import { el, setDisabled, setError, setText, escapeHtml } from "../ui.js";
import { t } from "../i18n.js";
import { getLastSelection, setLastSelection } from "../storage.js";

let providerRef = null;
let onStartPracticeHandler = async () => {};
let onOpenSettingsHandler = () => {};

let initialized = false;
let decks = [];
let deckMap = new Map();

let selection = {
  deckId: "",
  areaId: "",
  shuffle: true,
};

let selectedAreaQuestionCount = null;
let selectedAreaQuestionCountLoading = false;
let selectedAreaCountRequestId = 0;
let startPracticeLoading = false;

function resolveProvider() {
  return typeof providerRef === "function" ? providerRef() : providerRef;
}

function populateDeckSelect() {
  const sel = el("deckSelect");
  if (!sel) return;

  const options = ['<option value="" selected disabled>' + escapeHtml(t("selectSubject")) + "</option>"]
    .concat(decks.map((d) => `<option value="${escapeHtml(d.deckId)}">${escapeHtml(d.title)}</option>`));
  sel.innerHTML = options.join("");
}

function populateAreaSelect() {
  const areaSel = el("sheetSelect");
  if (!areaSel) return;

  const deck = deckMap.get(selection.deckId);
  const areas = deck?.areas || [];

  const optionsHead = '<option value="" selected disabled>' + escapeHtml(t("selectArea")) + "</option>";
  const areaOptions = areas.map((area) => {
    const value = String(area.id || "");
    const label = String(area.name || value);
    return `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`;
  });

  areaSel.innerHTML = [optionsHead].concat(areaOptions).join("");
  areaSel.disabled = areas.length === 0;

  const values = areas.map((a) => String(a.id || ""));
  if (!selection.areaId || !values.includes(selection.areaId)) {
    selection.areaId = "";
  }

  if (selection.areaId) areaSel.value = selection.areaId;
}

async function refreshSelectedAreaQuestionCount() {
  const deckId = selection.deckId;
  const areaId = selection.areaId;
  const requestId = ++selectedAreaCountRequestId;

  if (!deckId || !areaId) {
    selectedAreaQuestionCount = null;
    selectedAreaQuestionCountLoading = false;
    updateSelectionUI();
    return;
  }

  selectedAreaQuestionCount = null;
  selectedAreaQuestionCountLoading = true;
  updateSelectionUI();

  try {
    const provider = resolveProvider();
    const cards = await provider.getCards(deckId, areaId, true);
    if (requestId !== selectedAreaCountRequestId) return;
    selectedAreaQuestionCount = Array.isArray(cards) ? cards.length : 0;
  } catch {
    if (requestId !== selectedAreaCountRequestId) return;
    selectedAreaQuestionCount = null;
  } finally {
    if (requestId !== selectedAreaCountRequestId) return;
    selectedAreaQuestionCountLoading = false;
    updateSelectionUI();
  }
}

async function onStartClick() {
  if (startPracticeLoading) return;
  try {
    startPracticeLoading = true;
    updateSelectionUI();
    setError("selectionError", "");
    setLastSelection(selection);
    await onStartPracticeHandler(getSelection());
  } finally {
    startPracticeLoading = false;
    updateSelectionUI();
  }
}

function onDeckChange() {
  const deckSel = el("deckSelect");
  selection.deckId = deckSel?.value || "";
  selection.areaId = "";
  populateAreaSelect();
  refreshSelectedAreaQuestionCount();
}

function onAreaChange() {
  const areaSel = el("sheetSelect");
  selection.areaId = areaSel?.value || "";
  refreshSelectedAreaQuestionCount();
}

function onShuffleChange() {
  selection.shuffle = Boolean(el("shuffleToggle")?.checked);
  setLastSelection(selection);
}

async function onOverridesChanged() {
  const selectionScreen = el("screenSelection");
  if (!selectionScreen || selectionScreen.classList.contains("hidden")) return;
  if (!selection.deckId) return;

  try {
    const provider = resolveProvider();
    if (!provider || typeof provider.getAreas !== "function") return;

    const areas = await provider.getAreas(selection.deckId);
    const currentDeck = deckMap.get(selection.deckId);
    if (!currentDeck) return;

    const nextDeck = { ...currentDeck, areas: Array.isArray(areas) ? areas : [] };
    deckMap.set(selection.deckId, nextDeck);
    decks = decks.map((deck) => (deck.deckId === selection.deckId ? nextDeck : deck));

    populateAreaSelect();
    refreshSelectedAreaQuestionCount();
  } catch {
    // keep UI stable on refresh failures
  }
}

