import { el, show, hide, setText, setError } from "./ui.js";
import { t, getLocale } from "./i18n.js";
import { getConfig, setConfig } from "./storage.js";
import { mockProvider } from "./data_mock.js";
import { apiProvider } from "./data_api.js";
import * as areaStore from "./storage/areaStore.js";
import { getActiveDataset, setActiveDataset, computeCounts } from "./storage/deckStore.js";
import { createLocalProvider } from "./providers/localProvider.js";
import { createOverrideProvider } from "./providers/overrideProvider.js";
import { initAdminController, setAdminConfigToUI, updateAdminStatus } from "./controllers/adminController.js";
import { initSelectionController, setDecks, getSelection, restoreLastSelection, updateSelectionUI } from "./controllers/selectionController.js";
import { initFlashcardsController, startSession as startFlashcardsSession } from "./controllers/flashcardsController.js";

// Flip this to switch between mock and API mode:
const USE_MOCK_DATA = false;

const State = {
  SELECTION: "SELECTION",
  FLASHCARDS: "FLASHCARDS",
  ADMIN: "ADMIN",
};

let currentState = State.SELECTION;
let previousState = State.SELECTION;

let provider = null;
let decks = [];
let deckMap = new Map();
let hasLocalDataset = false;

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
}

function setState(next) {
  if (next === State.ADMIN && currentState !== State.ADMIN) {
    previousState = currentState;
  }
  currentState = next;
  render();
}

function render() {
  const adminBtn = el("btnTopAdmin");

  if (currentState === State.SELECTION) {
    show("screenSelection");
    hide("screenFlashcards");
    hide("screenAdmin");
    if (adminBtn) adminBtn.classList.remove("hidden");
  } else if (currentState === State.FLASHCARDS) {
    hide("screenSelection");
    show("screenFlashcards");
    hide("screenAdmin");
    if (adminBtn) adminBtn.classList.remove("hidden");
  } else if (currentState === State.ADMIN) {
    hide("screenSelection");
    hide("screenFlashcards");
    show("screenAdmin");
    if (adminBtn) adminBtn.classList.add("hidden");
  }
}

function createProvider(config, useMock) {
  if (useMock) return mockProvider;
  return apiProvider(config || {});
}

function buildRuntimeProvider() {
  const active = getActiveDataset();
  const counts = computeCounts(active || {});
  hasLocalDataset = counts.decks > 0;

  if (hasLocalDataset) {
    return createOverrideProvider(createLocalProvider(), areaStore);
  }

  // Keep base provider available for explicit sync, but runtime starts empty until sync.
  return createOverrideProvider(createProvider(getConfig(), USE_MOCK_DATA), areaStore);
}

function loadProvider() {
  provider = buildRuntimeProvider();
}

async function loadDecks() {
  if (!hasLocalDataset) {
    decks = [];
    deckMap = new Map();
    setDecks([]);
    return;
  }
  decks = await provider.getDecks();
  deckMap = new Map(decks.map(d => [d.deckId, d]));
  setDecks(decks);
}

async function fetchBundleViaGuess(apiUrl, apiKey) {
  const guessParams = ["op", "action", "route"];

  for (const key of guessParams) {
    try {
      const url = new URL(String(apiUrl || "").trim());
      if (apiKey) url.searchParams.set("key", String(apiKey || "").trim());
      url.searchParams.set(key, "bundle");

      const res = await fetch(url.toString(), { method: "GET" });
      if (!res.ok) continue;
      const js = await res.json().catch(() => null);
      if (js && js.schemaVersion === 1 && Array.isArray(js.decks)) return js;
    } catch {
      // try next pattern
    }
  }

  return null;
}

async function buildBundleFromProvider(syncProvider) {
  const decks = await syncProvider.getDecks();
  const out = [];

  for (const deck of decks || []) {
    const deckId = String(deck?.deckId || "").trim();
    if (!deckId) continue;

    const areas = typeof syncProvider.getAreas === "function"
      ? await syncProvider.getAreas(deckId)
      : (deck?.areas || []);

    const mappedAreas = [];
    for (const area of areas || []) {
      const areaId = String(area?.id || "").trim();
      if (!areaId) continue;
      const cards = await syncProvider.getCards(deckId, areaId, true);
      mappedAreas.push({
        id: areaId,
        name: String(area?.name || areaId),
        cards: Array.isArray(cards) ? cards : [],
      });
    }

    out.push({
      deck: {
        id: deckId,
        name: String(deck?.title || deckId),
      },
      areas: mappedAreas,
    });
  }

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    decks: out,
  };
}

function normalizeBundleToDataset(bundle, { sourceType, sourceMeta }) {
  if (!bundle || bundle.schemaVersion !== 1 || !Array.isArray(bundle.decks)) {
    throw new Error("Ogiltig bundle: schemaVersion/decks saknas.");
  }

  const decksMap = {};

  for (const deckEntry of bundle.decks) {
    const deckId = String(deckEntry?.deck?.id || "").trim();
    const deckName = String(deckEntry?.deck?.name || deckId).trim();
    if (!deckId) continue;

    const areaMap = {};
    const cardMap = {};

    const areas = Array.isArray(deckEntry?.areas) ? deckEntry.areas : [];
    for (const areaEntry of areas) {
      const areaId = String(areaEntry?.id || "").trim();
      const areaName = String(areaEntry?.name || areaId).trim();
      if (!areaId) continue;

      const cards = Array.isArray(areaEntry?.cards) ? areaEntry.cards : [];
      if (!cards.length) continue;

      areaMap[areaId] = { id: areaId, name: areaName };
      cardMap[areaId] = cards;
    }

    if (!Object.keys(areaMap).length) continue;

    decksMap[deckId] = {
      deck: { id: deckId, name: deckName },
      areas: areaMap,
      cards: cardMap,
    };
  }

  const dataset = {
    meta: {
      sourceType,
      sourceMeta: sourceMeta || {},
      lastSyncAt: new Date().toISOString(),
      generatedAt: bundle.generatedAt || new Date().toISOString(),
      counts: { decks: 0, areas: 0, cards: 0 },
    },
    decks: decksMap,
  };

  const counts = computeCounts(dataset);
  if (!counts.decks || !counts.areas || !counts.cards) {
    throw new Error("Synk misslyckades: bundle innehåller inget användbart innehåll.");
  }

  dataset.meta.counts = counts;
  return dataset;
}

