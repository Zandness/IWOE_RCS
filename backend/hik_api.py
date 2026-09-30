"""HIK RCS API proxies.

Submit WMS transfer requests through POST /api/rcs/tasks.
Legacy family submission endpoints are disabled because they
bypass bridge task records and duplicate-submission protection.

Other direct endpoints forward requests only in HIK mode.
"""

from typing import Any, Literal

from fastapi import APIRouter, HTTPException
from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    model_validator,
)


# =========================================================
# MODELS
# =========================================================

class Payload(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
        allow_inf_nan=False,
    )


class RobotQuery(Payload):
    singleRobotCode: str = Field(min_length=1)


class TaskQuery(Payload):
    robotTaskCode: str = Field(min_length=1)


class Target(Payload):
    seq: int = Field(ge=0)

    type: Literal[
        "SITE",
        "STORAGE",
        "CARRIER",
    ]

    code: str = Field(min_length=1)

    autoStart: int | None = Field(
        default=None,
        ge=0,
        le=1,
    )

    operation: Literal[
        "COLLECT",
        "DELIVERY",
    ] | None = None


class Submit(Payload):
    """Legacy request model retained for endpoint validation.

    Requests using this model are not forwarded to RCS.
    """

    taskType: str | None = Field(
        default=None,
        min_length=1,
    )

    targetRoute: list[Target] = Field(min_length=1)

    initPriority: int = Field(
        default=99,
        ge=1,
        le=120,
    )

    robotType: str | None = None
    robotCode: str | None = None
    groupCode: str | None = None
    deadlineTime: str | None = None
    interrupt: bool | None = None
    extra: dict[str, Any] | None = None

    @model_validator(mode="after")
    def ordered_route(self):
        sequences = [
            target.seq
            for target in self.targetRoute
        ]

        expected = list(
            range(len(self.targetRoute))
        )

        if sequences != expected:
            raise ValueError(
                "targetRoute.seq must start at 0 "
                "and be consecutive"
            )

        return self


class Cancel(TaskQuery):
    cancelType: str = Field(
        default="CANCEL",
        min_length=1,
    )

    reason: str | None = None
    returnTaskType: str | None = None
    carrierCode: str | None = None
    targetRoute: list[Target] | None = None
    extra: dict[str, Any] | None = None


class CarrierBind(Payload):
    carrierCode: str = Field(min_length=1)
    siteCode: str = Field(min_length=1)
    carrierDir: float | None = None
    extra: dict[str, Any] | None = None


class CarrierUnbind(Payload):
    carrierCode: str | None = Field(
        default=None,
        min_length=1,
    )

    siteCode: str | None = Field(
        default=None,
        min_length=1,
    )

    extra: dict[str, Any] | None = None

    @model_validator(mode="after")
    def identifier_required(self):
        if not (
            self.carrierCode
            or self.siteCode
        ):
            raise ValueError(
                "carrierCode or siteCode is required"
            )

        return self


class SiteBind(Payload):
    slotCategory: str | None = None
    slotCode: str = Field(min_length=1)

    carrierCategory: str | None = None
    carrierType: str | None = None
    carrierCode: str | None = None

    temporary: bool | None = None

    invoke: str = Field(
        default="BIND",
        min_length=1,
    )

    carrierDir: float | None = None

    colCount: int | None = Field(
        default=None,
        ge=1,
    )


# =========================================================
# ROUTER
# =========================================================

