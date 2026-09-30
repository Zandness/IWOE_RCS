# Warehouse Management System with External RCS Integration

A web-based Warehouse Management System (WMS) for storage monitoring, inventory operations, and load-transfer requests. The frontend uses React and Vite. A FastAPI backend connects the WMS to an external HIK Robot Control System (RCS).

The WMS manages what to move, the source and destination, priority, and sending time. The external RCS manages robot assignment, navigation, traffic, and physical task execution.

> This is a prototype for development and local warehouse testing. It is not a complete production WMS.

## Documentation scope

This README describes the reviewed project changes as of 30 September 2026.

These changes include:

- Removal of Fleet Control from the interface.
- WMS depth-2 placement after confirmed task completion.
- Reservation of paired storage depths during transfers.
- Operator review for stopped transfers with the load still at the source.
- Bridge protection against duplicate task submissions.
- Strict validation of task-status responses.
- Disabled direct family task-submission endpoints.
- Environment examples and dependency files for installation.
- A backend test suite with 18 tests.

The repository or local folder may still be named `IWOE_RCS`. That name does not indicate implemented AI optimization.

## Features

| Area | Functions |
| --- | --- |
| Dashboard | Warehouse summaries, storage usage, inventory, and task information |
| Warehouse Monitor | Schematic storage map, zoom and pan, storage details, levels, and depths |
| Load types | Basket, Pallet, and Rack |
| Inventory & Storage Data | View warehouse records based on Monitor data |
| Warehouse Operations | Inbound stock, outbound picking, reservations, and direct stock deductions |
| Task Management | Overview of warehouse operations and transfer tasks |
| Transfer preparation | Location selection, RCS target types and codes, task type, optional robot code, priority, and scheduled sending |
| RCS Dispatch Queue | Queue ordering, submission, status polling, and unresolved-task checks |
| Stopped-task review | Recheck the backend task and record an operator-confirmed load-at-source review |
| Command history | Collapsible history, search, command reuse, and 20 entries per page |
| Input history | Remember entered task types and robot codes in the browser |
| Appearance | Night and Day themes |
| Settings | Warehouse preferences and backend/RCS connection checks |

Fleet Control is excluded from the updated interface. This does not remove the dispatch queue or optional robot-code input.

## Architecture

| Component | Responsibility | Storage |
| --- | --- | --- |
| React frontend | Warehouse interface, inventory operations, transfer validation, scheduling, and queue processing | Browser local storage |
| FastAPI bridge | Validate requests, prevent duplicate submissions, prepare HIK payloads, submit tasks, and retrieve status | SQLite |
| External HIK RCS | Select and control robots, plan routes, and execute installed workflows | Managed by the external system |

The frontend sends transfer requests to `POST /api/rcs/tasks`.

The bridge records a submission claim before contacting RCS, prepares a `targetRoute`, and calls HIK `/task/submit`. After acceptance, it saves the returned task ID.

The frontend queries individual bridge tasks to retrieve current status. A confirmed `COMPLETED` status triggers the WMS load-location update, subject to local consistency checks.

The dispatcher remains mounted while navigating between WMS pages. Closing the browser tab stops automatic dispatch and polling.

## Main source files

| Path | Purpose |
| --- | --- |
| `frontend/src/App.jsx` | Application routes and mounted dispatcher |
| `frontend/src/pages/WarehouseMap.jsx` | Warehouse Monitor |
| `frontend/src/pages/WarehouseData.jsx` | Inventory and storage data |
| `frontend/src/pages/WarehouseOperations.jsx` | Warehouse operation pages |
| `frontend/src/pages/TaskManagement.jsx` | Task overview |
| `frontend/src/pages/RobotTaskDispatcher.jsx` | Queue, dispatch, polling, and stopped-task review |
| `frontend/src/components/MonitorRcsDispatch.jsx` | Transfer form and command history |
| `frontend/src/components/ThemeToggle.jsx` | Day/Night control |
| `frontend/src/utils/basketStore.js` | Transfer validation, reservations, local Bin/Unbin, completion updates, and review records |
| `frontend/src/utils/rackStructure.js` | Storage levels and depths |
| `frontend/src/utils/warehouseOperations.js` | Stock operations |
| `frontend/src/services/rcs.js` | Frontend bridge API client |
| `frontend/vite.config.js` | Development and preview servers with API proxy |
| `frontend/.env.example` | Frontend configuration example |
| `backend/main.py` | FastAPI app, SQLite records, submission protection, and tracked tasks |
| `backend/hik_api.py` | Direct query, cancellation, and binding routes; disabled legacy submission |
| `backend/test_hik_contract.py` | Backend contract and behavior tests |
| `backend/requirements.txt` | Direct dependencies with supported version ranges |
| `backend/requirements-lock.txt` | Package versions captured from the project environment |
| `backend/.env.example` | Backend configuration example |

