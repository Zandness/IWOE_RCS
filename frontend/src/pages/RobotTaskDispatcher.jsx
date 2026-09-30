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
  readMonitor,
  isStoppedTransferReviewed,
  reviewStoppedTransferAtSource,
} from "../utils/basketStore";

import "../styles/OverviewSettings.css";

const KEY = "wms-robot-tasks-v1";

const TARGET_TYPES = ["STORAGE", "SITE", "CARRIER"];

const STOPPED_STATUSES = [
  "FAILED",
  "CANCELLED",
  "CANCELED",
];

const TERMINAL_STATUSES = [
  "COMPLETED",
  ...STOPPED_STATUSES,
];

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

const FIELD_STYLE = {
  display: "grid",
  gap: 6,
  minWidth: 0,
};

const CONTROL_STYLE = {
  width: "100%",
  minWidth: 0,
  boxSizing: "border-box",
};

const CHECKBOX_LABEL_STYLE = {
  display: "flex",
  alignItems: "flex-start",
  gap: 8,
};

const CHECKBOX_STYLE = {
  width: "auto",
  height: "auto",
  flexShrink: 0,
  marginTop: 3,
};

function loadQueue() {
  const value = JSON.parse(
    localStorage.getItem(KEY) || "[]",
  );

  if (
    !Array.isArray(value) ||
    value.some(
      (task) =>
        !task ||
        typeof task !== "object" ||
        Array.isArray(task),
    )
  ) {
    throw new Error(
      "Invalid queue data. Restore the saved data before continuing.",
    );
  }

  return value;
}

function normalizeTargetType(value) {
  const type =
    value == null || value === ""
      ? "STORAGE"
      : value;

  if (!TARGET_TYPES.includes(type)) {
    throw new Error(
      `Unsupported RCS target type: ${type}`,
    );
  }

  return type;
}

