# AI Tuning Guide — Echoes of Sanguo

This guide explains how to tune AI behavior by modifying scoring constants and thresholds in `src/ai-behaviors.ts`.

## Quick Reference

### Difficulty Adjustment

**Make AI stronger:**
- Increase `AI_BEHAVIOR_WEIGHTS` values (more aggressive goal pursuit)
- Increase `AI_LOOKAHEAD_CONFIG.GAMMA_*` values (values future plays more)
- Decrease `AI_LP_THRESHOLD.LOW` (survival mode activates later)

**Make AI weaker:**
- Decrease alignment bonuses and gamma values
- Increase `AI_LP_THRESHOLD.LOW` (survival mode activates earlier)

---

## Constant Groups

### AI_SCORE — General Decision Weights

| Constant | Default | Effect |
|----------|---------|--------|
| `EFFECT_CARD_BONUS` | 10000 | Priority for effect monsters during summon |
| `DESTROY_TARGET` | 1000 | Score for destroying opponent's monster |
| `STRONG_PROBE` | 200 | Bonus for attacking face-down with strong monster |
| `PROBE_ATK_THRESHOLD` | 1800 | ATK required to attack face-down |
| `FACEDOWN_RISK` | 300 | Penalty for attacking face-down |
| `FACEDOWN_DEF_ESTIMATE` | 1200 | Estimated DEF for face-down monsters |
| `EQUIP_UNLOCK_KILL` | 2000 | Priority for equipping to get a kill |
| `REVIVE_BEATS_STRONGEST` | 1000 | Priority for reviving monster that beats strongest |
| `BUFF_UNLOCK_KILL` | 800 | Priority for buffing to reach kill |
| `BUFF_KILL_THRESHOLD` | 1000 | ATK deficit where buff becomes valuable |
| `LOW_LP_SURVIVAL` | 300 | Bonus for defensive summon at low LP |
| `THREAT_LP_WEIGHT` | 0.4 | LP ratio weight in threat assessment |
| `THREAT_BOARD_WEIGHT` | 1.2 | Monster power diff weight in threat |
| `THREAT_HAND_WEIGHT` | 150 | Per-card hand advantage weight |
| `FUTURE_GAMMA_DEFAULT` | 0.7 | Default future value discount |

### AI_BEHAVIOR_WEIGHTS — Strategy Alignment

| Constant | Default | Behavior |
|----------|---------|----------|
| `AGGRESSIVE_ALIGNMENT` | 800 | Swarm aggro goal priority |
| `DEFENSIVE_ALIGNMENT` | 700 | Stall/drain goal priority |
| `SMART_ALIGNMENT` | 600 | Control goal priority |
| `CHEATING_ALIGNMENT` | 1200 | OTK fusion goal priority |

### AI_FUSION_CONFIG — Fusion Summon Thresholds

| Constant | Default | Behavior |
|----------|---------|----------|
| `MIN_ATK_DEFAULT` | 0 | Default minimum ATK for fusion |
| `MIN_ATK_DEFENSIVE` | 2000 | Defensive AI only fuses 2000+ ATK |

### AI_LOOKAHEAD_CONFIG — Future Planning

| Constant | Default | Behavior |
|----------|---------|----------|
| `DEPTH_DEFAULT` | 1 | Turns to simulate ahead |
| `GAMMA_AGGRESSIVE` | 0.7 | Aggressive AI discount factor |
| `GAMMA_DEFENSIVE` | 0.6 | Defensive AI (cautious) |
| `GAMMA_SMART` | 0.75 | Smart AI (balanced) |
| `GAMMA_CHEATING` | 0.9 | Cheating AI (very aggressive) |

### AI_LP_THRESHOLD — Life Point Triggers

| Constant | Default | Effect |
|----------|---------|--------|
| `LOW` | 3000 | Activates survival mode |
| `DEFENSIVE` | 5000 | AI starts playing defensively |

### AI_SUMMON_SCORE — Monster Summon Scoring

| Constant | Default | Effect |
|----------|---------|--------|
| `BEATS_OPPONENT` | 300 | Bonus for monster that beats opponent's |
| `SURVIVES_EXCHANGE` | 200 | Bonus for ATK >= opponent max |
| `DEFENSIVE_ANSWER` | 100 | Bonus for DEF that beats threat |
| `EFFECT_PRIORITY` | 400 | Bonus for effect monsters |

### AI_ATTACK_SCORE — Battle Scoring

| Constant | Default | Effect |
|----------|---------|--------|
| `EFFECT_PRIORITY` | 500 | Priority for destroying effect monsters |
| `AGGRESSIVE_TRADE` | 100 | Bonus for aggressive equal-ATK trade |
| `CONSERVATIVE_TRADE` | 200 | Penalty for conservative equal trade |
| `AGGRESSIVE_RISK` | 500 | Penalty for risky aggressive attack |

### AI_EQUIP_SCORE — Equipment Targeting

| Constant | Default | Effect |
|----------|---------|--------|
| `READY_TO_ATTACK` | 500 | Priority for monsters that haven't attacked |
| `DEFENSIVE_STANCE` | 300 | Priority for DEF position with DEF boost |

### AI_REVIVE_SCORE — Graveyard Revival

| Constant | Default | Effect |
|----------|---------|--------|
| `EFFECT_PRIORITY` | 500 | Priority for effect monsters |
| `FUSION_PRIORITY` | 300 | Priority for fusion monsters |

### AI_DEFENSIVE_CONFIG — Defensive Behavior

| Constant | Default | Effect |
|----------|---------|--------|
| `SWITCH_TURN` | 8 | Turns before defensive AI switches strategy |

---

## Tuning Workflow

### 1. Identify the Behavior to Change

