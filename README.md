# 청도 바이브코딩 해커톤

청도 바이브코딩 해커톤 참가자를 위한 안내입니다. 행사 개요는 [공식 행사 사이트](https://hackersground.kr/hackathon/)에서, 현장 공지와 문의는 [해커그라운드 디스코드](https://discord.gg/TxFRn4YDSJ)에서 확인해 주세요.

## 행사 정보

- 일시: **2026년 11월 5일(목) 09:00~18:00**
- 장소: **청도신화랑풍류마을**
- 참가 형태: 개인 또는 **팀 리더 포함 최대 4인**. 팀은 현장에서 확정할 수 있습니다.
- 참가비: 무료
- 주최: 해커그라운드 / 주관: 대구한의대학교 / 후원: Microsoft, 청도군
- 총 상금: 500만 원
- 진행 방식: 웹 앱 개발
- 사용 언어: 자유
- 배포 플랫폼: Azure
- 사용 도구: [VS Code + GitHub Copilot](https://marketplace.visualstudio.com/items?itemName=GitHub.copilot-chat), [GitHub Copilot CLI](https://docs.github.com/copilot/how-tos/copilot-cli), [GitHub Copilot app](https://docs.github.com/copilot/how-tos/github-copilot-app). 타사 AI 코딩 도구는 사용할 수 없습니다.
- 도전 과제: 행사 당일 공개되는 주제와 안내에 따라 앱을 개발합니다. 아이디어 구체화에 활용할 [청도 사회문제 브리핑](./references/cheongdo-social-issues.md)을 참고해 주세요.


## 시간 계획

모든 시각은 한국 시각(KST) 기준입니다. 현장 변경 사항은 해커그라운드 디스코드 공지를 확인해 주세요.

| 시각 | 내용 |
|---|---|
| 09:00 | 등록 · 현장 체크인 |
| 10:00 | 개회 및 주제 공개 |
| 11:00 | 아이디어 구체화 · 팀 빌딩 · 개발환경세팅 |
| 12:00 | 중식 |
| 13:00 | 집중 개발 Ⅰ |
| 15:00 | 1차 제출 · 자동 검수 |
| 15:20 | 집중 개발 Ⅱ |
| **16:30** | **최종 제출 마감 · AI 사전 검수 및 최종 심사** |
| 17:00 | 시상식 |
| 17:30 | 폐회 · 사후 안내 |
| 18:00 | 석식 및 이동 |

11월 6일(금)에는 희망자를 대상으로 청도 문화탐방이 진행되며, 16시쯤 종료됩니다.

## 사전 준비 및 개발 도구 비용

노트북과 충전기, GitHub 계정, 사용할 개발 도구와 Azure 배포 환경을 준비해 주세요. 기초 학습 안내는 신청한 이메일을 확인해 주세요.

개발 도구는 참가자가 각자 계정으로 사용·결제한 뒤 증빙을 제출하는 방식입니다. **사용량 캡처와 실제 결제 영수증을 모두 보관**해 주세요.

| 항목 | 정산 기준 |
|---|---|
| GitHub Copilot | 개인당 최대 30,000원 |
| Azure Cloud | 실제 프로젝트 팀당 최대 50,000원 |
| 사용량 캡처 제출 | 2026년 11월 5일 17:00 ~ 11월 6일 12:00 |
| 실제 결제 영수증 제출 | 2026년 12월 1일 ~ 12월 5일 |

비용 정산 절차와 개인 초대 링크는 **이메일로 별도 안내**합니다. 메일에 안내된 **개발 도구 비용 증빙 제출 양식**에서 제출하고, 공개 GitHub 이슈로 제출하지 마세요. 개인 링크를 공유하지 말고, 증빙에서 무관한 결제 정보는 가려 주세요. 금액은 원화로 입력하며, 파일은 PDF·PNG·JPG 형식으로 파일당 8MB, 최대 3개까지 제출할 수 있습니다.

Azure 증빙은 모든 팀원이 각자의 초대 링크로 팀 구성을 확인한 뒤 팀 단위로 제출합니다. 정산 권고액은 **실제 결제액, 사용량 캡처액, 항목별 상한 중 가장 낮은 금액**이며, 운영자 검토 후 승인됩니다. 증빙 제출과 앱 심사 제출은 별도 절차입니다.

## 참가 순서

### 1. 현장 체크인

행사장에 도착하면 **먼저 운영진에게 현장 체크인**을 받아 주세요. 체크인 위치와 행사장 이용 정보는 현장에서 안내받을 수 있습니다.

### 2. 심사봇에 GitHub 핸들 직접 등록

체크인을 마친 참가자는 행사 중, 팀·결과 제출을 준비할 때 [GitHub 핸들 등록 양식](https://github.com/hackersground-kr/hackathon-cheongdo/issues/new?template=01-github-handle.yml)을 **직접 제출**해 주세요. 운영진이 대신 입력하지 않습니다. 현장 체크인만으로 심사봇 등록이 완료되지는 않으며, 앱 결과를 제출하기 전에 팀원 모두 핸들을 등록해야 합니다.

핸들은 이메일 주소가 아닌 GitHub ID를 `@` 없이 입력하고, 참가 신청 정보와 동일한 계정을 사용해 주세요. 현재 등록 양식의 GitHub Copilot 라이선스 확인 항목도 확인해 주세요.

### 3. 팀 등록

결과 제출 전에 팀을 등록해 주세요. 팀 리더가 본인의 GitHub 계정으로 [팀 등록 양식](https://github.com/hackersground-kr/hackathon-cheongdo/issues/new?template=02-team-building.yml)을 제출해야 합니다. **팀 리더를 포함해 1~4명**으로 구성하며, 팀원은 GitHub 핸들로 한 줄에 한 명씩 입력합니다. 팀 리더는 팀원 목록에 다시 입력하지 마세요. 혼자 참가하는 경우 팀원 항목은 비워 둘 수 있습니다.

- 먼저 참가자 핸들이 등록되어 있어야 합니다.
- 한 참가자는 하나의 팀에만 소속될 수 있습니다.
- 팀 이름은 다른 팀과 중복될 수 없습니다(대소문자 구분 없음).
- 팀 등록 마감은 따로 없지만, 앱 결과를 제출하기 전에 등록해야 합니다.
- 같은 팀 리더가 양식을 다시 제출하면 새 팀이 생기는 대신 기존 팀 정보가 갱신됩니다.

### 4. 앱 개발 및 배포

웹 앱을 개발해 Azure에 배포해 주세요. 평가 기준에서는 **GitHub Copilot SDK와 Microsoft Agent Framework 두 기술을 필수 기술로 명시**하고, 핵심 기능에 얼마나 효과적으로 활용했는지 평가합니다. 전체 항목과 가중치는 [해커톤 평가 기준](./judgement/judgement-criteria.md)을 확인해 주세요.

### 5. 결과 제출

팀 등록 후 팀 리더가 [결과 제출 양식](https://github.com/hackersground-kr/hackathon-cheongdo/issues/new?template=03-result-submission.yml)을 작성해 주세요.

- 제출 마감: **2026년 11월 5일 16시 30분 (한국 시각)**
- 팀당 최대 2회 제출할 수 있으며, **가장 나중에 제출한 내용**을 기준으로 평가합니다.
- 팀 리더 본인의 **공개 GitHub 저장소**를 제출해야 합니다.
- 저장소 루트에 `PRD.md`와 `TRD.md`를 포함하고, 심사할 커밋 해시와 앱 배포 URL을 제출해 주세요.
- 앱은 Azure에 배포해야 하며, `*.azurewebsites.net`, `*.azurecontainerapps.io`, `*.azurestaticapps.net` 등의 Azure 기본 도메인 URL을 사용해야 합니다. 커스텀 도메인은 허용되지 않습니다.
- 심사 에이전트가 로그인이나 별도 자격 증명 없이 앱의 핵심 기능을 사용할 수 있어야 합니다. 심사에 필요한 핵심 기능을 공개적으로 접근 가능하도록 준비해 주세요.
- 로그인·초대·별도 권한 등의 제한으로 평가할 수 없으면 모든 평가 항목에 최저점(1점)이 적용됩니다. 공개 게스트·데모 경로를 제공할 수 있습니다.
- 제출 이슈는 공개되므로 비밀번호, 토큰 등 자격 증명을 입력하지 마세요.
- 심사는 AI 에이전트가 저장소의 `PRD.md`, `TRD.md`와 앱의 실제 동작을 중심으로 진행합니다. `README.md`는 보조 자료입니다.

등록·제출 이슈는 자동 처리 후 닫힐 수 있습니다. 닫힘 여부만으로 성공을 판단하지 말고, **이슈 댓글과 `complete`·`invalid` 라벨**을 확인해 주세요. 오류가 발생하면 댓글의 안내에 따라 조치하고, 해결되지 않으면 운영진에게 문의해 주세요.

## 청도팜 사진 분석 실행

사진 촬영·미리보기와 직접 입력은 별도 인증 없이 사용할 수 있습니다. **실제 사진 분석**은 Copilot SDK 런타임, Copilot 인증 및 이미지 입력을 지원하는 모델 설정이 필요하며 기본적으로 비활성화되어 있습니다. PowerShell에서 다음을 준비한 뒤 서버를 실행합니다.

```powershell
python -m pip install -r requirements.txt
python -m copilot download-runtime
$env:COPILOT_SKIP_CLI_DOWNLOAD = "1"
$env:PHOTO_ANALYSIS_ENABLED = "true"
$env:COPILOT_VISION_MODEL = "이미지 입력을 지원하고 사용 권한이 있는 모델명"
python app.py
```

Copilot 인증은 [Copilot SDK 백엔드 설정 문서](https://docs.github.com/en/copilot/how-tos/copilot-sdk/setup/backend-services)와 배포 환경의 비밀 설정을 참고하세요. 사진은 사용자의 동의를 받은 후 모델 서비스로 전송됩니다. 앱은 분석 종료 시 SDK 세션 삭제를 시도하지만 비정상 종료나 삭제 실패에 대비한 운영상 정리와 서비스 측 보관 정책 확인이 필요합니다.

## Azure Container Apps 배포 준비

현재 구성은 공개 웹 서버, Copilot SDK 작물·사진 분석, Microsoft Agent Framework와 Azure OpenAI 출하 전략을 연결합니다. `AI_RUNTIME=live`에서도 **시장 데이터는 데모 데이터**이며 실시간 시세가 아닙니다. 실제 AI 호출은 아래 인증과 모델 설정을 완료한 뒤 별도 검증해야 합니다. `/health`는 서버 생존 확인만 하므로 AI 인증 성공을 의미하지 않습니다.

1. Azure 구독에 Container Apps 환경, Azure Container Registry(ACR), Azure OpenAI 리소스와 Chat Completions를 지원하는 모델 배포를 준비합니다. Entra 인증을 사용할 수 있는 Azure OpenAI 엔드포인트와 **모델 이름이 아닌 배포 이름**을 확인합니다. [Azure OpenAI Managed Identity 안내](https://learn.microsoft.com/en-us/azure/ai-services/openai/how-to/managed-identity)를 참고하세요.
2. Azure CLI 로그인 후 저장소 루트에서 ACR 클라우드 빌드를 실행합니다. Docker가 로컬에 없어도 사용할 수 있지만 빌드 컨텍스트가 ACR에 전송됩니다. 아래 이름은 실제 리소스 이름으로 바꾸세요.

   ```powershell
   az login
   az account set --subscription "<구독 ID>"
   az acr build --registry "<ACR 이름>" --image "cheongdopam:v1" .
   ```

   이미지 빌드 중 Copilot SDK 런타임을 다운로드하므로 빌드 환경의 외부 네트워크 접근이 필요합니다. 런타임 다운로드나 이미지 빌드 실패는 배포 성공이 아닙니다.
3. Azure Portal에서 해당 ACR 이미지를 사용하는 Container App을 생성하고 외부 ingress를 켜서 대상 포트를 `8080`으로 지정합니다. ACR 이미지 가져오기 권한도 설정합니다. 제출에는 앱의 기본 `*.azurecontainerapps.io` 주소를 사용합니다.
4. Container App의 시스템 할당 Managed Identity를 활성화합니다. Azure OpenAI 리소스의 액세스 제어(IAM)에서 이 ID에 **Cognitive Services OpenAI User** 역할을 부여하고 권한 적용을 기다립니다. 앱에서 Azure OpenAI API 키는 사용하지 않습니다.
5. Copilot SDK 서버 인증을 준비합니다. 서버 사용에 적합한 유효한 GitHub Copilot 인증 수단, 라이선스·정책, 텍스트 및 이미지 모델 접근 권한을 확인하세요. Portal의 Container App **Secrets**에 토큰을 안전하게 등록하고 환경 변수 `COPILOT_GITHUB_TOKEN`을 해당 비밀에 연결합니다. 토큰은 저장소, 이미지, 제출 이슈, 채팅 또는 로그에 넣지 마세요. 자세한 내용은 [Copilot SDK 인증](https://docs.github.com/en/copilot/how-tos/copilot-sdk/auth/authenticate)을 참고하세요. [GitHub App 설치 토큰](https://docs.github.com/en/copilot/how-tos/copilot-sdk/auth/server-to-server-tokens)은 조직 정책과 SDK 명시적 토큰 전달이 필요하며 1시간 후 만료됩니다. 이 저장소에는 해당 인증 방식의 명시적 전달 및 자동 발급·갱신이 구현되어 있지 않습니다.
6. Container App 환경 변수를 설정하고 새 리비전을 적용합니다.

   | 이름 | 값 |
   |---|---|
   | `AI_RUNTIME` | `live` |
   | `PHOTO_ANALYSIS_ENABLED` | `true` |
   | `AZURE_OPENAI_ENDPOINT` | Azure OpenAI 리소스 엔드포인트 |
   | `AZURE_OPENAI_MODEL` | Azure OpenAI 모델 배포 이름 |
   | `COPILOT_GITHUB_TOKEN` | 위에서 등록한 Container App 비밀 참조 |
   | `COPILOT_MODEL` | 접근 가능한 텍스트 모델. 생략 시 `gpt-5` |
   | `COPILOT_VISION_MODEL` | 이미지 입력을 지원하고 접근 가능한 모델. 생략 시 `gpt-5` |

   필요할 때 `AZURE_OPENAI_API_VERSION`을 지정합니다. `PORT=8080`, `COPILOT_SKIP_CLI_DOWNLOAD=1`은 이미지에 설정되어 있습니다. 로컬 로그인 자격 증명과 Azure Managed Identity는 서로 다릅니다.
7. 공개 URL에서 화면과 `/health`를 확인한 후 실제 출하 분석에서 네 단계, 위험도·기준일·데모 데이터 경고를 확인하고 승인까지 진행합니다. 동의 후 라벨과 작물 사진을 각각 시험해 인식된 정보와 직접 수정이 가능한지 확인합니다. 사진에 없는 출하 수량·날짜는 추측하지 않는지 확인하세요. 실패 시 Container App 로그와 인증·모델 권한을 확인하며, 503 또는 502를 성공으로 간주하지 않습니다.

공개 엔드포인트는 누구나 모델 호출을 유발할 수 있으므로 행사 운영 전에 사용량·비용 한도, 요청 제한 및 이상 사용 모니터링을 별도로 준비하세요. 사진과 입력 내용은 모델 서비스에 전달되며, SDK 세션 삭제 실패나 비정상 종료에 대비한 데이터 보관 정책도 확인해야 합니다.

## 참가 등록 및 현황

- 참가자 핸들 등록, 팀 등록, 앱 결과 제출은 [양식 선택 페이지](https://github.com/hackersground-kr/hackathon-cheongdo/issues/new/choose)에서 진행합니다.
- 제출 결과와 심사 현황은 [리더보드](https://hackersground.kr/hackathons/cheongdo/leaderboard)에서 확인할 수 있습니다.