function normalizeTarget(value, fallbackCode, label) {
  if (
    value != null &&
    (
      typeof value !== "object" ||
      Array.isArray(value)
    )
  ) {
    throw new Error(`Invalid ${label} RCS target.`);
  }

  const type = normalizeTargetType(value?.type);

  const rawCode =
    value == null ? fallbackCode : value.code;

  if (
    typeof rawCode !== "string" ||
    !rawCode.trim()
  ) {
    throw new Error(
      `Enter the ${label} RCS target code.`,
    );
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

function isStoppedTask(task) {
  return (
    task?.sendStatus === "SENT" &&
    STOPPED_STATUSES.includes(task.rcsStatus)
  );
}

function needsStoppedReview(task) {
  return (
    isStoppedTask(task) &&
    !isStoppedTransferReviewed(task)
  );
}

function blocksNextTransfer(task) {
  return (
    task.sendStatus === "SENT" &&
    task.rcsStatus !== "COMPLETED" &&
    !(
      isStoppedTask(task) &&
      isStoppedTransferReviewed(task)
    )
  );
}

// Display helper only.
// Dispatch checks call isStoppedTransferReviewed directly,
// so unreadable warehouse data still blocks dispatch.
function getReviewForDisplay(task) {
  if (!isStoppedTask(task)) {
    return null;
  }

  try {
    const data = readMonitor();

    return isStoppedTransferReviewed(task, data)
      ? data.reviewedStoppedTransfers[task.id]
      : null;
  } catch {
    return null;
  }
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

  const robotCode = String(
    task.rcsRobotCode || "",
  ).trim();

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
  const sourceWmsCode =
    Object.prototype.hasOwnProperty.call(
      task,
      "sourceWmsLocationCode",
    )
      ? task.sourceWmsLocationCode
      : task.sourceRcsPointCode;

  const destinationWmsCode =
    Object.prototype.hasOwnProperty.call(
      task,
      "destinationWmsLocationCode",
    )
      ? task.destinationWmsLocationCode
      : task.destinationRcsPointCode;

  if (
    String(from.code || "") !==
      String(sourceWmsCode || "") ||
    String(to.code || "") !==
      String(destinationWmsCode || "")
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

function StoppedTransferReviewForm({
  task,
  saving,
  onReview,
}) {
  const [reviewedBy, setReviewedBy] = useState("");
  const [note, setNote] = useState("");
  const [confirmedRcsStopped, setConfirmedRcsStopped] =
    useState(false);
  const [
    confirmedLoadAtSource,
    setConfirmedLoadAtSource,
  ] = useState(false);

  const valid =
    reviewedBy.trim() &&
    note.trim() &&
    confirmedRcsStopped &&
    confirmedLoadAtSource;

  function submit(event) {
    event.preventDefault();

    if (!valid || saving) {
      return;
    }

    void onReview(task.id, {
      reviewedBy: reviewedBy.trim(),
      note: note.trim(),
      confirmedRcsStopped,
      confirmedLoadAtSource,
    });
  }

  return (
    <form onSubmit={submit}>
      <fieldset
        disabled={saving}
        style={{
          minWidth: 0,
          margin: "16px 0",
          padding: 16,
          border: "1px solid currentColor",
          borderRadius: 8,
        }}
      >
        <legend>Review stopped transfer</legend>

        <p>
          Use this form only after checking that the RCS
          task has stopped and the physical load remains
          at the source.
        </p>

        <p>
          Source:{" "}
          <strong>
            {task.sourceWmsLocationCode ||
              task.sourceLocationId}
          </strong>
          {" · "}
          Load: <strong>{task.basketId}</strong>
        </p>

        <p>
          If the load is on the robot, at the destination,
          or elsewhere, leave this task unresolved.
        </p>

        <div style={{ display: "grid", gap: 14 }}>
          <label style={FIELD_STYLE}>
            Reviewer name
            <input
              required
              value={reviewedBy}
              onChange={(event) =>
                setReviewedBy(event.target.value)
              }
              placeholder="Name of the person checking"
              style={CONTROL_STYLE}
            />
          </label>

          <label style={FIELD_STYLE}>
            Review notes
            <textarea
              required
              rows={3}
              value={note}
              onChange={(event) =>
                setNote(event.target.value)
              }
              placeholder="Describe the RCS and physical location checks."
              style={{
                ...CONTROL_STYLE,
                resize: "vertical",
              }}
            />
          </label>

          <label style={CHECKBOX_LABEL_STYLE}>
            <input
              type="checkbox"
              checked={confirmedRcsStopped}
              onChange={(event) =>
                setConfirmedRcsStopped(
                  event.target.checked,
                )
              }
              style={CHECKBOX_STYLE}
            />
            <span>
              I checked that this task has stopped in RCS.
            </span>
          </label>

          <label style={CHECKBOX_LABEL_STYLE}>
            <input
              type="checkbox"
              checked={confirmedLoadAtSource}
              onChange={(event) =>
                setConfirmedLoadAtSource(
                  event.target.checked,
                )
              }
              style={CHECKBOX_STYLE}
            />
            <span>
              I checked the physical load and confirmed
              that it remains at the source.
            </span>
          </label>

          <div>
            <button
              type="submit"
              className="primary-button"
              disabled={!valid || saving}
            >
              {saving
                ? "Checking task and saving…"
                : "Confirm load at source"}
            </button>
          </div>
        </div>

        <p>
          This records the review and releases this
          task&apos;s reservations. It does not send a
          robot command or start the queue.
        </p>
      </fieldset>
    </form>
  );
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
  const [checking, setChecking] = useState(false);
  const [reviewing, setReviewing] = useState(false);

  const [connection, setConnection] = useState(
    "Backend not checked",
  );

  const ref = useRef(queue);
  const enabled = useRef(false);
  const busy = useRef(false);
  const blocked = useRef(Boolean(initial.error));
  const alive = useRef(true);
  const checkingRef = useRef(false);
  const reviewingRef = useRef(false);
  const startVersion = useRef(0);

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

  async function startQueue() {
    if (
      checkingRef.current ||
      reviewingRef.current ||
      blocked.current
    ) {
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

      const stoppedTask = ref.current.find(
        needsStoppedReview,
      );

      if (stoppedTask) {
        setDetails(stoppedTask.id);

        throw new Error(
          "A stopped transfer still requires review. Open its details and check the physical load location.",
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
        pause(error.message);
      }
    } finally {
      checkingRef.current = false;

      if (alive.current) {
        setChecking(false);
      }
    }
  }

  function commit(next) {
    localStorage.setItem(KEY, JSON.stringify(next));
    ref.current = next;

    if (alive.current) {
      setQueue(next);
    }

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
        ...TERMINAL_STATUSES,
      ].includes(status)
    ) {
      throw new Error(
        `Unrecognized RCS status: ${status}`,
      );
    }

    patch(
      queueTask.id,
      {
        rcsStatus: status,
        backendError: "",
        statusCheckError: "",
        lastStatusCheckAt: new Date().toISOString(),
      },
      queueTask.rcsStatus !== status
        ? `RCS ${status}`
        : "",
    );

    if (
      status === "COMPLETED" &&
      queueTask.basketId
    ) {
      syncWarehouse({
        ...queueTask,
        rcsStatus: status,
      });
    }

    if (STOPPED_STATUSES.includes(status)) {
      pause(
        "Task stopped. Check the physical load location before continuing.",
      );
    }
  }

  function syncWarehouse(task) {
    try {
      completeBasketTransfer(task);

      if (task.warehouseSyncStatus !== "COMPLETED") {
        patch(
          task.id,
          {
            warehouseSyncStatus: "COMPLETED",
            warehouseSyncError: "",
            backendError: "",
          },
          "Warehouse location updated after confirmed RCS completion",
        );
      }

      return true;
    } catch (error) {
      if (task.warehouseSyncError !== error.message) {
        patch(
          task.id,
          {
            warehouseSyncStatus: "REQUIRES_REVIEW",
            warehouseSyncError: error.message,
          },
          "Robot completed; warehouse update requires review",
        );
      }

      pause(error.message);
      return false;
    }
  }

  async function pollActive() {
    const activeTasks = ref.current.filter(
      (task) =>
        task.sendStatus === "SENT" &&
        !TERMINAL_STATUSES.includes(task.rcsStatus),
    );

    for (const task of activeTasks) {
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
        patch(task.id, {
          statusCheckError: error.message,
        });

        pause(error.message);
      }
    }
  }

  async function confirmStoppedReview(taskId, values) {
    if (
      busy.current ||
      checkingRef.current ||
      reviewingRef.current
    ) {
      setMessage(
        "A status check is in progress. Please try the review again shortly.",
      );
      return;
    }

    if (blocked.current) {
      setMessage("Queue storage is unreadable.");
      return;
    }

    pause("Checking the stopped task before saving the review.");

    const ticket = startVersion.current;

    busy.current = true;
    reviewingRef.current = true;
    setReviewing(true);

    try {
      const matches = ref.current.filter(
        (task) => task.id === taskId,
      );

      if (matches.length !== 1) {
        throw new Error("Task is missing or duplicated.");
      }

      const task = matches[0];

      if (
        !isStoppedTask(task) ||
        !task.bridgeTaskId ||
        !task.rcsTaskChainCode ||
        !task.basketId
      ) {
        throw new Error(
          "This task cannot be reviewed as a stopped transfer.",
        );
      }

      if (isStoppedTransferReviewed(task)) {
        setQueue([...ref.current]);
        setMessage(
          "This task has already been reviewed. The queue remains paused.",
        );
        return;
      }

      // Query the existing task only. No command is submitted.
      const response = await timed((options) =>
        getRcsBridgeTask(task.bridgeTaskId, options),
      );

      if (
        !alive.current ||
        ticket !== startVersion.current
      ) {
        throw new Error(
          "The queue changed during the check. Review the task again.",
        );
      }

      // Do not overwrite queue changes made elsewhere.
      if (
        JSON.stringify(loadQueue()) !==
        JSON.stringify(ref.current)
      ) {
        throw new Error(
          "Queue data changed in another tab. Reload and review the task again.",
        );
      }

      const current = ref.current.find(
        (item) => item.id === taskId,
      );

      if (current !== task) {
        throw new Error(
          "Task data changed during the check. Review it again.",
        );
      }

      const remote = response?.task;

      if (
        response?.ok !== true ||
        response?.mode !== "HIK" ||
        !remote ||
        remote.bridgeTaskId !== task.bridgeTaskId ||
        remote.rcsTaskChainCode !== task.rcsTaskChainCode ||
        remote.robotTaskCode !== task.warehouseTaskId
      ) {
        throw new Error(
          "The backend response does not match this transfer. No review was saved.",
        );
      }

      if (!STOPPED_STATUSES.includes(remote.rcsStatus)) {
        throw new Error(
          `The backend now reports ${remote.rcsStatus || "an unknown status"}. The load-at-source review was not saved. Check this task in RCS.`,
        );
      }

      // Record the latest confirmed stopped status first.
      applySnapshot(task, response);

      // This function rereads the saved queue and Monitor,
      // validates the source load and saves the review ledger.
      reviewStoppedTransferAtSource(taskId, values);

      setQueue([...ref.current]);

      setMessage(
        "Review saved: the load remains at the source. This task's reservations are released. The queue is paused; press Start Queue when ready.",
      );
    } catch (error) {
      pause(error.message);
    } finally {
      busy.current = false;
      reviewingRef.current = false;

      if (alive.current) {
        setReviewing(false);
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

      for (const task of ref.current) {
        if (
          task.basketId &&
          task.rcsStatus === "COMPLETED"
        ) {
          if (!syncWarehouse(task)) {
            return;
          }
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

      const stoppedTask = ref.current.find(
        needsStoppedReview,
      );

      if (stoppedTask) {
        setDetails(stoppedTask.id);

        pause(
          `Task ${
            stoppedTask.rcsTaskChainCode || stoppedTask.id
          } is ${stoppedTask.rcsStatus}. Check the physical load location before continuing.`,
        );
        return;
      }

      if (ref.current.some(blocksNextTransfer)) {
        return;
      }

      const next = orderReady(ref.current)[0];

      if (!next) {
        return;
      }

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

      if (!live || live.sendStatus !== "NOT_SENT") {
        return;
      }

      const { from, to } = validateTransfer(
        live.sourceLocationId,
        live.destinationLocationId,
        live.id,
        live.basketId,
      );

      assertWmsLocationsUnchanged(live, from, to);

      const command = commandFor(live);

      const sequence =
        Math.max(
          0,
          ...ref.current.map((task) => {
            const value = Number(
              task.dispatchSequence || 0,
            );

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
    if (
      busy.current ||
      reviewingRef.current ||
      blocked.current
    ) {
      return;
    }

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
            task.robotTaskCode ===
              queueTask.warehouseTaskId &&
            task.source?.code === expected.source.code &&
            task.source?.type === expected.source.type &&
            task.destination?.code ===
              expected.destination.code &&
            task.destination?.type ===
              expected.destination.type,
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
          rcsRobotCode: String(
            draft.robotCode || "",
          ).trim(),

          sourceLocationId: current.from.id,
          destinationLocationId: current.to.id,

          sourceWmsLocationCode: String(
            current.from.code || "",
          ),
          destinationWmsLocationCode: String(
            current.to.code || "",
          ),

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
      if (event.key !== KEY && event.key !== null) {
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
      !TERMINAL_STATUSES.includes(task.rcsStatus),
  );

  const awaitingReview = queue.filter(
    (task) =>
      isStoppedTask(task) &&
      !getReviewForDisplay(task),
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

  const detailReview = detailTask
    ? getReviewForDisplay(detailTask)
    : null;

  return (
    <div className="page wms-overview">
      <div className="page-header">
        <div>
          <span className="page-label">RCS DISPATCH</span>
          <h2>Load transfer queue</h2>

          <p>
            Create transfers in Monitor, then start this
            queue. Ready tasks run by priority, then arrival
            order. The active task finishes first.
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
              reviewing ||
              blocked.current
            }
            onClick={startQueue}
          >
            {checking ? "Checking backend…" : "Start Queue"}
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
            disabled={reviewing || blocked.current}
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

        {awaitingReview.length > 0 && (
          <div className="overview-notice">
            <strong>
              Stopped transfers requiring review:{" "}
              {awaitingReview.length}
            </strong>

            <p>
              Check the physical load location before
              releasing the reservations.
            </p>

            <button
              type="button"
              disabled={reviewing}
              onClick={() =>
                setDetails(awaitingReview[0].id)
              }
            >
              Open stopped transfer
            </button>
          </div>
        )}

        {active && (
          <div
            className="overview-notice"
            style={CELL_STYLE}
          >
            <strong>
              Active transfer:{" "}
              {active.basketId || "Previous task"}
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
              {active.statusCheckError ||
                active.warehouseSyncError ||
                active.backendError ||
                "Checking task status automatically. The load location updates after confirmed completion."}
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
        <h3>Waiting transfers · {pending.length}</h3>

        <div
          className="table-wrapper"
          style={{ overflowX: "auto" }}
        >
          <table
            className="dashboard-table"
            style={TABLE_STYLE}
          >
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
                  <td>
                    {readyIds.get(task.id) || "Scheduled"}
                  </td>

                  <td style={CELL_STYLE}>
                    {task.rcsTaskType || "CTUB1"}
                  </td>

                  <td style={CELL_STYLE}>
                    <strong>
                      {task.basketId || "Legacy task"}
                    </strong>
                    <br />
                    <RouteText task={task} />
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
                      onClick={() => removeUnsent(task.id)}
                    >
                      Remove
                    </button>

                    <button
                      type="button"
                      disabled={reviewing}
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

        <div
          className="table-wrapper"
          style={{ overflowX: "auto" }}
        >
          <table
            className="dashboard-table"
            style={TABLE_STYLE}
          >
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

              {submitted.map((task) => {
                const review = getReviewForDisplay(task);

                return (
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
                      {task.sendStatus === "SENT"
                        ? task.rcsStatus
                        : task.sendStatus}

                      {review ? (
                        <div>Reviewed: Load at source</div>
                      ) : (
                        <>
                          {isStoppedTask(task) && (
                            <div>Physical review required</div>
                          )}

                          {task.warehouseSyncStatus && (
                            <div>
                              Warehouse:{" "}
                              {task.warehouseSyncStatus}
                            </div>
                          )}
                        </>
                      )}

                      {task.statusCheckError && (
                        <div>
                          Status check: Connection error
                        </div>
                      )}

                      {task.backendError && (
                        <div>Submission: Requires review</div>
                      )}
                    </td>

                    <td style={CELL_STYLE}>
                      {task.rcsTaskChainCode || "Unconfirmed"}
                    </td>

                    <td>
                      <button
                        type="button"
                        disabled={reviewing}
                        onClick={() =>
                          setDetails((value) =>
                            value === task.id
                              ? ""
                              : task.id,
                          )
                        }
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                );
              })}
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

          <p>
            Task type: {detailTask.rcsTaskType || "CTUB1"}
          </p>

          <p>
            WMS locations: {detailTask.sourceLocationId}
            {" → "}
            {detailTask.destinationLocationId}
          </p>

          <p>
            <RouteText task={detailTask} />
          </p>

          <p>
            Robot:{" "}
            {detailTask.rcsRobotCode || "Assigned by RCS"}
          </p>

          <p>RCS status: {detailTask.rcsStatus}</p>
          <p>Submission: {detailTask.sendStatus}</p>

          <p>
            Warehouse:{" "}
            {detailReview
              ? "Reviewed — load at source"
              : isStoppedTask(detailTask)
                ? "Physical review required"
                : detailTask.warehouseSyncStatus ||
                  "Pending completion"}
          </p>

          <p role="status">
            {detailTask.warehouseSyncError ||
              detailTask.statusCheckError ||
              detailTask.backendError ||
              ""}
          </p>

          {detailReview && (
            <div className="overview-notice">
              <strong>
                Review saved: load remains at source
              </strong>

              <p>Reviewer: {detailReview.reviewedBy}</p>

              <p>
                Reviewed at:{" "}
                {new Date(
                  detailReview.reviewedAt,
                ).toLocaleString()}
              </p>

              <p style={{ whiteSpace: "pre-wrap" }}>
                Notes: {detailReview.note}
              </p>

              <p>
                This task&apos;s reservations have been
                released. Its original RCS status is
                retained.
              </p>
            </div>
          )}

          {isStoppedTask(detailTask) &&
            !detailReview && (
              <StoppedTransferReviewForm
                key={detailTask.id}
                task={detailTask}
                saving={reviewing}
                onReview={confirmStoppedReview}
              />
            )}

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
        </section>
      )}
    </div>
  );
}