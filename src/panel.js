import { appendHistory, clearHistory, exportHistoryBlob, loadHistory } from "./history.js";
import { hasCamera, scanImage, startCamera } from "./qr-engine.js";

const ui = {
  darkModeSelect: document.querySelector("#darkmode-select"),
  scanImage: document.querySelector("#scan-image"),
  scanCamera: document.querySelector("#scan-camera"),
  scanPage: document.querySelector("#scan-page"),
  stopCamera: document.querySelector("#stop-camera"),
  clearHistory: document.querySelector("#clear-history"),
  exportHistory: document.querySelector("#export-history"),
  makeInput: document.querySelector("#make-input"),
  makeSize: document.querySelector("#make-size"),
  makeGenerate: document.querySelector("#make-generate"),
  makeDownload: document.querySelector("#make-download"),
  makePreviewWrap: document.querySelector("#make-preview-wrap"),
  makePreview: document.querySelector("#make-preview"),
  camera: document.querySelector("#camera"),
  imagePreview: document.querySelector("#image"),
  status: document.querySelector("#status"),
  results: document.querySelector("#results"),
  resultCount: document.querySelector("#result-count"),
  template: document.querySelector("#result-template")
};

const recentCameraResults = new Map();
let cameraScanner = null;
let renderedCount = 0;
let generatedQrUrl = "";

const PANEL_PREFS_KEY = "panelPreferences";
const DEFAULT_PANEL_PREFS = {
  darkMode: "auto"
};
const FIXED_LAYOUT = "compact";
const prefersDarkScheme = window.matchMedia("(prefers-color-scheme: dark)");

applyI18n();

bootstrap().catch((err) => {
  console.error(err);
  setStatus(message("statusUnexpectedStartupError"));
});

function message(key, substitutions) {
  return chrome.i18n.getMessage(key, substitutions) || key;
}

function applyI18n(root = document) {
  document.documentElement.lang = chrome.i18n.getUILanguage();

  root.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = message(element.dataset.i18n);
  });

  root.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
    element.setAttribute("placeholder", message(element.dataset.i18nPlaceholder));
  });

  root.querySelectorAll("[data-i18n-alt]").forEach((element) => {
    element.setAttribute("alt", message(element.dataset.i18nAlt));
  });

  document.title = message("extName");
}

function formatSource(source) {
  const sourceKeyMap = {
    image: "sourceImage",
    camera: "sourceCamera",
    "page-canvas": "sourcePageCanvas",
    "page-image": "sourcePageImage",
    "tab-screenshot": "sourceTabScreenshot",
    "make-qr": "sourceMakeQr",
    unknown: "sourceUnknown"
  };

  return message(sourceKeyMap[source] || sourceKeyMap.unknown);
}

async function bootstrap() {
  bindEvents();
  await loadPanelPreferences();
  await initializeCameraCapability();
  await renderHistory();
}

function bindEvents() {
  ui.darkModeSelect.addEventListener("change", onDarkModeChange);
  ui.scanImage.addEventListener("click", onScanImage);
  ui.scanCamera.addEventListener("click", onStartCamera);
  ui.stopCamera.addEventListener("click", onStopCamera);
  ui.scanPage.addEventListener("click", onSweepCurrentPage);
  ui.clearHistory.addEventListener("click", onClearHistory);
  ui.exportHistory.addEventListener("click", onExportHistory);
  ui.makeGenerate.addEventListener("click", onGenerateQr);
  ui.makeDownload.addEventListener("click", onDownloadGeneratedQr);
  ui.results.addEventListener("click", onResultActionClick);
}

async function loadPanelPreferences() {
  const stored = await chrome.storage.local.get(PANEL_PREFS_KEY);
  const next = normalizePanelPreferences(stored[PANEL_PREFS_KEY]);

  ui.darkModeSelect.value = next.darkMode;
  applyPanelPreferences({ ...next, layout: FIXED_LAYOUT });

  if (prefersDarkScheme.addEventListener) {
    prefersDarkScheme.addEventListener("change", onSystemColorSchemeChange);
  } else if (prefersDarkScheme.addListener) {
    prefersDarkScheme.addListener(onSystemColorSchemeChange);
  }
}

function normalizePanelPreferences(prefs) {
  const legacyThemeToDarkMode = {
    ocean: "light",
    sunset: "light",
    graphite: "dark"
  };

  const rawDarkMode = prefs?.darkMode || legacyThemeToDarkMode[prefs?.theme];
  const darkMode = ["light", "dark", "auto"].includes(rawDarkMode)
    ? rawDarkMode
    : DEFAULT_PANEL_PREFS.darkMode;

  return { darkMode };
}

