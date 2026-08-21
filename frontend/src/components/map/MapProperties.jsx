export default function MapProperties({
  mapData,

  selectedNode,
  selectedEdge,

  onMapChange,
  onNodeChange,
  onEdgeChange,
}) {
  /*
   * PATH PROPERTIES
   */

  if (selectedEdge) {
    return (
      <EdgeProperties
        edge={
          selectedEdge
        }

        onEdgeChange={
          onEdgeChange
        }
      />
    );
  }


  /*
   * NODE PROPERTIES
   */

  if (selectedNode) {
    return (
      <NodeProperties
        node={
          selectedNode
        }

        onNodeChange={
          onNodeChange
        }
      />
    );
  }


  /*
   * MAP PROPERTIES
   */

  return (
    <MapSettings
      mapData={
        mapData
      }

      onMapChange={
        onMapChange
      }
    />
  );
}


/* =====================================================
   MAP
===================================================== */

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

        step="0.1"

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

        step="0.1"

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

        Click a Node or Path once to edit it.
        Click an empty area of the map to return
        to Map Properties.

      </div>

    </>
  );
}


/* =====================================================
   NODE
===================================================== */

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


      <SelectInput
        label="Node Type"

        value={
          node.type
        }

        onChange={(value) =>
          onNodeChange(
            "type",
            value
          )
        }

        options={[
          [
            "WAYPOINT",
            "Waypoint",
          ],

          [
            "ROAD",
            "Road Point",
          ],

          [
            "STORAGE",
            "Storage",
          ],

          [
            "PICKUP",
            "Pickup",
          ],

          [
            "DROPOFF",
            "Dropoff",
          ],

          [
            "CHARGING",
            "Charging",
          ],

          [
            "DOCK",
            "Dock",
          ],

          [
            "WAITING",
            "Waiting",
          ],

          [
            "HOME",
            "Home",
          ],
        ]}
      />


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


      <SelectInput
        label="Enabled"

        value={
          node.enabled
            ? "YES"
            : "NO"
        }

        onChange={(value) =>
          onNodeChange(
            "enabled",
            value === "YES"
          )
        }

        options={[
          [
            "YES",
            "Yes",
          ],

          [
            "NO",
            "No",
          ],
        ]}
      />


      {/* STORAGE */}

      {node.type ===
        "STORAGE" && (

        <>

          <div className="property-section-title">
            Storage Configuration
          </div>


          <PropertyInput
            label="Width"

            type="number"

            step="0.1"

            value={
              config.width ??
              4
            }

            unit="m"

            onChange={(value) =>
              onNodeChange(
                "config.width",
                Number(value)
              )
            }
          />


          <PropertyInput
            label="Depth"

            type="number"

            step="0.1"

            value={
              config.depth ??
              2
            }

            unit="m"

            onChange={(value) =>
              onNodeChange(
                "config.depth",
                Number(value)
              )
            }
          />


          <PropertyInput
            label="Zone"

            value={
              config.zone ??
              ""
            }

            onChange={(value) =>
              onNodeChange(
                "config.zone",
                value
              )
            }
          />


          <PropertyInput
            label="Levels"

            type="number"

            value={
              config.levels ??
              4
            }

            onChange={(value) =>
              onNodeChange(
                "config.levels",
                Number(value)
              )
            }
          />


          <PropertyInput
            label="Slots / Level"

            type="number"

            value={
              config.slotsPerLevel ??
              6
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
                config.levels ??
                  4
              ) *
                Number(
                  config.slotsPerLevel ??
                    6
                )}
            </strong>

          </div>

        </>

      )}


      {/* CHARGING / DOCK */}

      {(node.type ===
        "CHARGING" ||
        node.type ===
          "DOCK") && (

        <>

          <div className="property-section-title">
            Station Configuration
          </div>


          <PropertyInput
            label="Width"

            type="number"

            step="0.1"

            value={
              config.width ??
              2
            }

            unit="m"

            onChange={(value) =>
              onNodeChange(
                "config.width",
                Number(value)
              )
            }
          />


          <PropertyInput
            label="Depth"

            type="number"

            step="0.1"

            value={
              config.depth ??
              2
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

            <PropertyInput
              label="Charger ID"

              value={
                config.chargerId ??
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

        Node ID stays the same when changing
        Node Type, so connected paths will not
        be removed.

      </div>

    </>
  );
}


/* =====================================================
   EDGE / PATH
===================================================== */

function EdgeProperties({
  edge,
  onEdgeChange,
}) {
  return (
    <>

      <div className="panel-header">

        <h3>
          Path Properties
        </h3>

        <span>
          {edge.id}
        </span>

      </div>


      <div className="property-readonly">

        <span>
          From Node
        </span>

        <strong>
          {edge.from}
        </strong>

      </div>


      <div className="property-readonly">

        <span>
          To Node
        </span>

        <strong>
          {edge.to}
        </strong>

      </div>


      <div className="property-section-title">
        Path Configuration
      </div>


      <SelectInput
        label="Path Type"

        value={
          edge.pathType ||
          "NORMAL"
        }

        onChange={(value) =>
          onEdgeChange(
            "pathType",
            value
          )
        }

        options={[
          [
            "NORMAL",
            "Normal",
          ],

          [
            "SLOW",
            "Slow Zone",
          ],

          [
            "RESTRICTED",
            "Restricted",
          ],

          [
            "EMERGENCY",
            "Emergency",
          ],
        ]}
      />


      <SelectInput
        label="Vehicle Access"

        value={
          edge.vehicleAccess ||
          "BOTH"
        }

        onChange={(value) =>
          onEdgeChange(
            "vehicleAccess",
            value
          )
        }

        options={[
          [
            "BOTH",
            "AMR & AGV",
          ],

          [
            "AMR",
            "AMR Only",
          ],

          [
            "AGV",
            "AGV Only",
          ],
        ]}
      />


      <SelectInput
        label="Direction"

        value={
          edge.bidirectional
            ? "BOTH"
            : "ONE"
        }

        onChange={(value) =>
          onEdgeChange(
            "bidirectional",
            value === "BOTH"
          )
        }

        options={[
          [
            "BOTH",
            "Bidirectional",
          ],

          [
            "ONE",
            `One Way (${edge.from} → ${edge.to})`,
          ],
        ]}
      />


      <PropertyInput
        label="Speed Limit"

        type="number"

        step="0.1"

        min="0"

        value={
          edge.speedLimit ??
          1.2
        }

        unit="m/s"

        onChange={(value) =>
          onEdgeChange(
            "speedLimit",
            Number(value)
          )
        }
      />


      <div className="property-section-title">
        Distance
      </div>


      <SelectInput
        label="Auto Distance"

        value={
          edge.autoDistance
            ? "YES"
            : "NO"
        }

        onChange={(value) =>
          onEdgeChange(
            "autoDistance",
            value === "YES"
          )
        }

        options={[
          [
            "YES",
            "Automatic",
          ],

          [
            "NO",
            "Manual",
          ],
        ]}
      />


      <PropertyInput
        label="Path Distance"

        type="number"

        step="0.01"

        min="0"

        value={
          edge.distance
        }

        unit="m"

        disabled={
          edge.autoDistance
        }

        onChange={(value) =>
          onEdgeChange(
            "distance",
            Number(value)
          )
        }
      />


      <SelectInput
        label="Enabled"

        value={
          edge.enabled !==
          false
            ? "YES"
            : "NO"
        }

        onChange={(value) =>
          onEdgeChange(
            "enabled",
            value === "YES"
          )
        }

        options={[
          [
            "YES",
            "Yes",
          ],

          [
            "NO",
            "No",
          ],
        ]}
      />


      <div className="path-rule-summary">

        <div>

          <span>
            TYPE
          </span>

          <strong>
            {formatPathType(
              edge.pathType
            )}
          </strong>

        </div>


        <div>

          <span>
            VEHICLE
          </span>

          <strong>
            {formatVehicle(
              edge.vehicleAccess
            )}
          </strong>

        </div>


        <div>

          <span>
            DIRECTION
          </span>

          <strong>
            {edge.bidirectional
              ? "Two Way"
              : "One Way"}
          </strong>

        </div>

      </div>

    </>
  );
}


/* =====================================================
   SELECT
===================================================== */

function SelectInput({
  label,
  value,
  options,
  onChange,
}) {
  return (
    <div className="property-group">

      <label className="property-label">
        {label}
      </label>


      <select
        className="property-input"

        value={
          value
        }

        onChange={(event) =>
          onChange(
            event.target.value
          )
        }
      >

        {options.map(
          ([
            optionValue,
            optionLabel,
          ]) => (

            <option
              key={
                optionValue
              }

              value={
                optionValue
              }
            >
              {optionLabel}
            </option>

          )
        )}

      </select>

    </div>
  );
}


/* =====================================================
   INPUT
===================================================== */

function PropertyInput({
  label,

  value,

  type = "text",

  min,
  max,
  step,

  unit,

  disabled = false,

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

          type={
            type
          }

          value={
            value ?? ""
          }

          min={
            min
          }

          max={
            max
          }

          step={
            step
          }

          disabled={
            disabled
          }

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


function formatPathType(
  type
) {
  switch (type) {

    case "SLOW":
      return "Slow";

    case "RESTRICTED":
      return "Restricted";

    case "EMERGENCY":
      return "Emergency";

    default:
      return "Normal";
  }
}


function formatVehicle(
  value
) {
  switch (value) {

    case "AMR":
      return "AMR";

    case "AGV":
      return "AGV";

    default:
      return "Both";
  }
}