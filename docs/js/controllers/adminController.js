import { el, setError } from "../ui.js";

let onSyncNowHandler = async () => {};
let getSyncStatusHandler = () => null;
let onClearLocalDataHandler = async () => {};
let onBackHandler = () => {};

let syncLoading = false;
let selectedBundleText = "";
let selectedBundleName = "";
let initialized = false;

function sourceLabel(sourceType) {
  if (sourceType === "bundle-file") return "JSON-fil";
  if (sourceType === "bundle-url") return "URL";
  if (sourceType === "sheets") return "Google Sheets";
  return "—";
}

function updateSourceUI() {
  const source = String(el("adminSourceSelect")?.value || "sheets");
  el("adminSheetsWrap")?.classList.toggle("hidden", source !== "sheets");
  el("adminBundleFileWrap")?.classList.toggle("hidden", source !== "bundle-file");
  el("adminBundleUrlWrap")?.classList.toggle("hidden", source !== "bundle-url");

  const fileStatus = el("adminBundleFileStatus");
  if (fileStatus) fileStatus.textContent = selectedBundleName ? `Vald fil: ${selectedBundleName}` : "Ingen fil vald";

  const syncBtn = el("btnAdminSyncNow");
  if (syncBtn) {
    syncBtn.disabled = syncLoading;
    syncBtn.textContent = syncLoading ? "Synkar…" : "Synka nu";
  }
}

export function setAdminConfigToUI(cfg) {
  const safe = cfg || {};
  const apiUrlEl = el("adminApiUrl");
  const apiKeyEl = el("adminApiKey");
  if (apiUrlEl) apiUrlEl.value = safe.apiUrl || "";
  if (apiKeyEl) apiKeyEl.value = safe.apiKey || "";
}

export function getAdminConfigFromUI() {
  return {
    apiUrl: String(el("adminApiUrl")?.value || "").trim(),
    apiKey: String(el("adminApiKey")?.value || "").trim(),
  };
}

export function updateAdminStatus() {
  const status = getSyncStatusHandler?.();
  const hasData = Boolean(status?.counts?.decks);
  const counts = status?.counts || { decks: 0, areas: 0, cards: 0 };

  const syncedEl = el("adminStatusSynced");
  if (syncedEl) {
    const when = status?.lastSyncAt ? new Date(status.lastSyncAt).toLocaleString() : "—";
    syncedEl.textContent = `Senast synkad: ${when}`;
  }

  const countsEl = el("adminStatusCounts");
  if (countsEl) {
    countsEl.textContent = `${counts.decks} decks • ${counts.areas} områden • ${counts.cards} kort`;
  }

  const sourceEl = el("adminStatusSource");
  if (sourceEl) {
    sourceEl.textContent = `Datakälla: ${sourceLabel(status?.sourceType)}`;
  }

  el("adminStatusEmpty")?.classList.toggle("hidden", hasData);
}

async function onBundleFileChange(event) {
  const input = event?.target;
  const file = input?.files?.[0];
  if (!file) return;

  try {
    selectedBundleText = await file.text();
    selectedBundleName = file.name || "bundle.json";
    updateSourceUI();
  } catch {
    selectedBundleText = "";
    selectedBundleName = "";
    alert("Kunde inte läsa bundle-filen.");
    updateSourceUI();
  } finally {
    if (input) input.value = "";
  }
}

function onPickBundleClick() {
  el("inputAdminBundleJson")?.click();
}

async function onSyncNowClick() {
  if (syncLoading) return;

  try {
    setError("adminError", "");
    syncLoading = true;
    updateSourceUI();

    const sourceType = String(el("adminSourceSelect")?.value || "sheets");
    const cfg = getAdminConfigFromUI();
    const bundleUrl = String(el("adminBundleUrl")?.value || "").trim();

    const meta = await onSyncNowHandler({
      sourceType,
      apiUrl: cfg.apiUrl,
      apiKey: cfg.apiKey,
      bundleUrl,
      bundleText: selectedBundleText,
      bundleFileName: selectedBundleName,
    });

    updateAdminStatus();
    if (meta?.counts) alert(`Synk klar: ${meta.counts.decks} decks, ${meta.counts.areas} områden, ${meta.counts.cards} kort.`);
    else alert("Synk klar.");
  } catch (e) {
    setError("adminError", e?.message || String(e));
  } finally {
    syncLoading = false;
    updateSourceUI();
  }
}

async function onClearLocalDataClick() {
  const ok = confirm("Detta rensar all lokal data på denna enhet. Fortsätt?");
  if (!ok) return;

  try {
    setError("adminError", "");
    await onClearLocalDataHandler();
    selectedBundleText = "";
    selectedBundleName = "";
    updateSourceUI();
    updateAdminStatus();
    alert("Lokal data rensad.");
  } catch (e) {
    setError("adminError", e?.message || String(e));
  }
}

function onBackClick() {
  onBackHandler();
}

export function initAdminController({ onSyncNow, getSyncStatus, onClearLocalData, onBack } = {}) {
  if (typeof onSyncNow === "function") onSyncNowHandler = onSyncNow;
  if (typeof getSyncStatus === "function") getSyncStatusHandler = getSyncStatus;
  if (typeof onClearLocalData === "function") onClearLocalDataHandler = onClearLocalData;
  if (typeof onBack === "function") onBackHandler = onBack;

  if (initialized) {
    updateSourceUI();
    updateAdminStatus();
    return;
  }

  el("adminSourceSelect")?.addEventListener("change", updateSourceUI);
  el("btnAdminPickBundleFile")?.addEventListener("click", onPickBundleClick);
  el("inputAdminBundleJson")?.addEventListener("change", onBundleFileChange);
  el("btnAdminSyncNow")?.addEventListener("click", onSyncNowClick);
  el("btnAdminClearLocalData")?.addEventListener("click", onClearLocalDataClick);
  el("btnAdminBack")?.addEventListener("click", onBackClick);

  initialized = true;
  updateSourceUI();
  updateAdminStatus();
}
