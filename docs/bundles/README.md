# Flashcards Bundles (Offline datasets)

Det här katalogen innehåller **bundle-filer** som appen kan synka från (URL-läge i Admin).
Appen kör sedan **offline** på det synkade datasetet.

## Snabbstart

1. Redigera (eller skapa) en bundle-fil, t.ex. `amanda.json`
2. Commit + push
3. I appen: Admin → Datakälla: URL → `bundles/amanda.json` → **Synka nu**
4. Kontrollera Status: **Bundle skapad** + **Senast synkad** + antal kort

> Tips: Använd alltid **relativ URL** utan inledande `/` (GitHub Pages project site).

---

## Filkonvention

- `amanda.json` – Amanda
- `adrian.json` – Adrian
- `jenny-barn1.json` – senare vid behov

Målet är att **en fil = ett offline-dataset** för en person.

---

## Bundle-format (schemaVersion 1)

Bundle-filen ska vara giltig JSON i detta format:

```json
{
  "schemaVersion": 1,
  "generatedAt": "2026-02-22T10:00:00+01:00",
  "decks": [
    {
      "deck": { "id": "sv-sam1b", "name": "Samhällskunskap 1B" },
      "areas": [
        {
          "id": "mr",
          "name": "Mänskliga rättigheter",
          "cards": [
            { "q": "Fråga…", "a": "Svar…" }
          ]
        }
      ]
    }
  ]
}
````

### Fält

* `schemaVersion` (number): alltid `1`
* `generatedAt` (string): ISO-tid när bundle skapades/uppdaterades
* `decks` (array):

  * `deck.id` (string): stabilt ID för ämne/kurs
  * `deck.name` (string): namn som visas i appen
  * `areas` (array):

    * `id` (string): stabilt område-ID inom deck
    * `name` (string): visas i appen
    * `cards` (array): kort med `{ "q": "...", "a": "..." }`

---

## ID-regler

### deck.id

* Rekommendation: kort och stabilt, t.ex. `sv-sam1b`, `sv-hist1a1`, `ma-1c`
* Byt inte deck.id i onödan (appens data kopplas till ID:t)

### area.id

* Endast: `a-z`, `0-9`, `-`
* Inga mellanslag, inga å/ä/ö
* Exempel:

  * `demokrati`
  * `kalla-kriget`
  * `ekonomiska-system`

> Tips: Om namnet innehåller å/ä/ö, skriv om till närmaste ASCII:
> `mänskliga rättigheter` → `manskliga-rattigheter`

---

## Så lägger du till ett nytt område

1. Hitta rätt deck i `decks[]` (matcha `deck.id`)
2. Lägg till ett nytt `areas[]`-objekt:

```json
{
  "id": "demokrati",
  "name": "Demokrati och statsskick",
  "cards": [
    { "q": "…", "a": "…" }
  ]
}
```

3. Uppdatera `generatedAt`
4. Commit + push

---

## Så uppdaterar du ett område

* Hitta område med samma `area.id` i rätt deck
* Ersätt `name` och/eller `cards`
* Uppdatera `generatedAt`
* Commit + push

> Appen använder **ersätt allt** vid synk: bundle blir ny sanning lokalt.

---

## AI-prompt för att skapa ett område (JSON-snippet)

Kopiera och fyll i `<...>`:

```text
Skapa ett flashcard-område som JSON-snippet.

Krav:
- area.id: <SÄTT_ID_HÄR> (lowercase, a-z, 0-9, bindestreck)
- area.name: "<SÄTT_NAMN_HÄR>"
- cards: exakt 30 kort
- Format per kort: { "q": "...", "a": "..." }
- Språk: svenska
- Nivå: gymnasiet
- Variera frågetyper: definition, exempel, jämförelse, resonemang
- Svar: 1–3 meningar, tydliga och korrekta

Output:
- Returnera ENDAST giltig JSON för area-objektet:
  { "id": "...", "name": "...", "cards": [ ... ] }
- Inga kommentarer, ingen extra text, ingen markdown.
```

---

## Vanliga problem

### 404 vid synk från URL

* Använd `bundles/amanda.json` (utan inledande `/`)
* Kontrollera att filen ligger under `docs/bundles/` (GitHub Pages från `/docs`)

### “Synk lyckas men innehållet ändras inte”

* GitHub Pages kan cachea. Appen använder cache-busting, men kontrollera att `generatedAt` faktiskt ändrats.
* Kontrollera Status i Admin: “Bundle skapad” ska vara senaste värdet.

---

```

Om du vill kan jag också skriva en **kort checklista** att lägga högst upp i README:n (typ “1) uppdatera generatedAt 2) validera JSON 3) commit 4) synka”) men ovan räcker oftast.

Vill du att jag även föreslår en bra naming-konvention för `deck.id` så att den blir konsekvent när ni får fler kurser/ämnen?
::contentReference[oaicite:0]{index=0}
```
