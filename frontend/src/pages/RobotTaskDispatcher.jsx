import {
  AlertTriangle,
  CheckCircle2,
  Clipboard,
  Copy,
  ExternalLink,
  Eye,
  History,
  MapPin,
  Play,
  RefreshCw,
  Route,
  Send,
  Trash2,
  X,
} from "lucide-react";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  loadTasks,
  notifyWmsDataChanged,
  saveTasks,
  syncTaskStatusToOperations,
} from "../utils/taskOperationSync";

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
  * Command Draft ที่กำลังเปิดดู
  */

  const [
    selectedDraft,
    setSelectedDraft,
  ] = useState(null);

  /*
  * Queue Item ที่กำลังเปิดดู History
  */

  const [
    selectedHistoryItem,
    setSelectedHistoryItem,
  ] = useState(null);

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
              
              readiness,

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

/* =========================================================
   QUEUE STATE HISTORY WATCHER
========================================================= */

useEffect(() => {
  /*
   * queueRows จะคำนวณ Queue State ใหม่
   * ทุกครั้งที่เวลาเปลี่ยน
   *
   * เช่น:
   *
   * WAITING_TIME
   *       ↓
   * READY
   */

  if (
    queueRows.length ===
    0
  ) {
    return;
  }


  const rowMap =
    new Map(
      queueRows.map(
        (row) => [
          row.id,
          row,
        ]
      )
    );


  setDispatchQueue(
    (current) => {
      let changed =
        false;


      const updated =
        current.map(
          (item) => {
            const row =
              rowMap.get(
                item.id
              );


            if (!row) {
              return item;
            }


            const nextState =
              row.queueState;


            const previousState =
              item.lastQueueState ||
              "";


            /*
             * ไม่มีการเปลี่ยน State
             */

            if (
              previousState ===
              nextState
            ) {
              return item;
            }


            changed =
              true;


            const eventTime =
              new Date().toISOString();


            let message;


            /*
             * ครั้งแรก
             */

            if (
              !previousState
            ) {
              message =
                `Initial Queue State: ${nextState}.`;
            } else {
              message =
                `Queue State changed from ${previousState} to ${nextState}.`;
            }


            return {
              ...item,


              lastQueueState:
                nextState,


              history:
                appendHistory(
                  item.history,

                  createHistoryEvent({
                    type:
                      "QUEUE_STATE_CHANGED",

                    message,

                    at:
                      eventTime,

                    details: {
                      from:
                        previousState ||
                        null,

                      to:
                        nextState,
                    },
                  })
                ),
            };
          }
        );


      return changed
        ? updated
        : current;
    }
  );

}, [queueRows]);


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
   UPDATE QUEUE PRIORITY
===================================================== */

function updateQueuePriority(
  itemId,
  priority
) {
  const normalized =
    normalizeWmsPriority(
      priority
    );

  const rcsPriority =
    RCS_PRIORITY[normalized] ||
    60;

  const nowIso =
    new Date().toISOString();

  setDispatchQueue(
    (current) =>
      current.map(
        (item) => {
          if (
            item.id !== itemId ||
            isQueueLocked(item)
          ) {
            return item;
          }

          const oldPriority =
            normalizeWmsPriority(
              item.wmsPriority
            );

          const oldRcsPriority =
            clampRcsPriority(
              item.rcsPriority
            );

          if (
            oldPriority === normalized &&
            oldRcsPriority === rcsPriority
          ) {
            return item;
          }

          return {
            ...item,
            wmsPriority: normalized,
            rcsPriority,
            priorityUpdatedAt: nowIso,
            history: appendHistory(
              item.history,
              createHistoryEvent({
                type: "PRIORITY_UPDATED",
                message: `Priority changed from ${oldPriority} (RCS ${oldRcsPriority}) to ${normalized} (RCS ${rcsPriority}).`,
                at: nowIso,
                details: {
                  fromPriority: oldPriority,
                  toPriority: normalized,
                  fromRcsPriority: oldRcsPriority,
                  toRcsPriority: rcsPriority,
                },
              })
            ),
          };
        }
      )
  );
}

/* =====================================================
   UPDATE QUEUE SCHEDULE
===================================================== */

function updateQueueSchedule(
  itemId,
  value
) {
  let scheduledSendAt;

  if (!value) {
    scheduledSendAt =
      new Date().toISOString();
  } else {
    const selectedDate =
      new Date(value);

    if (
      Number.isNaN(
        selectedDate.getTime()
      )
    ) {
      return;
    }

    scheduledSendAt =
      selectedDate.toISOString();
  }

  const nowIso =
    new Date().toISOString();

  setDispatchQueue(
    (current) =>
      current.map(
        (item) => {
          if (
            item.id !== itemId ||
            isQueueLocked(item)
          ) {
            return item;
          }

          const oldSchedule =
            item.scheduledSendAt ||
            "";

          if (
            oldSchedule ===
            scheduledSendAt
          ) {
            return item;
          }

          return {
            ...item,
            scheduledSendAt,
            scheduleUpdatedAt: nowIso,
            history: appendHistory(
              item.history,
              createHistoryEvent({
                type: "SCHEDULE_UPDATED",
                message: `Scheduled Send changed from ${formatDateTime(oldSchedule)} to ${formatDateTime(scheduledSendAt)}.`,
                at: nowIso,
                details: {
                  from: oldSchedule || null,
                  to: scheduledSendAt,
                },
              })
            ),
          };
        }
      )
  );
}

/* =====================================================
   SET QUEUE TO NOW
===================================================== */

