export const TASK_STORAGE_KEY =
  "wms-warehouse-tasks-v1";

export const INBOUND_STORAGE_KEY =
  "wms-inbound-orders-v1";

export const OUTBOUND_STORAGE_KEY =
  "wms-outbound-orders-v1";

export const LOCATION_STORAGE_KEY =
  "wms-storage-locations-v1";

export const INVENTORY_STORAGE_KEY =
  "wms-inventory-items-v1";


export function loadTasks() {
  return loadArray(
    TASK_STORAGE_KEY
  ).map(
    normalizeTask
  );
}


export function saveTasks(
  tasks
) {
  try {
    localStorage.setItem(
      TASK_STORAGE_KEY,
      JSON.stringify(
        tasks
      )
    );

    return {
      ok: true,
    };
  } catch (error) {
    console.error(
      "Could not save warehouse tasks.",
      error
    );

    return {
      ok: false,

      message:
        "Could not save warehouse tasks.",
    };
  }
}


/* =========================================================
   OPERATION -> TASK
========================================================= */

export function syncWarehouseTasks(
  existingTasks = loadTasks()
) {
  const inboundOrders =
    loadArray(
      INBOUND_STORAGE_KEY
    );

  const outboundOrders =
    loadArray(
      OUTBOUND_STORAGE_KEY
    );

  const locations =
    loadArray(
      LOCATION_STORAGE_KEY
    );

  const now =
    new Date().toISOString();


  const normalizedExisting =
    (
      existingTasks ||
      []
    ).map(
      normalizeTask
    );


  const taskBySourceKey =
    new Map(
      normalizedExisting
        .filter(
          (task) =>
            task.sourceKey
        )
        .map(
          (task) => [
            task.sourceKey,
            task,
          ]
        )
    );


  const locationMap =
    new Map(
      locations.map(
        (location) => [
          location.id,
          location,
        ]
      )
    );


  let nextTaskNumber =
    getHighestTaskNumber(
      normalizedExisting
    ) + 1;


  function upsertTask(
    incomingTask,
    suggestedStatus
  ) {
    const existing =
      taskBySourceKey.get(
        incomingTask.sourceKey
      );


    /*
     * EXISTING TASK
     */

    if (existing) {
      const status =
        mergeTaskStatus(
          existing.status,
          suggestedStatus
        );


      taskBySourceKey.set(
        incomingTask.sourceKey,

        normalizeTask({
          ...existing,
          ...incomingTask,

          id:
            existing.id,

          priority:
            existing.priority ||
            "NORMAL",

          status,

          createdAt:
            existing.createdAt ||
            incomingTask.createdAt ||
            now,

          startedAt:
            existing.startedAt ||
            "",

          completedAt:
            status ===
            "COMPLETED"
              ? (
                  existing.completedAt ||
                  incomingTask.completedAt ||
                  now
                )
              : (
                  existing.completedAt ||
                  ""
                ),

          blockedAt:
            existing.blockedAt ||
            "",
        })
      );


      return;
    }


    /*
     * NEW TASK
     */

    const newTask =
      normalizeTask({
        id:
          `TASK-${String(
            nextTaskNumber
          ).padStart(
            3,
            "0"
          )}`,

        priority:
          "NORMAL",

        status:
          suggestedStatus,

        createdAt:
          incomingTask.createdAt ||
          now,

        startedAt:
          "",

        completedAt:
          suggestedStatus ===
          "COMPLETED"
            ? (
                incomingTask.completedAt ||
                now
              )
            : "",

        blockedAt:
          "",

        ...incomingTask,
      });


    nextTaskNumber +=
      1;


    taskBySourceKey.set(
      incomingTask.sourceKey,
      newTask
    );
  }


  /*
   * =====================================================
   * INBOUND -> PUTAWAY
   * =====================================================
   */

  inboundOrders.forEach(
    (order) => {
      if (
        ![
          "RECEIVED",
          "COMPLETED",
        ].includes(
          order.status
        )
      ) {
        return;
      }


      (
        order.lines ||
        []
      ).forEach(
        (line) => {
          const quantity =
            Number(
              line.receivedQty ||
              0
            );


          if (
            quantity <= 0 ||
            !line.locationId
          ) {
            return;
          }


          const location =
            locationMap.get(
              line.locationId
            );


          const suggestedStatus =
            order.status ===
            "COMPLETED"
              ? "COMPLETED"
              : "PENDING";


          upsertTask(
            {
              sourceKey:
                `INBOUND:${order.id}:${line.lineId}`,

              type:
                "PUTAWAY",

              sourceOrderType:
                "INBOUND",

              sourceOrderId:
                order.id,

              sourceOrderNo:
                order.receiptNo ||
                order.id,

              sourceOrderStatus:
                order.status,

              sourceLineId:
                line.lineId,

              inventoryId:
                "",

              sku:
                line.sku,

              itemName:
                line.itemName,

              quantity,

              sourceLocationId:
                "",

              destinationLocationId:
                line.locationId,

              sourceLabel:
                "RECEIVING",

              destinationLabel:
                location?.code ||
                line.locationId,

              mapId:
                location?.mapId ||
                "",

              sourceNodeId:
                "",

              destinationNodeId:
                location?.mapNodeId ||
                "",

              createdAt:
                order.receivedAt ||
                order.createdAt ||
                now,

              completedAt:
                order.status ===
                "COMPLETED"
                  ? (
                      order.completedAt ||
                      now
                    )
                  : "",
            },

            suggestedStatus
          );
        }
      );
    }
  );


  /*
   * =====================================================
   * OUTBOUND -> PICKING
   * =====================================================
   *
   * สำคัญ:
   *
   * Outbound status = PICKING
   * ไม่ได้แปลว่า Picking Task ทุกตัวต้อง IN_PROGRESS
   *
   * แต่ละ Task จะมีสถานะของตัวเอง
   *
   * PENDING
   * IN_PROGRESS
   * BLOCKED
   * COMPLETED
   *
   * =====================================================
   */

  outboundOrders.forEach(
    (order) => {
      if (
        ![
          "ALLOCATED",
          "PICKING",
          "PICKED",
          "READY",
          "COMPLETED",
        ].includes(
          order.status
        )
      ) {
        return;
      }


      /*
       * ถ้า Order ผ่าน Picking แล้ว
       * Task ทุกตัวถือว่า Complete
       *
       * แต่ถ้า Order แค่ ALLOCATED / PICKING
       * Task ใหม่เริ่มเป็น PENDING
       */

      const suggestedStatus =
        [
          "PICKED",
          "READY",
          "COMPLETED",
        ].includes(
          order.status
        )
          ? "COMPLETED"
          : "PENDING";


      (
        order.lines ||
        []
      ).forEach(
        (line) => {
          (
            line.allocations ||
            []
          ).forEach(
            (
              allocation,
              allocationIndex
            ) => {
              const quantity =
                Number(
                  allocation.qty ||
                  0
                );


              if (
                quantity <= 0 ||
                !allocation.locationId
              ) {
                return;
              }


              const location =
                locationMap.get(
                  allocation.locationId
                );


              const allocationKey =
                allocation.inventoryId ||
                `${
                  allocation.locationId
                }-${allocationIndex}`;


              upsertTask(
                {
                  sourceKey:
                    `OUTBOUND:${order.id}:${line.lineId}:${allocationKey}`,

                  type:
                    "PICKING",

                  sourceOrderType:
                    "OUTBOUND",

                  sourceOrderId:
                    order.id,

                  sourceOrderNo:
                    order.orderNo ||
                    order.id,

                  sourceOrderStatus:
                    order.status,

                  sourceLineId:
                    line.lineId,

                  inventoryId:
                    allocation.inventoryId ||
                    "",

                  sku:
                    line.sku,

                  itemName:
                    line.itemName,

                  quantity,

                  sourceLocationId:
                    allocation.locationId,

                  destinationLocationId:
                    "",

                  sourceLabel:
                    location?.code ||
                    allocation.locationId,

                  destinationLabel:
                    "SHIPPING",

                  mapId:
                    location?.mapId ||
                    "",

                  sourceNodeId:
                    location?.mapNodeId ||
                    "",

                  destinationNodeId:
                    "",

                  createdAt:
                    order.allocatedAt ||
                    order.createdAt ||
                    now,

                  completedAt:
                    suggestedStatus ===
                    "COMPLETED"
                      ? (
                          order.pickedAt ||
                          order.readyAt ||
                          order.completedAt ||
                          now
                        )
                      : "",
                },

                suggestedStatus
              );
            }
          );
        }
      );
    }
  );


  return Array.from(
    taskBySourceKey.values()
  ).map(
    normalizeTask
  );
}


