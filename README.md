# ✦ Aetherial Clash

Ein browser-basiertes Sammelkartenspiel im Stil von **Yu-Gi-Oh! Forbidden Memories** – komplett mit Vanilla JavaScript, ohne Frameworks oder externe Abhängigkeiten.

---

## Spielprinzip

Aetherial Clash ist ein 1v1 Duellkartenspiel. Jeder Spieler startet mit **8000 Lebenspunkten**. Wer zuerst auf 0 sinkt, verliert.

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

### 722 Karten
| Typ | Anzahl |
|---|---|
| Normale Monster | ~390 |
| Effekt-Monster | 208 |
| Fusionsmonster | 30 |
| Zauberkarten | 76 |
| Fallenkarten | 44 |
| **Gesamt** | **~722** |

**5 Seltenheitsstufen:** Common · Uncommon · Rare · Super Rare · Ultra Rare

### Effekt-Trigger
- `onSummon` – Effekt bei Beschwörung
- `onDestroyByBattle` – Effekt bei Zerstörung im Kampf
- `onDestroyByOpponent` – Effekt bei Zerstörung durch den Gegner
- `passive` – Dauereffekt (`piercing`, `cannotBeTargeted`)

### Fusionssystem
Zwei Monster in der Hand können direkt fusioniert werden. Über 30 Rezepte ergeben mächtige Fusionsmonster (Level 5–9, bis Ultra Rare).

---

## Progression

### Progression Loop
```
Erststart → Starterdeck wählen
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
  → "Sammlung":        [Sammlungs-Binder]  (722 Karten, Silhouette für fehlende)
  → "Deckbuilder":     [Deckbauer]  (nur eigene Karten, 40-Karten-Deck)
```

---

## Dateistruktur

```
Game2/
├── index.html              – Haupt-HTML, alle Screen-Divs
├── css/
│   ├── style.css           – Haupt-Stylesheet (Dark-Fantasy-Design)
│   └── progression.css     – Progression-Screens (Shop, Sammlung, Gegner, ...)
└── js/
    ├── cards.js            – Basisdatenbank (50 Karten), Konstanten, Gegner-Configs
    ├── cards-data.js       – Erweiterte Datenbank (672 neue Karten, STARTER_DECKS)
    ├── progression.js      – localStorage-Manager (Münzen, Sammlung, Gegner-Unlock)
    ├── engine.js           – GameEngine: Spiellogik, KI, Kampf, Fusion, Effekte
    ├── screens.js          – Screen-Controller (Gegnerauswahl, Starter, Sammlung)
    ├── shop.js             – Booster-Pack-Logik + Shop-UI
    └── ui.js               – Rendering, Event-Handler, Deckbuilder, Modale
```

**Script-Ladereihenfolge:** `cards.js` → `cards-data.js` → `progression.js` → `engine.js` → `screens.js` → `shop.js` → `ui.js`

---

## Persistenz

Alle Fortschrittsdaten werden in `localStorage` gespeichert (Präfix `ac_`):

| Key | Inhalt |
|---|---|
| `ac_initialized` | Erststart markiert |
| `ac_starter_chosen` | Starterauswahl abgeschlossen |
| `ac_starter_race` | Gewählte Starterrasse |
| `ac_collection` | Kartensammlung `[{id, count}, ...]` |
| `ac_deck` | Aktuelles Deck `["M001", "M001", ...]` |
| `ac_aether_coins` | Aktuelle Münzen |
| `ac_opponents` | Gegner-Status `{1: {unlocked, wins, losses}, ...}` |

---

## KI

Die KI spielt strategisch nach fester Priorität:
1. Fusion aus der Hand beschwören (wenn möglich)
2. Alle Monster aus der Hand ausspielen
3. Zauberkarten aktivieren
4. Fallen setzen
5. Angriff: bevorzugt Monster, die sie zerstören kann; greift sonst direkt an

---

## Technologie

- **Vanilla JavaScript** (ES6+, keine Frameworks)
- **Keine Build-Tools** – direkt im Browser öffnen
- **Kein Backend** – alles clientseitig via `localStorage`
- Läuft in jedem modernen Browser

```bash
# Starten: einfach index.html im Browser öffnen
```
