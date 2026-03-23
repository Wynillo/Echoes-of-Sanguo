# Echoes of Sanguo

Ein browser-basiertes Sammelkartenspiel im Stil von **Yu-Gi-Oh! Forbidden Memories** – gebaut mit React, TypeScript und einem eigenen binären Kartenformat.

---

## Spielprinzip

Echoes of Sanguo ist ein 1v1 Duellkartenspiel. Jeder Spieler startet mit **8000 Lebenspunkten**. Wer zuerst auf 0 sinkt, verliert.

**Kernregeln (Forbidden Memories-Stil):**
- Keine Tributbeschwörung – alle Monster sind sofort spielbar
- Unbegrenzte Beschwörungen pro Zug
- Neubeschwörene Monster leiden unter Beschwörungskrankheit (kein Angriff im selben Zug)
- Fusionsmonster sind Ausnahme: direkte Spezialbeschwörung aus der Hand, sofort kampfbereit
- Handlimit: 8 Karten
- Starthand: 5 Karten, 1 Nachzug pro Runde

---

## Features

### 10 Monsterrassen
Jede Rasse hat einen eigenen Spielstil und Stat-Bias:

| Rasse | Icon | Spielstil |
|---|---|---|
| Feuer | 🔥 | Direktschaden bei Beschwörung/Vernichtung |
| Drache | 🐲 | Hohe ATK, Ziel-Immunität |
| Flug | 🦅 | Gegner schwächen, kaum angreifbar |
| Stein | 🪨 | Hohe DEF, starke Heilung |
| Pflanze | 🌿 | LP-Heilung, Ausdauer |
| Krieger | ⚔️ | ATK-Stärkung, Durchbohrender Angriff |
| Magier | 🔮 | Karten ziehen, Kontrolle |
| Elfe | ✨ | Gegnermonster dauerhaft schwächen |
| Dämon | 💀 | Hoher Schaden, riskante Effekte |
| Wasser | 🌊 | Bounce, Kontrolle, Fallen-Synergie |

### 722+ Karten
| Typ | Anzahl |
|---|---|
| Normale Monster | ~390 |
| Effekt-Monster | 208 |
| Fusionsmonster | 30 |
| Zauberkarten | 76 |
| Fallenkarten | 44 |
| **Gesamt** | **~722** |

**5 Seltenheitsstufen:** Common · Uncommon · Rare · Super Rare · Ultra Rare

### Effekt-System
Datengetriebenes Effekt-System mit folgenden Triggern:
- `onSummon` – Effekt bei Beschwörung
- `onDestroyByBattle` – Effekt bei Zerstörung im Kampf
- `onDestroyByOpponent` – Effekt bei Zerstörung durch den Gegner
- `passive` – Dauereffekt (`piercing`, `cannotBeTargeted`)

Effekte umfassen: Direktschaden, LP-Heilung, Karten ziehen, Stat-Buffs/-Debuffs, Bounce und durchbohrenden Schaden.

### Fusionssystem
Zwei Monster in der Hand können direkt fusioniert werden. Über 30 Rezepte ergeben mächtige Fusionsmonster (Level 5–9, bis Ultra Rare).

### Internationalisierung
Vollständig übersetzt in **Deutsch** und **Englisch** via i18next.

### Mobile App
Android-Unterstützung über **Capacitor** – das Webspiel läuft nativ auf Android-Geräten.

---

## Progression

### Progression Loop
```
Erststart → Starterdeck wählen (10 Rassen zur Wahl)
  → Gegner herausfordern → Duell gewinnen → Äther-Münzen verdienen
  → Shop → Booster-Packs kaufen → Neue Karten erhalten
  → Sammlung aufbauen → stärkere Gegner freischalten
```

