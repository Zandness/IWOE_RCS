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

const KEY = "wms-robot-tasks-v1";

const PRIORITIES = {
  30: "LOW",
  60: "NORMAL",
  90: "HIGH",
  120: "URGENT",
};

function loadQueue() {
  const value = JSON.parse(
    localStorage.getItem(KEY) || "[]",
  );

  if (!Array.isArray(value)) {
    throw new Error(
      "Invalid queue data. Restore the saved data before continuing.",
    );
  }

  return value;
}

export function orderReady(
  queue,
  now = Date.now(),
) {
  return queue
    .filter(
      (task) =>
        task.sendStatus === "NOT_SENT" &&
        (
          !task.scheduledSendAt ||
          Date.parse(task.scheduledSendAt) <= now
        ),
    )
    .sort(
      (a, b) =>
        Number(b.rcsPriority || 60) -
          Number(a.rcsPriority || 60) ||
        Date.parse(a.createdAt) -
          Date.parse(b.createdAt) ||
        queue.indexOf(a) - queue.indexOf(b),
    );
}

export function commandFor(task) {
  return {
    robotTaskCode: task.warehouseTaskId,
    taskType: task.rcsTaskType || "CTUB1",
    initPriority: Number(task.rcsPriority || 60),
    scheduledSendAt: task.scheduledSendAt || null,

    source: {
      type: task.sourceRcsTargetType || "STORAGE",
      code: task.sourceRcsPointCode,
      autoStart: 1,
      mapCode: task.sourceRcsMapCode || "",
    },

    destination: {
      type: task.destinationRcsTargetType || "STORAGE",
      code: task.destinationRcsPointCode,
      autoStart: 1,
      mapCode: task.destinationRcsMapCode || "",
    },
  };
}

