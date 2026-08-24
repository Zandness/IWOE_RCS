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

import "../styles/TaskManagement.css";


const TASK_STORAGE_KEY =
  "wms-warehouse-tasks-v1";

const INBOUND_STORAGE_KEY =
  "wms-inbound-orders-v1";

const OUTBOUND_STORAGE_KEY =
  "wms-outbound-orders-v1";

const LOCATION_STORAGE_KEY =
  "wms-storage-locations-v1";


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

  /*
   * =====================================================
   * TASK STATE
   * =====================================================
   */

  const [
    tasks,
    setTasks,
  ] = useState(() => {

    const existing =
      loadTasks();

    return syncWarehouseTasks({
      existingTasks:
        existing,

      inboundOrders:
        loadInboundOrders(),

      outboundOrders:
        loadOutboundOrders(),

      locations:
        loadLocations(),
    });

  });


  /*
   * =====================================================
   * UI STATE
   * =====================================================
   */

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
  ] = useState(
    ""
  );


  const [
    lastSync,
    setLastSync,
  ] = useState(
    new Date().toISOString()
  );


  /*
   * =====================================================
   * SAVE TASKS
   * =====================================================
   */

  useEffect(() => {

    try {

      localStorage.setItem(
        TASK_STORAGE_KEY,

        JSON.stringify(
          tasks
        )
      );


      setSaveMessage(
        "Saved locally"
      );

    } catch (error) {

      console.error(
        "Could not save warehouse tasks.",
        error
      );


      setSaveMessage(
        "Local save failed"
      );

    }

  }, [tasks]);


  /*
   * =====================================================
   * SYNC
   * =====================================================
   */

  function syncFromOperations() {

    setTasks(
      (current) =>
        syncWarehouseTasks({
          existingTasks:
            current,

          inboundOrders:
            loadInboundOrders(),

          outboundOrders:
            loadOutboundOrders(),

          locations:
            loadLocations(),
        })
    );


    setLastSync(
      new Date().toISOString()
    );

  }


  /*
   * =====================================================
   * STORAGE / FOCUS EVENTS
   * =====================================================
   */

  useEffect(() => {

    function handleStorage(
      event
    ) {

      /*
       * TASK CHANGED
       * FROM ANOTHER TAB
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
       * SOURCE DATA
       * CHANGED
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


    function handleFocus() {

      syncFromOperations();

    }


    window.addEventListener(
      "storage",
      handleStorage
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
    useMemo(() => {

      return {

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

      };

    }, [tasks]);


  /*
   * =====================================================
   * FILTER
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


            const matchesSearch =
              !query ||
              searchable.includes(
                query
              );


            return (
              matchesType &&
              matchesStatus &&
              matchesSearch
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
              new Date(
                b.createdAt
              ).getTime() -
              new Date(
                a.createdAt
              ).getTime()
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
   * STATUS CHANGE
   * =====================================================
   */

  function updateTaskStatus(
    taskId,
    nextStatus
  ) {

    const now =
      new Date().toISOString();


    setTasks(
      (current) =>
        current.map(
          (task) => {

            if (
              task.id !==
              taskId
            ) {
              return task;
            }


            /*
             * START
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

              blockedAt:
                "",
            };

          }
        )
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


  /*
   * =====================================================
   * UI
   * =====================================================
   */

  return (
    <div className="task-management-page">

      {/* =================================================
          HEADER
      ================================================= */}

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


      {/* =================================================
          SYNC INFORMATION
      ================================================= */}

      <div className="task-sync-info">

        <span>
          Tasks are automatically
          generated from:
        </span>


        <strong>
          Inbound Receiving
        </strong>

        <span>
          and
        </span>

        <strong>
          Outbound Allocation
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


      {/* =================================================
          SUMMARY
      ================================================= */}

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


      {/* =================================================
          PANEL
      ================================================= */}

      <section className="task-panel">

        <div className="task-panel-header">

          <div>

            <h3>
              Warehouse Task Queue
            </h3>


            <p>
              Operational tasks that
              can later be converted
              into robot tasks for the
              external RCS.
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


        {/* =================================================
            TABLE
        ================================================= */}

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
 * SUMMARY CARD
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
    hasStorageMapNode(
      task
    );


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
              {formatDateTime(
                task.createdAt
              )}
            </span>

          </div>

        </div>

      </td>


      {/* TYPE */}

      <td>

        <span
          className={`task-type type-${task.type.toLowerCase()}`}
        >

          {
            formatTaskType(
              task.type
            )
          }

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


            {task.type ===
            "PUTAWAY"
              ? (
                  task.destinationNodeId ||
                  "No Node"
                )
              : (
                  task.sourceNodeId ||
                  "No Node"
                )}

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


      {/* ACTIONS */}

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
 * SYNC WAREHOUSE TASKS
 * =====================================================
 */

function syncWarehouseTasks({
  existingTasks,
  inboundOrders,
  outboundOrders,
  locations,
}) {

  const now =
    new Date().toISOString();


  const normalizedExisting =
    (
      existingTasks ||
      []
    ).map(
      normalizeTask
    );


  const taskBySourceKey =
    new Map(
      normalizedExisting
        .filter(
          (task) =>
            task.sourceKey
        )
        .map(
          (task) => [
            task.sourceKey,
            task,
          ]
        )
    );


  const locationMap =
    new Map(
      (
        locations ||
        []
      ).map(
        (location) => [
          location.id,
          location,
        ]
      )
    );


  let nextTaskNumber =
    getHighestTaskNumber(
      normalizedExisting
    ) + 1;


  /*
   * =====================================================
   * UPSERT
   * =====================================================
   */

  function upsertTask(
    incomingTask,
    suggestedStatus
  ) {

    const existing =
      taskBySourceKey.get(
        incomingTask.sourceKey
      );


    /*
     * EXISTING
     */

    if (existing) {

      const mergedStatus =
        mergeTaskStatus(
          existing.status,
          suggestedStatus
        );


      const updated = {
        ...existing,

        ...incomingTask,

        id:
          existing.id,

        priority:
          existing.priority ||
          "NORMAL",

        status:
          mergedStatus,

        createdAt:
          existing.createdAt ||
          incomingTask.createdAt ||
          now,

        startedAt:
          existing.startedAt ||
          (
            mergedStatus ===
            "IN_PROGRESS"
              ? now
              : ""
          ),

        completedAt:
          mergedStatus ===
          "COMPLETED"
            ? (
                existing.completedAt ||
                incomingTask.completedAt ||
                now
              )
            : existing.completedAt,

        blockedAt:
          existing.blockedAt ||
          "",
      };


      taskBySourceKey.set(
        incomingTask.sourceKey,
        updated
      );


      return;
    }


    /*
     * NEW TASK
     */

    const newTask = {

      id:
        `TASK-${String(
          nextTaskNumber
        ).padStart(
          3,
          "0"
        )}`,

      priority:
        "NORMAL",

      status:
        suggestedStatus,

      createdAt:
        incomingTask.createdAt ||
        now,

      startedAt:
        suggestedStatus ===
        "IN_PROGRESS"
          ? now
          : "",

      completedAt:
        suggestedStatus ===
        "COMPLETED"
          ? (
              incomingTask.completedAt ||
              now
            )
          : "",

      blockedAt:
        "",

      ...incomingTask,
    };


    nextTaskNumber +=
      1;


    taskBySourceKey.set(
      incomingTask.sourceKey,
      newTask
    );

  }


  /*
   * =====================================================
   * INBOUND → PUTAWAY
   * =====================================================
   */

  (
    inboundOrders ||
    []
  ).forEach(
    (order) => {

      if (
        ![
          "RECEIVED",
          "COMPLETED",
        ].includes(
          order.status
        )
      ) {
        return;
      }


      (
        order.lines ||
        []
      ).forEach(
        (line) => {

          const quantity =
            Number(
              line.receivedQty ||
                0
            );


          if (
            quantity <= 0 ||
            !line.locationId
          ) {
            return;
          }


          const location =
            locationMap.get(
              line.locationId
            );


          const suggestedStatus =
            order.status ===
            "COMPLETED"
              ? "COMPLETED"
              : "PENDING";


          const sourceKey =
            `INBOUND:${order.id}:${line.lineId}`;


          upsertTask(
            {

              sourceKey,

              type:
                "PUTAWAY",

              sourceOrderType:
                "INBOUND",

              sourceOrderId:
                order.id,

              sourceOrderNo:
                order.receiptNo ||
                order.id,

              sourceOrderStatus:
                order.status,

              sourceLineId:
                line.lineId,

              sku:
                line.sku,

              itemName:
                line.itemName,

              quantity,

              sourceLocationId:
                "",

              destinationLocationId:
                line.locationId,

              sourceLabel:
                "RECEIVING",

              destinationLabel:
                location?.code ||
                line.locationId,

              mapId:
                location?.mapId ||
                "",

              sourceNodeId:
                "",

              destinationNodeId:
                location?.mapNodeId ||
                "",

              createdAt:
                order.receivedAt ||
                order.createdAt ||
                now,

              completedAt:
                order.status ===
                "COMPLETED"
                  ? (
                      order.completedAt ||
                      now
                    )
                  : "",

            },

            suggestedStatus
          );

        }
      );

    }
  );


  /*
   * =====================================================
   * OUTBOUND → PICKING
   * =====================================================
   */

  (
    outboundOrders ||
    []
  ).forEach(
    (order) => {

      if (
        ![
          "ALLOCATED",
          "PICKING",
          "PICKED",
          "READY",
          "COMPLETED",
        ].includes(
          order.status
        )
      ) {
        return;
      }


      let suggestedStatus =
        "PENDING";


      if (
        order.status ===
        "PICKING"
      ) {

        suggestedStatus =
          "IN_PROGRESS";

      }


      if (
        [
          "PICKED",
          "READY",
          "COMPLETED",
        ].includes(
          order.status
        )
      ) {

        suggestedStatus =
          "COMPLETED";

      }


      (
        order.lines ||
        []
      ).forEach(
        (line) => {

          (
            line.allocations ||
            []
          ).forEach(
            (
              allocation,
              allocationIndex
            ) => {

              const quantity =
                Number(
                  allocation.qty ||
                    0
                );


              if (
                quantity <= 0 ||
                !allocation.locationId
              ) {
                return;
              }


              const location =
                locationMap.get(
                  allocation.locationId
                );


              const allocationKey =
                allocation.inventoryId ||
                `${
                  allocation.locationId
                }-${allocationIndex}`;


              const sourceKey =
                `OUTBOUND:${order.id}:${line.lineId}:${allocationKey}`;


              upsertTask(
                {

                  sourceKey,

                  type:
                    "PICKING",

                  sourceOrderType:
                    "OUTBOUND",

                  sourceOrderId:
                    order.id,

                  sourceOrderNo:
                    order.orderNo ||
                    order.id,

                  sourceOrderStatus:
                    order.status,

                  sourceLineId:
                    line.lineId,

                  inventoryId:
                    allocation.inventoryId ||
                    "",

                  sku:
                    line.sku,

                  itemName:
                    line.itemName,

                  quantity,

                  sourceLocationId:
                    allocation.locationId,

                  destinationLocationId:
                    "",

                  sourceLabel:
                    location?.code ||
                    allocation.locationId,

                  destinationLabel:
                    "SHIPPING",

                  mapId:
                    location?.mapId ||
                    "",

                  sourceNodeId:
                    location?.mapNodeId ||
                    "",

                  destinationNodeId:
                    "",

                  createdAt:
                    order.allocatedAt ||
                    order.createdAt ||
                    now,

                  completedAt:
                    suggestedStatus ===
                    "COMPLETED"
                      ? (
                          order.pickedAt ||
                          order.readyAt ||
                          order.completedAt ||
                          now
                        )
                      : "",

                },

                suggestedStatus
              );

            }
          );

        }
      );

    }
  );


  return Array.from(
    taskBySourceKey.values()
  ).map(
    normalizeTask
  );

}


/*
 * =====================================================
 * MERGE STATUS
 * =====================================================
 */

function mergeTaskStatus(
  currentStatus,
  suggestedStatus
) {

  /*
   * SOURCE OPERATION
   * IS ALREADY COMPLETE
   */

  if (
    suggestedStatus ===
    "COMPLETED"
  ) {
    return "COMPLETED";
  }


  /*
   * MANUALLY COMPLETED
   */

  if (
    currentStatus ===
    "COMPLETED"
  ) {
    return "COMPLETED";
  }


  /*
   * BLOCKED TASK
   * STAYS BLOCKED
   */

  if (
    currentStatus ===
    "BLOCKED"
  ) {
    return "BLOCKED";
  }


  /*
   * OUTBOUND PICKING
   * STARTED
   */

  if (
    suggestedStatus ===
      "IN_PROGRESS" &&
    currentStatus ===
      "PENDING"
  ) {
    return "IN_PROGRESS";
  }


  return (
    currentStatus ||
    suggestedStatus ||
    "PENDING"
  );

}


/*
 * =====================================================
 * NORMALIZE TASK
 * =====================================================
 */

function normalizeTask(
  task
) {

  return {

    id:
      String(
        task.id ||
          ""
      ),

    sourceKey:
      String(
        task.sourceKey ||
          ""
      ),

    type:
      String(
        task.type ||
          "PUTAWAY"
      ).toUpperCase(),

    sourceOrderType:
      String(
        task.sourceOrderType ||
          ""
      ).toUpperCase(),

    sourceOrderId:
      String(
        task.sourceOrderId ||
          ""
      ),

    sourceOrderNo:
      String(
        task.sourceOrderNo ||
          ""
      ),

    sourceOrderStatus:
      String(
        task.sourceOrderStatus ||
          ""
      ),

    sourceLineId:
      String(
        task.sourceLineId ||
          ""
      ),

    inventoryId:
      String(
        task.inventoryId ||
          ""
      ),

    sku:
      String(
        task.sku ||
          ""
      ),

    itemName:
      String(
        task.itemName ||
          ""
      ),

    quantity:
      Math.max(
        Number(
          task.quantity ||
            0
        ),
        0
      ),

    sourceLocationId:
      String(
        task.sourceLocationId ||
          ""
      ),

    destinationLocationId:
      String(
        task.destinationLocationId ||
          ""
      ),

    sourceLabel:
      String(
        task.sourceLabel ||
          "-"
      ),

    destinationLabel:
      String(
        task.destinationLabel ||
          "-"
      ),

    mapId:
      String(
        task.mapId ||
          ""
      ),

    sourceNodeId:
      String(
        task.sourceNodeId ||
          ""
      ),

    destinationNodeId:
      String(
        task.destinationNodeId ||
          ""
      ),

    priority:
      [
        "LOW",
        "NORMAL",
        "HIGH",
        "URGENT",
      ].includes(
        task.priority
      )
        ? task.priority
        : "NORMAL",

    status:
      [
        "PENDING",
        "IN_PROGRESS",
        "BLOCKED",
        "COMPLETED",
      ].includes(
        task.status
      )
        ? task.status
        : "PENDING",

    createdAt:
      task.createdAt ||
      new Date().toISOString(),

    startedAt:
      task.startedAt ||
      "",

    completedAt:
      task.completedAt ||
      "",

    blockedAt:
      task.blockedAt ||
      "",

  };

}


/*
 * =====================================================
 * HIGHEST TASK ID
 * =====================================================
 */

function getHighestTaskNumber(
  tasks
) {

  let highest = 0;


  tasks.forEach(
    (task) => {

      const match =
        /^TASK-(\d+)$/i.exec(
          String(
            task.id ||
              ""
          )
        );


      if (match) {

        highest =
          Math.max(
            highest,

            Number(
              match[1]
            )
          );

      }

    }
  );


  return highest;
}


/*
 * =====================================================
 * MAP LINK
 * =====================================================
 */

function hasStorageMapNode(
  task
) {

  if (
    task.type ===
    "PUTAWAY"
  ) {

    return Boolean(
      task.destinationNodeId
    );

  }


  return Boolean(
    task.sourceNodeId
  );

}


/*
 * =====================================================
 * FORMAT
 * =====================================================
 */

function formatTaskType(
  type
) {

  if (
    type ===
    "PUTAWAY"
  ) {
    return "Putaway";
  }


  if (
    type ===
    "PICKING"
  ) {
    return "Picking";
  }


  return type;
}


function formatTaskStatus(
  status
) {

  switch (
    status
  ) {

    case "IN_PROGRESS":
      return "In Progress";


    case "BLOCKED":
      return "Blocked";


    case "COMPLETED":
      return "Completed";


    default:
      return "Pending";

  }

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


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "-";
  }


  return date.toLocaleString();
}


/*
 * =====================================================
 * LOAD TASKS
 * =====================================================
 */

function loadTasks() {

  try {

    const saved =
      localStorage.getItem(
        TASK_STORAGE_KEY
      );


    if (saved) {

      const parsed =
        JSON.parse(
          saved
        );


      if (
        Array.isArray(
          parsed
        )
      ) {

        return parsed.map(
          normalizeTask
        );

      }

    }

  } catch (error) {

    console.warn(
      "Could not load warehouse tasks.",
      error
    );

  }


  return [];
}


/*
 * =====================================================
 * LOAD INBOUND
 * =====================================================
 */

function loadInboundOrders() {

  try {

    const saved =
      localStorage.getItem(
        INBOUND_STORAGE_KEY
      );


    if (saved) {

      const parsed =
        JSON.parse(
          saved
        );


      if (
        Array.isArray(
          parsed
        )
      ) {
        return parsed;
      }

    }

  } catch (error) {

    console.warn(
      "Could not load inbound orders.",
      error
    );

  }


  return [];
}


/*
 * =====================================================
 * LOAD OUTBOUND
 * =====================================================
 */

function loadOutboundOrders() {

  try {

    const saved =
      localStorage.getItem(
        OUTBOUND_STORAGE_KEY
      );


    if (saved) {

      const parsed =
        JSON.parse(
          saved
        );


      if (
        Array.isArray(
          parsed
        )
      ) {
        return parsed;
      }

    }

  } catch (error) {

    console.warn(
      "Could not load outbound orders.",
      error
    );

  }


  return [];
}


/*
 * =====================================================
 * LOAD LOCATIONS
 * =====================================================
 */

function loadLocations() {

  try {

    const saved =
      localStorage.getItem(
        LOCATION_STORAGE_KEY
      );


    if (saved) {

      const parsed =
        JSON.parse(
          saved
        );


      if (
        Array.isArray(
          parsed
        )
      ) {
        return parsed;
      }

    }

  } catch (error) {

    console.warn(
      "Could not load Storage Locations.",
      error
    );

  }


  return [];
}