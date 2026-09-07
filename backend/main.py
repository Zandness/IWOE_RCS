from datetime import datetime, timezone
from typing import Literal, Optional

import json
import os
import sqlite3
import time
import uuid
import random
import string
import urllib.error
import urllib.request

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, ConfigDict
from dotenv import load_dotenv
from urllib.parse import urlparse
from hik_api import create_hik_router

load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"), override=False)


# =========================================================
# APP
# =========================================================

app = FastAPI(
    title="IWOE WMS - RCS Bridge",
    version="1.2.0",
    description=(
        "Backend bridge between the WMS frontend "
        "and an external Robot Control System."
    ),
)


# =========================================================
# CORS
# =========================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================================================
# CONFIG
# =========================================================

RCS_MODE = os.getenv(
    "RCS_MODE",
    "MOCK",
).upper()


HIK_RCS_BASE_URL = os.getenv(
    "HIK_RCS_BASE_URL",
    "",
).rstrip("/")


HIK_RCS_API_VERSION = os.getenv(
    "HIK_RCS_API_VERSION",
    "v1.0",
)


HIK_RCS_TIMEOUT_SECONDS = float(
    os.getenv(
        "HIK_RCS_TIMEOUT_SECONDS",
        "30",
    )
)


# WMS generic task names must map to an installed HIK task template.
HIK_TASK_TYPE = os.getenv("HIK_TASK_TYPE", "").strip()
if RCS_MODE not in {"MOCK", "HIK"}:
    raise ValueError("RCS_MODE must be MOCK or HIK")
if HIK_RCS_BASE_URL:
    parsed_url = urlparse(HIK_RCS_BASE_URL)
    if parsed_url.scheme not in {"http", "https"} or not parsed_url.netloc or parsed_url.query or parsed_url.fragment:
        raise ValueError("HIK_RCS_BASE_URL must be an HTTP(S) controller base URL")
    if parsed_url.path in {"", "/"}:
        HIK_RCS_BASE_URL += "/rcs/rtas/api/robot/controller"


# =========================================================
# MOCK LIFECYCLE
# =========================================================
#
# 0 - 10 sec
# CREATED
#
# 10 - 20 sec
# RUNNING
#
# 20 sec+
# COMPLETED
# =========================================================

MOCK_CREATED_SECONDS = 10

MOCK_RUNNING_SECONDS = 10


# =========================================================
# DATABASE
# =========================================================

BASE_DIR = os.path.dirname(
    os.path.abspath(
        __file__
    )
)


DATABASE_PATH = os.path.join(
    BASE_DIR,
    "rcs_bridge.db",
)


# =========================================================
# MODELS
# =========================================================