async function timed(call) {
  const controller = new AbortController();

  const timer = window.setTimeout(
    () => controller.abort(),
    35000,
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
      date.getTimezoneOffset() * 60000,
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

  const [queue, setQueue] = useState(initial.queue);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState(initial.error);
  const [details, setDetails] = useState("");
  const [now, setNow] = useState(Date.now());

  const ref = useRef(queue);
  const enabled = useRef(false);
  const busy = useRef(false);
  const blocked = useRef(Boolean(initial.error));
  const alive = useRef(true);

  const [checking, setChecking] = useState(false);

  const [connection, setConnection] = useState(
    "Backend not checked",
  );

  const checkingRef = useRef(false);
  const startVersion = useRef(0);

  async function startQueue() {
    if (checkingRef.current || blocked.current) {
      return;
    }

    checkingRef.current = true;

    const ticket = ++startVersion.current;

    setChecking(true);
    setConnection("Checking backend…");

    try {
      const status = await timed(getRcsBridgeStatus);

      if (
        ticket !== startVersion.current ||
        !alive.current
      ) {
        return;
      }

      if (
        !status.ok ||
        status.bridgeMode !== "HIK" ||
        !status.hikConfigured
      ) {
        throw new Error(
          "Backend must run in HIK mode with an RCS address. Check Settings before starting.",
        );
      }

      setConnection(
        `HIK backend ready · ${new Date().toLocaleTimeString()}`,
      );

      if (
        ref.current.some((task) =>
          ["SENDING", "OUTCOME_UNKNOWN"].includes(
            task.sendStatus,
          ),
        )
      ) {
        throw new Error(
          "An earlier submission is unresolved. Check unresolved tasks before starting.",
        );
      }

      enabled.current = true;

      setRunning(true);

      setMessage(
        "Queue started. Eligible transfers will be sent automatically. Keep this WMS tab open.",
      );
    } catch (error) {
      if (
        ticket === startVersion.current &&
        alive.current
      ) {
        setConnection(error.message);
        pause(error.message);
      }
    } finally {
      checkingRef.current = false;

      if (alive.current) {
        setChecking(false);
      }
    }
  }

  function pause(text) {
    startVersion.current += 1;
    enabled.current = false;

    if (alive.current) {
      setRunning(false);

      if (text) {
        setMessage(text);
      }
    }
  }

  function commit(next) {
    localStorage.setItem(
      KEY,
      JSON.stringify(next),
    );

    ref.current = next;

    if (alive.current) {
      setQueue(next);
    }

    window.dispatchEvent(
      new CustomEvent("wms-data-changed", {
        detail: {
          keys: [KEY],
        },
      }),
    );
  }

  function patch(id, changes, note) {
    commit(
      ref.current.map((task) =>
        task.id !== id
          ? task
          : {
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
            },
      ),
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
        "The RCS task response does not match this queue entry.",
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
        `Unrecognized RCS status: ${status}`,
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

    patch(
      queueTask.id,

      {
        rcsStatus: status,
        backendError: "",
        lastStatusCheckAt: new Date().toISOString(),
      },

      queueTask.rcsStatus !== status
        ? `RCS ${status}${
            status === "COMPLETED" &&
            queueTask.basketId
              ? ": basket location updated"
              : ""
          }`
        : "",
    );

    if (
      ["FAILED", "CANCELLED", "CANCELED"].includes(
        status,
      )
    ) {
      pause(
        "Task stopped. Check the physical basket location before continuing.",
      );
    }
  }

  async function pollActive() {
    const active = ref.current.filter(
      (task) =>
        task.sendStatus === "SENT" &&
        task.rcsStatus !== "COMPLETED",
    );

    for (const task of active) {
      try {
        if (!task.bridgeTaskId) {
          throw new Error(
            "Missing backend task ID. Check this task in RCS.",
          );
        }

        const response = await timed(
          (options) =>
            getRcsBridgeTask(
              task.bridgeTaskId,
              options,
            ),
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
    if (busy.current || blocked.current) {
      return;
    }

    busy.current = true;

    try {
      await pollActive();

      // Recover a confirmed completion after a reload.
      for (const task of ref.current) {
        if (
          task.basketId &&
          task.rcsStatus === "COMPLETED"
        ) {
          completeBasketTransfer(task);
        }
      }

      if (!enabled.current) {
        return;
      }

      if (
        ref.current.some((task) =>
          ["SENDING", "OUTCOME_UNKNOWN"].includes(
            task.sendStatus,
          ),
        )
      ) {
        pause(
          "An earlier submission has an unknown outcome. Check unresolved tasks first.",
        );

        return;
      }

      if (
        ref.current.some(
          (task) =>
            task.sendStatus === "SENT" &&
            task.rcsStatus !== "COMPLETED",
        )
      ) {
        return;
      }

      const next = orderReady(ref.current)[0];

      if (!next) {
        return;
      }

      if (!next.basketId) {
        pause(
          "This legacy task has no basket data. Review it and recreate an unsent transfer from Monitor.",
        );

        return;
      }

      const bridge = await timed(
        getRcsBridgeStatus,
      );

      if (
        bridge.bridgeMode !== "HIK" ||
        !bridge.hikConfigured
      ) {
        throw new Error(
          "Configure the HIK backend before starting the queue.",
        );
      }

      // A more urgent task may arrive during the check.
      if (
        !enabled.current ||
        !alive.current ||
        orderReady(ref.current)[0]?.id !== next.id
      ) {
        return;
      }

      const live = ref.current.find(
        (task) => task.id === next.id,
      );

      const { from, to } = validateTransfer(
        live.sourceLocationId,
        live.destinationLocationId,
        live.id,
        live.basketId,
      );

      if (
        from.code !== live.sourceRcsPointCode ||
        to.code !== live.destinationRcsPointCode
      ) {
        throw new Error(
          "Location codes changed. Remove this unsent task and recreate it.",
        );
      }

      const sequence =
        Math.max(
          0,
          ...ref.current.map((task) =>
            Number(task.dispatchSequence || 0),
          ),
        ) + 1;

      // Persist before sending. Do not blindly retry.
      patch(
        live.id,

        {
          sendStatus: "SENDING",
          dispatchSequence: sequence,
          sendStartedAt: new Date().toISOString(),
          backendError: "",
        },

        "Submitting to RCS",
      );

      try {
        const response = await timed(
          (options) =>
            createRcsBridgeTask(
              commandFor(live),
              options,
            ),
        );

        if (
          response.mode !== "HIK" ||
          !response.bridgeTaskId ||
          !response.rcsTaskChainCode
        ) {
          throw new Error(
            "Submission returned no confirmed task ID.",
          );
        }

        patch(
          live.id,

          {
            sendStatus: "SENT",
            bridgeTaskId: response.bridgeTaskId,
            rcsTaskChainCode: response.rcsTaskChainCode,
            bridgeMode: "HIK",
            rcsStatus: "CREATED",
            sentAt: new Date().toISOString(),
          },

          "RCS accepted the task; waiting for completion",
        );
      } catch (error) {
        patch(
          live.id,

          {
            sendStatus: "OUTCOME_UNKNOWN",
            backendError: error.message,
          },

          "Check submission outcome before retrying",
        );

        pause(error.message);
      }
    } catch (error) {
      pause(error.message);
    } finally {
      busy.current = false;
    }
  }

  async function reconcile() {
    if (busy.current || blocked.current) {
      return;
    }

    pause();
    busy.current = true;

    try {
      const response = await timed(
        getAllRcsBridgeTasks,
      );

      if (
        response.mode !== "HIK" ||
        !Array.isArray(response.tasks)
      ) {
        throw new Error(
          "Unexpected backend task list.",
        );
      }

      for (const queueTask of [...ref.current]) {
        if (
          !["SENDING", "OUTCOME_UNKNOWN"].includes(
            queueTask.sendStatus,
          )
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
              queueTask.destinationRcsPointCode,
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
          rcsTaskChainCode: task.rcsTaskChainCode,
          bridgeMode: "HIK",
          rcsStatus: "CREATED",
        };

        patch(
          queueTask.id,
          recovered,
          "Recovered backend submission",
        );

        applySnapshot(recovered, {
          mode: "HIK",
          task,
        });
      }

      setMessage(
        "Backend records checked. Unmatched tasks remain blocked; nothing was resubmitted.",
      );
    } catch (error) {
      setMessage(error.message);
    } finally {
      busy.current = false;
    }
  }

  useEffect(() => {
    alive.current = true;

    function enqueue(event) {
      const request = event.detail;

      if (!request || request.handled) {
        return;
      }

      request.handled = true;

      try {
        if (blocked.current) {
          throw new Error(
            "Queue storage is unreadable.",
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
          to.id,
        );

        const taskType =
          typeof draft.taskType === "string"
            ? draft.taskType.trim()
            : "";

        if (!taskType) {
          throw new Error(
            "Enter the task type registered in RCS.",
          );
        }

        const priority = Number(
          draft.initPriority,
        );

        if (!PRIORITIES[priority]) {
          throw new Error("Invalid priority.");
        }

        const time =
          scheduledSendAt ||
          new Date().toISOString();

        if (!Number.isFinite(Date.parse(time))) {
          throw new Error(
            "Invalid scheduled time.",
          );
        }

        const id = `RCSQ-${crypto.randomUUID()}`;

        commit([
          ...ref.current,

          {
            id,

            warehouseTaskId:
              `MON-${crypto.randomUUID()}`,

            origin: "MONITOR",
            type: "STORAGE_TRANSFER",
            basketId: current.from.basket.id,

            rcsTaskType: taskType,

            sourceLocationId: current.from.id,
            destinationLocationId: current.to.id,

            sourceRcsPointCode: current.from.code,
            destinationRcsPointCode: current.to.code,

            sourceRcsTargetType: "STORAGE",
            destinationRcsTargetType: "STORAGE",

            wmsPriority: PRIORITIES[priority],
            rcsPriority: priority,

            scheduledSendAt: time,
            createdAt: new Date().toISOString(),

            sendStatus: "NOT_SENT",
            rcsStatus: "NOT_SENT",
            history: [],
          },
        ]);

        if (request.payload.startAfterEnqueue) {
          void startQueue();
        }
      } catch (error) {
        request.error = error.message;
      }
    }

    function storage(event) {
      if (
        event.key !== KEY &&
        event.key !== null
      ) {
        return;
      }

      pause(
        "Queue changed in another tab. Use one WMS tab for dispatch.",
      );

      try {
        ref.current = loadQueue();
        setQueue(ref.current);
        blocked.current = false;
      } catch (error) {
        blocked.current = true;
        setMessage(error.message);
      }
    }

    window.addEventListener(
      "wms-rcs-enqueue-request",
      enqueue,
    );

    window.addEventListener(
      "storage",
      storage,
    );

    const timer = window.setInterval(() => {
      setNow(Date.now());
      void tick();
    }, 1000);

    return () => {
      alive.current = false;
      enabled.current = false;

      window.clearInterval(timer);

      window.removeEventListener(
        "wms-rcs-enqueue-request",
        enqueue,
      );

      window.removeEventListener(
        "storage",
        storage,
      );
    };
  }, []);

  function edit(id, value) {
    try {
      const item = ref.current.find(
        (task) => task.id === id,
      );

      if (item?.sendStatus !== "NOT_SENT") {
        return;
      }

      patch(id, value);
    } catch (error) {
      pause(error.message);
    }
  }

  const active = queue.find(
    (task) =>
      task.sendStatus === "SENT" &&
      task.rcsStatus !== "COMPLETED",
  );

  const ready = orderReady(queue, now);

  const readyIds = new Map(
    ready.map((task, index) => [
      task.id,
      index + 1,
    ]),
  );

  const pending = queue
    .filter(
      (task) => task.sendStatus === "NOT_SENT",
    )
    .sort(
      (a, b) =>
        (readyIds.get(a.id) || 100000) -
          (readyIds.get(b.id) || 100000) ||
        Date.parse(a.scheduledSendAt) -
          Date.parse(b.scheduledSendAt),
    );

  const submitted = queue
    .filter(
      (task) => task.sendStatus !== "NOT_SENT",
    )
    .sort(
      (a, b) =>
        Number(b.dispatchSequence || 0) -
        Number(a.dispatchSequence || 0),
    );

  const detailTask = queue.find(
    (task) => task.id === details,
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
            Create transfers in Monitor, then start
            this queue. Ready tasks run by priority,
            then arrival order. The active task finishes first.
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
              checking ||
              blocked.current
            }
            onClick={startQueue}
          >
            {checking
              ? "Checking backend…"
              : "Start Queue"}
          </button>

          <button
            type="button"
            className="primary-button"
            disabled={!running && !checking}
            onClick={() =>
              pause(
                "Queue paused. The active robot task continues.",
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

        <p>
          <strong>
            {running
              ? "Queue running"
              : "Queue paused"}
          </strong>
          {" · "}
          {ready.length} ready
          {" · "}
          {pending.length - ready.length} scheduled
        </p>

        <p role="status">{message}</p>

        <p>
          {connection}
          {" · "}
          <Link to="/settings">
            Connection settings
          </Link>
        </p>

        {active && (
          <div className="overview-notice">
            <strong>
              Active transfer:{" "}
              {active.basketId || "Previous task"}
            </strong>

            <p>
              {active.sourceRcsPointCode} →{" "}
              {active.destinationRcsPointCode}
              {" · "}
              {active.rcsStatus}
            </p>

            <p>
              Task type: {active.rcsTaskType || "CTUB1"}
              {" · "}
              RCS task: {active.rcsTaskChainCode}
            </p>

            <p>
              {active.backendError ||
                "Checking task status automatically. The basket location updates after confirmed completion."}
            </p>

            {active.lastStatusCheckAt && (
              <small>
                Last checked:{" "}
                {new Date(
                  active.lastStatusCheckAt,
                ).toLocaleString()}
              </small>
            )}
          </div>
        )}
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
                <th>Task type</th>
                <th>Basket / route</th>
                <th>Priority</th>
                <th>Scheduled send time</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {!pending.length && (
                <tr>
                  <td colSpan={6}>
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

                  <td>{task.rcsTaskType || "CTUB1"}</td>

                  <td>
                    <strong>
                      {task.basketId || "Legacy task"}
                    </strong>

                    <br />

                    {task.sourceRcsPointCode} →{" "}
                    {task.destinationRcsPointCode}
                  </td>

                  <td>
                    <select
                      aria-label={`Priority ${task.id}`}
                      value={task.rcsPriority || 60}
                      onChange={(event) =>
                        edit(task.id, {
                          rcsPriority: Number(
                            event.target.value,
                          ),

                          wmsPriority:
                            PRIORITIES[event.target.value],
                        })
                      }
                    >
                      {Object.entries(PRIORITIES).map(
                        ([value, label]) => (
                          <option
                            key={value}
                            value={value}
                          >
                            {label}
                          </option>
                        ),
                      )}
                    </select>
                  </td>

                  <td>
                    <input
                      aria-label={`Send time ${task.id}`}
                      type="datetime-local"
                      value={datetimeInput(
                        task.scheduledSendAt,
                      )}
                      onChange={(event) => {
                        const value = event.target.value
                          ? new Date(event.target.value)
                          : new Date();

                        if (
                          Number.isFinite(value.getTime())
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
                      onClick={() => {
                        try {
                          commit(
                            ref.current.filter(
                              (item) =>
                                item.id !== task.id ||
                                item.sendStatus !== "NOT_SENT",
                            ),
                          );
                        } catch (error) {
                          pause(error.message);
                        }
                      }}
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
                <th>Task type</th>
                <th>Basket / route</th>
                <th>Status</th>
                <th>RCS task ID</th>
                <th>Details</th>
              </tr>
            </thead>

            <tbody>
              {!submitted.length && (
                <tr>
                  <td colSpan={6}>
                    No submitted tasks.
                  </td>
                </tr>
              )}

              {submitted.map((task) => (
                <tr key={task.id}>
                  <td>
                    {task.dispatchSequence || "—"}
                  </td>

                  <td>{task.rcsTaskType || "CTUB1"}</td>

                  <td>
                    {task.basketId || "Legacy task"}

                    <br />

                    {task.sourceRcsPointCode} →{" "}
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
                            : task.id,
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
              Task type: {detailTask.rcsTaskType || "CTUB1"}
            </p>

            <p>
              {detailTask.backendError ||
                detailTask.rcsStatus}
            </p>

            <ul>
              {(detailTask.history || []).map(
                (record, index) => (
                  <li key={record.id || index}>
                    {record.at || record.createdAt}
                    {" · "}
                    {record.message}
                  </li>
                ),
              )}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}