// Minimal UI helper utilities used by `docs/js/app.js`.
// Keep implementation small and dependency-free; these helpers
// are intentionally DOM-id centric because the app uses IDs.

export function el(id) {
  return document.getElementById(id);
}

export function show(id) {
  const e = el(id);
  if (!e) return;
  e.classList.remove("hidden");
  if (e.style) e.style.display = "";
}

export function hide(id) {
  const e = el(id);
  if (!e) return;
  e.classList.add("hidden");
  if (e.style) e.style.display = "none";
}

export function setText(id, text) {
  const e = el(id);
  if (!e) return;
  e.textContent = text == null ? "" : String(text);
}

export function setError(id, msg) {
  // Convention in the app: error containers are simple text fields
  // with an id (e.g. "selectionError", "cfgError"). We also
  // add/remove a small "error" class for visibility if present.
  const e = el(id);
  if (!e) return;
  const text = msg == null ? "" : String(msg);
  e.textContent = text;
  if (text) e.classList.add("error"); else e.classList.remove("error");
}

export function setDisabled(id, isDisabled) {
  const e = el(id);
  if (!e) return;
  e.disabled = Boolean(isDisabled);
}

export function openModal(id) {
  const m = el(id);
  if (!m) return;
  m.classList.add("open");
  m.classList.remove("hidden");
}

export function closeModal(id) {
  const m = el(id);
  if (!m) return;
  m.classList.remove("open");
  m.classList.add("hidden");
}

export function escapeHtml(unsafe) {
  if (unsafe == null) return "";
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/\'/g, "&#039;");
}

// Toggle the `hidden` class without setting inline display styles.
// Use this when you want to keep layout (reserved space) and only
// switch visibility/opacity via CSS rules (see `main.css`).
export function setVisibility(id, hidden) {
  const e = el(id);
  if (!e) return;
  if (hidden) e.classList.add("hidden"); else e.classList.remove("hidden");
}