/* =========================================================
   TASK -> OPERATION
========================================================= */

export function syncTaskStatusToOperations({
  changedTask,
  allTasks,
  nextStatus,
  now = new Date().toISOString(),
}) {
  if (!changedTask) {
    return {
      ok: false,

      message:
        "Task not found.",
    };
  }


  /*
   * =====================================================
   * PICKING TASK -> OUTBOUND
   *
   * ทุกครั้งที่ Picking Task เปลี่ยน
   * ให้ update Outbound Progress
   * =====================================================
   */

  if (
    changedTask.type ===
    "PICKING"
  ) {
    return syncOutboundPickingProgress({
      changedTask,
      allTasks,
      now,
    });
  }


  /*
   * =====================================================
   * PUTAWAY TASK -> INBOUND
   * =====================================================
   */

  if (
    changedTask.type ===
      "PUTAWAY" &&
    nextStatus ===
      "COMPLETED"
  ) {
    const siblingTasks =
      (
        allTasks ||
        []
      ).filter(
        (task) =>
          task.type ===
            "PUTAWAY" &&
          task.sourceOrderId ===
            changedTask.sourceOrderId
      );


    const allCompleted =
      siblingTasks.length >
        0 &&
      siblingTasks.every(
        (task) =>
          task.status ===
          "COMPLETED"
      );


    if (allCompleted) {
      return completeInbound(
        changedTask,
        now
      );
    }
  }


  return {
    ok: true,
  };
}


