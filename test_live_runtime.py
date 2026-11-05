import asyncio
import json
import os
import unittest
from unittest.mock import AsyncMock, patch

from ai_runtime import AiRuntimeError, _copilot_prompt, _framework_plan, analyze_with_ai
from app import AgentOrchestrator, get_market_snapshot


PAYLOAD = {"crop": "감", "quantity": 100, "harvestDate": "2026-11-10", "condition": "색이 고름"}
RISK = {"riskLevel": "medium", "observations": ["색이 고름"], "warnings": ["육안 확인 필요"]}
PLAN = {
    "summary": "출하를 준비하세요.",
    "recommendedAction": "일부 우선 출하",
    "recommendedChannel": "지역 직거래",
    "reasons": ["상태 확인"],
    "confidence": {"level": "medium", "reasons": ["제한된 정보"]},
    "warnings": [],
    "requiresApproval": True,
}


class LiveRuntimeTests(unittest.TestCase):
    def test_copilot_session_cleanup_on_failure(self):
        client = AsyncMock()
        client.__aenter__.return_value = client
        client.create_session.return_value.session_id = "session"
        client.create_session.return_value.send_and_wait.side_effect = RuntimeError("sdk failure")
        with patch("copilot.CopilotClient", return_value=client), self.assertRaises(RuntimeError):
            asyncio.run(_copilot_prompt("request"))
        client.delete_session.assert_awaited_once_with("session")
        self.assertEqual(client.create_session.await_args.kwargs["available_tools"], [])
        self.assertFalse(client.create_session.await_args.kwargs["enable_session_store"])

    def test_missing_azure_configuration_is_explicit(self):
        env = {
            "AZURE_OPENAI_ENDPOINT": "",
            "AZURE_OPENAI_MODEL": "",
            "AZURE_OPENAI_CHAT_COMPLETION_MODEL": "",
        }
        with patch.dict(os.environ, env), self.assertRaisesRegex(AiRuntimeError, "Azure OpenAI"):
            asyncio.run(_framework_plan("request"))

    def test_framework_uses_real_azure_client_and_response_types(self):
        from agent_framework import Agent, AgentResponse, Message

        response = AgentResponse(messages=[Message(role="assistant", contents=[json.dumps(PLAN)])])
        env = {"AZURE_OPENAI_ENDPOINT": "https://example.openai.azure.com", "AZURE_OPENAI_MODEL": "deployment"}
        with patch.dict(os.environ, env), \
             patch.object(Agent, "run", new=AsyncMock(return_value=response)) as run:
            result = asyncio.run(_framework_plan("example prompt"))
        run.assert_awaited_once_with("example prompt")
        self.assertEqual(result, PLAN)

    def test_live_result_contains_risk_date_and_market_context(self):
        market = get_market_snapshot(PAYLOAD["crop"], PAYLOAD["harvestDate"], PAYLOAD["quantity"])
        planner = AsyncMock(return_value=PLAN.copy())
        with patch("ai_runtime._copilot_prompt", new=AsyncMock(return_value=json.dumps(RISK))), \
             patch("ai_runtime._framework_plan", new=planner):
            result = analyze_with_ai(PAYLOAD, market)
        planner_input = json.loads(planner.await_args.args[0])
        self.assertEqual(planner_input["marketSnapshot"], market)
        self.assertEqual(result["riskLevel"], "medium")
        self.assertEqual(result["dataDate"], market["dataDate"])
        self.assertEqual(result["runtime"], "copilot-sdk-agent-framework")
        self.assertTrue(result["requiresApproval"])
        self.assertTrue(any("데모" in warning for warning in result["warnings"]))

    def test_invalid_risk_or_plan_fails_closed(self):
        market = get_market_snapshot(PAYLOAD["crop"], PAYLOAD["harvestDate"], PAYLOAD["quantity"])
        cases = [
            ({"riskLevel": "unknown", "observations": [], "warnings": []}, PLAN),
            (RISK, {**PLAN, "confidence": {"level": "medium", "reasons": []}}),
            (RISK, {**PLAN, "reasons": "invalid"}),
        ]
        for risk, plan in cases:
            with self.subTest(risk=risk, plan=plan), \
                 patch("ai_runtime._copilot_prompt", new=AsyncMock(return_value=json.dumps(risk))), \
                 patch("ai_runtime._framework_plan", new=AsyncMock(return_value=plan)), \
                 self.assertRaises(AiRuntimeError):
                analyze_with_ai(PAYLOAD, market)

    def test_orchestrator_calls_market_tool_in_live_mode(self):
        market = get_market_snapshot(PAYLOAD["crop"], PAYLOAD["harvestDate"], PAYLOAD["quantity"])
        result = {**PLAN, "riskLevel": "medium", "dataDate": market["dataDate"], "runtime": "copilot-sdk-agent-framework"}
        with patch.dict(os.environ, {"AI_RUNTIME": "live"}), \
             patch("app.get_market_snapshot", return_value=market) as tool, \
             patch("app.analyze_with_ai", return_value=result) as live:
            output = AgentOrchestrator().analyze(PAYLOAD)
        tool.assert_called_once_with("감", "2026-11-10", 100)
        live.assert_called_once_with(PAYLOAD, market)
        self.assertEqual(len(output["steps"]), 4)


if __name__ == "__main__":
    unittest.main()
