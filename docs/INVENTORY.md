# Game Element Inventory — Echoes of Sanguo

**Status:** 2026-04-16  
**Phase:** 1 complete — All elements inventoried and grouped.  
**Purpose:** Central reference for documenting all game elements.

---

## Overview

| Group | Title | Files | Lines | Priority | Estimated Doc Time |
|--------|-------|---------|-------|----------|---------------------|
| **G1** | Engine-Core | 10 | ~4,533 | High | 3–4h |
| **G2** | Effect System | 5 | ~1,425 | High | 4–5h |
| **G3** | AI System | 3 | ~1,483 | Medium | 2–3h |
| **G4** | Cards & Field | 5 | ~691 | High | 2–3h |
| **G5** | Opponents & Decks | 3 (TCG-internal) | n/a | Medium | 1–2h |
| **G6** | Campaign | 5 | ~693 | Medium | 2h |
| **G7** | Shop & Progression | 2 | ~785 | Medium | 2h |
| **G8** | Fusions | (in G4, G11) | — | Low | 1h |
| **G9** | UI Architecture | 30+ (React) | ~10k+ | Medium | 3–4h |
| **G10** | Mod API | 2 | ~80 | High | 2h |
| **G11** | TCG Format | 4 + External | ~560 | High | 2–3h |

**Total:** ~20k+ Lines Code, ~24–35h writing effort for complete documentation.

---

## Group G1: Engine-Core

**Files:**

| File | Lines | Responsibility |
|-------|-------|---------------|
| `src/engine.ts` | ~1,218 | GameEngine: Phases, Summoning, Battle, Fusion, Win-Check |
| `src/field.ts` | 104 | FieldCard (Monster on board), FieldSpellTrap |
| `src/rules.ts` | 28 | GAME_RULES constants (LP, Hand limit, Zones) |
| `src/trigger-bus.ts` | 35 | TriggerBus: Event emitter for extended triggers |
| `src/effect-registry.ts` | 982 | EFFECT_REGISTRY: 60+ Effect Actions, Cost-Payment |
| `src/cards.ts` | 277 | CARD_DB, FUSION_RECIPES, makeDeck(), checkFusion() |
| `src/types.ts` | 405 | All TypeScript interfaces (GameState, CardData, UICallbacks) |
| `src/debug-logger.ts` | 101 | EchoesOfSanguo debug logging |
| `src/ai-behaviors.ts` | 623 | AI-Behavior-Profile, Scoring, Targeting |
| `src/ai-orchestrator.ts` | 760 | aiTurn() sequence, Decision-Making |

**Important Types:**
- `GameEngine` — Main class, contains entire game state
- `GameState` — { phase, turn, activePlayer, player, opponent, log }
- `PlayerState` — { lp, deck, hand, field, graveyard, normalSummonUsed }
- `FieldCard` — Running monster with bonuses, flags, equipped cards
- `FieldSpellTrap` — Spell/Trap on field
- `UICallbacks` — Interface for Engine→UI communication

**Engine-Core Doc:** → `docs/engine-core.md`

---

## Group G2: Effect System

**Files:**

| File | Lines | Responsibility |
|-------|-------|---------------|
| `src/effect-registry.ts` | 982 | All 60+ Effect Actions, executeEffectBlock() |
| `src/effect-serializer.ts` | 21 | Re-export from @wynillo/tcg-format (serialize/deserialize) |
| `src/effect-text-builder.ts` | 310 | Human-readable effect text for UI |
| `src/types.ts` | 405 (excerpt) | CardEffectBlock, EffectTrigger, ValueExpr, CardFilter |
| `src/enums.ts` | 76 | TRIGGER_STRINGS, Trigger-Validation |

**All 7 Monster Triggers:**
1. `onSummon` — On Summon (Normal, Flip, Special)
2. `onDestroyByBattle` — On destruction in battle
3. `onDestroyByOpponent` — On destruction by opponent (battle or effect)
4. `onFlipSummon` — On Flip Summon (manual or by attack)
5. `onDealBattleDamage` — On battle damage to opponent
6. `onSentToGrave` — When card goes to graveyard
7. `passive` — Continuous on-field effect

**Effect Actions (60+):**
See Effect System inventory below.

**Effect System Doc:** → `docs/effect-system.md`

---

## Group G3: AI System

**Files:**

