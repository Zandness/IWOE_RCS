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

const CURRENT_LAYOUT_VERSION = 4;
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

const DEFAULT_RACK_LAYOUT = [
  { id: "A01", zone: "ZONE-A", left: 30.5, top: 7.9 },
  { id: "A02", zone: "ZONE-A", left: 47.2, top: 7.9 },
  { id: "A03", zone: "ZONE-A", left: 30.5, top: 16.2 },
  { id: "A04", zone: "ZONE-A", left: 47.2, top: 16.2 },
  { id: "A05", zone: "ZONE-A", left: 30.5, top: 24.8 },
  { id: "A06", zone: "ZONE-A", left: 47.2, top: 24.8 },
  { id: "A07", zone: "ZONE-A", left: 30.5, top: 33.0 },
  { id: "A08", zone: "ZONE-A", left: 47.2, top: 33.0 },

  { id: "B01", zone: "ZONE-B", left: 73.7, top: 17.1 },
  { id: "B02", zone: "ZONE-B", left: 73.7, top: 24.9 },
  { id: "B03", zone: "ZONE-B", left: 73.7, top: 32.9 },

  { id: "C01", zone: "ZONE-C", left: 47.2, top: 78.5 },
];

const DEFAULT_WAYPOINTS = [
  { id: "WP-L1", left: 38.8, top: 8.5 },
  { id: "WP-L2", left: 38.8, top: 16.8 },
  { id: "WP-L3", left: 38.8, top: 25.2 },
  { id: "WP-L4", left: 38.8, top: 33.5 },
  { id: "WP-L5", left: 38.8, top: 41.6 },
  { id: "WP-L6", left: 38.8, top: 57.2 },
  { id: "WP-L7", left: 38.8, top: 69.3 },
  { id: "WP-L8", left: 38.8, top: 79.1 },

  { id: "WP-R1", left: 65.3, top: 17.8 },
  { id: "WP-R2", left: 65.3, top: 25.6 },
  { id: "WP-R3", left: 65.3, top: 33.6 },
  { id: "WP-R4", left: 65.3, top: 41.6 },
  { id: "WP-R5", left: 65.3, top: 57.2 },

  { id: "WP-M1", left: 48.9, top: 57.2 },
  { id: "WP-RIGHT", left: 77.5, top: 57.2 },
];

const DEFAULT_ROUTE_EDGES = [
  ["WP-L1", "WP-L2"],
  ["WP-L2", "WP-L3"],
  ["WP-L3", "WP-L4"],
  ["WP-L4", "WP-L5"],
  ["WP-L5", "WP-L6"],
  ["WP-L6", "WP-L7"],
  ["WP-L7", "WP-L8"],

  ["WP-R1", "WP-R2"],
  ["WP-R2", "WP-R3"],
  ["WP-R3", "WP-R4"],
  ["WP-R4", "WP-R5"],

  ["WP-L6", "WP-M1"],
  ["WP-M1", "WP-R5"],
  ["WP-R5", "WP-RIGHT"],
];

