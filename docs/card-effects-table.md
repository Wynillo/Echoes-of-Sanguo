# Card Effects Table

Overview of all 41 implemented effects in `EFFECT_REGISTRY` (`js/effect-registry.ts`), their usage across the 312-card pool, and estimated competitive strength.

## All 41 Implemented Effects

| # | Effect Type | Category | # Cards | Strength |
|---|------------|----------|:-------:|----------|
| 1 | `dealDamage` | Damage | 6 | **B+** — Reliable direct damage; strength depends on value. |
| 2 | `gainLP` | Healing | 16 | **B** — Sustain tool; buffed values now compete with damage. |
| 3 | `draw` | Card Draw | 15 | **A** — Card advantage is king. Extra draws are always strong. |
| 4 | `buffField` | Field Buff | 31 | **A-** — Permanent ATK/DEF boost to all matching allies. Scales with board width. |
| 5 | `tempBuffField` | Field Buff | 2 | **B** — Same as buffField but temporary. Weaker since it doesn't persist. |
| 6 | `debuffField` | Field Debuff | 13 | **A-** — Permanent debuff to all opponent monsters. Punishing on wide boards. |
| 7 | `tempDebuffField` | Field Debuff | 3 | **B** — Temporary version of debuffField. Useful but fades. |
| 8 | `bounceStrongestOpp` | Bounce | 10 | **A** — Removes opponent's best monster cleanly. No death triggers, forces re-summon. |
| 9 | `bounceAttacker` | Bounce | 1 | **A-** — Trap-style bounce; punishes aggression hard, wastes opponent's summon. |
| 10 | `bounceAllOppMonsters` | Bounce | 1 | **S** — Full board bounce. Devastating tempo swing, rightfully rare (1 card). |
| 11 | `searchDeckToHand` | Search | 5 | **A+** — Tutoring is one of the strongest mechanics in any TCG. |
| 12 | `tempAtkBonus` | Stat Mod | 18 | **B** — Temporary single-target ATK/DEF pump. Good combat trick. |
| 13 | `permAtkBonus` | Stat Mod | 6 | **B+** — Permanent single-target ATK/DEF boost. Stacks over time. |
| 14 | `tempDefBonus` | Stat Mod | 6 | **C+** — Temporary DEF-only boost. Narrow; only helps in defense position. |
| 15 | `permDefBonus` | Stat Mod | 1 | **C+** — Permanent DEF-only boost. Niche but persistent. |
| 16 | `reviveFromGrave` | Revival | 1 | **A** — Graveyard recursion is very strong. Reuses defeated monsters. |
| 17 | `cancelAttack` | Trap | 4 | **B** — Negates one attack. Defensive stall tool. |
| 18 | `destroyAttacker` | Trap | 5 | **A-** — Cancels attack AND destroys attacker. Strong 2-for-1. |
| 19 | `destroySummonedIf` | Trap | 2 | **B+** — Conditional summon punishment. Good vs big monsters. |
| 20 | `destroyAllOpp` | Destruction | 1 | **S** — One-sided board wipe. Game-winning if it resolves. |
| 21 | `destroyAll` | Destruction | 1 | **A** — Symmetric board wipe. Strong as a comeback tool. |
| 22 | `destroyWeakestOpp` | Destruction | 2 | **B-** — Targeted removal; hits the least threatening monster. |
| 23 | `destroyStrongestOpp` | Destruction | 1 | **A** — Targeted removal of biggest threat. Very efficient. |
| 24 | `sendTopCardsToGrave` | Mill (Self) | 1 | **B** — Self-mill. Enables graveyard synergies; risky but rewarding with recursion. |
| 25 | `sendTopCardsToGraveOpp` | Mill (Opp) | 2 | **A-** — Opponent mill. Strong resource denial. |
| 26 | `salvageFromGrave` | GY Recovery | 1 | **A-** — Retrieves card from graveyard to hand. Strong recursion. |
| 27 | `recycleFromGraveToDeck` | GY Recovery | 1 | **C+** — Returns card to deck (not hand). Slower than salvage. |
| 28 | `shuffleGraveIntoDeck` | GY Recovery | 1 | **C** — Anti-deck-out insurance. Niche utility. Combo with draw. |
| 29 | `shuffleDeck` | Utility | 1 | **D** — Minimal impact on its own. Combo enabler (paired with searchDeckToHand). |
| 30 | `peekTopCard` | Utility | 1 | **D** — Information only. Combo enabler (paired with draw). |
| 31 | `specialSummonFromHand` | Summon | 1 | **A** — Extra summon = tempo advantage. Very strong. |
| 32 | `discardFromHand` | Hand Disrupt | 1 | **C-** — Self-discard (cost). Paired with draw 2 for net card advantage. |
| 33 | `discardOppHand` | Hand Disrupt | 2 | **A-** — Opponent hand disruption. Powerful denial tool. |
| 34 | `passive_piercing` | Passive | 7 | **B+** — Piercing damage through DEF position. Punishes defensive play. |
| 35 | `passive_untargetable` | Passive | 7 | **A-** — Cannot be targeted by effects. Strong protection. |
| 36 | `passive_directAttack` | Passive | 3 | **A** — Bypasses all monsters for direct LP damage. Game-winning closer. |
| 37 | `passive_vsAttrBonus` | Passive | 2 | **C+** — ATK bonus vs specific attribute. Matchup-dependent. |
| 38 | `passive_phoenixRevival` | Passive | 9 | **A** — Self-revive once on death. Effectively 2 lives. Excellent. |
| 39 | `passive_indestructible` | Passive | 1 | **S** — Cannot be destroyed. Extremely powerful; requires bounce answers. |
| 40 | `passive_effectImmune` | Passive | 1 | **A+** — Immune to opponent effects. Near-total protection. |
| 41 | `passive_cantBeAttacked` | Passive | 1 | **A** — Cannot be attacked. Forces removal or direct damage answers. |

## Summary

| Metric | Count |
|--------|-------|
| Total implemented effects | 41 |
| Used by cards | **41** (100%) |
| Cards with effects | 184 / 312 |

### Strength Tiers

| Tier | Meaning |
|------|---------|
| **S** | Game-winning / format-defining |
| **A+/A/A-** | Very strong, high competitive impact |
| **B+/B/B-** | Solid, good in the right context |
| **C+/C/C-** | Niche or situational, minor impact |
| **D** | Minimal impact, utility filler |

### Notable Observations

1. **All 41 effects (100%) are now in use** across the card pool.
2. **Most-used effects**: `buffField` (31), `tempAtkBonus` (18), `gainLP` (16), `draw` (15), `debuffField` (13), `bounceStrongestOpp` (10).
3. **S-tier effects kept rare**: `destroyAllOpp` (1), `passive_indestructible` (1), `bounceAllOppMonsters` (1).
4. **Damage drastically reduced**: `dealDamage` went from 33 to 6 cards (3 spells + 3 monsters).
5. **Healing now competitive**: Values scaled 60-100%, with top heal (1800 LP) matching damage output.
6. **Graveyard ecosystem added**: Self-mill, opponent mill, salvage, recycle, revive, and shuffle-back effects create strategic depth.
7. **Hand disruption introduced**: `discardOppHand` on 2 cards provides interaction beyond the board.
8. **Weak effects combo-paired**: `shuffleDeck`, `peekTopCard`, and `discardFromHand` always appear alongside stronger effects (searchDeckToHand, draw) for meaningful impact.
