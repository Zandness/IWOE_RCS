import {
  Settings,
  Server,
} from "lucide-react";

import { Link } from "react-router-dom";

export default function Navbar() {
  return (
    <header className="navbar">
      <div className="navbar-left">
        <div className="logo-box">
          W
        </div>

        <div>
          <h1>
            Warehouse Management System
          </h1>

          <span>
            External RCS Integration
          </span>
        </div>
      </div>

      <div className="navbar-right">
        <Link
          to="/settings"
          className="connection-status"
          style={{
            textDecoration: "none",
            color: "inherit",
          }}
        >
          <Settings size={17} />

          <span>
            Connection settings
          </span>
        </Link>

        <div className="system-status">
          <Server size={16} />
          <span>WMS</span>
        </div>
      </div>
    </header>
  );
}