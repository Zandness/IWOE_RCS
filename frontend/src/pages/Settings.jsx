import { Server, Wifi } from "lucide-react";

export default function Settings() {
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <span className="page-label">
            SYSTEM CONFIGURATION
          </span>

          <h2>Settings</h2>

          <p>
            Configure WMS and external RCS connection settings.
          </p>
        </div>
      </div>

      <section className="panel settings-panel">
        <div className="settings-title">
          <Wifi size={21} />

          <div>
            <h3>RCS Connection</h3>
            <span>External Robot Control System</span>
          </div>
        </div>

        <label>RCS WebSocket Endpoint</label>

        <input
          type="text"
          defaultValue="ws://localhost:8000/ws/rcs"
        />

        <button className="primary-button">
          Test Connection
        </button>
      </section>

      <section className="panel settings-panel">
        <div className="settings-title">
          <Server size={21} />

          <div>
            <h3>WMS Backend</h3>
            <span>FastAPI server configuration</span>
          </div>
        </div>

        <label>Backend API URL</label>

        <input
          type="text"
          defaultValue="http://localhost:8000"
        />
      </section>
    </div>
  );
}