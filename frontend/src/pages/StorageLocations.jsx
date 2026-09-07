import {
  Boxes,
  Layers3,
  MapPin,
  Pencil,
  Plus,
  Search,
  Trash2,
  Warehouse,
} from "lucide-react";

import { useEffect, useMemo, useState } from "react";

import "../styles/StorageLocations.css";

const LOCATION_STORAGE_KEY = "wms-storage-locations-v1";

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
    mapId: "",
    mapNodeId: "",
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
  const [search, setSearch] = useState("");
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  const filteredLocations = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return locations;
    }

    return locations.filter((location) =>
      [
        location.id,
        location.code,
        location.warehouse,
        location.zone,
        location.rack,
        location.level,
        location.type,
        location.status,
        location.rcsPointCode,
        location.rcsMapCode,
        location.rcsTargetType,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [locations, search]);

  const totalCapacity = locations.reduce(
    (sum, location) => sum + Number(location.capacity || 0),
    0
  );

  const totalUsed = locations.reduce(
    (sum, location) => sum + Number(location.used || 0),
    0
  );

  const availableLocations = locations.filter(
    (location) => location.status === "AVAILABLE"
  ).length;

  useEffect(() => {
    try {
      localStorage.setItem(
        LOCATION_STORAGE_KEY,
        JSON.stringify(locations)
      );

      window.dispatchEvent(
        new CustomEvent("wms-data-changed", {
          detail: {
            keys: [LOCATION_STORAGE_KEY],
          },
        })
      );

      setSaveMessage("Saved locally");
    } catch (error) {
      console.error("Could not save storage locations.", error);
      setSaveMessage("Local save failed");
    }
  }, [locations]);

  useEffect(() => {
    function handleStorage(event) {
      if (
        event.key === LOCATION_STORAGE_KEY &&
        event.newValue
      ) {
        setLocations(loadLocations());
      }
    }

    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  function handleDelete(id) {
    const target = locations.find((location) => location.id === id);

    const confirmed = window.confirm(
      `Delete location ${target?.code || id}?\n\nThis removes the WMS storage location record.`
    );

    if (!confirmed) {
      return;
    }

    setLocations((current) =>
      current.filter((location) => location.id !== id)
    );

    if (selectedLocation?.id === id) {
      setSelectedLocation(null);
      setShowForm(false);
    }
  }

  function handleAddLocation() {
    setSelectedLocation(null);
    setShowForm(true);
  }

  function handleEdit(location) {
    setSelectedLocation(location);
    setShowForm(true);
  }

  function handleSave(formData) {
    const editingId = selectedLocation?.id || null;

    const validation = validateLocation({
      formData,
      editingId,
      locations,
      selectedLocation,
    });

    if (!validation.ok) {
      return validation;
    }

    const normalized = validation.location;

    if (editingId) {
      setLocations((current) =>
        current.map((location) =>
          location.id === editingId
            ? {
                ...location,
                ...normalized,
              }
            : location
        )
      );
    } else {
      setLocations((current) => [
        ...current,
        {
          id: getNextLocationId(current),
          ...normalized,
        },
      ]);
    }

    setShowForm(false);
    setSelectedLocation(null);

    return { ok: true };
  }

  return (
    <div className="locations-page">
      <div className="locations-header">
        <div>
          <span className="locations-label">
            WAREHOUSE MANAGEMENT
          </span>

          <h2>Storage Locations</h2>

          <p>
            Manage warehouse zones, racks, levels and storage
            capacity. Map-node assignment is not required in this
            version.
          </p>
        </div>

        <div className="locations-header-actions">
          {saveMessage && (
            <span
              className={`location-save-state ${
                saveMessage.includes("failed") ? "error" : ""
              }`}
            >
              {saveMessage}
            </span>
          )}

          <button
            className="location-add-button"
            onClick={handleAddLocation}
          >
            <Plus size={18} />
            Add Location
          </button>
        </div>
      </div>

      <div className="location-summary-grid">
        <SummaryCard
          icon={<MapPin size={21} />}
          title="Locations"
          value={locations.length}
        />

        <SummaryCard
          icon={<Warehouse size={21} />}
          title="Available"
          value={availableLocations}
        />

        <SummaryCard
          icon={<Boxes size={21} />}
          title="Used Capacity"
          value={totalUsed}
        />

        <SummaryCard
          icon={<Layers3 size={21} />}
          title="Total Capacity"
          value={totalCapacity}
        />
      </div>

      <section className="location-panel">
        <div className="location-panel-header">
          <div>
            <h3>Location Directory</h3>
            <p>
              Warehouse storage structure and optional HIK RCS
              mapping.
            </p>
          </div>

          <div className="location-search">
            <Search size={17} />
            <input
              type="text"
              placeholder="Search location, rack or RCS point..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>

        <div className="location-table-wrapper">
          <table className="location-table">
            <thead>
              <tr>
                <th>Location</th>
                <th>Zone</th>
                <th>Rack</th>
                <th>Level</th>
                <th>HIK RCS Point</th>
                <th>Capacity</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>

            <tbody>
              {filteredLocations.map((location) => {
                const percentage =
                  location.capacity > 0
                    ? Math.min(
                        100,
                        Math.round(
                          (location.used / location.capacity) * 100
                        )
                      )
                    : 0;

                return (
                  <tr key={location.id}>
                    <td>
                      <div className="location-code-cell">
                        <div className="location-icon">
                          <MapPin size={17} />
                        </div>

                        <div>
                          <strong>{location.code}</strong>
                          <span>{location.id}</span>
                        </div>
                      </div>
                    </td>

                    <td>{location.zone}</td>
                    <td>{location.rack}</td>
                    <td>{location.level}</td>

                    <td>
                      <div className="rcs-point-cell">
                        <strong>
                          {location.rcsPointCode || "Not mapped"}
                        </strong>

                        <span>
                          {location.rcsPointCode
                            ? `${
                                location.rcsTargetType || "SITE"
                              }${
                                location.rcsMapCode
                                  ? ` · Map ${location.rcsMapCode}`
                                  : ""
                              }`
                            : "RCS mapping can be added later"}
                        </span>
                      </div>
                    </td>

                    <td>
                      <div className="capacity-cell">
                        <div>
                          <span>{location.used}</span>
                          <span>/{location.capacity}</span>
                        </div>

                        <div className="capacity-track">
                          <div
                            className="capacity-fill"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    <td>
                      <span
                        className={`location-status status-${location.status.toLowerCase()}`}
                      >
                        {location.status}
                      </span>
                    </td>

                    <td>
                      <div className="location-actions">
                        <button
                          type="button"
                          title="Edit"
                          onClick={() => handleEdit(location)}
                        >
                          <Pencil size={16} />
                        </button>

                        <button
                          type="button"
                          title="Delete"
                          onClick={() => handleDelete(location.id)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredLocations.length === 0 && (
            <div className="location-empty">
              No storage locations found.
            </div>
          )}
        </div>
      </section>

      {showForm && (
        <LocationForm
          location={selectedLocation}
          onSave={handleSave}
          onCancel={() => {
            setShowForm(false);
            setSelectedLocation(null);
          }}
        />
      )}
    </div>
  );
}

function SummaryCard({ icon, title, value }) {
  return (
    <div className="location-summary-card">
      <div className="summary-icon">{icon}</div>
      <div>
        <span>{title}</span>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

function LocationForm({ location, onSave, onCancel }) {
  const [form, setForm] = useState({
    code: location?.code || "",
    warehouse: location?.warehouse || "MAIN-WH",
    zone: location?.zone || "",
    rack: location?.rack || "",
    level: location?.level || "01",
    type: location?.type || "STORAGE",
    status: location?.status || "AVAILABLE",
    capacity: location?.capacity ?? 100,
    used: location?.used ?? 0,
    rcsPointCode: location?.rcsPointCode || "",
    rcsMapCode: location?.rcsMapCode || "",
    rcsTargetType: location?.rcsTargetType || "SITE",
  });

  const [error, setError] = useState("");

  function updateField(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));

    if (error) {
      setError("");
    }
  }

  function handleSubmit(event) {
    event.preventDefault();

    const result = onSave(form);

    if (!result?.ok) {
      setError(result?.message || "Could not save location.");
    }
  }

  return (
    <div
      className="location-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onCancel();
        }
      }}
    >
      <form className="location-modal" onSubmit={handleSubmit}>
        <div className="location-modal-header">
          <div>
            <span>LOCATION MANAGEMENT</span>
            <h3>{location ? "Edit Location" : "Add Location"}</h3>
          </div>

          <button
            type="button"
            className="location-close"
            onClick={onCancel}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="location-form-grid">
          <FormField
            label="Location Code"
            value={form.code}
            placeholder="A01-01"
            onChange={(value) => updateField("code", value)}
          />

          <FormField
            label="Warehouse"
            value={form.warehouse}
            placeholder="MAIN-WH"
            onChange={(value) => updateField("warehouse", value)}
          />

          <FormField
            label="Zone"
            value={form.zone}
            placeholder="ZONE-A"
            onChange={(value) => updateField("zone", value)}
          />

          <FormField
            label="Rack"
            value={form.rack}
            placeholder="RACK-A01"
            onChange={(value) => updateField("rack", value)}
          />

          <FormField
            label="Level"
            value={form.level}
            placeholder="01"
            onChange={(value) => updateField("level", value)}
          />

          <label className="location-field">
            <span>Location Type</span>
            <select
              value={form.type}
              onChange={(event) =>
                updateField("type", event.target.value)
              }
            >
              <option value="STORAGE">STORAGE</option>
              <option value="RECEIVING">RECEIVING</option>
              <option value="SHIPPING">SHIPPING</option>
              <option value="STAGING">STAGING</option>
            </select>
          </label>

          <FormField
            label="Capacity"
            type="number"
            min="1"
            value={form.capacity}
            onChange={(value) => updateField("capacity", value)}
          />

          <FormField
            label="Current Used"
            type="number"
            min="0"
            value={form.used}
            onChange={(value) => updateField("used", value)}
          />

          <label className="location-field">
            <span>Status</span>
            <select
              value={form.status}
              onChange={(event) =>
                updateField("status", event.target.value)
              }
            >
              <option value="AVAILABLE">AVAILABLE</option>
              <option value="FULL">FULL</option>
              <option value="BLOCKED">BLOCKED</option>
              <option value="MAINTENANCE">MAINTENANCE</option>
            </select>
          </label>

          <div className="location-form-full location-rcs-section-title">
            <strong>HIK RCS Mapping</strong>
            <span>
              Optional for now. This can be completed when the RCS
              location mapping is finalized.
            </span>
          </div>

          <FormField
            label="HIK RCS Point Code"
            value={form.rcsPointCode}
            placeholder="Optional RCS Point / Site Code"
            onChange={(value) => updateField("rcsPointCode", value)}
          />

          <FormField
            label="HIK RCS Map Code"
            value={form.rcsMapCode}
            placeholder="Optional RCS Map Code"
            onChange={(value) => updateField("rcsMapCode", value)}
          />

          <label className="location-field">
            <span>HIK RCS Target Type</span>
            <select
              value={form.rcsTargetType}
              onChange={(event) =>
                updateField("rcsTargetType", event.target.value)
              }
            >
              <option value="SITE">SITE (Point)</option>
              <option value="STORAGE">STORAGE (Bin)</option>
            </select>

            <small className="location-field-help">
              Map-node pinning is intentionally disabled in this
              version.
            </small>
          </label>
        </div>

        {error && (
          <div className="location-form-error">{error}</div>
        )}

        <div className="location-modal-actions">
          <button
            type="button"
            className="location-cancel"
            onClick={onCancel}
          >
            Cancel
          </button>

          <button type="submit" className="location-save">
            {location ? "Save Changes" : "Add Location"}
          </button>
        </div>
      </form>
    </div>
  );
}

function FormField({
  label,
  value,
  onChange,
  placeholder = "",
  type = "text",
  min,
}) {
  return (
    <label className="location-field">
      <span>{label}</span>
      <input
        type={type}
        min={min}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function validateLocation({
  formData,
  editingId,
  locations,
  selectedLocation,
}) {
  const code = String(formData.code || "").trim().toUpperCase();
  const warehouse = String(formData.warehouse || "")
    .trim()
    .toUpperCase();
  const zone = String(formData.zone || "").trim().toUpperCase();
  const rack = String(formData.rack || "").trim().toUpperCase();
  const level = String(formData.level || "").trim();
  const type = String(formData.type || "STORAGE")
    .trim()
    .toUpperCase();

  const rcsPointCode = String(formData.rcsPointCode || "").trim();
  const rcsMapCode = String(formData.rcsMapCode || "").trim();
  const rcsTargetType = ["SITE", "STORAGE"].includes(
    String(formData.rcsTargetType || "SITE").toUpperCase()
  )
    ? String(formData.rcsTargetType || "SITE").toUpperCase()
    : "SITE";

  const capacity = Number(formData.capacity);
  const used = Number(formData.used);

  if (!code || !warehouse || !zone || !rack || !level) {
    return {
      ok: false,
      message:
        "Please enter Location Code, Warehouse, Zone, Rack and Level.",
    };
  }

  const duplicateCode = locations.some(
    (location) =>
      location.id !== editingId &&
      String(location.code).trim().toUpperCase() === code
  );

  if (duplicateCode) {
    return {
      ok: false,
      message: `Location Code ${code} is already in use.`,
    };
  }

  if (!Number.isFinite(capacity) || capacity <= 0) {
    return {
      ok: false,
      message: "Capacity must be greater than 0.",
    };
  }

  if (!Number.isFinite(used) || used < 0) {
    return {
      ok: false,
      message: "Current Used must be 0 or greater.",
    };
  }

  if (used > capacity) {
    return {
      ok: false,
      message: "Current Used cannot be greater than Capacity.",
    };
  }

  const status = resolveLocationStatus(
    String(formData.status || "AVAILABLE").toUpperCase(),
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

      // Keep old map fields for data compatibility, but they are no
      // longer required or editable from Storage Locations.
      mapId: selectedLocation?.mapId || "",
      mapNodeId: selectedLocation?.mapNodeId || "",

      rcsPointCode,
      rcsMapCode,
      rcsTargetType,
    },
  };
}

function resolveLocationStatus(status, used, capacity) {
  if (status === "BLOCKED" || status === "MAINTENANCE") {
    return status;
  }

  if (used >= capacity) {
    return "FULL";
  }

  return "AVAILABLE";
}

function getNextLocationId(locations) {
  let highest = 0;

  locations.forEach((location) => {
    const match = String(location.id || "").match(/^LOC-(\d+)$/i);
    if (match) {
      highest = Math.max(highest, Number(match[1]));
    }
  });

  return `LOC-${String(highest + 1).padStart(3, "0")}`;
}

function loadLocations() {
  try {
    const saved = localStorage.getItem(LOCATION_STORAGE_KEY);

    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return parsed.map((location, index) =>
          normalizeLocation(location, index)
        );
      }
    }
  } catch (error) {
    console.error("Could not load saved storage locations.", error);
  }

  return INITIAL_LOCATIONS.map((location, index) =>
    normalizeLocation(location, index)
  );
}

function normalizeLocation(location, index) {
  const capacity = Number(location?.capacity || 0);
  const used = Number(location?.used || 0);

  return {
    id: String(
      location?.id || `LOC-${String(index + 1).padStart(3, "0")}`
    ),
    code: String(location?.code || "").toUpperCase(),
    warehouse: String(location?.warehouse || "MAIN-WH").toUpperCase(),
    zone: String(location?.zone || "").toUpperCase(),
    rack: String(location?.rack || "").toUpperCase(),
    level: String(location?.level || "01"),
    type: String(location?.type || "STORAGE").toUpperCase(),
    status: resolveLocationStatus(
      String(location?.status || "AVAILABLE").toUpperCase(),
      used,
      capacity
    ),
    capacity,
    used,

    // Legacy fields are retained only so older saved data does not
    // break other modules. Storage Locations no longer requires a
    // WMS map node assignment.
    mapId: String(location?.mapId || ""),
    mapNodeId: String(location?.mapNodeId || ""),

    rcsPointCode: String(location?.rcsPointCode || ""),
    rcsMapCode: String(location?.rcsMapCode || ""),
    rcsTargetType: ["SITE", "STORAGE"].includes(
      String(location?.rcsTargetType || "SITE").toUpperCase()
    )
      ? String(location?.rcsTargetType || "SITE").toUpperCase()
      : "SITE",
  };
}
