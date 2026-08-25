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
  Send,
  Trash2,
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
  notifyWmsDataChanged,
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


/*
 * =====================================================
 * RCS DISPATCH QUEUE
 * =====================================================
 *
 * Warehouse Task กับ RCS Queue
 * เป็นคนละ record กัน
 *
 * Warehouse Task
 * wms-warehouse-tasks-v1
 *
 * RCS Dispatch Queue
 * wms-robot-tasks-v1
 *
 * Warehouse Task เกิดหลัง Receive / Allocate
 * จึงไม่ควรถูก Delete จากหน้านี้โดยตรง
 */

const RCS_QUEUE_KEY =
  "wms-robot-tasks-v1";


export default function TaskManagement() {

  /*
   * =====================================================
   * WAREHOUSE TASK STATE
   * =====================================================
   */

  const [
    tasks,
    setTasks,
  ] = useState(
    () =>
      syncWarehouseTasks(
        loadTasks()
      )
  );


  /*
   * =====================================================
   * RCS QUEUE STATE
   * =====================================================
   */

  const [
    rcsQueue,
    setRcsQueue,
  ] = useState(
    loadRcsQueue
  );


  /*
   * =====================================================
   * FILTER STATE
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


  /*
   * =====================================================
   * UI STATE
   * =====================================================
   */

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
   * SYNC OPERATION → TASK
   * =====================================================
   */

  function syncFromOperations() {

    /*
     * Refresh Warehouse Tasks
     */

    setTasks(
      (current) =>
        syncWarehouseTasks(
          current
        )
    );


    /*
     * Refresh RCS Queue
     */

    setRcsQueue(
      loadRcsQueue()
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

    /*
     * =====================================================
     * OTHER BROWSER TAB
     * =====================================================
     */

    function handleStorage(
      event
    ) {

      /*
       * Warehouse Task changed
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
       * RCS Queue changed
       */

      if (
        event.key ===
        RCS_QUEUE_KEY
      ) {

        setRcsQueue(
          loadRcsQueue()
        );

        return;
      }


      /*
       * Warehouse Operation changed
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
     * =====================================================
     * SAME BROWSER TAB
     * =====================================================
     */

    function handleWmsDataChanged(
      event
    ) {

      const keys =
        event.detail?.keys ||
        [];


      /*
       * RCS Queue update
       */

      if (
        keys.includes(
          RCS_QUEUE_KEY
        )
      ) {

        setRcsQueue(
          loadRcsQueue()
        );
      }


      /*
       * Inbound / Outbound / Location update
       */

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


    /*
     * =====================================================
     * WINDOW FOCUS
     * =====================================================
     */

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
   * TASK → RCS QUEUE LOOKUP
   * =====================================================
   *
   * ตัวอย่าง
   *
   * TASK-016
   *     ↓
   * RCSQ-003
   *
   * ทำให้แต่ละ Warehouse Task
   * รู้ว่าตัวเองอยู่ใน RCS Queue หรือไม่
   */

  const rcsQueueByTaskId =
    useMemo(
      () =>
        new Map(
          rcsQueue

            /*
             * เอาเฉพาะ Queue
             * ที่มี Warehouse Task ID
             */

            .filter(
              (item) =>
                item.warehouseTaskId
            )


            /*
             * warehouseTaskId
             * →
             * queue record
             */

            .map(
              (item) => [
                item.warehouseTaskId,
                item,
              ]
            )
        ),

      [rcsQueue]
    );


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
   * SEARCH / FILTER / SORT
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

        /*
         * =================================================
         * FILTER
         * =================================================
         */

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
              .filter(
                Boolean
              )
              .join(
                " "
              )
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


        /*
         * =================================================
         * SORT
         * =================================================
         */

        .sort(
          (
            a,
            b
          ) => {

            /*
             * Status ก่อน
             */

            const statusCompare =
              (
                STATUS_ORDER[
                  a.status
                ] ??
                99
              ) -
              (
                STATUS_ORDER[
                  b.status
                ] ??
                99
              );


            if (
              statusCompare !==
              0
            ) {

              return statusCompare;
            }


            /*
             * Priority ต่อ
             */

            const priorityCompare =
              (
                PRIORITY_ORDER[
                  a.priority
                ] ??
                99
              ) -
              (
                PRIORITY_ORDER[
                  b.priority
                ] ??
                99
              );


            if (
              priorityCompare !==
              0
            ) {

              return priorityCompare;
            }


            /*
             * Task ใหม่กว่าอยู่ก่อน
             */

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
   * UPDATE TASK STATUS
   * =====================================================
   */

  function updateTaskStatus(
    taskId,
    nextStatus
  ) {

    const now =
      new Date().toISOString();


    /*
     * =====================================================
     * CHECK RCS QUEUE
     * =====================================================
     *
     * ถ้า Task อยู่ใน RCS Queue
     * จะไม่ให้ Manual Start / Complete / Block
     */

    const queuedItem =
      loadRcsQueue().find(
        (item) =>
          item.warehouseTaskId ===
          taskId
      );


    if (
      queuedItem
    ) {

      window.alert(
        isRcsQueueLocked(
          queuedItem
        )
          ? "This task has already been sent to RCS and is RCS-controlled. Manual status changes are locked."
          : "This task is currently in the RCS Dispatch Queue. Remove it from the RCS Queue before changing the task manually."
      );


      /*
       * Refresh Queue state
       */

      setRcsQueue(
        loadRcsQueue()
      );


      return;
    }


    /*
     * =====================================================
     * BUILD NEXT TASK STATE
     * =====================================================
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
           * =================================================
           * START / RESUME
           * =================================================
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
           * =================================================
           * COMPLETE
           * =================================================
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
           * =================================================
           * BLOCK
           * =================================================
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
           * =================================================
           * BACK TO PENDING
           * =================================================
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


    /*
     * =====================================================
     * TASK ที่เปลี่ยน
     * =====================================================
     */

    const changedTask =
      nextTasks.find(
        (task) =>
          task.id ===
          taskId
      );


    /*
     * =====================================================
     * TASK → INBOUND / OUTBOUND
     * =====================================================
     *
     * ให้ Warehouse Operation
     * sync ตาม Task ด้วย
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
     * =====================================================
     * ERROR
     * =====================================================
     */

    if (
      !result.ok
    ) {

      window.alert(
        result.message ||
        "Could not update Warehouse Operation."
      );


      return;
    }


    /*
     * =====================================================
     * RE-SYNC TASK
     * =====================================================
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
   * UPDATE PRIORITY
   * =====================================================
   */

  function updatePriority(
    taskId,
    priority
  ) {

    /*
     * =====================================================
     * CHECK RCS QUEUE
     * =====================================================
     */

    const queuedItem =
      loadRcsQueue().find(
        (item) =>
          item.warehouseTaskId ===
          taskId
      );


    /*
     * ถ้าเข้า Queue แล้ว
     *
     * Priority ต้องแก้จาก
     * RCS Dispatch Queue
     */

    if (
      queuedItem
    ) {

      window.alert(
        isRcsQueueLocked(
          queuedItem
        )
          ? "Priority is locked because this task has already been sent to RCS."
          : "This task is in the RCS Dispatch Queue. Edit its dispatch priority in RCS Dispatch Queue, or remove it from the queue first."
      );


      setRcsQueue(
        loadRcsQueue()
      );


      return;
    }


    /*
     * =====================================================
     * UPDATE WAREHOUSE TASK PRIORITY
     * =====================================================
     */

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
   * REMOVE UNSENT RCS QUEUE ITEM
   * =====================================================
   *
   * สำคัญ:
   *
   * Function นี้ลบเฉพาะ
   * RCS Dispatch Queue
   *
   * ไม่ลบ Warehouse Task
   *
   * เพราะ Warehouse Task เกิดจาก
   * Receive / Allocate ที่ Confirm ไปแล้ว
   */

  function removeTaskFromRcsQueue(
    task
  ) {

    /*
     * =====================================================
     * LOAD QUEUE ล่าสุด
     * =====================================================
     */

    const latestQueue =
      loadRcsQueue();


    /*
     * =====================================================
     * หา Queue ของ Task
     * =====================================================
     */

    const queuedItem =
      latestQueue.find(
        (item) =>
          item.warehouseTaskId ===
          task.id
      );


    /*
     * ไม่มี Queue แล้ว
     */

    if (
      !queuedItem
    ) {

      setRcsQueue(
        latestQueue
      );


      return;
    }


    /*
     * =====================================================
     * LOCK AFTER SENDING
     * =====================================================
     *
     * SENDING
     * SENT
     *
     * ห้ามลบ local
     */

    if (
      isRcsQueueLocked(
        queuedItem
      )
    ) {

      window.alert(
        "This dispatch has already started sending or was sent to RCS. It cannot be removed locally. A real RCS Cancel Task API will be required for that stage."
      );


      return;
    }


    /*
     * =====================================================
     * CONFIRM REMOVE
     * =====================================================
     */

    const confirmed =
      window.confirm(
        `Remove ${queuedItem.id} for ${task.id} from the RCS Dispatch Queue?\n\nThe Warehouse Task will remain PENDING.`
      );


    if (
      !confirmed
    ) {

      return;
    }


    /*
     * =====================================================
     * REMOVE QUEUE RECORD
     * =====================================================
     */

    const nextQueue =
      latestQueue.filter(
        (item) =>
          item.id !==
          queuedItem.id
      );


    /*
     * =====================================================
     * SAVE LOCAL STORAGE
     * =====================================================
     */

    try {

      localStorage.setItem(
        RCS_QUEUE_KEY,

        JSON.stringify(
          nextQueue
        )
      );

    } catch (
      error
    ) {

      console.error(
        "Could not remove RCS Queue item.",
        error
      );


      window.alert(
        "Could not remove the RCS Queue item."
      );


      return;
    }


    /*
     * =====================================================
     * UPDATE UI
     * =====================================================
     */

    setRcsQueue(
      nextQueue
    );


    /*
     * =====================================================
     * NOTIFY OTHER WMS PAGES
     * =====================================================
     */

    notifyWmsDataChanged([
      RCS_QUEUE_KEY,
    ]);
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
              {
                saveMessage
              }
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
          SYNC INFO
      ================================================= */}

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


      {/* =================================================
          TASK LIFECYCLE RULE
      ================================================= */}

      <div className="task-lifecycle-note">

        <AlertTriangle
          size={16}
        />


        <div>

          <strong>
            Task lifecycle rule
          </strong>


          <span>
            Delete is available only at the source Order DRAFT stage.
            After Receive / Allocate, the Warehouse Task is an execution
            record and is not deleted here. An unsent RCS dispatch can
            still be removed; after SENDING / SENT it becomes
            RCS-controlled.
          </span>

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
          TASK PANEL
      ================================================= */}

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


          {/* =============================================
              FILTER TOOLBAR
          ============================================= */}

          <div className="task-toolbar">

            {/* SEARCH */}

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
                    event.target.value
                  )
                }
              />

            </div>


            {/* TYPE */}

            <select
              value={
                typeFilter
              }
              onChange={(
                event
              ) =>
                setTypeFilter(
                  event.target.value
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


            {/* STATUS */}

            <select
              value={
                statusFilter
              }
              onChange={(
                event
              ) =>
                setStatusFilter(
                  event.target.value
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
                  RCS Dispatch
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

                    rcsQueueItem={
                      rcsQueueByTaskId.get(
                        task.id
                      ) ||
                      null
                    }

                    onRemoveRcsQueue={
                      removeTaskFromRcsQueue
                    }
                  />

                )
              )}

            </tbody>

          </table>


          {/* =================================================
              EMPTY
          ================================================= */}

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
          {
            title
          }
        </span>


        <strong>
          {
            value
          }
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
  rcsQueueItem,
  onRemoveRcsQueue,
}) {

  /*
   * =====================================================
   * MAP STATE
   * =====================================================
   */

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


  /*
   * =====================================================
   * RCS STATE
   * =====================================================
   */

  const hasRcsQueue =
    Boolean(
      rcsQueueItem
    );


  /*
   * SENDING / SENT
   */

  const rcsLocked =
    hasRcsQueue &&
    isRcsQueueLocked(
      rcsQueueItem
    );


  /*
   * ถ้าเข้า Queue แล้ว
   *
   * Manual control จะถูกหยุดก่อน
   * แม้ยังไม่ได้ Send
   */

  const manualControlLocked =
    hasRcsQueue;


  return (
    <tr>

      {/* =================================================
          TASK
      ================================================= */}

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


      {/* =================================================
          TYPE
      ================================================= */}

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


      {/* =================================================
          SOURCE ORDER
      ================================================= */}

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


      {/* =================================================
          SKU
      ================================================= */}

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


      {/* =================================================
          QTY
      ================================================= */}

      <td>

        <strong className="task-qty">
          {
            task.quantity
          }
        </strong>

      </td>


      {/* =================================================
          ROUTE
      ================================================= */}

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


      {/* =================================================
          MAP NODE
      ================================================= */}

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


      {/* =================================================
          PRIORITY
      ================================================= */}

      <td>

        <select
          className={`task-priority priority-${task.priority.toLowerCase()}`}

          value={
            task.priority
          }

          disabled={
            task.status ===
              "COMPLETED" ||
            manualControlLocked
          }

          title={
            manualControlLocked
              ? rcsLocked
                ? "Priority locked after RCS send"
                : "Edit dispatch priority in RCS Dispatch Queue, or remove the queue item first"
              : ""
          }

          onChange={(
            event
          ) =>
            onPriorityChange(
              task.id,
              event.target.value
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


      {/* =================================================
          STATUS
      ================================================= */}

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


      {/* =================================================
          RCS DISPATCH
      ================================================= */}

      <td>

        <div className="task-rcs-dispatch-cell">

          {!rcsQueueItem ? (

            /*
             * =============================================
             * NOT QUEUED
             * =============================================
             */

            <>

              <span className="task-rcs-state not-queued">
                Not Queued
              </span>


              <small>
                Manual task control available
              </small>

            </>

          ) : (

            /*
             * =============================================
             * QUEUED / RCS CONTROLLED
             * =============================================
             */

            <>

              <span
                className={`task-rcs-state ${
                  rcsLocked
                    ? "locked"
                    : "queued"
                }`}
              >

                {
                  formatRcsDispatchState(
                    rcsQueueItem
                  )
                }

              </span>


              <small>

                {
                  rcsQueueItem.id
                }


                {rcsQueueItem.rcsTaskChainCode
                  ? ` · ${rcsQueueItem.rcsTaskChainCode}`
                  : ""}

              </small>

            </>

          )}

        </div>

      </td>


      {/* =================================================
          ACTION
      ================================================= */}

      <td>

        <div className="task-actions">

          {/* ===============================================
              QUEUED BUT NOT SENT
          =============================================== */}

          {rcsQueueItem &&
            !rcsLocked && (

            <button
              type="button"

              className="task-remove-rcs"

              onClick={() =>
                onRemoveRcsQueue(
                  task
                )
              }
            >

              <Trash2
                size={14}
              />


              Remove Queue

            </button>

          )}


          {/* ===============================================
              RCS CONTROLLED
          =============================================== */}

          {rcsQueueItem &&
            rcsLocked && (

            <span className="task-rcs-controlled">

              <Send
                size={14}
              />


              RCS Controlled

            </span>

          )}


          {/* ===============================================
              PENDING
          =============================================== */}

          {!manualControlLocked &&
          task.status ===
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


          {/* ===============================================
              IN PROGRESS
          =============================================== */}

          {!manualControlLocked &&
          task.status ===
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


          {/* ===============================================
              BLOCKED
          =============================================== */}

          {!manualControlLocked &&
          task.status ===
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


          {/* ===============================================
              COMPLETED
          =============================================== */}

          {!manualControlLocked &&
          task.status ===
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
 * LOAD RCS QUEUE
 * =====================================================
 */

function loadRcsQueue() {

  try {

    const saved =
      localStorage.getItem(
        RCS_QUEUE_KEY
      );


    /*
     * ไม่มีข้อมูล
     */

    if (
      !saved
    ) {

      return [];
    }


    /*
     * JSON Parse
     */

    const parsed =
      JSON.parse(
        saved
      );


    /*
     * Queue ต้องเป็น Array
     */

    return Array.isArray(
      parsed
    )
      ? parsed
      : [];

  } catch (
    error
  ) {

    console.warn(
      "Could not load RCS Queue.",
      error
    );


    return [];
  }
}


/*
 * =====================================================
 * CHECK RCS QUEUE LOCK
 * =====================================================
 *
 * NOT_SENT
 * → ยัง Remove ได้
 *
 * SENDING
 * → Lock
 *
 * SENT
 * → Lock
 */

function isRcsQueueLocked(
  item
) {

  return [
    "SENDING",
    "SENT",
  ].includes(
    String(
      item?.sendStatus ||
      "NOT_SENT"
    ).toUpperCase()
  );
}


/*
 * =====================================================
 * FORMAT RCS DISPATCH STATUS
 * =====================================================
 */

function formatRcsDispatchState(
  item
) {

  /*
   * Send Status
   */

  const sendStatus =
    String(
      item?.sendStatus ||
      "NOT_SENT"
    ).toUpperCase();


  /*
   * RCS Status
   */

  const rcsStatus =
    String(
      item?.rcsStatus ||
      "NOT_SENT"
    ).toUpperCase();


  /*
   * =====================================================
   * SENDING
   * =====================================================
   */

  if (
    sendStatus ===
    "SENDING"
  ) {

    return "Sending";
  }


  /*
   * =====================================================
   * SENT
   * =====================================================
   */

  if (
    sendStatus ===
    "SENT"
  ) {

    /*
     * Sent แต่ยังไม่มี RCS Status
     */

    if (
      rcsStatus ===
      "NOT_SENT"
    ) {

      return "Sent";
    }


    /*
     * เช่น:
     *
     * Sent · CREATED
     */

    return `Sent · ${rcsStatus}`;
  }


  /*
   * =====================================================
   * NOT SENT YET
   * =====================================================
   */

  return "Queued";
}


/*
 * =====================================================
 * FORMAT TASK STATUS
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


/*
 * =====================================================
 * FORMAT DATE TIME
 * =====================================================
 */

function formatDateTime(
  value
) {

  if (
    !value
  ) {

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


/*
 * =====================================================
 * GET TIME
 * =====================================================
 */

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