import { useEffect, useRef, useState } from "react";
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

const TARGET_TYPES = ["STORAGE", "SITE", "CARRIER"];

const PRIORITIES = {
  30: "LOW",
  60: "NORMAL",
  90: "HIGH",
  120: "URGENT",
};

const TABLE_STYLE = {
  minWidth: 860,
};

const CELL_STYLE = {
  overflowWrap: "anywhere",
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

function normalizeTargetType(value) {
  const type = value == null || value === ""
    ? "STORAGE"
    : value;

  if (!TARGET_TYPES.includes(type)) {
    throw new Error(`Unsupported RCS target type: ${type}`);
  }

  return type;
}

function normalizeTarget(value, fallbackCode, label) {
  // Compatibility with the original Monitor form:
  // missing target objects use STORAGE and the WMS location code.
  if (
    value != null &&
    (typeof value !== "object" || Array.isArray(value))
  ) {
    throw new Error(`Invalid ${label} RCS target.`);
  }

  const type = normalizeTargetType(value?.type);

  const rawCode = value == null
    ? fallbackCode
    : value.code;

  if (typeof rawCode !== "string" || !rawCode.trim()) {
    throw new Error(`Enter the ${label} RCS target code.`);
  }

  return {
    type,
    code: rawCode.trim(),
  };
}

function targetsFor(task) {
  const source = normalizeTarget(
    {
      type: task.sourceRcsTargetType,
      code: task.sourceRcsPointCode,
    },
    "",
    "source",
  );

  const destination = normalizeTarget(
    {
      type: task.destinationRcsTargetType,
      code: task.destinationRcsPointCode,
    },
    "",
    "destination",
  );

  if (
    source.type === destination.type &&
    source.code === destination.code
  ) {
    throw new Error(
      "Source and destination RCS targets must differ.",
    );
  }

  return { source, destination };
}

export function orderReady(queue, now = Date.now()) {
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
  const { source, destination } = targetsFor(task);

  const robotCode = String(task.rcsRobotCode || "").trim();

  return {
    robotTaskCode: task.warehouseTaskId,
    taskType: task.rcsTaskType || "CTUB1",

    ...(robotCode ? { robotCode } : {}),

    initPriority: Number(task.rcsPriority || 60),
    scheduledSendAt: task.scheduledSendAt || null,

    source: {
      ...source,
      autoStart: 1,
      mapCode: task.sourceRcsMapCode || "",
    },

    destination: {
      ...destination,
      autoStart: 1,
      mapCode: task.destinationRcsMapCode || "",
    },
  };
}

function commandText(task) {
  try {
    return JSON.stringify(commandFor(task), null, 2);
  } catch (error) {
    return `Cannot prepare command: ${error.message}`;
  }
}

function assertWmsLocationsUnchanged(task, from, to) {
  // New entries preserve WMS codes separately from RCS codes.
  // Old entries used the WMS code directly as the RCS code.
  const sourceWmsCode = Object.prototype.hasOwnProperty.call(
    task,
    "sourceWmsLocationCode",
  )
    ? task.sourceWmsLocationCode
    : task.sourceRcsPointCode;

  const destinationWmsCode = Object.prototype.hasOwnProperty.call(
    task,
    "destinationWmsLocationCode",
  )
    ? task.destinationWmsLocationCode
    : task.destinationRcsPointCode;

  if (
    String(from.code || "") !== String(sourceWmsCode || "") ||
    String(to.code || "") !== String(destinationWmsCode || "")
  ) {
    throw new Error(
      "WMS location codes changed. Remove this unsent task and recreate it.",
    );
  }
}

async function timed(call) {
  const controller = new AbortController();

  const timer = window.setTimeout(
    () => controller.abort(),
    35000,
  );

  try {
    return await call({ signal: controller.signal });
  } finally {
    window.clearTimeout(timer);
  }
}

function datetimeInput(value) {
  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) return "";

  return new Date(
    date.getTime() - date.getTimezoneOffset() * 60000,
  )
    .toISOString()
    .slice(0, 16);
}

