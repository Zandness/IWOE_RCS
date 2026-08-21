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
      onMapChange={onMapChange}
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
        <h3>Map Properties</h3>

        <span>
          {mapData.mapId}
        </span>
      </div>

      <PropertyInput
        label="Map Name"
        value={mapData.name}
        onChange={(value) =>
          onMapChange(
            "name",
            value
          )
        }
      />

      <PropertyInput
        label="Width"
        type="number"
        min="1"
        step="1"
        value={mapData.width}
        unit="m"
        onChange={(value) =>
          onMapChange(
            "width",
            Number(value)
          )
        }
      />

      <PropertyInput
        label="Height"
        type="number"
        min="1"
        step="1"
        value={mapData.height}
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
        min="0.1"
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
          <span>Nodes</span>

          <strong>
            {
              mapData.nodes
                .length
            }
          </strong>
        </div>

        <div>
          <span>Paths</span>

          <strong>
            {
              mapData.edges
                .length
            }
          </strong>
        </div>

        <div>
          <span>Racks</span>

          <strong>
            {
              mapData.racks
                .length
            }
          </strong>
        </div>

        <div>
          <span>
            Stations
          </span>

          <strong>
            {
              mapData.stations
                .length
            }
          </strong>
        </div>
      </div>

      <div className="map-help-box">
        Select an object on the
        map to edit its properties.
      </div>
    </>
  );
}

function NodeProperties({
  node,
  onNodeChange,
}) {
  return (
    <>
      <div className="panel-header">
        <h3>
          Node Properties
        </h3>

        <span>{node.id}</span>
      </div>

      <PropertyInput
        label="Node Name"
        value={node.name}
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
          value={node.type}
          onChange={(event) =>
            onNodeChange(
              "type",
              event.target.value
            )
          }
        >
          <option value="NORMAL">
            Normal
          </option>

          <option value="STORAGE">
            Storage
          </option>

          <option value="PICK">
            Pick
          </option>

          <option value="DROP">
            Drop
          </option>

          <option value="HOME">
            Home
          </option>

          <option value="WAITING">
            Waiting
          </option>

          <option value="CHARGING">
            Charging
          </option>
        </select>
      </div>

      <PropertyInput
        label="X Position"
        type="number"
        step="0.1"
        value={node.x}
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
        value={node.y}
        unit="m"
        onChange={(value) =>
          onNodeChange(
            "y",
            Number(value)
          )
        }
      />

      <div className="map-help-box">
        Drag the node on the map
        or change X/Y values
        manually.
      </div>
    </>
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