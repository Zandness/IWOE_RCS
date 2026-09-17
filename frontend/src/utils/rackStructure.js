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
) {
  const rack = data.racks.find(
    (item) => item.id === rackId,
  );

  if (!rack) {
    throw new Error("Rack not found.");
  }

  const count = Number(value);

  const depthCount = Number(
    depthValue ?? rackDepthCount(rack),
  );

  if (
    !Number.isInteger(count) ||
    count < 1 ||
    count > MAX_SHELVES
  ) {
    throw new Error(
      `Enter 1–${MAX_SHELVES} shelf levels.`,
    );
  }

  if (
    !Number.isInteger(depthCount) ||
    depthCount < 1 ||
    depthCount > MAX_DEPTH
  ) {
    throw new Error("Depth must be 1 or 2.");
  }

  const removed = rack.shelves.filter(
    (shelf) =>
      Number(shelf.level) > count ||
      shelfDepth(shelf) > depthCount,
  );

  for (const shelf of removed) {
    assertEditable(shelf.id);

    if (
      basketOf(shelf) ||
      shelf.inventory?.length
    ) {
      throw new Error(
        `Empty ${shelf.code || shelf.id} and remove its basket before reducing the rack.`,
      );
    }

    const hasOpenOutbound = (
      data.outboundOperations || []
    ).some(
      (operation) =>
        operation.shelfId === shelf.id &&
        ![
          "COMPLETED",
          "CANCELLED",
          "CANCELED",
        ].includes(operation.status),
    );

    if (hasOpenOutbound) {
      throw new Error(
        `Resolve outbound operations for ${shelf.code || shelf.id} first.`,
      );
    }
  }

  const shelves = rackSlots(
    rack,
    count,
    depthCount,
  );

  return {
    ...data,

    racks: data.racks.map((item) =>
      item.id === rackId
        ? {
            ...item,
            shelfCount: count,
            depthCount,
            shelves,
          }
        : item,
    ),
  };
}