import {
  useEffect,
  useRef,
  useState,
} from "react";

import { Link } from "react-router-dom";

import {
  createRcsBridgeTask,
  getRcsBridgeStatus,
  getRcsBridgeTask,
  getAllRcsBridgeTasks,
} from "../services/rcs";

import {
  validateTransfer,
  completeBasketTransfer,
} from "../utils/basketStore";

import "../styles/OverviewSettings.css";

const QUEUE_KEY = "wms-robot-tasks-v1";

const PRIORITIES = {
  30: "LOW",
  60: "NORMAL",
  90: "HIGH",
  120: "URGENT",
};

function loadQueue() {
  const value = JSON.parse(
    localStorage.getItem(QUEUE_KEY) || "[]"
  );

  if (!Array.isArray(value)) {
    throw new Error(
      "Invalid queue data. Restore the saved data before continuing."
    );
  }

  return value;
}

export function orderReady(
  queue,
  now = Date.now()
) {
  return queue
    .filter(
      (task) =>
        task.sendStatus === "NOT_SENT" &&
        (
          !task.scheduledSendAt ||
          Date.parse(task.scheduledSendAt) <= now
        )
    )
    .sort(
      (a, b) =>
        Number(b.rcsPriority || 60) -
          Number(a.rcsPriority || 60) ||
        Date.parse(a.createdAt) -
          Date.parse(b.createdAt) ||
        queue.indexOf(a) - queue.indexOf(b)
    );
}

export function commandFor(task) {
  return {
    robotTaskCode: task.warehouseTaskId,

    taskType:
      task.rcsTaskType || "CTUB1",

    initPriority: Number(
      task.rcsPriority || 60
    ),

    scheduledSendAt:
      task.scheduledSendAt || null,

    source: {
      type:
        task.sourceRcsTargetType || "STORAGE",

      code: task.sourceRcsPointCode,

      mapCode:
        task.sourceRcsMapCode || "",
    },

    destination: {
      type:
        task.destinationRcsTargetType || "STORAGE",

      code: task.destinationRcsPointCode,

      mapCode:
        task.destinationRcsMapCode || "",
    },
  };
}

async function timed(call) {
  const controller = new AbortController();

  const timer = window.setTimeout(
    () => controller.abort(),
    35000
  );

  try {
    return await call({
      signal: controller.signal,
    });
  } finally {
    window.clearTimeout(timer);
  }
}

function datetimeInput(value) {
  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return "";
  }

  return new Date(
    date.getTime() -
      date.getTimezoneOffset() * 60000
  )
    .toISOString()
    .slice(0, 16);
}

