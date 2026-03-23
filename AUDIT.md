# Audit Report – Echoes of Sanguo

## Executive Summary

Das Projekt ist ein ambitioniertes, browserfähiges Kartenspiel mit solider Gesamtarchitektur
und funktionierendem Kern. Die Game Engine (Kampf, Fusion, Phasenmanagement) ist gut strukturiert
und durch ~60 Unit-Tests abgedeckt. Das TCG-Binärformat ist das stärkste Element des Projekts:
klar validiert, sauber separiert, mit einer durchdachten Effekt-DSL.

Stärkste Baustellen: (1) echte Logikfehler in `effect-registry.ts` und `engine.ts`, die still
falsche Spielzustände erzeugen; (2) fehlende TypeScript-Typsicherheit bei gleichzeitig
`strict: false` — eine gefährliche Kombination; (3) kritische Testlücken im Spell/Trap-System
und der KI; (4) React-Anti-Pattern (module-level mutable state, zu große Komponenten) in der UI.

---

## Code Quality

### Kritisch 🔴

**1. Logikfehler: `tempDefBonus` schreibt in `permDEFBonus`**
- `js/effect-registry.ts`, Zeile ~184
- Die `tempDefBonus`-Implementierung schreibt auf `fc.permDEFBonus` statt `fc.tempDEFBonus`.
  Jeder "temporäre" DEF-Buff ist faktisch permanent. Das ist ein stiller Gameplay-Bug.
- Außerdem: `FieldCard.effectiveDEF()` (`engine.ts:161`) addiert nur `permDEFBonus`, nie
  `tempDEFBonus`. Das Feld existiert in den Typen, wird aber weder befüllt noch gelesen.
  `tempDEFBonus` ist faktisch dead code — bis der Bug oben gefixt wird.

**2. Hard-coded Karten-IDs in der KI**
- `js/engine.ts`, Zeile ~890–921 (`_aiMainPhase`)
- Die KI entscheidet per `card.id === 'S001'`, ob ein Zauber aktiviert wird.
  Wenn Karten umbenannt oder verschoben werden, bricht die KI lautlos.
  Klassischer AI-Code-Smell: Logik durch Bezeichner statt durch Eigenschaften der Karte gesteuert.

**3. `onDestroyByBattle`-Trigger fehlt für den Angreifer**
- `js/engine.ts`, `_resolveBattle()`, Zeile ~590–600
- Wenn der Angreifer durch Kampf zerstört wird (ATK < DEF des Gegners), wird sein
  `onDestroyByBattle`-Effekt nicht gefeuert. Nur der Sieger-Effekt wird getriggert.
  Karten, die auf ihrer eigenen Zerstörung reagieren sollen, funktionieren als Angreifer nicht.

**4. `_resetMonsterFlags()` setzt `tempDEFBonus` nicht zurück**
- `js/engine.ts`, Zeile ~730–734
- Per-Zug-Flags werden zurückgesetzt: `tempATKBonus`, `hasAttacked`, `summonedThisTurn`.
  `tempDEFBonus` fehlt. Sobald Bug #1 gefixt ist, ohne diesen Fix zu machen, bleiben
  DEF-Buffs dauerhaft bestehen — dann ist das Verhalten noch schlimmer als jetzt.

---

### Verbesserungswürdig 🟡

**5. `strict: false` in tsconfig.json**
- `tsconfig.json`, Zeile 6
- Deaktiviert implizite `any`-Fehler, strict function types, strict bind/call/apply.
  `strictNullChecks: true` ist gesetzt, aber der Rest fehlt. Das erzeugt ein falsches
  Sicherheitsgefühl: TypeScript prüft, aber längst nicht alles.

**6. Fehlende Parametertypen in engine.ts**
- Betroffen: `_shuffle()`, `summonMonster()`, `_destroyMonster()`, `changePosition()`,
  `_buildSpellContext()`, `_triggerEffect()`, u.v.m.
- Funktionen mit 3–5 Parametern ohne Typen in einem 1021-Zeilen-File sind
  refactor-feindlich und fehleranfällig. `strict: true` würde das erzwingen.

