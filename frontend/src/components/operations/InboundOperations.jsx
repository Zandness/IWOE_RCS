import {
  AlertTriangle,
  ArrowDownToLine,
  CheckCircle2,
  ClipboardList,
  Package,
  Pencil,
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
  INBOUND_STORAGE_KEY,
  INVENTORY_STORAGE_KEY,
  LOCATION_STORAGE_KEY,
  notifyWmsDataChanged,
} from "../../utils/taskOperationSync";

import "../../styles/Inbound.css";


const INITIAL_INBOUND =
  [];


export default function InboundOperations({
  embedded = false,
}) {
  const [
    orders,
    setOrders,
  ] = useState(
    loadInboundOrders
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
    showReceiveForm,
    setShowReceiveForm,
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
    saveMessage,
    setSaveMessage,
  ] = useState("");


  /*
   * =====================================================
   * SAVE INBOUND
   * =====================================================
   */

  useEffect(() => {
    try {
      localStorage.setItem(
        INBOUND_STORAGE_KEY,

        JSON.stringify(
          orders
        )
      );


      setSaveMessage(
        "Saved locally"
      );
    } catch (error) {
      console.error(
        "Could not save inbound orders.",
        error
      );


      setSaveMessage(
        "Local save failed"
      );
    }
  }, [orders]);


  /*
   * =====================================================
   * SYNC FROM TASK / STORAGE
   * =====================================================
   */

  useEffect(() => {
    function refreshRelatedData() {
      setOrders(
        loadInboundOrders()
      );

      setInventory(
        loadInventory()
      );

      setLocations(
        loadLocations()
      );
    }


    function handleStorage(
      event
    ) {
      if (
        event.key ===
          INBOUND_STORAGE_KEY &&
        event.newValue
      ) {
        setOrders(
          loadInboundOrders()
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
     * Task Management -> Inbound
     */

    function handleWmsDataChanged(
      event
    ) {
      const keys =
        event.detail?.keys ||
        [];


      if (
        keys.includes(
          INBOUND_STORAGE_KEY
        )
      ) {
        setOrders(
          loadInboundOrders()
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
      refreshRelatedData
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
        refreshRelatedData
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
   * SKU MASTER
   * =====================================================
   */

  const skuMasters =
    useMemo(() => {
      const result =
        new Map();


      inventory.forEach(
        (item) => {
          if (
            !item.sku ||
            result.has(
              item.sku
            )
          ) {
            return;
          }


          result.set(
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

              minStock:
                item.minStock,

              maxStock:
                item.maxStock,
            }
          );
        }
      );


      return Array.from(
        result.values()
      ).sort(
        (a, b) =>
          a.sku.localeCompare(
            b.sku
          )
      );
    }, [inventory]);


  /*
   * =====================================================
   * SEARCH + NEWEST FIRST
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
              order.receiptNo,
              order.supplier,
              order.reference,
              order.status,

              ...(
                order.lines ||
                []
              ).flatMap(
                (line) => [
                  line.sku,
                  line.itemName,
                  line.locationId,
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

        /*
         * LATEST ORDER FIRST
         */

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
      const draft =
        orders.filter(
          (order) =>
            order.status ===
            "DRAFT"
        ).length;


      const received =
        orders.filter(
          (order) =>
            order.status ===
            "RECEIVED"
        ).length;


      const completed =
        orders.filter(
          (order) =>
            order.status ===
            "COMPLETED"
        ).length;


      const incomingQty =
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
              (
                order.lines ||
                []
              ).reduce(
                (
                  lineSum,
                  line
                ) =>
                  lineSum +
                  Number(
                    line.expectedQty ||
                    0
                  ),

                0
              ),

            0
          );


      return {
        draft,
        received,
        completed,
        incomingQty,
      };
    }, [orders]);


  /*
   * =====================================================
   * ADD
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
        "Only Draft inbound orders can be deleted."
      );

      return;
    }


    const confirmed =
      window.confirm(
        `Delete inbound order ${order.receiptNo}?`
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


    /*
     * If the Draft is currently open in a modal,
     * close the modal after deletion.
     */

    if (
      selectedOrder?.id ===
      order.id
    ) {
      setShowOrderForm(false);
      setShowReceiveForm(false);
      setSelectedOrder(null);
    }


    return true;
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
      validateInboundOrder({
        formData,
        skuMasters,
      });


    if (!validation.ok) {
      return validation;
    }


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
      const now =
        new Date().toISOString();


      setOrders(
        (current) => [
          ...current,

          {
            id:
              getNextInboundId(
                current
              ),

            receiptNo:
              generateReceiptNo(
                current
              ),

            status:
              "DRAFT",

            createdAt:
              now,

            receivedAt:
              "",

            completedAt:
              "",

            ...validation.order,
          },
        ]
      );
    }


    setSelectedOrder(
      null
    );


    setShowOrderForm(
      false
    );


    return {
      ok: true,
    };
  }


  /*
   * =====================================================
   * RECEIVE
   * =====================================================
   */

  function handleOpenReceive(
    order
  ) {
    if (
      order.status !==
      "DRAFT"
    ) {
      return;
    }


    if (
      !order.lines?.length
    ) {
      window.alert(
        "This inbound order has no items."
      );

      return;
    }


    setSelectedOrder(
      order
    );


    setShowReceiveForm(
      true
    );
  }


  function handleReceive(
    receiveLines
  ) {
    if (!selectedOrder) {
      return {
        ok: false,

        message:
          "Inbound order not found.",
      };
    }


    const validation =
      validateReceiveLines({
        order:
          selectedOrder,

        receiveLines,

        locations,
      });


    if (!validation.ok) {
      return validation;
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
                    "RECEIVED",

                  receivedAt:
                    now,

                  lines:
                    validation.lines,
                }
              : order
        )
    );


    setShowReceiveForm(
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
   * PUTAWAY FROM OPERATIONS PAGE
   * =====================================================
   */

  function handleCompletePutaway(
    order
  ) {
    if (
      order.status !==
      "RECEIVED"
    ) {
      return;
    }


    const confirmed =
      window.confirm(
        `Complete putaway for ${order.receiptNo}?\n\nReceived quantities will be added to Inventory.`
      );


    if (!confirmed) {
      return;
    }


    const currentInventory =
      loadInventory();


    const result =
      applyPutawayToInventory({
        inventory:
          currentInventory,

        order,
      });


    if (!result.ok) {
      window.alert(
        result.message
      );

      return;
    }


    try {
      localStorage.setItem(
        INVENTORY_STORAGE_KEY,

        JSON.stringify(
          result.inventory
        )
      );
    } catch (error) {
      console.error(
        "Could not update inventory.",
        error
      );


      window.alert(
        "Inventory update failed. Putaway was not completed."
      );


      return;
    }


    setInventory(
      result.inventory
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
                    "COMPLETED",

                  completedAt:
                    new Date().toISOString(),
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
   * UI
   * =====================================================
   */

  return (
    <div
      className={`inbound-page ${
        embedded
          ? "inbound-embedded"
          : ""
      }`}
    >

      {/* HEADER */}

      <div className="inbound-header">
        <div>
          <span className="inbound-label">
            INBOUND OPERATIONS
          </span>

          <h2>
            Inbound / Receiving
          </h2>

          <p>
            Create inbound orders,
            receive incoming goods
            and complete putaway.
          </p>
        </div>


        <div className="inbound-header-actions">
          {saveMessage && (
            <span
              className={`inbound-save-state ${
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
            className="inbound-add-button"
            onClick={
              handleAddOrder
            }
          >
            <Plus
              size={18}
            />

            New Inbound
          </button>
        </div>
      </div>


      {/* SUMMARY */}

      <div className="inbound-summary-grid">
        <SummaryCard
          icon={
            <ClipboardList
              size={21}
            />
          }
          title="Draft"
          value={
            summary.draft
          }
        />


        <SummaryCard
          icon={
            <ArrowDownToLine
              size={21}
            />
          }
          title="Waiting Putaway"
          value={
            summary.received
          }
          tone="warning"
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


        <SummaryCard
          icon={
            <Package
              size={21}
            />
          }
          title="Incoming Qty"
          value={
            summary.incomingQty
          }
        />
      </div>


      {/* TABLE */}

      <section className="inbound-panel">
        <div className="inbound-panel-header">
          <div>
            <h3>
              Inbound Orders
            </h3>

            <p>
              Newest orders are
              shown first.
            </p>
          </div>


          <div className="inbound-toolbar">
            <div className="inbound-search">
              <Search
                size={17}
              />

              <input
                value={
                  search
                }
                placeholder="Search inbound, supplier or SKU..."
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
              className="inbound-filter"
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

              <option value="RECEIVED">
                Waiting Putaway
              </option>

              <option value="COMPLETED">
                Completed
              </option>
            </select>
          </div>
        </div>


        <div className="inbound-table-wrapper">
          <table className="inbound-table">
            <thead>
              <tr>
                <th>
                  Inbound
                </th>

                <th>
                  Supplier
                </th>

                <th>
                  Reference
                </th>

                <th>
                  Items
                </th>

                <th>
                  Expected
                </th>

                <th>
                  Received
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
                      <div className="inbound-code-cell">
                        <div className="inbound-code-icon">
                          <Truck
                            size={17}
                          />
                        </div>

                        <div>
                          <strong>
                            {
                              order.receiptNo
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
                        order.supplier
                      }
                    </td>


                    <td>
                      <span className="inbound-reference">
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
                        getOrderExpectedQty(
                          order
                        )
                      }
                    </td>


                    <td>
                      {order.status ===
                      "DRAFT"
                        ? "-"
                        : getOrderReceivedQty(
                            order
                          )}
                    </td>


                    <td>
                      <StatusBadge
                        status={
                          order.status
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
                      <div className="inbound-actions">

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
                              title="Receive"
                              className="receive"
                              onClick={() =>
                                handleOpenReceive(
                                  order
                                )
                              }
                            >
                              <ArrowDownToLine
                                size={15}
                              />
                            </button>


                            <button
                              type="button"
                              title="Delete"
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


                        {order.status ===
                          "RECEIVED" && (
                          <button
                            type="button"
                            className="putaway"
                            onClick={() =>
                              handleCompletePutaway(
                                order
                              )
                            }
                          >
                            <CheckCircle2
                              size={15}
                            />

                            Putaway
                          </button>
                        )}


                        {order.status ===
                          "COMPLETED" && (
                          <span className="inbound-done">
                            Completed
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
            <div className="inbound-empty">
              No inbound orders found.
            </div>
          )}
        </div>
      </section>


      {/* CREATE / EDIT */}

      {showOrderForm && (
        <InboundOrderForm
          order={
            selectedOrder
          }
          skuMasters={
            skuMasters
          }
          onSave={
            handleSaveOrder
          }
          onDelete={
            selectedOrder
              ? () =>
                  handleDeleteOrder(
                    selectedOrder
                  )
              : null
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


      {/* RECEIVE */}

      {showReceiveForm &&
        selectedOrder && (
          <ReceiveForm
            order={
              selectedOrder
            }
            locations={
              locations
            }
            onSave={
              handleReceive
            }
            onDelete={() =>
              handleDeleteOrder(
                selectedOrder
              )
            }
            onCancel={() => {
              setShowReceiveForm(
                false
              );

              setSelectedOrder(
                null
              );
            }}
          />
        )}
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
      className={`inbound-summary-card tone-${tone}`}
    >
      <div className="inbound-summary-icon">
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
 * STATUS
 * =====================================================
 */

function StatusBadge({
  status,
}) {
  const label =
    status ===
    "RECEIVED"
      ? "Waiting Putaway"
      : status ===
        "COMPLETED"
        ? "Completed"
        : "Draft";


  return (
    <span
      className={`inbound-status status-${status.toLowerCase()}`}
    >
      {label}
    </span>
  );
}


/*
 * =====================================================
 * ORDER FORM
 * =====================================================
 */

function InboundOrderForm({
  order,
  skuMasters,
  onSave,
  onDelete,
  onCancel,
}) {
  const [
    form,
    setForm,
  ] = useState({
    supplier:
      order?.supplier ||
      "",

    reference:
      order?.reference ||
      "",

    lines:
      order?.lines?.map(
        (line) => ({
          ...line,
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


        lines[
          index
        ] = {
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


          lines[
            index
          ].itemName =
            master?.name ||
            "";
        }


        return {
          ...current,
          lines,
        };
      }
    );


    setError("");
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
        "Could not save inbound order."
      );
    }
  }


  return (
    <div
      className="inbound-modal-backdrop"
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
        className="inbound-modal inbound-order-modal"
        onSubmit={
          handleSubmit
        }
      >
        <div className="inbound-modal-header">
          <div>
            <span>
              INBOUND MANAGEMENT
            </span>

            <h3>
              {order
                ? "Edit Inbound Order"
                : "New Inbound Order"}
            </h3>
          </div>

          <button
            type="button"
            className="inbound-close"
            onClick={
              onCancel
            }
          >
            ×
          </button>
        </div>


        <div className="inbound-form-body">
          <div className="inbound-form-grid">
            <FormField
              label="Supplier"
              value={
                form.supplier
              }
              placeholder="Supplier name"
              onChange={(
                value
              ) =>
                updateField(
                  "supplier",
                  value
                )
              }
            />


            <FormField
              label="Reference / PO"
              value={
                form.reference
              }
              placeholder="PO-2026-001"
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


          <div className="inbound-lines-header">
            <div>
              <strong>
                Inbound Items
              </strong>

              <span>
                Select SKU and
                expected quantity.
              </span>
            </div>


            <button
              type="button"
              onClick={() =>
                setForm(
                  (current) => ({
                    ...current,

                    lines: [
                      ...current.lines,

                      createEmptyLine(),
                    ],
                  })
                )
              }
            >
              <Plus
                size={15}
              />

              Add Line
            </button>
          </div>


          <div className="inbound-lines">
            {form.lines.map(
              (
                line,
                index
              ) => (
                <div
                  className="inbound-line"
                  key={
                    line.lineId
                  }
                >
                  <div className="inbound-line-number">
                    {
                      index +
                      1
                    }
                  </div>


                  <label className="inbound-field">
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


                  <label className="inbound-field">
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


                  <label className="inbound-field inbound-qty-field">
                    <span>
                      Expected Qty
                    </span>

                    <input
                      type="number"
                      min="1"
                      value={
                        line.expectedQty
                      }
                      onChange={(
                        event
                      ) =>
                        updateLine(
                          index,
                          "expectedQty",
                          event
                            .target
                            .value
                        )
                      }
                    />
                  </label>


                  <button
                    type="button"
                    className="inbound-remove-line"
                    disabled={
                      form.lines
                        .length <=
                      1
                    }
                    onClick={() =>
                      setForm(
                        (current) => ({
                          ...current,

                          lines:
                            current.lines.filter(
                              (
                                _,
                                i
                              ) =>
                                i !==
                                index
                            ),
                        })
                      )
                    }
                  >
                    <Trash2
                      size={15}
                    />
                  </button>
                </div>
              )
            )}
          </div>


          {skuMasters.length ===
            0 && (
            <div className="inbound-form-warning">
              <AlertTriangle
                size={16}
              />

              <span>
                No SKU is available.
                Create Inventory /
                SKU first.
              </span>
            </div>
          )}


          {error && (
            <div className="inbound-form-error">
              <AlertTriangle
                size={16}
              />

              <span>
                {error}
              </span>
            </div>
          )}
        </div>


        <div className="inbound-modal-actions">
          {order &&
            onDelete && (
            <button
              type="button"
              className="inbound-delete-draft"
              onClick={
                onDelete
              }
            >
              <Trash2
                size={15}
              />

              Delete Draft
            </button>
          )}


          <button
            type="button"
            className="inbound-cancel"
            onClick={
              onCancel
            }
          >
            Cancel
          </button>


          <button
            type="submit"
            className="inbound-save"
          >
            {order
              ? "Save Changes"
              : "Create Inbound"}
          </button>
        </div>
      </form>
    </div>
  );
}


/*
 * =====================================================
 * RECEIVE FORM
 * =====================================================
 */

function ReceiveForm({
  order,
  locations,
  onSave,
  onDelete,
  onCancel,
}) {
  const [
    lines,
    setLines,
  ] = useState(
    order.lines.map(
      (line) => ({
        lineId:
          line.lineId,

        sku:
          line.sku,

        itemName:
          line.itemName,

        expectedQty:
          Number(
            line.expectedQty ||
            0
          ),

        receivedQty:
          line.receivedQty ||
          line.expectedQty ||
          0,

        locationId:
          line.locationId ||
          "",
      })
    )
  );


  const [
    error,
    setError,
  ] = useState("");


  const availableLocations =
    useMemo(
      () =>
        locations
          .filter(
            (location) =>
              ![
                "FULL",
                "BLOCKED",
                "MAINTENANCE",
              ].includes(
                location.status
              )
          )
          .sort(
            (a, b) =>
              String(
                a.code
              ).localeCompare(
                String(
                  b.code
                )
              )
          ),

      [locations]
    );


  function updateLine(
    index,
    field,
    value
  ) {
    setLines(
      (current) => {
        const next = [
          ...current,
        ];


        next[
          index
        ] = {
          ...next[
            index
          ],

          [field]:
            value,
        };


        return next;
      }
    );


    setError("");
  }


  function handleSubmit(
    event
  ) {
    event.preventDefault();


    const result =
      onSave(
        lines
      );


    if (!result?.ok) {
      setError(
        result?.message ||
        "Could not receive inbound order."
      );
    }
  }


  return (
    <div
      className="inbound-modal-backdrop"
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
        className="inbound-modal receive-modal"
        onSubmit={
          handleSubmit
        }
      >
        <div className="inbound-modal-header">
          <div>
            <span>
              RECEIVING
            </span>

            <h3>
              Receive
              {" "}
              {
                order.receiptNo
              }
            </h3>
          </div>


          <button
            type="button"
            className="inbound-close"
            onClick={
              onCancel
            }
          >
            ×
          </button>
        </div>


        <div className="inbound-form-body">
          <div className="receive-info">
            <div>
              <span>
                Supplier
              </span>

              <strong>
                {
                  order.supplier
                }
              </strong>
            </div>


            <div>
              <span>
                Reference
              </span>

              <strong>
                {
                  order.reference ||
                  "-"
                }
              </strong>
            </div>
          </div>


          <div className="receive-lines">
            {lines.map(
              (
                line,
                index
              ) => (
                <div
                  className="receive-line"
                  key={
                    line.lineId
                  }
                >
                  <div className="receive-product">
                    <div className="receive-product-icon">
                      <Package
                        size={17}
                      />
                    </div>

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


                  <div className="receive-expected">
                    <span>
                      Expected
                    </span>

                    <strong>
                      {
                        line.expectedQty
                      }
                    </strong>
                  </div>


                  <label className="inbound-field">
                    <span>
                      Received Qty
                    </span>

                    <input
                      type="number"
                      min="1"
                      max={
                        line.expectedQty
                      }
                      value={
                        line.receivedQty
                      }
                      onChange={(
                        event
                      ) =>
                        updateLine(
                          index,
                          "receivedQty",
                          event
                            .target
                            .value
                        )
                      }
                    />
                  </label>


                  <label className="inbound-field">
                    <span>
                      Putaway Location
                    </span>

                    <select
                      value={
                        line.locationId
                      }
                      onChange={(
                        event
                      ) =>
                        updateLine(
                          index,
                          "locationId",
                          event
                            .target
                            .value
                        )
                      }
                    >
                      <option value="">
                        Select location
                      </option>

                      {availableLocations.map(
                        (
                          location
                        ) => (
                          <option
                            key={
                              location.id
                            }
                            value={
                              location.id
                            }
                          >
                            {
                              location.code
                            }
                            {" - "}
                            {
                              location.zone
                            }
                            {" / "}
                            {
                              location.rack
                            }
                            {" / L"}
                            {
                              location.level
                            }
                          </option>
                        )
                      )}
                    </select>
                  </label>
                </div>
              )
            )}
          </div>


          {availableLocations.length ===
            0 && (
            <div className="inbound-form-warning">
              <AlertTriangle
                size={16}
              />

              <span>
                No available Storage
                Location exists for
                putaway.
              </span>
            </div>
          )}


          {error && (
            <div className="inbound-form-error">
              <AlertTriangle
                size={16}
              />

              <span>
                {error}
              </span>
            </div>
          )}
        </div>


        <div className="inbound-modal-actions">
          <button
            type="button"
            className="inbound-delete-draft"
            onClick={
              onDelete
            }
          >
            <Trash2
              size={15}
            />

            Delete Draft
          </button>


          <button
            type="button"
            className="inbound-cancel"
            onClick={
              onCancel
            }
          >
            Cancel
          </button>

          <button
            type="submit"
            className="inbound-save"
          >
            Confirm Receiving
          </button>
        </div>
      </form>
    </div>
  );
}


/*
 * =====================================================
 * FIELD
 * =====================================================
 */

function FormField({
  label,
  value,
  onChange,
  placeholder,
}) {
  return (
    <label className="inbound-field">
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


/*
 * =====================================================
 * VALIDATE INBOUND
 * =====================================================
 */

function validateInboundOrder({
  formData,
  skuMasters,
}) {
  const supplier =
    String(
      formData.supplier ||
      ""
    ).trim();


  const reference =
    String(
      formData.reference ||
      ""
    ).trim();


  if (!supplier) {
    return {
      ok: false,
      message:
        "Please enter Supplier.",
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
        "Add at least one inbound item.",
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


    const expectedQty =
      Number(
        line.expectedQty
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
          `${sku} appears more than once in this inbound order.`,
      };
    }


    if (
      !Number.isFinite(
        expectedQty
      ) ||
      expectedQty <= 0
    ) {
      return {
        ok: false,

        message:
          `Line ${index + 1}: Expected Quantity must be greater than 0.`,
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

      expectedQty,

      receivedQty:
        0,

      locationId:
        "",
    });
  }


  return {
    ok: true,

    order: {
      supplier,
      reference,

      lines:
        normalizedLines,
    },
  };
}


/*
 * =====================================================
 * VALIDATE RECEIVE
 * =====================================================
 */

function validateReceiveLines({
  order,
  receiveLines,
  locations,
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


  const result =
    [];


  for (
    let index = 0;
    index <
    order.lines.length;
    index += 1
  ) {
    const sourceLine =
      order.lines[
        index
      ];


    const inputLine =
      receiveLines.find(
        (line) =>
          line.lineId ===
          sourceLine.lineId
      ) || {};


    const receivedQty =
      Number(
        inputLine.receivedQty
      );


    const expectedQty =
      Number(
        sourceLine.expectedQty
      );


    const locationId =
      String(
        inputLine.locationId ||
        ""
      ).trim();


    if (
      !Number.isFinite(
        receivedQty
      ) ||
      receivedQty <= 0
    ) {
      return {
        ok: false,

        message:
          `${sourceLine.sku}: Received Quantity must be greater than 0.`,
      };
    }


    if (
      receivedQty >
      expectedQty
    ) {
      return {
        ok: false,

        message:
          `${sourceLine.sku}: Received Quantity cannot be greater than Expected Quantity in V1.`,
      };
    }


    if (!locationId) {
      return {
        ok: false,

        message:
          `${sourceLine.sku}: Please select Putaway Location.`,
      };
    }


    const location =
      locationMap.get(
        locationId
      );


    if (!location) {
      return {
        ok: false,

        message:
          `${sourceLine.sku}: Storage Location does not exist.`,
      };
    }


    if (
      [
        "FULL",
        "BLOCKED",
        "MAINTENANCE",
      ].includes(
        location.status
      )
    ) {
      return {
        ok: false,

        message:
          `${location.code} cannot be used for putaway because its status is ${location.status}.`,
      };
    }


    result.push({
      ...sourceLine,

      receivedQty,

      locationId,
    });
  }


  return {
    ok: true,

    lines:
      result,
  };
}


/*
 * =====================================================
 * INVENTORY +
 * =====================================================
 */

function applyPutawayToInventory({
  inventory,
  order,
}) {
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
    const qty =
      Number(
        line.receivedQty ||
        0
      );


    if (
      qty <= 0
    ) {
      continue;
    }


    const existingIndex =
      result.findIndex(
        (item) =>
          item.sku ===
            line.sku &&
          item.locationId ===
            line.locationId
      );


    if (
      existingIndex >=
      0
    ) {
      result[
        existingIndex
      ] = {
        ...result[
          existingIndex
        ],

        quantity:
          Number(
            result[
              existingIndex
            ].quantity ||
            0
          ) + qty,
      };


      continue;
    }


    const master =
      result.find(
        (item) =>
          item.sku ===
          line.sku
      );


    if (!master) {
      return {
        ok: false,

        message:
          `${line.sku}: Inventory SKU master does not exist.`,
      };
    }


    result.push({
      id:
        getNextInventoryId(
          result
        ),

      sku:
        master.sku,

      name:
        master.name,

      category:
        master.category,

      unit:
        master.unit,

      quantity:
        qty,

      minStock:
        master.minStock,

      maxStock:
        master.maxStock,

      locationId:
        line.locationId,
    });
  }


  return {
    ok: true,

    inventory:
      result,
  };
}


/*
 * =====================================================
 * ORDER TOTAL
 * =====================================================
 */

function getOrderExpectedQty(
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
        line.expectedQty ||
        0
      ),

    0
  );
}


function getOrderReceivedQty(
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
        line.receivedQty ||
        0
      ),

    0
  );
}


/*
 * =====================================================
 * NEWEST FIRST
 * =====================================================
 */

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


/*
 * =====================================================
 * ID
 * =====================================================
 */

function getNextInboundId(
  orders
) {
  let highest =
    0;


  orders.forEach(
    (order) => {
      const match =
        /^INB-(\d+)$/i.exec(
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


  return `INB-${String(
    highest + 1
  ).padStart(
    3,
    "0"
  )}`;
}


function getNextInventoryId(
  items
) {
  let highest =
    0;


  items.forEach(
    (item) => {
      const match =
        /^INV-(\d+)$/i.exec(
          String(
            item.id ||
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


  return `INV-${String(
    highest + 1
  ).padStart(
    3,
    "0"
  )}`;
}


function generateReceiptNo(
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
    const receiptNo =
      `RCV-${datePart}-${String(
        counter
      ).padStart(
        3,
        "0"
      )}`;


    if (
      !orders.some(
        (order) =>
          order.receiptNo ===
          receiptNo
      )
    ) {
      return receiptNo;
    }


    counter +=
      1;
  }
}


function createLineId() {
  return `LINE-${Date.now()}-${Math.random()
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

    expectedQty:
      1,

    receivedQty:
      0,

    locationId:
      "",
  };
}


/*
 * =====================================================
 * FORMAT
 * =====================================================
 */

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


/*
 * =====================================================
 * LOAD
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


  return INITIAL_INBOUND;
}


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