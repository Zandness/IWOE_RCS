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
  useRef,
  useState,
} from "react";

import {
  loadTasks,
  notifyWmsDataChanged,
  saveTasks,
  syncTaskStatusToOperations,
} from "../utils/taskOperationSync";

import {
  createRcsBridgeTask,
  getRcsBridgeStatus,
  getRcsBridgeTask,
} from "../services/rcs";

import "../styles/RobotTaskDispatcher.css";


const WAREHOUSE_TASK_KEY =
  "wms-warehouse-tasks-v1";

const LOCATION_STORAGE_KEY =
  "wms-storage-locations-v1";

const RCS_QUEUE_KEY =
  "wms-robot-tasks-v1";


const PRIORITY_ORDER = {
  URGENT: 0,
  HIGH: 1,
  NORMAL: 2,
  LOW: 3,
};


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


  const [
    scheduleDrafts,
    setScheduleDrafts,
  ] = useState({});


  const [
    gatewayLastOctet,
    setGatewayLastOctet,
  ] = useState("");


  const [
    copyMessage,
    setCopyMessage,
  ] = useState("");


  const [
    selectedDraft,
    setSelectedDraft,
  ] = useState(null);


  const [
    selectedHistoryItem,
    setSelectedHistoryItem,
  ] = useState(null);


  /* =====================================================
     QUEUE VIEW ORDER
  ===================================================== */

  const [
    queueViewOrder,
    setQueueViewOrder,
  ] = useState(
    "OLDEST"
  );


  /* =====================================================
     RCS BRIDGE CONNECTION
  ===================================================== */

  const [
    bridgeConnection,
    setBridgeConnection,
  ] = useState(() => ({
    online: false,
    checking: true,
    mode: "",
    database: "",
    taskCount: 0,
    activeTaskCount: 0,
    hikConfigured: false,
    lastCheckedAt: "",
    error: "",
  }));


  /* =====================================================
     LIVE CLOCK

     IMPORTANT:
     now ถูกประกาศแค่ครั้งเดียว
  ===================================================== */

  const [
    now,
    setNow,
  ] = useState(
    () => Date.now()
  );


  const rcsPollInFlightRef =
    useRef(
      new Set()
    );


  const bridgeStatusPollInFlightRef =
    useRef(
      false
    );


  /* =====================================================
     LIVE CLOCK
  ===================================================== */

  useEffect(() => {

    const timer =
      window.setInterval(
        () => {
          setNow(
            Date.now()
          );
        },
        1000
      );


    return () => {
      window.clearInterval(
        timer
      );
    };

  }, []);


  /* =====================================================
     RCS BRIDGE CONNECTION STATUS
  ===================================================== */

  async function refreshBridgeStatus() {

    if (
      bridgeStatusPollInFlightRef
        .current
    ) {
      return;
    }


    bridgeStatusPollInFlightRef
      .current =
      true;


    setBridgeConnection(
      (current) => ({
        ...current,
        checking: true,
      })
    );


    try {

      const response =
        await getRcsBridgeStatus();


      setBridgeConnection({
        online:
          Boolean(
            response?.ok
          ),

        checking:
          false,

        mode:
          String(
            response?.bridgeMode ||
            ""
          ).toUpperCase(),

        database:
          String(
            response?.database ||
            ""
          ),

        taskCount:
          Number(
            response?.taskCount ||
            0
          ),

        activeTaskCount:
          Number(
            response?.activeTaskCount ||
            0
          ),

        hikConfigured:
          Boolean(
            response?.hikConfigured
          ),

        lastCheckedAt:
          new Date()
            .toISOString(),

        error:
          "",
      });

    } catch (error) {

      setBridgeConnection(
        (current) => ({
          ...current,

          online:
            false,

          checking:
            false,

          lastCheckedAt:
            new Date()
              .toISOString(),

          error:
            error?.message ||
            "WMS RCS Bridge backend is unavailable.",
        })
      );

    } finally {

      bridgeStatusPollInFlightRef
        .current =
        false;

    }

  }


  useEffect(() => {

    refreshBridgeStatus();


    const bridgeStatusTimer =
      window.setInterval(
        refreshBridgeStatus,
        3000
      );


    return () => {

      window.clearInterval(
        bridgeStatusTimer
      );

    };

  }, []);


  /* =====================================================
     SAVE DISPATCH QUEUE
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

  }, [
    dispatchQueue,
  ]);


  /* =====================================================
     BACKEND RCS BRIDGE POLLING
  ===================================================== */

  useEffect(() => {

    let cancelled =
      false;


    async function pollActiveBridgeTasks() {

      const latestQueue =
        loadDispatchQueue();


      const activeItems =
        latestQueue.filter(
          (entry) =>
            entry.sendStatus ===
              "SENT" &&
            Boolean(
              entry.bridgeTaskId
            ) &&
            String(
              entry.rcsStatus ||
              "NOT_SENT"
            ).toUpperCase() !==
              "COMPLETED"
        );


      for (
        const entry
        of activeItems
      ) {

        if (
          rcsPollInFlightRef
            .current
            .has(
              entry.id
            )
        ) {
          continue;
        }


        rcsPollInFlightRef
          .current
          .add(
            entry.id
          );


        try {

          const response =
            await getRcsBridgeTask(
              entry.bridgeTaskId
            );


          if (
            !cancelled
          ) {

            applyRcsBridgeSnapshot(
              entry,
              response
            );

          }

        } catch (error) {

          if (
            !cancelled
          ) {

            markRcsBridgePollError(
              entry.id,
              error
            );

          }

        } finally {

          rcsPollInFlightRef
            .current
            .delete(
              entry.id
            );

        }

      }

    }


    pollActiveBridgeTasks();


    const pollTimer =
      window.setInterval(
        pollActiveBridgeTasks,
        1000
      );


    return () => {

      cancelled =
        true;


      window.clearInterval(
        pollTimer
      );


      rcsPollInFlightRef
        .current
        .clear();

    };

  }, []);


  /* =====================================================
     REFRESH DATA
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


  /* =====================================================
     DATA EVENTS
  ===================================================== */

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
     LOCATION MAP
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
      [
        locations,
      ]
    );


  const receivingLocation =
    useMemo(
      () =>
        findOperationalLocation(
          locations,
          "RECEIVING"
        ),
      [
        locations,
      ]
    );


  const shippingLocation =
    useMemo(
      () =>
        findOperationalLocation(
          locations,
          "SHIPPING"
        ),
      [
        locations,
      ]
    );


  /* =====================================================
     WAREHOUSE TASK CANDIDATES
  ===================================================== */

  const candidates =
    useMemo(() => {

      return warehouseTasks

        .filter(
          (task) =>
            task.status ===
            "PENDING"
        )

        .map(
          (task) => {

            const endpoints =
              resolveTaskEndpoints({
                task,
                locationMap,
                receivingLocation,
                shippingLocation,
              });


            const existingQueueItem =
              dispatchQueue.find(
                (item) =>
                  item.warehouseTaskId ===
                  task.id
              );


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

     นี่คือลำดับสำหรับ dispatch จริง
  ===================================================== */

  const queueRows =
    useMemo(() => {

      const enriched =
        dispatchQueue.map(
          (item) => {

            const endpoints =
              enrichQueuedEndpoints(
                item,
                locationMap
              );


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


  /* =====================================================
     TABLE VIEW ORDER

     เปลี่ยนเฉพาะลำดับที่เห็นบนหน้าจอ
  ===================================================== */

  const displayQueueRows =
    useMemo(
      () => {

        const rows =
          [
            ...queueRows,
          ];


        rows.sort(
          (
            a,
            b
          ) => {

            const timeA =
              getTime(
                a.createdAt
              );


            const timeB =
              getTime(
                b.createdAt
              );


            /* -------------------------------------------
               OLDEST → NEWEST
            ------------------------------------------- */

            if (
              queueViewOrder ===
              "OLDEST"
            ) {

              if (
                timeA !==
                timeB
              ) {

                return (
                  timeA -
                  timeB
                );

              }


              return (
                getQueueNumber(
                  a.id
                )
                -
                getQueueNumber(
                  b.id
                )
              );

            }


            /* -------------------------------------------
               NEWEST → OLDEST
            ------------------------------------------- */

            if (
              timeA !==
              timeB
            ) {

              return (
                timeB -
                timeA
              );

            }


            return (
              getQueueNumber(
                b.id
              )
              -
              getQueueNumber(
                a.id
              )
            );

          }
        );


        return rows;

      },

      [
        queueRows,
        queueViewOrder,
      ]
    );


  /* =====================================================
     READY QUEUE

     ใช้ queueRows ไม่ใช่ displayQueueRows
  ===================================================== */

  const readyQueue =
    useMemo(
      () =>
        queueRows.filter(
          (item) =>
            item.queueState ===
            "READY"
        ),
      [
        queueRows,
      ]
    );


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
      [
        readyQueue,
      ]
    );


  /* =====================================================
     QUEUE STATE HISTORY
  ===================================================== */

  useEffect(() => {

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


              if (
                !row
              ) {

                return item;

              }


              const nextState =
                row.queueState;


              const previousState =
                item.lastQueueState ||
                "";


              if (
                previousState ===
                nextState
              ) {

                return item;

              }


              changed =
                true;


              const eventTime =
                new Date()
                  .toISOString();


              const message =
                !previousState
                  ? `Initial Queue State: ${nextState}.`
                  : `Queue State changed from ${previousState} to ${nextState}.`;


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

  }, [
    queueRows,
  ]);


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


    const scheduleValue =
      scheduleDrafts[
        candidate.task.id
      ] ||
      "";


    const scheduledSendAt =
      parseScheduleInput(
        scheduleValue
      );


    setDispatchQueue(
      (current) => {

        const exists =
          current.some(
            (item) =>
              item.warehouseTaskId ===
              candidate.task.id
          );


        if (
          exists
        ) {

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
     UPDATE PRIORITY
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
      RCS_PRIORITY[
        normalized
      ] ||
      60;


    const nowIso =
      new Date()
        .toISOString();


    setDispatchQueue(
      (current) =>
        current.map(
          (item) => {

            if (
              item.id !==
                itemId ||
              isQueueLocked(
                item
              )
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
              oldPriority ===
                normalized &&
              oldRcsPriority ===
                rcsPriority
            ) {

              return item;

            }


            return {
              ...item,

              wmsPriority:
                normalized,

              rcsPriority,

              priorityUpdatedAt:
                nowIso,

              history:
                appendHistory(
                  item.history,

                  createHistoryEvent({
                    type:
                      "PRIORITY_UPDATED",

                    message:
                      `Priority changed from ${oldPriority} (RCS ${oldRcsPriority}) to ${normalized} (RCS ${rcsPriority}).`,

                    at:
                      nowIso,

                    details: {
                      fromPriority:
                        oldPriority,

                      toPriority:
                        normalized,

                      fromRcsPriority:
                        oldRcsPriority,

                      toRcsPriority:
                        rcsPriority,
                    },
                  })
                ),
            };

          }
        )
    );

  }


  /* =====================================================
     UPDATE SCHEDULE
  ===================================================== */

  function updateQueueSchedule(
    itemId,
    value
  ) {

    let scheduledSendAt;


    if (
      !value
    ) {

      scheduledSendAt =
        new Date()
          .toISOString();

    } else {

      const selectedDate =
        new Date(
          value
        );


      if (
        Number.isNaN(
          selectedDate.getTime()
        )
      ) {

        return;

      }


      scheduledSendAt =
        selectedDate
          .toISOString();

    }


    const nowIso =
      new Date()
        .toISOString();


    setDispatchQueue(
      (current) =>
        current.map(
          (item) => {

            if (
              item.id !==
                itemId ||
              isQueueLocked(
                item
              )
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

              scheduleUpdatedAt:
                nowIso,

              history:
                appendHistory(
                  item.history,

                  createHistoryEvent({
                    type:
                      "SCHEDULE_UPDATED",

                    message:
                      `Scheduled Send changed from ${formatDateTime(
                        oldSchedule
                      )} to ${formatDateTime(
                        scheduledSendAt
                      )}.`,

                    at:
                      nowIso,

                    details: {
                      from:
                        oldSchedule ||
                        null,

                      to:
                        scheduledSendAt,
                    },
                  })
                ),
            };

          }
        )
    );

  }


  /* =====================================================
     SCHEDULE NOW
  ===================================================== */

  function setQueueScheduleNow(
    itemId
  ) {

    const currentTime =
      new Date()
        .toISOString();


    setDispatchQueue(
      (current) =>
        current.map(
          (item) => {

            if (
              item.id !==
                itemId ||
              isQueueLocked(
                item
              )
            ) {

              return item;

            }


            return {
              ...item,

              scheduledSendAt:
                currentTime,

              scheduleUpdatedAt:
                currentTime,

              history:
                appendHistory(
                  item.history,

                  createHistoryEvent({
                    type:
                      "SCHEDULE_NOW",

                    message:
                      "Scheduled Send changed to current time.",

                    at:
                      currentTime,

                    details: {
                      from:
                        item.scheduledSendAt ||
                        null,

                      to:
                        currentTime,
                    },
                  })
                ),
            };

          }
        )
    );

  }


  /* =====================================================
     RCS -> WAREHOUSE TASK
  ===================================================== */

  function syncWarehouseTaskFromRcs({
    warehouseTaskId,
    nextStatus,
    at = new Date().toISOString(),
  }) {

    const latestTasks =
      loadTasks();


    const currentTask =
      latestTasks.find(
        (task) =>
          task.id ===
          warehouseTaskId
      );


    if (
      !currentTask
    ) {

      return {
        ok:
          false,

        message:
          `Warehouse Task ${warehouseTaskId} was not found.`,
      };

    }


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
        ok:
          true,

        skipped:
          true,

        task:
          currentTask,
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


    const operationResult =
      syncTaskStatusToOperations({
        changedTask,

        allTasks:
          nextTasks,

        nextStatus,

        now:
          at,
      });


    if (
      !operationResult.ok
    ) {

      return {
        ok:
          false,

        message:
          operationResult.message ||
          "Could not synchronize the Warehouse Operation.",
      };

    }


    const saveResult =
      saveTasks(
        nextTasks
      );


    if (
      !saveResult.ok
    ) {

      return {
        ok:
          false,

        message:
          saveResult.message ||
          "Could not save Warehouse Tasks.",
      };

    }


    setWarehouseTasks(
      nextTasks
    );


    notifyWmsDataChanged([
      WAREHOUSE_TASK_KEY,
    ]);


    return {
      ok:
        true,

      task:
        changedTask,
    };

  }


  /* =====================================================
     APPLY BRIDGE SNAPSHOT
  ===================================================== */

  function applyRcsBridgeSnapshot(
    queueItem,
    response
  ) {

    const backendTask =
      response?.task ||
      null;


    if (
      !backendTask
    ) {

      markRcsBridgePollError(
        queueItem.id,

        new Error(
          "RCS Bridge returned no task data."
        )
      );


      return;

    }


    const backendStatus =
      String(
        backendTask.rcsStatus ||
        "CREATED"
      ).toUpperCase();


    if (
      ![
        "CREATED",
        "RUNNING",
        "COMPLETED",
      ].includes(
        backendStatus
      )
    ) {

      markRcsBridgePollError(
        queueItem.id,

        new Error(
          `Unsupported RCS status from bridge: ${backendStatus}`
        )
      );


      return;

    }


    const currentStatus =
      String(
        queueItem.rcsStatus ||
        "CREATED"
      ).toUpperCase();


    const nowIso =
      new Date()
        .toISOString();


    const runningAt =
      backendTask.rcsStartedAt ||
      nowIso;


    const completedAt =
      backendTask.rcsCompletedAt ||
      nowIso;


    const transitionEvents =
      [];


    /* -----------------------------------------------
       CREATED → RUNNING
    ----------------------------------------------- */

    if (
      backendStatus ===
        "RUNNING" &&
      ![
        "RUNNING",
        "COMPLETED",
      ].includes(
        currentStatus
      )
    ) {

      const syncResult =
        syncWarehouseTaskFromRcs({
          warehouseTaskId:
            queueItem.warehouseTaskId,

          nextStatus:
            "IN_PROGRESS",

          at:
            runningAt,
        });


      transitionEvents.push({
        rcsStatus:
          "RUNNING",

        at:
          runningAt,

        syncResult,

        taskStatus:
          "IN_PROGRESS",
      });

    }


    /* -----------------------------------------------
       → COMPLETED
    ----------------------------------------------- */

    if (
      backendStatus ===
      "COMPLETED"
    ) {

      /*
       * ถ้าข้าม RUNNING
       * ให้ sync IN_PROGRESS ก่อน
       */

      if (
        ![
          "RUNNING",
          "COMPLETED",
        ].includes(
          currentStatus
        )
      ) {

        const runningSync =
          syncWarehouseTaskFromRcs({
            warehouseTaskId:
              queueItem.warehouseTaskId,

            nextStatus:
              "IN_PROGRESS",

            at:
              runningAt,
          });


        transitionEvents.push({
          rcsStatus:
            "RUNNING",

          at:
            runningAt,

          syncResult:
            runningSync,

          taskStatus:
            "IN_PROGRESS",
        });

      }


      if (
        currentStatus !==
        "COMPLETED"
      ) {

        const completedSync =
          syncWarehouseTaskFromRcs({
            warehouseTaskId:
              queueItem.warehouseTaskId,

            nextStatus:
              "COMPLETED",

            at:
              completedAt,
          });


        transitionEvents.push({
          rcsStatus:
            "COMPLETED",

          at:
            completedAt,

          syncResult:
            completedSync,

          taskStatus:
            "COMPLETED",
        });

      }

    }


    setDispatchQueue(
      (current) =>
        current.map(
          (entry) => {

            if (
              entry.id !==
              queueItem.id
            ) {

              return entry;

            }


            const entryCurrentStatus =
              String(
                entry.rcsStatus ||
                "CREATED"
              ).toUpperCase();


            let filteredTransitions =
              transitionEvents;


            if (
              entryCurrentStatus ===
              "RUNNING"
            ) {

              filteredTransitions =
                transitionEvents.filter(
                  (transition) =>
                    transition.rcsStatus !==
                    "RUNNING"
                );

            }


            if (
              entryCurrentStatus ===
              "COMPLETED"
            ) {

              filteredTransitions =
                [];

            }


            let nextHistory =
              entry.history;


            for (
              const transition
              of filteredTransitions
            ) {

              nextHistory =
                appendHistory(
                  nextHistory,

                  createHistoryEvent({
                    type:
                      transition.rcsStatus ===
                      "RUNNING"
                        ? "RCS_RUNNING"
                        : "RCS_COMPLETED",

                    message:
                      transition.rcsStatus ===
                      "RUNNING"
                        ? "RCS Bridge reports that the task is running."
                        : "RCS Bridge reports that the task is completed.",

                    at:
                      transition.at,

                    details: {
                      bridgeTaskId:
                        backendTask.bridgeTaskId ||
                        entry.bridgeTaskId,

                      taskChainCode:
                        backendTask.rcsTaskChainCode ||
                        entry.rcsTaskChainCode ||
                        null,

                      rcsStatus:
                        transition.rcsStatus,

                      mode:
                        response?.mode ||
                        entry.bridgeMode ||
                        "MOCK",
                    },
                  })
                );


              nextHistory =
                appendHistory(
                  nextHistory,

                  createHistoryEvent({
                    type:
                      transition
                        .syncResult
                        ?.ok
                        ? transition
                            .taskStatus ===
                          "IN_PROGRESS"
                          ? "WAREHOUSE_TASK_IN_PROGRESS"
                          : "WAREHOUSE_TASK_COMPLETED"
                        : "WAREHOUSE_TASK_SYNC_FAILED",

                    message:
                      transition
                        .syncResult
                        ?.ok
                        ? `Warehouse Task ${entry.warehouseTaskId} synchronized to ${transition.taskStatus}.`
                        : `Could not synchronize Warehouse Task ${entry.warehouseTaskId} to ${transition.taskStatus}: ${
                            transition
                              .syncResult
                              ?.message ||
                            "Unknown synchronization error."
                          }`,

                    at:
                      transition.at,

                    details: {
                      warehouseTaskId:
                        entry.warehouseTaskId,

                      warehouseTaskStatus:
                        transition
                          .syncResult
                          ?.ok
                          ? transition.taskStatus
                          : null,

                      syncOk:
                        Boolean(
                          transition
                            .syncResult
                            ?.ok
                        ),
                    },
                  })
                );

            }


            const lastTransition =
              filteredTransitions[
                filteredTransitions.length -
                  1
              ];


            const lastSync =
              lastTransition
                ?.syncResult;


            const lastTaskStatus =
              lastTransition
                ?.taskStatus;


            return {
              ...entry,

              bridgeTaskId:
                backendTask.bridgeTaskId ||
                entry.bridgeTaskId ||
                "",

              bridgeMode:
                response?.mode ||
                entry.bridgeMode ||
                "MOCK",

              bridgeElapsedSeconds:
                Number(
                  response
                    ?.elapsedSeconds ||
                  0
                ),

              bridgeLastPolledAt:
                nowIso,

              backendError:
                "",

              rcsStatus:
                backendStatus,

              rcsTaskChainCode:
                backendTask.rcsTaskChainCode ||
                entry.rcsTaskChainCode ||
                "",

              rcsCreatedAt:
                backendTask.rcsCreatedAt ||
                entry.rcsCreatedAt ||
                "",

              rcsStartedAt:
                backendTask.rcsStartedAt ||
                entry.rcsStartedAt ||
                "",

              rcsCompletedAt:
                backendTask.rcsCompletedAt ||
                entry.rcsCompletedAt ||
                "",

              warehouseTaskSyncedAt:
                lastSync?.ok
                  ? lastTransition?.at ||
                    nowIso
                  : entry.warehouseTaskSyncedAt ||
                    "",

              warehouseTaskSyncStatus:
                filteredTransitions.length >
                0
                  ? lastSync?.ok
                    ? lastTaskStatus
                    : "ERROR"
                  : entry.warehouseTaskSyncStatus ||
                    "NOT_SYNCED",

              history:
                nextHistory,
            };

          }
        )
    );

  }


  /* =====================================================
     BRIDGE POLL ERROR
  ===================================================== */

  function markRcsBridgePollError(
    itemId,
    error
  ) {

    const message =
      error?.message ||
      "Could not read RCS Bridge status.";


    const at =
      new Date()
        .toISOString();


    setDispatchQueue(
      (current) =>
        current.map(
          (entry) => {

            if (
              entry.id !==
              itemId
            ) {

              return entry;

            }


            if (
              entry.backendError ===
              message
            ) {

              return {
                ...entry,

                bridgeLastPolledAt:
                  at,
              };

            }


            return {
              ...entry,

              backendError:
                message,

              bridgeLastPolledAt:
                at,

              history:
                appendHistory(
                  entry.history,

                  createHistoryEvent({
                    type:
                      "BRIDGE_POLL_FAILED",

                    message:
                      `Could not read RCS Bridge status: ${message}`,

                    at,

                    details: {
                      bridgeTaskId:
                        entry.bridgeTaskId ||
                        null,
                    },
                  })
                ),
            };

          }
        )
    );

  }


  /* =====================================================
     SEND TO RCS BRIDGE
  ===================================================== */

  async function sendToRcsBridge(
    item
  ) {

    if (
      item.queueState !==
      "READY"
    ) {

      window.alert(
        "Only a READY task can be sent."
      );


      return;

    }


    if (
      !bridgeConnection.online
    ) {

      window.alert(
        "WMS RCS Bridge is offline. Start the FastAPI backend and wait for the status to become ONLINE before sending."
      );


      refreshBridgeStatus();


      return;

    }


    if (
      isQueueLocked(
        item
      )
    ) {

      return;

    }


    const startedAt =
      new Date()
        .toISOString();


    /* -----------------------------------------------
       READY → SENDING
    ----------------------------------------------- */

    setDispatchQueue(
      (current) =>
        current.map(
          (entry) =>
            entry.id ===
            item.id
              ? {
                  ...entry,

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

                  sendStatus:
                    "SENDING",

                  rcsStatus:
                    "NOT_SENT",

                  sendStartedAt:
                    startedAt,

                  backendError:
                    "",

                  history:
                    appendHistory(
                      entry.history,

                      createHistoryEvent({
                        type:
                          "BRIDGE_SEND_STARTED",

                        message:
                          "Sending command to the WMS RCS Bridge backend.",

                        at:
                          startedAt,

                        details: {
                          mode:
                            "BACKEND_BRIDGE",

                          warehouseTaskId:
                            entry.warehouseTaskId,

                          rcsPriority:
                            entry.rcsPriority,
                        },
                      })
                    ),
                }
              : entry
        )
    );


    try {

      /* ---------------------------------------------
         POST /api/rcs/tasks
      --------------------------------------------- */

      const response =
        await createRcsBridgeTask(
          buildBridgeCommand(
            item
          )
        );


      const acceptedAt =
        response?.receivedAt ||
        new Date()
          .toISOString();


      const acceptedStatus =
        String(
          response?.rcsStatus ||
          "CREATED"
        ).toUpperCase();


      setDispatchQueue(
        (current) =>
          current.map(
            (entry) => {

              if (
                entry.id !==
                item.id
              ) {

                return entry;

              }


              let nextHistory =
                appendHistory(
                  entry.history,

                  createHistoryEvent({
                    type:
                      "COMMAND_SENT",

                    message:
                      "Command was accepted by the WMS RCS Bridge backend.",

                    at:
                      acceptedAt,

                    details: {
                      mode:
                        response?.mode ||
                        "MOCK",

                      bridgeTaskId:
                        response?.bridgeTaskId ||
                        null,

                      command:
                        buildBridgeCommand(
                          entry
                        ),
                    },
                  })
                );


              if (
                acceptedStatus ===
                "CREATED"
              ) {

                nextHistory =
                  appendHistory(
                    nextHistory,

                    createHistoryEvent({
                      type:
                        "RCS_CREATED",

                      message:
                        `RCS Bridge created task ${
                          response?.rcsTaskChainCode ||
                          response?.bridgeTaskId ||
                          entry.warehouseTaskId
                        }.`,

                      at:
                        acceptedAt,

                      details: {
                        bridgeTaskId:
                          response?.bridgeTaskId ||
                          null,

                        taskChainCode:
                          response?.rcsTaskChainCode ||
                          null,

                        rcsStatus:
                          acceptedStatus,

                        mode:
                          response?.mode ||
                          "MOCK",
                      },
                    })
                  );

              }


              return {
                ...entry,

                sendStatus:
                  "SENT",

                sentAt:
                  acceptedAt,

                bridgeTaskId:
                  response?.bridgeTaskId ||
                  "",

                bridgeMode:
                  response?.mode ||
                  "MOCK",

                bridgeLastPolledAt:
                  acceptedAt,

                bridgeElapsedSeconds:
                  0,

                backendError:
                  "",

                rcsStatus:
                  acceptedStatus,

                rcsTaskChainCode:
                  response?.rcsTaskChainCode ||
                  "",

                rcsCreatedAt:
                  acceptedStatus ===
                  "CREATED"
                    ? acceptedAt
                    : entry.rcsCreatedAt ||
                      "",

                history:
                  nextHistory,
              };

            }
          )
      );

    } catch (error) {

      const failedAt =
        new Date()
          .toISOString();


      const message =
        error?.message ||
        "Could not send command to the WMS RCS Bridge.";


      setDispatchQueue(
        (current) =>
          current.map(
            (entry) =>
              entry.id ===
              item.id
                ? {
                    ...entry,

                    sendStatus:
                      "NOT_SENT",

                    rcsStatus:
                      "NOT_SENT",

                    sendStartedAt:
                      "",

                    backendError:
                      message,

                    history:
                      appendHistory(
                        entry.history,

                        createHistoryEvent({
                          type:
                            "BRIDGE_SEND_FAILED",

                          message:
                            `RCS Bridge send failed: ${message}`,

                          at:
                            failedAt,

                          details: {
                            mode:
                              "BACKEND_BRIDGE",
                          },
                        })
                      ),
                  }
                : entry
          )
      );


      window.alert(
        `Could not send to RCS Bridge.\n\n${message}`
      );

    }

  }


  /* =====================================================
     REMOVE QUEUE
  ===================================================== */

  function removeQueueItem(
    item
  ) {

    if (
      isQueueLocked(
        item
      )
    ) {

      window.alert(
        "A task that is sending or already sent cannot be removed."
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
     NETWORK ROUTE
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
      () => {
        setCopyMessage(
          ""
        );
      },
      2000
    );

  }


  /* =====================================================
     RENDER
  ===================================================== */

  return (

    <div className="dispatcher-page">

      {/* =================================================
          PAGE HEADER
      ================================================= */}

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


      {/* =================================================
          RCS BRIDGE CONNECTION
      ================================================= */}

      <BridgeConnectionStatus
        connection={
          bridgeConnection
        }
        onRefresh={
          refreshBridgeStatus
        }
      />


      {/* =================================================
          SUMMARY
      ================================================= */}

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
          NETWORK PREPARATION
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
                      event.target.value
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


          <div className="rcs-command-card">

            <span>
              Administrator CMD
            </span>


            <code>
              {
                routeCommand ||
                "Enter gateway last number first"
              }
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


            {
              copyMessage && (

                <small>
                  {
                    copyMessage
                  }
                </small>

              )
            }

          </div>


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

              {
                candidates.map(
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


                      <td>

                        <RouteCell
                          sourceLabel={
                            candidate
                              .endpoints
                              .sourceLabel
                          }
                          destinationLabel={
                            candidate
                              .endpoints
                              .destinationLabel
                          }
                          sourceCode={
                            candidate
                              .endpoints
                              .sourceNodeId
                          }
                          destinationCode={
                            candidate
                              .endpoints
                              .destinationNodeId
                          }
                          emptyText="WMS node missing"
                        />

                      </td>


                      <td>

                        <RouteCell
                          sourceLabel={
                            candidate
                              .endpoints
                              .sourceRcsTargetType
                          }
                          destinationLabel={
                            candidate
                              .endpoints
                              .destinationRcsTargetType
                          }
                          sourceCode={
                            candidate
                              .endpoints
                              .sourceRcsPointCode
                          }
                          destinationCode={
                            candidate
                              .endpoints
                              .destinationRcsPointCode
                          }
                          emptyText="RCS point missing"
                          rcs
                        />

                      </td>


                      <td>

                        <PriorityBadge
                          priority={
                            candidate
                              .task
                              .priority
                          }
                          rcsPriority={
                            RCS_PRIORITY[
                              candidate
                                .task
                                .priority
                            ] ||
                            60
                          }
                        />

                      </td>


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
                                  event.target.value,
                              })
                            )
                          }
                        />


                        <small className="schedule-help">
                          Empty = send when queue sender is available
                        </small>

                      </td>


                      <td>

                        <MappingReadiness
                          candidate={
                            candidate
                          }
                        />

                      </td>


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
                )
              }

            </tbody>

          </table>


          {
            candidates.length ===
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

            )
          }

        </div>

      </section>


      {/* =================================================
          SCHEDULED COMMAND QUEUE
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


          <div className="queue-header-tools">

            {/* -------------------------------------------
                VIEW ORDER
            ------------------------------------------- */}

            <div className="queue-view-order">

              <span>
                VIEW ORDER
              </span>


              <div className="queue-view-order-buttons">

                <button
                  type="button"
                  className={
                    queueViewOrder ===
                    "OLDEST"
                      ? "active"
                      : ""
                  }
                  onClick={() =>
                    setQueueViewOrder(
                      "OLDEST"
                    )
                  }
                >
                  Oldest
                  {" → "}
                  Newest
                </button>


                <button
                  type="button"
                  className={
                    queueViewOrder ===
                    "NEWEST"
                      ? "active"
                      : ""
                  }
                  onClick={() =>
                    setQueueViewOrder(
                      "NEWEST"
                    )
                  }
                >
                  Newest
                  {" → "}
                  Oldest
                </button>

              </div>

            </div>


            {/* -------------------------------------------
                LOCAL TIME
            ------------------------------------------- */}

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

        </div>


        <div className="dispatcher-api-warning">

          <AlertTriangle
            size={16}
          />


          <span>
            RCS Queue now sends through the WMS backend bridge.
            In MOCK mode the backend simulates CREATED → RUNNING → COMPLETED.
            Direct HIK sending remains disabled until the exact
            GenerateTaskOrder endpoint, authentication and payload are confirmed.
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

              {
                displayQueueRows.map(
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
                          {
                            item.queueState ===
                            "READY"
                              ? `Ready rank #${readyRankMap.get(
                                  item.id
                                )}`
                              : formatDateTime(
                                  item.createdAt
                                )
                          }
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


                          {
                            item.sourceOrderNo
                              ? ` · ${item.sourceOrderNo}`
                              : ""
                          }

                        </small>

                      </td>


                      {/* HIK ROUTE */}

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
                              isQueueLocked(
                                item
                              )
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
                            RCS{" "}
                            {
                              item.rcsPriority
                            }
                          </span>

                        </div>

                      </td>


                      {/* SCHEDULE */}

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
                              isQueueLocked(
                                item
                              )
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
                              isQueueLocked(
                                item
                              )
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
                            {
                              item.queueState ===
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
                                      : "Schedule saved"
                            }
                          </small>

                        </div>

                      </td>


                      {/* QUEUE STATE */}

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
                          bridgeTaskId={
                            item.bridgeTaskId
                          }
                          backendError={
                            item.backendError
                          }
                        />

                      </td>


                      {/* COMMAND */}

                      <td>

                        <div className="draft-action-buttons">

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


                      {/* HISTORY */}

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
                              item.history?.length ||
                              0
                            }
                          </span>

                        </button>

                      </td>


                      {/* SEND */}

                      <td>

                        <button
                          type="button"
                          className="simulate-send-button"
                          disabled={
                            item.queueState !==
                              "READY" ||
                            isQueueLocked(
                              item
                            ) ||
                            !bridgeConnection.online
                          }
                          title={
                            !bridgeConnection.online &&
                            !isQueueLocked(
                              item
                            )
                              ? "WMS RCS Bridge backend is offline."
                              : undefined
                          }
                          onClick={() =>
                            sendToRcsBridge(
                              item
                            )
                          }
                        >

                          <Play
                            size={14}
                          />


                          {
                            item.sendStatus ===
                            "SENDING"
                              ? "Sending..."
                              : item.sendStatus ===
                                  "SENT"
                                ? "Sent"
                                : bridgeConnection.checking &&
                                    !bridgeConnection.lastCheckedAt
                                  ? "Checking Bridge..."
                                  : !bridgeConnection.online
                                    ? "Bridge Offline"
                                    : "Send to Bridge"
                          }

                        </button>

                      </td>


                      {/* DELETE */}

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
                )
              }

            </tbody>

          </table>


          {
            displayQueueRows.length ===
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

            )
          }

        </div>

      </section>


      {/* =================================================
          COMMAND DRAFT MODAL
      ================================================= */}

      {
        selectedDraft && (

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

        )
      }


      {/* =================================================
          HISTORY MODAL
      ================================================= */}

      {
        selectedHistoryItem && (

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

        )
      }

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
  ] = useState(
    false
  );


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


    if (
      !success
    ) {

      return;

    }


    setCopied(
      true
    );


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

        if (
          event.target ===
          event.currentTarget
        ) {

          onClose();

        }

      }}
    >

      <div className="draft-modal">

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

              {
                item.sourceRcsMapCode
                  ? ` · Map ${item.sourceRcsMapCode}`
                  : ""
              }
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

              {
                item.destinationRcsMapCode
                  ? ` · Map ${item.destinationRcsMapCode}`
                  : ""
              }
            </small>

          </div>

        </div>


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


              {
                copied
                  ? "Copied"
                  : "Copy JSON"
              }

            </button>

          </div>


          <pre>
            <code>
              {
                jsonText
              }
            </code>
          </pre>

        </div>


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

  const [
    historyOrder,
    setHistoryOrder,
  ] = useState(
    "NEWEST"
  );


  const history =
    Array.isArray(
      item.history
    )
      ? [
          ...item.history,
        ]
      : [];


  history.sort(
    (
      a,
      b
    ) => {

      const timeA =
        getTime(
          a.at
        );


      const timeB =
        getTime(
          b.at
        );


      if (
        historyOrder ===
        "OLDEST"
      ) {

        return (
          timeA -
          timeB
        );

      }


      return (
        timeB -
        timeA
      );

    }
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


        {/* ===============================================
            HISTORY SORT
        =============================================== */}

        <div className="history-sort-bar">

          <div className="history-sort-info">

            <span>
              TIMELINE ORDER
            </span>


            <strong>
              {
                historyOrder ===
                "OLDEST"
                  ? "Oldest → Newest"
                  : "Newest → Oldest"
              }
            </strong>


            <small>
              {
                historyOrder ===
                "OLDEST"
                  ? "Showing the first event at the top."
                  : "Showing the latest event at the top."
              }
            </small>

          </div>


          <div className="history-sort-buttons">

            <button
              type="button"
              className={
                historyOrder ===
                "OLDEST"
                  ? "active"
                  : ""
              }
              onClick={() =>
                setHistoryOrder(
                  "OLDEST"
                )
              }
            >
              Oldest
              {" → "}
              Newest
            </button>


            <button
              type="button"
              className={
                historyOrder ===
                "NEWEST"
                  ? "active"
                  : ""
              }
              onClick={() =>
                setHistoryOrder(
                  "NEWEST"
                )
              }
            >
              Newest
              {" → "}
              Oldest
            </button>

          </div>

        </div>


        <div className="history-timeline">

          {
            history.map(
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


                    {
                      event.details && (

                        <details>

                          <summary>
                            Details
                          </summary>


                          <pre>
                            {
                              JSON.stringify(
                                event.details,
                                null,
                                2
                              )
                            }
                          </pre>

                        </details>

                      )
                    }

                  </div>

                </div>

              )
            )
          }


          {
            history.length ===
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

            )
          }

        </div>


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
        {
          label
        }
      </span>


      <strong>
        {
          value
        }
      </strong>

    </div>

  );

}


