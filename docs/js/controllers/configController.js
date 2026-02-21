import { el, setError, setDisabled, setText, openModal, closeModal } from "../ui.js";
import { t } from "../i18n.js";

let onConfigSavedHandler = async () => {};
let onConfigCancelledHandler = () => {};
let requireConfigHandler = () => false;
let saveLoading = false;
let initialized = false;

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

export function updateConfigControllerUi() {
  setText("btnCfgSave", saveLoading ? t("savingConfig") : t("save"));
  setDisabled("btnCfgSave", !canSave());
  updateCancelVisibility();
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

export function initConfigController({ onConfigSaved, onConfigCancelled, requireConfig } = {}) {
  if (typeof onConfigSaved === "function") onConfigSavedHandler = onConfigSaved;
  if (typeof onConfigCancelled === "function") onConfigCancelledHandler = onConfigCancelled;
  if (typeof requireConfig === "function") requireConfigHandler = requireConfig;

  if (initialized) {
    updateConfigControllerUi();
    return;
  }

  el("btnCfgSave")?.addEventListener("click", onSaveClick);
  el("btnCfgCancel")?.addEventListener("click", onCancelClick);
  el("apiUrl")?.addEventListener("input", updateConfigControllerUi);
  el("apiKey")?.addEventListener("input", updateConfigControllerUi);
  document.querySelector("#configModal .modalBackdrop")?.addEventListener("click", onBackdropClick);

  initialized = true;
  updateConfigControllerUi();
}
