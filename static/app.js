const form = document.querySelector("#analysis-form");
const analyzeButton = document.querySelector("#analyze-button");
const buttonLabel = analyzeButton.querySelector(".button-label");
const emptyState = document.querySelector("#empty-state");
const loadingState = document.querySelector("#loading-state");
const errorState = document.querySelector("#error-state");
const analysisResult = document.querySelector("#analysis-result");
const errorMessage = document.querySelector("#error-message");
const conditionInput = document.querySelector("#condition");
const lastRequest = { value: null };

class AnalysisRequestError extends Error {
  constructor(message, retryable) {
    super(message);
    this.retryable = retryable;
  }
}

const today = new Date();
document.querySelector("#today-date").textContent =
  `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`;

conditionInput.addEventListener("input", () => {
  document.querySelector("#condition-count").textContent = conditionInput.value.length;
  document.querySelector("#condition-error").textContent = "";
});

document.querySelector("#quantity").addEventListener("input", () => {
  document.querySelector("#quantity-error").textContent = "";
  document.querySelector("#quantity").removeAttribute("aria-invalid");
});
document.querySelector("#harvest-date").addEventListener("input", () => {
  document.querySelector("#date-error").textContent = "";
  document.querySelector("#harvest-date").removeAttribute("aria-invalid");
});
document.querySelector("#crop").addEventListener("change", (event) => {
  document.querySelector("#crop-error").textContent = "";
  const isCustomCrop = event.target.value === "other";
  document.querySelector("#custom-crop-field").hidden = !isCustomCrop;
  if (isCustomCrop) document.querySelector("#custom-crop").focus();
});
document.querySelector("#custom-crop").addEventListener("input", () => {
  document.querySelector("#crop-error").textContent = "";
  document.querySelector("#custom-crop").removeAttribute("aria-invalid");
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const request = getValidatedRequest();
  if (!request) return;
  lastRequest.value = request;
  analyze(request);
});

document.querySelector("#retry-button").addEventListener("click", () => {
  if (lastRequest.value) analyze(lastRequest.value);
});

document.querySelector("#approve-button").addEventListener("click", async () => {
  try {
    await approvePlan(document.querySelector("#recommended-action").textContent);
  } catch (error) {
    document.querySelector("#final-plan-status").textContent = error.message;
  }
});

document.querySelector("#edit-button").addEventListener("click", openEditForm);
document.querySelector("#final-edit").addEventListener("click", openEditForm);
document.querySelector("#cancel-edit").addEventListener("click", closeEditForm);
document.querySelector("#save-edit").addEventListener("click", async () => {
  const editedAction = document.querySelector("#edited-action").value.trim();
  if (!editedAction) {
    document.querySelector("#edited-action").setAttribute("aria-invalid", "true");
    document.querySelector("#edited-action").focus();
    return;
  }
  document.querySelector("#edited-action").removeAttribute("aria-invalid");
  try {
    await approvePlan(editedAction, "농가 상황에 맞게 수정한 계획이에요.");
  } catch (error) {
    document.querySelector("#final-plan-status").textContent = error.message;
  }
});

function getValidatedRequest() {
  clearValidation();
  const selectedCrop = document.querySelector("#crop").value;
  const cropInput = document.querySelector("#custom-crop");
  const crop = selectedCrop === "other" ? cropInput.value.trim() : selectedCrop.trim();
  const quantityInput = document.querySelector("#quantity");
  const harvestDateInput = document.querySelector("#harvest-date");
  const quantity = Number(quantityInput.value);
  const harvestDate = harvestDateInput.value;
  const condition = conditionInput.value.trim();
  let valid = true;

  if (!crop) {
    setFieldError("crop-error", selectedCrop === "other" ? "작물명을 입력해 주세요." : "작물명을 선택해 주세요.");
    if (selectedCrop === "other") cropInput.setAttribute("aria-invalid", "true");
    valid = false;
  }
  if (!Number.isInteger(quantity) || quantity <= 0 || quantity > 1000000) {
    setFieldError("quantity-error", "1kg 이상 1,000,000kg 이하의 정수로 입력해 주세요.");
    quantityInput.setAttribute("aria-invalid", "true");
    valid = false;
  }
  if (!harvestDate) {
    setFieldError("date-error", "출하 예정일을 입력해 주세요.");
    harvestDateInput.setAttribute("aria-invalid", "true");
    valid = false;
  } else if (Number.isNaN(Date.parse(`${harvestDate}T00:00:00`))) {
    setFieldError("date-error", "올바른 날짜를 입력해 주세요.");
    harvestDateInput.setAttribute("aria-invalid", "true");
    valid = false;
  }
  if (!condition) {
    setFieldError("condition-error", "작물 상태를 입력해 주세요.");
    conditionInput.setAttribute("aria-invalid", "true");
    valid = false;
  }

  if (!valid) {
    form.querySelector('[aria-invalid="true"]')?.focus();
    if (selectedCrop === "other" && !crop) cropInput.focus();
    return null;
  }
  return { crop, quantity, harvestDate, condition };
}