/* =========================================================
   BRIDGE CONNECTION STATUS
========================================================= */

function BridgeConnectionStatus({
  connection,
  onRefresh,
}) {

  const initialChecking =
    connection.checking &&
    !connection.lastCheckedAt;


  const statusLabel =
    initialChecking
      ? "CHECKING"
      : connection.online
        ? "ONLINE"
        : "OFFLINE";


  return (

    <section
      className={`bridge-connection-panel ${
        connection.online
          ? "online"
          : "offline"
      } ${
        initialChecking
          ? "checking"
          : ""
      }`}
    >

      <div className="bridge-connection-main">

        <span
          className="bridge-connection-dot"
          aria-hidden="true"
        />


        <div>

          <span>
            RCS BRIDGE
          </span>


          <strong>
            {
              statusLabel
            }
          </strong>


          <small>
            {
              connection.online
                ? "Frontend is connected to the WMS RCS Bridge backend."
                : initialChecking
                  ? "Checking backend connection..."
                  : connection.error ||
                    "Backend unavailable."
            }
          </small>

        </div>

      </div>


      <div className="bridge-connection-metrics">

        <BridgeMetric
          label="Mode"
          value={
            connection.mode ||
            "-"
          }
        />


        <BridgeMetric
          label="Database"
          value={
            connection.database ||
            "-"
          }
        />


        <BridgeMetric
          label="Tasks"
          value={
            connection.online
              ? connection.taskCount
              : "-"
          }
        />


        <BridgeMetric
          label="Active"
          value={
            connection.online
              ? connection.activeTaskCount
              : "-"
          }
        />


        <BridgeMetric
          label="HIK API"
          value={
            connection.hikConfigured
              ? "CONFIGURED"
              : "NOT CONFIGURED"
          }
        />

      </div>


      <div className="bridge-connection-actions">

        <small>
          Last checked
          {" "}
          {
            connection.lastCheckedAt
              ? formatDateTime(
                  connection.lastCheckedAt
                )
              : "-"
          }
        </small>


        <button
          type="button"
          onClick={
            onRefresh
          }
          disabled={
            connection.checking
          }
        >

          <RefreshCw
            size={14}
          />

          {
            connection.checking
              ? "Checking..."
              : "Check Bridge"
          }

        </button>

      </div>

    </section>

  );

}


