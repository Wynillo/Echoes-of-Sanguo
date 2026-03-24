# TCG Format v2: Gap-Analyse & Data-Driven Roadmap

## Kontext

Echoes of Sanguo will vollstaendig data-driven werden -- alles ueber die `.tcg`-Datei (ZIP mit JSON + Assets). Aktuell ist nur ein Teil der Daten in `base.tcg` enthalten. Diese Analyse zeigt **ehrlich und faktisch**, was fehlt, wie weit das Projekt entfernt ist, und was Best Practices waeren.

---

## IST-Zustand: Was bereits in der .tcg ist

| Datei | Inhalt | Status |
|-------|--------|--------|
| `cards.json` | Karten-Definitionen (id, level, rarity, type, atk, def, attribute, race, effect) | Gut |
| `xx_cards_description.json` | Lokalisierte Kartennamen/-beschreibungen | Gut |
| `meta.json` | Fusion Recipes, Starter Decks | Gut |
| `opponents/*.json` | Gegner-Konfig (Name, Deck, Belohnungen, Behavior-Referenz) | Gut |
| `img/*.png` | Kartenbilder | Gut |
| `id_migration.json` | String<->Numeric ID Mapping | Gut |

**Fazit: ~40% der Spieldaten sind data-driven. Die Karten selbst sind gut abgedeckt.**

---

## SOLL vs. IST: Vollstaendige Gap-Analyse

### GAP 1: Enum-Metadaten (Rassen, Attribute, Raritaeten) -- KRITISCH

**Problem:** Rassen, Attribute und Raritaeten sind als TypeScript-Enums in `js/types.ts` hartcodiert. Ihre visuellen Metadaten (Farben, Icons, Symbole, Namen) sind ueber **mindestens 6 Dateien** verstreut und teils inkonsistent:

| Daten | Vorkommen in Dateien |
|-------|---------------------|
| Race-Farben | `Card.tsx`, `OpponentScreen.tsx`, `cards.ts` (3x dupliziert!) |
| Race-Icons/Symbole | `cards.ts`, `OpponentScreen.tsx`, `CollectionScreen.tsx`, `DeckbuilderScreen.tsx` |
| Attribut-Farben | `Card.tsx` |
| Raritaets-Farben | `cards.ts` |
| Race-Namen | `cards.ts` (Deutsch hartcodiert, nicht i18n) |

**Was fehlt in der .tcg:**
```json
// types.json (NEU) -- Enum-Definitionen + visuelle Metadaten:
{
  "races": [
    { "id": 1, "key": "dragon", "color": "#8040c0", "icon": "\ud83d\udc32", "symbol": "\u26a1" }
  ],
  "attributes": [
    { "id": 1, "key": "light", "color": "#c09000", "symbol": "\u2600" }
  ],
  "rarities": [
    { "id": 1, "key": "common", "color": "#aaa" }
  ],
  "cardTypes": [
    { "id": 1, "key": "monster" }
  ]
}
```

**Aufwand:** Mittel (~3-5 Tage). Loader erweitern + alle 6+ Dateien refactoren.
**Effekt:** Ermoeglicht custom Rassen/Attribute in Mod-TCGs.

**Betroffene Dateien:**
- `js/types.ts` -- Enums durch dynamisch geladene Typen ersetzen oder ergaenzen
- `js/cards.ts` -- `RARITY_COLOR`, `RARITY_NAME`, `RACE_ICON`, `RACE_NAME`, `ATTR_SYMBOL`, `ATTR_NAME` aus types.json laden
- `js/react/components/Card.tsx` -- `TYPE_LABEL`, `RACE_ABBR`, `RACE_COLORS`, `ATTR_ORB_COLORS`, `TYPE_CSS`, `ATTR_CSS` aus types.json
- `js/react/screens/OpponentScreen.tsx` -- `RACE_COLORS`, `RACE_SYMBOL` aus types.json
- `js/react/screens/StarterScreen.tsx` -- `RACE_INFO`, `RACE_TO_NUM` aus types.json
- `js/react/screens/CollectionScreen.tsx` -- `RACE_FILTER_BTNS`, Rarity-Labels aus types.json
- `js/react/screens/DeckbuilderScreen.tsx` -- `RACE_FILTERS`, `TYPE_FILTERS`, `TYPE_LABEL`, Rarity-Labels aus types.json
- `js/tcg-format/tcg-loader.ts` -- types.json parsen und bereitstellen
- `js/tcg-format/tcg-validator.ts` -- types.json validieren
- `js/tcg-format/tcg-builder.ts` -- types.json erzeugen
- `js/tcg-format/generate-base-tcg.ts` -- types.json in base.tcg aufnehmen

