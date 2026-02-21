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

function normalizeSheetEntry(entry) {
  if (entry && typeof entry === "object") {
    const id = String(entry.id || entry.sheet || "").trim();
    const title = String(entry.title || id).trim();
    return { id, title };
  }

  const raw = String(entry || "").trim();
  if (!raw) return { id: "", title: "" };

  if (raw.includes("|")) {
    const [idPart, ...titleParts] = raw.split("|");
    const id = String(idPart || "").trim();
    const title = String(titleParts.join("|") || id).trim();
    return { id, title };
  }

  return { id: raw, title: raw };
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
          .map(normalizeSheetEntry)
          .filter(s => s.id),
      }));
    },

    async getCards(deckId, sheet, activeOnly = true) {
      const js = await apiGet(cfg, {
        path: "cards",
        deckId,
        sheet,
        activeOnly: activeOnly ? "true" : "false",
      });
      return js.cards || [];
    },
  };
}
