import { useState } from "react";

import {
  Map,
  Info,
} from "lucide-react";

import MapToolbar
  from "../components/map/MapToolbar";

import MapCanvas
  from "../components/map/MapCanvas";

import MapProperties
  from "../components/map/MapProperties";

import MapObjectProperties
  from "../components/map/MapObjectProperties";

import {
  INITIAL_MAP,
} from "../data/mockWarehouseMap";

import "../map-editor.css";

export default function WarehouseMap() {
  /*
   * ==========================
   * MAP STATE
   * ==========================
   */

  const [
    mapData,
    setMapData,
  ] = useState(() =>
    structuredClone(
      INITIAL_MAP
    )
  );

  const [
    tool,
    setTool,
  ] = useState("select");

  /*
   * Selected topology node
   */

  const [
    selectedNodeId,
    setSelectedNodeId,
  ] = useState(null);

  /*
   * Rack or station selection
   */

  const [
    selectedObject,
    setSelectedObject,
  ] = useState(null);

  /*
   * First node when connecting
   */

  const [
    connectionStart,
    setConnectionStart,
  ] = useState(null);

  /*
   * ==========================
   * DERIVED DATA
   * ==========================
   */

  const selectedNode =
    mapData.nodes.find(
      (node) =>
        node.id ===
        selectedNodeId
    ) || null;

  const selectedMapObject =
    getSelectedMapObject(
      mapData,
      selectedObject
    );

  /*
   * ==========================
   * CANVAS CLICK
   * ==========================
   */

  function handleCanvasClick(
    position
  ) {
    /*
     * Add topology node
     */

    if (tool === "node") {
      addNode(position);
      return;
    }

    /*
     * Add Rack
     */

    if (tool === "rack") {
      addRack(position);
      return;
    }

    /*
     * Add Dock
     */

    if (tool === "dock") {
      addStation(
        position,
        "DOCK"
      );

      return;
    }

    /*
     * Add Charging Station
     */

    if (
      tool === "charging"
    ) {
      addStation(
        position,
        "CHARGING"
      );

      return;
    }

    /*
     * Clear selection
     */

    if (tool === "select") {
      setSelectedNodeId(
        null
      );

      setSelectedObject(
        null
      );
    }
  }

  /*
   * ==========================
   * ADD NODE
   * ==========================
   */

  function addNode({
    x,
    y,
  }) {
    const spacing =
      mapData.gridSpacing ||
      1;

    const position =
      snapPosition(
        x,
        y,
        spacing
      );

    const id =
      getNextId(
        mapData.nodes,
        "P",
        3
      );

    const number =
      id.replace("P", "");

    const newNode = {
      id,

      name:
        `Point-${number}`,

      type: "NORMAL",

      x: clamp(
        position.x,
        0,
        mapData.width
      ),

      y: clamp(
        position.y,
        0,
        mapData.height
      ),
    };

    setMapData(
      (previous) => ({
        ...previous,

        nodes: [
          ...previous.nodes,
          newNode,
        ],
      })
    );

    setSelectedNodeId(id);

    setSelectedObject(null);

    setTool("select");
  }

  /*
   * ==========================
   * ADD RACK
   * ==========================
   */

  function addRack({
    x,
    y,
  }) {
    const position =
      snapPosition(
        x,
        y,
        mapData.gridSpacing ||
          1
      );

    const id =
      getNextId(
        mapData.racks,
        "RACK-",
        3
      );

    const newRack = {
      id,

      name: `Rack ${
        mapData.racks.length +
        1
      }`,

      x: clamp(
        position.x,
        0,
        mapData.width
      ),

      y: clamp(
        position.y,
        0,
        mapData.height
      ),

      width: 4,

      depth: 1.5,

      rotation: 0,

      levels: 4,

      slotsPerLevel: 6,
    };

    setMapData(
      (previous) => ({
        ...previous,

        racks: [
          ...previous.racks,
          newRack,
        ],
      })
    );

    setSelectedNodeId(
      null
    );

    setSelectedObject({
      type: "rack",
      id,
    });

    setTool("select");
  }

  /*
   * ==========================
   * ADD STATION
   * ==========================
   */

  function addStation(
    position,
    type
  ) {
    const snapped =
      snapPosition(
        position.x,
        position.y,
        mapData.gridSpacing ||
          1
      );

    const prefix =
      type === "DOCK"
        ? "DOCK-"
        : "CHARGE-";

    const id =
      getNextId(
        mapData.stations.filter(
          (station) =>
            station.type ===
            type
        ),
        prefix,
        2
      );

    const count =
      mapData.stations.filter(
        (station) =>
          station.type ===
          type
      ).length + 1;

    const station = {
      id,

      name:
        type === "DOCK"
          ? `Dock ${count}`
          : `Charging Station ${count}`,

      type,

      x: clamp(
        snapped.x,
        0,
        mapData.width
      ),

      y: clamp(
        snapped.y,
        0,
        mapData.height
      ),

      width:
        type === "DOCK"
          ? 3
          : 2,

      depth: 2,

      rotation: 0,
    };

    setMapData(
      (previous) => ({
        ...previous,

        stations: [
          ...previous.stations,
          station,
        ],
      })
    );

    setSelectedNodeId(
      null
    );

    setSelectedObject({
      type: "station",
      id,
    });

    setTool("select");
  }

  /*
   * ==========================
   * NODE CLICK
   * ==========================
   */

  function handleNodeClick(
    nodeId
  ) {
    /*
     * Path creation
     */

    if (
      tool === "connect"
    ) {
      /*
       * First Node
       */

      if (
        !connectionStart
      ) {
        setConnectionStart(
          nodeId
        );

        return;
      }

      /*
       * Cancel same Node
       */

      if (
        connectionStart ===
        nodeId
      ) {
        setConnectionStart(
          null
        );

        return;
      }

      /*
       * Create connection
       */

      createConnection(
        connectionStart,
        nodeId
      );

      setConnectionStart(
        null
      );

      return;
    }

    setSelectedObject(null);

    setSelectedNodeId(
      nodeId
    );
  }

  /*
   * ==========================
   * OBJECT CLICK
   * ==========================
   */

  function handleObjectClick(
    object
  ) {
    setSelectedNodeId(null);

    setConnectionStart(null);

    setSelectedObject(
      object
    );

    setTool("select");
  }

  /*
   * ==========================
   * CREATE PATH
   * ==========================
   */

  function createConnection(
    fromId,
    toId
  ) {
    const alreadyExists =
      mapData.edges.some(
        (edge) =>
          (edge.from ===
            fromId &&
            edge.to ===
              toId) ||
          (edge.from ===
            toId &&
            edge.to ===
              fromId)
      );

    if (alreadyExists) {
      return;
    }

    const from =
      mapData.nodes.find(
        (node) =>
          node.id ===
          fromId
      );

    const to =
      mapData.nodes.find(
        (node) =>
          node.id ===
          toId
      );

    if (!from || !to) {
      return;
    }

    const newEdge = {
      id:
        getNextId(
          mapData.edges,
          "E",
          3
        ),

      from: fromId,

      to: toId,

      distance:
        calculateDistance(
          from,
          to
        ),

      autoDistance: true,

      bidirectional: true,
    };

    setMapData(
      (previous) => ({
        ...previous,

        edges: [
          ...previous.edges,
          newEdge,
        ],
      })
    );
  }

  /*
   * ==========================
   * DRAG NODE
   * ==========================
   */

  function handleNodeMove(
    nodeId,
    x,
    y
  ) {
    setMapData(
      (previous) => {
        const nodes =
          previous.nodes.map(
            (node) =>
              node.id ===
              nodeId
                ? {
                    ...node,

                    x: clamp(
                      x,
                      0,
                      previous.width
                    ),

                    y: clamp(
                      y,
                      0,
                      previous.height
                    ),
                  }
                : node
          );

        return {
          ...previous,

          nodes,

          edges:
            recalculateEdges(
              previous.edges,
              nodes
            ),
        };
      }
    );
  }

  /*
   * ==========================
   * NODE PROPERTY CHANGE
   * ==========================
   */

  function handleNodeChange(
    field,
    value
  ) {
    if (
      !selectedNodeId
    ) {
      return;
    }

    setMapData(
      (previous) => {
        const nodes =
          previous.nodes.map(
            (node) => {
              if (
                node.id !==
                selectedNodeId
              ) {
                return node;
              }

              let nextValue =
                value;

              if (
                field === "x"
              ) {
                nextValue =
                  clamp(
                    value,
                    0,
                    previous.width
                  );
              }

              if (
                field === "y"
              ) {
                nextValue =
                  clamp(
                    value,
                    0,
                    previous.height
                  );
              }

              return {
                ...node,

                [field]:
                  nextValue,
              };
            }
          );

        return {
          ...previous,

          nodes,

          edges:
            recalculateEdges(
              previous.edges,
              nodes
            ),
        };
      }
    );
  }

  /*
   * ==========================
   * OBJECT PROPERTY CHANGE
   * ==========================
   */

  function handleObjectChange(
    field,
    value
  ) {
    if (
      !selectedObject
    ) {
      return;
    }

    if (
      selectedObject.type ===
      "rack"
    ) {
      setMapData(
        (previous) => ({
          ...previous,

          racks:
            previous.racks.map(
              (rack) =>
                rack.id ===
                selectedObject.id
                  ? {
                      ...rack,

                      [field]:
                        normalizeObjectValue(
                          field,
                          value,
                          previous
                        ),
                    }
                  : rack
            ),
        })
      );

      return;
    }

    if (
      selectedObject.type ===
      "station"
    ) {
      setMapData(
        (previous) => ({
          ...previous,

          stations:
            previous.stations.map(
              (station) =>
                station.id ===
                selectedObject.id
                  ? {
                      ...station,

                      [field]:
                        normalizeObjectValue(
                          field,
                          value,
                          previous
                        ),
                    }
                  : station
            ),
        })
      );
    }
  }

  /*
   * ==========================
   * MAP PROPERTY CHANGE
   * ==========================
   */

  function handleMapChange(
    field,
    value
  ) {
    if (
      field === "width" ||
      field === "height"
    ) {
      if (
        !Number.isFinite(
          value
        ) ||
        value <= 0
      ) {
        return;
      }
    }

    if (
      field ===
      "gridSpacing"
    ) {
      if (
        !Number.isFinite(
          value
        ) ||
        value <= 0
      ) {
        return;
      }
    }

    setMapData(
      (previous) => ({
        ...previous,

        [field]: value,
      })
    );
  }

  /*
   * ==========================
   * DELETE
   * ==========================
   */

  function handleDelete() {
    /*
     * Delete selected node
     */

    if (
      selectedNodeId
    ) {
      setMapData(
        (previous) => ({
          ...previous,

          nodes:
            previous.nodes.filter(
              (node) =>
                node.id !==
                selectedNodeId
            ),

          edges:
            previous.edges.filter(
              (edge) =>
                edge.from !==
                  selectedNodeId &&
                edge.to !==
                  selectedNodeId
            ),
        })
      );

      setSelectedNodeId(
        null
      );

      setConnectionStart(
        null
      );

      return;
    }

    /*
     * Delete rack
     */

    if (
      selectedObject?.type ===
      "rack"
    ) {
      setMapData(
        (previous) => ({
          ...previous,

          racks:
            previous.racks.filter(
              (rack) =>
                rack.id !==
                selectedObject.id
            ),
        })
      );

      setSelectedObject(
        null
      );

      return;
    }

    /*
     * Delete station
     */

    if (
      selectedObject?.type ===
      "station"
    ) {
      setMapData(
        (previous) => ({
          ...previous,

          stations:
            previous.stations.filter(
              (station) =>
                station.id !==
                selectedObject.id
            ),
        })
      );

      setSelectedObject(
        null
      );
    }
  }

  /*
   * ==========================
   * EXPORT JSON
   * ==========================
   */

  function handleExport() {
    const json =
      JSON.stringify(
        mapData,
        null,
        2
      );

    const blob =
      new Blob(
        [json],
        {
          type:
            "application/json",
        }
      );

    const url =
      URL.createObjectURL(
        blob
      );

    const link =
      document.createElement(
        "a"
      );

    link.href = url;

    link.download =
      `${sanitizeFilename(
        mapData.name
      )}.json`;

    document.body.appendChild(
      link
    );

    link.click();

    link.remove();

    URL.revokeObjectURL(
      url
    );
  }

  /*
   * ==========================
   * RESET
   * ==========================
   */

  function handleReset() {
    setMapData(
      structuredClone(
        INITIAL_MAP
      )
    );

    setTool("select");

    setSelectedNodeId(
      null
    );

    setSelectedObject(
      null
    );

    setConnectionStart(
      null
    );
  }

  /*
   * ==========================
   * UI
   * ==========================
   */

  return (
    <div className="page">
      {/* HEADER */}

      <div className="page-header">
        <div>
          <span className="page-label">
            WAREHOUSE MAP DESIGN
          </span>

          <h2>
            Map Editor
          </h2>

          <p>
            Create warehouse
            topology, racks,
            stations and travel
            paths.
          </p>
        </div>

        <div className="map-editor-info">
          <Map size={16} />

          <span>
            {mapData.width}
            {" × "}
            {mapData.height}
            {" "}
            {mapData.unit}
          </span>
        </div>
      </div>

      {/* TOOLBAR */}

      <MapToolbar
        tool={tool}
        setTool={(nextTool) => {
          setTool(
            nextTool
          );

          setConnectionStart(
            null
          );
        }}
        onDelete={
          handleDelete
        }
        onExport={
          handleExport
        }
        onReset={
          handleReset
        }
      />

      {/* EDITOR */}

      <div className="map-editor-layout">
        {/* CANVAS */}

        <section className="panel map-main-panel">
          <div className="panel-header">
            <h3>
              Warehouse Topology
            </h3>

            <span>
              {
                mapData.nodes
                  .length
              }{" "}
              nodes
              {" • "}
              {
                mapData.edges
                  .length
              }{" "}
              paths
              {" • "}
              {
                mapData.racks
                  .length
              }{" "}
              racks
            </span>
          </div>

          {/* INFORMATION */}

          {tool ===
            "connect" && (
            <EditorMessage>
              {connectionStart
                ? `Start node ${connectionStart} selected. Select destination node.`
                : "Select the first node to create a path."}
            </EditorMessage>
          )}

          {tool ===
            "node" && (
            <EditorMessage>
              Click on the grid
              to create a topology
              node.
            </EditorMessage>
          )}

          {tool ===
            "rack" && (
            <EditorMessage>
              Click on the grid
              to place a new rack.
            </EditorMessage>
          )}

          {tool ===
            "dock" && (
            <EditorMessage>
              Click on the grid
              to place a dock.
            </EditorMessage>
          )}

          {tool ===
            "charging" && (
            <EditorMessage>
              Click on the grid
              to place a charging
              station.
            </EditorMessage>
          )}

          {/* MAP */}

          <MapCanvas
            mapData={
              mapData
            }
            tool={tool}
            selectedNodeId={
              selectedNodeId
            }
            selectedObject={
              selectedObject
            }
            connectionStart={
              connectionStart
            }
            onCanvasClick={
              handleCanvasClick
            }
            onNodeClick={
              handleNodeClick
            }
            onNodeMove={
              handleNodeMove
            }
            onObjectClick={
              handleObjectClick
            }
          />
        </section>

        {/* PROPERTIES */}

        <aside className="panel map-properties">
          {selectedMapObject ? (
            <MapObjectProperties
              object={
                selectedMapObject
              }
              objectType={
                selectedObject.type
              }
              onChange={
                handleObjectChange
              }
            />
          ) : (
            <MapProperties
              mapData={
                mapData
              }
              selectedNode={
                selectedNode
              }
              onMapChange={
                handleMapChange
              }
              onNodeChange={
                handleNodeChange
              }
            />
          )}
        </aside>
      </div>
    </div>
  );
}

