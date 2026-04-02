# Early Access Readiness Review — Echoes of Sanguo

**Target audience:** Hardcore Yu-Gi-Oh! Forbidden Memories mod players
**Assessment date:** 2026-03-30 (updated 2026-03-30)
**Verdict:** CONDITIONALLY READY — solid foundation, but gameplay depth and content gaps will limit retention

---

## Overall Scores

| Category | Score | Verdict |
|----------|-------|---------|
| Engineering & Code Quality | 9/10 | Production-grade. Zero TODO/FIXME/HACK in codebase. |
| UI & Visual Polish | 8/10 | 12 screens, 10 modals, 90+ CSS animations, responsive. Impressive. |
| Audio | 7/10 | 5 music tracks, 12 SFX. Functional but no damage popups or ambient loops. |
| Test Coverage | 7/10 | 6,300+ lines unit tests. E2E is 50 lines (1 spec). Zero React component tests. |
| Mod API | 8/10 | Powerful (cards, effects, triggers, .tcg loading). Full documentation + examples added. |
| Shop & Economy | 6/10 | 6 tiered packs with rarity system and pity mechanic. Could use more variety. |
| Gameplay Depth | 6/10 | Chain/response system added (onOpponentSpell). AI trap bug fixed. Deeper interactions now. |
| Card/Content Volume | 4/10 | 312 cards with only 85 unique effects. 12 traps. 7 equipment. Thin. |
| AI Challenge | 6/10 | Cheating AI now has foreknowledge: reads player hand, peeks own deck, reactive trap placement. |
| Campaign & Progression | 4/10 | 39 duels but strictly linear. 1 postgame duel. Weak endgame. |
| Fun Factor (target audience) | 5/10 | Familiar FM feel, but experienced players will exhaust content in hours. |

---

## CRITICAL FINDINGS — Gameplay Mechanics

### 1. No Chain/Response System ✅ PARTIALLY ADDRESSED
**File:** `src/engine.ts`

~~Traps and spells cannot be chained.~~ A basic chain/response layer has been added:
- New `onOpponentSpell` trap trigger fires when the opponent activates a spell — the player is now prompted to respond with face-down traps
- AI's face-down traps now auto-fire symmetrically (bug fix: they previously never activated when the player was the attacker/summoner)
- New `cancelEffect` action allows traps to negate spells entirely
- AI with `knowsPlayerHand` analyzes the player's hand composition and places `onOpponentSpell` traps first when the player is spell-heavy

Full spell-speed chain (multi-card chains, counter-traps) remains a P2 item.

**Impact:** Duels are more interactive on both turns. Trap placement is now strategically meaningful.

### 2. Fusion System is Shallow
**File:** `node_modules/@wynillo/echoes-mod-base/tcg-src/fusion_formulas.json` — only 20 fusion formulas

FM had hundreds of fusion combinations including attribute combos, specific card combos, and material interactions. Here it's 20 race+race generic formulas. No LP cost for fusing. No fusion spell cards required. No fusion substitute monsters.

**Impact:** Fusions are predictable and free. The discovery element — one of FM's most exciting aspects — is minimal.

### 3. "Cheating" AI Doesn't Actually Cheat ✅ ADDRESSED
**File:** `src/ai-behaviors.ts`

~~It's functionally identical to AGGRESSIVE but prioritizes fusions.~~ The CHEATING profile now has genuine foreknowledge mechanics:
- `peekDeckCards: 5` — AI sees its own top 5 deck cards and will draw early if a fusion partner is found
- `knowsPlayerHand: true` — AI reads the player's full hand when planning attacks, spell activation, and trap placement
- `peekPlayerDeck: 1` — AI knows the player's next draw, enabling counter-planning
- `holdFusionPiece: true` — AI withholds specific fusion materials from the field when the partner card isn't in hand yet

These mechanics are subtle and feel like the AI "knows too much" — which is exactly how cheating should feel.

**Impact:** Endgame opponents are meaningfully harder. The AI won't run out of steam from over-drawing.

### 4. AI Has No Multi-Turn Planning ✅ PARTIALLY ADDRESSED
**File:** `src/ai-orchestrator.ts`

~~AI uses greedy single-turn optimization with no hand management.~~ Two multi-turn planning behaviors have been added:
- **Fusion-piece holding** (`holdFusionPiece`, enabled for SMART and CHEATING): AI skips summoning a card that is a specific fusion material when the partner isn't in hand — waits for the fusion payoff instead of wasting the piece
- **Reactive threat response** (`knowsPlayerHand`): AI assesses the player's hand each turn; if the player is spell-heavy, AI prioritizes setting `onOpponentSpell` traps; if the player has high-ATK monsters in hand but none on field, AI pre-emptively activates destroy/debuff spells; if the player has fusion potential, AI plays more conservatively in battle

Bluffing (face-down ATK) and full multi-turn lookahead remain future work.

**Impact:** Experienced players can no longer trivially read the AI — it responds to what they're holding.

### 5. Effect Variety is Too Low
**File:** `src/effect-registry.ts` — 41 registered effect types

