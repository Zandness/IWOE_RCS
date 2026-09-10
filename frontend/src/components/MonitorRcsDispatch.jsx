import {
  useEffect,
  useState,
} from "react";

import {
  Link,
} from "react-router-dom";

import {
  readMonitor,
  shelvesOf,
  validateTransfer,
  isReserved,
} from "../utils/basketStore";

import "../styles/MonitorRcsDispatch.css";

import {
  loadPreferences,
} from "../utils/dashboardData";

export default function MonitorRcsDispatch() {
  const [shelves, setShelves] = useState([]);

  const [source, setSource] = useState("");
  const [destination, setDestination] = useState("");

  const [priority, setPriority] = useState(() => loadPreferences().defaultPriority);
  const [sendTime, setSendTime] = useState("");

  const [message, setMessage] = useState("");

  useEffect(() => {
    function refresh() {
      try {
        setShelves(
          shelvesOf(readMonitor())
        );
      } catch (error) {
        setMessage(error.message);
      }
    }

    refresh();

    const events = [
      "wms-monitor-data-changed",
      "wms-data-changed",
      "storage",
      "focus",
    ];

    events.forEach((eventName) => {
      window.addEventListener(
        eventName,
        refresh
      );
    });

    return () => {
      events.forEach((eventName) => {
        window.removeEventListener(
          eventName,
          refresh
        );
      });
    };
  }, []);

  function submit(event) {
    event.preventDefault();

    try {
      const { from, to } = validateTransfer(
        source,
        destination
      );

      const time = sendTime
        ? new Date(sendTime)
        : new Date();

      if (!Number.isFinite(time.getTime())) {
        throw new Error(
          "Invalid send time."
        );
      }

      const request = {
        handled: false,
        error: "",

        payload: {
          from,
          to,

          scheduledSendAt:
            time.toISOString(),

          draft: {
            taskType: "CTUB1",
            initPriority: priority,
          },
        },
      };

      window.dispatchEvent(
        new CustomEvent(
          "wms-rcs-enqueue-request",
          {
            detail: request,
          }
        )
      );

      if (
        !request.handled ||
        request.error
      ) {
        throw new Error(
          request.error ||
          "Dispatch queue unavailable."
        );
      }

      setSource("");
      setDestination("");

      setMessage(
        "Basket transfer queued. Open RCS Dispatch to start or review the queue."
      );
    } catch (error) {
      setMessage(error.message);
    }
  }

  const from = shelves.find(
    (shelf) => shelf.id === source
  );

  const sourceShelves = shelves.filter(
    (shelf) => shelf.basket
  );

  const destinationShelves = shelves.filter(
    (shelf) =>
      !shelf.basket &&
      !shelf.inventory.length
  );

  return (
    <section className="monitor-rcs-panel">
      <h3>Move a basket</h3>

      <p>
        One basket per location. Contents move with
        the basket after RCS confirms completion.
      </p>

      <form onSubmit={submit}>
        <div className="monitor-rcs-fields">
          <label>
            Source location

            <select
              required
              value={source}
              onChange={(event) =>
                setSource(event.target.value)
              }
            >
              <option value="">
                Select basket
              </option>

              {sourceShelves.map((shelf) => {
                const reserved = isReserved(
                  shelf.id
                );

                return (
                  <option
                    key={shelf.id}
                    value={shelf.id}
                    disabled={reserved}
                  >
                    {shelf.code}
                    {" · "}
                    {shelf.basket.id}
                    {reserved
                      ? " · Reserved"
                      : ""}
                  </option>
                );
              })}
            </select>
          </label>

          <label>
            Destination location

            <select
              required
              value={destination}
              onChange={(event) =>
                setDestination(
                  event.target.value
                )
              }
            >
              <option value="">
                Select empty location
              </option>

              {destinationShelves.map((shelf) => {
                const reserved = isReserved(
                  shelf.id
                );

                const blocked = [
                  "BLOCKED",
                  "MAINTENANCE",
                ].includes(shelf.status);

                return (
                  <option
                    key={shelf.id}
                    value={shelf.id}
                    disabled={
                      reserved || blocked
                    }
                  >
                    {shelf.code}
                    {reserved
                      ? " · Reserved"
                      : ""}
                  </option>
                );
              })}
            </select>
          </label>

          <label>
            Priority

            <select
              value={priority}
              onChange={(event) =>
                setPriority(
                  Number(event.target.value)
                )
              }
            >
              <option value={30}>
                Low
              </option>

              <option value={60}>
                Normal
              </option>

              <option value={90}>
                High
              </option>

              <option value={120}>
                Urgent
              </option>
            </select>
          </label>

          <label>
            Scheduled send time

            <input
              type="datetime-local"
              value={sendTime}
              onChange={(event) =>
                setSendTime(event.target.value)
              }
            />

            <small>
              Local time. Leave empty for the
              next available turn.
            </small>
          </label>
        </div>

        {from && (
          <p>
            {from.basket.id}
            {": "}

            {from.inventory
              .map(
                (item) =>
                  `${item.sku} · ${item.name}: ` +
                  `${item.quantity} ${item.unit}`
              )
              .join(", ") || "Empty basket"}
          </p>
        )}

        <button
          type="submit"
          disabled={
            !source || !destination
          }
        >
          Add to Queue
        </button>

        {" "}

        <Link to="/dispatcher">
          Open RCS Dispatch
        </Link>
      </form>

      {message && (
        <p role="status">
          {message}
        </p>
      )}
    </section>
  );
}