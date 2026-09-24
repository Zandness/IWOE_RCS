# Warehouse Management System with External RCS Integration

A web-based Warehouse Management System (WMS) for storage monitoring, inventory operations, and load-transfer requests. The frontend uses React and Vite. A FastAPI backend connects the WMS to an external HIK Robot Control System (RCS).

The WMS manages what to move, the source and destination, priority, and sending time. The external RCS manages robot assignment, navigation, traffic, and physical task execution.

> This is a prototype for development and local warehouse testing. It is not a complete production WMS.

## Documentation scope

This README covers the project source shared on 22 September 2026 and the subsequent changes: removal of Fleet Control and WMS depth-2 placement logic. Apply those source changes when using this README with an older project copy. Older copies may still contain Fleet Control or the original `basketStore.js`.

The repository or local folder may still be named `IWOE_RCS`; that name does not indicate implemented AI optimization.

## Features

| Area | Functions |
| --- | --- |
| Dashboard | Warehouse summaries, storage usage, inventory, and task information |
| Warehouse Monitor | Schematic storage map, zoom and pan, storage details, levels, and depths |
| Load types | Basket, Pallet, and Rack |
| Inventory & Storage Data | View warehouse records based on Monitor data |
| Warehouse Operations | Inbound stock, outbound picking, reservations, and direct stock deductions |
| Task Management | Overview of warehouse operations and transfer tasks |
| Transfer preparation | Source and destination selection, RCS target types and codes, task type, optional robot code, priority, and scheduled sending |
| RCS Dispatch Queue | Queue ordering, submission, status polling, and review of unresolved submissions |
| Command history | Collapsible history, search, command reuse, and 20 entries per page |
| Input history | Remember previously entered task types and robot codes in the browser |
| Appearance | Night and Day themes with a toggle |
| Settings | Warehouse preferences and backend/RCS connection checks |

Fleet Control is excluded from the updated interface. Removing it does not remove the RCS Dispatch Queue or optional robot-code input.

## Architecture

| Component | Responsibility | Storage |
| --- | --- | --- |
| React frontend | Warehouse interface, inventory operations, transfer validation, scheduling, and queue processing | Browser local storage |
| FastAPI bridge | Validate requests, prepare HIK payloads, submit tasks, and retrieve task status | SQLite task records |
| External HIK RCS | Select and control robots, plan routes, and execute installed task workflows | Managed by the external system |

The frontend calls `/api/rcs/tasks` on the bridge. The bridge prepares a `targetRoute` and sends it to HIK `/task/submit`. The frontend then polls the bridge. A confirmed `COMPLETED` status triggers the WMS load-location update.

The dispatcher remains mounted while navigating between WMS pages. Closing the browser tab stops its automatic dispatch and polling.

## Main source files

| Path | Purpose |
| --- | --- |
| `frontend/src/App.jsx` | Application routes and mounted dispatcher |
| `frontend/src/pages/WarehouseMap.jsx` | Warehouse Monitor |
| `frontend/src/pages/WarehouseData.jsx` | Inventory and storage data |
| `frontend/src/pages/WarehouseOperations.jsx` | Warehouse operation pages |
| `frontend/src/pages/TaskManagement.jsx` | Task overview |
| `frontend/src/pages/RobotTaskDispatcher.jsx` | Queue, dispatch, and task polling |
| `frontend/src/components/MonitorRcsDispatch.jsx` | Transfer form and command history |
| `frontend/src/components/ThemeToggle.jsx` | Day/Night control |
| `frontend/src/utils/basketStore.js` | Load validation, local Bin/Unbin, and completed transfers |
| `frontend/src/utils/rackStructure.js` | Storage levels and depths |
| `frontend/src/utils/warehouseOperations.js` | Stock operations |
| `frontend/src/services/rcs.js` | Frontend bridge API client |
| `frontend/src/styles/Theme.css` | Theme styles |
| `frontend/vite.config.js` | Frontend server and API proxy |
| `backend/main.py` | FastAPI app, SQLite records, and tracked RCS tasks |
| `backend/hik_api.py` | Direct HIK API proxy routes |
| `backend/tests/test_hik_api.py` | Backend contract tests |

## Requirements

- Node.js compatible with the included Vite version: `^20.19.0` or `>=22.12.0`.
- npm.
- Python 3.10 or later; the backend uses Python 3.10 union-type syntax.
- A browser with JavaScript and local storage enabled.
- For physical testing: access from the backend computer to the RCS network, configured robots, and installed RCS task templates.

Install dependencies before disconnecting from the internet.

## Installation

Run the following commands from the repository root unless another directory is shown.

### 1. Backend

