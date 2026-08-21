export const MOCK_ROBOTS = [
  {
    id: "AMR-01",

    type: "AMR",

    status: "MOVING",

    battery: 84,

    x: 11,
    y: 5,

    currentNode: "P002",

    nextNode: "P003",

    destination: "P004",

    task: "Order Picking",

    speed: 1.2,

    plannedPath: [
      "P002",
      "P003",
      "P004",
    ],
  },

  {
    id: "AMR-02",

    type: "AMR",

    status: "IDLE",

    battery: 93,

    x: 5,
    y: 5,

    currentNode: "P001",

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

    x: 20,
    y: 10,

    currentNode: "P004",

    nextNode: null,

    destination: "P004",

    task: "Charging",

    speed: 0,

    plannedPath: [],
  },
];