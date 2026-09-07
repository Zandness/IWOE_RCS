import {
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

export default function MapToolbar({
  zoom,
  onZoomIn,
  onZoomOut,
  onFit,
  expanded,
  onToggleExpand,
}) {
  return (
    <div className="map-toolbar map-monitor-toolbar">
      <div className="map-toolbar-group">
        <span className="map-monitor-only-label">
          MONITOR ONLY
        </span>
      </div>

      <div className="map-toolbar-divider" />

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
    </div>
  );
}

function ToolbarButton({
  icon,
  label,
  title,
  onClick,
}) {
  return (
    <button
      type="button"
      title={title || label}
      className="map-toolbar-button"
      onClick={onClick}
    >
      {icon}
      {label && <span>{label}</span>}
    </button>
  );
}
