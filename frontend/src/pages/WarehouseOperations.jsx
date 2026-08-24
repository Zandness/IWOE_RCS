import {
  ArrowDownToLine,
  ArrowUpFromLine,
} from "lucide-react";

import { useState } from "react";

import InboundOperations from "../components/operations/InboundOperations";
import OutboundOperations from "../components/operations/OutboundOperations";

import "../styles/WarehouseOperations.css";

export default function WarehouseOperations() {
  const [activeTab, setActiveTab] =
    useState("INBOUND");

  return (
    <div className="warehouse-operations-page">
      <div className="warehouse-operations-header">
        <div>
          <span className="warehouse-operations-label">
            WAREHOUSE MANAGEMENT
          </span>

          <h2>
            Warehouse Operations
          </h2>

          <p>
            Manage receiving, putaway,
            stock allocation, picking
            and dispatch from one
            workspace.
          </p>
        </div>
      </div>

      <div
        className="warehouse-operations-tabs"
        role="tablist"
      >
        <button
          type="button"
          role="tab"
          aria-selected={
            activeTab === "INBOUND"
          }
          className={
            activeTab === "INBOUND"
              ? "active"
              : ""
          }
          onClick={() =>
            setActiveTab("INBOUND")
          }
        >
          <ArrowDownToLine
            size={18}
          />

          <div>
            <strong>
              Inbound
            </strong>

            <span>
              Receiving & Putaway
            </span>
          </div>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={
            activeTab === "OUTBOUND"
          }
          className={
            activeTab === "OUTBOUND"
              ? "active"
              : ""
          }
          onClick={() =>
            setActiveTab("OUTBOUND")
          }
        >
          <ArrowUpFromLine
            size={18}
          />

          <div>
            <strong>
              Outbound
            </strong>

            <span>
              Allocation, Picking &
              Dispatch
            </span>
          </div>
        </button>
      </div>

      <div className="warehouse-operations-content">
        {activeTab === "INBOUND" ? (
          <InboundOperations
            embedded
          />
        ) : (
          <OutboundOperations
            embedded
          />
        )}
      </div>
    </div>
  );
}