```bash
cd backend
python -m venv .venv
```

Activate the environment on Windows PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
```

Or on macOS/Linux:

```bash
source .venv/bin/activate
```

Install dependencies:

```bash
python -m pip install -r requirements.txt
```

Copy `backend/.env.example` to `backend/.env` and configure it as described below.

Start the backend from `backend/`:

```bash
python -m uvicorn main:app --host 127.0.0.1 --port 8000
```

Use `--reload` during development if needed. Restart the backend after changing its environment settings.

### 2. Frontend

Open another terminal from the repository root:

```bash
cd frontend
npm ci
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

`npm ci` uses the committed `package-lock.json`. If maintaining dependencies intentionally, update the manifest and lockfile together.

## Configuration

### Backend environment

Example `backend/.env` for local mock testing:

```dotenv
RCS_MODE=MOCK
HIK_RCS_BASE_URL=http://192.168.200.101/rcs/rtas/api/robot/controller
HIK_RCS_API_VERSION=v1.0
HIK_RCS_TIMEOUT_SECONDS=30
HIK_TASK_TYPE=
```

For physical RCS integration, change `RCS_MODE` to `HIK` and verify the controller address and port for the installation. The address above is the project test-network address, not a universal HIK default. Older `.env.example` copies may contain a different address.

| Variable | Meaning |
| --- | --- |
| `RCS_MODE` | `MOCK` for backend simulation or `HIK` for the external controller |
| `HIK_RCS_BASE_URL` | HIK controller base URL |
| `HIK_RCS_API_VERSION` | Value sent in the HIK API version header |
| `HIK_RCS_TIMEOUT_SECONDS` | Backend timeout for upstream RCS requests |
| `HIK_TASK_TYPE` | Installed task template used when a tracked request specifies generic `TRANSPORT` |

Explicit task types such as `CTUB1`, `PF-LMR-COMMON`, and `PF-FMR-COMMON` must exist in the target RCS installation. A task type name alone does not guarantee support for a load or route.

Existing process environment variables take precedence over `backend/.env`.

### Frontend environment

The default development setup proxies `/api` to `http://127.0.0.1:8000`.

Optional `frontend/.env`:

```dotenv
WMS_BRIDGE_TARGET=http://127.0.0.1:8000
VITE_RCS_BRIDGE_URL=
```

- `WMS_BRIDGE_TARGET` changes the Vite development/preview proxy target.
- Keep `VITE_RCS_BRIDGE_URL` empty to use relative API paths through that proxy.
- Set `VITE_RCS_BRIDGE_URL` only when the browser should call the bridge directly. Configure backend CORS for that frontend origin.
- Do not point the frontend directly at the HIK controller.
- Restart Vite after editing environment settings. Rebuild for changes to frontend build-time variables.

The supplied backend allows `http://localhost:5173` and `http://127.0.0.1:5173`. Other origins require a CORS change in `backend/main.py`.

## Warehouse rules

### Storage and inventory

- Each storage point holds at most one load.
- A load may contain several inventory records.
- Basket and Pallet storage can use configured levels, up to eight. Whole-Rack storage uses one pickup level.
- Storage supports up to two depths per level.
- Source and destination must support the same load type.
- The source must contain a load and the selected destination must be empty.
- WMS location codes must be present and unique.
- Blocked, maintenance, and reserved locations are restricted.
- Source stock reservations must be resolved before transferring the load.
- A transfer moves the load and its inventory without changing the total product quantity.

Local **Bin/Unbin** changes occupancy in WMS and uses an internal load ID. It does not automatically bind or unbind a carrier in RCS. Direct binding API routes exist separately in the backend.

### Automatic placement at depth 2

The updated `basketStore.js` reflects the stated robot behavior in WMS after confirmed completion:

| Selected destination | Depth-2 slot on the same storage and level | Recorded WMS destination |
| --- | --- | --- |
| Depth 1 | Empty | Depth 2 |
| Depth 1 | Occupied | Depth 1 |
| Depth 1 | Does not exist | Depth 1 |
| Depth 2 | Empty | Depth 2 |

The RCS request still uses the selected destination and its original code. This rule changes only the completed WMS location update. Both the load and its inventory move together. Warehouse history records the requested destination and actual destination.

An empty depth-2 slot marked blocked or under maintenance requires review instead of an automatic update. Previously applied transfers are protected from duplicate updates and are not moved retrospectively.

This is a local rule based on WMS occupancy at completion, not a sensor-confirmed position returned by RCS. The current reservation check covers the selected source and destination; it does not additionally reserve the implicit depth-2 destination. Avoid editing that paired slot during a transfer and verify physical placement during testing.

## Transfer workflow

