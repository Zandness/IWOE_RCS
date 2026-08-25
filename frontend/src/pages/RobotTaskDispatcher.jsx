import {
  AlertTriangle,
  CheckCircle2,
  Clipboard,
  Copy,
  ExternalLink,
  MapPin,
  RefreshCw,
  Route,
  Send,
  Trash2,
} from "lucide-react";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import "../styles/RobotTaskDispatcher.css";


const WAREHOUSE_TASK_KEY =
  "wms-warehouse-tasks-v1";

const LOCATION_STORAGE_KEY =
  "wms-storage-locations-v1";


/*
 * ยังใช้ key เดิมจาก V6
 *
 * เพื่อไม่ให้ข้อมูลเก่าที่เคยสร้างไว้หาย
 */
const RCS_QUEUE_KEY =
  "wms-robot-tasks-v1";


const PRIORITY_ORDER = {
  URGENT: 0,
  HIGH: 1,
  NORMAL: 2,
  LOW: 3,
};


/*
 * WMS Priority
 * ↓
 * HIK RCS Priority
 *
 * HIK รองรับช่วง 1 - 120
 */
const RCS_PRIORITY = {
  LOW: 30,
  NORMAL: 60,
  HIGH: 90,
  URGENT: 120,
};


export default function RobotTaskDispatcher() {
  const [
    warehouseTasks,
    setWarehouseTasks,
  ] = useState(
    loadWarehouseTasks
  );


  const [
    locations,
    setLocations,
  ] = useState(
    loadLocations
  );


  const [
    dispatchQueue,
    setDispatchQueue,
  ] = useState(
    loadDispatchQueue
  );


  /*
   * เก็บเวลาที่ user กำลังเลือก
   * ก่อน Add Queue
   */

  const [
    scheduleDrafts,
    setScheduleDrafts,
  ] = useState({});


  /*
   * เลขท้าย gateway
   *
   * 192.168.50.xxx
   */

  const [
    gatewayLastOctet,
    setGatewayLastOctet,
  ] = useState("");


  const [
    copyMessage,
    setCopyMessage,
  ] = useState("");


  /*
   * เวลา realtime
   *
   * ใช้ตรวจว่า Scheduled Task
   * ถึงเวลาหรือยัง
   */

  const [
    now,
    setNow,
  ] = useState(
    () => Date.now()
  );


  /* =====================================================
     LIVE CLOCK
  ===================================================== */

  useEffect(() => {
    const timer =
      window.setInterval(
        () =>
          setNow(
            Date.now()
          ),
        1000
      );


    return () =>
      window.clearInterval(
        timer
      );
  }, []);


  /* =====================================================
     SAVE RCS QUEUE
  ===================================================== */

  useEffect(() => {
    try {
      localStorage.setItem(
        RCS_QUEUE_KEY,

        JSON.stringify(
          dispatchQueue
        )
      );


      window.dispatchEvent(
        new CustomEvent(
          "wms-data-changed",
          {
            detail: {
              keys: [
                RCS_QUEUE_KEY,
              ],
            },
          }
        )
      );
    } catch (error) {
      console.error(
        "Could not save RCS dispatch queue.",
        error
      );
    }
  }, [dispatchQueue]);


  /* =====================================================
     REFRESH
  ===================================================== */

  function refreshData() {
    setWarehouseTasks(
      loadWarehouseTasks()
    );


    setLocations(
      loadLocations()
    );


    setDispatchQueue(
      loadDispatchQueue()
    );
  }


  useEffect(() => {
    function handleStorage(
      event
    ) {
      if (
        [
          WAREHOUSE_TASK_KEY,
          LOCATION_STORAGE_KEY,
          RCS_QUEUE_KEY,
        ].includes(
          event.key
        )
      ) {
        refreshData();
      }
    }


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
              WAREHOUSE_TASK_KEY,
              LOCATION_STORAGE_KEY,
            ].includes(
              key
            )
        )
      ) {
        setWarehouseTasks(
          loadWarehouseTasks()
        );


        setLocations(
          loadLocations()
        );
      }
    }


    window.addEventListener(
      "focus",
      refreshData
    );


    window.addEventListener(
      "storage",
      handleStorage
    );


    window.addEventListener(
      "wms-data-changed",
      handleWmsDataChanged
    );


    return () => {
      window.removeEventListener(
        "focus",
        refreshData
      );


      window.removeEventListener(
        "storage",
        handleStorage
      );


      window.removeEventListener(
        "wms-data-changed",
        handleWmsDataChanged
      );
    };
  }, []);


  /* =====================================================
     LOCATION LOOKUP
  ===================================================== */

  const locationMap =
    useMemo(
      () =>
        new Map(
          locations.map(
            (location) => [
              location.id,
              location,
            ]
          )
        ),

      [locations]
    );


  /*
   * Receiving
   *
   * ใช้เป็นต้นทางของ Putaway
   */

  const receivingLocation =
    useMemo(
      () =>
        findOperationalLocation(
          locations,
          "RECEIVING"
        ),

      [locations]
    );


  /*
   * Shipping
   *
   * ใช้เป็นปลายทางของ Picking
   */

  const shippingLocation =
    useMemo(
      () =>
        findOperationalLocation(
          locations,
          "SHIPPING"
        ),

      [locations]
    );


  /* =====================================================
     WAREHOUSE TASK CANDIDATES
  ===================================================== */

  const candidates =
    useMemo(() => {
      return warehouseTasks

        /*
         * เอาเฉพาะ Task
         * ที่ยังรอทำ
         */

        .filter(
          (task) =>
            task.status ===
            "PENDING"
        )


        /*
         * หา Source / Destination
         */

        .map(
          (task) => {
            const endpoints =
              resolveTaskEndpoints({
                task,
                locationMap,
                receivingLocation,
                shippingLocation,
              });


            /*
             * Task นี้อยู่ใน Queue แล้วหรือยัง
             */

            const existingQueueItem =
              dispatchQueue.find(
                (item) =>
                  item.warehouseTaskId ===
                  task.id
              );


            /*
             * ตรวจ mapping
             */

            const readiness =
              getEndpointReadiness(
                endpoints
              );


            return {
              task,

              endpoints,

              existingQueueItem,

              ready:
                readiness.ok &&
                !existingQueueItem,

              reason:
                existingQueueItem
                  ? "Already in RCS queue"
                  : readiness.message,
            };
          }
        )


        /*
         * Warehouse Task list
         * เรียง priority ก่อน
         */

        .sort(
          compareWarehouseCandidates
        );
    }, [
      warehouseTasks,
      dispatchQueue,
      locationMap,
      receivingLocation,
      shippingLocation,
    ]);


  /* =====================================================
     QUEUE ROWS
  ===================================================== */

  const queueRows =
    useMemo(() => {
      const enriched =
        dispatchQueue.map(
          (item) => {
            /*
             * Refresh RCS Point
             * จาก Storage Location ล่าสุด
             *
             * เช่น user ไปแก้ Point หลังจาก Add Queue
             */

            const endpoints =
              enrichQueuedEndpoints(
                item,
                locationMap
              );


            /*
             * ตรวจ Queue state
             */

            const state =
              getQueueState({
                item,
                endpoints,
                now,
              });


            return {
              ...item,

              ...endpoints,

              queueState:
                state,

              /*
               * สร้าง preview
               * สำหรับ command ที่จะส่งในอนาคต
               */

              commandDraft:
                buildCommandDraft({
                  ...item,
                  ...endpoints,
                }),
            };
          }
        );


      return enriched.sort(
        compareQueueRows
      );
    }, [
      dispatchQueue,
      locationMap,
      now,
    ]);


  /*
   * READY only
   */

  const readyQueue =
    useMemo(
      () =>
        queueRows.filter(
          (item) =>
            item.queueState ===
            "READY"
        ),

      [queueRows]
    );


  /*
   * Ranking
   *
   * READY #1
   * READY #2
   * ...
   */

  const readyRankMap =
    useMemo(
      () =>
        new Map(
          readyQueue.map(
            (
              item,
              index
            ) => [
              item.id,
              index + 1,
            ]
          )
        ),

      [readyQueue]
    );


  /* =====================================================
     SUMMARY
  ===================================================== */

  const summary =
    useMemo(
      () => ({
        pendingWarehouse:
          candidates.length,

        readyWarehouse:
          candidates.filter(
            (item) =>
              item.ready
          ).length,

        waitingTime:
          queueRows.filter(
            (item) =>
              item.queueState ===
              "WAITING_TIME"
          ).length,

        readyToSend:
          readyQueue.length,

        mappingRequired:
          queueRows.filter(
            (item) =>
              item.queueState ===
              "MAPPING_REQUIRED"
          ).length,
      }),

      [
        candidates,
        queueRows,
        readyQueue,
      ]
    );


  /* =====================================================
     ADD TO QUEUE
  ===================================================== */

  function queueWarehouseTask(
    candidate
  ) {
    if (
      !candidate.ready
    ) {
      return;
    }


    /*
     * อ่านเวลาที่เลือก
     */

    const scheduleValue =
      scheduleDrafts[
        candidate.task.id
      ] || "";


    /*
     * ถ้าไม่ได้เลือกเวลา
     *
     * = พร้อมทันที
     */

    const scheduledSendAt =
      parseScheduleInput(
        scheduleValue
      );


    setDispatchQueue(
      (current) => {
        /*
         * กัน duplicate
         */

        const exists =
          current.some(
            (item) =>
              item.warehouseTaskId ===
              candidate.task.id
          );


        if (exists) {
          return current;
        }


        const record =
          createDispatchRecord({
            warehouseTask:
              candidate.task,

            endpoints:
              candidate.endpoints,

            scheduledSendAt,

            id:
              getNextQueueId(
                current
              ),
          });


        return [
          ...current,
          record,
        ];
      }
    );


    /*
     * clear schedule field
     */

    setScheduleDrafts(
      (current) => {
        const next = {
          ...current,
        };


        delete next[
          candidate.task.id
        ];


        return next;
      }
    );
  }


  /* =====================================================
     REMOVE QUEUE ITEM
  ===================================================== */

  function removeQueueItem(
    item
  ) {
    /*
     * ในอนาคตถ้าส่งแล้ว
     * จะไม่ให้ลบง่าย ๆ
     */

    if (
      item.sendStatus ===
      "SENT"
    ) {
      window.alert(
        "A sent task cannot be removed from this preparation queue."
      );


      return;
    }


    const confirmed =
      window.confirm(
        `Remove ${item.id} from the RCS dispatch queue?`
      );


    if (
      !confirmed
    ) {
      return;
    }


    setDispatchQueue(
      (current) =>
        current.filter(
          (entry) =>
            entry.id !==
            item.id
        )
    );
  }


  /* =====================================================
     RCS NETWORK ROUTE
  ===================================================== */

  const gatewayValidation =
    validateGatewayOctet(
      gatewayLastOctet
    );


  const routeCommand =
    gatewayValidation.ok
      ? `route -p add 192.168.100.0 mask 255.255.255.0 192.168.50.${gatewayValidation.value}`
      : "";


  async function handleCopyRoute() {
    if (
      !routeCommand
    ) {
      return;
    }


    const copied =
      await copyText(
        routeCommand
      );


    setCopyMessage(
      copied
        ? "Route command copied"
        : "Could not copy command"
    );


    window.setTimeout(
      () =>
        setCopyMessage(
          ""
        ),
      2000
    );
  }


  /* =====================================================
     UI
  ===================================================== */

  return (
    <div className="dispatcher-page">

      {/* HEADER */}

      <div className="dispatcher-header">

        <div>

          <span className="dispatcher-label">
            WMS → HIK RCS PREPARATION
          </span>


          <h2>
            RCS Dispatch Queue
          </h2>


          <p>
            Prepare Warehouse Tasks for HIK RCS,
            schedule when they become eligible,
            and order due tasks by priority.
          </p>

        </div>


        <button
          type="button"
          className="dispatcher-refresh-button"
          onClick={
            refreshData
          }
        >
          <RefreshCw
            size={16}
          />

          Refresh
        </button>

      </div>


      {/* SUMMARY */}

      <div className="dispatcher-summary-grid">

        <SummaryCard
          title="Pending Warehouse"
          value={
            summary.pendingWarehouse
          }
          icon={
            <Clipboard
              size={20}
            />
          }
        />


        <SummaryCard
          title="Can Queue"
          value={
            summary.readyWarehouse
          }
          icon={
            <CheckCircle2
              size={20}
            />
          }
          tone="success"
        />


        <SummaryCard
          title="Waiting Time"
          value={
            summary.waitingTime
          }
          icon={
            <Send
              size={20}
            />
          }
          tone="warning"
        />


        <SummaryCard
          title="Ready to Send"
          value={
            summary.readyToSend
          }
          icon={
            <Send
              size={20}
            />
          }
          tone="cyan"
        />


        <SummaryCard
          title="Mapping Required"
          value={
            summary.mappingRequired
          }
          icon={
            <AlertTriangle
              size={20}
            />
          }
          tone="danger"
        />

      </div>


      {/* =================================================
          NETWORK
      ================================================= */}

      <section className="dispatcher-panel">

        <div className="dispatcher-panel-header">

          <div>

            <span className="dispatcher-section-label">
              NETWORK PREPARATION
            </span>


            <h3>
              HIK RCS Access
            </h3>


            <p>
              The browser only prepares the Windows route
              command. Run it manually in Administrator CMD.
            </p>

          </div>

        </div>


        <div className="rcs-prep-grid">

          {/* GATEWAY */}

          <div className="rcs-gateway-card">

            <label>

              <span>
                Gateway
              </span>


              <div className="gateway-input-row">

                <strong>
                  192.168.50.
                </strong>


                <input
                  type="number"
                  min="1"
                  max="254"
                  placeholder="120"
                  value={
                    gatewayLastOctet
                  }
                  onChange={(
                    event
                  ) =>
                    setGatewayLastOctet(
                      event.target
                        .value
                    )
                  }
                />

              </div>

            </label>


            <div className="gateway-warning">

              <AlertTriangle
                size={15}
              />


              <span>
                Enter the current last IP number again
                before each RCS session.
              </span>

            </div>

          </div>


          {/* CMD */}

          <div className="rcs-command-card">

            <span>
              Administrator CMD
            </span>


            <code>
              {routeCommand ||
                "Enter gateway last number first"}
            </code>


            <button
              type="button"
              disabled={
                !routeCommand
              }
              onClick={
                handleCopyRoute
              }
            >
              <Copy
                size={15}
              />

              Copy Route Command
            </button>


            {copyMessage && (
              <small>
                {
                  copyMessage
                }
              </small>
            )}

          </div>


          {/* LINKS */}

          <div className="rcs-links-card">

            <span>
              RCS Access
            </span>


            <button
              type="button"
              onClick={() =>
                window.open(
                  "http://192.168.100.100:12826/web/",
                  "_blank",
                  "noopener,noreferrer"
                )
              }
            >
              <ExternalLink
                size={15}
              />

              Open HIK Web
            </button>


            <button
              type="button"
              onClick={() =>
                window.open(
                  "https://192.168.100.101/portal/subSystem/rcs/home",
                  "_blank",
                  "noopener,noreferrer"
                )
              }
            >
              <ExternalLink
                size={15}
              />

              Open RCS Home
            </button>

          </div>

        </div>

      </section>


      {/* =================================================
          WAREHOUSE TASKS
      ================================================= */}

      <section className="dispatcher-panel">

        <div className="dispatcher-panel-header">

          <div>

            <span className="dispatcher-section-label">
              WAREHOUSE TASKS
            </span>


            <h3>
              Add Task to RCS Queue
            </h3>


            <p>
              A task can be queued only when both source
              and destination locations have HIK RCS mapping.
              Leave Send Time empty to make it eligible now.
            </p>

          </div>

        </div>


        <div className="dispatcher-table-wrapper">

          <table className="dispatcher-table">

            <thead>

              <tr>

                <th>
                  Task
                </th>

                <th>
                  WMS Route
                </th>

                <th>
                  HIK RCS Route
                </th>

                <th>
                  Priority
                </th>

                <th>
                  Send Time
                </th>

                <th>
                  Readiness
                </th>

                <th></th>

              </tr>

            </thead>


            <tbody>

              {candidates.map(
                (
                  candidate
                ) => (
                  <tr
                    key={
                      candidate.task.id
                    }
                  >

                    <td>

                      <strong>
                        {
                          candidate.task.id
                        }
                      </strong>


                      <small>
                        {
                          candidate.task.type
                        }

                        {" · "}

                        {
                          candidate.task
                            .sourceOrderNo ||
                          "-"
                        }
                      </small>

                    </td>


                    {/* WMS ROUTE */}

                    <td>

                      <RouteCell
                        sourceLabel={
                          candidate.endpoints
                            .sourceLabel
                        }
                        destinationLabel={
                          candidate.endpoints
                            .destinationLabel
                        }
                        sourceCode={
                          candidate.endpoints
                            .sourceNodeId
                        }
                        destinationCode={
                          candidate.endpoints
                            .destinationNodeId
                        }
                        emptyText="WMS node missing"
                      />

                    </td>


                    {/* RCS ROUTE */}

                    <td>

                      <RouteCell
                        sourceLabel={
                          candidate.endpoints
                            .sourceRcsTargetType
                        }
                        destinationLabel={
                          candidate.endpoints
                            .destinationRcsTargetType
                        }
                        sourceCode={
                          candidate.endpoints
                            .sourceRcsPointCode
                        }
                        destinationCode={
                          candidate.endpoints
                            .destinationRcsPointCode
                        }
                        emptyText="RCS point missing"
                        rcs
                      />

                    </td>


                    {/* PRIORITY */}

                    <td>

                      <PriorityBadge
                        priority={
                          candidate.task
                            .priority
                        }
                        rcsPriority={
                          RCS_PRIORITY[
                            candidate.task
                              .priority
                          ] ||
                          60
                        }
                      />

                    </td>


                    {/* SCHEDULE */}

                    <td>

                      <input
                        className="dispatch-schedule-input"
                        type="datetime-local"
                        value={
                          scheduleDrafts[
                            candidate.task.id
                          ] ||
                          ""
                        }
                        onChange={(
                          event
                        ) =>
                          setScheduleDrafts(
                            (
                              current
                            ) => ({
                              ...current,

                              [candidate.task.id]:
                                event.target
                                  .value,
                            })
                          )
                        }
                      />


                      <small className="schedule-help">
                        Empty = send when queue sender is available
                      </small>

                    </td>


                    {/* READINESS */}

                    <td>

                      {candidate.ready ? (
                        <span className="readiness ready">

                          <CheckCircle2
                            size={13}
                          />

                          Ready

                        </span>
                      ) : (
                        <span className="readiness not-ready">

                          <AlertTriangle
                            size={13}
                          />

                          {
                            candidate.reason
                          }

                        </span>
                      )}

                    </td>


                    {/* ADD */}

                    <td>

                      <button
                        type="button"
                        className="prepare-task-button"
                        disabled={
                          !candidate.ready
                        }
                        onClick={() =>
                          queueWarehouseTask(
                            candidate
                          )
                        }
                      >
                        <Send
                          size={14}
                        />

                        Add Queue
                      </button>

                    </td>

                  </tr>
                )
              )}

            </tbody>

          </table>


          {candidates.length ===
            0 && (
            <div className="dispatcher-empty">

              <CheckCircle2
                size={30}
              />

              <strong>
                No Pending Warehouse Task
              </strong>

              <span>
                Pending Putaway/Picking tasks will appear here.
              </span>

            </div>
          )}

        </div>

      </section>


      {/* =================================================
          QUEUE
      ================================================= */}

      <section className="dispatcher-panel">

        <div className="dispatcher-panel-header">

          <div>

            <span className="dispatcher-section-label">
              RCS DISPATCH QUEUE
            </span>


            <h3>
              Scheduled Command Queue
            </h3>


            <p>
              Only tasks whose Send Time has arrived become READY.
              READY tasks are ordered by RCS priority, then FIFO.
            </p>

          </div>


          <div className="dispatcher-live-time">

            <span>
              Local time
            </span>


            <strong>
              {
                new Date(
                  now
                ).toLocaleString()
              }
            </strong>

          </div>

        </div>


        {/* IMPORTANT WARNING */}

        <div className="dispatcher-api-warning">

          <AlertTriangle
            size={16}
          />


          <span>
            Queue and scheduling are active in WMS only.
            Automatic HIK sending is intentionally disabled until
            the GenerateTaskOrder endpoint, authentication and exact
            request/response format are confirmed.
          </span>

        </div>


        <div className="dispatcher-table-wrapper">

          <table className="dispatcher-table robot-task-table">

            <thead>

              <tr>

                <th>
                  Queue
                </th>

                <th>
                  Warehouse Task
                </th>

                <th>
                  HIK RCS Route
                </th>

                <th>
                  Priority
                </th>

                <th>
                  Scheduled Send
                </th>

                <th>
                  Queue State
                </th>

                <th>
                  Command Draft
                </th>

                <th></th>

              </tr>

            </thead>


            <tbody>

              {queueRows.map(
                (
                  item
                ) => (
                  <tr
                    key={
                      item.id
                    }
                  >

                    {/* QUEUE */}

                    <td>

                      <strong>
                        {
                          item.id
                        }
                      </strong>


                      <small>

                        {item.queueState ===
                        "READY"
                          ? `Ready rank #${readyRankMap.get(
                              item.id
                            )}`
                          : formatDateTime(
                              item.createdAt
                            )}

                      </small>

                    </td>


                    {/* WAREHOUSE TASK */}

                    <td>

                      <strong>
                        {
                          item.warehouseTaskId
                        }
                      </strong>


                      <small>

                        {
                          item.type
                        }

                        {item.sourceOrderNo
                          ? ` · ${item.sourceOrderNo}`
                          : ""}

                      </small>

                    </td>


                    {/* ROUTE */}

                    <td>

                      <RouteCell
                        sourceLabel={
                          item.sourceRcsTargetType
                        }
                        destinationLabel={
                          item.destinationRcsTargetType
                        }
                        sourceCode={
                          item.sourceRcsPointCode
                        }
                        destinationCode={
                          item.destinationRcsPointCode
                        }
                        emptyText="RCS point missing"
                        rcs
                      />

                    </td>


                    {/* PRIORITY */}

                    <td>

                      <PriorityBadge
                        priority={
                          item.wmsPriority
                        }
                        rcsPriority={
                          item.rcsPriority
                        }
                      />

                    </td>


                    {/* TIME */}

                    <td>

                      <strong className="scheduled-time">
                        {
                          formatDateTime(
                            item.scheduledSendAt
                          )
                        }
                      </strong>

                    </td>


                    {/* STATE */}

                    <td>

                      <QueueStateBadge
                        state={
                          item.queueState
                        }
                      />

                    </td>


                    {/* COMMAND PREVIEW */}

                    <td>

                      <button
                        type="button"
                        className="payload-button"
                        onClick={() =>
                          copyText(
                            JSON.stringify(
                              item.commandDraft,
                              null,
                              2
                            )
                          )
                        }
                      >
                        <Copy
                          size={14}
                        />

                        Copy Draft
                      </button>

                    </td>


                    {/* REMOVE */}

                    <td>

                      <button
                        type="button"
                        className="robot-remove-button"
                        onClick={() =>
                          removeQueueItem(
                            item
                          )
                        }
                      >
                        <Trash2
                          size={14}
                        />
                      </button>

                    </td>

                  </tr>
                )
              )}

            </tbody>

          </table>


          {queueRows.length ===
            0 && (
            <div className="dispatcher-empty">

              <Send
                size={30}
              />

              <strong>
                RCS Queue is Empty
              </strong>

              <span>
                Add a mapped Warehouse Task to start scheduling.
              </span>

            </div>
          )}

        </div>

      </section>

    </div>
  );
}