**7. `any`-Typen an kritischen Stellen**
- `FieldSpellTrap.card: any` (`engine.ts:167`) — sollte `CardData` sein
- `GameEngine.ui: any` (`engine.ts:183`) — ist ein Alias von `uiCallbacks: UICallbacks`, also redundant und ungetypt
- `GameEngine._trapResolve: any` — sollte `((result: boolean) => void) | null` sein
- `effect-registry.ts:33–40`: 4× `as any` in `resolveStatTarget()` hebeln jede Typsicherheit aus
- `GameScreen.tsx`: mehrfach `any` für `gameState`, `card`, Callback-Parameter

**8. KI-Loop-Bug in `_aiPlaceTraps()`**
- `js/engine.ts`, Zeile ~939
- `i = Math.min(i, ai.hand.length)` nach dem Entfernen einer Handkarte setzt `i` auf
  den neuen `hand.length`, dann `i--` → ein Index wird übersprungen.
  Bei mehreren Fallen im Deck bleiben Karten liegen, die gespielt werden sollten.

**9. Async-Inkonsistenz bei `showActivation`**
- `activateSpellFromField()` awaitet `showActivation`; `_triggerEffect()` tut es nicht.
  Effekte bei getriggertem `onSummon` zeigen die Animations-Einblendung nicht korrekt an.

**10. `ProgressionContext.tsx` — useEffect-Dependency-Problem**
- `js/react/contexts/ProgressionContext.tsx`, Zeile ~43
- `useEffect` mit `[refresh, loadDeck]` in den Dependencies löst bei jeder Mutation
  einen neuen Effect aus, der wiederum `refresh`/`loadDeck` aufruft → potenzielle
  Endlosschleife. Funktioniert nur, weil `useCallback` die Referenzen aktuell stabil hält.

**11. `GameScreen.tsx` und `DeckbuilderScreen.tsx` zu groß**
- `GameScreen.tsx`: 409 Zeilen — Spielfeld-Logik, State, Rendering aller 5 Monsterzone,
  Traps, Hand. Sollte in ~5 Sub-Komponenten aufgeteilt werden.
- `DeckbuilderScreen.tsx`: 343 Zeilen; kein `useMemo` für den Filterstack über
  `Object.values(CARD_DB)` → vollständige Neuberechnung bei jedem Keystroke.

**12. `PackOpeningScreen.tsx` — Module-level Mutable State**
- `js/react/screens/PackOpeningScreen.tsx`, Zeile ~13–18
- `_cards` und `_preOpen` sind module-level Variablen als Kommunikationskanal
  zwischen `ShopScreen` und `PackOpeningScreen`. Race-Condition möglich bei schnellen
  Navigation-Übergängen, nicht testbar, verletzt Encapsulation.

**13. `cards-data.ts` — Dead Code**
- `js/cards-data.ts`
- Die Effekt-Fabriken (`fxBurnSummon`, `fxPiercing`, …) werden nirgends mehr importiert.
  Karten sind jetzt im `.tcg`-Format. Die Datei ist Zombie-Code.

**14. Inkonsistente Debuff-Logik**
- `js/effect-registry.ts`, Zeile ~92–112
- `tempDebuffAllOpp` wendet `atkD` nur an wenn truthy, ignoriert `defD` komplett.
  `debuffAllOpp` wendet beide immer an. Die Asymmetrie ist undokumentiert.

---

### Positiv ✅

- **Effektsystem (`effect-registry.ts`)**: Data-driven `EffectDescriptor → IMPL`-Architektur
  ist sauber erweiterbar. `registerEffect()` ermöglicht externe Mods. Kein `switch`-Wald.
- **ProgressionContext-Isolation**: `localStorage` wird ausschließlich über `progression.ts`
  angesprochen. Keine React-Komponente greift direkt darauf zu.
- **Fehlerbehandlung in `engine.ts`**: `_aiTurn()` hat Recovery-Logic bei Exception;
  alle Effekt-Ausführungen sind try-catched mit kontextreichem Logging.
- **`_promptPlayerTraps()` mit Timeout**: 8-Sekunden-Race-Condition-Protection verhindert
  UI-Freeze bei nicht-respondendem Prompt. Klar durchdacht.
