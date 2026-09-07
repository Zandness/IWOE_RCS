import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";

import RobotCard from "../components/RobotCard";
import RobotControlPanel from "../components/RobotControlPanel";

const ABNORMAL_STATUSES = new Set([
  "ERROR",
  "FAULT",
  "E-STOP",
  "OFFLINE",
  "ABNORMAL",
]);

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
              task:
                robot.task === "Paused"
                  ? "Manual Operation"
                  : robot.task,
              speed: robot.speed === "0.0 m/s" ? "1.0 m/s" : robot.speed,
            };

          case "PAUSE":
            return {
              ...robot,
              status: "PAUSED",
              task: "Paused",
              speed: "0.0 m/s",
            };

          default:
            return robot;
        }
      })
    );

    addLog(
      "COMMAND",
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
            Monitor fleet condition and use only Start / Pause commands.
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

        <section className="panel fleet-status-panel">
          <div className="panel-header">
            <h3>Robot Status</h3>
            <RobotConditionBadge robot={selectedRobot} />
          </div>

          <RobotStatusVisual robot={selectedRobot} />
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

  const paused = robots.filter(
    (robot) => robot.status === "PAUSED"
  ).length;

  const alerts = robots.filter((robot) =>
    isAbnormalRobot(robot)
  ).length;

  return (
    <div className="fleet-summary">
      <SummaryCard label="Total Robots" value={robots.length} />
      <SummaryCard label="Moving" value={moving} />
      <SummaryCard label="Idle" value={idle} />
      <SummaryCard label="Paused" value={paused} />
      <SummaryCard
        label="Abnormal"
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

function RobotStatusVisual({ robot }) {
  if (!robot) {
    return (
      <div className="robot-status-visual empty">
        Select a robot to view its condition.
      </div>
    );
  }

  const abnormal = isAbnormalRobot(robot);
  const imageSrc = abnormal
    ? "/images/robot-abnormal.svg"
    : "/images/robot-normal.svg";

  return (
    <div
      className={`robot-status-visual ${
        abnormal ? "abnormal" : "normal"
      }`}
    >
      <img
        src={imageSrc}
        alt={`${robot.id} ${abnormal ? "abnormal" : "normal"} status`}
      />

      <div className="robot-status-visual-copy">
        {abnormal ? (
          <AlertTriangle size={20} />
        ) : (
          <CheckCircle2 size={20} />
        )}

        <div>
          <strong>
            {abnormal ? "ABNORMAL" : "NORMAL"}
          </strong>
          <span>
            {robot.id} · RCS status: {robot.status}
          </span>
        </div>
      </div>

      <small>
        Replace the SVG files in public/images later if a real robot status image is available.
      </small>
    </div>
  );
}

function RobotConditionBadge({ robot }) {
  if (!robot) return null;

  const abnormal = isAbnormalRobot(robot);

  return (
    <span
      className={`robot-condition-badge ${
        abnormal ? "abnormal" : "normal"
      }`}
    >
      {abnormal ? "ABNORMAL" : "NORMAL"}
    </span>
  );
}

function isAbnormalRobot(robot) {
  return Boolean(
    robot &&
      ABNORMAL_STATUSES.has(
        String(robot.status || "").toUpperCase()
      )
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
              {log.type}
            </span>

            <span className="terminal-message">
              {log.message}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
