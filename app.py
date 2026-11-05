import json
import logging
import os
from datetime import date
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import urlparse


ROOT = Path(__file__).parent
STATIC = ROOT / "static"
STATIC_ASSETS = {
    "app.js": "text/javascript; charset=utf-8",
    "styles.css": "text/css; charset=utf-8",
}
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
        result = ShipmentPlannerAgent().run(payload, risk)
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
    return {
        "crop": str(payload["crop"]).strip()[:80],
        "quantity": quantity,
        "harvestDate": str(payload["harvestDate"]).strip()[:20],
        "condition": str(payload["condition"]).strip()[:500],
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
        if path in ("/", "/index.html"):
            content = (STATIC / "index.html").read_bytes()
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(content)))
            self.end_headers()
            self.wfile.write(content)
            return
        asset_name = path.lstrip("/")
        content_type = STATIC_ASSETS.get(asset_name)
        if content_type:
            content = (STATIC / asset_name).read_bytes()
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(content)))
            self.send_header("Cache-Control", "no-cache")
            self.end_headers()
            self.wfile.write(content)
            return
        self._send_json(HTTPStatus.NOT_FOUND, {"error": "페이지를 찾을 수 없습니다."})

    def do_POST(self) -> None:
        if urlparse(self.path).path != "/api/analyze":
            self._send_json(HTTPStatus.NOT_FOUND, {"error": "API를 찾을 수 없습니다."})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            payload = validate_payload(json.loads(self.rfile.read(length)))
            result = AgentOrchestrator().analyze(payload)
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
