import { useState } from "react";

import RobotCard from "../components/RobotCard";
import RobotControlPanel from "../components/RobotControlPanel";
import TelemetryLogs from "../components/TelemetryLogs";

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
];

export default function FleetControl() {
  const [robots] = useState(initialRobots);
  const [selectedId, setSelectedId] = useState("AMR-01");

  const selectedRobot = robots.find(
    (robot) => robot.id === selectedId
  );

  const sendCommand = (command) => {
    console.log({
      event: "COMMAND",
      command,
      robotId: selectedRobot.id,
      timestamp: new Date().toISOString(),
    });
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
            Monitor and control AMR / AGV operations
            through the external RCS.
          </p>
        </div>
      </div>

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
            <span className="badge">2D MAP</span>
          </div>

          <div className="warehouse-map">
            {Array.from({ length: 54 }, (_, index) => (
              <div
                key={index}
                className="map-cell"
              />
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <h3>Robot Control</h3>
            <span>{selectedRobot.id}</span>
          </div>

          <RobotControlPanel
            robot={selectedRobot}
            onCommand={sendCommand}
          />
        </section>
      </div>

      <TelemetryLogs />
    </div>
  );
}