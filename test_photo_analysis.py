import asyncio
import base64
import json
import threading
import unittest
from http.client import HTTPConnection
from http.server import ThreadingHTTPServer
from types import SimpleNamespace
from unittest.mock import patch

from ai_runtime import AiRuntimeError
from app import Handler
from photo_analysis import PhotoAnalysisError, _analyze_photo, analyze_photo, validate_photo_request, validate_photo_result


IMAGE = base64.b64encode(b"\xff\xd8\xfftest").decode("ascii")
REQUEST = {"kind": "label", "mimeType": "image/jpeg", "image": IMAGE, "consent": True}


class FakeSession:
    session_id = "test-session"

    def __init__(self, content):
        self.content = content
        self.attachments = None

    async def send_and_wait(self, prompt, *, attachments, timeout):
        self.attachments = attachments
        return SimpleNamespace(data=SimpleNamespace(content=self.content))


class FakeClient:
    def __init__(self, content):
        self.session = FakeSession(content)
        self.deleted = []

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        pass

    async def create_session(self, **kwargs):
        return self.session

    async def delete_session(self, session_id):
        self.deleted.append(session_id)


class PhotoTests(unittest.TestCase):
    def test_unconfigured_photo_analysis_fails_without_starting_sdk(self):
        with patch.dict("os.environ", {"PHOTO_ANALYSIS_ENABLED": ""}):
            with self.assertRaises(PhotoAnalysisError):
                analyze_photo(REQUEST)
        with patch.dict("os.environ", {"PHOTO_ANALYSIS_ENABLED": "true", "COPILOT_SKIP_CLI_DOWNLOAD": "", "COPILOT_CLI_PATH": ""}):
            with self.assertRaises(PhotoAnalysisError):
                analyze_photo(REQUEST)

    def test_request_validation(self):
        self.assertEqual(validate_photo_request(REQUEST)["image"], IMAGE)
        for changes in (
            {"consent": False},
            {"kind": "other"},
            {"mimeType": "image/png"},
            {"image": "not-base64"},
            {"image": "A" * (6 * 1024 * 1024)},
        ):
            with self.subTest(changes=changes), self.assertRaises(ValueError):
                validate_photo_request({**REQUEST, **changes})

    def test_sdk_attachment_result_and_cleanup(self):
        result = {"crop": "감", "grade": "특", "itemsPerBox": "10",
                  "weightPerBoxKg": "5", "observation": "ignored",
                  "totalWeightKg": "100", "totalWeightEvidence": "출하 총중량 100kg",
                  "shipmentDate": "2026-11-10", "shipmentDateEvidence": "출하 예정일 2026년 11월 10일"}
        client = FakeClient(json.dumps(result, ensure_ascii=False))
        with patch.dict("sys.modules", {"copilot": SimpleNamespace(CopilotClient=lambda: client)}):
            output = asyncio.run(_analyze_photo(validate_photo_request(REQUEST)))
        self.assertEqual(output["crop"], "감")
        self.assertEqual(output["observation"], "")
        self.assertEqual(output["totalWeightKg"], "100")
        self.assertEqual(output["shipmentDate"], "2026-11-10")
        self.assertEqual(client.session.attachments[0]["data"], IMAGE)
        self.assertEqual(client.deleted, ["test-session"])

    def test_produce_does_not_assign_label_fields(self):
        client = FakeClient('{"crop":"감","grade":"특","observation":"붉은색","totalWeightKg":"100","shipmentDate":"2026-11-10"}')
        with patch.dict("sys.modules", {"copilot": SimpleNamespace(CopilotClient=lambda: client)}):
            output = asyncio.run(_analyze_photo({**REQUEST, "kind": "produce"}))
        self.assertEqual(output["grade"], "")
        self.assertEqual(output["crop"], "감")
        self.assertEqual(output["observation"], "붉은색")
        self.assertEqual(output["totalWeightKg"], "")
        self.assertEqual(output["shipmentDate"], "")

    def test_shipment_values_need_valid_explicit_evidence(self):
        cases = [
            {"totalWeightKg": "5", "totalWeightEvidence": "상자 5kg"},
            {"totalWeightKg": "5", "totalWeightEvidence": "출하 총중량 10kg"},
            {"totalWeightKg": "5.5", "totalWeightEvidence": "출하 총중량 5.5kg"},
            {"shipmentDate": "2026-11-10", "shipmentDateEvidence": "수확일 2026-11-10"},
            {"shipmentDate": "2026-11-10", "shipmentDateEvidence": "출하 2026-11-11"},
            {"shipmentDate": "2026-02-30", "shipmentDateEvidence": "출하 2026-02-30"},
        ]
        for result in cases:
            with self.subTest(result=result), self.assertRaises(PhotoAnalysisError):
                validate_photo_result(result)

    def test_invalid_model_result_still_deletes_session(self):
        client = FakeClient("not json")
        with patch.dict("sys.modules", {"copilot": SimpleNamespace(CopilotClient=lambda: client)}):
            with self.assertRaises(PhotoAnalysisError):
                asyncio.run(_analyze_photo(REQUEST))
        self.assertEqual(client.deleted, ["test-session"])

    def test_http_endpoint_and_existing_analyze(self):
        server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            conn = HTTPConnection("127.0.0.1", server.server_port, timeout=5)
            with patch("app.analyze_photo", return_value={"crop": "감"}):
                conn.request("POST", "/api/photo-analyze", json.dumps(REQUEST))
                response = conn.getresponse()
                self.assertEqual(response.status, 200)
                self.assertEqual(json.loads(response.read())["crop"], "감")
            conn.request("POST", "/api/photo-analyze", json.dumps({**REQUEST, "consent": False}))
            response = conn.getresponse()
            self.assertEqual(response.status, 400)
            response.read()
            payload = {"crop": "감", "quantity": 10, "harvestDate": "2026-11-10", "condition": "양호"}
            with patch.dict("os.environ", {"AI_RUNTIME": "demo"}):
                conn.request("POST", "/api/analyze", json.dumps(payload))
                response = conn.getresponse()
                self.assertEqual(response.status, 200)
                self.assertEqual(json.loads(response.read())["runtime"], "demo")
            with patch("app.AgentOrchestrator.analyze", side_effect=AiRuntimeError("AI 연결 실패")):
                conn.request("POST", "/api/analyze", json.dumps(payload))
                response = conn.getresponse()
                self.assertEqual(response.status, 502)
                self.assertTrue(json.loads(response.read())["retryable"])
            plan = {"requiresApproval": True, "summary": "요약",
                    "recommendedAction": "출하", "recommendedChannel": "시장"}
            conn.request("POST", "/api/plan", json.dumps(plan))
            response = conn.getresponse()
            self.assertEqual(response.status, 200)
            self.assertEqual(json.loads(response.read())["status"], "approved")
            conn.close()
        finally:
            server.shutdown()
            server.server_close()
            thread.join()


if __name__ == "__main__":
    unittest.main()
