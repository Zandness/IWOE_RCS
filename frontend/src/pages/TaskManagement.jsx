import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle2,
  ClipboardList,
  Clock,
  MapPin,
  Play,
  RefreshCw,
  Search,
} from "lucide-react";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  INBOUND_STORAGE_KEY,
  LOCATION_STORAGE_KEY,
  OUTBOUND_STORAGE_KEY,
  TASK_STORAGE_KEY,
  loadTasks,
  saveTasks,
  syncTaskStatusToOperations,
  syncWarehouseTasks,
} from "../utils/taskOperationSync";

import "../styles/TaskManagement.css";


const STATUS_ORDER = {
  BLOCKED: 0,
  IN_PROGRESS: 1,
  PENDING: 2,
  COMPLETED: 3,
};


const PRIORITY_ORDER = {
  URGENT: 0,
  HIGH: 1,
  NORMAL: 2,
  LOW: 3,
};


export default function TaskManagement() {
  const [
    tasks,
    setTasks,
  ] = useState(
    () =>
      syncWarehouseTasks(
        loadTasks()
      )
  );


  const [
    search,
    setSearch,
  ] = useState("");


  const [
    typeFilter,
    setTypeFilter,
  ] = useState(
    "ALL"
  );


  const [
    statusFilter,
    setStatusFilter,
  ] = useState(
    "ALL"
  );


  const [
    saveMessage,
    setSaveMessage,
  ] = useState("");


  const [
    lastSync,
    setLastSync,
  ] = useState(
    new Date().toISOString()
  );


  /*
   * =====================================================
   * SAVE TASK
   * =====================================================
   */

  useEffect(() => {
    const result =
      saveTasks(
        tasks
      );


    setSaveMessage(
      result.ok
        ? "Saved locally"
        : "Local save failed"
    );
  }, [tasks]);


  /*
   * =====================================================
   * SYNC OPERATION -> TASK
   * =====================================================
   */

  function syncFromOperations() {
    setTasks(
      (current) =>
        syncWarehouseTasks(
          current
        )
    );


    setLastSync(
      new Date().toISOString()
    );
  }


  /*
   * =====================================================
   * LISTEN DATA CHANGE
   * =====================================================
   */

  useEffect(() => {
    function handleStorage(
      event
    ) {
      /*
       * Task changed
       * from another browser tab.
       */

      if (
        event.key ===
          TASK_STORAGE_KEY &&
        event.newValue
      ) {
        setTasks(
          loadTasks()
        );

        return;
      }


      /*
       * Operation changed.
       */

      if (
        [
          INBOUND_STORAGE_KEY,
          OUTBOUND_STORAGE_KEY,
          LOCATION_STORAGE_KEY,
        ].includes(
          event.key
        )
      ) {
        syncFromOperations();
      }
    }


    /*
     * Same browser tab.
     */

    function handleWmsDataChanged(
      event
    ) {
      const keys =
        event.detail?.keys ||
        [];


      if (
        keys.some(
          (key) =>
            [
              INBOUND_STORAGE_KEY,
              OUTBOUND_STORAGE_KEY,
              LOCATION_STORAGE_KEY,
            ].includes(
              key
            )
        )
      ) {
        syncFromOperations();
      }
    }


    function handleFocus() {
      syncFromOperations();
    }


    window.addEventListener(
      "storage",
      handleStorage
    );


    window.addEventListener(
      "wms-data-changed",
      handleWmsDataChanged
    );


    window.addEventListener(
      "focus",
      handleFocus
    );


    return () => {
      window.removeEventListener(
        "storage",
        handleStorage
      );


      window.removeEventListener(
        "wms-data-changed",
        handleWmsDataChanged
      );


      window.removeEventListener(
        "focus",
        handleFocus
      );
    };
  }, []);


  /*
   * =====================================================
   * SUMMARY
   * =====================================================
   */

  const summary =
    useMemo(
      () => ({
        total:
          tasks.length,

        pending:
          tasks.filter(
            (task) =>
              task.status ===
              "PENDING"
          ).length,

        inProgress:
          tasks.filter(
            (task) =>
              task.status ===
              "IN_PROGRESS"
          ).length,

        blocked:
          tasks.filter(
            (task) =>
              task.status ===
              "BLOCKED"
          ).length,

        completed:
          tasks.filter(
            (task) =>
              task.status ===
              "COMPLETED"
          ).length,
      }),
      [tasks]
    );


  /*
   * =====================================================
   * SEARCH
   * =====================================================
   */

  const filteredTasks =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();


      return [
        ...tasks,
      ]
        .filter(
          (task) => {
            const matchesType =
              typeFilter ===
                "ALL" ||
              task.type ===
                typeFilter;


            const matchesStatus =
              statusFilter ===
                "ALL" ||
              task.status ===
                statusFilter;


            const searchable = [
              task.id,
              task.type,
              task.sourceOrderId,
              task.sourceOrderNo,
              task.sku,
              task.itemName,
              task.sourceLabel,
              task.destinationLabel,
              task.sourceLocationId,
              task.destinationLocationId,
              task.sourceNodeId,
              task.destinationNodeId,
              task.priority,
              task.status,
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();


            return (
              matchesType &&
              matchesStatus &&
              (
                !query ||
                searchable.includes(
                  query
                )
              )
            );
          }
        )
        .sort(
          (a, b) => {
            const statusCompare =
              (
                STATUS_ORDER[
                  a.status
                ] ?? 99
              ) -
              (
                STATUS_ORDER[
                  b.status
                ] ?? 99
              );


            if (
              statusCompare !==
              0
            ) {
              return statusCompare;
            }


            const priorityCompare =
              (
                PRIORITY_ORDER[
                  a.priority
                ] ?? 99
              ) -
              (
                PRIORITY_ORDER[
                  b.priority
                ] ?? 99
              );


            if (
              priorityCompare !==
              0
            ) {
              return priorityCompare;
            }


            return (
              getTime(
                b.createdAt
              ) -
              getTime(
                a.createdAt
              )
            );
          }
        );
    }, [
      tasks,
      search,
      typeFilter,
      statusFilter,
    ]);


  /*
   * =====================================================
   * TASK STATUS
   * =====================================================
   */

  function updateTaskStatus(
    taskId,
    nextStatus
  ) {
    const now =
      new Date().toISOString();


    /*
     * Build next Task state.
     */

    const nextTasks =
      tasks.map(
        (task) => {
          if (
            task.id !==
            taskId
          ) {
            return task;
          }


          /*
           * START / RESUME
           */

          if (
            nextStatus ===
            "IN_PROGRESS"
          ) {
            return {
              ...task,

              status:
                "IN_PROGRESS",

              startedAt:
                task.startedAt ||
                now,

              completedAt:
                "",

              blockedAt:
                "",
            };
          }


          /*
           * COMPLETE
           */

          if (
            nextStatus ===
            "COMPLETED"
          ) {
            return {
              ...task,

              status:
                "COMPLETED",

              startedAt:
                task.startedAt ||
                now,

              completedAt:
                now,

              blockedAt:
                "",
            };
          }


          /*
           * BLOCK
           */

          if (
            nextStatus ===
            "BLOCKED"
          ) {
            return {
              ...task,

              status:
                "BLOCKED",

              blockedAt:
                now,
            };
          }


          /*
           * PENDING
           */

          return {
            ...task,

            status:
              "PENDING",

            completedAt:
              "",

            blockedAt:
              "",
          };
        }
      );


    const changedTask =
      nextTasks.find(
        (task) =>
          task.id ===
          taskId
      );


    /*
     * TASK -> INBOUND / OUTBOUND
     */

    const result =
      syncTaskStatusToOperations({
        changedTask,

        allTasks:
          nextTasks,

        nextStatus,

        now,
      });


    /*
     * If operation update fails,
     * do not update Task.
     */

    if (!result.ok) {
      window.alert(
        result.message ||
        "Could not update Warehouse Operation."
      );

      return;
    }


    /*
     * Re-sync again after
     * operation status changes.
     */

    setTasks(
      syncWarehouseTasks(
        nextTasks
      )
    );


    setLastSync(
      now
    );
  }


  /*
   * =====================================================
   * PRIORITY
   * =====================================================
   */

  function updatePriority(
    taskId,
    priority
  ) {
    setTasks(
      (current) =>
        current.map(
          (task) =>
            task.id ===
            taskId
              ? {
                  ...task,
                  priority,
                }
              : task
        )
    );
  }


  return (
    <div className="task-management-page">

      {/* HEADER */}

      <div className="task-management-header">
        <div>
          <span className="task-management-label">
            WAREHOUSE EXECUTION
          </span>

          <h2>
            Task Management
          </h2>

          <p>
            Manage warehouse putaway
            and picking tasks generated
            from Warehouse Operations.
          </p>
        </div>


        <div className="task-header-actions">
          {saveMessage && (
            <span
              className={`task-save-state ${
                saveMessage.includes(
                  "failed"
                )
                  ? "error"
                  : ""
              }`}
            >
              {saveMessage}
            </span>
          )}


          <button
            type="button"
            className="task-sync-button"
            onClick={
              syncFromOperations
            }
          >
            <RefreshCw
              size={16}
            />

            Sync Operations
          </button>
        </div>
      </div>


      {/* SYNC INFO */}

      <div className="task-sync-info">
        <span>
          Two-way sync:
        </span>

        <strong>
          Inbound Receiving / Putaway
        </strong>

        <span>
          and
        </span>

        <strong>
          Outbound Allocation / Picking
        </strong>

        <div className="task-sync-time">
          Last sync:
          {" "}
          {
            formatDateTime(
              lastSync
            )
          }
        </div>
      </div>


      {/* SUMMARY */}

      <div className="task-summary-grid">
        <SummaryCard
          icon={
            <ClipboardList
              size={21}
            />
          }
          title="Total Tasks"
          value={
            summary.total
          }
        />


        <SummaryCard
          icon={
            <Clock
              size={21}
            />
          }
          title="Pending"
          value={
            summary.pending
          }
        />


        <SummaryCard
          icon={
            <Play
              size={21}
            />
          }
          title="In Progress"
          value={
            summary.inProgress
          }
          tone="progress"
        />


        <SummaryCard
          icon={
            <AlertTriangle
              size={21}
            />
          }
          title="Blocked"
          value={
            summary.blocked
          }
          tone="danger"
        />


        <SummaryCard
          icon={
            <CheckCircle2
              size={21}
            />
          }
          title="Completed"
          value={
            summary.completed
          }
          tone="success"
        />
      </div>


      {/* PANEL */}

      <section className="task-panel">
        <div className="task-panel-header">
          <div>
            <h3>
              Warehouse Task Queue
            </h3>

            <p>
              Completing tasks here
              also updates the related
              Inbound / Outbound operation.
            </p>
          </div>


          <div className="task-toolbar">
            <div className="task-search">
              <Search
                size={17}
              />

              <input
                value={
                  search
                }
                placeholder="Search task, order, SKU or location..."
                onChange={(
                  event
                ) =>
                  setSearch(
                    event.target
                      .value
                  )
                }
              />
            </div>


            <select
              value={
                typeFilter
              }
              onChange={(
                event
              ) =>
                setTypeFilter(
                  event.target
                    .value
                )
              }
            >
              <option value="ALL">
                All Types
              </option>

              <option value="PUTAWAY">
                Putaway
              </option>

              <option value="PICKING">
                Picking
              </option>
            </select>


            <select
              value={
                statusFilter
              }
              onChange={(
                event
              ) =>
                setStatusFilter(
                  event.target
                    .value
                )
              }
            >
              <option value="ALL">
                All Status
              </option>

              <option value="PENDING">
                Pending
              </option>

              <option value="IN_PROGRESS">
                In Progress
              </option>

              <option value="BLOCKED">
                Blocked
              </option>

              <option value="COMPLETED">
                Completed
              </option>
            </select>
          </div>
        </div>


        {/* TABLE */}

        <div className="task-table-wrapper">
          <table className="task-table">
            <thead>
              <tr>
                <th>
                  Task
                </th>

                <th>
                  Type
                </th>

                <th>
                  Source Order
                </th>

                <th>
                  SKU
                </th>

                <th>
                  Qty
                </th>

                <th>
                  Route
                </th>

                <th>
                  Map Node
                </th>

                <th>
                  Priority
                </th>

                <th>
                  Status
                </th>

                <th>
                  Actions
                </th>
              </tr>
            </thead>


            <tbody>
              {filteredTasks.map(
                (task) => (
                  <TaskRow
                    key={
                      task.id
                    }
                    task={
                      task
                    }
                    onStatusChange={
                      updateTaskStatus
                    }
                    onPriorityChange={
                      updatePriority
                    }
                  />
                )
              )}
            </tbody>
          </table>


          {filteredTasks.length ===
            0 && (
            <div className="task-empty">
              <ClipboardList
                size={32}
              />

              <strong>
                No warehouse tasks
              </strong>

              <span>
                Receive an inbound
                order or allocate an
                outbound order, then
                press Sync Operations.
              </span>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}


/*
 * =====================================================
 * SUMMARY
 * =====================================================
 */

function SummaryCard({
  icon,
  title,
  value,
  tone = "default",
}) {
  return (
    <div
      className={`task-summary-card tone-${tone}`}
    >
      <div className="task-summary-icon">
        {icon}
      </div>

      <div>
        <span>
          {title}
        </span>

        <strong>
          {value}
        </strong>
      </div>
    </div>
  );
}


/*
 * =====================================================
 * TASK ROW
 * =====================================================
 */

function TaskRow({
  task,
  onStatusChange,
  onPriorityChange,
}) {
  const mapReady =
    task.type ===
    "PUTAWAY"
      ? Boolean(
          task.destinationNodeId
        )
      : Boolean(
          task.sourceNodeId
        );


  const nodeId =
    task.type ===
    "PUTAWAY"
      ? task.destinationNodeId
      : task.sourceNodeId;


  return (
    <tr>

      {/* TASK */}

      <td>
        <div className="task-id-cell">
          <div
            className={`task-id-icon type-${task.type.toLowerCase()}`}
          >
            {task.type ===
            "PUTAWAY" ? (
              <ArrowDownToLine
                size={16}
              />
            ) : (
              <ArrowUpFromLine
                size={16}
              />
            )}
          </div>

          <div>
            <strong>
              {
                task.id
              }
            </strong>

            <span>
              {
                formatDateTime(
                  task.createdAt
                )
              }
            </span>
          </div>
        </div>
      </td>


      {/* TYPE */}

      <td>
        <span
          className={`task-type type-${task.type.toLowerCase()}`}
        >
          {task.type ===
          "PUTAWAY"
            ? "Putaway"
            : "Picking"}
        </span>
      </td>


      {/* ORDER */}

      <td>
        <div className="task-order-cell">
          <strong>
            {
              task.sourceOrderNo
            }
          </strong>

          <span>
            {
              task.sourceOrderId
            }
          </span>
        </div>
      </td>


      {/* SKU */}

      <td>
        <div className="task-sku-cell">
          <strong>
            {
              task.sku
            }
          </strong>

          <span>
            {
              task.itemName
            }
          </span>
        </div>
      </td>


      {/* QTY */}

      <td>
        <strong className="task-qty">
          {
            task.quantity
          }
        </strong>
      </td>


      {/* ROUTE */}

      <td>
        <div className="task-route">
          <span>
            {
              task.sourceLabel
            }
          </span>

          <strong>
            →
          </strong>

          <span>
            {
              task.destinationLabel
            }
          </span>
        </div>
      </td>


      {/* MAP NODE */}

      <td>
        <div className="task-map-info">
          <div
            className={
              mapReady
                ? "task-map-linked"
                : "task-map-missing"
            }
          >
            <MapPin
              size={12}
            />

            {
              nodeId ||
              "No Node"
            }
          </div>

          <small>
            {mapReady
              ? "Storage node linked"
              : "Location has no map node"}
          </small>
        </div>
      </td>


      {/* PRIORITY */}

      <td>
        <select
          className={`task-priority priority-${task.priority.toLowerCase()}`}
          value={
            task.priority
          }
          disabled={
            task.status ===
            "COMPLETED"
          }
          onChange={(
            event
          ) =>
            onPriorityChange(
              task.id,
              event.target
                .value
            )
          }
        >
          <option value="LOW">
            Low
          </option>

          <option value="NORMAL">
            Normal
          </option>

          <option value="HIGH">
            High
          </option>

          <option value="URGENT">
            Urgent
          </option>
        </select>
      </td>


      {/* STATUS */}

      <td>
        <span
          className={`task-status status-${task.status.toLowerCase()}`}
        >
          {
            formatTaskStatus(
              task.status
            )
          }
        </span>
      </td>


      {/* ACTION */}

      <td>
        <div className="task-actions">
          {task.status ===
            "PENDING" && (
            <button
              type="button"
              className="task-start"
              onClick={() =>
                onStatusChange(
                  task.id,
                  "IN_PROGRESS"
                )
              }
            >
              <Play
                size={14}
              />

              Start
            </button>
          )}


          {task.status ===
            "IN_PROGRESS" && (
            <>
              <button
                type="button"
                className="task-complete"
                onClick={() =>
                  onStatusChange(
                    task.id,
                    "COMPLETED"
                  )
                }
              >
                <CheckCircle2
                  size={14}
                />

                Complete
              </button>


              <button
                type="button"
                className="task-block"
                title="Block task"
                onClick={() =>
                  onStatusChange(
                    task.id,
                    "BLOCKED"
                  )
                }
              >
                <AlertTriangle
                  size={14}
                />
              </button>
            </>
          )}


          {task.status ===
            "BLOCKED" && (
            <button
              type="button"
              className="task-resume"
              onClick={() =>
                onStatusChange(
                  task.id,
                  "IN_PROGRESS"
                )
              }
            >
              <Play
                size={14}
              />

              Resume
            </button>
          )}


          {task.status ===
            "COMPLETED" && (
            <span className="task-done">
              <CheckCircle2
                size={14}
              />

              Done
            </span>
          )}
        </div>
      </td>
    </tr>
  );
}


/*
 * =====================================================
 * FORMAT
 * =====================================================
 */

function formatTaskStatus(
  status
) {
  if (
    status ===
    "IN_PROGRESS"
  ) {
    return "In Progress";
  }


  if (
    status ===
    "BLOCKED"
  ) {
    return "Blocked";
  }


  if (
    status ===
    "COMPLETED"
  ) {
    return "Completed";
  }


  return "Pending";
}


function formatDateTime(
  value
) {
  if (!value) {
    return "-";
  }


  const date =
    new Date(
      value
    );


  return Number.isNaN(
    date.getTime()
  )
    ? "-"
    : date.toLocaleString();
}


function getTime(
  value
) {
  const time =
    new Date(
      value ||
      ""
    ).getTime();


  return Number.isFinite(
    time
  )
    ? time
    : 0;
}