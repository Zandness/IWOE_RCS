import {
  AlertTriangle,
  Boxes,
  Layers3,
  Link2,
  Map,
  MapPin,
  Pencil,
  Plus,
  Search,
  Trash2,
  Warehouse,
} from "lucide-react";

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { INITIAL_MAP } from "../data/mockWarehouseMap";
import "../styles/StorageLocations.css";

const LOCATION_STORAGE_KEY = "wms-storage-locations-v1";
const MAP_LIBRARY_KEY = "wms-warehouse-map-library-v1";
const KEEP_EXISTING_LINK = "__KEEP_EXISTING_LINK__";

const INITIAL_LOCATIONS = [
  {
    id: "LOC-001",
    code: "A01-01",
    warehouse: "MAIN-WH",
    zone: "ZONE-A",
    rack: "RACK-A01",
    level: "01",
    type: "STORAGE",
    status: "AVAILABLE",
    capacity: 100,
    used: 65,
    mapId: "MAP-001",
    mapNodeId: "P003",
    rcsPointCode: "",
    rcsMapCode: "",
    rcsTargetType: "SITE",
  },
  {
    id: "LOC-002",
    code: "A01-02",
    warehouse: "MAIN-WH",
    zone: "ZONE-A",
    rack: "RACK-A01",
    level: "02",
    type: "STORAGE",
    status: "AVAILABLE",
    capacity: 100,
    used: 40,
    mapId: "",
    mapNodeId: "",
    rcsPointCode: "",
    rcsMapCode: "",
    rcsTargetType: "SITE",
  },
  {
    id: "LOC-003",
    code: "A02-01",
    warehouse: "MAIN-WH",
    zone: "ZONE-A",
    rack: "RACK-A02",
    level: "01",
    type: "STORAGE",
    status: "FULL",
    capacity: 80,
    used: 80,
    mapId: "",
    mapNodeId: "",
    rcsPointCode: "",
    rcsMapCode: "",
    rcsTargetType: "SITE",
  },
  {
    id: "LOC-004",
    code: "B01-01",
    warehouse: "MAIN-WH",
    zone: "ZONE-B",
    rack: "RACK-B01",
    level: "01",
    type: "STORAGE",
    status: "AVAILABLE",
    capacity: 120,
    used: 25,
    mapId: "",
    mapNodeId: "",
    rcsPointCode: "",
    rcsMapCode: "",
    rcsTargetType: "SITE",
  },
];

