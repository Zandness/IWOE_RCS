const BASE_URL = String(
  import.meta.env.VITE_RCS_BRIDGE_URL || "",
).replace(/\/+$/, "");

export function getRcsBridgeBaseUrl() {
  return BASE_URL || window.location.origin;
}

async function bridgeFetch(
  path,
  { signal, method = "GET", body } = {},
) {
  let response;

  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      signal,

      headers: {
        "Content-Type": "application/json",
      },

      ...(body === undefined
        ? {}
        : { body: JSON.stringify(body) }),
    });
  } catch (cause) {
    throw new Error(
      signal?.aborted
        ? "The request timed out or was cancelled. Check task status before submitting again."
        : `Cannot reach the WMS backend at ${getRcsBridgeBaseUrl()}. Check that FastAPI is running. ${cause.message}`,
    );
  }

  let data;

  try {
    data = await response.json();
  } catch {
    throw new Error(
      `Backend returned an unreadable response (HTTP ${response.status}). Check task status before submitting again.`,
    );
  }

  if (!response.ok || data?.success === false) {
    const detail =
      data?.detail ||
      data?.message ||
      `HTTP ${response.status}`;

    const text =
      typeof detail === "string"
        ? detail
        : detail?.rcsResponse?.message ||
          detail?.message ||
          JSON.stringify(detail);

    const error = new Error(text);

    error.status = response.status;
    error.data = data;

    throw error;
  }

  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data)
  ) {
    throw new Error(
      "Unexpected backend response. Check task status before submitting again.",
    );
  }

  return data;
}

export function getRcsBridgeStatus(options = {}) {
  return bridgeFetch("/api/rcs/status", options);
}

export async function checkRcsConnection(
  robotCode,
  options = {},
) {
  const code = String(robotCode || "").trim();

  if (!code) {
    throw new Error(
      "Enter a robot code for the connection check.",
    );
  }

  const result = await bridgeFetch(
    "/api/rcs/connection/check",
    {
      ...options,
      method: "POST",

      body: {
        singleRobotCode: code,
      },
    },
  );

  if (
    result.connected !== true ||
    result.mode !== "HIK"
  ) {
    throw new Error(
      "RCS did not confirm a connection.",
    );
  }

  return result;
}

// The bridge records the task and forwards it to HIK.
// Basket contents are not included in the RCS command.
export function createRcsBridgeTask(
  command,
  options = {},
) {
  return bridgeFetch("/api/rcs/tasks", {
    ...options,
    method: "POST",
    body: command,
  });
}

export function getRcsBridgeTask(
  bridgeTaskId,
  options = {},
) {
  if (!bridgeTaskId) {
    throw new Error("Missing backend task ID.");
  }

  return bridgeFetch(
    `/api/rcs/tasks/${encodeURIComponent(bridgeTaskId)}`,
    options,
  );
}

export function getAllRcsBridgeTasks(options = {}) {
  return bridgeFetch("/api/rcs/tasks", options);
}