function setQueueScheduleNow(
  itemId
) {
  const currentTime =
    new Date().toISOString();

  setDispatchQueue(
    (current) =>
      current.map(
        (item) => {
          if (
            item.id !== itemId ||
            isQueueLocked(item)
          ) {
            return item;
          }

          return {
            ...item,
            scheduledSendAt:
              currentTime,
            scheduleUpdatedAt:
              currentTime,
            history: appendHistory(
              item.history,
              createHistoryEvent({
                type: "SCHEDULE_NOW",
                message:
                  "Scheduled Send changed to current time.",
                at: currentTime,
                details: {
                  from:
                    item.scheduledSendAt ||
                    null,
                  to: currentTime,
                },
              })
            ),
          };
        }
      )
  );
}

/* =====================================================
   RCS -> WAREHOUSE TASK SYNC
===================================================== */

function syncWarehouseTaskFromRcs({
  warehouseTaskId,
  nextStatus,
  at = new Date().toISOString(),
}) {
  /*
   * Always read the latest task records from localStorage.
   * This avoids using a stale React state snapshot while the
   * simulated RCS lifecycle is advancing through timers.
   */
  const latestTasks =
    loadTasks();


  const currentTask =
    latestTasks.find(
      (task) =>
        task.id ===
        warehouseTaskId
    );


  if (!currentTask) {
    return {
      ok: false,
      message:
        `Warehouse Task ${warehouseTaskId} was not found.`,
    };
  }


  /*
   * Do not move a completed Warehouse Task backwards.
   * Repeated timer execution is also treated as idempotent.
   */
  if (
    currentTask.status ===
      "COMPLETED" ||
    currentTask.status ===
      nextStatus
  ) {
    setWarehouseTasks(
      latestTasks
    );


    return {
      ok: true,
      skipped: true,
      task: currentTask,
    };
  }


  const nextTasks =
    latestTasks.map(
      (task) => {
        if (
          task.id !==
          warehouseTaskId
        ) {
          return task;
        }


        /*
         * RCS RUNNING
         * -> Warehouse Task IN_PROGRESS
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
              at,
            completedAt:
              "",
            blockedAt:
              "",
          };
        }


        /*
         * RCS COMPLETED
         * -> Warehouse Task COMPLETED
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
              at,
            completedAt:
              at,
            blockedAt:
              "",
          };
        }


        return {
          ...task,
          status:
            nextStatus,
        };
      }
    );


  const changedTask =
    nextTasks.find(
      (task) =>
        task.id ===
        warehouseTaskId
    );


  /*
   * Reuse the same Task -> Operation synchronization logic
   * already used by Task Management.
   *
   * This is important because inventory must be updated only
   * through the existing operation workflow, not directly by
   * the RCS simulator.
   */
  const operationResult =
    syncTaskStatusToOperations({
      changedTask,
      allTasks:
        nextTasks,
      nextStatus,
      now: at,
    });


  if (!operationResult.ok) {
    return {
      ok: false,
      message:
        operationResult.message ||
        "Could not synchronize the Warehouse Operation.",
    };
  }


  const saveResult =
    saveTasks(
      nextTasks
    );


  if (!saveResult.ok) {
    return {
      ok: false,
      message:
        saveResult.message ||
        "Could not save Warehouse Tasks.",
    };
  }


  setWarehouseTasks(
    nextTasks
  );


  /*
   * localStorage does not emit a storage event in the same tab.
   * Notify Task Management and other WMS pages explicitly.
   */
  notifyWmsDataChanged([
    WAREHOUSE_TASK_KEY,
  ]);


  return {
    ok: true,
    task: changedTask,
  };
}


/* =====================================================
   SIMULATE SEND TO RCS
===================================================== */

function simulateSendToRcs(
  item
) {
  if (
    item.queueState !== "READY"
  ) {
    window.alert(
      "Only a READY task can be sent."
    );
    return;
  }

  if (isQueueLocked(item)) {
    return;
  }

  const startedAt =
    new Date().toISOString();

  /* STEP 1: READY -> SENDING */
  setDispatchQueue(
    (current) =>
      current.map(
        (entry) =>
          entry.id === item.id
            ? {
                ...entry,

                // Keep the latest mapping shown in queueRows.
                sourceRcsPointCode:
                  item.sourceRcsPointCode ||
                  entry.sourceRcsPointCode ||
                  "",
                destinationRcsPointCode:
                  item.destinationRcsPointCode ||
                  entry.destinationRcsPointCode ||
                  "",
                sourceRcsMapCode:
                  item.sourceRcsMapCode ||
                  entry.sourceRcsMapCode ||
                  "",
                destinationRcsMapCode:
                  item.destinationRcsMapCode ||
                  entry.destinationRcsMapCode ||
                  "",
                sourceRcsTargetType:
                  item.sourceRcsTargetType ||
                  entry.sourceRcsTargetType ||
                  "SITE",
                destinationRcsTargetType:
                  item.destinationRcsTargetType ||
                  entry.destinationRcsTargetType ||
                  "SITE",

                sendStatus: "SENDING",
                rcsStatus: "NOT_SENT",
                sendStartedAt:
                  startedAt,
                history: appendHistory(
                  entry.history,
                  createHistoryEvent({
                    type:
                      "SIMULATED_SEND_STARTED",
                    message:
                      "Simulated transmission to HIK RCS started.",
                    at: startedAt,
                    details: {
                      mode: "SIMULATION",
                      warehouseTaskId:
                        entry.warehouseTaskId,
                      rcsPriority:
                        entry.rcsPriority,
                      source:
                        item.sourceRcsPointCode ||
                        entry.sourceRcsPointCode,
                      destination:
                        item.destinationRcsPointCode ||
                        entry.destinationRcsPointCode,
                    },
                  })
                ),
              }
            : entry
      )
  );

  /* STEP 2: SENDING -> SENT */
  window.setTimeout(
    () => {
      const sentAt =
        new Date().toISOString();

      setDispatchQueue(
        (current) =>
          current.map(
            (entry) => {
              if (
                entry.id !== item.id ||
                entry.sendStatus !==
                  "SENDING"
              ) {
                return entry;
              }

              return {
                ...entry,
                sendStatus: "SENT",
                sentAt,
                history: appendHistory(
                  entry.history,
                  createHistoryEvent({
                    type: "COMMAND_SENT",
                    message:
                      "Command was simulated as successfully sent to HIK RCS.",
                    at: sentAt,
                    details: {
                      mode: "SIMULATION",
                      command:
                        buildCommandDraft(
                          entry
                        ),
                    },
                  })
                ),
              };
            }
          )
      );
    },
    1000
  );

  /* STEP 3: simulated RCS creates a task chain */
  window.setTimeout(
    () => {
      const createdAt =
        new Date().toISOString();

      setDispatchQueue(
        (current) =>
          current.map(
            (entry) => {
              if (
                entry.id !== item.id ||
                entry.sendStatus !==
                  "SENT" ||
                ![
                  "NOT_SENT",
                  "",
                ].includes(
                  String(
                    entry.rcsStatus ||
                    "NOT_SENT"
                  ).toUpperCase()
                )
              ) {
                return entry;
              }

              const simulatedTaskChainCode =
                createSimulatedRcsTaskChainCode(
                  entry
                );

              return {
                ...entry,
                rcsStatus: "CREATED",
                rcsTaskChainCode:
                  simulatedTaskChainCode,
                rcsCreatedAt:
                  createdAt,
                history: appendHistory(
                  entry.history,
                  createHistoryEvent({
                    type: "RCS_CREATED",
                    message: `Simulated RCS task created with Task Chain ${simulatedTaskChainCode}.`,
                    at: createdAt,
                    details: {
                      taskChainCode:
                        simulatedTaskChainCode,
                      rcsStatus:
                        "CREATED",
                      mode: "SIMULATION",
                    },
                  })
                ),
              };
            }
          )
      );
    },
    2000
  );


  /*
   * =====================================================
   * STEP 4: CREATED -> RUNNING
   * =====================================================
   *
   * This also mirrors the RCS execution state back to the
   * Warehouse Task as IN_PROGRESS.
   */
  window.setTimeout(
    () => {
      const latestEntry =
        loadDispatchQueue().find(
          (entry) =>
            entry.id ===
            item.id
        );


      if (
        !latestEntry ||
        latestEntry.sendStatus !==
          "SENT" ||
        latestEntry.rcsStatus !==
          "CREATED"
      ) {
        return;
      }


      const runningAt =
        new Date().toISOString();


      const taskSync =
        syncWarehouseTaskFromRcs({
          warehouseTaskId:
            latestEntry.warehouseTaskId,
          nextStatus:
            "IN_PROGRESS",
          at: runningAt,
        });


      setDispatchQueue(
        (current) =>
          current.map(
            (entry) => {
              if (
                entry.id !==
                  item.id ||
                entry.sendStatus !==
                  "SENT" ||
                entry.rcsStatus !==
                  "CREATED"
              ) {
                return entry;
              }


              let nextHistory =
                appendHistory(
                  entry.history,
                  createHistoryEvent({
                    type:
                      "RCS_RUNNING",
                    message:
                      "Simulated RCS task started running.",
                    at: runningAt,
                    details: {
                      taskChainCode:
                        entry.rcsTaskChainCode ||
                        null,
                      rcsStatus:
                        "RUNNING",
                      mode:
                        "SIMULATION",
                    },
                  })
                );


              nextHistory =
                appendHistory(
                  nextHistory,
                  createHistoryEvent({
                    type:
                      taskSync.ok
                        ? "WAREHOUSE_TASK_IN_PROGRESS"
                        : "WAREHOUSE_TASK_SYNC_FAILED",
                    message:
                      taskSync.ok
                        ? `Warehouse Task ${entry.warehouseTaskId} synchronized to IN_PROGRESS.`
                        : `Could not synchronize Warehouse Task ${entry.warehouseTaskId} to IN_PROGRESS: ${taskSync.message}`,
                    at: runningAt,
                    details: {
                      warehouseTaskId:
                        entry.warehouseTaskId,
                      warehouseTaskStatus:
                        taskSync.ok
                          ? "IN_PROGRESS"
                          : null,
                      syncOk:
                        taskSync.ok,
                    },
                  })
                );


              return {
                ...entry,
                rcsStatus:
                  "RUNNING",
                rcsStartedAt:
                  runningAt,
                warehouseTaskSyncedAt:
                  taskSync.ok
                    ? runningAt
                    : entry.warehouseTaskSyncedAt ||
                      "",
                warehouseTaskSyncStatus:
                  taskSync.ok
                    ? "IN_PROGRESS"
                    : "ERROR",
                history:
                  nextHistory,
              };
            }
          )
      );


      if (!taskSync.ok) {
        console.error(
          "RCS RUNNING -> Warehouse Task sync failed:",
          taskSync.message
        );
      }
    },
    4000
  );


  /*
   * =====================================================
   * STEP 5: RUNNING -> COMPLETED
   * =====================================================
   *
   * The RCS simulator does NOT edit inventory directly.
   * It completes the Warehouse Task and then reuses the
   * existing Task -> Operation synchronization logic.
   */
  window.setTimeout(
    () => {
      const latestEntry =
        loadDispatchQueue().find(
          (entry) =>
            entry.id ===
            item.id
        );


      if (
        !latestEntry ||
        latestEntry.sendStatus !==
          "SENT" ||
        latestEntry.rcsStatus !==
          "RUNNING"
      ) {
        return;
      }


      const completedAt =
        new Date().toISOString();


      const taskSync =
        syncWarehouseTaskFromRcs({
          warehouseTaskId:
            latestEntry.warehouseTaskId,
          nextStatus:
            "COMPLETED",
          at: completedAt,
        });


      setDispatchQueue(
        (current) =>
          current.map(
            (entry) => {
              if (
                entry.id !==
                  item.id ||
                entry.sendStatus !==
                  "SENT" ||
                entry.rcsStatus !==
                  "RUNNING"
              ) {
                return entry;
              }


              let nextHistory =
                appendHistory(
                  entry.history,
                  createHistoryEvent({
                    type:
                      "RCS_COMPLETED",
                    message:
                      "Simulated RCS task completed.",
                    at: completedAt,
                    details: {
                      taskChainCode:
                        entry.rcsTaskChainCode ||
                        null,
                      rcsStatus:
                        "COMPLETED",
                      mode:
                        "SIMULATION",
                    },
                  })
                );


              nextHistory =
                appendHistory(
                  nextHistory,
                  createHistoryEvent({
                    type:
                      taskSync.ok
                        ? "WAREHOUSE_TASK_COMPLETED"
                        : "WAREHOUSE_TASK_SYNC_FAILED",
                    message:
                      taskSync.ok
                        ? `Warehouse Task ${entry.warehouseTaskId} synchronized to COMPLETED.`
                        : `Could not synchronize Warehouse Task ${entry.warehouseTaskId} to COMPLETED: ${taskSync.message}`,
                    at: completedAt,
                    details: {
                      warehouseTaskId:
                        entry.warehouseTaskId,
                      warehouseTaskStatus:
                        taskSync.ok
                          ? "COMPLETED"
                          : null,
                      syncOk:
                        taskSync.ok,
                    },
                  })
                );


              return {
                ...entry,
                rcsStatus:
                  "COMPLETED",
                rcsCompletedAt:
                  completedAt,
                warehouseTaskSyncedAt:
                  taskSync.ok
                    ? completedAt
                    : entry.warehouseTaskSyncedAt ||
                      "",
                warehouseTaskSyncStatus:
                  taskSync.ok
                    ? "COMPLETED"
                    : "ERROR",
                history:
                  nextHistory,
              };
            }
          )
      );


      if (!taskSync.ok) {
        console.error(
          "RCS COMPLETED -> Warehouse Task sync failed:",
          taskSync.message
        );


        window.alert(
          `RCS task completed, but WMS synchronization failed: ${taskSync.message}`
        );
      }
    },
    7000
  );
}

/* =====================================================
   REMOVE QUEUE ITEM
===================================================== */

function removeQueueItem(
  item
) {
  if (isQueueLocked(item)) {
    window.alert(
      "A task that is sending or already sent cannot be removed."
    );
    return;
  }

  const confirmed =
    window.confirm(
      `Remove ${item.id} from the RCS dispatch queue?`
    );

  if (!confirmed) {
    return;
  }

  setDispatchQueue(
    (current) =>
      current.filter(
        (entry) =>
          entry.id !== item.id
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

                      <MappingReadiness
                        candidate={
                          candidate
                        }
                      />

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
                  RCS Status
                </th>

                <th>
                  Command Draft
                </th>

                <th>
                  History
                </th>

                <th>
                  Action
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

                      <div className="queue-priority-editor">

                        <select
                          value={
                            item.wmsPriority ||
                            "NORMAL"
                          }

                          disabled={
                            isQueueLocked(item)
                          }

                          onChange={(
                            event
                          ) =>
                            updateQueuePriority(
                              item.id,
                              event.target.value
                            )
                          }
                        >

                          <option value="LOW">
                            LOW
                          </option>


                          <option value="NORMAL">
                            NORMAL
                          </option>


                          <option value="HIGH">
                            HIGH
                          </option>


                          <option value="URGENT">
                            URGENT
                          </option>

                        </select>


                        <span
                          className={`queue-priority-value priority-${String(
                            item.wmsPriority ||
                            "NORMAL"
                          ).toLowerCase()}`}
                        >
                          RCS
                          {" "}
                          {
                            item.rcsPriority
                          }
                        </span>

                      </div>

                    </td>


                    {/* TIME */}

                    <td>

                      <div className="queue-schedule-editor">

                        <input
                          type="datetime-local"

                          value={
                            formatDateTimeLocalInput(
                              item.scheduledSendAt
                            )
                          }

                          disabled={
                            isQueueLocked(item)
                          }

                          onChange={(
                            event
                          ) =>
                            updateQueueSchedule(
                              item.id,
                              event.target.value
                            )
                          }
                        />


                        <button
                          type="button"

                          disabled={
                            isQueueLocked(item)
                          }

                          onClick={() =>
                            setQueueScheduleNow(
                              item.id
                            )
                          }
                        >
                          Now
                        </button>


                        <small>

                          {item.queueState ===
                          "WAITING_TIME"
                            ? "Waiting until scheduled time"
                            : item.queueState ===
                                "READY"
                              ? "Eligible to send now"
                              : item.queueState ===
                                  "SENDING"
                                ? "Sending command"
                                : item.queueState ===
                                    "SENT"
                                  ? "Command sent"
                                  : "Schedule saved"}

                        </small>

                      </div>

                    </td>

                    <td>

                      <QueueStateBadge
                        state={
                          item.queueState
                        }
                      />

                    </td>

                    {/* RCS STATUS */}

                    <td>

                      <RcsStatusBadge
                        status={
                          item.rcsStatus
                        }
                        taskChainCode={
                          item.rcsTaskChainCode
                        }
                      />

                    </td>


                    {/* COMMAND PREVIEW */}

                    <td>

                      <div className="draft-action-buttons">

                        {/* VIEW */}

                        <button
                          type="button"
                          className="view-draft-button"
                          onClick={() =>
                            setSelectedDraft(
                              item
                            )
                          }
                        >
                          <Eye
                            size={14}
                          />

                          View Draft
                        </button>


                        {/* COPY */}

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

                      </div>

                    </td>

                    <td>

                      <button
                        type="button"
                        className="history-button"
                        onClick={() =>
                          setSelectedHistoryItem(
                            item
                          )
                        }
                      >
                        <History
                          size={14}
                        />

                        History

                        <span>
                          {
                            item.history
                              ?.length ||
                            0
                          }
                        </span>

                      </button>

                    </td>

                    


                    {/* SIMULATE SEND */}

                    <td>

                      <button
                        type="button"
                        className="simulate-send-button"
                        disabled={
                          item.queueState !==
                            "READY" ||
                          isQueueLocked(item)
                        }
                        onClick={() =>
                          simulateSendToRcs(
                            item
                          )
                        }
                      >
                        <Play
                          size={14}
                        />

                        {item.sendStatus ===
                        "SENDING"
                          ? "Sending..."
                          : item.sendStatus ===
                              "SENT"
                            ? "Sent"
                            : "Simulate Send"}
                      </button>

                    </td>


                    {/* REMOVE */}

                    <td>

                      <button
                        type="button"
                        className="robot-remove-button"

                        disabled={
                          isQueueLocked(
                            item
                          )
                        }   

                        title={
                          isQueueLocked(
                            item
                          )
                            ? "Locked after RCS sending starts"
                            : "Remove this unsent dispatch from the RCS Queue"
                        }

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


      {/* =================================================
          COMMAND DRAFT MODAL
      ================================================= */}

      {selectedDraft && (
        <CommandDraftModal
          item={
            selectedDraft
          }
          onClose={() =>
            setSelectedDraft(
              null
            )
          }
        />
      )}

      {selectedHistoryItem && (
        <QueueHistoryModal
          item={
            queueRows.find(
              (row) =>
                row.id ===
                selectedHistoryItem.id
            ) ||
            selectedHistoryItem
          }

          onClose={() =>
            setSelectedHistoryItem(
              null
            )
          }
        />
      )}

    </div>
  );
}

/* =========================================================
   COMMAND DRAFT MODAL
========================================================= */

function CommandDraftModal({
  item,
  onClose,
}) {
  const [
    copied,
    setCopied,
  ] = useState(false);


  const jsonText =
    JSON.stringify(
      item.commandDraft,
      null,
      2
    );


  async function handleCopy() {
    const success =
      await copyText(
        jsonText
      );


    if (!success) {
      return;
    }


    setCopied(true);


    window.setTimeout(
      () =>
        setCopied(
          false
        ),
      1800
    );
  }


  return (
    <div
      className="draft-modal-backdrop"
      onMouseDown={(
        event
      ) => {
        /*
         * คลิกพื้นที่ดำด้านนอก
         * = ปิด Modal
         */

        if (
          event.target ===
          event.currentTarget
        ) {
          onClose();
        }
      }}
    >

      <div className="draft-modal">

        {/* HEADER */}

        <div className="draft-modal-header">

          <div>

            <span>
              WMS INTERNAL COMMAND
            </span>


            <h3>
              Command Draft
            </h3>


            <p>
              Preview the command data prepared by WMS
              before future transmission to HIK RCS.
            </p>

          </div>


          <button
            type="button"
            className="draft-modal-close"
            onClick={
              onClose
            }
            aria-label="Close"
          >
            <X
              size={18}
            />
          </button>

        </div>


        {/* TASK INFORMATION */}

        <div className="draft-info-grid">

          <DraftInfo
            label="Queue ID"
            value={
              item.id
            }
          />


          <DraftInfo
            label="Warehouse Task"
            value={
              item.warehouseTaskId
            }
          />


          <DraftInfo
            label="Task Type"
            value={
              item.type ||
              "-"
            }
          />


          <DraftInfo
            label="Queue State"
            value={
              item.queueState ||
              "-"
            }
          />


          <DraftInfo
            label="WMS Priority"
            value={
              item.wmsPriority ||
              "NORMAL"
            }
          />


          <DraftInfo
            label="RCS Priority"
            value={
              item.rcsPriority ??
              "-"
            }
          />


          <DraftInfo
            label="Scheduled Send"
            value={
              formatDateTime(
                item.scheduledSendAt
              )
            }
            wide
          />


          <DraftInfo
            label="Send Status"
            value={
              item.sendStatus ||
              "NOT_SENT"
            }
          />

        </div>


        {/* ROUTE */}

        <div className="draft-route-preview">

          <div>

            <span>
              SOURCE
            </span>


            <strong>
              {
                item.sourceRcsPointCode ||
                "Missing RCS Point"
              }
            </strong>


            <small>
              {
                item.sourceRcsTargetType ||
                "SITE"
              }

              {item.sourceRcsMapCode
                ? ` · Map ${item.sourceRcsMapCode}`
                : ""}
            </small>

          </div>


          <Route
            size={20}
          />


          <div>

            <span>
              DESTINATION
            </span>


            <strong>
              {
                item.destinationRcsPointCode ||
                "Missing RCS Point"
              }
            </strong>


            <small>
              {
                item.destinationRcsTargetType ||
                "SITE"
              }

              {item.destinationRcsMapCode
                ? ` · Map ${item.destinationRcsMapCode}`
                : ""}
            </small>

          </div>

        </div>


        {/* WARNING */}

        <div className="draft-notice">

          <AlertTriangle
            size={15}
          />


          <span>
            This is an internal WMS command draft.
            It is not yet the confirmed HIK
            GenerateTaskOrder request body.
          </span>

        </div>


        {/* JSON */}

        <div className="draft-json-section">

          <div className="draft-json-header">

            <span>
              JSON Preview
            </span>


            <button
              type="button"
              onClick={
                handleCopy
              }
            >
              <Copy
                size={14}
              />

              {copied
                ? "Copied"
                : "Copy JSON"}
            </button>

          </div>


          <pre>
            <code>
              {jsonText}
            </code>
          </pre>

        </div>


        {/* FOOTER */}

        <div className="draft-modal-footer">

          <button
            type="button"
            className="draft-close-button"
            onClick={
              onClose
            }
          >
            Close
          </button>

        </div>

      </div>

    </div>
  );
}

/* =========================================================
   QUEUE HISTORY MODAL
========================================================= */

function QueueHistoryModal({
  item,
  onClose,
}) {
  const history =
    Array.isArray(
      item.history
    )
      ? [...item.history]
      : [];


  /*
   * ล่าสุดอยู่ด้านบน
   */

  history.sort(
    (a, b) =>
      getTime(
        b.at
      ) -
      getTime(
        a.at
      )
  );


  return (
    <div
      className="history-modal-backdrop"

      onMouseDown={(
        event
      ) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          onClose();
        }
      }}
    >

      <div className="history-modal">

        {/* HEADER */}

        <div className="history-modal-header">

          <div>

            <span>
              RCS DISPATCH QUEUE
            </span>


            <h3>
              Queue History
            </h3>


            <p>
              {
                item.id
              }

              {" · "}

              {
                item.warehouseTaskId
              }
            </p>

          </div>


          <button
            type="button"
            onClick={
              onClose
            }
          >
            <X
              size={18}
            />
          </button>

        </div>


        {/* CURRENT STATE */}

        <div className="history-current-state">

          <div>

            <span>
              Current State
            </span>


            <strong>
              {
                item.queueState ||
                item.lastQueueState ||
                "-"
              }
            </strong>

          </div>


          <div>

            <span>
              Priority
            </span>


            <strong>
              {
                item.wmsPriority
              }

              {" / RCS "}

              {
                item.rcsPriority
              }
            </strong>

          </div>


          <div>

            <span>
              Scheduled Send
            </span>


            <strong>
              {
                formatDateTime(
                  item.scheduledSendAt
                )
              }
            </strong>

          </div>

        </div>


        {/* TIMELINE */}

        <div className="history-timeline">

          {history.map(
            (
              event,
              index
            ) => (
              <div
                className="history-event"
                key={
                  event.id ||
                  `${event.at}-${index}`
                }
              >

                <div className="history-event-marker">

                  <span />

                </div>


                <div className="history-event-content">

                  <div className="history-event-top">

                    <strong>
                      {
                        formatHistoryType(
                          event.type
                        )
                      }
                    </strong>


                    <time>
                      {
                        formatDateTime(
                          event.at
                        )
                      }
                    </time>

                  </div>


                  <p>
                    {
                      event.message
                    }
                  </p>


                  {event.details && (
                    <details>

                      <summary>
                        Details
                      </summary>


                      <pre>
                        {JSON.stringify(
                          event.details,
                          null,
                          2
                        )}
                      </pre>

                    </details>
                  )}

                </div>

              </div>
            )
          )}


          {history.length ===
            0 && (
            <div className="history-empty">

              <History
                size={26}
              />


              <strong>
                No History Yet
              </strong>


              <span>
                New queue events will appear here.
              </span>

            </div>
          )}

        </div>


        {/* FOOTER */}

        <div className="history-modal-footer">

          <button
            type="button"
            onClick={
              onClose
            }
          >
            Close
          </button>

        </div>

      </div>

    </div>
  );
}


/* =========================================================
   FORMAT HISTORY TYPE
========================================================= */

function formatHistoryType(
  value
) {
  return String(
    value ||
    "EVENT"
  )
    .replaceAll(
      "_",
      " "
    )
    .toLowerCase()
    .replace(
      /\b\w/g,
      (
        character
      ) =>
        character.toUpperCase()
    );
}


/* =========================================================
   DRAFT INFO
========================================================= */

function DraftInfo({
  label,
  value,
  wide = false,
}) {
  return (
    <div
      className={`draft-info-item ${
        wide
          ? "wide"
          : ""
      }`}
    >

      <span>
        {label}
      </span>


      <strong>
        {value}
      </strong>

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

    SENDING:
      "SENDING",

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
   RCS STATUS BADGE
========================================================= */

function RcsStatusBadge({
  status,
  taskChainCode,
}) {
  const normalized =
    String(
      status ||
      "NOT_SENT"
    ).toUpperCase();


  return (
    <div className="rcs-status-wrap">

      <span
        className={`rcs-status rcs-status-${normalized
          .toLowerCase()
          .replaceAll(
            "_",
            "-"
          )}`}
      >
        {
          normalized.replaceAll(
            "_",
            " "
          )
        }
      </span>


      {taskChainCode && (
        <small
          title={
            taskChainCode
          }
        >
          {
            taskChainCode
          }
        </small>
      )}

    </div>
  );
}

/* =========================================================
   MAPPING READINESS
========================================================= */

function MappingReadiness({
  candidate,
}) {
  /*
   * Task เข้า Queue แล้ว
   */

  if (
    candidate.existingQueueItem
  ) {
    return (
      <div className="mapping-readiness">

        <span className="readiness queued">

          <CheckCircle2
            size={13}
          />

          Already Queued

        </span>

      </div>
    );
  }


  const errors =
    candidate.readiness
      ?.errors ||
    [];


  const warnings =
    candidate.readiness
      ?.warnings ||
    [];


  /*
   * =====================================================
   * ERROR
   * =====================================================
   */

  if (
    errors.length >
    0
  ) {
    return (
      <div className="mapping-readiness">

        <span className="readiness not-ready">

          <AlertTriangle
            size={13}
          />

          Not Ready

        </span>


        <div className="mapping-message-list error">

          {errors.map(
            (
              message,
              index
            ) => (
              <small
                key={`${message}-${index}`}
              >
                • {message}
              </small>
            )
          )}

        </div>

      </div>
    );
  }


  /*
   * =====================================================
   * WARNING
   * =====================================================
   */

  if (
    warnings.length >
    0
  ) {
    return (
      <div className="mapping-readiness">

        <span className="readiness warning">

          <AlertTriangle
            size={13}
          />

          Ready with Warning

        </span>


        <div className="mapping-message-list warning">

          {warnings.map(
            (
              message,
              index
            ) => (
              <small
                key={`${message}-${index}`}
              >
                • {message}
              </small>
            )
          )}

        </div>

      </div>
    );
  }


  /*
   * =====================================================
   * READY
   * =====================================================
   */

  return (
    <div className="mapping-readiness">

      <span className="readiness ready">

        <CheckCircle2
          size={13}
        />

        Ready

      </span>


      <small className="mapping-all-good">
        RCS mapping complete
      </small>

    </div>
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
   RCS ENDPOINT VALIDATION
========================================================= */

function getEndpointReadiness(
  endpoints
) {
  const errors = [];
  const warnings = [];

  /*
   * =====================================================
   * SOURCE WMS LOCATION
   * =====================================================
   */

  if (
    !endpoints.sourceLocationId
  ) {
    errors.push(
      "Source WMS location missing"
    );
  }


  /*
   * =====================================================
   * DESTINATION WMS LOCATION
   * =====================================================
   */

  if (
    !endpoints.destinationLocationId
  ) {
    errors.push(
      "Destination WMS location missing"
    );
  }


  /*
   * =====================================================
   * SOURCE HIK RCS POINT
   * =====================================================
   */

  if (
    !String(
      endpoints.sourceRcsPointCode ||
      ""
    ).trim()
  ) {
    errors.push(
      "Source HIK RCS point missing"
    );
  }


  /*
   * =====================================================
   * DESTINATION HIK RCS POINT
   * =====================================================
   */

  if (
    !String(
      endpoints.destinationRcsPointCode ||
      ""
    ).trim()
  ) {
    errors.push(
      "Destination HIK RCS point missing"
    );
  }


  /*
   * =====================================================
   * TARGET TYPES
   *
   * ตอนนี้ WMS รองรับเฉพาะ:
   *
   * SITE
   * STORAGE
   * =====================================================
   */

  const sourceType =
    String(
      endpoints.sourceRcsTargetType ||
      "SITE"
    ).toUpperCase();


  const destinationType =
    String(
      endpoints.destinationRcsTargetType ||
      "SITE"
    ).toUpperCase();


  const supportedTypes = [
    "SITE",
    "STORAGE",
  ];


  if (
    !supportedTypes.includes(
      sourceType
    )
  ) {
    errors.push(
      `Unsupported source RCS target type: ${sourceType}`
    );
  }


  if (
    !supportedTypes.includes(
      destinationType
    )
  ) {
    errors.push(
      `Unsupported destination RCS target type: ${destinationType}`
    );
  }


  /*
   * =====================================================
   * WMS MAP NODE
   *
   * ไม่ block
   *
   * เพราะการส่ง RCS ใช้ RCS Point
   * ไม่ใช่ WMS Node โดยตรง
   * =====================================================
   */

  if (
    !String(
      endpoints.sourceNodeId ||
      ""
    ).trim()
  ) {
    warnings.push(
      "Source WMS map node missing"
    );
  }


  if (
    !String(
      endpoints.destinationNodeId ||
      ""
    ).trim()
  ) {
    warnings.push(
      "Destination WMS map node missing"
    );
  }


  /*
   * =====================================================
   * RCS MAP CODE
   *
   * ตอนนี้ยังไม่บังคับ
   *
   * เพราะ exact GenerateTaskOrder
   * request ยังไม่ยืนยัน
   * =====================================================
   */

  if (
    !String(
      endpoints.sourceRcsMapCode ||
      ""
    ).trim()
  ) {
    warnings.push(
      "Source RCS Map Code not set"
    );
  }


  if (
    !String(
      endpoints.destinationRcsMapCode ||
      ""
    ).trim()
  ) {
    warnings.push(
      "Destination RCS Map Code not set"
    );
  }


  /*
   * =====================================================
   * SAME POINT
   *
   * ไม่ block
   *
   * แค่เตือน เพราะบาง Process
   * อาจมี use case พิเศษ
   * =====================================================
   */

  if (
    endpoints.sourceRcsPointCode &&
    endpoints.destinationRcsPointCode &&
    String(
      endpoints.sourceRcsPointCode
    ).trim() ===
      String(
        endpoints.destinationRcsPointCode
      ).trim()
  ) {
    warnings.push(
      "Source and destination use the same RCS point"
    );
  }


  /*
   * =====================================================
   * CROSS MAP
   *
   * HIK รองรับ cross-map process ได้
   *
   * เพราะฉะนั้นไม่ถือเป็น error
   * =====================================================
   */

  if (
    endpoints.sourceRcsMapCode &&
    endpoints.destinationRcsMapCode &&
    String(
      endpoints.sourceRcsMapCode
    ).trim() !==
      String(
        endpoints.destinationRcsMapCode
      ).trim()
  ) {
    warnings.push(
      "Source and destination are on different RCS maps"
    );
  }


  /*
   * =====================================================
   * FINAL RESULT
   * =====================================================
   */

  return {
    ok:
      errors.length ===
      0,

    errors,

    warnings,

    message:
      errors[0] ||
      (
        warnings.length > 0
          ? "Ready with warning"
          : "Ready"
      ),
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

    rcsStartedAt:
      "",

    rcsCompletedAt:
      "",

    warehouseTaskSyncedAt:
      "",

    warehouseTaskSyncStatus:
      "NOT_SYNCED",


    /*
    * Queue state ล่าสุด
    *
    * จะถูก update โดย state watcher
    */

    lastQueueState:
      "",


    /*
    * Event History
    */

    history: [
      createHistoryEvent({
        type:
          "QUEUED",

        message:
          "Warehouse Task added to RCS Dispatch Queue.",

        at:
          createdAt,
      }),
    ],


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
      String(
        item.sendStatus ||
          (item.status === "SENT"
            ? "SENT"
            : "NOT_SENT")
      ).toUpperCase(),

    rcsTaskChainCode:
      String(
        item.rcsTaskChainCode ||
        ""
      ),

    rcsStatus:
      String(
        item.rcsStatus ||
        "NOT_SENT"
      ).toUpperCase(),

    sendStartedAt:
      item.sendStartedAt ||
      "",

    sentAt:
      item.sentAt ||
      "",

    rcsCreatedAt:
      item.rcsCreatedAt ||
      "",

    rcsStartedAt:
      item.rcsStartedAt ||
      "",

    rcsCompletedAt:
      item.rcsCompletedAt ||
      "",

    warehouseTaskSyncedAt:
      item.warehouseTaskSyncedAt ||
      "",

    warehouseTaskSyncStatus:
      String(
        item.warehouseTaskSyncStatus ||
        "NOT_SYNCED"
      ).toUpperCase(),

    priorityUpdatedAt:
      item.priorityUpdatedAt ||
      "",

    scheduleUpdatedAt:
      item.scheduleUpdatedAt ||
      "",

    lastQueueState:
      String(
        item.lastQueueState ||
        ""
      ),

    history:
      Array.isArray(
        item.history
      )
        ? item.history
        : [],

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
   * =====================================================
   * SENDING
   * =====================================================
   */

  if (
    item.sendStatus ===
    "SENDING"
  ) {
    return "SENDING";
  }


  /*
   * =====================================================
   * SENT
   * =====================================================
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


    /*
     * WMS Map Node
     */

    sourceNodeId:
      item.sourceNodeId,

    destinationNodeId:
      item.destinationNodeId,


    /*
     * RCS Point
     */

    sourceRcsPointCode:
      endpoints.sourceRcsPointCode,

    destinationRcsPointCode:
      endpoints.destinationRcsPointCode,


    /*
     * RCS Map
     */

    sourceRcsMapCode:
      endpoints.sourceRcsMapCode,

    destinationRcsMapCode:
      endpoints.destinationRcsMapCode,


    /*
     * RCS Target Type
     */

    sourceRcsTargetType:
      endpoints.sourceRcsTargetType,

    destinationRcsTargetType:
      endpoints.destinationRcsTargetType,
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
    SENDING: 1,
    WAITING_TIME: 2,
    MAPPING_REQUIRED: 3,
    SENT: 4,
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
   QUEUE LOCK
========================================================= */

function isQueueLocked(
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


/* =========================================================
   SIMULATED RCS TASK CHAIN
========================================================= */

function createSimulatedRcsTaskChainCode(
  item
) {
  const taskPart =
    String(
      item.warehouseTaskId ||
      "TASK"
    )
      .replace(
        /[^A-Za-z0-9]/g,
        ""
      )
      .toUpperCase();


  const timePart =
    Date.now()
      .toString()
      .slice(-6);


  return `SIM-RCS-${taskPart}-${timePart}`;
}

/* =========================================================
   HISTORY
========================================================= */

function createHistoryEvent({
  type,
  message,
  at,
  details = null,
}) {
  const timestamp =
    at ||
    new Date().toISOString();


  return {
    id:
      `EVT-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`,

    type,

    message,

    at:
      timestamp,

    details,
  };
}


function appendHistory(
  history,
  event
) {
  const current =
    Array.isArray(
      history
    )
      ? history
      : [];


  return [
    ...current,
    event,
  ];
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
   DATETIME LOCAL INPUT
========================================================= */

function formatDateTimeLocalInput(
  value
) {
  if (!value) {
    return "";
  }


  const date =
    new Date(value);


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }


  /*
   * datetime-local ต้องการรูปแบบ:
   *
   * YYYY-MM-DDTHH:mm
   *
   * และต้องใช้เวลาท้องถิ่น
   * ไม่ใช่ UTC
   */

  const pad = (
    number
  ) =>
    String(
      number
    ).padStart(
      2,
      "0"
    );


  return [
    date.getFullYear(),

    "-",

    pad(
      date.getMonth() +
        1
    ),

    "-",

    pad(
      date.getDate()
    ),

    "T",

    pad(
      date.getHours()
    ),

    ":",

    pad(
      date.getMinutes()
    ),
  ].join("");
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