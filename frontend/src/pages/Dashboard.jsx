import {
  Activity,
  Bot,
  ClipboardList,
  Server,
} from "lucide-react";

import ExecutiveStats from "../components/ExecutiveStats";
import WarehouseGrid from "../components/WarehouseGrid";

const recentOrders = [
  {
    id: "ORD-1024",
    status: "Picking",
    items: 5,
  },
  {
    id: "ORD-1025",
    status: "Queued",
    items: 3,
  },
  {
    id: "ORD-1026",
    status: "Completed",
    items: 8,
  },
  {
    id: "ORD-1027",
    status: "Picking",
    items: 2,
  },
];

const robotActivity = [
  {
    robot: "AMR-01",
    activity: "Picking Order ORD-1024",
    status: "MOVING",
  },
  {
    robot: "AMR-02",
    activity: "Waiting at Zone B",
    status: "IDLE",
  },
  {
    robot: "AGV-01",
    activity: "Charging",
    status: "CHARGING",
  },
];

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
            Overview of warehouse operations,
            inventory, orders and mobile robots.
          </p>
        </div>
      </div>

      <ExecutiveStats />

      <div className="dashboard-main-grid">
        <section className="panel dashboard-large-panel">
          <div className="panel-header">
            <h3>
              <Activity size={17} />
              Warehouse Overview
            </h3>

            <span className="badge">
              LIVE DATA
            </span>
          </div>

          <WarehouseGrid />
        </section>

        <section className="panel">
          <div className="panel-header">
            <h3>
              <Server size={17} />
              System Status
            </h3>
          </div>

          <div className="system-list">
            <SystemRow
              name="Frontend"
              status="Online"
            />

            <SystemRow
              name="WMS Core"
              status="Online"
            />

            <SystemRow
              name="Database"
              status="Mock"
            />

            <SystemRow
              name="RCS Integration"
              status="Not Connected"
            />
          </div>
        </section>
      </div>

      <div className="dashboard-bottom-grid">
        <section className="panel">
          <div className="panel-header">
            <h3>
              <ClipboardList size={17} />
              Recent Orders
            </h3>

            <span>
              {recentOrders.length} records
            </span>
          </div>

          <div className="table-wrapper">
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Items</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {recentOrders.map((order) => (
                  <tr key={order.id}>
                    <td>{order.id}</td>
                    <td>{order.items}</td>
                    <td>
                      <span
                        className={`order-status ${order.status.toLowerCase()}`}
                      >
                        {order.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <h3>
              <Bot size={17} />
              Robot Activity
            </h3>

            <span>
              {robotActivity.length} robots
            </span>
          </div>

          <div className="activity-list">
            {robotActivity.map((item) => (
              <div
                className="activity-item"
                key={item.robot}
              >
                <div className="activity-icon">
                  <Bot size={17} />
                </div>

                <div className="activity-content">
                  <strong>
                    {item.robot}
                  </strong>

                  <span>
                    {item.activity}
                  </span>
                </div>

                <span
                  className={`activity-status ${item.status.toLowerCase()}`}
                >
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function SystemRow({ name, status }) {
  const statusClass =
    status === "Online"
      ? "system-online"
      : status === "Mock"
      ? "system-mock"
      : "system-offline";

  return (
    <div className="system-row">
      <span>{name}</span>

      <strong className={statusClass}>
        {status}
      </strong>
    </div>
  );
}