import { CardType, Attribute, Race, Rarity } from './types.js';

export interface RaceMeta {
  id:     number;
  key:    string;   // stable PascalCase identifier (e.g. 'Dragon')
  value:  string;   // display label (localized)
  color:  string;   // primary display color (hex)
  icon?:   string;   // react-icons/gi identifier (e.g. 'GiWizardStaff')
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
  rebuildIndices();
}

export interface TypeMetaData {
  races?:      RaceMeta[];
  attributes?: AttributeMeta[];
  rarities?:   RarityMeta[];
  cardTypes?:  CardTypeMeta[];
}

export function applyTypeMeta(data: TypeMetaData): void {
  if (data.races)      TYPE_META.races      = data.races.map(r => r.value ? r : { ...r, value: r.key });
  if (data.attributes) TYPE_META.attributes = data.attributes.map(a => a.value ? a : { ...a, value: a.key });
  if (data.rarities)   TYPE_META.rarities   = data.rarities.map(r => r.value ? r : { ...r, value: r.key });
  if (data.cardTypes)  TYPE_META.cardTypes  = data.cardTypes.map(c => c.value ? c : { ...c, value: c.key });
  rebuildIndices();
}

initDefaults();