class RcsTarget(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
    autoStart: Optional[int] = Field(default=None, ge=0, le=1)

    type: Literal[
        "SITE",
        "STORAGE",
    ] = "SITE"

    code: str = Field(
        min_length=1
    )

    mapCode: Optional[str] = ""


class RcsTaskRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
    robotType: Optional[str] = None
    robotCode: Optional[str] = None
    groupCode: Optional[str] = None
    deadlineTime: Optional[str] = None
    interrupt: Optional[bool] = None
    extra: Optional[dict] = None

    robotTaskCode: str = Field(
        min_length=1
    )

    taskType: str = Field(default="TRANSPORT", min_length=1)

    initPriority: int = Field(
        default=60,
        ge=1,
        le=120,
    )

    scheduledSendAt: Optional[str] = None

    source: RcsTarget

    destination: RcsTarget


class RcsTaskResponse(BaseModel):

    ok: bool

    mode: str

    bridgeTaskId: str

    robotTaskCode: str

    rcsTaskChainCode: str

    rcsStatus: str

    receivedAt: str


# =========================================================
# TIME
# =========================================================


def utc_now_iso() -> str:

    return datetime.now(
        timezone.utc
    ).isoformat()


# =========================================================
# DATABASE CONNECTION
# =========================================================


def get_db_connection():

    connection = sqlite3.connect(
        DATABASE_PATH
    )

    connection.row_factory = (
        sqlite3.Row
    )

    return connection


# =========================================================
# INIT DATABASE
# =========================================================


def init_database():

    connection = (
        get_db_connection()
    )


    try:

        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS rcs_tasks (
                bridge_task_id TEXT PRIMARY KEY,

                robot_task_code TEXT NOT NULL,

                task_type TEXT NOT NULL,

                init_priority INTEGER NOT NULL,

                scheduled_send_at TEXT,

                source_json TEXT NOT NULL,

                destination_json TEXT NOT NULL,

                rcs_task_chain_code TEXT NOT NULL,

                rcs_status TEXT NOT NULL,

                rcs_created_at TEXT NOT NULL,

                rcs_started_at TEXT,

                rcs_completed_at TEXT,

                received_at TEXT NOT NULL,

                updated_at TEXT NOT NULL,

                created_timestamp REAL NOT NULL
            )
            """
        )


        connection.execute(
            """
            CREATE INDEX IF NOT EXISTS
            idx_rcs_tasks_robot_task_code

            ON rcs_tasks (
                robot_task_code
            )
            """
        )


        connection.execute(
            """
            CREATE INDEX IF NOT EXISTS
            idx_rcs_tasks_status

            ON rcs_tasks (
                rcs_status
            )
            """
        )


        connection.commit()

    finally:

        connection.close()


# =========================================================
# STARTUP
# =========================================================


@app.on_event(
    "startup"
)
def startup_event():

    init_database()


# =========================================================
# PYDANTIC -> DICT
# =========================================================


def model_to_dict(
    model: BaseModel,
) -> dict:

    if hasattr(
        model,
        "model_dump",
    ):

        return model.model_dump()

    return model.dict()


# =========================================================
# HIK RCS 4.3 HTTP HELPERS
# =========================================================


def random_lower_id(
    length: int,
) -> str:

    alphabet = (
        string.ascii_lowercase
        +
        string.digits
    )

    return "".join(
        random.choice(
            alphabet
        )
        for _ in range(
            length
        )
    )


def hik_headers() -> dict:

    return {
        "Content-Type":
            "application/json;charset=UTF-8",

        "Accept":
            "application/json",

        "X-lr-request-id":
            random_lower_id(
                16
            ),

        "X-lr-trace-id":
            random_lower_id(
                32
            ),

        "X-lr-version":
            HIK_RCS_API_VERSION,
    }


def ensure_hik_configured():

    if not HIK_RCS_BASE_URL:

        raise HTTPException(
            status_code=503,
            detail=(
                "HIK RCS mode is enabled, "
                "but HIK_RCS_BASE_URL is empty."
            ),
        )


def hik_post(
    path: str,
    payload: dict,
) -> dict:

    ensure_hik_configured()

    url = (
        HIK_RCS_BASE_URL
        +
        "/"
        +
        path.lstrip("/")
    )

    body = json.dumps(
        payload
    ).encode(
        "utf-8"
    )

    request = urllib.request.Request(
        url=url,
        data=body,
        headers=hik_headers(),
        method="POST",
    )

    try:

        with urllib.request.urlopen(
            request,
            timeout=HIK_RCS_TIMEOUT_SECONDS,
        ) as response:

            text = response.read().decode(
                "utf-8",
                errors="replace",
            )

            status = response.status

    except urllib.error.HTTPError as error:

        text = error.read().decode(
            "utf-8",
            errors="replace",
        )

        raise HTTPException(
            status_code=502,
            detail={
                "message":
                    "HIK RCS returned an HTTP error.",

                "target":
                    url,

                "rcsHttpStatus":
                    error.code,

                "rcsResponse":
                    text,
            },
        )

    except (
        urllib.error.URLError,
        TimeoutError,
    ) as error:

        raise HTTPException(
            status_code=503,
            detail={
                "message":
                    "Cannot get a response from HIK RCS. For submit/cancel/bind, the outcome may be unknown; check RCS before retrying.",

                "target":
                    url,

                "error":
                    str(error),
            },
        )

    try:

        data = json.loads(
            text
        )

    except json.JSONDecodeError:

        raise HTTPException(
            status_code=502,
            detail={
                "message":
                    "HIK RCS returned a non-JSON response.",

                "target":
                    url,

                "rcsHttpStatus":
                    status,

                "rcsResponse":
                    text,
            },
        )

    if not isinstance(data, dict):
        raise HTTPException(502, "HIK RCS returned an invalid response object.")
    return data


def hik_success(response: dict) -> bool:
    # WASNA4.3 uses this exact business code; HTTP 200 alone is not success.
    return isinstance(response, dict) and response.get("code") == "SUCCESS"


def extract_hik_robot_task_code(
    response: dict,
) -> str:

    data = response.get(
        "data"
    )

    if isinstance(
        data,
        dict,
    ):

        value = (
            data.get(
                "robotTaskCode"
            )
            or
            data.get(
                "taskCode"
            )
            or
            data.get(
                "taskChainCode"
            )
        )

        if value:

            return str(
                value
            )

    value = (
        response.get(
            "robotTaskCode"
        )
        or
        response.get(
            "taskCode"
        )
    )

    return str(
        value or ""
    )


def build_hik_target_route(command: RcsTaskRequest) -> list:
    route = []
    for seq, target in enumerate((command.source, command.destination)):
        point = {"seq": seq, "type": target.type, "code": target.code}
        if target.autoStart is not None:
            point["autoStart"] = target.autoStart
        route.append(point)
    return route


def build_hik_task_payload(command: RcsTaskRequest) -> dict:
    task_type = command.taskType
    if task_type.upper() == "TRANSPORT":
        if not HIK_TASK_TYPE:
            raise HTTPException(422, "Set HIK_TASK_TYPE to the installed RCS task template (e.g. F05 for the reference LMR), or send an explicit taskType.")
        task_type = HIK_TASK_TYPE
    payload = {"taskType": task_type, "targetRoute": build_hik_target_route(command),
               "initPriority": command.initPriority}
    for name in ("robotType", "robotCode", "groupCode", "deadlineTime", "interrupt", "extra"):
        value = getattr(command, name)
        if value is not None:
            payload[name] = value
    return payload


def find_status_value(
    value,
) -> str:

    status_keys = {
        "status",
        "taskstatus",
        "robottaskstatus",
        "state",
        "taskstate",
    }

    if isinstance(
        value,
        dict,
    ):

        for key, child in value.items():

            if (
                str(key).lower()
                in
                status_keys
                and
                child is not None
            ):

                return str(
                    child
                )

        for child in value.values():

            found = find_status_value(
                child
            )

            if found:

                return found

    if isinstance(
        value,
        list,
    ):

        for child in value:

            found = find_status_value(
                child
            )

            if found:

                return found

    return ""


def normalize_hik_status(
    raw_status: str,
    fallback: str = "CREATED",
) -> str:

    status = str(
        raw_status or ""
    ).strip().upper().replace(
        "-",
        "_",
    ).replace(
        " ",
        "_",
    )

    if status in {
        "CREATED",
        "CREATE",
        "NEW",
        "PENDING",
        "WAITING",
        "QUEUED",
        "ACCEPTED",
        "READY",
    }:

        return "CREATED"

    if status in {
        "RUNNING",
        "EXECUTING",
        "EXECUTE",
        "DOING",
        "PROCESSING",
        "IN_PROGRESS",
        "STARTED",
        "WORKING",
    }:

        return "RUNNING"

    if status in {
        "COMPLETED",
        "COMPLETE",
        "FINISHED",
        "DONE",
        "ENDED",
        "END",
    }:

        return "COMPLETED"

    if status in {"CANCELLED", "CANCELED"}:
        return "CANCELLED"
    if status in {"FAILED", "FAILURE", "ERROR", "ABORTED"}:
        return "FAILED"
    # Numeric/vendor-specific status values require a verified mapping.
    return str(fallback or "CREATED").upper()


# =========================================================
# MOCK TASK CHAIN CODE
# =========================================================


def create_mock_task_chain_code(
    robot_task_code: str,
) -> str:

    safe_task_code = (
        robot_task_code
        .replace("-", "")
        .replace("_", "")
        .replace(" ", "")
        .upper()
    )


    suffix = str(
        int(
            time.time() * 1000
        )
    )[-6:]


    return (
        f"SIM-RCS-"
        f"{safe_task_code}-"
        f"{suffix}"
    )


# =========================================================
# DB ROW -> DICT
# =========================================================


def row_to_record(
    row,
) -> Optional[dict]:

    if row is None:
        return None


    return {

        "bridgeTaskId":
            row[
                "bridge_task_id"
            ],

        "robotTaskCode":
            row[
                "robot_task_code"
            ],

        "taskType":
            row[
                "task_type"
            ],

        "initPriority":
            row[
                "init_priority"
            ],

        "scheduledSendAt":
            row[
                "scheduled_send_at"
            ],

        "source":
            json.loads(
                row[
                    "source_json"
                ]
            ),

        "destination":
            json.loads(
                row[
                    "destination_json"
                ]
            ),

        "rcsTaskChainCode":
            row[
                "rcs_task_chain_code"
            ],

        "rcsStatus":
            row[
                "rcs_status"
            ],

        "rcsCreatedAt":
            row[
                "rcs_created_at"
            ],

        "rcsStartedAt":
            row[
                "rcs_started_at"
            ] or "",

        "rcsCompletedAt":
            row[
                "rcs_completed_at"
            ] or "",

        "receivedAt":
            row[
                "received_at"
            ],

        "updatedAt":
            row[
                "updated_at"
            ],

        "createdTimestamp":
            row[
                "created_timestamp"
            ],
    }


# =========================================================
# GET RECORD
# =========================================================


def get_task_record(
    bridge_task_id: str,
) -> Optional[dict]:

    connection = (
        get_db_connection()
    )


    try:

        row = connection.execute(
            """
            SELECT *
            FROM rcs_tasks
            WHERE bridge_task_id = ?
            """,
            (
                bridge_task_id,
            ),
        ).fetchone()


        return row_to_record(
            row
        )

    finally:

        connection.close()


# =========================================================
# GET ALL RECORDS
# =========================================================


def get_all_task_records():

    connection = (
        get_db_connection()
    )


    try:

        rows = connection.execute(
            """
            SELECT *
            FROM rcs_tasks
            ORDER BY created_timestamp DESC
            """
        ).fetchall()


        return [
            row_to_record(
                row
            )
            for row in rows
        ]

    finally:

        connection.close()


# =========================================================
# FIND ACTIVE WMS TASK
# =========================================================


def find_tasks_by_robot_code(
    robot_task_code: str,
):

    connection = (
        get_db_connection()
    )


    try:

        rows = connection.execute(
            """
            SELECT *
            FROM rcs_tasks
            WHERE robot_task_code = ?
            ORDER BY created_timestamp DESC
            """,
            (
                robot_task_code,
            ),
        ).fetchall()


        return [
            row_to_record(
                row
            )
            for row in rows
        ]

    finally:

        connection.close()


# =========================================================
# INSERT RECORD
# =========================================================


def insert_task_record(
    record: dict,
):

    connection = (
        get_db_connection()
    )


    try:

        connection.execute(
            """
            INSERT INTO rcs_tasks (
                bridge_task_id,
                robot_task_code,
                task_type,
                init_priority,
                scheduled_send_at,
                source_json,
                destination_json,
                rcs_task_chain_code,
                rcs_status,
                rcs_created_at,
                rcs_started_at,
                rcs_completed_at,
                received_at,
                updated_at,
                created_timestamp
            )
            VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
            )
            """,
            (
                record[
                    "bridgeTaskId"
                ],

                record[
                    "robotTaskCode"
                ],

                record[
                    "taskType"
                ],

                record[
                    "initPriority"
                ],

                record[
                    "scheduledSendAt"
                ],

                json.dumps(
                    record[
                        "source"
                    ]
                ),

                json.dumps(
                    record[
                        "destination"
                    ]
                ),

                record[
                    "rcsTaskChainCode"
                ],

                record[
                    "rcsStatus"
                ],

                record[
                    "rcsCreatedAt"
                ],

                record.get(
                    "rcsStartedAt"
                ) or "",

                record.get(
                    "rcsCompletedAt"
                ) or "",

                record[
                    "receivedAt"
                ],

                record[
                    "updatedAt"
                ],

                record[
                    "createdTimestamp"
                ],
            ),
        )


        connection.commit()

    finally:

        connection.close()


# =========================================================
# UPDATE LIFECYCLE
# =========================================================


def update_task_lifecycle(
    record: dict,
):

    connection = (
        get_db_connection()
    )


    try:

        connection.execute(
            """
            UPDATE rcs_tasks

            SET
                rcs_status = ?,
                rcs_started_at = ?,
                rcs_completed_at = ?,
                updated_at = ?

            WHERE bridge_task_id = ?
            """,
            (
                record[
                    "rcsStatus"
                ],

                record.get(
                    "rcsStartedAt"
                ) or "",

                record.get(
                    "rcsCompletedAt"
                ) or "",

                record[
                    "updatedAt"
                ],

                record[
                    "bridgeTaskId"
                ],
            ),
        )


        connection.commit()

    finally:

        connection.close()


# =========================================================
# ELAPSED TIME
# =========================================================


def get_elapsed_seconds(
    record: dict,
) -> float:

    created_timestamp = (
        record.get(
            "createdTimestamp"
        )
    )


    if (
        created_timestamp is None
    ):

        return 0.0


    return max(
        0.0,
        time.time()
        -
        float(
            created_timestamp
        ),
    )


# =========================================================
# MOCK STATUS
# =========================================================


def calculate_mock_status(
    record: dict,
) -> str:

    elapsed = (
        get_elapsed_seconds(
            record
        )
    )


    if (
        elapsed
        <
        MOCK_CREATED_SECONDS
    ):

        return "CREATED"


    if (
        elapsed
        <
        (
            MOCK_CREATED_SECONDS
            +
            MOCK_RUNNING_SECONDS
        )
    ):

        return "RUNNING"


    return "COMPLETED"


# =========================================================
# REFRESH MOCK RECORD
# =========================================================


def refresh_mock_record(
    record: dict,
) -> dict:

    previous_status = str(
        record.get(
            "rcsStatus",
            "CREATED",
        )
    ).upper()


    next_status = (
        calculate_mock_status(
            record
        )
    )


    if (
        previous_status
        ==
        next_status
    ):

        return record


    now = utc_now_iso()


    # -----------------------------------------------------
    # RUNNING
    # -----------------------------------------------------

    if (
        next_status
        ==
        "RUNNING"
    ):

        record[
            "rcsStartedAt"
        ] = (
            record.get(
                "rcsStartedAt"
            )
            or now
        )


    # -----------------------------------------------------
    # COMPLETED
    # -----------------------------------------------------

    if (
        next_status
        ==
        "COMPLETED"
    ):

        record[
            "rcsStartedAt"
        ] = (
            record.get(
                "rcsStartedAt"
            )
            or now
        )


        record[
            "rcsCompletedAt"
        ] = (
            record.get(
                "rcsCompletedAt"
            )
            or now
        )


    record[
        "rcsStatus"
    ] = next_status


    record[
        "updatedAt"
    ] = now


    update_task_lifecycle(
        record
    )


    return record


# =========================================================
# REFRESH HIK RECORD
# =========================================================


def refresh_hik_record(
    record: dict,
) -> dict:

    rcs_robot_task_code = str(
        record.get(
            "rcsTaskChainCode"
        )
        or
        ""
    ).strip()

    if not rcs_robot_task_code:

        return record

    # Records created in MOCK mode must never be queried
    # against a physical RCS after the bridge switches mode.
    if rcs_robot_task_code.upper().startswith(
        "SIM-RCS-"
    ):

        return record

    response = hik_post(
        "/task/query",
        {
            "robotTaskCode":
                rcs_robot_task_code,
        },
    )

    if not hik_success(response):
        raise HTTPException(502, {"message": "HIK RCS rejected task query.", "rcsResponse": response})

    raw_status = find_status_value(
        response.get(
            "data",
            response,
        )
    )

    next_status = normalize_hik_status(
        raw_status,
        fallback=record.get(
            "rcsStatus",
            "CREATED",
        ),
    )

    previous_status = str(
        record.get(
            "rcsStatus",
            "CREATED",
        )
    ).upper()

    if next_status == previous_status:

        return record

    now = utc_now_iso()

    if next_status == "RUNNING":

        record[
            "rcsStartedAt"
        ] = (
            record.get(
                "rcsStartedAt"
            )
            or
            now
        )

    if next_status == "COMPLETED":

        record[
            "rcsStartedAt"
        ] = (
            record.get(
                "rcsStartedAt"
            )
            or
            now
        )

        record[
            "rcsCompletedAt"
        ] = (
            record.get(
                "rcsCompletedAt"
            )
            or
            now
        )

    record[
        "rcsStatus"
    ] = next_status

    record[
        "updatedAt"
    ] = now

    update_task_lifecycle(
        record
    )

    return record


def refresh_task_record(record: dict) -> dict:
    simulated = str(record.get("rcsTaskChainCode", "")).startswith("SIM-RCS-")
    if simulated:
        return refresh_mock_record(record) if RCS_MODE == "MOCK" else record
    return refresh_hik_record(record) if RCS_MODE == "HIK" else record


# =========================================================
# PUBLIC TASK
# =========================================================


def public_task_record(
    record: dict,
) -> dict:

    return {
        key: value
        for key, value
        in record.items()
        if key
        !=
        "createdTimestamp"
    }


# =========================================================
# ROOT
# =========================================================


@app.get("/")
def root():

    return {
        "ok": True,

        "service":
            "IWOE WMS RCS Bridge",

        "version":
            "1.2.0",

        "mode":
            RCS_MODE,

        "database":
            "SQLite",

        "docs":
            "/docs",
    }


# =========================================================
# HEALTH
# =========================================================


@app.get(
    "/api/health"
)
def health():

    return {
        "ok": True,

        "service":
            "IWOE WMS RCS Bridge",

        "mode":
            RCS_MODE,

        "database":
            "SQLite",

        "time":
            utc_now_iso(),
    }


# =========================================================
# RCS STATUS
# =========================================================


@app.get(
    "/api/rcs/status"
)
def rcs_bridge_status():
    # Local readiness only. Use /api/rcs/connection/check for a live robot query.
    tasks = get_all_task_records()
    return {
        "ok": True, "bridgeMode": RCS_MODE,
        "hikConfigured": bool(HIK_RCS_BASE_URL),
        "hikBaseUrl": HIK_RCS_BASE_URL if RCS_MODE == "HIK" else "",
        "hikTaskType": HIK_TASK_TYPE,
        "connectionStatus": "NOT_CHECKED" if RCS_MODE == "HIK" else "SIMULATION",
        "database": "SQLite", "taskCount": len(tasks),
        "activeTaskCount": sum(t["rcsStatus"] not in {"COMPLETED", "CANCELLED", "FAILED"} for t in tasks),
        "mockLifecycle": {"createdSeconds": MOCK_CREATED_SECONDS, "runningSeconds": MOCK_RUNNING_SECONDS,
                          "completedAfterSeconds": MOCK_CREATED_SECONDS + MOCK_RUNNING_SECONDS},
    }


# =========================================================
# CREATE RCS TASK
# =========================================================


@app.post(
    "/api/rcs/tasks",
    response_model=RcsTaskResponse,
)
def create_rcs_task(
    command: RcsTaskRequest,
):

    # -----------------------------------------------------
    # ROUTE VALIDATION
    # -----------------------------------------------------

    if (
        command.source.code
        ==
        command.destination.code
    ):

        raise HTTPException(
            status_code=400,

            detail=(
                "Source and destination "
                "cannot be the same."
            ),
        )


    # -----------------------------------------------------
    # HIK CONFIG CHECK
    # -----------------------------------------------------

    if (
        RCS_MODE
        ==
        "HIK"
    ):

        ensure_hik_configured()


    # -----------------------------------------------------
    # DUPLICATE ACTIVE TASK
    # -----------------------------------------------------

    existing_tasks = (
        find_tasks_by_robot_code(
            command.robotTaskCode
        )
    )


    for existing in (
        existing_tasks
    ):

        if (
            RCS_MODE == "HIK"
            and
            str(
                existing.get(
                    "rcsTaskChainCode",
                    "",
                )
            ).upper().startswith(
                "SIM-RCS-"
            )
        ):

            continue

        refresh_task_record(
            existing
        )


        if (
            existing[
                "rcsStatus"
            ]
            !=
            "COMPLETED"
        ):

            raise HTTPException(
                status_code=409,

                detail=(
                    f"Active RCS task for "
                    f"{command.robotTaskCode} "
                    f"already exists."
                ),
            )


    # -----------------------------------------------------
    # SEND TO HIK RCS 4.3
    # -----------------------------------------------------

    hik_response = None
    hik_robot_task_code = ""

    if RCS_MODE == "HIK":

        hik_payload = build_hik_task_payload(command)

        hik_response = hik_post(
            "/task/submit",
            hik_payload,
        )

        if not hik_success(
            hik_response
        ):

            raise HTTPException(
                status_code=502,
                detail={
                    "message":
                        "HIK RCS rejected the task.",

                    "rcsResponse":
                        hik_response,
                },
            )

        hik_robot_task_code = (
            extract_hik_robot_task_code(
                hik_response
            )
        )

        if not hik_robot_task_code:

            raise HTTPException(
                status_code=502,
                detail={
                    "message":
                        "HIK RCS accepted the request but did not return robotTaskCode. Check RCS before retrying; the task may already exist.",

                    "rcsResponse":
                        hik_response,
                },
            )


    # -----------------------------------------------------
    # CREATE IDS
    # -----------------------------------------------------

    bridge_task_id = (
        "BRIDGE-"
        +
        uuid.uuid4()
        .hex[:10]
        .upper()
    )


    task_chain_code = (
        hik_robot_task_code
        if RCS_MODE == "HIK"
        else
        create_mock_task_chain_code(
            command.robotTaskCode
        )
    )


    received_at = (
        utc_now_iso()
    )


    created_timestamp = (
        time.time()
    )


    # -----------------------------------------------------
    # CREATE RECORD
    # -----------------------------------------------------

    record = {

        "bridgeTaskId":
            bridge_task_id,

        "robotTaskCode":
            command.robotTaskCode,

        "taskType":
            hik_payload["taskType"] if RCS_MODE == "HIK" else command.taskType,

        "initPriority":
            command.initPriority,

        "scheduledSendAt":
            command.scheduledSendAt,

        "source":
            model_to_dict(
                command.source
            ),

        "destination":
            model_to_dict(
                command.destination
            ),

        "rcsTaskChainCode":
            task_chain_code,

        "rcsStatus":
            "CREATED",

        "rcsCreatedAt":
            received_at,

        "rcsStartedAt":
            "",

        "rcsCompletedAt":
            "",

        "receivedAt":
            received_at,

        "updatedAt":
            received_at,

        "createdTimestamp":
            created_timestamp,
    }


    # -----------------------------------------------------
    # SAVE SQLITE
    # -----------------------------------------------------

    insert_task_record(
        record
    )


    return {
        "ok":
            True,

        "mode":
            RCS_MODE,

        "bridgeTaskId":
            bridge_task_id,

        "robotTaskCode":
            command.robotTaskCode,

        "rcsTaskChainCode":
            task_chain_code,

        "rcsStatus":
            "CREATED",

        "receivedAt":
            received_at,
    }


# =========================================================
# GET ALL TASKS
# =========================================================


@app.get(
    "/api/rcs/tasks"
)
def get_all_rcs_tasks():

    records = (
        get_all_task_records()
    )


    tasks = []


    for record in (
        records
    ):

        refresh_task_record(
            record
        )


        public_record = (
            public_task_record(
                record
            )
        )


        public_record[
            "elapsedSeconds"
        ] = round(
            get_elapsed_seconds(
                record
            ),
            2,
        )


        tasks.append(
            public_record
        )


    return {
        "ok":
            True,

        "mode":
            RCS_MODE,

        "count":
            len(
                tasks
            ),

        "tasks":
            tasks,
    }


# =========================================================
# GET ONE TASK
# =========================================================


@app.get(
    "/api/rcs/tasks/{bridge_task_id}"
)
def get_rcs_task(
    bridge_task_id: str,
):

    record = (
        get_task_record(
            bridge_task_id
        )
    )


    if (
        not record
    ):

        raise HTTPException(
            status_code=404,

            detail=(
                "RCS bridge task not found."
            ),
        )


    refresh_task_record(
        record
    )


    elapsed_seconds = round(
        get_elapsed_seconds(
            record
        ),
        2,
    )


    return {
        "ok":
            True,

        "mode":
            RCS_MODE,

        "elapsedSeconds":
            elapsed_seconds,

        "task":
            public_task_record(
                record
            ),
    }

app.include_router(create_hik_router(hik_post, lambda: RCS_MODE))
