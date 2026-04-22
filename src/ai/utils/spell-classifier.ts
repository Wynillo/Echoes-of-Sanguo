import type { CardData } from '../../types.js';

export interface SpellClassification {
  dealsDamage: boolean;
  heals: boolean;
  buffs: boolean;
  destroys: boolean;
  buffsTargetCount: number;
  destroysTargetCount: number;
}

const BUFF_TYPES = new Set(['buffAtkAll', 'buffAtkRace', 'buffAtk', 'buffField']);
const DESTROY_TYPES = new Set(['destroyMonster', 'destroyAll', 'destroySpellTrap']);

export function classifySpell(card: CardData): SpellClassification {
  const actions = card.effect?.actions ?? [];
  
  const result: SpellClassification = {
    dealsDamage: false,
    heals: false,
    buffs: false,
    destroys: false,
    buffsTargetCount: 0,
    destroysTargetCount: 0,
  };
  
  for (const action of actions) {
    const t = action.type as string;
    if (t === 'dealDamage') {
      result.dealsDamage = true;
    } else if (t === 'gainLP') {
      result.heals = true;
    } else if (BUFF_TYPES.has(t)) {
      result.buffs = true;
      result.buffsTargetCount++;
    } else if (DESTROY_TYPES.has(t)) {
      result.destroys = true;
      result.destroysTargetCount++;
    }
  }
  
  return result;
}
