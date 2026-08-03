import { useState } from "react";
import {
  Battery,
  Play,
  Pause,
  Square,
  Home,
  Zap,
  AlertTriangle,
  Wifi,
} from "lucide-react";

const robots = [
  {
    id: "AMR-01",
    status: "ACTIVE",
    battery: 94,
    task: "Order Picking",
    position: "A3",
    destination: "C7",
    speed: "1.2 m/s",
  },
  {
    id: "AMR-02",
    status: "IDLE",
    battery: 82,
    task: "Waiting",
    position: "B2",
    destination: "-",
    speed: "0 m/s",
  },
  {
    id: "AMR-03",
    status: "CHARGING",
    battery: 38,
    task: "Charging",
    position: "Charging Station",
    destination: "-",
    speed: "0 m/s",
  },
  {
    id: "AGV-01",
    status: "ACTIVE",
    battery: 67,
    task: "Transport Pallet",
    position: "C5",
    destination: "A1",
    speed: "0.8 m/s",
  },
];

export default function FleetControl() {
  const [selectedRobot, setSelectedRobot] = useState(robots[0]);

  const sendCommand = (command) => {
    console.log(`${command} -> ${selectedRobot.id}`);

    // Future:
    // websocket.send(JSON.stringify({
    //   robot: selectedRobot.id,
    //   command
    // }))
  };

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 flex justify-between items-center">

        <div>
          <h1 className="text-3xl font-bold text-white">
            Fleet Control Center
          </h1>

          <p className="text-slate-400 mt-2">
            Real-time AMR / AGV Monitoring & Control
          </p>
        </div>

        <div className="flex items-center gap-2 bg-emerald-500/10 text-emerald-400 px-4 py-2 rounded-xl">
          <Wifi size={18}/>
          RCS Connected
        </div>

      </div>

      {/* Summary */}

      <div className="grid grid-cols-5 gap-4">

        <SummaryCard title="Total Robots" value="4" />

        <SummaryCard title="Active" value="2" />

        <SummaryCard title="Idle" value="1" />

        <SummaryCard title="Charging" value="1" />

        <SummaryCard title="Average Battery" value="70%" />

      </div>

      {/* Main */}

      <div className="grid grid-cols-3 gap-6">

        {/* Robot List */}

        <div className="bg-slate-900 rounded-2xl p-5 border border-slate-800">

          <h2 className="text-xl font-semibold text-white mb-4">
            Robot Fleet
          </h2>

          <div className="space-y-3">

            {robots.map((robot) => (

              <button
                key={robot.id}
                onClick={() => setSelectedRobot(robot)}
                className={`w-full rounded-xl p-4 text-left transition

                ${
                  selectedRobot.id === robot.id
                    ? "bg-cyan-500 text-black"
                    : "bg-slate-800 hover:bg-slate-700 text-white"
                }`}
              >

                <div className="flex justify-between">

                  <strong>{robot.id}</strong>

                  <span>{robot.battery}%</span>

                </div>

                <p className="text-sm opacity-80">
                  {robot.status}
                </p>

              </button>

            ))}

          </div>

        </div>

        {/* Robot Information */}

        <div className="bg-slate-900 rounded-2xl p-5 border border-slate-800">

          <h2 className="text-xl font-semibold text-white mb-5">
            Robot Information
          </h2>

          <Info title="Robot ID" value={selectedRobot.id}/>
          <Info title="Status" value={selectedRobot.status}/>
          <Info title="Task" value={selectedRobot.task}/>
          <Info title="Position" value={selectedRobot.position}/>
          <Info title="Destination" value={selectedRobot.destination}/>
          <Info title="Speed" value={selectedRobot.speed}/>

          <div className="mt-5 flex items-center gap-3">

            <Battery className="text-green-400"/>

            <span className="text-white font-semibold">
              {selectedRobot.battery}%
            </span>

          </div>

        </div>

        {/* Control Panel */}

        <div className="bg-slate-900 rounded-2xl p-5 border border-slate-800">

          <h2 className="text-xl font-semibold text-white mb-5">
            Robot Control
          </h2>

          <div className="grid grid-cols-2 gap-3">

            <ControlButton
              icon={<Play size={18}/>}
              text="Start"
              onClick={()=>sendCommand("START")}
            />

            <ControlButton
              icon={<Pause size={18}/>}
              text="Pause"
              onClick={()=>sendCommand("PAUSE")}
            />

            <ControlButton
              icon={<Play size={18}/>}
              text="Resume"
              onClick={()=>sendCommand("RESUME")}
            />

            <ControlButton
              icon={<Square size={18}/>}
              text="Stop"
              onClick={()=>sendCommand("STOP")}
            />

            <ControlButton
              icon={<Home size={18}/>}
              text="Return Home"
              onClick={()=>sendCommand("HOME")}
            />

            <ControlButton
              icon={<Zap size={18}/>}
              text="Charge"
              onClick={()=>sendCommand("CHARGE")}
            />

          </div>

          <button
            onClick={()=>sendCommand("EMERGENCY")}
            className="mt-5 w-full bg-red-600 hover:bg-red-700 rounded-xl py-4 text-white font-bold flex justify-center items-center gap-2"
          >
            <AlertTriangle size={20}/>
            Emergency Stop
          </button>

        </div>

      </div>

    </div>
  );
}

function SummaryCard({ title, value }) {
  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
      <p className="text-slate-400 text-sm">{title}</p>
      <h2 className="text-2xl text-white font-bold mt-2">{value}</h2>
    </div>
  );
}

function Info({ title, value }) {
  return (
    <div className="flex justify-between border-b border-slate-800 py-3">
      <span className="text-slate-400">{title}</span>
      <span className="text-white font-semibold">{value}</span>
    </div>
  );
}

function ControlButton({ icon, text, onClick }) {
  return (
    <button
      onClick={onClick}
      className="bg-cyan-500 hover:bg-cyan-400 rounded-xl p-4 font-semibold text-black flex items-center justify-center gap-2"
    >
      {icon}
      {text}
    </button>
  );
}