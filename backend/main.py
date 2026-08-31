from datetime import datetime, timezone
from typing import Literal, Optional

import json
import os
import sqlite3
import time
import uuid

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field


# =========================================================
# APP
# =========================================================

app = FastAPI(
    title="IWOE WMS - RCS Bridge",
    version="1.1.0",
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
            "1.1.0",

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

        refresh_mock_record(
            record
        )


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
    # REAL HIK MODE
    # -----------------------------------------------------

    if (
        RCS_MODE
        ==
        "HIK"
    ):

        raise HTTPException(
            status_code=501,

            detail=(
                "HIK RCS mode is not configured yet. "
                "Exact GenerateTaskOrder API contract "
                "must be confirmed first."
            ),
        )


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

        refresh_mock_record(
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
            "MOCK",

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

        refresh_mock_record(
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
            "MOCK",

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


    refresh_mock_record(
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
            "MOCK",

        "elapsedSeconds":
            elapsed_seconds,

        "task":
            public_task_record(
                record
            ),
    }