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
        return JSON.parse(
          saved
        );
      }
    } catch (error) {
      console.warn(
        "Could not load saved warehouse map.",
        error
      );
    }

    return structuredClone(
      INITIAL_MAP
    );
  });


  /*
   * =====================================================
   * MODE
   * =====================================================
   */

  const [
    mode,
    setMode,
  ] = useState(
    "edit"
  );


  /*
   * =====================================================
   * TOOL
   * =====================================================
   */

  const [
    tool,
    setTool,
  ] = useState(
    "select"
  );


  /*
   * =====================================================
   * NODE SELECTION
   * =====================================================
   */

  const [
    selectedNodeId,
    setSelectedNodeId,
  ] = useState(
    null
  );


  /*
   * =====================================================
   * EDGE SELECTION
   * =====================================================
   */

  const [
    selectedEdgeId,
    setSelectedEdgeId,
  ] = useState(
    null
  );


  /*
   * =====================================================
   * PATH CREATION
   * =====================================================
   */

  const [
    connectionStart,
    setConnectionStart,
  ] = useState(
    null
  );


  /*
   * =====================================================
   * MONITOR ROBOT
   * =====================================================
   */

  const [
    selectedRobotId,
    setSelectedRobotId,
  ] = useState(
    null
  );


  /*
   * =====================================================
   * VIEW
   * =====================================================
   */

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


  /*
   * =====================================================
   * SAVE STATUS
   * =====================================================
   */

  const [
    saveStatus,
    setSaveStatus,
  ] = useState(
    ""
  );


  /*
   * =====================================================
   * UNDO / REDO
   * =====================================================
   */

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


  /*
   * =====================================================
   * DRAG HISTORY SNAPSHOT
   * =====================================================
   */

  const nodeDragSnapshot =
    useRef(
      null
    );


  /*
   * =====================================================
   * SELECTED OBJECT DATA
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
   * COMMIT MAP
   *
   * ใช้ตอนแก้ข้อมูลที่ต้องเข้า Undo History
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

        const workingCopy =
          structuredClone(
            current
          );

        const next =
          typeof updater ===
          "function"
            ? updater(
                workingCopy
              )
            : structuredClone(
                updater
              );


        /*
         * ถ้า updater คืนค่าเดิม
         * เราก็ยัง return ได้
         */

        if (!next) {
          return current;
        }


        setUndoStack(
          (history) => [
            ...history.slice(
              -49
            ),

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


  /*
   * =====================================================
   * MODE CHANGE
   * =====================================================
   */

  function handleModeChange(
    nextMode
  ) {
    setMode(
      nextMode
    );


    setTool(
      "select"
    );


    setConnectionStart(
      null
    );


    setSelectedNodeId(
      null
    );


    setSelectedEdgeId(
      null
    );


    if (
      nextMode ===
      "monitor"
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
      setSelectedRobotId(
        null
      );
    }
  }


  /*
   * =====================================================
   * TOOL CHANGE
   * =====================================================
   */

  function handleToolChange(
    nextTool
  ) {
    if (
      mode !== "edit"
    ) {
      return;
    }


    setTool(
      nextTool
    );


    setConnectionStart(
      null
    );
  }


  /*
   * =====================================================
   * UNDO
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


  /*
   * =====================================================
   * REDO
   * =====================================================
   */

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


      setSaveStatus(
        "Saved"
      );
    } catch (error) {
      console.error(
        "Map save failed:",
        error
      );


      setSaveStatus(
        "Save failed"
      );
    }
  }


  /*
   * =====================================================
   * ZOOM
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
    setZoom(
      1
    );
  }


  /*
   * =====================================================
   * EMPTY MAP CLICK
   * =====================================================
   */

  function handleCanvasClick(
    position
  ) {
    /*
     * Monitor Mode
     */

    if (
      mode === "monitor"
    ) {
      setSelectedRobotId(
        null
      );

      return;
    }


    /*
     * NODE TOOL
     */

    if (
      tool === "node"
    ) {
      addNode(
        position
      );

      return;
    }


    /*
     * SELECT TOOL
     *
     * Click พื้นที่ว่าง
     * = กลับ Map Properties
     */

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


    setSelectedEdgeId(
      null
    );


    setConnectionStart(
      null
    );


    /*
     * สร้างเสร็จกลับ Select
     */

    setTool(
      "select"
    );
  }


  /*
   * =====================================================
   * NODE CLICK
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


    /*
     * =========================================
     * PATH CREATION MODE
     * =========================================
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


        setSelectedNodeId(
          nodeId
        );


        setSelectedEdgeId(
          null
        );


        return;
      }


      /*
       * Same Node clicked
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


    /*
     * =========================================
     * SELECT NODE
     * =========================================
     */

    if (
      tool === "select"
    ) {
      setSelectedNodeId(
        nodeId
      );


      setSelectedEdgeId(
        null
      );


      setConnectionStart(
        null
      );
    }
  }


  /*
   * =====================================================
   * EDGE CLICK
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


    setSelectedNodeId(
      null
    );


    setConnectionStart(
      null
    );
  }


  /*
   * =====================================================
   * CREATE CONNECTION
   * =====================================================
   */

  function createConnection(
    fromId,
    toId
  ) {
    /*
     * Same Node
     */

    if (
      fromId === toId
    ) {
      return;
    }


    /*
     * Nodes must exist
     */

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


    /*
     * Duplicate prevention
     */

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


    /*
     * เลือก Path ที่เพิ่งสร้าง
     */

    setSelectedNodeId(
      null
    );


    setSelectedEdgeId(
      edge.id
    );
  }


  /*
   * =====================================================
   * NODE DRAG START
   * =====================================================
   */

  function handleNodeDragStart() {
    nodeDragSnapshot.current =
      structuredClone(
        mapData
      );
  }


  /*
   * =====================================================
   * NODE MOVE
   * =====================================================
   */

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


  /*
   * =====================================================
   * NODE DRAG END
   * =====================================================
   */

  function handleNodeDragEnd() {
    if (
      !nodeDragSnapshot.current
    ) {
      return;
    }


    setUndoStack(
      (history) => [
        ...history.slice(
          -49
        ),

        nodeDragSnapshot.current,
      ]
    );


    setRedoStack(
      []
    );


    nodeDragSnapshot.current =
      null;


    setSaveStatus(
      "Unsaved changes"
    );
  }


  /*
   * =====================================================
   * NODE PROPERTY CHANGE
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


              /*
               * =========================================
               * CONFIG FIELD
               * =========================================
               */

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


              /*
               * =========================================
               * NODE TYPE
               * =========================================
               */

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


              /*
               * =========================================
               * POSITION
               * =========================================
               */

              if (
                field === "x" ||
                field === "y"
              ) {
                const number =
                  Number(value);


                if (
                  !Number.isFinite(
                    number
                  )
                ) {
                  return node;
                }


                return {
                  ...node,

                  [field]:
                    number,
                };
              }


              /*
               * =========================================
               * ROTATION
               * =========================================
               */

              if (
                field === "rotation"
              ) {
                return {
                  ...node,

                  rotation:
                    Number(value) ||
                    0,
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

          /*
           * ถ้า X/Y เปลี่ยน
           * auto distance จะเปลี่ยนด้วย
           */

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
   * EDGE PROPERTY CHANGE
   *
   * V9
   * รองรับ From / To endpoint editing
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


        /*
         * =================================================
         * FROM / TO NODE CHANGE
         * =================================================
         */

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


          /*
           * -----------------------------------------------
           * CHECK NODE EXISTS
           * -----------------------------------------------
           */

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


          /*
           * -----------------------------------------------
           * FROM CANNOT EQUAL TO
           * -----------------------------------------------
           */

          if (
            nextFrom ===
            nextTo
          ) {
            return previous;
          }


          /*
           * -----------------------------------------------
           * PREVENT DUPLICATE PATH
           *
           * Treat reverse direction as same physical path
           * -----------------------------------------------
           */

          const duplicate =
            previous.edges.some(
              (edge) => {
                /*
                 * Ignore current selected edge.
                 */

                if (
                  edge.id ===
                  selectedEdgeId
                ) {
                  return false;
                }


                const sameDirection =
                  edge.from ===
                    nextFrom &&
                  edge.to ===
                    nextTo;


                const oppositeDirection =
                  edge.from ===
                    nextTo &&
                  edge.to ===
                    nextFrom;


                return (
                  sameDirection ||
                  oppositeDirection
                );
              }
            );


          if (
            duplicate
          ) {
            return previous;
          }


          /*
           * -----------------------------------------------
           * UPDATE EDGE
           * -----------------------------------------------
           */

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


                  /*
                   * ---------------------------------------
                   * RECALCULATE DISTANCE
                   * ---------------------------------------
                   */

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


        /*
         * =================================================
         * NORMAL EDGE PROPERTY CHANGE
         * =================================================
         */

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


                /*
                 * -----------------------------------------
                 * AUTO DISTANCE ENABLED
                 * -----------------------------------------
                 */

                if (
                  field ===
                    "autoDistance" &&
                  value === true
                ) {
                  const fromNode =
                    previous.nodes.find(
                      (node) =>
                        node.id ===
                        edge.from
                    );


                  const toNode =
                    previous.nodes.find(
                      (node) =>
                        node.id ===
                        edge.to
                    );


                  if (
                    fromNode &&
                    toNode
                  ) {
                    nextEdge.distance =
                      calculateDistance(
                        fromNode,
                        toNode
                      );
                  }
                }


                /*
                 * -----------------------------------------
                 * MANUAL DISTANCE
                 * -----------------------------------------
                 */

                if (
                  field ===
                  "distance"
                ) {
                  const distance =
                    Number(value);


                  nextEdge.distance =
                    Number.isFinite(
                      distance
                    )
                      ? Math.max(
                          distance,
                          0
                        )
                      : 0;
                }


                /*
                 * -----------------------------------------
                 * SPEED LIMIT
                 * -----------------------------------------
                 */

                if (
                  field ===
                  "speedLimit"
                ) {
                  const speed =
                    Number(value);


                  nextEdge.speedLimit =
                    Number.isFinite(
                      speed
                    )
                      ? Math.max(
                          speed,
                          0
                        )
                      : 0;
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
   * MAP PROPERTY CHANGE
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


    /*
     * Numeric fields
     */

    if (
      field === "width" ||
      field === "height" ||
      field === "gridSpacing"
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


    /*
     * =========================================
     * DELETE EDGE
     * =========================================
     */

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


      setSelectedEdgeId(
        null
      );


      return;
    }


    /*
     * =========================================
     * DELETE NODE
     *
     * Also remove connected edges
     * =========================================
     */

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


      setSelectedNodeId(
        null
      );


      setConnectionStart(
        null
      );
    }
  }


  /*
   * =====================================================
   * EXPORT
   * =====================================================
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
      structuredClone(
        INITIAL_MAP
      )
    );


    clearSelection();


    setTool(
      "select"
    );


    setZoom(
      1
    );
  }


  /*
   * =====================================================
   * CLEAR SELECTION
   * =====================================================
   */

  function clearSelection() {
    setSelectedNodeId(
      null
    );


    setSelectedEdgeId(
      null
    );


    setConnectionStart(
      null
    );
  }


  /*
   * =====================================================
   * TREE NODE SELECT
   * =====================================================
   */

  function handleTreeNodeSelect(
    nodeId
  ) {
    setSelectedNodeId(
      nodeId
    );


    setSelectedEdgeId(
      null
    );


    setConnectionStart(
      null
    );


    setTool(
      "select"
    );
  }


  /*
   * =====================================================
   * TREE EDGE SELECT
   * =====================================================
   */

  function handleTreeEdgeSelect(
    edgeId
  ) {
    setSelectedEdgeId(
      edgeId
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

      {/* =================================================
          PAGE HEADER
      ================================================= */}

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
              ? "Create warehouse nodes and configure robot travel paths."
              : "Monitor robot position, status and planned route."}
          </p>
        </div>


        <div className="map-header-right">

          {/* SAVE STATUS */}

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


          {/* MAP SIZE */}

          <div className="map-editor-info">

            <Map
              size={16}
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


      {/* =================================================
          TOOLBAR
      ================================================= */}

      <MapToolbar
        mode={mode}

        setMode={
          handleModeChange
        }

        tool={tool}

        setTool={
          handleToolChange
        }

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


      {/* =================================================
          EDITOR LAYOUT
      ================================================= */}

      <div
        className={
          expanded
            ? "map-editor-layout-v4 expanded"
            : "map-editor-layout-v4"
        }
      >

        {/* =================================================
            LEFT SIDE
        ================================================= */}

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
          mode ===
            "monitor" && (
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


        {/* =================================================
            CENTER
        ================================================= */}

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


          {/* CONNECT MESSAGE */}

          {mode === "edit" &&
            tool ===
              "connect" && (
            <EditorMessage>
              {connectionStart
                ? `Start node: ${connectionStart}. Select destination node.`
                : "Select the first node to create a path."}
            </EditorMessage>
          )}


          {/* NODE MESSAGE */}

          {mode === "edit" &&
            tool ===
              "node" && (
            <EditorMessage>
              Click anywhere on the grid to create a Node.
            </EditorMessage>
          )}


          {/* MAP CANVAS */}

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

            onEdgeClick={
              handleEdgeClick
            }
          />

        </section>


        {/* =================================================
            RIGHT SIDE
        ================================================= */}

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

              onMapChange={
                handleMapChange
              }

              onNodeChange={
                handleNodeChange
              }

              onEdgeChange={
                handleEdgeChange
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


/*
 * =====================================================
 * EDITOR MESSAGE
 * =====================================================
 */

function EditorMessage({
  children,
}) {
  return (
    <div className="map-editor-message">

      <Info
        size={15}
      />

      <span>
        {children}
      </span>

    </div>
  );
}


/*
 * =====================================================
 * DISTANCE
 * =====================================================
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
    ).toFixed(3)
  );
}


/*
 * =====================================================
 * RECALCULATE EDGES
 * =====================================================
 */

function recalculateEdges(
  edges,
  nodes
) {
  return edges.map(
    (edge) => {
      /*
       * Manual distance
       * ไม่ต้องคำนวณใหม่
       */

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


/*
 * =====================================================
 * SNAP POSITION
 * =====================================================
 */

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
        Number(x),

      y:
        Number(y),
    };
  }


  return {
    x: Number(
      (
        Math.round(
          Number(x) /
          step
        ) *
        step
      ).toFixed(3)
    ),

    y: Number(
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


/*
 * =====================================================
 * DEFAULT NODE CONFIG
 * =====================================================
 */

function getDefaultConfigForType(
  type,
  existingConfig = {}
) {
  switch (type) {
    /*
     * STORAGE
     */

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


    /*
     * CHARGING
     */

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


    /*
     * DOCK
     */

    case "DOCK":
      return {
        width:
          existingConfig.width ||
          3,

        depth:
          existingConfig.depth ||
          2,
      };


    /*
     * OTHER NODE TYPES
     */

    default:
      return {};
  }
}


/*
 * =====================================================
 * NEXT ID
 * =====================================================
 */

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


/*
 * =====================================================
 * FILE NAME
 * =====================================================
 */

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