export default function RobotTaskDispatcher() {
  const [initial] = useState(() => {
    try {
      return {
        queue: loadQueue(),
        error: "",
      };
    } catch (error) {
      return {
        queue: [],
        error: error.message,
      };
    }
  });

  const [queue, setQueue] = useState(
    initial.queue
  );

  const [running, setRunning] = useState(false);

  const [message, setMessage] = useState(
    initial.error
  );

  const [details, setDetails] = useState("");

  const [now, setNow] = useState(Date.now());

  const queueRef = useRef(queue);
  const enabledRef = useRef(false);
  const busyRef = useRef(false);

  const blockedRef = useRef(
    Boolean(initial.error)
  );

  const aliveRef = useRef(true);

  function pause(text) {
    enabledRef.current = false;

    if (aliveRef.current) {
      setRunning(false);

      if (text) {
        setMessage(text);
      }
    }
  }

  function commit(next) {
    localStorage.setItem(
      QUEUE_KEY,
      JSON.stringify(next)
    );

    queueRef.current = next;

    if (aliveRef.current) {
      setQueue(next);
    }

    window.dispatchEvent(
      new CustomEvent("wms-data-changed", {
        detail: {
          keys: [QUEUE_KEY],
        },
      })
    );
  }

  function patch(id, changes, note) {
    commit(
      queueRef.current.map((task) => {
        if (task.id !== id) {
          return task;
        }

        return {
          ...task,
          ...changes,

          history: note
            ? [
                ...(task.history || []),

                {
                  id: crypto.randomUUID(),
                  type: "QUEUE_UPDATE",
                  at: new Date().toISOString(),
                  message: note,
                },
              ].slice(-300)
            : task.history,
        };
      })
    );
  }

  function applySnapshot(queueTask, response) {
    const task = response?.task;

    if (
      response?.mode !== "HIK" ||
      !task ||
      task.bridgeTaskId !== queueTask.bridgeTaskId ||
      task.rcsTaskChainCode !== queueTask.rcsTaskChainCode
    ) {
      throw new Error(
        "The RCS task response does not match this queue entry."
      );
    }

    const status = task.rcsStatus;

    if (
      ![
        "CREATED",
        "RUNNING",
        "COMPLETED",
        "FAILED",
        "CANCELLED",
        "CANCELED",
      ].includes(status)
    ) {
      throw new Error(
        `Unrecognized RCS status: ${status}`
      );
    }

    if (
      status === "COMPLETED" &&
      queueTask.basketId
    ) {
      completeBasketTransfer({
        ...queueTask,
        rcsStatus: status,
      });
    }

    const note =
      queueTask.rcsStatus !== status
        ? `RCS ${status}${
            status === "COMPLETED" &&
            queueTask.basketId
              ? ": basket location updated"
              : ""
          }`
        : "";

    patch(
      queueTask.id,
      {
        rcsStatus: status,
        backendError: "",
        lastStatusCheckAt:
          new Date().toISOString(),
      },
      note
    );

    if (
      [
        "FAILED",
        "CANCELLED",
        "CANCELED",
      ].includes(status)
    ) {
      pause(
        "Task stopped. Check the physical basket location before continuing."
      );
    }
  }

  async function pollActive() {
    const activeTasks = queueRef.current.filter(
      (task) =>
        task.sendStatus === "SENT" &&
        task.rcsStatus !== "COMPLETED"
    );

    for (const task of activeTasks) {
      try {
        if (!task.bridgeTaskId) {
          throw new Error(
            "Missing backend task ID. Check this task in RCS."
          );
        }

        const response = await timed(
          (options) =>
            getRcsBridgeTask(
              task.bridgeTaskId,
              options
            )
        );

        applySnapshot(task, response);
      } catch (error) {
        patch(task.id, {
          backendError: error.message,
        });

        pause(error.message);
      }
    }
  }

  async function tick() {
    if (
      busyRef.current ||
      blockedRef.current
    ) {
      return;
    }

    busyRef.current = true;

    try {
      await pollActive();

      // Recover location synchronization after a browser restart.
      for (const task of queueRef.current) {
        if (
          task.basketId &&
          task.rcsStatus === "COMPLETED"
        ) {
          completeBasketTransfer(task);
        }
      }

      if (!enabledRef.current) {
        return;
      }

      const uncertainTask = queueRef.current.some(
        (task) =>
          [
            "SENDING",
            "OUTCOME_UNKNOWN",
          ].includes(task.sendStatus)
      );

      if (uncertainTask) {
        pause(
          "An earlier submission has an unknown outcome. Check unresolved tasks first."
        );

        return;
      }

      const unfinishedTask = queueRef.current.some(
        (task) =>
          task.sendStatus === "SENT" &&
          task.rcsStatus !== "COMPLETED"
      );

      if (unfinishedTask) {
        return;
      }

      const next = orderReady(
        queueRef.current
      )[0];

      if (!next) {
        return;
      }

      if (!next.basketId) {
        pause(
          "This legacy task has no basket data. Review it and recreate an unsent transfer from Monitor."
        );

        return;
      }

      const bridge = await timed(
        getRcsBridgeStatus
      );

      if (
        bridge.bridgeMode !== "HIK" ||
        !bridge.hikConfigured
      ) {
        throw new Error(
          "Configure the HIK backend before starting the queue."
        );
      }

      // Priority may change while the backend check is running.
      if (
        !enabledRef.current ||
        !aliveRef.current ||
        orderReady(queueRef.current)[0]?.id !==
          next.id
      ) {
        return;
      }

      const liveTask = queueRef.current.find(
        (task) => task.id === next.id
      );

      const { from, to } = validateTransfer(
        liveTask.sourceLocationId,
        liveTask.destinationLocationId,
        liveTask.id,
        liveTask.basketId
      );

      if (
        from.code !== liveTask.sourceRcsPointCode ||
        to.code !== liveTask.destinationRcsPointCode
      ) {
        throw new Error(
          "Location codes changed. Remove this unsent task and recreate it."
        );
      }

      const sequence =
        Math.max(
          0,
          ...queueRef.current.map(
            (task) =>
              Number(task.dispatchSequence || 0)
          )
        ) + 1;

      // Save before POST so an uncertain result is never resent automatically.
      patch(
        liveTask.id,
        {
          sendStatus: "SENDING",
          dispatchSequence: sequence,
          sendStartedAt:
            new Date().toISOString(),
          backendError: "",
        },
        "Submitting to RCS"
      );

      try {
        const response = await timed(
          (options) =>
            createRcsBridgeTask(
              commandFor(liveTask),
              options
            )
        );

        if (
          response.mode !== "HIK" ||
          !response.bridgeTaskId ||
          !response.rcsTaskChainCode
        ) {
          throw new Error(
            "Submission returned no confirmed task ID."
          );
        }

        patch(
          liveTask.id,
          {
            sendStatus: "SENT",

            bridgeTaskId:
              response.bridgeTaskId,

            rcsTaskChainCode:
              response.rcsTaskChainCode,

            bridgeMode: "HIK",
            rcsStatus: "CREATED",

            sentAt:
              new Date().toISOString(),
          },
          "RCS accepted the task; waiting for completion"
        );
      } catch (error) {
        patch(
          liveTask.id,
          {
            sendStatus: "OUTCOME_UNKNOWN",
            backendError: error.message,
          },
          "Check submission outcome before retrying"
        );

        pause(error.message);
      }
    } catch (error) {
      pause(error.message);
    } finally {
      busyRef.current = false;
    }
  }

  async function reconcile() {
    if (
      busyRef.current ||
      blockedRef.current
    ) {
      return;
    }

    pause();
    busyRef.current = true;

    try {
      const response = await timed(
        getAllRcsBridgeTasks
      );

      if (
        response.mode !== "HIK" ||
        !Array.isArray(response.tasks)
      ) {
        throw new Error(
          "Unexpected backend task list."
        );
      }

      for (const queueTask of [
        ...queueRef.current,
      ]) {
        if (
          ![
            "SENDING",
            "OUTCOME_UNKNOWN",
          ].includes(queueTask.sendStatus)
        ) {
          continue;
        }

        const matches = response.tasks.filter(
          (task) =>
            task.robotTaskCode ===
              queueTask.warehouseTaskId &&
            task.source?.code ===
              queueTask.sourceRcsPointCode &&
            task.destination?.code ===
              queueTask.destinationRcsPointCode
        );

        if (
          matches.length !== 1 ||
          !matches[0].bridgeTaskId ||
          !matches[0].rcsTaskChainCode
        ) {
          continue;
        }

        const task = matches[0];

        const recovered = {
          ...queueTask,

          sendStatus: "SENT",
          bridgeTaskId: task.bridgeTaskId,
          rcsTaskChainCode:
            task.rcsTaskChainCode,

          bridgeMode: "HIK",
          rcsStatus: "CREATED",
        };

        patch(
          queueTask.id,
          recovered,
          "Recovered backend submission"
        );

        applySnapshot(recovered, {
          mode: "HIK",
          task,
        });
      }

      setMessage(
        "Backend records checked. Unmatched tasks remain blocked; nothing was resubmitted."
      );
    } catch (error) {
      setMessage(error.message);
    } finally {
      busyRef.current = false;
    }
  }

  useEffect(() => {
    aliveRef.current = true;

    function enqueue(event) {
      const request = event.detail;

      if (!request || request.handled) {
        return;
      }

      request.handled = true;

      try {
        if (blockedRef.current) {
          throw new Error(
            "Queue storage is unreadable."
          );
        }

        const {
          draft,
          from,
          to,
          scheduledSendAt,
        } = request.payload;

        const current = validateTransfer(
          from.id,
          to.id
        );

        const priority = Number(
          draft.initPriority
        );

        if (!PRIORITIES[priority]) {
          throw new Error(
            "Invalid priority."
          );
        }

        const time =
          scheduledSendAt ||
          new Date().toISOString();

        if (!Number.isFinite(Date.parse(time))) {
          throw new Error(
            "Invalid scheduled time."
          );
        }

        const id =
          `RCSQ-${crypto.randomUUID()}`;

        commit([
          ...queueRef.current,

          {
            id,

            warehouseTaskId:
              `MON-${crypto.randomUUID()}`,

            origin: "MONITOR",
            type: "STORAGE_TRANSFER",

            basketId:
              current.from.basket.id,

            rcsTaskType:
              draft.taskType || "CTUB1",

            sourceLocationId:
              current.from.id,

            destinationLocationId:
              current.to.id,

            sourceRcsPointCode:
              current.from.code,

            destinationRcsPointCode:
              current.to.code,

            sourceRcsTargetType: "STORAGE",
            destinationRcsTargetType: "STORAGE",

            wmsPriority: PRIORITIES[priority],
            rcsPriority: priority,
            scheduledSendAt: time,

            createdAt:
              new Date().toISOString(),

            sendStatus: "NOT_SENT",
            rcsStatus: "NOT_SENT",
            history: [],
          },
        ]);
      } catch (error) {
        request.error = error.message;
      }
    }

    function storage(event) {
      if (
        event.key !== QUEUE_KEY &&
        event.key !== null
      ) {
        return;
      }

      pause(
        "Queue changed in another tab. Use one WMS tab for dispatch."
      );

      try {
        queueRef.current = loadQueue();
        setQueue(queueRef.current);
        blockedRef.current = false;
      } catch (error) {
        blockedRef.current = true;
        setMessage(error.message);
      }
    }

    window.addEventListener(
      "wms-rcs-enqueue-request",
      enqueue
    );

    window.addEventListener(
      "storage",
      storage
    );

    const timer = window.setInterval(() => {
      setNow(Date.now());
      void tick();
    }, 1000);

    return () => {
      aliveRef.current = false;
      enabledRef.current = false;

      window.clearInterval(timer);

      window.removeEventListener(
        "wms-rcs-enqueue-request",
        enqueue
      );

      window.removeEventListener(
        "storage",
        storage
      );
    };
  }, []);

  function edit(id, value) {
    try {
      const task = queueRef.current.find(
        (entry) => entry.id === id
      );

      if (task?.sendStatus !== "NOT_SENT") {
        return;
      }

      patch(id, value);
    } catch (error) {
      pause(error.message);
    }
  }

  function removeUnsent(id) {
    try {
      commit(
        queueRef.current.filter(
          (task) =>
            task.id !== id ||
            task.sendStatus !== "NOT_SENT"
        )
      );
    } catch (error) {
      pause(error.message);
    }
  }

  const ready = orderReady(queue, now);

  const readyIds = new Map(
    ready.map((task, index) => [
      task.id,
      index + 1,
    ])
  );

  const pending = queue
    .filter(
      (task) =>
        task.sendStatus === "NOT_SENT"
    )
    .sort(
      (a, b) =>
        (readyIds.get(a.id) || 100000) -
          (readyIds.get(b.id) || 100000) ||
        Date.parse(a.scheduledSendAt) -
          Date.parse(b.scheduledSendAt)
    );

  const submitted = queue
    .filter(
      (task) =>
        task.sendStatus !== "NOT_SENT"
    )
    .sort(
      (a, b) =>
        Number(b.dispatchSequence || 0) -
        Number(a.dispatchSequence || 0)
    );

  const detailTask = queue.find(
    (task) => task.id === details
  );

  return (
    <div className="page wms-overview">
      <div className="page-header">
        <div>
          <span className="page-label">
            RCS DISPATCH
          </span>

          <h2>Basket transfer queue</h2>

          <p>
            Schedule transfers here. Higher priority
            eligible work follows the active task.
          </p>
        </div>
      </div>

      <section className="panel overview-section">
        <div className="overview-actions">
          <Link to="/warehouse">
            Create transfer in Monitor
          </Link>

          <button
            type="button"
            className="primary-button"
            disabled={
              running ||
              blockedRef.current
            }
            onClick={() => {
              enabledRef.current = true;
              setRunning(true);

              setMessage(
                "Queue started. Keep this WMS tab open."
              );
            }}
          >
            Start Queue
          </button>

          <button
            type="button"
            className="primary-button"
            disabled={!running}
            onClick={() =>
              pause(
                "Queue paused. The active robot task continues."
              )
            }
          >
            Pause Queue
          </button>

          <button
            type="button"
            className="primary-button"
            onClick={reconcile}
          >
            Check unresolved tasks
          </button>
        </div>

        <p role="status">
          {message ||
            (
              running
                ? "Queue running"
                : "Queue paused"
            )}
        </p>
      </section>

      <section className="panel overview-section">
        <h3>
          Waiting transfers · {pending.length}
        </h3>

        <div className="table-wrapper">
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>Ready order</th>
                <th>Basket / route</th>
                <th>Priority</th>
                <th>Scheduled send time</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {pending.length === 0 && (
                <tr>
                  <td colSpan={5}>
                    No waiting transfers.
                  </td>
                </tr>
              )}

              {pending.map((task) => (
                <tr key={task.id}>
                  <td>
                    {readyIds.get(task.id) ||
                      "Scheduled"}
                  </td>

                  <td>
                    <strong>
                      {task.basketId ||
                        "Legacy task"}
                    </strong>

                    <br />

                    {task.sourceRcsPointCode}
                    {" → "}
                    {task.destinationRcsPointCode}
                  </td>

                  <td>
                    <select
                      aria-label={
                        `Priority ${task.id}`
                      }
                      value={
                        task.rcsPriority || 60
                      }
                      onChange={(event) =>
                        edit(task.id, {
                          rcsPriority: Number(
                            event.target.value
                          ),

                          wmsPriority:
                            PRIORITIES[
                              event.target.value
                            ],
                        })
                      }
                    >
                      {Object.entries(
                        PRIORITIES
                      ).map(([value, label]) => (
                        <option
                          key={value}
                          value={value}
                        >
                          {label}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td>
                    <input
                      aria-label={
                        `Send time ${task.id}`
                      }
                      type="datetime-local"
                      value={datetimeInput(
                        task.scheduledSendAt
                      )}
                      onChange={(event) => {
                        const value =
                          event.target.value
                            ? new Date(
                                event.target.value
                              )
                            : new Date();

                        if (
                          Number.isFinite(
                            value.getTime()
                          )
                        ) {
                          edit(task.id, {
                            scheduledSendAt:
                              value.toISOString(),
                          });
                        }
                      }}
                    />
                  </td>

                  <td>
                    <button
                      type="button"
                      onClick={() =>
                        removeUnsent(task.id)
                      }
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel overview-section">
        <h3>
          Submitted tasks · {submitted.length}
        </h3>

        <div className="table-wrapper">
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>Send order</th>
                <th>Basket / route</th>
                <th>Status</th>
                <th>RCS task ID</th>
                <th>Details</th>
              </tr>
            </thead>

            <tbody>
              {submitted.length === 0 && (
                <tr>
                  <td colSpan={5}>
                    No submitted tasks.
                  </td>
                </tr>
              )}

              {submitted.map((task) => (
                <tr key={task.id}>
                  <td>
                    {task.dispatchSequence || "—"}
                  </td>

                  <td>
                    {task.basketId ||
                      "Legacy task"}

                    <br />

                    {task.sourceRcsPointCode}
                    {" → "}
                    {task.destinationRcsPointCode}
                  </td>

                  <td>
                    {task.backendError
                      ? "Needs attention"
                      : task.sendStatus === "SENT"
                      ? task.rcsStatus
                      : task.sendStatus}
                  </td>

                  <td>
                    {task.rcsTaskChainCode ||
                      "Unconfirmed"}
                  </td>

                  <td>
                    <button
                      type="button"
                      onClick={() =>
                        setDetails(
                          details === task.id
                            ? ""
                            : task.id
                        )
                      }
                    >
                      Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {detailTask && (
          <div className="overview-notice">
            <p>
              {detailTask.backendError ||
                detailTask.rcsStatus}
            </p>

            <ul>
              {(detailTask.history || []).map(
                (entry, index) => (
                  <li key={entry.id || index}>
                    {entry.at || entry.createdAt}
                    {" · "}
                    {entry.message}
                  </li>
                )
              )}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}