- **Fisher-Yates in `_shuffle()`**: Korrekte Implementierung, nicht die naive falsche.
- **`FieldCard`-Deep-Copy im Konstruktor**: Verhindert Shared-Mutations-Bugs bei Effekten.

---

## Architektur

### Kritisch 🔴

**1. Kein TCG-Format-Versioning**
- `js/tcg-format/` (alle Dateien)
- Die `base.tcg`-Datei hat kein Versionsfeld. Wenn das Schema von `cards.json` bricht
  (z.B. Feldumbenennung), scheitert der Load mit einer Kaskade von Validator-Fehlern,
  ohne Hinweis auf inkompatible Format-Version. Eine Migrationsstrategie fehlt vollständig.

**2. Blob-URL-Leak in `tcg-loader.ts`**
- `js/tcg-format/tcg-loader.ts`
- `URL.createObjectURL()` wird für jedes Kartenbild aufgerufen (~722 Blobs).
  `revokeTcgImages()` existiert, wird aber in `main.js` nie aufgerufen.
  Bei jedem Reload des TCG-Files akkumulieren sich Blobs im Browser-Speicher.

**3. Dual-Effektsystem ohne klare Abgrenzung**
- Das Projekt hat zwei Effektsysteme parallel:
  - `effect-registry.ts` mit `EffectDescriptor`-basierten IMPL-Funktionen (aktuell)
  - Legacy `apply(game, owner)`-Callbacks (in Kommentaren referenziert, in `cards-data.ts` als Fabriken)
- Neuer Code muss wissen, welches System er verwendet. Keine einheitliche API, kein Dokument,
  das erklärt, wann welches System greift.

---

### Verbesserungswürdig 🟡

**4. `engine.ts` mischt Game Logic mit UI-Side-Effects**
- `_triggerEffect()` ruft `ui.showActivation()` direkt auf (Zeile ~682).
  `_destroyMonster()` ruft `ui.render()` auf (Zeile ~649).
  `_resolveBattle()` ruft `ui.playAttackAnimation()` auf.
  Die Engine ist via `UICallbacks`-Injection nicht direkt React-abhängig — das ist korrekt —
  aber Rendering-Trigger mitten in Spiellogik-Methoden erschwert isolierte Tests.

**5. Spell-Aktivierung entfernt Karte vor Effekt-Ausführung**
- `engine.ts`, `activateSpell()`, Zeile ~391
- `st.hand.splice(handIndex, 1)` passiert vor dem Effect-Execute-Aufruf.
  Wenn ein Effekt die Handkarten referenziert (z.B. "zeige alle Karten in der Hand"),
  fehlt die aktivierte Karte bereits. In YGO normalerweise irrelevant, aber fragil.

**6. AI-Strategien hartcodiert, `strategy`-Feld ungenutzt**
- `_aiBattlePhase()` hat feste Prioritäten für alle Gegner.
  `OPPONENT_CONFIGS` enthält ein `strategy`-Feld (laut `types.ts`), das aber nirgends
  für unterschiedliche Kampfverhalten ausgewertet wird. Alle 10 Gegner spielen identisch.

**7. Mod-API ohne Validierung**
- `js/mod-api.ts`
- `window.EchoesOfSanguoMod.CARD_DB` ist eine Live-Referenz. Mods können beliebige
  Daten einfügen; kein Validator wird aufgerufen. Bestehende IDs können silent
  überschrieben werden.

**8. `GameContext.tsx` — `uiCallbacks` mit leerem Dependency-Array**
- `js/react/contexts/GameContext.tsx`, Zeile ~86
- `uiCallbacks` wird einmalig gememoized via `useMemo(…, [])`, referenziert aber Refs
  auf sich ändernde Werte. Das funktioniert via Refs-Trick, ist aber fragil bei Refactors:
  wer das Muster nicht kennt, fügt eine echte Variable ein und wundert sich über stale closures.

---

### Positiv ✅

- **TCG-Format-Validierung**: `card-validator.ts`, `def-validator.ts`, `tcg-validator.ts`
  bilden eine saubere dreistufige Pipeline mit klarer Fehlerberichterstattung.
  Warnings vs. Errors korrekt differenziert (fehlende Images = Warning, kein Crash).
