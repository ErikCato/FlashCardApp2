import { el, show, hide, setText, setError } from "./ui.js";
import { t, locales, setLocale, getLocale } from "./i18n.js";
import { getConfig, setConfig, hasConfig, setCardGrade } from "./storage.js";
import { mockProvider } from "./data_mock.js";
import { apiProvider } from "./data_api.js";
import { initConfigController, openConfigModal, setConfigToUI, updateConfigControllerUi } from "./controllers/configController.js";
import { initSelectionController, setDecks, getSelection, restoreLastSelection, updateSelectionUI } from "./controllers/selectionController.js";

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

function createProvider(config, useMock) {
  if (useMock) return mockProvider;
  return apiProvider(config || {});
}

function loadProvider() {
  provider = createProvider(getConfig(), USE_MOCK_DATA);
}

async function loadDecks() {
  decks = await provider.getDecks();
  deckMap = new Map(decks.map(d => [d.deckId, d]));
  setDecks(decks);
}

function showConfigModal() {
  setConfigToUI(getConfig());
  applyLocale();
  openConfigModal();
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

  const selection = getSelection();
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
  const selection = getSelection();
  try {
    setError("selectionError", "");

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
  updateSelectionUI();
  updateConfigControllerUi();
}

async function init() {
  registerServiceWorker();

  initConfigController({
    requireConfig: () => (!USE_MOCK_DATA && !hasConfig()),
    onConfigSaved: async ({ apiUrl, apiKey }) => {
      if (!USE_MOCK_DATA) {
        if (!apiUrl) throw new Error(t('enterApiUrl'));
        if (!apiKey) throw new Error(t('enterApiKey'));
      }
      setConfig({ apiUrl, apiKey });
      loadProvider();
      await loadDecks();
    },
  });

  initSelectionController({
    provider: () => provider,
    onOpenSettings: showConfigModal,
    onStartPractice: startPractice,
  });

  // Wire top settings button
  el("btnTopSettings").addEventListener("click", showConfigModal);

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

  // Initialize provider
  loadProvider();

  // If API mode and config missing: force config modal first
  if (!USE_MOCK_DATA && !hasConfig()) {
    showConfigModal();
  }

  // Load decks (mock or API)
  try {
    await loadDecks();
    restoreLastSelection();
  } catch (e) {
    // If API mode failed, prompt settings
    if (!USE_MOCK_DATA) {
      showConfigModal();
      setError("cfgError", e?.message || String(e));
    } else {
      setError("selectionError", e?.message || String(e));
    }
  }

  updateSelectionUI();
  setState(State.SELECTION);
}

init();