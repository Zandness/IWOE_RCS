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

  racks: [
    {
      id: "RACK-001",

      name: "Rack A",

      x: 15,
      y: 9,

      width: 4,
      depth: 1.5,

      rotation: 0,

      levels: 4,

      slotsPerLevel: 6,
    },
  ],

  stations: [
    {
      id: "CHARGE-01",

      name: "Charging Station 1",

      type: "CHARGING",

      x: 3,
      y: 17,

      width: 2,
      depth: 2,

      rotation: 0,
    },

    {
      id: "DOCK-01",

      name: "Dock 1",

      type: "DOCK",

      x: 26,
      y: 17,

      width: 3,
      depth: 2,

      rotation: 0,
    },
  ],
};