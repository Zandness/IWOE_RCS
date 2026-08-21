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


/*
 * =====================================================
 * LOCAL SAVE KEY
 * =====================================================
 */

const STORAGE_KEY =
  "wms-warehouse-map";


/*
 * =====================================================
 * WAREHOUSE MAP
 * =====================================================
 */

export default function WarehouseMap() {

  /*
   * ===================================================
   * INITIAL MAP DATA
   * ===================================================
   */

  const [
    mapData,
    setMapData,
  ] = useState(() => {

    try {

      const savedMap =
        localStorage.getItem(
          STORAGE_KEY
        );

      if (savedMap) {

        return JSON.parse(
          savedMap
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
   * ===================================================
   * EDITOR TOOL
   * ===================================================
   */

  const [
    tool,
    setTool,
  ] = useState(
    "select"
  );


  /*
   * ===================================================
   * SELECTION
   * ===================================================
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


  /*
   * Used while creating path
   */

  const [
    connectionStart,
    setConnectionStart,
  ] = useState(
    null
  );


  /*
   * ===================================================
   * VIEW
   * ===================================================
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
   * ===================================================
   * SAVE STATUS
   * ===================================================
   */

  const [
    saveStatus,
    setSaveStatus,
  ] = useState(
    ""
  );


  /*
   * ===================================================
   * UNDO / REDO
   * ===================================================
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
   * Dragging should only create
   * one Undo history entry.
   */

  const nodeDragSnapshot =
    useRef(
      null
    );


  const objectDragSnapshot =
    useRef(
      null
    );


  /*
   * ===================================================
   * SELECTED NODE
   * ===================================================
   */

  const selectedNode =
    mapData.nodes.find(
      (node) =>
        node.id ===
        selectedNodeId
    ) || null;


  /*
   * ===================================================
   * SELECTED RACK / STATION
   * ===================================================
   */

  const selectedMapObject =
    getSelectedMapObject(
      mapData,
      selectedObject
    );


  /*
   * ===================================================
   * HISTORY COMMIT
   * ===================================================
   *
   * Use this whenever map data is changed normally.
   *
   * It stores the previous state for Undo.
   * ===================================================
   */

  function commitMap(
    updater
  ) {

    setMapData(
      (currentMap) => {

        const previousSnapshot =
          structuredClone(
            currentMap
          );


        const nextMap =
          typeof updater ===
          "function"
            ? updater(
                structuredClone(
                  currentMap
                )
              )
            : structuredClone(
                updater
              );


        setUndoStack(
          (history) => [

            ...history.slice(
              -49
            ),

            previousSnapshot,

          ]
        );


        /*
         * Any new action clears Redo
         */

        setRedoStack(
          []
        );


        setSaveStatus(
          "Unsaved changes"
        );


        return nextMap;

      }
    );

  }


  /*
   * ===================================================
   * UNDO
   * ===================================================
   */

  function handleUndo() {

    if (
      undoStack.length ===
      0
    ) {

      return;

    }


    const previousMap =
      undoStack[
        undoStack.length -
        1
      ];


    /*
     * Current map becomes redo state.
     */

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
        previousMap
      )
    );


    clearSelection();


    setSaveStatus(
      "Unsaved changes"
    );

  }


  /*
   * ===================================================
   * REDO
   * ===================================================
   */

  function handleRedo() {

    if (
      redoStack.length ===
      0
    ) {

      return;

    }


    const nextMap =
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
        nextMap
      )
    );


    clearSelection();


    setSaveStatus(
      "Unsaved changes"
    );

  }


  /*
   * ===================================================
   * SAVE
   * ===================================================
   *
   * Currently saved in browser LocalStorage.
   *
   * Later this can be replaced by:
   *
   * React
   *   ↓
   * FastAPI
   *   ↓
   * Database
   * ===================================================
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
   * ===================================================
   * ZOOM BUTTONS
   * ===================================================
   */

  function zoomIn() {

    setZoom(
      (current) =>
        Number(
          Math.min(
            current * 1.1,
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
            current * 0.9,
            0.25
          ).toFixed(
            3
          )
        )
    );

  }


  /*
   * Current simple Fit behavior.
   *
   * Later we can calculate actual
   * object bounding box.
   */

  function fitMap() {

    setZoom(
      1
    );

  }


  /*
   * ===================================================
   * BACKGROUND CLICK
   * ===================================================
   */

  function handleCanvasClick(
    position
  ) {

    /*
     * CREATE NODE
     */

    if (
      tool ===
      "node"
    ) {

      addNode(
        position
      );

      return;

    }


    /*
     * CREATE RACK
     */

    if (
      tool ===
      "rack"
    ) {

      addRack(
        position
      );

      return;

    }


    /*
     * CREATE DOCK
     */

    if (
      tool ===
      "dock"
    ) {

      addStation(
        position,
        "DOCK"
      );

      return;

    }


    /*
     * CREATE CHARGING STATION
     */

    if (
      tool ===
      "charging"
    ) {

      addStation(
        position,
        "CHARGING"
      );

      return;

    }


    /*
     * SELECT mode:
     * clicking empty workspace
     * clears selection.
     */

    if (
      tool ===
      "select"
    ) {

      clearSelection();

    }

  }


  /*
   * ===================================================
   * CREATE NODE
   * ===================================================
   *
   * IMPORTANT:
   * No warehouse boundary clamp.
   *
   * X and Y can be:
   *
   * -10
   * 0
   * 50
   * 200
   *
   * because workspace is infinite.
   * ===================================================
   */

  function addNode({
    x,
    y,
  }) {

    const spacing =
      Number(
        mapData.gridSpacing
      ) || 1;


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
   * ===================================================
   * CREATE RACK
   * ===================================================
   */

  function addRack({
    x,
    y,
  }) {

    const spacing =
      Number(
        mapData.gridSpacing
      ) || 1;


    const position =
      snapPosition(
        x,
        y,
        spacing
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

          newRack,

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
   * ===================================================
   * CREATE STATION
   * ===================================================
   */

  function addStation(
    position,
    type
  ) {

    const spacing =
      Number(
        mapData.gridSpacing
      ) || 1;


    const snappedPosition =
      snapPosition(
        position.x,
        position.y,
        spacing
      );


    const prefix =
      type ===
      "DOCK"
        ? "DOCK-"
        : "CHARGE-";


    const sameTypeStations =
      mapData.stations.filter(
        (station) =>
          station.type ===
          type
      );


    const id =
      getNextId(
        sameTypeStations,
        prefix,
        2
      );


    const count =
      sameTypeStations.length +
      1;


    const newStation = {

      id,

      name:
        type ===
        "DOCK"
          ? `Dock ${count}`
          : `Charging Station ${count}`,

      type,

      x:
        snappedPosition.x,

      y:
        snappedPosition.y,

      width:
        type ===
        "DOCK"
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

          newStation,

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
   * ===================================================
   * NODE CLICK
   * ===================================================
   */

  function handleNodeClick(
    nodeId
  ) {

    /*
     * PATH TOOL
     */

    if (
      tool ===
      "connect"
    ) {

      /*
       * First node
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
       * Clicking same node cancels
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
       * Second node:
       * create edge.
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


    setSelectedObject(
      null
    );


    setSelectedNodeId(
      nodeId
    );

  }


  /*
   * ===================================================
   * OBJECT CLICK
   * ===================================================
   */

  function handleObjectClick(
    object
  ) {

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
   * ===================================================
   * CREATE PATH
   * ===================================================
   */

  function createConnection(
    fromId,
    toId
  ) {

    /*
     * Prevent duplicate connection.
     */

    const alreadyExists =
      mapData.edges.some(
        (edge) =>

          (
            edge.from ===
              fromId &&
            edge.to ===
              toId
          )

          ||

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


    const newEdge = {

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

          newEdge,

        ],

      })
    );

  }


  /*
   * ===================================================
   * NODE DRAG START
   * ===================================================
   */

  function handleNodeDragStart() {

    nodeDragSnapshot.current =
      structuredClone(
        mapData
      );

  }


  /*
   * ===================================================
   * NODE MOVE
   * ===================================================
   *
   * No clamp.
   * Infinite coordinates allowed.
   * ===================================================
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

                    x:
                      Number(
                        x
                      ),

                    y:
                      Number(
                        y
                      ),

                  }

                :
                  node
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
   * ===================================================
   * NODE DRAG END
   * ===================================================
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
   * ===================================================
   * OBJECT DRAG START
   * ===================================================
   */

  function handleObjectDragStart() {

    objectDragSnapshot.current =
      structuredClone(
        mapData
      );

  }


  /*
   * ===================================================
   * OBJECT MOVE
   * ===================================================
   *
   * Rack / Dock / Charging Station
   * can move anywhere in infinite workspace.
   * ===================================================
   */

  function handleObjectMove(
    type,
    objectId,
    x,
    y
  ) {

    setMapData(
      (previous) => {

        /*
         * RACK
         */

        if (
          type ===
          "rack"
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
                          Number(
                            x
                          ),

                        y:
                          Number(
                            y
                          ),

                      }

                    :
                      rack
              ),

          };

        }


        /*
         * STATION
         */

        if (
          type ===
          "station"
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
                          Number(
                            x
                          ),

                        y:
                          Number(
                            y
                          ),

                      }

                    :
                      station
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


  /*
   * ===================================================
   * OBJECT DRAG END
   * ===================================================
   */

  function handleObjectDragEnd() {

    if (
      !objectDragSnapshot.current
    ) {

      return;

    }


    setUndoStack(
      (history) => [

        ...history.slice(
          -49
        ),

        objectDragSnapshot.current,

      ]
    );


    setRedoStack(
      []
    );


    objectDragSnapshot.current =
      null;


    setSaveStatus(
      "Unsaved changes"
    );

  }


  /*
   * ===================================================
   * NODE PROPERTY CHANGE
   * ===================================================
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


              /*
               * Coordinates may be negative.
               */

              if (
                field ===
                  "x" ||
                field ===
                  "y"
              ) {

                nextValue =
                  Number(
                    value
                  );


                if (
                  !Number.isFinite(
                    nextValue
                  )
                ) {

                  nextValue =
                    0;

                }

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
   * ===================================================
   * OBJECT PROPERTY CHANGE
   * ===================================================
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


    /*
     * RACK
     */

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

                  :
                    rack
            ),

        })
      );


      return;

    }


    /*
     * STATION
     */

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

                  :
                    station
            ),

        })
      );

    }

  }


  /*
   * ===================================================
   * MAP PROPERTIES
   * ===================================================
   *
   * Width / Height represent Warehouse Boundary,
   * not workspace limits.
   * ===================================================
   */

  function handleMapChange(
    field,
    value
  ) {

    /*
     * Validate dimensions.
     */

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


  /*
   * ===================================================
   * DELETE
   * ===================================================
   */

  function handleDelete() {

    /*
     * NODE
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

          /*
           * Remove all connected edges.
           */

          edges:
            previous.edges.filter(
              (edge) =>

                edge.from !==
                  selectedNodeId

                &&

                edge.to !==
                  selectedNodeId
            ),

        })
      );


      clearSelection();


      return;

    }


    /*
     * RACK
     */

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


    /*
     * STATION
     */

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
   * ===================================================
   * EXPORT JSON
   * ===================================================
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
      `${
        sanitizeFilename(
          mapData.name
        )
      }.json`;


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
   * ===================================================
   * RESET MAP
   * ===================================================
   */

  function handleReset() {

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
   * ===================================================
   * CLEAR SELECTION
   * ===================================================
   */

  function clearSelection() {

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
   * ===================================================
   * OBJECT TREE NODE SELECT
   * ===================================================
   */

  function handleTreeNodeSelect(
    nodeId
  ) {

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


  /*
   * ===================================================
   * OBJECT TREE OBJECT SELECT
   * ===================================================
   */

  function handleTreeObjectSelect(
    object
  ) {

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


  /*
   * ===================================================
   * TOOL CHANGE
   * ===================================================
   */

  function handleToolChange(
    nextTool
  ) {

    setTool(
      nextTool
    );


    /*
     * Cancel unfinished connection.
     */

    setConnectionStart(
      null
    );

  }


  /*
   * ===================================================
   * UI
   * ===================================================
   */

  return (

    <div
      className={
        expanded
          ? "page map-page-expanded"
          : "page"
      }
    >

      {/*
       * ===============================================
       * PAGE HEADER
       * ===============================================
       */}

      <div className="page-header">

        <div>

          <span className="page-label">

            WAREHOUSE MAP DESIGN

          </span>


          <h2>

            Map Editor

          </h2>


          <p>

            Design warehouse topology,
            racks, stations and robot
            travel paths on an infinite
            workspace.

          </p>

        </div>


        <div className="map-header-right">

          {/*
           * Save status
           */}

          {saveStatus && (

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


          {/*
           * Warehouse boundary size
           */}

          <div className="map-editor-info">

            <Map
              size={
                16
              }
            />


            <span>

              {
                mapData.width
              }

              {" × "}

              {
                mapData.height
              }

              {" "}

              {
                mapData.unit
              }

            </span>

          </div>

        </div>

      </div>


      {/*
       * ===============================================
       * TOOLBAR
       * ===============================================
       */}

      <MapToolbar

        tool={
          tool
        }

        setTool={
          handleToolChange
        }


        /*
         * Editing
         */

        onDelete={
          handleDelete
        }


        /*
         * File
         */

        onSave={
          handleSave
        }

        onExport={
          handleExport
        }

        onReset={
          handleReset
        }


        /*
         * History
         */

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


        /*
         * Zoom
         */

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


        /*
         * Expand
         */

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


      {/*
       * ===============================================
       * MAIN EDITOR
       * ===============================================
       */}

      <div
        className={
          expanded
            ? "map-editor-layout-v4 expanded"
            : "map-editor-layout-v4"
        }
      >

        {/*
         * =============================================
         * LEFT OBJECT TREE
         * =============================================
         */}

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

            onSelectNode={
              handleTreeNodeSelect
            }

            onSelectObject={
              handleTreeObjectSelect
            }

          />

        )}


        {/*
         * =============================================
         * CENTER MAP
         * =============================================
         */}

        <section className="panel map-main-panel">

          <div className="panel-header">

            <h3>

              Warehouse Topology

            </h3>


            <span>

              {
                mapData.nodes.length
              }

              {" nodes • "}

              {
                mapData.edges.length
              }

              {" paths • "}

              {
                mapData.racks.length
              }

              {" racks • "}

              {
                mapData.stations.length
              }

              {" stations"}

            </span>

          </div>


          {/*
           * ===========================================
           * TOOL HELP
           * ===========================================
           */}

          {tool ===
            "connect" && (

            <EditorMessage>

              {
                connectionStart

                  ? `Start node: ${connectionStart}. Select destination node.`

                  : "Select the first node to create a path."
              }

            </EditorMessage>

          )}


          {tool ===
            "node" && (

            <EditorMessage>

              Click anywhere on the
              infinite grid to create
              a topology node.

            </EditorMessage>

          )}


          {tool ===
            "rack" && (

            <EditorMessage>

              Click anywhere on the
              infinite grid to place
              a rack.

            </EditorMessage>

          )}


          {tool ===
            "dock" && (

            <EditorMessage>

              Click anywhere on the
              infinite grid to place
              a dock station.

            </EditorMessage>

          )}


          {tool ===
            "charging" && (

            <EditorMessage>

              Click anywhere on the
              infinite grid to place
              a charging station.

            </EditorMessage>

          )}


          {/*
           * ===========================================
           * CANVAS
           * ===========================================
           */}

          <MapCanvas

            mapData={
              mapData
            }


            /*
             * Tool
             */

            tool={
              tool
            }


            /*
             * Selection
             */

            selectedNodeId={
              selectedNodeId
            }

            selectedObject={
              selectedObject
            }

            connectionStart={
              connectionStart
            }


            /*
             * Zoom
             */

            zoom={
              zoom
            }

            onZoomChange={
              setZoom
            }


            /*
             * Background
             */

            onCanvasClick={
              handleCanvasClick
            }


            /*
             * Node
             */

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


            /*
             * Rack / Station
             */

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


        {/*
         * =============================================
         * RIGHT PROPERTIES
         * =============================================
         */}

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

    ).toFixed(
      3
    )

  );

}


/*
 * =====================================================
 * RECALCULATE PATH DISTANCES
 * =====================================================
 */

function recalculateEdges(
  edges,
  nodes
) {

  return edges.map(
    (edge) => {

      /*
       * Manual distance should
       * not be recalculated.
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
 * GET SELECTED RACK / STATION
 * =====================================================
 */

function getSelectedMapObject(
  mapData,
  selection
) {

  if (
    !selection
  ) {

    return null;

  }


  /*
   * Rack
   */

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


  /*
   * Station
   */

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


/*
 * =====================================================
 * SNAP TO GRID
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


/*
 * =====================================================
 * OBJECT VALUE NORMALIZATION
 * =====================================================
 */

function normalizeObjectValue(
  field,
  value
) {

  /*
   * Infinite workspace coordinates.
   *
   * Negative values are allowed.
   */

  if (
    field === "x" ||
    field === "y"
  ) {

    const number =
      Number(
        value
      );


    return Number.isFinite(
      number
    )
      ? number
      : 0;

  }


  /*
   * Rack / Station size
   */

  if (
    field === "width" ||
    field === "depth"
  ) {

    const number =
      Number(
        value
      );


    return Math.max(

      Number.isFinite(
        number
      )
        ? number
        : 0.1,

      0.1

    );

  }


  /*
   * Rack levels
   */

  if (
    field === "levels" ||
    field === "slotsPerLevel"
  ) {

    const number =
      Number(
        value
      );


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


  /*
   * Rotation
   */

  if (
    field === "rotation"
  ) {

    const number =
      Number(
        value
      );


    return Number.isFinite(
      number
    )
      ? number
      : 0;

  }


  /*
   * String values
   */

  return value;

}


/*
 * =====================================================
 * NEXT UNIQUE ID
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


  return (
    `${prefix}${
      String(
        highest + 1
      ).padStart(
        padding,
        "0"
      )
    }`
  );

}


/*
 * =====================================================
 * SAFE FILE NAME
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