## Requirements

- Python 3.11 for the reviewed backend and test setup.
- Node.js and npm compatible with the Vite version in the project lockfile.
- A browser with JavaScript and local storage enabled.
- For physical testing: access from the backend computer to the RCS network, configured robots, and installed task templates.

The backend package snapshot was captured from a Windows Python 3.11 environment. Other operating systems or Python versions need separate installation and testing.

Install dependencies before disconnecting from the internet.

## Installation on Windows

The following instructions use PowerShell.

### 1. Backend

From the repository root:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-lock.txt
.\.venv\Scripts\python.exe -m pip check
```

Using the virtual environment's Python directly avoids activation-policy issues.

Create `.env` only if it does not already exist:

```powershell
if (-not (Test-Path .env)) {
    Copy-Item .env.example .env
}
```

Review the settings before starting the backend:

```powershell
.\.venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000
```

The example environment starts in `MOCK` mode.

Use `--reload` during development if needed. Restart the backend after changing its environment settings.

### 2. Frontend

Open another terminal from the repository root:

```powershell
cd frontend
npm ci
```

Create the frontend `.env` only if it does not already exist:

```powershell
if (-not (Test-Path .env)) {
    Copy-Item .env.example .env
}
```

Start the frontend:

```powershell
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

`npm ci` installs dependencies from `package-lock.json`. Keep the manifest and lockfile together when intentionally changing dependencies.

### Dependency files

`requirements.txt` lists direct Python dependencies and version ranges.

`requirements-lock.txt` records installed package versions, including indirect dependencies. Use this file to reproduce the reviewed environment.

A frozen package list does not include package downloads or guarantee compatibility across operating systems.

## Configuration

### Backend environment

Example `backend/.env`:

```dotenv
RCS_MODE=MOCK
HIK_RCS_BASE_URL=http://192.168.200.101/rcs/rtas/api/robot/controller
HIK_RCS_API_VERSION=v1.0
HIK_RCS_TIMEOUT_SECONDS=30
HIK_TASK_TYPE=
```

| Variable | Meaning |
| --- | --- |
| `RCS_MODE` | `MOCK` for backend simulation or `HIK` for the external controller |
| `HIK_RCS_BASE_URL` | HIK controller base URL |
| `HIK_RCS_API_VERSION` | Value sent in the HIK API version header |
| `HIK_RCS_TIMEOUT_SECONDS` | Timeout for an upstream RCS request |
| `HIK_TASK_TYPE` | Installed template used when a tracked request specifies generic `TRANSPORT` |

For physical integration, set `RCS_MODE=HIK` and verify the controller IP, port, and path.

The example address is a project network address, not a universal HIK default.

Explicit task types such as `CTUB1`, `PF-LMR-COMMON`, and `PF-FMR-COMMON` must exist in the target installation. A task type name alone does not guarantee support for a load or route.

Leave `HIK_TASK_TYPE` empty if every request specifies an explicit installed task type. A generic `TRANSPORT` request in HIK mode requires this mapping.

Existing process environment variables take precedence over `backend/.env`.

### Frontend environment

Example `frontend/.env`:

```dotenv
WMS_BRIDGE_TARGET=http://127.0.0.1:8000
VITE_RCS_BRIDGE_URL=
```