/*
 * ==========================================
 * SMALL COMPONENTS
 * ==========================================
 */

function EditorMessage({
  children,
}) {
  return (
    <div className="map-editor-message">
      <Info size={15} />

      <span>{children}</span>
    </div>
  );
}

/*
 * ==========================================
 * HELPERS
 * ==========================================
 */

function calculateDistance(
  pointA,
  pointB
) {
  const dx =
    pointB.x -
    pointA.x;

  const dy =
    pointB.y -
    pointA.y;

  return Number(
    Math.sqrt(
      dx * dx +
        dy * dy
    ).toFixed(2)
  );
}

function recalculateEdges(
  edges,
  nodes
) {
  return edges.map(
    (edge) => {
      if (
        !edge.autoDistance
      ) {
        return edge;
      }

      const from =
        nodes.find(
          (node) =>
            node.id ===
            edge.from
        );

      const to =
        nodes.find(
          (node) =>
            node.id ===
            edge.to
        );

      if (!from || !to) {
        return edge;
      }

      return {
        ...edge,

        distance:
          calculateDistance(
            from,
            to
          ),
      };
    }
  );
}

function getSelectedMapObject(
  mapData,
  selection
) {
  if (!selection) {
    return null;
  }

  if (
    selection.type ===
    "rack"
  ) {
    return (
      mapData.racks.find(
        (rack) =>
          rack.id ===
          selection.id
      ) || null
    );
  }

  if (
    selection.type ===
    "station"
  ) {
    return (
      mapData.stations.find(
        (station) =>
          station.id ===
          selection.id
      ) || null
    );
  }

  return null;
}

