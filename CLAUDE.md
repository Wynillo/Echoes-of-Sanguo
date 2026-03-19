# Aetherial Clash — Codeüberblick für KI-Sessions

Ein browserbasiertes 1v1-Kartenspiel (Yu-Gi-Oh-Stil). Kein Build-Step, kein Framework — reines Vanilla-JS/HTML/CSS.

## Dateistruktur & Ladereihenfolge

```
index.html          ← Alle Screens als div-Blöcke; kein Routing
css/
  style.css         ← Dark-Fantasy-Design, CSS-Variablen in :root
  progression.css   ← Shop, Sammlung, Deckbuilder
js/
  cards.js          ← Basis-Kartendatenbank (50 Karten, M001–M049 + Spells/Traps)
                       Konstanten: TYPE, ATTR, RACE, RARITY
                       FUSION_RECIPES[], PLAYER_DECK_IDS[], OPPONENT_CONFIGS[]
  cards-data.js     ← 672 weitere Karten (IIFE, erweitert CARD_DB global)
                       Effekt-Fabriken: fxBurnSummon, fxPiercing, fxCanDirectAttack, …
  progression.js    ← localStorage-Wrapper (Münzen, Sammlung, Siege)
  engine.js         ← GameEngine-Klasse: gesamte Spiellogik
  screens.js        ← Gegner-/Starterdeckauswahl, Sammlungs-UI
  shop.js           ← Booster-Pack-System
  ui.js             ← Rendering, Event-Handler, Animationen
```

**Wichtig:** `cards-data.js` läuft als IIFE und schreibt in das globale `CARD_DB`-Objekt, das `cards.js` anlegt.

---

## Game Engine (`engine.js`)

### Globales Debug-Objekt
```javascript
AetherialClash.debug = true  // Browser-Konsole: farbige Logs (PHASE|AI|BATTLE|EFFECT|…)
AetherialClash.downloadLog() // Lädt JSON-Log herunter
```

### Kernklassen

**`FieldCard`** — Monster auf dem Spielfeld
```javascript
fc.card            // Karten-Objekt aus CARD_DB
fc.position        // 'atk' | 'def'
fc.hasAttacked     // Boolean — pro Zug zurückgesetzt
fc.summonedThisTurn // Boolean — Beschwerungszeit (kann nicht angreifen)
fc.piercing        // Passiv: Überschussschaden bei DEF-Monster
fc.cannotBeTargeted// Passiv: kann nicht als Ziel gewählt werden
fc.canDirectAttack // Passiv: darf direkt angreifen (auch wenn Gegner Monster hat)
fc.tempATKBonus / fc.permATKBonus / fc.permDEFBonus
fc.effectiveATK()  // ATK + Boni
fc.effectiveDEF()
```

**`FieldSpellTrap`** — Zauber/Falle auf dem Spielfeld
```javascript
fst.card / fst.faceDown / fst.used
```

### Spielzustand (`game.state`)
```javascript
{
  phase: 'draw'|'main'|'battle'|'end',
  turn: Number,
  activePlayer: 'player'|'opponent',
  player:   { lp, deck[], hand[], field:{ monsters[5], spellTraps[5] }, graveyard[], normalSummonUsed },
  opponent: { … }  // gleiche Struktur
}
```

### Wichtige Engine-Methoden
| Methode | Beschreibung |
|---|---|
| `initGame(deckIds, oppConfig)` | Spiel starten |
| `summonMonster(owner, handIdx, zone, pos, faceDown)` | Normal-Beschwörung |
| `specialSummon(owner, card, zone?)` | Spezialbeschwörung |
| `setSpellTrap(owner, handIdx, zone)` | Verdeckt setzen |
| `activateSpell(owner, handIdx, targetInfo?)` | Zauber aktivieren |
| `attack(atkOwner, atkZone, defZone)` | Monsterangriff (async) |
| `attackDirect(atkOwner, atkZone)` | Direktangriff (async); bei `canDirectAttack` erlaubt auch mit Gegnermonstern |
| `advancePhase()` | main→battle→end→(endTurn) |
| `endTurn()` | Zug beenden, KI starten |
| `dealDamage(target, amount)` | LP abziehen + Siegprüfung |
| `gainLP(target, amount)` | LP heilen |
| `drawCard(owner, count)` | Karte(n) ziehen |
| `performFusion(owner, idx1, idx2)` | Fusion beschwören |
| `_destroyMonster(owner, zone, reason, byOwner)` | Monster zerstören + Effekte auslösen |
| `_triggerEffect(fc, owner, trigger, zone)` | onSummon / onDestroyByBattle auslösen |

### Effekt-System
```javascript
// Trigger-Typen:
{ trigger: 'onSummon',          apply(gameState, owner){ … } }
{ trigger: 'onDestroyByBattle', apply(gameState, owner){ … } }
{ trigger: 'onDestroyByOpponent',apply(gameState, owner){ … } }
{ trigger: 'passive', piercing:true }          // Durchbohrer
{ trigger: 'passive', cannotBeTargeted:true }  // Untargetable
{ trigger: 'passive', canDirectAttack:true }   // Direktangreifer
```
Karten-Traps haben zusätzlich `trapTrigger: 'onAttack'|'onOwnMonsterAttacked'|'manual'`.

