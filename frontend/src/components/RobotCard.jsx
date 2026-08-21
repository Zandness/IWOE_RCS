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
          className={`robot-status ${robot.status.toLowerCase()}`}
        >
          {robot.status}
        </span>
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