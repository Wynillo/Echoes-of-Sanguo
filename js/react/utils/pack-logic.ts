import { CARD_DB } from '../../cards.js';
import { Rarity, Race } from '../../types.js';
import { Progression } from '../../progression.js';
import type { CardData } from '../../types.js';

export const PACK_TYPES: Record<string, { id: string; name: string; desc: string; price: number; icon: string; color: string }> = {
  starter: { id: 'starter', name: 'Starterpack',      desc: '9 Karten · Eine Rasse · C/U-lastig',          price: 200, icon: '✦', color: '#4080a0' },
  race:    { id: 'race',    name: 'Rassen-Pack',       desc: '9 Karten · Gewählte Rasse · Standard',        price: 350, icon: '⚔', color: '#a06020' },
  aether:  { id: 'aether',  name: 'Ätherpack',         desc: '9 Karten · Alle Rassen · Standard',           price: 500, icon: '◈', color: '#6040a0' },
  rarity:  { id: 'rarity',  name: 'Seltenheitspack',   desc: '9 Karten · Min. Rare · Erhöhte SR/UR-Chance', price: 600, icon: '★', color: '#c0a020' },
};

function _pickRarity(slot: number, packType: string): Rarity {
  if (packType === 'rarity') {
    if (slot <= 7) return Rarity.Rare;
    const r = Math.random();
    if (r < 0.15) return Rarity.UltraRare;
    if (r < 0.45) return Rarity.SuperRare;
    return Rarity.Rare;
  }
  if (slot <= 5) return Rarity.Common;
  if (slot <= 7) return Rarity.Uncommon;
  if (slot === 8) return Rarity.Rare;
  const r = Math.random();
  if (r < 0.05) return Rarity.UltraRare;
  if (r < 0.25) return Rarity.SuperRare;
  return Rarity.Rare;
}

function _allCardsByRarity(rarity: Rarity, race: Race | null): CardData[] {
  return (Object.values(CARD_DB) as CardData[]).filter(c =>
    c.rarity === rarity && (!race || c.race === race)
  );
}

function _pickCard(rarity: Rarity, race: Race | null): CardData {
  let pool = _allCardsByRarity(rarity, race);
  if (!pool.length) {
    const fallbacks: Partial<Record<Rarity, Rarity>> = {
      [Rarity.UltraRare]: Rarity.SuperRare,
      [Rarity.SuperRare]: Rarity.Rare,
      [Rarity.Rare]:      Rarity.Uncommon,
      [Rarity.Uncommon]:  Rarity.Common,
    };
    pool = _allCardsByRarity(fallbacks[rarity] || Rarity.Common, race);
  }
  if (!pool.length) pool = Object.values(CARD_DB) as CardData[];
  return pool[Math.floor(Math.random() * pool.length)];
}

export function openPack(packType: string, race: Race | null = null): CardData[] {
  const starterRace = Progression.getStarterRace();
  const targetRace: Race | null = packType === 'race'    ? race
    : packType === 'starter' ? (starterRace != null ? Number(starterRace) as Race : race)
    : null;

  const cards: CardData[] = [];
  for (let slot = 1; slot <= 9; slot++) {
    cards.push(_pickCard(_pickRarity(slot, packType), targetRace));
  }
  return cards;
}
