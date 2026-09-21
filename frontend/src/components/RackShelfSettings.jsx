import { useEffect, useState } from "react";

import {
  MAX_SHELVES,
  rackShelfCount,
  rackDepthCount,
} from "../utils/rackStructure.js";

export default function RackShelfSettings({ rack, onSave }) {
  const levels = rackShelfCount(rack);
  const depths = rackDepthCount(rack);
  const savedType = rack.loadType || "BASKET";

  const [loadType, setLoadType] = useState(savedType);
  const [count, setCount] = useState(String(levels));
  const [depth, setDepth] = useState(String(depths));
  const [message, setMessage] = useState("");

  useEffect(() => {
    setLoadType(savedType);
    setCount(String(levels));
    setDepth(String(depths));
    setMessage("");
  }, [rack.id, savedType, levels, depths]);

  const isWholeRack = loadType === "RACK";
  const nextCount = isWholeRack ? 1 : Number(count);

  const hasChanges =
    loadType !== savedType ||
    nextCount !== levels ||
    Number(depth) !== depths;

  function submit(event) {
    event.preventDefault();
    setMessage("");

    try {
      onSave(
        rack.id,
        nextCount,
        Number(depth),
        loadType,
      );

      setMessage("Storage settings saved.");
    } catch (error) {
      setMessage(error.message || "Could not save settings.");
    }
  }

  return (
    <form
      className="monitor-rcs-panel"
      onSubmit={submit}
    >
      <label>
        Load type — {rack.id}

        <select
          value={loadType}
          onChange={(event) => {
            setLoadType(event.target.value);
            setMessage("");
          }}
        >
          <option value="BASKET">Basket</option>
          <option value="PALLET">Pallet</option>
          <option value="RACK">Rack</option>
        </select>
      </label>

      {!isWholeRack && (
        <label>
          {loadType === "BASKET"
            ? "Number of shelf levels"
            : "Number of storage positions"}

          <input
            type="number"
            min="1"
            max={MAX_SHELVES}
            step="1"
            required
            value={count}
            onChange={(event) => setCount(event.target.value)}
          />
        </label>
      )}

      {isWholeRack && (
        <p>
          The robot picks up the whole rack.
          Shelf-level selection is not needed.
        </p>
      )}

      <label>
        Storage depth

        <select
          value={depth}
          onChange={(event) => setDepth(event.target.value)}
        >
          <option value="1">1 depth</option>
          <option value="2">2 depths</option>
        </select>
      </label>

      <button
        type="submit"
        disabled={!hasChanges}
      >
        Save storage settings
      </button>

      <p>
        Before changing the load type, remove stored items
        and finish or cancel related tasks.
      </p>

      {message && (
        <p role="status">{message}</p>
      )}
    </form>
  );
}