import { Bot, Battery } from "lucide-react";

export default function RobotCard({
  robot,
  selected,
  onClick,
}) {
  return (
    <button
      className={`robot-card ${
        selected ? "selected" : ""
      }`}
      onClick={onClick}
    >
      <div className="robot-card-top">
        <div className="robot-name">
          <Bot size={19} />
          <strong>{robot.id}</strong>
        </div>

        <span
          className={`robot-status ${getStatusClass(
            robot.status
          )}`}
        >
          {robot.status}
        </span>
      </div>

      <div className="robot-task">
        {robot.task}
      </div>

      <div className="robot-card-bottom">
        <span>{robot.type}</span>

        <span className="battery">
          <Battery size={15} />
          {robot.battery}%
        </span>
      </div>
    </button>
  );
}

function getStatusClass(status) {
  switch (status) {
    case "MOVING":
      return "moving";

    case "IDLE":
      return "idle";

    case "CHARGING":
      return "charging";

    case "PAUSED":
      return "paused";

    case "E-STOP":
      return "estop";

    default:
      return "";
  }
}