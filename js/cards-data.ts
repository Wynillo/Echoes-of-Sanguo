// ============================================================
// ECHOES OF SANGUO – Complete Card Database (generator source)
// Contains ALL card definitions (base + generated).
// NOT imported at runtime — only used by generate-base-ac.ts.
// ============================================================
import { Race } from './types.js';
import type { CardEffectBlock } from './types.js';

  // ── Effekt-Fabriken (data-driven) ──────────────────────────
  function fxBurnSummon(n: number): CardEffectBlock      { return { trigger:'onSummon',          actions:[{ type:'dealDamage', target:'opponent', value:n }] }; }
  function fxHealSummon(n: number): CardEffectBlock      { return { trigger:'onSummon',          actions:[{ type:'gainLP', target:'self', value:n }] }; }
  function fxDrawSummon(n: number): CardEffectBlock      { return { trigger:'onSummon',          actions:[{ type:'draw', target:'self', count:n }] }; }
  function fxBurnDestroy(n: number): CardEffectBlock     { return { trigger:'onDestroyByBattle', actions:[{ type:'dealDamage', target:'opponent', value:n }] }; }
  function fxHealDestroy(n: number): CardEffectBlock     { return { trigger:'onDestroyByBattle', actions:[{ type:'gainLP', target:'self', value:n }] }; }
  function fxDrawDestroy(n: number): CardEffectBlock     { return { trigger:'onDestroyByBattle', actions:[{ type:'draw', target:'self', count:n }] }; }
  function fxBuffRaceSummon(race: Race, n: number): CardEffectBlock {
    return { trigger:'onSummon', actions:[{ type:'buffAtkRace', race, value:n }] };
  }
  function fxDebuffAllOpp(atkD: number, defD: number): CardEffectBlock {
    return { trigger:'onSummon', actions:[{ type:'debuffAllOpp', atkD, defD }] };
  }
  function fxBounceOppSummon(): CardEffectBlock {
    return { trigger:'onSummon', actions:[{ type:'bounceStrongestOpp' }] };
  }
  function fxPiercing(): CardEffectBlock         { return { trigger:'passive', actions:[{ type:'passive_piercing' }] }; }
  function fxUntargetable(): CardEffectBlock    { return { trigger:'passive', actions:[{ type:'passive_untargetable' }] }; }
  function fxCanDirectAttack(): CardEffectBlock { return { trigger:'passive', actions:[{ type:'passive_directAttack' }] }; }
