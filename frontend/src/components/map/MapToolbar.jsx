import {
  MousePointer2,
  MapPin,
  Link2,
  Undo2,
  Redo2,
  ZoomOut,
  ZoomIn,
  Maximize2,
  Minimize2,
  Save,
  Upload,
  Download,
  Trash2,
  RotateCcw,
  Pencil,
  Radio,
} from "lucide-react";

export default function MapToolbar({
  mode,
  setMode,

  tool,
  setTool,

  onDelete,

  onSave,
  onImport,
  onExport,
  onReset,

  onUndo,
  onRedo,

  canUndo,
  canRedo,

  zoom,

  onZoomIn,
  onZoomOut,

  onFit,

  expanded,
  onToggleExpand,
}) {
  return (
    <div className="map-toolbar">
      {/* MODE */}
      <div className="map-toolbar-group">
        <ToolbarButton
          active={mode === "edit"}
          icon={<Pencil size={14} />}
          label="Edit Map"
          onClick={() => setMode("edit")}
        />

        <ToolbarButton
          active={mode === "monitor"}
          icon={<Radio size={14} />}
          label="Monitor"
          onClick={() => setMode("monitor")}
        />
      </div>

      {/* EDIT TOOLS */}
      {mode === "edit" && (
        <>
          <div className="map-toolbar-divider" />

          <div className="map-toolbar-group">
            <ToolbarButton
              active={tool === "select"}
              icon={<MousePointer2 size={14} />}
              label="Select"
              onClick={() => setTool("select")}
            />

            <ToolbarButton
              active={tool === "node"}
              icon={<MapPin size={14} />}
              label="Node"
              onClick={() => setTool("node")}
            />

            <ToolbarButton
              active={tool === "connect"}
              icon={<Link2 size={14} />}
              label="Path"
              onClick={() => setTool("connect")}
            />
          </div>

          <div className="map-toolbar-divider" />

          {/* HISTORY */}
          <div className="map-toolbar-group">
            <ToolbarButton
              icon={<Undo2 size={14} />}
              label="Undo"
              disabled={!canUndo}
              onClick={onUndo}
            />

            <ToolbarButton
              icon={<Redo2 size={14} />}
              label="Redo"
              disabled={!canRedo}
              onClick={onRedo}
            />
          </div>
        </>
      )}

      <div className="map-toolbar-divider" />

      {/* VIEW */}
      <div className="map-toolbar-group">
        <ToolbarButton
          icon={<ZoomOut size={14} />}
          title="Zoom Out"
          onClick={onZoomOut}
        />

        <div className="map-toolbar-zoom">
          {Math.round(Number(zoom) * 100)}%
        </div>

        <ToolbarButton
          icon={<ZoomIn size={14} />}
          title="Zoom In"
          onClick={onZoomIn}
        />

        <ToolbarButton
          icon={<Maximize2 size={14} />}
          label="Fit"
          onClick={onFit}
        />

        <ToolbarButton
          icon={
            expanded ? (
              <Minimize2 size={14} />
            ) : (
              <Maximize2 size={14} />
            )
          }
          label={expanded ? "Collapse" : "Expand"}
          onClick={onToggleExpand}
        />
      </div>

      {/* ACTIONS */}
      {mode === "edit" && (
        <div className="map-toolbar-actions">
          <ToolbarButton
            primary
            icon={<Save size={14} />}
            label="Save"
            onClick={onSave}
          />

          <ToolbarButton
            icon={<Upload size={14} />}
            label="Import"
            onClick={onImport}
          />

          <ToolbarButton
            icon={<Download size={14} />}
            label="Export"
            onClick={onExport}
          />

          <ToolbarButton
            icon={<Trash2 size={14} />}
            label="Delete"
            onClick={onDelete}
          />

          <ToolbarButton
            icon={<RotateCcw size={14} />}
            label="Reset"
            onClick={onReset}
          />
        </div>
      )}
    </div>
  );
}

function ToolbarButton({
  icon,
  label,
  active = false,
  primary = false,
  disabled = false,
  title,
  onClick,
}) {
  return (
    <button
      type="button"
      title={title || label}
      disabled={disabled}
      className={[
        "map-toolbar-button",
        active ? "active" : "",
        primary ? "primary" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={onClick}
    >
      {icon}
      {label && <span>{label}</span>}
    </button>
  );
}