import json
import os
import tempfile
import unittest
from unittest.mock import Mock, patch
from fastapi import FastAPI
from fastapi.testclient import TestClient

os.environ['RCS_MODE'] = 'MOCK'
import main
from hik_api import create_hik_router


class HikContractTests(unittest.TestCase):
    def setUp(self):
        self.post = Mock(return_value={'code': 'SUCCESS', 'data': {'robotTaskCode': 'HIK-42'}})
        self.mode = 'HIK'
        app = FastAPI()
        app.include_router(create_hik_router(self.post, lambda: self.mode))
        self.client = TestClient(app)
        self.route = [{'seq': 0, 'type': 'SITE', 'code': 'P01'}, {'seq': 1, 'type': 'SITE', 'code': 'P02'}]

    def test_family_submit_payloads_and_returned_task_id(self):
        for family, task_type in [('ctu', 'CTUW'), ('lmr', 'F05'), ('fmr', 'F115'), ('qf', 'F116')]:
            r = self.client.post(f'/api/{family}/task/submit', json={'targetRoute': self.route, 'interrupt': False})
            self.assertEqual(r.status_code, 200)
            self.assertEqual(r.json()['robotTaskCode'], 'HIK-42')
            self.post.assert_called_with('/task/submit', {'taskType': task_type, 'targetRoute': self.route, 'initPriority': 99, 'interrupt': False})

    def test_read_only_connection_check(self):
        r = self.client.post('/api/rcs/connection/check', json={'singleRobotCode': 'R01'})
        self.assertTrue(r.json()['connected'])
        self.post.assert_called_once_with('/robot/query', {'singleRobotCode': 'R01'})

    def test_query_cancel_and_binding(self):
        for endpoint, target, payload, expected in [
            ('/api/lmr/task/query', '/task/query', {'robotTaskCode': 'HIK-42'}, {'robotTaskCode': 'HIK-42'}),
            ('/api/ctu/task/cancel', '/task/cancel', {'robotTaskCode': 'HIK-42'}, {'robotTaskCode': 'HIK-42', 'cancelType': 'CANCEL'}),
            ('/api/lmr/site/bind', '/site/bind', {'slotCode': 'P01', 'temporary': False}, {'slotCode': 'P01', 'temporary': False, 'slotCategory': 'SITE', 'invoke': 'BIND'}),
            ('/api/fmr/bin/bind', '/site/bind', {'slotCode': 'B01'}, {'slotCode': 'B01', 'slotCategory': 'BIN', 'invoke': 'BIND'}),
            ('/api/ctu/carrier/unbind', '/carrier/unbind', {'siteCode': 'P01'}, {'siteCode': 'P01'}),
        ]:
            self.assertEqual(self.client.post(endpoint, json=payload).status_code, 200)
            self.post.assert_called_with(target, expected)

    def test_mock_never_sends_direct_requests(self):
        self.mode = 'MOCK'
        self.assertEqual(self.client.post('/api/lmr/task/submit', json={'targetRoute': self.route}).status_code, 409)
        self.post.assert_not_called()

    def test_validation_before_network(self):
        for path, payload in [('/api/robot/query', {'singleRobotCode': ' '}),
                              ('/api/ctu/carrier/unbind', {}),
                              ('/api/lmr/task/submit', {'targetRoute': []}),
                              ('/api/lmr/task/submit', {'targetRoute': [{'seq': 2, 'type': 'SITE', 'code': 'A'}]}),
                              ('/api/unknown/task/submit', {'targetRoute': self.route})]:
            self.assertEqual(self.client.post(path, json=payload).status_code, 422)
        self.post.assert_not_called()

    def test_rejection_and_missing_task_code_do_not_report_success(self):
        self.post.return_value = {'code': 'ERROR', 'message': 'bad task'}
        self.assertEqual(self.client.post('/api/robot/query', json={'singleRobotCode': 'R'}).status_code, 502)
        self.post.return_value = {'code': 'SUCCESS', 'data': {}}
        self.assertEqual(self.client.post('/api/lmr/task/submit', json={'targetRoute': self.route}).status_code, 502)

    def test_existing_wms_adapter_mapping(self):
        command = main.RcsTaskRequest(robotTaskCode='WMS-1', source={'code': 'A'}, destination={'code': 'B'}, robotCode='R', interrupt=False)
        with patch.object(main, 'HIK_TASK_TYPE', 'F05'):
            body = main.build_hik_task_payload(command)
        self.assertEqual(body['taskType'], 'F05')
        self.assertEqual(body['robotCode'], 'R')
        self.assertIs(body['interrupt'], False)
        self.assertNotIn('autoStart', body['targetRoute'][0])
        with patch.object(main, 'HIK_TASK_TYPE', ''):
            with self.assertRaises(main.HTTPException): main.build_hik_task_payload(command)

    def test_transport_url_headers_errors_and_no_retries(self):
        response = Mock()
        response.__enter__ = Mock(return_value=response)
        response.__exit__ = Mock(return_value=False)
        response.status = 200
        response.read.return_value = b'{"code":"SUCCESS","data":{}}'
        with patch.object(main, 'HIK_RCS_BASE_URL', 'http://example.test/rcs/rtas/api/robot/controller'), patch.object(main.urllib.request, 'urlopen', return_value=response) as call:
            main.hik_post('/task/query', {'robotTaskCode': 'T'})
            request = call.call_args.args[0]
            self.assertEqual(request.full_url, 'http://example.test/rcs/rtas/api/robot/controller/task/query')
            headers = dict((k.lower(), v) for k,v in request.header_items())
            self.assertEqual(len(headers['x-lr-request-id']), 16)
            self.assertEqual(len(headers['x-lr-trace-id']), 32)
            self.assertEqual(json.loads(request.data), {'robotTaskCode': 'T'})
            response.read.return_value = b'[]'
            with self.assertRaises(main.HTTPException): main.hik_post('/task/query', {})
            call.reset_mock()
            call.side_effect = TimeoutError('timeout')
            with self.assertRaises(main.HTTPException) as error: main.hik_post('/task/submit', {})
            self.assertEqual(error.exception.status_code, 503)
            call.assert_called_once()

    def test_status_is_local_and_real_records_are_not_simulated(self):
        with patch.object(main, 'get_all_task_records', return_value=[]), patch.object(main, 'hik_post') as post:
            self.assertEqual(main.rcs_bridge_status()['connectionStatus'], 'SIMULATION')
            post.assert_not_called()
        record = {'rcsTaskChainCode': 'HIK-1', 'rcsStatus': 'CREATED'}
        self.assertIs(main.refresh_task_record(record), record)
        self.assertEqual(record['rcsStatus'], 'CREATED')

    def test_wms_hik_submission_and_query_persist_ids(self):
        with tempfile.TemporaryDirectory() as d, patch.object(main, 'DATABASE_PATH', d+'/test.db'), patch.object(main, 'RCS_MODE', 'HIK'), patch.object(main, 'HIK_RCS_BASE_URL', 'http://example.test'), patch.object(main, 'HIK_TASK_TYPE', 'F05'), patch.object(main, 'hik_post', return_value={'code': 'SUCCESS', 'data': {'robotTaskCode': 'HIK-42'}}) as post:
            main.init_database()
            command = main.RcsTaskRequest(robotTaskCode='WMS-TEST', source={'code':'A'}, destination={'code':'B'})
            result = main.create_rcs_task(command)
            self.assertEqual(result['robotTaskCode'], 'WMS-TEST')
            self.assertEqual(result['rcsTaskChainCode'], 'HIK-42')
            record = main.get_task_record(result['bridgeTaskId'])
            post.return_value = {'code':'SUCCESS', 'data':{'robotTaskStatus':'RUNNING'}}
            main.refresh_hik_record(record)
            post.assert_called_with('/task/query', {'robotTaskCode':'HIK-42'})
            self.assertEqual(main.get_task_record(result['bridgeTaskId'])['rcsStatus'], 'RUNNING')
            post.return_value = {'code':'ERROR'}
            with self.assertRaises(main.HTTPException): main.refresh_hik_record(record)

if __name__ == '__main__': unittest.main()
