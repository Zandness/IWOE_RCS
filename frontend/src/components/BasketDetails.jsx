import { useEffect, useState } from "react";
import { basketOf, binLocationPatch } from "../utils/basketStore";
import LoadTypeVisual, { getLoadInfo } from "./LoadTypeVisual";

export default function BasketDetails({ shelf, loadType = "BASKET", onSave }) {
  const info = getLoadInfo(loadType);
  const load = basketOf(shelf);
  const [message, setMessage] = useState("");
  useEffect(() => setMessage(""), [shelf.id, loadType]);
  const hasContents = (shelf.inventory || []).some(item =>
    Number(item.quantity) > 0 || Number(item.reserved) > 0);
  function apply(remove) {
    try {
      onSave(binLocationPatch(shelf.id, remove));
      setMessage(remove ? `${info.label} unbinned.` : `${info.label} binned.`);
    } catch (error) { setMessage(error.message || "Could not update location."); }
  }
  return (
    <section className="monitor-rcs-panel load-details-panel">
      <div className="load-details-heading">
        <LoadTypeVisual type={info.type} />
        <div>
          <h3>{info.label} · {load ? "Occupied" : "Empty"}</h3>
          <p>{info.description}</p>
        </div>
      </div>
      <div className="load-details-actions">
        <button type="button" disabled={Boolean(load)} onClick={() => apply(false)}>Bin</button>
        <button type="button" disabled={!load || hasContents} onClick={() => apply(true)}>Unbin</button>
      </div>
      <p>Bin marks this position as occupied. Unbin marks it as empty. These actions do not move the robot.</p>
      {load && hasContents && <p>Remove products and reservations before Unbin.</p>}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