/* =========================================================
   PICKING TASK PROGRESS -> OUTBOUND
========================================================= */

function syncOutboundPickingProgress({
  changedTask,
  allTasks,
  now,
}) {
  const orders =
    loadArray(
      OUTBOUND_STORAGE_KEY
    );


  const order =
    orders.find(
      (item) =>
        item.id ===
        changedTask.sourceOrderId
    );


  if (!order) {
    return {
      ok: false,

      message:
        `Outbound order ${changedTask.sourceOrderId} was not found.`,
    };
  }


  /*
   * หา Picking Task ทุกตัว
   * ของ Outbound Order ใบเดียวกัน
   */

  const pickingTasks =
    (
      allTasks ||
      []
    ).filter(
      (task) =>
        task.type ===
          "PICKING" &&
        task.sourceOrderId ===
          changedTask.sourceOrderId
    );


  if (
    pickingTasks.length ===
    0
  ) {
    return {
      ok: false,

      message:
        `No Picking task was found for ${
          order.orderNo ||
          order.id
        }.`,
    };
  }


  const totalTasks =
    pickingTasks.length;


  const completedTasks =
    pickingTasks.filter(
      (task) =>
        task.status ===
        "COMPLETED"
    ).length;


  const inProgressTasks =
    pickingTasks.filter(
      (task) =>
        task.status ===
        "IN_PROGRESS"
    ).length;


  const blockedTasks =
    pickingTasks.filter(
      (task) =>
        task.status ===
        "BLOCKED"
    ).length;


  const pendingTasks =
    pickingTasks.filter(
      (task) =>
        task.status ===
        "PENDING"
    ).length;


  const allCompleted =
    completedTasks ===
    totalTasks;


  /*
   * Progress fields
   * จะถูกเก็บใน Outbound Order
   */

  const progressFields = {
    pickingTaskTotal:
      totalTasks,

    pickingTaskCompleted:
      completedTasks,

    pickingTaskInProgress:
      inProgressTasks,

    pickingTaskBlocked:
      blockedTasks,

    pickingTaskPending:
      pendingTasks,
  };


  /*
   * =====================================================
   * ORDER ผ่าน PICKED ไปแล้ว
   *
   * ห้ามลด Inventory อีก
   * แค่อัพเดต Progress
   * =====================================================
   */

  if (
    [
      "PICKED",
      "READY",
      "COMPLETED",
    ].includes(
      order.status
    )
  ) {
    const updatedOrders =
      orders.map(
        (item) =>
          item.id ===
          order.id
            ? {
                ...item,
                ...progressFields,
              }
            : item
      );


    return saveEntries([
      [
        OUTBOUND_STORAGE_KEY,
        updatedOrders,
      ],
    ]);
  }


  /*
   * Picking Task จะทำงานได้
   * ตอน Order = ALLOCATED / PICKING
   */

  if (
    ![
      "ALLOCATED",
      "PICKING",
    ].includes(
      order.status
    )
  ) {
    return {
      ok: false,

      message:
        `Outbound ${
          order.orderNo ||
          order.id
        } cannot sync Picking tasks from status ${order.status}.`,
    };
  }


  /*
   * =====================================================
   * TASK ครบทั้งหมด
   *
   * เช่น
   *
   * TASK-001 = COMPLETED
   * TASK-002 = COMPLETED
   * TASK-003 = COMPLETED
   *
   * THEN
   *
   * Inventory -
   * Outbound -> PICKED
   * =====================================================
   */

  if (allCompleted) {
    const inventory =
      loadArray(
        INVENTORY_STORAGE_KEY
      );


    const deduction =
      deductOutboundInventory(
        inventory,
        order
      );


    if (!deduction.ok) {
      return deduction;
    }


    const updatedOrders =
      orders.map(
        (item) =>
          item.id ===
          order.id
            ? {
                ...item,

                status:
                  "PICKED",

                pickingAt:
                  item.pickingAt ||
                  now,

                pickedAt:
                  now,

                ...progressFields,

                pickingTaskInProgress:
                  0,

                pickingTaskBlocked:
                  0,

                pickingTaskPending:
                  0,
              }
            : item
      );


    return saveEntries([
      [
        INVENTORY_STORAGE_KEY,
        deduction.inventory,
      ],

      [
        OUTBOUND_STORAGE_KEY,
        updatedOrders,
      ],
    ]);
  }


  /*
   * =====================================================
   * PARTIAL PICKING
   *
   * เช่น
   *
   * Task 1 = Complete
   * Task 2 = Pending
   * Task 3 = Pending
   *
   * Order ยังเป็น PICKING
   * แต่ Progress = 1/3
   * =====================================================
   */

  const hasStarted =
    inProgressTasks >
      0 ||
    completedTasks >
      0 ||
    blockedTasks >
      0;


  const nextOrderStatus =
    hasStarted
      ? "PICKING"
      : order.status;


  const updatedOrders =
    orders.map(
      (item) =>
        item.id ===
        order.id
          ? {
              ...item,

              status:
                nextOrderStatus,

              pickingAt:
                hasStarted
                  ? (
                      item.pickingAt ||
                      now
                    )
                  : item.pickingAt,

              ...progressFields,
            }
          : item
    );


  return saveEntries([
    [
      OUTBOUND_STORAGE_KEY,
      updatedOrders,
    ],
  ]);
}