The supplied Vite configuration forwards `/api` requests to `WMS_BRIDGE_TARGET`.

- Keep `VITE_RCS_BRIDGE_URL` empty to use relative API paths through the proxy.
- `WMS_BRIDGE_TARGET` is the FastAPI address, not the HIK controller address.
- Set `VITE_RCS_BRIDGE_URL` only when the browser should call the bridge directly.
- Restart Vite after changing environment settings.
- Rebuild the frontend when changing build-time frontend variables.

The development and preview servers use port `5173` with `strictPort` enabled.

The backend allows these CORS origins:

- `http://localhost:5173`
- `http://127.0.0.1:5173`

A direct browser connection from another origin requires a matching backend CORS configuration.

Do not store passwords or private API keys in `VITE_` variables because frontend values can be included in the browser build.

## Warehouse rules

### Storage and inventory

- Each storage point holds at most one load.
- A load may contain several inventory records.
- Basket and Pallet storage can use configured levels, up to eight.
- Whole-Rack storage uses one pickup level.
- Storage supports up to two depths per level.
- Source and destination must support the same load type.
- The source must contain a load.
- The selected destination must be empty.
- WMS location codes must be present and unique.
- Blocked, maintenance, and reserved locations are restricted.
- Source stock reservations must be resolved before transferring the load.
- A transfer moves the load and its inventory without changing total product quantities.

Local **Bin/Unbin** changes occupancy in WMS using an internal load ID. It does not automatically bind or unbind a carrier in RCS.

Direct binding API routes exist separately in the backend.

### Paired-depth reservations

For a storage level with two depths, transfer reservations cover the paired positions in the same storage and level.

This protects the source and destination lanes, including a possible depth-2 placement. Changes through reservation-aware WMS operations are blocked while the transfer remains unresolved.

This reservation mechanism is local to browser data. It is not a shared lock across computers.

### Automatic placement at depth 2

After confirmed task completion, WMS applies the stated robot placement rule:

| Selected destination | Depth-2 slot in the same storage and level | Recorded WMS destination |
| --- | --- | --- |
| Depth 1 | Empty and eligible | Depth 2 |
| Depth 1 | Occupied | Depth 1 |
| Depth 1 | Does not exist | Depth 1 |
| Depth 2 | Empty and eligible | Depth 2 |

**The RCS request still uses the selected destination and its original code.**

The rule changes only the completed WMS location update. Both the load and its inventory move together. Transfer history records the requested and actual destinations.

An empty paired depth-2 slot that is blocked, under maintenance, or otherwise conflicting prevents automatic completion of the WMS update.

A completion ledger prevents the same confirmed transfer from moving stock twice. A completed RCS task whose WMS update fails remains a consistency issue that requires review.

The actual destination is calculated from WMS data at completion. It is not a sensor-confirmed location returned by RCS.

This rule does not implement relocation of a load that blocks access to an inner position.

## Transfer workflow

1. Configure storage and WMS location codes in Warehouse Monitor.
2. Confirm that source and destination occupancy match the warehouse.
3. Select the source and destination.
4. Choose the RCS target types and registered codes.
5. Enter the installed task type and optional robot code.
6. Select priority and optional sending time.
7. Review the command preview and add the task to the queue.
8. Start the queue or use **Add and start dispatch**.
9. Monitor the returned task ID and status.
10. Verify physical placement and the WMS update during commissioning.

Leaving the robot code empty allows RCS assignment.

Leaving the sending time empty makes the request eligible immediately. The queue must still be running.

### Queue ordering

| Priority | Value |
| --- | --- |
| Low | 30 |
| Normal | 60 |
| High | 90 |
| Urgent | 120 |

Only requests whose sending time has arrived are eligible.

Eligible requests are ordered by highest priority, then creation time. A higher-priority request waits for the active transfer to finish; it does not interrupt that transfer.

**Pause Queue** prevents new submissions. It does not stop or cancel an active robot task.

### Command history

History can be collapsed, searched, and viewed in pages of 20 entries.