312 cards but only **85 unique effect strings**. That's 2.2 cards per unique effect. Most effect monsters are stat sticks sharing effects with 1-2 other cards. Only 12 trap cards total. Only 7 equipment cards. No archetype synergies (cards rewarding mono-race or mono-attribute decks).

**Impact:** Deckbuilding lacks depth. No interesting combos to discover beyond basic fusions.

---

## CRITICAL FINDINGS — Content & Progression

### 6. Campaign Lacks Endgame
**File:** `node_modules/@wynillo/echoes-mod-base/tcg-src/campaign.json` — campaign graph

- 7 chapters, 39 duel nodes, strictly linear progression
- Chapter 7 (Postgame): **1 single duel node**
- No side quests, no branching paths, no difficulty scaling options
- Unlock conditions limited to: `nodeComplete`, `winsCount(10)`, `anyComplete`
- Defined but unused node types: `cardOwned`, `reward`, `shop`, `branch`

**Impact:** Hardcore players complete campaign in 3-5 hours and have nothing left. FM's appeal was the grind loop — replaying duels for drops, buying packs, optimizing decks over dozens of hours.

### 7. Starter Decks Are Structurally Identical
**File:** `node_modules/@wynillo/echoes-mod-base/tcg-src/meta.json` — starter deck definitions

All 6 starter decks use identical structure: 13-14 doubled monsters + same tech card package (IDs 266, 267, 269, 270, 274, 291). Only the monster ID range changes. No aggro vs control vs combo identity.

**Impact:** Starter choice feels cosmetic rather than strategic. No replay incentive.

### 8. Shop Economy Could Be Tighter
**File:** `node_modules/@wynillo/echoes-mod-base/tcg-src/shop.json` (shop pack definitions), `src/react/utils/pack-logic.ts`

The shop system itself is well-engineered: 6 tiered booster packs with randomized pulls, rarity distribution (60% C / 30% U / 8.9% R / 1% SR / 0.1% UR), pity system guaranteeing Rare+ per pack, card pool filtering by ATK ceiling, and campaign-gated unlock progression. Solid architecture.

However: duel rewards (100-1000 coins) vs pack prices (250-800 coins) means players can buy a pack every 2-3 duels. FM's economy was tighter — you had to grind more per pack. The current pacing may be too generous for hardcore players who want to feel the grind.

**Impact:** Card acquisition feels too easy. No tension in saving vs spending.

---

## POSITIVE FINDINGS — What's Already Great

### Engineering Excellence
- **Zero TODO/FIXME/HACK** in entire codebase — exceptional discipline
- **6,300+ lines of unit tests** covering engine, effects, AI, progression, format
- **Clean 3-layer architecture** (Engine / Data / UI) with strict separation
- **Modern stack**: React 19, TypeScript 6, Vite 8, Tailwind 4, GSAP
- **Mobile-ready**: Capacitor 8 Android build pipeline

### UI & Polish
- 12 complete screens with animations and responsive layouts
- Pack opening screen: sparkle particles, light beams, screen shake — genuinely satisfying
- Duel result screen: GSAP phased animations and badge system
- 90+ CSS @keyframes animations
- Dark fantasy aesthetic with consistent pixel-art theme
- Touch support (long-press, swipe carousel)

### Shop & Pack System
- 6 tiered packs with campaign-gated progression
- Sophisticated rarity distribution with weighted random
- Pity system guaranteeing at least Rare per pack
- Card pool filtering (ATK ceiling, rarity bounds, race/attribute/type)
- Fallback chains when pool lacks cards at target rarity
- Data-driven from shop.json — fully moddable

### Mod API Foundation
- `window.EchoesOfSanguoMod` exposes: CARD_DB, FUSION_RECIPES, EFFECT_REGISTRY, registerEffect(), loadModTcg(), TriggerBus
- Runtime .tcg archive loading without restart
- Custom effects registerable without touching engine code
- **Right architecture for the FM modding community** — now fully documented in `docs/modding-guide.md`

### Effect System Architecture
- 41 data-driven effect types in EFFECT_REGISTRY
- Triggers: onSummon, onDestroyByBattle, onDestroyByOpponent, onFlipSummon, passive
- 8 passive abilities: piercing, untargetable, directAttack, vsAttrBonus, phoenixRevival, indestructible, effectImmune, cantBeAttacked
- Extensible design — new effects added to registry, not hardcoded

### Audio System
- 5 music tracks (title, battle, shop, victory, defeat)
- 12 SFX (attack, damage, destroy, fusion, spell, trap, draw, card-play, etc.)
- Web Audio API with buffer caching, crossfade, concurrent limiter
- Volume persistence and per-channel control

---

## IS THE GAME FUN? IS IT HARD?

### For the target audience (hardcore FM mod players):

**The core FM feel is there.** No tribute summoning (faithful to FM), hand refill to 5, fusion from hand, 5 field zones, 8000 LP start, first-turn no-attack — the foundations are correct.

**It's too easy.** AI is greedy and predictable. "Cheating" opponents don't actually cheat. An experienced FM player will figure out the AI in 2-3 duels and steamroll the campaign without losing.

