"""Tests for the HIK router and WMS bridge.

Run from the backend directory:
    python -m unittest test_hik_contract -v

All network requests are mocked.
Database tests use a temporary SQLite database.
"""

import json
import os
import tempfile
import unittest

from unittest.mock import Mock, patch

from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient


# Load the backend with deterministic test configuration.
# Restore environment variables after importing.
with patch.dict(
    os.environ,
    {
        "RCS_MODE": "MOCK",
        "HIK_RCS_BASE_URL": "",
        "HIK_TASK_TYPE": "",
        "HIK_RCS_TIMEOUT_SECONDS": "30",
    },
):
    import main

from hik_api import create_hik_router


# =========================================================
# COMMON TEST SAFETY
# =========================================================

class NoNetworkTestCase(unittest.TestCase):
    def setUp(self):
        super().setUp()

        self.network = self.enterContext(
            patch.object(
                main.urllib.request,
                "urlopen",
                side_effect=AssertionError(
                    "Unexpected real network request."
                ),
            )
        )


# =========================================================
# DIRECT API ROUTER
# =========================================================

class HikContractTests(NoNetworkTestCase):
    def setUp(self):
        super().setUp()

        self.post = Mock(
            return_value={
                "code": "SUCCESS",
                "data": {},
            }
        )

        self.mode = "HIK"

        app = FastAPI()

        app.include_router(
            create_hik_router(
                self.post,
                lambda: self.mode,
            )
        )

        self.client = TestClient(app)
        self.addCleanup(self.client.close)

        self.route = [
            {
                "seq": 0,
                "type": "SITE",
                "code": "P01",
            },
            {
                "seq": 1,
                "type": "SITE",
                "code": "P02",
            },
        ]

    def test_direct_submit_is_disabled_in_all_modes(self):
        for mode in ("HIK", "MOCK"):
            for family in ("ctu", "lmr", "fmr", "qf"):
                with self.subTest(
                    mode=mode,
                    family=family,
                ):
                    self.mode = mode
                    self.post.reset_mock()

                    response = self.client.post(
                        f"/api/{family}/task/submit",
                        json={
                            "targetRoute": self.route,
                            "interrupt": False,
                        },
                    )

                    self.assertEqual(
                        response.status_code,
                        410,
                    )

                    detail = response.json()["detail"]

                    self.assertEqual(
                        detail["replacement"],
                        "/api/rcs/tasks",
                    )

                    self.assertEqual(
                        detail["method"],
                        "POST",
                    )

                    self.post.assert_not_called()

    def test_read_only_connection_check(self):
        response = self.client.post(
            "/api/rcs/connection/check",
            json={
                "singleRobotCode": "R01",
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertIs(response.json()["connected"], True)
        self.assertEqual(response.json()["mode"], "HIK")

        self.post.assert_called_once_with(
            "/robot/query",
            {
                "singleRobotCode": "R01",
            },
        )

    def test_query_cancel_and_binding_payloads(self):
        cases = [
            (
                "/api/lmr/task/query",
                "/task/query",
                {"robotTaskCode": "HIK-42"},
                {"robotTaskCode": "HIK-42"},
            ),
            (
                "/api/ctu/task/cancel",
                "/task/cancel",
                {"robotTaskCode": "HIK-42"},
                {
                    "robotTaskCode": "HIK-42",
                    "cancelType": "CANCEL",
                },
            ),
            (
                "/api/lmr/site/bind",
                "/site/bind",
                {
                    "slotCode": "P01",
                    "temporary": False,
                },
                {
                    "slotCode": "P01",
                    "temporary": False,
                    "slotCategory": "SITE",
                    "invoke": "BIND",
                },
            ),
            (
                "/api/fmr/bin/bind",
                "/site/bind",
                {"slotCode": "B01"},
                {
                    "slotCode": "B01",
                    "slotCategory": "BIN",
                    "invoke": "BIND",
                },
            ),
            (
                "/api/ctu/carrier/unbind",
                "/carrier/unbind",
                {"siteCode": "P01"},
                {"siteCode": "P01"},
            ),
        ]

        for endpoint, target, payload, expected in cases:
            with self.subTest(endpoint=endpoint):
                self.post.reset_mock()

                response = self.client.post(
                    endpoint,
                    json=payload,
                )

                self.assertEqual(
                    response.status_code,
                    200,
                )

                self.post.assert_called_once_with(
                    target,
                    expected,
                )

    def test_mock_blocks_other_direct_requests(self):
        self.mode = "MOCK"

        cases = [
            (
                "/api/rcs/connection/check",
                {"singleRobotCode": "R01"},
            ),
            (
                "/api/lmr/task/query",
                {"robotTaskCode": "HIK-42"},
            ),
            (
                "/api/ctu/task/cancel",
                {"robotTaskCode": "HIK-42"},
            ),
            (
                "/api/fmr/bin/bind",
                {"slotCode": "B01"},
            ),
            (
                "/api/ctu/carrier/unbind",
                {"siteCode": "P01"},
            ),
        ]

        for endpoint, payload in cases:
            with self.subTest(endpoint=endpoint):
                response = self.client.post(
                    endpoint,
                    json=payload,
                )

                self.assertEqual(
                    response.status_code,
                    409,
                )

        self.post.assert_not_called()

    def test_validation_before_network(self):
        cases = [
            (
                "/api/robot/query",
                {"singleRobotCode": " "},
            ),
            (
                "/api/ctu/carrier/unbind",
                {},
            ),
            (
                "/api/lmr/task/submit",
                {"targetRoute": []},
            ),
            (
                "/api/lmr/task/submit",
                {
                    "targetRoute": [
                        {
                            "seq": 2,
                            "type": "SITE",
                            "code": "A",
                        },
                    ],
                },
            ),
            (
                "/api/unknown/task/submit",
                {"targetRoute": self.route},
            ),
        ]

        for endpoint, payload in cases:
            with self.subTest(endpoint=endpoint):
                response = self.client.post(
                    endpoint,
                    json=payload,
                )

                self.assertEqual(
                    response.status_code,
                    422,
                )

        self.post.assert_not_called()

    def test_invalid_upstream_responses_are_rejected(self):
        responses = [
            {
                "code": "ERROR",
                "message": "Bad request",
            },
            {},
            [],
            None,
        ]

        for upstream in responses:
            with self.subTest(upstream=upstream):
                self.post.return_value = upstream

                response = self.client.post(
                    "/api/robot/query",
                    json={"singleRobotCode": "R01"},
                )

                self.assertEqual(
                    response.status_code,
                    502,
                )

                self.assertNotIn(
                    "success",
                    response.json(),
                )


# =========================================================
# WMS BRIDGE
# =========================================================

class WmsBridgeTests(NoNetworkTestCase):
    def setUp(self):
        super().setUp()

        directory = self.enterContext(
            tempfile.TemporaryDirectory()
        )

        self.enterContext(
            patch.object(
                main,
                "DATABASE_PATH",
                os.path.join(directory, "test.db"),
            )
        )

        self.enterContext(
            patch.object(main, "RCS_MODE", "HIK")
        )

        self.enterContext(
            patch.object(
                main,
                "HIK_RCS_BASE_URL",
                "http://example.test",
            )
        )

        self.enterContext(
            patch.object(main, "HIK_TASK_TYPE", "F05")
        )

        self.post = self.enterContext(
            patch.object(
                main,
                "hik_post",
                return_value={
                    "code": "SUCCESS",
                    "data": {
                        "robotTaskCode": "HIK-42",
                    },
                },
            )
        )

        main.init_database()

        self.client = TestClient(main.app)
        self.addCleanup(self.client.close)

    def command(self, **changes):
        values = {
            "robotTaskCode": "WMS-TEST",
            "taskType": "TRANSPORT",
            "source": {
                "type": "SITE",
                "code": "A",
            },
            "destination": {
                "type": "SITE",
                "code": "B",
            },
        }

        values.update(changes)

        return main.RcsTaskRequest(**values)

    def create_record(self):
        response = main.create_rcs_task(
            self.command()
        )

        return main.get_task_record(
            response["bridgeTaskId"]
        )

    def test_adapter_preserves_optional_values(self):
        command = self.command(
            robotCode="R01",
            interrupt=False,
        )

        body = main.build_hik_task_payload(command)

        self.assertEqual(body["taskType"], "F05")
        self.assertEqual(body["robotCode"], "R01")
        self.assertIs(body["interrupt"], False)
        self.assertEqual(body["initPriority"], 60)

        self.assertNotIn(
            "autoStart",
            body["targetRoute"][0],
        )

        with patch.object(main, "HIK_TASK_TYPE", ""):
            with self.assertRaises(HTTPException):
                main.build_hik_task_payload(command)

        self.post.assert_not_called()

    def test_submit_persists_ids_and_duplicate_is_cached(self):
        payload = self.command().model_dump()

        first = self.client.post(
            "/api/rcs/tasks",
            json=payload,
        )

        second = self.client.post(
            "/api/rcs/tasks",
            json=payload,
        )

        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(first.json(), second.json())

        result = first.json()

        self.assertEqual(
            result["robotTaskCode"],
            "WMS-TEST",
        )

        self.assertEqual(
            result["rcsTaskChainCode"],
            "HIK-42",
        )

        record = main.get_task_record(
            result["bridgeTaskId"]
        )

        self.assertEqual(
            record["robotTaskCode"],
            "WMS-TEST",
        )

        self.assertEqual(
            record["rcsTaskChainCode"],
            "HIK-42",
        )

        self.assertEqual(
            len(main.get_all_task_records()),
            1,
        )

        self.post.assert_called_once_with(
            "/task/submit",
            {
                "taskType": "F05",
                "targetRoute": [
                    {
                        "seq": 0,
                        "type": "SITE",
                        "code": "A",
                    },
                    {
                        "seq": 1,
                        "type": "SITE",
                        "code": "B",
                    },
                ],
                "initPriority": 60,
            },
        )

    def test_same_reference_with_changed_data_is_blocked(self):
        main.create_rcs_task(self.command())
        self.post.reset_mock()

        changed = self.command(
            destination={
                "type": "SITE",
                "code": "C",
            }
        )

        with self.assertRaises(HTTPException) as caught:
            main.create_rcs_task(changed)

        self.assertEqual(
            caught.exception.status_code,
            409,
        )

        self.post.assert_not_called()

    def test_uncertain_submission_cannot_be_retried(self):
        self.post.side_effect = HTTPException(
            status_code=503,
            detail="No response from RCS.",
        )

        with self.assertRaises(HTTPException) as first:
            main.create_rcs_task(self.command())

        self.assertEqual(
            first.exception.status_code,
            503,
        )

        with self.assertRaises(HTTPException) as second:
            main.create_rcs_task(self.command())

        self.assertEqual(
            second.exception.status_code,
            409,
        )

        self.post.assert_called_once()

        self.assertEqual(
            main.get_all_task_records(),
            [],
        )

    def test_missing_returned_task_code_blocks_retry(self):
        self.post.return_value = {
            "code": "SUCCESS",
            "data": {},
        }

        with self.assertRaises(HTTPException) as first:
            main.create_rcs_task(self.command())

        self.assertEqual(
            first.exception.status_code,
            502,
        )

        with self.assertRaises(HTTPException) as second:
            main.create_rcs_task(self.command())

        self.assertEqual(
            second.exception.status_code,
            409,
        )

        self.post.assert_called_once()

    def test_task_history_uses_database_only(self):
        record = self.create_record()
        self.post.reset_mock()

        response = self.client.get(
            "/api/rcs/tasks"
        )

        self.assertEqual(response.status_code, 200)

        result = response.json()

        self.assertEqual(
            result["statusSource"],
            "DATABASE",
        )

        self.assertEqual(result["count"], 1)

        self.assertEqual(
            result["tasks"][0]["bridgeTaskId"],
            record["bridgeTaskId"],
        )

        self.post.assert_not_called()

    def test_individual_query_updates_saved_status(self):
        record = self.create_record()
        self.post.reset_mock()

        self.post.return_value = {
            "code": "SUCCESS",
            "data": {
                "robotTaskCode": "HIK-42",
                "taskStatus": "FINISHED",
            },
        }

        response = self.client.get(
            f"/api/rcs/tasks/{record['bridgeTaskId']}"
        )

        self.assertEqual(response.status_code, 200)

        self.assertEqual(
            response.json()["task"]["rcsStatus"],
            "COMPLETED",
        )

        saved = main.get_task_record(
            record["bridgeTaskId"]
        )

        self.assertEqual(
            saved["rcsStatus"],
            "COMPLETED",
        )

        self.post.assert_called_once_with(
            "/task/query",
            {"robotTaskCode": "HIK-42"},
        )

    def test_invalid_status_response_does_not_change_database(self):
        record = self.create_record()

        before = main.get_task_record(
            record["bridgeTaskId"]
        )

        invalid_data = [
            None,
            {},
            [],
            [
                {"taskStatus": "RUNNING"},
                {"taskStatus": "FINISHED"},
            ],
            {"status": "FINISHED"},
            {
                "subtask": {
                    "taskStatus": "FINISHED",
                },
            },
            {"taskStatus": ""},
            {"taskStatus": 3},
            {"taskStatus": "UNKNOWN_VENDOR_STATUS"},
            {
                "taskStatus": "FINISHED",
                "taskState": "RUNNING",
            },
            {
                "robotTaskCode": "OTHER-TASK",
                "taskStatus": "FINISHED",
            },
        ]

        for data in invalid_data:
            with self.subTest(data=data):
                self.post.return_value = {
                    "code": "SUCCESS",
                    "data": data,
                }

                response = self.client.get(
                    "/api/rcs/tasks/"
                    + record["bridgeTaskId"]
                )

                self.assertEqual(
                    response.status_code,
                    502,
                )

                after = main.get_task_record(
                    record["bridgeTaskId"]
                )

                self.assertEqual(after, before)

    def test_query_failure_keeps_saved_record(self):
        record = self.create_record()

        before = main.get_task_record(
            record["bridgeTaskId"]
        )

        self.post.return_value = {
            "code": "ERROR",
            "message": "Task query failed",
        }

        response = self.client.get(
            f"/api/rcs/tasks/{record['bridgeTaskId']}"
        )

        self.assertEqual(response.status_code, 502)

        after = main.get_task_record(
            record["bridgeTaskId"]
        )

        self.assertEqual(after, before)

    def test_supported_status_shapes(self):
        cases = [
            (
                {"taskStatus": "FINISHED"},
                "COMPLETED",
            ),
            (
                {"robotTaskStatus": "RUNNING"},
                "RUNNING",
            ),
            (
                [{"taskStatus": "CANCELED"}],
                "CANCELLED",
            ),
            (
                {
                    "taskStatus": "DONE",
                    "taskState": "FINISHED",
                },
                "COMPLETED",
            ),
        ]

        for data, expected in cases:
            with self.subTest(data=data):
                self.assertEqual(
                    main.find_status_value(data),
                    expected,
                )

    def test_status_is_local_and_mock_does_not_advance_real_task(self):
        with patch.object(main, "RCS_MODE", "MOCK"):
            status = main.rcs_bridge_status()

            self.assertEqual(
                status["connectionStatus"],
                "SIMULATION",
            )

            record = {
                "rcsTaskChainCode": "HIK-1",
                "rcsStatus": "CREATED",
            }

            result = main.refresh_task_record(record)

            self.assertIs(result, record)

            self.assertEqual(
                result["rcsStatus"],
                "CREATED",
            )

        self.post.assert_not_called()


# =========================================================
# HTTP TRANSPORT
# =========================================================

class HikTransportTests(NoNetworkTestCase):
    def test_url_headers_invalid_json_shape_and_no_retry(self):
        response = Mock()

        response.__enter__ = Mock(
            return_value=response
        )

        response.__exit__ = Mock(
            return_value=False
        )

        response.status = 200

        response.read.return_value = (
            b'{"code":"SUCCESS","data":{}}'
        )

        base_url = (
            "http://example.test"
            "/rcs/rtas/api/robot/controller"
        )

        with (
            patch.object(
                main,
                "HIK_RCS_BASE_URL",
                base_url,
            ),
            patch.object(
                main.urllib.request,
                "urlopen",
                return_value=response,
            ) as call,
        ):
            main.hik_post(
                "/task/query",
                {"robotTaskCode": "T"},
            )

            request = call.call_args.args[0]

            self.assertEqual(
                request.full_url,
                base_url + "/task/query",
            )

            headers = {
                key.lower(): value
                for key, value in request.header_items()
            }

            self.assertEqual(
                len(headers["x-lr-request-id"]),
                16,
            )

            self.assertEqual(
                len(headers["x-lr-trace-id"]),
                32,
            )

            self.assertEqual(
                json.loads(request.data),
                {"robotTaskCode": "T"},
            )

            response.read.return_value = b"[]"

            with self.assertRaises(HTTPException) as invalid:
                main.hik_post("/task/query", {})

            self.assertEqual(
                invalid.exception.status_code,
                502,
            )

            call.reset_mock()
            call.side_effect = TimeoutError("timeout")

            with self.assertRaises(HTTPException) as timeout:
                main.hik_post("/task/submit", {})

            self.assertEqual(
                timeout.exception.status_code,
                503,
            )

            call.assert_called_once()


if __name__ == "__main__":
    unittest.main()