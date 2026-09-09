import { useEffect, useRef, useState } from "react";
import {
  getRcsBridgeBaseUrl,
  getRcsBridgeStatus,
} from "../services/rcs";
import "../styles/MonitorRcsDispatch.css";

const MONITOR_KEY = "wms-monitor-master-v2";
const JOB_KEY = "wms-monitor-rcs-dispatch-v1";

const TERMINAL_STATUSES = [
  "FINISHED",
  "COMPLETED",
  "CANCELLED",
  "CANCELED",
  "FAILED",
  "ABORTED",
];

function readSavedJob() {
  try {
    const saved = JSON.parse(
      localStorage.getItem(JOB_KEY) || "null"
    );

    return saved && typeof saved === "object"
      ? saved
      : null;
  } catch {
    return null;
  }
}

async function postRcs(path, payload) {
  const response = await fetch(
    `${getRcsBridgeBaseUrl()}${path}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

  const body = await response.json();

  if (
    !response.ok ||
    body.success !== true ||
    body.data?.code !== "SUCCESS"
  ) {
    const detail = body.detail;

    throw new Error(
      detail?.rcsResponse?.message ||
        detail?.message ||
        (typeof detail === "string" ? detail : "") ||
        body.message ||
        `HTTP ${response.status}`
    );
  }

  return body;
}

export default function MonitorRcsDispatch() {
  const [shelves, setShelves] = useState([]);
  const [layoutError, setLayoutError] = useState("");

  const [taskType, setTaskType] = useState("CTUB1");
  const [source, setSource] = useState("");
  const [destination, setDestination] = useState("");
  const [priority, setPriority] = useState(99);

  const [job, setJob] = useState(readSavedJob);
  const [queryCode, setQueryCode] = useState(
    () => readSavedJob()?.robotTaskCode || ""
  );

  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  useEffect(() => {
    function refreshShelves() {
      try {
        const data = JSON.parse(
          localStorage.getItem(MONITOR_KEY) || "null"
        );

        if (!Array.isArray(data?.racks)) {
          throw new Error(
            "Open Warehouse Monitor and save shelf codes first."
          );
        }

        const rows = data.racks.flatMap((rack) =>
          (rack.shelves || []).map((shelf) => ({
            id: shelf.id,
            rack: rack.id,
            level: shelf.level,
            code: String(shelf.code || "").trim(),
            blocked: ["BLOCKED", "MAINTENANCE"].includes(
              shelf.status
            ),
          }))
        );

        const counts = new Map();

        rows.forEach((shelf) => {
          counts.set(
            shelf.code,
            (counts.get(shelf.code) || 0) + 1
          );
        });

        setShelves(
          rows.map((shelf) => ({
            ...shelf,
            duplicate: counts.get(shelf.code) > 1,
          }))
        );

        setLayoutError("");
      } catch (error) {
        setShelves([]);
        setLayoutError(error.message);
      }
    }

    refreshShelves();

    window.addEventListener("focus", refreshShelves);
    window.addEventListener("storage", refreshShelves);
    window.addEventListener(
      "wms-monitor-data-changed",
      refreshShelves
    );

    return () => {
      window.removeEventListener("focus", refreshShelves);
      window.removeEventListener("storage", refreshShelves);
      window.removeEventListener(
        "wms-monitor-data-changed",
        refreshShelves
      );
    };
  }, []);

  const from = shelves.find((shelf) => shelf.id === source);
  const to = shelves.find(
    (shelf) => shelf.id === destination
  );

  const validShelf = (shelf) =>
    shelf &&
    shelf.code &&
    !shelf.blocked &&
    !shelf.duplicate;

  const valid =
    validShelf(from) &&
    validShelf(to) &&
    from.code !== to.code &&
    taskType.trim() &&
    Number.isInteger(Number(priority)) &&
    Number(priority) >= 1 &&
    Number(priority) <= 120;

  const draft = {
    taskType: taskType.trim(),
    targetRoute: [
      {
        seq: 0,
        type: "STORAGE",
        code: from?.code || "",
      },
      {
        seq: 1,
        type: "STORAGE",
        code: to?.code || "",
      },
    ],
    initPriority: Number(priority),
  };

  async function submitTask() {
    if (busyRef.current || job || !valid) return;

    busyRef.current = true;
    setBusy(true);
    setMessage("");

    let requestStarted = false;

    try {
      const bridge = await getRcsBridgeStatus();

      if (bridge.bridgeMode !== "HIK") {
        throw new Error(
          "Set the backend to HIK mode before sending a real task."
        );
      }

      const pending = {
        payload: draft,
        status: "OUTCOME_UNKNOWN",
        submittedAt: new Date().toISOString(),
      };

      // Save before sending to prevent accidental resubmission.
      localStorage.setItem(JOB_KEY, JSON.stringify(pending));
      setJob(pending);
      requestStarted = true;

      const result = await postRcs(
        "/api/ctu/task/submit",
        draft
      );

      const taskId =
        result.robotTaskCode ||
        result.data?.data?.robotTaskCode;

      if (!taskId) {
        throw new Error("No RCS task ID was returned.");
      }

      const saved = {
        ...pending,
        robotTaskCode: taskId,
        status: "SUBMITTED",
      };

      setJob(saved);
      setQueryCode(taskId);

      try {
        localStorage.setItem(JOB_KEY, JSON.stringify(saved));
      } catch {
        setMessage(
          `Task accepted. Copy task ID ${taskId}; browser storage could not be updated.`
        );
      }
    } catch (error) {
      setMessage(
        error.message +
          (requestStarted
            ? " Check the RCS task list before starting another task."
            : "")
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  async function queryTask() {
    if (busyRef.current || !queryCode.trim()) return;

    busyRef.current = true;
    setBusy(true);
    setMessage("");

    try {
      const result = await postRcs(
        "/api/ctu/task/query",
        {
          robotTaskCode: queryCode.trim(),
        }
      );

      const task = result.data?.data;

      if (
        !task ||
        task.robotTaskCode !== queryCode.trim()
      ) {
        throw new Error(
          "The returned task ID does not match the requested task."
        );
      }

      const saved = {
        ...job,
        robotTaskCode: task.robotTaskCode,
        status: String(
          task.taskStatus || "UNKNOWN"
        ).toUpperCase(),
        actualTask: task,
        checkedAt: new Date().toISOString(),
      };

      setJob(saved);

      try {
        localStorage.setItem(JOB_KEY, JSON.stringify(saved));
      } catch {
        setMessage(
          "Status received, but browser storage could not be updated."
        );
      }
    } catch (error) {
      setMessage(error.message);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  function startNewTask() {
    if (busyRef.current || !job) return;

    if (
      !TERMINAL_STATUSES.includes(job.status) &&
      !window.confirm(
        "The last task is not confirmed finished. Have you checked its outcome in RCS? Clear this local form only?"
      )
    ) {
      return;
    }

    try {
      localStorage.removeItem(JOB_KEY);
      setJob(null);
      setQueryCode("");
      setMessage("");
    } catch {
      setMessage("Could not clear the saved task.");
    }
  }

  function renderShelfOptions() {
    return shelves.map((shelf) => (
      <option
        key={shelf.id}
        value={shelf.id}
        disabled={!validShelf(shelf)}
      >
        {shelf.rack} / Shelf {shelf.level} —{" "}
        {shelf.code || "No code"}
        {shelf.duplicate ? " (duplicate code)" : ""}
        {shelf.blocked ? " (blocked)" : ""}
      </option>
    ));
  }

  return (
    <section className="monitor-rcs-panel">
      <h3>Send Storage Transfer to RCS</h3>

      <p>
        Select shelf codes from Warehouse Monitor.
        RCS assigns the robot. Sending starts a real
        transfer task.
      </p>

      {layoutError && (
        <p role="alert">{layoutError}</p>
      )}

      <div className="monitor-rcs-fields">
        <label>
          Task type
          <input
            value={taskType}
            disabled={busy || !!job}
            onChange={(event) =>
              setTaskType(event.target.value)
            }
          />
        </label>

        <label>
          Priority
          <input
            type="number"
            min="1"
            max="120"
            step="1"
            value={priority}
            disabled={busy || !!job}
            onChange={(event) =>
              setPriority(event.target.value)
            }
          />
        </label>

        <label>
          Source shelf
          <select
            value={source}
            disabled={busy || !!job}
            onChange={(event) =>
              setSource(event.target.value)
            }
          >
            <option value="">Select source</option>
            {renderShelfOptions()}
          </select>
        </label>

        <label>
          Destination shelf
          <select
            value={destination}
            disabled={busy || !!job}
            onChange={(event) =>
              setDestination(event.target.value)
            }
          >
            <option value="">Select destination</option>
            {renderShelfOptions()}
          </select>
        </label>
      </div>

      <p>
        Use shelf codes registered in RCS.
        This form does not bind carriers automatically.
      </p>

      <details>
        <summary>Request details</summary>
        <pre>
          {JSON.stringify(job?.payload || draft, null, 2)}
        </pre>
      </details>

      <button
        type="button"
        disabled={!valid || busy || !!job}
        onClick={submitTask}
      >
        Send transfer task
      </button>

      <div className="monitor-rcs-query">
        <label>
          RCS task ID
          <input
            value={queryCode}
            disabled={busy}
            onChange={(event) =>
              setQueryCode(event.target.value)
            }
            placeholder="Returned robotTaskCode"
          />
        </label>

        <button
          type="button"
          disabled={busy || !queryCode.trim()}
          onClick={queryTask}
        >
          Check task status
        </button>

        {job && (
          <button
            type="button"
            disabled={busy}
            onClick={startNewTask}
          >
            New task
          </button>
        )}
      </div>

      {job && (
        <div aria-live="polite">
          <p>
            <strong>Status:</strong>{" "}
            {job.status === "FINISHED"
              ? "COMPLETED (RCS: FINISHED)"
              : job.status}
          </p>

          {job.robotTaskCode && (
            <p>
              <strong>Task ID:</strong>{" "}
              {job.robotTaskCode}
            </p>
          )}

          {job.actualTask && (
            <p>
              RCS task type: {job.actualTask.taskType}
              {" · "}
              Route:{" "}
              {(job.actualTask.targetRoute || [])
                .map((point) => point.code)
                .join(" → ")}
            </p>
          )}
        </div>
      )}

      {message && <p role="alert">{message}</p>}

      <p>
        This panel tracks the task separately from the
        WMS queue. Inventory quantities are unchanged.
      </p>
    </section>
  );
}