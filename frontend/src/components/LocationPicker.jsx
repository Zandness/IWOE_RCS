import { useState } from "react";

export function filterLocations(
  shelves,
  query,
  rack,
  depth,
  availableOnly,
  unavailable,
) {
  const tokens = query
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return shelves.filter((shelf) => {
    const text = [
      shelf.code,
      shelf.rack,
      shelf.basket?.id,

      ...(shelf.inventory || []).flatMap(
        (item) => [item.sku, item.name],
      ),
    ]
      .join(" ")
      .toLowerCase();

    return (
      (!rack || shelf.rack === rack) &&
      (
        !depth ||
        Number(shelf.depth || 1) === Number(depth)
      ) &&
      tokens.every((token) => text.includes(token)) &&
      (!availableOnly || !unavailable(shelf))
    );
  });
}

export default function LocationPicker({
  label,
  shelves,
  value,
  onChange,
  unavailable,
}) {
  const [query, setQuery] = useState("");
  const [rack, setRack] = useState("");
  const [depth, setDepth] = useState("");

  const [availableOnly, setAvailableOnly] =
    useState(true);

  const racks = [
    ...new Set(
      shelves.map((shelf) => shelf.rack),
    ),
  ].sort((a, b) =>
    a.localeCompare(b, undefined, {
      numeric: true,
    }),
  );

  const selected = shelves.find(
    (shelf) => shelf.id === value,
  );

  const visible = filterLocations(
    shelves,
    query,
    rack,
    depth,
    availableOnly,
    unavailable,
  );

  // Keep the selected location visible even if filters change.
  const choices =
    selected &&
    !visible.some((shelf) => shelf.id === value)
      ? [selected, ...visible]
      : visible;

  function describe(shelf) {
    return [
      shelf.code || "Set RCS code",
      `Rack ${shelf.rack}`,
      `L${shelf.level} / D${shelf.depth || 1}`,
      shelf.basket?.id || "Empty",
    ].join(" · ");
  }

  return (
    <fieldset
      style={{
        minWidth: 0,
        border: "1px solid #334155",
        borderRadius: 8,
        padding: 12,
      }}
    >
      <legend>{label}</legend>

      <label>
        Search location, basket or SKU

        <input
          type="search"
          value={query}
          onChange={(event) =>
            setQuery(event.target.value)
          }
          placeholder="e.g. R8A04011 or 002"
        />
      </label>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 8,
        }}
      >
        <label>
          Rack

          <select
            value={rack}
            onChange={(event) =>
              setRack(event.target.value)
            }
          >
            <option value="">All racks</option>

            {racks.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <label>
          Depth

          <select
            value={depth}
            onChange={(event) =>
              setDepth(event.target.value)
            }
          >
            <option value="">All depths</option>
            <option value="1">Depth 1</option>
            <option value="2">Depth 2</option>
          </select>
        </label>
      </div>

      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <input
          style={{ width: "auto" }}
          type="checkbox"
          checked={availableOnly}
          onChange={(event) =>
            setAvailableOnly(event.target.checked)
          }
        />

        Available locations only
      </label>

      <label>
        Select {label.toLowerCase()}

        <select
          required
          size={6}
          value={value}
          onChange={(event) =>
            onChange(event.target.value)
          }
          style={{
            width: "100%",
            height: 160,
          }}
        >
          <option value="">Select a location</option>

          {choices.map((shelf) => (
            <option
              key={shelf.id}
              value={shelf.id}
              disabled={unavailable(shelf)}
            >
              {describe(shelf)}
              {unavailable(shelf)
                ? " · Unavailable"
                : ""}
            </option>
          ))}
        </select>
      </label>

      <small>
        {visible.length} matching locations
      </small>

      <p aria-live="polite">
        {selected
          ? `Selected: ${describe(selected)}${
              unavailable(selected)
                ? " — unavailable; choose another point"
                : ""
            }`
          : "No location selected"}
      </p>

      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
        >
          Clear selection
        </button>
      )}
    </fieldset>
  );
}