**It's engaging for the first 2-3 hours.** The polish impresses — nice animations, satisfying pack opening, cool campaign map. But once you realize the AI never surprises you and there are only 85 unique effects across 312 cards, replay motivation drops.

**It lacks the "one more duel" factor.** FM's addiction loop was: grind → coins → random pack → chase that one rare card → optimize deck → tackle the next boss. The pieces are here (tiered packs, rarity system, pity mechanic), but the economy is too generous and the card variety too thin to sustain the chase.

**What FM modders will specifically miss:**
1. More fusion recipes (FM had hundreds; this has 20)
2. Smarter/harder AI that forces deck optimization
3. Hours of postgame grinding content
4. Card archetype synergies and discovery
5. Chain/response mechanics for trap interaction
6. Modding documentation and examples

---

## RECOMMENDATIONS — Priority Order

### P0 — Required Before Early Access Launch
1. ~~**Make "cheating" AI actually threatening**~~ ✅ **DONE** — Foreknowledge mechanics: reads player hand, peeks deck, reactive trap/spell activation
2. **Expand fusion formulas to 50+** — add attribute combos, specific card recipes, more result variety
3. **Add 5-10 postgame challenge duels/gauntlets** — endgame content for hardcore grinders
4. ~~**Write basic modding documentation**~~ ✅ **DONE** — Full API reference, card format spec, complete example mod in `docs/modding-guide.md`

### P1 — First Month Post-Launch
5. Add 30+ new trap cards with diverse triggers
6. Add 15+ new equipment cards
7. Create unique effect strings for more cards (target: 150+ unique effects)
8. Add 3 distinct starter deck strategies (aggro/control/combo)
9. Tighten coin economy (reduce duel rewards or increase pack prices)
10. ~~Improve AI multi-turn planning (save cards for future fusions, bluffing)~~ ✅ **DONE** — Fusion-piece holding + reactive hand-aware decisions added; bluffing still outstanding

### P2 — Short-Term Roadmap
11. ~~Basic chain/response system (at least for traps interrupting spells)~~ ✅ **DONE** — `onOpponentSpell` trigger + `cancelEffect` action; AI trap bug fixed; full spell-speed chain still P2
12. Expand E2E test coverage (50 → 500+ lines)
13. Card archetype synergies (mono-race/attribute deck rewards)
14. Campaign branching paths and side quests
15. Duel replay incentives (daily bonus coins, first-win rewards)

### P3 — Nice to Have
16. ~~Damage number animations during battles~~ ✅ **DONE** — Floating red numbers animate from LP panels on damage
17. Daily/weekly challenge duels
18. Deck sharing/import
19. Achievement system beyond battle badges
20. CHANGELOG.md for the modding community

---

## Key Metrics

| Metric | Value |
|--------|-------|
| Total Cards | 312 (245 monsters, 20 fusions, 28 spells, 12 traps, 7 equipment) |
| Unique Effect Strings | 85 |
| Effect Registry Types | 41 |
| Fusion Recipes | 20 |
| AI Behavior Profiles | 5 (default, aggressive, defensive, smart, cheating) |
| Campaign Duels | 39 (7 chapters, 1 postgame node) |
| Shop Booster Packs | 6 tiered packages |
| Starter Decks | 6 |
| Opponents | 39 |
| UI Screens | 12 |
| Modals | 10 |
| CSS Animations | 90+ keyframes |
| Audio Assets | 17 (5 music, 12 SFX) |
| Unit Test Lines | ~6,300 |
| E2E Test Lines | ~50 |
| TODO/FIXME/HACK | 0 |

---

## Key Files Referenced

| File | Relevance |
|------|-----------|
| `src/engine.ts` | Core game loop — missing chain/response mechanics |
| `src/effect-registry.ts` | 41 effect types — needs expansion |
| `src/ai-behaviors.ts` | 5 profiles — "cheating" is just aggressive |
| `src/ai-orchestrator.ts` | Greedy single-turn AI — no multi-turn planning |
| `src/rules.ts` | Game constants (LP 8000, hand 10, field 5, deck 40) |
| `src/field.ts` | FieldCard with 8 passive abilities |
| `src/progression.ts` | Save/load — functional but no meta-progression |
| `src/campaign.ts` | Campaign logic — unused node types |
| `src/campaign-types.ts` | Schema supports more than campaign.json uses |
| `src/shop-data.ts` | Well-typed shop data store |
| `src/react/utils/pack-logic.ts` | Solid pack opening: rarity distribution, pity, pool filtering |
| `node_modules/@wynillo/echoes-mod-base/tcg-src/cards.json` | 312 cards, 85 unique effects |
| `node_modules/@wynillo/echoes-mod-base/tcg-src/fusion_formulas.json` | Only 20 formulas |
| `node_modules/@wynillo/echoes-mod-base/tcg-src/campaign.json` | 39 nodes, linear, 1 postgame duel |
| `node_modules/@wynillo/echoes-mod-base/tcg-src/shop.json` | 6 tiered booster packs with unlock progression |
| `node_modules/@wynillo/echoes-mod-base/tcg-src/meta.json` | 6 starter decks, identical structure |
