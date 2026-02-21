import { el, show, hide, setText, setError, setDisabled, openModal, closeModal, escapeHtml } from "./ui.js";
import { t, locales, setLocale, getLocale } from "./i18n.js";
import { getConfig, setConfig, hasConfig, getLastSelection, setLastSelection, setCardGrade } from "./storage.js";
import { mockProvider } from "./data_mock.js";
import { apiProvider } from "./data_api.js";

// Flip this to switch between mock and API mode:
const USE_MOCK_DATA = false;

const State = {
  CONFIG: "CONFIG",
  SELECTION: "SELECTION",
  FLASHCARDS: "FLASHCARDS",
};

let currentState = State.SELECTION;

let provider = null;
let decks = [];
let deckMap = new Map();

let selection = {
  deckId: "",
  areaId: "",
  shuffle: true,
};

let session = {
  cards: [],
  order: [],
  index: 0,
  reveal: false,
};

let selectedAreaQuestionCount = null;
let selectedAreaQuestionCountLoading = false;
let selectedAreaCountRequestId = 0;
let startPracticeLoading = false;
let configSaveLoading = false;

function normalizeAreaEntry(entry) {
  if (entry && typeof entry === "object") {
    const id = String(entry.id || entry.sheet || "").trim();
    const name = String(entry.name || entry.title || id).trim();
    return { id, name };
  }

  const raw = String(entry || "").trim();
  if (!raw) return { id: "", name: "" };

  if (raw.includes("|")) {
    const [idPart, ...nameParts] = raw.split("|");
    const id = String(idPart || "").trim();
    const name = String(nameParts.join("|") || id).trim();
    return { id, name };
  }

  return { id: raw, name: raw };
}

function normalizeDeck(deck) {
  const sourceAreas = Array.isArray(deck?.areas) ? deck.areas : (deck?.sheets || []);
  const areas = sourceAreas.map(normalizeAreaEntry).filter(a => a.id);
  return { ...deck, areas };
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
}

function setState(next) {
  currentState = next;
  render();
}

function render() {
  if (currentState === State.SELECTION) {
    show("screenSelection");
    hide("screenFlashcards");
    // modal may be open/closed separately
  } else if (currentState === State.FLASHCARDS) {
    hide("screenSelection");
    show("screenFlashcards");
  }
}

function loadProvider() {
  if (USE_MOCK_DATA) {
    provider = mockProvider;
    return;
  }
  const cfg = getConfig() || {};
  provider = apiProvider(cfg);
}

async function loadDecks() {
  decks = (await provider.getDecks()).map(normalizeDeck);
  deckMap = new Map(decks.map(d => [d.deckId, d]));
  populateDeckSelect();
}

function populateDeckSelect() {
  const sel = el("deckSelect");
  if (!sel) return;
  const options = ['<option value="" selected disabled>' + escapeHtml(t('selectSubject')) + '</option>']
    .concat(decks.map(d => `<option value="${escapeHtml(d.deckId)}">${escapeHtml(d.title)}</option>`));
  sel.innerHTML = options.join("");
  // Restore last selection if possible
  const last = getLastSelection();
  if (last.deckId && deckMap.has(last.deckId)) {
    sel.value = last.deckId;
    selection.deckId = last.deckId;
    populateSheetSelect();
  }
}

function populateSheetSelect() {
  const sheetSel = el("sheetSelect");
  const deckSel = el("deckSelect");
  if (!sheetSel || !deckSel) return;

  const deckId = deckSel.value || "";
  selection.deckId = deckId;

  const deck = deckMap.get(deckId);
  const areas = deck?.areas || [];

  const optionsHead = '<option value="" selected disabled>' + escapeHtml(t('selectArea')) + '</option>';
  const sheetOptions = areas.map(area => {
    const val = String(area.id || '');
    const label = String(area.name || val);
    return `<option value="${escapeHtml(val)}">${escapeHtml(label)}</option>`;
  });
  sheetSel.innerHTML = [optionsHead].concat(sheetOptions).join('');

  sheetSel.disabled = areas.length === 0;

  const last = getLastSelection();
  const values = areas.map(a => String(a.id || ''));
  const lastAreaId = String(last.areaId || last.sheet || '').trim();
  if (lastAreaId && values.includes(lastAreaId)) {
    sheetSel.value = lastAreaId;
    selection.areaId = lastAreaId;
  } else {
    selection.areaId = "";
  }

  refreshSelectedAreaQuestionCount();
}