/* =========================================================
   COMPLETE INBOUND FROM PUTAWAY TASK
========================================================= */

function completeInbound(
  task,
  now
) {
  const orders =
    loadArray(
      INBOUND_STORAGE_KEY
    );


  const order =
    orders.find(
      (item) =>
        item.id ===
        task.sourceOrderId
    );


  if (!order) {
    return {
      ok: false,

      message:
        `Inbound order ${task.sourceOrderId} was not found.`,
    };
  }


  /*
   * Completed จากหน้า Inbound แล้ว
   *
   * ห้าม Inventory + ซ้ำ
   */

  if (
    order.status ===
    "COMPLETED"
  ) {
    return {
      ok: true,
    };
  }


  if (
    order.status !==
    "RECEIVED"
  ) {
    return {
      ok: false,

      message:
        `Inbound ${
          order.receiptNo ||
          order.id
        } must be RECEIVED before Putaway can be completed.`,
    };
  }


  const inventory =
    loadArray(
      INVENTORY_STORAGE_KEY
    );


  const putaway =
    applyInboundPutaway(
      inventory,
      order
    );


  if (!putaway.ok) {
    return putaway;
  }


  const updatedOrders =
    orders.map(
      (item) =>
        item.id ===
        order.id
          ? {
              ...item,

              status:
                "COMPLETED",

              completedAt:
                now,
            }
          : item
    );


  return saveEntries([
    [
      INVENTORY_STORAGE_KEY,
      putaway.inventory,
    ],

    [
      INBOUND_STORAGE_KEY,
      updatedOrders,
    ],
  ]);
}