const DEFAULT_STORAGE_LINKS = [
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
          title="Shelf Blocks"
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
            onResizeRack={(rackId, count, depth) =>
              saveAndSet(
                resizeRack(
                  readMonitor(),
                  rackId,
                  count,
                  depth,
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
              throw new Error("Basket ID already exists.");
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
  const MAP_WIDTH = 1000;
  const MAP_HEIGHT = 1300;

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
              top: waypoint.top,
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

  const depthCount = rack
    ? rackDepthCount(rack)
    : 1;

  const activeDepth = Math.min(
    selectedDepth,
    depthCount,
  );

  useEffect(() => {
    setSelectedDepth(1);
  }, [rack?.id]);

  if (!rack) {
    return (
      <aside className="rack-front-side-panel empty">
        <Warehouse size={30} />

        <strong>Select a storage rack</strong>

        <span>
          Shelf blocks will appear here.
        </span>
      </aside>
    );
  }

  const shelves = rack.shelves
    .filter(
      (shelf) => shelfDepth(shelf) === activeDepth,
    )
    .sort(
      (a, b) => Number(b.level) - Number(a.level),
    );

  const totalQty = shelves.reduce(
    (sum, shelf) =>
      sum +
      shelf.inventory.reduce(
        (itemSum, item) =>
          itemSum + Number(item.quantity || 0),
        0,
      ),
    0,
  );

  return (
    <aside className="rack-front-side-panel">
      <div className="rack-side-header">
        <div>
          <span>{rack.zone}</span>
          <h3>Rack {rack.id}</h3>

          <p>
            Monitor master data
            {" · "}
            {rackShelfCount(rack)} shelf levels
            {" · "}
            {depthCount} depths
          </p>
        </div>

        <div className="rack-side-total">
          <strong>{totalQty}</strong>
          <span>stock qty</span>
        </div>
      </div>

      <RackShelfSettings
        rack={rack}
        onSave={onResizeRack}
      />

      <div
        className="overview-actions"
        role="group"
        aria-label="Rack depth"
      >
        {Array.from(
          { length: depthCount },
          (_, index) => index + 1,
        ).map((depth) => (
          <button
            type="button"
            key={depth}
            aria-pressed={activeDepth === depth}
            style={{
              borderBottom:
                activeDepth === depth
                  ? "3px solid #22d3ee"
                  : "3px solid transparent",
            }}
            onClick={() => setSelectedDepth(depth)}
          >
            Depth {depth}
          </button>
        ))}
      </div>

      <div className="rack-five-shelf-frame">
        <div className="rack-five-upright left" />
        <div className="rack-five-upright right" />

        {shelves.map((shelf) => {
          const qty = shelf.inventory.reduce(
            (sum, item) =>
              sum + Number(item.quantity || 0),
            0,
          );

          const state = getShelfState(shelf);

          const firstItem = shelf.inventory.find(
            (item) => Number(item.quantity || 0) > 0,
          );

          return (
            <div
              className="rack-five-level"
              key={shelf.id}
            >
              <div className="rack-five-level-label">
                Level {shelf.level}
              </div>

              <div className="rack-five-level-blocks">
                <button
                  type="button"
                  className={`rack-five-block ${state}`}
                  onClick={() => onShelfClick(shelf)}
                >
                  <strong>
                    {shelf.code || "Set RCS location code"}
                  </strong>

                  <span>
                    {firstItem
                      ? `${firstItem.sku} · ${firstItem.name}`
                      : "Empty"}
                  </span>

                  <small>
                    {basketOf(shelf)?.id || "No basket"}
                    {" · "}
                    {qty} items
                  </small>
                </button>
              </div>
            </div>
          );
        })}

        <div className="rack-five-base" />
      </div>

      <div className="rack-side-legend">
        <span>
          <i className="legend-dot empty" />
          Empty
        </span>

        <span>
          <i className="legend-dot occupied" />
          Occupied
        </span>

        <span>
          <i className="legend-dot blocked" />
          Blocked
        </span>
      </div>

      <div className="rack-side-hint">
        <CircleDot size={14} />

        Click a shelf to view inventory,
        edit shelf data and run an operation.
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
        "Shelf data saved in Monitor.",
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
              {" · RACK "}
              {rack.id}
              {" · LEVEL "}
              {shelf.level}
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
            <span>Baskets</span>
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
          onSave={onSaveShelf}
        />

        <section className="rack-location-inventory-section monitor-shelf-settings">
          <div className="rack-modal-section-title">
            <Layers3 size={17} />

            <div>
              <strong>Shelf data</strong>

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
              Save Shelf Data
            </button>
          </div>
        </section>

        <section className="rack-location-inventory-section">
          <div className="rack-modal-section-title">
            <Package size={17} />

            <div>
              <strong>Inventory in this shelf</strong>

              <span>
                Current stock stored inside this basket.
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
                No stock in this shelf.
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
          `Shelf ${shelf.code} is ${shelf.status}.`,
        );
      }

      if (!basketOf(shelf)) {
        throw new Error(
          "Create a basket at this location before adding stock.",
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