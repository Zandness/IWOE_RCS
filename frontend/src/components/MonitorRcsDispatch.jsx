import { getLoadInfo } from "./LoadTypeVisual";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import LocationPicker from "./LocationPicker";
import { loadPreferences } from "../utils/dashboardData";

import {
  readMonitor,
  shelvesOf,
  validateTransfer,
  isReserved,
} from "../utils/basketStore";

import "../styles/MonitorRcsDispatch.css";

const HISTORY_PAGE_SIZE = 20;

const QUEUE_KEY = "wms-robot-tasks-v1";
const INPUT_HISTORY_KEY = "wms-transfer-input-history-v1";

const TARGET_TYPES = ["STORAGE", "SITE", "CARRIER"];

const TARGET_LABELS = {
  STORAGE: "STORAGE — Bin alias",
  SITE: "SITE — Point alias",
  CARRIER: "CARRIER — Carrier number",
};

const TARGET_HINTS = {
  STORAGE: "Enter the bin alias registered in RCS.",
  SITE: "Enter the point alias registered in RCS, such as QQ1.",
  CARRIER: "Enter the actual carrier number registered in RCS.",
};

const PRIORITIES = [30, 60, 90, 120];

const PRIORITY_LABELS = {
  30: "Low",
  60: "Normal",
  90: "High",
  120: "Urgent",
};

const FIELD_STYLE = {
  display: "grid",
  gap: 6,
  minWidth: 0,
};

const INPUT_STYLE = {
  boxSizing: "border-box",
  width: "100%",
  minWidth: 0,
  height: 40,
};

const TARGET_GRID_STYLE = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
  gap: 16,
  margin: "16px 0",
};

