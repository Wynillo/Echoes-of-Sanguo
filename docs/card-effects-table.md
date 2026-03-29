# Card Effects Table

Overview of all 41 implemented effects in `EFFECT_REGISTRY` (`js/effect-registry.ts`), their usage across the 312-card pool, and estimated competitive strength.

## All 41 Implemented Effects

| # | Effect Type | Category | Used? | # Cards | Strength |
|---|------------|----------|:-----:|:-------:|----------|
| 1 | `dealDamage` | Damage | Yes | 33 | **B+** — Reliable direct damage; strength depends on value. Common workhorse. |
| 2 | `gainLP` | Healing | Yes | 16 | **C+** — Sustain tool; rarely wins games but buys time. |
| 3 | `draw` | Card Draw | Yes | 12 | **A** — Card advantage is king. Extra draws are always strong. |
| 4 | `buffField` | Field Buff | Yes | 25 | **A-** — Permanent ATK/DEF boost to all matching allies. Scales with board width. |
| 5 | `tempBuffField` | Field Buff | No | 0 | **B** — Same as buffField but temporary. Weaker since it doesn't persist. |
| 6 | `debuffField` | Field Debuff | Yes | 13 | **A-** — Permanent debuff to all opponent monsters. Punishing on wide boards. |
| 7 | `tempDebuffField` | Field Debuff | Yes | 2 | **B** — Temporary version of debuffField. Useful but fades. |
| 8 | `bounceStrongestOpp` | Bounce | Yes | 10 | **A** — Removes opponent's best monster cleanly. No death triggers, forces re-summon. |
| 9 | `bounceAttacker` | Bounce | No | 0 | **A-** — Trap-style bounce; punishes aggression hard, wastes opponent's summon. |
| 10 | `bounceAllOppMonsters` | Bounce | Yes | 1 | **S** — Full board bounce. Devastating tempo swing, rightfully rare (1 card). |
| 11 | `searchDeckToHand` | Search | Yes | 4 | **A+** — Tutoring is one of the strongest mechanics in any TCG. |
| 12 | `tempAtkBonus` | Stat Mod | Yes | 18 | **B** — Temporary single-target ATK/DEF pump. Good combat trick. |
| 13 | `permAtkBonus` | Stat Mod | Yes | 6 | **B+** — Permanent single-target ATK/DEF boost. Stacks over time. |
| 14 | `tempDefBonus` | Stat Mod | Yes | 6 | **C+** — Temporary DEF-only boost. Narrow; only helps in defense position. |
| 15 | `permDefBonus` | Stat Mod | Yes | 1 | **C+** — Permanent DEF-only boost. Niche but persistent. |
| 16 | `reviveFromGrave` | Revival | No | 0 | **A** — Graveyard recursion is very strong. Reuses defeated monsters. |
| 17 | `cancelAttack` | Trap | Yes | 5 | **B** — Negates one attack. Defensive stall tool. |
| 18 | `destroyAttacker` | Trap | Yes | 5 | **A-** — Cancels attack AND destroys attacker. Strong 2-for-1. |
| 19 | `destroySummonedIf` | Trap | Yes | 2 | **B+** — Conditional summon punishment. Good vs big monsters. |
| 20 | `destroyAllOpp` | Destruction | No | 0 | **S** — One-sided board wipe. Game-winning if it resolves. |
| 21 | `destroyAll` | Destruction | No | 0 | **A** — Symmetric board wipe. Strong as a comeback tool. |
| 22 | `destroyWeakestOpp` | Destruction | No | 0 | **B-** — Targeted removal but hits the least threatening monster. |
| 23 | `destroyStrongestOpp` | Destruction | No | 0 | **A** — Targeted removal of biggest threat. Very efficient. |
| 24 | `sendTopCardsToGrave` | Mill (Self) | No | 0 | **B** — Self-mill. Enables graveyard synergies; risky but rewarding with recursion. |
| 25 | `sendTopCardsToGraveOpp` | Mill (Opp) | No | 0 | **A-** — Opponent mill. Very strong when graveyard recovery is scarce (currently none in pool). |
| 26 | `salvageFromGrave` | GY Recovery | No | 0 | **A-** — Retrieves card from graveyard to hand. Strong recursion. |
| 27 | `recycleFromGraveToDeck` | GY Recovery | No | 0 | **C+** — Returns card to deck (not hand). Slower than salvage. |
| 28 | `shuffleGraveIntoDeck` | GY Recovery | No | 0 | **C** — Anti-deck-out insurance. Niche utility. |
| 29 | `shuffleDeck` | Utility | No | 0 | **D** — Minimal impact on its own. Combo enabler at best. |
| 30 | `peekTopCard` | Utility | No | 0 | **D** — Information only, no board impact. |
| 31 | `specialSummonFromHand` | Summon | No | 0 | **A** — Extra summon = tempo advantage. Very strong. |
| 32 | `discardFromHand` | Hand Disrupt | No | 0 | **C-** — Self-discard (cost). Downside effect, usually paired with something strong. |
| 33 | `discardOppHand` | Hand Disrupt | No | 0 | **A-** — Opponent hand disruption. Powerful denial tool. |
| 34 | `passive_piercing` | Passive | Yes | 7 | **B+** — Piercing damage through DEF position. Punishes defensive play. |
| 35 | `passive_untargetable` | Passive | Yes | 7 | **A-** — Cannot be targeted by effects. Strong protection. |
| 36 | `passive_directAttack` | Passive | Yes | 2 | **A** — Bypasses all monsters for direct LP damage. Game-winning closer. |
| 37 | `passive_vsAttrBonus` | Passive | No | 0 | **C+** — ATK bonus vs specific attribute. Very matchup-dependent. |
| 38 | `passive_phoenixRevival` | Passive | Yes | 9 | **A** — Self-revive once on death. Effectively 2 lives. Excellent. |
| 39 | `passive_indestructible` | Passive | No | 0 | **S** — Cannot be destroyed. Extremely powerful if no bounce/exile exists. |
| 40 | `passive_effectImmune` | Passive | No | 0 | **A+** — Immune to opponent effects. Near-total protection. |
| 41 | `passive_cantBeAttacked` | Passive | No | 0 | **A** — Cannot be attacked. Forces removal or direct damage answers. |