export default function StorageLocations() {
  const [locations, setLocations] = useState(loadLocations);

  const [mapSystem, setMapSystem] = useState(
    loadMapSystemSnapshot
  );

  const [search, setSearch] = useState("");

  const [selectedLocation, setSelectedLocation] =
    useState(null);

  const [showForm, setShowForm] = useState(false);

  const [saveMessage, setSaveMessage] =
    useState("");

  /*
   * =====================================================
   * ACTIVE MAP
   * =====================================================
   */

  const activeMap = useMemo(() => {
    return (
      mapSystem.maps?.[
        mapSystem.activeMapId
      ] ||
      Object.values(
        mapSystem.maps || {}
      )[0] ||
      null
    );
  }, [mapSystem]);

  /*
   * =====================================================
   * STORAGE NODES FROM ACTIVE MAP
   * =====================================================
   */

  const activeStorageNodes =
    useMemo(() => {
      if (!activeMap) {
        return [];
      }

      return (
        activeMap.nodes || []
      )
        .filter(
          (node) =>
            node.type ===
            "STORAGE"
        )
        .sort(
          (a, b) =>
            String(a.id).localeCompare(
              String(b.id)
            )
        );
    }, [activeMap]);

  /*
   * =====================================================
   * LINKED STORAGE NODE COUNT
   * =====================================================
   */

  const activeLinkedNodeCount =
    useMemo(() => {
      if (!activeMap) {
        return 0;
      }

      const linkedNodeIds =
        new Set(
          locations
            .filter(
              (location) =>
                location.mapId ===
                  activeMap.mapId &&
                location.mapNodeId
            )
            .map(
              (location) =>
                location.mapNodeId
            )
        );

      return activeStorageNodes.filter(
        (node) =>
          linkedNodeIds.has(
            node.id
          )
      ).length;
    }, [
      activeMap,
      activeStorageNodes,
      locations,
    ]);

  /*
   * =====================================================
   * SEARCH
   * =====================================================
   */

  const filteredLocations =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      if (!query) {
        return locations;
      }

      return locations.filter(
        (location) => {
          const link =
            getLocationMapLink(
              location,
              mapSystem
            );

          return [
            location.id,
            location.code,
            location.warehouse,
            location.zone,
            location.rack,
            location.level,
            location.type,
            location.status,
            location.mapId,
            location.mapNodeId,
            location.rcsPointCode,
            location.rcsMapCode,
            location.rcsTargetType,
            link.map?.name,
            link.node?.name,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(query);
        }
      );
    }, [
      locations,
      mapSystem,
      search,
    ]);

  /*
   * =====================================================
   * SUMMARY
   * =====================================================
   */

  const totalCapacity =
    locations.reduce(
      (sum, location) =>
        sum +
        Number(
          location.capacity ||
            0
        ),
      0
    );

  const totalUsed =
    locations.reduce(
      (sum, location) =>
        sum +
        Number(
          location.used ||
            0
        ),
      0
    );

  const availableLocations =
    locations.filter(
      (location) =>
        location.status ===
        "AVAILABLE"
    ).length;

  /*
   * =====================================================
   * SAVE STORAGE LOCATIONS
   * =====================================================
   */

  useEffect(() => {
    try {
      localStorage.setItem(
        LOCATION_STORAGE_KEY,
        JSON.stringify(
          locations
        )
      );

      setSaveMessage(
        "Saved locally"
      );
    } catch (error) {
      console.error(
        "Could not save storage locations.",
        error
      );

      setSaveMessage(
        "Local save failed"
      );
    }
  }, [locations]);

  /*
   * =====================================================
   * REFRESH MAP LIBRARY
   * =====================================================
   */

  useEffect(() => {
    function refreshMapSystem() {
      setMapSystem(
        loadMapSystemSnapshot()
      );
    }

    function handleStorage(
      event
    ) {
      if (
        event.key ===
        MAP_LIBRARY_KEY
      ) {
        refreshMapSystem();
      }

      if (
        event.key ===
          LOCATION_STORAGE_KEY &&
        event.newValue
      ) {
        setLocations(
          loadLocations()
        );
      }
    }

    window.addEventListener(
      "storage",
      handleStorage
    );

    window.addEventListener(
      "focus",
      refreshMapSystem
    );

    return () => {
      window.removeEventListener(
        "storage",
        handleStorage
      );

      window.removeEventListener(
        "focus",
        refreshMapSystem
      );
    };
  }, []);

  /*
   * =====================================================
   * DELETE
   * =====================================================
   */

  function handleDelete(id) {
    const target =
      locations.find(
        (location) =>
          location.id === id
      );

    const confirmed =
      window.confirm(
        `Delete location ${
          target?.code || id
        }?\n\nThis removes the WMS location record only. The map node will remain in Warehouse Map.`
      );

    if (!confirmed) {
      return;
    }

    setLocations(
      (current) =>
        current.filter(
          (location) =>
            location.id !== id
        )
    );

    if (
      selectedLocation?.id ===
      id
    ) {
      setSelectedLocation(
        null
      );

      setShowForm(false);
    }
  }

  /*
   * =====================================================
   * ADD
   * =====================================================
   */

  function handleAddLocation() {
    setSelectedLocation(
      null
    );

    setShowForm(true);
  }

  /*
   * =====================================================
   * EDIT
   * =====================================================
   */

  function handleEdit(
    location
  ) {
    setSelectedLocation(
      location
    );

    setShowForm(true);
  }

  /*
   * =====================================================
   * SAVE FORM
   * =====================================================
   */

  function handleSave(
    formData
  ) {
    const editingId =
      selectedLocation?.id ||
      null;

    const validation =
      validateLocation({
        formData,
        editingId,
        locations,
        activeMap,
        activeStorageNodes,
        selectedLocation,
      });

    if (!validation.ok) {
      return validation;
    }

    const normalized =
      validation.location;

    /*
     * EDIT EXISTING
     */

    if (editingId) {
      setLocations(
        (current) =>
          current.map(
            (location) =>
              location.id ===
              editingId
                ? {
                    ...location,
                    ...normalized,
                  }
                : location
          )
      );
    }

    /*
     * CREATE NEW
     */

    else {
      const newLocation = {
        id:
          getNextLocationId(
            locations
          ),

        ...normalized,
      };

      setLocations(
        (current) => [
          ...current,
          newLocation,
        ]
      );
    }

    setShowForm(false);

    setSelectedLocation(
      null
    );

    return {
      ok: true,
    };
  }

  /*
   * =====================================================
   * UI
   * =====================================================
   */

  return (
    <div className="locations-page">

      {/* =================================================
          HEADER
      ================================================= */}

      <div className="locations-header">

        <div>
          <span className="locations-label">
            WAREHOUSE MANAGEMENT
          </span>

          <h2>
            Storage Locations
          </h2>

          <p>
            Manage warehouse zones,
            racks, bins and
            map-linked storage
            locations.
          </p>
        </div>

        <div className="locations-header-actions">

          {saveMessage && (
            <span
              className={`location-save-state ${
                saveMessage.includes(
                  "failed"
                )
                  ? "error"
                  : ""
              }`}
            >
              {saveMessage}
            </span>
          )}

          <button
            className="location-add-button"
            onClick={
              handleAddLocation
            }
          >
            <Plus size={18} />

            Add Location
          </button>

        </div>
      </div>

      {/* =================================================
          SUMMARY
      ================================================= */}

      <div className="location-summary-grid">

        <SummaryCard
          icon={
            <MapPin
              size={21}
            />
          }
          title="Locations"
          value={
            locations.length
          }
        />

        <SummaryCard
          icon={
            <Warehouse
              size={21}
            />
          }
          title="Available"
          value={
            availableLocations
          }
        />

        <SummaryCard
          icon={
            <Boxes
              size={21}
            />
          }
          title="Used Capacity"
          value={
            totalUsed
          }
        />

        <SummaryCard
          icon={
            <Layers3
              size={21}
            />
          }
          title="Total Capacity"
          value={
            totalCapacity
          }
        />

      </div>

      {/* =================================================
          MAP BRIDGE
      ================================================= */}

      <section className="location-map-bridge">

        <div className="location-map-bridge-icon">
          <Map size={20} />
        </div>

        <div className="location-map-bridge-main">

          <span>
            ACTIVE WAREHOUSE MAP
          </span>

          <strong>
            {activeMap?.name ||
              "No active map"}
          </strong>

          <small>
            {activeMap?.mapId ||
              "No map ID"}
          </small>

        </div>

        <div className="location-map-bridge-stat">

          <span>
            Storage Nodes
          </span>

          <strong>
            {
              activeStorageNodes.length
            }
          </strong>

        </div>

        <div className="location-map-bridge-stat">

          <span>
            Linked
          </span>

          <strong>
            {
              activeLinkedNodeCount
            }
          </strong>

        </div>

        <div className="location-map-bridge-stat">

          <span>
            Available to Link
          </span>

          <strong>
            {Math.max(
              activeStorageNodes.length -
                activeLinkedNodeCount,
              0
            )}
          </strong>

        </div>

        <Link
          className="location-map-open"
          to="/warehouse"
        >
          Open Map
        </Link>

      </section>

      {/* =================================================
          DIRECTORY
      ================================================= */}

      <section className="location-panel">

        <div className="location-panel-header">

          <div>
            <h3>
              Location Directory
            </h3>

            <p>
              Warehouse storage
              structure and map node
              assignment.
            </p>
          </div>

          <div className="location-search">

            <Search
              size={17}
            />

            <input
              type="text"
              placeholder="Search location, map or node..."
              value={search}
              onChange={(
                event
              ) =>
                setSearch(
                  event.target
                    .value
                )
              }
            />

          </div>

        </div>

        {/* =================================================
            TABLE
        ================================================= */}

        <div className="location-table-wrapper">

          <table className="location-table">

            <thead>
              <tr>
                <th>
                  Location
                </th>

                <th>
                  Zone
                </th>

                <th>
                  Rack
                </th>

                <th>
                  Level
                </th>

                <th>
                  Map Node
                </th>

                <th>
                  HIK RCS Point
                </th>

                <th>
                  Capacity
                </th>

                <th>
                  Status
                </th>

                <th></th>
              </tr>
            </thead>

            <tbody>

              {filteredLocations.map(
                (
                  location
                ) => {

                  const percentage =
                    location.capacity >
                    0
                      ? Math.min(
                          100,
                          Math.round(
                            (
                              location.used /
                              location.capacity
                            ) *
                              100
                          )
                        )
                      : 0;

                  const link =
                    getLocationMapLink(
                      location,
                      mapSystem
                    );

                  return (
                    <tr
                      key={
                        location.id
                      }
                    >

                      {/* LOCATION */}

                      <td>
                        <div className="location-code-cell">

                          <div className="location-icon">
                            <MapPin
                              size={
                                17
                              }
                            />
                          </div>

                          <div>
                            <strong>
                              {
                                location.code
                              }
                            </strong>

                            <span>
                              {
                                location.id
                              }
                            </span>
                          </div>

                        </div>
                      </td>

                      {/* ZONE */}

                      <td>
                        {
                          location.zone
                        }
                      </td>

                      {/* RACK */}

                      <td>
                        {
                          location.rack
                        }
                      </td>

                      {/* LEVEL */}

                      <td>
                        {
                          location.level
                        }
                      </td>

                      {/* MAP NODE */}

                      <td>
                        <MapNodeBadge
                          location={
                            location
                          }
                          link={
                            link
                          }
                        />
                      </td>

                      {/* HIK RCS POINT */}

                      <td>
                        <div className="rcs-point-cell">
                          <strong>
                            {location.rcsPointCode || "Not mapped"}
                          </strong>

                          <span>
                            {location.rcsPointCode
                              ? `${location.rcsTargetType || "SITE"}${location.rcsMapCode ? ` · Map ${location.rcsMapCode}` : ""}`
                              : "RCS mapping not set"}
                          </span>
                        </div>
                      </td>

                      {/* CAPACITY */}

                      <td>
                        <div className="capacity-cell">

                          <div>
                            <span>
                              {
                                location.used
                              }
                            </span>

                            <span>
                              /
                              {
                                location.capacity
                              }
                            </span>
                          </div>

                          <div className="capacity-track">

                            <div
                              className="capacity-fill"
                              style={{
                                width: `${percentage}%`,
                              }}
                            />

                          </div>

                        </div>
                      </td>

                      {/* STATUS */}

                      <td>
                        <span
                          className={`location-status status-${location.status.toLowerCase()}`}
                        >
                          {
                            location.status
                          }
                        </span>
                      </td>

                      {/* ACTIONS */}

                      <td>
                        <div className="location-actions">

                          <button
                            type="button"
                            title="Edit"
                            onClick={() =>
                              handleEdit(
                                location
                              )
                            }
                          >
                            <Pencil
                              size={
                                16
                              }
                            />
                          </button>

                          <button
                            type="button"
                            title="Delete"
                            onClick={() =>
                              handleDelete(
                                location.id
                              )
                            }
                          >
                            <Trash2
                              size={
                                16
                              }
                            />
                          </button>

                        </div>
                      </td>

                    </tr>
                  );
                }
              )}

            </tbody>
          </table>

          {filteredLocations.length ===
            0 && (
            <div className="location-empty">
              No storage locations
              found.
            </div>
          )}

        </div>
      </section>

      {/* =================================================
          FORM
      ================================================= */}

      {showForm && (
        <LocationForm
          location={
            selectedLocation
          }
          locations={
            locations
          }
          activeMap={
            activeMap
          }
          storageNodes={
            activeStorageNodes
          }
          onSave={
            handleSave
          }
          onCancel={() => {
            setShowForm(
              false
            );

            setSelectedLocation(
              null
            );
          }}
        />
      )}

    </div>
  );
}

