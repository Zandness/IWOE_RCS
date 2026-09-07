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
from pydantic import BaseModel, Field


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

    type: Literal[
        "SITE",
        "STORAGE",
    ] = "SITE"

    code: str = Field(
        min_length=1
    )

    mapCode: Optional[str] = ""


class RcsTaskRequest(BaseModel):

    robotTaskCode: str = Field(
        min_length=1
    )

    taskType: str = "TRANSPORT"

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
                    "Cannot connect to HIK RCS.",

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

    return data


def hik_success(
    response: dict,
) -> bool:

    code = str(
        response.get(
            "code",
            "",
        )
    ).upper()

    success = response.get(
        "success"
    )

    return (
        code in {
            "SUCCESS",
            "0",
        }
        or
        success is True
    )


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


def build_hik_target_route(
    command: RcsTaskRequest,
) -> list:

    return [
        {
            "seq": 0,
            "type": command.source.type,
            "code": command.source.code,
            "autoStart": 1,
        },
        {
            "seq": 1,
            "type": command.destination.type,
            "code": command.destination.code,
            "autoStart": 1,
        },
    ]


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

    return str(
        fallback or "CREATED"
    ).upper()


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

    if not hik_success(
        response
    ):

        return record

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


def refresh_task_record(
    record: dict,
) -> dict:

    if RCS_MODE == "HIK":

        return refresh_hik_record(
            record
        )

    return refresh_mock_record(
        record
    )


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

    tasks = (
        get_all_task_records()
    )


    active_count = 0


    for record in tasks:

        try:

            refresh_task_record(
                record
            )

        except HTTPException:

            # Keep bridge status readable even when the
            # external RCS is temporarily unavailable.
            pass


        if (
            record[
                "rcsStatus"
            ]
            !=
            "COMPLETED"
        ):

            active_count += 1


    return {
        "ok": True,

        "bridgeMode":
            RCS_MODE,

        "hikConfigured":
            bool(
                HIK_RCS_BASE_URL
            ),

        "hikBaseUrl":
            HIK_RCS_BASE_URL
            if RCS_MODE == "HIK"
            else
            "",

        "database":
            "SQLite",

        "taskCount":
            len(
                tasks
            ),

        "activeTaskCount":
            active_count,

        "mockLifecycle": {

            "createdSeconds":
                MOCK_CREATED_SECONDS,

            "runningSeconds":
                MOCK_RUNNING_SECONDS,

            "completedAfterSeconds":
                (
                    MOCK_CREATED_SECONDS
                    +
                    MOCK_RUNNING_SECONDS
                ),
        },
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

        hik_payload = {
            "taskType":
                command.taskType,

            "targetRoute":
                build_hik_target_route(
                    command
                ),

            "initPriority":
                command.initPriority,
        }

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
                        "HIK RCS accepted the request but did not return robotTaskCode.",

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
            command.taskType,

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