from datetime import datetime, timezone
from typing import Dict, Literal, Optional

import os
import time
import uuid

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field


# =========================================================
# FASTAPI APP
# =========================================================

app = FastAPI(
    title="IWOE WMS - RCS Bridge",
    version="1.0.0",
    description="WMS backend bridge for External RCS Integration",
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
# MOCK LIFECYCLE TIME
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
# MOCK STORAGE
# =========================================================
#
# ตอนนี้เก็บใน RAM
#
# Restart backend
# -> Mock Tasks หาย
# =========================================================

mock_rcs_tasks: Dict[str, dict] = {}


# =========================================================
# PYDANTIC MODELS
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
# TIME HELPER
# =========================================================


def utc_now_iso() -> str:

    return datetime.now(
        timezone.utc
    ).isoformat()


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


    if not created_timestamp:
        return 0.0


    return max(
        0.0,
        time.time()
        - created_timestamp,
    )


# =========================================================
# CALCULATE MOCK STATUS
# =========================================================


def calculate_mock_status(
    record: dict,
) -> str:

    elapsed = (
        get_elapsed_seconds(
            record
        )
    )


    # CREATED
    if (
        elapsed
        <
        MOCK_CREATED_SECONDS
    ):

        return "CREATED"


    # RUNNING
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


    return record


# =========================================================
# REMOVE INTERNAL FIELDS
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
        "service": "IWOE WMS RCS Bridge",
        "mode": RCS_MODE,
        "docs": "/docs",
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
        "service": "IWOE WMS RCS Bridge",
        "time": utc_now_iso(),
    }


# =========================================================
# RCS BRIDGE STATUS
# =========================================================


@app.get(
    "/api/rcs/status"
)
def rcs_bridge_status():

    return {
        "ok": True,

        "bridgeMode":
            RCS_MODE,

        "hikConfigured":
            bool(
                HIK_RCS_BASE_URL
            ),

        "mockTaskCount":
            len(
                mock_rcs_tasks
            ),

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


    for existing in (
        mock_rcs_tasks.values()
    ):

        if (
            existing.get(
                "robotTaskCode"
            )
            !=
            command.robotTaskCode
        ):

            continue


        existing_status = (
            calculate_mock_status(
                existing
            )
        )


        if (
            existing_status
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
            time.time(),
    }


    mock_rcs_tasks[
        bridge_task_id
    ] = record


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
# GET ALL RCS TASKS
# =========================================================


@app.get(
    "/api/rcs/tasks"
)
def get_all_rcs_tasks():

    tasks = []


    for record in (
        mock_rcs_tasks.values()
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
# GET ONE RCS TASK
# =========================================================


@app.get(
    "/api/rcs/tasks/{bridge_task_id}"
)
def get_rcs_task(
    bridge_task_id: str,
):

    record = (
        mock_rcs_tasks.get(
            bridge_task_id
        )
    )


    if not record:

        raise HTTPException(
            status_code=404,

            detail=(
                "RCS bridge task "
                "not found."
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