import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import LocationPicker from "./LocationPicker";

import {
  loadPreferences,
} from "../utils/dashboardData";

import {
  readMonitor,
  shelvesOf,
  validateTransfer,
  isReserved,
} from "../utils/basketStore";

import "../styles/MonitorRcsDispatch.css";

const PRIORITIES = [30, 60, 90, 120];

const PRIORITY_LABELS = {
  30: "Low",
  60: "Normal",
  90: "High",
  120: "Urgent",
};

function normalizePriority(value) {
  const priority = Number(value);

  return PRIORITIES.includes(priority)
    ? priority
    : 60;
}

function formatDate(value) {
  const date = new Date(value);

  return Number.isFinite(date.getTime())
    ? date.toLocaleString()
    : "—";
}

export function loadCommandHistory() {
  const queue = JSON.parse(
    localStorage.getItem("wms-robot-tasks-v1") || "[]",
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
  const source = shelves.filter(
    (shelf) =>
      shelf.code === task.sourceRcsPointCode,
  );

  const destination = shelves.filter(
    (shelf) =>
      shelf.code === task.destinationRcsPointCode,
  );

  if (
    source.length !== 1 ||
    destination.length !== 1
  ) {
    throw new Error(
      "The saved location codes are missing or duplicated. Check Monitor location codes first.",
    );
  }

  return {
    taskType: task.rcsTaskType || "CTUB1",
    priority: normalizePriority(task.rcsPriority),
    source: source[0].id,
    destination: destination[0].id,
    sendTime: "",
  };
}

export default function MonitorRcsDispatch() {
  const navigate = useNavigate();

  const [shelves, setShelves] = useState([]);
  const [source, setSource] = useState("");
  const [destination, setDestination] = useState("");
  const [taskType, setTaskType] = useState("CTUB1");

  const [priority, setPriority] = useState(() =>
    normalizePriority(loadPreferences().defaultPriority),
  );

  const [sendTime, setSendTime] = useState("");
  const [message, setMessage] = useState("");
  const [history, setHistory] = useState([]);
  const [historyError, setHistoryError] = useState("");
  const [search, setSearch] = useState("");

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

    events.forEach((event) => {
      window.addEventListener(event, refresh);
    });

    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, refresh);
      });
    };
  }, []);

  useEffect(() => {
    function selectPoint(event) {
      const { role, shelfId } = event.detail || {};

      if (!["source", "destination"].includes(role)) {
        return;
      }

      try {
        const current = shelvesOf(readMonitor());

        const shelf = current.find(
          (item) => item.id === shelfId,
        );

        if (
          !shelf ||
          !shelf.code ||
          unavailable(shelf, role === "source")
        ) {
          throw new Error(
            `This point cannot be used as ${role}. Check its basket, stock and reservations.`,
          );
        }

        setShelves(current);

        if (role === "source") {
          setSource(shelfId);

          setDestination((value) =>
            value === shelfId ? "" : value,
          );
        } else {
          setDestination(shelfId);

          setSource((value) =>
            value === shelfId ? "" : value,
          );
        }

        setMessage(
          `${shelf.code} selected as ${role}. Review the form before adding a task.`,
        );
      } catch (error) {
        setMessage(error.message);
      }
    }

    window.addEventListener(
      "wms-transfer-select",
      selectPoint,
    );

    return () => {
      window.removeEventListener(
        "wms-transfer-select",
        selectPoint,
      );
    };
  }, []);

  function reuse(task) {
    try {
      const currentShelves = shelvesOf(readMonitor());

      const values = recallCommand(
        task,
        currentShelves,
      );

      setShelves(currentShelves);
      setTaskType(values.taskType);
      setPriority(values.priority);
      setSource(values.source);
      setDestination(values.destination);
      setSendTime(values.sendTime);

      const priorityChanged = !PRIORITIES.includes(
        Number(task.rcsPriority),
      );

      setMessage(
        "Copied to the form. Review the basket, destination and time before adding a new task. Nothing has been sent." +
          (
            priorityChanged
              ? " The saved priority is not supported, so Normal (60) was selected."
              : ""
          ),
      );
    } catch (error) {
      setMessage(error.message);
    }
  }

  function submit(event) {
    event.preventDefault();

    const startAfterEnqueue =
      event.nativeEvent.submitter?.value === "start";

    try {
      const type = taskType.trim();

      if (!type) {
        throw new Error(
          "Enter the task type registered in RCS.",
        );
      }

      if (!PRIORITIES.includes(priority)) {
        throw new Error(
          "Select a valid priority: Low, Normal, High or Urgent.",
        );
      }

      const { from, to } = validateTransfer(
        source,
        destination,
      );

      const time = sendTime
        ? new Date(sendTime)
        : new Date();

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
            initPriority: priority,
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

      setSource("");
      setDestination("");
      setSendTime("");

      setMessage(
        `${type} added to the queue and command history.`,
      );

      try {
        setHistory(loadCommandHistory());
        setHistoryError("");
      } catch (error) {
        setHistoryError(error.message);
      }

      if (startAfterEnqueue) {
        navigate("/dispatcher");
      }
    } catch (error) {
      setMessage(error.message);
    }
  }

  function unavailable(shelf, isSource) {
    const inventory = Array.isArray(shelf.inventory)
      ? shelf.inventory
      : [];

    return (
      isReserved(shelf.id) ||
      ["BLOCKED", "MAINTENANCE"].includes(
        shelf.status,
      ) ||
      (
        isSource
          ? !shelf.basket ||
            inventory.some(
              (item) => Number(item.reserved) > 0,
            )
          : !!shelf.basket || inventory.length > 0
      )
    );
  }

  const from = shelves.find(
    (shelf) => shelf.id === source,
  );

  const to = shelves.find(
    (shelf) => shelf.id === destination,
  );

  const types = [
    ...new Set([
      "CTUB1",
      ...history
        .map((task) => task.rcsTaskType)
        .filter(Boolean),
    ]),
  ];

  const query = search.trim().toLowerCase();

  const filtered = history.filter((task) =>
    [
      task.id,
      task.rcsTaskType,
      task.sourceRcsPointCode,
      task.destinationRcsPointCode,
      task.rcsTaskChainCode,
      task.basketId,
    ]
      .join(" ")
      .toLowerCase()
      .includes(query),
  );

  const preview = {
    taskType: taskType.trim(),

    targetRoute: [
      {
        type: "STORAGE",
        code: from?.code || "",
        seq: 0,
        autoStart: 1,
      },
      {
        type: "STORAGE",
        code: to?.code || "",
        seq: 1,
        autoStart: 1,
      },
    ],

    initPriority: priority,
  };

  return (
    <section
      id="monitor-transfer-form"
      className="monitor-rcs-panel"
    >
      <h3>Move a basket</h3>

      <p>
        Select a workflow registered in RCS for a
        two-location storage transfer.
      </p>

      <form onSubmit={submit}>
        <div className="monitor-rcs-fields">
          <label>
            Task type

            <input
              required
              value={taskType}
              list="rcs-task-types"
              onChange={(event) =>
                setTaskType(event.target.value)
              }
              placeholder="e.g. CTUB1"
            />

            <datalist id="rcs-task-types">
              {types.map((type) => (
                <option key={type} value={type} />
              ))}
            </datalist>
          </label>

          <label>
            Priority

            <select
              value={priority}
              onChange={(event) =>
                setPriority(Number(event.target.value))
              }
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
              !shelf.code ||
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
              !shelf.code ||
              shelf.id === source ||
              unavailable(shelf, false)
            }
          />

          <label>
            Scheduled send time

            <input
              type="datetime-local"
              value={sendTime}
              onChange={(event) =>
                setSendTime(event.target.value)
              }
            />
          </label>
        </div>

        <p>
          Leave the send time empty to make the task
          available for dispatch immediately.
        </p>

        {from && (
          <p>
            Selected basket:{" "}
            <strong>
              {from.basket?.id || "No basket"}
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
            disabled={
              !source ||
              !destination ||
              !taskType.trim()
            }
          >
            Add to queue
          </button>

          <button
            type="submit"
            value="start"
            disabled={
              !source ||
              !destination ||
              !taskType.trim()
            }
          >
            Add and start dispatch
          </button>

          <Link to="/dispatcher">
            Open RCS Dispatch
          </Link>
        </div>

        {message && (
          <p role="status">{message}</p>
        )}
      </form>

      <hr />

      <h3>Command history</h3>

      <p>
        Reuse a previous command to fill in the form.
        Review it before adding a new task.
      </p>

      <label>
        Search command history

        <input
          type="search"
          value={search}
          onChange={(event) =>
            setSearch(event.target.value)
          }
          placeholder="Task type, location, basket or task code"
        />
      </label>

      {historyError && (
        <p role="alert">{historyError}</p>
      )}

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

            {filtered.map((task, index) => {
              const savedPriority = Number(
                task.rcsPriority,
              );

              const priorityLabel =
                PRIORITY_LABELS[savedPriority];

              const status = task.backendError
                ? "NEEDS_ATTENTION"
                : task.sendStatus === "SENT"
                  ? task.rcsStatus || "SENT"
                  : task.sendStatus || "NOT_SENT";

              return (
                <tr
                  key={
                    task.id ||
                    task.rcsTaskChainCode ||
                    index
                  }
                >
                  <td>
                    {formatDate(task.createdAt)}
                    <br />
                    {task.rcsTaskChainCode ||
                      task.id ||
                      "—"}
                  </td>

                  <td>
                    {task.rcsTaskType || "CTUB1"}
                  </td>

                  <td>{task.sourceRcsPointCode}</td>

                  <td>
                    {task.destinationRcsPointCode}
                  </td>

                  <td>
                    {Number.isFinite(savedPriority)
                      ? `${priorityLabel || "Previous value"} · ${savedPriority}`
                      : "—"}
                  </td>

                  <td>{status}</td>

                  <td>
                    <button
                      type="button"
                      onClick={() => reuse(task)}
                    >
                      Reuse
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p>
        History is stored in this browser using the
        dispatch queue. Tasks removed from the queue
        are also removed from this list.
      </p>
    </section>
  );
}