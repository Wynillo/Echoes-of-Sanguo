// ============================================================
// ECHOES OF SANGUO — Centralized Enum Metadata
// Single source of truth for race/attribute/rarity/cardType display data.
// Populated with defaults at module load; can be overridden by types.json
// from a .tcg archive via applyTypeMeta().
// ============================================================

import { CardType, Attribute, Race, Rarity } from './types.js';

// ── Metadata interfaces ────────────────────────────────────

export interface RaceMeta {
  id:     number;
  key:    string;   // i18n suffix, e.g. 'drache' → t('cards.race_drache')
  color:  string;   // primary display color (hex)
  icon:   string;   // emoji icon for filter buttons
  symbol: string;   // symbol for opponent tiles
  abbr:   string;   // abbreviated display name (German)
}

export interface AttributeMeta {
  id:     number;
  key:    string;   // lowercase key, e.g. 'fire'
  color:  string;   // attribute orb color
  symbol: string;   // attribute symbol character
  name:   string;   // display name (German)
}

export interface RarityMeta {
  id:     number;
  key:    string;   // lowercase key, e.g. 'common'
  color:  string;   // display color
  name:   string;   // display name
}

export interface CardTypeMeta {
  id:     number;
  key:    string;   // lowercase key, e.g. 'monster'
  label:  string;   // display label (German)
  css:    string;   // CSS class prefix
}

// ── Central store ──────────────────────────────────────────

export const TYPE_META = {
  races:      [] as RaceMeta[],
  attributes: [] as AttributeMeta[],
  rarities:   [] as RarityMeta[],
  cardTypes:  [] as CardTypeMeta[],
};

// ── Lookup indices (rebuilt after init/apply) ──────────────

const _raceById   = new Map<number, RaceMeta>();
const _raceByKey  = new Map<string, RaceMeta>();
const _attrById   = new Map<number, AttributeMeta>();
const _attrByKey  = new Map<string, AttributeMeta>();
const _rarityById = new Map<number, RarityMeta>();
const _rarityByKey= new Map<string, RarityMeta>();
const _ctById     = new Map<number, CardTypeMeta>();
const _ctByKey    = new Map<string, CardTypeMeta>();

function rebuildIndices(): void {
  _raceById.clear();   _raceByKey.clear();
  _attrById.clear();   _attrByKey.clear();
  _rarityById.clear(); _rarityByKey.clear();
  _ctById.clear();     _ctByKey.clear();

  for (const r of TYPE_META.races)      { _raceById.set(r.id, r);   _raceByKey.set(r.key, r); }
  for (const a of TYPE_META.attributes) { _attrById.set(a.id, a);   _attrByKey.set(a.key, a); }
  for (const r of TYPE_META.rarities)   { _rarityById.set(r.id, r); _rarityByKey.set(r.key, r); }
  for (const c of TYPE_META.cardTypes)  { _ctById.set(c.id, c);     _ctByKey.set(c.key, c); }
}

// ── Lookup helpers ─────────────────────────────────────────

export function getRaceById(id: number): RaceMeta | undefined   { return _raceById.get(id); }
export function getRaceByKey(key: string): RaceMeta | undefined  { return _raceByKey.get(key); }
export function getAttrById(id: number): AttributeMeta | undefined  { return _attrById.get(id); }
export function getAttrByKey(key: string): AttributeMeta | undefined { return _attrByKey.get(key); }
export function getRarityById(id: number): RarityMeta | undefined   { return _rarityById.get(id); }
export function getRarityByKey(key: string): RarityMeta | undefined  { return _rarityByKey.get(key); }
export function getCardTypeById(id: number): CardTypeMeta | undefined   { return _ctById.get(id); }
export function getCardTypeByKey(key: string): CardTypeMeta | undefined  { return _ctByKey.get(key); }

/** Get all races as array (for filter button generation) */
export function getAllRaces(): readonly RaceMeta[] { return TYPE_META.races; }
/** Get all rarities as array */
export function getAllRarities(): readonly RarityMeta[] { return TYPE_META.rarities; }

// ── Default initialization ─────────────────────────────────

