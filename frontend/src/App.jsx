import { BrowserRouter, Routes, Route } from "react-router-dom";

import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";

import Dashboard from "./pages/Dashboard";
import FleetControl from "./pages/FleetControl";
import WarehouseMap from "./pages/WarehouseMap";
import Settings from "./pages/Settings";

function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <Navbar />

        <div className="app-body">
          <Sidebar />

          <main className="main-content">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/fleet" element={<FleetControl />} />
              <Route path="/warehouse" element={<WarehouseMap />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  );
}

export default App;