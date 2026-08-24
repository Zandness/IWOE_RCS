import { useRef, useState } from "react";
import {
  FilePlus2,
  Save,
  Copy,
  FolderOpen,
  Upload,
  Trash2,
  X,
  Map,
} from "lucide-react";

export default function MapManager({
  maps,
  activeMapId,
  currentMap,
  saveStatus,
  onNew,
  onSave,
  onSaveAs,
  onLoad,
  onDelete,
  onImport,
}) {
  const fileInputRef = useRef(null);
  const [dialog, setDialog] = useState(null);
  const [mapName, setMapName] = useState("");
  const [importStatus, setImportStatus] = useState("");

  function openNewDialog() {
    setMapName("New Warehouse");
    setDialog("new");
  }

  function openSaveAsDialog() {
    setMapName(`${currentMap?.name || "Warehouse"} Copy`);
    setDialog("saveAs");
  }

  function closeDialog() {
    setDialog(null);
    setMapName("");
  }

  function handleDialogSubmit(event) {
    event.preventDefault();
    const cleanName = mapName.trim();
    if (!cleanName) return;

    if (dialog === "new") onNew(cleanName);
    if (dialog === "saveAs") onSaveAs(cleanName);
    closeDialog();
  }

  async function handleFileChange(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setImportStatus("Importing...");
    try {
      const result = await onImport(file);
      setImportStatus(
        result?.ok
          ? result.message || "Map imported"
          : result?.message || "Import failed"
      );
    } catch (error) {
      console.error(error);
      setImportStatus("Import failed");
    }

    window.setTimeout(() => setImportStatus(""), 3500);
  }

  return (
    <>
      <section className="panel map-manager">
        <div className="map-manager-current">
          <div className="map-manager-icon">
            <Map size={17} />
          </div>

          <div>
            <span className="map-manager-label">CURRENT MAP</span>
            <strong>{currentMap?.name || "Unnamed Map"}</strong>
            <small>{currentMap?.mapId || "NO-ID"}</small>
          </div>
        </div>

        <div className="map-manager-load">
          <FolderOpen size={14} />
          <select
            value={activeMapId}
            onChange={(event) => onLoad(event.target.value)}
          >
            {maps.map((map) => (
              <option key={map.mapId} value={map.mapId}>
                {map.name} — {map.mapId}
              </option>
            ))}
          </select>
        </div>

        <div className="map-manager-actions">
          <button type="button" onClick={openNewDialog}>
            <FilePlus2 size={14} /> New
          </button>

          <button
            type="button"
            className={saveStatus === "Unsaved changes" ? "attention" : ""}
            onClick={onSave}
          >
            <Save size={14} /> Save
          </button>

          <button type="button" onClick={openSaveAsDialog}>
            <Copy size={14} /> Save As
          </button>

          <button type="button" onClick={() => fileInputRef.current?.click()}>
            <Upload size={14} /> Import
          </button>

          <button
            type="button"
            className="danger"
            disabled={maps.length <= 1}
            onClick={() => onDelete(activeMapId)}
          >
            <Trash2 size={14} /> Delete Map
          </button>
        </div>

        {importStatus && (
          <span className="map-import-status">{importStatus}</span>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={handleFileChange}
        />
      </section>

      {dialog && (
        <div
          className="map-dialog-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeDialog();
          }}
        >
          <form className="map-dialog" onSubmit={handleDialogSubmit}>
            <div className="map-dialog-header">
              <div>
                <span>MAP MANAGEMENT</span>
                <h3>{dialog === "new" ? "Create New Map" : "Save Map As"}</h3>
              </div>

              <button
                type="button"
                className="map-dialog-close"
                onClick={closeDialog}
              >
                <X size={17} />
              </button>
            </div>

            <div className="map-dialog-body">
              <label>Map Name</label>
              <input
                autoFocus
                value={mapName}
                onChange={(event) => setMapName(event.target.value)}
                placeholder="Example: Warehouse A"
              />
              <p>
                {dialog === "new"
                  ? "A new empty warehouse map will be created."
                  : "The current map will be duplicated as a new map."}
              </p>
            </div>

            <div className="map-dialog-actions">
              <button type="button" onClick={closeDialog}>
                Cancel
              </button>
              <button type="submit" className="primary" disabled={!mapName.trim()}>
                {dialog === "new" ? "Create Map" : "Save Copy"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
