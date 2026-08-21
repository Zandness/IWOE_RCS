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
  "wms-warehouse-map";


export default function WarehouseMap() {
  /*
   * =========================================
   * MAP
   * =========================================
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
   * =========================================
   * MODE
   * =========================================
   */

  const [
    mode,
    setMode,
  ] = useState(
    "edit"
  );


  /*
   * =========================================
   * EDIT TOOL
   * =========================================
   */

  const [
    tool,
    setTool,
  ] = useState(
    "select"
  );


  /*
   * =========================================
   * EDIT SELECTION
   * =========================================
   */

  const [
    selectedNodeId,
    setSelectedNodeId,
  ] = useState(
    null
  );

  const [
    selectedObject,
    setSelectedObject,
  ] = useState(
    null
  );

  const [
    connectionStart,
    setConnectionStart,
  ] = useState(
    null
  );


  /*
   * =========================================
   * MONITOR SELECTION
   * =========================================
   */

  const [
    selectedRobotId,
    setSelectedRobotId,
  ] = useState(
    null
  );


  /*
   * =========================================
   * VIEW
   * =========================================
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
   * =========================================
   * SAVE
   * =========================================
   */

  const [
    saveStatus,
    setSaveStatus,
  ] = useState(
    ""
  );


  /*
   * =========================================
   * HISTORY
   * =========================================
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

  const nodeDragSnapshot =
    useRef(
      null
    );

  const objectDragSnapshot =
    useRef(
      null
    );


  /*
   * =========================================
   * SELECTED DATA
   * =========================================
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


  const selectedRobot =
    MOCK_ROBOTS.find(
      (robot) =>
        robot.id ===
        selectedRobotId
    ) || null;


  /*
   * =========================================
   * COMMIT MAP
   * =========================================
   */

  function commitMap(
    updater
  ) {
    setMapData(
      (current) => {
        const currentSnapshot =
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
            currentSnapshot,
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
   * =========================================
   * MODE CHANGE
   * =========================================
   */

  function handleModeChange(
    nextMode
  ) {
    setMode(
      nextMode
    );

    setConnectionStart(
      null
    );

    if (
      nextMode ===
      "monitor"
    ) {
      setTool(
        "select"
      );

      setSelectedNodeId(
        null
      );

      setSelectedObject(
        null
      );

      if (
        !selectedRobotId &&
        MOCK_ROBOTS.length > 0
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


  /*
   * =========================================
   * UNDO
   * =========================================
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

    clearEditSelection();

    setSaveStatus(
      "Unsaved changes"
    );
  }


  /*
   * =========================================
   * REDO
   * =========================================
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

    clearEditSelection();

    setSaveStatus(
      "Unsaved changes"
    );
  }


  /*
   * =========================================
   * SAVE
   * =========================================
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
   * =========================================
   * ZOOM
   * =========================================
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
   * =========================================
   * CANVAS CLICK
   * =========================================
   */

  function handleCanvasClick(
    position
  ) {
    if (
      mode === "monitor"
    ) {
      setSelectedRobotId(
        null
      );

      return;
    }

    if (
      tool === "node"
    ) {
      addNode(
        position
      );
      return;
    }

    if (
      tool === "rack"
    ) {
      addRack(
        position
      );
      return;
    }

    if (
      tool === "dock"
    ) {
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

    if (
      tool === "select"
    ) {
      clearEditSelection();
    }
  }


  /*
   * =========================================
   * ADD NODE
   * =========================================
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

    const newNode = {
      id,

      name:
        `Point-${number}`,

      type:
        "NORMAL",

      x:
        position.x,

      y:
        position.y,
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

    setSelectedNodeId(
      id
    );

    setSelectedObject(
      null
    );

    setTool(
      "select"
    );
  }


  /*
   * =========================================
   * ADD RACK
   * =========================================
   */

  function addRack({
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
        mapData.racks,
        "RACK-",
        3
      );

    const rack = {
      id,

      name:
        `Rack ${
          mapData.racks.length +
          1
        }`,

      x:
        position.x,

      y:
        position.y,

      width:
        4,

      depth:
        1.5,

      rotation:
        0,

      levels:
        4,

      slotsPerLevel:
        6,
    };

    commitMap(
      (previous) => ({
        ...previous,

        racks: [
          ...previous.racks,
          rack,
        ],
      })
    );

    setSelectedNodeId(
      null
    );

    setSelectedObject({
      type:
        "rack",

      id,
    });

    setTool(
      "select"
    );
  }


  /*
   * =========================================
   * ADD STATION
   * =========================================
   */

  function addStation(
    position,
    type
  ) {
    const snapped =
      snapPosition(
        position.x,
        position.y,
        mapData.gridSpacing
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

      x:
        snapped.x,

      y:
        snapped.y,

      width:
        type === "DOCK"
          ? 3
          : 2,

      depth:
        2,

      rotation:
        0,
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

    setSelectedNodeId(
      null
    );

    setSelectedObject({
      type:
        "station",

      id,
    });

    setTool(
      "select"
    );
  }


  /*
   * =========================================
   * NODE CLICK
   * =========================================
   */

  function handleNodeClick(
    nodeId
  ) {
    if (
      mode === "monitor"
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

    setSelectedObject(
      null
    );

    setSelectedNodeId(
      nodeId
    );
  }


  /*
   * =========================================
   * OBJECT CLICK
   * =========================================
   */

  function handleObjectClick(
    object
  ) {
    if (
      mode === "monitor"
    ) {
      return;
    }

    setSelectedNodeId(
      null
    );

    setConnectionStart(
      null
    );

    setSelectedObject(
      object
    );

    setTool(
      "select"
    );
  }


  /*
   * =========================================
   * CONNECTION
   * =========================================
   */

  function createConnection(
    fromId,
    toId
  ) {
    const alreadyExists =
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
      alreadyExists
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


  /*
   * =========================================
   * NODE DRAG
   * =========================================
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
  }


  /*
   * =========================================
   * OBJECT DRAG
   * =========================================
   */

  function handleObjectDragStart() {
    objectDragSnapshot.current =
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
    if (
      mode !== "edit"
    ) {
      return;
    }

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
                  rack.id ===
                  objectId
                    ? {
                        ...rack,

                        x:
                          Number(x),

                        y:
                          Number(y),
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
                  station.id ===
                  objectId
                    ? {
                        ...station,

                        x:
                          Number(x),

                        y:
                          Number(y),
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
      !objectDragSnapshot.current
    ) {
      return;
    }

    setUndoStack(
      (history) => [
        ...history.slice(-49),

        objectDragSnapshot.current,
      ]
    );

    setRedoStack([]);

    objectDragSnapshot.current =
      null;
  }


  /*
   * =========================================
   * NODE PROPERTY
   * =========================================
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

              const nextValue =
                field === "x" ||
                field === "y"
                  ? Number(value)
                  : value;

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
   * =========================================
   * OBJECT PROPERTY
   * =========================================
   */

  function handleObjectChange(
    field,
    value
  ) {
    if (
      mode !== "edit" ||
      !selectedObject
    ) {
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
                          value
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
                          value
                        ),
                    }
                  : station
            ),
        })
      );
    }
  }


  /*
   * =========================================
   * MAP PROPERTY
   * =========================================
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
      field === "width" ||
      field === "height" ||
      field ===
        "gridSpacing"
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
   * =========================================
   * DELETE
   * =========================================
   */

  function handleDelete() {
    if (
      mode !== "edit"
    ) {
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

      clearEditSelection();

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

      clearEditSelection();

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

      clearEditSelection();
    }
  }


  /*
   * =========================================
   * EXPORT
   * =========================================
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
   * =========================================
   * RESET
   * =========================================
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

    clearEditSelection();

    setTool(
      "select"
    );

    setZoom(
      1
    );
  }


  /*
   * =========================================
   * SELECTION
   * =========================================
   */

  function clearEditSelection() {
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


  function handleTreeNodeSelect(
    nodeId
  ) {
    if (
      mode !== "edit"
    ) {
      return;
    }

    setSelectedObject(
      null
    );

    setSelectedNodeId(
      nodeId
    );

    setConnectionStart(
      null
    );

    setTool(
      "select"
    );
  }


  function handleTreeObjectSelect(
    object
  ) {
    if (
      mode !== "edit"
    ) {
      return;
    }

    setSelectedNodeId(
      null
    );

    setSelectedObject(
      object
    );

    setConnectionStart(
      null
    );

    setTool(
      "select"
    );
  }


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
   * =========================================
   * UI
   * =========================================
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
              ? "Design warehouse topology, racks, stations and robot travel paths."
              : "Monitor robot position, status, destination and planned path."}
          </p>

        </div>


        <div className="map-header-right">

          {mode ===
            "edit" &&
            saveStatus && (
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

        {/* LEFT */}

        {!expanded &&
          mode === "edit" && (
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

            onSelectNode={
              handleTreeNodeSelect
            }

            onSelectObject={
              handleTreeObjectSelect
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


        {/* CENTER */}

        <section className="panel map-main-panel">

          <div className="panel-header">

            <h3>
              {mode === "edit"
                ? "Warehouse Topology"
                : "Live Warehouse Map"}
            </h3>

            <span>
              {mode === "edit"
                ? `${mapData.nodes.length} nodes • ${mapData.edges.length} paths • ${mapData.racks.length} racks • ${mapData.stations.length} stations`
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
              Click anywhere on the grid to create a topology node.
            </EditorMessage>
          )}


          {mode === "edit" &&
            tool ===
              "rack" && (
            <EditorMessage>
              Click anywhere on the grid to place a rack.
            </EditorMessage>
          )}


          {mode === "edit" &&
            tool ===
              "dock" && (
            <EditorMessage>
              Click anywhere on the grid to place a dock.
            </EditorMessage>
          )}


          {mode === "edit" &&
            tool ===
              "charging" && (
            <EditorMessage>
              Click anywhere on the grid to place a charging station.
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

            selectedObject={
              selectedObject
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


        {/* RIGHT */}

        {!expanded &&
          mode === "edit" && (
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


function getSelectedMapObject(
  mapData,
  selection
) {
  if (
    !selection
  ) {
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
      ) ||
      null
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
      ) ||
      null
    );
  }

  return null;
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


function normalizeObjectValue(
  field,
  value
) {
  if (
    field === "x" ||
    field === "y"
  ) {
    const number =
      Number(value);

    return Number.isFinite(
      number
    )
      ? number
      : 0;
  }

  if (
    field === "width" ||
    field === "depth"
  ) {
    const number =
      Number(value);

    return Math.max(
      Number.isFinite(
        number
      )
        ? number
        : 0.1,

      0.1
    );
  }

  if (
    field === "levels" ||
    field ===
      "slotsPerLevel"
  ) {
    const number =
      Number(value);

    return Math.max(
      Math.round(
        Number.isFinite(
          number
        )
          ? number
          : 1
      ),
      1
    );
  }

  if (
    field ===
    "rotation"
  ) {
    const number =
      Number(value);

    return Number.isFinite(
      number
    )
      ? number
      : 0;
  }

  return value;
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