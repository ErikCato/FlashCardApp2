# FlashCardApp2

Single-page flashcard app (PWA-style) served from `docs/`.

## Features

- Deck + area selection
- Flip-card practice view (question/answer)
- English/Swedish localization
- Mock data mode and API mode
- Local progress and settings via `localStorage`
- Mobile-friendly fullscreen layout

## Project Structure

- `docs/index.html` — app shell
- `docs/css/main.css` — styling and responsive/mobile behavior
- `docs/js/app.js` — app state + UI wiring
- `docs/js/data_mock.js` — mock provider
- `docs/js/data_api.js` — API provider
- `docs/js/storage.js` — local persistence
- `docs/js/i18n.js` — translations
- `docs/sw.js` + `docs/manifest.json` — PWA surface

## Run Locally

From repository root:

```bash
python3 -m http.server 8000 --directory docs --bind 0.0.0.0
```

Open:

- `http://localhost:8000`

## Data Modes

In `docs/js/app.js`:

- `const USE_MOCK_DATA = true` → use local mock data
- `const USE_MOCK_DATA = false` → use backend API

## API Mode (Google Apps Script)

Expected query style (`GET`):

- `?path=decks&key=...`
- `?path=sheets&deckId=...&key=...`
- `?path=cards&deckId=...&sheet=...&activeOnly=true&key=...`

### Response shape

#### decks

```json
{
	"ok": true,
	"decks": [
		{
			"deckId": "samh1b",
			"title": "Samhällskunskap 1B",
			"sheets": ["mr|Mänskliga Rättigheter", "eu|Europeiska Unionen"]
		}
	]
}
```

#### sheets

Preferred format:

```json
{
	"ok": true,
	"deckId": "samh1b",
	"sheets": [
		{ "id": "mr", "title": "Mänskliga Rättigheter" },
		{ "id": "eu", "title": "Europeiska Unionen" }
	]
}
```

#### cards

```json
{
	"ok": true,
	"deckId": "samh1b",
	"sheet": "mr",
	"cards": [
		{
			"id": "mr-1",
			"question": "...",
			"answer": "...",
			"tags": "definition",
			"level": 1,
			"active": true
		}
	]
}
```

## Sheet Format Notes

- Backend may return sheets either as:
	- objects: `{ id, title }`
	- strings: `id|Title`
- The app normalizes both formats.
- Card loading always uses the sheet id only (for example `mr`).

## Mobile / PWA Notes

- Viewport is configured for edge-to-edge mobile layout.
- CSS uses dynamic viewport height (`100dvh`) for iOS/Android browser chrome changes.
- For iPhone best experience, use “Add to Home Screen”.

## Troubleshooting

- Area dropdown shows `id|Title` raw text:
	- Ensure latest `docs/js/data_api.js` and `docs/js/app.js` are loaded.
	- Hard refresh and clear service worker cache.

- Start button disabled after selecting area:
	- Verify selected option value is a sheet id (for example `mr`), not `mr|Title`.
	- Check API responses in DevTools Network tab.

- Changes not visible on device:
	- Unregister service worker in browser dev tools and reload.