/*
 * =====================================================
 * SUMMARY CARD
 * =====================================================
 */

function SummaryCard({
  icon,
  title,
  value,
}) {
  return (
    <div className="location-summary-card">

      <div className="summary-icon">
        {icon}
      </div>

      <div>
        <span>
          {title}
        </span>

        <strong>
          {value}
        </strong>
      </div>

    </div>
  );
}

/*
 * =====================================================
 * MAP NODE BADGE
 * =====================================================
 */

function MapNodeBadge({
  location,
  link,
}) {
  /*
   * NOT LINKED
   */

  if (
    !location.mapNodeId
  ) {
    return (
      <span className="map-node-link map-node-link-empty">

        <Link2
          size={13}
        />

        Not linked

      </span>
    );
  }

  /*
   * INVALID LINK
   */

  if (
    !link.map ||
    !link.node ||
    link.node.type !==
      "STORAGE"
  ) {
    return (
      <div className="map-node-link-wrap">

        <span className="map-node-link map-node-link-invalid">

          <AlertTriangle
            size={13}
          />

          {
            location.mapNodeId
          }

        </span>

        <small>
          Invalid or missing
          STORAGE node
        </small>

      </div>
    );
  }

  /*
   * VALID LINK
   */

  return (
    <div className="map-node-link-wrap">

      <span className="map-node-link">

        <Link2
          size={13}
        />

        {link.node.id}
        {" · "}
        {link.node.name}

      </span>

      <small>
        {link.map.name}
        {" · "}
        {link.map.mapId}
      </small>

    </div>
  );
}

