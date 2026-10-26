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
import Settings from "./pages/Settings";
import StockCount from "./pages/StockCount";
import AuditHistory from "./pages/AuditHistory";
import WarehouseDocuments from "./pages/WarehouseDocuments";

function AppContent() {
  const { pathname } = useLocation();

  return (
    <div className="app">
      <Navbar />

      <div className="app-body">
        <Sidebar />

        <main className="main-content">
          {/* Keep the queue mounted; only toggle page visibility. */}
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
            <Route path="/documents" element={<WarehouseDocuments />} />
            <Route path="/audit-history" element={<AuditHistory />} />
            <Route path="/stock-count" element={<StockCount />} />
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

            {/* The dispatcher is rendered above. */}
            <Route path="/dispatcher" element={null} />

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