| File | Lines | Responsibility |
|-------|-------|---------------|
| `src/ai-behaviors.ts` | 623 | Behavior-Profile, Scoring, Targeting logic |
| `src/ai-orchestrator.ts` | 760 | aiTurn() main sequence, phase execution |
| `src/ai-threat.ts` | 100 | BoardSnapshot, ThreatScoring, GoalAlignment |

**AI-Behavior-Profile:**
| Profile | Strategy |
|--------|-----------|
| `default` | Balanced — Summon highest ATK, smart positioning |
| `aggressive` | Swarm Aggro — Fusion first, always attack |
| `defensive` | Stall/Drain — DEF position, conservative |
| `smart` | Control — Effect monsters first, board-aware |
| `cheating` | OTK Fusion — Full info access, aggressive |

**AI-Turn Sequence:**
```
1. Draw Phase → Hand refill
2. Main Phase → Fusion → Summon → Spells
3. Trap Phase → Set traps face-down
4. Equip Phase → Equip buffs/debuffs
5. Battle Phase → Lethal check → Plan attacks → Execute
6. End Phase → Reset flags, increment turn
```

**AI System Doc:** → `docs/ai-system.md`

---

## Group G4: Cards & Field

**Files:**

| File | Lines | Responsibility |
|-------|-------|---------------|
| `src/types.ts` | 405 | CardData, FieldCard, FieldSpellTrap interfaces |
| `src/field.ts` | 104 | FieldCard class (bonuses, flags, methods) |
| `src/cards.ts` | 277 | CARD_DB, FUSION_RECIPES, OPPONENT_CONFIGS |
| `src/enums.ts` | 76 | CardType enum, Trigger-Converter |
| `src/type-metadata.ts` | 93 | Race, Attribute, Rarity metadata |

**CardType Enum:**
```typescript
Monster = 1, Fusion = 2, Spell = 3, Trap = 4, Equipment = 5
```

**FieldCard Properties:**
- **Bonuses:** tempATKBonus, tempDEFBonus, permATKBonus, permDEFBonus, fieldSpellATKBonus, fieldSpellDEFBonus
- **Flags:** piercing, cannotBeTargeted, canDirectAttack, phoenixRevival, indestructible, effectImmune, cantBeAttacked
- **State:** hasAttacked, hasFlipSummoned, summonedThisTurn, equippedCards[]

**Cards & Field Doc:** → `docs/cards-field.md`

---

## Group G5: Opponents & Decks

**Data Source:** Inside `base.tcg` (`opponents.json`, `starterDecks.json`)

**OpponentConfig Structure:**
```typescript
interface OpponentConfig {
  id:          number;
  name:        string;
  title:       string;
  race:        Race;
  flavor:      string;
  coinsWin:    number;
  coinsLoss:   number;
  currencyId?: string;
  deckIds:     string[];
  behaviorId?: string;
  rewardConfig?: DuelRewardConfig;
}
```

**Starter Decks:**
- Key: Race ID (number)
- Value: Array of card IDs
- 4 Decks (e.g., Warrior, Dragon, Spellcaster, Fiend)

**Opponents Doc:** → `docs/opponents-decks.md`

---

## Group G6: Campaign

**Files:**

| File | Lines | Responsibility |
|-------|-------|---------------|
| `src/campaign-types.ts` | 58 | CampaignData, Chapter, CampaignNode types |
| `src/campaign-store.ts` | 88 | Query functions (isNodeUnlocked, getNode) |
| `src/campaign-duel-result.ts` | 139 | Duel result processing with rewards |
| `src/reward-config.ts` | 48 | Reward configs, rank multipliers |
| `src/progression.ts` | 696 (excerpt) | Progress persistence |

**Node Types:**
- `'duel'` — Duel with opponent
- `'story'` — Dialogue/Story
- `'reward'` — Reward node
- `'shop'` — Shop access
- `'branch'` — Branching
- `'gauntlet'` — Back-to-back duels (in CampaignNode)

**UnlockConditions:**
- `{ type: 'nodeComplete', nodeId }`
- `{ type: 'allComplete', nodeIds }`
- `{ type: 'anyComplete', nodeIds }`
- `{ type: 'cardOwned', cardId }`
- `{ type: 'winsCount', count }`

**Campaign Doc:** → `docs/campaign.md`

---

