import {
  MousePointer2,
  MapPin,
  Link2,
  Boxes,
  DoorOpen,
  BatteryCharging,
  Trash2,
  Download,
  RotateCcw,
} from "lucide-react";

export default function MapToolbar({
  tool,
  setTool,
  onDelete,
  onExport,
  onReset,
}) {
  return (
    <div className="map-toolbar">
      <ToolbarButton
        active={tool === "select"}
        icon={MousePointer2}
        label="Select"
        onClick={() => setTool("select")}
      />

      <ToolbarButton
        active={tool === "node"}
        icon={MapPin}
        label="Node"
        onClick={() => setTool("node")}
      />

      <ToolbarButton
        active={tool === "connect"}
        icon={Link2}
        label="Path"
        onClick={() => setTool("connect")}
      />

      <div className="toolbar-divider" />

      <ToolbarButton
        active={tool === "rack"}
        icon={Boxes}
        label="Rack"
        onClick={() => setTool("rack")}
      />

      <ToolbarButton
        active={tool === "dock"}
        icon={DoorOpen}
        label="Dock"
        onClick={() => setTool("dock")}
      />

      <ToolbarButton
        active={tool === "charging"}
        icon={BatteryCharging}
        label="Charge"
        onClick={() => setTool("charging")}
      />

      <div className="toolbar-spacer" />

      <ToolbarButton
        danger
        icon={Trash2}
        label="Delete"
        onClick={onDelete}
      />

      <ToolbarButton
        icon={Download}
        label="Export JSON"
        onClick={onExport}
      />

      <ToolbarButton
        icon={RotateCcw}
        label="Reset"
        onClick={onReset}
      />
    </div>
  );
}

function ToolbarButton({
  icon: Icon,
  label,
  active = false,
  danger = false,
  onClick,
}) {
  return (
    <button
      type="button"
      className={[
        "map-tool-button",
        active ? "active" : "",
        danger ? "danger" : "",
      ].join(" ")}
      onClick={onClick}
    >
      <Icon size={16} />

      <span>{label}</span>
    </button>
  );
}