function RouteText({ task }) {
  return (
    <span>
      {task.sourceRcsTargetType || "STORAGE"}
      {": "}
      {task.sourceRcsPointCode}
      <br />
      {"→ "}
      {task.destinationRcsTargetType || "STORAGE"}
      {": "}
      {task.destinationRcsPointCode}
    </span>
  );
}

export default function RobotTaskDispatcher() {
  const [initial] = useState(() => {
    try {
      return { queue: loadQueue(), error: "" };
    } catch (error) {
      return { queue: [], error: error.message };
    }
  });

  const [queue, setQueue] = useState(initial.queue);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState(initial.error);
  const [details, setDetails] = useState("");
  const [now, setNow] = useState(Date.now());
  const [checking, setChecking] = useState(false);
  const [connection, setConnection] = useState(
    "Backend not checked",
  );

  const ref = useRef(queue);
  const enabled = useRef(false);
  const busy = useRef(false);
  const blocked = useRef(Boolean(initial.error));
  const alive = useRef(true);
  const checkingRef = useRef(false);
  const startVersion = useRef(0);

  function pause(text) {
    startVersion.current += 1;
    enabled.current = false;

    if (alive.current) {
      setRunning(false);
      if (text) setMessage(text);
    }
  }

  async function startQueue() {
    if (checkingRef.current || blocked.current) return;

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
          ["SENDING", "OUTCOME_UNKNOWN"].includes(task.sendStatus),
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
      if (alive.current) setChecking(false);
    }
  }

  function commit(next) {
    localStorage.setItem(KEY, JSON.stringify(next));
    ref.current = next;

    if (alive.current) setQueue(next);

    window.dispatchEvent(
      new CustomEvent("wms-data-changed", {
        detail: { keys: [KEY] },
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
      throw new Error(`Unrecognized RCS status: ${status}`);
    }

    if (status === "COMPLETED" && queueTask.basketId) {
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
            status === "COMPLETED" && queueTask.basketId
              ? ": load location updated"
              : ""
          }`
        : "",
    );

    if (["FAILED", "CANCELLED", "CANCELED"].includes(status)) {
      pause(
        "Task stopped. Check the physical load location before continuing.",
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

        const response = await timed((options) =>
          getRcsBridgeTask(task.bridgeTaskId, options),
        );

        applySnapshot(task, response);
      } catch (error) {
        patch(task.id, { backendError: error.message });
        pause(error.message);
      }
    }
  }

  async function tick() {
    if (busy.current || blocked.current) return;
    busy.current = true;

    try {
      await pollActive();

      for (const task of ref.current) {
        if (task.basketId && task.rcsStatus === "COMPLETED") {
          completeBasketTransfer(task);
        }
      }

      if (!enabled.current) return;

      if (
        ref.current.some((task) =>
          ["SENDING", "OUTCOME_UNKNOWN"].includes(task.sendStatus),
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
      if (!next) return;

      if (!next.basketId) {
        pause(
          "This legacy task has no load data. Review it and recreate an unsent transfer from Monitor.",
        );
        return;
      }

      const bridge = await timed(getRcsBridgeStatus);

      if (
        !bridge.ok ||
        bridge.bridgeMode !== "HIK" ||
        !bridge.hikConfigured
      ) {
        throw new Error(
          "Configure the HIK backend before starting the queue.",
        );
      }

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

      if (!live || live.sendStatus !== "NOT_SENT") return;

      const { from, to } = validateTransfer(
        live.sourceLocationId,
        live.destinationLocationId,
        live.id,
        live.basketId,
      );

      assertWmsLocationsUnchanged(live, from, to);

      // Validate and prepare the exact bridge request before
      // marking the entry as SENDING.
      const command = commandFor(live);

      const sequence =
        Math.max(
          0,
          ...ref.current.map((task) => {
            const value = Number(task.dispatchSequence || 0);
            return Number.isFinite(value) ? value : 0;
          }),
        ) + 1;

      patch(
        live.id,
        {
          sendStatus: "SENDING",
          dispatchSequence: sequence,
          sendStartedAt: new Date().toISOString(),
          backendError: "",

          // Store the frontend-to-backend request for review.
          submittedBridgeCommand: command,
        },
        "Submitting to RCS",
      );

      try {
        const response = await timed((options) =>
          createRcsBridgeTask(command, options),
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
    if (busy.current || blocked.current) return;

    pause();
    busy.current = true;

    try {
      const response = await timed(getAllRcsBridgeTasks);

      if (
        response.mode !== "HIK" ||
        !Array.isArray(response.tasks)
      ) {
        throw new Error("Unexpected backend task list.");
      }

      for (const queueTask of [...ref.current]) {
        if (
          !["SENDING", "OUTCOME_UNKNOWN"].includes(
            queueTask.sendStatus,
          )
        ) {
          continue;
        }

        const expected = targetsFor(queueTask);

        const matches = response.tasks.filter(
          (task) =>
            task.robotTaskCode === queueTask.warehouseTaskId &&
            task.source?.code === expected.source.code &&
            task.source?.type === expected.source.type &&
            task.destination?.code === expected.destination.code &&
            task.destination?.type === expected.destination.type,
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

        applySnapshot(recovered, { mode: "HIK", task });
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

      if (!request || request.handled) return;
      request.handled = true;

      try {
        if (blocked.current) {
          throw new Error("Queue storage is unreadable.");
        }

        const {
          draft,
          from,
          to,
          scheduledSendAt,
        } = request.payload || {};

        if (!draft || !from?.id || !to?.id) {
          throw new Error("Incomplete transfer request.");
        }

        const current = validateTransfer(from.id, to.id);

        // Check that the form's WMS data is still current.
        if (
          String(from.code || "") !==
            String(current.from.code || "") ||
          String(to.code || "") !==
            String(current.to.code || "") ||
          from.basket?.id !== current.from.basket?.id
        ) {
          throw new Error(
            "WMS location or load data changed. Review the transfer again.",
          );
        }

        const taskType =
          typeof draft.taskType === "string"
            ? draft.taskType.trim()
            : "";

        if (!taskType) {
          throw new Error(
            "Enter the task type registered in RCS.",
          );
        }

        const priority = Number(draft.initPriority);

        if (!PRIORITIES[priority]) {
          throw new Error("Invalid priority.");
        }

        const sourceTarget = normalizeTarget(
          draft.source,
          current.from.code,
          "source",
        );

        const destinationTarget = normalizeTarget(
          draft.destination,
          current.to.code,
          "destination",
        );

        if (
          sourceTarget.type === destinationTarget.type &&
          sourceTarget.code === destinationTarget.code
        ) {
          throw new Error(
            "Source and destination RCS targets must differ.",
          );
        }

        const time =
          scheduledSendAt || new Date().toISOString();

        if (!Number.isFinite(Date.parse(time))) {
          throw new Error("Invalid scheduled time.");
        }

        const task = {
          id: `RCSQ-${crypto.randomUUID()}`,
          warehouseTaskId: `MON-${crypto.randomUUID()}`,

          origin: "MONITOR",
          type: "STORAGE_TRANSFER",
          basketId: current.from.basket.id,

          rcsTaskType: taskType,
          rcsRobotCode: String(draft.robotCode || "").trim(),

          // Internal WMS locations used for stock/occupancy updates.
          sourceLocationId: current.from.id,
          destinationLocationId: current.to.id,

          // Snapshot WMS codes separately from API target codes.
          sourceWmsLocationCode: String(current.from.code || ""),
          destinationWmsLocationCode: String(current.to.code || ""),

          // API targets from the updated Monitor form.
          sourceRcsPointCode: sourceTarget.code,
          destinationRcsPointCode: destinationTarget.code,

          sourceRcsTargetType: sourceTarget.type,
          destinationRcsTargetType: destinationTarget.type,

          wmsPriority: PRIORITIES[priority],
          rcsPriority: priority,

          scheduledSendAt: time,
          createdAt: new Date().toISOString(),

          sendStatus: "NOT_SENT",
          rcsStatus: "NOT_SENT",
          history: [],
        };

        // Validate the bridge command before saving the entry.
        commandFor(task);

        commit([...ref.current, task]);

        if (request.payload.startAfterEnqueue) {
          void startQueue();
        }
      } catch (error) {
        request.error = error.message;
      }
    }

    function storage(event) {
      if (event.key !== KEY && event.key !== null) return;

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

    window.addEventListener("storage", storage);

    const timer = window.setInterval(() => {
      setNow(Date.now());
      void tick();
    }, 1000);

    return () => {
      alive.current = false;
      enabled.current = false;
      startVersion.current += 1;

      window.clearInterval(timer);
      window.removeEventListener(
        "wms-rcs-enqueue-request",
        enqueue,
      );
      window.removeEventListener("storage", storage);
    };
  }, []);

  function edit(id, value) {
    try {
      const item = ref.current.find((task) => task.id === id);

      if (item?.sendStatus !== "NOT_SENT") return;

      patch(id, value);
    } catch (error) {
      pause(error.message);
    }
  }

  function removeUnsent(id) {
    try {
      commit(
        ref.current.filter(
          (task) =>
            task.id !== id ||
            task.sendStatus !== "NOT_SENT",
        ),
      );
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
    ready.map((task, index) => [task.id, index + 1]),
  );

  const pending = queue
    .filter((task) => task.sendStatus === "NOT_SENT")
    .sort(
      (a, b) =>
        (readyIds.get(a.id) || 100000) -
          (readyIds.get(b.id) || 100000) ||
        Date.parse(a.scheduledSendAt) -
          Date.parse(b.scheduledSendAt),
    );

  const submitted = queue
    .filter((task) => task.sendStatus !== "NOT_SENT")
    .sort(
      (a, b) =>
        Number(b.dispatchSequence || 0) -
        Number(a.dispatchSequence || 0),
    );

  const detailTask = queue.find((task) => task.id === details);

  return (
    <div className="page wms-overview">
      <div className="page-header">
        <div>
          <span className="page-label">RCS DISPATCH</span>
          <h2>Load transfer queue</h2>

          <p>
            Create transfers in Monitor, then start this queue.
            Ready tasks run by priority, then arrival order.
            The active task finishes first.
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
            disabled={running || checking || blocked.current}
            onClick={startQueue}
          >
            {checking ? "Checking backend…" : "Start Queue"}
          </button>

          <button
            type="button"
            className="primary-button"
            disabled={!running && !checking}
            onClick={() =>
              pause("Queue paused. The active robot task continues.")
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
            {running ? "Queue running" : "Queue paused"}
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
          <Link to="/settings">Connection settings</Link>
        </p>

        {active && (
          <div className="overview-notice" style={CELL_STYLE}>
            <strong>
              Active transfer: {active.basketId || "Previous task"}
            </strong>

            <p>
              <RouteText task={active} />
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
                "Checking task status automatically. The load location updates after confirmed completion."}
            </p>

            {active.lastStatusCheckAt && (
              <small>
                Last checked:{" "}
                {new Date(active.lastStatusCheckAt).toLocaleString()}
              </small>
            )}
          </div>
        )}
      </section>

      <section className="panel overview-section">
        <h3>Waiting transfers · {pending.length}</h3>

        <div className="table-wrapper" style={{ overflowX: "auto" }}>
          <table className="dashboard-table" style={TABLE_STYLE}>
            <thead>
              <tr>
                <th>Ready order</th>
                <th>Task type</th>
                <th>Load / route</th>
                <th>Priority</th>
                <th>Scheduled send time</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {!pending.length && (
                <tr>
                  <td colSpan={6}>No waiting transfers.</td>
                </tr>
              )}

              {pending.map((task) => (
                <tr key={task.id}>
                  <td>{readyIds.get(task.id) || "Scheduled"}</td>

                  <td style={CELL_STYLE}>
                    {task.rcsTaskType || "CTUB1"}
                  </td>

                  <td style={CELL_STYLE}>
                    <strong>{task.basketId || "Legacy task"}</strong>
                    <br />
                    <RouteText task={task} />
                  </td>

                  <td>
                    <select
                      aria-label={`Priority ${task.id}`}
                      value={task.rcsPriority || 60}
                      onChange={(event) =>
                        edit(task.id, {
                          rcsPriority: Number(event.target.value),
                          wmsPriority: PRIORITIES[event.target.value],
                        })
                      }
                    >
                      {Object.entries(PRIORITIES).map(
                        ([value, label]) => (
                          <option key={value} value={value}>
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
                      value={datetimeInput(task.scheduledSendAt)}
                      onChange={(event) => {
                        const value = event.target.value
                          ? new Date(event.target.value)
                          : new Date();

                        if (Number.isFinite(value.getTime())) {
                          edit(task.id, {
                            scheduledSendAt: value.toISOString(),
                          });
                        }
                      }}
                    />
                  </td>

                  <td>
                    <button
                      type="button"
                      onClick={() => removeUnsent(task.id)}
                    >
                      Remove
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setDetails((value) =>
                          value === task.id ? "" : task.id,
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
      </section>

      <section className="panel overview-section">
        <h3>Submitted tasks · {submitted.length}</h3>

        <div className="table-wrapper" style={{ overflowX: "auto" }}>
          <table className="dashboard-table" style={TABLE_STYLE}>
            <thead>
              <tr>
                <th>Send order</th>
                <th>Task type</th>
                <th>Load / route</th>
                <th>Status</th>
                <th>RCS task ID</th>
                <th>Details</th>
              </tr>
            </thead>

            <tbody>
              {!submitted.length && (
                <tr>
                  <td colSpan={6}>No submitted tasks.</td>
                </tr>
              )}

              {submitted.map((task) => (
                <tr key={task.id}>
                  <td>{task.dispatchSequence || "—"}</td>

                  <td style={CELL_STYLE}>
                    {task.rcsTaskType || "CTUB1"}
                  </td>

                  <td style={CELL_STYLE}>
                    {task.basketId || "Legacy task"}
                    <br />
                    <RouteText task={task} />
                  </td>

                  <td>
                    {task.backendError
                      ? "Needs attention"
                      : task.sendStatus === "SENT"
                        ? task.rcsStatus
                        : task.sendStatus}
                  </td>

                  <td style={CELL_STYLE}>
                    {task.rcsTaskChainCode || "Unconfirmed"}
                  </td>

                  <td>
                    <button
                      type="button"
                      onClick={() =>
                        setDetails((value) =>
                          value === task.id ? "" : task.id,
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
      </section>

      {detailTask && (
        <section
          className="panel overview-section"
          style={CELL_STYLE}
        >
          <h3>Transfer details</h3>

          <p>Task type: {detailTask.rcsTaskType || "CTUB1"}</p>

          <p>
            WMS locations: {detailTask.sourceLocationId}
            {" → "}
            {detailTask.destinationLocationId}
          </p>

          <p>
            <RouteText task={detailTask} />
          </p>

          <p>
            Robot: {detailTask.rcsRobotCode || "Assigned by RCS"}
          </p>

          <p>
            {detailTask.backendError || detailTask.rcsStatus}
          </p>

          <details>
            <summary>
              {detailTask.submittedBridgeCommand
                ? "Saved request sent to backend"
                : "Backend request preview"}
            </summary>

            <pre
              style={{
                maxWidth: "100%",
                overflowX: "auto",
                whiteSpace: "pre-wrap",
                overflowWrap: "anywhere",
              }}
            >
              {detailTask.submittedBridgeCommand
                ? JSON.stringify(
                    detailTask.submittedBridgeCommand,
                    null,
                    2,
                  )
                : commandText(detailTask)}
            </pre>
          </details>

          <ul>
            {(detailTask.history || []).map((record, index) => (
              <li key={record.id || index}>
                {record.at || record.createdAt}
                {" · "}
                {record.message}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}