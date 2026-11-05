import json
import logging
import os
from datetime import date
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from ai_runtime import AiRuntimeError, analyze_with_ai

ROOT = Path(__file__).parent
STATIC = ROOT / "static"
logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
LOGGER = logging.getLogger("cheongdo-farm")


def get_crop_risk_data(crop: str, condition: str) -> dict[str, Any]:
    condition_text = condition.lower()
    risk_level = "high" if any(word in condition_text for word in ("병", "곰팡이", "급격")) else "medium"
    return {
        "riskLevel": risk_level,
        "observations": [f"{crop} 상태 입력: {condition}"],
        "warnings": ["현장 전문가의 확인이 필요한 참고용 분석입니다."],
    }


def get_market_snapshot(crop: str, harvest_date: str, quantity: int) -> dict[str, Any]:
    return {
        "crop": crop,
        "harvestDate": harvest_date,
        "quantity": quantity,
        "recommendedChannel": "지역 직거래 및 로컬푸드 매장",
        "dataDate": date.today().isoformat(),
        "isDemoData": True,
        "source": "청도팜 데모 시장 데이터",
    }


class CropRiskAgent:
    def run(self, payload: dict[str, Any]) -> dict[str, Any]:
        return get_crop_risk_data(payload["crop"], payload["condition"])


class ShipmentPlannerAgent:
    def run(self, payload: dict[str, Any], crop_risk: dict[str, Any]) -> dict[str, Any]:
        market = get_market_snapshot(payload["crop"], payload["harvestDate"], payload["quantity"])
        early_share = 60 if crop_risk["riskLevel"] == "high" else 40
        return {
            "summary": f"전체 물량의 {early_share}%를 우선 출하하는 전략을 권장합니다.",
            "riskLevel": crop_risk["riskLevel"],
            "recommendedAction": f"전체 물량의 {early_share}%를 우선 출하",
            "recommendedChannel": market["recommendedChannel"],
            "reasons": [
                "입력된 작물 상태와 출하 예정일",
                "수량과 청도 지역 판매 채널 데모 데이터",
            ],
            "confidence": {
                "level": "medium",
                "reasons": [
                    "실시간 가격 데이터가 아닌 데모 데이터 사용",
                    "농가의 상세 품질 정보가 제한적임",
                ],
            },
            "dataDate": market["dataDate"],
            "warnings": crop_risk["warnings"]
            + ["실시간 도매시장 가격이 아닌 데모 데이터입니다."],
            "requiresApproval": True,
            "runtime": "demo",
        }


class AgentOrchestrator:
    def analyze(self, payload: dict[str, Any]) -> dict[str, Any]:
        LOGGER.info("analysis started crop=%s", payload["crop"])
        risk = CropRiskAgent().run(payload)
        if os.getenv("AI_RUNTIME", "demo").lower() == "live":
            try:
                result = analyze_with_ai(payload, risk)
            except AiRuntimeError:
                LOGGER.exception("live AI runtime failed")
                raise
        else:
            result = ShipmentPlannerAgent().run(payload, risk)
        result["steps"] = [
            {"id": "validating", "label": "입력 검증", "status": "completed"},
            {"id": "crop-risk", "label": "작물 위험 분석", "status": "completed"},
            {"id": "market-snapshot", "label": "시장 데이터 조회", "status": "completed"},
            {"id": "shipment-plan", "label": "출하 전략 생성", "status": "completed"},
        ]
        LOGGER.info("analysis completed risk=%s", result["riskLevel"])
        return result


def validate_payload(payload: Any) -> dict[str, Any]:
    if not isinstance(payload, dict):
        raise ValueError("요청 본문은 JSON 객체여야 합니다.")
    required = ("crop", "quantity", "harvestDate", "condition")
    missing = [field for field in required if not str(payload.get(field, "")).strip()]
    if missing:
        raise ValueError(f"필수 입력이 누락되었습니다: {', '.join(missing)}")
    try:
        quantity = int(payload["quantity"])
    except (TypeError, ValueError) as exc:
        raise ValueError("수량은 숫자여야 합니다.") from exc
    if quantity <= 0:
        raise ValueError("수량은 1 이상이어야 합니다.")
    harvest_date = str(payload["harvestDate"]).strip()
    try:
        date.fromisoformat(harvest_date)
    except ValueError as exc:
        raise ValueError("출하 예정일은 YYYY-MM-DD 형식이어야 합니다.") from exc
    return {
        "crop": str(payload["crop"]).strip()[:80],
        "quantity": quantity,
        "harvestDate": harvest_date,
        "condition": str(payload["condition"]).strip()[:500],
    }


def create_approved_plan(payload: Any) -> dict[str, Any]:
    if not isinstance(payload, dict) or payload.get("requiresApproval") is not True:
        raise ValueError("승인 가능한 분석 결과가 아닙니다.")
    required = ("summary", "recommendedAction", "recommendedChannel")
    if any(not str(payload.get(field, "")).strip() for field in required):
        raise ValueError("승인할 출하 계획 정보가 부족합니다.")
    return {
        "status": "approved",
        "approvedAt": date.today().isoformat(),
        "plan": {
            "summary": str(payload.get("summary", "")),
            "action": str(payload.get("recommendedAction", "")),
            "channel": str(payload.get("recommendedChannel", "")),
        },
        "notice": "출하 계획만 승인되었으며 실제 주문이나 출하는 실행되지 않았습니다.",
    }


class Handler(BaseHTTPRequestHandler):
    def _send_json(self, status: int, body: dict[str, Any]) -> None:
        encoded = json.dumps(body, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(encoded)

    def do_GET(self) -> None:
        path = urlparse(self.path).path
        if path == "/health":
            self._send_json(HTTPStatus.OK, {"status": "ok"})
            return
        if path == "/api/demo-data":
            self._send_json(
                HTTPStatus.OK,
                {
                    "crops": ["복숭아", "청도반시"],
                    "marketDataDate": date.today().isoformat(),
                    "source": "청도팜 데모 시장 데이터",
                    "isDemoData": True,
                },
            )
            return
        if path in ("/", "/index.html"):
            content = (STATIC / "index.html").read_bytes()
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(content)))
            self.end_headers()
            self.wfile.write(content)
            return
        self._send_json(HTTPStatus.NOT_FOUND, {"error": "페이지를 찾을 수 없습니다."})

    def do_POST(self) -> None:
        path = urlparse(self.path).path
        if path not in ("/api/analyze", "/api/plan"):
            self._send_json(HTTPStatus.NOT_FOUND, {"error": "API를 찾을 수 없습니다."})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            body = json.loads(self.rfile.read(length))
            if path == "/api/analyze":
                payload = validate_payload(body)
                result = AgentOrchestrator().analyze(payload)
            else:
                result = create_approved_plan(body)
        except (ValueError, json.JSONDecodeError) as exc:
            self._send_json(HTTPStatus.BAD_REQUEST, {"error": str(exc), "retryable": False})
            return
        except Exception:
            LOGGER.exception("analysis failed")
            self._send_json(
                HTTPStatus.INTERNAL_SERVER_ERROR,
                {"error": "분석 중 오류가 발생했습니다. 다시 시도해 주세요.", "retryable": True},
            )
            return
        self._send_json(HTTPStatus.OK, result)

    def log_message(self, format: str, *args: Any) -> None:
        LOGGER.info("%s - %s", self.address_string(), format % args)


def main() -> None:
    port = int(os.getenv("PORT", "8080"))
    server = ThreadingHTTPServer(("0.0.0.0", port), Handler)
    LOGGER.info("server listening on port %s", port)
    server.serve_forever()


if __name__ == "__main__":
    main()