/*
 * =====================================================
 * LOCATION FORM
 * =====================================================
 */

function LocationForm({
  location,
  locations,
  activeMap,
  storageNodes,
  onSave,
  onCancel,
}) {
  /*
   * If location was linked
   * to another map,
   * allow user to keep
   * the existing link.
   */

  const existingLinkOnOtherMap =
    Boolean(
      location?.mapNodeId &&
        location?.mapId &&
        activeMap?.mapId &&
        location.mapId !==
          activeMap.mapId
    );

  const [
    form,
    setForm,
  ] = useState({
    code:
      location?.code ||
      "",

    warehouse:
      location?.warehouse ||
      "MAIN-WH",

    zone:
      location?.zone ||
      "",

    rack:
      location?.rack ||
      "",

    level:
      location?.level ||
      "01",

    type:
      location?.type ||
      "STORAGE",

    status:
      location?.status ||
      "AVAILABLE",

    capacity:
      location?.capacity ??
      100,

    used:
      location?.used ??
      0,

    mapNodeId:
      existingLinkOnOtherMap
        ? KEEP_EXISTING_LINK
        : location?.mapNodeId ||
          "",

    rcsPointCode:
      location?.rcsPointCode ||
      "",

    rcsMapCode:
      location?.rcsMapCode ||
      "",

    rcsTargetType:
      location?.rcsTargetType ||
      "SITE",
  });

  const [
    error,
    setError,
  ] = useState("");

  /*
   * =====================================================
   * FIELD CHANGE
   * =====================================================
   */

  function updateField(
    field,
    value
  ) {
    setForm(
      (current) => ({
        ...current,

        [field]:
          value,
      })
    );

    if (error) {
      setError("");
    }
  }

  /*
   * =====================================================
   * CHECK NODE LINK
   * =====================================================
   */

  function getLinkedLocation(
    nodeId
  ) {
    if (
      !activeMap ||
      !nodeId
    ) {
      return null;
    }

    return locations.find(
      (item) =>
        item.id !==
          location?.id &&
        item.mapId ===
          activeMap.mapId &&
        item.mapNodeId ===
          nodeId
    );
  }

  /*
   * =====================================================
   * NODE CHANGE
   * =====================================================
   */

  function handleNodeChange(
    value
  ) {
    updateField(
      "mapNodeId",
      value
    );

    if (
      !value ||
      value ===
        KEEP_EXISTING_LINK
    ) {
      return;
    }

    const selectedNode =
      storageNodes.find(
        (node) =>
          node.id === value
      );

    const mapZone =
      selectedNode
        ?.config
        ?.zone;

    /*
     * Auto-fill Zone
     * only when current Zone
     * is empty.
     */

    if (
      mapZone &&
      !form.zone.trim()
    ) {
      setForm(
        (current) => ({
          ...current,

          mapNodeId:
            value,

          zone:
            String(
              mapZone
            )
              .toUpperCase()
              .startsWith(
                "ZONE-"
              )
              ? String(
                  mapZone
                ).toUpperCase()
              : `ZONE-${String(
                  mapZone
                ).toUpperCase()}`,
        })
      );
    }
  }

  /*
   * =====================================================
   * SUBMIT
   * =====================================================
   */

  function handleSubmit(
    event
  ) {
    event.preventDefault();

    const result =
      onSave(form);

    if (!result?.ok) {
      setError(
        result?.message ||
          "Could not save location."
      );
    }
  }

  /*
   * =====================================================
   * SELECTED MAP NODE
   * =====================================================
   */

  const selectedStorageNode =
    storageNodes.find(
      (node) =>
        node.id ===
        form.mapNodeId
    );

  /*
   * =====================================================
   * UI
   * =====================================================
   */

  return (
    <div
      className="location-modal-backdrop"
      onMouseDown={(
        event
      ) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          onCancel();
        }
      }}
    >

      <form
        className="location-modal"
        onSubmit={
          handleSubmit
        }
      >

        {/* HEADER */}

        <div className="location-modal-header">

          <div>
            <span>
              LOCATION MANAGEMENT
            </span>

            <h3>
              {location
                ? "Edit Location"
                : "Add Location"}
            </h3>
          </div>

          <button
            type="button"
            className="location-close"
            onClick={
              onCancel
            }
            aria-label="Close"
          >
            ×
          </button>

        </div>

        {/* FORM */}

        <div className="location-form-grid">

          <FormField
            label="Location Code"
            value={
              form.code
            }
            placeholder="A01-01"
            onChange={(
              value
            ) =>
              updateField(
                "code",
                value
              )
            }
          />

          <FormField
            label="Warehouse"
            value={
              form.warehouse
            }
            placeholder="MAIN-WH"
            onChange={(
              value
            ) =>
              updateField(
                "warehouse",
                value
              )
            }
          />

          <FormField
            label="Zone"
            value={
              form.zone
            }
            placeholder="ZONE-A"
            onChange={(
              value
            ) =>
              updateField(
                "zone",
                value
              )
            }
          />

          <FormField
            label="Rack"
            value={
              form.rack
            }
            placeholder="RACK-A01"
            onChange={(
              value
            ) =>
              updateField(
                "rack",
                value
              )
            }
          />

          <FormField
            label="Level"
            value={
              form.level
            }
            placeholder="01"
            onChange={(
              value
            ) =>
              updateField(
                "level",
                value
              )
            }
          />

          {/* MAP NODE */}

          <label className="location-field">

            <span>
              Map STORAGE Node
            </span>

            <select
              value={
                form.mapNodeId
              }
              onChange={(
                event
              ) =>
                handleNodeChange(
                  event.target
                    .value
                )
              }
            >

              {existingLinkOnOtherMap && (
                <option
                  value={
                    KEEP_EXISTING_LINK
                  }
                >
                  Keep current:
                  {" "}
                  {
                    location.mapId
                  }
                  {" / "}
                  {
                    location.mapNodeId
                  }
                </option>
              )}

              <option value="">
                Not linked
              </option>

              {storageNodes.map(
                (node) => {

                  const linkedLocation =
                    getLinkedLocation(
                      node.id
                    );

                  return (
                    <option
                      key={
                        node.id
                      }
                      value={
                        node.id
                      }
                      disabled={Boolean(
                        linkedLocation
                      )}
                    >
                      {node.id}
                      {" - "}
                      {node.name}

                      {linkedLocation
                        ? ` (Linked to ${linkedLocation.code})`
                        : ""}
                    </option>
                  );
                }
              )}

            </select>

            <small className="location-field-help">

              Active map:
              {" "}
              {activeMap?.name ||
                "No map"}

              {activeMap?.mapId
                ? ` (${activeMap.mapId})`
                : ""}

              . Only STORAGE
              nodes can be
              linked.

            </small>

          </label>

          {/* HIK RCS MAPPING */}

          <FormField
            label="HIK RCS Point Code"
            value={
              form.rcsPointCode
            }
            placeholder="RCS Point No. / Site Code"
            onChange={(
              value
            ) =>
              updateField(
                "rcsPointCode",
                value
              )
            }
          />

          <FormField
            label="HIK RCS Map Code"
            value={
              form.rcsMapCode
            }
            placeholder="Optional RCS Map No."
            onChange={(
              value
            ) =>
              updateField(
                "rcsMapCode",
                value
              )
            }
          />

          <label className="location-field">
            <span>
              HIK RCS Target Type
            </span>

            <select
              value={form.rcsTargetType}
              onChange={(event) =>
                updateField(
                  "rcsTargetType",
                  event.target.value
                )
              }
            >
              <option value="SITE">
                SITE (Point)
              </option>
              <option value="STORAGE">
                STORAGE (Bin)
              </option>
            </select>

            <small className="location-field-help">
              Match this with the target type used by the HIK RCS point/bin configuration.
            </small>
          </label>

          {/* CAPACITY */}

          <FormField
            label="Capacity"
            type="number"
            min="1"
            value={
              form.capacity
            }
            onChange={(
              value
            ) =>
              updateField(
                "capacity",
                value
              )
            }
          />

          {/* USED */}

          <FormField
            label="Current Used"
            type="number"
            min="0"
            value={
              form.used
            }
            onChange={(
              value
            ) =>
              updateField(
                "used",
                value
              )
            }
          />

          {/* STATUS */}

          <label className="location-field">

            <span>
              Status
            </span>

            <select
              value={
                form.status
              }
              onChange={(
                event
              ) =>
                updateField(
                  "status",
                  event.target
                    .value
                )
              }
            >

              <option value="AVAILABLE">
                Available
              </option>

              <option
                value="FULL"
                disabled
              >
                Full (automatic)
              </option>

              <option value="BLOCKED">
                Blocked
              </option>

              <option value="MAINTENANCE">
                Maintenance
              </option>

            </select>

            <small className="location-field-help">
              FULL is calculated
              automatically when
              Used reaches Capacity.
            </small>

          </label>

          {/* TYPE */}

          <label className="location-field">

            <span>
              Location Type
            </span>

            <select
              value={
                form.type
              }
              onChange={(
                event
              ) =>
                updateField(
                  "type",
                  event.target
                    .value
                )
              }
            >

              <option value="STORAGE">
                Storage
              </option>

              <option value="PICKING">
                Picking
              </option>

              <option value="STAGING">
                Staging
              </option>

              <option value="BUFFER">
                Buffer
              </option>

              <option value="RECEIVING">
                Receiving
              </option>

              <option value="SHIPPING">
                Shipping
              </option>

            </select>

          </label>

          {/* NODE PREVIEW */}

          {selectedStorageNode && (
            <div className="location-node-preview location-form-full">

              <div>
                <MapPin
                  size={17}
                />

                <span>
                  Selected Map Node
                </span>
              </div>

              <strong>
                {
                  selectedStorageNode.id
                }
                {" · "}
                {
                  selectedStorageNode.name
                }
              </strong>

              <small>
                Position:
                {" ("}
                {
                  selectedStorageNode.x
                }
                {", "}
                {
                  selectedStorageNode.y
                }
                {") m"}

                {selectedStorageNode
                  .config
                  ?.zone
                  ? ` · Map zone: ${selectedStorageNode.config.zone}`
                  : ""}
              </small>

            </div>
          )}

          {/* ERROR */}

          {error && (
            <div className="location-form-error location-form-full">

              <AlertTriangle
                size={16}
              />

              <span>
                {error}
              </span>

            </div>
          )}

        </div>

        {/* ACTIONS */}

        <div className="location-modal-actions">

          <button
            type="button"
            className="location-cancel"
            onClick={
              onCancel
            }
          >
            Cancel
          </button>

          <button
            type="submit"
            className="location-save"
          >
            {location
              ? "Save Changes"
              : "Create Location"}
          </button>

        </div>

      </form>
    </div>
  );
}