async function refreshSelectedAreaQuestionCount() {
  const deckId = selection.deckId;
  const areaId = selection.areaId;
  const requestId = ++selectedAreaCountRequestId;

  if (!deckId || !areaId) {
    selectedAreaQuestionCount = null;
    selectedAreaQuestionCountLoading = false;
    updateSelectionUi();
    return;
  }

  selectedAreaQuestionCount = null;
  selectedAreaQuestionCountLoading = true;
  updateSelectionUi();

  try {
    const cards = await provider.getCards(deckId, areaId, true);
    if (requestId !== selectedAreaCountRequestId) return;
    selectedAreaQuestionCount = Array.isArray(cards) ? cards.length : 0;
  } catch {
    if (requestId !== selectedAreaCountRequestId) return;
    selectedAreaQuestionCount = null;
  } finally {
    if (requestId !== selectedAreaCountRequestId) return;
    selectedAreaQuestionCountLoading = false;
    updateSelectionUi();
  }
}

function updateSelectionUi() {
  const deckId = selection.deckId;
  const areaId = selection.areaId;
  const hasAreaCount = typeof selectedAreaQuestionCount === "number";

  setText("startPracticeBtn", startPracticeLoading ? t('startingPractice') : t('startPractice'));

  if (!deckId || !areaId) {
    setText("availableCount", t('selectSubjectAndArea'));
  } else if (selectedAreaQuestionCountLoading) {
    setText("availableCount", t('countingQuestions'));
  } else if (hasAreaCount) {
    setText("availableCount", `${t('questionsInArea')}: ${selectedAreaQuestionCount} • ${t('readyToLoad')}`);
  } else {
    setText("availableCount", t('readyToLoad'));
  }

  const canStart = Boolean(deckId && areaId) && !selectedAreaQuestionCountLoading && hasAreaCount && !startPracticeLoading;
  setDisabled("startPracticeBtn", !canStart);

  // Clear selection screen error
  setError("selectionError", "");
}

function shuffleArray(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
}

function buildOrder(n, shuffle) {
  const arr = Array.from({ length: n }, (_, i) => i);
  if (shuffle) shuffleArray(arr);
  return arr;
}

function currentCard() {
  if (!session.cards.length) return null;
  return session.cards[session.order[session.index]];
}

function renderFlashcard() {
  const c = currentCard();
  if (!c) {
    setError("flashcardsError", t('noCardsLoaded'));
    setText("fcQuestion", "—");
    setText("fcAnswer", "—");
    setText("fcPos", "—");
    setText("fcTags", "—");
    return;
  }

  setError("flashcardsError", "");

  const deck = deckMap.get(selection.deckId);
  const area = (deck?.areas || []).find(a => a.id === selection.areaId);
  const areaText = area?.name || selection.areaId;
  setText("fcSubtitle", `${deck?.title || selection.deckId} • ${areaText}`);

  setText("fcQuestion", c.question || "");
  setText("fcAnswer", c.answer || "");
  setText("fcPos", `${session.index + 1} / ${session.cards.length}`);

  const tags = (c.tags || "").trim();
  setText("fcTags", tags ? tags : t('noTags'));

  // Flip the card when revealing answer so it replaces the question.
  const flip = el("flipCard");
  if (flip) {
    if (session.reveal) flip.classList.add("flipped"); else flip.classList.remove("flipped");
  }
  el("btnReveal").textContent = session.reveal ? t('hideAnswer') : t('revealAnswer');
}

function nextCard() {
  if (!session.cards.length) return;
  session.index = (session.index + 1) % session.cards.length;
  session.reveal = false;
  renderFlashcard();
}