- **Effekt-Serializer DSL**: Das Format `"trigger:action(args);action2(args)"` ist kompakt,
  menschenlesbar und korrekt klammernbewusst geparst. 30+ Effekttypen abgedeckt.
- **Contexts klar getrennt**: Screen / Game / Selection / Modal / Progression — 5 separate
  Contexts, kein God-Context, jeder mit genau einer Verantwortlichkeit.
- **`progression.ts` vollständig isoliert**: Kein React-Import, einfach unit-testbar,
  und tatsächlich getestet (`tests/progression.test.js`).
- **Engine ohne React-Abhängigkeit**: `engine.ts` importiert kein React. UICallbacks sind
  injiziert. Isoliert testbar, und tatsächlich getestet (`tests/engine.core.test.js`).
- **Test-Coverage der kritischen Pfade**: Kampf, Fusion, Summon, Phasenübergänge durch
  ~60 aussagekräftige Unit-Tests abgedeckt — keine reinen Smoke-Tests.

---

## Top-5-Prioritätenliste

### 1. 🔴 Logikbugs in `effect-registry.ts` + `engine.ts` fixen
*Höchster Impact, minimaler Aufwand (~1h), keine Refactoring-Risiken.*
- `effect-registry.ts:184`: `fc.permDEFBonus` → `fc.tempDEFBonus`
- `engine.ts:161`: `effectiveDEF()` um `+ this.tempDEFBonus` ergänzen
- `engine.ts:732`: `_resetMonsterFlags()` um `fc.tempDEFBonus = 0` ergänzen
- `engine.ts:_resolveBattle`: `onDestroyByBattle` auch für zerstörten Angreifer feuern

### 2. 🔴 KI von Hard-coded IDs auf Karten-Eigenschaften umstellen
*Verhindert silent-breaks bei Karten-Umbenennungen (~2–3h).*
- Statt `card.id === 'S001'`: Effekte via `card.effect.actions.some(a => a.type === 'dealDamage')`
  prüfen. Ein `aiHint`-Feld in `TcgCard` wäre noch sauberer.

### 3. 🟡 `tsconfig.json` auf `strict: true` + Typen nachrüsten
*Größter Impact auf langfristige Wartbarkeit (~4–6h, iterativ).*
- `FieldSpellTrap.card: CardData`, `GameEngine.ui: UICallbacks`, `GameEngine._trapResolve`
- Parametertypen in `_shuffle`, `summonMonster`, `_destroyMonster`, `changePosition`, `_triggerEffect`

### 4. 🟡 TCG-Format-Versioning + Blob-URL-Lifecycle
*Verhindert schwer debuggbare Ladeprobleme (~1–2h).*
- `meta.json` um `"version": 1` erweitern; Loader prüft und loggt Mismatch
- `revokeTcgImages()` in `main.js` aufrufen (oder einen expliziten "kein Reload"-Kommentar)

### 5. 🟡 `GameScreen.tsx` aufteilen + `PackOpeningScreen`-State liften
*Verhindert Regressions bei zukünftigen Features (~3–4h).*
- `GameScreen` in Sub-Komponenten: `OpponentField`, `PlayerField`, `HandArea`, `LPPanel`
- `_cards`/`_preOpen` aus module-level in `ShopScreen`-State heben, als Props übergeben

---

## Konkrete Refactoring-Vorschläge

### A) Bug-Fix: `tempDefBonus` (`effect-registry.ts:184` + `engine.ts`)

```typescript
// effect-registry.ts — VORHER (Bug):
case 'tempDefBonus': {
  const fc = resolveStatTarget(desc.target, ctx);
  if (!fc) return;
  fc.permDEFBonus = (fc.permDEFBonus || 0) + desc.value;  // ← schreibt permanent
  break;
}

// NACHHER:
case 'tempDefBonus': {
  const fc = resolveStatTarget(desc.target, ctx);
  if (!fc) return;
  fc.tempDEFBonus = (fc.tempDEFBonus || 0) + desc.value;  // ← korrekt temporär
  break;
}

// engine.ts — effectiveDEF() — VORHER:
effectiveDEF(): number { return Math.max(0, (this.card.def ?? 0) + this.permDEFBonus); }

// NACHHER:
effectiveDEF(): number {
  return Math.max(0, (this.card.def ?? 0) + this.tempDEFBonus + this.permDEFBonus);
}

// engine.ts — _resetMonsterFlags() — ergänzen:
if (fc) {
  fc.tempATKBonus = 0;
  fc.tempDEFBonus = 0;  // ← neu
  fc.hasAttacked = false;
  fc.summonedThisTurn = false;
}
```

