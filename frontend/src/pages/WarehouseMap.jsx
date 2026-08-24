import { useRef, useState } from "react";
import { Map, Info, CheckCircle2 } from "lucide-react";

import MapToolbar from "../components/map/MapToolbar";
import MapCanvas from "../components/map/MapCanvas";
import MapProperties from "../components/map/MapProperties";
import MapObjectTree from "../components/map/MapObjectTree";
import MonitorPanel from "../components/map/MonitorPanel";
import MapManager from "../components/map/MapManager";

import { INITIAL_MAP } from "../data/mockWarehouseMap";
import { MOCK_ROBOTS } from "../data/mockRobots";

import "../styles/map-editor.css";

const MAP_LIBRARY_KEY = "wms-warehouse-map-library-v1";
const LEGACY_KEYS = ["wms-warehouse-map-v3", "wms-warehouse-map-v2"];

export default function WarehouseMap() {
  const initialSystemRef = useRef(null);
  if (!initialSystemRef.current) {
    initialSystemRef.current = loadMapSystem();
  }

  const initialSystem = initialSystemRef.current;

  const [mapLibrary, setMapLibrary] = useState(initialSystem.library);
  const [activeMapId, setActiveMapId] = useState(initialSystem.activeMapId);
  const [mapData, setMapData] = useState(initialSystem.mapData);

  const [mode, setMode] = useState("edit");
  const [tool, setTool] = useState("select");
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState(null);
  const [boundarySelected, setBoundarySelected] = useState(false);
  const [connectionStart, setConnectionStart] = useState(null);
  const [selectedRobotId, setSelectedRobotId] = useState(null);

  const [zoom, setZoom] = useState(1);
  const [fitRequest, setFitRequest] = useState(0);
  const [expanded, setExpanded] = useState(false);

  const [saveStatus, setSaveStatus] = useState("Saved");
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);

  const nodeDragSnapshot = useRef(null);
  const boundaryDragSnapshot = useRef(null);
  const importFileRef = useRef(null);

  const selectedNode =
    mapData.nodes.find((node) => node.id === selectedNodeId) || null;
  const selectedEdge =
    mapData.edges.find((edge) => edge.id === selectedEdgeId) || null;
  const selectedRobot =
    MOCK_ROBOTS.find((robot) => robot.id === selectedRobotId) || null;

  const mapList = Object.values(mapLibrary.maps).sort((a, b) =>
    String(a.name).localeCompare(String(b.name))
  );

  function commitMap(updater) {
    setMapData((current) => {
      const snapshot = structuredClone(current);
      const working = structuredClone(current);
      const next =
        typeof updater === "function" ? updater(working) : structuredClone(updater);

      if (!next) return current;

      setUndoStack((history) => [...history.slice(-49), snapshot]);
      setRedoStack([]);
      setSaveStatus("Unsaved changes");
      return normalizeMapData(next);
    });
  }

  function persistLibrary(library) {
    try {
      localStorage.setItem(MAP_LIBRARY_KEY, JSON.stringify(library));
      return true;
    } catch (error) {
      console.error("Could not save map library.", error);
      return false;
    }
  }

  function handleSave() {
    const normalized = normalizeMapData(mapData);
    const nextLibrary = {
      ...mapLibrary,
      activeMapId: normalized.mapId,
      maps: {
        ...mapLibrary.maps,
        [normalized.mapId]: structuredClone(normalized),
      },
    };

    if (!persistLibrary(nextLibrary)) {
      setSaveStatus("Save failed");
      return;
    }

    setMapData(normalized);
    setMapLibrary(nextLibrary);
    setActiveMapId(normalized.mapId);
    setSaveStatus("Saved");
  }

  function handleNewMap(name) {
    if (!confirmDiscardChanges()) return;

    const mapId = generateMapId(mapLibrary.maps);
    const newMap = createBlankMap(mapId, name);
    const nextLibrary = {
      ...mapLibrary,
      activeMapId: mapId,
      maps: {
        ...mapLibrary.maps,
        [mapId]: structuredClone(newMap),
      },
    };

    if (!persistLibrary(nextLibrary)) {
      window.alert("Could not create the new map.");
      return;
    }

    setMapLibrary(nextLibrary);
    setActiveMapId(mapId);
    setMapData(structuredClone(newMap));
    resetEditorState();
    setSaveStatus("Saved");
    requestFit();
  }

  function handleSaveAs(name) {
    const mapId = generateMapId(mapLibrary.maps);
    const newMap = normalizeMapData({
      ...structuredClone(mapData),
      mapId,
      name,
    });

    const nextLibrary = {
      ...mapLibrary,
      activeMapId: mapId,
      maps: {
        ...mapLibrary.maps,
        [mapId]: structuredClone(newMap),
      },
    };

    if (!persistLibrary(nextLibrary)) {
      window.alert("Could not save the map copy.");
      return;
    }

    setMapLibrary(nextLibrary);
    setActiveMapId(mapId);
    setMapData(newMap);
    resetEditorState();
    setSaveStatus("Saved");
  }

  function handleLoadMap(mapId) {
    if (mapId === activeMapId) return;
    const target = mapLibrary.maps[mapId];
    if (!target || !confirmDiscardChanges()) return;

    const nextLibrary = { ...mapLibrary, activeMapId: mapId };
    persistLibrary(nextLibrary);
    setMapLibrary(nextLibrary);
    setActiveMapId(mapId);
    setMapData(normalizeMapData(structuredClone(target)));
    resetEditorState();
    setSaveStatus("Saved");
    requestFit();
  }

  function handleDeleteMap(mapId) {
    const ids = Object.keys(mapLibrary.maps);
    if (ids.length <= 1) {
      window.alert("At least one map must remain.");
      return;
    }

    const target = mapLibrary.maps[mapId];
    if (!target) return;

    if (!window.confirm(`Delete map "${target.name}"?\n\nThis action cannot be undone.`)) {
      return;
    }

    const nextMaps = { ...mapLibrary.maps };
    delete nextMaps[mapId];

    const nextActiveMapId =
      activeMapId === mapId ? Object.keys(nextMaps)[0] : activeMapId;

    const nextLibrary = {
      activeMapId: nextActiveMapId,
      maps: nextMaps,
    };

    if (!persistLibrary(nextLibrary)) {
      window.alert("Could not delete the map.");
      return;
    }

    setMapLibrary(nextLibrary);
    setActiveMapId(nextActiveMapId);
    setMapData(normalizeMapData(structuredClone(nextMaps[nextActiveMapId])));
    resetEditorState();
    setSaveStatus("Saved");
    requestFit();
  }

  function handleImportClick() {
    if (mode !== "edit") return;
    importFileRef.current?.click();
  }

  async function handleToolbarImport(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    await handleImportMap(file);
  }

  async function handleImportMap(file) {
    if (!file.name.toLowerCase().endsWith(".json")) {
      window.alert("Import failed.\n\nPlease select a JSON file.");
      return { ok: false, message: "Import failed: JSON files only." };
    }

    if (file.size > 5 * 1024 * 1024) {
      window.alert("Import failed.\n\nThe JSON file must be smaller than 5 MB.");
      return { ok: false, message: "Import failed: file is larger than 5 MB." };
    }

    let raw;
    try {
      raw = JSON.parse(await file.text());
    } catch (error) {
      console.error("JSON parse error:", error);
      window.alert("Import failed.\n\nThe selected file is not valid JSON.");
      return { ok: false, message: "Import failed: invalid JSON." };
    }

    const validation = validateImportedMap(raw);
    if (!validation.ok) {
      window.alert(
        ["Import failed.", "", ...validation.errors.map((error) => `• ${error}`)].join(
          "\n"
        )
      );
      return {
        ok: false,
        message: `Import failed (${validation.errors.length} error${
          validation.errors.length === 1 ? "" : "s"
        }).`,
      };
    }

    let importedMap = validation.map;
    if (mapLibrary.maps[importedMap.mapId]) {
      importedMap = {
        ...importedMap,
        mapId: generateMapId(mapLibrary.maps),
        name: `${importedMap.name} (Imported)`,
      };
    }

    const nextLibrary = {
      ...mapLibrary,
      activeMapId: importedMap.mapId,
      maps: {
        ...mapLibrary.maps,
        [importedMap.mapId]: structuredClone(importedMap),
      },
    };

    if (!persistLibrary(nextLibrary)) {
      return { ok: false, message: "Import failed: could not save map." };
    }

    setMapLibrary(nextLibrary);
    setActiveMapId(importedMap.mapId);
    setMapData(structuredClone(importedMap));
    resetEditorState();
    setSaveStatus("Saved");
    requestFit();

    return { ok: true, message: `Imported ${importedMap.name}` };
  }

  function confirmDiscardChanges() {
    if (saveStatus !== "Unsaved changes") return true;
    return window.confirm("This map has unsaved changes.\n\nContinue without saving?");
  }

  function resetEditorState() {
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setBoundarySelected(false);
    setConnectionStart(null);
    setTool("select");
    setUndoStack([]);
    setRedoStack([]);
  }

  function requestFit() {
    window.setTimeout(() => setFitRequest((current) => current + 1), 0);
  }

  function clearSelection() {
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setBoundarySelected(false);
    setConnectionStart(null);
  }

  function handleModeChange(nextMode) {
    setMode(nextMode);
    setTool("select");
    clearSelection();

    if (nextMode === "monitor") {
      if (!selectedRobotId && MOCK_ROBOTS.length > 0) {
        setSelectedRobotId(MOCK_ROBOTS[0].id);
      }
    } else {
      setSelectedRobotId(null);
    }
  }

  function handleToolChange(nextTool) {
    if (mode !== "edit") return;
    setTool(nextTool);
    setConnectionStart(null);
  }

  function handleUndo() {
    if (undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];

    setRedoStack((history) => [...history, structuredClone(mapData)]);
    setUndoStack((history) => history.slice(0, -1));
    setMapData(structuredClone(previous));
    clearSelection();
    setSaveStatus("Unsaved changes");
  }

  function handleRedo() {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];

    setUndoStack((history) => [...history, structuredClone(mapData)]);
    setRedoStack((history) => history.slice(0, -1));
    setMapData(structuredClone(next));
    clearSelection();
    setSaveStatus("Unsaved changes");
  }

  function zoomIn() {
    setZoom((current) => Number(Math.min(current * 1.1, 4).toFixed(3)));
  }

  function zoomOut() {
    setZoom((current) => Number(Math.max(current * 0.9, 0.25).toFixed(3)));
  }

  function fitMap() {
    setFitRequest((current) => current + 1);
  }

  function handleCanvasClick(position) {
    if (mode === "monitor") {
      setSelectedRobotId(null);
      return;
    }

    if (tool === "node") {
      addNode(position);
      return;
    }

    if (tool === "select") clearSelection();
  }

  function addNode({ x, y }) {
    const position = snapPosition(x, y, mapData.gridSpacing);
    const id = getNextId(mapData.nodes, "P", 3);
    const node = {
      id,
      name: `Point-${id.replace("P", "")}`,
      type: "WAYPOINT",
      x: position.x,
      y: position.y,
      rotation: 0,
      enabled: true,
      config: {},
    };

    commitMap((previous) => ({
      ...previous,
      nodes: [...previous.nodes, node],
    }));

    setSelectedNodeId(id);
    setSelectedEdgeId(null);
    setBoundarySelected(false);
    setConnectionStart(null);
    setTool("select");
  }

  function handleNodeClick(nodeId) {
    if (mode !== "edit") return;

    if (tool === "connect") {
      if (!connectionStart) {
        setConnectionStart(nodeId);
        setSelectedNodeId(nodeId);
        setSelectedEdgeId(null);
        setBoundarySelected(false);
        return;
      }

      if (connectionStart === nodeId) {
        setConnectionStart(null);
        return;
      }

      createConnection(connectionStart, nodeId);
      setConnectionStart(null);
      return;
    }

    if (tool === "select") {
      setSelectedNodeId(nodeId);
      setSelectedEdgeId(null);
      setBoundarySelected(false);
      setConnectionStart(null);
    }
  }

  function handleEdgeClick(edgeId) {
    if (mode !== "edit" || tool !== "select") return;
    setSelectedEdgeId(edgeId);
    setSelectedNodeId(null);
    setBoundarySelected(false);
    setConnectionStart(null);
  }

  function handleBoundaryClick() {
    if (mode !== "edit" || tool !== "select") return;
    setBoundarySelected(true);
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setConnectionStart(null);
  }

  function createConnection(fromId, toId) {
    if (fromId === toId) return;

    const from = mapData.nodes.find((node) => node.id === fromId);
    const to = mapData.nodes.find((node) => node.id === toId);
    if (!from || !to) return;

    const duplicate = mapData.edges.some(
      (edge) =>
        (edge.from === fromId && edge.to === toId) ||
        (edge.from === toId && edge.to === fromId)
    );
    if (duplicate) return;

    const edge = {
      id: getNextId(mapData.edges, "E", 3),
      from: fromId,
      to: toId,
      distance: calculateDistance(from, to),
      autoDistance: true,
      bidirectional: true,
      enabled: true,
      speedLimit: 1.2,
      pathType: "NORMAL",
      vehicleAccess: "BOTH",
    };

    commitMap((previous) => ({
      ...previous,
      edges: [...previous.edges, edge],
    }));

    setSelectedNodeId(null);
    setSelectedEdgeId(edge.id);
    setBoundarySelected(false);
  }

  function handleNodeDragStart() {
    nodeDragSnapshot.current = structuredClone(mapData);
  }

  function handleNodeMove(nodeId, x, y) {
    if (mode !== "edit") return;

    setMapData((previous) => {
      const nodes = previous.nodes.map((node) =>
        node.id === nodeId ? { ...node, x: Number(x), y: Number(y) } : node
      );

      return {
        ...previous,
        nodes,
        edges: recalculateEdges(previous.edges, nodes),
      };
    });

    setSaveStatus("Unsaved changes");
  }

  function handleNodeDragEnd() {
    if (!nodeDragSnapshot.current) return;
    setUndoStack((history) => [...history.slice(-49), nodeDragSnapshot.current]);
    setRedoStack([]);
    nodeDragSnapshot.current = null;
    setSaveStatus("Unsaved changes");
  }

  function handleBoundaryDragStart() {
    boundaryDragSnapshot.current = structuredClone(mapData);
  }

  function handleBoundaryLiveChange(patch) {
    setMapData((previous) => ({ ...previous, ...patch }));
    setSaveStatus("Unsaved changes");
  }

  function handleBoundaryDragEnd() {
    if (!boundaryDragSnapshot.current) return;
    setUndoStack((history) => [...history.slice(-49), boundaryDragSnapshot.current]);
    setRedoStack([]);
    boundaryDragSnapshot.current = null;
    setSaveStatus("Unsaved changes");
  }

  function handleNodeChange(field, value) {
    if (mode !== "edit" || !selectedNodeId) return;

    commitMap((previous) => {
      const nodes = previous.nodes.map((node) => {
        if (node.id !== selectedNodeId) return node;

        if (field.startsWith("config.")) {
          const key = field.replace("config.", "");
          return {
            ...node,
            config: {
              ...(node.config || {}),
              [key]: value,
            },
          };
        }

        if (field === "type") {
          return {
            ...node,
            type: value,
            config: getDefaultConfigForType(value, node.config),
          };
        }

        if (["x", "y", "rotation"].includes(field)) {
          const numeric = Number(value);
          return Number.isFinite(numeric) ? { ...node, [field]: numeric } : node;
        }

        return { ...node, [field]: value };
      });

      return {
        ...previous,
        nodes,
        edges: recalculateEdges(previous.edges, nodes),
      };
    });
  }

  function handleEdgeChange(field, value) {
    if (mode !== "edit" || !selectedEdgeId) return;

    commitMap((previous) => {
      const currentEdge = previous.edges.find((edge) => edge.id === selectedEdgeId);
      if (!currentEdge) return previous;

      if (field === "from" || field === "to") {
        const nextFrom = field === "from" ? value : currentEdge.from;
        const nextTo = field === "to" ? value : currentEdge.to;

        if (nextFrom === nextTo) return previous;

        const fromNode = previous.nodes.find((node) => node.id === nextFrom);
        const toNode = previous.nodes.find((node) => node.id === nextTo);
        if (!fromNode || !toNode) return previous;

        const duplicate = previous.edges.some((edge) => {
          if (edge.id === selectedEdgeId) return false;
          return (
            (edge.from === nextFrom && edge.to === nextTo) ||
            (edge.from === nextTo && edge.to === nextFrom)
          );
        });
        if (duplicate) return previous;

        return {
          ...previous,
          edges: previous.edges.map((edge) => {
            if (edge.id !== selectedEdgeId) return edge;
            const nextEdge = { ...edge, from: nextFrom, to: nextTo };
            if (edge.autoDistance) {
              nextEdge.distance = calculateDistance(fromNode, toNode);
            }
            return nextEdge;
          }),
        };
      }

      return {
        ...previous,
        edges: previous.edges.map((edge) => {
          if (edge.id !== selectedEdgeId) return edge;
          const nextEdge = { ...edge, [field]: value };

          if (field === "autoDistance" && value === true) {
            const from = previous.nodes.find((node) => node.id === edge.from);
            const to = previous.nodes.find((node) => node.id === edge.to);
            if (from && to) nextEdge.distance = calculateDistance(from, to);
          }

          if (field === "distance") {
            nextEdge.distance = Math.max(Number(value) || 0, 0);
          }

          if (field === "speedLimit") {
            nextEdge.speedLimit = Math.max(Number(value) || 0, 0);
          }

          return nextEdge;
        }),
      };
    });
  }

  function handleMapChange(field, value) {
    if (mode !== "edit") return;

    if (["width", "height", "gridSpacing"].includes(field)) {
      const number = Number(value);
      if (!Number.isFinite(number) || number <= 0) return;
      value = number;
    }

    if (["originX", "originY"].includes(field)) {
      const number = Number(value);
      if (!Number.isFinite(number)) return;
      value = number;
    }

    commitMap((previous) => ({ ...previous, [field]: value }));
  }

  function handleDelete() {
    if (mode !== "edit") return;

    if (selectedEdgeId) {
      commitMap((previous) => ({
        ...previous,
        edges: previous.edges.filter((edge) => edge.id !== selectedEdgeId),
      }));
      setSelectedEdgeId(null);
      return;
    }

    if (selectedNodeId) {
      commitMap((previous) => ({
        ...previous,
        nodes: previous.nodes.filter((node) => node.id !== selectedNodeId),
        edges: previous.edges.filter(
          (edge) => edge.from !== selectedNodeId && edge.to !== selectedNodeId
        ),
      }));
      setSelectedNodeId(null);
      setConnectionStart(null);
    }
  }

  function handleExport() {
    const blob = new Blob([JSON.stringify(mapData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${sanitizeFilename(mapData.name)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function handleReset() {
    if (mode !== "edit") return;
    if (!window.confirm("Reset the current map layout?")) return;

    commitMap(createBlankMap(mapData.mapId, mapData.name));
    clearSelection();
    setTool("select");
    requestFit();
  }

  function handleTreeNodeSelect(nodeId) {
    setSelectedNodeId(nodeId);
    setSelectedEdgeId(null);
    setBoundarySelected(false);
    setConnectionStart(null);
    setTool("select");
  }

  function handleTreeEdgeSelect(edgeId) {
    setSelectedEdgeId(edgeId);
    setSelectedNodeId(null);
    setBoundarySelected(false);
    setConnectionStart(null);
    setTool("select");
  }

  return (
    <div className={expanded ? "page map-page-expanded" : "page"}>
      <div className="page-header">
        <div>
          <span className="page-label">WAREHOUSE MAP DESIGN</span>
          <h2>{mode === "edit" ? "Map Editor" : "Warehouse Monitor"}</h2>
          <p>
            {mode === "edit"
              ? "Create, manage and configure warehouse maps and robot travel topology."
              : "Monitor robot position, status and planned route."}
          </p>
        </div>

        <div className="map-header-right">
          {mode === "edit" && saveStatus && (
            <div
              className={
                saveStatus === "Saved" ? "map-save-status saved" : "map-save-status"
              }
            >
              {saveStatus === "Saved" && <CheckCircle2 size={14} />}
              <span>{saveStatus}</span>
            </div>
          )}

          <div className="map-editor-info">
            <Map size={16} />
            <span>
              {mapData.width} × {mapData.height} {mapData.unit}
            </span>
          </div>
        </div>
      </div>

      {mode === "edit" && (
        <MapManager
          maps={mapList}
          activeMapId={activeMapId}
          currentMap={mapData}
          saveStatus={saveStatus}
          onNew={handleNewMap}
          onSave={handleSave}
          onSaveAs={handleSaveAs}
          onLoad={handleLoadMap}
          onDelete={handleDeleteMap}
          onImport={handleImportMap}
        />
      )}

      <MapToolbar
        mode={mode}
        setMode={handleModeChange}
        tool={tool}
        setTool={handleToolChange}
        onDelete={handleDelete}
        onSave={handleSave}
        onImport={handleImportClick}
        onExport={handleExport}
        onReset={handleReset}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={undoStack.length > 0}
        canRedo={redoStack.length > 0}
        zoom={zoom}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onFit={fitMap}
        expanded={expanded}
        onToggleExpand={() => setExpanded((current) => !current)}
      />

      <div className={expanded ? "map-editor-layout-v4 expanded" : "map-editor-layout-v4"}>
        {!expanded && mode === "edit" && (
          <MapObjectTree
            mapData={mapData}
            selectedNodeId={selectedNodeId}
            selectedEdgeId={selectedEdgeId}
            onSelectNode={handleTreeNodeSelect}
            onSelectEdge={handleTreeEdgeSelect}
          />
        )}

        {!expanded && mode === "monitor" && (
          <aside className="panel monitor-fleet-list">
            <div className="panel-header">
              <h3>Robot Fleet</h3>
              <span>{MOCK_ROBOTS.length}</span>
            </div>

            {MOCK_ROBOTS.map((robot) => (
              <button
                type="button"
                key={robot.id}
                className={`monitor-fleet-item ${
                  selectedRobotId === robot.id ? "active" : ""
                }`}
                onClick={() => setSelectedRobotId(robot.id)}
              >
                <div>
                  <strong>{robot.id}</strong>
                  <span>{robot.task}</span>
                </div>
                <span className={`monitor-status ${robot.status.toLowerCase()}`}>
                  {robot.status}
                </span>
              </button>
            ))}
          </aside>
        )}

        <section className="panel map-main-panel">
          <div className="panel-header">
            <h3>{mode === "edit" ? "Warehouse Topology" : "Live Warehouse Map"}</h3>
            <span>
              {mode === "edit"
                ? `${mapData.nodes.length} nodes • ${mapData.edges.length} paths`
                : `${MOCK_ROBOTS.length} robots`}
            </span>
          </div>

          {mode === "edit" && tool === "connect" && (
            <EditorMessage>
              {connectionStart
                ? `Start node: ${connectionStart}. Select destination node.`
                : "Select the first node to create a path."}
            </EditorMessage>
          )}

          {mode === "edit" && tool === "node" && (
            <EditorMessage>Click anywhere on the infinite grid to create a Node.</EditorMessage>
          )}

          <MapCanvas
            mapData={mapData}
            mode={mode}
            tool={tool}
            selectedNodeId={selectedNodeId}
            selectedEdgeId={selectedEdgeId}
            boundarySelected={boundarySelected}
            connectionStart={connectionStart}
            robots={MOCK_ROBOTS}
            selectedRobotId={selectedRobotId}
            onRobotClick={setSelectedRobotId}
            zoom={zoom}
            onZoomChange={setZoom}
            fitRequest={fitRequest}
            onCanvasClick={handleCanvasClick}
            onNodeClick={handleNodeClick}
            onNodeMove={handleNodeMove}
            onNodeDragStart={handleNodeDragStart}
            onNodeDragEnd={handleNodeDragEnd}
            onEdgeClick={handleEdgeClick}
            onBoundaryClick={handleBoundaryClick}
            onBoundaryDragStart={handleBoundaryDragStart}
            onBoundaryChange={handleBoundaryLiveChange}
            onBoundaryDragEnd={handleBoundaryDragEnd}
          />
        </section>

        {!expanded && mode === "edit" && (
          <aside className="panel map-properties">
            <MapProperties
              mapData={mapData}
              selectedNode={selectedNode}
              selectedEdge={selectedEdge}
              boundarySelected={boundarySelected}
              onMapChange={handleMapChange}
              onNodeChange={handleNodeChange}
              onEdgeChange={handleEdgeChange}
              onSelectBoundary={handleBoundaryClick}
            />
          </aside>
        )}

        {!expanded && mode === "monitor" && <MonitorPanel robot={selectedRobot} />}
      </div>

      <input
        ref={importFileRef}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={handleToolbarImport}
      />
    </div>
  );
}

function EditorMessage({ children }) {
  return (
    <div className="map-editor-message">
      <Info size={15} />
      <span>{children}</span>
    </div>
  );
}

function loadMapSystem() {
  try {
    const saved = localStorage.getItem(MAP_LIBRARY_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed?.maps && typeof parsed.maps === "object") {
        const sourceIds = Object.keys(parsed.maps);
        if (sourceIds.length > 0) {
          const normalizedMaps = {};
          for (const sourceId of sourceIds) {
            const normalized = normalizeMapData(parsed.maps[sourceId]);
            let id = normalized.mapId || sourceId;
            if (normalizedMaps[id]) {
              id = generateMapId(normalizedMaps);
              normalized.mapId = id;
            }
            normalizedMaps[id] = normalized;
          }

          const normalizedIds = Object.keys(normalizedMaps);
          const activeMapId = normalizedMaps[parsed.activeMapId]
            ? parsed.activeMapId
            : normalizedIds[0];

          const library = { activeMapId, maps: normalizedMaps };
          return {
            activeMapId,
            mapData: structuredClone(normalizedMaps[activeMapId]),
            library,
          };
        }
      }
    }
  } catch (error) {
    console.warn("Could not load Map Library.", error);
  }

  for (const key of LEGACY_KEYS) {
    try {
      const saved = localStorage.getItem(key);
      if (!saved) continue;

      const legacy = normalizeMapData(JSON.parse(saved));
      const library = {
        activeMapId: legacy.mapId,
        maps: { [legacy.mapId]: legacy },
      };
      localStorage.setItem(MAP_LIBRARY_KEY, JSON.stringify(library));
      return {
        activeMapId: legacy.mapId,
        mapData: structuredClone(legacy),
        library,
      };
    } catch (error) {
      console.warn(`Migration failed for ${key}.`, error);
    }
  }

  const initialMap = normalizeMapData(structuredClone(INITIAL_MAP));
  const library = {
    activeMapId: initialMap.mapId,
    maps: { [initialMap.mapId]: initialMap },
  };
  localStorage.setItem(MAP_LIBRARY_KEY, JSON.stringify(library));

  return {
    activeMapId: initialMap.mapId,
    mapData: structuredClone(initialMap),
    library,
  };
}

function createBlankMap(mapId, name) {
  return normalizeMapData({
    ...structuredClone(INITIAL_MAP),
    mapId,
    name,
    originX: 0,
    originY: 0,
    width: 30,
    height: 20,
    gridSpacing: 1,
    showBoundary: true,
    snapBoundaryToGrid: true,
    nodes: [],
    edges: [],
  });
}

function validateImportedMap(raw) {
  const errors = [];

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, errors: ["JSON root must be an object."], map: null };
  }

  if (typeof raw.name !== "string" || !raw.name.trim()) {
    errors.push("Map name is required.");
  }
  if (!isPositiveNumber(raw.width)) errors.push("width must be greater than 0.");
  if (!isPositiveNumber(raw.height)) errors.push("height must be greater than 0.");
  if (!isPositiveNumber(raw.gridSpacing)) {
    errors.push("gridSpacing must be greater than 0.");
  }
  if (!Array.isArray(raw.nodes)) errors.push("nodes must be an array.");
  if (!Array.isArray(raw.edges)) errors.push("edges must be an array.");

  if (errors.length > 0) return { ok: false, errors, map: null };

  const nodeIds = new Set();
  raw.nodes.forEach((node, index) => {
    if (!node || typeof node !== "object") {
      errors.push(`Node ${index + 1} is invalid.`);
      return;
    }

    if (typeof node.id !== "string" || !node.id.trim()) {
      errors.push(`Node ${index + 1} has no valid id.`);
      return;
    }

    if (nodeIds.has(node.id)) errors.push(`Duplicate Node ID: ${node.id}.`);
    nodeIds.add(node.id);

    if (!isFiniteNumber(node.x) || !isFiniteNumber(node.y)) {
      errors.push(`${node.id} has invalid X/Y coordinates.`);
    }
  });

  const edgeIds = new Set();
  const physicalPaths = new Set();
  raw.edges.forEach((edge, index) => {
    if (!edge || typeof edge !== "object") {
      errors.push(`Path ${index + 1} is invalid.`);
      return;
    }

    if (typeof edge.id !== "string" || !edge.id.trim()) {
      errors.push(`Path ${index + 1} has no valid id.`);
      return;
    }

    if (edgeIds.has(edge.id)) errors.push(`Duplicate Path ID: ${edge.id}.`);
    edgeIds.add(edge.id);

    if (!nodeIds.has(edge.from)) {
      errors.push(`${edge.id} refers to unknown From Node ${edge.from}.`);
    }
    if (!nodeIds.has(edge.to)) {
      errors.push(`${edge.id} refers to unknown To Node ${edge.to}.`);
    }
    if (edge.from === edge.to) {
      errors.push(`${edge.id} cannot connect a Node to itself.`);
    }

    if (edge.from && edge.to) {
      const key = [edge.from, edge.to].sort().join("::");
      if (physicalPaths.has(key)) {
        errors.push(`${edge.id} duplicates another physical path.`);
      }
      physicalPaths.add(key);
    }
  });

  if (errors.length > 0) return { ok: false, errors, map: null };

  const map = normalizeMapData(raw);
  map.edges = recalculateEdges(map.edges, map.nodes);
  return { ok: true, errors: [], map };
}

function normalizeMapData(data) {
  const nodes = Array.isArray(data?.nodes)
    ? data.nodes.map((node) => ({
        ...node,
        id: String(node.id),
        name: node.name || node.id,
        type: node.type || "WAYPOINT",
        x: Number(node.x) || 0,
        y: Number(node.y) || 0,
        rotation: Number(node.rotation) || 0,
        enabled: node.enabled !== false,
        config:
          node.config && typeof node.config === "object" ? { ...node.config } : {},
      }))
    : [];

  const edges = Array.isArray(data?.edges)
    ? data.edges.map((edge) => ({
        ...edge,
        id: String(edge.id),
        from: String(edge.from),
        to: String(edge.to),
        distance: Math.max(Number(edge.distance) || 0, 0),
        autoDistance: edge.autoDistance !== false,
        bidirectional: edge.bidirectional !== false,
        enabled: edge.enabled !== false,
        speedLimit: Math.max(Number(edge.speedLimit) || 1.2, 0),
        pathType: edge.pathType || "NORMAL",
        vehicleAccess: edge.vehicleAccess || "BOTH",
      }))
    : [];

  return {
    ...data,
    mapId: String(data?.mapId || "MAP-001"),
    name: String(data?.name || "Warehouse Map"),
    unit: data?.unit || "meter",
    originX: isFiniteNumber(data?.originX) ? Number(data.originX) : 0,
    originY: isFiniteNumber(data?.originY) ? Number(data.originY) : 0,
    width: isPositiveNumber(data?.width) ? Number(data.width) : 30,
    height: isPositiveNumber(data?.height) ? Number(data.height) : 20,
    gridSpacing: isPositiveNumber(data?.gridSpacing) ? Number(data.gridSpacing) : 1,
    showBoundary: data?.showBoundary !== false,
    snapBoundaryToGrid: data?.snapBoundaryToGrid !== false,
    nodes,
    edges,
  };
}

function generateMapId(maps) {
  let highest = 0;
  for (const mapId of Object.keys(maps)) {
    const match = /^MAP-(\d+)$/i.exec(mapId);
    if (match) highest = Math.max(highest, Number(match[1]));
  }

  let next = highest + 1;
  let id;
  do {
    id = `MAP-${String(next).padStart(3, "0")}`;
    next += 1;
  } while (maps[id]);
  return id;
}

function calculateDistance(pointA, pointB) {
  const dx = Number(pointB.x) - Number(pointA.x);
  const dy = Number(pointB.y) - Number(pointA.y);
  return Number(Math.hypot(dx, dy).toFixed(3));
}

function recalculateEdges(edges, nodes) {
  return edges.map((edge) => {
    if (!edge.autoDistance) return edge;
    const from = nodes.find((node) => node.id === edge.from);
    const to = nodes.find((node) => node.id === edge.to);
    if (!from || !to) return edge;
    return { ...edge, distance: calculateDistance(from, to) };
  });
}

function snapPosition(x, y, spacing) {
  const step = Number(spacing);
  if (!Number.isFinite(step) || step <= 0) {
    return { x: Number(x), y: Number(y) };
  }

  return {
    x: Number((Math.round(Number(x) / step) * step).toFixed(3)),
    y: Number((Math.round(Number(y) / step) * step).toFixed(3)),
  };
}

function getDefaultConfigForType(type, existingConfig = {}) {
  switch (type) {
    case "STORAGE":
      return {
        width: existingConfig.width || 4,
        depth: existingConfig.depth || 2,
        zone: existingConfig.zone || "",
        levels: existingConfig.levels || 4,
        slotsPerLevel: existingConfig.slotsPerLevel || 6,
      };
    case "CHARGING":
      return {
        width: existingConfig.width || 2,
        depth: existingConfig.depth || 2,
        chargerId: existingConfig.chargerId || "",
      };
    case "DOCK":
      return {
        width: existingConfig.width || 3,
        depth: existingConfig.depth || 2,
      };
    default:
      return {};
  }
}

function getNextId(items, prefix, padding) {
  let highest = 0;
  for (const item of items) {
    const id = String(item.id);
    if (!id.startsWith(prefix)) continue;
    const value = Number(id.slice(prefix.length));
    if (Number.isFinite(value)) highest = Math.max(highest, value);
  }
  return `${prefix}${String(highest + 1).padStart(padding, "0")}`;
}

function isFiniteNumber(value) {
  return Number.isFinite(Number(value));
}

function isPositiveNumber(value) {
  return Number.isFinite(Number(value)) && Number(value) > 0;
}

function sanitizeFilename(name) {
  return (
    String(name || "warehouse-map")
      .trim()
      .replace(/[^a-zA-Z0-9-_ ]/g, "")
      .replace(/\s+/g, "_") || "warehouse-map"
  );
}
