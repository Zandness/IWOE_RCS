import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";

import Dashboard from "./pages/Dashboard";
import WarehouseMap from "./pages/WarehouseMap";
import StorageLocations from "./pages/StorageLocations";
import Inventory from "./pages/Inventory";
import WarehouseOperations from "./pages/WarehouseOperations";
import TaskManagement from "./pages/TaskManagement";
import RobotTaskDispatcher from "./pages/RobotTaskDispatcher";
import FleetControl from "./pages/FleetControl";
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

              <Route
                path="/"
                element={
                  <Dashboard />
                }
              />


              <Route
                path="/warehouse"
                element={
                  <WarehouseMap />
                }
              />


              <Route
                path="/locations"
                element={
                  <StorageLocations />
                }
              />


              <Route
                path="/inventory"
                element={
                  <Inventory />
                }
              />


              <Route
                path="/operations"
                element={
                  <WarehouseOperations />
                }
              />


              <Route
                path="/tasks"
                element={
                  <TaskManagement />
                }
              />


              <Route
                path="/dispatcher"
                element={
                  <RobotTaskDispatcher />
                }
              />


              <Route
                path="/inbound"
                element={
                  <Navigate
                    to="/operations"
                    replace
                  />
                }
              />


              <Route
                path="/outbound"
                element={
                  <Navigate
                    to="/operations"
                    replace
                  />
                }
              />


              <Route
                path="/fleet"
                element={
                  <FleetControl />
                }
              />


              <Route
                path="/settings"
                element={
                  <Settings />
                }
              />

            </Routes>

          </main>

        </div>

      </div>

    </BrowserRouter>
  );
}


export default App;