function clearValidation() {
  for (const id of ["crop-error", "quantity-error", "date-error"]) {
    document.getElementById(id).textContent = "";
  }
  for (const id of ["quantity", "harvest-date", "condition"]) {
    document.getElementById(id).removeAttribute("aria-invalid");
  }
  document.querySelector("#custom-crop").removeAttribute("aria-invalid");
}

function setFieldError(id, message) {
  document.getElementById(id).textContent = message;
}

async function analyze(request) {
  setView("loading");
  analyzeButton.disabled = true;
  buttonLabel.textContent = "분석 중이에요...";
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 60000);

  try {
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(request),
      signal: controller.signal,
    });

    if (!response.ok) {
      const apiError = await readApiError(response);
      throw new AnalysisRequestError(
        apiError.message || `분석 요청에 실패했어요. (오류 코드 ${response.status})`,
        apiError.retryable ?? response.status >= 500,
      );
    }

    let result;
    try {
      result = await response.json();
    } catch {
      throw new Error("분석 서버가 올바른 결과 형식으로 응답하지 않았어요.");
    }
    validateResult(result);
    renderResult(result);
    setView("result");
  } catch (error) {
    errorMessage.textContent = error instanceof Error && error.name === "AbortError"
      ? "분석 시간이 길어져 요청을 중단했어요. 잠시 후 다시 시도해 주세요."
      : error instanceof Error
        ? error.message
        : "분석 중 문제가 발생했어요. 잠시 후 다시 시도해 주세요.";
    const retryable = !(error instanceof AnalysisRequestError) || error.retryable;
    document.querySelector("#retry-button").hidden = !retryable;
    document.querySelector("#error-footnote").textContent = retryable
      ? "입력한 내용은 그대로 유지돼요."
      : "입력한 내용을 확인하고 다시 분석해 주세요.";
    setView("error");
  } finally {
    window.clearTimeout(timeoutId);
    analyzeButton.disabled = false;
    buttonLabel.textContent = "출하 전략 분석하기";
  }
}

async function readApiError(response) {
  try {
    const body = await response.json();
    return {
      message: typeof body.error === "string"
        ? body.error
        : typeof body.message === "string"
          ? body.message
          : "",
      retryable: typeof body.retryable === "boolean" ? body.retryable : undefined,
    };
  } catch {
    return { message: "", retryable: undefined };
  }
}

function validateResult(result) {
  const isString = (value) => typeof value === "string" && value.trim().length > 0;
  const isDate = (value) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  };
  const validRisk = ["low", "medium", "high"].includes(result?.riskLevel);
  const validConfidence = ["low", "medium", "high"].includes(result?.confidence?.level);
  const validReasons =
    Array.isArray(result?.reasons) && result.reasons.length > 0 && result.reasons.every(isString);
  const validConfidenceReasons =
    Array.isArray(result?.confidence?.reasons) &&
    result.confidence.reasons.length > 0 &&
    result.confidence.reasons.every(isString);
  const validWarnings = Array.isArray(result?.warnings) && result.warnings.every(isString);

  if (
    !isString(result?.summary) ||
    !validRisk ||
    !isString(result?.recommendedAction) ||
    !isString(result?.recommendedChannel) ||
    !validReasons ||
    !validConfidence ||
    !validConfidenceReasons ||
    !isDate(result?.dataDate) ||
    !validWarnings ||
    typeof result?.requiresApproval !== "boolean"
  ) {
    throw new Error("분석 결과의 필수 정보가 누락되거나 형식이 올바르지 않아요. 다시 시도해 주세요.");
  }
}