function prevCard() {
  if (!session.cards.length) return;
  session.index = (session.index - 1 + session.cards.length) % session.cards.length;
  session.reveal = false;
  renderFlashcard();
}

async function startPractice() {
  if (startPracticeLoading) return;
  try {
    startPracticeLoading = true;
    updateSelectionUi();
    setError("selectionError", "");

    // Persist selection
    setLastSelection(selection);

    // Load cards
    const cards = await provider.getCards(selection.deckId, selection.areaId, true);

    if (!cards.length) {
      setError("selectionError", t('noCardsFoundArea'));
      return;
    }

    session.cards = cards;
    session.order = buildOrder(cards.length, selection.shuffle);
    session.index = 0;
    session.reveal = false;

    setState(State.FLASHCARDS);
    renderFlashcard();
  } catch (e) {
    setError("selectionError", e?.message || String(e));
  } finally {
    startPracticeLoading = false;
    updateSelectionUi();
  }
}

function openConfigModal(force) {
  // If force is true, show even if config exists
  const cfg = getConfig();
  el("apiUrl").value = cfg.apiUrl || "";
  el("apiKey").value = cfg.apiKey || "";
  setError("cfgError", "");

  openModal("configModal");

  // Ensure modal strings reflect current locale when opened
  applyLocale();
  updateConfigSaveUi();

  // In first-run, hide cancel to "force" config before use (optional)
  // Here: if force is false and config missing, we keep Cancel hidden.
  const cancelBtn = el("btnCfgCancel");
  if (!cancelBtn) return;

  if (!USE_MOCK_DATA && !hasConfig()) {
    cancelBtn.classList.add("hidden");
  } else {
    cancelBtn.classList.remove("hidden");
  }
}

function applyLocale() {
  // Set HTML lang attribute for accessibility
  try { document.documentElement.lang = getLocale(); } catch {}
  // Selection screen
  setText('selTitle', t('setupTitle'));
  setText('selSubtitle', t('setupSubtitle'));
  setText('chooseContentTitle', t('chooseContent'));
  setText('labelDeck', t('subject'));
  setText('labelSheet', t('area'));
  setText('shuffleText', t('shuffle'));
  setText('labelLang', t('language'));
  // Buttons
  el('openSettingsBtn').textContent = t('apiSettings');
  el('startPracticeBtn').textContent = t('startPractice');
  // Modal
  setText('cfgTitle', t('apiSettings'));
  el('apiUrl').placeholder = t('apiUrlPlaceholder');
  el('apiKey').placeholder = t('apiKeyPlaceholder');
  setText('cfgSubtitle', t('apiHint'));
  setText('btnCfgCancel', t('cancel'));
  setText('btnCfgSave', t('save'));
  setText('cfgTip', t('modalTip'));
  // Selection card
  setText('modeTitle', t('practiceMode'));
  setText('shuffleHint', t('shuffleHint'));
  // Flashcards screen
  setText('flashTitle', t('practiceTitle'));
  setText('labelQuestion', t('questionLabel'));
  setText('labelAnswer', t('answerLabel'));
  setText('btnBackToSelection', t('backToSelection'));
  // Top bar tooltip/title
  el('btnTopSettings').title = t('apiSettings');
  el('btnTopSettings').setAttribute('aria-label', t('apiSettings'));

  updateConfigSaveUi();
}

function updateConfigSaveUi() {
  const saveBtn = el("btnCfgSave");
  const apiUrlEl = el("apiUrl");
  const apiKeyEl = el("apiKey");
  if (!saveBtn || !apiUrlEl || !apiKeyEl) return;

  const hasUrl = Boolean(apiUrlEl.value.trim());
  const hasKey = Boolean(apiKeyEl.value.trim());
  const canSave = hasUrl && hasKey && !configSaveLoading;

  setText("btnCfgSave", configSaveLoading ? t('savingConfig') : t('save'));
  setDisabled("btnCfgSave", !canSave);
}

function closeConfigModal() {
  closeModal("configModal");
}

