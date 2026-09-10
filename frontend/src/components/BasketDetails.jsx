import {
  useEffect,
  useState,
} from "react";

import {
  basketOf,
} from "../utils/basketStore";

export default function BasketDetails({
  shelf,
  onSave,
}) {
  const basket = basketOf(shelf);

  const [id, setId] = useState(
    basket?.id || ""
  );

  const [message, setMessage] = useState("");

  useEffect(() => {
    setId(basket?.id || "");
    setMessage("");
  }, [shelf.id, basket?.id]);

  const hasContents = shelf.inventory.some(
    (item) =>
      Number(item.quantity) > 0 ||
      Number(item.reserved) > 0
  );

  function save(remove = false) {
    try {
      if (!remove && !id.trim()) {
        throw new Error(
          "Enter a basket ID."
        );
      }

      if (remove && hasContents) {
        throw new Error(
          "Deduct all contents before removing an empty basket."
        );
      }

      onSave({
        basket: remove
          ? null
          : { id: id.trim() },

        capacity: 1,

        ...(remove
          ? { inventory: [] }
          : {}),
      });

      setMessage(
        remove
          ? "Empty basket removed."
          : "Basket saved. Use Inbound below to add products and quantities."
      );
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <section className="monitor-rcs-panel">
      <h3>
        Basket · {basket ? "1 / 1" : "0 / 1"}
      </h3>

      <p>
        Product quantities belong to this basket.
        They are managed in WMS and are not sent to RCS.
      </p>

      <label>
        Basket ID

        <input
          value={id}
          onChange={(event) =>
            setId(event.target.value)
          }
          placeholder="e.g. BASKET-001"
        />
      </label>

      <button
        type="button"
        onClick={() => save()}
      >
        Save Basket
      </button>

      {basket && (
        <button
          type="button"
          disabled={hasContents}
          onClick={() => save(true)}
        >
          Remove Empty Basket
        </button>
      )}

      {message && (
        <p role="status">
          {message}
        </p>
      )}
    </section>
  );
}