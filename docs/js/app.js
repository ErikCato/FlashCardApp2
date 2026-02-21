import { el, show, hide, setText, setError, setDisabled, openModal, closeModal, escapeHtml } from "./ui.js";
import { t, locales, setLocale, getLocale } from "./i18n.js";
import { getConfig, setConfig, hasConfig, getLastSelection, setLastSelection, setCardGrade } from "./storage.js";
import { mockProvider } from "./data_mock.js";
import { apiProvider } from "./data_api.js";

// Flip this during UI development:
const USE_MOCK_DATA = true;

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
  sheet: "",
  shuffle: true,
};

let session = {
  cards: [],
  order: [],
  index: 0,
  reveal: false,
};

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
  const cfg = getConfig();
  provider = apiProvider(cfg);
}

async function loadDecks() {
  decks = await provider.getDecks();
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
  const sheets = deck?.sheets || [];

  const optionsHead = '<option value="" selected disabled>' + escapeHtml(t('selectArea')) + '</option>';
  const sheetOptions = sheets.map(s => {
    if (typeof s === 'string') {
      return `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`;
    }
    const val = String(s.id || s.sheet || '');
    const label = String(s.title || val);
    return `<option value="${escapeHtml(val)}">${escapeHtml(label)}</option>`;
  });
  sheetSel.innerHTML = [optionsHead].concat(sheetOptions).join('');

  sheetSel.disabled = sheets.length === 0;

  const last = getLastSelection();
  const values = sheets.map(s => (typeof s === 'string') ? s : String(s.id || s.sheet || ''));
  if (last.sheet && values.includes(last.sheet)) {
    sheetSel.value = last.sheet;
    selection.sheet = last.sheet;
  } else {
    selection.sheet = "";
  }

  updateSelectionUi();
}

function updateSelectionUi() {
  const deckId = selection.deckId;
  const sheet = selection.sheet;

  setText("availableCount", (deckId && sheet) ? t('readyToLoad') : t('selectSubjectAndArea'));

  const canStart = Boolean(deckId && sheet);
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
  setText("fcSubtitle", `${deck?.title || selection.deckId} • ${selection.sheet}`);

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
  try {
    setError("selectionError", "");

    // Persist selection
    setLastSelection(selection);

    // Load cards
    const cards = await provider.getCards(selection.deckId, selection.sheet, true);

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
}

function closeConfigModal() {
  closeModal("configModal");
}

async function saveConfigFromModal() {
  try {
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
    selection.sheet = el("sheetSelect").value || "";
    updateSelectionUi();
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
    if (sheetSel && last.sheet) {
      sheetSel.value = last.sheet;
      selection.sheet = last.sheet;
    }
  }

  updateSelectionUi();
  setState(State.SELECTION);
}

init();