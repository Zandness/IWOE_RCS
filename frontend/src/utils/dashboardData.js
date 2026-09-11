import { basketOf } from "./basketStore.js";

export const PREFERENCES_KEY =
  "wms-ui-preferences-v1";

export const DEFAULT_PREFERENCES = {
  warehouseName: "Warehouse",
  defaultPriority: 60,
};

export function loadPreferences() {
  try {
    const value = JSON.parse(
      localStorage.getItem(PREFERENCES_KEY) || "{}",
    );

    return {
      warehouseName: String(
        value.warehouseName || "Warehouse",
      ),
      defaultPriority: [30, 60, 90, 120].includes(
        value.defaultPriority,
      )
        ? value.defaultPriority
        : 60,
    };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

export function summarizeWarehouse(
  monitor,
  queue,
  now = Date.now(),
) {
  const shelves = (monitor?.racks || []).flatMap(
    (rack) => rack.shelves || [],
  );

  const contents = shelves.flatMap(
    (shelf) => shelf.inventory || [],
  );

  const pending = queue.filter(
    (task) => task.sendStatus === "NOT_SENT",
  );

  const attention = queue.filter(
    (task) =>
      task.sendStatus === "OUTCOME_UNKNOWN" ||
      task.backendError ||
      ["FAILED", "CANCELLED", "CANCELED"].includes(
        task.rcsStatus,
      ),
  );

  return {
    racks: monitor?.racks || [],
    shelves: shelves.length,

    baskets: shelves.filter(
      (shelf) => basketOf(shelf),
    ).length,

    empty: shelves.filter(
      (shelf) =>
        !basketOf(shelf) &&
        !["BLOCKED", "MAINTENANCE"].includes(
          shelf.status,
        ),
    ).length,

    skuCount: new Set(
      contents
        .filter((item) => Number(item.quantity) > 0)
        .map((item) => item.sku),
    ).size,

    quantity: contents.reduce(
      (sum, item) =>
        sum + Number(item.quantity || 0),
      0,
    ),

    pending: pending.length,

    scheduled: pending.filter(
      (task) =>
        Date.parse(task.scheduledSendAt) > now,
    ).length,

    active: queue.filter(
      (task) =>
        task.sendStatus === "SENDING" ||
        (task.sendStatus === "SENT" &&
          ["CREATED", "RUNNING"].includes(
            task.rcsStatus,
          )),
    ).length,

    completed: queue.filter(
      (task) => task.rcsStatus === "COMPLETED",
    ).length,

    attention: attention.length,

    recent: [...queue]
      .sort(
        (a, b) =>
          (Date.parse(b.createdAt) || 0) -
          (Date.parse(a.createdAt) || 0),
      )
      .slice(0, 8),
  };
}