function applyPanelPreferences(prefs) {
  const body = document.body;
  const effectiveDarkMode = prefs.darkMode === "auto"
    ? (prefersDarkScheme.matches ? "dark" : "light")
    : prefs.darkMode;

  body.classList.remove("mode-light", "mode-dark", "mode-auto");
  body.classList.remove("ui-comfortable", "ui-compact");

  body.classList.add(`mode-${effectiveDarkMode}`);
  body.classList.add(`mode-${prefs.darkMode}`);
  body.classList.add(`ui-${FIXED_LAYOUT}`);
}

async function savePanelPreferences(partial) {
  const stored = await chrome.storage.local.get(PANEL_PREFS_KEY);
  const current = normalizePanelPreferences(stored[PANEL_PREFS_KEY]);
  const merged = normalizePanelPreferences({ ...current, ...partial });
  applyPanelPreferences({ ...merged, layout: FIXED_LAYOUT });
  await chrome.storage.local.set({ [PANEL_PREFS_KEY]: merged });
}

async function onDarkModeChange() {
  await savePanelPreferences({ darkMode: ui.darkModeSelect.value });
}

async function onSystemColorSchemeChange() {
  const stored = await chrome.storage.local.get(PANEL_PREFS_KEY);
  const current = normalizePanelPreferences(stored[PANEL_PREFS_KEY]);
  if (current.darkMode === "auto") {
    applyPanelPreferences(current);
  }
}

async function initializeCameraCapability() {
  ui.stopCamera.classList.add("hidden");
  const supported = await hasCamera();
  ui.scanCamera.disabled = !supported;
  if (!supported) {
    setStatus(message("statusNoCameraFound"));
  }
}

async function renderHistory() {
  const items = await loadHistory();
  ui.results.innerHTML = "";
  renderedCount = 0;

  for (const item of items) {
    renderResultItem(item, false);
  }

  setStatus(items.length ? message("statusHistoryLoaded") : message("statusReady"));
}

function setStatus(text) {
  ui.status.textContent = text;
}

function showElement(element) {
  [ui.camera, ui.imagePreview].forEach((el) => el.classList.add("hidden"));
  if (element) {
    element.classList.remove("hidden");
  }
}

async function onScanImage() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";

  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    showElement(ui.imagePreview);
    ui.imagePreview.src = previewUrl;
    setStatus(message("statusScanningImage"));

    try {
      const value = await scanImage(file);
      if (value) {
        await addResult(value, "image");
        setStatus(message("statusImageScanned"));
      } else {
        setStatus(message("statusNoQrInImage"));
      }
    } catch (error) {
      setStatus(message("statusNoQrInImage"));
    } finally {
      setTimeout(() => URL.revokeObjectURL(previewUrl), 1000);
    }
  });

  input.click();
}

async function onStartCamera() {
  await chrome.tabs.create({ url: chrome.runtime.getURL("camera.html") });
  setStatus(message("statusCameraOpenedInTab"));
}

function isRecentDuplicate(value) {
  const now = Date.now();
  const seenAt = recentCameraResults.get(value) || 0;
  recentCameraResults.set(value, now);
  return now - seenAt < 3000;
}

function onStopCamera() {
  if (!cameraScanner) {
    return;
  }

  cameraScanner.stop();
  cameraScanner = null;
  ui.scanCamera.disabled = false;
  ui.stopCamera.disabled = true;
  setStatus(message("statusCameraStopped"));
}

async function onSweepCurrentPage() {
  setStatus(message("statusCollectingPageCandidates"));

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    setStatus(message("statusNoActiveTab"));
    return;
  }

  const [{ result: collected }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      const imageUrls = [...document.images]
        .map((img) => img.currentSrc || img.src)
        .filter(Boolean)
        .filter((src, idx, arr) => arr.indexOf(src) === idx)
        .slice(0, 80);

      const canvasData = [...document.querySelectorAll("canvas")]
        .slice(0, 30)
        .map((canvas) => {
          try {
            return canvas.toDataURL("image/png");
          } catch {
            return null;
          }
        })
        .filter(Boolean);

      return {
        imageUrls,
        canvasData,
        pageTitle: document.title,
        pageUrl: location.href
      };
    }
  });

  const found = new Set();
  const pageMeta = {
    title: collected?.pageTitle || "",
    url: collected?.pageUrl || ""
  };

  setStatus(message("statusSweepingCanvases"));
  for (const dataUrl of collected.canvasData || []) {
    const value = await tryScanInput(dataUrl);
    if (value) {
      found.add(value);
      await addResult(value, "page-canvas", pageMeta);
    }
  }

  setStatus(message("statusSweepingImages"));
  for (const imageUrl of collected.imageUrls || []) {
    const value = await tryScanInput(imageUrl);
    if (value && !found.has(value)) {
      found.add(value);
      await addResult(value, "page-image", pageMeta);
    }
  }

  setStatus(message("statusSweepingScreenshot"));
  const screenshot = await captureCurrentTab();
  if (screenshot) {
    const value = await tryScanInput(screenshot);
    if (value && !found.has(value)) {
      found.add(value);
      await addResult(value, "tab-screenshot", pageMeta);
    }
  }

  if (found.size === 0) {
    setStatus(message("statusSweepNoResults"));
    return;
  }

  setStatus(message("statusSweepFoundResults", String(found.size)));
}

