export const INITIAL_MAP = {
  mapId: "MAP-001",
  name: "Main Warehouse",
  unit: "meter",

  width: 30,
  height: 20,

  gridSpacing: 1,

  nodes: [
    {
      id: "P001",
      name: "Point-001",
      type: "NORMAL",
      x: 5,
      y: 5,
    },
    {
      id: "P002",
      name: "Point-002",
      type: "STORAGE",
      x: 10,
      y: 5,
    },
  ],

  edges: [
    {
      id: "E001",
      from: "P001",
      to: "P002",
      distance: 5,
      autoDistance: true,
      bidirectional: true,
    },
  ],

  racks: [],

  stations: [],
};