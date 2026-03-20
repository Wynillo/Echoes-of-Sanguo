import { CARD_DB, RARITY } from '../../cards.js';
import { Progression } from '../../progression.js';
import type { CardData } from '../../types.js';

export const PACK_TYPES: Record<string, { id: string; name: string; desc: string; price: number; icon: string; color: string }> = {
  starter: { id: 'starter', name: 'Starterpack',      desc: '9 Karten · Eine Rasse · C/U-lastig',          price: 200, icon: '✦', color: '#4080a0' },
  race:    { id: 'race',    name: 'Rassen-Pack',       desc: '9 Karten · Gewählte Rasse · Standard',        price: 350, icon: '⚔', color: '#a06020' },
  aether:  { id: 'aether',  name: 'Ätherpack',         desc: '9 Karten · Alle Rassen · Standard',           price: 500, icon: '◈', color: '#6040a0' },
  rarity:  { id: 'rarity',  name: 'Seltenheitspack',   desc: '9 Karten · Min. Rare · Erhöhte SR/UR-Chance', price: 600, icon: '★', color: '#c0a020' },
};

function _pickRarity(slot: number, packType: string): string {
  if (packType === 'rarity') {
    if (slot <= 7) return RARITY.RARE;
    const r = Math.random();
    if (r < 0.15) return RARITY.ULTRA_RARE;
    if (r < 0.45) return RARITY.SUPER_RARE;
    return RARITY.RARE;
  }
  if (slot <= 5) return RARITY.COMMON;
  if (slot <= 7) return RARITY.UNCOMMON;
  if (slot === 8) return RARITY.RARE;
  const r = Math.random();
  if (r < 0.05) return RARITY.ULTRA_RARE;
  if (r < 0.25) return RARITY.SUPER_RARE;
  return RARITY.RARE;
}

function _allCardsByRarity(rarity: string, race: string | null): CardData[] {
  return (Object.values(CARD_DB) as CardData[]).filter(c =>
    (c as any).rarity === rarity && (!race || (c as any).race === race)
  );
}

function _pickCard(rarity: string, race: string | null): CardData {
  let pool = _allCardsByRarity(rarity, race);
  if (!pool.length) {
    const fallbacks: Record<string, string> = {
      [RARITY.ULTRA_RARE]: RARITY.SUPER_RARE,
      [RARITY.SUPER_RARE]: RARITY.RARE,
      [RARITY.RARE]:       RARITY.UNCOMMON,
      [RARITY.UNCOMMON]:   RARITY.COMMON,
    };
    pool = _allCardsByRarity(fallbacks[rarity] || RARITY.COMMON, race);
  }
  if (!pool.length) pool = Object.values(CARD_DB) as CardData[];
  return pool[Math.floor(Math.random() * pool.length)];
}

export function openPack(packType: string, race: string | null = null): CardData[] {
  const targetRace = packType === 'race'    ? race
    : packType === 'starter' ? (Progression.getStarterRace() || race || null)
    : null;

  const cards: CardData[] = [];
  for (let slot = 1; slot <= 9; slot++) {
    cards.push(_pickCard(_pickRarity(slot, packType), targetRace));
  }
  return cards;
}
