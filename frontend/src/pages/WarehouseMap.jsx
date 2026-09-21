import { createOutboundReservation } from "../utils/warehouseOperations";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Boxes,
  CheckCircle2,
  CircleDot,
  Layers3,
  Package,
  RefreshCw,
  Search,
  Warehouse,
  X,
} from "lucide-react";

import BasketDetails from "../components/BasketDetails";
import MonitorRcsDispatch from "../components/MonitorRcsDispatch";
import RackShelfSettings from "../components/RackShelfSettings";

import LoadTypeVisual, {
  getLoadInfo,
} from "../components/LoadTypeVisual";

import {
  rackShelfCount,
  rackDepthCount,
  rackSlots,
  shelfDepth,
  resizeRack,
} from "../utils/rackStructure";

import {
  basketOf,
  assertEditable,
  readMonitor,
  shelvesOf,
} from "../utils/basketStore";

import "../styles/RackMonitor.css";

const MONITOR_STORAGE_KEY = "wms-monitor-master-v2";

const LEGACY_MONITOR_STORAGE_KEYS = [
  "wms-monitor-master-v1",
];

const CURRENT_LAYOUT_VERSION = 5;
const SHELF_COUNT = 8;

const DEFAULT_SKUS = [
  {
    sku: "SKU-001",
    name: "Plastic Bin 600x400",
    category: "Container",
    unit: "PCS",
  },
  {
    sku: "SKU-002",
    name: "Carton Box M",
    category: "Packaging",
    unit: "PCS",
  },
  {
    sku: "SKU-003",
    name: "Pallet 1100x1100",
    category: "Pallet",
    unit: "PCS",
  },
];

// Convert reference-image positions to percentages on the WMS map.
// These positions are for display only.
function mapPosition(x, y) {
  return {
    left: (x / 894) * 100,
    top: ((y + 28) / 809) * 100,
  };
}

const DEFAULT_RACK_LAYOUT = [
  // Existing storage: left column
  {
    id: "A01",
    zone: "ZONE-A",
    ...mapPosition(463, 32),
  },
  {
    id: "A03",
    zone: "ZONE-A",
    ...mapPosition(463, 66),
  },
  {
    id: "A05",
    zone: "ZONE-A",
    ...mapPosition(463, 100),
  },
  {
    id: "A07",
    zone: "ZONE-A",
    ...mapPosition(463, 135),
  },

  // Existing storage: middle column
  {
    id: "A02",
    zone: "ZONE-A",
    ...mapPosition(533, 32),
  },
  {
    id: "A04",
    zone: "ZONE-A",
    ...mapPosition(533, 66),
  },
  {
    id: "A06",
    zone: "ZONE-A",
    ...mapPosition(533, 100),
  },
  {
    id: "A08",
    zone: "ZONE-A",
    ...mapPosition(533, 135),
  },

  // Existing storage: right column
  {
    id: "B01",
    zone: "ZONE-B",
    ...mapPosition(644, 70),
  },
  {
    id: "B02",
    zone: "ZONE-B",
    ...mapPosition(644, 102),
  },
  {
    id: "B03",
    zone: "ZONE-B",
    ...mapPosition(644, 135),
  },

  // Existing storage below the main group
  {
    id: "C01",
    zone: "ZONE-C",
    ...mapPosition(533, 322),
  },

  // Added storage: two positions on the left
  {
    id: "D01",
    zone: "ZONE-D",
    ...mapPosition(204, 66),
  },
  {
    id: "D02",
    zone: "ZONE-D",
    ...mapPosition(282, 66),
  },

  // Added storage: purple square positions
  {
    id: "E01",
    zone: "ZONE-E",
    ...mapPosition(181, 269),
  },
  {
    id: "E02",
    zone: "ZONE-E",
    ...mapPosition(136, 463),
  },
  {
    id: "E03",
    zone: "ZONE-E",
    ...mapPosition(805, 390),
  },

  // Added storage: blue arrow position
  {
    id: "F01",
    zone: "ZONE-F",
    ...mapPosition(507, 374),
  },
  {
    id: "F02",
    zone: "ZONE-F",
    ...mapPosition(746, 322),
  },
];

const DEFAULT_WAYPOINTS = [
  // Main vertical route
  { id: "WP-L1", ...mapPosition(498, 32) },
  { id: "WP-L2", ...mapPosition(498, 66) },
  { id: "WP-L3", ...mapPosition(498, 100) },
  { id: "WP-L4", ...mapPosition(498, 135) },
  { id: "WP-L5", ...mapPosition(498, 167) },
  { id: "WP-L6", ...mapPosition(498, 232) },
  { id: "WP-L7", ...mapPosition(498, 278) },
  { id: "WP-L8", ...mapPosition(498, 322) },

  // Upper-right route
  { id: "WP-R1", ...mapPosition(608, 70) },
  { id: "WP-R2", ...mapPosition(608, 102) },
  { id: "WP-R3", ...mapPosition(608, 135) },
  { id: "WP-R4", ...mapPosition(608, 167) },
  { id: "WP-R5", ...mapPosition(608, 232) },

  // Connection between the upper routes
  { id: "WP-M1", ...mapPosition(548, 232) },
  { id: "WP-RIGHT", ...mapPosition(658, 232) },

  // Left-side route
  { id: "WP-D1", ...mapPosition(204, 184) },
  { id: "WP-D2", ...mapPosition(282, 184) },
  { id: "WP-D3", ...mapPosition(181, 184) },
  { id: "WP-D4", ...mapPosition(181, 269) },

  // Bottom route
  { id: "WP-E1", ...mapPosition(302, 463) },
  { id: "WP-E2", ...mapPosition(390, 463) },
  { id: "WP-E3", ...mapPosition(478, 463) },
  { id: "WP-E4", ...mapPosition(593, 463) },
  { id: "WP-E5", ...mapPosition(593, 390) },
  { id: "WP-E6", ...mapPosition(659, 390) },

  // Route near the blue arrow
  { id: "WP-F1", ...mapPosition(586, 374) },
  { id: "WP-F2", ...mapPosition(630, 374) },
  { id: "WP-F3", ...mapPosition(630, 322) },
  { id: "WP-F4", ...mapPosition(674, 322) },
];

const DEFAULT_ROUTE_EDGES = [
  // Main vertical route
  ["WP-L1", "WP-L2"],
  ["WP-L2", "WP-L3"],
  ["WP-L3", "WP-L4"],
  ["WP-L4", "WP-L5"],
  ["WP-L5", "WP-L6"],
  ["WP-L6", "WP-L7"],
  ["WP-L7", "WP-L8"],

  // Upper-right route
  ["WP-R1", "WP-R2"],
  ["WP-R2", "WP-R3"],
  ["WP-R3", "WP-R4"],
  ["WP-R4", "WP-R5"],

  // Upper horizontal connection
  ["WP-L6", "WP-M1"],
  ["WP-M1", "WP-R5"],
  ["WP-R5", "WP-RIGHT"],

  // Left-side route
  ["WP-D3", "WP-D1"],
  ["WP-D1", "WP-D2"],
  ["WP-D3", "WP-D4"],

  // Bottom route
  ["WP-E1", "WP-E2"],
  ["WP-E2", "WP-E3"],
  ["WP-E3", "WP-E4"],
  ["WP-E4", "WP-E5"],
  ["WP-E5", "WP-E6"],

  // Route near the blue arrow
  ["WP-F1", "WP-F2"],
  ["WP-F2", "WP-F3"],
  ["WP-F3", "WP-F4"],
];

