import {
  useEffect,
  useState,
} from "react";

import { Link } from "react-router-dom";

import {
  basketOf,
  MONITOR_KEY,
} from "../utils/basketStore";

import {
  loadPreferences,
  summarizeWarehouse,
} from "../utils/dashboardData";

import "../styles/OverviewSettings.css";

function readSnapshot() {
  try {
    const monitor = JSON.parse(
      localStorage.getItem(
        MONITOR_KEY
      ) || "null"
    );

    const queue = JSON.parse(
      localStorage.getItem(
        "wms-robot-tasks-v1"
      ) || "[]"
    );

    if (
      !Array.isArray(queue) ||
      (
        monitor &&
        !Array.isArray(monitor.racks)
      )
    ) {
      throw new Error(
        "Invalid warehouse data."
      );
    }

    return {
      summary: summarizeWarehouse(
        monitor,
        queue
      ),

      initialized: Boolean(monitor),
      preferences: loadPreferences(),
      error: "",
    };
  } catch (error) {
    return {
      summary: summarizeWarehouse(
        null,
        []
      ),

      error: error.message,
      preferences: loadPreferences(),
    };
  }
}

export default function Dashboard() {
  const [snapshot, setSnapshot] = useState(
    readSnapshot
  );

  useEffect(() => {
    function refresh() {
      setSnapshot(readSnapshot());
    }

    const events = [
      "storage",
      "focus",
      "wms-data-changed",
      "wms-monitor-data-changed",
      "wms-preferences-changed",
    ];

    events.forEach((eventName) =>
      window.addEventListener(
        eventName,
        refresh
      )
    );

    const timer = window.setInterval(
      refresh,
      1000
    );

    return () => {
      window.clearInterval(timer);

      events.forEach((eventName) =>
        window.removeEventListener(
          eventName,
          refresh
        )
      );
    };
  }, []);

  const {
    summary,
    preferences,
    error,
    initialized,
  } = snapshot;

  const cards = [
    ["Baskets", summary.baskets],
    ["Empty available points", summary.empty],
    ["SKU types in stock", summary.skuCount],
    ["Total item quantity", summary.quantity],
  ];

  const queueSummary = [
    ["Pending", summary.pending],
    ["Scheduled for later", summary.scheduled],
    ["Submitted / running", summary.active],
    ["Completed", summary.completed],
    ["Needs attention", summary.attention],
  ];

  return (
    <div className="page wms-overview">
      <div className="page-header">
        <div>
          <span className="page-label">
            WAREHOUSE OVERVIEW
          </span>

          <h2>Dashboard</h2>

          <p>
            {preferences.warehouseName}
            {" · "}
            Monitor inventory and dispatch
            records in this browser.
          </p>
        </div>
      </div>

      {error ? (
        <p role="alert">
          Cannot read warehouse data: {error}
        </p>
      ) : (
        <>
          {!initialized && (
            <p className="overview-notice">
              Open{" "}
              <Link to="/warehouse">
                Warehouse Monitor
              </Link>{" "}
              to initialize the warehouse layout.
            </p>
          )}

          <div className="overview-stats">
            {cards.map(([name, value]) => (
              <section
                className="panel overview-stat"
                key={name}
              >
                <span>{name}</span>
                <strong>{value}</strong>
              </section>
            ))}
          </div>

          <div className="overview-columns">
            <section className="panel overview-section">
              <div className="overview-heading">
                <h3>Rack occupancy</h3>

                <Link to="/warehouse">
                  Open Monitor
                </Link>
              </div>

              <p>
                Each point holds one basket.
                Empty baskets also occupy a point.
              </p>

              {summary.racks.length === 0 && (
                <p>No rack data yet.</p>
              )}

              {summary.racks.map((rack) => {
                const used = rack.shelves.filter(
                  (shelf) => basketOf(shelf)
                ).length;

                return (
                  <div
                    className="overview-rack"
                    key={rack.id}
                  >
                    <div>
                      <strong>
                        {rack.name || rack.id}
                      </strong>

                      <span>
                        {used}
                        {" / "}
                        {rack.shelves.length}
                        {" baskets"}
                      </span>
                    </div>

                    <progress
                      value={used}
                      max={
                        rack.shelves.length || 1
                      }
                      aria-label={
                        `${rack.id} basket occupancy`
                      }
                    />
                  </div>
                );
              })}
            </section>

            <section className="panel overview-section">
              <div className="overview-heading">
                <h3>Dispatch summary</h3>

                <Link to="/dispatcher">
                  Manage queue
                </Link>
              </div>

              <dl className="overview-facts">
                {queueSummary.map(
                  ([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  )
                )}
              </dl>

              <p>
                Eligible urgent tasks follow
                the active task. Equal priority
                follows FIFO.
              </p>

              <Link to="/warehouse-data">
                View basket contents and inventory
              </Link>
            </section>
          </div>

          <section className="panel overview-section">
            <div className="overview-heading">
              <h3>Recent transfers</h3>

              <Link to="/dispatcher">
                View all
              </Link>
            </div>

            <div className="table-wrapper">
              <table className="dashboard-table">
                <thead>
                  <tr>
                    <th>Task</th>
                    <th>Basket</th>
                    <th>Route</th>
                    <th>Priority</th>
                    <th>Send time</th>
                    <th>Status</th>
                  </tr>
                </thead>

                <tbody>
                  {summary.recent.length === 0 && (
                    <tr>
                      <td colSpan={6}>
                        No queued transfers yet.
                        Create a basket transfer
                        from Monitor.
                      </td>
                    </tr>
                  )}

                  {summary.recent.map((task) => (
                    <tr key={task.id}>
                      <td>{task.id}</td>

                      <td>
                        {task.basketId || "—"}
                      </td>

                      <td>
                        {task.sourceRcsPointCode ||
                          "—"}

                        {" → "}

                        {task.destinationRcsPointCode ||
                          "—"}
                      </td>

                      <td>
                        {task.wmsPriority ||
                          task.rcsPriority}
                      </td>

                      <td>
                        {task.scheduledSendAt &&
                        Number.isFinite(
                          Date.parse(
                            task.scheduledSendAt
                          )
                        )
                          ? new Date(
                              task.scheduledSendAt
                            ).toLocaleString()
                          : "As soon as ready"}
                      </td>

                      <td>
                        {task.backendError
                          ? "Needs attention"
                          : task.sendStatus === "SENT"
                          ? task.rcsStatus
                          : task.sendStatus}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}