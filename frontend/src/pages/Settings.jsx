import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  getRcsBridgeBaseUrl,
  getRcsBridgeStatus,
  checkRcsConnection,
} from "../services/rcs";

import {
  loadPreferences,
  PREFERENCES_KEY,
} from "../utils/dashboardData";

import "../styles/OverviewSettings.css";

export default function Settings() {
  const [draft, setDraft] = useState(loadPreferences);
  const [message, setMessage] = useState("");
  const [bridge, setBridge] = useState(null);

  const [bridgeMessage, setBridgeMessage] = useState(
    "Not checked",
  );

  const [robotCode, setRobotCode] = useState("30964");

  const [rcsMessage, setRcsMessage] = useState(
    "Not checked",
  );

  const [busy, setBusy] = useState(false);
  const controllerRef = useRef(null);

  useEffect(() => {
    return () => {
      controllerRef.current?.abort();
    };
  }, []);

  function save(event) {
    event.preventDefault();

    try {
      if (!draft.warehouseName.trim()) {
        throw new Error("Enter a warehouse name.");
      }

      const value = {
        warehouseName: draft.warehouseName.trim(),
        defaultPriority: Number(draft.defaultPriority),
      };

      localStorage.setItem(
        PREFERENCES_KEY,
        JSON.stringify(value),
      );

      window.dispatchEvent(
        new CustomEvent("wms-preferences-changed"),
      );

      setMessage(
        "Saved. The default priority applies when opening a new transfer form. Existing tasks are unchanged.",
      );
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function check(realRcs = false) {
    if (controllerRef.current) {
      return;
    }

    const request = new AbortController();

    controllerRef.current = request;
    setBusy(true);

    const timer = window.setTimeout(
      () => request.abort(),
      35000,
    );

    try {
      if (realRcs) {
        setRcsMessage("Checking robot response…");

        await checkRcsConnection(robotCode, {
          signal: request.signal,
        });

        setRcsMessage(
          `RCS responded to robot ${robotCode.trim()} query at ${new Date().toLocaleTimeString()}.`,
        );
      } else {
        setBridge(null);
        setBridgeMessage("Checking backend…");

        const status = await getRcsBridgeStatus({
          signal: request.signal,
        });

        if (status.ok !== true) {
          throw new Error(
            "Unexpected backend response.",
          );
        }

        setBridge(status);

        setBridgeMessage(
          `Backend responded at ${new Date().toLocaleTimeString()}.`,
        );
      }
    } catch (error) {
      const text = request.signal.aborted
        ? "Check timed out or was cancelled."
        : error.message;

      if (realRcs) {
        setRcsMessage(text);
      } else {
        setBridgeMessage(text);
      }
    } finally {
      window.clearTimeout(timer);
      controllerRef.current = null;
      setBusy(false);
    }
  }

  return (
    <div className="page wms-overview">
      <div className="page-header">
        <div>
          <span className="page-label">
            SYSTEM PREFERENCES
          </span>

          <h2>Settings</h2>

          <p>
            Warehouse preferences and connection checks.
          </p>
        </div>
      </div>

      <div className="overview-columns">
        <section className="panel overview-section">
          <h3>Warehouse preferences</h3>

          <form
            className="overview-form"
            onSubmit={save}
          >
            <label>
              Warehouse name

              <input
                required
                maxLength={100}
                value={draft.warehouseName}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    warehouseName: event.target.value,
                  })
                }
              />
            </label>

            <label>
              Default transfer priority

              <select
                value={draft.defaultPriority}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    defaultPriority:
                      Number(event.target.value),
                  })
                }
              >
                <option value={30}>Low</option>
                <option value={60}>Normal</option>
                <option value={90}>High</option>
                <option value={120}>Urgent</option>
              </select>
            </label>

            <p>
              Saved for this browser. You can override
              priority for each transfer in Monitor.
            </p>

            <button className="primary-button">
              Save preferences
            </button>

            <p role="status">{message}</p>
          </form>
        </section>

        <section className="panel overview-section">
          <h3>Storage and queue rules</h3>

          <dl className="overview-facts">
            <div>
              <dt>Location capacity</dt>
              <dd>1 basket per point</dd>
            </div>

            <div>
              <dt>Basket contents</dt>
              <dd>Multiple products and quantities</dd>
            </div>

            <div>
              <dt>Location update</dt>
              <dd>After confirmed completion</dd>
            </div>

            <div>
              <dt>Warehouse data</dt>
              <dd>This browser</dd>
            </div>
          </dl>

          <p>
            Keep one WMS tab open for automatic dispatch.
            Warehouse layout and basket contents are
            managed in Monitor.
          </p>
        </section>
      </div>

      <section className="panel overview-section">
        <h3>FastAPI backend and HIK RCS</h3>

        <div className="overview-form">
          <label>
            Backend API URL

            <input
              readOnly
              value={getRcsBridgeBaseUrl()}
            />
          </label>

          <p>
            By default, the website forwards API requests
            to FastAPI through the web server.
            VITE_RCS_BRIDGE_URL can override this address.
            Change it in the frontend environment
            configuration and restart Vite.
            HIK credentials and server settings remain
            in the backend configuration.
          </p>

          <button
            type="button"
            className="primary-button"
            disabled={busy}
            onClick={() => check(false)}
          >
            Check backend
          </button>

          <p role="status">{bridgeMessage}</p>

          {bridge && (
            <dl className="overview-facts">
              <div>
                <dt>Mode</dt>
                <dd>{bridge.bridgeMode || "Unknown"}</dd>
              </div>

              <div>
                <dt>HIK configured</dt>
                <dd>
                  {bridge.hikConfigured ? "Yes" : "No"}
                </dd>
              </div>

              <div>
                <dt>Backend task database</dt>
                <dd>{bridge.database || "Unknown"}</dd>
              </div>
            </dl>
          )}

          <label>
            Robot code for connection check

            <input
              value={robotCode}
              disabled={busy}
              onChange={(event) => {
                setRobotCode(event.target.value);
                setRcsMessage("Not checked");
              }}
            />
          </label>

          <button
            type="button"
            className="primary-button"
            disabled={busy || !robotCode.trim()}
            onClick={() => check(true)}
          >
            Check RCS connection
          </button>

          <p role="status">{rcsMessage}</p>

          <p>
            This checks a robot query only.
            It does not submit movement tasks.
            A backend response alone does not confirm
            an RCS connection.
          </p>
        </div>
      </section>
    </div>
  );
}