---

## UI (`ui.js`)

### Rendering
```javascript
renderAll(state)           // Kompletter Re-Render (wird von engine.ui.render() aufgerufen)
renderMonsterZone(owner, monsters, state)
renderSpellTrapZone(owner, spellTraps, state)
renderHand(hand, state)
buildFieldCard(fc, owner, zone, state)  // Gibt DOM-Element zurück
```

### Selektions-State (global `SEL`)
```javascript
SEL.mode          // null | 'attack' | 'fusion1' | 'spell-target' | 'trap-target' | 'grave-target'
SEL.attackerZone  // Zone des gewählten Angreifers
SEL.handIndex     // Gewählte Handkarte
resetSel()        // Alles zurücksetzen + CSS-Klassen entfernen
```

### Wichtige Event-Funktionen
| Funktion | Auslöser |
|---|---|
| `onAttackerSelect(zone, state)` | Spieler klickt eigenes Monster in Kampfphase |
| `onDefenderSelect(zone)` | Spieler klickt Gegner-Monster als Ziel |
| `onOwnFieldCardClick(fc, zone, state)` | Eigenes Monster in Hauptphase → Aktionsmenü |
| `onHandCardClick(card, index, state)` | Handkarte klicken |

### UI-Callbacks (an GameEngine übergeben)
```javascript
uiCallbacks.render(state)
uiCallbacks.log(msg)
uiCallbacks.prompt(opts)        // Trap-Bestätigungs-Modal (gibt Promise zurück)
uiCallbacks.showActivation(card, text)
uiCallbacks.playAttackAnimation(ao, az, dO, dZ)
uiCallbacks.onDraw(owner, count)
uiCallbacks.onDuelEnd(result, oppId)
```

---

## Spielfeld-Layout (HTML/CSS)

```
#game-screen (CSS-Grid: field | battle-log / hand-area / action-bar)
  └── #field (position:relative, Grid: opponent-side / field-middle / player-side)
        ├── #opp-info-overlay    (position:absolute, oben links)
        ├── .opponent-side       (flex column: opp-spelltrap-zone → opponent-monster-zone)
        ├── #btn-direct-attack   (position:absolute, 42% Höhe, zentriert — Hover-Button)
        ├── #field-middle        (Friedhöfe + Phasen-Anzeige)
        ├── .player-side         (flex column: player-monster-zone → player-spelltrap-zone)
        └── #player-info-overlay (position:absolute, unten links)
```

**Wichtig:** `.opponent-side` nutzt `flex-direction: column` (NICHT `column-reverse`), damit die Monster-Zone des Gegners der Spieler-Monster-Zone direkt gegenübersteht.

Karten-Größen per CSS-Variablen: `--card-w/h` (Spieler), `--card-w-opp/h-opp` (Gegner, kleiner).

---

## Kartendatenbank

**`cards.js`** legt `CARD_DB = {}` an. Karten-IDs:
- `M001–M049` Basismonster (inkl. Fusionen)
- `S001–S009` Zauberkarten
- `T001–T006` Fallen

**`cards-data.js`** ergänzt mit `E{Rasse}{Nr}`:
- Rassen-Prefixe: `EFE` Feuer, `EDR` Drache, `EKR` Krieger, `EDA` Dämon, `EWA` Wasser, `EEI` Eis, `ELI` Licht, `EWI` Wind, `EPF` Pflanze, `EST` Stein, `EUN` Untot, `EMA` Magier

**Effekt-Fabriken in `cards-data.js`:**
```javascript
fxBurnSummon(n)         fxHealSummon(n)       fxDrawSummon(n)
fxBurnDestroy(n)        fxHealDestroy(n)      fxDrawDestroy(n)
fxBuffRaceSummon(race,n) fxDebuffAllOpp(atkD,defD)
fxBounceOppSummon()     fxReviveOwnMonster()
fxPiercing()            fxUntargetable()      fxCanDirectAttack()
```

---

## KI (`engine.js → _aiTurn()`)

Prioritäten in der Kampfphase:
1. Direktangriff wenn Spieler keine Monster hat
2. Stärkstes Monster angreifen, das zerstört werden kann
3. Schwächstes Monster angreifen (aggressiv, auch auf Verlust)

---

## Häufige Aufgaben

**Neue Karte hinzufügen:** Eintrag in `cards.js` (CARD_DB) oder `cards-data.js` (Array-Format)

**Neuen Effekt-Typ implementieren:**
1. Trigger in `engine._triggerEffect()` oder `FieldCard`-Konstruktor registrieren
2. Factory-Funktion in `cards-data.js` anlegen
3. Falls passiv: Flag in `FieldCard` ergänzen

**UI-Änderungen:** `ui.js` → `renderAll` / `buildFieldCard`; CSS in `style.css`

**Neue KI-Logik:** `engine._aiTurn()` (async, ~Zeile 799)
