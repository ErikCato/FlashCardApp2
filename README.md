# FlashCardApp2

FlashCardApp2 är en single-page flashcard-app (PWA-style) som körs från `docs/`.

## Innehåll

- [Funktioner](#funktioner)
- [Kom igång lokalt](#kom-igång-lokalt)
- [Arkitektur](#arkitektur)
- [Datakällor och sync](#datakällor-och-sync)
- [Bundle-format](#bundle-format)
- [Validering av bundles (CI)](#validering-av-bundles-ci)
- [Projektstruktur](#projektstruktur)

## Funktioner

- Träningsflöde med `Deck -> Area -> Flashcards`
- Flip-card vy för fråga/svar
- Offline-first dataset (lokalt lagrat innehåll)
- Admin-vy för datakälla, sync och systemåtgärder
- Stöd för datakälla via:
	- Google Sheets/API
	- Lokal JSON-bundle-fil
	- URL till JSON-bundle
- Svensk/engelsk lokalisering
- Mobilvänlig layout och PWA-surface

## Kom igång lokalt

Kör från repository root:

```bash
python3 -m http.server 8000 --directory docs --bind 0.0.0.0
```

Öppna sedan:

- `http://localhost:8000`

## Arkitektur

- `docs/js/app.js`: state machine + bootstrap
- `docs/js/controllers/selectionController.js`: urvalsflöde
- `docs/js/controllers/flashcardsController.js`: träningsflöde
- `docs/js/controllers/adminController.js`: Admin-vy (datakälla/sync/status)
- `docs/js/providers/localProvider.js`: runtime-provider för lokalt dataset
- `docs/js/storage/deckStore.js`: lagring av aktivt dataset + metadata

## Datakällor och sync

Admin-vyn stöder tre källor:

1. **Google Sheets** (via API)
2. **JSON-fil (bundle)**
3. **URL (bundle)**

Sync är explicit via **Synka nu** och använder **atomic replace**:

- Nytt dataset ersätter aktivt dataset först efter lyckad fetch + validering.
- Vid fel behålls befintligt lokalt innehåll.

## Bundle-format

Appen använder schemaVersion `1` för bundles under `docs/bundles/*.json`.

```json
{
	"schemaVersion": 1,
	"generatedAt": "2026-02-22T10:00:00+01:00",
	"decks": [
		{
			"deck": { "id": "demo", "name": "Demo" },
			"areas": [
				{
					"id": "intro",
					"name": "Intro",
					"cards": [
						{ "q": "Fråga", "a": "Svar" }
					]
				}
			]
		}
	]
}
```

ID-regler för bundles:

- `deck.id` och `area.id` ska matcha `^[a-z0-9-]+$`
- IDs måste vara unika i sin respektive scope

## Validering av bundles (CI)

Bundle-validering körs i:

- `.github/workflows/validate-bundles.yml`

Lokalt kan du köra:

```bash
python scripts/validate_bundles.py
```

Valideraren kontrollerar bland annat:

- JSON-format och `schemaVersion == 1`
- obligatoriska fält (`generatedAt`, `decks`, `deck`, `areas`, `cards`)
- icke-tomma `q`/`a`
- dubbletter av `deck.id`, `area.id` och `q` inom area

## Projektstruktur

```text
docs/
	index.html
	css/main.css
	js/
		app.js
		i18n.js
		storage.js
		storage/
			areaStore.js
			deckStore.js
		providers/
			localProvider.js
			overrideProvider.js
		controllers/
			selectionController.js
			flashcardsController.js
			adminController.js
	bundles/
		amanda.json
	sw.js
	manifest.json
scripts/
	validate_bundles.py
```