---

### GAP 2: AI Behavior Profiles -- HOCH

**Problem:** 5 AI-Profile (`default`, `aggressive`, `defensive`, `smart`, `cheating`) sind reine TypeScript-Objekte in `js/ai-behaviors.ts`. Gegner referenzieren sie per String-Key, aber die Definition ist Code.

**Was fehlt in der .tcg:**
```json
// ai/behaviors.json (NEU):
{
  "aggressive": {
    "fusionFirst": true,
    "fusionMinATK": 0,
    "summonPriority": "highestATK",
    "positionStrategy": "aggressive",
    "battleStrategy": "aggressive",
    "defaultSpellActivation": "always"
  },
  "defensive": {
    "fusionFirst": true,
    "fusionMinATK": 2000,
    "summonPriority": "highestDEF",
    "positionStrategy": "defensive",
    "battleStrategy": "conservative",
    "defaultSpellActivation": "smart"
  }
}
```

**Realitaet:** Die Profiles sind bereits rein deklarativ (Booleans, Strings, Zahlen). Die Serialisierung in JSON ist trivial -- die Auswertungslogik (`chooseSummon()`, `chooseAttack()` etc.) bleibt natuerlich im Code.

**Aufwand:** Niedrig (~1-2 Tage). Die Datenstruktur existiert praktisch schon.

**Betroffene Dateien:**
- `js/ai-behaviors.ts` -- Profile aus .tcg laden statt hartcodieren, Fallback auf defaults
- `js/tcg-format/tcg-loader.ts` -- `ai/behaviors.json` parsen
- `js/tcg-format/tcg-builder.ts` -- `ai/behaviors.json` erzeugen
- `js/tcg-format/generate-base-tcg.ts` -- AI-Profile in base.tcg aufnehmen

---

### GAP 3: Story/Campaign-Graph -- FEHLT KOMPLETT

**Problem:** Es gibt **kein Story-System**. Progression ist rein linear: Gegner 1 -> 2 -> ... -> 10. `OPPONENT_COUNT=10` und die Unlock-Logik sind in `progression.ts` hartcodiert.

**Vorgeschlagene Datenstruktur (Best Practice: Slay the Spire / FE Heroes / Yu-Gi-Oh FM Ansatz):**

```json
// campaign.json (NEU):
{
  "chapters": [
    {
      "id": "ch1",
      "nodes": [
        {
          "id": "n1",
          "type": "duel",
          "opponentId": 1,
          "position": { "x": 100, "y": 200 },
          "unlockCondition": null,
          "rewards": { "coins": 100, "unlocks": ["n2", "n3"] }
        },
        {
          "id": "n2",
          "type": "duel",
          "opponentId": 2,
          "position": { "x": 250, "y": 150 },
          "unlockCondition": { "type": "nodeComplete", "nodeId": "n1" }
        },
        {
          "id": "n3",
          "type": "story",
          "dialogueKeys": ["dialog_ch1_n3_1", "dialog_ch1_n3_2"],
          "unlockCondition": { "type": "nodeComplete", "nodeId": "n1" }
        },
        {
          "id": "n4",
          "type": "duel",
          "opponentId": 3,
          "unlockCondition": {
            "type": "allComplete",
            "nodeIds": ["n2", "n3"]
          }
        },
        {
          "id": "boss1",
          "type": "duel",
          "opponentId": 5,
          "unlockCondition": { "type": "nodeComplete", "nodeId": "n4" },
          "rewards": { "coins": 500, "cards": ["M025"], "unlocks": ["ch2"] }
        }
      ]
    }
  ]
}
```

