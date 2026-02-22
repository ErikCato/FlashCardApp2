const LS_AREA_OVERRIDE = "flashcards.areaOverride.v1";

function emptyState() {
  return { decks: {} };
}

function safeParse(raw) {
  if (!raw) return emptyState();
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return emptyState();
    if (!parsed.decks || typeof parsed.decks !== "object") return emptyState();
    return parsed;
  } catch {
    return emptyState();
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem(LS_AREA_OVERRIDE);
    return safeParse(raw);
  } catch {
    return emptyState();
  }
}

function saveState(state) {
  try {
    localStorage.setItem(LS_AREA_OVERRIDE, JSON.stringify(state || emptyState()));
  } catch {}
}

function toKey(v) {
  return String(v || "").trim();
}

export function saveAreaOverride(payload) {
  const deckId = toKey(payload?.deckId);
  const areaId = toKey(payload?.area?.id);
  if (!deckId || !areaId) return;

  const state = loadState();
  state.decks = state.decks || {};
  state.decks[deckId] = state.decks[deckId] || {};

  state.decks[deckId][areaId] = {
    deckId,
    area: {
      id: areaId,
      name: toKey(payload?.area?.name) || areaId,
    },
    cards: Array.isArray(payload?.cards) ? payload.cards : [],
    updatedAt: payload?.updatedAt || new Date().toISOString(),
  };

  saveState(state);
}

export function getAreaOverride(deckId, areaId) {
  const did = toKey(deckId);
  const aid = toKey(areaId);
  if (!did || !aid) return null;

  const state = loadState();
  const found = state?.decks?.[did]?.[aid];
  if (!found || typeof found !== "object") return null;
  return found;
}

export function listAreaOverrides(deckId) {
  const did = toKey(deckId);
  if (!did) return [];

  const state = loadState();
  const deckOverrides = state?.decks?.[did];
  if (!deckOverrides || typeof deckOverrides !== "object") return [];

  return Object.values(deckOverrides).filter(Boolean);
}

export function deleteAreaOverride(deckId, areaId) {
  const did = toKey(deckId);
  const aid = toKey(areaId);
  if (!did || !aid) return;

  const state = loadState();
  const deckOverrides = state?.decks?.[did];
  if (!deckOverrides || typeof deckOverrides !== "object") return;

  delete deckOverrides[aid];
  if (!Object.keys(deckOverrides).length) delete state.decks[did];
  saveState(state);
}
