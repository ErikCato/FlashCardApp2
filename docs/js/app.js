import { el, show, hide, setText, setError } from "./ui.js";
import { t, locales, setLocale, getLocale } from "./i18n.js";
import { getConfig, setConfig, hasConfig, setCardGrade } from "./storage.js";
import { mockProvider } from "./data_mock.js";
import { apiProvider } from "./data_api.js";
import * as areaStore from "./storage/areaStore.js";
import { createOverrideProvider } from "./providers/overrideProvider.js";
import { initConfigController, openConfigModal, setConfigToUI, updateConfigControllerUi } from "./controllers/configController.js";
import { initSelectionController, setDecks, getSelection, restoreLastSelection, updateSelectionUI } from "./controllers/selectionController.js";
import { initFlashcardsController, startSession as startFlashcardsSession } from "./controllers/flashcardsController.js";

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
  const baseProvider = createProvider(getConfig(), USE_MOCK_DATA);
  provider = createOverrideProvider(baseProvider, areaStore);
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

    const deck = deckMap.get(selection.deckId);
    const area = (deck?.areas || []).find((a) => a.id === selection.areaId);

    setState(State.FLASHCARDS);
    startFlashcardsSession({
      deckTitle: deck?.title || selection.deckId,
      deckId: selection.deckId,
      areaId: selection.areaId,
      areaName: area?.name || selection.areaId,
      cards,
      shuffle: selection.shuffle,
    });
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
    getCurrentDeckId: () => getSelection().deckId,
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

  initFlashcardsController({
    onBackToSelection: () => setState(State.SELECTION),
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