**Node-Typen:**
- `duel` -- Kampf gegen Gegner
- `story` -- Dialog/Cutscene (referenziert i18n-Keys)
- `reward` -- Belohnung ohne Kampf
- `shop` -- Spezieller Shop
- `branch` -- Verzweigung (Spieler waehlt Pfad)

**Unlock-Conditions:**
- `nodeComplete` -- einzelner Node abgeschlossen
- `allComplete` -- alle genannten Nodes abgeschlossen
- `anyComplete` -- mindestens einer der genannten Nodes
- `cardOwned` -- Spieler besitzt bestimmte Karte
- `winsCount` -- N Siege insgesamt

**Lokalisierung:** Separate `xx_campaign.json` Dateien fuer uebersetzte Texte (Chapter-Titel, Dialog-Texte).

**Aufwand:** Hoch (~2-3 Wochen). Komplett neues System: Datenstruktur, Loader, UI (Map-Screen), Progression-Tracking.

**Betroffene Dateien (neu + bestehend):**
- `js/tcg-format/tcg-loader.ts` -- campaign.json parsen
- `js/tcg-format/tcg-validator.ts` -- campaign.json validieren (Graph-Integritaet)
- `js/tcg-format/tcg-builder.ts` -- campaign.json erzeugen
- `js/progression.ts` -- Campaign-Graph statt linearer Unlock-Logik
- `js/react/screens/` -- Neuer CampaignScreen / MapScreen
- `js/react/contexts/` -- CampaignContext fuer Graph-State
- `locales/de.json`, `locales/en.json` -- Dialog-Keys

---

### GAP 4: Shop/Pack-System -- MITTEL

**Problem:** 4 Pack-Typen mit Preisen, Icons, Farben und Raritaets-Verteilungen sind in `pack-logic.ts` und `ShopScreen.tsx` hartcodiert.

**Was fehlt in der .tcg:**
```json
// shop.json (NEU):
{
  "packs": [
    {
      "id": "starter",
      "price": 200,
      "icon": "\u2726",
      "color": "#4080a0",
      "slots": [
        { "count": 5, "pool": "common" },
        { "count": 2, "pool": "uncommon" },
        { "count": 1, "pool": "rare" },
        { "count": 1, "pool": "guaranteed_rare_plus",
          "distribution": { "rare": 0.75, "superRare": 0.20, "ultraRare": 0.05 }
        }
      ]
    },
    {
      "id": "race",
      "price": 350,
      "icon": "\u2694",
      "color": "#a06020",
      "slots": [
        { "count": 5, "pool": "common" },
        { "count": 2, "pool": "uncommon" },
        { "count": 1, "pool": "rare" },
        { "count": 1, "pool": "guaranteed_rare_plus",
          "distribution": { "rare": 0.75, "superRare": 0.20, "ultraRare": 0.05 }
        }
      ],
      "filter": "byRace"
    },
    {
      "id": "aether",
      "price": 500,
      "icon": "\u25c8",
      "color": "#2a7848",
      "slots": [
        { "count": 5, "pool": "common" },
        { "count": 2, "pool": "uncommon" },
        { "count": 1, "pool": "rare" },
        { "count": 1, "pool": "guaranteed_rare_plus",
          "distribution": { "rare": 0.75, "superRare": 0.20, "ultraRare": 0.05 }
        }
      ]
    },
    {
      "id": "rarity",
      "price": 600,
      "icon": "\u2605",
      "color": "#c0a020",
      "slots": [
        { "count": 7, "pool": "rare" },
        { "count": 2, "pool": "guaranteed_sr_plus",
          "distribution": { "rare": 0.55, "superRare": 0.30, "ultraRare": 0.15 }
        }
      ]
    }
  ],
  "currency": { "name": "jade_coins", "icon": "\u25c8" }
}
```

**Aufwand:** Niedrig-Mittel (~2-3 Tage).

**Betroffene Dateien:**
- `js/react/utils/pack-logic.ts` -- Verteilung aus shop.json laden
- `js/react/screens/ShopScreen.tsx` -- Pack-Daten aus shop.json
- `js/tcg-format/tcg-loader.ts` -- shop.json parsen
- `js/tcg-format/tcg-builder.ts` -- shop.json erzeugen

---

### GAP 5: Game Rules als Daten -- NIEDRIG-MITTEL

