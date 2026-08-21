import {
  Circle,
  Link2,
  Boxes,
  BatteryCharging,
  DoorOpen,
  ChevronDown,
} from "lucide-react";

export default function MapObjectTree({
  mapData,
  selectedNodeId,
  selectedObject,
  onSelectNode,
  onSelectObject,
}) {
  return (
    <aside className="panel map-object-tree">
      <div className="panel-header">
        <h3>Map Objects</h3>

        <span>
          {mapData.nodes.length +
            mapData.edges.length +
            mapData.racks.length +
            mapData.stations.length}
        </span>
      </div>

      <TreeSection
        title="Nodes"
        count={mapData.nodes.length}
      >
        {mapData.nodes.map((node) => (
          <TreeItem
            key={node.id}
            icon={Circle}
            title={node.id}
            subtitle={node.name}
            active={selectedNodeId === node.id}
            onClick={() => onSelectNode(node.id)}
          />
        ))}
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
            subtitle={`${edge.from} → ${edge.to}`}
          />
        ))}
      </TreeSection>

      <TreeSection
        title="Racks"
        count={mapData.racks.length}
      >
        {mapData.racks.map((rack) => (
          <TreeItem
            key={rack.id}
            icon={Boxes}
            title={rack.id}
            subtitle={rack.name}
            active={
              selectedObject?.type === "rack" &&
              selectedObject?.id === rack.id
            }
            onClick={() =>
              onSelectObject({
                type: "rack",
                id: rack.id,
              })
            }
          />
        ))}
      </TreeSection>

      <TreeSection
        title="Stations"
        count={mapData.stations.length}
      >
        {mapData.stations.map((station) => {
          const Icon =
            station.type === "CHARGING"
              ? BatteryCharging
              : DoorOpen;

          return (
            <TreeItem
              key={station.id}
              icon={Icon}
              title={station.id}
              subtitle={station.name}
              active={
                selectedObject?.type === "station" &&
                selectedObject?.id === station.id
              }
              onClick={() =>
                onSelectObject({
                  type: "station",
                  id: station.id,
                })
              }
            />
          );
        })}
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
          <ChevronDown size={13} />
          <strong>{title}</strong>
        </div>

        <span>{count}</span>
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
        active ? "active" : ""
      }`}
      onClick={onClick}
    >
      <Icon size={14} />

      <div>
        <strong>{title}</strong>
        <span>{subtitle}</span>
      </div>
    </button>
  );
}