function BridgeMetric({
  label,
  value,
}) {

  return (

    <div className="bridge-connection-metric">

      <span>
        {
          label
        }
      </span>


      <strong>
        {
          value
        }
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
        {
          icon
        }
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

      <div>

        <span>
          {
            sourceLabel ||
            "Source"
          }
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


          {
            sourceCode ||
            emptyText
          }

        </strong>

      </div>


      <Route
        size={14}
      />


      <div>

        <span>
          {
            destinationLabel ||
            "Destination"
          }
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


          {
            destinationCode ||
            emptyText
          }

        </strong>

      </div>

    </div>

  );

}


/* =========================================================
   PRIORITY BADGE
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
        RCS{" "}
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
   QUEUE STATE BADGE
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
        labels[
          state
        ] ||
        state
      }
    </span>

  );

}


/* =========================================================
   RCS STATUS
========================================================= */

function RcsStatusBadge({
  status,
  taskChainCode,
  bridgeTaskId,
  backendError,
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


      {
        taskChainCode && (

          <small
            title={
              taskChainCode
            }
          >
            {
              taskChainCode
            }
          </small>

        )
      }


      {
        bridgeTaskId && (

          <small
            title={
              bridgeTaskId
            }
          >
            Bridge{" "}
            {
              bridgeTaskId
            }
          </small>

        )
      }


      {
        backendError && (

          <small
            title={
              backendError
            }
          >
            Bridge error
          </small>

        )
      }

    </div>

  );

}


