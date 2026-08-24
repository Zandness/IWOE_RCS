import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Clipboard,
  Copy,
  ExternalLink,
  MapPin,
  Package,
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

const ROBOT_TASK_KEY =
  "wms-robot-tasks-v1";


const PRIORITY_ORDER = {
  URGENT: 0,
  HIGH: 1,
  NORMAL: 2,
  LOW: 3,
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
    robotTasks,
    setRobotTasks,
  ] = useState(
    loadRobotTasks
  );


  /*
   * Gateway last octet
   *
   * ตั้งใจไม่ save ลง localStorage
   * เพราะต้องตรวจ/กรอกใหม่ทุกครั้ง
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
   * =====================================================
   * SAVE ROBOT TASKS
   * =====================================================
   */

  useEffect(() => {
    try {
      localStorage.setItem(
        ROBOT_TASK_KEY,
        JSON.stringify(
          robotTasks
        )
      );
    } catch (error) {
      console.error(
        "Could not save Robot Tasks.",
        error
      );
    }
  }, [robotTasks]);


  /*
   * =====================================================
   * REFRESH DATA
   * =====================================================
   */

  function refreshData() {
    setWarehouseTasks(
      loadWarehouseTasks()
    );

    setLocations(
      loadLocations()
    );

    setRobotTasks(
      loadRobotTasks()
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
          ROBOT_TASK_KEY,
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
              ROBOT_TASK_KEY,
            ].includes(
              key
            )
        )
      ) {
        refreshData();
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


  /*
   * =====================================================
   * OPERATIONAL LOCATIONS
   * =====================================================
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


  const shippingLocation =
    useMemo(
      () =>
        findOperationalLocation(
          locations,
          "SHIPPING"
        ),
      [locations]
    );


  /*
   * =====================================================
   * DISPATCH CANDIDATES
   * =====================================================
   */

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
                receivingLocation,
                shippingLocation,
              });


            const existingRobotTask =
              robotTasks.find(
                (robotTask) =>
                  robotTask.warehouseTaskId ===
                  task.id
              );


            const ready =
              Boolean(
                endpoints.sourceNodeId
              ) &&
              Boolean(
                endpoints.destinationNodeId
              ) &&
              !existingRobotTask;


            let reason =
              "";


            if (
              existingRobotTask
            ) {
              reason =
                "Robot Task already prepared";
            } else if (
              !endpoints.sourceNodeId
            ) {
              reason =
                "Source Map Node missing";
            } else if (
              !endpoints.destinationNodeId
            ) {
              reason =
                "Destination Map Node missing";
            }


            return {
              task,
              endpoints,
              existingRobotTask,
              ready,
              reason,
            };
          }
        )
        .sort(
          (a, b) => {
            const priorityCompare =
              (
                PRIORITY_ORDER[
                  a.task.priority
                ] ?? 99
              ) -
              (
                PRIORITY_ORDER[
                  b.task.priority
                ] ?? 99
              );


            if (
              priorityCompare !==
              0
            ) {
              return priorityCompare;
            }


            /*
             * FIFO inside same priority
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
        );
    }, [
      warehouseTasks,
      robotTasks,
      receivingLocation,
      shippingLocation,
    ]);


  const readyCandidates =
    useMemo(
      () =>
        candidates.filter(
          (item) =>
            item.ready
        ),
      [candidates]
    );


  /*
   * =====================================================
   * SUMMARY
   * =====================================================
   */

  const summary =
    useMemo(
      () => ({
        pending:
          candidates.length,

        ready:
          readyCandidates.length,

        notReady:
          candidates.filter(
            (item) =>
              !item.ready &&
              !item.existingRobotTask
          ).length,

        prepared:
          robotTasks.filter(
            (task) =>
              task.status ===
              "READY_TO_SEND"
          ).length,
      }),
      [
        candidates,
        readyCandidates,
        robotTasks,
      ]
    );


  /*
   * =====================================================
   * PREPARE ONE
   * =====================================================
   */

  function prepareRobotTask(
    candidate
  ) {
    if (
      !candidate.ready
    ) {
      return;
    }


    setRobotTasks(
      (current) => {
        const exists =
          current.some(
            (robotTask) =>
              robotTask.warehouseTaskId ===
              candidate.task.id
          );


        if (exists) {
          return current;
        }


        const robotTask =
          createRobotTask({
            warehouseTask:
              candidate.task,

            endpoints:
              candidate.endpoints,

            id:
              getNextRobotTaskId(
                current
              ),
          });


        return [
          ...current,
          robotTask,
        ];
      }
    );
  }


  /*
   * =====================================================
   * PREPARE ALL
   * =====================================================
   */

  function prepareAllReady() {
    setRobotTasks(
      (current) => {
        const existingWarehouseIds =
          new Set(
            current.map(
              (robotTask) =>
                robotTask.warehouseTaskId
            )
          );


        const ready =
          readyCandidates.filter(
            (candidate) =>
              !existingWarehouseIds.has(
                candidate.task.id
              )
          );


        if (
          ready.length ===
          0
        ) {
          return current;
        }


        let nextNumber =
          getHighestRobotTaskNumber(
            current
          ) + 1;


        const newRobotTasks =
          ready.map(
            (candidate) => {
              const id =
                `RT-${String(
                  nextNumber
                ).padStart(
                  3,
                  "0"
                )}`;


              nextNumber +=
                1;


              return createRobotTask({
                warehouseTask:
                  candidate.task,

                endpoints:
                  candidate.endpoints,

                id,
              });
            }
          );


        return [
          ...current,
          ...newRobotTasks,
        ];
      }
    );
  }


  /*
   * =====================================================
   * REMOVE PREPARED TASK
   * =====================================================
   */

  function removeRobotTask(
    robotTask
  ) {
    const confirmed =
      window.confirm(
        `Remove prepared Robot Task ${robotTask.id}?`
      );


    if (!confirmed) {
      return;
    }


    setRobotTasks(
      (current) =>
        current.filter(
          (item) =>
            item.id !==
            robotTask.id
        )
    );
  }


  /*
   * =====================================================
   * RCS ROUTE COMMAND
   * =====================================================
   */

  const gatewayValidation =
    validateGatewayOctet(
      gatewayLastOctet
    );


  const routeCommand =
    gatewayValidation.ok
      ? `route -p add 192.168.100.0 mask 255.255.255.0 192.168.50.${gatewayValidation.value}`
      : "";


  async function handleCopyCommand() {
    if (!routeCommand) {
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


  /*
   * =====================================================
   * UI
   * =====================================================
   */

  return (
    <div className="dispatcher-page">

      {/* HEADER */}

      <div className="dispatcher-header">

        <div>
          <span className="dispatcher-label">
            ROBOT EXECUTION PREPARATION
          </span>


          <h2>
            Robot Task Dispatcher
          </h2>


          <p>
            Convert ready Warehouse
            Tasks into internal Robot
            Tasks before connecting to
            the external HIK RCS.
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
          title="Pending Tasks"
          value={
            summary.pending
          }
          icon={
            <Clipboard
              size={20}
            />
          }
        />


        <SummaryCard
          title="Ready for Robot"
          value={
            summary.ready
          }
          icon={
            <CheckCircle2
              size={20}
            />
          }
          tone="success"
        />


        <SummaryCard
          title="Missing Endpoint"
          value={
            summary.notReady
          }
          icon={
            <AlertTriangle
              size={20}
            />
          }
          tone="warning"
        />


        <SummaryCard
          title="Ready to Send"
          value={
            summary.prepared
          }
          icon={
            <Send
              size={20}
            />
          }
          tone="cyan"
        />

      </div>


      {/* RCS PREPARATION */}

      <section className="dispatcher-panel">

        <div className="dispatcher-panel-header">

          <div>
            <span className="dispatcher-section-label">
              RCS NETWORK PREPARATION
            </span>

            <h3>
              HIK RCS Connection Prep
            </h3>

            <p>
              This page only prepares
              the Windows route command.
              It cannot execute an
              Administrator command
              directly from the browser.
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
                Check and enter this
                number again every time
                before accessing RCS.
              </span>

            </div>

          </div>


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
                handleCopyCommand
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


      {/* WAREHOUSE TASKS */}

      <section className="dispatcher-panel">

        <div className="dispatcher-panel-header">

          <div>
            <span className="dispatcher-section-label">
              DISPATCH QUEUE
            </span>

            <h3>
              Warehouse Tasks
            </h3>

            <p>
              Priority is processed
              first, then FIFO inside
              the same priority.
            </p>
          </div>


          <button
            type="button"
            className="prepare-all-button"
            disabled={
              readyCandidates.length ===
              0
            }
            onClick={
              prepareAllReady
            }
          >
            <Bot
              size={16}
            />

            Prepare All Ready
          </button>

        </div>


        <div className="dispatcher-table-wrapper">

          <table className="dispatcher-table">

            <thead>
              <tr>
                <th>
                  Task
                </th>

                <th>
                  Type
                </th>

                <th>
                  SKU / Qty
                </th>

                <th>
                  Source
                </th>

                <th>
                  Destination
                </th>

                <th>
                  Priority
                </th>

                <th>
                  Readiness
                </th>

                <th></th>
              </tr>
            </thead>


            <tbody>

              {candidates.map(
                (candidate) => (
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
                          candidate.task
                            .sourceOrderNo
                        }
                      </small>
                    </td>


                    <td>
                      <TaskTypeBadge
                        type={
                          candidate.task.type
                        }
                      />
                    </td>


                    <td>
                      <strong>
                        {
                          candidate.task.sku
                        }
                      </strong>

                      <small>
                        Qty
                        {" "}
                        {
                          candidate.task
                            .quantity
                        }
                      </small>
                    </td>


                    <td>
                      <NodeCell
                        label={
                          candidate.endpoints
                            .sourceLabel
                        }
                        nodeId={
                          candidate.endpoints
                            .sourceNodeId
                        }
                      />
                    </td>


                    <td>
                      <NodeCell
                        label={
                          candidate.endpoints
                            .destinationLabel
                        }
                        nodeId={
                          candidate.endpoints
                            .destinationNodeId
                        }
                      />
                    </td>


                    <td>
                      <PriorityBadge
                        priority={
                          candidate.task
                            .priority
                        }
                      />
                    </td>


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


                    <td>
                      <button
                        type="button"
                        className="prepare-task-button"
                        disabled={
                          !candidate.ready
                        }
                        onClick={() =>
                          prepareRobotTask(
                            candidate
                          )
                        }
                      >
                        <Bot
                          size={14}
                        />

                        Prepare
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
                New robot candidates
                will appear when
                Warehouse Tasks are
                Pending.
              </span>

            </div>
          )}

        </div>

      </section>


      {/* ROBOT TASKS */}

      <section className="dispatcher-panel">

        <div className="dispatcher-panel-header">

          <div>
            <span className="dispatcher-section-label">
              ROBOT TASK BUFFER
            </span>

            <h3>
              Prepared Robot Tasks
            </h3>

            <p>
              These are internal WMS
              Robot Tasks only. They
              have not been sent to
              HIK RCS yet.
            </p>
          </div>

        </div>


        <div className="dispatcher-table-wrapper">

          <table className="dispatcher-table robot-task-table">

            <thead>
              <tr>
                <th>
                  Robot Task
                </th>

                <th>
                  Warehouse Task
                </th>

                <th>
                  Type
                </th>

                <th>
                  Route
                </th>

                <th>
                  Status
                </th>

                <th>
                  Payload
                </th>

                <th></th>
              </tr>
            </thead>


            <tbody>

              {[...robotTasks]
                .sort(
                  (a, b) =>
                    getTime(
                      b.createdAt
                    ) -
                    getTime(
                      a.createdAt
                    )
                )
                .map(
                  (robotTask) => (
                    <tr
                      key={
                        robotTask.id
                      }
                    >

                      <td>
                        <strong>
                          {
                            robotTask.id
                          }
                        </strong>

                        <small>
                          {
                            formatDateTime(
                              robotTask.createdAt
                            )
                          }
                        </small>
                      </td>


                      <td>
                        {
                          robotTask
                            .warehouseTaskId
                        }
                      </td>


                      <td>
                        <TaskTypeBadge
                          type={
                            robotTask.type
                          }
                        />
                      </td>


                      <td>
                        <div className="robot-route">

                          <span>
                            {
                              robotTask
                                .sourceNodeId
                            }
                          </span>

                          <Route
                            size={14}
                          />

                          <span>
                            {
                              robotTask
                                .destinationNodeId
                            }
                          </span>

                        </div>
                      </td>


                      <td>
                        <span className="robot-ready-status">
                          READY_TO_SEND
                        </span>
                      </td>


                      <td>
                        <button
                          type="button"
                          className="payload-button"
                          onClick={() =>
                            copyText(
                              JSON.stringify(
                                robotTask.payload,
                                null,
                                2
                              )
                            )
                          }
                        >
                          <Copy
                            size={14}
                          />

                          Copy Payload
                        </button>
                      </td>


                      <td>
                        <button
                          type="button"
                          className="robot-remove-button"
                          onClick={() =>
                            removeRobotTask(
                              robotTask
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


          {robotTasks.length ===
            0 && (
            <div className="dispatcher-empty">

              <Bot
                size={30}
              />

              <strong>
                No Robot Task Prepared
              </strong>

              <span>
                Prepare a Warehouse
                Task when both Map
                Nodes are available.
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
   NODE CELL
========================================================= */

function NodeCell({
  label,
  nodeId,
}) {
  return (
    <div className="dispatcher-node">

      <span>
        {
          label ||
          "-"
        }
      </span>


      <small
        className={
          nodeId
            ? "node-linked"
            : "node-missing"
        }
      >
        <MapPin
          size={11}
        />

        {
          nodeId ||
          "No Map Node"
        }
      </small>

    </div>
  );
}


/* =========================================================
   TYPE
========================================================= */

function TaskTypeBadge({
  type,
}) {
  return (
    <span
      className={`dispatcher-type type-${String(
        type
      ).toLowerCase()}`}
    >
      {
        type ===
        "PUTAWAY"
          ? "Putaway"
          : "Picking"
      }
    </span>
  );
}


/* =========================================================
   PRIORITY
========================================================= */

function PriorityBadge({
  priority,
}) {
  return (
    <span
      className={`dispatcher-priority priority-${String(
        priority
      ).toLowerCase()}`}
    >
      {
        priority ||
        "NORMAL"
      }
    </span>
  );
}


/* =========================================================
   ENDPOINT RESOLUTION
========================================================= */

function resolveTaskEndpoints({
  task,
  receivingLocation,
  shippingLocation,
}) {
  /*
   * PUTAWAY
   *
   * Receiving -> Storage
   */

  if (
    task.type ===
    "PUTAWAY"
  ) {
    return {
      sourceNodeId:
        task.sourceNodeId ||
        receivingLocation
          ?.mapNodeId ||
        "",

      sourceLocationId:
        task.sourceLocationId ||
        receivingLocation?.id ||
        "",

      sourceLabel:
        task.sourceNodeId
          ? task.sourceLabel
          : (
              receivingLocation?.code ||
              "RECEIVING"
            ),

      destinationNodeId:
        task.destinationNodeId ||
        "",

      destinationLocationId:
        task.destinationLocationId ||
        "",

      destinationLabel:
        task.destinationLabel ||
        "STORAGE",
    };
  }


  /*
   * PICKING
   *
   * Storage -> Shipping
   */

  return {
    sourceNodeId:
      task.sourceNodeId ||
      "",

    sourceLocationId:
      task.sourceLocationId ||
      "",

    sourceLabel:
      task.sourceLabel ||
      "STORAGE",

    destinationNodeId:
      task.destinationNodeId ||
      shippingLocation
        ?.mapNodeId ||
      "",

    destinationLocationId:
      task.destinationLocationId ||
      shippingLocation?.id ||
      "",

    destinationLabel:
      task.destinationNodeId
        ? task.destinationLabel
        : (
            shippingLocation?.code ||
            "SHIPPING"
          ),
  };
}


/* =========================================================
   FIND RECEIVING / SHIPPING LOCATION
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
          ) &&
          Boolean(
            location.mapNodeId
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
   CREATE ROBOT TASK
========================================================= */

function createRobotTask({
  warehouseTask,
  endpoints,
  id,
}) {
  const createdAt =
    new Date().toISOString();


  const payload = {
    robotTaskId:
      id,

    warehouseTaskId:
      warehouseTask.id,

    taskType:
      warehouseTask.type,

    sourceNode:
      endpoints.sourceNodeId,

    destinationNode:
      endpoints.destinationNodeId,

    sku:
      warehouseTask.sku,

    quantity:
      warehouseTask.quantity,

    priority:
      warehouseTask.priority,

    sourceOrderId:
      warehouseTask.sourceOrderId,
  };


  return {
    id,

    warehouseTaskId:
      warehouseTask.id,

    sourceOrderId:
      warehouseTask.sourceOrderId,

    sourceOrderNo:
      warehouseTask.sourceOrderNo,

    type:
      warehouseTask.type,

    sku:
      warehouseTask.sku,

    itemName:
      warehouseTask.itemName,

    quantity:
      warehouseTask.quantity,

    priority:
      warehouseTask.priority,

    sourceLocationId:
      endpoints.sourceLocationId,

    destinationLocationId:
      endpoints.destinationLocationId,

    sourceNodeId:
      endpoints.sourceNodeId,

    destinationNodeId:
      endpoints.destinationNodeId,

    status:
      "READY_TO_SEND",

    createdAt,

    payload,
  };
}


/* =========================================================
   ROBOT TASK ID
========================================================= */

function getNextRobotTaskId(
  tasks
) {
  const next =
    getHighestRobotTaskNumber(
      tasks
    ) + 1;


  return `RT-${String(
    next
  ).padStart(
    3,
    "0"
  )}`;
}


function getHighestRobotTaskNumber(
  tasks
) {
  let highest =
    0;


  (
    tasks ||
    []
  ).forEach(
    (task) => {
      const match =
        /^RT-(\d+)$/i.exec(
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
    number < 1 ||
    number > 254
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


/* =========================================================
   LOAD
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


function loadRobotTasks() {
  return loadArray(
    ROBOT_TASK_KEY
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


    if (!saved) {
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