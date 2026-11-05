# TRD: 청도팜 세일즈 코파일럿

## 0. 확정 범위

MVP는 `POST /api/analyze` 하나의 완료된 사용자 흐름을 제공한다. MVP에서는 두 에이전트만 실행하고, 시장 분석은 `ShipmentPlannerAgent`가 도구를 통해 수행한다. MVP 완료 후 도구와 결과 계약을 유지한 채 `MarketAgent`와 `ValidationAgent`를 독립 분리한다.

## 0.1 현재 구현 상태

- `app.py`와 `static/index.html`에 로그인 없는 웹 UI, 분석 API, 입력 검증, 결과·승인 흐름, 데모 에이전트가 구현되어 있다.
- 현재 서버는 외부 AI 자격 증명 없이 E2E를 검증할 수 있는 `runtime: demo` 모드로 동작한다.
- `AI_RUNTIME=live`로 실행하면 `ai_runtime.py`가 Copilot SDK 세션과 Agent Framework `Agent.run`을 사용한다. 라이브 모드는 패키지와 모델 인증이 준비된 환경에서만 활성화한다.
- 의존성은 `requirements.txt`에 고정했으며, 현재 검증 환경에서는 패키지 설치가 완료되지 않아 라이브 모드는 실행 검증 전이다.
- 데모 모드는 실제 AI 연동을 대체한 것으로 표시하지 않으며, 외부 데이터가 아닌 데모 데이터임을 UI에 표시한다.

## 1. 기술 목표

- 공개 Azure URL에서 로그인 없이 핵심 기능 제공
- Copilot SDK와 Microsoft Agent Framework를 분석 흐름에 직접 사용
- AI 응답을 검증 가능한 구조화 데이터로 반환
- 프론트엔드와 백엔드의 책임을 분리

## 2. 시스템 구성

```text
반응형 웹 UI
    ↓
분석 API
    ↓
Agent Orchestrator
    ├─ CropRiskAgent: 작물 상태·위험 분석
    └─ ShipmentPlannerAgent: 시장 도구 호출·출하 전략 통합
    ↓
구조화된 분석 결과
    ↓
결과·근거·승인 UI
```

- Frontend: 반응형 웹 애플리케이션
- Backend: 분석 API 및 응답 검증
- Model connection: GitHub Copilot SDK
- Agent orchestration: Microsoft Agent Framework
- Runtime switch: `AI_RUNTIME=demo|live`
- Hosting: Azure Container Apps
- Data: 데모 농업·시장 데이터

## 3. 주요 API

### `POST /api/analyze`

요청:

```json
{
  "crop": "복숭아",
  "quantity": 300,
  "harvestDate": "2026-11-10",
  "condition": "일부 과실의 착색이 빠름"
}
```

응답:

```json
{
  "summary": "일부 물량을 우선 출하하는 전략을 권장합니다.",
  "riskLevel": "medium",
  "recommendedAction": "전체 물량의 40%를 우선 출하",
  "recommendedChannel": "지역 직거래 및 로컬푸드 매장",
  "reasons": [
    "출하 예정일과 품질 변화 가능성",
    "입력된 수량과 판매 기간"
  ],
  "confidence": {
    "level": "medium",
    "reasons": [
      "실시간 가격 데이터가 아닌 데모 데이터 사용",
      "작물 상태 설명이 제한적임"
    ]
  },
  "dataDate": "2026-11-05",
  "warnings": [
    "실시간 도매시장 가격이 아닌 데모 데이터입니다."
  ],
  "requiresApproval": true,
  "runtime": "demo",
  "steps": [
    { "id": "validating", "label": "입력 검증", "status": "completed" },
    { "id": "crop-risk", "label": "작물 위험 분석", "status": "completed" },
    { "id": "market-snapshot", "label": "시장 데이터 조회", "status": "completed" },
    { "id": "shipment-plan", "label": "출하 전략 생성", "status": "completed" }
  ]
}
```

현재 API는 분석이 끝난 뒤 `steps`를 반환한다. UI는 요청 중에는 일반 대기 상태를 표시하고, 응답을 받은 뒤 실제 반환된 단계와 상태를 표시한다.

### `GET /api/demo-data`

대표 작물, 데모 시장 데이터 기준일, 데이터 출처를 반환한다. 실제 농가 개인정보나 실시간 가격을 반환하지 않는다.

### `POST /api/plan`