function snapPosition(
  x,
  y,
  spacing
) {
  if (
    !spacing ||
    spacing <= 0
  ) {
    return {
      x,
      y,
    };
  }

  return {
    x:
      Math.round(
        x / spacing
      ) * spacing,

    y:
      Math.round(
        y / spacing
      ) * spacing,
  };
}

function clamp(
  value,
  minimum,
  maximum
) {
  const numeric =
    Number(value);

  if (
    !Number.isFinite(
      numeric
    )
  ) {
    return minimum;
  }

  return Math.min(
    Math.max(
      numeric,
      minimum
    ),
    maximum
  );
}

function normalizeObjectValue(
  field,
  value,
  mapData
) {
  if (field === "x") {
    return clamp(
      value,
      0,
      mapData.width
    );
  }

  if (field === "y") {
    return clamp(
      value,
      0,
      mapData.height
    );
  }

  if (
    field === "width" ||
    field === "depth"
  ) {
    return Math.max(
      Number(value) || 0.1,
      0.1
    );
  }

  if (
    field === "levels" ||
    field ===
      "slotsPerLevel"
  ) {
    return Math.max(
      Math.round(
        Number(value) || 1
      ),
      1
    );
  }

  if (
    field === "rotation"
  ) {
    return Number(value) || 0;
  }

  return value;
}

function getNextId(
  items,
  prefix,
  padding
) {
  let highest = 0;

  for (const item of items) {
    if (
      !item.id.startsWith(
        prefix
      )
    ) {
      continue;
    }

    const suffix =
      item.id.slice(
        prefix.length
      );

    const number =
      Number(suffix);

    if (
      Number.isFinite(
        number
      )
    ) {
      highest =
        Math.max(
          highest,
          number
        );
    }
  }

  return `${prefix}${String(
    highest + 1
  ).padStart(
    padding,
    "0"
  )}`;
}

function sanitizeFilename(
  name
) {
  return (
    name
      ?.trim()
      .replace(
        /[^a-zA-Z0-9-_ ]/g,
        ""
      )
      .replace(/\s+/g, "_") ||
    "warehouse-map"
  );
}