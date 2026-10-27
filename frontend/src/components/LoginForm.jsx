import { useState } from "react";
import { authRequest } from "../utils/wmsAuth";

export default function LoginForm({ needsSetup, onSignedIn }) {
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      const result = await authRequest(
        needsSetup ? "setup" : "login",
        {
          method: "POST",
          body: {
            username,
            password,
            ...(needsSetup
              ? {
                  display_name: name,
                  role: "admin",
                }
              : {}),
          },
        }
      );

      setPassword("");
      await onSignedIn(result.user);
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel overview-section login-panel">
      <img
        src={`${import.meta.env.BASE_URL}wms-logo.png`}
        alt="WMS logo"
        width={144}
        height={144}
        style={{
          display: "block",
          objectFit: "contain",
          margin: "0 auto 20px",
          maxWidth: "100%",
        }}
      />

      <h2>
        {needsSetup
          ? "Create the first administrator"
          : "Sign in to WMS"}
      </h2>

      <p>
        {needsSetup
          ? "Create your own administrator account. Existing warehouse data will be preserved. The first account always has Admin permission."
          : "Use the account created by your WMS administrator. Accounts and RCS permissions are checked by the Backend. Warehouse data stays in this browser."}
      </p>

      <form onSubmit={submit}>
        <div className="overview-form">
          <label>
            Username
            <input
              required
              autoComplete="username"
              maxLength={64}
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
          </label>

          {needsSetup && (
            <label>
              Display name
              <input
                required
                autoComplete="name"
                maxLength={100}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
          )}

          <label>
            Password
            <input
              required
              type="password"
              autoComplete={
                needsSetup ? "new-password" : "current-password"
              }
              minLength={needsSetup ? 12 : 1}
              maxLength={128}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
        </div>

        {needsSetup && (
          <p>
            Use a unique password with at least 12 characters.
            There is no default administrator password.
          </p>
        )}

        <div className="overview-actions">
          <button
            type="submit"
            className="primary-button"
            disabled={busy}
          >
            {busy
              ? "Please wait…"
              : needsSetup
                ? "Create administrator"
                : "Sign in"}
          </button>
        </div>
      </form>

      {error && <p role="alert">{error}</p>}
    </section>
  );
}