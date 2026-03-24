import { CARD_DB } from '../../cards.js';
import { Rarity, Race } from '../../types.js';
import { Progression } from '../../progression.js';
import { SHOP_DATA } from '../../shop-data.js';
import type { PackDef, PackSlotDef } from '../../shop-data.js';
import type { CardData } from '../../types.js';

// ── Public API (same shape as before) ───────────────────────

export type PackTypeInfo = { id: string; name: string; desc: string; price: number; icon: string; color: string };

/** Derive PACK_TYPES record from SHOP_DATA so existing consumers keep working. */
export const PACK_TYPES: Record<string, PackTypeInfo> = new Proxy({} as Record<string, PackTypeInfo>, {
  get(_target, prop: string) {
    const pack = SHOP_DATA.packs.find(p => p.id === prop);
    if (!pack) return undefined;
    return { id: pack.id, name: pack.name, desc: pack.desc, price: pack.price, icon: pack.icon, color: pack.color };
  },
  ownKeys() {
    return SHOP_DATA.packs.map(p => p.id);
  },
  getOwnPropertyDescriptor(_target, prop: string) {
    const pack = SHOP_DATA.packs.find(p => p.id === prop);
    if (!pack) return undefined;
    return { configurable: true, enumerable: true, value: { id: pack.id, name: pack.name, desc: pack.desc, price: pack.price, icon: pack.icon, color: pack.color } };
  },
  has(_target, prop: string) {
    return SHOP_DATA.packs.some(p => p.id === prop);
  },
});

// ── Data-driven rarity picker ───────────────────────────────

function _pickRarityFromSlot(slot: PackSlotDef): Rarity {
  if (slot.distribution) {
    const r = Math.random();
    let cumulative = 0;
    const entries = Object.entries(slot.distribution)
      .map(([k, v]) => [Number(k), v] as [number, number])
      .sort((a, b) => b[1] - a[1]); // sort by probability desc for stable iteration
    // iterate from lowest probability to highest to match cumulative check
    entries.sort((a, b) => a[1] - b[1]);
    for (const [rarity, prob] of entries) {
      cumulative += prob;
      if (r < cumulative) return rarity as Rarity;
    }
    // fallback to last entry
    return entries[entries.length - 1][0] as Rarity;
  }
  return (slot.rarity ?? Rarity.Common) as Rarity;
}

// ── Card pool helpers ───────────────────────────────────────

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

// ── Expand slots into individual rarity picks ───────────────

function _expandSlots(packDef: PackDef): Rarity[] {
  const rarities: Rarity[] = [];
  for (const slot of packDef.slots) {
    for (let i = 0; i < slot.count; i++) {
      rarities.push(_pickRarityFromSlot(slot));
    }
  }
  return rarities;
}

// ── Main public function ────────────────────────────────────

export function openPack(packType: string, race: Race | null = null): CardData[] {
  const packDef = SHOP_DATA.packs.find(p => p.id === packType);
  if (!packDef) return [];

  const starterRace = Progression.getStarterRace();
  const targetRace: Race | null =
    packDef.filter === 'byRace' && packType === 'race'    ? race
    : packDef.filter === 'byRace' && packType === 'starter' ? (starterRace != null ? Number(starterRace) as Race : race)
    : null;

  const rarities = _expandSlots(packDef);
  return rarities.map(r => _pickCard(r, targetRace));
}