**Reuse** copies a previous command into the form for review. It does not submit the command immediately.

History comes from browser queue records. Removing a queue record also removes it from this history view.

### Stopped transfers

Tasks reported as `FAILED`, `CANCELLED`, or `CANCELED` stop normal queue progression until reviewed.

Automatic polling excludes terminal tasks. The stopped-task review performs an explicit backend status check before saving the review.

The current review flow supports a load that is confirmed to remain at its original source:

1. Check the task and physical load.
2. Open its review form.
3. Enter the reviewer name and notes.
4. Confirm that the RCS task has stopped.
5. Confirm that the load remains at the source.
6. Submit the review.

The system rechecks task identity, stopped status, and local load consistency before recording the review.

An accepted review releases the transfer's local reservation. It does not move inventory, mark the RCS task as completed, or send another command.

The queue remains paused until the operator starts it again.

If the load is on the robot, at the destination, or somewhere else, do not use the load-at-source confirmation. Resolve the physical and WMS records first.

### Unknown submission outcomes

`SENDING` and `OUTCOME_UNKNOWN` entries block new submissions until their outcome is checked.

Use **Check unresolved tasks** to look for matching saved bridge records. This does not resubmit the command.

A missing bridge record does not prove that RCS received nothing. The controller may have accepted the command before a timeout or database failure.

Do not delete the task or create a new reference simply to bypass an uncertain outcome.

## RCS target types

Load type and RCS target type are separate choices.

| Target type | RCS identifier |
| --- | --- |
| `STORAGE` | Registered bin alias |
| `SITE` | Registered point alias |
| `CARRIER` | Actual carrier number registered in RCS |

Internal IDs such as `BASKET-...` and `RACK-...` are WMS identifiers. They are not automatically valid RCS carrier numbers.

Match the target type, code, and installed workflow.

## API usage

Interactive documentation is available at [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs).

Replace example codes and task types with values from the actual installation before physical testing.

### Read-only connection check

`POST /api/rcs/connection/check`

```json
{
  "singleRobotCode": "YOUR_REGISTERED_ROBOT_CODE"
}
```

This performs a live robot query in HIK mode.

`GET /api/rcs/status` reports local configuration and saved task counts. It does not prove that RCS is reachable.

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

An optional `robotCode` can be included in the tracked request.

The WMS task reference, bridge task ID, and returned RCS task ID are separate identifiers.

The bridge retains `mapCode` when supplied, but the current route builder does not forward it to HIK.

The backend stores `scheduledSendAt` but does not wait for that time. Scheduling is enforced by the frontend queue. A direct API submission starts processing immediately.

Calling the bridge through Swagger creates a backend task record. It does not automatically create a browser queue entry or update browser inventory.

### Duplicate-submission protection

The bridge uses the mode, controller URL, and WMS task reference to identify a submission. It also saves a fingerprint of the request data.

| Situation | Bridge behavior |
| --- | --- |
| First valid request | Save a submission claim before contacting RCS |
| Same reference and identical request after acceptance | Return the saved submission response without sending again |
| Same reference with different request data | Return `409` |
| Same reference with an in-progress or uncertain submission | Return `409` without sending again |
| Existing legacy record with the same reference in the same mode | Block resubmission |

A cached acceptance response is not a fresh status check. Query the individual bridge task for current status.

Use a new WMS task reference only for an intentional new transfer.

This protection does not provide exactly-once execution across every possible RCS or database failure. It blocks blind retries when the result is uncertain.

### Task-status validation

Individual task queries validate the upstream response before updating SQLite.

The current parser accepts:

- A task object in `data`.
- A list containing exactly one task object in `data`.
- Explicit fields named `taskStatus`, `robotTaskStatus`, or `taskState`, matched without case sensitivity.

Recognized values are mapped to WMS statuses, such as `FINISHED` to `COMPLETED`.

Missing, conflicting, numeric, or unrecognized statuses produce an error rather than reusing the old status as a successful refresh.

If `robotTaskCode` is present in the response, it must match the requested RCS task ID.

