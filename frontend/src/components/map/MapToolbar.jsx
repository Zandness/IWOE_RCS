import {
  MousePointer2,
  MapPin,
  Link2,
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
        label="Add Node"
        onClick={() => setTool("node")}
      />

      <ToolbarButton
        active={tool === "connect"}
        icon={Link2}
        label="Connect"
        onClick={() => setTool("connect")}
      />

      <div className="toolbar-divider" />

      <ToolbarButton
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
  active,
  onClick,
}) {
  return (
    <button
      className={`map-tool-button ${
        active ? "active" : ""
      }`}
      onClick={onClick}
    >
      <Icon size={16} />

      <span>{label}</span>
    </button>
  );
}