1. Open Warehouse Monitor and configure storage and location codes.
2. Ensure the source load and destination occupancy match the warehouse.
3. Select the source and destination WMS locations.
4. Choose each RCS target type and enter its registered RCS code.
5. Enter the installed task type and optional robot code.
6. Select priority and optional sending time.
7. Review the command preview and add the task to the queue.
8. Start the queue from RCS Dispatch Queue, or use **Add and start dispatch**.
9. Monitor the returned task ID and status until completion.

Leaving the robot code empty allows RCS assignment. Leaving the sending time empty makes the task eligible immediately; the queue must still be running.

### Queue ordering

| Priority | Value |
| --- | --- |
| Low | 30 |
| Normal | 60 |
| High | 90 |
| Urgent | 120 |

Only tasks whose sending time has arrived are eligible. Eligible tasks are ordered by highest priority, then creation time. A new higher-priority task waits for the active task to finish; it does not interrupt that task.

**Pause Queue** prevents new submissions. It does not cancel or stop an active robot task.

### Command history

History can be collapsed, searched, and viewed in pages of 20 entries. **Reuse** copies a saved command into the form for review; it does not submit immediately. History comes from the browser queue, so removing a queue record also removes it from this history view.

## RCS target types

Load type and RCS target type are separate choices. A Pallet or Rack does not automatically imply one particular target type.

| Target type | RCS identifier |
| --- | --- |
| `STORAGE` | Registered bin alias |
| `SITE` | Registered point alias |
| `CARRIER` | Actual carrier number registered in RCS |

Internal IDs such as `BASKET-...` and `RACK-...` are WMS identifiers. They are not automatically valid RCS carrier numbers. Match the target type, code, and installed workflow.

## API examples

Interactive API documentation is available at [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs).

The following payloads are examples. Replace location codes, robot codes, and task types with values from the actual installation before physical testing.

### Read-only connection check

`POST /api/rcs/connection/check`

```json
{
  "singleRobotCode": "YOUR_REGISTERED_ROBOT_CODE"
}
```

This performs a live robot query in HIK mode. `GET /api/rcs/status` checks local configuration and does not prove that RCS is reachable.

### WMS-tracked transfer

`POST /api/rcs/tasks`

```json
{
  "robotTaskCode": "WMS-TRANSFER-001",
  "taskType": "CTUB1",
  "initPriority": 60,
  "source": {
    "type": "STORAGE",
    "code": "R8A04011",
    "autoStart": 1
  },
  "destination": {
    "type": "STORAGE",
    "code": "R1A03011",
    "autoStart": 1
  }
}
```

The bridge prepares this upstream HIK payload:

```json
{
  "taskType": "CTUB1",
  "targetRoute": [
    {
      "seq": 0,
      "type": "STORAGE",
      "code": "R8A04011",
      "autoStart": 1
    },
    {
      "seq": 1,
      "type": "STORAGE",
      "code": "R1A03011",
      "autoStart": 1
    }
  ],
  "initPriority": 60
}
```

An optional `robotCode` can be included in the tracked request. The WMS task reference and returned RCS task ID are separate identifiers. The bridge retains `mapCode` when supplied but the current HIK route builder does not forward it.

The backend stores `scheduledSendAt`, but it does not wait until that time before submitting an API request. Scheduling is enforced by the frontend queue. Calling the backend directly submits immediately.

### Main endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Backend health |
| GET | `/api/rcs/status` | Bridge mode and configuration |
| POST | `/api/rcs/connection/check` | Live robot query for connectivity |
| POST | `/api/rcs/tasks` | Create a tracked bridge task |
| GET | `/api/rcs/tasks` | List bridge tasks and refresh statuses |
| GET | `/api/rcs/tasks/{bridge_task_id}` | Retrieve one bridge task |
| POST | `/api/rcs/robot/query` | Direct robot query |
| POST | `/api/rcs/task/query` | Direct task query |
| POST | `/api/rcs/task/cancel` | Direct task cancellation |
| POST | `/api/{family}/task/submit` | Direct submission for `ctu`, `lmr`, `fmr`, or `qf` |

Additional family query/cancel and carrier/site binding routes are described in Swagger. Direct HIK routes require HIK mode and do not create the same WMS-tracked bridge record as `/api/rcs/tasks`. They do not automatically update browser inventory.

## MOCK and HIK modes

| Mode | Behavior |
| --- | --- |
| `MOCK` | Tracked backend tasks simulate CREATED, RUNNING, and COMPLETED based on elapsed time; no physical command is sent |
| `HIK` | The bridge sends requests to the configured external RCS |

