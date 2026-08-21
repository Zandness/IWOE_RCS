import {
  Bot,
  Battery,
  Navigation,
  Gauge,
  ClipboardList,
} from "lucide-react";

export default function MonitorPanel({
  robot,
}) {
  if (!robot) {
    return (
      <aside className="panel monitor-panel">
        <div className="panel-header">
          <h3>
            Robot Monitor
          </h3>
        </div>

        <div className="monitor-empty">
          Select a robot on the map or from the fleet list.
        </div>
      </aside>
    );
  }

  return (
    <aside className="panel monitor-panel">

      <div className="panel-header">
        <h3>
          Robot Monitor
        </h3>

        <span>
          {robot.id}
        </span>
      </div>

      <div className="monitor-robot-header">

        <div className="monitor-robot-icon">
          <Bot size={25} />
        </div>

        <div>
          <strong>
            {robot.id}
          </strong>

          <span>
            {robot.type}
          </span>
        </div>

        <span
          className={`monitor-status ${robot.status.toLowerCase()}`}
        >
          {robot.status}
        </span>

      </div>

      <MonitorRow
        icon={Battery}
        label="Battery"
        value={`${robot.battery}%`}
      />

      <MonitorRow
        icon={Gauge}
        label="Speed"
        value={`${robot.speed} m/s`}
      />

      <MonitorRow
        icon={Navigation}
        label="Current Node"
        value={
          robot.currentNode ||
          "-"
        }
      />

      <MonitorRow
        icon={Navigation}
        label="Next Node"
        value={
          robot.nextNode ||
          "-"
        }
      />

      <MonitorRow
        icon={Navigation}
        label="Destination"
        value={
          robot.destination ||
          "-"
        }
      />

      <MonitorRow
        icon={ClipboardList}
        label="Task"
        value={
          robot.task ||
          "-"
        }
      />

      <div className="monitor-path-section">

        <div className="property-section-title">
          Planned Path
        </div>

        {robot.plannedPath.length > 0 ? (
          <div className="monitor-path-list">
            {robot.plannedPath.map(
              (
                node,
                index
              ) => (
                <div
                  key={`${robot.id}-${node}-${index}`}
                  className="monitor-path-node"
                >
                  <span>
                    {node}
                  </span>

                  {index <
                    robot.plannedPath.length -
                      1 && (
                    <span className="monitor-path-arrow">
                      →
                    </span>
                  )}
                </div>
              )
            )}
          </div>
        ) : (
          <div className="monitor-empty-small">
            No planned path
          </div>
        )}

      </div>

    </aside>
  );
}


function MonitorRow({
  icon: Icon,
  label,
  value,
}) {
  return (
    <div className="monitor-row">

      <div>
        <Icon size={14} />

        <span>
          {label}
        </span>
      </div>

      <strong>
        {value}
      </strong>

    </div>
  );
}