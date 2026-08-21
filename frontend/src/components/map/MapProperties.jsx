export default function MapProperties({
  mapData,

  selectedNode,

  onMapChange,
  onNodeChange,
}) {
  if (selectedNode) {
    return (
      <NodeProperties
        node={selectedNode}

        onNodeChange={
          onNodeChange
        }
      />
    );
  }

  return (
    <MapSettings
      mapData={mapData}

      onMapChange={
        onMapChange
      }
    />
  );
}


function MapSettings({
  mapData,
  onMapChange,
}) {
  return (
    <>
      <div className="panel-header">

        <h3>
          Map Properties
        </h3>

        <span>
          {mapData.mapId}
        </span>

      </div>

      <PropertyInput
        label="Map Name"

        value={
          mapData.name
        }

        onChange={(value) =>
          onMapChange(
            "name",
            value
          )
        }
      />

      <PropertyInput
        label="Warehouse Width"

        type="number"

        value={
          mapData.width
        }

        unit="m"

        onChange={(value) =>
          onMapChange(
            "width",
            Number(value)
          )
        }
      />

      <PropertyInput
        label="Warehouse Height"

        type="number"

        value={
          mapData.height
        }

        unit="m"

        onChange={(value) =>
          onMapChange(
            "height",
            Number(value)
          )
        }
      />

      <PropertyInput
        label="Grid Spacing"

        type="number"

        step="0.1"

        value={
          mapData.gridSpacing
        }

        unit="m"

        onChange={(value) =>
          onMapChange(
            "gridSpacing",
            Number(value)
          )
        }
      />

      <div className="map-property-summary">

        <div>
          <span>
            Nodes
          </span>

          <strong>
            {mapData.nodes.length}
          </strong>
        </div>

        <div>
          <span>
            Paths
          </span>

          <strong>
            {mapData.edges.length}
          </strong>
        </div>

      </div>

      <div className="map-help-box">
        All warehouse objects are represented as nodes.
        Select a node and change its type to define
        waypoint, storage, charging, dock or other functions.
      </div>
    </>
  );
}