async function captureCurrentTab() {
  return new Promise((resolve) => {
    chrome.tabs.captureVisibleTab(null, { format: "png" }, (dataUrl) => {
      resolve(dataUrl || null);
    });
  });
}

async function tryScanInput(input) {
  try {
    const value = await scanImage(input);
    return value || null;
  } catch {
    return null;
  }
}

async function addResult(value, source, pageMeta = null) {
  const entry = {
    value,
    source,
    pageUrl: pageMeta?.url || "",
    pageTitle: pageMeta?.title || "",
    createdAt: Date.now()
  };

  renderResultItem(entry, true);
  await appendHistory(entry);
}

function renderResultItem(item, prepend) {
  const node = ui.template.content.firstElementChild.cloneNode(true);
  const valueEl = node.querySelector(".value");
  const metaEl = node.querySelector(".meta");

  applyI18n(node);

  const sourceText = formatSource(item.source || "unknown");
  const timeText = new Date(item.createdAt || Date.now()).toLocaleTimeString();
  metaEl.textContent = `${sourceText} • ${timeText}`;

  if (isUrl(item.value)) {
    valueEl.href = item.value;
    valueEl.textContent = item.value;
  } else {
    valueEl.href = "javascript:void(0)";
    valueEl.removeAttribute("target");
    valueEl.textContent = item.value;
  }

  node.dataset.value = item.value;

  if (prepend) {
    ui.results.prepend(node);
  } else {
    ui.results.append(node);
  }

  renderedCount += 1;
  ui.resultCount.textContent = String(renderedCount);
}

function isUrl(value) {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

async function onResultActionClick(event) {
  const action = event.target?.dataset?.action;
  if (!action) {
    return;
  }

  const item = event.target.closest(".result-item");
  const value = item?.dataset?.value;
  if (!value) {
    return;
  }

  if (action === "copy") {
    try {
      await navigator.clipboard.writeText(value);
      setStatus(message("statusCopied"));
    } catch {
      setStatus(message("statusCopyFailed"));
    }
    return;
  }

  if (action === "open") {
    if (!isUrl(value)) {
      setStatus(message("statusResultNotUrl"));
      return;
    }

    await chrome.tabs.create({ url: value });
    setStatus(message("statusOpenedResult"));
  }
}

async function onClearHistory() {
  await clearHistory();
  ui.results.innerHTML = "";
  renderedCount = 0;
  ui.resultCount.textContent = "0";
  setStatus(message("statusHistoryCleared"));
}

async function onExportHistory() {
  const items = await loadHistory();
  const blob = exportHistoryBlob(items);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `qr-sweep-history-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  setStatus(message("statusHistoryExported"));
}

async function onGenerateQr() {
  const input = ui.makeInput.value.trim();
  if (!input) {
    setStatus(message("statusEnterTextBeforeGenerating"));
    return;
  }

  const size = Number(ui.makeSize.value || 300);
  const encoded = encodeURIComponent(input);
  generatedQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encoded}`;

  ui.makePreview.src = generatedQrUrl;
  ui.makePreviewWrap.classList.remove("hidden");
  ui.makeDownload.disabled = false;
  setStatus(message("statusQrGenerated"));

  await addResult(input, "make-qr");
}

async function onDownloadGeneratedQr() {
  if (!generatedQrUrl) {
    setStatus(message("statusNoGeneratedQr"));
    return;
  }

  try {
    const response = await fetch(generatedQrUrl);
    if (!response.ok) {
      throw new Error("Failed to fetch generated QR image.");
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = `qr-made-${Date.now()}.png`;
    a.click();
    URL.revokeObjectURL(objectUrl);
    setStatus(message("statusGeneratedQrDownloaded"));
  } catch (error) {
    await chrome.tabs.create({ url: generatedQrUrl });
    setStatus(message("statusOpenedGeneratedQrManualSave"));
  }
}