**Problem:** Spielregeln sind als Konstanten in `engine.ts` und Screens verteilt:

| Regel | Wert | Ort |
|-------|------|-----|
| Starting LP | 8000 | `engine.ts:209`, `GameScreen.tsx:51` |
| Hand Limit (Draw) | 10 | `engine.ts:110` |
| Hand Limit (End) | 8 | `engine.ts:111` |
| Field Zones | 5 | `GameScreen.tsx:14` |
| Max Deck Size | 40 | `DeckbuilderScreen.tsx:14` |
| Max Card Copies | 3 | `DeckbuilderScreen.tsx:15` |
| Phoenix Penalty | -500 ATK | `engine.ts:634` |

**Was fehlt in der .tcg:**
```json
// rules.json (NEU):
{
  "startingLP": 8000,
  "handLimitDraw": 10,
  "handLimitEnd": 8,
  "fieldZones": 5,
  "maxDeckSize": 40,
  "maxCardCopies": 3,
  "drawPerTurn": 1,
  "phoenixRevivePenalty": -500
}
```

**Best Practice Einschaetzung:** Kommerzielle TCGs (MTG Arena, Hearthstone) haben Regeln NICHT in Datendateien. Grund: Regelaenderungen erfordern fast immer Code-Aenderungen. **Empfehlung: Nur numerische Konstanten externalisieren, nicht die Regellogik selbst.**

**Aufwand:** Niedrig (~1 Tag).

**Betroffene Dateien:**
- `js/engine.ts` -- Konstanten aus rules.json lesen (`HAND_LIMIT_DRAW`, `HAND_LIMIT_END`, LP)
- `js/react/screens/GameScreen.tsx` -- `FIELD_ZONES`, `START_LP` aus rules.json
- `js/react/screens/DeckbuilderScreen.tsx` -- `MAX_DECK`, `MAX_COPIES` aus rules.json
- `js/tcg-format/tcg-loader.ts` -- rules.json parsen

---

### GAP 6: Theme/Assets -- KOSMETISCH

**Problem:** Hintergrund-Bilder (`title-bg.png`), Farb-Schema (CSS-Variablen), Audio-Dateien sind in `public/` und `css/` hartcodiert.

**Was theoretisch in die .tcg koennte:**
```
theme/ (NEU):
  background.png
  card-back.png
  theme.json: { "primaryColor": "#c8a848", "bgColor": "#060e0a" }
audio/ (NEU):
  battle.mp3
  victory.mp3
```

**Best Practice:** Die meisten TCG-Engines trennen "Game Data" von "Theme/Skin". Themes sind ueblicherweise ein separates Asset-Bundle, kein Teil der Kartendaten. **Empfehlung: Optionales `theme/`-Verzeichnis in der .tcg, aber als v3-Feature.**

**Aufwand:** Mittel (~1 Woche). Loader + CSS-Variable-Injection.

---

### GAP 7: Opponent-Lokalisierung -- NIEDRIG

**Problem:** Gegner-Namen (`"Lehrling Finn"`), Titel (`"Krieger-Lehrling"`), Flavor-Texte sind nur auf Deutsch in `opponents/*.json`. Nicht ueber i18n lokalisierbar.

**Loesung:** Analog zu `xx_cards_description.json` -> `xx_opponents_description.json`:
```json
[
  { "id": 1, "name": "Apprentice Finn", "title": "Warrior Apprentice", "flavor": "An inexperienced fighter..." }
]
```

**Aufwand:** Niedrig (~1 Tag).

**Betroffene Dateien:**
- `js/tcg-format/tcg-loader.ts` -- `xx_opponents_description.json` parsen
- `js/tcg-format/tcg-validator.ts` -- Neue Datei validieren
- `opponents/*.json` -- `name`/`title`/`flavor` als Fallback behalten

---

### GAP 8: Effect System Extensibility -- LANGFRISTIG

**Problem:** Effekt-Typen (`dealDamage`, `buffAtkRace`, `passive_piercing` etc.) sind als JavaScript-Funktionen in `effect-registry.ts` implementiert. Neue Effekte erfordern Code-Aenderungen.