**Example**: "AI doesn't summon strong enough monsters"

Check:
- `AI_SUMMON_SCORE` values
- `AI_FUSION_CONFIG.MIN_ATK_*` values
- `AI_LP_THRESHOLD` for survival mode

### 2. Adjust Incrementally

**Change one constant at a time by 10-20%**. Test after each change.

**Example**: Make AI more aggressive with fusions
```typescript
// Before
AI_FUSION_CONFIG = {
  MIN_ATK_DEFENSIVE: 2000,  // Too conservative
}

// After (10% reduction)
AI_FUSION_CONFIG = {
  MIN_ATK_DEFENSIVE: 1800,  // More aggressive
}
```

### 3. Test Against Human Players

Run duels against the modified AI and observe:
- Does it make the desired plays more often?
- Does it feel fair or frustrating?
- Are win rates balanced?

### 4. Document Changes

Record what you changed and why:
```markdown
## 2026-04-19 — AI Tuning
- Reduced `MIN_ATK_DEFENSIVE` from 2000 → 1800
  - Defensive AI now fuses more readily
  - Aimed at reducing stall gameplay
```

---

## Behavioral Profiles Overview

### Default (Balanced)
- `fusionMinATK`: 0
- `summonPriority`: highestATK
- `positionStrategy`: smart
- `battleStrategy`: smart
- `goal`: none (default scoring)

### Aggressive (Swarm)
- `alignmentBonus`: 800
- `positionStrategy`: always ATK
- `battleStrategy`: always attack
- `gamma`: 0.7
- **Playstyle**: Fast, risky, prioritizes damage over board control

### Defensive (Stall)
- `alignmentBonus`: 700
- `fusionMinATK`: 2000
- `switchTurn`: 8
- `positionStrategy`: always DEF
- `battleStrategy`: conservative
- `gamma`: 0.6
- **Playstyle**: Slow, safe, waits for opponent mistakes

### Smart (Control)
- `alignmentBonus`: 600
- `summonPriority`: effectFirst
- `positionStrategy`: smart
- `battleStrategy`: smart
- `gamma`: 0.75
- `holdFusionPiece`: true
- **Playstyle**: Evaluates board, holds resources for optimal plays

### Cheating (OTK Fusion)
- `alignmentBonus`: 1200
- `knowsPlayerHand`: true
- `peekDeckCards`: 5
- `gamma`: 0.9
- **Playstyle**: Hyper-aggressive fusion plays with full information

---

## Common Tuning Scenarios

### Scenario 1: AI Too Easy

**Symptoms**: Player wins consistently, AI makes poor trades

**Solutions**:
1. Increase `AI_BEHAVIOR_WEIGHTS` by 10-20% (better goal pursuit)
2. Increase `AI_LOOKAHEAD_CONFIG.GAMMA_*` values (plans further ahead)
3. Decrease `AI_LP_THRESHOLD.LOW` (survival mode later)

### Scenario 2: AI Too Hard

**Symptoms**: Player loses consistently, AI makes perfect plays

**Solutions**:
1. Decrease alignment bonuses by 10-20%
2. Decrease gamma values (less future planning)
3. Increase `AI_LP_THRESHOLD.LOW` (earlier survival mode)

### Scenario 3: AI Summons Weak Monsters

**Symptoms**: AI summons small monsters when stronger ones available

**Solutions**:
1. Increase `AI_SUMMON_SCORE.BEATS_OPPONENT`
2. Increase `AI_SUMMON_SCORE.SURVIVES_EXCHANGE`
3. Ensure hand scoring prioritizes ATK/DEF appropriately

### Scenario 4: AI Doesn't Use Effects

**Symptoms**: AI ignores effect monsters, plays vanilla monsters

**Solutions**:
1. Increase `AI_SCORE.EFFECT_CARD_BONUS` (currently 10000)
2. Increase `AI_SUMMON_SCORE.EFFECT_PRIORITY`
3. Increase `AI_ATTACK_SCORE.EFFECT_PRIORITY`

### Scenario 5: AI Makes Risky Attacks

**Symptoms**: AI attacks into unknown face-downs, loses monsters

**Solutions**:
1. Increase `AI_SCORE.FACEDOWN_RISK` penalty
2. Increase `AI_SCORE.PROBE_ATK_THRESHOLD` (requires stronger monsters)
3. Adjust `AI_ATTACK_SCORE.AGGRESSIVE_RISK` penalty

### Scenario 6: Defensive AI Too Passive

**Symptoms**: Defensive AI never fuses, just stalls

**Solutions**:
1. Decrease `AI_FUSION_CONFIG.MIN_ATK_DEFENSIVE` (currently 2000)
2. Decrease `AI_DEFENSIVE_CONFIG.SWITCH_TURN` (switches strategy earlier)
3. Increase `AI_BEHAVIOR_WEIGHTS.DEFENSIVE_ALIGNMENT`

---

## Testing Checklist

After making changes:

- [ ] Run `npm test` — all AI tests pass
- [ ] Play 5+ duels against modified AI
- [ ] Verify AI makes intended plays >70% of the time
- [ ] Check win rate is 40-60% (balanced)
- [ ] Test against different deck archetypes
- [ ] Verify no new bugs introduced (AI doesn't hang, crash)

---

## Notes

- **Constants are exported** — modders can reference them in custom behaviors
- **Names are descriptive** — `EQUIP_UNLOCK_KILL` clearly indicates purpose
- **Grouped logically** — each group handles one decision domain
- **Comments explain rationale** — see individual constant JSDoc comments

For questions or suggestions, open an issue on GitHub or consult `docs/ai-system.md` for architecture details.

---

**Last Updated**: 2026-04-19  
**Version**: 1.0
