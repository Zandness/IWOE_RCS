export default function MapObjectProperties({
  object,
  objectType,
  onChange,
}) {
  if (!object) {
    return null;
  }

  const isRack =
    objectType === "rack";

  return (
    <>
      <div className="panel-header">
        <h3>
          {isRack
            ? "Rack Properties"
            : "Station Properties"}
        </h3>

        <span>
          {object.id}
        </span>
      </div>

      <PropertyInput
        label="Name"
        value={object.name}
        onChange={(value) =>
          onChange(
            "name",
            value
          )
        }
      />

      {!isRack && (
        <div className="property-readonly">
          <span>Type</span>

          <strong>
            {object.type}
          </strong>
        </div>
      )}

      <div className="property-section-title">
        Position
      </div>

      <PropertyInput
        label="X Position"
        value={object.x}
        type="number"
        step="0.1"
        unit="m"
        onChange={(value) =>
          onChange(
            "x",
            Number(value)
          )
        }
      />

      <PropertyInput
        label="Y Position"
        value={object.y}
        type="number"
        step="0.1"
        unit="m"
        onChange={(value) =>
          onChange(
            "y",
            Number(value)
          )
        }
      />

      <div className="property-section-title">
        Dimensions
      </div>

      <PropertyInput
        label="Width"
        value={object.width}
        type="number"
        min="0.1"
        step="0.1"
        unit="m"
        onChange={(value) =>
          onChange(
            "width",
            Number(value)
          )
        }
      />

      <PropertyInput
        label="Depth"
        value={object.depth}
        type="number"
        min="0.1"
        step="0.1"
        unit="m"
        onChange={(value) =>
          onChange(
            "depth",
            Number(value)
          )
        }
      />

      <PropertyInput
        label="Rotation"
        value={object.rotation}
        type="number"
        step="5"
        unit="°"
        onChange={(value) =>
          onChange(
            "rotation",
            Number(value)
          )
        }
      />

      {isRack && (
        <>
          <div className="property-section-title">
            Storage Configuration
          </div>

          <PropertyInput
            label="Levels"
            value={object.levels}
            type="number"
            min="1"
            step="1"
            onChange={(value) =>
              onChange(
                "levels",
                Number(value)
              )
            }
          />

          <PropertyInput
            label="Slots / Level"
            value={
              object.slotsPerLevel
            }
            type="number"
            min="1"
            step="1"
            onChange={(value) =>
              onChange(
                "slotsPerLevel",
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
                object.levels ||
                  0
              ) *
                Number(
                  object.slotsPerLevel ||
                    0
                )}
            </strong>
          </div>
        </>
      )}
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