/* =========================================================
   MAPPING READINESS
========================================================= */

function MappingReadiness({
  candidate,
}) {

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

          {
            errors.map(
              (
                message,
                index
              ) => (

                <small
                  key={`${message}-${index}`}
                >
                  • {
                    message
                  }
                </small>

              )
            )
          }

        </div>

      </div>

    );

  }


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

          {
            warnings.map(
              (
                message,
                index
              ) => (

                <small
                  key={`${message}-${index}`}
                >
                  • {
                    message
                  }
                </small>

              )
            )
          }

        </div>

      </div>

    );

  }


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
   HISTORY TYPE FORMAT
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
   RESOLVE TASK ENDPOINTS
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

  } else {

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
   ENRICH QUEUED ENDPOINTS
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
   ENDPOINT READINESS
========================================================= */

function getEndpointReadiness(
  endpoints
) {

  const errors =
    [];


  const warnings =
    [];


  if (
    !endpoints.sourceLocationId
  ) {

    errors.push(
      "Source WMS location missing"
    );

  }


  if (
    !endpoints.destinationLocationId
  ) {

    errors.push(
      "Destination WMS location missing"
    );

  }


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


  const supportedTypes =
    [
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


  return {
    ok:
      errors.length ===
      0,

    errors,

    warnings,

    message:
      errors[0] ||
      (
        warnings.length >
        0
          ? "Ready with warning"
          : "Ready"
      ),
  };

}


/* =========================================================
   FIND OPERATION LOCATION
========================================================= */

function findOperationalLocation(
  locations,
  type
) {

  return locations

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
      (
        a,
        b
      ) =>
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
    null;

}


/* =========================================================
   CREATE DISPATCH RECORD
========================================================= */

function createDispatchRecord({
  warehouseTask,
  endpoints,
  scheduledSendAt,
  id,
}) {

  const createdAt =
    new Date()
      .toISOString();


  const wmsPriority =
    normalizeWmsPriority(
      warehouseTask.priority
    );


  return {

    id,

    warehouseTaskId:
      warehouseTask.id,

    sourceOrderId:
      warehouseTask.sourceOrderId ||
      "",

    sourceOrderNo:
      warehouseTask.sourceOrderNo ||
      "",

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

    sourceLocationId:
      endpoints.sourceLocationId,

    destinationLocationId:
      endpoints.destinationLocationId,

    sourceNodeId:
      endpoints.sourceNodeId,

    destinationNodeId:
      endpoints.destinationNodeId,

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

    wmsPriority,

    rcsPriority:
      RCS_PRIORITY[
        wmsPriority
      ] ||
      60,

    scheduledSendAt,

    sendStatus:
      "NOT_SENT",

    rcsTaskChainCode:
      "",

    rcsStatus:
      "NOT_SENT",

    bridgeTaskId:
      "",

    bridgeMode:
      "",

    bridgeLastPolledAt:
      "",

    bridgeElapsedSeconds:
      0,

    backendError:
      "",

    rcsStartedAt:
      "",

    rcsCompletedAt:
      "",

    warehouseTaskSyncedAt:
      "",

    warehouseTaskSyncStatus:
      "NOT_SYNCED",

    lastQueueState:
      "",

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
   NORMALIZE DISPATCH RECORD
========================================================= */

function normalizeDispatchRecord(
  item,
  index
) {

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
      new Date()
        .toISOString(),

    sendStatus:
      String(
        item.sendStatus ||
        (
          item.status ===
          "SENT"
            ? "SENT"
            : "NOT_SENT"
        )
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

    bridgeTaskId:
      item.bridgeTaskId ||
      "",

    bridgeMode:
      item.bridgeMode ||
      "",

    bridgeLastPolledAt:
      item.bridgeLastPolledAt ||
      "",

    bridgeElapsedSeconds:
      Number(
        item.bridgeElapsedSeconds ||
        0
      ),

    backendError:
      item.backendError ||
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
      new Date()
        .toISOString(),
  };

}


/* =========================================================
   BRIDGE COMMAND
========================================================= */

function buildBridgeCommand(
  item
) {

  return {

    robotTaskCode:
      item.warehouseTaskId,

    taskType:
      "TRANSPORT",

    initPriority:
      clampRcsPriority(
        item.rcsPriority
      ),

    scheduledSendAt:
      item.scheduledSendAt ||
      null,

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
   COMMAND DRAFT
========================================================= */

function buildCommandDraft(
  item
) {

  return {

    _note:
      "Internal WMS command sent to the WMS RCS Bridge. The bridge will map this to the exact HIK GenerateTaskOrder contract only after that external API is confirmed.",

    ...buildBridgeCommand(
      item
    ),
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

  if (
    item.sendStatus ===
    "SENDING"
  ) {

    return "SENDING";

  }


  if (
    item.sendStatus ===
    "SENT"
  ) {

    return "SENT";

  }


  const readiness =
    getEndpointReadiness({

      sourceLocationId:
        item.sourceLocationId,

      destinationLocationId:
        item.destinationLocationId,

      sourceNodeId:
        item.sourceNodeId,

      destinationNodeId:
        item.destinationNodeId,

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
    });


  if (
    !readiness.ok
  ) {

    return "MAPPING_REQUIRED";

  }


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


  return "READY";

}


/* =========================================================
   CANDIDATE SORT
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
    )
    -
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


  return (
    getTime(
      a.task.createdAt
    )
    -
    getTime(
      b.task.createdAt
    )
  );

}


/* =========================================================
   REAL RCS QUEUE SORT

   ใช้สำหรับ READY ranking จริง
========================================================= */

function compareQueueRows(
  a,
  b
) {

  const stateRank = {

    READY:
      0,

    SENDING:
      1,

    WAITING_TIME:
      2,

    MAPPING_REQUIRED:
      3,

    SENT:
      4,
  };


  const stateCompare =
    (
      stateRank[
        a.queueState
      ] ??
      99
    )
    -
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


  /* -----------------------------------------------
     READY
  ----------------------------------------------- */

  if (
    a.queueState ===
    "READY"
  ) {

    const priorityCompare =
      Number(
        b.rcsPriority ||
        0
      )
      -
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
      )
      -
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
      )
      -
      getTime(
        b.createdAt
      )
    );

  }


  /* -----------------------------------------------
     WAITING TIME
  ----------------------------------------------- */

  if (
    a.queueState ===
    "WAITING_TIME"
  ) {

    const scheduleCompare =
      getTime(
        a.scheduledSendAt
      )
      -
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
      )
      -
      Number(
        a.rcsPriority ||
        0
      )
    );

  }


  return (
    getTime(
      a.createdAt
    )
    -
    getTime(
      b.createdAt
    )
  );

}


/* =========================================================
   NEXT QUEUE ID
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

  if (
    !value
  ) {

    return new Date()
      .toISOString();

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

    return new Date()
      .toISOString();

  }


  return date
    .toISOString();

}


/* =========================================================
   GATEWAY VALIDATION
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
      ok:
        false,
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
      ok:
        false,
    };

  }


  return {
    ok:
      true,

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
   HISTORY EVENT
========================================================= */

function createHistoryEvent({
  type,
  message,
  at,
  details = null,
}) {

  const timestamp =
    at ||
    new Date()
      .toISOString();


  return {
    id:
      `EVT-${Date.now()}-${Math.random()
        .toString(36)
        .slice(
          2,
          8
        )}`,

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
   TIME
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


/* =========================================================
   QUEUE NUMBER

   RCSQ-004 → 4
========================================================= */

function getQueueNumber(
  queueId
) {

  const match =
    String(
      queueId ||
      ""
    ).match(
      /(\d+)$/
    );


  if (
    !match
  ) {

    return 0;

  }


  return Number(
    match[1]
  );

}


/* =========================================================
   DATE FORMAT
========================================================= */

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
   DATETIME LOCAL FORMAT
========================================================= */

function formatDateTimeLocalInput(
  value
) {

  if (
    !value
  ) {

    return "";

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

    return "";

  }


  const pad =
    (
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

  ].join(
    ""
  );

}


/* =========================================================
   STORAGE LOADERS
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