## Group G7: Shop & Progression

**Files:**

| File | Lines | Responsibility |
|-------|-------|---------------|
| `src/shop-data.ts` | 90 | PackDef, CardPoolDef, shop tiers |
| `src/progression.ts` | 696 | localStorage, Coins, Collection, Deck |

**Shop Data Structure:**
```typescript
interface PackDef {
  id: string;
  name, desc: string;
  price: number | PackPrice;
  icon, color: string;
  slots: PackSlotDef[];
  cardPool?: CardPoolDef;
  unlockCondition?: UnlockCondition;
}
```

**Progression Keys (localStorage):**
- `tcg_s{slot}_coins` — Jade Coins
- `tcg_s{slot}_collection` — [{id, count}]
- `tcg_s{slot}_deck` — 40-card deck
- `tcg_s{slot}_opponents` — {id: {unlocked, wins, losses}}
- `tcg_s{slot}_campaign_progress` — {completedNodes, currentChapter}

**Shop & Progression Doc:** → `docs/shop-progression.md`

---

## Group G8: Fusions

**Doc:** See G4 (Cards & Field) and G11 (TCG Format)

**Types:**
- `FusionRecipe` — Explicit material pairs → Result
- `FusionFormula` — Type-based (Race+Race, Race+Attr, Attr+Attr)
- `FusionChainResult` — Multi-card fusion chain

**Functions:**
- `checkFusion(id1, id2)` — 2-card fusion check
- `resolveFusionChain(cardIds[])` — Multi-card chain
- `getFusionHints(cardId)` — How do I obtain this card?

---

## Group G9: UI Architecture

**Structure:** `src/react/`

| Folder | Files | Responsibility |
|--------|---------|---------------|
| `screens/` | 12+ | PressStart, Title, Campaign, Game, Shop, Collection, Deckbuilder |
| `components/` | 10+ | Card, HandCard, FieldCard, HoverPreview, VFXOverlay |
| `contexts/` | 6 | GameContext, ProgressionContext, ModalContext, ScreenContext, SelectionContext, CampaignContext |
| `hooks/` | 8+ | useAttackAnimation, useLongPress, useAudio, useGamepad |
| `modals/` | 8+ | BattleLog, CardDetail, Options, Result, TrapPrompt |

**UI Doc:** → `docs/ui-architecture.md`

---

## Group G10: Mod API

**Files:**

| File | Lines | Responsibility |
|-------|-------|---------------|
| `src/mod-api.ts` | 45 | window.EchoesOfSanguoMod public API |
| `src/trigger-bus.ts` | 35 | Event emitter for custom triggers |

**Mod API Methods:**
```typescript
window.EchoesOfSanguoMod = {
  CARD_DB,                    // Live card database
  FUSION_RECIPES,             // Fusion recipes array
  OPPONENT_CONFIGS,           // Opponent configs array
  STARTER_DECKS,              // Starter deck definitions
  EFFECT_REGISTRY,            // Read-only effect actions
  registerEffect(name, impl), // Custom effect handler
  loadModTcg(url),            // Load .tcg archive
  unloadModCards(modId),      // Remove mod cards
  getLoadedMods(),            // List loaded mods
  getCurrentManifest(),       // Get manifest
  emitTrigger(event, ctx),    // Fire custom trigger
  addTriggerHook(event, fn),  // Subscribe to trigger
}
```

**Mod API Doc:** → `docs/mod-api.md`

---

## Group G11: TCG Format

**Files:**

| File | Lines | Responsibility |
|-------|-------|---------------|
| `src/tcg-bridge.ts` | 405 | @wynillo/tcg-format → game stores |
| `src/tcg-builder.ts` | 58 | CardData → TcgCard (packing) |
| `src/effect-serializer.ts` | 21 | Effect string ↔ CardEffectBlock |
| `src/enums.ts` | 76 | Int ↔ Enum converter |

**TCG Archive (`base.tcg`):**
- ZIP format with `.tcg` extension
- Contains: cards.json, opponents.json, starterDecks.json, fusion_recipes.json, locales/{lang}.json

**Load Pipeline:**
1. Extract ZIP
2. loadTcgFile() from @wynillo/tcg-format
3. applyOpponents(), applyStarterDecks(), etc.
4. Fill CARD_DB, FUSION_RECIPES

