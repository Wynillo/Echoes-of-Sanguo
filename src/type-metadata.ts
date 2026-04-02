import { CardType, Attribute, Race, Rarity } from './types.js';

export interface RaceMeta {
  id:     number;
  key:    string;   // stable PascalCase identifier (e.g. 'Dragon')
  value:  string;   // display label (localized)
  color:  string;   // primary display color (hex)
  icon?:  string;   // emoji or react-icons/gi identifier (e.g. 'GiWizardStaff')
  emoji?: string;   // plain-text fallback for text-only contexts (e.g. <option>)
}

export interface AttributeMeta {
  id:     number;
  key:    string;   // stable PascalCase identifier (e.g. 'Light')
  value:  string;   // display label (localized)
  color:  string;   // attribute orb color
  symbol?: string;  // attribute symbol character (optional)
}

export interface RarityMeta {
  id:     number;
  key:    string;   // stable PascalCase identifier (e.g. 'Common')
  value:  string;   // display label
  color:  string;   // display color
}

export interface CardTypeMeta {
  id:     number;
  key:    string;   // stable PascalCase identifier (e.g. 'Monster')
  value:  string;   // display label (localized)
  color:  string;   // display color
}

export const TYPE_META = {
  races:      [] as RaceMeta[],
  attributes: [] as AttributeMeta[],
  rarities:   [] as RarityMeta[],
  cardTypes:  [] as CardTypeMeta[],
};

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

export function initDefaults(): void {
  TYPE_META.races = [
    { id: Race.Dragon,      key: 'Dragon',      value: 'Dragon',      color: '#8040c0', icon: 'GiSpikedDragonHead', emoji: '🐲' },
    { id: Race.Spellcaster, key: 'Spellcaster', value: 'Spellcaster', color: '#6060c0', icon: 'GiWizardStaff',       emoji: '🔮' },
    { id: Race.Warrior,     key: 'Warrior',     value: 'Warrior',     color: '#c09030', icon: 'GiCrossedSwords',     emoji: '⚔️' },
    { id: Race.Beast,       key: 'Beast',       value: 'Beast',       color: '#e07030', icon: 'GiBearFace',          emoji: '🐅' },
    { id: Race.Plant,       key: 'Plant',       value: 'Plant',       color: '#40a050', icon: 'GiVineLeaf',          emoji: '🌿' },
    { id: Race.Rock,        key: 'Rock',        value: 'Rock',        color: '#808060', icon: 'GiStonePile',         emoji: '🪨' },
    { id: Race.Phoenix,     key: 'Phoenix',     value: 'Phoenix',     color: '#e06020', icon: 'GiFireBreath',          emoji: '🔥' },
    { id: Race.Undead,      key: 'Undead',      value: 'Undead',      color: '#804090', icon: 'GiSkullCrossedBones', emoji: '💀' },
    { id: Race.Aqua,        key: 'Aqua',        value: 'Aqua',        color: '#3080b0', icon: 'GiWaterDrop',         emoji: '🌊' },
    { id: Race.Insect,      key: 'Insect',      value: 'Insect',      color: '#90a040', icon: 'GiButterfly',         emoji: '🦋' },
    { id: Race.Machine,     key: 'Machine',     value: 'Machine',     color: '#708090', icon: 'GiGears',             emoji: '⚙️' },
    { id: Race.Pyro,        key: 'Pyro',        value: 'Pyro',        color: '#c03010', icon: 'GiFireBowl',          emoji: '♨' },
  ];

  TYPE_META.attributes = [
    { id: Attribute.Light, key: 'Light', value: 'Light', color: '#c09000', symbol: '☀' },
    { id: Attribute.Dark,  key: 'Dark',  value: 'Dark',  color: '#7020a0', symbol: '☽' },
    { id: Attribute.Fire,  key: 'Fire',  value: 'Fire',  color: '#c0300a', symbol: '♨' },
    { id: Attribute.Water, key: 'Water', value: 'Water', color: '#1a6aaa', symbol: '◎' },
    { id: Attribute.Earth, key: 'Earth', value: 'Earth', color: '#6a7030', symbol: '◆' },
    { id: Attribute.Wind,  key: 'Wind',  value: 'Wind',  color: '#4a6080', symbol: '∿' },
  ];

  TYPE_META.rarities = [
    { id: Rarity.Common,    key: 'Common',    value: 'Common',     color: '#aaa' },
    { id: Rarity.Uncommon,  key: 'Uncommon',  value: 'Uncommon',   color: '#7ec8e3' },
    { id: Rarity.Rare,      key: 'Rare',      value: 'Rare',       color: '#f5c518' },
    { id: Rarity.SuperRare, key: 'SuperRare', value: 'Super Rare', color: '#c084fc' },
    { id: Rarity.UltraRare, key: 'UltraRare', value: 'Ultra Rare', color: '#f97316' },
  ];

  TYPE_META.cardTypes = [
    { id: CardType.Monster, key: 'Monster', value: 'Monster',        color: '#c8a850' },
    { id: CardType.Fusion,  key: 'Fusion',  value: 'Fusion Monster', color: '#a050c0' },
    { id: CardType.Spell,   key: 'Spell',   value: 'Spell',          color: '#1dc0a0' },
    { id: CardType.Trap,      key: 'Trap',      value: 'Trap',            color: '#bc2060' },
    { id: CardType.Equipment, key: 'Equipment', value: 'Equipment',       color: '#e08030' },
  ];

  rebuildIndices();
}

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

initDefaults();