/* =========================================================
   INBOUND INVENTORY +
========================================================= */

function applyInboundPutaway(
  inventory,
  order
) {
  const result =
    (
      inventory ||
      []
    ).map(
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


    if (
      !line.locationId
    ) {
      return {
        ok: false,

        message:
          `${line.sku}: Putaway Location is missing.`,
      };
    }


    /*
     * SKU เดิม + Location เดิม
     */

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
          ) +
          qty,
      };


      continue;
    }


    /*
     * หา SKU Master
     */

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


    /*
     * SKU เดิม แต่ Location ใหม่
     */

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


/* =========================================================
   OUTBOUND INVENTORY -
========================================================= */

function deductOutboundInventory(
  inventory,
  order
) {
  const result =
    (
      inventory ||
      []
    ).map(
      (item) => ({
        ...item,
      })
    );


  for (
    const line
    of order.lines ||
    []
  ) {
    for (
      const allocation
      of line.allocations ||
      []
    ) {
      const index =
        result.findIndex(
          (item) =>
            item.id ===
            allocation.inventoryId
        );


      if (
        index < 0
      ) {
        return {
          ok: false,

          message:
            `${line.sku}: Inventory record ${allocation.inventoryId} no longer exists.`,
        };
      }


      const currentQty =
        Number(
          result[
            index
          ].quantity ||
          0
        );


      const pickQty =
        Number(
          allocation.qty ||
          0
        );


      if (
        currentQty <
        pickQty
      ) {
        return {
          ok: false,

          message:
            `${line.sku}: Need ${pickQty} at ${allocation.locationId}, but only ${currentQty} remains.`,
        };
      }


      result[
        index
      ] = {
        ...result[
          index
        ],

        quantity:
          currentQty -
          pickQty,
      };
    }
  }


  return {
    ok: true,

    inventory:
      result,
  };
}


/* =========================================================
   SAME TAB EVENT
========================================================= */

export function notifyWmsDataChanged(
  keys
) {
  window.dispatchEvent(
    new CustomEvent(
      "wms-data-changed",
      {
        detail: {
          keys:
            Array.isArray(
              keys
            )
              ? keys
              : [],
        },
      }
    )
  );
}


/* =========================================================
   SAVE MULTIPLE LOCAL STORAGE
========================================================= */

function saveEntries(
  entries
) {
  try {
    entries.forEach(
      (
        [
          key,
          value,
        ]
      ) => {
        localStorage.setItem(
          key,

          JSON.stringify(
            value
          )
        );
      }
    );
  } catch (error) {
    console.error(
      "Could not sync warehouse operation.",
      error
    );


    return {
      ok: false,

      message:
        "Could not save Warehouse Operation changes.",
    };
  }


  /*
   * Storage event จะไม่เกิด
   * ใน Browser Tab เดียวกัน
   *
   * จึงต้องมี Custom Event
   */

  notifyWmsDataChanged(
    entries.map(
      ([key]) =>
        key
    )
  );


  return {
    ok: true,
  };
}


/* =========================================================
   LOAD ARRAY
========================================================= */