function NodeProperties({
  node,
  onNodeChange,
}) {
  const config =
    node.config || {};

  return (
    <>
      <div className="panel-header">

        <h3>
          Node Properties
        </h3>

        <span>
          {node.id}
        </span>

      </div>


      <PropertyInput
        label="Node Name"

        value={
          node.name
        }

        onChange={(value) =>
          onNodeChange(
            "name",
            value
          )
        }
      />


      <div className="property-group">

        <label className="property-label">
          Node Type
        </label>

        <select
          className="property-input"

          value={
            node.type
          }

          onChange={(event) =>
            onNodeChange(
              "type",
              event.target.value
            )
          }
        >

          <option value="WAYPOINT">
            Waypoint
          </option>

          <option value="ROAD">
            Road Point
          </option>

          <option value="STORAGE">
            Storage
          </option>

          <option value="PICKUP">
            Pickup
          </option>

          <option value="DROPOFF">
            Dropoff
          </option>

          <option value="CHARGING">
            Charging
          </option>

          <option value="DOCK">
            Dock
          </option>

          <option value="WAITING">
            Waiting
          </option>

          <option value="HOME">
            Home
          </option>

        </select>

      </div>


      <div className="property-section-title">
        Position
      </div>


      <PropertyInput
        label="X Position"

        type="number"

        step="0.1"

        value={
          node.x
        }

        unit="m"

        onChange={(value) =>
          onNodeChange(
            "x",
            Number(value)
          )
        }
      />


      <PropertyInput
        label="Y Position"

        type="number"

        step="0.1"

        value={
          node.y
        }

        unit="m"

        onChange={(value) =>
          onNodeChange(
            "y",
            Number(value)
          )
        }
      />


      <PropertyInput
        label="Rotation"

        type="number"

        step="5"

        value={
          node.rotation || 0
        }

        unit="°"

        onChange={(value) =>
          onNodeChange(
            "rotation",
            Number(value)
          )
        }
      />


      <div className="property-group">

        <label className="property-label">
          Enabled
        </label>

        <select
          className="property-input"

          value={
            node.enabled
              ? "YES"
              : "NO"
          }

          onChange={(event) =>
            onNodeChange(
              "enabled",
              event.target.value ===
                "YES"
            )
          }
        >
          <option value="YES">
            Yes
          </option>

          <option value="NO">
            No
          </option>
        </select>

      </div>


      {node.type ===
        "STORAGE" && (

        <>
          <div className="property-section-title">
            Storage Configuration
          </div>

          <ConfigInput
            label="Width"

            value={
              config.width || 4
            }

            unit="m"

            onChange={(value) =>
              onNodeChange(
                "config.width",
                Number(value)
              )
            }
          />

          <ConfigInput
            label="Depth"

            value={
              config.depth || 2
            }

            unit="m"

            onChange={(value) =>
              onNodeChange(
                "config.depth",
                Number(value)
              )
            }
          />

          <ConfigInput
            label="Zone"

            value={
              config.zone || ""
            }

            onChange={(value) =>
              onNodeChange(
                "config.zone",
                value
              )
            }
          />

          <ConfigInput
            label="Levels"

            type="number"

            value={
              config.levels || 1
            }

            onChange={(value) =>
              onNodeChange(
                "config.levels",
                Number(value)
              )
            }
          />

          <ConfigInput
            label="Slots / Level"

            type="number"

            value={
              config.slotsPerLevel ||
              1
            }

            onChange={(value) =>
              onNodeChange(
                "config.slotsPerLevel",
                Number(value)
              )
            }
          />

          <div className="rack-slot-summary">

            <span>
              Total Storage Slots
            </span>

            <strong>
              {Number(
                config.levels ||
                  1
              ) *
                Number(
                  config.slotsPerLevel ||
                    1
                )}
            </strong>

          </div>
        </>
      )}


      {(node.type ===
        "CHARGING" ||
        node.type ===
          "DOCK") && (

        <>
          <div className="property-section-title">
            Station Configuration
          </div>

          <ConfigInput
            label="Width"

            value={
              config.width || 2
            }

            unit="m"

            onChange={(value) =>
              onNodeChange(
                "config.width",
                Number(value)
              )
            }
          />

          <ConfigInput
            label="Depth"

            value={
              config.depth || 2
            }

            unit="m"

            onChange={(value) =>
              onNodeChange(
                "config.depth",
                Number(value)
              )
            }
          />

          {node.type ===
            "CHARGING" && (

            <ConfigInput
              label="Charger ID"

              value={
                config.chargerId ||
                ""
              }

              onChange={(value) =>
                onNodeChange(
                  "config.chargerId",
                  value
                )
              }
            />

          )}
        </>
      )}


      <div className="map-help-box">
        Changing the Node Type changes only its
        visual style and configuration. Existing
        paths remain connected to the same Node ID.
      </div>

    </>
  );
}


function ConfigInput({
  label,

  value,

  type = "text",

  unit,

  onChange,
}) {
  return (
    <PropertyInput
      label={label}

      value={value}

      type={type}

      unit={unit}

      step={
        type === "number"
          ? "0.1"
          : undefined
      }

      onChange={
        onChange
      }
    />
  );
}


function PropertyInput({
  label,

  value,

  type = "text",

  min,
  max,
  step,

  unit,

  onChange,
}) {
  return (
    <div className="property-group">

      <label className="property-label">
        {label}
      </label>

      <div className="property-input-wrapper">

        <input
          className="property-input"

          type={type}

          value={value}

          min={min}
          max={max}
          step={step}

          onChange={(event) =>
            onChange(
              event.target.value
            )
          }
        />

        {unit && (
          <span className="property-unit">
            {unit}
          </span>
        )}

      </div>

    </div>
  );
}