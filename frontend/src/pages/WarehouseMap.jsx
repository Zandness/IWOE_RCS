import { useState } from "react";
import { Map, Radio } from "lucide-react";

import MapToolbar from "../components/map/MapToolbar";
import MapCanvas from "../components/map/MapCanvas";
import MonitorPanel from "../components/map/MonitorPanel";

import { INITIAL_MAP } from "../data/mockWarehouseMap";
import { MOCK_ROBOTS } from "../data/mockRobots";

import "../styles/map-editor.css";

const MAP_LIBRARY_KEY = "wms-warehouse-map-library-v1";
const LEGACY_KEYS = [
  "wms-warehouse-map-v3",
  "wms-warehouse-map-v2",
];

export default function WarehouseMap() {
  const [mapData] = useState(loadMonitorMap);
  const [selectedRobotId, setSelectedRobotId] = useState(
    MOCK_ROBOTS[0]?.id || null
  );
  const [zoom, setZoom] = useState(1);
  const [fitRequest, setFitRequest] = useState(1);
  const [expanded, setExpanded] = useState(false);

  const selectedRobot =
    MOCK_ROBOTS.find(
      (robot) => robot.id === selectedRobotId
    ) || null;

  function zoomIn() {
    setZoom((current) =>
      Number(Math.min(current * 1.1, 4).toFixed(3))
    );
  }

  function zoomOut() {
    setZoom((current) =>
      Number(Math.max(current * 0.9, 0.25).toFixed(3))
    );
  }

  function fitMap() {
    setFitRequest((current) => current + 1);
  }

  return (
    <div className={expanded ? "page map-page-expanded" : "page"}>
      <div className="page-header">
        <div>
          <span className="page-label">
            WAREHOUSE MONITOR
          </span>

          <h2>Warehouse Map</h2>

          <p>
            Monitor robot position, operating status and planned route.
            Map editing is disabled in this WMS view.
          </p>
        </div>

        <div className="map-header-right">
          <div className="map-editor-info">
            <Radio size={15} />
            <span>Monitor Mode</span>
          </div>

          <div className="map-editor-info">
            <Map size={16} />
            <span>
              {mapData.width} × {mapData.height} {mapData.unit}
            </span>
          </div>
        </div>
      </div>

      <MapToolbar
        zoom={zoom}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onFit={fitMap}
        expanded={expanded}
        onToggleExpand={() =>
          setExpanded((current) => !current)
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
                onClick={() =>
                  setSelectedRobotId(robot.id)
                }
              >
                <div>
                  <strong>{robot.id}</strong>
                  <span>{robot.task}</span>
                </div>

                <span
                  className={`monitor-status ${robot.status.toLowerCase()}`}
                >
                  {robot.status}
                </span>
              </button>
            ))}
          </aside>
        )}

        <section className="panel map-main-panel">
          <div className="panel-header">
            <h3>Live Warehouse Map</h3>
            <span>{MOCK_ROBOTS.length} robots</span>
          </div>

          <MapCanvas
            mapData={mapData}
            mode="monitor"
            tool="select"
            selectedNodeId={null}
            selectedEdgeId={null}
            boundarySelected={false}
            connectionStart={null}
            robots={MOCK_ROBOTS}
            selectedRobotId={selectedRobotId}
            onRobotClick={setSelectedRobotId}
            zoom={zoom}
            onZoomChange={setZoom}
            fitRequest={fitRequest}
            onCanvasClick={() => setSelectedRobotId(null)}
            onNodeClick={() => {}}
            onNodeMove={() => {}}
            onNodeDragStart={() => {}}
            onNodeDragEnd={() => {}}
            onEdgeClick={() => {}}
            onBoundaryClick={() => {}}
            onBoundaryDragStart={() => {}}
            onBoundaryChange={() => {}}
            onBoundaryDragEnd={() => {}}
          />
        </section>

        {!expanded && (
          <MonitorPanel robot={selectedRobot} />
        )}
      </div>
    </div>
  );
}

function loadMonitorMap() {
  try {
    const savedLibrary = localStorage.getItem(
      MAP_LIBRARY_KEY
    );

    if (savedLibrary) {
      const parsed = JSON.parse(savedLibrary);
      const maps = parsed?.maps;
      const activeMapId = parsed?.activeMapId;

      if (
        maps &&
        typeof maps === "object" &&
        maps[activeMapId]
      ) {
        return cloneMap(maps[activeMapId]);
      }

      const firstMap = maps
        ? Object.values(maps)[0]
        : null;

      if (isUsableMap(firstMap)) {
        return cloneMap(firstMap);
      }
    }
  } catch (error) {
    console.warn(
      "Could not load warehouse map library for monitor mode.",
      error
    );
  }

  for (const key of LEGACY_KEYS) {
    try {
      const saved = localStorage.getItem(key);
      if (!saved) continue;

      const parsed = JSON.parse(saved);
      if (isUsableMap(parsed)) {
        return cloneMap(parsed);
      }
    } catch (error) {
      console.warn(
        `Could not load legacy map ${key}.`,
        error
      );
    }
  }

  return cloneMap(INITIAL_MAP);
}

function isUsableMap(map) {
  return Boolean(
    map &&
      Array.isArray(map.nodes) &&
      Array.isArray(map.edges) &&
      Number(map.width) > 0 &&
      Number(map.height) > 0
  );
}

function cloneMap(map) {
  if (typeof structuredClone === "function") {
    return structuredClone(map);
  }

  return JSON.parse(JSON.stringify(map));
}