/*
 * =====================================================
 * FORM FIELD
 * =====================================================
 */

function FormField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  min,
}) {
  return (
    <label className="location-field">

      <span>
        {label}
      </span>

      <input
        type={type}
        min={min}
        value={value}
        placeholder={
          placeholder
        }
        onChange={(
          event
        ) =>
          onChange(
            event.target.value
          )
        }
      />

    </label>
  );
}

/*
 * =====================================================
 * VALIDATE LOCATION
 * =====================================================
 */

function validateLocation({
  formData,
  editingId,
  locations,
  activeMap,
  activeStorageNodes,
  selectedLocation,
}) {
  const code =
    String(
      formData.code ||
        ""
    )
      .trim()
      .toUpperCase();

  const warehouse =
    String(
      formData.warehouse ||
        ""
    )
      .trim()
      .toUpperCase();

  const zone =
    String(
      formData.zone ||
        ""
    )
      .trim()
      .toUpperCase();

  const rack =
    String(
      formData.rack ||
        ""
    )
      .trim()
      .toUpperCase();

  const level =
    String(
      formData.level ||
        ""
    ).trim();

  const type =
    String(
      formData.type ||
        "STORAGE"
    )
      .trim()
      .toUpperCase();

  const rcsPointCode =
    String(
      formData.rcsPointCode ||
        ""
    ).trim();

  const rcsMapCode =
    String(
      formData.rcsMapCode ||
        ""
    ).trim();

  const rcsTargetType =
    ["SITE", "STORAGE"].includes(
      String(
        formData.rcsTargetType ||
          "SITE"
      ).toUpperCase()
    )
      ? String(
          formData.rcsTargetType ||
            "SITE"
        ).toUpperCase()
      : "SITE";

  const capacity =
    Number(
      formData.capacity
    );

  const used =
    Number(
      formData.used
    );

  /*
   * REQUIRED
   */

  if (
    !code ||
    !warehouse ||
    !zone ||
    !rack ||
    !level
  ) {
    return {
      ok: false,

      message:
        "Please enter Location Code, Warehouse, Zone, Rack and Level.",
    };
  }

  /*
   * DUPLICATE CODE
   */

  const duplicateCode =
    locations.some(
      (location) =>
        location.id !==
          editingId &&
        String(
          location.code
        )
          .trim()
          .toUpperCase() ===
          code
    );

  if (duplicateCode) {
    return {
      ok: false,

      message:
        `Location Code ${code} is already in use.`,
    };
  }

  /*
   * CAPACITY
   */

  if (
    !Number.isFinite(
      capacity
    ) ||
    capacity <= 0
  ) {
    return {
      ok: false,

      message:
        "Capacity must be greater than 0.",
    };
  }

  /*
   * USED
   */

  if (
    !Number.isFinite(
      used
    ) ||
    used < 0
  ) {
    return {
      ok: false,

      message:
        "Current Used must be 0 or greater.",
    };
  }

  if (
    used >
    capacity
  ) {
    return {
      ok: false,

      message:
        "Current Used cannot be greater than Capacity.",
    };
  }

  /*
   * =====================================================
   * MAP LINK
   * =====================================================
   */

  let mapId = "";

  let mapNodeId = "";

  /*
   * KEEP OLD LINK
   */

  if (
    formData.mapNodeId ===
    KEEP_EXISTING_LINK
  ) {
    mapId =
      selectedLocation
        ?.mapId || "";

    mapNodeId =
      selectedLocation
        ?.mapNodeId ||
      "";
  }

  /*
   * LINK ACTIVE MAP NODE
   */

  else if (
    formData.mapNodeId
  ) {
    if (!activeMap) {
      return {
        ok: false,

        message:
          "No active Warehouse Map is available.",
      };
    }

    const node =
      activeStorageNodes.find(
        (
          candidate
        ) =>
          candidate.id ===
          formData.mapNodeId
      );

    if (!node) {
      return {
        ok: false,

        message:
          "The selected node is not a valid STORAGE node on the active map.",
      };
    }

    /*
     * UNIQUE MAP NODE LINK
     */

    const alreadyLinked =
      locations.find(
        (location) =>
          location.id !==
            editingId &&
          location.mapId ===
            activeMap.mapId &&
          location.mapNodeId ===
            node.id
      );

    if (alreadyLinked) {
      return {
        ok: false,

        message:
          `${node.id} is already linked to ${alreadyLinked.code}.`,
      };
    }

    mapId =
      activeMap.mapId;

    mapNodeId =
      node.id;
  }

  /*
   * STATUS
   */

  const status =
    resolveLocationStatus(
      String(
        formData.status ||
          "AVAILABLE"
      ).toUpperCase(),
      used,
      capacity
    );

  return {
    ok: true,

    location: {
      code,
      warehouse,
      zone,
      rack,
      level,
      type,
      status,
      capacity,
      used,
      mapId,
      mapNodeId,
      rcsPointCode,
      rcsMapCode,
      rcsTargetType,
    },
  };
}

