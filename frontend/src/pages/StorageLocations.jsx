import {
  MapPin,
  Plus,
  Search,
  Warehouse,
  Boxes,
  Layers3,
  Pencil,
  Trash2,
} from "lucide-react";

import { useMemo, useState } from "react";

import "../styles/StorageLocations.css";


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
    mapNodeId: "P001",
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
    mapNodeId: "P002",
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
    mapNodeId: "P003",
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
    mapNodeId: "P004",
  },
];


export default function StorageLocations() {
  const [locations, setLocations] =
    useState(INITIAL_LOCATIONS);

  const [search, setSearch] =
    useState("");

  const [selectedLocation, setSelectedLocation] =
    useState(null);

  const [showForm, setShowForm] =
    useState(false);


  const filteredLocations =
    useMemo(() => {
      const query =
        search.trim().toLowerCase();

      if (!query) {
        return locations;
      }

      return locations.filter((location) => {
        return [
          location.id,
          location.code,
          location.warehouse,
          location.zone,
          location.rack,
          location.status,
          location.mapNodeId,
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);
      });
    }, [locations, search]);


  const totalCapacity =
    locations.reduce(
      (sum, location) =>
        sum + location.capacity,
      0
    );


  const totalUsed =
    locations.reduce(
      (sum, location) =>
        sum + location.used,
      0
    );


  const availableLocations =
    locations.filter(
      (location) =>
        location.status === "AVAILABLE"
    ).length;


  function handleDelete(id) {
    const confirmed =
      window.confirm(
        `Delete location ${id}?`
      );

    if (!confirmed) {
      return;
    }

    setLocations((current) =>
      current.filter(
        (location) =>
          location.id !== id
      )
    );

    if (
      selectedLocation?.id === id
    ) {
      setSelectedLocation(null);
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
    if (selectedLocation) {
      setLocations((current) =>
        current.map((location) =>
          location.id ===
          selectedLocation.id
            ? {
                ...location,
                ...formData,
              }
            : location
        )
      );
    } else {
      const nextNumber =
        locations.length + 1;

      const newLocation = {
        id: `LOC-${String(
          nextNumber
        ).padStart(3, "0")}`,

        ...formData,
      };

      setLocations((current) => [
        ...current,
        newLocation,
      ]);
    }

    setShowForm(false);
    setSelectedLocation(null);
  }


  return (
    <div className="locations-page">

      {/* ================================
          PAGE HEADER
      ================================= */}

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
            racks, bins and map-linked
            storage locations.
          </p>
        </div>


        <button
          className="location-add-button"
          onClick={handleAddLocation}
        >
          <Plus size={18} />

          Add Location
        </button>

      </div>


      {/* ================================
          SUMMARY
      ================================= */}

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


      {/* ================================
          MAIN PANEL
      ================================= */}

      <section className="location-panel">

        <div className="location-panel-header">

          <div>
            <h3>
              Location Directory
            </h3>

            <p>
              Warehouse storage structure
              and map node assignment.
            </p>
          </div>


          <div className="location-search">

            <Search size={17} />

            <input
              type="text"
              placeholder="Search location..."
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
            />

          </div>

        </div>


        {/* ================================
            TABLE
        ================================= */}

        <div className="location-table-wrapper">

          <table className="location-table">

            <thead>
              <tr>
                <th>Location</th>
                <th>Zone</th>
                <th>Rack</th>
                <th>Level</th>
                <th>Map Node</th>
                <th>Capacity</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>


            <tbody>

              {filteredLocations.map(
                (location) => {

                  const percentage =
                    location.capacity > 0
                      ? Math.min(
                          100,
                          Math.round(
                            (
                              location.used /
                              location.capacity
                            ) * 100
                          )
                        )
                      : 0;


                  return (
                    <tr
                      key={location.id}
                      onClick={() =>
                        setSelectedLocation(
                          location
                        )
                      }
                    >

                      <td>
                        <div className="location-code-cell">

                          <div className="location-icon">
                            <MapPin size={17} />
                          </div>

                          <div>
                            <strong>
                              {location.code}
                            </strong>

                            <span>
                              {location.id}
                            </span>
                          </div>

                        </div>
                      </td>


                      <td>
                        {location.zone}
                      </td>


                      <td>
                        {location.rack}
                      </td>


                      <td>
                        {location.level}
                      </td>


                      <td>
                        <span className="map-node-badge">
                          {location.mapNodeId ||
                            "Not linked"}
                        </span>
                      </td>


                      <td>

                        <div className="capacity-cell">

                          <div>
                            <span>
                              {location.used}
                            </span>

                            <span>
                              /
                              {location.capacity}
                            </span>
                          </div>


                          <div className="capacity-track">

                            <div
                              className="capacity-fill"
                              style={{
                                width:
                                  `${percentage}%`,
                              }}
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
                            title="Edit"
                            onClick={(event) => {
                              event.stopPropagation();

                              handleEdit(
                                location
                              );
                            }}
                          >
                            <Pencil size={16} />
                          </button>


                          <button
                            title="Delete"
                            onClick={(event) => {
                              event.stopPropagation();

                              handleDelete(
                                location.id
                              );
                            }}
                          >
                            <Trash2 size={16} />
                          </button>

                        </div>

                      </td>

                    </tr>
                  );
                }
              )}

            </tbody>

          </table>


          {filteredLocations.length === 0 && (
            <div className="location-empty">
              No storage locations found.
            </div>
          )}

        </div>

      </section>


      {/* ================================
          ADD / EDIT FORM
      ================================= */}

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
 * LOCATION FORM
 * =====================================================
 */

function LocationForm({
  location,
  onSave,
  onCancel,
}) {
  const [form, setForm] =
    useState({
      code:
        location?.code || "",

      warehouse:
        location?.warehouse ||
        "MAIN-WH",

      zone:
        location?.zone || "",

      rack:
        location?.rack || "",

      level:
        location?.level || "01",

      type:
        location?.type ||
        "STORAGE",

      status:
        location?.status ||
        "AVAILABLE",

      capacity:
        location?.capacity || 100,

      used:
        location?.used || 0,

      mapNodeId:
        location?.mapNodeId || "",
    });


  function updateField(
    field,
    value
  ) {
    setForm((current) => ({
      ...current,

      [field]: value,
    }));
  }


  function handleSubmit(event) {
    event.preventDefault();

    if (
      !form.code.trim() ||
      !form.zone.trim() ||
      !form.rack.trim()
    ) {
      alert(
        "Please enter Location Code, Zone and Rack."
      );

      return;
    }


    onSave({
      ...form,

      capacity:
        Number(form.capacity),

      used:
        Number(form.used),
    });
  }


  return (
    <div className="location-modal-backdrop">

      <form
        className="location-modal"
        onSubmit={handleSubmit}
      >

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
            onClick={onCancel}
          >
            ×
          </button>

        </div>


        <div className="location-form-grid">

          <FormField
            label="Location Code"
            value={form.code}
            placeholder="A01-01"
            onChange={(value) =>
              updateField(
                "code",
                value
              )
            }
          />


          <FormField
            label="Warehouse"
            value={form.warehouse}
            placeholder="MAIN-WH"
            onChange={(value) =>
              updateField(
                "warehouse",
                value
              )
            }
          />


          <FormField
            label="Zone"
            value={form.zone}
            placeholder="ZONE-A"
            onChange={(value) =>
              updateField(
                "zone",
                value
              )
            }
          />


          <FormField
            label="Rack"
            value={form.rack}
            placeholder="RACK-A01"
            onChange={(value) =>
              updateField(
                "rack",
                value
              )
            }
          />


          <FormField
            label="Level"
            value={form.level}
            placeholder="01"
            onChange={(value) =>
              updateField(
                "level",
                value
              )
            }
          />


          <FormField
            label="Map Node ID"
            value={form.mapNodeId}
            placeholder="P001"
            onChange={(value) =>
              updateField(
                "mapNodeId",
                value
              )
            }
          />


          <FormField
            label="Capacity"
            type="number"
            value={form.capacity}
            onChange={(value) =>
              updateField(
                "capacity",
                value
              )
            }
          />


          <FormField
            label="Current Used"
            type="number"
            value={form.used}
            onChange={(value) =>
              updateField(
                "used",
                value
              )
            }
          />


          <label className="location-field">

            <span>Status</span>

            <select
              value={form.status}

              onChange={(event) =>
                updateField(
                  "status",
                  event.target.value
                )
              }
            >
              <option value="AVAILABLE">
                Available
              </option>

              <option value="FULL">
                Full
              </option>

              <option value="BLOCKED">
                Blocked
              </option>

              <option value="MAINTENANCE">
                Maintenance
              </option>
            </select>

          </label>


          <label className="location-field">

            <span>Location Type</span>

            <select
              value={form.type}

              onChange={(event) =>
                updateField(
                  "type",
                  event.target.value
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
            </select>

          </label>

        </div>


        <div className="location-modal-actions">

          <button
            type="button"
            className="location-cancel"
            onClick={onCancel}
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
}) {
  return (
    <label className="location-field">

      <span>
        {label}
      </span>

      <input
        type={type}
        value={value}
        placeholder={placeholder}

        onChange={(event) =>
          onChange(
            event.target.value
          )
        }
      />

    </label>
  );
}