function cleanHistory(values) {
  if (!Array.isArray(values)) return [];

  return [
    ...new Set(
      values
        .filter((value) => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ].slice(0, 50);
}

function readInputHistory() {
  try {
    const data = JSON.parse(
      localStorage.getItem(INPUT_HISTORY_KEY) || "{}",
    );

    return {
      robots: cleanHistory(data?.robots),
      types: cleanHistory(data?.types),
      lastRobot:
        typeof data?.lastRobot === "string"
          ? data.lastRobot
          : "",
      lastType:
        typeof data?.lastType === "string"
          ? data.lastType
          : "CTUB1",
    };
  } catch {
    return {
      robots: [],
      types: [],
      lastRobot: "",
      lastType: "CTUB1",
    };
  }
}

function normalizePriority(value) {
  const priority = Number(value);
  return PRIORITIES.includes(priority) ? priority : 60;
}

function readTargetType(value) {
  // Old tasks without a target type keep the original STORAGE behavior.
  if (value == null || value === "") return "STORAGE";

  if (!TARGET_TYPES.includes(value)) {
    throw new Error(`Unsupported RCS target type: ${value}`);
  }

  return value;
}

function formatDate(value) {
  const date = new Date(value);

  return Number.isFinite(date.getTime())
    ? date.toLocaleString()
    : "—";
}

function unavailable(shelf, isSource) {
  const inventory = Array.isArray(shelf.inventory)
    ? shelf.inventory
    : [];

  return (
    isReserved(shelf.id) ||
    ["BLOCKED", "MAINTENANCE"].includes(shelf.status) ||
    (
      isSource
        ? !shelf.basket ||
          inventory.some((item) => Number(item.reserved) > 0)
        : Boolean(shelf.basket) || inventory.length > 0
    )
  );
}

function findSavedLocation(shelves, locationId, rcsCode, targetType) {
  // WMS location IDs remain valid when the API uses an independent
  // point alias or carrier number.
  if (locationId) {
    const matches = shelves.filter(
      (shelf) => shelf.id === locationId,
    );

    if (matches.length === 1) return matches[0];
  }

  // A carrier number must not be guessed to be a WMS location code.
  if (targetType !== "CARRIER" && rcsCode) {
    const matches = shelves.filter(
      (shelf) => shelf.code === rcsCode,
    );

    if (matches.length === 1) return matches[0];
  }

  throw new Error(
    "The saved WMS location could not be found. Select the source and destination manually.",
  );
}

export function loadCommandHistory() {
  const queue = JSON.parse(
    localStorage.getItem(QUEUE_KEY) || "[]",
  );

  if (!Array.isArray(queue)) {
    throw new Error("Command history cannot be read.");
  }

  return queue
    .filter(
      (task) =>
        task &&
        task.sourceRcsPointCode &&
        task.destinationRcsPointCode,
    )
    .sort(
      (a, b) =>
        (Date.parse(b.createdAt) || 0) -
        (Date.parse(a.createdAt) || 0),
    );
}

export function recallCommand(task, shelves) {
  const sourceType = readTargetType(task.sourceRcsTargetType);
  const destinationType = readTargetType(
    task.destinationRcsTargetType,
  );

  const source = findSavedLocation(
    shelves,
    task.sourceLocationId,
    task.sourceRcsPointCode,
    sourceType,
  );

  const destination = findSavedLocation(
    shelves,
    task.destinationLocationId,
    task.destinationRcsPointCode,
    destinationType,
  );

  return {
    taskType: task.rcsTaskType || "CTUB1",
    robotCode: task.rcsRobotCode || "",
    priority: normalizePriority(task.rcsPriority),
    source: source.id,
    destination: destination.id,
    sourceType,
    destinationType,
    sourceCode: String(task.sourceRcsPointCode || ""),
    destinationCode: String(task.destinationRcsPointCode || ""),
    sendTime: "",
  };
}

function RcsTargetFields({
  title,
  type,
  code,
  onTypeChange,
  onCodeChange,
  locationCode,
}) {
  return (
    <fieldset style={{ minWidth: 0, margin: 0 }}>
      <legend>{title}</legend>

      <label style={FIELD_STYLE}>
        RCS target type
        <select
          value={type}
          onChange={(event) => onTypeChange(event.target.value)}
          style={INPUT_STYLE}
        >
          {TARGET_TYPES.map((value) => (
            <option key={value} value={value}>
              {TARGET_LABELS[value]}
            </option>
          ))}
        </select>
      </label>

      <label style={{ ...FIELD_STYLE, marginTop: 12 }}>
        RCS target code
        <input
          required
          value={code}
          onChange={(event) => onCodeChange(event.target.value)}
          placeholder={
            type === "SITE"
              ? "e.g. QQ1"
              : type === "CARRIER"
                ? "Actual RCS carrier number"
                : "e.g. R8A04011"
          }
          style={INPUT_STYLE}
        />
      </label>

      <p style={{ overflowWrap: "anywhere" }}>
        {TARGET_HINTS[type]}
      </p>

      <p style={{ overflowWrap: "anywhere" }}>
        WMS location code: {locationCode || "No location selected"}
      </p>
    </fieldset>
  );
}

export default function MonitorRcsDispatch() {
  const navigate = useNavigate();
  const submitting = useRef(false);

  const [shelves, setShelves] = useState([]);
  const [source, setSource] = useState("");
  const [destination, setDestination] = useState("");

  const [sourceType, setSourceType] = useState("STORAGE");
  const [destinationType, setDestinationType] = useState("STORAGE");
  const [sourceCode, setSourceCode] = useState("");
  const [destinationCode, setDestinationCode] = useState("");

  const [taskType, setTaskType] = useState(
    () => readInputHistory().lastType,
  );
  const [robotCode, setRobotCode] = useState(
    () => readInputHistory().lastRobot,
  );
  const [inputHistory, setInputHistory] = useState(readInputHistory);

  const [priority, setPriority] = useState(() =>
    normalizePriority(loadPreferences().defaultPriority),
  );

  const [sendTime, setSendTime] = useState("");
  const [message, setMessage] = useState("");
  const [history, setHistory] = useState([]);
  const [historyError, setHistoryError] = useState("");
  const [search, setSearch] = useState("");
  const [historyPage, setHistoryPage] = useState(1);

  function rememberInputs() {
    const saved = readInputHistory();
    const robot = robotCode.trim();
    const type = taskType.trim();

    const add = (value, old) =>
      [...new Set([value, ...old].filter(Boolean))].slice(0, 50);

    const next = {
      robots: add(robot, saved.robots),
      types: add(type, saved.types),
      lastRobot: robot,
      lastType: type,
    };

    try {
      localStorage.setItem(INPUT_HISTORY_KEY, JSON.stringify(next));
      setInputHistory(next);
      return true;
    } catch {
      return false;
    }
  }

  function rememberOnBlur() {
    if (!rememberInputs()) {
      setMessage("Could not save input history in this browser.");
    }
  }

  useEffect(() => {
    function refresh() {
      try {
        setShelves(shelvesOf(readMonitor()));
      } catch (error) {
        setMessage(error.message);
      }

      try {
        setHistory(loadCommandHistory());
        setHistoryError("");
      } catch (error) {
        setHistory([]);
        setHistoryError(error.message);
      }
    }

    refresh();

    const events = [
      "wms-monitor-data-changed",
      "wms-data-changed",
      "storage",
      "focus",
    ];

    events.forEach((event) =>
      window.addEventListener(event, refresh),
    );

    return () => {
      events.forEach((event) =>
        window.removeEventListener(event, refresh),
      );
    };
  }, []);

  useEffect(() => {
    function selectPoint(event) {
      const { role, shelfId } = event.detail || {};

      if (!["source", "destination"].includes(role)) return;

      try {
        const current = shelvesOf(readMonitor());
        const shelf = current.find((item) => item.id === shelfId);

        if (!shelf || unavailable(shelf, role === "source")) {
          throw new Error(
            `This point cannot be used as ${role}. Check its load, stock and reservations.`,
          );
        }

        setShelves(current);

        if (role === "source") {
          setSource(shelfId);
          setDestination((value) => value === shelfId ? "" : value);
        } else {
          setDestination(shelfId);
          setSource((value) => value === shelfId ? "" : value);
        }

        // A changed location requires a fresh review of its RCS mapping.
        setMessage(
          `${shelf.code || shelf.id} selected as ${role}. Review the RCS target type and code.`,
        );
      } catch (error) {
        setMessage(error.message);
      }
    }

    window.addEventListener("wms-transfer-select", selectPoint);

    return () => {
      window.removeEventListener("wms-transfer-select", selectPoint);
    };
  }, []);

  // Reset an override when a different WMS location is selected.
  // Reuse is handled separately below to preserve its saved API codes.
  const previousLocations = useRef({ source: "", destination: "" });
  const recalledLocations = useRef(null);

  useEffect(() => {
    const previous = previousLocations.current;
    const recalled = recalledLocations.current;

    if (
      recalled &&
      recalled.source === source &&
      recalled.destination === destination
    ) {
      previousLocations.current = { source, destination };
      recalledLocations.current = null;
      return;
    }

    if (previous.source !== source) {
      const selected = shelves.find((item) => item.id === source);
      setSourceCode(
        sourceType === "CARRIER" ? "" : selected?.code || "",
      );
    }

    if (previous.destination !== destination) {
      const selected = shelves.find((item) => item.id === destination);
      setDestinationCode(
        destinationType === "CARRIER" ? "" : selected?.code || "",
      );
    }

    previousLocations.current = { source, destination };
  }, [source, destination, shelves, sourceType, destinationType]);

  function changeSourceType(value) {
    setSourceType(value);
    setSourceCode("");
    setMessage("Enter the source RCS code for the selected target type.");
  }

  function changeDestinationType(value) {
    setDestinationType(value);
    setDestinationCode("");
    setMessage(
      "Enter the destination RCS code for the selected target type.",
    );
  }

  function reuse(task) {
    try {
      const currentShelves = shelvesOf(readMonitor());
      const values = recallCommand(task, currentShelves);

      recalledLocations.current = {
        source: values.source,
        destination: values.destination,
      };

      setShelves(currentShelves);
      setTaskType(values.taskType);
      setRobotCode(values.robotCode);
      setPriority(values.priority);
      setSource(values.source);
      setDestination(values.destination);
      setSourceType(values.sourceType);
      setDestinationType(values.destinationType);
      setSourceCode(values.sourceCode);
      setDestinationCode(values.destinationCode);
      setSendTime("");

      const priorityChanged = !PRIORITIES.includes(
        Number(task.rcsPriority),
      );

      setMessage(
        "Copied to the form. Review the WMS locations, RCS target types and codes before adding a new task. Nothing has been sent." +
        (
          priorityChanged
            ? " Normal priority (60) was selected because the saved priority is not supported."
            : ""
        ),
      );
    } catch (error) {
      setMessage(error.message);
    }
  }

  function submit(event) {
    event.preventDefault();
    if (submitting.current) return;

    submitting.current = true;

    const startAfterEnqueue =
      event.nativeEvent.submitter?.value === "start";

    try {
      const type = taskType.trim();
      const sourceRcsCode = sourceCode.trim();
      const destinationRcsCode = destinationCode.trim();

      if (!type) {
        throw new Error("Enter the task type registered in RCS.");
      }

      if (!PRIORITIES.includes(priority)) {
        throw new Error("Select a valid priority.");
      }

      readTargetType(sourceType);
      readTargetType(destinationType);

      if (!sourceRcsCode || !destinationRcsCode) {
        throw new Error("Enter both source and destination RCS codes.");
      }

      if (
        sourceType === destinationType &&
        sourceRcsCode === destinationRcsCode
      ) {
        throw new Error("Source and destination RCS targets must differ.");
      }

      // Keep the existing WMS stock, occupancy and reservation checks.
      const { from, to } = validateTransfer(source, destination);

      const time = sendTime ? new Date(sendTime) : new Date();

      if (!Number.isFinite(time.getTime())) {
        throw new Error("Invalid send time.");
      }

      const request = {
        handled: false,
        error: "",
        payload: {
          startAfterEnqueue,
          from,
          to,
          scheduledSendAt: time.toISOString(),
          draft: {
            taskType: type,
            robotCode: robotCode.trim(),
            initPriority: priority,

            // RobotTaskDispatcher must read these two objects.
            // The WMS location IDs still come from from.id and to.id.
            source: {
              type: sourceType,
              code: sourceRcsCode,
            },
            destination: {
              type: destinationType,
              code: destinationRcsCode,
            },
          },
        },
      };

      window.dispatchEvent(
        new CustomEvent("wms-rcs-enqueue-request", {
          detail: request,
        }),
      );

      if (!request.handled || request.error) {
        throw new Error(
          request.error || "Dispatch queue unavailable.",
        );
      }

      const historySaved = rememberInputs();

      setSource("");
      setDestination("");
      setSourceCode("");
      setDestinationCode("");
      setSendTime("");

      setMessage(
        `${type} added to the queue and command history.` +
        (
          historySaved
            ? ""
            : " Robot and task-type input history could not be saved."
        ),
      );

      try {
        setHistory(loadCommandHistory());
        setHistoryError("");
      } catch (error) {
        setHistoryError(error.message);
      }

      if (startAfterEnqueue) navigate("/dispatcher");
    } catch (error) {
      setMessage(error.message);
    } finally {
      submitting.current = false;
    }
  }

  const from = shelves.find((shelf) => shelf.id === source);
  const to = shelves.find((shelf) => shelf.id === destination);

  const types = [
    ...new Set([
      "CTUB1",
      ...inputHistory.types,
      ...history.map((task) => task.rcsTaskType).filter(Boolean),
    ]),
  ];

  const robots = [
    ...new Set([
      ...inputHistory.robots,
      ...history.map((task) => task.rcsRobotCode).filter(Boolean),
    ]),
  ];

  const query = search.trim().toLowerCase();

  const filtered = history.filter((task) =>
    [
      task.id,
      task.rcsTaskType,
      task.sourceRcsPointCode,
      task.destinationRcsPointCode,
      task.sourceRcsTargetType,
      task.destinationRcsTargetType,
      task.rcsTaskChainCode,
      task.basketId,
    ]
      .join(" ")
      .toLowerCase()
      .includes(query),
  );

  const historyPageCount = Math.max(
    1,
    Math.ceil(filtered.length / HISTORY_PAGE_SIZE),
  );
  const currentHistoryPage = Math.min(historyPage, historyPageCount);
  const historyOffset = (currentHistoryPage - 1) * HISTORY_PAGE_SIZE;
  const visibleHistory = filtered.slice(
    historyOffset,
    historyOffset + HISTORY_PAGE_SIZE,
  );

  useEffect(() => {
    setHistoryPage((page) => Math.min(page, historyPageCount));
  }, [historyPageCount]);

  const preview = {
    taskType: taskType.trim(),
    ...(robotCode.trim() ? { robotCode: robotCode.trim() } : {}),
    targetRoute: [
      {
        type: sourceType,
        code: sourceCode.trim(),
        seq: 0,
        autoStart: 1,
      },
      {
        type: destinationType,
        code: destinationCode.trim(),
        seq: 1,
        autoStart: 1,
      },
    ],
    initPriority: priority,
  };

  const cannotSubmit =
    !source ||
    !destination ||
    !taskType.trim() ||
    !sourceCode.trim() ||
    !destinationCode.trim();

  return (
    <section
      id="monitor-transfer-form"
      className="monitor-rcs-panel"
    >
      <h3>
        {from
          ? `Move a ${getLoadInfo(from.loadType).label.toLowerCase()}`
          : "Move a load"}
      </h3>

      <p>
        Select the WMS locations, then set the RCS target types and
        codes required by the selected workflow.
      </p>

      <form onSubmit={submit}>
        <div className="monitor-rcs-fields">
          <label>
            Task type
            <input
              required
              value={taskType}
              list="rcs-task-types"
              onBlur={rememberOnBlur}
              onChange={(event) => setTaskType(event.target.value)}
              placeholder="e.g. CTUB1 or PF-LMR-COMMON"
            />
            <datalist id="rcs-task-types">
              {types.map((type) => (
                <option key={type} value={type} />
              ))}
            </datalist>
          </label>

          <label>
            Robot code (optional)
            <input
              value={robotCode}
              list="rcs-robot-codes"
              onChange={(event) => setRobotCode(event.target.value)}
              onBlur={rememberOnBlur}
              placeholder="Leave empty for RCS assignment"
            />
            <datalist id="rcs-robot-codes">
              {robots.map((code) => (
                <option key={code} value={code} />
              ))}
            </datalist>
          </label>

          <label>
            Priority
            <select
              value={priority}
              onChange={(event) => setPriority(Number(event.target.value))}
            >
              {PRIORITIES.map((value) => (
                <option key={value} value={value}>
                  {PRIORITY_LABELS[value]} · {value}
                </option>
              ))}
            </select>
          </label>

          <LocationPicker
            label="Source location"
            shelves={shelves}
            value={source}
            onChange={setSource}
            unavailable={(shelf) =>
              shelf.id === destination ||
              unavailable(shelf, true)
            }
          />

          <LocationPicker
            label="Destination location"
            shelves={shelves}
            value={destination}
            onChange={setDestination}
            unavailable={(shelf) =>
              shelf.id === source ||
              (Boolean(from) && shelf.loadType !== from.loadType) ||
              unavailable(shelf, false)
            }
          />

          <label>
            Scheduled send time
            <input
              type="datetime-local"
              value={sendTime}
              onChange={(event) => setSendTime(event.target.value)}
            />
          </label>
        </div>

        <div style={TARGET_GRID_STYLE}>
          <RcsTargetFields
            title="Source RCS target"
            type={sourceType}
            code={sourceCode}
            onTypeChange={changeSourceType}
            onCodeChange={setSourceCode}
            locationCode={from?.code}
          />

          <RcsTargetFields
            title="Destination RCS target"
            type={destinationType}
            code={destinationCode}
            onTypeChange={changeDestinationType}
            onCodeChange={setDestinationCode}
            locationCode={to?.code}
          />
        </div>

        <p>
          The RCS codes must refer to the selected WMS locations or
          their loads. For CARRIER, use the actual RCS carrier number.
        </p>

        <p>
          Leave the send time empty to make the task available for
          dispatch immediately.
        </p>

        {from && (
          <p>
            Selected load:{" "}
            <strong>
              {getLoadInfo(from.loadType).label}
              {" · "}
              {from.basket ? "Occupied" : "Empty"}
            </strong>
          </p>
        )}

        <details>
          <summary>Command JSON preview</summary>
          <pre
            style={{
              maxWidth: "100%",
              overflowX: "auto",
              whiteSpace: "pre-wrap",
              overflowWrap: "anywhere",
            }}
          >
            {JSON.stringify(preview, null, 2)}
          </pre>
        </details>

        <div className="monitor-rcs-actions">
          <button
            type="submit"
            value="queue"
            disabled={cannotSubmit}
          >
            Add to queue
          </button>

          <button
            type="submit"
            value="start"
            disabled={cannotSubmit}
          >
            Add and start dispatch
          </button>

          <Link to="/dispatcher">Open RCS Dispatch</Link>
        </div>

        {message && <p role="status">{message}</p>}
      </form>

      <hr />

      <details className="command-history-collapse">
        <summary
          style={{
            cursor: "pointer",
            padding: "14px 0",
            fontSize: 16,
            fontWeight: 600,
            overflowWrap: "anywhere",
          }}
        >
          Command history · {historyError ? "Unavailable" : `${history.length} entries`}
        </summary>

        <p>
          Reuse a previous command to fill in the form. Review the
          locations, target types and codes before adding a new task.
        </p>

        <label>
          Search command history
          <input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setHistoryPage(1);
            }}
            placeholder="Task type, location, target type or task code"
          />
        </label>

        {historyError && <p role="alert">{historyError}</p>}

        <div
          className="table-wrapper"
          style={{ overflowX: "auto" }}
        >
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>Created / task</th>
                <th>Task type</th>
                <th>Source</th>
                <th>Destination</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {!filtered.length && (
                <tr>
                  <td colSpan={7}>
                    {historyError
                      ? "Command history is unavailable."
                      : "No command history found."}
                  </td>
                </tr>
              )}

              {visibleHistory.map((task, index) => {
                const savedPriority = Number(task.rcsPriority);
                const priorityLabel = PRIORITY_LABELS[savedPriority];

                const status = task.backendError
                  ? "NEEDS_ATTENTION"
                  : task.sendStatus === "SENT"
                    ? task.rcsStatus || "SENT"
                    : task.sendStatus || "NOT_SENT";

                return (
                  <tr key={task.id || task.rcsTaskChainCode || index}>
                    <td>
                      {formatDate(task.createdAt)}
                      <br />
                      {task.rcsTaskChainCode || task.id || "—"}
                    </td>

                    <td>{task.rcsTaskType || "CTUB1"}</td>

                    <td>
                      {task.sourceRcsTargetType || "STORAGE"}
                      <br />
                      {task.sourceRcsPointCode}
                    </td>

                    <td>
                      {task.destinationRcsTargetType || "STORAGE"}
                      <br />
                      {task.destinationRcsPointCode}
                    </td>

                    <td>
                      {Number.isFinite(savedPriority)
                        ? `${priorityLabel || "Previous value"} · ${savedPriority}`
                        : "—"}
                    </td>

                    <td>{status}</td>

                    <td>
                      <button type="button" onClick={() => reuse(task)}>
                        Reuse
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <nav
          aria-label="Command history pagination"
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            marginTop: 12,
          }}
        >
          <span role="status" style={{ fontSize: 13 }}>
            {filtered.length
              ? `${historyOffset + 1}–${Math.min(historyOffset + HISTORY_PAGE_SIZE, filtered.length)} of ${filtered.length} entries`
              : "0 entries"}
            {" · "}Page {currentHistoryPage} of {historyPageCount}
          </span>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <button
              type="button"
              disabled={currentHistoryPage <= 1}
              onClick={() => setHistoryPage(currentHistoryPage - 1)}
              style={{ margin: 0 }}
            >
              Previous
            </button>
            <button
              type="button"
              disabled={currentHistoryPage >= historyPageCount}
              onClick={() => setHistoryPage(currentHistoryPage + 1)}
              style={{ margin: 0 }}
            >
              Next
            </button>
          </div>
        </nav>

        <p>
          History is stored in this browser using the dispatch queue.
          Tasks removed from the queue are also removed from this list.
        </p>
      </details>
    </section>
  );
}