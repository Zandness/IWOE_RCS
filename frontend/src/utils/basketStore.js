export const MONITOR_KEY = "wms-monitor-master-v2";

const QUEUE_KEY = "wms-robot-tasks-v1";

function inventoryOf(shelf) {
  const inventory = shelf?.inventory;

  if (inventory == null) {
    return [];
  }

  if (!Array.isArray(inventory)) {
    throw new Error(
      "Invalid inventory data. Check Warehouse Monitor.",
    );
  }

  return inventory;
}

function readQueue() {
  const queue = JSON.parse(
    localStorage.getItem(QUEUE_KEY) || "[]",
  );

  if (
    !Array.isArray(queue) ||
    queue.some(
      (task) =>
        !task ||
        typeof task !== "object" ||
        Array.isArray(task),
    )
  ) {
    throw new Error(
      "Invalid queue data. Check the dispatch queue before continuing.",
    );
  }

  return queue;
}

function findLocation(shelves, id) {
  const matches = shelves.filter(
    (shelf) => shelf.id === id,
  );

  if (matches.length > 1) {
    throw new Error(
      "Duplicate location IDs found. Check Warehouse Monitor.",
    );
  }

  return matches[0];
}

export function basketOf(shelf) {
  return (
    shelf?.basket ||
    (
      inventoryOf(shelf).length
        ? { id: `BASKET-${shelf.id}` }
        : null
    )
  );
}

export function readMonitor() {
  const data = JSON.parse(
    localStorage.getItem(MONITOR_KEY) || "null",
  );

  if (!Array.isArray(data?.racks)) {
    throw new Error("Open Warehouse Monitor first.");
  }

  for (const rack of data.racks) {
    if (
      !rack ||
      !Array.isArray(rack.shelves) ||
      rack.shelves.some(
        (shelf) =>
          !shelf ||
          typeof shelf !== "object" ||
          Array.isArray(shelf),
      )
    ) {
      throw new Error(
        "Invalid storage data. Check Warehouse Monitor.",
      );
    }
  }

  return data;
}

export function shelvesOf(data) {
  return data.racks.flatMap((rack) =>
    rack.shelves.map((shelf) => ({
      ...shelf,
      rack: rack.id,
      loadType: rack.loadType || "BASKET",
      inventory: inventoryOf(shelf),
      basket: basketOf(shelf),
    })),
  );
}

export function isReserved(id, except = "") {
  return readQueue().some(
    (task) =>
      task.id !== except &&
      task.rcsStatus !== "COMPLETED" &&
      (
        task.sourceLocationId === id ||
        task.destinationLocationId === id
      ),
  );
}

export function assertEditable(id) {
  if (isReserved(id)) {
    throw new Error(
      "This location is reserved by a transfer. Remove an unsent task or review the submitted task before editing.",
    );
  }
}

export function validateTransfer(
  fromId,
  toId,
  except = "",
  expectedBasket = "",
) {
  const shelves = shelvesOf(readMonitor());

  const from = findLocation(shelves, fromId);
  const to = findLocation(shelves, toId);

  if (!from || !to || from.id === to.id) {
    throw new Error("Choose two different locations.");
  }

  if (from.loadType !== to.loadType) {
    throw new Error(
      "Source and destination must support the same load type.",
    );
  }

  if (!from.basket?.id) {
    throw new Error(
      "The source has no load or its internal load ID is missing.",
    );
  }

  if (to.basket || to.inventory.length) {
    throw new Error(
      "Destination must be empty: one load per location.",
    );
  }

  for (const shelf of [from, to]) {
    if (
      typeof shelf.code !== "string" ||
      !shelf.code.trim() ||
      shelves.filter(
        (item) => item.code === shelf.code,
      ).length !== 1
    ) {
      throw new Error(
        "WMS location codes must be present and unique.",
      );
    }

    if (
      ["BLOCKED", "MAINTENANCE"].includes(
        shelf.status,
      )
    ) {
      throw new Error("Location is unavailable.");
    }

    if (isReserved(shelf.id, except)) {
      throw new Error(
        "Location already reserved by another transfer.",
      );
    }
  }

  if (
    expectedBasket &&
    from.basket.id !== expectedBasket
  ) {
    throw new Error("The source load has changed.");
  }

  if (
    from.inventory.some(
      (item) => Number(item.reserved) > 0,
    )
  ) {
    throw new Error(
      "Resolve outbound stock reservations before moving this load.",
    );
  }

  return { from, to };
}

function assertWmsLocationCodes(task, from, to) {
  // New tasks store WMS codes separately from RCS target codes.
  // Legacy tasks used the same code for both.
  const expectedSourceCode =
    Object.prototype.hasOwnProperty.call(
      task,
      "sourceWmsLocationCode",
    )
      ? task.sourceWmsLocationCode
      : task.sourceRcsPointCode;

  const expectedDestinationCode =
    Object.prototype.hasOwnProperty.call(
      task,
      "destinationWmsLocationCode",
    )
      ? task.destinationWmsLocationCode
      : task.destinationRcsPointCode;

  if (
    (
      expectedSourceCode != null &&
      String(from.code || "") !==
        String(expectedSourceCode)
    ) ||
    (
      expectedDestinationCode != null &&
      String(to.code || "") !==
        String(expectedDestinationCode)
    )
  ) {
    throw new Error(
      "RCS completed, but WMS location codes changed. Check physical locations and Monitor before continuing.",
    );
  }
}

