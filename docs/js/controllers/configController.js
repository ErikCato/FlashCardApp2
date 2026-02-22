import { el, setError, setDisabled, setText, openModal, closeModal } from "../ui.js";
import { t } from "../i18n.js";
import { listAreaOverrides, deleteAreaOverride } from "../storage/areaStore.js";
import { saveAreaOverride } from "../storage/areaStore.js";

let onConfigSavedHandler = async () => {};
let onConfigCancelledHandler = () => {};
let requireConfigHandler = () => false;
let onImportAreaJsonHandler = async () => {};
let onSyncNowHandler = async () => {};
let getCurrentDeckIdHandler = () => "";
let getSyncStatusHandler = () => null;
let saveLoading = false;
let syncLoading = false;
let initialized = false;
let selectedBundleText = "";
let selectedBundleName = "";

function isConfigRequired() {
  return Boolean(requireConfigHandler());
}

function updateCancelVisibility() {
  const cancelBtn = el("btnCfgCancel");
  if (!cancelBtn) return;
  if (isConfigRequired()) cancelBtn.classList.add("hidden");
  else cancelBtn.classList.remove("hidden");
}

function canSave() {
  const cfg = getConfigFromUI();
  return Boolean(cfg.apiUrl && cfg.apiKey) && !saveLoading;
}

function currentDeckId() {
  try {
    return String(getCurrentDeckIdHandler?.() || "").trim();
  } catch {
    return "";
  }
}

function updateOverrideStatus() {
  const statusEl = el("overrideStatus");
  if (!statusEl) return;

  const deckId = currentDeckId();
  if (!deckId) {
    statusEl.textContent = "Inga lokala overrides";
    return;
  }

  const count = listAreaOverrides(deckId).length;
  statusEl.textContent = count > 0
    ? `Lokala overrides aktiva: ${count}`
    : "Inga lokala overrides";
}

function updateSyncStatusLine() {
  const statusEl = el("syncStatus");
  if (!statusEl) return;

  const status = getSyncStatusHandler?.();
  if (!status || !status.counts || !status.counts.decks) {
    statusEl.textContent = "Inget innehåll på denna enhet ännu.";
    return;
  }

  const when = status.lastSyncAt ? new Date(status.lastSyncAt).toLocaleString() : "okänd tid";
  const counts = status.counts;
  statusEl.textContent = `Senast synkad: ${when} • ${counts.decks} decks, ${counts.areas} områden, ${counts.cards} kort`;
}

function updateSyncSourceUi() {
  const source = String(el("syncSourceSelect")?.value || "sheets");
  const fileWrap = el("syncSourceFileWrap");
  const urlWrap = el("syncSourceUrlWrap");
  const fileStatus = el("bundleFileStatus");
  const syncBtn = el("btnSyncNow");

  if (fileWrap) fileWrap.classList.toggle("hidden", source !== "bundle-file");
  if (urlWrap) urlWrap.classList.toggle("hidden", source !== "bundle-url");

  if (fileStatus) {
    fileStatus.textContent = selectedBundleName ? `Vald fil: ${selectedBundleName}` : "Ingen fil vald";
  }

  if (syncBtn) {
    syncBtn.disabled = syncLoading;
    syncBtn.textContent = syncLoading ? "Synkar…" : "Synka nu";
  }
}

export function updateConfigControllerUi() {
  setText("btnCfgSave", saveLoading ? t("savingConfig") : t("save"));
  setDisabled("btnCfgSave", !canSave());
  updateCancelVisibility();
  updateSyncSourceUi();
  updateSyncStatusLine();
}

export function setConfigToUI(cfg) {
  const safe = cfg || {};
  const apiUrlEl = el("apiUrl");
  const apiKeyEl = el("apiKey");
  if (apiUrlEl) apiUrlEl.value = safe.apiUrl || "";
  if (apiKeyEl) apiKeyEl.value = safe.apiKey || "";
  setError("cfgError", "");
  updateConfigControllerUi();
}

export function getConfigFromUI() {
  const apiUrlEl = el("apiUrl");
  const apiKeyEl = el("apiKey");
  return {
    apiUrl: apiUrlEl ? apiUrlEl.value.trim() : "",
    apiKey: apiKeyEl ? apiKeyEl.value.trim() : "",
  };
}

export function openConfigModal() {
  setError("cfgError", "");
  updateConfigControllerUi();
  updateOverrideStatus();
  updateSyncStatusLine();
  openModal("configModal");
}

export function closeConfigModal() {
  closeModal("configModal");
}

async function onSaveClick() {
  if (saveLoading) return;
  try {
    saveLoading = true;
    updateConfigControllerUi();
    setError("cfgError", "");
    const cfg = getConfigFromUI();
    await onConfigSavedHandler(cfg);
    closeConfigModal();
  } catch (e) {
    setError("cfgError", e?.message || String(e));
  } finally {
    saveLoading = false;
    updateConfigControllerUi();
  }
}

function onCancelClick() {
  if (isConfigRequired()) return;
  closeConfigModal();
  onConfigCancelledHandler();
}

function onBackdropClick() {
  if (isConfigRequired()) return;
  closeConfigModal();
  onConfigCancelledHandler();
}