async function syncDataset({ sourceType, apiUrl, apiKey, bundleUrl, bundleText }) {
  const type = String(sourceType || "").trim();
  let bundle;
  let sourceMeta = {};

  if (type === "bundle-file") {
    if (!bundleText) throw new Error("Välj en bundle JSON-fil först.");
    bundle = JSON.parse(bundleText);
    sourceMeta = { file: "local" };
  } else if (type === "bundle-url") {
    const url = String(bundleUrl || "").trim();
    if (!url) throw new Error("Ange Bundle URL.");
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Kunde inte hämta bundle (HTTP ${res.status}).`);
    bundle = await res.json();
    sourceMeta = { url };
  } else {
    const cfg = {
      apiUrl: String(apiUrl || "").trim(),
      apiKey: String(apiKey || "").trim(),
    };
    if (!cfg.apiUrl) throw new Error(t("enterApiUrl"));
    if (!cfg.apiKey) throw new Error(t("enterApiKey"));

    setConfig(cfg);

    bundle = await fetchBundleViaGuess(cfg.apiUrl, cfg.apiKey);
    if (!bundle) {
      const syncProvider = createProvider(cfg, false);
      bundle = await buildBundleFromProvider(syncProvider);
    }
    sourceMeta = { apiUrl: cfg.apiUrl };
  }

  const dataset = normalizeBundleToDataset(bundle, { sourceType: type || "sheets", sourceMeta });
  setActiveDataset(dataset); // atomic replace only after validation
  window.dispatchEvent(new Event("data:datasetChanged"));
  return dataset.meta;
}

function openAdminView() {
  setAdminConfigToUI(getConfig());
  updateAdminStatus();
  setState(State.ADMIN);
}

function backFromAdmin() {
  if (previousState === State.FLASHCARDS) {
    setState(State.FLASHCARDS);
    return;
  }
  setState(State.SELECTION);
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

async function clearAllLocalData() {
  const keys = [
    "flashcards_cfg_v1",
    "flashcards_last_v1",
    "flashcards_progress_v1",
    "flashcards.areaOverride.v1",
    "flashcards.deckStore.v1",
    "flashcards_lang_v1",
  ];

  keys.forEach((key) => {
    try { localStorage.removeItem(key); } catch {}
  });

  window.dispatchEvent(new Event("data:datasetChanged"));
  window.dispatchEvent(new Event("data:overridesChanged"));
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
  // Buttons
  el('startPracticeBtn').textContent = t('startPractice');
  // Selection card
  setText('modeTitle', t('practiceMode'));
  setText('shuffleHint', t('shuffleHint'));
  // Flashcards screen
  setText('flashTitle', t('practiceTitle'));
  setText('labelQuestion', t('questionLabel'));
  setText('labelAnswer', t('answerLabel'));
  setText('btnBackToSelection', t('backToSelection'));
  // Top bar tooltip/title
  if (el('btnTopAdmin')) {
    el('btnTopAdmin').title = 'Admin';
    el('btnTopAdmin').setAttribute('aria-label', 'Admin');
  }
  updateSelectionUI();
  updateAdminStatus();
}

async function init() {
  registerServiceWorker();

  initAdminController({
    getSyncStatus: () => {
      const active = getActiveDataset();
      if (!active?.meta) return null;
      return {
        lastSyncAt: active.meta.lastSyncAt,
        counts: active.meta.counts,
        sourceType: active.meta.sourceType,
      };
    },
    onSyncNow: syncDataset,
    onClearLocalData: async () => {
      await clearAllLocalData();
    },
    onBack: backFromAdmin,
  });

  initSelectionController({
    provider: () => provider,
    onStartPractice: startPractice,
  });

  initFlashcardsController({
    onBackToSelection: () => setState(State.SELECTION),
  });

  // Wire top admin button
  el("btnTopAdmin")?.addEventListener("click", openAdminView);

  // Apply locale to initial UI
  applyLocale();
  // Expose for debugging so you can re-run localization from DevTools
  try { window.applyLocale = applyLocale; } catch(e) {}

  // Initialize provider
  loadProvider();

  window.addEventListener("data:datasetChanged", async () => {
    loadProvider();
    await loadDecks();
    restoreLastSelection();
    updateSelectionUI();
    updateAdminStatus();
  });

  window.addEventListener("data:overridesChanged", () => {
    updateAdminStatus();
  });

  // Load decks (mock or API)
  try {
    await loadDecks();
    restoreLastSelection();
  } catch (e) {
    setError("selectionError", e?.message || String(e));
  }

  updateSelectionUI();
  setState(State.SELECTION);
}

init();