**TCG Format Doc:** → `docs/tcg-format.md` (needs to be written!)

---

## Dependencies Between Groups

```
G4 (Cards & Field) ← G1, G2, G8, G11
G2 (Effect System) ← G1, G10, G11
G1 (Engine-Core)   ← G2, G3, G4, G8
G11 (TCG Format)   ← G4, G5, G6, G7
G10 (Mod API)      ← G1, G2
G3 (AI System)     ← G1, G2, G4
G8 (Fusions)       ← G4, G11
G5 (Opponents)     ← G11
G6 (Campaign)      ← G1, G5, G11
G7 (Shop)          ← G11
G9 (UI)            ← G1, G2, G4, G6, G7
```

---

## Doc Writing Order (Prioritized)

| # | Group | Doc File | Duration | Dependencies |
|---|--------|-----------|-------|--------------|
| 1 | G4 | `docs/cards-field.md` | 2–3h | — |
| 2 | G2 | `docs/effect-system.md` | 4–5h | G4 |
| 3 | G1 | `docs/engine-core.md` | 3–4h | G2, G4 |
| 4 | G11 | `docs/tcg-format.md` | 2–3h | G4, G2 |
| 5 | G10 | `docs/mod-api.md` | 2h | G1, G2 |
| 6 | G3 | `docs/ai-system.md` | 2–3h | G1 |
| 7 | G5 | `docs/opponents-decks.md` | 1–2h | G11 |
| 8 | G7 | `docs/shop-progression.md` | 2h | G11 |
| 9 | G6 | `docs/campaign.md` | 2h | G11 |
| 10 | G8 | (Contained in G4, G11) | — | — |
| 11 | G9 | `docs/ui-architecture.md` | 3–4h | G1 |

---

## Effect Registry (G2 — Detail)

### Damage / Heal (5)
`dealDamage`, `gainLP`, `reflectBattleDamage`, `destroyAndDamageBoth`, `preventBattleDamage`

### Draw / Search (10)
`draw`, `searchDeckToHand`, `peekTopCard`, `drawThenDiscard`, `discardFromHand`, `discardOppHand`, `discardEntireHand`, `sendTopCardsToGrave`, `sendTopCardsToGraveOpp`, `shuffleDeck`

### Stat Buffs (14)
`buffField`, `tempBuffField`, `debuffField`, `tempDebuffField`, `tempAtkBonus`, `permAtkBonus`, `tempDefBonus`, `permDefBonus`, `halveAtk`, `doubleAtk`, `swapAtkDef`

### Removal / Bounce (13)
`bounceStrongestOpp`, `bounceAttacker`, `bounceAllOppMonsters`, `bounceOppHandToDeck`, `destroyAttacker`, `destroyAllOpp`, `destroyAll`, `destroyWeakestOpp`, `destroyStrongestOpp`, `destroyByFilter`, `destroySummonedIf`, `setFaceDown`, `flipAllOppFaceDown`

### Graveyard (7)
`reviveFromGrave`, `reviveFromEitherGrave`, `salvageFromGrave`, `recycleFromGraveToDeck`, `shuffleGraveIntoDeck`

### Summon (5)
`specialSummonFromHand`, `specialSummonFromDeck`, `createTokens`, `excavateAndSummon`

### Control (6)
`stealMonster`, `stealMonsterTemp`, `cancelAttack`, `cancelEffect`, `preventAttacks`, `changePositionOpp`

### Spell/Trap Removal (4)
`destroyOppSpellTrap`, `destroyAllOppSpellTraps`, `destroyAllSpellTraps`, `destroyOppFieldSpell`

### Passive (11)
`passive_piercing`, `passive_untargetable`, `passive_directAttack`, `passive_vsAttrBonus`, `passive_phoenixRevival`, `passive_indestructible`, `passive_effectImmune`, `passive_cantBeAttacked`, `passive_negateTraps`, `passive_negateSpells`, `passive_negateMonsterEffects`

### Utility (5)
`tributeSelf`, `payCost`, `skipOppDraw`, `gameReset`, `revealTopCard`

---

## Next Steps

1. **Start Phase 2** — Document first group (G4: Cards & Field)
2. **Use template** — Consistent structure per doc file
3. **Review after each doc** — Check technical accuracy

---

**Note:** This inventory is updated after each completed doc part. Mark as complete when doc is written and merged.