### 10 Gegner (sequenziell freischaltbar)
| # | Name | Rasse | Schwierigkeit | Münzen (Sieg/Niederlage) |
|---|---|---|---|---|
| 1 | Lehrling Finn | Krieger | Tutorial | 100 / 20 |
| 2 | Gärtnerin Mira | Pflanze | Einfach | 150 / 30 |
| 3 | Flüsterin Syl | Elfe | Mittel | 200 / 40 |
| 4 | Tiefseefischer | Wasser | Mittel | 200 / 40 |
| 5 | Vulkanschmied | Feuer | Mittel-schwer | 250 / 50 |
| 6 | Steinhüter Grom | Stein | Schwer | 300 / 60 |
| 7 | Schattenhändler | Dämon | Schwer | 300 / 60 |
| 8 | Windweberin | Flug | Sehr schwer | 400 / 80 |
| 9 | Erzmagier Theron | Magier | Sehr schwer | 400 / 80 |
| 10 | Drachenfürst Varek | Drache | Extrem | 500 / 100 |

### Booster-Packs
| Pack | Preis | Inhalt |
|---|---|---|
| Starterpack | 200 ◈ | 9 Karten, eine Rasse, C/U-lastig |
| Rassen-Pack | 350 ◈ | 9 Karten, gewählte Rasse |
| Ätherpack | 500 ◈ | 9 Karten, alle Rassen |
| Seltenheitspack | 600 ◈ | 9 Karten, min. Rare, erhöhte SR/UR-Chance |

**Pack-Slot-Regeln:** Slot 1–5 Common · Slot 6–7 Uncommon · Slot 8 Rare · Slot 9 Rare (75%) / Super Rare (20%) / Ultra Rare (5%)

---

## Screens / Navigation

```
[Startbildschirm]
  → Erstes Mal: [Starterdeck-Auswahl]  (einmalig, 10 Rassen zur Wahl)
  → "Duell starten":   [Gegnerauswahl]  → [Spielfeld]  → [Duellergebnis]
  → "Shop":            [Shop]  → [Pack öffnen]
  → "Sammlung":        [Sammlungs-Binder]  (722+ Karten, Silhouette für fehlende)
  → "Deckbuilder":     [Deckbauer]  (nur eigene Karten, 40-Karten-Deck)
  → "Speicherpunkt":   [Speichern/Laden]
```

---

## Tech Stack

| Technologie | Verwendung |
|---|---|
| **React 19** | UI-Framework mit Context-basiertem State Management |
| **TypeScript** | Typsicherheit für Game Engine & UI |
| **Vite** | Build-Tool und Dev-Server |
| **Tailwind CSS 4** | Styling (Pixel-Font-Theme, Dark-Fantasy-Design) |
| **GSAP** | Animationen (Angriffe, Karten-Effekte) |
| **i18next** | Internationalisierung (DE/EN) |
| **Capacitor** | Android-App-Bridge |
| **Vitest** | Unit- und Integrationstests (jsdom) |
| **Playwright** | End-to-End-Tests |

**Kein Backend** – alle Daten werden clientseitig via `localStorage` gespeichert.

---

## Dateistruktur