/*
 * =====================================================
 * STATUS
 * =====================================================
 */

function resolveLocationStatus(
  status,
  used,
  capacity
) {
  if (
    status ===
      "BLOCKED" ||
    status ===
      "MAINTENANCE"
  ) {
    return status;
  }

  if (
    used >=
    capacity
  ) {
    return "FULL";
  }

  return "AVAILABLE";
}

/*
 * =====================================================
 * NEXT LOCATION ID
 * =====================================================
 */

function getNextLocationId(
  locations
) {
  let highest = 0;

  for (
    const location
    of locations
  ) {
    const match =
      /^LOC-(\d+)$/i.exec(
        String(
          location.id ||
            ""
        )
      );

    if (!match) {
      continue;
    }

    highest =
      Math.max(
        highest,
        Number(
          match[1]
        )
      );
  }

  return `LOC-${String(
    highest + 1
  ).padStart(
    3,
    "0"
  )}`;
}

/*
 * =====================================================
 * GET MAP LINK
 * =====================================================
 */

function getLocationMapLink(
  location,
  mapSystem
) {
  const map =
    location.mapId
      ? mapSystem.maps?.[
          location.mapId
        ]
      : null;

  const node =
    map?.nodes?.find(
      (
        candidate
      ) =>
        candidate.id ===
        location.mapNodeId
    );

  return {
    map:
      map || null,

    node:
      node || null,
  };
}

