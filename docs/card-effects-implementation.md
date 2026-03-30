# Card Effects Implementation Plan & Summary

## Context

43 iconic card effects were implemented across 7 phases, prioritized by "cards unlocked per unit of engine work." The engine previously had 60 effect actions, 6 monster triggers, and 5 trap triggers. This work added 15+ new effect actions, 3 new triggers, and several new engine mechanics.

---

## Phase 0: Zero-Engine-Work Cards (8 cards)

No engine changes — cards use existing actions.

| Card | Type | Effect String |
|------|------|---------------|
| Pot of Greed | Spell | `onSummon:draw(self,2)` |
| Raigeki | Spell | `onSummon:destroyAllOpp()` |
| Dark Hole | Spell | `onSummon:destroyAll()` |
| Harpie's Feather Duster | Spell | `onSummon:destroyAllOppSpellTraps()` |
| Heavy Storm | Spell | `onSummon:destroyAllSpellTraps()` |
| MST | Spell | `onSummon:destroyOppSpellTrap()` |
| Mirror Force | Trap | `onAttack:destroyAllOpp()` |
| Magic Cylinder | Trap | `onAttack:reflectBattleDamage()` |

---

## Phase 1: Multi-Effect Blocks + New Triggers (6 cards)

### Engine Changes

- **Multi-effect block support**: `effects?: CardEffectBlock[]` on `CardData`. Pipe-delimited format: `"passive:passive_piercing()|onDealBattleDamage:draw(self,1)"`.
  - `js/types.ts`: Added `effects` array and `spirit` flag to `CardData`
  - `js/effect-serializer.ts`: `deserializeEffects()`, `serializeEffects()`, `parseEffectString()` for pipe-delimited multi-block
  - `js/engine.ts`: `_getEffectBlocks()` helper iterates both `card.effects` and `card.effect`
  - `js/field.ts`: `FieldCard` constructor scans all passive blocks from `effects` array
  - `js/tcg-bridge.ts`: Uses `parseEffectString()` for multi-block support on load

- **New trigger: `onDealBattleDamage`**: Fires on the attacking monster after it deals battle damage to LP. Added in `_resolveBattle` (ATK win, piercing), `attack` (direct attack path), and `attackDirect`.

- **New trigger: `onSentToGrave`**: Fires when a monster is sent to GY by any means. Added via `_triggerSentToGrave()` helper called from `_destroyMonster` and `_destroyMonsterBySignal`.

- **New action: `skipOppDraw`**: Sets `GameState.skipNextDraw` flag. Checked and cleared in `refillHand`.

- **Spirit mechanic**: `_returnSpiritMonsters()` bounces spirit monsters to hand. Called in `endTurn` and AI end phase.

| Card | Effect |
|------|--------|
| Airknight Parshath | `passive:passive_piercing()\|onDealBattleDamage:draw(self,1)` |
| Don Zaloog | `onDealBattleDamage:discardOppHand(1)` |
| Yata-Garasu | Spirit + `onDealBattleDamage:skipOppDraw()` |
| Sangan | `onSentToGrave:searchDeckToHand({maxAtk=1500,ct=1})` |
| Witch of the Black Forest | `onSentToGrave:searchDeckToHand({maxDef=1500,ct=1})` |
| Spirit Reaper | `passive:passive_indestructible()\|onDealBattleDamage:discardOppHand(1)` |

---

## Phase 2: Flip Effect Extensions (4 cards)

### Engine Changes

- **New action: `discardEntireHand`**: `{ target: 'self' | 'opponent' | 'both' }` — discards all cards from target's hand to GY.
- **`specialSummonFromDeck` extended**: Now supports `faceDown` and `position` params. `specialSummon()` engine method also updated.

| Card | Effect |
|------|--------|
| Magician of Faith | `onFlip:salvageFromGrave({ct=3})` |
| Morphing Jar | `onFlip:discardEntireHand(both);draw(self,5);draw(opponent,5)` |
| Night Assailant | `onFlip:destroyStrongestOpp()` |
| Apprentice Magician | `onDestroyByBattle:specialSummonFromDeck({maxLevel=2,r=2},faceDown,def)` |

---