function loadArray(
  key
) {
  try {
    const saved =
      localStorage.getItem(
        key
      );


    if (!saved) {
      return [];
    }


    const parsed =
      JSON.parse(
        saved
      );


    return Array.isArray(
      parsed
    )
      ? parsed
      : [];
  } catch (error) {
    console.warn(
      `Could not load ${key}.`,
      error
    );


    return [];
  }
}


/* =========================================================
   NORMALIZE TASK
========================================================= */

function normalizeTask(
  task
) {
  return {
    id:
      String(
        task.id ||
        ""
      ),

    sourceKey:
      String(
        task.sourceKey ||
        ""
      ),

    type:
      String(
        task.type ||
        "PUTAWAY"
      ).toUpperCase(),

    sourceOrderType:
      String(
        task.sourceOrderType ||
        ""
      ).toUpperCase(),

    sourceOrderId:
      String(
        task.sourceOrderId ||
        ""
      ),

    sourceOrderNo:
      String(
        task.sourceOrderNo ||
        ""
      ),

    sourceOrderStatus:
      String(
        task.sourceOrderStatus ||
        ""
      ),

    sourceLineId:
      String(
        task.sourceLineId ||
        ""
      ),

    inventoryId:
      String(
        task.inventoryId ||
        ""
      ),

    sku:
      String(
        task.sku ||
        ""
      ),

    itemName:
      String(
        task.itemName ||
        ""
      ),

    quantity:
      Math.max(
        Number(
          task.quantity ||
          0
        ),
        0
      ),

    sourceLocationId:
      String(
        task.sourceLocationId ||
        ""
      ),

    destinationLocationId:
      String(
        task.destinationLocationId ||
        ""
      ),

    sourceLabel:
      String(
        task.sourceLabel ||
        "-"
      ),

    destinationLabel:
      String(
        task.destinationLabel ||
        "-"
      ),

    mapId:
      String(
        task.mapId ||
        ""
      ),

    sourceNodeId:
      String(
        task.sourceNodeId ||
        ""
      ),

    destinationNodeId:
      String(
        task.destinationNodeId ||
        ""
      ),

    priority:
      [
        "LOW",
        "NORMAL",
        "HIGH",
        "URGENT",
      ].includes(
        task.priority
      )
        ? task.priority
        : "NORMAL",

    status:
      [
        "PENDING",
        "IN_PROGRESS",
        "BLOCKED",
        "COMPLETED",
      ].includes(
        task.status
      )
        ? task.status
        : "PENDING",

    createdAt:
      task.createdAt ||
      new Date().toISOString(),

    startedAt:
      task.startedAt ||
      "",

    completedAt:
      task.completedAt ||
      "",

    blockedAt:
      task.blockedAt ||
      "",
  };
}


/* =========================================================
   MERGE STATUS
========================================================= */

function mergeTaskStatus(
  currentStatus,
  suggestedStatus
) {
  /*
   * ถ้า Operation จบแล้ว
   * Task ต้อง Completed
   */

  if (
    suggestedStatus ===
    "COMPLETED"
  ) {
    return "COMPLETED";
  }


  /*
   * Completed แล้วไม่ย้อนกลับ
   */

  if (
    currentStatus ===
    "COMPLETED"
  ) {
    return "COMPLETED";
  }


  /*
   * Blocked คงไว้
   */

  if (
    currentStatus ===
    "BLOCKED"
  ) {
    return "BLOCKED";
  }


  /*
   * สำคัญ:
   *
   * Outbound PICKING
   * จะไม่เปลี่ยน PENDING Task
   * ทั้งหมดเป็น IN_PROGRESS
   */

  return (
    currentStatus ||
    suggestedStatus ||
    "PENDING"
  );
}


/* =========================================================
   TASK ID
========================================================= */

function getHighestTaskNumber(
  tasks
) {
  let highest =
    0;


  (
    tasks ||
    []
  ).forEach(
    (task) => {
      const match =
        /^TASK-(\d+)$/i.exec(
          String(
            task.id ||
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


  return highest;
}


/* =========================================================
   INVENTORY ID
========================================================= */

function getNextInventoryId(
  inventory
) {
  let highest =
    0;


  (
    inventory ||
    []
  ).forEach(
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