## Summary

| Metric | Count |
|--------|-------|
| Total implemented effects | 41 |
| Used by cards | **20** (49%) |
| Unused | **21** (51%) |
| Cards with effects | ~184 / 312 |

### Strength Tiers

| Tier | Meaning |
|------|---------|
| **S** | Game-winning / format-defining |
| **A+/A/A-** | Very strong, high competitive impact |
| **B+/B/B-** | Solid, good in the right context |
| **C+/C/C-** | Niche or situational, minor impact |
| **D** | Minimal impact, utility filler |

### Notable Observations

1. **21 effects (51%) are implemented but unused** — many are high-power (destroyAllOpp, destroyStrongestOpp, reviveFromGrave, specialSummonFromHand, passive_indestructible).
2. **Most-used effects**: `dealDamage` (33), `buffField` (25), `tempAtkBonus` (18), `gainLP` (16), `debuffField` (13), `draw` (12).
3. **Strongest unused**: `destroyAllOpp` (S), `passive_indestructible` (S), `passive_effectImmune` (A+), `specialSummonFromHand` (A), `reviveFromGrave` (A), `destroyStrongestOpp` (A), `sendTopCardsToGraveOpp` (A-), `bounceAttacker` (A-), `discardOppHand` (A-), `salvageFromGrave` (A-).
4. **Mill is undervalued on paper but strong in practice**: With zero graveyard recovery cards in the pool, mill (`sendTopCardsToGraveOpp`) is permanent resource denial.
5. **Direct attack wins games**: Only 2 cards have `passive_directAttack` despite it being an A-tier closer that bypasses all board states.
6. **Design opportunity**: Over half the effect system is ready for new cards, which could significantly diversify gameplay.
