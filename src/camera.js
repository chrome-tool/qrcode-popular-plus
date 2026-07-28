import { appendHistory } from "./history.js";
import { hasCamera, startCamera } from "./qr-engine.js";

const ui = {
  camera: document.querySelector("#camera"),
  status: document.querySelector("#status"),
  stopCamera: document.querySelector("#stop-camera"),
  copyResult: document.querySelector("#copy-result"),
  openResult: document.querySelector("#open-result"),
  resultMeta: document.querySelector("#result-meta"),
  resultValue: document.querySelector("#result-value"),
  historyHint: document.querySelector("#history-hint")
};

const recentResults = new Map();
let cameraScanner = null;
let latestValue = "";

applyI18n();
renderEmptyResult();

bootstrap().catch((error) => {
  console.error(error);
  setStatus(formatErrorMessage(error));
});

function message(key, substitutions) {
  return chrome.i18n.getMessage(key, substitutions) || key;
}

function applyI18n(root = document) {
  document.documentElement.lang = chrome.i18n.getUILanguage();

  root.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = message(element.dataset.i18n);
  });

  document.title = message("cameraPageTitle");
}

function setStatus(text) {
  ui.status.textContent = text;
}

function formatErrorMessage(error) {
  const detail = error instanceof Error ? error.message : String(error || "");
  return detail
    ? `${message("statusCameraUnavailable")} (${detail})`
    : message("statusCameraUnavailable");
}

function isUrl(value) {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function isRecentDuplicate(value) {
  const now = Date.now();
  const seenAt = recentResults.get(value) || 0;
  recentResults.set(value, now);
  return now - seenAt < 3000;
}

function renderEmptyResult() {
  ui.resultMeta.textContent = "";
  ui.resultValue.textContent = message("cameraPageLatestResultEmpty");
  ui.resultValue.removeAttribute("target");
  ui.resultValue.href = "javascript:void(0)";
  ui.copyResult.disabled = true;
  ui.openResult.disabled = true;
}

function renderResult(value) {
  latestValue = value;
  ui.resultMeta.textContent = `${message("sourceCamera")} • ${new Date().toLocaleTimeString()}`;
  ui.resultValue.textContent = value;
  if (isUrl(value)) {
    ui.resultValue.href = value;
    ui.resultValue.target = "_blank";
  } else {
    ui.resultValue.href = "javascript:void(0)";
    ui.resultValue.removeAttribute("target");
  }
  ui.copyResult.disabled = false;
  ui.openResult.disabled = !isUrl(value);
}

async function bootstrap() {
  bindEvents();

  const supported = await hasCamera();
  if (!supported) {
    ui.stopCamera.disabled = true;
    setStatus(message("statusNoCameraFound"));
    return;
  }

  setStatus(message("statusStartingCamera"));
  cameraScanner = await startCamera(ui.camera, onDetected);
  ui.stopCamera.disabled = false;
  setStatus(message("statusCameraActive"));
}

function bindEvents() {
  ui.stopCamera.addEventListener("click", stopCamera);
  ui.copyResult.addEventListener("click", onCopyResult);
  ui.openResult.addEventListener("click", onOpenResult);
  window.addEventListener("beforeunload", stopCamera);
}

async function onDetected(value) {
  if (isRecentDuplicate(value)) {
    return;
  }

  renderResult(value);
  setStatus(message("statusCameraDetectedQr"));

  await appendHistory({
    value,
    source: "camera",
    pageUrl: "",
    pageTitle: "",
    createdAt: Date.now()
  });
}

function stopCamera() {
  if (!cameraScanner) {
    return;
  }

  cameraScanner.stop();
  cameraScanner = null;
  ui.stopCamera.disabled = true;
  setStatus(message("statusCameraStopped"));
}

async function onCopyResult() {
  if (!latestValue) {
    return;
  }

  try {
    await navigator.clipboard.writeText(latestValue);
    setStatus(message("statusCopied"));
  } catch {
    setStatus(message("statusCopyFailed"));
  }
}

async function onOpenResult() {
  if (!latestValue || !isUrl(latestValue)) {
    setStatus(message("statusResultNotUrl"));
    return;
  }

  await chrome.tabs.create({ url: latestValue });
  setStatus(message("statusOpenedResult"));
}