def create_hik_router(post, get_mode):
    router = APIRouter(
        tags=["HIK RCS 4.3"],
    )

    def reject_direct_submission():
        raise HTTPException(
            status_code=410,
            detail={
                "message": (
                    "Direct task submission is disabled. "
                    "Use POST /api/rcs/tasks so the bridge "
                    "records the task and checks for "
                    "duplicate submissions. "
                    "No request was sent to RCS."
                ),
                "replacement": "/api/rcs/tasks",
                "method": "POST",
            },
        )

    def forward(path, payload):
        # Prevent this router from bypassing the bridge
        # even if another route later calls this helper.
        if path.rstrip("/") == "/task/submit":
            reject_direct_submission()

        if get_mode() != "HIK":
            raise HTTPException(
                status_code=409,
                detail=(
                    "This direct RCS API requires "
                    "RCS_MODE=HIK. No request was sent."
                ),
            )

        response = post(path, payload)

        if not isinstance(response, dict):
            raise HTTPException(
                status_code=502,
                detail=(
                    "HIK RCS returned an invalid "
                    "response object."
                ),
            )

        if response.get("code") != "SUCCESS":
            raise HTTPException(
                status_code=502,
                detail={
                    "message": (
                        "HIK RCS rejected the request"
                    ),
                    "rcsResponse": response,
                },
            )

        return {
            "success": True,
            "code": response["code"],
            "message": response.get(
                "message",
                "Operation completed",
            ),
            "data": response,
        }

    # =====================================================
    # ROBOT QUERY / CONNECTION CHECK
    # =====================================================

    @router.post("/api/rcs/robot/query")
    @router.post("/api/robot/query")
    @router.post("/api/ctu/robot/query")
    def query_robot(body: RobotQuery):
        return forward(
            "/robot/query",
            body.model_dump(exclude_none=True),
        )

    @router.post("/api/rcs/connection/check")
    def check_connection(body: RobotQuery):
        # A successful robot query checks live connectivity.
        result = query_robot(body)

        return {
            **result,
            "connected": True,
            "mode": "HIK",
        }

    # =====================================================
    # DISABLED LEGACY SUBMISSION
    # =====================================================

    @router.post(
        "/api/{family}/task/submit",
        deprecated=True,
        responses={
            410: {
                "description": (
                    "Direct submission is disabled. "
                    "Use POST /api/rcs/tasks."
                ),
            },
        },
    )
    def submit(
        family: Literal["ctu", "lmr", "fmr", "qf"],
        body: Submit,
    ):
        # Keep the old route so existing callers receive
        # a clear migration error instead of sending a task.
        reject_direct_submission()

    # =====================================================
    # TASK QUERY
    # =====================================================

    @router.post("/api/rcs/task/query")
    def query(body: TaskQuery):
        return forward(
            "/task/query",
            body.model_dump(),
        )

    @router.post("/api/{family}/task/query")
    def family_query(
        family: Literal["ctu", "lmr", "fmr", "qf"],
        body: TaskQuery,
    ):
        return query(body)

    # =====================================================
    # TASK CANCEL
    # =====================================================

    @router.post("/api/rcs/task/cancel")
    def cancel(body: Cancel):
        return forward(
            "/task/cancel",
            body.model_dump(exclude_none=True),
        )

    @router.post("/api/{family}/task/cancel")
    def family_cancel(
        family: Literal["ctu", "lmr", "fmr", "qf"],
        body: Cancel,
    ):
        return cancel(body)

    # =====================================================
    # CARRIER BIND / UNBIND
    # =====================================================

    @router.post("/api/ctu/carrier/bind")
    def bind_carrier(body: CarrierBind):
        return forward(
            "/carrier/bind",
            body.model_dump(exclude_none=True),
        )

    @router.post("/api/ctu/carrier/unbind")
    def unbind_carrier(body: CarrierUnbind):
        return forward(
            "/carrier/unbind",
            body.model_dump(exclude_none=True),
        )

    # =====================================================
    # SITE / BIN BIND
    # =====================================================

    @router.post("/api/{family}/site/bind")
    def bind_site(
        family: Literal["ctu", "lmr", "qf"],
        body: SiteBind,
    ):
        payload = body.model_dump(
            exclude_none=True,
        )

        payload["slotCategory"] = (
            body.slotCategory
            or (
                "BIN"
                if family == "ctu"
                else "SITE"
            )
        )

        return forward(
            "/site/bind",
            payload,
        )

    @router.post("/api/fmr/bin/bind")
    @router.post("/api/ctu/bin/link")
    def bind_bin(body: SiteBind):
        payload = body.model_dump(
            exclude_none=True,
        )

        payload["slotCategory"] = (
            body.slotCategory or "BIN"
        )

        return forward(
            "/site/bind",
            payload,
        )

    return router