function renderResult(result) {
  const riskLabels = { low: "작물 위험도 낮음", medium: "작물 위험도 보통", high: "작물 위험도 높음" };
  const confidenceLabels = { low: "참고해서 살펴봐 주세요", medium: "보통", high: "높음" };
  const riskBadge = document.querySelector("#risk-badge");
  riskBadge.textContent = riskLabels[result.riskLevel];
  riskBadge.dataset.risk = result.riskLevel;
  document.querySelector("#recommendation-title").textContent = result.recommendedAction;
  document.querySelector("#recommendation-summary").textContent = result.summary;
  document.querySelector("#recommended-action").textContent = result.recommendedAction;
  document.querySelector("#recommended-channel").textContent = result.recommendedChannel;
  document.querySelector("#result-date").textContent = formatDate(result.dataDate);
  document.querySelector("#confidence-level").textContent = confidenceLabels[result.confidence.level];
  document.querySelector("#reason-count").textContent = `${result.reasons.length}가지`;
  document.querySelector("#reasons-list").replaceChildren(...result.reasons.map(createListItem));
  document.querySelector("#confidence-reasons").replaceChildren(
    ...result.confidence.reasons.map(createListItem),
  );
  const warningsBox = document.querySelector("#warnings-box");
  warningsBox.hidden = result.warnings.length === 0;
  document.querySelector("#warnings-list").replaceChildren(...result.warnings.map(createListItem));
  document.querySelector("#data-source-text").textContent =
    `분석 데이터 기준일 ${formatDate(result.dataDate)} · 실시간 시세가 아닐 수 있어요.`;
  document.querySelector("#runtime-label").lastChild.textContent =
    result.runtime === "demo" ? " 데모 런타임" : " 분석 결과";
  document.querySelector("#demo-label").hidden = result.runtime !== "demo";
  document.querySelectorAll("#execution-timeline li").forEach((step) => {
    step.classList.add("completed");
  });

  document.querySelector("#approval-section").hidden = !result.requiresApproval;
  document.querySelector("#final-plan").hidden = true;
  document.querySelector("#edit-form").hidden = true;
}

function createListItem(text) {
  const item = document.createElement("li");
  item.textContent = text;
  return item;
}

function formatDate(value) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

function setView(view) {
  emptyState.hidden = view !== "empty";
  loadingState.hidden = view !== "loading";
  errorState.hidden = view !== "error";
  analysisResult.hidden = view !== "result";
}

function openEditForm() {
  const editForm = document.querySelector("#edit-form");
  const currentPlan = document.querySelector("#final-plan-text").textContent ||
    document.querySelector("#recommended-action").textContent;
  document.querySelector("#edited-action").value = currentPlan;
  editForm.hidden = false;
  document.querySelector("#approval-section").hidden = false;
  document.querySelector("#final-plan").hidden = true;
  document.querySelector("#edited-action").focus();
}

function closeEditForm() {
  document.querySelector("#edit-form").hidden = true;
}

async function approvePlan(action, status = "추천을 검토하고 승인했어요.") {
  const response = await fetch("/api/plan", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      requiresApproval: true,
      summary: document.querySelector("#recommendation-summary").textContent,
      recommendedAction: action,
      recommendedChannel: document.querySelector("#recommended-channel").textContent,
    }),
  });
  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error || "출하 계획 승인에 실패했어요.");
  }
  showFinalPlan(result.plan.action, status);
}

function showFinalPlan(action, status) {
  document.querySelector("#final-plan-text").textContent = action;
  document.querySelector("#final-plan-status").textContent = status;
  document.querySelector("#approval-section").hidden = true;
  document.querySelector("#edit-form").hidden = true;
  document.querySelector("#final-plan").hidden = false;
  document.querySelector("#final-plan").scrollIntoView({ block: "nearest", behavior: "smooth" });
}

setView("empty");
