import {
  AlertTriangle,
  ArrowDownToLine,
  CheckCircle2,
  ClipboardList,
  MapPin,
  Package,
  Pencil,
  Plus,
  Search,
  Trash2,
  Truck,
} from "lucide-react";

import { useEffect, useMemo, useState } from "react";

import "../../styles/Inbound.css";

const INBOUND_STORAGE_KEY = "wms-inbound-orders-v1";
const INVENTORY_STORAGE_KEY = "wms-inventory-items-v1";
const LOCATION_STORAGE_KEY = "wms-storage-locations-v1";

const INITIAL_INBOUND = [];

export default function InboundOperations({
  embedded = false,
}) {
  const [orders, setOrders] = useState(loadInboundOrders);
  const [inventory, setInventory] = useState(loadInventory);
  const [locations, setLocations] = useState(loadLocations);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const [showOrderForm, setShowOrderForm] = useState(false);
  const [showReceiveForm, setShowReceiveForm] = useState(false);

  const [selectedOrder, setSelectedOrder] = useState(null);

  const [saveMessage, setSaveMessage] = useState("");

  /*
   * =====================================================
   * SAVE INBOUND ORDERS
   * =====================================================
   */

  useEffect(() => {
    try {
      localStorage.setItem(
        INBOUND_STORAGE_KEY,
        JSON.stringify(orders)
      );

      setSaveMessage("Saved locally");
    } catch (error) {
      console.error("Could not save inbound orders.", error);

      setSaveMessage("Local save failed");
    }
  }, [orders]);

  /*
   * =====================================================
   * REFRESH RELATED DATA
   * =====================================================
   */

  useEffect(() => {
    function refreshRelatedData() {
      setInventory(loadInventory());
      setLocations(loadLocations());
    }

    function handleStorage(event) {
      if (event.key === INVENTORY_STORAGE_KEY) {
        setInventory(loadInventory());
      }

      if (event.key === LOCATION_STORAGE_KEY) {
        setLocations(loadLocations());
      }

      if (
        event.key === INBOUND_STORAGE_KEY &&
        event.newValue
      ) {
        setOrders(loadInboundOrders());
      }
    }

    window.addEventListener("focus", refreshRelatedData);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener("focus", refreshRelatedData);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  /*
   * =====================================================
   * SKU MASTER
   * =====================================================
   */

  const skuMasters = useMemo(() => {
    const result = new Map();

    inventory.forEach((item) => {
      if (!item.sku) {
        return;
      }

      if (!result.has(item.sku)) {
        result.set(item.sku, {
          sku: item.sku,
          name: item.name,
          category: item.category,
          unit: item.unit,
          minStock: item.minStock,
          maxStock: item.maxStock,
        });
      }
    });

    return Array.from(result.values()).sort((a, b) =>
      a.sku.localeCompare(b.sku)
    );
  }, [inventory]);

  /*
   * =====================================================
   * SEARCH + FILTER
   * =====================================================
   */

  const filteredOrders = useMemo(() => {
    const query = search.trim().toLowerCase();

    return orders.filter((order) => {
      const matchesStatus =
        statusFilter === "ALL" ||
        order.status === statusFilter;

      const searchable = [
        order.id,
        order.receiptNo,
        order.supplier,
        order.reference,
        order.status,
        ...(order.lines || []).flatMap((line) => [
          line.sku,
          line.itemName,
          line.locationId,
        ]),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !query || searchable.includes(query);

      return matchesStatus && matchesSearch;
    });
  }, [orders, search, statusFilter]);

  /*
   * =====================================================
   * SUMMARY
   * =====================================================
   */

  const summary = useMemo(() => {
    const draft = orders.filter(
      (order) => order.status === "DRAFT"
    ).length;

    const received = orders.filter(
      (order) => order.status === "RECEIVED"
    ).length;

    const completed = orders.filter(
      (order) => order.status === "COMPLETED"
    ).length;

    const incomingQty = orders
      .filter((order) => order.status !== "COMPLETED")
      .reduce(
        (sum, order) =>
          sum +
          (order.lines || []).reduce(
            (lineSum, line) =>
              lineSum + Number(line.expectedQty || 0),
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
   * ADD ORDER
   * =====================================================
   */

  function handleAddOrder() {
    setSelectedOrder(null);
    setShowOrderForm(true);
  }

  /*
   * =====================================================
   * EDIT ORDER
   * =====================================================
   */

  function handleEditOrder(order) {
    if (order.status !== "DRAFT") {
      return;
    }

    setSelectedOrder(order);
    setShowOrderForm(true);
  }

  /*
   * =====================================================
   * DELETE ORDER
   * =====================================================
   */

  function handleDeleteOrder(order) {
    if (order.status !== "DRAFT") {
      window.alert(
        "Only Draft inbound orders can be deleted."
      );

      return;
    }

    const confirmed = window.confirm(
      `Delete inbound order ${order.receiptNo}?`
    );

    if (!confirmed) {
      return;
    }

    setOrders((current) =>
      current.filter((item) => item.id !== order.id)
    );
  }

  /*
   * =====================================================
   * SAVE ORDER FORM
   * =====================================================
   */

  function handleSaveOrder(formData) {
    const validation = validateInboundOrder({
      formData,
      editingId: selectedOrder?.id || null,
      orders,
      skuMasters,
    });

    if (!validation.ok) {
      return validation;
    }

    if (selectedOrder) {
      setOrders((current) =>
        current.map((order) =>
          order.id === selectedOrder.id
            ? {
                ...order,
                ...validation.order,
              }
            : order
        )
      );
    } else {
      const now = new Date().toISOString();

      setOrders((current) => [
        ...current,
        {
          id: getNextInboundId(current),
          receiptNo: generateReceiptNo(current),
          status: "DRAFT",
          createdAt: now,
          receivedAt: "",
          completedAt: "",
          ...validation.order,
        },
      ]);
    }

    setSelectedOrder(null);
    setShowOrderForm(false);

    return {
      ok: true,
    };
  }

  /*
   * =====================================================
   * RECEIVE
   * =====================================================
   */

  function handleOpenReceive(order) {
    if (order.status !== "DRAFT") {
      return;
    }

    if (!order.lines?.length) {
      window.alert("This inbound order has no items.");
      return;
    }

    setSelectedOrder(order);
    setShowReceiveForm(true);
  }

  function handleReceive(receiveLines) {
    if (!selectedOrder) {
      return {
        ok: false,
        message: "Inbound order not found.",
      };
    }

    const validation = validateReceiveLines({
      order: selectedOrder,
      receiveLines,
      locations,
    });

    if (!validation.ok) {
      return validation;
    }

    const now = new Date().toISOString();

    setOrders((current) =>
      current.map((order) =>
        order.id === selectedOrder.id
          ? {
              ...order,
              status: "RECEIVED",
              receivedAt: now,
              lines: validation.lines,
            }
          : order
      )
    );

    setShowReceiveForm(false);
    setSelectedOrder(null);

    return {
      ok: true,
    };
  }

  /*
   * =====================================================
   * COMPLETE PUTAWAY
   * =====================================================
   */

  function handleCompletePutaway(order) {
    if (order.status !== "RECEIVED") {
      return;
    }

    const confirmed = window.confirm(
      `Complete putaway for ${order.receiptNo}?\n\nReceived quantities will be added to Inventory.`
    );

    if (!confirmed) {
      return;
    }

    const currentInventory = loadInventory();

    const updatedInventory = applyPutawayToInventory({
      inventory: currentInventory,
      order,
    });

    try {
      localStorage.setItem(
        INVENTORY_STORAGE_KEY,
        JSON.stringify(updatedInventory)
      );
    } catch (error) {
      console.error("Could not update inventory.", error);

      window.alert(
        "Inventory update failed. Putaway was not completed."
      );

      return;
    }

    setInventory(updatedInventory);

    const now = new Date().toISOString();

    setOrders((current) =>
      current.map((item) =>
        item.id === order.id
          ? {
              ...item,
              status: "COMPLETED",
              completedAt: now,
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
            WAREHOUSE MANAGEMENT
          </span>

          <h2>Inbound / Receiving</h2>

          <p>
            Create inbound orders, receive incoming goods
            and complete warehouse putaway.
          </p>
        </div>

        <div className="inbound-header-actions">
          {saveMessage && (
            <span
              className={`inbound-save-state ${
                saveMessage.includes("failed")
                  ? "error"
                  : ""
              }`}
            >
              {saveMessage}
            </span>
          )}

          <button
            className="inbound-add-button"
            onClick={handleAddOrder}
          >
            <Plus size={18} />
            New Inbound
          </button>
        </div>
      </div>

      {/* SUMMARY */}

      <div className="inbound-summary-grid">
        <SummaryCard
          icon={<ClipboardList size={21} />}
          title="Draft"
          value={summary.draft}
        />

        <SummaryCard
          icon={<ArrowDownToLine size={21} />}
          title="Waiting Putaway"
          value={summary.received}
          tone="warning"
        />

        <SummaryCard
          icon={<CheckCircle2 size={21} />}
          title="Completed"
          value={summary.completed}
          tone="success"
        />

        <SummaryCard
          icon={<Package size={21} />}
          title="Incoming Qty"
          value={summary.incomingQty}
        />
      </div>

      {/* PANEL */}

      <section className="inbound-panel">
        <div className="inbound-panel-header">
          <div>
            <h3>Inbound Orders</h3>

            <p>
              Receive products and assign destination
              storage locations before putaway.
            </p>
          </div>

          <div className="inbound-toolbar">
            <div className="inbound-search">
              <Search size={17} />

              <input
                type="text"
                placeholder="Search inbound, supplier or SKU..."
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
              />
            </div>

            <select
              className="inbound-filter"
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value)
              }
            >
              <option value="ALL">All status</option>
              <option value="DRAFT">Draft</option>
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
                <th>Inbound</th>
                <th>Supplier</th>
                <th>Reference</th>
                <th>Items</th>
                <th>Expected</th>
                <th>Received</th>
                <th>Status</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>

            <tbody>
              {filteredOrders.map((order) => {
                const expectedQty = getOrderExpectedQty(order);
                const receivedQty = getOrderReceivedQty(order);

                return (
                  <tr key={order.id}>
                    <td>
                      <div className="inbound-code-cell">
                        <div className="inbound-code-icon">
                          <Truck size={17} />
                        </div>

                        <div>
                          <strong>{order.receiptNo}</strong>
                          <span>{order.id}</span>
                        </div>
                      </div>
                    </td>

                    <td>{order.supplier}</td>

                    <td>
                      <span className="inbound-reference">
                        {order.reference || "-"}
                      </span>
                    </td>

                    <td>{order.lines?.length || 0}</td>

                    <td>{expectedQty}</td>

                    <td>
                      {order.status === "DRAFT"
                        ? "-"
                        : receivedQty}
                    </td>

                    <td>
                      <StatusBadge status={order.status} />
                    </td>

                    <td>
                      {formatDateTime(order.createdAt)}
                    </td>

                    <td>
                      <div className="inbound-actions">
                        {order.status === "DRAFT" && (
                          <>
                            <button
                              type="button"
                              title="Edit"
                              onClick={() =>
                                handleEditOrder(order)
                              }
                            >
                              <Pencil size={15} />
                            </button>

                            <button
                              type="button"
                              title="Receive"
                              className="receive"
                              onClick={() =>
                                handleOpenReceive(order)
                              }
                            >
                              <ArrowDownToLine size={15} />
                            </button>

                            <button
                              type="button"
                              title="Delete"
                              className="danger"
                              onClick={() =>
                                handleDeleteOrder(order)
                              }
                            >
                              <Trash2 size={15} />
                            </button>
                          </>
                        )}

                        {order.status === "RECEIVED" && (
                          <button
                            type="button"
                            className="putaway"
                            onClick={() =>
                              handleCompletePutaway(order)
                            }
                          >
                            <CheckCircle2 size={15} />
                            Putaway
                          </button>
                        )}

                        {order.status === "COMPLETED" && (
                          <span className="inbound-done">
                            Completed
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredOrders.length === 0 && (
            <div className="inbound-empty">
              No inbound orders found.
            </div>
          )}
        </div>
      </section>

      {/* ORDER FORM */}

      {showOrderForm && (
        <InboundOrderForm
          order={selectedOrder}
          skuMasters={skuMasters}
          onSave={handleSaveOrder}
          onCancel={() => {
            setShowOrderForm(false);
            setSelectedOrder(null);
          }}
        />
      )}

      {/* RECEIVE FORM */}

      {showReceiveForm && selectedOrder && (
        <ReceiveForm
          order={selectedOrder}
          locations={locations}
          onSave={handleReceive}
          onCancel={() => {
            setShowReceiveForm(false);
            setSelectedOrder(null);
          }}
        />
      )}
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
      className={`inbound-summary-card tone-${tone}`}
    >
      <div className="inbound-summary-icon">
        {icon}
      </div>

      <div>
        <span>{title}</span>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

/*
 * =====================================================
 * STATUS
 * =====================================================
 */

function StatusBadge({ status }) {
  return (
    <span
      className={`inbound-status status-${status.toLowerCase()}`}
    >
      {status === "RECEIVED"
        ? "Waiting Putaway"
        : status === "COMPLETED"
          ? "Completed"
          : "Draft"}
    </span>
  );
}

/*
 * =====================================================
 * CREATE / EDIT INBOUND
 * =====================================================
 */

function InboundOrderForm({
  order,
  skuMasters,
  onSave,
  onCancel,
}) {
  const [form, setForm] = useState({
    supplier: order?.supplier || "",
    reference: order?.reference || "",
    lines:
      order?.lines?.map((line) => ({
        ...line,
      })) || [createEmptyLine()],
  });

  const [error, setError] = useState("");

  function updateField(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));

    setError("");
  }

  function updateLine(index, field, value) {
    setForm((current) => {
      const lines = [...current.lines];

      lines[index] = {
        ...lines[index],
        [field]: value,
      };

      if (field === "sku") {
        const master = skuMasters.find(
          (item) => item.sku === value
        );

        lines[index].itemName = master?.name || "";
      }

      return {
        ...current,
        lines,
      };
    });

    setError("");
  }

  function addLine() {
    setForm((current) => ({
      ...current,
      lines: [...current.lines, createEmptyLine()],
    }));
  }

  function removeLine(index) {
    if (form.lines.length <= 1) {
      return;
    }

    setForm((current) => ({
      ...current,
      lines: current.lines.filter(
        (_, lineIndex) => lineIndex !== index
      ),
    }));
  }

  function handleSubmit(event) {
    event.preventDefault();

    const result = onSave(form);

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
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onCancel();
        }
      }}
    >
      <form
        className="inbound-modal inbound-order-modal"
        onSubmit={handleSubmit}
      >
        <div className="inbound-modal-header">
          <div>
            <span>INBOUND MANAGEMENT</span>

            <h3>
              {order
                ? "Edit Inbound Order"
                : "New Inbound Order"}
            </h3>
          </div>

          <button
            type="button"
            className="inbound-close"
            onClick={onCancel}
          >
            ×
          </button>
        </div>

        <div className="inbound-form-body">
          <div className="inbound-form-grid">
            <FormField
              label="Supplier"
              value={form.supplier}
              placeholder="Supplier name"
              onChange={(value) =>
                updateField("supplier", value)
              }
            />

            <FormField
              label="Reference / PO"
              value={form.reference}
              placeholder="PO-2026-001"
              onChange={(value) =>
                updateField("reference", value)
              }
            />
          </div>

          <div className="inbound-lines-header">
            <div>
              <strong>Inbound Items</strong>

              <span>
                Select SKU and expected receiving quantity.
              </span>
            </div>

            <button
              type="button"
              onClick={addLine}
            >
              <Plus size={15} />
              Add Line
            </button>
          </div>

          <div className="inbound-lines">
            {form.lines.map((line, index) => (
              <div
                className="inbound-line"
                key={line.lineId}
              >
                <div className="inbound-line-number">
                  {index + 1}
                </div>

                <label className="inbound-field">
                  <span>SKU</span>

                  <select
                    value={line.sku}
                    onChange={(event) =>
                      updateLine(
                        index,
                        "sku",
                        event.target.value
                      )
                    }
                  >
                    <option value="">
                      Select SKU
                    </option>

                    {skuMasters.map((item) => (
                      <option
                        key={item.sku}
                        value={item.sku}
                      >
                        {item.sku} - {item.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="inbound-field">
                  <span>Item</span>

                  <input
                    value={line.itemName}
                    readOnly
                    placeholder="Select SKU"
                  />
                </label>

                <label className="inbound-field inbound-qty-field">
                  <span>Expected Qty</span>

                  <input
                    type="number"
                    min="1"
                    value={line.expectedQty}
                    onChange={(event) =>
                      updateLine(
                        index,
                        "expectedQty",
                        event.target.value
                      )
                    }
                  />
                </label>

                <button
                  type="button"
                  className="inbound-remove-line"
                  disabled={form.lines.length <= 1}
                  onClick={() => removeLine(index)}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>

          {skuMasters.length === 0 && (
            <div className="inbound-form-warning">
              <AlertTriangle size={16} />

              <span>
                No SKU master is available. Create Inventory /
                SKU records before creating an inbound order.
              </span>
            </div>
          )}

          {error && (
            <div className="inbound-form-error">
              <AlertTriangle size={16} />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="inbound-modal-actions">
          <button
            type="button"
            className="inbound-cancel"
            onClick={onCancel}
          >
            Cancel
          </button>

          <button
            type="submit"
            className="inbound-save"
          >
            {order ? "Save Changes" : "Create Inbound"}
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
  onCancel,
}) {
  const [lines, setLines] = useState(
    order.lines.map((line) => ({
      lineId: line.lineId,
      sku: line.sku,
      itemName: line.itemName,
      expectedQty: Number(line.expectedQty || 0),

      receivedQty:
        line.receivedQty ||
        line.expectedQty ||
        0,

      locationId:
        line.locationId || "",
    }))
  );

  const [error, setError] = useState("");

  const availableLocations = useMemo(() => {
    return locations
      .filter(
        (location) =>
          ![
            "FULL",
            "BLOCKED",
            "MAINTENANCE",
          ].includes(location.status)
      )
      .sort((a, b) =>
        String(a.code).localeCompare(
          String(b.code)
        )
      );
  }, [locations]);

  function updateLine(index, field, value) {
    setLines((current) => {
      const next = [...current];

      next[index] = {
        ...next[index],
        [field]: value,
      };

      return next;
    });

    setError("");
  }

  function handleSubmit(event) {
    event.preventDefault();

    const result = onSave(lines);

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
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onCancel();
        }
      }}
    >
      <form
        className="inbound-modal receive-modal"
        onSubmit={handleSubmit}
      >
        <div className="inbound-modal-header">
          <div>
            <span>RECEIVING</span>

            <h3>
              Receive {order.receiptNo}
            </h3>
          </div>

          <button
            type="button"
            className="inbound-close"
            onClick={onCancel}
          >
            ×
          </button>
        </div>

        <div className="inbound-form-body">
          <div className="receive-info">
            <div>
              <span>Supplier</span>
              <strong>{order.supplier}</strong>
            </div>

            <div>
              <span>Reference</span>
              <strong>{order.reference || "-"}</strong>
            </div>
          </div>

          <div className="receive-lines">
            {lines.map((line, index) => (
              <div
                className="receive-line"
                key={line.lineId}
              >
                <div className="receive-product">
                  <div className="receive-product-icon">
                    <Package size={17} />
                  </div>

                  <div>
                    <strong>{line.sku}</strong>
                    <span>{line.itemName}</span>
                  </div>
                </div>

                <div className="receive-expected">
                  <span>Expected</span>
                  <strong>{line.expectedQty}</strong>
                </div>

                <label className="inbound-field">
                  <span>Received Qty</span>

                  <input
                    type="number"
                    min="1"
                    max={line.expectedQty}
                    value={line.receivedQty}
                    onChange={(event) =>
                      updateLine(
                        index,
                        "receivedQty",
                        event.target.value
                      )
                    }
                  />
                </label>

                <label className="inbound-field">
                  <span>Putaway Location</span>

                  <select
                    value={line.locationId}
                    onChange={(event) =>
                      updateLine(
                        index,
                        "locationId",
                        event.target.value
                      )
                    }
                  >
                    <option value="">
                      Select location
                    </option>

                    {availableLocations.map(
                      (location) => (
                        <option
                          key={location.id}
                          value={location.id}
                        >
                          {location.code}
                          {" - "}
                          {location.zone}
                          {" / "}
                          {location.rack}
                          {" / L"}
                          {location.level}
                        </option>
                      )
                    )}
                  </select>
                </label>
              </div>
            ))}
          </div>

          {availableLocations.length === 0 && (
            <div className="inbound-form-warning">
              <AlertTriangle size={16} />

              <span>
                No available Storage Location exists for
                putaway.
              </span>
            </div>
          )}

          {error && (
            <div className="inbound-form-error">
              <AlertTriangle size={16} />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="inbound-modal-actions">
          <button
            type="button"
            className="inbound-cancel"
            onClick={onCancel}
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
      <span>{label}</span>

      <input
        value={value}
        placeholder={placeholder}
        onChange={(event) =>
          onChange(event.target.value)
        }
      />
    </label>
  );
}

/*
 * =====================================================
 * VALIDATE ORDER
 * =====================================================
 */

function validateInboundOrder({
  formData,
  editingId,
  skuMasters,
}) {
  const supplier = String(
    formData.supplier || ""
  ).trim();

  const reference = String(
    formData.reference || ""
  ).trim();

  if (!supplier) {
    return {
      ok: false,
      message: "Please enter Supplier.",
    };
  }

  if (
    !Array.isArray(formData.lines) ||
    formData.lines.length === 0
  ) {
    return {
      ok: false,
      message: "Add at least one inbound item.",
    };
  }

  const masterMap = new Map(
    skuMasters.map((item) => [
      item.sku,
      item,
    ])
  );

  const usedSku = new Set();
  const normalizedLines = [];

  for (
    let index = 0;
    index < formData.lines.length;
    index += 1
  ) {
    const line = formData.lines[index];

    const sku = String(line.sku || "")
      .trim()
      .toUpperCase();

    const expectedQty = Number(
      line.expectedQty
    );

    if (!sku) {
      return {
        ok: false,
        message: `Line ${index + 1}: Please select SKU.`,
      };
    }

    const master = masterMap.get(sku);

    if (!master) {
      return {
        ok: false,
        message: `Line ${index + 1}: SKU ${sku} does not exist in Inventory.`,
      };
    }

    if (usedSku.has(sku)) {
      return {
        ok: false,
        message: `${sku} appears more than once in this inbound order.`,
      };
    }

    usedSku.add(sku);

    if (
      !Number.isFinite(expectedQty) ||
      expectedQty <= 0
    ) {
      return {
        ok: false,
        message: `Line ${index + 1}: Expected Quantity must be greater than 0.`,
      };
    }

    normalizedLines.push({
      lineId:
        line.lineId ||
        createLineId(),

      sku,

      itemName: master.name,

      expectedQty,

      receivedQty: 0,

      locationId: "",
    });
  }

  return {
    ok: true,

    order: {
      supplier,
      reference,
      lines: normalizedLines,
    },
  };
}

/*
 * =====================================================
 * VALIDATE RECEIVING
 * =====================================================
 */

function validateReceiveLines({
  order,
  receiveLines,
  locations,
}) {
  const locationMap = new Map(
    locations.map((location) => [
      location.id,
      location,
    ])
  );

  const result = [];

  for (
    let index = 0;
    index < order.lines.length;
    index += 1
  ) {
    const sourceLine = order.lines[index];

    const inputLine =
      receiveLines.find(
        (line) =>
          line.lineId ===
          sourceLine.lineId
      ) || {};

    const receivedQty = Number(
      inputLine.receivedQty
    );

    const expectedQty = Number(
      sourceLine.expectedQty
    );

    const locationId = String(
      inputLine.locationId || ""
    ).trim();

    if (
      !Number.isFinite(receivedQty) ||
      receivedQty <= 0
    ) {
      return {
        ok: false,

        message:
          `${sourceLine.sku}: Received Quantity must be greater than 0.`,
      };
    }

    if (receivedQty > expectedQty) {
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
      locationMap.get(locationId);

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
      ].includes(location.status)
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
    lines: result,
  };
}

/*
 * =====================================================
 * APPLY PUTAWAY
 * =====================================================
 */

function applyPutawayToInventory({
  inventory,
  order,
}) {
  const result = inventory.map((item) => ({
    ...item,
  }));

  for (const line of order.lines || []) {
    const qty = Number(
      line.receivedQty || 0
    );

    if (qty <= 0) {
      continue;
    }

    const existingIndex =
      result.findIndex(
        (item) =>
          item.sku === line.sku &&
          item.locationId === line.locationId
      );

    /*
     * SAME SKU + LOCATION
     * Increase quantity.
     */

    if (existingIndex >= 0) {
      result[existingIndex] = {
        ...result[existingIndex],

        quantity:
          Number(
            result[existingIndex].quantity || 0
          ) + qty,
      };

      continue;
    }

    /*
     * SKU EXISTS IN ANOTHER LOCATION.
     * Copy master data and create new balance.
     */

    const master = result.find(
      (item) => item.sku === line.sku
    );

    if (!master) {
      continue;
    }

    result.push({
      id: getNextInventoryId(result),

      sku: master.sku,

      name: master.name,

      category: master.category,

      unit: master.unit,

      quantity: qty,

      minStock: master.minStock,

      maxStock: master.maxStock,

      locationId: line.locationId,
    });
  }

  return result;
}

/*
 * =====================================================
 * TOTALS
 * =====================================================
 */

function getOrderExpectedQty(order) {
  return (order.lines || []).reduce(
    (sum, line) =>
      sum +
      Number(line.expectedQty || 0),
    0
  );
}

function getOrderReceivedQty(order) {
  return (order.lines || []).reduce(
    (sum, line) =>
      sum +
      Number(line.receivedQty || 0),
    0
  );
}

/*
 * =====================================================
 * ID GENERATORS
 * =====================================================
 */

function getNextInboundId(orders) {
  let highest = 0;

  orders.forEach((order) => {
    const match = /^INB-(\d+)$/i.exec(
      String(order.id || "")
    );

    if (match) {
      highest = Math.max(
        highest,
        Number(match[1])
      );
    }
  });

  return `INB-${String(
    highest + 1
  ).padStart(3, "0")}`;
}

function getNextInventoryId(items) {
  let highest = 0;

  items.forEach((item) => {
    const match = /^INV-(\d+)$/i.exec(
      String(item.id || "")
    );

    if (match) {
      highest = Math.max(
        highest,
        Number(match[1])
      );
    }
  });

  return `INV-${String(
    highest + 1
  ).padStart(3, "0")}`;
}

function generateReceiptNo(orders) {
  const date = new Date();

  const datePart = [
    date.getFullYear(),
    String(
      date.getMonth() + 1
    ).padStart(2, "0"),
    String(
      date.getDate()
    ).padStart(2, "0"),
  ].join("");

  let counter = 1;

  while (true) {
    const receiptNo =
      `RCV-${datePart}-${String(
        counter
      ).padStart(3, "0")}`;

    const exists = orders.some(
      (order) =>
        order.receiptNo ===
        receiptNo
    );

    if (!exists) {
      return receiptNo;
    }

    counter += 1;
  }
}

function createLineId() {
  return `LINE-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 7)}`;
}

function createEmptyLine() {
  return {
    lineId: createLineId(),
    sku: "",
    itemName: "",
    expectedQty: 1,
    receivedQty: 0,
    locationId: "",
  };
}

/*
 * =====================================================
 * DATE
 * =====================================================
 */

function formatDateTime(value) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

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
        JSON.parse(saved);

      if (Array.isArray(parsed)) {
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

/*
 * =====================================================
 * LOAD INVENTORY
 * =====================================================
 */

function loadInventory() {
  try {
    const saved =
      localStorage.getItem(
        INVENTORY_STORAGE_KEY
      );

    if (saved) {
      const parsed =
        JSON.parse(saved);

      if (Array.isArray(parsed)) {
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
        JSON.parse(saved);

      if (Array.isArray(parsed)) {
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