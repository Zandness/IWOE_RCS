import { useEffect, useState } from "react";

import {
  MAX_SHELVES,
  rackShelfCount,
  rackDepthCount,
} from "../utils/rackStructure.js";

export default function RackShelfSettings({
  rack,
  onSave,
}) {
  const levels = rackShelfCount(rack);
  const depths = rackDepthCount(rack);

  const [count, setCount] = useState(
    String(levels),
  );

  const [depth, setDepth] = useState(
    String(depths),
  );

  const [message, setMessage] = useState("");

  useEffect(() => {
    setCount(String(levels));
    setDepth(String(depths));
    setMessage("");
  }, [rack.id, levels, depths]);

  function submit(event) {
    event.preventDefault();

    try {
      onSave(rack.id, count, depth);

      setMessage(
        "Rack saved. Enter the actual RCS location code for each new point.",
      );
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <form
      className="monitor-rcs-panel"
      onSubmit={submit}
    >
      <label>
        Number of shelf levels — {rack.id}

        <input
          type="number"
          min="1"
          max={MAX_SHELVES}
          step="1"
          required
          value={count}
          onChange={(event) =>
            setCount(event.target.value)
          }
        />
      </label>

      <label>
        Rack depth

        <select
          value={depth}
          onChange={(event) =>
            setDepth(event.target.value)
          }
        >
          <option value="1">1 depth</option>
          <option value="2">2 depths</option>
        </select>
      </label>

      <button
        type="submit"
        disabled={
          Number(count) === levels &&
          Number(depth) === depths
        }
      >
        Save rack structure
      </button>

      <p>
        Each level has one location per depth.
        Removed locations must be empty and unreserved.
      </p>

      {message && (
        <p role="status">{message}</p>
      )}
    </form>
  );
}