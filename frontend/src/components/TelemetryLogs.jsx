import { Radio, Clock } from "lucide-react";

const logs = [
  {
    time: "10:42:15",
    type: "SYSTEM",
    message: "WMS dashboard initialized",
  },
  {
    time: "10:42:18",
    type: "RCS",
    message: "Waiting for RCS connection",
  },
  {
    time: "10:42:24",
    type: "STATUS",
    message: "AMR-01 status: MOVING",
  },
];

export default function TelemetryLogs() {
  return (
    <section className="panel telemetry-panel">
      <div className="panel-header">
        <h3>
          <Radio size={17} />
          Real-time Telemetry & RCS Logs
        </h3>

        <span>{logs.length} events</span>
      </div>

      <div className="terminal">
        {logs.map((log, index) => (
          <div
            className="terminal-line"
            key={index}
          >
            <span className="terminal-time">
              <Clock size={12} />
              {log.time}
            </span>

            <span className="terminal-type">
              [{log.type}]
            </span>

            <span>{log.message}</span>
          </div>
        ))}
      </div>
    </section>
  );
}