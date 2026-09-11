import {
  MONITOR_KEY,
  readMonitor,
  basketOf,
  assertEditable,
} from "./basketStore.js";

export function readArray(key) {
  const value = JSON.parse(
    localStorage.getItem(key) || "[]",
  );

  if (!Array.isArray(value)) {
    throw new Error(`Invalid data: ${key}`);
  }

  return value;
}

export function readOperationsSnapshot() {
  return {
    monitor: readMonitor(),
    queue: readArray("wms-robot-tasks-v1"),
    legacyTasks: readArray("wms-warehouse-tasks-v1"),
    legacyInbound: readArray("wms-inbound-orders-v1"),
    legacyOutbound: readArray("wms-outbound-orders-v1"),
  };
}

function locate(data, rackId, shelfId) {
  const shelf = data.racks
    .find((rack) => rack.id === rackId)
    ?.shelves.find((item) => item.id === shelfId);

  if (!shelf) {
    throw new Error("Storage location not found.");
  }

  return shelf;
}

function positive(value) {
  const quantity = Number(value);

  if (
    !Number.isFinite(quantity) ||
    quantity <= 0
  ) {
    throw new Error(
      "Quantity must be greater than zero.",
    );
  }

  return quantity;
}

export function createOutboundReservation(
  data,
  rackId,
  shelfId,
  payload,
) {
  assertEditable(shelfId);

  const next = JSON.parse(JSON.stringify(data));
  const shelf = locate(next, rackId, shelfId);

  if (
    ["BLOCKED", "MAINTENANCE"].includes(shelf.status)
  ) {
    throw new Error("Location is unavailable.");
  }

  const basket = basketOf(shelf);

  if (!basket) {
    throw new Error("No basket at this location.");
  }

  const item = shelf.inventory.find(
    (record) => record.id === payload.itemId,
  );

  if (!item) {
    throw new Error("Inventory record not found.");
  }

  const quantity = positive(payload.quantity);
  const free =
    Number(item.quantity || 0) -
    Number(item.reserved || 0);

  if (quantity > free) {
    throw new Error(
      `Only ${free} unreserved stock is available.`,
    );
  }

  item.reserved =
    Number(item.reserved || 0) + quantity;

  const operation = {
    id: `OUT-${crypto.randomUUID()}`,
    type: "OUTBOUND",
    status: "PENDING",
    rackId,
    shelfId,
    locationCode: shelf.code,
    basketId: basket.id,
    itemId: item.id,
    sku: item.sku,
    itemName: item.name,
    unit: item.unit,
    quantity,
    reference: payload.reference || "",
    note: payload.note || "",
    createdAt: new Date().toISOString(),
  };

  next.outboundOperations = [
    ...(next.outboundOperations || []),
    operation,
  ];

  next.history = [
    {
      ...operation,
      operationId: operation.id,
      id: `HIS-${crypto.randomUUID()}`,
    },
    ...(next.history || []),
  ].slice(0, 300);

  return next;
}

export function transitionOutbound(data, id, action) {
  const next = JSON.parse(JSON.stringify(data));

  const operation = next.outboundOperations?.find(
    (record) => record.id === id,
  );

  if (!operation) {
    throw new Error("Outbound operation not found.");
  }

  const terminal =
    action === "COMPLETE"
      ? "COMPLETED"
      : action === "CANCEL"
        ? "CANCELLED"
        : "";

  if (terminal && operation.status === terminal) {
    return next;
  }

  if (
    action === "START" &&
    operation.status === "IN_PROGRESS"
  ) {
    return next;
  }

  if (
    !["PENDING", "IN_PROGRESS"].includes(
      operation.status,
    )
  ) {
    throw new Error("This operation is already closed.");
  }

  if (
    !["START", "COMPLETE", "CANCEL"].includes(action)
  ) {
    throw new Error("Unknown action.");
  }

  if (
    action === "COMPLETE" &&
    operation.status !== "IN_PROGRESS"
  ) {
    throw new Error(
      "Start picking before confirming completion.",
    );
  }

  assertEditable(operation.shelfId);

  const shelf = locate(
    next,
    operation.rackId,
    operation.shelfId,
  );

  if (basketOf(shelf)?.id !== operation.basketId) {
    throw new Error(
      "Basket location has changed. Review the operation.",
    );
  }

  if (
    action !== "CANCEL" &&
    ["BLOCKED", "MAINTENANCE"].includes(shelf.status)
  ) {
    throw new Error("Location is unavailable.");
  }

  const item = shelf.inventory.find(
    (record) =>
      record.id === operation.itemId &&
      record.sku === operation.sku,
  );

  const quantity = positive(operation.quantity);

  if (
    !item ||
    Number(item.reserved || 0) < quantity ||
    Number(item.quantity || 0) < quantity
  ) {
    throw new Error(
      "Stock or reservation does not match this operation.",
    );
  }

  const at = new Date().toISOString();

  if (action === "START") {
    operation.status = "IN_PROGRESS";
    operation.startedAt = at;
  } else {
    item.reserved =
      Number(item.reserved || 0) - quantity;

    if (action === "COMPLETE") {
      item.quantity =
        Number(item.quantity) - quantity;
    }

    operation.status = terminal;
    operation.closedAt = at;

    shelf.inventory = shelf.inventory.filter(
      (record) =>
        Number(record.quantity) > 0 ||
        Number(record.reserved) > 0,
    );
  }

  next.history = [
    {
      id: `HIS-${crypto.randomUUID()}`,
      type: `OUTBOUND_${operation.status}`,
      operationId: operation.id,
      rackId: operation.rackId,
      shelfId: shelf.id,
      locationCode: shelf.code,
      basketId: operation.basketId,
      sku: operation.sku,
      itemName: operation.itemName,
      quantity,
      unit: operation.unit,
      reference: operation.reference,
      createdAt: at,
    },
    ...(next.history || []),
  ].slice(0, 300);

  return next;
}

export function updateOutbound(id, action) {
  const next = transitionOutbound(
    readMonitor(),
    id,
    action,
  );

  localStorage.setItem(
    MONITOR_KEY,
    JSON.stringify(next),
  );

  window.dispatchEvent(
    new CustomEvent("wms-monitor-data-changed"),
  );

  return next;
}