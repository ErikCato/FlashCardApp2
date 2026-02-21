import { el, setError, setText } from "../ui.js";
import { t } from "../i18n.js";

let initialized = false;
let onBackToSelectionHandler = () => {};

let session = {
  deckTitle: "",
  deckId: "",
  areaId: "",
  areaName: "",
  cards: [],
  order: [],
  index: 0,
  reveal: false,
};

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

export function render() {
  const c = currentCard();
  if (!c) {
    setError("flashcardsError", t("noCardsLoaded"));
    setText("fcQuestion", "—");
    setText("fcAnswer", "—");
    setText("fcPos", "—");
    setText("fcTags", "—");
    return;
  }

  setError("flashcardsError", "");

  const subtitleDeck = session.deckTitle || session.deckId || "";
  const subtitleArea = session.areaName || session.areaId || "";
  setText("fcSubtitle", `${subtitleDeck} • ${subtitleArea}`);

  setText("fcQuestion", c.question || "");
  setText("fcAnswer", c.answer || "");
  setText("fcPos", `${session.index + 1} / ${session.cards.length}`);

  const tags = String(c.tags || "").trim();
  setText("fcTags", tags ? tags : t("noTags"));

  const flip = el("flipCard");
  if (flip) {
    if (session.reveal) flip.classList.add("flipped");
    else flip.classList.remove("flipped");
  }

  setText("btnReveal", session.reveal ? t("hideAnswer") : t("revealAnswer"));
}

export function next() {
  if (!session.cards.length) return;
  session.index = (session.index + 1) % session.cards.length;
  session.reveal = false;
  render();
}

export function prev() {
  if (!session.cards.length) return;
  session.index = (session.index - 1 + session.cards.length) % session.cards.length;
  session.reveal = false;
  render();
}

export function toggleReveal() {
  if (!session.cards.length) return;
  session.reveal = !session.reveal;
  render();
}

export function clearSession() {
  session = {
    deckTitle: "",
    deckId: "",
    areaId: "",
    areaName: "",
    cards: [],
    order: [],
    index: 0,
    reveal: false,
  };
}

export function startSession({ deckTitle, deckId, areaId, areaName, cards, shuffle } = {}) {
  const safeCards = Array.isArray(cards) ? cards : [];

  session.deckTitle = String(deckTitle || "");
  session.deckId = String(deckId || "");
  session.areaId = String(areaId || "");
  session.areaName = String(areaName || session.areaId);
  session.cards = safeCards;
  session.order = buildOrder(safeCards.length, Boolean(shuffle));
  session.index = 0;
  session.reveal = false;

  render();
}

export function initFlashcardsController({ onBackToSelection } = {}) {
  if (typeof onBackToSelection === "function") onBackToSelectionHandler = onBackToSelection;

  if (initialized) return;

  el("btnReveal")?.addEventListener("click", toggleReveal);
  el("btnNext")?.addEventListener("click", next);
  el("btnPrev")?.addEventListener("click", prev);
  el("btnBackToSelection")?.addEventListener("click", () => onBackToSelectionHandler());

  initialized = true;
}
