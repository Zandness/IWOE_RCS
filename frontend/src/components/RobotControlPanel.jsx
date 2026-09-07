import {
  Play,
  Square,
  RotateCcw,
} from "lucide-react";

export default function RobotControlPanel({
  robot,
  onCommand,
}) {
  if (!robot) return null;

  const isPaused =
    String(robot.status || "").toUpperCase() === "PAUSED";

  const commands = [
    {
      name: "Start",
      command: "START",
      icon: Play,
    },
    isPaused
      ? {
          name: "Resume",
          command: "RESUME",
          icon: RotateCcw,
        }
      : {
          name: "Stop",
          command: "STOP",
          icon: Square,
        },
  ];

  return (
    <div>
      <div className="robot-detail">
        <div className="robot-detail-icon">
          <span>🤖</span>
        </div>

        <h3>{robot.id}</h3>
        <span>{robot.type}</span>
      </div>

      <Info label="Status" value={robot.status} />
      <Info label="Battery" value={`${robot.battery}%`} />
      <Info label="Position" value={robot.position} />
      <Info label="Destination" value={robot.destination} />
      <Info label="Task" value={robot.task} />
      <Info label="Speed" value={robot.speed} />

      <div className="command-section">
        <span className="section-label">
          ROBOT COMMANDS
        </span>

        <div className="command-grid command-grid-two">
          {commands.map((item) => {
            const Icon = item.icon;

            return (
              <button
                key={item.name}
                type="button"
                className="command-button"
                onClick={() =>
                  onCommand(item.command)
                }
              >
                <Icon size={17} />
                {item.name}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div className="robot-info">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
