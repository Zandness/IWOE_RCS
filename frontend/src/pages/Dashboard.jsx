import { Bot } from "lucide-react";

import ExecutiveStats from "../components/ExecutiveStats";
import WarehouseGrid from "../components/WarehouseGrid";

export default function Dashboard() {
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <span className="page-label">
            WAREHOUSE MANAGEMENT
          </span>

          <h2>Dashboard</h2>

          <p>
            Overview of warehouse operations and robot
            system status.
          </p>
        </div>
      </div>

      <ExecutiveStats />

      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel-header">
            <h3>Warehouse Overview</h3>
            <span className="badge">LIVE</span>
          </div>

          <WarehouseGrid />
        </section>

        <section className="panel">
          <div className="panel-header">
            <h3>RCS Status</h3>

            <span className="status-offline">
              DISCONNECTED
            </span>
          </div>

          <div className="rcs-placeholder">
            <Bot size={42} />

            <strong>
              Waiting for RCS connection
            </strong>

            <span>
              Robot telemetry will appear here
            </span>
          </div>
        </section>
      </div>
    </div>
  );
}