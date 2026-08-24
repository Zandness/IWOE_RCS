import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  ClipboardList,
  MapPin,
  Package,
  PackageCheck,
  Pencil,
  Play,
  Plus,
  Search,
  Trash2,
  Truck,
} from "lucide-react";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  INVENTORY_STORAGE_KEY,
  LOCATION_STORAGE_KEY,
  OUTBOUND_STORAGE_KEY,
  notifyWmsDataChanged,
} from "../../utils/taskOperationSync";

import "../../styles/Outbound.css";


const ACTIVE_RESERVATION_STATUSES =
  new Set([
    "ALLOCATED",
    "PICKING",
  ]);


const INITIAL_OUTBOUND =
  [];


export default function OutboundOperations({
  embedded = false,
}) {
  const [
    orders,
    setOrders,
  ] = useState(
    loadOutboundOrders
  );


  const [
    inventory,
    setInventory,
  ] = useState(
    loadInventory
  );


  const [
    locations,
    setLocations,
  ] = useState(
    loadLocations
  );


  const [
    search,
    setSearch,
  ] = useState("");


  const [
    statusFilter,
    setStatusFilter,
  ] = useState(
    "ALL"
  );


  const [
    showOrderForm,
    setShowOrderForm,
  ] = useState(
    false
  );


  const [
    showAllocation,
    setShowAllocation,
  ] = useState(
    false
  );


  const [
    selectedOrder,
    setSelectedOrder,
  ] = useState(
    null
  );


  const [
    allocationPreview,
    setAllocationPreview,
  ] = useState(
    null
  );


  const [
    saveMessage,
    setSaveMessage,
  ] = useState("");


  /*
   * =====================================================
   * SAVE OUTBOUND
   * =====================================================
   */

  useEffect(() => {
    try {
      localStorage.setItem(
        OUTBOUND_STORAGE_KEY,

        JSON.stringify(
          orders
        )
      );


      setSaveMessage(
        "Saved locally"
      );
    } catch (error) {
      console.error(
        "Could not save outbound orders.",
        error
      );


      setSaveMessage(
        "Local save failed"
      );
    }
  }, [orders]);


  /*
   * =====================================================
   * RECEIVE TASK MANAGEMENT UPDATE
   * =====================================================
   */

  useEffect(() => {
    function refreshAll() {
      setOrders(
        loadOutboundOrders()
      );

      setInventory(
        loadInventory()
      );

      setLocations(
        loadLocations()
      );
    }


    /*
     * Other browser tab
     */

    function handleStorage(
      event
    ) {
      if (
        event.key ===
        OUTBOUND_STORAGE_KEY
      ) {
        setOrders(
          loadOutboundOrders()
        );
      }


      if (
        event.key ===
        INVENTORY_STORAGE_KEY
      ) {
        setInventory(
          loadInventory()
        );
      }


      if (
        event.key ===
        LOCATION_STORAGE_KEY
      ) {
        setLocations(
          loadLocations()
        );
      }
    }


    /*
     * Same browser tab
     *
     * Task Management
     * -> Outbound
     */

    function handleWmsDataChanged(
      event
    ) {
      const keys =
        event.detail?.keys ||
        [];


      if (
        keys.includes(
          OUTBOUND_STORAGE_KEY
        )
      ) {
        setOrders(
          loadOutboundOrders()
        );
      }


      if (
        keys.includes(
          INVENTORY_STORAGE_KEY
        )
      ) {
        setInventory(
          loadInventory()
        );
      }


      if (
        keys.includes(
          LOCATION_STORAGE_KEY
        )
      ) {
        setLocations(
          loadLocations()
        );
      }
    }


    window.addEventListener(
      "focus",
      refreshAll
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
        refreshAll
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
   * LOCATION MAP
   * =====================================================
   */

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
   * =====================================================
   * SKU MASTER
   * =====================================================
   */

  const skuMasters =
    useMemo(() => {
      const map =
        new Map();


      inventory.forEach(
        (item) => {
          if (
            !item.sku ||
            map.has(
              item.sku
            )
          ) {
            return;
          }


          map.set(
            item.sku,

            {
              sku:
                item.sku,

              name:
                item.name,

              category:
                item.category,

              unit:
                item.unit,
            }
          );
        }
      );


      return Array.from(
        map.values()
      ).sort(
        (a, b) =>
          a.sku.localeCompare(
            b.sku
          )
      );
    }, [inventory]);


  /*
   * =====================================================
   * FREE STOCK
   * =====================================================
   */

  const freeStockBySku =
    useMemo(
      () =>
        getAvailableStockBySku({
          inventory,
          locations,
          orders,
        }),

      [
        inventory,
        locations,
        orders,
      ]
    );


  /*
   * =====================================================
   * SEARCH + LATEST FIRST
   * =====================================================
   */

  const filteredOrders =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();


      return orders
        .filter(
          (order) => {
            const matchesStatus =
              statusFilter ===
                "ALL" ||
              order.status ===
                statusFilter;


            const searchable = [
              order.id,
              order.orderNo,
              order.customer,
              order.reference,
              order.status,

              ...(
                order.lines ||
                []
              ).flatMap(
                (line) => [
                  line.sku,
                  line.itemName,

                  ...(
                    line.allocations ||
                    []
                  ).map(
                    (
                      allocation
                    ) =>
                      allocation.locationId
                  ),
                ]
              ),
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();


            return (
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
          compareNewestFirst
        );
    }, [
      orders,
      search,
      statusFilter,
    ]);


  /*
   * =====================================================
   * SUMMARY
   * =====================================================
   */

  const summary =
    useMemo(() => {
      const openOrders =
        orders.filter(
          (order) =>
            ![
              "READY",
              "COMPLETED",
            ].includes(
              order.status
            )
        ).length;


      const allocated =
        orders.filter(
          (order) =>
            [
              "ALLOCATED",
              "PICKING",
            ].includes(
              order.status
            )
        ).length;


      const ready =
        orders.filter(
          (order) =>
            order.status ===
            "READY"
        ).length;


      const completed =
        orders.filter(
          (order) =>
            order.status ===
            "COMPLETED"
        ).length;


      const requestedQty =
        orders
          .filter(
            (order) =>
              order.status !==
              "COMPLETED"
          )
          .reduce(
            (
              sum,
              order
            ) =>
              sum +
              getOrderRequestedQty(
                order
              ),

            0
          );


      return {
        openOrders,
        allocated,
        ready,
        completed,
        requestedQty,
      };
    }, [orders]);


  /*
   * =====================================================
   * NEW
   * =====================================================
   */

  function handleAddOrder() {
    setSelectedOrder(
      null
    );


    setShowOrderForm(
      true
    );
  }


  /*
   * =====================================================
   * EDIT
   * =====================================================
   */

  function handleEditOrder(
    order
  ) {
    if (
      order.status !==
      "DRAFT"
    ) {
      return;
    }


    setSelectedOrder(
      order
    );


    setShowOrderForm(
      true
    );
  }


  /*
   * =====================================================
   * DELETE
   * =====================================================
   */

  function handleDeleteOrder(
    order
  ) {
    if (
      order.status !==
      "DRAFT"
    ) {
      window.alert(
        "Only Draft outbound orders can be deleted."
      );


      return;
    }


    const confirmed =
      window.confirm(
        `Delete outbound order ${order.orderNo}?`
      );


    if (!confirmed) {
      return;
    }


    setOrders(
      (current) =>
        current.filter(
          (item) =>
            item.id !==
            order.id
        )
    );
  }


  /*
   * =====================================================
   * SAVE ORDER
   * =====================================================
   */

  function handleSaveOrder(
    formData
  ) {
    const validation =
      validateOutboundOrder({
        formData,
        inventory,
        locations,
        orders,
        skuMasters,
      });


    if (!validation.ok) {
      return validation;
    }


    /*
     * EDIT
     */

    if (selectedOrder) {
      setOrders(
        (current) =>
          current.map(
            (order) =>
              order.id ===
              selectedOrder.id
                ? {
                    ...order,
                    ...validation.order,
                  }
                : order
          )
      );
    } else {
      /*
       * NEW
       */

      const now =
        new Date().toISOString();


      setOrders(
        (current) => [
          ...current,

          {
            id:
              getNextOutboundId(
                current
              ),

            orderNo:
              generateOutboundNo(
                current
              ),

            status:
              "DRAFT",

            createdAt:
              now,

            allocatedAt:
              "",

            pickingAt:
              "",

            pickedAt:
              "",

            readyAt:
              "",

            completedAt:
              "",

            /*
             * Picking Task Progress
             */

            pickingTaskTotal:
              0,

            pickingTaskCompleted:
              0,

            pickingTaskInProgress:
              0,

            pickingTaskBlocked:
              0,

            pickingTaskPending:
              0,

            ...validation.order,
          },
        ]
      );
    }


    setShowOrderForm(
      false
    );


    setSelectedOrder(
      null
    );


    return {
      ok: true,
    };
  }


  /*
   * =====================================================
   * OPEN ALLOCATION
   * =====================================================
   */

  function handleOpenAllocation(
    order
  ) {
    const result =
      buildOrderAllocations({
        order,
        inventory,
        locations,
        orders,
      });


    if (!result.ok) {
      window.alert(
        result.message
      );


      return;
    }


    setSelectedOrder(
      order
    );


    setAllocationPreview(
      result.lines
    );


    setShowAllocation(
      true
    );
  }


  /*
   * =====================================================
   * CONFIRM ALLOCATION
   * =====================================================
   */

  function handleConfirmAllocation() {
    if (
      !selectedOrder ||
      !allocationPreview
    ) {
      return;
    }


    const now =
      new Date().toISOString();


    setOrders(
      (current) =>
        current.map(
          (order) =>
            order.id ===
            selectedOrder.id
              ? {
                  ...order,

                  status:
                    "ALLOCATED",

                  allocatedAt:
                    now,

                  lines:
                    allocationPreview,

                  pickingTaskTotal:
                    0,

                  pickingTaskCompleted:
                    0,

                  pickingTaskInProgress:
                    0,

                  pickingTaskBlocked:
                    0,

                  pickingTaskPending:
                    0,
                }
              : order
        )
    );


    setShowAllocation(
      false
    );


    setSelectedOrder(
      null
    );


    setAllocationPreview(
      null
    );
  }


  /*
   * =====================================================
   * START PICKING FROM OUTBOUND PAGE
   * =====================================================
   */

  function handleStartPicking(
    order
  ) {
    if (
      order.status !==
      "ALLOCATED"
    ) {
      return;
    }


    setOrders(
      (current) =>
        current.map(
          (item) =>
            item.id ===
            order.id
              ? {
                  ...item,

                  status:
                    "PICKING",

                  pickingAt:
                    item.pickingAt ||
                    new Date().toISOString(),
                }
              : item
        )
    );
  }


  /*
   * =====================================================
   * CONFIRM PICK FROM OUTBOUND PAGE
   * =====================================================
   *
   * ยังคงอนุญาตให้ Operator
   * Confirm Pick จากหน้า Outbound โดยตรงได้
   *
   * ถ้าใช้ Task Management
   * Inventory จะถูกลดตอน Task ครบเอง
   * =====================================================
   */

  function handleConfirmPick(
    order
  ) {
    if (
      order.status !==
      "PICKING"
    ) {
      return;
    }


    const currentInventory =
      loadInventory();


    const deduction =
      deductPickedInventory(
        currentInventory,
        order
      );


    if (!deduction.ok) {
      window.alert(
        deduction.message
      );


      setInventory(
        currentInventory
      );


      return;
    }


    try {
      localStorage.setItem(
        INVENTORY_STORAGE_KEY,

        JSON.stringify(
          deduction.inventory
        )
      );
    } catch (error) {
      console.error(
        "Could not update inventory.",
        error
      );


      window.alert(
        "Inventory update failed. Pick was not confirmed."
      );


      return;
    }


    setInventory(
      deduction.inventory
    );


    setOrders(
      (current) =>
        current.map(
          (item) =>
            item.id ===
            order.id
              ? {
                  ...item,

                  status:
                    "PICKED",

                  pickedAt:
                    new Date().toISOString(),

                  pickingTaskCompleted:
                    Number(
                      item.pickingTaskTotal ||
                      0
                    ),

                  pickingTaskInProgress:
                    0,

                  pickingTaskBlocked:
                    0,

                  pickingTaskPending:
                    0,
                }
              : item
        )
    );


    notifyWmsDataChanged([
      INVENTORY_STORAGE_KEY,
    ]);
  }


  /*
   * =====================================================
   * MARK READY
   * =====================================================
   */

  function handleMarkReady(
    order
  ) {
    if (
      order.status !==
      "PICKED"
    ) {
      return;
    }


    setOrders(
      (current) =>
        current.map(
          (item) =>
            item.id ===
            order.id
              ? {
                  ...item,

                  status:
                    "READY",

                  readyAt:
                    new Date().toISOString(),
                }
              : item
        )
    );
  }


  /*
   * =====================================================
   * DISPATCH
   * =====================================================
   */

  function handleDispatch(
    order
  ) {
    if (
      order.status !==
      "READY"
    ) {
      return;
    }


    const confirmed =
      window.confirm(
        `Dispatch ${order.orderNo}?`
      );


    if (!confirmed) {
      return;
    }


    setOrders(
      (current) =>
        current.map(
          (item) =>
            item.id ===
            order.id
              ? {
                  ...item,

                  status:
                    "COMPLETED",

                  completedAt:
                    new Date().toISOString(),
                }
              : item
        )
    );
  }


  /*
   * =====================================================
   * UI
   * =====================================================
   */

  return (
    <div
      className={`outbound-page ${
        embedded
          ? "outbound-embedded"
          : ""
      }`}
    >

      {/* HEADER */}

      <div className="outbound-header">

        <div>
          <span className="outbound-label">
            OUTBOUND OPERATIONS
          </span>


          <h2>
            Outbound / Picking
          </h2>


          <p>
            Allocate available inventory,
            perform picking and prepare
            dispatch.
          </p>
        </div>


        <div className="outbound-header-actions">

          {saveMessage && (
            <span
              className={`outbound-save-state ${
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
            className="outbound-add-button"
            onClick={
              handleAddOrder
            }
          >
            <Plus
              size={18}
            />

            New Outbound
          </button>

        </div>

      </div>


      {/* SUMMARY */}

      <div className="outbound-summary-grid">

        <SummaryCard
          icon={
            <ClipboardList
              size={21}
            />
          }
          title="Open Orders"
          value={
            summary.openOrders
          }
        />


        <SummaryCard
          icon={
            <Boxes
              size={21}
            />
          }
          title="Allocated / Picking"
          value={
            summary.allocated
          }
          tone="warning"
        />


        <SummaryCard
          icon={
            <PackageCheck
              size={21}
            />
          }
          title="Ready"
          value={
            summary.ready
          }
          tone="success"
        />


        <SummaryCard
          icon={
            <Truck
              size={21}
            />
          }
          title="Dispatched"
          value={
            summary.completed
          }
        />


        <SummaryCard
          icon={
            <Package
              size={21}
            />
          }
          title="Open Qty"
          value={
            summary.requestedQty
          }
        />

      </div>


      {/* TABLE */}

      <section className="outbound-panel">

        <div className="outbound-panel-header">

          <div>
            <h3>
              Outbound Orders
            </h3>


            <p>
              Newest orders are shown
              first. Picking progress is
              synchronized from Task
              Management.
            </p>
          </div>


          <div className="outbound-toolbar">

            <div className="outbound-search">

              <Search
                size={17}
              />


              <input
                value={
                  search
                }
                placeholder="Search order, customer or SKU..."
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
              className="outbound-filter"
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
                All status
              </option>

              <option value="DRAFT">
                Draft
              </option>

              <option value="ALLOCATED">
                Allocated
              </option>

              <option value="PICKING">
                Picking
              </option>

              <option value="PICKED">
                Picked
              </option>

              <option value="READY">
                Ready
              </option>

              <option value="COMPLETED">
                Completed
              </option>

            </select>

          </div>

        </div>


        <div className="outbound-table-wrapper">

          <table className="outbound-table">

            <thead>
              <tr>

                <th>
                  Outbound
                </th>

                <th>
                  Customer
                </th>

                <th>
                  Reference
                </th>

                <th>
                  Lines
                </th>

                <th>
                  Requested
                </th>

                <th>
                  Allocated
                </th>

                <th>
                  Status
                </th>

                <th>
                  Created
                </th>

                <th></th>

              </tr>
            </thead>


            <tbody>

              {filteredOrders.map(
                (order) => (
                  <tr
                    key={
                      order.id
                    }
                  >

                    <td>
                      <div className="outbound-code-cell">

                        <div className="outbound-code-icon">
                          <Package
                            size={17}
                          />
                        </div>


                        <div>

                          <strong>
                            {
                              order.orderNo
                            }
                          </strong>

                          <span>
                            {
                              order.id
                            }
                          </span>

                        </div>

                      </div>
                    </td>


                    <td>
                      {
                        order.customer
                      }
                    </td>


                    <td>
                      <span className="outbound-reference">
                        {
                          order.reference ||
                          "-"
                        }
                      </span>
                    </td>


                    <td>
                      {
                        order.lines
                          ?.length ||
                        0
                      }
                    </td>


                    <td>
                      {
                        getOrderRequestedQty(
                          order
                        )
                      }
                    </td>


                    <td>
                      {
                        getOrderAllocatedQty(
                          order
                        )
                      }
                    </td>


                    <td>
                      <StatusBadge
                        status={
                          order.status
                        }
                        order={
                          order
                        }
                      />
                    </td>


                    <td>
                      {
                        formatDateTime(
                          order.createdAt
                        )
                      }
                    </td>


                    <td>

                      <div className="outbound-actions">

                        {/* DRAFT */}

                        {order.status ===
                          "DRAFT" && (
                          <>
                            <button
                              type="button"
                              title="Edit"
                              onClick={() =>
                                handleEditOrder(
                                  order
                                )
                              }
                            >
                              <Pencil
                                size={15}
                              />
                            </button>


                            <button
                              type="button"
                              className="allocate"
                              onClick={() =>
                                handleOpenAllocation(
                                  order
                                )
                              }
                            >
                              <Boxes
                                size={15}
                              />

                              Allocate
                            </button>


                            <button
                              type="button"
                              className="danger"
                              onClick={() =>
                                handleDeleteOrder(
                                  order
                                )
                              }
                            >
                              <Trash2
                                size={15}
                              />
                            </button>
                          </>
                        )}


                        {/* ALLOCATED */}

                        {order.status ===
                          "ALLOCATED" && (
                          <button
                            type="button"
                            className="picking"
                            onClick={() =>
                              handleStartPicking(
                                order
                              )
                            }
                          >
                            <Play
                              size={15}
                            />

                            Start Picking
                          </button>
                        )}


                        {/* PICKING */}

                        {order.status ===
                          "PICKING" && (
                          <button
                            type="button"
                            className="confirm-pick"
                            onClick={() =>
                              handleConfirmPick(
                                order
                              )
                            }
                          >
                            <CheckCircle2
                              size={15}
                            />

                            Confirm Pick
                          </button>
                        )}


                        {/* PICKED */}

                        {order.status ===
                          "PICKED" && (
                          <button
                            type="button"
                            className="ready"
                            onClick={() =>
                              handleMarkReady(
                                order
                              )
                            }
                          >
                            <PackageCheck
                              size={15}
                            />

                            Mark Ready
                          </button>
                        )}


                        {/* READY */}

                        {order.status ===
                          "READY" && (
                          <button
                            type="button"
                            className="dispatch"
                            onClick={() =>
                              handleDispatch(
                                order
                              )
                            }
                          >
                            <Truck
                              size={15}
                            />

                            Dispatch
                          </button>
                        )}


                        {/* COMPLETED */}

                        {order.status ===
                          "COMPLETED" && (
                          <span className="outbound-done">
                            Dispatched
                          </span>
                        )}

                      </div>

                    </td>

                  </tr>
                )
              )}

            </tbody>

          </table>


          {filteredOrders.length ===
            0 && (
            <div className="outbound-empty">
              No outbound orders found.
            </div>
          )}

        </div>

      </section>


      {/* CREATE / EDIT MODAL */}

      {showOrderForm && (
        <OutboundOrderForm
          order={
            selectedOrder
          }
          skuMasters={
            skuMasters
          }
          freeStockBySku={
            freeStockBySku
          }
          onSave={
            handleSaveOrder
          }
          onCancel={() => {
            setShowOrderForm(
              false
            );

            setSelectedOrder(
              null
            );
          }}
        />
      )}


      {/* ALLOCATION MODAL */}

      {showAllocation &&
        selectedOrder &&
        allocationPreview && (
          <AllocationModal
            order={
              selectedOrder
            }
            lines={
              allocationPreview
            }
            locationMap={
              locationMap
            }
            onConfirm={
              handleConfirmAllocation
            }
            onCancel={() => {
              setShowAllocation(
                false
              );

              setSelectedOrder(
                null
              );

              setAllocationPreview(
                null
              );
            }}
          />
        )}

    </div>
  );
}


/* =========================================================
   SUMMARY CARD
========================================================= */

function SummaryCard({
  icon,
  title,
  value,
  tone = "default",
}) {
  return (
    <div
      className={`outbound-summary-card tone-${tone}`}
    >

      <div className="outbound-summary-icon">
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
   STATUS BADGE
========================================================= */

function StatusBadge({
  status,
  order,
}) {
  const labels = {
    DRAFT:
      "Draft",

    ALLOCATED:
      "Allocated",

    PICKING:
      "Picking",

    PICKED:
      "Picked",

    READY:
      "Ready",

    COMPLETED:
      "Completed",
  };


  let label =
    labels[
      status
    ] ||
    status;


  /*
   * Picking Progress
   *
   * Picking 0/3
   * Picking 1/3
   * Picking 2/3
   */

  if (
    status ===
      "PICKING" &&
    Number(
      order?.pickingTaskTotal ||
      0
    ) > 0
  ) {
    const completed =
      Number(
        order?.pickingTaskCompleted ||
        0
      );


    const total =
      Number(
        order?.pickingTaskTotal ||
        0
      );


    label =
      `Picking ${completed}/${total}`;
  }


  return (
    <span
      className={`outbound-status status-${status.toLowerCase()}`}
    >
      {label}
    </span>
  );
}


/* =========================================================
   OUTBOUND ORDER FORM
========================================================= */

function OutboundOrderForm({
  order,
  skuMasters,
  freeStockBySku,
  onSave,
  onCancel,
}) {
  const [
    form,
    setForm,
  ] = useState({
    customer:
      order?.customer ||
      "",

    reference:
      order?.reference ||
      "",

    lines:
      order?.lines?.map(
        (line) => ({
          ...line,

          allocations:
            [],
        })
      ) || [
        createEmptyLine(),
      ],
  });


  const [
    error,
    setError,
  ] = useState("");


  function updateField(
    field,
    value
  ) {
    setForm(
      (current) => ({
        ...current,

        [field]:
          value,
      })
    );


    setError("");
  }


  function updateLine(
    index,
    field,
    value
  ) {
    setForm(
      (current) => {
        const lines = [
          ...current.lines,
        ];


        const next = {
          ...lines[
            index
          ],

          [field]:
            value,
        };


        if (
          field ===
          "sku"
        ) {
          const master =
            skuMasters.find(
              (item) =>
                item.sku ===
                value
            );


          next.itemName =
            master?.name ||
            "";
        }


        lines[
          index
        ] = next;


        return {
          ...current,
          lines,
        };
      }
    );


    setError("");
  }


  function addLine() {
    setForm(
      (current) => ({
        ...current,

        lines: [
          ...current.lines,

          createEmptyLine(),
        ],
      })
    );
  }


  function removeLine(
    index
  ) {
    if (
      form.lines.length <=
      1
    ) {
      return;
    }


    setForm(
      (current) => ({
        ...current,

        lines:
          current.lines.filter(
            (
              _,
              lineIndex
            ) =>
              lineIndex !==
              index
          ),
      })
    );
  }


  function handleSubmit(
    event
  ) {
    event.preventDefault();


    const result =
      onSave(
        form
      );


    if (!result?.ok) {
      setError(
        result?.message ||
        "Could not save outbound order."
      );
    }
  }


  return (
    <div
      className="outbound-modal-backdrop"
      onMouseDown={(
        event
      ) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          onCancel();
        }
      }}
    >

      <form
        className="outbound-modal"
        onSubmit={
          handleSubmit
        }
      >

        <div className="outbound-modal-header">

          <div>

            <span>
              OUTBOUND MANAGEMENT
            </span>


            <h3>
              {order
                ? "Edit Outbound Order"
                : "New Outbound Order"}
            </h3>

          </div>


          <button
            type="button"
            className="outbound-close"
            onClick={
              onCancel
            }
          >
            ×
          </button>

        </div>


        <div className="outbound-form-body">

          <div className="outbound-form-grid">

            <FormField
              label="Customer / Destination"
              value={
                form.customer
              }
              placeholder="Customer name"
              onChange={(
                value
              ) =>
                updateField(
                  "customer",
                  value
                )
              }
            />


            <FormField
              label="Reference / SO"
              value={
                form.reference
              }
              placeholder="SO-2026-001"
              onChange={(
                value
              ) =>
                updateField(
                  "reference",
                  value
                )
              }
            />

          </div>


          <div className="outbound-lines-header">

            <div>

              <strong>
                Outbound Items
              </strong>

              <span>
                Requested quantity must
                be within free stock.
              </span>

            </div>


            <button
              type="button"
              onClick={
                addLine
              }
            >
              <Plus
                size={15}
              />

              Add Line
            </button>

          </div>


          <div className="outbound-lines">

            {form.lines.map(
              (
                line,
                index
              ) => {
                const available =
                  Number(
                    freeStockBySku.get(
                      line.sku
                    ) ||
                    0
                  );


                return (
                  <div
                    className="outbound-line"
                    key={
                      line.lineId
                    }
                  >

                    <div className="outbound-line-number">
                      {
                        index +
                        1
                      }
                    </div>


                    {/* SKU */}

                    <label className="outbound-field">

                      <span>
                        SKU
                      </span>


                      <select
                        value={
                          line.sku
                        }
                        onChange={(
                          event
                        ) =>
                          updateLine(
                            index,
                            "sku",
                            event
                              .target
                              .value
                          )
                        }
                      >

                        <option value="">
                          Select SKU
                        </option>


                        {skuMasters.map(
                          (
                            item
                          ) => (
                            <option
                              key={
                                item.sku
                              }
                              value={
                                item.sku
                              }
                            >
                              {
                                item.sku
                              }
                              {" - "}
                              {
                                item.name
                              }
                            </option>
                          )
                        )}

                      </select>

                    </label>


                    {/* ITEM */}

                    <label className="outbound-field">

                      <span>
                        Item
                      </span>


                      <input
                        value={
                          line.itemName
                        }
                        readOnly
                        placeholder="Select SKU"
                      />

                    </label>


                    {/* QTY */}

                    <label className="outbound-field outbound-qty-field">

                      <span>
                        Requested Qty
                      </span>


                      <input
                        type="number"
                        min="1"
                        value={
                          line.requestedQty
                        }
                        onChange={(
                          event
                        ) =>
                          updateLine(
                            index,
                            "requestedQty",
                            event
                              .target
                              .value
                          )
                        }
                      />


                      <small>
                        Free stock:
                        {" "}
                        {
                          available
                        }
                      </small>

                    </label>


                    {/* DELETE LINE */}

                    <button
                      type="button"
                      className="outbound-remove-line"
                      disabled={
                        form.lines
                          .length <=
                        1
                      }
                      onClick={() =>
                        removeLine(
                          index
                        )
                      }
                    >
                      <Trash2
                        size={15}
                      />
                    </button>

                  </div>
                );
              }
            )}

          </div>


          {skuMasters.length ===
            0 && (
            <div className="outbound-form-warning">

              <AlertTriangle
                size={16}
              />


              <span>
                No inventory SKU is
                available. Create
                Inventory / SKU first.
              </span>

            </div>
          )}


          {error && (
            <div className="outbound-form-error">

              <AlertTriangle
                size={16}
              />

              <span>
                {error}
              </span>

            </div>
          )}

        </div>


        <div className="outbound-modal-actions">

          <button
            type="button"
            className="outbound-cancel"
            onClick={
              onCancel
            }
          >
            Cancel
          </button>


          <button
            type="submit"
            className="outbound-save"
          >
            {order
              ? "Save Changes"
              : "Create Outbound"}
          </button>

        </div>

      </form>

    </div>
  );
}


/* =========================================================
   ALLOCATION MODAL
========================================================= */

function AllocationModal({
  order,
  lines,
  locationMap,
  onConfirm,
  onCancel,
}) {
  return (
    <div
      className="outbound-modal-backdrop"
      onMouseDown={(
        event
      ) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          onCancel();
        }
      }}
    >

      <div className="outbound-modal allocation-modal">

        <div className="outbound-modal-header">

          <div>

            <span>
              STOCK ALLOCATION
            </span>


            <h3>
              Allocate
              {" "}
              {
                order.orderNo
              }
            </h3>

          </div>


          <button
            type="button"
            className="outbound-close"
            onClick={
              onCancel
            }
          >
            ×
          </button>

        </div>


        <div className="outbound-form-body">

          <div className="allocation-info">

            Stock is reserved now
            but Inventory is deducted
            only after
            {" "}

            <strong>
              Confirm Pick
            </strong>
            .

          </div>


          <div className="allocation-lines">

            {lines.map(
              (line) => (
                <div
                  className="allocation-line"
                  key={
                    line.lineId
                  }
                >

                  <div className="allocation-product">

                    <Package
                      size={17}
                    />


                    <div>

                      <strong>
                        {
                          line.sku
                        }
                      </strong>


                      <span>
                        {
                          line.itemName
                        }
                      </span>

                    </div>

                  </div>


                  <div className="allocation-requested">

                    <span>
                      Requested
                    </span>

                    <strong>
                      {
                        line.requestedQty
                      }
                    </strong>

                  </div>


                  <div className="allocation-sources">

                    {(
                      line.allocations ||
                      []
                    ).map(
                      (
                        allocation
                      ) => {
                        const location =
                          locationMap.get(
                            allocation.locationId
                          );


                        return (
                          <div
                            className="allocation-source"
                            key={
                              allocation.inventoryId
                            }
                          >

                            <MapPin
                              size={13}
                            />


                            <span>
                              {
                                location?.code ||
                                allocation.locationId
                              }
                            </span>


                            <strong>
                              {
                                allocation.qty
                              }
                            </strong>

                          </div>
                        );
                      }
                    )}

                  </div>

                </div>
              )
            )}

          </div>

        </div>


        <div className="outbound-modal-actions">

          <button
            type="button"
            className="outbound-cancel"
            onClick={
              onCancel
            }
          >
            Cancel
          </button>


          <button
            type="button"
            className="outbound-save"
            onClick={
              onConfirm
            }
          >
            Confirm Allocation
          </button>

        </div>

      </div>

    </div>
  );
}


/* =========================================================
   FORM FIELD
========================================================= */

function FormField({
  label,
  value,
  onChange,
  placeholder,
}) {
  return (
    <label className="outbound-field">

      <span>
        {label}
      </span>


      <input
        value={
          value
        }
        placeholder={
          placeholder
        }
        onChange={(
          event
        ) =>
          onChange(
            event.target
              .value
          )
        }
      />

    </label>
  );
}


/* =========================================================
   VALIDATE OUTBOUND ORDER
========================================================= */

function validateOutboundOrder({
  formData,
  inventory,
  locations,
  orders,
  skuMasters,
}) {
  const customer =
    String(
      formData.customer ||
      ""
    ).trim();


  const reference =
    String(
      formData.reference ||
      ""
    ).trim();


  if (!customer) {
    return {
      ok: false,

      message:
        "Please enter Customer / Destination.",
    };
  }


  if (
    !Array.isArray(
      formData.lines
    ) ||
    formData.lines
      .length === 0
  ) {
    return {
      ok: false,

      message:
        "Add at least one outbound item.",
    };
  }


  const masterMap =
    new Map(
      skuMasters.map(
        (item) => [
          item.sku,
          item,
        ]
      )
    );


  const availableBySku =
    getAvailableStockBySku({
      inventory,
      locations,
      orders,
    });


  const usedSku =
    new Set();


  const normalizedLines =
    [];


  for (
    let index = 0;
    index <
    formData.lines.length;
    index += 1
  ) {
    const line =
      formData.lines[
        index
      ];


    const sku =
      String(
        line.sku ||
        ""
      )
        .trim()
        .toUpperCase();


    const requestedQty =
      Number(
        line.requestedQty
      );


    if (!sku) {
      return {
        ok: false,

        message:
          `Line ${index + 1}: Please select SKU.`,
      };
    }


    const master =
      masterMap.get(
        sku
      );


    if (!master) {
      return {
        ok: false,

        message:
          `Line ${index + 1}: SKU ${sku} does not exist in Inventory.`,
      };
    }


    if (
      usedSku.has(
        sku
      )
    ) {
      return {
        ok: false,

        message:
          `${sku} appears more than once in this outbound order.`,
      };
    }


    if (
      !Number.isFinite(
        requestedQty
      ) ||
      requestedQty <=
      0
    ) {
      return {
        ok: false,

        message:
          `Line ${index + 1}: Requested Quantity must be greater than 0.`,
      };
    }


    const availableQty =
      Number(
        availableBySku.get(
          sku
        ) ||
        0
      );


    if (
      requestedQty >
      availableQty
    ) {
      return {
        ok: false,

        message:
          `${sku}: Requested ${requestedQty}, but only ${availableQty} is available after reservations.`,
      };
    }


    usedSku.add(
      sku
    );


    normalizedLines.push({
      lineId:
        line.lineId ||
        createLineId(),

      sku,

      itemName:
        master.name,

      requestedQty,

      allocations:
        [],
    });
  }


  return {
    ok: true,

    order: {
      customer,
      reference,

      lines:
        normalizedLines,
    },
  };
}


/* =========================================================
   BUILD ALLOCATION
========================================================= */

function buildOrderAllocations({
  order,
  inventory,
  locations,
  orders,
}) {
  const locationMap =
    new Map(
      locations.map(
        (location) => [
          location.id,
          location,
        ]
      )
    );


  /*
   * ไม่รวม Reservation ของ Order
   * ตัวเองตอนคำนวณ
   */

  const reserved =
    getReservedInventoryMap(
      orders,
      order.id
    );


  const resultLines =
    [];


  for (
    const line
    of order.lines ||
    []
  ) {
    let remaining =
      Number(
        line.requestedQty ||
        0
      );


    const balances =
      inventory
        .filter(
          (item) => {
            if (
              item.sku !==
              line.sku
            ) {
              return false;
            }


            const location =
              locationMap.get(
                item.locationId
              );


            /*
             * FULL ยังหยิบออกได้
             *
             * BLOCKED / MAINTENANCE
             * หยิบไม่ได้
             */

            return (
              location &&
              ![
                "BLOCKED",
                "MAINTENANCE",
              ].includes(
                location.status
              )
            );
          }
        )
        .map(
          (item) => ({
            ...item,

            freeQty:
              Math.max(
                Number(
                  item.quantity ||
                  0
                ) -
                Number(
                  reserved.get(
                    item.id
                  ) ||
                  0
                ),

                0
              ),

            locationCode:
              locationMap.get(
                item.locationId
              )?.code ||
              item.locationId,
          })
        )
        .filter(
          (item) =>
            item.freeQty >
            0
        )
        .sort(
          (a, b) => {
            const qtyCompare =
              b.freeQty -
              a.freeQty;


            if (
              qtyCompare !==
              0
            ) {
              return qtyCompare;
            }


            return String(
              a.locationCode
            ).localeCompare(
              String(
                b.locationCode
              )
            );
          }
        );


    const allocations =
      [];


    for (
      const balance
      of balances
    ) {
      if (
        remaining <=
        0
      ) {
        break;
      }


      const qty =
        Math.min(
          remaining,
          balance.freeQty
        );


      allocations.push({
        inventoryId:
          balance.id,

        locationId:
          balance.locationId,

        qty,
      });


      remaining -=
        qty;
    }


    if (
      remaining >
      0
    ) {
      return {
        ok: false,

        message:
          `${line.sku}: Not enough free stock to allocate. Missing ${remaining}.`,
      };
    }


    resultLines.push({
      ...line,

      allocations,
    });
  }


  return {
    ok: true,

    lines:
      resultLines,
  };
}


/* =========================================================
   INVENTORY - FROM OUTBOUND PAGE
========================================================= */

function deductPickedInventory(
  inventory,
  order
) {
  const result =
    inventory.map(
      (item) => ({
        ...item,
      })
    );


  for (
    const line
    of order.lines ||
    []
  ) {
    for (
      const allocation
      of line.allocations ||
      []
    ) {
      const index =
        result.findIndex(
          (item) =>
            item.id ===
            allocation.inventoryId
        );


      if (
        index < 0
      ) {
        return {
          ok: false,

          message:
            `${line.sku}: Inventory record ${allocation.inventoryId} no longer exists.`,
        };
      }


      const currentQty =
        Number(
          result[
            index
          ].quantity ||
          0
        );


      const pickQty =
        Number(
          allocation.qty ||
          0
        );


      if (
        currentQty <
        pickQty
      ) {
        return {
          ok: false,

          message:
            `${line.sku}: Stock at ${allocation.locationId} changed. Need ${pickQty}, current quantity is ${currentQty}.`,
        };
      }


      result[
        index
      ] = {
        ...result[
          index
        ],

        quantity:
          currentQty -
          pickQty,
      };
    }
  }


  return {
    ok: true,

    inventory:
      result,
  };
}


/* =========================================================
   RESERVED INVENTORY
========================================================= */

function getReservedInventoryMap(
  orders,
  excludeOrderId = null
) {
  const reserved =
    new Map();


  orders.forEach(
    (order) => {
      if (
        order.id ===
          excludeOrderId ||
        !ACTIVE_RESERVATION_STATUSES.has(
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
          (
            line.allocations ||
            []
          ).forEach(
            (
              allocation
            ) => {
              reserved.set(
                allocation.inventoryId,

                Number(
                  reserved.get(
                    allocation.inventoryId
                  ) ||
                  0
                ) +
                Number(
                  allocation.qty ||
                  0
                )
              );
            }
          );
        }
      );
    }
  );


  return reserved;
}


/* =========================================================
   AVAILABLE STOCK
========================================================= */

function getAvailableStockBySku({
  inventory,
  locations,
  orders,
}) {
  const locationMap =
    new Map(
      locations.map(
        (location) => [
          location.id,
          location,
        ]
      )
    );


  const reserved =
    getReservedInventoryMap(
      orders
    );


  const result =
    new Map();


  inventory.forEach(
    (item) => {
      const location =
        locationMap.get(
          item.locationId
        );


      if (
        !location ||
        [
          "BLOCKED",
          "MAINTENANCE",
        ].includes(
          location.status
        )
      ) {
        return;
      }


      const freeQty =
        Math.max(
          Number(
            item.quantity ||
            0
          ) -
          Number(
            reserved.get(
              item.id
            ) ||
            0
          ),

          0
        );


      result.set(
        item.sku,

        Number(
          result.get(
            item.sku
          ) ||
          0
        ) +
        freeQty
      );
    }
  );


  return result;
}


/* =========================================================
   TOTAL REQUESTED
========================================================= */

function getOrderRequestedQty(
  order
) {
  return (
    order.lines ||
    []
  ).reduce(
    (
      sum,
      line
    ) =>
      sum +
      Number(
        line.requestedQty ||
        0
      ),

    0
  );
}


/* =========================================================
   TOTAL ALLOCATED
========================================================= */

function getOrderAllocatedQty(
  order
) {
  return (
    order.lines ||
    []
  ).reduce(
    (
      sum,
      line
    ) =>
      sum +
      (
        line.allocations ||
        []
      ).reduce(
        (
          lineSum,
          allocation
        ) =>
          lineSum +
          Number(
            allocation.qty ||
            0
          ),

        0
      ),

    0
  );
}


/* =========================================================
   LATEST ORDER FIRST
========================================================= */

function compareNewestFirst(
  a,
  b
) {
  const timeDifference =
    getOrderTime(
      b
    ) -
    getOrderTime(
      a
    );


  if (
    timeDifference !==
    0
  ) {
    return timeDifference;
  }


  return String(
    b.id ||
    ""
  ).localeCompare(
    String(
      a.id ||
      ""
    ),
    undefined,
    {
      numeric: true,
    }
  );
}


function getOrderTime(
  order
) {
  const time =
    new Date(
      order.createdAt ||
      ""
    ).getTime();


  return Number.isFinite(
    time
  )
    ? time
    : 0;
}


/* =========================================================
   OUTBOUND ID
========================================================= */

function getNextOutboundId(
  orders
) {
  let highest =
    0;


  orders.forEach(
    (order) => {
      const match =
        /^OUT-(\d+)$/i.exec(
          String(
            order.id ||
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


  return `OUT-${String(
    highest + 1
  ).padStart(
    3,
    "0"
  )}`;
}


/* =========================================================
   OUTBOUND NUMBER
========================================================= */

function generateOutboundNo(
  orders
) {
  const date =
    new Date();


  const datePart = [
    date.getFullYear(),

    String(
      date.getMonth() +
      1
    ).padStart(
      2,
      "0"
    ),

    String(
      date.getDate()
    ).padStart(
      2,
      "0"
    ),
  ].join("");


  let counter =
    1;


  while (true) {
    const orderNo =
      `OUT-${datePart}-${String(
        counter
      ).padStart(
        3,
        "0"
      )}`;


    const exists =
      orders.some(
        (order) =>
          order.orderNo ===
          orderNo
      );


    if (!exists) {
      return orderNo;
    }


    counter +=
      1;
  }
}


/* =========================================================
   LINE ID
========================================================= */

function createLineId() {
  return `OLINE-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 7)}`;
}


function createEmptyLine() {
  return {
    lineId:
      createLineId(),

    sku:
      "",

    itemName:
      "",

    requestedQty:
      1,

    allocations:
      [],
  };
}


/* =========================================================
   DATE
========================================================= */

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
   LOAD OUTBOUND
========================================================= */

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


  return INITIAL_OUTBOUND;
}


/* =========================================================
   LOAD INVENTORY
========================================================= */

function loadInventory() {
  try {
    const saved =
      localStorage.getItem(
        INVENTORY_STORAGE_KEY
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
      "Could not load Inventory.",
      error
    );
  }


  return [];
}


/* =========================================================
   LOAD LOCATIONS
========================================================= */

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