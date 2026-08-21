export const MOCK_ROBOTS = [
  {
    id: "AMR-01",
    type: "AMR",

    status: "MOVING",

    battery: 84,

    x: 7,
    y: 5,

    currentNode: "P001",
    nextNode: "P002",

    destination: "P003",

    task: "Order Picking",

    speed: 1.2,

    plannedPath: [
      "P001",
      "P002",
      "P003",
    ],
  },

  {
    id: "AMR-02",
    type: "AMR",

    status: "IDLE",

    battery: 93,

    x: 12,
    y: 10,

    currentNode: "P002",
    nextNode: null,

    destination: null,

    task: "Standby",

    speed: 0,

    plannedPath: [],
  },

  {
    id: "AGV-01",
    type: "AGV",

    status: "CHARGING",

    battery: 38,

    x: 3,
    y: 17,

    currentNode: null,
    nextNode: null,

    destination: "CHARGE-01",

    task: "Charging",

    speed: 0,

    plannedPath: [],
  },
];