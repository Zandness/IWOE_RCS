import {
  useRef,
  useState,
} from "react";

import {
  Map,
  Info,
  CheckCircle2,
} from "lucide-react";

import MapToolbar from "../components/map/MapToolbar";
import MapCanvas from "../components/map/MapCanvas";
import MapProperties from "../components/map/MapProperties";
import MapObjectTree from "../components/map/MapObjectTree";
import MonitorPanel from "../components/map/MonitorPanel";

import {
  INITIAL_MAP,
} from "../data/mockWarehouseMap";

import {
  MOCK_ROBOTS,
} from "../data/mockRobots";

import "../map-editor.css";


const STORAGE_KEY =
  "wms-warehouse-map-v3";


export default function WarehouseMap() {
  /*
   * =====================================================
   * MAP DATA
   * =====================================================
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
        return normalizeMapData(
          JSON.parse(saved)
        );
      }
    } catch (error) {
      console.warn(
        "Could not load saved warehouse map.",
        error
      );
    }

    return normalizeMapData(
      structuredClone(
        INITIAL_MAP
      )
    );
  });


  /*
   * =====================================================
   * EDITOR STATE
   * =====================================================
   */

  const [
    mode,
    setMode,
  ] = useState("edit");


  const [
    tool,
    setTool,
  ] = useState("select");


  const [
    selectedNodeId,
    setSelectedNodeId,
  ] = useState(null);


  const [
    selectedEdgeId,
    setSelectedEdgeId,
  ] = useState(null);


  /*
   * V11
   * Warehouse Boundary selection
   */

  const [
    boundarySelected,
    setBoundarySelected,
  ] = useState(false);


  const [
    connectionStart,
    setConnectionStart,
  ] = useState(null);


  const [
    selectedRobotId,
    setSelectedRobotId,
  ] = useState(null);


  /*
   * =====================================================
   * VIEW
   * =====================================================
   */

  const [
    zoom,
    setZoom,
  ] = useState(1);


  const [
    fitRequest,
    setFitRequest,
  ] = useState(0);


  const [
    expanded,
    setExpanded,
  ] = useState(false);


  /*
   * =====================================================
   * SAVE / HISTORY
   * =====================================================
   */

  const [
    saveStatus,
    setSaveStatus,
  ] = useState("");


  const [
    undoStack,
    setUndoStack,
  ] = useState([]);


  const [
    redoStack,
    setRedoStack,
  ] = useState([]);


  const nodeDragSnapshot =
    useRef(null);


  const boundaryDragSnapshot =
    useRef(null);


  /*
   * =====================================================
   * SELECTED DATA
   * =====================================================
   */

  const selectedNode =
    mapData.nodes.find(
      (node) =>
        node.id ===
        selectedNodeId
    ) || null;


  const selectedEdge =
    mapData.edges.find(
      (edge) =>
        edge.id ===
        selectedEdgeId
    ) || null;


  const selectedRobot =
    MOCK_ROBOTS.find(
      (robot) =>
        robot.id ===
        selectedRobotId
    ) || null;


  /*
   * =====================================================
   * COMMIT
   * =====================================================
   */

  function commitMap(
    updater
  ) {
    setMapData(
      (current) => {
        const snapshot =
          structuredClone(
            current
          );

        const working =
          structuredClone(
            current
          );

        const next =
          typeof updater ===
          "function"
            ? updater(working)
            : structuredClone(
                updater
              );

        if (!next) {
          return current;
        }

        setUndoStack(
          (history) => [
            ...history.slice(-49),
            snapshot,
          ]
        );

        setRedoStack([]);

        setSaveStatus(
          "Unsaved changes"
        );

        return next;
      }
    );
  }


  /*
   * =====================================================
   * CLEAR SELECTION
   * =====================================================
   */

  function clearSelection() {
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setBoundarySelected(false);
    setConnectionStart(null);
  }


  /*
   * =====================================================
   * MODE
   * =====================================================
   */

  function handleModeChange(
    nextMode
  ) {
    setMode(nextMode);

    setTool("select");

    clearSelection();

    if (
      nextMode === "monitor"
    ) {
      if (
        !selectedRobotId &&
        MOCK_ROBOTS.length > 0
      ) {
        setSelectedRobotId(
          MOCK_ROBOTS[0].id
        );
      }
    } else {
      setSelectedRobotId(null);
    }
  }


  function handleToolChange(
    nextTool
  ) {
    if (
      mode !== "edit"
    ) {
      return;
    }

    setTool(nextTool);

    setConnectionStart(null);
  }


  /*
   * =====================================================
   * UNDO / REDO
   * =====================================================
   */

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

    clearSelection();

    setSaveStatus(
      "Unsaved changes"
    );
  }


  /*
   * =====================================================
   * SAVE
   * =====================================================
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
        error
      );

      setSaveStatus(
        "Save failed"
      );
    }
  }


  /*
   * =====================================================
   * VIEW
   * =====================================================
   */

  function zoomIn() {
    setZoom(
      (current) =>
        Number(
          Math.min(
            current * 1.1,
            4
          ).toFixed(3)
        )
    );
  }


  function zoomOut() {
    setZoom(
      (current) =>
        Number(
          Math.max(
            current * 0.9,
            0.25
          ).toFixed(3)
        )
    );
  }


  function fitMap() {
    setFitRequest(
      (current) =>
        current + 1
    );
  }


  /*
   * =====================================================
   * CANVAS CLICK
   * =====================================================
   */

  function handleCanvasClick(
    position
  ) {
    if (
      mode === "monitor"
    ) {
      setSelectedRobotId(null);
      return;
    }

    if (
      tool === "node"
    ) {
      addNode(position);
      return;
    }

    if (
      tool === "select"
    ) {
      clearSelection();
    }
  }


  /*
   * =====================================================
   * ADD NODE
   * =====================================================
   */

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

    const node = {
      id,

      name:
        `Point-${id.replace(
          "P",
          ""
        )}`,

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

    setSelectedNodeId(id);
    setSelectedEdgeId(null);
    setBoundarySelected(false);
    setTool("select");
  }


  /*
   * =====================================================
   * NODE SELECT
   * =====================================================
   */

  function handleNodeClick(
    nodeId
  ) {
    if (
      mode !== "edit"
    ) {
      return;
    }


    if (
      tool === "connect"
    ) {
      if (
        !connectionStart
      ) {
        setConnectionStart(
          nodeId
        );

        setSelectedNodeId(
          nodeId
        );

        setSelectedEdgeId(null);
        setBoundarySelected(false);

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


    if (
      tool === "select"
    ) {
      setSelectedNodeId(
        nodeId
      );

      setSelectedEdgeId(null);
      setBoundarySelected(false);
      setConnectionStart(null);
    }
  }


  /*
   * =====================================================
   * EDGE SELECT
   * =====================================================
   */

  function handleEdgeClick(
    edgeId
  ) {
    if (
      mode !== "edit" ||
      tool !== "select"
    ) {
      return;
    }

    setSelectedEdgeId(
      edgeId
    );

    setSelectedNodeId(null);
    setBoundarySelected(false);
    setConnectionStart(null);
  }


  /*
   * =====================================================
   * V11 - BOUNDARY SELECT
   * =====================================================
   */

  function handleBoundaryClick() {
    if (
      mode !== "edit" ||
      tool !== "select"
    ) {
      return;
    }

    setBoundarySelected(true);
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setConnectionStart(null);
  }


  /*
   * =====================================================
   * PATH CREATION
   * =====================================================
   */

  function createConnection(
    fromId,
    toId
  ) {
    if (
      fromId === toId
    ) {
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

    const duplicate =
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

    if (
      duplicate
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

      pathType:
        "NORMAL",

      vehicleAccess:
        "BOTH",
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


    setSelectedNodeId(null);

    setSelectedEdgeId(
      edge.id
    );

    setBoundarySelected(false);
  }


  /*
   * =====================================================
   * NODE DRAG
   * =====================================================
   */

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
      mode !== "edit"
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
                      Number(x),
                    y:
                      Number(y),
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

    setRedoStack([]);

    nodeDragSnapshot.current =
      null;

    setSaveStatus(
      "Unsaved changes"
    );
  }


  /*
   * =====================================================
   * V11 - BOUNDARY DRAG HISTORY
   * =====================================================
   */

  function handleBoundaryDragStart() {
    boundaryDragSnapshot.current =
      structuredClone(
        mapData
      );
  }


  function handleBoundaryLiveChange(
    patch
  ) {
    setMapData(
      (previous) => ({
        ...previous,
        ...patch,
      })
    );

    setSaveStatus(
      "Unsaved changes"
    );
  }


  function handleBoundaryDragEnd() {
    if (
      !boundaryDragSnapshot.current
    ) {
      return;
    }

    setUndoStack(
      (history) => [
        ...history.slice(-49),
        boundaryDragSnapshot.current,
      ]
    );

    setRedoStack([]);

    boundaryDragSnapshot.current =
      null;

    setSaveStatus(
      "Unsaved changes"
    );
  }


  /*
   * =====================================================
   * NODE PROPERTY
   * =====================================================
   */

  function handleNodeChange(
    field,
    value
  ) {
    if (
      mode !== "edit" ||
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
                const key =
                  field.replace(
                    "config.",
                    ""
                  );

                return {
                  ...node,

                  config: {
                    ...(node.config ||
                      {}),

                    [key]:
                      value,
                  },
                };
              }


              if (
                field === "type"
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


              if (
                [
                  "x",
                  "y",
                  "rotation",
                ].includes(
                  field
                )
              ) {
                return {
                  ...node,

                  [field]:
                    Number(value),
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


  /*
   * =====================================================
   * EDGE PROPERTY
   * =====================================================
   */

  function handleEdgeChange(
    field,
    value
  ) {
    if (
      mode !== "edit" ||
      !selectedEdgeId
    ) {
      return;
    }


    commitMap(
      (previous) => {
        const currentEdge =
          previous.edges.find(
            (edge) =>
              edge.id ===
              selectedEdgeId
          );


        if (
          !currentEdge
        ) {
          return previous;
        }


        if (
          field === "from" ||
          field === "to"
        ) {
          const nextFrom =
            field === "from"
              ? value
              : currentEdge.from;

          const nextTo =
            field === "to"
              ? value
              : currentEdge.to;


          if (
            nextFrom ===
            nextTo
          ) {
            return previous;
          }


          const fromNode =
            previous.nodes.find(
              (node) =>
                node.id ===
                nextFrom
            );


          const toNode =
            previous.nodes.find(
              (node) =>
                node.id ===
                nextTo
            );


          if (
            !fromNode ||
            !toNode
          ) {
            return previous;
          }


          const duplicate =
            previous.edges.some(
              (edge) => {
                if (
                  edge.id ===
                  selectedEdgeId
                ) {
                  return false;
                }

                return (
                  (
                    edge.from ===
                      nextFrom &&
                    edge.to ===
                      nextTo
                  ) ||
                  (
                    edge.from ===
                      nextTo &&
                    edge.to ===
                      nextFrom
                  )
                );
              }
            );


          if (
            duplicate
          ) {
            return previous;
          }


          return {
            ...previous,

            edges:
              previous.edges.map(
                (edge) => {
                  if (
                    edge.id !==
                    selectedEdgeId
                  ) {
                    return edge;
                  }

                  const nextEdge = {
                    ...edge,

                    from:
                      nextFrom,

                    to:
                      nextTo,
                  };


                  if (
                    edge.autoDistance
                  ) {
                    nextEdge.distance =
                      calculateDistance(
                        fromNode,
                        toNode
                      );
                  }


                  return nextEdge;
                }
              ),
          };
        }


        return {
          ...previous,

          edges:
            previous.edges.map(
              (edge) => {
                if (
                  edge.id !==
                  selectedEdgeId
                ) {
                  return edge;
                }


                const nextEdge = {
                  ...edge,

                  [field]:
                    value,
                };


                if (
                  field ===
                    "autoDistance" &&
                  value === true
                ) {
                  const from =
                    previous.nodes.find(
                      (node) =>
                        node.id ===
                        edge.from
                    );

                  const to =
                    previous.nodes.find(
                      (node) =>
                        node.id ===
                        edge.to
                    );


                  if (
                    from &&
                    to
                  ) {
                    nextEdge.distance =
                      calculateDistance(
                        from,
                        to
                      );
                  }
                }


                if (
                  field === "distance"
                ) {
                  nextEdge.distance =
                    Math.max(
                      Number(value) ||
                        0,
                      0
                    );
                }


                if (
                  field === "speedLimit"
                ) {
                  nextEdge.speedLimit =
                    Math.max(
                      Number(value) ||
                        0,
                      0
                    );
                }


                return nextEdge;
              }
            ),
        };
      }
    );
  }


  /*
   * =====================================================
   * MAP / BOUNDARY PROPERTY
   * =====================================================
   */

  function handleMapChange(
    field,
    value
  ) {
    if (
      mode !== "edit"
    ) {
      return;
    }


    if (
      [
        "width",
        "height",
        "gridSpacing",
      ].includes(
        field
      )
    ) {
      const number =
        Number(value);

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


    if (
      [
        "originX",
        "originY",
      ].includes(
        field
      )
    ) {
      const number =
        Number(value);

      if (
        !Number.isFinite(
          number
        )
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


  /*
   * =====================================================
   * DELETE
   * =====================================================
   */

  function handleDelete() {
    if (
      mode !== "edit"
    ) {
      return;
    }


    if (
      selectedEdgeId
    ) {
      commitMap(
        (previous) => ({
          ...previous,

          edges:
            previous.edges.filter(
              (edge) =>
                edge.id !==
                selectedEdgeId
            ),
        })
      );

      setSelectedEdgeId(null);

      return;
    }


    if (
      selectedNodeId
    ) {
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

      setSelectedNodeId(null);
      setConnectionStart(null);
    }
  }


  /*
   * =====================================================
   * EXPORT
   * =====================================================
   */

  function handleExport() {
    const blob =
      new Blob(
        [
          JSON.stringify(
            mapData,
            null,
            2
          ),
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


  /*
   * =====================================================
   * RESET
   * =====================================================
   */

  function handleReset() {
    if (
      mode !== "edit"
    ) {
      return;
    }

    commitMap(
      normalizeMapData(
        structuredClone(
          INITIAL_MAP
        )
      )
    );

    clearSelection();

    setTool("select");

    setTimeout(
      () => {
        setFitRequest(
          (current) =>
            current + 1
        );
      },
      0
    );
  }


  /*
   * =====================================================
   * TREE SELECT
   * =====================================================
   */

  function handleTreeNodeSelect(
    nodeId
  ) {
    setSelectedNodeId(nodeId);
    setSelectedEdgeId(null);
    setBoundarySelected(false);
    setConnectionStart(null);
    setTool("select");
  }


  function handleTreeEdgeSelect(
    edgeId
  ) {
    setSelectedEdgeId(edgeId);
    setSelectedNodeId(null);
    setBoundarySelected(false);
    setConnectionStart(null);
    setTool("select");
  }


  /*
   * =====================================================
   * UI
   * =====================================================
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
            {mode === "edit"
              ? "Map Editor"
              : "Warehouse Monitor"}
          </h2>

          <p>
            {mode === "edit"
              ? "Create warehouse topology, define warehouse area and configure robot travel paths."
              : "Monitor robot position, status and planned route."}
          </p>
        </div>


        <div className="map-header-right">
          {mode === "edit" &&
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
                      size={14}
                    />
                  )}

                <span>
                  {saveStatus}
                </span>
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
        mode={mode}
        setMode={handleModeChange}

        tool={tool}
        setTool={handleToolChange}

        onDelete={handleDelete}
        onSave={handleSave}
        onExport={handleExport}
        onReset={handleReset}

        onUndo={handleUndo}
        onRedo={handleRedo}

        canUndo={
          undoStack.length > 0
        }

        canRedo={
          redoStack.length > 0
        }

        zoom={zoom}

        onZoomIn={zoomIn}
        onZoomOut={zoomOut}

        onFit={fitMap}

        expanded={expanded}

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
          mode === "edit" && (
            <MapObjectTree
              mapData={
                mapData
              }

              selectedNodeId={
                selectedNodeId
              }

              selectedEdgeId={
                selectedEdgeId
              }

              onSelectNode={
                handleTreeNodeSelect
              }

              onSelectEdge={
                handleTreeEdgeSelect
              }
            />
          )}


        {!expanded &&
          mode === "monitor" && (
            <aside className="panel monitor-fleet-list">
              <div className="panel-header">
                <h3>
                  Robot Fleet
                </h3>

                <span>
                  {MOCK_ROBOTS.length}
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
                        {robot.id}
                      </strong>

                      <span>
                        {robot.task}
                      </span>
                    </div>

                    <span
                      className={`monitor-status ${robot.status.toLowerCase()}`}
                    >
                      {robot.status}
                    </span>
                  </button>
                )
              )}
            </aside>
          )}


        <section className="panel map-main-panel">
          <div className="panel-header">
            <h3>
              {mode === "edit"
                ? "Warehouse Topology"
                : "Live Warehouse Map"}
            </h3>

            <span>
              {mode === "edit"
                ? `${mapData.nodes.length} nodes • ${mapData.edges.length} paths`
                : `${MOCK_ROBOTS.length} robots`}
            </span>
          </div>


          {mode === "edit" &&
            tool ===
              "connect" && (
              <EditorMessage>
                {connectionStart
                  ? `Start node: ${connectionStart}. Select destination node.`
                  : "Select the first node to create a path."}
              </EditorMessage>
            )}


          {mode === "edit" &&
            tool ===
              "node" && (
              <EditorMessage>
                Click anywhere on the infinite grid to create a Node.
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

            selectedEdgeId={
              selectedEdgeId
            }

            boundarySelected={
              boundarySelected
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

            fitRequest={
              fitRequest
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

            onEdgeClick={
              handleEdgeClick
            }

            onBoundaryClick={
              handleBoundaryClick
            }

            onBoundaryDragStart={
              handleBoundaryDragStart
            }

            onBoundaryChange={
              handleBoundaryLiveChange
            }

            onBoundaryDragEnd={
              handleBoundaryDragEnd
            }
          />
        </section>


        {!expanded &&
          mode === "edit" && (
            <aside className="panel map-properties">
              <MapProperties
                mapData={
                  mapData
                }

                selectedNode={
                  selectedNode
                }

                selectedEdge={
                  selectedEdge
                }

                boundarySelected={
                  boundarySelected
                }

                onMapChange={
                  handleMapChange
                }

                onNodeChange={
                  handleNodeChange
                }

                onEdgeChange={
                  handleEdgeChange
                }

                onSelectBoundary={
                  handleBoundaryClick
                }
              />
            </aside>
          )}


        {!expanded &&
          mode === "monitor" && (
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
      <Info size={15} />

      <span>
        {children}
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
    ).toFixed(3)
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
    Number(spacing);

  if (
    !Number.isFinite(
      step
    ) ||
    step <= 0
  ) {
    return {
      x:
        Number(x),
      y:
        Number(y),
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
        ).toFixed(3)
      ),

    y:
      Number(
        (
          Math.round(
            Number(y) /
              step
          ) *
          step
        ).toFixed(3)
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
  let highest = 0;

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

    const number =
      Number(
        item.id.slice(
          prefix.length
        )
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
      ) ||
    "warehouse-map"
  );
}


function normalizeMapData(
  data
) {
  return {
    ...data,

    originX:
      Number.isFinite(
        Number(
          data.originX
        )
      )
        ? Number(
            data.originX
          )
        : 0,

    originY:
      Number.isFinite(
        Number(
          data.originY
        )
      )
        ? Number(
            data.originY
          )
        : 0,

    width:
      Number(
        data.width
      ) || 30,

    height:
      Number(
        data.height
      ) || 20,

    gridSpacing:
      Number(
        data.gridSpacing
      ) || 1,

    showBoundary:
      data.showBoundary !==
      false,

    snapBoundaryToGrid:
      data.snapBoundaryToGrid !==
      false,

    nodes:
      Array.isArray(
        data.nodes
      )
        ? data.nodes
        : [],

    edges:
      Array.isArray(
        data.edges
      )
        ? data.edges
        : [],
  };
}