export function initDefaults(): void {
  TYPE_META.races = [
    { id: Race.Dragon,      key: 'drache',  color: '#8040c0', icon: '🐲', symbol: '⚡', abbr: 'Drache' },
    { id: Race.Spellcaster, key: 'magier',  color: '#6060c0', icon: '🔮', symbol: '✦', abbr: 'Magier' },
    { id: Race.Warrior,     key: 'krieger', color: '#c09030', icon: '⚔️', symbol: '⚔', abbr: 'Krieger' },
    { id: Race.Fire,        key: 'feuer',   color: '#e05030', icon: '🔥', symbol: '♨', abbr: 'Feuer' },
    { id: Race.Plant,       key: 'pflanze', color: '#40a050', icon: '🌿', symbol: '✿', abbr: 'Pflanze' },
    { id: Race.Stone,       key: 'stein',   color: '#808060', icon: '🪨', symbol: '⬡', abbr: 'Stein' },
    { id: Race.Flyer,       key: 'flug',    color: '#4090c0', icon: '🦅', symbol: '🜁', abbr: 'Flug' },
    { id: Race.Elf,         key: 'elfe',    color: '#90c060', icon: '✨', symbol: '☽', abbr: 'Elfe' },
    { id: Race.Demon,       key: 'daemon',  color: '#804090', icon: '💀', symbol: '☠', abbr: 'Dämon' },
    { id: Race.Water,       key: 'wasser',  color: '#3080b0', icon: '🌊', symbol: '≋', abbr: 'Wasser' },
  ];

  TYPE_META.attributes = [
    { id: Attribute.Light, key: 'light', color: '#c09000', symbol: '☀', name: 'Licht' },
    { id: Attribute.Dark,  key: 'dark',  color: '#7020a0', symbol: '☽', name: 'Dunkel' },
    { id: Attribute.Fire,  key: 'fire',  color: '#c0300a', symbol: '♨', name: 'Feuer' },
    { id: Attribute.Water, key: 'water', color: '#1a6aaa', symbol: '◎', name: 'Wasser' },
    { id: Attribute.Earth, key: 'earth', color: '#6a7030', symbol: '◆', name: 'Erde' },
    { id: Attribute.Wind,  key: 'wind',  color: '#4a6080', symbol: '∿', name: 'Wind' },
  ];

  TYPE_META.rarities = [
    { id: Rarity.Common,    key: 'common',    color: '#aaa',    name: 'Common' },
    { id: Rarity.Uncommon,  key: 'uncommon',  color: '#7ec8e3', name: 'Uncommon' },
    { id: Rarity.Rare,      key: 'rare',      color: '#f5c518', name: 'Rare' },
    { id: Rarity.SuperRare, key: 'superRare', color: '#c084fc', name: 'Super Rare' },
    { id: Rarity.UltraRare, key: 'ultraRare', color: '#f97316', name: 'Ultra Rare' },
  ];

  TYPE_META.cardTypes = [
    { id: CardType.Monster, key: 'monster', label: 'Normal', css: 'monster' },
    { id: CardType.Fusion,  key: 'fusion',  label: 'Fusion', css: 'fusion' },
    { id: CardType.Spell,   key: 'spell',   label: 'Zauber', css: 'spell' },
    { id: CardType.Trap,    key: 'trap',    label: 'Falle',  css: 'trap' },
  ];

  rebuildIndices();
}

// ── Apply external metadata (from types.json in .tcg archive) ──

export interface TypeMetaData {
  races?:      RaceMeta[];
  attributes?: AttributeMeta[];
  rarities?:   RarityMeta[];
  cardTypes?:  CardTypeMeta[];
}

export function applyTypeMeta(data: TypeMetaData): void {
  if (data.races)      TYPE_META.races      = data.races;
  if (data.attributes) TYPE_META.attributes = data.attributes;
  if (data.rarities)   TYPE_META.rarities   = data.rarities;
  if (data.cardTypes)  TYPE_META.cardTypes  = data.cardTypes;
  rebuildIndices();
}

// ── Auto-initialize defaults at module load ────────────────
initDefaults();