분석 결과의 `requiresApproval: true`를 확인한 뒤 사용자가 승인한 출하 계획을 반환한다. 실제 주문·출하 API를 호출하지 않는다.

요청에는 `requiresApproval`, `summary`, `recommendedAction`, `recommendedChannel`을 전달한다. 사용자가 수정한 경우 `recommendedAction`에 수정 내용을 전달하며, 응답의 `status`, `approvedAt`, `plan`, `notice`를 확인한 뒤 최종 계획을 표시한다.

## 4. 에이전트 설계

### 공통 실행 계층

#### Copilot SDK

- 서버에서 모델 세션을 생성한다.
- 에이전트 지침과 단계별 컨텍스트를 전달한다.
- 가능한 경우 스트리밍 이벤트를 UI에 전달한다.
- 최종 결과를 구조화된 출력으로 생성한다.
- API 키는 서버 환경변수에서만 읽는다.

#### Microsoft Agent Framework

분석 요청을 받고 ShipmentPlanner 단계의 실행과 입력 컨텍스트를 관리한다. `ai_runtime.py`의 `Agent.run` 결과가 누락되거나 JSON 검증에 실패하면 최종 추천을 생성하지 않고 오류 상태를 반환한다.

### MVP 에이전트

#### CropRiskAgent

작물명, 출하일, 상태 설명을 바탕으로 위험 수준·관찰 항목·주의사항을 반환한다.

도구:

```text
getCropRiskData(crop, condition)
```

#### ShipmentPlannerAgent

시장 데이터 도구를 호출한 뒤 CropRiskAgent의 결과와 함께 실행 가능한 출하 전략을 생성한다.

도구:

```text
getMarketSnapshot(crop, harvestDate, quantity)
```

반환 결과에는 추천 근거, 신뢰도 수준, 기준일, 경고를 반드시 포함한다.

### MVP 이후 분리 구조

```text
Orchestrator
  ├─ CropRiskAgent
  ├─ MarketAgent
  │    └─ getMarketSnapshot()
  ├─ ShipmentPlannerAgent
  └─ ValidationAgent
```

- `MarketAgent`: 시장 데이터 해석만 담당
- `ShipmentPlannerAgent`: 작물 위험과 시장 결과를 통합
- `ValidationAgent`: 근거·수치·주의사항·정책 제약을 검증

분리 전환은 MVP 기능이 안정화된 뒤 수행하며, UI와 최종 응답 스키마는 변경하지 않는다.

## 5. AI 출력 원칙

- 모든 에이전트 결과와 최종 AI 결과를 정의된 JSON 스키마로 검증한다.
- 근거와 주의사항을 결과의 별도 필드로 반환한다.
- 데이터가 없을 때 임의의 수치나 사실을 생성하지 않는다.
- 위험한 작업을 자동 실행하지 않는다.
- 사용자의 승인 전에는 출하 계획을 확정하지 않는다.
- 사용자 입력과 시스템 지침을 분리하여 프롬프트 인젝션 영향을 줄인다.

## 6. 오류 처리

- 필수 입력 누락: 필드별 검증 메시지 반환
- AI 응답 실패: 재시도 가능한 오류 반환
- 타임아웃: 요청 중단 및 재시도 안내
- 데이터 부족: `warnings`에 데이터 부족 사유 표시
- 스키마 검증 실패: 결과를 성공으로 표시하지 않고 오류 로그 기록
- 신뢰도는 통계적 확률로 표현하지 않고 데이터 품질과 입력 완성도에 따른 수준·근거로 표시
- 승인 요청은 서버에서 `requiresApproval: true`를 확인하고, 실제 외부 주문 작업은 수행하지 않는다.

## 7. Azure 배포 및 운영

- Azure Container Apps에 배포
- Copilot SDK 관련 비밀키는 Azure 환경변수로 관리
- `.env`와 비밀키를 저장소에 커밋하지 않음
- 공개 Azure 기본 도메인으로 제출
- 애플리케이션 오류와 분석 요청 실패를 로그로 확인
- 프론트엔드가 직접 비밀키를 호출하지 않도록 서버에서 AI 요청 처리

## 8. 보안 및 개인정보

- 로그인 없는 데모 모드로 핵심 기능 제공
- 농민 개인정보를 수집하거나 장기 저장하지 않음
- 사용자 입력을 HTML에 직접 삽입하지 않음
- API 키를 브라우저 응답에 포함하지 않음
- 공개 제출 이슈에 자격 증명을 작성하지 않음
