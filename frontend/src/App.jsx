import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";

import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";

import Dashboard from "./pages/Dashboard";
import WarehouseMap from "./pages/WarehouseMap";
import WarehouseData from "./pages/WarehouseData";
import WarehouseOperations from "./pages/WarehouseOperations";
import TaskManagement from "./pages/TaskManagement";
import RobotTaskDispatcher from "./pages/RobotTaskDispatcher";
import FleetControl from "./pages/FleetControl";
import Settings from "./pages/Settings";

function AppContent() {
  const { pathname } = useLocation();

  return (
    <div className="app">
      <Navbar />

      <div className="app-body">
        <Sidebar />

        <main className="main-content">
          {/* คิวอยู่ตลอด เปลี่ยนเฉพาะการแสดงหน้า */}
          <div
            style={{
              display:
                pathname === "/dispatcher"
                  ? "block"
                  : "none",
            }}
          >
            <RobotTaskDispatcher />
          </div>

          <Routes>
            <Route path="/" element={<Dashboard />} />

            <Route
              path="/warehouse"
              element={<WarehouseMap />}
            />

            <Route
              path="/warehouse-data"
              element={<WarehouseData />}
            />

            <Route
              path="/inventory"
              element={
                <Navigate to="/warehouse-data" replace />
              }
            />

            <Route
              path="/locations"
              element={
                <Navigate to="/warehouse-data" replace />
              }
            />

            <Route
              path="/operations"
              element={<WarehouseOperations />}
            />

            <Route
              path="/inbound"
              element={
                <Navigate to="/operations" replace />
              }
            />

            <Route
              path="/outbound"
              element={
                <Navigate to="/operations" replace />
              }
            />

            <Route
              path="/tasks"
              element={<TaskManagement />}
            />

            {/* แสดง Dispatcher จากด้านบนแล้ว */}
            <Route path="/dispatcher" element={null} />

            <Route
              path="/fleet"
              element={<FleetControl />}
            />

            <Route
              path="/settings"
              element={<Settings />}
            />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}