**Realitaet:** Das ist bei **allen** kommerziellen TCGs so. Hearthstone und MTG Arena haben eine Script-Engine (Lua/C#), aber die ist extrem komplex.

**Optionen:**
1. **Status Quo beibehalten** (empfohlen kurzfristig) -- Effekt-Strings in .tcg referenzieren Code-Funktionen. Fuer ein Indie-Projekt mit 350 Karten voellig ausreichend.
2. **Deklarativer DSL-Ausbau** (mittelfristig) -- Die bestehende Effekt-Notation (`onSummon:dealDamage(opponent,300)`) zu einer Mini-Sprache ausbauen mit Conditionals: `if(field.count(race=1)>2):buffAtk(self,500)`
3. **Scripting Engine** (langfristig) -- Lua/WASM-Sandbox. Overkill fuer den aktuellen Scope.

**Aufwand:** Option 1: 0. Option 2: ~2 Wochen. Option 3: ~2-3 Monate.

**Betroffene Dateien:**
- `js/effect-registry.ts` -- Neue Effekt-Typen registrieren
- `js/tcg-format/effect-serializer.ts` -- Erweiterte Syntax parsen

---

## Empfohlene .tcg v2 Archiv-Struktur

```
base.tcg (ZIP)
+-- manifest.json              <-- NEU: Format-Version + Feature-Flags
+-- cards.json                 <-- Bestehend (unveraendert)
+-- types.json                 <-- NEU: Enum-Definitionen + visuelle Metadaten
+-- rules.json                 <-- NEU: Spielregel-Konstanten
+-- campaign.json              <-- NEU: Story-Graph mit Nodes
+-- shop.json                  <-- NEU: Pack-Definitionen + Preise
+-- de_cards_description.json  <-- Bestehend
+-- en_cards_description.json  <-- Bestehend
+-- de_ui.json                 <-- NEU: Lokalisierte UI-Strings (Race-Namen, etc.)
+-- en_ui.json                 <-- NEU: Lokalisierte UI-Strings
+-- de_opponents.json          <-- NEU: Lokalisierte Gegner-Texte
+-- en_opponents.json          <-- NEU: Lokalisierte Gegner-Texte
+-- de_campaign.json           <-- NEU: Lokalisierte Story-Texte
+-- en_campaign.json           <-- NEU: Lokalisierte Story-Texte
+-- id_migration.json          <-- Bestehend
+-- meta.json                  <-- Bestehend (Fusion Recipes, Starter Decks)
+-- opponents/                 <-- Bestehend (mechanische Daten)
|   +-- opponent_1.json
|   +-- ...
+-- ai/                        <-- NEU: AI Behavior Profiles
|   +-- behaviors.json
+-- img/                       <-- Bestehend
|   +-- 1.png
|   +-- ...
+-- theme/                     <-- NEU (optional, v3)
    +-- background.png
    +-- theme.json
```

**manifest.json:**
```json
{
  "formatVersion": 2,
  "name": "Echoes of Sanguo -- Base Set",
  "author": "Wynillo",
  "features": ["campaign", "shop", "ai_behaviors"],
  "minEngineVersion": "2.0.0"
}
```

---

## Vergleich mit Best Practices (Industrie)

| Aspekt | Hearthstone | MTG Arena | Yu-Gi-Oh FM | Echoes (Ist) | Echoes (Soll) |
|--------|------------|-----------|-------------|--------------|---------------|
| Karten als Daten | Protobuf | JSON | ROM | JSON | Bleibt |
| Effekte als Daten | Script | Hybrid | Code | Strings->Code | Ausreichend |
| Enums als Daten | Code | Code | Code | Code | Geplant |
| Story als Daten | Ja | Nein | Nein | Nein | Geplant |
| AI als Daten | Code | Code | Code | Code | Geplant |
| Shop als Daten | Server | Server | Nein | Code | Geplant |
| Theme als Daten | Bundles | Bundles | Nein | Nein | Optional |

**Echoes waere mit v2 datengetriebener als die meisten kommerziellen TCGs.** Das ist fuer ein Mod-faehiges Indie-Spiel der richtige Ansatz.

---

## Ehrliche Aufwand-Einschaetzung

| Gap | Prioritaet | Aufwand | Abhaengigkeiten |
|-----|-----------|---------|----------------|
| 1. Enum-Metadaten | KRITISCH | 3-5 Tage | Keine |
| 2. AI Behaviors | HOCH | 1-2 Tage | Keine |
| 3. Campaign-Graph | HOCH | 2-3 Wochen | Gap 7 (Lokalisierung) |
| 4. Shop/Packs | MITTEL | 2-3 Tage | Gap 1 (Raritaeten) |
| 5. Game Rules | NIEDRIG | 1 Tag | Keine |
| 6. Theme Assets | KOSMETISCH | 1 Woche | Keine |
| 7. Opponent-i18n | NIEDRIG | 1 Tag | Keine |
| 8. Effect DSL | LANGFRISTIG | 2+ Wochen | Keine |

**Gesamt fuer v2 (ohne Theme + Effect DSL): ~4-6 Wochen**

---

## Was NICHT in die .tcg gehoert

1. **Battle-Logik / Regelcode** -- Kampfablauf, Phasen-Sequenz, Schadenberechnung. Das ist Engine-Code, kein Daten-Problem.
2. **UI-Layout / CSS** -- Wo Karten auf dem Bildschirm liegen, Animationen, Responsive-Design.
3. **Effect-Implementierungen** -- Die Funktionen hinter `dealDamage()`, `bounceStrongestOpp()`. Nur die Effekt-*Definitionen* (welche Karte welchen Effekt hat) sind Daten.
4. **Netzwerk/Multiplayer-Code** -- Falls je implementiert.
5. **localStorage-Schema** -- Save-Format ist Engine-intern.

---

## Empfohlene Reihenfolge der Implementierung

```
Phase 1 (Foundation):    types.json + rules.json + manifest.json + AI behaviors
Phase 2 (Localization):  Opponent-i18n + UI-String-Externalisierung
Phase 3 (Campaign):      campaign.json + Story-Graph + Map-Screen UI
Phase 4 (Economy):       shop.json + Pack-Definitionen
Phase 5 (Polish):        Theme-Assets (optional)
Phase 6 (Future):        Effect DSL Erweiterung (optional)
```

---

## Issue-Vorschlaege

Die folgenden Issues koennen direkt aus dieser Analyse erstellt werden:

### Phase 1 -- Foundation
- **Issue #1:** `feat(format): add types.json to .tcg for enum metadata (races, attributes, rarities)` -- GAP 1
- **Issue #2:** `refactor(ui): consolidate duplicate race/attribute/rarity display mappings` -- GAP 1 (Vorarbeit)
- **Issue #3:** `feat(format): add rules.json to .tcg for game rule constants` -- GAP 5
- **Issue #4:** `feat(format): add manifest.json with format versioning` -- Infrastruktur
- **Issue #5:** `feat(format): serialize AI behavior profiles into .tcg` -- GAP 2

### Phase 2 -- Localization
- **Issue #6:** `feat(i18n): add opponent localization via xx_opponents_description.json` -- GAP 7
- **Issue #7:** `feat(i18n): externalize UI-level enum labels (race names, type labels) into .tcg` -- GAP 1 Erweiterung

### Phase 3 -- Campaign
- **Issue #8:** `feat(campaign): design and implement campaign.json story graph format` -- GAP 3 (Datenstruktur)
- **Issue #9:** `feat(campaign): add campaign graph loader and validator to tcg-format` -- GAP 3 (Loader)
- **Issue #10:** `feat(campaign): create CampaignScreen with node-based map UI` -- GAP 3 (UI)
- **Issue #11:** `feat(campaign): replace linear progression with graph-based campaign progression` -- GAP 3 (Integration)

### Phase 4 -- Economy
- **Issue #12:** `feat(format): add shop.json to .tcg for pack definitions and pricing` -- GAP 4
- **Issue #13:** `refactor(shop): load pack types and rarity distributions from shop.json` -- GAP 4

### Phase 5 -- Polish (Optional)
- **Issue #14:** `feat(format): add optional theme/ directory for visual customization` -- GAP 6

### Phase 6 -- Future (Optional)
- **Issue #15:** `feat(effects): extend effect DSL with conditional expressions` -- GAP 8
