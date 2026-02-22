const LS_DECK_STORE = "flashcards.deckStore.v1";

function emptyStore() {
  return {
    version: 1,
    datasets: {
      active: null,
    },
  };
}

function safeParse(raw) {
  if (!raw) return emptyStore();
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return emptyStore();
    if (!parsed.datasets || typeof parsed.datasets !== "object") return emptyStore();
    return {
      version: 1,
      datasets: {
        active: parsed.datasets.active || null,
      },
    };
  } catch {
    return emptyStore();
  }
}

function readStore() {
  try {
    return safeParse(localStorage.getItem(LS_DECK_STORE));
  } catch {
    return emptyStore();
  }
}

function writeStore(store) {
  try {
    localStorage.setItem(LS_DECK_STORE, JSON.stringify(store || emptyStore()));
  } catch {}
}

export function computeCounts(dataset) {
  const decksMap = dataset?.decks && typeof dataset.decks === "object" ? dataset.decks : {};
  const deckIds = Object.keys(decksMap);

  let areas = 0;
  let cards = 0;

  deckIds.forEach((deckId) => {
    const deck = decksMap[deckId] || {};
    const areasMap = deck.areas && typeof deck.areas === "object" ? deck.areas : {};
    const cardsMap = deck.cards && typeof deck.cards === "object" ? deck.cards : {};

    const areaIds = Object.keys(areasMap);
    areas += areaIds.length;

    areaIds.forEach((areaId) => {
      const list = Array.isArray(cardsMap[areaId]) ? cardsMap[areaId] : [];
      cards += list.length;
    });
  });

  return { decks: deckIds.length, areas, cards };
}

export function getActiveDataset() {
  const store = readStore();
  const active = store?.datasets?.active;
  if (!active || typeof active !== "object") return null;
  return active;
}

export function setActiveDataset(dataset) {
  const store = readStore();
  store.datasets = store.datasets || {};
  store.datasets.active = dataset || null;
  writeStore(store);
}

export function clearActiveDataset() {
  const store = readStore();
  if (!store.datasets) store.datasets = {};
  store.datasets.active = null;
  writeStore(store);
}