```
ECHOES-OF-SANGUO/
├── index.html                  – Einstiegs-HTML (React Root + CRT-Overlay)
├── package.json                – Abhängigkeiten & Scripts
├── vite.config.js              – Vite Build-Konfiguration
├── tailwind.config.ts          – Tailwind-Theme (Pixel-Fonts, Dark-Fantasy)
├── capacitor.config.ts         – Capacitor Android-Konfiguration
├── css/
│   ├── style.css               – Haupt-Stylesheet
│   ├── animations.css          – Karten- & Kampfanimationen
│   └── progression.css         – Shop/Sammlung-Screens
├── js/
│   ├── main.js                 – Einstiegspunkt (lädt base.tcg, startet React)
│   ├── types.ts                – Kern-Typdefinitionen (Enums, Interfaces)
│   ├── cards.ts                – Kartendatenbank-Store & Lookup-Funktionen
│   ├── cards-data.ts           – Erweiterte Kartendefinitionen
│   ├── engine.ts               – Game Engine (Spiellogik, KI, Kampf, Fusion, Effekte)
│   ├── effect-registry.ts      – Datengetriebener Effekt-Executor
│   ├── progression.ts          – localStorage-Manager (Münzen, Sammlung, Deck)
│   ├── audio.ts                – SFX/Musik-Manager
│   ├── i18n.ts                 – i18next-Setup
│   ├── mod-api.ts              – Modding-API (window.EchoesOfSanguoMod)
│   ├── tcg-format/              – Eigenes binäres Kartenformat (.tcg)
│   │   ├── tcg-builder.ts       – Serialisierer: Kartendaten → Binär
│   │   ├── tcg-loader.ts        – Deserialisierer: Binär → Spielobjekte
│   │   ├── tcg-validator.ts     – Validierungslogik
│   │   ├── effect-serializer.ts – Effekt-Binär-Codec
│   │   └── generate-base-tcg.ts – CLI: base.tcg aus cards-data.ts generieren
│   └── react/
│       ├── App.tsx             – Root-Komponente (Provider-Tree + Router)
│       ├── contexts/           – React Contexts (Game, Screen, Progression, Modal, Selection)
│       ├── screens/            – Screen-Komponenten (Title, Starter, Opponent, Game, Shop, PackOpening, Collection, Deckbuilder, SavePoint)
│       ├── components/         – Wiederverwendbare UI-Komponenten (Card, HandCard, FieldCard, HoverPreview)
│       ├── modals/             – Modal-Dialoge (CardAction, CardDetail, CardList, GraveSelect, TrapPrompt, Options, Result)
│       ├── hooks/              – Custom Hooks (useAnimatedNumber, useAttackAnimation, useAudio, useKeyboardShortcuts)
│       └── utils/
│           └── pack-logic.ts   – Booster-Pack-Generierung
├── public/
│   ├── base.tcg                 – Kompilierte Kartendatenbank (Binärformat)
│   └── audio/                  – Sound-Effekte
├── locales/
│   ├── de.json                 – Deutsche Übersetzungen
│   └── en.json                 – Englische Übersetzungen
├── tests/                      – Unit-/Integrationstests
├── tests-e2e/                  – End-to-End-Tests (Playwright)
└── android/                    – Capacitor Android-Projekt
```

---

## Eigenes Binärformat (.tcg)

Kartendaten werden in einem eigenen Binärformat (`base.tcg`) gespeichert und beim Start geladen:

- **tcg-builder.ts** – Kodiert TypeScript-Objekte zu Binärdaten
- **tcg-loader.ts** – Dekodiert Binärdaten zu Laufzeitobjekten (CARD_DB, FUSION_RECIPES, etc.)
- **effect-serializer.ts** – Effekt-Bäume als kompakter Binär-Codec

Generierung via `npm run generate:tcg` aus `js/cards-data.ts`.

---

## Persistenz

Alle Fortschrittsdaten werden in `localStorage` gespeichert (Präfix `ac_`):

| Key | Inhalt |
|---|---|
| `ac_initialized` | Erststart markiert |
| `ac_starter_chosen` | Starterauswahl abgeschlossen |
| `ac_starter_race` | Gewählte Starterrasse |
| `ac_collection` | Kartensammlung `[{id, count}, ...]` |
| `ac_deck` | Aktuelles Deck (40 Karten) |
| `ac_aether_coins` | Aktuelle Münzen |
| `ac_opponents` | Gegner-Status `{1: {unlocked, wins, losses}, ...}` |
| `ac_settings` | Benutzereinstellungen |
| `ac_seen_cards` | Gesehene Karten |
| `ac_save_version` | Migrations-Version |

---

## KI

Die KI spielt strategisch nach fester Priorität:
1. Fusion aus der Hand beschwören (wenn möglich)
2. Alle Monster aus der Hand ausspielen
3. Zauberkarten aktivieren
4. Fallen setzen
5. Angriff: bevorzugt Monster, die sie zerstören kann; greift sonst direkt an

---

## Entwicklung

```bash
# Voraussetzungen: Node.js >= 18

npm install              # Abhängigkeiten installieren

npm run dev              # Dev-Server starten (http://localhost:5173)
npm run build            # Produktions-Build → dist/
npm run generate:tcg      # base.tcg aus Kartendaten generieren

npm test                 # Tests einmalig ausführen
npm run test:watch       # Tests im Watch-Modus
npm run test:coverage    # Test-Coverage-Report
npm run test:e2e         # End-to-End-Tests (Playwright)
```