### B) Bug-Fix: `onDestroyByBattle` für Angreifer (`engine.ts:_resolveBattle`)

```typescript
// Im ATK-vs-ATK-Branch, wenn Angreifer verliert (effATK < defVal):
this._destroyMonster(atkOwner, atkZone, 'battle', defOwner);
this.dealDamage(atkOwner, dmg);
// Neu: Effekt des zerstörten Angreifers triggern
// (attFC ist bereits vom Feld entfernt, daher card direkt nutzen)
this._triggerEffect(attFC, atkOwner, 'onDestroyByBattle', null);
```

### C) KI: ID-Unabhängige Spell-Aktivierung (`engine.ts:_aiMainPhase`)

```typescript
// VORHER:
const should = (card.id === 'S001' && plr.lp > 800) ||
               (card.id === 'S002' && ai.lp < 5000) ||
               card.id === 'S005';

// NACHHER — eigene Hilfsfunktion außerhalb der Klasse:
function aiShouldActivateNormalSpell(
  card: CardData,
  ai: PlayerState,
  plr: PlayerState
): boolean {
  if (!card.effect?.actions) return true; // kein Effekt bekannt → aktivieren
  const actions = card.effect.actions;
  const dealsDamage = actions.some(a => a.type === 'dealDamage' && a.target === 'opponent');
  const heals       = actions.some(a => a.type === 'gainLP');
  const draws       = actions.some(a => a.type === 'draw');
  if (dealsDamage && plr.lp <= 0) return false;  // wäre Overkill
  if (heals && ai.lp >= 7000) return false;       // LP bereits hoch
  return true;
}
```

### D) `PackOpeningScreen` — Module-State entfernen

```typescript
// VORHER (PackOpeningScreen.tsx):
let _cards: CardData[] = [];
let _preOpen = false;
export function setPackOpeningCards(cards: CardData[], preOpen: boolean) {
  _cards = cards; _preOpen = preOpen;
}

// NACHHER: Props statt module-state
interface PackOpeningProps {
  cards: CardData[];
  preOpen?: boolean;
  onDone: () => void;
}
export function PackOpeningScreen({ cards, preOpen = false, onDone }: PackOpeningProps) {
  // ... cards aus Props, nicht aus module-variable
}

// In ShopScreen: statt navigateTo('pack-opening') mit setPackOpeningCards():
// Option A: Modal mit PackOpeningScreen als Inhalt
// Option B: cards in ProgressionContext/ScreenContext mitgeben
```

### E) TCG-Format-Versioning

```typescript
// public/opponents/meta.json — Feld ergänzen:
{ "version": 1, "title": "base", ... }

// js/tcg-format/tcg-loader.ts — nach meta-Parsing:
const SUPPORTED_TCG_VERSION = 1;
const metaVersion = (meta as any)?.version ?? 0;
if (metaVersion !== SUPPORTED_TCG_VERSION) {
  console.warn(
    `[TCG] Format version mismatch: archive has v${metaVersion}, ` +
    `loader expects v${SUPPORTED_TCG_VERSION}. Cards may fail to load.`
  );
}
```

### F) `FieldSpellTrap` — `card: any` fixen (`engine.ts`)

```typescript
// VORHER:
export class FieldSpellTrap {
  card: any;
  faceDown: boolean;
  used: boolean;
  constructor(card, faceDown = true) {
    this.card = card; this.faceDown = faceDown; this.used = false;
  }
}

// NACHHER:
export class FieldSpellTrap {
  card: CardData;
  faceDown: boolean;
  used: boolean;
  constructor(card: CardData, faceDown = true) {
    this.card = card; this.faceDown = faceDown; this.used = false;
  }
}
```