/* =========================================================
   SUMMARY CARD
========================================================= */

function SummaryCard({
  title,
  value,
  icon,
  tone = "default",
}) {
  return (
    <div
      className={`dispatcher-summary-card tone-${tone}`}
    >

      <div className="dispatcher-summary-icon">
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


/* =========================================================
   ROUTE CELL
========================================================= */

function RouteCell({
  sourceLabel,
  destinationLabel,
  sourceCode,
  destinationCode,
  emptyText,
  rcs = false,
}) {
  return (
    <div
      className={`dispatcher-route-cell ${
        rcs
          ? "rcs"
          : ""
      }`}
    >

      {/* SOURCE */}

      <div>

        <span>
          {sourceLabel ||
            "Source"}
        </span>


        <strong
          className={
            sourceCode
              ? ""
              : "missing"
          }
        >
          <MapPin
            size={11}
          />

          {sourceCode ||
            emptyText}
        </strong>

      </div>


      <Route
        size={14}
      />


      {/* DESTINATION */}

      <div>

        <span>
          {destinationLabel ||
            "Destination"}
        </span>


        <strong
          className={
            destinationCode
              ? ""
              : "missing"
          }
        >
          <MapPin
            size={11}
          />

          {destinationCode ||
            emptyText}
        </strong>

      </div>

    </div>
  );
}


/* =========================================================
   PRIORITY
========================================================= */

function PriorityBadge({
  priority,
  rcsPriority,
}) {
  const normalized =
    String(
      priority ||
      "NORMAL"
    ).toUpperCase();


  return (
    <div className="dispatcher-priority-wrap">

      <span
        className={`dispatcher-priority priority-${normalized.toLowerCase()}`}
      >
        {
          normalized
        }
      </span>


      <small>
        RCS
        {" "}
        {
          Number(
            rcsPriority ||
            60
          )
        }
      </small>

    </div>
  );
}


/* =========================================================
   QUEUE STATE
========================================================= */

function QueueStateBadge({
  state,
}) {
  const labels = {
    READY:
      "READY",

    WAITING_TIME:
      "WAITING TIME",

    MAPPING_REQUIRED:
      "MAPPING REQUIRED",

    SENT:
      "SENT",
  };


  return (
    <span
      className={`queue-state queue-${String(
        state
      )
        .toLowerCase()
        .replaceAll(
          "_",
          "-"
        )}`}
    >
      {
        labels[state] ||
        state
      }
    </span>
  );
}


/* =========================================================
   RESOLVE SOURCE / DESTINATION
========================================================= */

function resolveTaskEndpoints({
  task,
  locationMap,
  receivingLocation,
  shippingLocation,
}) {
  let sourceLocation =
    null;

  let destinationLocation =
    null;


  /*
   * PUTAWAY
   *
   * Receiving -> Storage
   */

  if (
    task.type ===
    "PUTAWAY"
  ) {
    sourceLocation =
      task.sourceLocationId
        ? locationMap.get(
            task.sourceLocationId
          )
        : receivingLocation;


    destinationLocation =
      locationMap.get(
        task.destinationLocationId
      ) ||
      null;
  }


  /*
   * PICKING
   *
   * Storage -> Shipping
   */

  else {
    sourceLocation =
      locationMap.get(
        task.sourceLocationId
      ) ||
      null;


    destinationLocation =
      task.destinationLocationId
        ? locationMap.get(
            task.destinationLocationId
          )
        : shippingLocation;
  }


  return {
    sourceLocationId:
      sourceLocation?.id ||
      task.sourceLocationId ||
      "",

    destinationLocationId:
      destinationLocation?.id ||
      task.destinationLocationId ||
      "",


    sourceLabel:
      sourceLocation?.code ||
      task.sourceLabel ||
      "SOURCE",

    destinationLabel:
      destinationLocation?.code ||
      task.destinationLabel ||
      "DESTINATION",


    sourceNodeId:
      sourceLocation?.mapNodeId ||
      task.sourceNodeId ||
      "",

    destinationNodeId:
      destinationLocation?.mapNodeId ||
      task.destinationNodeId ||
      "",


    /*
     * HIK POINT
     */

    sourceRcsPointCode:
      sourceLocation?.rcsPointCode ||
      "",

    destinationRcsPointCode:
      destinationLocation?.rcsPointCode ||
      "",


    sourceRcsMapCode:
      sourceLocation?.rcsMapCode ||
      "",

    destinationRcsMapCode:
      destinationLocation?.rcsMapCode ||
      "",


    sourceRcsTargetType:
      sourceLocation?.rcsTargetType ||
      "SITE",

    destinationRcsTargetType:
      destinationLocation?.rcsTargetType ||
      "SITE",
  };
}


/* =========================================================
   REFRESH RCS POINTS FOR QUEUED TASK
========================================================= */

function enrichQueuedEndpoints(
  item,
  locationMap
) {
  const sourceLocation =
    locationMap.get(
      item.sourceLocationId
    );


  const destinationLocation =
    locationMap.get(
      item.destinationLocationId
    );


  return {
    sourceRcsPointCode:
      sourceLocation?.rcsPointCode ||
      item.sourceRcsPointCode ||
      "",

    destinationRcsPointCode:
      destinationLocation?.rcsPointCode ||
      item.destinationRcsPointCode ||
      "",


    sourceRcsMapCode:
      sourceLocation?.rcsMapCode ||
      item.sourceRcsMapCode ||
      "",

    destinationRcsMapCode:
      destinationLocation?.rcsMapCode ||
      item.destinationRcsMapCode ||
      "",


    sourceRcsTargetType:
      sourceLocation?.rcsTargetType ||
      item.sourceRcsTargetType ||
      "SITE",

    destinationRcsTargetType:
      destinationLocation?.rcsTargetType ||
      item.destinationRcsTargetType ||
      "SITE",
  };
}


/* =========================================================
   MAPPING VALIDATION
========================================================= */

function getEndpointReadiness(
  endpoints
) {
  if (
    !endpoints.sourceLocationId
  ) {
    return {
      ok: false,

      message:
        "Source WMS location missing",
    };
  }


  if (
    !endpoints.destinationLocationId
  ) {
    return {
      ok: false,

      message:
        "Destination WMS location missing",
    };
  }


  if (
    !endpoints.sourceRcsPointCode
  ) {
    return {
      ok: false,

      message:
        "Source HIK RCS point missing",
    };
  }


  if (
    !endpoints.destinationRcsPointCode
  ) {
    return {
      ok: false,

      message:
        "Destination HIK RCS point missing",
    };
  }


  return {
    ok: true,

    message:
      "Ready",
  };
}


/* =========================================================
   RECEIVING / SHIPPING
========================================================= */

function findOperationalLocation(
  locations,
  type
) {
  return (
    locations

      .filter(
        (location) =>
          location.type ===
            type &&
          ![
            "BLOCKED",
            "MAINTENANCE",
          ].includes(
            location.status
          )
      )

      .sort(
        (a, b) =>
          String(
            a.code ||
            ""
          ).localeCompare(
            String(
              b.code ||
              ""
            )
          )
      )[0] ||

    null
  );
}


/* =========================================================
   CREATE QUEUE RECORD
========================================================= */

function createDispatchRecord({
  warehouseTask,
  endpoints,
  scheduledSendAt,
  id,
}) {
  const createdAt =
    new Date().toISOString();


  const wmsPriority =
    normalizeWmsPriority(
      warehouseTask.priority
    );


  return {
    id,


    /*
     * WMS reference
     */

    warehouseTaskId:
      warehouseTask.id,

    sourceOrderId:
      warehouseTask.sourceOrderId ||
      "",

    sourceOrderNo:
      warehouseTask.sourceOrderNo ||
      "",


    /*
     * Task information
     */

    type:
      warehouseTask.type,

    sku:
      warehouseTask.sku ||
      "",

    itemName:
      warehouseTask.itemName ||
      "",

    quantity:
      Number(
        warehouseTask.quantity ||
        0
      ),


    /*
     * WMS locations
     */

    sourceLocationId:
      endpoints.sourceLocationId,

    destinationLocationId:
      endpoints.destinationLocationId,


    /*
     * WMS Map Nodes
     */

    sourceNodeId:
      endpoints.sourceNodeId,

    destinationNodeId:
      endpoints.destinationNodeId,


    /*
     * HIK RCS mapping
     */

    sourceRcsPointCode:
      endpoints.sourceRcsPointCode,

    destinationRcsPointCode:
      endpoints.destinationRcsPointCode,

    sourceRcsMapCode:
      endpoints.sourceRcsMapCode,

    destinationRcsMapCode:
      endpoints.destinationRcsMapCode,

    sourceRcsTargetType:
      endpoints.sourceRcsTargetType,

    destinationRcsTargetType:
      endpoints.destinationRcsTargetType,


    /*
     * Priority
     */

    wmsPriority,

    rcsPriority:
      RCS_PRIORITY[
        wmsPriority
      ] ||
      60,


    /*
     * Schedule
     */

    scheduledSendAt,


    /*
     * RCS connection state
     *
     * ยังไม่ได้ส่งจริง
     */

    sendStatus:
      "NOT_SENT",

    rcsTaskChainCode:
      "",

    rcsStatus:
      "NOT_SENT",


    createdAt,
  };
}


/* =========================================================
   LOAD OLD V6 / NORMALIZE
========================================================= */

function normalizeDispatchRecord(
  item,
  index
) {
  /*
   * รองรับข้อมูล V6 เดิม
   */

  const wmsPriority =
    normalizeWmsPriority(
      item.wmsPriority ||
      item.priority
    );


  return {
    id:
      String(
        item.id ||
        `RCSQ-${String(
          index + 1
        ).padStart(
          3,
          "0"
        )}`
      ),


    warehouseTaskId:
      String(
        item.warehouseTaskId ||
        ""
      ),


    sourceOrderId:
      String(
        item.sourceOrderId ||
        ""
      ),


    sourceOrderNo:
      String(
        item.sourceOrderNo ||
        ""
      ),


    type:
      String(
        item.type ||
        item.taskType ||
        "TRANSPORT"
      ).toUpperCase(),


    sku:
      String(
        item.sku ||
        ""
      ),


    itemName:
      String(
        item.itemName ||
        ""
      ),


    quantity:
      Number(
        item.quantity ||
        0
      ),


    sourceLocationId:
      String(
        item.sourceLocationId ||
        ""
      ),


    destinationLocationId:
      String(
        item.destinationLocationId ||
        ""
      ),


    sourceNodeId:
      String(
        item.sourceNodeId ||
        ""
      ),


    destinationNodeId:
      String(
        item.destinationNodeId ||
        ""
      ),


    sourceRcsPointCode:
      String(
        item.sourceRcsPointCode ||
        item.sourcePointCode ||
        ""
      ),


    destinationRcsPointCode:
      String(
        item.destinationRcsPointCode ||
        item.destinationPointCode ||
        ""
      ),


    sourceRcsMapCode:
      String(
        item.sourceRcsMapCode ||
        ""
      ),


    destinationRcsMapCode:
      String(
        item.destinationRcsMapCode ||
        ""
      ),


    sourceRcsTargetType:
      String(
        item.sourceRcsTargetType ||
        "SITE"
      ).toUpperCase(),


    destinationRcsTargetType:
      String(
        item.destinationRcsTargetType ||
        "SITE"
      ).toUpperCase(),


    wmsPriority,


    rcsPriority:
      clampRcsPriority(
        item.rcsPriority ??
        RCS_PRIORITY[
          wmsPriority
        ]
      ),


    scheduledSendAt:
      item.scheduledSendAt ||
      item.createdAt ||
      new Date().toISOString(),


    sendStatus:
      item.sendStatus ||
      (
        item.status ===
        "SENT"
          ? "SENT"
          : "NOT_SENT"
      ),


    rcsTaskChainCode:
      String(
        item.rcsTaskChainCode ||
        ""
      ),


    rcsStatus:
      String(
        item.rcsStatus ||
        "NOT_SENT"
      ),


    createdAt:
      item.createdAt ||
      new Date().toISOString(),
  };
}


/* =========================================================
   COMMAND DRAFT
========================================================= */

function buildCommandDraft(
  item
) {
  return {
    _note:
      "Internal WMS command draft only. Exact HIK GenerateTaskOrder endpoint/body is not configured yet.",


    /*
     * External Task ID
     */

    robotTaskCode:
      item.warehouseTaskId,


    taskType:
      "TRANSPORT",


    initPriority:
      clampRcsPriority(
        item.rcsPriority
      ),


    scheduledSendAt:
      item.scheduledSendAt,


    /*
     * SOURCE
     */

    source: {
      type:
        item.sourceRcsTargetType ||
        "SITE",

      code:
        item.sourceRcsPointCode ||
        "",

      mapCode:
        item.sourceRcsMapCode ||
        "",
    },


    /*
     * DESTINATION
     */

    destination: {
      type:
        item.destinationRcsTargetType ||
        "SITE",

      code:
        item.destinationRcsPointCode ||
        "",

      mapCode:
        item.destinationRcsMapCode ||
        "",
    },
  };
}


/* =========================================================
   QUEUE STATE
========================================================= */

function getQueueState({
  item,
  endpoints,
  now,
}) {
  /*
   * ถ้าส่งแล้ว
   */

  if (
    item.sendStatus ===
    "SENT"
  ) {
    return "SENT";
  }


  /*
   * ตรวจ RCS mapping
   */

  const readiness =
    getEndpointReadiness({
      sourceLocationId:
        item.sourceLocationId,

      destinationLocationId:
        item.destinationLocationId,

      sourceRcsPointCode:
        endpoints.sourceRcsPointCode,

      destinationRcsPointCode:
        endpoints.destinationRcsPointCode,
    });


  if (
    !readiness.ok
  ) {
    return "MAPPING_REQUIRED";
  }


  /*
   * ตรวจเวลา
   */

  const scheduledTime =
    getTime(
      item.scheduledSendAt
    );


  if (
    scheduledTime >
    now
  ) {
    return "WAITING_TIME";
  }


  /*
   * ถึงเวลาแล้ว
   */

  return "READY";
}


/* =========================================================
   WAREHOUSE TASK SORT
========================================================= */

function compareWarehouseCandidates(
  a,
  b
) {
  const priorityCompare =
    (
      PRIORITY_ORDER[
        a.task.priority
      ] ??
      99
    ) -
    (
      PRIORITY_ORDER[
        b.task.priority
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
   * Priority เท่ากัน
   *
   * Task เก่าก่อน
   */

  return (
    getTime(
      a.task.createdAt
    ) -
    getTime(
      b.task.createdAt
    )
  );
}


/* =========================================================
   RCS QUEUE SORT
========================================================= */

function compareQueueRows(
  a,
  b
) {
  /*
   * READY อยู่บนสุด
   */

  const stateRank = {
    READY: 0,
    WAITING_TIME: 1,
    MAPPING_REQUIRED: 2,
    SENT: 3,
  };


  const stateCompare =
    (
      stateRank[
        a.queueState
      ] ??
      99
    ) -
    (
      stateRank[
        b.queueState
      ] ??
      99
    );


  if (
    stateCompare !==
    0
  ) {
    return stateCompare;
  }


  /*
   * ==========================
   * READY
   * ==========================
   *
   * Priority สูงก่อน
   *
   * ถ้า Priority เท่ากัน
   * scheduled time ก่อน
   *
   * ถ้ายังเท่ากัน
   * FIFO
   */

  if (
    a.queueState ===
    "READY"
  ) {
    const priorityCompare =
      Number(
        b.rcsPriority ||
        0
      ) -
      Number(
        a.rcsPriority ||
        0
      );


    if (
      priorityCompare !==
      0
    ) {
      return priorityCompare;
    }


    const scheduleCompare =
      getTime(
        a.scheduledSendAt
      ) -
      getTime(
        b.scheduledSendAt
      );


    if (
      scheduleCompare !==
      0
    ) {
      return scheduleCompare;
    }


    return (
      getTime(
        a.createdAt
      ) -
      getTime(
        b.createdAt
      )
    );
  }


  /*
   * ==========================
   * WAITING TIME
   * ==========================
   *
   * งานที่ถึงเวลาก่อน
   * แสดงก่อน
   */

  if (
    a.queueState ===
    "WAITING_TIME"
  ) {
    const scheduleCompare =
      getTime(
        a.scheduledSendAt
      ) -
      getTime(
        b.scheduledSendAt
      );


    if (
      scheduleCompare !==
      0
    ) {
      return scheduleCompare;
    }


    return (
      Number(
        b.rcsPriority ||
        0
      ) -
      Number(
        a.rcsPriority ||
        0
      )
    );
  }


  return (
    getTime(
      a.createdAt
    ) -
    getTime(
      b.createdAt
    )
  );
}


/* =========================================================
   QUEUE ID
========================================================= */

function getNextQueueId(
  items
) {
  let highest =
    0;


  items.forEach(
    (item) => {
      const match =
        /^RCSQ-(\d+)$/i.exec(
          String(
            item.id ||
            ""
          )
        );


      if (
        match
      ) {
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


  return `RCSQ-${String(
    highest + 1
  ).padStart(
    3,
    "0"
  )}`;
}


/* =========================================================
   PRIORITY
========================================================= */

function normalizeWmsPriority(
  value
) {
  const priority =
    String(
      value ||
      "NORMAL"
    ).toUpperCase();


  return [
    "LOW",
    "NORMAL",
    "HIGH",
    "URGENT",
  ].includes(
    priority
  )
    ? priority
    : "NORMAL";
}


function clampRcsPriority(
  value
) {
  const number =
    Number(
      value
    );


  if (
    !Number.isFinite(
      number
    )
  ) {
    return 60;
  }


  return Math.min(
    120,

    Math.max(
      1,

      Math.round(
        number
      )
    )
  );
}


/* =========================================================
   SCHEDULE
========================================================= */

function parseScheduleInput(
  value
) {
  /*
   * Empty
   *
   * = พร้อมทันที
   */

  if (
    !value
  ) {
    return new Date().toISOString();
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
    return new Date().toISOString();
  }


  return date.toISOString();
}


/* =========================================================
   GATEWAY
========================================================= */

function validateGatewayOctet(
  value
) {
  if (
    String(
      value
    ).trim() ===
    ""
  ) {
    return {
      ok: false,
    };
  }


  const number =
    Number(
      value
    );


  if (
    !Number.isInteger(
      number
    ) ||
    number <
      1 ||
    number >
      254
  ) {
    return {
      ok: false,
    };
  }


  return {
    ok: true,

    value:
      number,
  };
}


/* =========================================================
   COPY
========================================================= */

async function copyText(
  text
) {
  try {
    if (
      navigator.clipboard &&
      window.isSecureContext
    ) {
      await navigator.clipboard.writeText(
        text
      );


      return true;
    }


    const textarea =
      document.createElement(
        "textarea"
      );


    textarea.value =
      text;


    textarea.style.position =
      "fixed";


    textarea.style.opacity =
      "0";


    document.body.appendChild(
      textarea
    );


    textarea.focus();

    textarea.select();


    const copied =
      document.execCommand(
        "copy"
      );


    document.body.removeChild(
      textarea
    );


    return copied;
  } catch (error) {
    console.error(
      "Copy failed.",
      error
    );


    return false;
  }
}


/* =========================================================
   DATE
========================================================= */

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


/* =========================================================
   LOAD LOCAL STORAGE
========================================================= */

function loadWarehouseTasks() {
  return loadArray(
    WAREHOUSE_TASK_KEY
  );
}


function loadLocations() {
  return loadArray(
    LOCATION_STORAGE_KEY
  );
}


function loadDispatchQueue() {
  return loadArray(
    RCS_QUEUE_KEY
  ).map(
    normalizeDispatchRecord
  );
}


function loadArray(
  key
) {
  try {
    const saved =
      localStorage.getItem(
        key
      );


    if (
      !saved
    ) {
      return [];
    }


    const parsed =
      JSON.parse(
        saved
      );


    return Array.isArray(
      parsed
    )
      ? parsed
      : [];
  } catch (error) {
    console.warn(
      `Could not load ${key}.`,
      error
    );


    return [];
  }
}