import {
  basketOf,
  assertEditable,
} from "./basketStore.js";

export const MAX_SHELVES = 8;
export const MAX_DEPTH = 2;

export const shelfDepth = (shelf) =>
  Number(shelf?.depth || 1);

export function rackShelfCount(rack, fallback = 8) {
  const levels = (rack?.shelves || [])
    .map((shelf) => Number(shelf.level))
    .filter(
      (level) => Number.isInteger(level) && level > 0,
    );

  const saved = Number(rack?.shelfCount);

  return Math.max(
    1,
    ...(levels.length
      ? levels
      : [saved > 0 ? saved : fallback]),
    saved > 0 ? saved : 0,
  );
}

export function rackDepthCount(rack) {
  const depth = Math.max(
    Number(rack?.depthCount || 1),
    ...(rack?.shelves || []).map(shelfDepth),
  );

  if (
    !Number.isInteger(depth) ||
    depth < 1 ||
    depth > MAX_DEPTH
  ) {
    throw new Error(
      "Unsupported saved rack depth. Restore valid data before editing.",
    );
  }

  return depth;
}

// Keep each level/depth combination as an individual storage point.
export function rackSlots(
  rack,
  levelCount = rackShelfCount(rack),
  depthCount = rackDepthCount(rack),
) {
  const saved = rack?.shelves || [];
  const positions = new Set();

  for (const shelf of saved) {
    const key = `${shelf.level}:${shelfDepth(shelf)}`;

    if (positions.has(key)) {
      throw new Error(
        `Duplicate level/depth in rack ${rack.id}.`,
      );
    }

    positions.add(key);
  }

  return Array.from(
    { length: levelCount },
    (_, index) => index + 1,
  ).flatMap((level) =>
    Array.from(
      { length: depthCount },
      (_, index) => index + 1,
    ).map((depth) => {
      const existing = saved.find(
        (shelf) =>
          Number(shelf.level) === level &&
          shelfDepth(shelf) === depth,
      );

      if (existing) {
        return {
          ...existing,
          depth,
        };
      }

      return {
        id: `${rack.id}-S${level}-D${depth}-${crypto.randomUUID()}`,
        level,
        depth,

        // Set the actual location code from RCS before dispatch.
        code: "",

        capacity: 1,
        basket: null,
        status: "AVAILABLE",
        inventory: [],
      };
    }),
  );
}

export function resizeRack(
  data,
  rackId,
  value,
  depthValue,
  loadTypeValue,
) {
  const rack = data.racks.find((item) => item.id === rackId);

  if (!rack) {
    throw new Error("Storage not found.");
  }

  const oldType = rack.loadType || "BASKET";
  const loadType = loadTypeValue ?? oldType;

  if (!["BASKET", "PALLET", "RACK"].includes(loadType)) {
    throw new Error("Select Basket, Pallet or Rack.");
  }

  // A whole rack uses one pickup level per depth.
  const count = loadType === "RACK" ? 1 : Number(value);

  const depthCount = Number(
    depthValue ?? rackDepthCount(rack),
  );

  if (
    !Number.isInteger(count) ||
    count < 1 ||
    count > MAX_SHELVES
  ) {
    throw new Error(
      loadType === "BASKET"
        ? `Enter 1–${MAX_SHELVES} shelf levels.`
        : `Enter 1–${MAX_SHELVES} storage positions.`,
    );
  }

  if (
    !Number.isInteger(depthCount) ||
    depthCount < 1 ||
    depthCount > MAX_DEPTH
  ) {
    throw new Error("Depth must be 1 or 2.");
  }

  const savedShelves = rack.shelves || [];
  const typeChanged = loadType !== oldType;

  const removedShelves = savedShelves.filter(
    (shelf) =>
      Number(shelf.level) > count ||
      shelfDepth(shelf) > depthCount,
  );

  // Changing the type affects all locations in this storage.
  const shelvesToCheck = typeChanged
    ? savedShelves
    : removedShelves;

  for (const shelf of shelvesToCheck) {
    assertEditable(shelf.id);

    const hasStoredItems =
      Boolean(basketOf(shelf)) ||
      Boolean(shelf.inventory?.length);

    if (hasStoredItems) {
      throw new Error(
        `Remove stored items from ${
          shelf.code || shelf.id
        } before changing the type or reducing storage.`,
      );
    }

    const hasOpenOutbound = (
      data.outboundOperations || []
    ).some(
      (operation) =>
        operation.shelfId === shelf.id &&
        !["COMPLETED", "CANCELLED", "CANCELED"].includes(
          operation.status,
        ),
    );

    if (hasOpenOutbound) {
      throw new Error(
        `Finish or cancel outbound tasks for ${
          shelf.code || shelf.id
        } first.`,
      );
    }
  }

  const shelves = rackSlots(rack, count, depthCount);

  return {
    ...data,
    racks: data.racks.map((item) =>
      item.id === rackId
        ? {
            ...item,
            loadType,
            shelfCount: count,
            depthCount,
            shelves,
          }
        : item,
    ),
  };
}