function validateImportPayload(payload) {
  const deckId = String(payload?.deckId || "").trim();
  const areaId = String(payload?.area?.id || "").trim();
  const areaName = String(payload?.area?.name || "").trim();
  const cards = payload?.cards;

  if (!deckId) throw new Error("Invalid JSON: deckId is required.");
  if (!areaId) throw new Error("Invalid JSON: area.id is required.");
  if (!areaName) throw new Error("Invalid JSON: area.name is required.");
  if (!Array.isArray(cards)) throw new Error("Invalid JSON: cards must be an array.");

  return {
    deckId,
    area: { id: areaId, name: areaName },
    cards,
    updatedAt: payload?.updatedAt,
  };
}

async function onImportFileChange(event) {
  const input = event?.target;
  const file = input?.files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const payload = validateImportPayload(parsed);
    saveAreaOverride(payload);
    try {
      await onImportAreaJsonHandler(payload);
    } catch {
      // import persistence must not depend on optional callback side effects
    }
    window.dispatchEvent(new Event("data:overridesChanged"));
    updateOverrideStatus();
    alert(`Imported area JSON: ${payload.deckId} / ${payload.area.id}`);
  } catch (e) {
    alert(e?.message || "Failed to import area JSON.");
  } finally {
    if (input) input.value = "";
  }
}

function onImportButtonClick() {
  const fileInput = el("inputImportAreaJson");
  fileInput?.click();
}

function onPickBundleClick() {
  const fileInput = el("inputBundleJson");
  fileInput?.click();
}

async function onBundleFileChange(event) {
  const input = event?.target;
  const file = input?.files?.[0];
  if (!file) return;

  try {
    selectedBundleText = await file.text();
    selectedBundleName = file.name || "bundle.json";
    updateSyncSourceUi();
  } catch {
    selectedBundleText = "";
    selectedBundleName = "";
    alert("Kunde inte läsa bundle-filen.");
    updateSyncSourceUi();
  } finally {
    if (input) input.value = "";
  }
}

async function onSyncNowClick() {
  if (syncLoading) return;
  const sourceType = String(el("syncSourceSelect")?.value || "sheets");

  try {
    syncLoading = true;
    updateSyncSourceUi();

    const cfg = getConfigFromUI();
    const bundleUrl = String(el("bundleUrlInput")?.value || "").trim();

    const meta = await onSyncNowHandler({
      sourceType,
      apiUrl: cfg.apiUrl,
      apiKey: cfg.apiKey,
      bundleUrl,
      bundleText: selectedBundleText,
      bundleFileName: selectedBundleName,
    });

    updateSyncStatusLine();
    if (meta?.counts) {
      alert(`Synk klar: ${meta.counts.decks} decks, ${meta.counts.areas} områden, ${meta.counts.cards} kort.`);
    } else {
      alert("Synk klar.");
    }
  } catch (e) {
    alert(e?.message || "Synk misslyckades.");
  } finally {
    syncLoading = false;
    updateSyncSourceUi();
  }
}

function onClearOverridesClick() {
  const deckId = currentDeckId();
  if (!deckId) {
    alert("Ingen deck vald. Välj ett ämne först.");
    return;
  }

  const ok = confirm("Detta tar bort lokalt importerade områden på denna enhet. Fortsätt?");
  if (!ok) return;

  const overrides = listAreaOverrides(deckId);
  overrides.forEach((entry) => {
    const areaId = String(entry?.area?.id || "").trim();
    if (areaId) deleteAreaOverride(deckId, areaId);
  });

  window.dispatchEvent(new Event("data:overridesChanged"));
  updateOverrideStatus();
  alert("Overrides borttagna.");
}

export function initConfigController({ onConfigSaved, onConfigCancelled, requireConfig, onImportAreaJson, onSyncNow, getCurrentDeckId, getSyncStatus } = {}) {
  if (typeof onConfigSaved === "function") onConfigSavedHandler = onConfigSaved;
  if (typeof onConfigCancelled === "function") onConfigCancelledHandler = onConfigCancelled;
  if (typeof requireConfig === "function") requireConfigHandler = requireConfig;
  if (typeof onImportAreaJson === "function") onImportAreaJsonHandler = onImportAreaJson;
  if (typeof onSyncNow === "function") onSyncNowHandler = onSyncNow;
  if (typeof getCurrentDeckId === "function") getCurrentDeckIdHandler = getCurrentDeckId;
  if (typeof getSyncStatus === "function") getSyncStatusHandler = getSyncStatus;

  if (initialized) {
    updateConfigControllerUi();
    return;
  }

  el("btnCfgSave")?.addEventListener("click", onSaveClick);
  el("btnCfgCancel")?.addEventListener("click", onCancelClick);
  el("apiUrl")?.addEventListener("input", updateConfigControllerUi);
  el("apiKey")?.addEventListener("input", updateConfigControllerUi);
  el("btnImportAreaJson")?.addEventListener("click", onImportButtonClick);
  el("inputImportAreaJson")?.addEventListener("change", onImportFileChange);
  el("clearOverridesBtn")?.addEventListener("click", onClearOverridesClick);
  el("syncSourceSelect")?.addEventListener("change", updateSyncSourceUi);
  el("btnPickBundleFile")?.addEventListener("click", onPickBundleClick);
  el("inputBundleJson")?.addEventListener("change", onBundleFileChange);
  el("btnSyncNow")?.addEventListener("click", onSyncNowClick);
  document.querySelector("#configModal .modalBackdrop")?.addEventListener("click", onBackdropClick);

  initialized = true;
  updateConfigControllerUi();
}
