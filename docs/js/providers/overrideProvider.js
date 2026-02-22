function normalizeArea(area) {
  const id = String(area?.id || area?.areaId || "").trim();
  const name = String(area?.name || area?.title || id).trim();
  return { id, name };
}

function normalizeCard(card, index) {
  const id = String(card?.id || `card-${index + 1}`).trim();
  const question = String(card?.question ?? card?.q ?? "").trim();
  const answer = String(card?.answer ?? card?.a ?? "").trim();
  const tags = String(card?.tags || "").trim();
  const level = Number(card?.level || 1);
  const active = card?.active !== false;
  return { id, question, answer, tags, level, active };
}

export function createOverrideProvider(baseProvider, areaStore) {
  return {
    async getDecks() {
      const decks = await baseProvider.getDecks();
      return Promise.all((decks || []).map(async (deck) => {
        const deckId = String(deck?.deckId || "").trim();
        const areas = await this.getAreas(deckId);
        return {
          ...deck,
          deckId,
          title: String(deck?.title || deckId),
          areas,
        };
      }));
    },

    async getAreas(deckId) {
      const did = String(deckId || "").trim();
      if (!did) return [];

      let baseAreas = [];
      if (typeof baseProvider.getAreas === "function") {
        baseAreas = ((await baseProvider.getAreas(did)) || []).map(normalizeArea).filter((a) => a.id);
      } else {
        const decks = await baseProvider.getDecks();
        const baseDeck = (decks || []).find((d) => String(d?.deckId || "").trim() === did);
        baseAreas = (baseDeck?.areas || []).map(normalizeArea).filter((a) => a.id);
      }

      const overrides = areaStore.listAreaOverrides(did) || [];
      const overrideMap = new Map(
        overrides
          .map((entry) => {
            const area = normalizeArea(entry?.area || {});
            if (!area.id) return null;
            return [area.id, area];
          })
          .filter(Boolean)
      );

      const merged = baseAreas.map((baseArea) => {
        const over = overrideMap.get(baseArea.id);
        return over ? { id: baseArea.id, name: over.name || baseArea.name } : baseArea;
      });

      const existing = new Set(merged.map((a) => a.id));
      overrideMap.forEach((area, areaId) => {
        if (!existing.has(areaId)) merged.push(area);
      });

      return merged;
    },

    async getCards(deckId, areaId, activeOnly = true) {
      const did = String(deckId || "").trim();
      const aid = String(areaId || "").trim();

      const override = areaStore.getAreaOverride(did, aid);
      if (override && Array.isArray(override.cards)) {
        const cards = override.cards.map(normalizeCard);
        return activeOnly ? cards.filter((c) => c.active !== false) : cards;
      }

      return baseProvider.getCards(did, aid, activeOnly);
    },
  };
}
