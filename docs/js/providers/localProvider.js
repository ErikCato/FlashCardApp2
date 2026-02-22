import { getActiveDataset } from "../storage/deckStore.js";

function normalizeDeck(deckId, node) {
  const deck = node?.deck || {};
  return {
    deckId,
    title: String(deck.name || deck.id || deckId),
    areas: Object.values(node?.areas || {}).map((area) => ({
      id: String(area?.id || "").trim(),
      name: String(area?.name || area?.id || "").trim(),
    })).filter((a) => a.id),
  };
}

function normalizeCard(card, index) {
  return {
    id: String(card?.id || `card-${index + 1}`).trim(),
    question: String(card?.question ?? card?.q ?? "").trim(),
    answer: String(card?.answer ?? card?.a ?? "").trim(),
    tags: String(card?.tags || "").trim(),
    level: Number(card?.level || 1),
    active: card?.active !== false,
  };
}

export function createLocalProvider() {
  return {
    async getDecks() {
      const active = getActiveDataset();
      const decksMap = active?.decks && typeof active.decks === "object" ? active.decks : {};
      return Object.entries(decksMap).map(([deckId, node]) => normalizeDeck(deckId, node));
    },

    async getAreas(deckId) {
      const active = getActiveDataset();
      const node = active?.decks?.[deckId];
      if (!node) return [];
      return Object.values(node?.areas || {})
        .map((area) => ({
          id: String(area?.id || "").trim(),
          name: String(area?.name || area?.id || "").trim(),
        }))
        .filter((a) => a.id);
    },

    async getCards(deckId, areaId, activeOnly = true) {
      const active = getActiveDataset();
      const list = active?.decks?.[deckId]?.cards?.[areaId];
      const cards = (Array.isArray(list) ? list : []).map(normalizeCard);
      return activeOnly ? cards.filter((c) => c.active !== false) : cards;
    },
  };
}