const DEFAULT_STORAGE_LINKS = [
  // Existing storage
  ["A01", "WP-L1"],
  ["A02", "WP-L1"],
  ["A03", "WP-L2"],
  ["A04", "WP-L2"],
  ["A05", "WP-L3"],
  ["A06", "WP-L3"],
  ["A07", "WP-L4"],
  ["A08", "WP-L4"],

  ["B01", "WP-R1"],
  ["B02", "WP-R2"],
  ["B03", "WP-R3"],

  ["C01", "WP-L8"],

  // Added storage
  ["D01", "WP-D1"],
  ["D02", "WP-D2"],
  ["E01", "WP-D4"],
  ["E02", "WP-E1"],
  ["E03", "WP-E6"],
  ["F01", "WP-F1"],
  ["F02", "WP-F4"],
];

export default function WarehouseMap() {
  const [monitorData, setMonitorData] = useState(
    loadMonitorData,
  );

  const [selectedRackId, setSelectedRackId] = useState(
    () => loadMonitorData().racks[0]?.id || "",
  );

  const [selectedShelfRef, setSelectedShelfRef] = useState(null);

  const [search, setSearch] = useState("");
  const [zoneFilter, setZoneFilter] = useState("ALL");

  function saveAndSet(nextData) {
    const normalized = normalizeMonitorData(nextData);

    localStorage.setItem(
      MONITOR_STORAGE_KEY,
      JSON.stringify(normalized),
    );

    setMonitorData(normalized);

    window.dispatchEvent(
      new CustomEvent("wms-monitor-data-changed", {
        detail: {
          source: "warehouse-monitor",
        },
      }),
    );
  }

  function refreshData() {
    setMonitorData(loadMonitorData());
  }

  useEffect(() => {
    function handleStorage(event) {
      if (event.key === MONITOR_STORAGE_KEY) {
        refreshData();
      }
    }

    window.addEventListener(
      "wms-monitor-data-changed",
      refreshData,
    );

    window.addEventListener("focus", refreshData);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener(
        "wms-monitor-data-changed",
        refreshData,
      );

      window.removeEventListener("focus", refreshData);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const zones = useMemo(
    () =>
      Array.from(
        new Set(
          monitorData.racks.map((rack) => rack.zone),
        ),
      ).sort(),
    [monitorData.racks],
  );

  const visibleRackIds = useMemo(() => {
    const query = search.trim().toLowerCase();

    return new Set(
      monitorData.racks
        .filter((rack) => {
          if (
            zoneFilter !== "ALL" &&
            rack.zone !== zoneFilter
          ) {
            return false;
          }

          if (!query) {
            return true;
          }

          return [
            rack.id,
            rack.name,
            rack.zone,

            ...rack.shelves.flatMap((shelf) => [
              shelf.code,
              shelf.status,

              ...shelf.inventory.flatMap((item) => [
                item.sku,
                item.name,
                item.category,
              ]),
            ]),
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(query);
        })
        .map((rack) => rack.id),
    );
  }, [monitorData.racks, search, zoneFilter]);

  const selectedRack =
    monitorData.racks.find(
      (rack) => rack.id === selectedRackId,
    ) ||
    monitorData.racks[0] ||
    null;

  const selectedShelf = selectedShelfRef
    ? monitorData.racks
        .find(
          (rack) =>
            rack.id === selectedShelfRef.rackId,
        )
        ?.shelves.find(
          (shelf) =>
            shelf.id === selectedShelfRef.shelfId,
        ) || null
    : null;

  const selectedShelfRack = selectedShelfRef
    ? monitorData.racks.find(
        (rack) =>
          rack.id === selectedShelfRef.rackId,
      ) || null
    : null;

  const allShelves = monitorData.racks.flatMap(
    (rack) => rack.shelves,
  );

  const occupiedShelves = allShelves.filter(
    (shelf) => Boolean(basketOf(shelf)),
  ).length;

  const totalQty = allShelves.reduce(
    (sum, shelf) =>
      sum +
      shelf.inventory.reduce(
        (itemSum, item) =>
          itemSum + Number(item.quantity || 0),
        0,
      ),
    0,
  );

  if (monitorData.loadError) {
    return (
      <div className="rack-monitor-page" role="alert">
        <h2>Monitor data cannot be loaded</h2>

        <p>{monitorData.loadError}</p>

        <p>
          Stored data has not been deleted.
          Check or restore the saved data before continuing.
        </p>

        <button type="button" onClick={refreshData}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="rack-monitor-page">
      <MonitorRcsDispatch />

      <div className="rack-monitor-header">
        <div>
          <span className="rack-monitor-label">
            WAREHOUSE MONITOR
          </span>

          <h2>Warehouse Floor &amp; Rack Monitor</h2>

          <p>
              Monitor is the master source for rack positions,
              rack-specific shelf data and basket contents.
              Inventory follows this structure.
          </p>
        </div>

        <button
          type="button"
          className="rack-refresh-button"
          onClick={refreshData}
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      <div className="rack-summary-grid">
        <SummaryCard
          icon={<Warehouse size={20} />}
          title="Storage Racks"
          value={monitorData.racks.length}
        />

        <SummaryCard
          icon={<Layers3 size={20} />}
          title="Storage Positions"
          value={allShelves.length}
        />

        <SummaryCard
          icon={<CheckCircle2 size={20} />}
          title="Occupied Shelves"
          value={occupiedShelves}
        />

        <SummaryCard
          icon={<Boxes size={20} />}
          title="Monitor Stock Qty"
          value={totalQty}
        />
      </div>

      <section className="warehouse-floor-panel">
        <div className="warehouse-floor-toolbar">
          <div>
            <h3>Warehouse Layout</h3>

            <p>
              Select a rack to view its shelves and basket contents.
            </p>
          </div>

          <div className="warehouse-floor-filters">
            <div className="rack-search-box">
              <Search size={16} />

              <input
                type="text"
                placeholder="Search rack, shelf or SKU..."
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
              />
            </div>

            <select
              value={zoneFilter}
              onChange={(event) =>
                setZoneFilter(event.target.value)
              }
            >
              <option value="ALL">All Zones</option>

              {zones.map((zone) => (
                <option key={zone} value={zone}>
                  {zone}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="warehouse-monitor-layout">
          <WarehouseFloorPlan
            racks={monitorData.racks}
            waypoints={monitorData.waypoints}
            routeEdges={monitorData.routeEdges}
            storageLinks={monitorData.storageLinks}
            visibleRackIds={visibleRackIds}
            selectedRackId={selectedRackId}
            onSelectRack={setSelectedRackId}
          />

          <RackFrontPanel
            rack={selectedRack}
            onResizeRack={(rackId, count, depth, loadType) =>
              saveAndSet(
                resizeRack(
                  readMonitor(),
                  rackId,
                  count,
                  depth,
                  loadType,
                ),
              )
            }
            onShelfClick={(shelf) =>
              setSelectedShelfRef({
                rackId: selectedRack.id,
                shelfId: shelf.id,
              })
            }
          />
        </div>

        <div className="warehouse-map-legend">
          <span>
            <i className="floor-legend rack" />
            Storage Rack
          </span>

          <span>
            <i className="floor-legend node" />
            Waypoint
          </span>

          <span>
            <i className="floor-legend route" />
            Route Connection
          </span>
        </div>
      </section>

      {selectedShelf && selectedShelfRack && (
        <ShelfInventoryModal
          rack={selectedShelfRack}
          shelf={selectedShelf}
          skuCatalog={monitorData.skuCatalog}
          onClose={() => setSelectedShelfRef(null)}
          onSaveShelf={(patch) => {
            assertEditable(selectedShelf.id);

            const latest = readMonitor();

            if (
              patch.basket &&
              shelvesOf(latest).some(
                (shelf) =>
                  shelf.id !== selectedShelf.id &&
                  shelf.basket?.id === patch.basket.id,
              )
            ) {
              throw new Error("Load ID already exists.");
            }

            if (
              patch.code &&
              shelvesOf(latest).some(
                (shelf) =>
                  shelf.id !== selectedShelf.id &&
                  shelf.code === patch.code,
              )
            ) {
              throw new Error("Location code already exists.");
            }

            saveAndSet(
              updateShelf(
                latest,
                selectedShelfRack.id,
                selectedShelf.id,
                (current) => ({
                  ...current,
                  ...patch,
                }),
              ),
            );
          }}
          onInbound={(payload) => {
            assertEditable(selectedShelf.id);

            saveAndSet(
              applyInbound(
                readMonitor(),
                selectedShelfRack.id,
                selectedShelf.id,
                payload,
              ),
            );
          }}
          onOutbound={(payload) => {
            assertEditable(selectedShelf.id);

            saveAndSet(
              applyOutboundReservation(
                readMonitor(),
                selectedShelfRack.id,
                selectedShelf.id,
                payload,
              ),
            );
          }}
          onDeduct={(payload) => {
            assertEditable(selectedShelf.id);

            saveAndSet(
              applyDeductStock(
                readMonitor(),
                selectedShelfRack.id,
                selectedShelf.id,
                payload,
              ),
            );
          }}
        />
      )}
    </div>
  );
}

function SummaryCard({ icon, title, value }) {
  return (
    <div className="rack-summary-card">
      <div className="rack-summary-icon">
        {icon}
      </div>

      <div>
        <span>{title}</span>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

function WarehouseFloorPlan({
  racks,
  waypoints,
  routeEdges,
  storageLinks,
  visibleRackIds,
  selectedRackId,
  onSelectRack,
}) {
  const MAP_WIDTH = 2682;
  const MAP_HEIGHT = 2000;

  const MIN_ZOOM = 0.25;
  const MAX_ZOOM = 3;

  const viewportRef = useRef(null);
  const dragRef = useRef(null);

  const cameraRef = useRef({
    x: 0,
    y: 0,
    zoom: 1,
  });

  const [camera, setCamera] = useState(
    cameraRef.current,
  );

  const [dragging, setDragging] = useState(false);

  const waypointMap = useMemo(
    () =>
      new Map(
        waypoints.map((point) => [
          point.id,
          point,
        ]),
      ),
    [waypoints],
  );

  function updateCamera(next) {
    cameraRef.current = next;
    setCamera(next);
  }

  function resetView() {
    const viewport = viewportRef.current;

    if (!viewport) {
      return;
    }

    const zoom = Math.max(
      MIN_ZOOM,
      Math.min(
        1,
        (viewport.clientWidth - 32) / MAP_WIDTH,
      ),
    );

    updateCamera({
      x:
        (viewport.clientWidth -
          MAP_WIDTH * zoom) / 2,
      y: 16,
      zoom,
    });
  }

  function zoomAt(value, pointerX, pointerY) {
    const current = cameraRef.current;

    const zoom = Math.max(
      MIN_ZOOM,
      Math.min(MAX_ZOOM, value),
    );

    const ratio = zoom / current.zoom;

    updateCamera({
      x:
        pointerX -
        (pointerX - current.x) * ratio,
      y:
        pointerY -
        (pointerY - current.y) * ratio,
      zoom,
    });
  }

  function zoomFromButton(factor) {
    const viewport = viewportRef.current;

    if (!viewport) {
      return;
    }

    zoomAt(
      cameraRef.current.zoom * factor,
      viewport.clientWidth / 2,
      viewport.clientHeight / 2,
    );
  }

  useEffect(() => {
    resetView();

    const viewport = viewportRef.current;

    function handleWheel(event) {
      event.preventDefault();

      if (dragRef.current) {
        return;
      }

      const bounds = viewport.getBoundingClientRect();

      const unit =
        event.deltaMode === 1
          ? 16
          : event.deltaMode === 2
            ? viewport.clientHeight
            : 1;

      const delta = Math.max(
        -200,
        Math.min(200, event.deltaY * unit),
      );

      zoomAt(
        cameraRef.current.zoom *
          Math.exp(-delta * 0.002),

        event.clientX -
          bounds.left -
          viewport.clientLeft,

        event.clientY -
          bounds.top -
          viewport.clientTop,
      );
    }

    viewport.addEventListener(
      "wheel",
      handleWheel,
      { passive: false },
    );

    return () => {
      viewport.removeEventListener(
        "wheel",
        handleWheel,
      );
    };
  }, []);

  function startDrag(event) {
    if (
      event.button !== 0 ||
      dragRef.current
    ) {
      return;
    }

    if (
      event.target.closest(
        "button, input, select, textarea, a",
      )
    ) {
      return;
    }

    event.preventDefault();

    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      cameraX: cameraRef.current.x,
      cameraY: cameraRef.current.y,
    };

    event.currentTarget.setPointerCapture(
      event.pointerId,
    );

    setDragging(true);
  }

  function moveDrag(event) {
    const drag = dragRef.current;

    if (
      !drag ||
      drag.pointerId !== event.pointerId
    ) {
      return;
    }

    updateCamera({
      ...cameraRef.current,
      x:
        drag.cameraX +
        event.clientX -
        drag.startX,
      y:
        drag.cameraY +
        event.clientY -
        drag.startY,
    });
  }

  function stopDrag(event) {
    if (
      dragRef.current?.pointerId !==
      event.pointerId
    ) {
      return;
    }

    dragRef.current = null;
    setDragging(false);

    if (
      event.currentTarget.hasPointerCapture(
        event.pointerId,
      )
    ) {
      event.currentTarget.releasePointerCapture(
        event.pointerId,
      );
    }
  }

  return (
    <div
      style={{
        minWidth: 0,
        background: "#0a1626",
      }}
    >
      <div
        role="group"
        aria-label="Map zoom"
        style={{
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
          padding: "12px 18px",
          color: "#e2e8f0",
        }}
      >
        <button
          type="button"
          aria-label="Zoom out"
          disabled={camera.zoom <= MIN_ZOOM}
          onClick={() =>
            zoomFromButton(1 / 1.2)
          }
        >
          −
        </button>

        <output>
          {Math.round(camera.zoom * 100)}%
        </output>

        <button
          type="button"
          aria-label="Zoom in"
          disabled={camera.zoom >= MAX_ZOOM}
          onClick={() =>
            zoomFromButton(1.2)
          }
        >
          +
        </button>

        <button
          type="button"
          onClick={resetView}
        >
          Reset
        </button>

        <span style={{ fontSize: 12 }}>
          Scroll to zoom · Drag empty space to pan
        </span>
      </div>

      <div
        ref={viewportRef}
        className="warehouse-floor-stage-wrap"
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={stopDrag}
        onPointerCancel={stopDrag}
        onLostPointerCapture={stopDrag}
        style={{
          position: "relative",
          display: "block",
          height: "clamp(400px, 70vh, 800px)",
          padding: 0,
          overflow: "hidden",
          boxSizing: "border-box",
          background: "#cbd5e1",
          cursor: dragging ? "grabbing" : "grab",
          touchAction: "none",
          userSelect: "none",
        }}
      >
        <div
          className="warehouse-floor-stage"
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: MAP_WIDTH,
            minWidth: 0,
            height: MAP_HEIGHT,
            margin: 0,
            boxSizing: "border-box",
            transformOrigin: "0 0",
            transform:
              `translate(${camera.x}px, ${camera.y}px) ` +
              `scale(${camera.zoom})`,
          }}
        >
          <div
            className="floor-route-layer"
            aria-hidden="true"
          >
            {routeEdges.map(([fromId, toId]) => {
              const from = waypointMap.get(fromId);
              const to = waypointMap.get(toId);

              if (!from || !to) {
                return null;
              }

              return (
                <FloorRoute
                  key={`${fromId}-${toId}`}
                  from={from}
                  to={to}
                />
              );
            })}
          </div>

          <StorageWaypointLinks
            racks={racks}
            waypointMap={waypointMap}
            storageLinks={storageLinks}
          />

          {waypoints.map((waypoint) => (
            <FloorNode
              key={waypoint.id}
              waypoint={waypoint}
            />
          ))}

          {racks.map((rack) => (
            <FloorRack
              key={rack.id}
              rack={rack}
              visible={visibleRackIds.has(rack.id)}
              active={selectedRackId === rack.id}
              onClick={() => onSelectRack(rack.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function StorageWaypointLinks({
  racks,
  waypointMap,
  storageLinks,
}) {
  const rackMap = useMemo(
    () =>
      new Map(
        racks.map((rack) => [
          rack.id,
          rack,
        ]),
      ),
    [racks],
  );

  return (
    <div
      className="floor-route-layer"
      aria-hidden="true"
    >
      {storageLinks.map(([rackId, waypointId]) => {
        const rack = rackMap.get(rackId);
        const waypoint = waypointMap.get(waypointId);

        if (!rack || !waypoint) {
          return null;
        }

        return (
          <FloorRoute
            key={`${rackId}-${waypointId}`}
            from={{
              left: rack.left,
              top: rack.top,
            }}
            to={waypoint}
          />
        );
      })}
    </div>
  );
}
function FloorRoute({ from, to }) {
  const sameRow =
    Math.abs(from.top - to.top) < 0.05;

  const sameColumn =
    Math.abs(from.left - to.left) < 0.05;

  if (sameRow) {
    return (
      <div
        className="floor-route-line horizontal"
        style={{
          left: `${Math.min(from.left, to.left)}%`,
          top: `${from.top}%`,
          width: `${Math.abs(to.left - from.left)}%`,
        }}
      />
    );
  }

  if (sameColumn) {
    return (
      <div
        className="floor-route-line vertical"
        style={{
          left: `${from.left}%`,
          top: `${Math.min(from.top, to.top)}%`,
          height: `${Math.abs(to.top - from.top)}%`,
        }}
      />
    );
  }

  return null;
}

function FloorNode({ waypoint }) {
  return (
    <div
      className="floor-route-node"
      style={{
        left: `${waypoint.left}%`,
        top: `${waypoint.top}%`,
      }}
      title={waypoint.id}
    />
  );
}

function FloorRack({
  rack,
  visible,
  active,
  onClick,
}) {
  const occupied = rack.shelves.filter(
    (shelf) => Boolean(basketOf(shelf)),
  ).length;

  return (
    <button
      type="button"
      className={
        `floor-storage-rack ` +
        `${active ? "active" : ""} ` +
        `${visible ? "" : "filtered-out"}`
      }
      style={{
        left: `${rack.left}%`,
        top: `${rack.top}%`,
      }}
      onClick={onClick}
      title={`${rack.id} · ${rack.zone}`}
    >
      <span className="floor-rack-label">
        {rack.id}
      </span>

      <div className="floor-rack-body">
        {Array.from({
          length: Math.min(8, rack.shelves.length),
        }).map((_, index) => (
          <i key={index} />
        ))}
      </div>

      <small>
        {occupied}/{rack.shelves.length} occupied
      </small>
    </button>
  );
}

function RackFrontPanel({
  rack,
  onShelfClick,
  onResizeRack,
}) {
  const [selectedDepth, setSelectedDepth] = useState(1);

  const info = getLoadInfo(rack?.loadType);
  const isBasket = info.type === "BASKET";
  const depthCount = rack ? rackDepthCount(rack) : 1;
  const activeDepth = Math.min(selectedDepth, depthCount);

  useEffect(() => {
    setSelectedDepth(1);
  }, [rack?.id]);

  if (!rack) {
    return (
      <aside className="rack-front-side-panel empty">
        <Warehouse size={30} />
        <strong>Select a storage location</strong>
        <span>Storage details will appear here.</span>
      </aside>
    );
  }

  const locations = rack.shelves
    .filter((item) => shelfDepth(item) === activeDepth)
    .sort((a, b) =>
      isBasket
        ? Number(b.level) - Number(a.level)
        : Number(a.level) - Number(b.level),
    );

  const totalQty = locations.reduce(
    (sum, location) =>
      sum +
      (location.inventory || []).reduce(
        (itemSum, item) => itemSum + Number(item.quantity || 0),
        0,
      ),
    0,
  );

  function renderLocation(location) {
    const inventory = location.inventory || [];
    const load = basketOf(location);
    const state = getShelfState(location);

    const qty = inventory.reduce(
      (sum, item) => sum + Number(item.quantity || 0),
      0,
    );

    const firstItem = inventory.find(
      (item) => Number(item.quantity || 0) > 0,
    );

    return (
      <button
        type="button"
        className={`rack-five-block load-location-card ${state}`}
        onClick={() => onShelfClick(location)}
      >
        {!isBasket && <LoadTypeVisual type={info.type} />}

        <strong>
          {location.code || "Set RCS location code"}
        </strong>

        <span>
          {firstItem
            ? `${firstItem.sku} · ${firstItem.name}`
            : "No products"}
        </span>

        <small>
          {load ? `${info.label} present` : `No ${info.label.toLowerCase()}`}
          {" · "}
          {qty} items
        </small>
      </button>
    );
  }

  return (
    <aside className="rack-front-side-panel">
      <div className="rack-side-header">
        <div>
          <span>{rack.zone}</span>
          <h3>{info.label} storage · {rack.id}</h3>

          <p>
            {isBasket
              ? `${rackShelfCount(rack)} shelf levels`
              : info.type === "RACK"
                ? "Whole-rack pickup"
                : `${locations.length} storage positions per depth`}
            {" · "}
            {depthCount} {depthCount === 1 ? "depth" : "depths"}
          </p>
        </div>

        <div className="rack-side-total">
          <strong>{totalQty}</strong>
          <span>stock qty</span>
        </div>
      </div>

      <RackShelfSettings rack={rack} onSave={onResizeRack} />

      <div
        className="overview-actions"
        role="group"
        aria-label="Storage depth"
      >
        {Array.from(
          { length: depthCount },
          (_, index) => index + 1,
        ).map((depth) => (
          <button
            type="button"
            key={depth}
            aria-pressed={activeDepth === depth}
            onClick={() => setSelectedDepth(depth)}
          >
            Depth {depth}
          </button>
        ))}
      </div>

      {isBasket ? (
        <div className="rack-five-shelf-frame">
          <div className="rack-five-upright left" />
          <div className="rack-five-upright right" />

          {locations.map((location) => (
            <div className="rack-five-level" key={location.id}>
              <div className="rack-five-level-label">
                Level {location.level}
              </div>

              <div className="rack-five-level-blocks">
                {renderLocation(location)}
              </div>
            </div>
          ))}

          <div className="rack-five-base" />
        </div>
      ) : (
        <div className="load-position-grid">
          {locations.map((location) => (
            <div className="load-position-item" key={location.id}>
              <span className="load-position-label">
                {info.location}
                {locations.length > 1 ? ` ${location.level}` : ""}
              </span>

              {renderLocation(location)}
            </div>
          ))}
        </div>
      )}

      <div className="rack-side-legend">
        <span><i className="legend-dot empty" />Empty</span>
        <span><i className="legend-dot occupied" />Occupied</span>
        <span><i className="legend-dot blocked" />Blocked</span>
      </div>

      <div className="rack-side-hint">
        <CircleDot size={14} />
        <span>
          Click a {info.location.toLowerCase()} to view products,
          edit location details and prepare an operation.
        </span>
      </div>
    </aside>
  );
}

function ShelfInventoryModal({
  rack,
  shelf,
  skuCatalog,
  onClose,
  onSaveShelf,
  onInbound,
  onOutbound,
  onDeduct,
}) {
  const info = getLoadInfo(rack.loadType);
  const isBasket = info.type === "BASKET";

  const [mode, setMode] = useState("INBOUND");

  const [selectedItemId, setSelectedItemId] = useState(
    shelf.inventory[0]?.id || "",
  );

  const [sku, setSku] = useState(
    shelf.inventory[0]?.sku ||
      skuCatalog[0]?.sku ||
      "",
  );

  const [itemName, setItemName] = useState(
    shelf.inventory[0]?.name ||
      skuCatalog[0]?.name ||
      "",
  );

  const [unit, setUnit] = useState(
    shelf.inventory[0]?.unit ||
      skuCatalog[0]?.unit ||
      "PCS",
  );

  const [category, setCategory] = useState(
    shelf.inventory[0]?.category ||
      skuCatalog[0]?.category ||
      "General",
  );

  const [quantity, setQuantity] = useState("");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");

  const [codeDraft, setCodeDraft] = useState(shelf.code);
  const [statusDraft, setStatusDraft] = useState(shelf.status);

  useEffect(() => {
    setSelectedItemId(
      shelf.inventory[0]?.id || "",
    );

    setSku(
      shelf.inventory[0]?.sku ||
        skuCatalog[0]?.sku ||
        "",
    );

    setItemName(
      shelf.inventory[0]?.name ||
        skuCatalog[0]?.name ||
        "",
    );

    setUnit(
      shelf.inventory[0]?.unit ||
        skuCatalog[0]?.unit ||
        "PCS",
    );

    setCategory(
      shelf.inventory[0]?.category ||
        skuCatalog[0]?.category ||
        "General",
    );

    setQuantity("");
    setReference("");
    setNote("");
    setMessage("");

    setCodeDraft(shelf.code);
    setStatusDraft(shelf.status);
  }, [shelf.id, rack.id]);

  const totalQty = shelf.inventory.reduce(
    (sum, item) =>
      sum + Number(item.quantity || 0),
    0,
  );

  const selectedItem = shelf.inventory.find(
    (item) => item.id === selectedItemId,
  );

  const reservedQty = Number(
    selectedItem?.reserved || 0,
  );

  const freeQty = selectedItem
    ? Math.max(
        0,
        Number(selectedItem.quantity || 0) -
          reservedQty,
      )
    : 0;

  const operationsDisabled = [
    "BLOCKED",
    "MAINTENANCE",
  ].includes(
    String(shelf.status || "").toUpperCase(),
  );

  function handleSkuChange(nextSku) {
    setSku(nextSku);

    const master = skuCatalog.find(
      (item) => item.sku === nextSku,
    );

    if (master) {
      setItemName(master.name || "");
      setUnit(master.unit || "PCS");
      setCategory(master.category || "General");
    }
  }

  function submitOperation() {
    setMessage("");

    const qty = Number(quantity);

    if (
      !Number.isFinite(qty) ||
      qty <= 0
    ) {
      setMessage(
        "Quantity must be greater than 0.",
      );

      return;
    }

    try {
      if (mode === "INBOUND") {
        if (!sku.trim()) {
          setMessage("Enter an SKU.");
          return;
        }

        onInbound({
          sku: sku.trim(),
          name: itemName.trim() || sku.trim(),
          unit: unit.trim() || "PCS",
          category: category.trim() || "General",
          quantity: qty,
          reference: reference.trim(),
          note: note.trim(),
        });

        setMessage(
          `Inbound +${qty} saved in Monitor.`,
        );
      } else if (mode === "OUTBOUND") {
        if (!selectedItem) {
          setMessage(
            "Select an inventory record first.",
          );

          return;
        }

        if (qty > freeQty) {
          setMessage(
            `Only ${freeQty} free stock is available.`,
          );

          return;
        }

        onOutbound({
          itemId: selectedItem.id,
          quantity: qty,
          reference: reference.trim(),
          note: note.trim(),
        });

        setMessage(
          `Outbound reservation ${qty} saved in Monitor.`,
        );
      } else {
        if (!selectedItem) {
          setMessage(
            "Select an inventory record first.",
          );

          return;
        }

        if (qty > freeQty) {
          setMessage(
            `Only ${freeQty} free stock can be deducted.`,
          );

          return;
        }

        onDeduct({
          itemId: selectedItem.id,
          quantity: qty,
          reference: reference.trim(),
          note: note.trim(),
        });

        setMessage(
          `Direct deduction ${qty} saved in Monitor.`,
        );
      }

      setQuantity("");
    } catch (error) {
      setMessage(
        error.message || "Operation failed.",
      );
    }
  }

  function saveShelfData() {
    if (!codeDraft.trim()) {
      setMessage(
        "Location Code is required.",
      );

      return;
    }

    try {
      onSaveShelf({
        code: codeDraft.trim(),
        capacity: 1,
        status: statusDraft,
      });

      setMessage(
        `${info.location} data saved in Monitor.`,
      );
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <div
      className="rack-location-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="rack-location-modal">
        <div className="rack-location-modal-header">
          <div>
            <span>
              {rack.zone}
              {" · "}
              {info.label.toUpperCase()}
              {" · STORAGE "}
              {rack.id}
              {isBasket && (
                <>
                  {" · LEVEL "}
                  {shelf.level}
                </>
              )}
              {" · DEPTH "}
              {shelfDepth(shelf)}
            </span>

            <h3>{shelf.code}</h3>
          </div>

          <button
            type="button"
            className="rack-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={19} />
          </button>
        </div>

        <div className="overview-actions">
          {["source", "destination"].map((role) => (
            <button
              key={role}
              type="button"
              disabled={!shelf.code}
              onClick={() => {
                window.dispatchEvent(
                  new CustomEvent("wms-transfer-select", {
                    detail: {
                      role,
                      shelfId: shelf.id,
                    },
                  }),
                );

                onClose();

                requestAnimationFrame(() => {
                  document
                    .getElementById("monitor-transfer-form")
                    ?.scrollIntoView({
                      behavior: "smooth",
                      block: "start",
                    });
                });
              }}
            >
              Use as {role}
            </button>
          ))}
        </div>

        <div className="rack-location-overview">
          <div>
            <span>Status</span>
            <strong>{shelf.status}</strong>
          </div>

          <div>
            <span>{info.plural}</span>
            <strong>
              {basketOf(shelf) ? 1 : 0}/1
            </strong>
          </div>

          <div>
            <span>Inventory Records</span>
            <strong>
              {shelf.inventory.length}
            </strong>
          </div>

          <div>
            <span>Total Qty</span>
            <strong>{totalQty}</strong>
          </div>
        </div>

        <BasketDetails
          shelf={shelf}
          loadType={info.type}
          onSave={onSaveShelf}
        />

        <section className="rack-location-inventory-section monitor-shelf-settings">
          <div className="rack-modal-section-title">
            <Layers3 size={17} />

            <div>
              <strong>{info.location} data</strong>

              <span>
                Location details are maintained directly in Monitor.
              </span>
            </div>
          </div>

          <div className="rack-operation-form">
            <label>
              <span>Location Code</span>

              <input
                value={codeDraft}
                onChange={(event) =>
                  setCodeDraft(event.target.value)
                }
              />
            </label>

            <label>
              <span>Status</span>

              <select
                value={statusDraft}
                onChange={(event) =>
                  setStatusDraft(event.target.value)
                }
              >
                <option value="AVAILABLE">
                  AVAILABLE
                </option>

                <option value="BLOCKED">
                  BLOCKED
                </option>

                <option value="MAINTENANCE">
                  MAINTENANCE
                </option>
              </select>
            </label>
          </div>

          <div className="monitor-shelf-save-row">
            <button
              type="button"
              onClick={saveShelfData}
            >
              Save {info.location} Data
            </button>
          </div>
        </section>

        <section className="rack-location-inventory-section">
          <div className="rack-modal-section-title">
            <Package size={17} />

            <div>
              <strong>Products in this {info.label.toLowerCase()}</strong>

              <span>
                {info.description}
              </span>
            </div>
          </div>

          <div className="rack-location-inventory-list">
            {shelf.inventory.length > 0 ? (
              shelf.inventory.map((item) => {
                const reserved = Number(
                  item.reserved || 0,
                );

                const free = Math.max(
                  0,
                  Number(item.quantity || 0) -
                    reserved,
                );

                return (
                  <div
                    className="rack-location-inventory-item"
                    key={item.id}
                  >
                    <div>
                      <strong>{item.sku}</strong>
                      <span>{item.name}</span>
                    </div>

                    <div>
                      <strong>
                        {item.quantity} {item.unit}
                      </strong>

                      <span>
                        Reserved {reserved}
                        {" · Free "}
                        {free}
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="rack-no-inventory">
                No products in this {info.label.toLowerCase()}.
              </div>
            )}
          </div>
        </section>

        <section className="rack-quick-operation-section">
          <div className="rack-operation-tabs three">
            <button
              type="button"
              className={
                `operation-tab inbound ` +
                `${mode === "INBOUND" ? "active" : ""}`
              }
              onClick={() => setMode("INBOUND")}
            >
              <ArrowDownToLine size={15} />
              Inbound
            </button>

            <button
              type="button"
              className={
                `operation-tab outbound ` +
                `${mode === "OUTBOUND" ? "active" : ""}`
              }
              onClick={() => setMode("OUTBOUND")}
            >
              <ArrowUpFromLine size={15} />
              Outbound
            </button>

            <button
              type="button"
              className={
                `operation-tab deduct ` +
                `${mode === "DEDUCT" ? "active" : ""}`
              }
              onClick={() => setMode("DEDUCT")}
            >
              <Boxes size={15} />
              Deduct Stock
            </button>
          </div>

          {operationsDisabled && (
            <div className="rack-operation-warning">
              This shelf is {shelf.status};
              stock operations are disabled.
            </div>
          )}

          <div className="rack-operation-form">
            {mode === "INBOUND" ? (
              <>
                <label>
                  <span>SKU</span>

                  <input
                    list="monitor-sku-list"
                    value={sku}
                    onChange={(event) =>
                      handleSkuChange(event.target.value)
                    }
                    disabled={operationsDisabled}
                  />

                  <datalist id="monitor-sku-list">
                    {skuCatalog.map((item) => (
                      <option
                        key={item.sku}
                        value={item.sku}
                      >
                        {item.name}
                      </option>
                    ))}
                  </datalist>
                </label>

                <label>
                  <span>Item Name</span>

                  <input
                    value={itemName}
                    onChange={(event) =>
                      setItemName(event.target.value)
                    }
                    disabled={operationsDisabled}
                  />
                </label>

                <label>
                  <span>Category / Type</span>

                  <input
                    value={category}
                    onChange={(event) =>
                      setCategory(event.target.value)
                    }
                    disabled={operationsDisabled}
                  />
                </label>

                <label>
                  <span>Unit</span>

                  <input
                    value={unit}
                    onChange={(event) =>
                      setUnit(event.target.value)
                    }
                    disabled={operationsDisabled}
                  />
                </label>
              </>
            ) : (
              <label>
                <span>Inventory Record</span>

                <select
                  value={selectedItemId}
                  onChange={(event) =>
                    setSelectedItemId(event.target.value)
                  }
                  disabled={
                    operationsDisabled ||
                    shelf.inventory.length === 0
                  }
                >
                  <option value="">
                    Select stock...
                  </option>

                  {shelf.inventory.map((item) => (
                    <option
                      key={item.id}
                      value={item.id}
                    >
                      {item.sku}
                      {" · Qty "}
                      {item.quantity}
                      {" · Free "}
                      {Math.max(
                        0,
                        Number(item.quantity || 0) -
                          Number(item.reserved || 0),
                      )}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label>
              <span>Quantity</span>

              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(event) =>
                  setQuantity(event.target.value)
                }
                disabled={operationsDisabled}
              />
            </label>

            <label>
              <span>Reference</span>

              <input
                value={reference}
                onChange={(event) =>
                  setReference(event.target.value)
                }
                disabled={operationsDisabled}
              />
            </label>

            <label>
              <span>Note</span>

              <input
                value={note}
                onChange={(event) =>
                  setNote(event.target.value)
                }
                disabled={operationsDisabled}
              />
            </label>
          </div>

          <div className="rack-operation-footer">
            <div>
              <span>
                {message ||
                  "Monitor master data will be updated immediately."}
              </span>

              {mode !== "INBOUND" && selectedItem && (
                <strong>
                  Current {selectedItem.quantity}
                  {" · Reserved "}
                  {reservedQty}
                  {" · Free "}
                  {freeQty}
                </strong>
              )}
            </div>

            <button
              type="button"
              className={
                mode === "INBOUND"
                  ? "inbound"
                  : mode === "OUTBOUND"
                    ? "outbound"
                    : "deduct"
              }
              disabled={operationsDisabled}
              onClick={submitOperation}
            >
              {mode === "INBOUND"
                ? "Confirm Inbound"
                : mode === "OUTBOUND"
                  ? "Create Outbound"
                  : "Deduct Stock"}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

function createDefaultMonitorData() {
  const racks = DEFAULT_RACK_LAYOUT.map((rack) => ({
    ...rack,
    name: `Rack ${rack.id}`,
    loadType: "BASKET",

    shelves: Array.from(
      { length: SHELF_COUNT },
      (_, index) => {
        const level = index + 1;

        return {
          id: `${rack.id}-S${level}`,
          level,
          code: `${rack.id}-${String(level).padStart(2, "0")}`,
          capacity: 1,
          basket: null,
          status: "AVAILABLE",
          inventory: [],
        };
      },
    ),
  }));

  return {
    version: 4,
    layoutVersion: CURRENT_LAYOUT_VERSION,
    completedBasketTransfers: {},
    outboundOperations: [],
    racks,

    waypoints: DEFAULT_WAYPOINTS.map(
      (item) => ({ ...item }),
    ),

    routeEdges: DEFAULT_ROUTE_EDGES.map(
      (edge) => [...edge],
    ),

    storageLinks: DEFAULT_STORAGE_LINKS.map(
      (edge) => [...edge],
    ),

    skuCatalog: DEFAULT_SKUS,
    history: [],
  };
}

function loadMonitorData() {
  try {
    let raw = localStorage.getItem(
      MONITOR_STORAGE_KEY,
    );

    if (!raw) {
      for (const legacyKey of LEGACY_MONITOR_STORAGE_KEYS) {
        const legacyRaw = localStorage.getItem(
          legacyKey,
        );

        if (legacyRaw) {
          raw = legacyRaw;
          break;
        }
      }
    }

    if (!raw) {
      const fresh = createDefaultMonitorData();

      localStorage.setItem(
        MONITOR_STORAGE_KEY,
        JSON.stringify(fresh),
      );

      return fresh;
    }

    const backupKey =
      `${MONITOR_STORAGE_KEY}-before-depth-v1`;

    if (!localStorage.getItem(backupKey)) {
      localStorage.setItem(backupKey, raw);
    }

    const normalized = normalizeMonitorData(
      JSON.parse(raw),
    );
  

    localStorage.setItem(
      MONITOR_STORAGE_KEY,
      JSON.stringify(normalized),
    );

    return normalized;
  } catch (error) {
    console.error(
      "Could not load monitor master data.",
      error,
    );

    return {
      ...createDefaultMonitorData(),
      loadError:
        error.message ||
        "Monitor data cannot be read.",
    };
  }
}

function normalizeMonitorData(data) {
  const fallback = createDefaultMonitorData();

  const sourceRacks = Array.isArray(data?.racks)
    ? data.racks
    : [];

  const rackMap = new Map(
    sourceRacks.map((rack) => [
      String(rack.id),
      rack,
    ]),
  );

  const racks = DEFAULT_RACK_LAYOUT.map((layout) => {
    const saved = rackMap.get(layout.id) || {};

    const savedShelves = Array.isArray(saved.shelves)
      ? saved.shelves
      : [];

    const shelfCount = rackShelfCount(
      saved,
      SHELF_COUNT,
    );

    const depthCount = rackDepthCount(saved);

    const fallbackRack = fallback.racks.find(
      (rack) => rack.id === layout.id,
    );

    const sourceRack = savedShelves.length
      ? {
          ...saved,
          id: layout.id,
          shelves: savedShelves,
        }
      : {
          ...fallbackRack,
          ...saved,
          id: layout.id,
          shelves: fallbackRack?.shelves || [],
        };

    return {
      ...layout,
      ...saved,

      loadType: saved.loadType || "BASKET",

      id: layout.id,
      zone: saved.zone || layout.zone,
      name: saved.name || `Rack ${layout.id}`,

      left: layout.left,
      top: layout.top,

      shelfCount,
      depthCount,

      shelves: rackSlots(
        sourceRack,
        shelfCount,
        depthCount,
      ).map((shelf) =>
        normalizeShelf(
          shelf,
          layout.id,
          shelf.level,
        ),
      ),
    };
  });

  return {
    version: 4,
    layoutVersion: CURRENT_LAYOUT_VERSION,

    completedBasketTransfers:
      data?.completedBasketTransfers || {},

    outboundOperations:
      Array.isArray(data?.outboundOperations)
        ? data.outboundOperations
        : [],

    racks,

    waypoints: DEFAULT_WAYPOINTS.map(
      (item) => ({ ...item }),
    ),

    routeEdges: DEFAULT_ROUTE_EDGES.map(
      (edge) => [...edge],
    ),

    storageLinks: DEFAULT_STORAGE_LINKS.map(
      (edge) => [...edge],
    ),

    skuCatalog:
      Array.isArray(data?.skuCatalog) &&
      data.skuCatalog.length > 0
        ? data.skuCatalog
        : DEFAULT_SKUS,

    history: Array.isArray(data?.history)
      ? data.history
      : [],
  };
}

function normalizeShelf(shelf, rackId, level) {
  const inventory = Array.isArray(shelf?.inventory)
    ? shelf.inventory.map((item, index) => ({
        id: String(
          item.id ||
            `${rackId}-S${level}-INV-${index + 1}`,
        ),

        sku: String(item.sku || ""),

        name: String(
          item.name || item.sku || "Item",
        ),

        category: String(
          item.category || "General",
        ),

        unit: String(item.unit || "PCS"),

        quantity: Math.max(
          0,
          Number(item.quantity || 0),
        ),

        reserved: Math.max(
          0,
          Number(item.reserved || 0),
        ),
      }))
    : [];

  const id = String(
    shelf?.id || `${rackId}-S${level}`,
  );

  return {
    id,
    level,
    depth: shelfDepth(shelf),

    code: String(
      shelf?.code ??
        `${rackId}-${String(level).padStart(2, "0")}`,
    ),

    capacity: 1,

    basket: basketOf({
      ...shelf,
      id,
      inventory,
    }),

    status: String(
      shelf?.status || "AVAILABLE",
    ).toUpperCase(),

    inventory,
  };
}

function updateShelf(
  data,
  rackId,
  shelfId,
  updater,
) {
  return {
    ...data,

    racks: data.racks.map((rack) =>
      rack.id !== rackId
        ? rack
        : {
            ...rack,

            shelves: rack.shelves.map(
              (shelf) =>
                shelf.id === shelfId
                  ? updater({ ...shelf })
                  : shelf,
            ),
          },
    ),
  };
}

function applyInbound(
  data,
  rackId,
  shelfId,
  payload,
) {
  const qty = Number(payload.quantity || 0);

  let historyItem = null;

  const next = updateShelf(
    data,
    rackId,
    shelfId,
    (shelf) => {
      if (
        ["BLOCKED", "MAINTENANCE"].includes(
          shelf.status,
        )
      ) {
        throw new Error(
          `Location ${shelf.code} is ${shelf.status}.`,
        );
      }

      if (!basketOf(shelf)) {
        throw new Error(
          "Save a load ID at this location before adding products.",
        );
      }

      const inventory = shelf.inventory.map(
        (item) => ({ ...item }),
      );

      const existingIndex = inventory.findIndex(
        (item) => item.sku === payload.sku,
      );

      if (existingIndex >= 0) {
        inventory[existingIndex].quantity =
          Number(
            inventory[existingIndex].quantity || 0,
          ) + qty;
      } else {
        inventory.push({
          id: getNextMonitorInventoryId(data),
          sku: payload.sku,
          name: payload.name,
          category: payload.category || "General",
          unit: payload.unit || "PCS",
          quantity: qty,
          reserved: 0,
        });
      }

      historyItem = createHistoryRecord(
        "INBOUND",
        rackId,
        shelf,
        payload,
      );

      return {
        ...shelf,
        inventory,
      };
    },
  );

  return appendSkuAndHistory(
    next,
    payload,
    historyItem,
  );
}

function applyOutboundReservation(
  data,
  rackId,
  shelfId,
  payload,
) {
  return createOutboundReservation(
    data,
    rackId,
    shelfId,
    payload,
  );
}

function applyDeductStock(
  data,
  rackId,
  shelfId,
  payload,
) {
  let historyItem = null;

  const next = updateShelf(
    data,
    rackId,
    shelfId,
    (shelf) => {
      const inventory = shelf.inventory.map(
        (item) => ({ ...item }),
      );

      const index = inventory.findIndex(
        (item) => item.id === payload.itemId,
      );

      if (index < 0) {
        throw new Error(
          "Inventory record not found.",
        );
      }

      const current = inventory[index];

      const free = Math.max(
        0,
        Number(current.quantity || 0) -
          Number(current.reserved || 0),
      );

      const qty = Number(
        payload.quantity || 0,
      );

      if (qty > free) {
        throw new Error(
          `Only ${free} free stock can be deducted.`,
        );
      }

      const beforeQuantity = Number(
        current.quantity || 0,
      );

      current.quantity = Math.max(
        0,
        beforeQuantity - qty,
      );

      historyItem = createHistoryRecord(
        "DEDUCT_STOCK",
        rackId,
        shelf,
        {
          ...payload,
          sku: current.sku,
          name: current.name,
          unit: current.unit,
          beforeQuantity,
          afterQuantity: current.quantity,
        },
      );

      return {
        ...shelf,

        inventory: inventory.filter(
          (item) =>
            Number(item.quantity || 0) > 0 ||
            Number(item.reserved || 0) > 0,
        ),
      };
    },
  );

  return {
    ...next,

    history: [
      historyItem,
      ...(next.history || []),
    ].slice(0, 300),
  };
}

function appendSkuAndHistory(
  data,
  payload,
  historyItem,
) {
  const catalog = [
    ...(data.skuCatalog || []),
  ];

  if (
    !catalog.some(
      (item) => item.sku === payload.sku,
    )
  ) {
    catalog.push({
      sku: payload.sku,
      name: payload.name,
      category: payload.category || "General",
      unit: payload.unit || "PCS",
    });
  }

  return {
    ...data,
    skuCatalog: catalog,

    history: [
      historyItem,
      ...(data.history || []),
    ].slice(0, 300),
  };
}

function createHistoryRecord(
  type,
  rackId,
  shelf,
  payload,
) {
  return {
    id:
      `MON-HIS-${Date.now()}-` +
      Math.random().toString(36).slice(2, 7),

    type,
    rackId,
    shelfId: shelf.id,
    locationCode: shelf.code,

    sku: payload.sku || "",
    itemName: payload.name || "",

    quantity: Number(
      payload.quantity || 0,
    ),

    unit: payload.unit || "",
    reference: payload.reference || "",
    note: payload.note || "",

    beforeQuantity: payload.beforeQuantity,
    afterQuantity: payload.afterQuantity,

    createdAt: new Date().toISOString(),
  };
}

function getNextMonitorInventoryId(data) {
  let max = 0;

  data.racks.forEach((rack) => {
    rack.shelves.forEach((shelf) => {
      shelf.inventory.forEach((item) => {
        const match = String(
          item.id || "",
        ).match(/(\d+)$/);

        if (match) {
          max = Math.max(
            max,
            Number(match[1]),
          );
        }
      });
    });
  });

  return (
    "MON-INV-" +
    String(max + 1).padStart(3, "0")
  );
}

function getShelfState(shelf) {
  const status = String(
    shelf.status || "",
  ).toUpperCase();

  if (
    ["BLOCKED", "MAINTENANCE"].includes(
      status,
    )
  ) {
    return "blocked";
  }

  if (!basketOf(shelf)) {
    return "empty";
  }

  return "occupied";
}