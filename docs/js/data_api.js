function ensureExecUrl(apiUrl) {
  const u = String(apiUrl || "").trim();
  if (!u) throw new Error("API URL is empty");
  return u; // assume user enters .../exec
}

async function apiGet(cfg, params) {
  const apiUrl = ensureExecUrl(cfg.apiUrl);
  const apiKey = String(cfg.apiKey || "").trim();
  if (!apiKey) throw new Error("API key is empty");

  const url = new URL(apiUrl);
  url.searchParams.set("key", apiKey);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v));
  }

  const res = await fetch(url.toString(), { method: "GET" });
  const js = await res.json().catch(() => null);
  if (!js || js.ok !== true) {
    const msg = js?.error || `API error (HTTP ${res.status})`;
    throw new Error(msg);
  }
  return js;
}

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

function normalizeCard(card, index) {
  const id = String(card?.id || `card-${index + 1}`).trim();
  const question = String(card?.question || "").trim();
  const answer = String(card?.answer || "").trim();
  const tags = String(card?.tags || "").trim();
  const level = Number(card?.level || 1);
  const active = card?.active !== false;
  return { id, question, answer, tags, level, active };
}

export function apiProvider(cfg) {
  return {
    async getDecks() {
      const js = await apiGet(cfg, { path: "decks" });
      // supports: {decks:[{deckId,title,areas:[...]}]} or legacy sheets
      return (js.decks || []).map(d => ({
        deckId: d.deckId,
        title: d.title || d.deckId,
        areas: (Array.isArray(d.areas) ? d.areas : (d.sheets || []))
          .map(normalizeAreaEntry)
          .filter(s => s.id),
      }));
    },

    async getCards(deckId, areaId, activeOnly = true) {
      const js = await apiGet(cfg, {
        path: "cards",
        deckId,
        sheet: areaId,
        activeOnly: activeOnly ? "true" : "false",
      });
      return (js.cards || []).map(normalizeCard);
    },
  };
}