async function saveConfigFromModal() {
  if (configSaveLoading) return;
  try {
    configSaveLoading = true;
    updateConfigSaveUi();
    setError("cfgError", "");
    const apiUrl = el("apiUrl").value.trim();
    const apiKey = el("apiKey").value.trim();

    if (!USE_MOCK_DATA) {
      if (!apiUrl) throw new Error(t('enterApiUrl'));
      if (!apiKey) throw new Error(t('enterApiKey'));
    }

    setConfig({ apiUrl, apiKey });

    // Reload provider/decks (only matters in API mode)
    loadProvider();
    await loadDecks();

    closeConfigModal();
  } catch (e) {
    setError("cfgError", e?.message || String(e));
  } finally {
    configSaveLoading = false;
    updateConfigSaveUi();
  }
}

async function init() {
  registerServiceWorker();

  // Wire top settings button
  el("btnTopSettings").addEventListener("click", () => openConfigModal(true));

  // Language selector
  const langSel = el('langSelect');
  if (langSel) {
    // populate and set current
    const ls = locales();
    langSel.innerHTML = ls.map(l => `<option value="${l.code}">${l.name}</option>`).join('');
    langSel.value = getLocale();
    langSel.addEventListener('change', (e) => {
      setLocale(e.target.value);
      applyLocale();
    });
  }

  // Apply locale to initial UI
  applyLocale();
  // Expose for debugging so you can re-run localization from DevTools
  try { window.applyLocale = applyLocale; } catch(e) {}

  // Selection screen controls
  el("openSettingsBtn").addEventListener("click", () => openConfigModal(true));

  el("deckSelect").addEventListener("change", () => {
    populateSheetSelect();
  });

  el("sheetSelect").addEventListener("change", () => {
    selection.areaId = el("sheetSelect").value || "";
    refreshSelectedAreaQuestionCount();
  });

  el("shuffleToggle").addEventListener("change", () => {
    selection.shuffle = Boolean(el("shuffleToggle").checked);
    setLastSelection(selection);
  });

  el("startPracticeBtn").addEventListener("click", startPractice);

  // Flashcards controls
  el("btnReveal").addEventListener("click", () => {
    session.reveal = !session.reveal;
    renderFlashcard();
  });

  el("btnNext").addEventListener("click", nextCard);
  el("btnPrev").addEventListener("click", prevCard);

  el("btnBackToSelection").addEventListener("click", () => {
    setState(State.SELECTION);
  });

  // Config modal controls
  el("btnCfgSave").addEventListener("click", saveConfigFromModal);
  el("btnCfgCancel").addEventListener("click", closeConfigModal);
  el("apiUrl").addEventListener("input", updateConfigSaveUi);
  el("apiKey").addEventListener("input", updateConfigSaveUi);

  // Click on backdrop closes modal (when cancel is allowed)
  document.querySelector("#configModal .modalBackdrop")
    .addEventListener("click", () => {
      // If config is required (API mode + missing), do not close
      if (!USE_MOCK_DATA && !hasConfig()) return;
      closeConfigModal();
    });

  // Load last selection defaults
  const last = getLastSelection();
  selection.shuffle = last.shuffle !== false;
  el("shuffleToggle").checked = selection.shuffle;

  // Initialize provider
  loadProvider();

  // If API mode and config missing: force config modal first
  if (!USE_MOCK_DATA && !hasConfig()) {
    openConfigModal(false);
  }

  // Load decks (mock or API)
  try {
    await loadDecks();
  } catch (e) {
    // If API mode failed, prompt settings
    if (!USE_MOCK_DATA) {
      openConfigModal(true);
      setError("cfgError", e?.message || String(e));
    } else {
      setError("selectionError", e?.message || String(e));
    }
  }

  // Restore last sheet if possible
  const deckSel = el("deckSelect");
  if (last.deckId && deckSel && deckSel.value === last.deckId) {
    populateSheetSelect();
    const sheetSel = el("sheetSelect");
    const lastAreaId = String(last.areaId || last.sheet || '').trim();
    if (sheetSel && lastAreaId) {
      sheetSel.value = lastAreaId;
      selection.areaId = lastAreaId;
    }
  }

  updateSelectionUi();
  setState(State.SELECTION);
}

init();