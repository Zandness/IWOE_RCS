import {
  useRef,
  useState,
} from "react";

import {
  Map,
  Info,
  CheckCircle2,
} from "lucide-react";

import MapToolbar
  from "../components/map/MapToolbar";

import MapCanvas
  from "../components/map/MapCanvas";

import MapProperties
  from "../components/map/MapProperties";

import MapObjectProperties
  from "../components/map/MapObjectProperties";

import MapObjectTree
  from "../components/map/MapObjectTree";

import {
  INITIAL_MAP,
} from "../data/mockWarehouseMap";

import "../map-editor.css";


const STORAGE_KEY =
  "wms-warehouse-map";


export default function WarehouseMap() {
  /*
   * ================================
   * INITIAL MAP
   * ================================
   */

  const [
    mapData,
    setMapData,
  ] = useState(() => {
    try {
      const saved =
        localStorage.getItem(
          STORAGE_KEY
        );

      if (saved) {
        return JSON.parse(
          saved
        );
      }
    } catch (error) {
      console.warn(
        "Could not load saved map.",
        error
      );
    }

    return structuredClone(
      INITIAL_MAP
    );
  });


  /*
   * ================================
   * EDITOR STATE
   * ================================
   */

  const [
    tool,
    setTool,
  ] = useState("select");

  const [
    selectedNodeId,
    setSelectedNodeId,
  ] = useState(null);

  const [
    selectedObject,
    setSelectedObject,
  ] = useState(null);

  const [
    connectionStart,
    setConnectionStart,
  ] = useState(null);

  const [
    zoom,
    setZoom,
  ] = useState(1);

  const [
    expanded,
    setExpanded,
  ] = useState(false);

  const [
    saveStatus,
    setSaveStatus,
  ] = useState("");


  /*
   * ================================
   * UNDO / REDO
   * ================================
   */

  const [
    undoStack,
    setUndoStack,
  ] = useState([]);

  const [
    redoStack,
    setRedoStack,
  ] = useState([]);

  const dragStartSnapshot =
    useRef(null);

  const objectDragStartSnapshot =
    useRef(null);


  /*
   * ================================
   * SELECTED DATA
   * ================================
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
   * ================================
   * HISTORY
   * ================================
   */

  function commitMap(updater) {
    setMapData((current) => {
      const next =
        typeof updater ===
        "function"
          ? updater(
              structuredClone(
                current
              )
            )
          : updater;

      setUndoStack(
        (history) => [
          ...history.slice(-49),
          structuredClone(
            current
          ),
        ]
      );

      setRedoStack([]);

      setSaveStatus(
        "Unsaved changes"
      );

      return next;
    });
  }


  function handleUndo() {
    if (
      undoStack.length === 0
    ) {
      return;
    }

    const previous =
      undoStack[
        undoStack.length - 1
      ];

    setRedoStack(
      (current) => [
        ...current,
        structuredClone(
          mapData
        ),
      ]
    );

    setUndoStack(
      (current) =>
        current.slice(0, -1)
    );

    setMapData(
      structuredClone(
        previous
      )
    );

    clearSelection();

    setSaveStatus(
      "Unsaved changes"
    );
  }


  function handleRedo() {
    if (
      redoStack.length === 0
    ) {
      return;
    }

    const next =
      redoStack[
        redoStack.length - 1
      ];

    setUndoStack(
      (current) => [
        ...current,
        structuredClone(
          mapData
        ),
      ]
    );

    setRedoStack(
      (current) =>
        current.slice(0, -1)
    );

    setMapData(
      structuredClone(next)
    );

    clearSelection();

    setSaveStatus(
      "Unsaved changes"
    );
  }


  /*
   * ================================
   * SAVE
   * ================================
   */

  function handleSave() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(
          mapData
        )
      );

      setSaveStatus("Saved");
    } catch (error) {
      console.error(
        "Save error:",
        error
      );

      setSaveStatus(
        "Save failed"
      );
    }
  }


  /*
   * ================================
   * ZOOM
   * ================================
   */

  function zoomIn() {
    setZoom((current) =>
      Math.min(
        current + 0.1,
        2.5
      )
    );
  }


  function zoomOut() {
    setZoom((current) =>
      Math.max(
        current - 0.1,
        0.4
      )
    );
  }


  function fitMap() {
    setZoom(1);
  }


  /*
   * ================================
   * CANVAS CLICK
   * ================================
   */

  function handleCanvasClick(
    position
  ) {
    if (tool === "node") {
      addNode(position);
      return;
    }

    if (tool === "rack") {
      addRack(position);
      return;
    }

    if (tool === "dock") {
      addStation(
        position,
        "DOCK"
      );
      return;
    }

    if (
      tool === "charging"
    ) {
      addStation(
        position,
        "CHARGING"
      );
      return;
    }

    if (tool === "select") {
      clearSelection();
    }
  }


  /*
   * ================================
   * ADD NODE
   * ================================
   */

  function addNode({
    x,
    y,
  }) {
    const spacing =
      mapData.gridSpacing || 1;

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

    commitMap(
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
   * ================================
   * ADD RACK
   * ================================
   */

  function addRack({
    x,
    y,
  }) {
    const position =
      snapPosition(
        x,
        y,
        mapData.gridSpacing || 1
      );

    const id =
      getNextId(
        mapData.racks,
        "RACK-",
        3
      );

    const newRack = {
      id,

      name:
        `Rack ${
          mapData.racks.length + 1
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

    commitMap(
      (previous) => ({
        ...previous,

        racks: [
          ...previous.racks,
          newRack,
        ],
      })
    );

    setSelectedNodeId(null);

    setSelectedObject({
      type: "rack",
      id,
    });

    setTool("select");
  }


  /*
   * ================================
   * ADD STATION
   * ================================
   */

  function addStation(
    position,
    type
  ) {
    const snapped =
      snapPosition(
        position.x,
        position.y,
        mapData.gridSpacing || 1
      );

    const prefix =
      type === "DOCK"
        ? "DOCK-"
        : "CHARGE-";

    const sameType =
      mapData.stations.filter(
        (station) =>
          station.type === type
      );

    const id =
      getNextId(
        sameType,
        prefix,
        2
      );

    const count =
      sameType.length + 1;

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

    commitMap(
      (previous) => ({
        ...previous,

        stations: [
          ...previous.stations,
          station,
        ],
      })
    );

    setSelectedNodeId(null);

    setSelectedObject({
      type: "station",
      id,
    });

    setTool("select");
  }


  /*
   * ================================
   * NODE CLICK
   * ================================
   */

  function handleNodeClick(
    nodeId
  ) {
    if (
      tool === "connect"
    ) {
      if (!connectionStart) {
        setConnectionStart(
          nodeId
        );

        return;
      }

      if (
        connectionStart ===
        nodeId
      ) {
        setConnectionStart(null);
        return;
      }

      createConnection(
        connectionStart,
        nodeId
      );

      setConnectionStart(null);

      return;
    }

    setSelectedObject(null);
    setSelectedNodeId(nodeId);
  }


  /*
   * ================================
   * OBJECT CLICK
   * ================================
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
   * ================================
   * CREATE PATH
   * ================================
   */

  function createConnection(
    fromId,
    toId
  ) {
    const alreadyExists =
      mapData.edges.some(
        (edge) =>
          (
            edge.from === fromId &&
            edge.to === toId
          ) ||
          (
            edge.from === toId &&
            edge.to === fromId
          )
      );

    if (alreadyExists) {
      return;
    }

    const from =
      mapData.nodes.find(
        (node) =>
          node.id === fromId
      );

    const to =
      mapData.nodes.find(
        (node) =>
          node.id === toId
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

    commitMap(
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
   * ================================
   * NODE DRAG
   * ================================
   */

  function handleNodeDragStart() {
    dragStartSnapshot.current =
      structuredClone(
        mapData
      );
  }


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
              node.id === nodeId
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

    setSaveStatus(
      "Unsaved changes"
    );
  }


  function handleNodeDragEnd() {
    if (
      !dragStartSnapshot.current
    ) {
      return;
    }

    setUndoStack(
      (history) => [
        ...history.slice(-49),
        dragStartSnapshot.current,
      ]
    );

    setRedoStack([]);

    dragStartSnapshot.current =
      null;
  }


  /*
   * ================================
   * OBJECT DRAG
   * ================================
   */

  function handleObjectDragStart() {
    objectDragStartSnapshot.current =
      structuredClone(
        mapData
      );
  }


  function handleObjectMove(
    type,
    objectId,
    x,
    y
  ) {
    setMapData(
      (previous) => {
        if (
          type === "rack"
        ) {
          return {
            ...previous,

            racks:
              previous.racks.map(
                (rack) =>
                  rack.id === objectId
                    ? {
                        ...rack,

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
                    : rack
              ),
          };
        }

        if (
          type === "station"
        ) {
          return {
            ...previous,

            stations:
              previous.stations.map(
                (station) =>
                  station.id === objectId
                    ? {
                        ...station,

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
                    : station
              ),
          };
        }

        return previous;
      }
    );

    setSaveStatus(
      "Unsaved changes"
    );
  }


  function handleObjectDragEnd() {
    if (
      !objectDragStartSnapshot.current
    ) {
      return;
    }

    setUndoStack(
      (history) => [
        ...history.slice(-49),

        objectDragStartSnapshot.current,
      ]
    );

    setRedoStack([]);

    objectDragStartSnapshot.current =
      null;
  }


  /*
   * ================================
   * NODE PROPERTY CHANGE
   * ================================
   */

  function handleNodeChange(
    field,
    value
  ) {
    if (!selectedNodeId) {
      return;
    }

    commitMap(
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
   * ================================
   * OBJECT PROPERTY CHANGE
   * ================================
   */

  function handleObjectChange(
    field,
    value
  ) {
    if (!selectedObject) {
      return;
    }

    if (
      selectedObject.type ===
      "rack"
    ) {
      commitMap(
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
      commitMap(
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
   * ================================
   * MAP PROPERTY CHANGE
   * ================================
   */

  function handleMapChange(
    field,
    value
  ) {
    if (
      (
        field === "width" ||
        field === "height" ||
        field === "gridSpacing"
      ) &&
      (
        !Number.isFinite(
          value
        ) ||
        value <= 0
      )
    ) {
      return;
    }

    commitMap(
      (previous) => ({
        ...previous,

        [field]:
          value,
      })
    );
  }


  /*
   * ================================
   * DELETE
   * ================================
   */

  function handleDelete() {
    if (selectedNodeId) {
      commitMap(
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

      clearSelection();
      return;
    }

    if (
      selectedObject?.type ===
      "rack"
    ) {
      commitMap(
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

      clearSelection();
      return;
    }

    if (
      selectedObject?.type ===
      "station"
    ) {
      commitMap(
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

      clearSelection();
    }
  }


  /*
   * ================================
   * EXPORT
   * ================================
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
   * ================================
   * RESET
   * ================================
   */

  function handleReset() {
    commitMap(
      structuredClone(
        INITIAL_MAP
      )
    );

    clearSelection();

    setTool("select");
    setZoom(1);
  }


  /*
   * ================================
   * SELECTION
   * ================================
   */

  function clearSelection() {
    setSelectedNodeId(null);
    setSelectedObject(null);
    setConnectionStart(null);
  }


  /*
   * ================================
   * UI
   * ================================
   */

  return (
    <div
      className={
        expanded
          ? "page map-page-expanded"
          : "page"
      }
    >
      <div className="page-header">
        <div>
          <span className="page-label">
            WAREHOUSE MAP DESIGN
          </span>

          <h2>
            Map Editor
          </h2>

          <p>
            Create warehouse topology,
            racks, stations and travel paths.
          </p>
        </div>

        <div className="map-header-right">
          {saveStatus && (
            <div
              className={
                saveStatus === "Saved"
                  ? "map-save-status saved"
                  : "map-save-status"
              }
            >
              {saveStatus ===
                "Saved" && (
                <CheckCircle2
                  size={14}
                />
              )}

              {saveStatus}
            </div>
          )}

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
      </div>


      <MapToolbar
        tool={tool}

        setTool={(nextTool) => {
          setTool(nextTool);

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

        onSave={
          handleSave
        }

        onUndo={
          handleUndo
        }

        onRedo={
          handleRedo
        }

        canUndo={
          undoStack.length > 0
        }

        canRedo={
          redoStack.length > 0
        }

        zoom={zoom}

        onZoomIn={
          zoomIn
        }

        onZoomOut={
          zoomOut
        }

        onFit={
          fitMap
        }

        expanded={
          expanded
        }

        onToggleExpand={() =>
          setExpanded(
            (current) =>
              !current
          )
        }
      />


      <div
        className={
          expanded
            ? "map-editor-layout-v4 expanded"
            : "map-editor-layout-v4"
        }
      >
        {!expanded && (
          <MapObjectTree
            mapData={
              mapData
            }

            selectedNodeId={
              selectedNodeId
            }

            selectedObject={
              selectedObject
            }

            onSelectNode={(
              nodeId
            ) => {
              setSelectedObject(
                null
              );

              setSelectedNodeId(
                nodeId
              );

              setTool(
                "select"
              );
            }}

            onSelectObject={(
              object
            ) => {
              setSelectedNodeId(
                null
              );

              setSelectedObject(
                object
              );

              setTool(
                "select"
              );
            }}
          />
        )}


        <section className="panel map-main-panel">
          <div className="panel-header">
            <h3>
              Warehouse Topology
            </h3>

            <span>
              {mapData.nodes.length}
              {" nodes • "}

              {mapData.edges.length}
              {" paths • "}

              {mapData.racks.length}
              {" racks • "}

              {mapData.stations.length}
              {" stations"}
            </span>
          </div>


          {tool ===
            "connect" && (
            <EditorMessage>
              {connectionStart
                ? `Start: ${connectionStart}. Select destination node.`
                : "Select the first node to create a path."}
            </EditorMessage>
          )}


          {tool ===
            "node" && (
            <EditorMessage>
              Click on the map to
              create a node.
            </EditorMessage>
          )}


          {tool ===
            "rack" && (
            <EditorMessage>
              Click on the map to
              place a rack.
            </EditorMessage>
          )}


          {tool ===
            "dock" && (
            <EditorMessage>
              Click on the map to
              place a dock.
            </EditorMessage>
          )}


          {tool ===
            "charging" && (
            <EditorMessage>
              Click on the map to
              place a charging station.
            </EditorMessage>
          )}


          <MapCanvas
            mapData={
              mapData
            }

            tool={
              tool
            }

            zoom={
              zoom
            }

            onZoomChange={
              setZoom
            }

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

            onNodeDragStart={
              handleNodeDragStart
            }

            onNodeDragEnd={
              handleNodeDragEnd
            }

            onObjectClick={
              handleObjectClick
            }

            onObjectMove={
              handleObjectMove
            }

            onObjectDragStart={
              handleObjectDragStart
            }

            onObjectDragEnd={
              handleObjectDragEnd
            }
          />
        </section>


        {!expanded && (
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
        )}
      </div>
    </div>
  );
}


/*
 * ================================
 * MESSAGE
 * ================================
 */

function EditorMessage({
  children,
}) {
  return (
    <div className="map-editor-message">
      <Info size={15} />

      <span>
        {children}
      </span>
    </div>
  );
}


/*
 * ================================
 * HELPERS
 * ================================
 */

function calculateDistance(
  a,
  b
) {
  const dx =
    b.x - a.x;

  const dy =
    b.y - a.y;

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
      ) *
      spacing,

    y:
      Math.round(
        y / spacing
      ) *
      spacing,
  };
}


function clamp(
  value,
  min,
  max
) {
  const number =
    Number(value);

  if (
    !Number.isFinite(
      number
    )
  ) {
    return min;
  }

  return Math.min(
    Math.max(
      number,
      min
    ),
    max
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
    return (
      Number(value) || 0
    );
  }

  return value;
}


function getNextId(
  items,
  prefix,
  padding
) {
  let highest = 0;

  for (
    const item of items
  ) {
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
      .replace(
        /\s+/g,
        "_"
      ) ||
    "warehouse-map"
  );
}