## Phase 3: New Trap Triggers + Battle Protection (3 cards)

### Engine Changes

- **New trap trigger: `onAnySummon`**: Fires for both players' summons. `_checkAnySummonTraps()` helper checks both players' trap fields after any summon (normal, special, fusion).

- **New action: `destroyAndDamageBoth`**: Destroys strongest opponent monster, deals its ATK to both players (Ring of Destruction).

- **New action: `preventBattleDamage`**: Sets `PlayerState.battleProtection` flag for the turn. Checked in `_resolveBattle` and direct attacks. Cleared in `_resetMonsterFlags`.

| Card | Effect |
|------|--------|
| Torrential Tribute | Trap `onAnySummon:destroyAll()` |
| Ring of Destruction | Trap `manual:destroyAndDamageBoth(opponent)` |
| Waboku | Trap `onAttack:preventBattleDamage()` |

---

## Phase 4: Continuous Effects + Temporary Control + Player Choice (10 cards)

### Engine Changes

- **Continuous effect flag system**: `PlayerState.fieldFlags` with `negateTraps`, `negateSpells`, `negateMonsterEffects`. Checked in `_promptPlayerTraps`, `_autoActivateOpponentTraps`, `activateSpell`, and `_triggerEffect`. Recalculated via `_recalcFieldFlags()` on every card removal.

- **Temporary control steal**: `stealMonsterTemp` moves opponent's strongest monster to own field with `FieldCard.originalOwner` marker. `_returnTempStolenMonsters()` returns them at end of turn.

- **`reviveFromEitherGrave`**: Picks best monster from either player's GY.

- **`drawThenDiscard`**: Draw N then discard M randomly (AI path; player choice can be added later).

- **`bounceOppHandToDeck`**: Shuffle random cards from opponent's hand back to deck.

- **`tributeSelf` cost**: New `EffectCost.tributeSelf` flag. `payCost()` finds and removes the effect owner from the field.

- **Fix: `deserializeEffect` colon parsing**: Now uses bracket-aware scanning to skip colons inside `[cost:...]` brackets.

| Card | Effect |
|------|--------|
| Jinzo | `passive:passive_negateTraps()` |
| Skill Drain | Trap `manual[cost:lp=1000]:passive_negateMonsterEffects()` |
| Imperial Order | Trap `manual:passive_negateSpells()` |
| Graceful Charity | Spell `onSummon:drawThenDiscard(3,2)` |
| Change of Heart | Spell `onSummon:stealMonsterTemp()` |
| Monster Reborn | Spell (fromGrave) `onSummon:reviveFromEitherGrave()` |
| Delinquent Duo | Spell `onSummon[cost:lp=1000]:discardOppHand(2)` |
| Confiscation | Spell `onSummon[cost:lp=1000]:discardOppHand(1)` |
| The Forceful Sentry | Spell `onSummon:bounceOppHandToDeck(1)` |
| Exiled Force | Monster `onSummon[cost:tributeSelf]:destroyStrongestOpp()` |

---

## Phase 5: Turn Counters + Counter Traps (5 cards)

### Engine Changes

- **Turn counter system**: `TurnCounter[]` on `PlayerState` with `{ turnsRemaining, effect }`. `_tickTurnCounters()` decrements at end of each player's turn. `hasPreventAttacks()` blocks attacks when active.

- **`lpHalf` cost type**: `EffectCost.lpHalf` — pays `Math.floor(currentLP / 2)`.

- **Added `cancelEffect` to serializer** (was missing — existed in registry but never serialized since no cards used it before).

| Card | Effect |
|------|--------|
| Swords of Revealing Light | Spell `onSummon:preventAttacks(3)` |
| Solemn Judgment | Trap `onOpponentSummon[cost:lpHalf]:cancelEffect()` |
| Snatch Steal | Spell `onSummon:stealMonster()` |
| Premature Burial | Spell (fromGrave) `onSummon[cost:lp=800]:reviveFromGrave()` |
| Call of the Haunted | Trap `manual:reviveFromGrave()` |

---

## Phase 6: Tokens, Game Reset, Excavate (7 cards)

### Engine Changes

