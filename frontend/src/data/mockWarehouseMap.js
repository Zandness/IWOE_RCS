export const INITIAL_MAP = {
  mapId: "MAP-001",

  name: "Main Warehouse",

  unit: "meter",

  originX: 0,
  originY: 0,

  width: 30,
  height: 20,

  gridSpacing: 1,

  showBoundary: true,
  snapBoundaryToGrid: true,

  nodes: [
    {
      id: "P001",

      name: "Start Point",

      type: "HOME",

      x: 5,
      y: 5,

      rotation: 0,

      enabled: true,

      config: {},
    },

    {
      id: "P002",

      name: "Main Waypoint",

      type: "WAYPOINT",

      x: 10,
      y: 5,

      rotation: 0,

      enabled: true,

      config: {},
    },

    {
      id: "P003",

      name: "Storage A",

      type: "STORAGE",

      x: 15,
      y: 5,

      rotation: 0,

      enabled: true,

      config: {
        width: 4,
        depth: 2,

        zone: "A",

        levels: 4,

        slotsPerLevel: 6,
      },
    },

    {
      id: "P004",

      name: "Charging Station 1",

      type: "CHARGING",

      x: 20,
      y: 10,

      rotation: 0,

      enabled: true,

      config: {
        width: 2,
        depth: 2,

        chargerId: "CHG-01",
      },
    },

    {
      id: "P005",

      name: "Dock 1",

      type: "DOCK",

      x: 24,
      y: 15,

      rotation: 0,

      enabled: true,

      config: {
        width: 3,
        depth: 2,
      },
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

      enabled: true,

      speedLimit: 1.2,

      pathType: "NORMAL",

      vehicleAccess: "BOTH",
    },

    {
      id: "E002",

      from: "P002",
      to: "P003",

      distance: 5,

      autoDistance: true,

      bidirectional: true,

      enabled: true,

      speedLimit: 0.8,

      pathType: "SLOW",

      vehicleAccess: "BOTH",
    },

    {
      id: "E003",

      from: "P003",
      to: "P004",

      distance: 7.071,

      autoDistance: true,

      bidirectional: false,

      enabled: true,

      speedLimit: 1,

      pathType: "NORMAL",

      vehicleAccess: "AMR",
    },

    {
      id: "E004",

      from: "P004",
      to: "P005",

      distance: 6.403,

      autoDistance: true,

      bidirectional: true,

      enabled: true,

      speedLimit: 1.2,

      pathType: "RESTRICTED",

      vehicleAccess: "AGV",
    },
  ],
};