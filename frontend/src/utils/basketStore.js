export const MONITOR_KEY = "wms-monitor-master-v2";
const QUEUE_KEY = "wms-robot-tasks-v1";

export function basketOf(shelf) {
  return (
    shelf?.basket ||
    ((shelf?.inventory || []).length
      ? { id: `BASKET-${shelf.id}` }
      : null)
  );
}

export function readMonitor() {
  const data = JSON.parse(
    localStorage.getItem(MONITOR_KEY) || "null",
  );

  if (!Array.isArray(data?.racks)) {
    throw new Error("Open Warehouse Monitor first.");
  }

  return data;
}

export function shelvesOf(data) {
  return data.racks.flatMap((rack) =>
    rack.shelves.map((shelf) => ({
      ...shelf,
      rack: rack.id,
      basket: basketOf(shelf),
    })),
  );
}

export function isReserved(id, except = "") {
  const queue = JSON.parse(
    localStorage.getItem(QUEUE_KEY) || "[]",
  );

  return queue.some(
    (task) =>
      task.id !== except &&
      task.rcsStatus !== "COMPLETED" &&
      (task.sourceLocationId === id ||
        task.destinationLocationId === id),
  );
}

export function assertEditable(id) {
  if (isReserved(id)) {
    throw new Error(
      "This location is reserved by a queued transfer. Remove the unsent task or wait for completion.",
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
  const from = shelves.find((s) => s.id === fromId);
  const to = shelves.find((s) => s.id === toId);

  if (!from || !to || from.id === to.id) {
    throw new Error("Choose two different locations.");
  }

  if (!from.basket) {
    throw new Error("The source has no basket.");
  }

  if (to.basket || to.inventory?.length) {
    throw new Error(
      "Destination must be empty: one basket per location.",
    );
  }

  for (const shelf of [from, to]) {
    if (
      !shelf.code ||
      shelves.filter((s) => s.code === shelf.code).length !== 1
    ) {
      throw new Error(
        "Location codes must be present and unique.",
      );
    }

    if (
      ["BLOCKED", "MAINTENANCE"].includes(shelf.status)
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
    throw new Error("The source basket has changed.");
  }

  if (
    from.inventory.some(
      (item) => Number(item.reserved) > 0,
    )
  ) {
    throw new Error(
      "Resolve outbound stock reservations before moving this basket.",
    );
  }

  return { from, to };
}

export function completeBasketTransfer(task) {
  if (
    !task.basketId ||
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

  if (data.completedBasketTransfers?.[key]) {
    return true;
  }

  const shelves = data.racks.flatMap(
    (rack) => rack.shelves,
  );

  const from = shelves.find(
    (shelf) => shelf.id === task.sourceLocationId,
  );

  const to = shelves.find(
    (shelf) => shelf.id === task.destinationLocationId,
  );

  if (
    !from ||
    !to ||
    basketOf(from)?.id !== task.basketId ||
    basketOf(to) ||
    to.inventory?.length
  ) {
    throw new Error(
      "RCS completed, but basket locations conflict. Check physical locations and Monitor before continuing.",
    );
  }

  to.basket = basketOf(from);
  to.inventory = from.inventory;

  from.basket = null;
  from.inventory = [];

  data.completedBasketTransfers = {
    ...data.completedBasketTransfers,
    [key]: new Date().toISOString(),
  };

  data.history = [
    {
      id: `TRANSFER-${key}`,
      type: "BASKET_TRANSFER",
      basketId: task.basketId,
      sourceLocationCode: from.code,
      locationCode: to.code,
      shelfId: to.id,
      createdAt: new Date().toISOString(),
      rcsTaskChainCode: key,
    },
    ...(data.history || []),
  ];

  // Basket, inventory and completion ledger are committed together.
  localStorage.setItem(
    MONITOR_KEY,
    JSON.stringify(data),
  );

  window.dispatchEvent(
    new CustomEvent("wms-monitor-data-changed"),
  );

  return true;
}