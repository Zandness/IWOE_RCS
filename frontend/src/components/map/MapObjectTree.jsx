import {
  Circle,
  Diamond,
  Square,
  Triangle,
  BatteryCharging,
  DoorOpen,
  Clock3,
  House,
  Link2,
  ChevronDown,
} from "lucide-react";

export default function MapObjectTree({
  mapData,

  selectedNodeId,
  selectedEdgeId,

  onSelectNode,
  onSelectEdge,
}) {
  return (
    <aside className="panel map-object-tree">
      <div className="panel-header">
        <h3>Map Objects</h3>

        <span>
          {mapData.nodes.length +
            mapData.edges.length}
        </span>
      </div>

      <TreeSection
        title="Nodes"
        count={mapData.nodes.length}
      >
        {mapData.nodes.map((node) => {
          const Icon =
            getNodeIcon(
              node.type
            );

          return (
            <TreeItem
              key={node.id}
              icon={Icon}
              title={node.id}
              subtitle={`${node.name} • ${formatType(
                node.type
              )}`}
              active={
                selectedNodeId ===
                node.id
              }
              onClick={() =>
                onSelectNode(
                  node.id
                )
              }
            />
          );
        })}
      </TreeSection>

      <TreeSection
        title="Paths"
        count={mapData.edges.length}
      >
        {mapData.edges.map((edge) => (
          <TreeItem
            key={edge.id}
            icon={Link2}
            title={edge.id}
            subtitle={`${edge.from} → ${edge.to} • ${Number(
              edge.distance
            ).toFixed(2)} m`}
            active={
              selectedEdgeId ===
              edge.id
            }
            onClick={() =>
              onSelectEdge(
                edge.id
              )
            }
          />
        ))}
      </TreeSection>
    </aside>
  );
}


function TreeSection({
  title,
  count,
  children,
}) {
  return (
    <div className="tree-section">
      <div className="tree-section-header">
        <div>
          <ChevronDown
            size={13}
          />

          <strong>
            {title}
          </strong>
        </div>

        <span>
          {count}
        </span>
      </div>

      <div className="tree-section-content">
        {children}
      </div>
    </div>
  );
}


function TreeItem({
  icon: Icon,

  title,
  subtitle,

  active = false,

  onClick,
}) {
  return (
    <button
      type="button"
      className={`tree-item ${
        active
          ? "active"
          : ""
      }`}
      onClick={
        onClick
      }
    >
      <Icon
        size={14}
      />

      <div>
        <strong>
          {title}
        </strong>

        <span>
          {subtitle}
        </span>
      </div>
    </button>
  );
}


function getNodeIcon(
  type
) {
  switch (type) {
    case "ROAD":
      return Diamond;

    case "STORAGE":
      return Square;

    case "PICKUP":
      return Triangle;

    case "DROPOFF":
      return Triangle;

    case "CHARGING":
      return BatteryCharging;

    case "DOCK":
      return DoorOpen;

    case "WAITING":
      return Clock3;

    case "HOME":
      return House;

    default:
      return Circle;
  }
}


function formatType(
  type
) {
  switch (type) {
    case "WAYPOINT":
      return "Waypoint";

    case "ROAD":
      return "Road";

    case "STORAGE":
      return "Storage";

    case "PICKUP":
      return "Pickup";

    case "DROPOFF":
      return "Dropoff";

    case "CHARGING":
      return "Charging";

    case "DOCK":
      return "Dock";

    case "WAITING":
      return "Waiting";

    case "HOME":
      return "Home";

    default:
      return type;
  }
}