Mock tasks reach RUNNING after about 10 seconds and COMPLETED after about 20 seconds when their status is refreshed. The frontend **Start Queue** currently requires a configured HIK backend. Use Swagger or API requests for mock lifecycle testing.

## Data storage and backup

| Location | Contents |
| --- | --- |
| Browser: `wms-monitor-master-v2` | Monitor storage, loads, inventory, warehouse history, and completion markers |
| Browser: `wms-robot-tasks-v1` | Dispatch queue and command history |
| Browser: `wms-transfer-input-history-v1` | Saved transfer inputs |
| Browser: `wms-ui-preferences-v1` | Warehouse name and default priority |
| Browser: `wms-color-theme-v1` | Selected theme |
| Backend: `rcs_bridge.db` | Submitted bridge-task records |

Browser data is tied to the origin and browser profile. `localhost` and `127.0.0.1` use separate browser storage. Clearing site data can remove warehouse records and queue history.

Back up browser records separately from SQLite. The bridge database is not a complete inventory backup. Stop the backend before making a simple file-copy backup of SQLite. Do not remove unresolved queue records just to clear an error.

## Offline and local-network testing

Before disconnecting from the internet:

1. Install frontend and backend dependencies.
2. Verify that both services start locally.
3. Confirm the backend can reach the configured RCS address and port.
4. Run the read-only connection check with a registered robot code.
5. Confirm task templates, target types, codes, and physical occupancy.
6. Keep the WMS tab open during dispatch and polling.

Internet access is not required for local operation once dependencies are installed. Connectivity to the RCS network is still required for physical commands.

## Build and tests

From `frontend/`:

```bash
npm run build
npm run preview
```

The build output is `frontend/dist/`. Vite preview is for checking the build locally. For deployment, serve the static build with SPA route fallback and configure `/api` forwarding to FastAPI, or use an explicit bridge URL with matching CORS. Vite proxy settings do not configure an external production web server.

From `backend/`, with the virtual environment activated:

```bash
python -m pip install httpx
python -m unittest discover -s tests -v
```

`httpx` is needed by FastAPI's test client and is not listed in the current runtime requirements. Backend contract tests use mocked calls; passing them does not verify physical robot behavior. The current frontend package has no `npm test` script.

## Troubleshooting

| Issue | Check |
| --- | --- |
| Cannot reach the backend | FastAPI process, port 8000, Vite proxy, explicit bridge URL, and firewall |
| Backend ready but RCS unreachable | Use the live connection check; local readiness is not a network test |
| `Bin (...) Not exist` | Registered bin alias, chosen target type, and installed workflow; a point alias is not necessarily a bin alias |
| Queue will not start | HIK mode, configured controller URL, and unresolved earlier submissions |
| Task accepted, then a timeout | Check the existing RCS task ID; the timeout may be from polling while the physical task continues |
| `OUTCOME_UNKNOWN` | Check RCS and use **Check unresolved tasks** before considering another submission |
| RCS completed but Monitor did not update | Load identity, source/destination occupancy, WMS codes, stock reservations, and depth-2 conflicts |
| Warehouse data appears missing | Browser profile, origin, site-data clearing, and available backups |
| Theme or input history is not remembered | Browser local-storage availability and selected origin |

Reconciliation searches bridge records; it cannot guarantee recovery if RCS accepted a task but the bridge never saved its returned ID. An unknown outcome must not be treated as proof that nothing was sent.

## Current limitations

- Warehouse data is browser-local, not a shared multi-user inventory database.
- The browser runs scheduling and status polling; it is not a background server worker.
- Use one WMS tab for dispatch. The current queue is not a distributed locking system.
- Task completion and actual placement should be checked against physical behavior during commissioning.
- Depth-2 placement mirrors the stated robot rule. It does not implement relocation of a blocking front load.
- Local Bin/Unbin is not integrated with automatic RCS binding.
- Robot navigation, traffic management, and hardware control remain in RCS.
- AI optimization and automatic storage recommendations are outside the implemented scope.
- The backend does not provide application authentication or user roles. A production deployment needs access control and an appropriate network boundary.

## Preparing the repository for GitHub

Commit source files, dependency manifests, the npm lockfile, and sanitized `.env.example` files. Exclude generated dependencies, local databases, real environment files, and warehouse backups.

Suggested `.gitignore` entries:

```gitignore
node_modules/
dist/
.venv/
venv/
__pycache__/
*.py[cod]
.env
.env.*
!.env.example
*.db
*.db-*
*.sqlite
*.sqlite3
*.log
```

If these files are already tracked, adding ignore rules alone does not remove them from Git history. Review the staged files before publishing. Add an appropriate license only after deciding how the project may be shared and reused.
