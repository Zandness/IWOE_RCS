import {
  Boxes,
  ClipboardList,
  MapPin,
  Package,
  RefreshCw,
} from "lucide-react";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  INVENTORY_STORAGE_KEY,
  LOCATION_STORAGE_KEY,
  notifyWmsDataChanged,
} from "../../utils/taskOperationSync";

import "../../styles/StockOutbound.css";

const STOCK_OUTBOUND_HISTORY_KEY =
  "wms-stock-outbound-history-v1";

export default function StockOutboundOperations({
  embedded = false,
}) {
  const [inventory, setInventory] = useState(loadInventory);
  const [locations, setLocations] = useState(loadLocations);
  const [history, setHistory] = useState(loadHistory);

  const [inventoryId, setInventoryId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");

  const locationMap = useMemo(
    () =>
      new Map(
        locations.map((location) => [
          location.id,
          location,
        ])
      ),
    [locations]
  );

  const availableInventory = useMemo(
    () =>
      inventory
        .filter(
          (item) => Number(item.quantity || 0) > 0
        )
        .sort((a, b) =>
          String(a.sku || "").localeCompare(
            String(b.sku || "")
          )
        ),
    [inventory]
  );

  const selectedItem = inventory.find(
    (item) => item.id === inventoryId
  );

  useEffect(() => {
    function refresh() {
      setInventory(loadInventory());
      setLocations(loadLocations());
      setHistory(loadHistory());
    }

    function handleStorage(event) {
      if (
        [
          INVENTORY_STORAGE_KEY,
          LOCATION_STORAGE_KEY,
          STOCK_OUTBOUND_HISTORY_KEY,
        ].includes(event.key)
      ) {
        refresh();
      }
    }

    function handleWmsDataChanged(event) {
      const keys = event.detail?.keys || [];
      if (
        keys.some((key) =>
          [
            INVENTORY_STORAGE_KEY,
            LOCATION_STORAGE_KEY,
          ].includes(key)
        )
      ) {
        refresh();
      }
    }

    window.addEventListener("focus", refresh);
    window.addEventListener("storage", handleStorage);
    window.addEventListener(
      "wms-data-changed",
      handleWmsDataChanged
    );

    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(
        "wms-data-changed",
        handleWmsDataChanged
      );
    };
  }, []);

  function refreshData() {
    setInventory(loadInventory());
    setLocations(loadLocations());
    setHistory(loadHistory());
    setMessage("Data refreshed");
  }

  function handleConfirmOutbound() {
    const item = inventory.find(
      (candidate) => candidate.id === inventoryId
    );

    if (!item) {
      setMessage("Select an inventory record first.");
      return;
    }

    const outboundQty = Number(quantity);
    const currentQty = Number(item.quantity || 0);

    if (
      !Number.isFinite(outboundQty) ||
      outboundQty <= 0
    ) {
      setMessage("Outbound quantity must be greater than 0.");
      return;
    }

    if (outboundQty > currentQty) {
      setMessage(
        `Not enough stock. Current quantity is ${currentQty}.`
      );
      return;
    }

    const confirmed = window.confirm(
      `Confirm Stock Outbound?\n\n${item.sku} - ${item.name}\nQuantity: ${outboundQty} ${item.unit || ""}\nStock: ${currentQty} → ${currentQty - outboundQty}`
    );

    if (!confirmed) return;

    const nextInventory = inventory.map(
      (candidate) =>
        candidate.id === item.id
          ? {
              ...candidate,
              quantity: currentQty - outboundQty,
            }
          : candidate
    );

    const record = {
      id: getNextHistoryId(history),
      inventoryId: item.id,
      sku: item.sku,
      itemName: item.name,
      locationId: item.locationId || "",
      quantity: outboundQty,
      beforeQuantity: currentQty,
      afterQuantity: currentQty - outboundQty,
      unit: item.unit || "",
      reference: reference.trim(),
      note: note.trim(),
      createdAt: new Date().toISOString(),
    };

    const nextHistory = [record, ...history].slice(0, 200);

    try {
      localStorage.setItem(
        INVENTORY_STORAGE_KEY,
        JSON.stringify(nextInventory)
      );

      localStorage.setItem(
        STOCK_OUTBOUND_HISTORY_KEY,
        JSON.stringify(nextHistory)
      );
    } catch (error) {
      console.error(
        "Could not save stock outbound operation.",
        error
      );
      setMessage("Could not save stock outbound operation.");
      return;
    }

    setInventory(nextInventory);
    setHistory(nextHistory);
    setQuantity("");
    setReference("");
    setNote("");
    setMessage(
      `${item.sku}: deducted ${outboundQty} ${item.unit || ""} from stock.`
    );

    notifyWmsDataChanged([
      INVENTORY_STORAGE_KEY,
    ]);
  }

  return (
    <div
      className={`stock-outbound-page ${
        embedded ? "stock-outbound-embedded" : ""
      }`}
    >
      <div className="stock-outbound-header">
        <div>
          <span className="stock-outbound-label">
            DIRECT INVENTORY ISSUE
          </span>
          <h2>Stock Outbound</h2>
          <p>
            Deduct stock directly from an inventory location and keep an outbound history record.
          </p>
        </div>

        <button
          type="button"
          className="stock-outbound-refresh"
          onClick={refreshData}
        >
          <RefreshCw size={15} />
          Refresh
        </button>
      </div>

      <div className="stock-outbound-summary">
        <SummaryCard
          icon={Boxes}
          label="Inventory Records"
          value={inventory.length}
        />
        <SummaryCard
          icon={Package}
          label="Available Records"
          value={availableInventory.length}
        />
        <SummaryCard
          icon={ClipboardList}
          label="Outbound Records"
          value={history.length}
        />
      </div>

      <div className="stock-outbound-layout">
        <section className="stock-outbound-panel">
          <div className="stock-outbound-panel-header">
            <div>
              <h3>Deduct Inventory</h3>
              <p>Select the stock record and quantity to issue.</p>
            </div>
          </div>

          {inventory.length === 0 ? (
            <div className="stock-outbound-empty">
              No inventory records are available. Add inventory first.
            </div>
          ) : (
            <div className="stock-outbound-form">
              <label>
                <span>Inventory / SKU</span>
                <select
                  value={inventoryId}
                  onChange={(event) => {
                    setInventoryId(event.target.value);
                    setQuantity("");
                    setMessage("");
                  }}
                >
                  <option value="">Select inventory</option>
                  {inventory.map((item) => {
                    const location = locationMap.get(
                      item.locationId
                    );

                    return (
                      <option
                        key={item.id}
                        value={item.id}
                      >
                        {item.sku} - {item.name} · {location?.code || item.locationId || "No location"} · Qty {item.quantity}
                      </option>
                    );
                  })}
                </select>
              </label>

              {selectedItem && (
                <div className="stock-outbound-selected">
                  <div>
                    <MapPin size={15} />
                    <span>
                      {locationMap.get(selectedItem.locationId)?.code ||
                        selectedItem.locationId ||
                        "No location"}
                    </span>
                  </div>
                  <strong>
                    Current Stock: {selectedItem.quantity} {selectedItem.unit}
                  </strong>
                </div>
              )}

              <label>
                <span>Outbound Quantity</span>
                <input
                  type="number"
                  min="1"
                  max={selectedItem?.quantity || undefined}
                  value={quantity}
                  onChange={(event) =>
                    setQuantity(event.target.value)
                  }
                  placeholder="0"
                />
              </label>

              <label>
                <span>Reference</span>
                <input
                  type="text"
                  value={reference}
                  onChange={(event) =>
                    setReference(event.target.value)
                  }
                  placeholder="Order / document reference (optional)"
                />
              </label>

              <label>
                <span>Note</span>
                <textarea
                  rows="3"
                  value={note}
                  onChange={(event) =>
                    setNote(event.target.value)
                  }
                  placeholder="Reason or remark (optional)"
                />
              </label>

              {message && (
                <div className="stock-outbound-message">
                  {message}
                </div>
              )}

              <button
                type="button"
                className="stock-outbound-confirm"
                onClick={handleConfirmOutbound}
              >
                <Package size={17} />
                Confirm Stock Outbound
              </button>
            </div>
          )}
        </section>

        <section className="stock-outbound-panel">
          <div className="stock-outbound-panel-header">
            <div>
              <h3>Recent Stock Outbound</h3>
              <p>Latest direct stock deductions.</p>
            </div>
          </div>

          {history.length === 0 ? (
            <div className="stock-outbound-empty">
              No stock outbound history yet.
            </div>
          ) : (
            <div className="stock-outbound-table-wrapper">
              <table className="stock-outbound-table">
                <thead>
                  <tr>
                    <th>Record</th>
                    <th>SKU</th>
                    <th>Location</th>
                    <th>Qty Out</th>
                    <th>Stock After</th>
                    <th>Reference</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {history.slice(0, 20).map((record) => (
                    <tr key={record.id}>
                      <td>{record.id}</td>
                      <td>
                        <strong>{record.sku}</strong>
                        <span>{record.itemName}</span>
                      </td>
                      <td>
                        {locationMap.get(record.locationId)?.code ||
                          record.locationId ||
                          "-"}
                      </td>
                      <td>
                        {record.quantity} {record.unit}
                      </td>
                      <td>
                        {record.afterQuantity} {record.unit}
                      </td>
                      <td>{record.reference || "-"}</td>
                      <td>{formatDateTime(record.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value }) {
  return (
    <div className="stock-outbound-summary-card">
      <div className="stock-outbound-summary-icon">
        <Icon size={19} />
      </div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

function loadInventory() {
  return loadArray(INVENTORY_STORAGE_KEY);
}

function loadLocations() {
  return loadArray(LOCATION_STORAGE_KEY);
}

function loadHistory() {
  return loadArray(STOCK_OUTBOUND_HISTORY_KEY).sort(
    (a, b) =>
      new Date(b.createdAt || 0).getTime() -
      new Date(a.createdAt || 0).getTime()
  );
}

function loadArray(key) {
  try {
    const saved = localStorage.getItem(key);
    if (!saved) return [];

    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn(`Could not load ${key}.`, error);
    return [];
  }
}

function getNextHistoryId(history) {
  let highest = 0;

  history.forEach((record) => {
    const match = String(record.id || "").match(
      /^SOUT-(\d+)$/
    );

    if (match) {
      highest = Math.max(highest, Number(match[1]));
    }
  });

  return `SOUT-${String(highest + 1).padStart(4, "0")}`;
}

function formatDateTime(value) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString();
}