export function completeBasketTransfer(task) {
  if (
    !task?.basketId ||
    task.rcsStatus !== "COMPLETED"
  ) {
    return false;
  }

  const data = readMonitor();

  const key =
    task.rcsTaskChainCode || task.bridgeTaskId;

  if (!key) {
    throw new Error("Missing confirmed transfer ID.");
  }

  // A completed transfer must only update warehouse data once.
  if (
    Object.prototype.hasOwnProperty.call(
      data.completedBasketTransfers || {},
      key,
    )
  ) {
    return true;
  }

  const locations = shelvesOf(data);

  const sourceInfo = findLocation(
    locations,
    task.sourceLocationId,
  );

  const destinationInfo = findLocation(
    locations,
    task.destinationLocationId,
  );

  if (
    !sourceInfo ||
    !destinationInfo ||
    sourceInfo.id === destinationInfo.id
  ) {
    throw new Error(
      "RCS completed, but WMS locations are missing or invalid. Check Monitor before continuing.",
    );
  }

  if (
    sourceInfo.loadType !== destinationInfo.loadType
  ) {
    throw new Error(
      "RCS completed, but the WMS load types no longer match. Check Monitor before continuing.",
    );
  }

  assertWmsLocationCodes(
    task,
    sourceInfo,
    destinationInfo,
  );

  // Use original objects so both locations are saved together.
  const shelves = data.racks.flatMap(
    (rack) => rack.shelves,
  );

  const from = findLocation(
    shelves,
    task.sourceLocationId,
  );

  const to = findLocation(
    shelves,
    task.destinationLocationId,
  );

  const load = basketOf(from);
  const sourceInventory = inventoryOf(from);

  if (
    load?.id !== task.basketId ||
    basketOf(to) ||
    inventoryOf(to).length
  ) {
    throw new Error(
      "RCS completed, but load locations conflict. Check physical locations and Monitor before continuing.",
    );
  }

  if (
    sourceInventory.some(
      (item) => Number(item.reserved) > 0,
    )
  ) {
    throw new Error(
      "RCS completed, but the source has stock reservations. Review warehouse operations before updating its location.",
    );
  }

  if (
    data.history != null &&
    !Array.isArray(data.history)
  ) {
    throw new Error(
      "Warehouse history is invalid. Restore it before updating the completed transfer.",
    );
  }

  const completedAt = new Date().toISOString();

  to.basket = load;
  to.inventory = sourceInventory;

  from.basket = null;
  from.inventory = [];

  data.completedBasketTransfers = {
    ...data.completedBasketTransfers,
    [key]: completedAt,
  };

  data.history = [
    {
      id: `TRANSFER-${key}`,

      // Preserve the existing history type and field names.
      type: "BASKET_TRANSFER",
      basketId: task.basketId,
      loadType: sourceInfo.loadType,

      sourceLocationCode: from.code,
      locationCode: to.code,
      shelfId: to.id,

      sourceLocationId: from.id,
      destinationLocationId: to.id,

      sourceRcsTargetType:
        task.sourceRcsTargetType || "STORAGE",
      destinationRcsTargetType:
        task.destinationRcsTargetType || "STORAGE",

      sourceRcsPointCode:
        task.sourceRcsPointCode || "",
      destinationRcsPointCode:
        task.destinationRcsPointCode || "",

      rcsTaskType: task.rcsTaskType || "",
      rcsRobotCode: task.rcsRobotCode || "",

      createdAt: completedAt,
      rcsTaskChainCode: key,
      bridgeTaskId: task.bridgeTaskId || "",
    },
    ...(data.history || []),
  ];

  // Save the load, inventory, history and completion marker together.
  localStorage.setItem(
    MONITOR_KEY,
    JSON.stringify(data),
  );

  window.dispatchEvent(
    new CustomEvent("wms-monitor-data-changed"),
  );

  return true;
}

export function binLocationPatch(
  locationId,
  remove = false,
) {
  const data = readMonitor();

  const shelf = findLocation(
    shelvesOf(data),
    locationId,
  );

  if (!shelf) {
    throw new Error("Location not found.");
  }

  assertEditable(locationId);

  if (
    ["BLOCKED", "MAINTENANCE"].includes(
      shelf.status,
    )
  ) {
    throw new Error("This location is unavailable.");
  }

  const outboundOperations =
    data.outboundOperations || [];

  if (!Array.isArray(outboundOperations)) {
    throw new Error(
      "Invalid outbound operation data.",
    );
  }

  if (
    outboundOperations.some(
      (operation) =>
        operation.shelfId === locationId &&
        ![
          "COMPLETED",
          "CANCELLED",
          "CANCELED",
        ].includes(operation.status),
    )
  ) {
    throw new Error(
      "Finish or cancel outbound tasks first.",
    );
  }

  if (remove) {
    if (!shelf.basket) {
      throw new Error(
        "This location is already empty.",
      );
    }

    if (
      shelf.inventory.some(
        (item) =>
          Number(item.quantity) > 0 ||
          Number(item.reserved) > 0,
      )
    ) {
      throw new Error(
        "Remove products and reservations before Unbin.",
      );
    }

    return {
      basket: null,
      inventory: [],
      capacity: 1,
    };
  }

  if (shelf.basket) {
    throw new Error(
      "This location is already occupied.",
    );
  }

  // This is an internal WMS ID, not an RCS carrier number.
  return {
    basket: {
      id: `${shelf.loadType}-${crypto.randomUUID()}`,
    },
    capacity: 1,
  };
}