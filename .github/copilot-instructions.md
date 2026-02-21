<!-- Copied patterns are discoverable from the `docs/` folder and JS modules. -->
# Copilot instructions for FlashCardApp2

Summary
- Single-page PWA-style flashcard app served from the `docs/` folder.
- Main app entry: [docs/js/app.js](docs/js/app.js). UI helpers, storage, and data providers are modularized under `docs/js/`.

Big picture / architecture
- UI layer: DOM helper functions are imported from `docs/js/ui.js` and used throughout `app.js` (helpers: `el`, `show`, `hide`, `setText`, `setError`, `setDisabled`, `openModal`, `closeModal`, `escapeHtml`).
- Storage layer: client-only persistence via `localStorage` using keys `flashcards_cfg_v1`, `flashcards_last_v1`, and `flashcards_progress_v1` implemented in `docs/js/storage.js`.
- Data providers: two interchangeable providers — `mockProvider` in `docs/js/data_mock.js` and `apiProvider` in `docs/js/data_api.js`. Toggle by editing `USE_MOCK_DATA` in `app.js` or by using the settings UI.
- PWA surface: service worker registration in `app.js` registers `./sw.js`; `manifest.json` is in `docs/`.

Developer workflows & debugging
- Local dev: open `docs/index.html` in a browser or run a simple static server (example: `python -m http.server` from the repo root) — service worker requires `localhost` or HTTPS to test.
- Toggle backend mode: set `USE_MOCK_DATA` to `false` in `docs/js/app.js` and provide a config via the app settings UI (or set localStorage key `flashcards_cfg_v1`).
- API mode expectations: `apiProvider` expects an "exec"-style endpoint (set `apiUrl`) and an API key (`apiKey`). The GET params are `path=decks` and `path=cards` with `deckId`, `sheet`, and `activeOnly`.
- Debugging: open browser DevTools console and network tab. Errors surface via `setError(...)` calls on the selection/config screens.

Project-specific conventions and patterns
- Prefer mock data for UI development: `USE_MOCK_DATA = true` in `app.js` keeps the app offline-friendly.
- Data shapes:
  - Deck: `{ deckId, title, sheets: [] }` (see `data_mock.js` and mapping in `data_api.js`).
  - Card: `{ id, question, answer, tags, level, active }` (app filters by `active`).
- Local state: `app.js` keeps `selection` (deckId, sheet, shuffle) and `session` (cards, order, index, reveal) in module-level variables — prefer changing these through the existing functions (`setLastSelection`, `setCardGrade`, etc.) to keep UI in sync.
- UI composition: `app.js` drives view state via `setState(State.SELECTION|FLASHCARDS)` and `render()`; reuse `renderFlashcard()` and `populate*` helpers for consistent behavior.

Integration points & extension notes
- To add server-side support, implement `apiProvider(cfg)` in `docs/js/data_api.js` to return the same shapes as `mockProvider`.
- Persisted progress: `setCardGrade(deckId, sheet, cardId, grade)` writes to `localStorage` keys; external sync should read/write the same key format if integrating cloud sync.
- Service worker and manifest: `docs/sw.js` and `docs/manifest.json` are present — changes to caching strategy affect offline availability and should be tested on localhost.

Practical examples (copy-paste)
- Switch to API mode in `docs/js/app.js`:
  - `const USE_MOCK_DATA = false;`
  - Open settings and enter `apiUrl` and `apiKey` in the UI (or set `localStorage.setItem('flashcards_cfg_v1', JSON.stringify({apiUrl:'https://...',apiKey:'...'}))`).
- Expected API response for decks (GET `?path=decks&key=APIKEY`): `{ ok: true, decks: [{deckId, title, sheets: []}] }`.
- Expected API response for cards: `{ ok: true, cards: [ { id, question, answer, tags, level, active } ] }`.

Notes for agents
- Do not change public API shapes (deckId/sheets/cards) when modifying providers — UI depends on these fields.
- Prefer minimal, focused edits: change `USE_MOCK_DATA` to test API flow, add small helper functions to `docs/js/ui.js` or `docs/js/storage.js` as needed.
- There are no tests in repository; run changes in browser and use DevTools to validate behavior.

If anything here is unclear or you'd like the instructions expanded (examples, local server commands, or test recipes), tell me which section to refine.
