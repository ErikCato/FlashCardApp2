const LS_CFG = "flashcards_cfg_v1";
const LS_LAST = "flashcards_last_v1";
const LS_PROGRESS = "flashcards_progress_v1";

export function getConfig() {
  try {
    return JSON.parse(localStorage.getItem(LS_CFG) || "{}");
  } catch {
    return {};
  }
}

export function setConfig(cfg) {
  localStorage.setItem(LS_CFG, JSON.stringify({
    apiUrl: (cfg.apiUrl || "").trim(),
    apiKey: (cfg.apiKey || "").trim(),
  }));
}

export function clearConfig() {
  localStorage.removeItem(LS_CFG);
}

export function hasConfig() {
  const cfg = getConfig();
  return Boolean(cfg.apiUrl && cfg.apiKey);
}

export function getLastSelection() {
  try {
    return JSON.parse(localStorage.getItem(LS_LAST) || "{}");
  } catch {
    return {};
  }
}

export function setLastSelection(sel) {
  const areaId = String(sel.areaId || sel.sheet || "").trim();
  localStorage.setItem(LS_LAST, JSON.stringify({
    deckId: sel.deckId || "",
    areaId,
    sheet: areaId,
    shuffle: sel.shuffle !== false,
  }));
}

export function getProgress() {
  try {
    return JSON.parse(localStorage.getItem(LS_PROGRESS) || "{}");
  } catch {
    return {};
  }
}

export function setProgress(p) {
  localStorage.setItem(LS_PROGRESS, JSON.stringify(p || {}));
}

export function setCardGrade(deckId, areaId, cardId, grade) {
  const p = getProgress();
  const k = `${deckId}::${areaId}`;
  p[k] = p[k] || {};
  p[k][cardId] = { grade, ts: Date.now() };
  setProgress(p);
}