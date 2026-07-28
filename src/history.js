const HISTORY_KEY = "qrSweepHistoryV1";
const HISTORY_LIMIT = 200;

export async function loadHistory() {
  const data = await chrome.storage.local.get(HISTORY_KEY);
  return Array.isArray(data[HISTORY_KEY]) ? data[HISTORY_KEY] : [];
}

export async function saveHistory(items) {
  const trimmed = items.slice(0, HISTORY_LIMIT);
  await chrome.storage.local.set({ [HISTORY_KEY]: trimmed });
}

export async function appendHistory(entry) {
  const history = await loadHistory();
  history.unshift(entry);
  await saveHistory(history);
}

export async function clearHistory() {
  await chrome.storage.local.set({ [HISTORY_KEY]: [] });
}

export function exportHistoryBlob(items) {
  const content = JSON.stringify(items, null, 2);
  return new Blob([content], { type: "application/json" });
}