export function initSelectionController({ provider, onStartPractice, onOpenSettings } = {}) {
  if (provider !== undefined) providerRef = provider;
  if (typeof onStartPractice === "function") onStartPracticeHandler = onStartPractice;
  if (typeof onOpenSettings === "function") onOpenSettingsHandler = onOpenSettings;

  if (initialized) {
    updateSelectionUI();
    return;
  }

  el("openSettingsBtn")?.addEventListener("click", () => onOpenSettingsHandler());
  el("deckSelect")?.addEventListener("change", onDeckChange);
  el("sheetSelect")?.addEventListener("change", onAreaChange);
  el("shuffleToggle")?.addEventListener("change", onShuffleChange);
  el("startPracticeBtn")?.addEventListener("click", onStartClick);
  window.addEventListener("data:overridesChanged", onOverridesChanged);

  initialized = true;
  updateSelectionUI();
}

export function setDecks(nextDecks) {
  decks = Array.isArray(nextDecks) ? nextDecks : [];
  deckMap = new Map(decks.map((d) => [d.deckId, d]));
  populateDeckSelect();

  if (selection.deckId && deckMap.has(selection.deckId)) {
    const deckSel = el("deckSelect");
    if (deckSel) deckSel.value = selection.deckId;
    populateAreaSelect();
  } else {
    selection.deckId = "";
    selection.areaId = "";
    const areaSel = el("sheetSelect");
    if (areaSel) {
      areaSel.innerHTML = '<option value="" selected disabled>' + escapeHtml(t("selectArea")) + "</option>";
      areaSel.disabled = true;
    }
  }

  updateSelectionUI();
}

export function getSelection() {
  return {
    deckId: selection.deckId || "",
    areaId: selection.areaId || "",
    shuffle: selection.shuffle !== false,
  };
}

export function restoreLastSelection() {
  const last = getLastSelection();

  selection.shuffle = last.shuffle !== false;
  const shuffleToggle = el("shuffleToggle");
  if (shuffleToggle) shuffleToggle.checked = selection.shuffle;

  const lastDeckId = String(last.deckId || "").trim();
  if (lastDeckId && deckMap.has(lastDeckId)) {
    selection.deckId = lastDeckId;
    const deckSel = el("deckSelect");
    if (deckSel) deckSel.value = lastDeckId;
    populateAreaSelect();

    const lastAreaId = String(last.areaId || last.sheet || "").trim();
    const deck = deckMap.get(lastDeckId);
    const areas = deck?.areas || [];
    const values = areas.map((a) => String(a.id || ""));
    if (lastAreaId && values.includes(lastAreaId)) {
      selection.areaId = lastAreaId;
      const areaSel = el("sheetSelect");
      if (areaSel) areaSel.value = lastAreaId;
    }
  }

  refreshSelectedAreaQuestionCount();
}

export function updateSelectionUI() {
  const deckId = selection.deckId;
  const areaId = selection.areaId;
  const hasAreaCount = typeof selectedAreaQuestionCount === "number";

  setText("startPracticeBtn", startPracticeLoading ? t("startingPractice") : t("startPractice"));

  if (!deckId || !areaId) {
    setText("availableCount", t("selectSubjectAndArea"));
  } else if (selectedAreaQuestionCountLoading) {
    setText("availableCount", t("countingQuestions"));
  } else if (hasAreaCount) {
    setText("availableCount", `${t("questionsInArea")}: ${selectedAreaQuestionCount} • ${t("readyToLoad")}`);
  } else {
    setText("availableCount", t("readyToLoad"));
  }

  const canStart = Boolean(deckId && areaId) && !selectedAreaQuestionCountLoading && hasAreaCount && !startPracticeLoading;
  setDisabled("startPracticeBtn", !canStart);

  setError("selectionError", "");
}
