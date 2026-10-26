import { transferWorkflowState } from "./workflowStatus.js";
import {
  basketOf,
  isReserved,
} from "./basketStore.js";

export const PREFERENCES_KEY = "wms-ui-preferences-v1";

export const DEFAULT_PREFERENCES = {
  warehouseName: "Warehouse",
  defaultPriority: 60,
};

export function loadPreferences() {
  try {
    const value = JSON.parse(
      localStorage.getItem(PREFERENCES_KEY) || "{}"
    );

    return {
      warehouseName: String(
        value.warehouseName || "Warehouse"
      ),
      defaultPriority: [30, 60, 90, 120].includes(
        value.defaultPriority
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
  now = Date.now()
) {
  const racks = monitor?.racks || [];

  const shelves = racks.flatMap(
    (rack) => rack.shelves || []
  );

  const contents = shelves.flatMap(
    (shelf) => shelf.inventory || []
  );

  const pending = queue.filter(
    (task) => task.sendStatus === "NOT_SENT"
  );

  const states = queue.map(task => transferWorkflowState(task, monitor || {}, now));

  const loadsByType = {
    BASKET: 0,
    PALLET: 0,
    RACK: 0,
  };

  const occupancy = racks
    .map((rack) => {
      const points = rack.shelves || [];
      const type = rack.loadType || "BASKET";

      const occupied = points.filter(
        (point) => basketOf(point)
      ).length;

      loadsByType[type] =
        (loadsByType[type] || 0) + occupied;

      const blocked = points.filter((point) =>
        ["BLOCKED", "MAINTENANCE"].includes(
          point.status
        )
      ).length;

      const reserved = points.filter((point) =>
        isReserved(point.id, "", monitor, queue)
      ).length;

      const available = points.filter(
        (point) =>
          !basketOf(point) &&
          !["BLOCKED", "MAINTENANCE"].includes(
            point.status
          ) &&
          !isReserved(point.id, "", monitor, queue)
      ).length;

      return {
        ...rack,
        type,
        occupied,
        total: points.length,
        available,
        blocked,
        reserved,
      };
    })
    .sort((a, b) =>
      String(a.name || a.id).localeCompare(
        String(b.name || b.id),
        undefined,
        { numeric: true }
      )
    );

  const occupied = occupancy.reduce(
    (sum, rack) => sum + rack.occupied,
    0
  );

  return {
    loadsByType,
    loads: occupied,
    occupancy,

    utilization: shelves.length
      ? Math.round(
          (occupied / shelves.length) * 100
        )
      : 0,

    blocked: occupancy.reduce(
      (sum, rack) => sum + rack.blocked,
      0
    ),

    reserved: occupancy.reduce(
      (sum, rack) => sum + rack.reserved,
      0
    ),

    racks,
    shelves: shelves.length,
    baskets: loadsByType.BASKET,

    empty: occupancy.reduce(
      (sum, rack) => sum + rack.available,
      0
    ),

    skuCount: new Set(
      contents
        .filter((item) => Number(item.quantity) > 0)
        .map((item) => item.sku)
    ).size,

    quantity: contents.reduce(
      (sum, item) =>
        sum + Number(item.quantity || 0),
      0
    ),

    pending: pending.length,

    scheduled: states.filter(value => value.status === "SCHEDULED").length,
    ready: states.filter(value => value.status === "NOT_SENT").length,
    active: states.filter(value => ["SUBMITTING", "WAITING_RCS"].includes(value.status)).length,
    completed: states.filter(value => value.status === "COMPLETED").length,
    attention: states.filter(value => value.attention).length,

    recent: [...queue]
      .sort(
        (a, b) =>
          (Date.parse(b.createdAt) || 0) -
          (Date.parse(a.createdAt) || 0)
      )
      .slice(0, 8)
      .map(task => ({ ...task, workflow: transferWorkflowState(task, monitor || {}, now) })),
  };
}