/*
 * =====================================================
 * LOAD LOCATIONS
 * =====================================================
 */

function loadLocations() {
  try {
    const saved =
      localStorage.getItem(
        LOCATION_STORAGE_KEY
      );

    if (saved) {
      const parsed =
        JSON.parse(
          saved
        );

      if (
        Array.isArray(
          parsed
        )
      ) {
        return parsed.map(
          normalizeLocationRecord
        );
      }
    }
  } catch (error) {
    console.warn(
      "Could not load saved storage locations.",
      error
    );
  }

  return INITIAL_LOCATIONS.map(
    normalizeLocationRecord
  );
}

/*
 * =====================================================
 * NORMALIZE LOCATION
 * =====================================================
 */

function normalizeLocationRecord(
  location,
  index = 0
) {
  const capacity =
    Math.max(
      Number(
        location.capacity
      ) || 0,
      1
    );

  const used =
    Math.max(
      Math.min(
        Number(
          location.used
        ) || 0,
        capacity
      ),
      0
    );

  return {
    id:
      String(
        location.id ||
          `LOC-${String(
            index + 1
          ).padStart(
            3,
            "0"
          )}`
      ),

    code:
      String(
        location.code ||
          ""
      )
        .trim()
        .toUpperCase(),

    warehouse:
      String(
        location.warehouse ||
          "MAIN-WH"
      )
        .trim()
        .toUpperCase(),

    zone:
      String(
        location.zone ||
          ""
      )
        .trim()
        .toUpperCase(),

    rack:
      String(
        location.rack ||
          ""
      )
        .trim()
        .toUpperCase(),

    level:
      String(
        location.level ||
          "01"
      ).trim(),

    type:
      String(
        location.type ||
          "STORAGE"
      )
        .trim()
        .toUpperCase(),

    status:
      resolveLocationStatus(
        String(
          location.status ||
            "AVAILABLE"
        )
          .trim()
          .toUpperCase(),

        used,

        capacity
      ),

    capacity,

    used,

    mapId:
      String(
        location.mapId ||
          ""
      ),

    mapNodeId:
      String(
        location.mapNodeId ||
          ""
      ),

    rcsPointCode:
      String(
        location.rcsPointCode ||
          ""
      ).trim(),

    rcsMapCode:
      String(
        location.rcsMapCode ||
          ""
      ).trim(),

    rcsTargetType:
      ["SITE", "STORAGE"].includes(
        String(
          location.rcsTargetType ||
            "SITE"
        ).toUpperCase()
      )
        ? String(
            location.rcsTargetType ||
              "SITE"
          ).toUpperCase()
        : "SITE",
  };
}

/*
 * =====================================================
 * LOAD MAP EDITOR V12 LIBRARY
 * =====================================================
 */

function loadMapSystemSnapshot() {
  try {
    const saved =
      localStorage.getItem(
        MAP_LIBRARY_KEY
      );

    if (saved) {
      const parsed =
        JSON.parse(
          saved
        );

      const maps =
        parsed?.maps &&
        typeof parsed.maps ===
          "object"
          ? parsed.maps
          : {};

      const mapIds =
        Object.keys(
          maps
        );

      if (
        mapIds.length >
        0
      ) {
        const activeMapId =
          maps[
            parsed.activeMapId
          ]
            ? parsed.activeMapId
            : mapIds[0];

        return {
          activeMapId,

          maps,
        };
      }
    }
  } catch (error) {
    console.warn(
      "Could not read Warehouse Map library.",
      error
    );
  }

  /*
   * Fallback to INITIAL_MAP
   */

  return {
    activeMapId:
      INITIAL_MAP.mapId,

    maps: {
      [INITIAL_MAP.mapId]:
        structuredClone(
          INITIAL_MAP
        ),
    },
  };
}