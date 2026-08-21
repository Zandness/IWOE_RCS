import { Package, Bot } from "lucide-react";

export default function WarehouseMap() {
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <span className="page-label">
            WAREHOUSE OPERATIONS
          </span>

          <h2>Warehouse Map</h2>

          <p>
            Warehouse storage locations and robot positions.
          </p>
        </div>
      </div>

      <section className="panel large-map-panel">
        <div className="panel-header">
          <h3>Warehouse Layout</h3>
        </div>

        <div className="large-warehouse-map">
          {Array.from({ length: 72 }, (_, index) => (
            <div
              className="large-map-cell"
              key={index}
            >
              {index === 20 ? (
                <Bot size={19} />
              ) : index % 7 === 0 ? (
                <Package size={17} />
              ) : null}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}