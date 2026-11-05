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
let lastResult = null;
let approvedPlan = null;
let planPending = false;

class AnalysisRequestError extends Error {
  constructor(message, retryable) {
    super(message);
    this.retryable = retryable;
  }
}

const today = new Date();
document.querySelector("#today-date").textContent =
  `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`;
const suggestedHarvestDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 5);
document.querySelector("#harvest-date").value = [
  suggestedHarvestDate.getFullYear(),
  String(suggestedHarvestDate.getMonth() + 1).padStart(2, "0"),
  String(suggestedHarvestDate.getDate()).padStart(2, "0"),
].join("-");

function showPage(moveFocus = false) {
  const page = window.location.hash === "#guide" ? "guide" : "analysis";
  document.querySelector("#analysis-view").hidden = page !== "analysis";
  document.querySelector("#guide-view").hidden = page !== "guide";
  document.querySelector("#current-page-label").textContent = page === "guide" ? "사용 가이드" : "출하 분석";
  document.title = `${page === "guide" ? "사용 가이드" : "출하 분석"} | 청도팜 세일즈 코파일럿`;
  document.querySelectorAll(".side-nav [data-page]").forEach((link) => {
    const active = link.dataset.page === page;
    link.classList.toggle("active", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  if (moveFocus) {
    window.scrollTo({ top: 0, behavior: "auto" });
    if (page === "guide") document.querySelector("#guide-title").focus({ preventScroll: true });
    else document.querySelector("#input-title").focus({ preventScroll: true });
  }
}

document.querySelector("#input-title").setAttribute("tabindex", "-1");
window.addEventListener("hashchange", () => showPage(true));
showPage();

const photoKind = document.querySelector("#photo-kind");
const photoStatus = document.querySelector("#photo-status");
const photoReview = document.querySelector("#photo-review");
const photoButton = document.querySelector("#photo-analyze");
const photoConsent = document.querySelector("#photo-consent");
const photoInputs = [document.querySelector("#photo-camera"), document.querySelector("#photo-file")];
const photoVersions = { crop: 0, quantity: 0, shipmentDate: 0, condition: 0 };
const photoTouched = { crop: false, quantity: false, shipmentDate: false, condition: false };
let selectedPhoto = null;
let photoUrl = null;
let photoController = null;
let photoRevision = 0;

function invalidatePreviousAnalysis() {
  photoRevision += 1;
  lastRequest.value = null;
  lastResult = null;
  approvedPlan = null;
  setView("empty");
}

for (const [selector, field, event] of [
  ["#crop", "crop", "change"],
  ["#custom-crop", "crop", "input"],
  ["#quantity", "quantity", "input"],
  ["#harvest-date", "shipmentDate", "input"],
  ["#condition", "condition", "input"],
]) {
  document.querySelector(selector).addEventListener(event, () => {
    photoVersions[field] += 1;
    photoTouched[field] = true;
  });
}

function resetPhoto() {
  if (photoUrl) URL.revokeObjectURL(photoUrl);
  photoUrl = null;
  selectedPhoto = null;
  photoInputs.forEach((input) => { input.value = ""; });
  document.querySelector("#photo-preview").removeAttribute("src");
  document.querySelector("#photo-preview-wrap").hidden = true;
  photoReview.hidden = true;
  photoStatus.textContent = "";
}

photoInputs.forEach((input) => input.addEventListener("change", () => {
  const file = input.files[0];
  if (!file) return;
  resetPhoto();
  if (!["image/jpeg", "image/png"].includes(file.type)) {
    photoStatus.textContent = "JPG 또는 PNG 사진을 선택해 주세요.";
    return;
  }
  if (file.size > 20 * 1024 * 1024) {
    photoStatus.textContent = "20MB 이하 사진을 선택해 주세요.";
    return;
  }
  selectedPhoto = file;
  photoUrl = URL.createObjectURL(file);
  document.querySelector("#photo-preview").src = photoUrl;
  document.querySelector("#photo-preview-wrap").hidden = false;
  if (photoConsent.checked) analyzePhoto();
  else photoStatus.textContent = "사진 전송에 동의하면 자동으로 내용을 읽어요.";
}));
document.querySelector("#photo-remove").addEventListener("click", resetPhoto);
photoKind.addEventListener("change", () => {
  photoReview.hidden = true;
  if (selectedPhoto && photoConsent.checked) analyzePhoto();
  else photoStatus.textContent = selectedPhoto ? "사진 전송에 동의하면 자동으로 내용을 읽어요." : "";
});
photoConsent.addEventListener("change", () => {
  if (!photoConsent.checked) {
    if (photoController) photoController.abort();
    photoStatus.textContent = "사진 전송 동의가 해제됐어요.";
  } else if (selectedPhoto && !photoButton.disabled) {
    analyzePhoto();
  }
});

async function preparePhoto(file) {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const scale = Math.min(1, 2200 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("이 기기에서 사진을 처리할 수 없어요.");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const data = canvas.toDataURL("image/jpeg", 0.85).split(",")[1];
    if (data.length > 4 * 1024 * 1024 * 4 / 3) throw new Error("사진이 너무 커요. 더 작은 사진을 선택해 주세요.");
    return data;
  } finally {
    URL.revokeObjectURL(url);
  }
}

photoButton.addEventListener("click", analyzePhoto);

function applyPhotoResult(result, versions) {
  invalidatePreviousAnalysis();
  const updated = [];
  const missing = [];
  const retained = [];
  const apply = (field, label, value, setValue) => {
    if (photoVersions[field] !== versions[field]) {
      retained.push(label);
    } else if (value) {
      setValue(value);
      updated.push(label);
    } else {
      missing.push(label);
      if (!photoTouched[field] && field !== "condition") setValue("");
    }
  };
  apply("crop", "작물명", result.crop, (value) => {
    const select = document.querySelector("#crop");
    const option = Array.from(select.options).find((item) => item.value === value && value !== "other");
    select.value = option ? value : value ? "other" : "";
    document.querySelector("#custom-crop").value = option ? "" : value;
    select.dispatchEvent(new Event("change"));
  });
  apply("quantity", "출하 예정 수량", result.totalWeightKg, (value) => {
    document.querySelector("#quantity").value = value;
    document.querySelector("#quantity").dispatchEvent(new Event("input"));
  });
  apply("shipmentDate", "출하 예정일", result.shipmentDate, (value) => {
    document.querySelector("#harvest-date").value = value;
    document.querySelector("#harvest-date").dispatchEvent(new Event("input"));
  });
  const notes = [
    result.grade && `라벨 표시 등급: ${result.grade}`,
    result.itemsPerBox && `상자당 ${result.itemsPerBox}개`,
    result.observation && `사진상 관찰: ${result.observation}`,
  ].filter(Boolean).join(" / ");
  const currentCondition = conditionInput.value.trim();
  const combined = notes && !currentCondition.includes(notes)
    ? [currentCondition, notes].filter(Boolean).join(" / ")
    : currentCondition;
  if (notes && combined.length > 500) {
    retained.push("작물 상태 (500자 초과)");
  } else {
    apply("condition", "작물 상태", notes, () => {
      conditionInput.value = combined;
      conditionInput.dispatchEvent(new Event("input"));
    });
  }
  const messages = [];
  if (updated.length) messages.push(`자동 입력: ${updated.join(", ")}.`);
  if (missing.length) messages.push(`사진에서 확인하지 못한 항목: ${missing.join(", ")}. 직접 확인해 주세요.`);
  if (retained.length) messages.push(`기존 입력 유지: ${retained.join(", ")}. 직접 확인해 주세요.`);
  messages.push("자동 입력한 내용도 맞는지 확인하고 고쳐주세요.");
  photoStatus.textContent = messages.join(" ");
}

async function analyzePhoto() {
  if (!selectedPhoto) {
    photoStatus.textContent = "먼저 사진을 찍거나 선택해 주세요.";
    return;
  }
  if (!photoConsent.checked) {
    photoStatus.textContent = "사진 전송에 동의해 주세요.";
    photoConsent.focus();
    return;
  }
  if (photoButton.disabled) return;
  const versions = { ...photoVersions };
  photoButton.disabled = true;
  photoKind.disabled = true;
  photoInputs.forEach((input) => { input.disabled = true; });
  document.querySelector("#photo-remove").disabled = true;
  photoReview.hidden = true;
  photoStatus.textContent = "사진을 살펴보고 있어요. 잠시만 기다려 주세요.";
  const controller = new AbortController();
  photoController = controller;
  const timeout = window.setTimeout(() => controller.abort(), 90000);
  try {
    const image = await preparePhoto(selectedPhoto);
    const response = await fetch("/api/photo-analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ kind: photoKind.value, mimeType: "image/jpeg", image, consent: true }),
      signal: controller.signal,
    });
    if (!response.ok) {
      const error = await readApiError(response);
      throw new Error(error.message || `사진 분석에 실패했어요. (오류 코드 ${response.status})`);
    }
    const result = await response.json();
    const fields = ["crop", "grade", "itemsPerBox", "weightPerBoxKg", "observation",
      "totalWeightKg", "totalWeightEvidence", "shipmentDate", "shipmentDateEvidence"];
    if (!result || !fields.every((field) => typeof result[field] === "string")) {
      throw new Error("사진 분석 결과 형식이 올바르지 않아요.");
    }
    if (!photoConsent.checked) throw new DOMException("Consent withdrawn", "AbortError");
    applyPhotoResult(result, versions);
    document.querySelector("#photo-weight").value = result.weightPerBoxKg;
    document.querySelector("#photo-boxes").value = "";
    photoReview.hidden = photoKind.value !== "label";
  } catch (error) {
    photoStatus.textContent = error.name === "AbortError"
      ? photoConsent.checked
        ? "사진 분석 시간이 길어졌어요. 다시 시도하거나 직접 입력해 주세요."
        : "사진 전송 동의가 해제되어 분석을 중단했어요."
      : error.message?.includes("직접 입력")
        ? error.message
        : `${error.message || "사진을 분석하지 못했어요."} 직접 입력해도 괜찮아요.`;
  } finally {
    window.clearTimeout(timeout);
    photoController = null;
    photoButton.disabled = false;
    photoKind.disabled = false;
    photoInputs.forEach((input) => { input.disabled = false; });
    document.querySelector("#photo-remove").disabled = false;
  }
}

document.querySelector("#photo-apply").addEventListener("click", () => {
  const weight = document.querySelector("#photo-weight");
  const boxes = document.querySelector("#photo-boxes");
  for (const input of [weight, boxes]) {
    if (!input.value || !input.validity.valid) {
      photoStatus.textContent = "상자당 중량과 출하할 상자 수를 올바르게 입력해 주세요.";
      input.focus();
      return;
    }
  }
  const product = Number(weight.value) * Number(boxes.value);
  const rounded = Math.round(product);
  const total = Math.abs(product - rounded) <= Number.EPSILON * Math.max(1, Math.abs(product)) * 4
    ? rounded : product;
  if (!Number.isSafeInteger(total) || total < 1 || total > 1000000) {
    photoStatus.textContent = "총중량은 1~1,000,000kg의 정수로 확인해 주세요. 직접 입력할 수도 있어요.";
    weight.focus();
    return;
  }
  invalidatePreviousAnalysis();
  document.querySelector("#quantity").value = total;
  document.querySelector("#quantity").dispatchEvent(new Event("input"));
  photoStatus.textContent = `상자 수로 계산한 총중량 ${total}kg을 입력했어요. 맞는지 확인해 주세요.`;
});

conditionInput.addEventListener("input", () => {
  document.querySelector("#condition-count").textContent = conditionInput.value.length;
  document.querySelector("#condition-error").textContent = "";
  conditionInput.removeAttribute("aria-invalid");
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
  if (isCustomCrop && event.isTrusted) document.querySelector("#custom-crop").focus();
});
document.querySelector("#custom-crop").addEventListener("input", () => {
  document.querySelector("#crop-error").textContent = "";
  document.querySelector("#custom-crop").removeAttribute("aria-invalid");
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (planPending) return;
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
  for (const id of ["crop-error", "quantity-error", "date-error", "condition-error"]) {
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
  const analysisPhotoRevision = photoRevision;
  lastResult = null;
  approvedPlan = null;
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

    if (analysisPhotoRevision !== photoRevision) return;
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
    if (analysisPhotoRevision !== photoRevision) return;
    renderResult(result);
    lastResult = result;
    setView("result");
  } catch (error) {
    if (analysisPhotoRevision !== photoRevision) return;
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
  const validSteps = Array.isArray(result?.steps) && result.steps.length > 0 &&
    result.steps.every((step) =>
      isString(step?.id) && isString(step?.label) &&
      ["completed", "failed", "pending", "running", "in_progress"].includes(step?.status));

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
    !validSteps ||
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
  const statusLabels = {
    completed: "완료", failed: "실패", pending: "대기", running: "진행 중", in_progress: "진행 중",
  };
  document.querySelector("#execution-timeline").replaceChildren(...result.steps.map((step, index) => {
    const item = document.createElement("li");
    const number = document.createElement("span");
    number.textContent = String(index + 1).padStart(2, "0");
    item.dataset.stage = step.id;
    item.dataset.status = step.status;
    item.append(number, document.createTextNode(`${step.label} · ${statusLabels[step.status]}`));
    return item;
  }));

  document.querySelector("#approval-section").hidden = !result.requiresApproval;
  document.querySelector("#approval-actions").hidden = false;
  document.querySelector("#final-plan").hidden = true;
  document.querySelector("#edit-form").hidden = true;
  document.querySelector("#plan-error").hidden = true;
  document.querySelector("#final-plan-text").textContent = "";
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
  const currentPlan = approvedPlan?.plan.action || lastResult?.recommendedAction || "";
  document.querySelector("#edited-action").value = currentPlan;
  editForm.hidden = false;
  document.querySelector("#approval-section").hidden = false;
  document.querySelector("#approval-actions").hidden = true;
  document.querySelector("#final-plan").hidden = true;
  document.querySelector("#plan-error").hidden = true;
  document.querySelector("#edited-action").focus();
}

function closeEditForm() {
  document.querySelector("#edit-form").hidden = true;
  document.querySelector("#plan-error").hidden = true;
  document.querySelector("#approval-actions").hidden = false;
  if (approvedPlan) showFinalPlan(approvedPlan);
}

async function approvePlan(action, status = "추천을 검토하고 승인했어요.") {
  const planPhotoRevision = photoRevision;
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
  if (planPhotoRevision !== photoRevision) return;
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
