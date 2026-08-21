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

import MapObjectTree
  from "../components/map/MapObjectTree";

import MonitorPanel
  from "../components/map/MonitorPanel";

import {
  INITIAL_MAP,
} from "../data/mockWarehouseMap";

import {
  MOCK_ROBOTS,
} from "../data/mockRobots";

import "../map-editor.css";


const STORAGE_KEY =
  "wms-warehouse-map-v2";


export default function WarehouseMap() {
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
        "Could not load map.",
        error
      );
    }


    return structuredClone(
      INITIAL_MAP
    );
  });


  const [
    mode,
    setMode,
  ] = useState(
    "edit"
  );


  const [
    tool,
    setTool,
  ] = useState(
    "select"
  );


  const [
    selectedNodeId,
    setSelectedNodeId,
  ] = useState(
    null
  );


  const [
    connectionStart,
    setConnectionStart,
  ] = useState(
    null
  );


  const [
    selectedRobotId,
    setSelectedRobotId,
  ] = useState(
    null
  );


  const [
    zoom,
    setZoom,
  ] = useState(
    1
  );


  const [
    expanded,
    setExpanded,
  ] = useState(
    false
  );


  const [
    saveStatus,
    setSaveStatus,
  ] = useState(
    ""
  );


  const [
    undoStack,
    setUndoStack,
  ] = useState(
    []
  );


  const [
    redoStack,
    setRedoStack,
  ] = useState(
    []
  );


  const nodeDragSnapshot =
    useRef(
      null
    );


  const selectedNode =
    mapData.nodes.find(
      (node) =>
        node.id ===
        selectedNodeId
    ) || null;


  const selectedRobot =
    MOCK_ROBOTS.find(
      (robot) =>
        robot.id ===
        selectedRobotId
    ) || null;


  function commitMap(
    updater
  ) {
    setMapData(
      (current) => {
        const snapshot =
          structuredClone(
            current
          );


        const next =
          typeof updater ===
          "function"
            ? updater(
                structuredClone(
                  current
                )
              )
            : structuredClone(
                updater
              );


        setUndoStack(
          (history) => [
            ...history.slice(-49),
            snapshot,
          ]
        );


        setRedoStack(
          []
        );


        setSaveStatus(
          "Unsaved changes"
        );


        return next;
      }
    );
  }


  function handleModeChange(
    nextMode
  ) {
    setMode(
      nextMode
    );


    setConnectionStart(
      null
    );


    setTool(
      "select"
    );


    if (
      nextMode ===
      "monitor"
    ) {
      setSelectedNodeId(
        null
      );


      if (
        !selectedRobotId &&
        MOCK_ROBOTS.length >
          0
      ) {
        setSelectedRobotId(
          MOCK_ROBOTS[0].id
        );
      }
    }


    if (
      nextMode ===
      "edit"
    ) {
      setSelectedRobotId(
        null
      );
    }
  }


  function handleUndo() {
    if (
      undoStack.length ===
      0
    ) {
      return;
    }


    const previous =
      undoStack[
        undoStack.length -
          1
      ];


    setRedoStack(
      (history) => [
        ...history,

        structuredClone(
          mapData
        ),
      ]
    );


    setUndoStack(
      (history) =>
        history.slice(
          0,
          -1
        )
    );


    setMapData(
      structuredClone(
        previous
      )
    );


    setSelectedNodeId(
      null
    );


    setConnectionStart(
      null
    );


    setSaveStatus(
      "Unsaved changes"
    );
  }


  function handleRedo() {
    if (
      redoStack.length ===
      0
    ) {
      return;
    }


    const next =
      redoStack[
        redoStack.length -
          1
      ];


    setUndoStack(
      (history) => [
        ...history,

        structuredClone(
          mapData
        ),
      ]
    );


    setRedoStack(
      (history) =>
        history.slice(
          0,
          -1
        )
    );


    setMapData(
      structuredClone(
        next
      )
    );


    setSelectedNodeId(
      null
    );


    setConnectionStart(
      null
    );


    setSaveStatus(
      "Unsaved changes"
    );
  }


  function handleSave() {
    try {
      localStorage.setItem(
        STORAGE_KEY,

        JSON.stringify(
          mapData
        )
      );


      setSaveStatus(
        "Saved"
      );
    } catch (error) {
      console.error(
        error
      );


      setSaveStatus(
        "Save failed"
      );
    }
  }


  function zoomIn() {
    setZoom(
      (current) =>
        Number(
          Math.min(
            current *
              1.1,
            4
          ).toFixed(
            3
          )
        )
    );
  }


  function zoomOut() {
    setZoom(
      (current) =>
        Number(
          Math.max(
            current *
              0.9,
            0.25
          ).toFixed(
            3
          )
        )
    );
  }


  function fitMap() {
    setZoom(
      1
    );
  }


  function handleCanvasClick(
    position
  ) {
    if (
      mode ===
      "monitor"
    ) {
      setSelectedRobotId(
        null
      );

      return;
    }


    if (
      tool ===
      "node"
    ) {
      addNode(
        position
      );

      return;
    }


    if (
      tool ===
      "select"
    ) {
      setSelectedNodeId(
        null
      );

      setConnectionStart(
        null
      );
    }
  }


  function addNode({
    x,
    y,
  }) {
    const position =
      snapPosition(
        x,
        y,
        mapData.gridSpacing
      );


    const id =
      getNextId(
        mapData.nodes,
        "P",
        3
      );


    const number =
      id.replace(
        "P",
        ""
      );


    const node = {
      id,

      name:
        `Point-${number}`,

      type:
        "WAYPOINT",

      x:
        position.x,

      y:
        position.y,

      rotation:
        0,

      enabled:
        true,

      config:
        {},
    };


    commitMap(
      (previous) => ({
        ...previous,

        nodes: [
          ...previous.nodes,
          node,
        ],
      })
    );


    setSelectedNodeId(
      id
    );


    setTool(
      "select"
    );
  }


  function handleNodeClick(
    nodeId
  ) {
    if (
      mode !==
      "edit"
    ) {
      return;
    }


    if (
      tool ===
      "connect"
    ) {
      if (
        !connectionStart
      ) {
        setConnectionStart(
          nodeId
        );

        return;
      }


      if (
        connectionStart ===
        nodeId
      ) {
        setConnectionStart(
          null
        );

        return;
      }


      createConnection(
        connectionStart,
        nodeId
      );


      setConnectionStart(
        null
      );

      return;
    }


    setSelectedNodeId(
      nodeId
    );
  }


  function createConnection(
    fromId,
    toId
  ) {
    const exists =
      mapData.edges.some(
        (edge) =>
          (
            edge.from ===
              fromId &&
            edge.to ===
              toId
          ) ||
          (
            edge.from ===
              toId &&
            edge.to ===
              fromId
          )
      );


    if (exists) {
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


    if (
      !from ||
      !to
    ) {
      return;
    }


    const edge = {
      id:
        getNextId(
          mapData.edges,
          "E",
          3
        ),

      from:
        fromId,

      to:
        toId,

      distance:
        calculateDistance(
          from,
          to
        ),

      autoDistance:
        true,

      bidirectional:
        true,

      enabled:
        true,

      speedLimit:
        1.2,
    };


    commitMap(
      (previous) => ({
        ...previous,

        edges: [
          ...previous.edges,
          edge,
        ],
      })
    );
  }


  function handleNodeDragStart() {
    nodeDragSnapshot.current =
      structuredClone(
        mapData
      );
  }


  function handleNodeMove(
    nodeId,
    x,
    y
  ) {
    if (
      mode !==
      "edit"
    ) {
      return;
    }


    setMapData(
      (previous) => {
        const nodes =
          previous.nodes.map(
            (node) =>
              node.id ===
              nodeId
                ? {
                    ...node,

                    x:
                      Number(
                        x
                      ),

                    y:
                      Number(
                        y
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
      !nodeDragSnapshot.current
    ) {
      return;
    }


    setUndoStack(
      (history) => [
        ...history.slice(-49),

        nodeDragSnapshot.current,
      ]
    );


    setRedoStack(
      []
    );


    nodeDragSnapshot.current =
      null;
  }


  function handleNodeChange(
    field,
    value
  ) {
    if (
      mode !==
        "edit" ||
      !selectedNodeId
    ) {
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


              if (
                field.startsWith(
                  "config."
                )
              ) {
                const configKey =
                  field.replace(
                    "config.",
                    ""
                  );


                return {
                  ...node,

                  config: {
                    ...(node.config ||
                      {}),

                    [configKey]:
                      value,
                  },
                };
              }


              if (
                field ===
                "type"
              ) {
                return {
                  ...node,

                  type:
                    value,

                  config:
                    getDefaultConfigForType(
                      value,
                      node.config
                    ),
                };
              }


              return {
                ...node,

                [field]:
                  value,
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


  function handleMapChange(
    field,
    value
  ) {
    if (
      mode !==
      "edit"
    ) {
      return;
    }


    if (
      field ===
        "width" ||
      field ===
        "height" ||
      field ===
        "gridSpacing"
    ) {
      const number =
        Number(
          value
        );


      if (
        !Number.isFinite(
          number
        ) ||
        number <= 0
      ) {
        return;
      }


      value =
        number;
    }


    commitMap(
      (previous) => ({
        ...previous,

        [field]:
          value,
      })
    );
  }


  function handleDelete() {
    if (
      mode !==
        "edit" ||
      !selectedNodeId
    ) {
      return;
    }


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


    setSelectedNodeId(
      null
    );


    setConnectionStart(
      null
    );
  }


  function handleExport() {
    const json =
      JSON.stringify(
        mapData,
        null,
        2
      );


    const blob =
      new Blob(
        [
          json,
        ],
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


    link.href =
      url;


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


  function handleReset() {
    if (
      mode !==
      "edit"
    ) {
      return;
    }


    commitMap(
      structuredClone(
        INITIAL_MAP
      )
    );


    setSelectedNodeId(
      null
    );


    setConnectionStart(
      null
    );


    setTool(
      "select"
    );


    setZoom(
      1
    );
  }


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
            {mode ===
            "edit"
              ? "Map Editor"
              : "Warehouse Monitor"}
          </h2>

          <p>
            {mode ===
            "edit"
              ? "Create node-based warehouse topology and travel paths."
              : "Monitor robot position, status and planned path."}
          </p>

        </div>


        <div className="map-header-right">

          {mode ===
            "edit" &&
            saveStatus && (

            <div
              className={
                saveStatus ===
                "Saved"
                  ? "map-save-status saved"
                  : "map-save-status"
              }
            >

              {saveStatus ===
                "Saved" && (

                <CheckCircle2
                  size={
                    14
                  }
                />

              )}

              <span>
                {
                  saveStatus
                }
              </span>

            </div>

          )}


          <div className="map-editor-info">

            <Map
              size={
                16
              }
            />

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
        mode={
          mode
        }

        setMode={
          handleModeChange
        }

        tool={
          tool
        }

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

        onSave={
          handleSave
        }

        onExport={
          handleExport
        }

        onReset={
          handleReset
        }

        onUndo={
          handleUndo
        }

        onRedo={
          handleRedo
        }

        canUndo={
          undoStack.length >
          0
        }

        canRedo={
          redoStack.length >
          0
        }

        zoom={
          zoom
        }

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

        {!expanded &&
          mode ===
            "edit" && (

          <MapObjectTree
            mapData={
              mapData
            }

            selectedNodeId={
              selectedNodeId
            }

            onSelectNode={(
              nodeId
            ) => {
              setSelectedNodeId(
                nodeId
              );

              setConnectionStart(
                null
              );

              setTool(
                "select"
              );
            }}
          />

        )}


        {!expanded &&
          mode ===
            "monitor" && (

          <aside className="panel monitor-fleet-list">

            <div className="panel-header">

              <h3>
                Robot Fleet
              </h3>

              <span>
                {
                  MOCK_ROBOTS.length
                }
              </span>

            </div>


            {MOCK_ROBOTS.map(
              (robot) => (

                <button
                  type="button"

                  key={
                    robot.id
                  }

                  className={`monitor-fleet-item ${
                    selectedRobotId ===
                    robot.id
                      ? "active"
                      : ""
                  }`}

                  onClick={() =>
                    setSelectedRobotId(
                      robot.id
                    )
                  }
                >

                  <div>

                    <strong>
                      {
                        robot.id
                      }
                    </strong>

                    <span>
                      {
                        robot.task
                      }
                    </span>

                  </div>


                  <span
                    className={`monitor-status ${robot.status.toLowerCase()}`}
                  >
                    {
                      robot.status
                    }
                  </span>

                </button>

              )
            )}

          </aside>

        )}


        <section className="panel map-main-panel">

          <div className="panel-header">

            <h3>
              {mode ===
              "edit"
                ? "Warehouse Topology"
                : "Live Warehouse Map"}
            </h3>

            <span>
              {mode ===
              "edit"
                ? `${mapData.nodes.length} nodes • ${mapData.edges.length} paths`
                : `${MOCK_ROBOTS.length} robots`}
            </span>

          </div>


          {mode ===
            "edit" &&
            tool ===
              "connect" && (

            <EditorMessage>
              {connectionStart
                ? `Start node: ${connectionStart}. Select destination node.`
                : "Select the first node to create a path."}
            </EditorMessage>

          )}


          {mode ===
            "edit" &&
            tool ===
              "node" && (

            <EditorMessage>
              Click anywhere on the infinite grid to create a node.
            </EditorMessage>

          )}


          <MapCanvas
            mapData={
              mapData
            }

            mode={
              mode
            }

            tool={
              tool
            }

            selectedNodeId={
              selectedNodeId
            }

            connectionStart={
              connectionStart
            }

            robots={
              MOCK_ROBOTS
            }

            selectedRobotId={
              selectedRobotId
            }

            onRobotClick={
              setSelectedRobotId
            }

            zoom={
              zoom
            }

            onZoomChange={
              setZoom
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
          />

        </section>


        {!expanded &&
          mode ===
            "edit" && (

          <aside className="panel map-properties">

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

          </aside>

        )}


        {!expanded &&
          mode ===
            "monitor" && (

          <MonitorPanel
            robot={
              selectedRobot
            }
          />

        )}

      </div>

    </div>
  );
}


function EditorMessage({
  children,
}) {
  return (
    <div className="map-editor-message">

      <Info
        size={
          15
        }
      />

      <span>
        {
          children
        }
      </span>

    </div>
  );
}


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
    ).toFixed(
      3
    )
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


      if (
        !from ||
        !to
      ) {
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


function snapPosition(
  x,
  y,
  spacing
) {
  const step =
    Number(
      spacing
    );


  if (
    !Number.isFinite(
      step
    ) ||
    step <= 0
  ) {
    return {
      x:
        Number(
          x
        ),

      y:
        Number(
          y
        ),
    };
  }


  return {
    x:
      Number(
        (
          Math.round(
            Number(x) /
            step
          ) *
          step
        ).toFixed(
          3
        )
      ),

    y:
      Number(
        (
          Math.round(
            Number(y) /
            step
          ) *
          step
        ).toFixed(
          3
        )
      ),
  };
}


function getDefaultConfigForType(
  type,
  existingConfig = {}
) {
  switch (type) {

    case "STORAGE":
      return {
        width:
          existingConfig.width ||
          4,

        depth:
          existingConfig.depth ||
          2,

        zone:
          existingConfig.zone ||
          "",

        levels:
          existingConfig.levels ||
          4,

        slotsPerLevel:
          existingConfig.slotsPerLevel ||
          6,
      };


    case "CHARGING":
      return {
        width:
          existingConfig.width ||
          2,

        depth:
          existingConfig.depth ||
          2,

        chargerId:
          existingConfig.chargerId ||
          "",
      };


    case "DOCK":
      return {
        width:
          existingConfig.width ||
          3,

        depth:
          existingConfig.depth ||
          2,
      };


    default:
      return {};
  }
}


function getNextId(
  items,
  prefix,
  padding
) {
  let highest =
    0;


  for (
    const item
    of items
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
      Number(
        suffix
      );


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
      )
    ||
    "warehouse-map"
  );
}