import { WifiOff, Server } from "lucide-react";

export default function Navbar() {
  const connected = false;

  return (
    <header className="navbar">
      <div className="navbar-left">
        <div className="logo-box">W</div>

        <div>
          <h1>Warehouse Management System</h1>
          <span>External RCS Integration</span>
        </div>
      </div>

      <div className="navbar-right">
        <div
          className={`connection-status ${
            connected ? "connected" : "disconnected"
          }`}
        >
          <WifiOff size={17} />

          <span>
            RCS {connected ? "CONNECTED" : "DISCONNECTED"}
          </span>
        </div>

        <div className="system-status">
          <Server size={16} />
          <span>WMS ONLINE</span>
        </div>
      </div>
    </header>
  );
}