import {
  Package,
  ClipboardList,
  Warehouse,
  Bot,
} from "lucide-react";

const stats = [
  {
    title: "Total Inventory",
    value: "1,284",
    unit: "SKUs",
    icon: Package,
  },
  {
    title: "Active Orders",
    value: "24",
    unit: "Orders",
    icon: ClipboardList,
  },
  {
    title: "Storage Utilization",
    value: "72",
    unit: "%",
    icon: Warehouse,
  },
  {
    title: "Active Robots",
    value: "4",
    unit: "Units",
    icon: Bot,
  },
];

export default function ExecutiveStats() {
  return (
    <div className="stats-grid">
      {stats.map((stat) => {
        const Icon = stat.icon;

        return (
          <div className="status-card" key={stat.title}>
            <div className="status-card-icon">
              <Icon size={22} />
            </div>

            <div>
              <span className="status-card-title">
                {stat.title}
              </span>

              <div className="status-card-value">
                {stat.value}
                <small>{stat.unit}</small>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}