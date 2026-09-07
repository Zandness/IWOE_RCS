# HIK RCS 4.3 Bridge

The FastAPI bridge supports two modes.

## Safe development mode

```powershell
$env:RCS_MODE="MOCK"
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

No request is sent to the physical RCS in MOCK mode.

## HIK RCS 4.3 mode

The senior reference project uses this controller base URL:

```text
http://192.168.100.101/rcs/rtas/api/robot/controller
```

Configure it explicitly before starting the bridge:

```powershell
$env:RCS_MODE="HIK"
$env:HIK_RCS_BASE_URL="http://192.168.100.101/rcs/rtas/api/robot/controller"
$env:HIK_RCS_API_VERSION="v1.0"
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

In HIK mode the existing WMS endpoint remains unchanged:

```text
POST /api/rcs/tasks
```

The bridge converts the WMS command to RCS 4.3:

```text
POST {HIK_RCS_BASE_URL}/task/submit
```

The bridge polls task state through:

```text
POST {HIK_RCS_BASE_URL}/task/query
```

Headers follow the supplied RCS 4.3 senior reference:

```text
Content-Type: application/json;charset=UTF-8
Accept: application/json
X-lr-request-id: <16 chars>
X-lr-trace-id: <32 chars>
X-lr-version: v1.0
```

The WMS source and destination are converted to a two-step `targetRoute` with `seq`, `type`, `code`, and `autoStart`.

Keep `RCS_MODE=MOCK` until the RCS task type and physical source/destination points for the test area are confirmed.