Other response structures require a verified mapping based on the actual installation.

### Main endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Backend health response |
| GET | `/api/rcs/status` | Local bridge configuration and task counts |
| POST | `/api/rcs/connection/check` | Live robot query for connectivity |
| POST | `/api/rcs/tasks` | Create a tracked task with submission protection |
| GET | `/api/rcs/tasks` | List saved bridge records without contacting RCS |
| GET | `/api/rcs/tasks/{bridge_task_id}` | Refresh one eligible task and return its record |
| POST | `/api/rcs/robot/query` | Direct robot query |
| POST | `/api/rcs/task/query` | Direct task query |
| POST | `/api/rcs/task/cancel` | Direct task cancellation |
| POST | `/api/{family}/task/submit` | Disabled legacy submission route |

The saved task list includes `statusSource: "DATABASE"`. Its statuses may be older than the controller's current state.

Legacy family submission routes for `ctu`, `lmr`, `fmr`, and `qf` return `410` for valid requests in both modes. Invalid request bodies or family names may return `422` during validation. No task is forwarded.

These old routes are not redirects. Clients must use the `source` and `destination` request format required by `/api/rcs/tasks`.

Additional query, cancellation, and carrier/site binding routes are described in Swagger. They require HIK mode and do not automatically update browser inventory.

The direct proxy routes do not share the tracked submission-claim mechanism.

## MOCK and HIK modes

| Mode | Behavior |
| --- | --- |
| `MOCK` | Tracked backend tasks simulate lifecycle changes without sending physical commands |
| `HIK` | The bridge communicates with the configured external RCS |

Mock tasks reach `RUNNING` after about 10 seconds and `COMPLETED` after about 20 seconds when their individual status is refreshed.

Listing saved tasks does not advance their lifecycle.

The frontend **Start Queue** requires a configured HIK backend. Use Swagger or API requests for mock lifecycle testing.

Existing simulated records are not queried against physical RCS after switching to HIK mode. Existing real task records are not advanced by simulation after switching to MOCK mode.

## Data storage and backup

| Location | Contents |
| --- | --- |
| Browser: `wms-monitor-master-v2` | Storage layout, loads, inventory, warehouse history, completion ledger, and stopped-transfer reviews |
| Browser: `wms-robot-tasks-v1` | Dispatch queue and command history |
| Browser: `wms-transfer-input-history-v1` | Saved task types and robot codes |
| Browser: `wms-ui-preferences-v1` | Warehouse preferences |
| Browser: `wms-color-theme-v1` | Selected theme |
| Backend: `rcs_bridge.db` | Bridge-task records and submission claims |

Browser data belongs to its origin and browser profile. `localhost` and `127.0.0.1` use separate browser storage.

Clearing site data can remove warehouse records, reservations, reviews, and queue history.

Back up browser records separately from SQLite. The bridge database is not a complete inventory backup.

Stop the backend before making a simple file-copy backup of SQLite. Preserve the submission claims as well as task records because they support duplicate-submission protection.

Do not remove unresolved records merely to clear an error.

## Tests and build

### Backend tests

From `backend/`:

```powershell
.\.venv\Scripts\python.exe -m unittest test_hik_contract -v
```

The reported local run passed all 18 tests on 30 September 2026.

The suite checks:

- Disabled direct submission in HIK and MOCK modes.
- Validation before upstream requests.
- Query, cancellation, and binding payloads.
- Read-only connection checks.
- HTTP request construction and timeout behavior.
- No automatic retry in the tested transport path.
- Saved task identifiers.
- Cached responses for duplicate submissions.
- Blocking changed or uncertain submissions.
- Database-only task listing.
- Individual task refreshes.
- Rejection of invalid status responses without changing saved records.

Tests mock network requests and use temporary SQLite databases. They do not send commands to physical robots.

Passing these tests does not verify frontend behavior, actual RCS response compatibility, or physical placement.

`httpx2`, used by the test client in the reviewed environment, is included in the dependency files.

### Frontend build

From `frontend/`:

