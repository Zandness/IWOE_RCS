const DEFAULT_RCS_BRIDGE_URL =
  "http://127.0.0.1:8000";


const RCS_BRIDGE_URL =
  String(
    import.meta.env.VITE_RCS_BRIDGE_URL ||
      DEFAULT_RCS_BRIDGE_URL
  ).replace(/\/+$/, "");


/* =========================================================
   BASE URL
========================================================= */

export function getRcsBridgeBaseUrl() {
  return RCS_BRIDGE_URL;
}


/* =========================================================
   READ RESPONSE
========================================================= */

async function readJsonResponse(
  response
) {
  let data = null;


  try {
    data =
      await response.json();
  } catch {
    data = null;
  }


  if (!response.ok) {
    const detail =
      data?.detail ||
      data?.message ||
      `RCS Bridge request failed with HTTP ${response.status}.`;


    const error =
      new Error(
        typeof detail ===
          "string"
          ? detail
          : JSON.stringify(
              detail
            )
      );


    error.status =
      response.status;


    error.data =
      data;


    throw error;
  }


  return data;
}


/* =========================================================
   FETCH WRAPPER
========================================================= */

async function bridgeFetch(
  path,
  options = {}
) {
  let response;


  try {
    response =
      await fetch(
        `${RCS_BRIDGE_URL}${path}`,
        {
          ...options,

          headers: {
            "Content-Type":
              "application/json",

            ...(
              options.headers ||
              {}
            ),
          },
        }
      );
  } catch (error) {
    throw new Error(
      `Cannot connect to WMS RCS Bridge at ${RCS_BRIDGE_URL}. ` +
        `Make sure FastAPI is running. ${
          error?.message ||
          ""
        }`
    );
  }


  return readJsonResponse(
    response
  );
}


/* =========================================================
   BRIDGE STATUS
========================================================= */

export async function getRcsBridgeStatus(
  options = {}
) {
  return bridgeFetch(
    "/api/rcs/status",
    {
      method:
        "GET",

      signal:
        options.signal,
    }
  );
}


/* =========================================================
   CREATE RCS TASK
========================================================= */

export async function createRcsBridgeTask(
  command,
  options = {}
) {
  return bridgeFetch(
    "/api/rcs/tasks",
    {
      method:
        "POST",

      signal:
        options.signal,

      body:
        JSON.stringify(
          command
        ),
    }
  );
}


/* =========================================================
   GET ONE RCS TASK
========================================================= */

export async function getRcsBridgeTask(
  bridgeTaskId,
  options = {}
) {
  if (!bridgeTaskId) {
    throw new Error(
      "bridgeTaskId is required."
    );
  }


  return bridgeFetch(
    `/api/rcs/tasks/${encodeURIComponent(
      bridgeTaskId
    )}`,
    {
      method:
        "GET",

      signal:
        options.signal,
    }
  );
}


/* =========================================================
   GET ALL RCS TASKS
========================================================= */

export async function getAllRcsBridgeTasks(
  options = {}
) {
  return bridgeFetch(
    "/api/rcs/tasks",
    {
      method:
        "GET",

      signal:
        options.signal,
    }
  );
}