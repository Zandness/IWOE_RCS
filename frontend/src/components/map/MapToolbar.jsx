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
  Save,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Scan,
  Pencil,
  Radio,
} from "lucide-react";

export default function MapToolbar({
  mode,
  setMode,

  tool,
  setTool,

  onDelete,
  onExport,
  onReset,
  onSave,

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
  const editing =
    mode === "edit";

  return (
    <div className="map-toolbar">

      {/* MODE */}

      <ToolbarButton
        icon={Pencil}
        label="Edit Map"
        active={
          mode === "edit"
        }
        onClick={() =>
          setMode("edit")
        }
      />

      <ToolbarButton
        icon={Radio}
        label="Monitor"
        active={
          mode === "monitor"
        }
        onClick={() =>
          setMode("monitor")
        }
      />

      <div className="toolbar-divider" />

      {/* EDIT TOOLS */}

      {editing && (
        <>
          <ToolbarButton
            active={
              tool === "select"
            }
            icon={MousePointer2}
            label="Select"
            onClick={() =>
              setTool("select")
            }
          />

          <ToolbarButton
            active={
              tool === "node"
            }
            icon={MapPin}
            label="Node"
            onClick={() =>
              setTool("node")
            }
          />

          <ToolbarButton
            active={
              tool === "connect"
            }
            icon={Link2}
            label="Path"
            onClick={() =>
              setTool("connect")
            }
          />

          <ToolbarButton
            active={
              tool === "rack"
            }
            icon={Boxes}
            label="Rack"
            onClick={() =>
              setTool("rack")
            }
          />

          <ToolbarButton
            active={
              tool === "dock"
            }
            icon={DoorOpen}
            label="Dock"
            onClick={() =>
              setTool("dock")
            }
          />

          <ToolbarButton
            active={
              tool === "charging"
            }
            icon={
              BatteryCharging
            }
            label="Charge"
            onClick={() =>
              setTool(
                "charging"
              )
            }
          />

          <div className="toolbar-divider" />

          <ToolbarButton
            icon={Undo2}
            label="Undo"
            disabled={
              !canUndo
            }
            onClick={
              onUndo
            }
          />

          <ToolbarButton
            icon={Redo2}
            label="Redo"
            disabled={
              !canRedo
            }
            onClick={
              onRedo
            }
          />
        </>
      )}

      <div className="toolbar-divider" />

      {/* ZOOM */}

      <ToolbarButton
        icon={ZoomOut}
        label="-"
        onClick={
          onZoomOut
        }
      />

      <div className="zoom-display">
        {Math.round(
          zoom * 100
        )}
        %
      </div>

      <ToolbarButton
        icon={ZoomIn}
        label="+"
        onClick={
          onZoomIn
        }
      />

      <ToolbarButton
        icon={Scan}
        label="Fit"
        onClick={
          onFit
        }
      />

      <ToolbarButton
        icon={
          expanded
            ? Minimize2
            : Maximize2
        }
        label={
          expanded
            ? "Collapse"
            : "Expand"
        }
        onClick={
          onToggleExpand
        }
      />

      <div className="toolbar-spacer" />

      {/* FILE */}

      {editing && (
        <>
          <ToolbarButton
            primary
            icon={Save}
            label="Save"
            onClick={
              onSave
            }
          />

          <ToolbarButton
            icon={Download}
            label="Export"
            onClick={
              onExport
            }
          />

          <ToolbarButton
            danger
            icon={Trash2}
            label="Delete"
            onClick={
              onDelete
            }
          />

          <ToolbarButton
            icon={RotateCcw}
            label="Reset"
            onClick={
              onReset
            }
          />
        </>
      )}
    </div>
  );
}


function ToolbarButton({
  icon: Icon,
  label,

  active = false,
  danger = false,
  primary = false,
  disabled = false,

  onClick,
}) {
  return (
    <button
      type="button"

      disabled={
        disabled
      }

      className={[
        "map-tool-button",

        active
          ? "active"
          : "",

        danger
          ? "danger"
          : "",

        primary
          ? "primary"
          : "",
      ].join(" ")}

      onClick={
        onClick
      }
    >
      <Icon
        size={16}
      />

      <span>
        {label}
      </span>
    </button>
  );
}