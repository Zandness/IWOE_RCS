import { buildWorkflowRows } from "../utils/workflowStatus";
import "../styles/WorkflowStatus.css";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import {
  readOperationsSnapshot,
} from "../utils/warehouseOperations";

import "../styles/OverviewSettings.css";

export default function TaskManagement() {
  const [snapshot, setSnapshot] = useState(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [rows, setRows] = useState([]);

  useEffect(() => {
    function refresh() {
      try {
        const next = readOperationsSnapshot();
        const nextRows = buildWorkflowRows(next.monitor, next.queue);
        setSnapshot(next);
        setRows(nextRows);
        setError("");
      } catch (error) {
        setSnapshot(null);
        setRows([]);
        setError(error.message);
      }
    }

    refresh();
    const timer = window.setInterval(refresh, 10000);

    const events = [
      "focus",
      "storage",
      "wms-monitor-data-changed",
      "wms-data-changed",
    ];

    events.forEach((event) => {
      window.addEventListener(event, refresh);
    });

    return () => {
      window.clearInterval(timer);
      events.forEach((event) => {
        window.removeEventListener(event, refresh);
      });
    };
  }, []);

  const visible = rows
    .filter(
      (record) =>
        (filter === "ALL" || record.kind === filter) &&
        [
          record.id,
          record.kind,
          record.typeLabel,
          record.execution,
          record.nextStep,
          record.number,
          record.sku,
          record.basketId,
          record.source,
          record.destination,
          record.status,
        ]
          .join(" ")
          .toLowerCase()
          .includes(search.toLowerCase())
    )
    .sort(
      (a, b) =>
        (Date.parse(b.createdAt) || 0) -
        (Date.parse(a.createdAt) || 0)
    );

  const stats = [
    ["Total", rows.length],

    [
      "Open",
      rows.filter(
        (record) => !record.closed
      ).length,
    ],

    [
      "Completed",
      rows.filter(
        (record) => record.status === "COMPLETED"
      ).length,
    ],

    [
      "Needs attention",
      rows.filter(record => record.attention).length,
    ],
  ];

  return (
    <div className="page wms-overview workflow-view">
      <div className="page-header">
        <div>
          <span className="page-label">
            WAREHOUSE TASKS
          </span>

          <h2>Task Management</h2>

          <p>
            Overview of WMS documents, picking, stock counts and RCS Load transfers.
            Manage each task in its operation page.
          </p>
        </div>
      </div>

      {error && <p role="alert">{error}</p>}

      <div className="overview-stats">
        {stats.map(([label, value]) => (
          <section
            className="panel overview-stat"
            key={label}
          >
            <span>{label}</span>
            <strong>{value}</strong>
          </section>
        ))}
      </div>

      <section className="panel overview-section">
        <div className="overview-actions">
          <Link to="/warehouse">
            Create operation in Monitor
          </Link>

          <Link to="/operations">
            Manage picking
          </Link>

          <Link to="/dispatcher">
            Manage dispatch queue
          </Link>
        </div>

        <div className="overview-form workflow-toolbar">
          <label>
            Task type

            <select
              value={filter}
              onChange={(event) =>
                setFilter(event.target.value)
              }
            >
              <option value="ALL">
                All tasks
              </option>

              <option value="OUTBOUND">
                Outbound picking
              </option>

              <option value="DOCUMENT">Inbound / Outbound documents</option>
              <option value="STOCK_COUNT">Stock counts</option>

              <option value="BASKET_TRANSFER">
                Load transfers
              </option>
            </select>
          </label>

          <label>
            Search

            <input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Task, load, SKU or location"
            />
          </label>
        </div>

        <div className="workflow-results">
          <span role="status">
            Showing {visible.length} of {rows.length} tasks
          </span>

          <button
            type="button"
            disabled={!search && filter === "ALL"}
            onClick={() => {
              setSearch("");
              setFilter("ALL");
            }}
          >
            Clear filters
          </button>
        </div>

        <p className="workflow-note">
          Summary cards include all tasks.
          Open tasks may also need attention. RCS-reported completion remains open until WMS reconciliation is recorded. No live connection check or dispatch is performed here.
        </p>

        <div className="table-wrapper">
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>Task</th>
                <th>Type</th>
                <th>Load / product</th>
                <th>From → To</th>
                <th>Status</th>
                <th>Open</th>
              </tr>
            </thead>

            <tbody>
              {!visible.length && (
                <tr>
                  <td
                    colSpan={6}
                    className="workflow-empty"
                  >
                    {rows.length
                      ? "No tasks match your filters."
                      : "No tasks yet. Create an operation in Monitor."}
                  </td>
                </tr>
              )}

              {visible.map((record) => (
                <tr key={`${record.kind}-${record.id}`}>
                  <td>{record.id}</td>

                  <td>
                    {record.typeLabel}
                    <small className="workflow-execution">{record.execution}</small>
                  </td>

                  <td>
                    {record.basketId || "—"}
                    <br />
                    {record.sku || ""}
                  </td>

                  <td>
                    {record.source} → {record.destination}
                  </td>

                  <td>
                    <span
                      className="workflow-status"
                      data-status={record.status || "UNKNOWN"}
                    >
                      {record.label || "UNKNOWN"}
                    </span>
                    <small className="workflow-next-step">{record.nextStep}</small>
                  </td>

                  <td>
                    <Link to={record.path}>
                      Manage
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {!!snapshot?.legacyTasks.length && (
        <section className="panel overview-section">
          <details>
            <summary>
              Previous-version tasks
              {" · "}
              {snapshot.legacyTasks.length}
            </summary>

            <p>
              Historical records only. They are not
              automatically sent to RCS or used to modify
              Monitor inventory.
            </p>

            {snapshot.legacyTasks.map((task, index) => (
              <p key={task.id || index}>
                {task.id}
                {" · "}
                {task.type}
                {" · "}
                {task.status}
              </p>
            ))}
          </details>
        </section>
      )}
    </div>
  );
}