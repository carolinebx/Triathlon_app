# Triatlon Coach — eigen Netlify-app met Google Sheets

Dit is een kant-en-klaar, downloadbaar project van je triatlon trainingsplanner.
Je host het zelf gratis op Netlify, je data komt in je eigen Google Spreadsheet
te staan, en je kunt de app als icoon op je telefoon zetten (PWA).

Ik kan dit niet voor je deployen — daar heb ik geen toegang toe jouw Netlify- of
Google-account voor nodig — maar hieronder staan alle stappen exact uitgeschreven.
Reken op **20-30 minuten**, eenmalig.

---

## Overzicht

```
Jouw telefoon/browser  →  Netlify (host de app)  →  Google Apps Script  →  Google Spreadsheet
```

- **Netlify** host de statische app (gratis tier is ruim voldoende).
- **Google Apps Script** is een klein "achterdeurtje" dat als eenvoudige API
  boven je spreadsheet draait — geen serverkosten, geen aparte database nodig.
- Zonder Sheets-koppeling werkt de app ook prima, dan blijft je data alleen op
  dat ene apparaat staan (in de browser-opslag).

---

## Stap 1 — Google Spreadsheet + backend maken

1. Ga naar [sheets.google.com](https://sheets.google.com) en maak een nieuwe,
   lege spreadsheet. Noem hem bijvoorbeeld "Triatlon Coach Data".
2. Ga naar **Extensies → Apps Script**.
3. Verwijder de voorbeeldcode die er staat en plak de volledige inhoud van
   [`google-apps-script/Code.gs`](./google-apps-script/Code.gs) uit dit project erin.
4. Klik op **Opslaan** (het schijfje-icoon), geef het project een naam zoals
   "Triatlon Coach API".
5. Klik rechtsboven op **Implementeren → Nieuwe implementatie**.
6. Kies als type **Webapp**.
   - "Uitvoeren als": **Ik (jouw account)**
   - "Wie heeft toegang": **Iedereen**  
     *(dit hoeft niet eng te zijn: er staat geen link naar je Sheet publiek
     ergens, alleen jouw app kent deze URL. Wil je het extra dichttimmeren,
     kun je later authenticatie toevoegen — dat valt buiten deze basisversie.)*
7. Klik op **Implementeren**. Google vraagt de eerste keer om toestemming
   (je eigen script, dus klik door "Geavanceerd" → "Ga naar project (onveilig)"
   — dat is normaal voor je eigen scripts).
8. Kopieer de **Web app-URL** die je krijgt (ziet er ongeveer zo uit:
   `https://script.google.com/macros/s/AKfycb.../exec`). Die heb je zo nodig.

> Wijzig je later de code in `Code.gs`? Dan moet je opnieuw **Implementeren →
> Nieuwe implementatie** (of een bestaande implementatie bewerken) om de
> wijziging live te zetten.

---

## Stap 2 — Project lokaal klaarzetten

Je hebt [Node.js](https://nodejs.org) (versie 18 of hoger) nodig.

```bash
cd triathlon-planner
npm install
cp .env.example .env
```

Open `.env` en plak je Web app-URL uit stap 1 achter `VITE_SHEETS_API_URL=`:

```
VITE_SHEETS_API_URL=https://script.google.com/macros/s/AKfycb.../exec
```

Test het lokaal:

```bash
npm run dev
```

Open de getoonde `localhost`-link. Doorloop de intake — als alles goed staat,
zie je in je Google Spreadsheet na een paar seconden een tabblad "Data"
verschijnen met een rij `triathlon-state`.

---

## Stap 3 — Deployen naar Netlify

**Optie A — via GitHub (aanbevolen, makkelijk updaten):**

1. Zet dit project in een nieuwe GitHub-repository (bijvoorbeeld via
   [github.com/new](https://github.com/new), dan lokaal:
   ```bash
   git init
   git add .
   git commit -m "Eerste versie triatlon coach"
   git branch -M main
   git remote add origin <jouw-repo-url>
   git push -u origin main
   ```
2. Ga naar [app.netlify.com](https://app.netlify.com) → **Add new site →
   Import an existing project** → koppel je GitHub-account → kies de repo.
3. Build command: `npm run build` — Publish directory: `dist`
   *(dit staat al klaar in `netlify.toml`, Netlify pikt het automatisch op)*.
4. Belangrijk: voeg je omgevingsvariabele toe onder **Site configuration →
   Environment variables**: key `VITE_SHEETS_API_URL`, value = jouw Web
   app-URL uit stap 1.
5. Klik **Deploy site**. Na een minuutje krijg je een live URL zoals
   `https://jouw-naam.netlify.app`.

**Optie B — snel zonder GitHub (drag & drop):**

```bash
npm run build
```

Ga naar [app.netlify.com/drop](https://app.netlify.com/drop) en sleep de
`dist`-map erin. Let op: bij deze route moet je `VITE_SHEETS_API_URL` al
vóór het bouwen in `.env` hebben staan, want drag & drop leest geen
omgevingsvariabelen van Netlify zelf.

---

## Stap 4 — Op je telefoon zetten

1. Open je Netlify-URL op je telefoon in Safari (iOS) of Chrome (Android).
2. **iOS:** tik op het deel-icoon onderin → **"Zet op beginscherm"**.
3. **Android (Chrome):** tik op het menu (⋮) → **"App installeren"** of
   **"Toevoegen aan startscherm"**.
4. Je krijgt nu een eigen app-icoon (de terracotta vlag) en de app opent
   fullscreen, zonder browserbalk.

---

## Hoe de data-opslag werkt

- Elke wijziging (nieuw doel, resultaat invullen, week genereren, …) wordt
  direct lokaal opgeslagen én — na een korte pauze — gesynchroniseerd naar
  je Google Spreadsheet.
- Open je de app op een ander apparaat? Dan wordt bij het opstarten eerst
  gekeken of er nieuwere data in de Spreadsheet staat, en die wordt dan
  ingeladen.
- Geen internet? De app blijft werken met de lokale kopie en synchroniseert
  zodra er weer verbinding is.
- Onderin **Instellingen** in de app zie je een statuslampje (groen =
  gesynchroniseerd, grijs = alleen lokaal, oranje = bezig, rood = mislukt) en
  kun je met één knop alle data wissen om opnieuw te beginnen.

---

## Bestandenoverzicht

```
index.html              — HTML-shell + PWA meta tags
src/main.jsx             — React-opstartpunt, registreert de service worker
src/App.jsx               — De volledige app (planner, coach, kalender, instellingen)
src/lib/sheetsApi.js       — Opslaglaag: localStorage + Google Sheets
public/manifest.json       — PWA-manifest (naam, icoon, kleuren)
public/sw.js                — Service worker (offline-shell + snel opstarten)
public/icons/                — App-icoontjes
google-apps-script/Code.gs   — Backend-script om in Apps Script te plakken
netlify.toml                  — Build- en redirect-config voor Netlify
.env.example                   — Voorbeeld voor je Sheets-URL
```

Veel succes met trainen! 🏊🚴🏃
