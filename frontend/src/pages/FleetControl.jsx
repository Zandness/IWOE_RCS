import { useState } from "react";

import RobotCard from "../components/RobotCard";
import RobotControlPanel from "../components/RobotControlPanel";

const initialRobots = [
  {
    id: "AMR-01",
    type: "AMR",
    status: "MOVING",
    battery: 85,
    position: "A3",
    destination: "Dock 1",
    task: "Order Picking",
    speed: "1.2 m/s",
  },
  {
    id: "AMR-02",
    type: "AMR",
    status: "IDLE",
    battery: 94,
    position: "B2",
    destination: "-",
    task: "Standby",
    speed: "0.0 m/s",
  },
  {
    id: "AGV-01",
    type: "AGV",
    status: "CHARGING",
    battery: 32,
    position: "Charging Station",
    destination: "-",
    task: "Charging",
    speed: "0.0 m/s",
  },
  {
    id: "AGV-02",
    type: "AGV",
    status: "MOVING",
    battery: 67,
    position: "C4",
    destination: "Palletizer",
    task: "Pallet Transport",
    speed: "0.9 m/s",
  },
];

export default function FleetControl() {
  const [robots, setRobots] = useState(initialRobots);
  const [selectedId, setSelectedId] = useState("AMR-01");

  const [logs, setLogs] = useState([
    {
      id: 1,
      time: new Date().toLocaleTimeString(),
      type: "SYSTEM",
      message: "Fleet Control initialized",
    },
  ]);

  const selectedRobot = robots.find(
    (robot) => robot.id === selectedId
  );

  const addLog = (type, message) => {
    const newLog = {
      id: Date.now(),
      time: new Date().toLocaleTimeString(),
      type,
      message,
    };

    setLogs((prev) => [newLog, ...prev].slice(0, 30));
  };

  const sendCommand = (command) => {
    if (!selectedRobot) return;

    setRobots((prev) =>
      prev.map((robot) => {
        if (robot.id !== selectedRobot.id) {
          return robot;
        }

        switch (command) {
          case "START":
            return {
              ...robot,
              status: "MOVING",
              task: "Manual Operation",
              speed: "1.0 m/s",
            };

          case "PAUSE":
            return {
              ...robot,
              status: "PAUSED",
              speed: "0.0 m/s",
            };

          case "STOP":
            return {
              ...robot,
              status: "IDLE",
              task: "Stopped",
              speed: "0.0 m/s",
              destination: "-",
            };

          case "HOME":
            return {
              ...robot,
              status: "MOVING",
              task: "Returning Home",
              destination: "Home Station",
              speed: "1.0 m/s",
            };

          case "CHARGE":
            return {
              ...robot,
              status: "CHARGING",
              task: "Charging",
              destination: "Charging Station",
              speed: "0.0 m/s",
            };

          case "DISPATCH":
            return {
              ...robot,
              status: "MOVING",
              task: "Manual Dispatch",
              destination: "Target Location",
              speed: "1.0 m/s",
            };

          case "EMERGENCY_STOP":
            return {
              ...robot,
              status: "E-STOP",
              task: "Emergency Stop",
              speed: "0.0 m/s",
            };

          default:
            return robot;
        }
      })
    );

    addLog(
      command === "EMERGENCY_STOP" ? "ALERT" : "COMMAND",
      `${command} command sent to ${selectedRobot.id}`
    );
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <span className="page-label">
            ROBOT OPERATIONS
          </span>

          <h2>Fleet Control</h2>

          <p>
            Monitor and simulate AMR / AGV operations
            before external RCS integration.
          </p>
        </div>

        <span className="simulation-badge">
          LOCAL SIMULATION
        </span>
      </div>

      <FleetSummary robots={robots} />

      <div className="fleet-layout">
        <section className="panel">
          <div className="panel-header">
            <h3>Robot Fleet</h3>
            <span>{robots.length} Units</span>
          </div>

          <div className="robot-list">
            {robots.map((robot) => (
              <RobotCard
                key={robot.id}
                robot={robot}
                selected={robot.id === selectedId}
                onClick={() => setSelectedId(robot.id)}
              />
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <h3>Live Warehouse Map</h3>
            <span className="badge">SIMULATION</span>
          </div>

          <WarehouseSimulation
            robots={robots}
            selectedId={selectedId}
          />
        </section>

        <section className="panel">
          <div className="panel-header">
            <h3>Robot Control</h3>
            <span>{selectedRobot?.id}</span>
          </div>

          <RobotControlPanel
            robot={selectedRobot}
            onCommand={sendCommand}
          />
        </section>
      </div>

      <FleetLogs logs={logs} />
    </div>
  );
}

function FleetSummary({ robots }) {
  const moving = robots.filter(
    (robot) => robot.status === "MOVING"
  ).length;

  const idle = robots.filter(
    (robot) => robot.status === "IDLE"
  ).length;

  const charging = robots.filter(
    (robot) => robot.status === "CHARGING"
  ).length;

  const alerts = robots.filter(
    (robot) => robot.status === "E-STOP"
  ).length;

  return (
    <div className="fleet-summary">
      <SummaryCard
        label="Total Robots"
        value={robots.length}
      />

      <SummaryCard
        label="Moving"
        value={moving}
      />

      <SummaryCard
        label="Idle"
        value={idle}
      />

      <SummaryCard
        label="Charging"
        value={charging}
      />

      <SummaryCard
        label="Alerts"
        value={alerts}
        danger={alerts > 0}
      />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  danger = false,
}) {
  return (
    <div
      className={`summary-card ${
        danger ? "summary-danger" : ""
      }`}
    >
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function WarehouseSimulation({
  robots,
  selectedId,
}) {
  const robotPositions = {
    "AMR-01": 12,
    "AMR-02": 25,
    "AGV-01": 45,
    "AGV-02": 34,
  };

  return (
    <div className="warehouse-map">
      {Array.from({ length: 54 }, (_, index) => {
        const robot = robots.find(
          (item) =>
            robotPositions[item.id] === index
        );

        const isSelected =
          robot?.id === selectedId;

        return (
          <div
            key={index}
            className={`map-cell ${
              isSelected
                ? "map-cell-selected"
                : ""
            }`}
          >
            {robot && (
              <div
                className={`map-robot ${robot.status.toLowerCase()}`}
              >
                <span>{robot.id}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function FleetLogs({ logs }) {
  return (
    <section className="panel telemetry-panel">
      <div className="panel-header">
        <h3>Fleet Event Log</h3>

        <span>{logs.length} events</span>
      </div>

      <div className="terminal">
        {logs.map((log) => (
          <div
            key={log.id}
            className="terminal-line"
          >
            <span className="terminal-time">
              [{log.time}]
            </span>

            <span
              className={`terminal-type ${log.type.toLowerCase()}`}
            >
              [{log.type}]
            </span>

            <span>{log.message}</span>
          </div>
        ))}
      </div>
    </section>
  );
}