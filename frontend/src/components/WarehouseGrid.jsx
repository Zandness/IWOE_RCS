import { Package } from "lucide-react";

const zones = [
  { name: "Zone A", usage: "82%", slots: 24 },
  { name: "Zone B", usage: "68%", slots: 18 },
  { name: "Zone C", usage: "74%", slots: 21 },
  { name: "Zone D", usage: "61%", slots: 16 },
];

export default function WarehouseGrid() {
  return (
    <div className="warehouse-zone-grid">
      {zones.map((zone) => (
        <div className="warehouse-zone-card" key={zone.name}>
          <div className="zone-icon">
            <Package size={20} />
          </div>

          <h4>{zone.name}</h4>

          <span>
            {zone.slots} occupied slots
          </span>

          <div className="usage-row">
            <span>Usage</span>
            <strong>{zone.usage}</strong>
          </div>
        </div>
      ))}
    </div>
  );
}