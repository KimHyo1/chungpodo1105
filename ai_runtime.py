import asyncio
import json
import os
from typing import Any


class AiRuntimeError(RuntimeError):
    """Raised when the configured AI runtime cannot complete an analysis."""


def _text_from_response(response: Any) -> str:
    if response is None:
        raise AiRuntimeError("AI 응답이 비어 있습니다.")
    content = getattr(response, "content", None)
    if content is None:
        data = getattr(response, "data", None)
        content = getattr(data, "content", data)
    if content is None:
        content = response
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "".join(str(getattr(item, "text", item)) for item in content)
    return str(content)


def _parse_json_response(text: str, stage: str) -> dict[str, Any]:
    cleaned = text.strip()
    if not cleaned:
        raise AiRuntimeError(f"{stage} AI 응답이 비어 있습니다. Copilot 인증과 모델 응답을 확인해 주세요.")
    try:
        result = json.loads(cleaned)
    except json.JSONDecodeError as exc:
        preview = " ".join(cleaned.split())[:160]
        raise AiRuntimeError(
            f"{stage} AI 응답이 JSON 형식이 아닙니다. 응답 일부: {preview}"
        ) from exc
    if not isinstance(result, dict):
        raise AiRuntimeError(f"{stage} AI 응답은 JSON 객체여야 합니다.")
    return result


async def _copilot_prompt(prompt: str) -> str:
    try:
        from copilot import CopilotClient
    except ImportError as exc:
        raise AiRuntimeError("github-copilot-sdk가 설치되지 않았습니다.") from exc

    async with CopilotClient() as client:
        async with await client.create_session(
            model=os.getenv("COPILOT_MODEL", "gpt-5"),
            system_message={
                "mode": "replace",
                "content": (
                    "You are a Korean agricultural shipment decision assistant. "
                    "Return only valid JSON with no markdown."
                ),
            },
        ) as session:
            response = await session.send_and_wait(prompt)
            return _text_from_response(response)


async def _framework_plan(prompt: str) -> dict[str, Any]:
    try:
        from agent_framework import Agent
        from agent_framework.exceptions import ChatClientException
        from agent_framework.openai import OpenAIChatClient
    except ImportError as exc:
        raise AiRuntimeError("agent-framework가 설치되지 않았습니다.") from exc

    model = os.getenv("OPENAI_CHAT_MODEL") or os.getenv("OPENAI_MODEL") or os.getenv(
        "COPILOT_MODEL", "gpt-5"
    )
    try:
        async with Agent(
            client=OpenAIChatClient(model=model),
            instructions=(
                "You are the shipment planner stage. Return only valid JSON with "
                "summary, recommendedAction, recommendedChannel, reasons, confidence, "
                "warnings, and requiresApproval."
            ),
        ) as agent:
            result = await agent.run(prompt)
    except ChatClientException as exc:
        raise AiRuntimeError(
            "출하 전략 AI 인증에 실패했습니다. OPENAI_API_KEY가 유효한지 확인해 주세요."
        ) from exc
    return _parse_json_response(_text_from_response(result), "출하 전략 생성")


def analyze_with_ai(payload: dict[str, Any], crop_risk: dict[str, Any]) -> dict[str, Any]:
    risk_prompt = json.dumps(
        {
            "task": "Analyze crop risk. Return JSON with riskLevel, observations, warnings.",
            "request": payload,
        },
        ensure_ascii=False,
    )
    live_crop_risk = _parse_json_response(
        asyncio.run(_copilot_prompt(risk_prompt)),
        "작물 위험 분석",
    )
    plan_prompt = json.dumps(
        {"request": payload, "cropRisk": live_crop_risk},
        ensure_ascii=False,
    )
    result = asyncio.run(_framework_plan(plan_prompt))
    required = ("summary", "recommendedAction", "recommendedChannel", "reasons", "confidence", "warnings")
    if any(field not in result for field in required):
        raise AiRuntimeError("AI 결과에 필수 필드가 없습니다.")
    result["runtime"] = "copilot-sdk-agent-framework"
    result["requiresApproval"] = True
    return result
