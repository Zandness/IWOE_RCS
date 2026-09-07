"""HIK RCS 4.3 proxies based on the supplied WASNA4.3/server.js.

These direct APIs preserve the upstream payload. WMS-tracked tasks should use
/api/rcs/tasks instead. No direct endpoint simulates a successful HIK response.
"""
from typing import Any, Literal
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field, model_validator


class Payload(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True, allow_inf_nan=False)


class RobotQuery(Payload):
    singleRobotCode: str = Field(min_length=1)


class TaskQuery(Payload):
    robotTaskCode: str = Field(min_length=1)


class Target(Payload):
    seq: int = Field(ge=0)
    type: Literal["SITE", "STORAGE"]
    code: str = Field(min_length=1)
    autoStart: int | None = Field(default=None, ge=0, le=1)


class Submit(Payload):
    taskType: str | None = Field(default=None, min_length=1)
    targetRoute: list[Target] = Field(min_length=1)
    initPriority: int = Field(default=99, ge=1, le=120)
    robotType: str | None = None
    robotCode: str | None = None
    groupCode: str | None = None
    deadlineTime: str | None = None
    interrupt: bool | None = None
    extra: dict[str, Any] | None = None

    @model_validator(mode="after")
    def ordered_route(self):
        if [x.seq for x in self.targetRoute] != list(range(len(self.targetRoute))):
            raise ValueError("targetRoute.seq must start at 0 and be consecutive")
        return self


class Cancel(TaskQuery):
    cancelType: str = Field(default="CANCEL", min_length=1)
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
    carrierCode: str | None = Field(default=None, min_length=1)
    siteCode: str | None = Field(default=None, min_length=1)
    extra: dict[str, Any] | None = None

    @model_validator(mode="after")
    def identifier_required(self):
        if not (self.carrierCode or self.siteCode):
            raise ValueError("carrierCode or siteCode is required")
        return self


class SiteBind(Payload):
    slotCategory: str | None = None
    slotCode: str = Field(min_length=1)
    carrierCategory: str | None = None
    carrierType: str | None = None
    carrierCode: str | None = None
    temporary: bool | None = None
    invoke: str = Field(default="BIND", min_length=1)
    carrierDir: float | None = None
    colCount: int | None = Field(default=None, ge=1)


DEFAULT_TASK_TYPES = {"ctu": "CTUW", "lmr": "F05", "fmr": "F115", "qf": "F116"}


def create_hik_router(post, get_mode):
    router = APIRouter(tags=["HIK 4.3 / WASNA reference"])

    def forward(path, payload):
        if get_mode() != "HIK":
            raise HTTPException(409, "This direct RCS API requires RCS_MODE=HIK. No request was sent.")
        response = post(path, payload)
        if response.get("code") != "SUCCESS":
            raise HTTPException(502, {"message": "HIK RCS rejected the request", "rcsResponse": response})
        result = {"success": True, "code": response["code"],
                  "message": response.get("message", "Operation completed"), "data": response}
        if path == "/task/submit":
            task_code = (response.get("data") or {}).get("robotTaskCode") if isinstance(response.get("data"), dict) else None
            if not task_code:
                raise HTTPException(502, {"message": "Submission outcome uncertain: no robotTaskCode returned. Query RCS before retrying.", "rcsResponse": response})
            result["robotTaskCode"] = task_code
        return result

    @router.post("/api/rcs/robot/query")
    @router.post("/api/robot/query")
    @router.post("/api/ctu/robot/query")
    def query_robot(body: RobotQuery):
        return forward("/robot/query", body.model_dump(exclude_none=True))

    # A successful robot query is a live connectivity check, unlike local /status.
    @router.post("/api/rcs/connection/check")
    def check_connection(body: RobotQuery):
        result = query_robot(body)
        return {**result, "connected": True, "mode": "HIK"}

    @router.post("/api/{family}/task/submit")
    def submit(family: Literal["ctu", "lmr", "fmr", "qf"], body: Submit):
        payload = body.model_dump(exclude_none=True)
        payload["taskType"] = body.taskType or DEFAULT_TASK_TYPES[family]
        return forward("/task/submit", payload)

    @router.post("/api/rcs/task/query")
    def query(body: TaskQuery):
        return forward("/task/query", body.model_dump())

    @router.post("/api/{family}/task/query")
    def family_query(family: Literal["ctu", "lmr", "fmr", "qf"], body: TaskQuery):
        return query(body)

    @router.post("/api/rcs/task/cancel")
    def cancel(body: Cancel):
        return forward("/task/cancel", body.model_dump(exclude_none=True))

    @router.post("/api/{family}/task/cancel")
    def family_cancel(family: Literal["ctu", "lmr", "fmr", "qf"], body: Cancel):
        return cancel(body)

    @router.post("/api/ctu/carrier/bind")
    def bind_carrier(body: CarrierBind):
        return forward("/carrier/bind", body.model_dump(exclude_none=True))

    @router.post("/api/ctu/carrier/unbind")
    def unbind_carrier(body: CarrierUnbind):
        return forward("/carrier/unbind", body.model_dump(exclude_none=True))

    @router.post("/api/{family}/site/bind")
    def bind_site(family: Literal["ctu", "lmr", "qf"], body: SiteBind):
        payload = body.model_dump(exclude_none=True)
        payload["slotCategory"] = body.slotCategory or ("BIN" if family == "ctu" else "SITE")
        return forward("/site/bind", payload)

    @router.post("/api/fmr/bin/bind")
    @router.post("/api/ctu/bin/link")
    def bind_bin(body: SiteBind):
        payload = body.model_dump(exclude_none=True)
        payload["slotCategory"] = body.slotCategory or "BIN"
        return forward("/site/bind", payload)

    return router