- **`createTokens`**: Creates N token monster cards (inline CardData) and special summons them via `engine.specialSummon`.

- **`gameReset`**: Collects all cards from both players' hands, fields, and graveyards. Shuffles everything back into decks. Both players draw 5.

- **`excavateAndSummon`**: Reveals top N cards from each player's deck. Special summons monsters with level ≤ X face-down in DEF. Adds remaining cards to hand.

| Card | Effect |
|------|--------|
| Scapegoat | Spell `onSummon:createTokens(sheep_token,4,def)` |
| Fiber Jar | `onFlip:gameReset()` |
| Cyber Jar | `onFlip:destroyAll();excavateAndSummon(5,4)` |
| Tribe-Infecting Virus | `onSummon[cost:discard=1]:destroyAllOpp()` |
| Tsukuyomi | Spirit + `onSummon:setFaceDown()` |
| Sinister Serpent | `onSentToGrave:salvageFromGrave({ct=1})` |
| Painful Choice | Spell `onSummon:sendTopCardsToGrave(4);draw(self,1)` |

---

## Summary

| Phase | New Engine Features | Cards | Cumulative |
|-------|-------------------|-------|------------|
| 0 | None | 8 | 8 |
| 1 | Multi-effect blocks, `onDealBattleDamage`, `onSentToGrave`, Spirit, `skipOppDraw` | 6 | 14 |
| 2 | `discardEntireHand`, face-down SS from deck | 4 | 18 |
| 3 | `onAnySummon` trap trigger, `destroyAndDamageBoth`, `preventBattleDamage` | 3 | 21 |
| 4 | Continuous effect flags, temp steal, either-GY revive, hand disruption, `tributeSelf` | 10 | 31 |
| 5 | Turn counters, `lpHalf` cost, counter trap serialization | 5 | 36 |
| 6 | Tokens, game reset, excavate | 7 | 43 |

## Files Modified

- `js/types.ts` — EffectDescriptorMap (15 new actions), EffectTrigger (+2), TrapTrigger (+1), CardData (effects, spirit), PlayerState (battleProtection, turnCounters, fieldFlags), GameState (skipNextDraw), EffectCost (tributeSelf, lpHalf)
- `js/engine.ts` — Battle damage triggers, continuous effect checks, spirit return, temp steal return, turn counters, preventAttacks, onAnySummon trap checking, onSentToGrave trigger
- `js/effect-registry.ts` — 15+ new action handlers in EFFECT_REGISTRY
- `js/effect-serializer.ts` — Multi-block pipe format, bracket-aware colon parsing, all new action serialize/deserialize, cancelEffect serialization
- `js/field.ts` — FieldCard (originalOwner, multi-block passive extraction)
- `js/ai-orchestrator.ts` — Spirit return, temp steal return, turn counter tick
- `js/tcg-bridge.ts` — Multi-block effect parsing via parseEffectString
- `js/enums.ts` — New triggers in TRIGGER_STRINGS and trap trigger int maps
- `public/base.tcg-src/cards.json` — 43 new card definitions (IDs 313-355)
- `public/base.tcg-src/locales/cards_description.json` — Card names and descriptions

## Simplifications

Several cards are simplified vs full YGO rules (this is an FM-style engine):

- **Confiscation / Forceful Sentry**: Random discard instead of viewing opponent's hand
- **Delinquent Duo**: Both discards random instead of 1 random + 1 choice
- **Snatch Steal**: Permanent steal, no LP gain to opponent
- **Premature Burial / Call of the Haunted**: No equip-link destruction tracking
- **Imperial Order**: No maintenance cost per turn
- **Tribe-Infecting Virus**: Destroys all opp monsters instead of declared type
- **Painful Choice**: Mill 4 + draw 1 instead of pick-5-opponent-chooses-1
- **Sinister Serpent**: Returns a monster from GY when destroyed instead of standby self-return
- **Swords of Revealing Light**: Blocks attacks for 3 turns (no flip face-up)
- **Solemn Judgment**: Only negates summons (not spells) via single trapTrigger
- **Graceful Charity**: Random discard instead of player choice (selectCards UI not yet wired)
- **Night Assailant**: Simplified to flip destroy only (no onDiscard salvage trigger)