```powershell
npm run build
npm run preview
```

The build output is `frontend/dist/`.

Vite preview is for checking the build locally. For deployment, serve the static build with SPA route fallback and configure `/api` forwarding to FastAPI, or use an explicit bridge URL with matching CORS.

Vite proxy settings do not configure an external production web server.

## Offline and local-network testing

Before disconnecting from the internet:

1. Install backend and frontend dependencies.
2. Run the backend tests.
3. Verify that both services start locally.
4. Confirm the controller address and port.
5. Run the live connection check with a registered robot code.
6. Confirm task templates, target types, codes, and physical occupancy.
7. Keep the WMS tab open during dispatch and polling.

Internet access is not required for local operation once dependencies are installed. Connectivity to the RCS network is still required for physical commands.

Dependency lockfiles alone are not an offline installation bundle. A fresh offline machine also needs the required package files or prepared installation media.

## Troubleshooting

| Issue | Check |
| --- | --- |
| `No module named fastapi` | Use the project's `.venv` Python and install its requirements |
| TestClient reports missing `httpx2` | Install the updated requirements in the same virtual environment |
| Cannot reach the backend | FastAPI process, port 8000, Vite proxy, explicit bridge URL, and firewall |
| Backend ready but RCS unreachable | Run the live connection check; local readiness is not a network test |
| `Bin (...) Not exist` | Registered bin alias, target type, and installed workflow |
| Direct submit returns `410` | Use `POST /api/rcs/tasks` with the tracked request format |
| Submission returns `409` | Check the existing task reference, request data, and previous submission outcome |
| Queue will not start | HIK configuration, unresolved submissions, and stopped tasks awaiting review |
| Accepted task later shows a timeout | Check the existing RCS task ID; polling may have failed while the robot continues |
| Invalid or missing task status | Inspect the actual `/task/query` response and verify its mapping |
| `OUTCOME_UNKNOWN` | Check RCS and saved bridge records before considering another submission |
| Stopped task still reserves locations | Complete the supported review only after confirming the load is at the source |
| RCS completed but Monitor did not update | Load identity, occupancy, WMS codes, reservations, and paired-depth conflicts |
| Warehouse data appears missing | Browser profile, origin, site-data clearing, and backups |
| Theme or input history is not remembered | Local-storage availability and browser origin |

Reconciliation searches saved bridge records. It cannot guarantee recovery if RCS accepted a task but the bridge never saved its returned ID.

An unknown outcome is not proof that nothing was sent.

## Current limitations

- Warehouse data is browser-local rather than a shared multi-user inventory database.
- Scheduling and automatic polling run in the browser.
- Use one WMS tab for dispatch; the queue is not a distributed locking system.
- Bridge submission claims prevent the tested retry cases but cannot resolve every uncertain upstream outcome automatically.
- Task-status mappings must match the installed RCS response format.
- Physical placement must be verified during commissioning.
- Depth-2 placement reflects the stated robot rule and does not implement relocation of blocking loads.
- The stopped-transfer review currently supports confirmation that the load remains at the source.
- Local Bin/Unbin does not automatically update RCS binding.
- Navigation, traffic management, and hardware control remain in RCS.
- AI optimization and automatic storage recommendations are outside the implemented scope.
- The backend does not provide application authentication or user roles.
- Production use requires access control, shared data management, and an appropriate deployment design.

## Repository files

Commit:

- Application source.
- Tests.
- `requirements.txt`.
- `requirements-lock.txt`.
- `package.json` and `package-lock.json`.
- Sanitized backend and frontend `.env.example` files.
- Documentation and `.gitignore`.

Keep local:

- `.env` files.
- `.venv` and `node_modules`.
- Build output and caches.
- Live SQLite databases.
- Warehouse-data backups.

The root `.gitignore` contains the project exclusion rules.

Adding an ignore rule does not stop tracking a file already in Git. Removing a file with `git rm --cached` keeps the local copy but only changes tracking in subsequent commits; it does not erase older history.

Add a license only after deciding how the project may be shared and reused.