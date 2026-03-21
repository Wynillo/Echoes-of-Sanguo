// ============================================================
// AETHERIAL CLASH - Kartendatenbank
// ============================================================
import type { CardData, CardEffectBlock, FusionRecipe, OpponentConfig } from './types.js';
import { CardType, Attribute, Race, Rarity } from './types.js';

// Convenience aliases — these map the old constant names to the new enum values.
export const ATTR = Attribute;
export const TYPE = CardType;
export const RACE = Race;
export const RARITY = Rarity;

export const RACE_NAME: Record<number, string> = {
  [Race.Fire]: 'Feuer', [Race.Dragon]: 'Drache', [Race.Flyer]: 'Flug', [Race.Stone]: 'Stein',
  [Race.Plant]: 'Pflanze', [Race.Warrior]: 'Krieger', [Race.Spellcaster]: 'Magier',
  [Race.Elf]: 'Elfe', [Race.Demon]: 'Dämon', [Race.Water]: 'Wasser',
};

export const RACE_ICON: Record<number, string> = {
  [Race.Fire]: '🔥', [Race.Dragon]: '🐲', [Race.Flyer]: '🦅', [Race.Stone]: '🪨',
  [Race.Plant]: '🌿', [Race.Warrior]: '⚔️', [Race.Spellcaster]: '🔮',
  [Race.Elf]: '✨', [Race.Demon]: '💀', [Race.Water]: '🌊',
};

export const RARITY_NAME: Record<number, string> = {
  [Rarity.Common]: 'Common', [Rarity.Uncommon]: 'Uncommon', [Rarity.Rare]: 'Rare',
  [Rarity.SuperRare]: 'Super Rare', [Rarity.UltraRare]: 'Ultra Rare',
};

export const RARITY_COLOR: Record<number, string> = {
  [Rarity.Common]: '#aaa', [Rarity.Uncommon]: '#7ec8e3', [Rarity.Rare]: '#f5c518',
  [Rarity.SuperRare]: '#c084fc', [Rarity.UltraRare]: '#f97316',
};

export const ATTR_SYMBOL: Record<number, string> = {
  [Attribute.Fire]: '♨', [Attribute.Water]: '◎', [Attribute.Earth]: '◆',
  [Attribute.Wind]: '∿', [Attribute.Light]: '☀', [Attribute.Dark]: '☽',
};

export const ATTR_NAME: Record<number, string> = {
  [Attribute.Fire]: 'Feuer', [Attribute.Water]: 'Wasser', [Attribute.Earth]: 'Erde',
  [Attribute.Wind]: 'Wind', [Attribute.Light]: 'Licht', [Attribute.Dark]: 'Dunkel',
};

// ── Kartendatenbank ──────────────────────────────────────────
export const CARD_DB: Record<string, CardData> = {

  // ===== NORMALE MONSTER =====
  'M001': {
    id:'M001', name:'Feuersalamander', type:CardType.Monster,
    attribute:Attribute.Fire, race:Race.Fire, rarity:Rarity.Common, level:3, atk:1000, def:800,
    description:'Ein von lebenden Flammen umhüllter Salamander. Seine Schuppen brennen bei Berührung.',
  },
  'M002': {
    id:'M002', name:'Steingolem', type:CardType.Monster,
    attribute:Attribute.Earth, race:Race.Stone, rarity:Rarity.Common, level:4, atk:800, def:2000,
    description:'Ein massiver, animierter Steinkoloß. Fast unverwundbar gegen physische Angriffe.',
  },
  'M003': {
    id:'M003', name:'Meeresschlange', type:CardType.Monster,
    attribute:Attribute.Water, race:Race.Water, rarity:Rarity.Common, level:4, atk:1200, def:900,
    description:'Ein schlangenartiges Ungeheuer aus den Tiefen des Ozeans.',
  },
  'M004': {
    id:'M004', name:'Winddracos', type:CardType.Monster,
    attribute:Attribute.Wind, race:Race.Dragon, rarity:Rarity.Common, level:4, atk:1300, def:1000,
    description:'Ein flinker Drache, der auf Windströmungen reitet.',
  },
  'M005': {
    id:'M005', name:'Schattenwolf', type:CardType.Monster,
    attribute:Attribute.Dark, race:Race.Demon, rarity:Rarity.Common, level:3, atk:1100, def:800,
    description:'Ein Wolf, der sich zwischen den Schatten bewegt.',
  },
  'M006': {
    id:'M006', name:'Kristallritter', type:CardType.Monster,
    attribute:Attribute.Light, race:Race.Warrior, rarity:Rarity.Uncommon, level:4, atk:1500, def:1200,
    description:'Ein in magischen Kristall gehüllter Ritter.',
  },
  'M007': {
    id:'M007', name:'Eisenkrieger', type:CardType.Monster,
    attribute:Attribute.Earth, race:Race.Warrior, rarity:Rarity.Common, level:4, atk:1400, def:1100,
    description:'Ein erfahrener Krieger in schwerem Eisenpanzer.',
  },
  'M008': {
    id:'M008', name:'Korallenfee', type:CardType.Monster,
    attribute:Attribute.Water, race:Race.Elf, rarity:Rarity.Common, level:3, atk:800, def:1000,
    description:'Eine zarte Fee, die in bunten Korallenriffen lebt.',
  },
  'M009': {
    id:'M009', name:'Sturmfalke', type:CardType.Monster,
    attribute:Attribute.Wind, race:Race.Flyer, rarity:Rarity.Common, level:3, atk:1100, def:900,
    description:'Ein Falke, der Stürme aus seinen Schwingen ruft.',
  },
  'M010': {
    id:'M010', name:'Sonnenriester', type:CardType.Monster,
    attribute:Attribute.Light, race:Race.Spellcaster, rarity:Rarity.Common, level:4, atk:1000, def:1500,
    description:'Ein Priester, der der Sonnengottheit geweiht ist.',
  },
  'M011': {
    id:'M011', name:'Knochenschütze', type:CardType.Monster,
    attribute:Attribute.Dark, race:Race.Demon, rarity:Rarity.Common, level:3, atk:1000, def:700,
    description:'Ein Skelettsoldaat mit tödlicher Präzision.',
  },
  'M012': {
    id:'M012', name:'Moostroll', type:CardType.Monster,
    attribute:Attribute.Earth, race:Race.Plant, rarity:Rarity.Common, level:3, atk:900, def:1100,
    description:'Ein uralter Troll, bedeckt mit Moos und Flechten.',
  },
  'M013': {
    id:'M013', name:'Gluteber', type:CardType.Monster,
    attribute:Attribute.Fire, race:Race.Fire, rarity:Rarity.Common, level:4, atk:1400, def:600,
    description:'Ein riesiger Eber, der aus lodernden Flammen besteht.',
  },
  'M014': {
    id:'M014', name:'Tiefsee-Angler', type:CardType.Monster,
    attribute:Attribute.Water, race:Race.Water, rarity:Rarity.Common, level:3, atk:1000, def:800,
    description:'Ein bizarres Wesen aus den finstersten Meerestiefen.',
  },
  'M015': {
    id:'M015', name:'Silberpaladin', type:CardType.Monster,
    attribute:Attribute.Light, race:Race.Warrior, rarity:Rarity.Uncommon, level:5, atk:1900, def:1600,
    description:'Ein edler Paladin in silbernem Rüstzeug.',
  },
  'M016': {
    id:'M016', name:'Magmakrabbe', type:CardType.Monster,
    attribute:Attribute.Fire, race:Race.Fire, rarity:Rarity.Common, level:3, atk:900, def:1000,
    description:'Eine Krabbe aus erstarrter Lava mit glühenden Augen.',
  },

  // ===== EFFEKT-MONSTER =====
  'M019': {
    id:'M019', name:'Frosthexe', type:CardType.Monster,
    attribute:Attribute.Water, race:Race.Water, rarity:Rarity.Uncommon, level:4, atk:1200, def:1000,
    description:'[Effekt] Bei Beschwörung: Gegner verliert 300 LP.',
    effect: { trigger:'onSummon', actions:[{ type:'dealDamage', target:'opponent', value:300 }] }
  },
  'M020': {
    id:'M020', name:'Dunkelassassin', type:CardType.Monster,
    attribute:Attribute.Dark, race:Race.Demon, rarity:Rarity.Uncommon, level:4, atk:1400, def:800,
    description:'[Effekt] Wenn dieses Monster ein Monster im Kampf zerstört: Ziehe 1 Karte.',
    effect: { trigger:'onDestroyByBattle', actions:[{ type:'draw', target:'self', count:1 }] }
  },
  'M021': {
    id:'M021', name:'Naturschamane', type:CardType.Monster,
    attribute:Attribute.Earth, race:Race.Plant, rarity:Rarity.Uncommon, level:3, atk:900, def:900,
    description:'[Effekt] Bei Beschwörung: Alle deine Erde-Monster erhalten +200 ATK.',
    effect: { trigger:'onSummon', actions:[{ type:'buffAtkAttr', attr:Attribute.Earth, value:200 }] }
  },
  'M022': {
    id:'M022', name:'Flammenphönix', type:CardType.Monster,
    attribute:Attribute.Fire, race:Race.Fire, rarity:Rarity.Rare, level:5, atk:1700, def:1300,
    description:'[Effekt] Wenn durch den Gegner zerstört: Kann einmalig mit 500 weniger ATK als Spezialbeschwörung aus dem Friedhof beschworen werden.',
    effect: { trigger:'passive', actions:[{ type:'passive_phoenixRevival' }] }
  },
  'M023': {
    id:'M023', name:'Blitzmagier', type:CardType.Monster,
    attribute:Attribute.Wind, race:Race.Spellcaster, rarity:Rarity.Rare, level:5, atk:1800, def:1200,
    description:'[Effekt] Bei Beschwörung: Füge dem Gegner 500 Schaden zu.',
    effect: { trigger:'onSummon', actions:[{ type:'dealDamage', target:'opponent', value:500 }] }
  },
  'M024': {
    id:'M024', name:'Heiliger Krieger', type:CardType.Monster,
    attribute:Attribute.Light, race:Race.Warrior, rarity:Rarity.Rare, level:6, atk:2100, def:1800,
    description:'[Passiv] Im Kampf gegen ein DUNKEL-Monster: +500 ATK.',
    effect: { trigger:'passive', actions:[{ type:'passive_vsAttrBonus', attr:Attribute.Dark, atk:500 }] }
  },
  'M025': {
    id:'M025', name:'Schattensensenmann', type:CardType.Monster,
    attribute:Attribute.Dark, race:Race.Demon, rarity:Rarity.Rare, level:6, atk:2000, def:1600,
    description:'[Effekt] Wenn dieses Monster ein Monster zerstört: Erhalte 500 LP.',
    effect: { trigger:'onDestroyByBattle', actions:[{ type:'gainLP', target:'self', value:500 }] }
  },
  'M026': {
    id:'M026', name:'Wasserdrache', type:CardType.Monster,
    attribute:Attribute.Water, race:Race.Dragon, rarity:Rarity.Rare, level:6, atk:2200, def:1700,
    description:'[Effekt] Bei Beschwörung: Füge 1 Wasserkarte aus deinem Deck in deine Hand hinzu.',
    effect: { trigger:'onSummon', actions:[{ type:'searchDeckToHand', attr:Attribute.Water }] }
  },

  // ===== FUSIONSMONSTER =====
  'M027': {
    id:'M027', name:'Lavakoloss', type:CardType.Fusion,
    attribute:Attribute.Fire, race:Race.Fire, rarity:Rarity.Rare, level:6, atk:2100, def:1800,
    description:'[Fusion] Feuersalamander + Steingolem. Ein gewaltiger Titan aus Lava und Stein.',
  },
  'M028': {
    id:'M028', name:'Sturmleviathan', type:CardType.Fusion,
    attribute:Attribute.Water, race:Race.Dragon, rarity:Rarity.SuperRare, level:7, atk:2400, def:1900,
    description:'[Fusion] Meeresschlange + Winddracos. Ein uraltes Seeungeheuer, das Sturmseen beherrscht.',
  },
  'M029': {
    id:'M029', name:'Schattendracos', type:CardType.Fusion,
    attribute:Attribute.Dark, race:Race.Dragon, rarity:Rarity.SuperRare, level:8, atk:2600, def:2100,
    description:'[Fusion] Schattenwolf + Dunkelassassin. Ein finsterer Drache aus der Dunkelheit selbst.',
    effect:{ trigger:'onDestroyByBattle', actions:[{ type:'draw', target:'self', count:1 }] }
  },
  'M030': {
    id:'M030', name:'Strahlender Golem', type:CardType.Fusion,
    attribute:Attribute.Light, race:Race.Stone, rarity:Rarity.Rare, level:7, atk:2300, def:2400,
    description:'[Fusion] Steingolem + Kristallritter. Ein Golem, der in heiligem Licht erstrahlt.',
  },
  'M031': {
    id:'M031', name:'Tsunamischlange', type:CardType.Fusion,
    attribute:Attribute.Water, race:Race.Water, rarity:Rarity.Rare, level:6, atk:2000, def:1600,
    description:'[Fusion] Meeresschlange + Korallenfee. Eine Schlange, die Tsunamis herbeiruft.',
  },
  'M032': {
    id:'M032', name:'Wirbeladler', type:CardType.Fusion,
    attribute:Attribute.Wind, race:Race.Flyer, rarity:Rarity.Rare, level:5, atk:1900, def:1500,
    description:'[Fusion] Winddracos + Sturmfalke. Ein Adler, der Wirbelstürme erschafft.',
  },
  'M033': {
    id:'M033', name:'Eisenkolossos', type:CardType.Fusion,
    attribute:Attribute.Earth, race:Race.Stone, rarity:Rarity.SuperRare, level:7, atk:2500, def:2200,
    description:'[Fusion] Eisenkrieger + Steingolem. Ein unaufhaltsamer Kolossos aus Eisen und Stein.',
  },
  'M034': {
    id:'M034', name:'Flammender Phönix', type:CardType.Fusion,
    attribute:Attribute.Fire, race:Race.Fire, rarity:Rarity.SuperRare, level:7, atk:2400, def:2000,
    description:'[Fusion] Feuersalamander + Flammenphönix. Bei Beschwörung: Füge dem Gegner 800 Schaden zu.',
    effect:{ trigger:'onSummon', actions:[{ type:'dealDamage', target:'opponent', value:800 }] }
  },
  'M035': {
    id:'M035', name:'Himmelsdrache', type:CardType.Fusion,
    attribute:Attribute.Light, race:Race.Dragon, rarity:Rarity.UltraRare, level:9, atk:2900, def:2400,
    description:'[Fusion] Kristallritter + Heiliger Krieger. Der mächtigste Drache des Himmels. Kann nicht durch Effekte als Ziel gewählt werden.',
    effect:{ trigger:'passive', actions:[{ type:'passive_untargetable' }] }
  },
  'M036': {
    id:'M036', name:'Leerenphantom', type:CardType.Fusion,
    attribute:Attribute.Dark, race:Race.Demon, rarity:Rarity.UltraRare, level:7, atk:2500, def:2100,
    description:'[Fusion] Knochenschütze + Schattenwolf. Durchbohrender Angriff: Überschussschaden trifft die LP.',
    effect:{ trigger:'passive', actions:[{ type:'passive_piercing' }] }
  },

  // ===== ZAUBERKARTEN =====
  'S001': {
    id:'S001', name:'Feuerball', type:CardType.Spell,
    race:Race.Fire, rarity:Rarity.Common,
    description:'Füge dem Gegner 800 Schadenspunkte zu.',
    spellType:'normal',
    effect:{ trigger:'onSummon', actions:[{ type:'dealDamage', target:'opponent', value:800 }] }
  },
  'S002': {
    id:'S002', name:'Heilquelle', type:CardType.Spell,
    race:Race.Plant, rarity:Rarity.Common,
    description:'Erhalte 1000 Lebenspunkte.',
    spellType:'normal',
    effect:{ trigger:'onSummon', actions:[{ type:'gainLP', target:'self', value:1000 }] }
  },
  'S003': {
    id:'S003', name:'Kraftschub', type:CardType.Spell,
    rarity:Rarity.Common,
    description:'Wähle ein Monster auf deinem Spielfeld. Es erhält bis zum Ende des Zuges +700 ATK.',
    spellType:'targeted', target:'ownMonster',
    effect:{ trigger:'onSummon', actions:[{ type:'tempAtkBonus', target:'ownMonster', value:700 }] }
  },
  'S004': {
    id:'S004', name:'Dunkles Ritual', type:CardType.Spell,
    race:Race.Demon, rarity:Rarity.Uncommon,
    description:'Wähle ein DUNKEL-Monster auf deinem Spielfeld. Es erhält dauerhaft +500 ATK.',
    spellType:'targeted', target:'ownDarkMonster',
    effect:{ trigger:'onSummon', actions:[{ type:'permAtkBonus', target:'ownMonster', value:500, attrFilter:Attribute.Dark }] }
  },
  'S005': {
    id:'S005', name:'Kartenzug', type:CardType.Spell,
    rarity:Rarity.Common,
    description:'Ziehe 2 Karten.',
    spellType:'normal',
    effect:{ trigger:'onSummon', actions:[{ type:'draw', target:'self', count:2 }] }
  },
  'S006': {
    id:'S006', name:'Monsterwiederbelebung', type:CardType.Spell,
    rarity:Rarity.Uncommon,
    description:'Beschwöre ein Monster aus deinem Friedhof als Spezialbeschwörung.',
    spellType:'fromGrave', target:'ownGraveMonster',
    effect:{ trigger:'onSummon', actions:[{ type:'reviveFromGrave' }] }
  },

  // ===== FALLENKARTEN =====
  'T001': {
    id:'T001', name:'Gegenexplosion', type:CardType.Trap,
    rarity:Rarity.Common,
    description:'Aktiviere wenn ein Monster des Gegners angreift: Füge dem Gegner Schaden gleich ATK des angreifenden Monsters ÷ 2 zu.',
    trapTrigger:'onAttack',
    effect:{ trigger:'onAttack', actions:[
      { type:'dealDamage', target:'opponent', value:{ from:'attacker.effectiveATK', multiply:0.5, round:'floor' } },
      { type:'cancelAttack' },
    ]}
  },
  'T002': {
    id:'T002', name:'Spiegelschild', type:CardType.Trap,
    rarity:Rarity.Common,
    description:'Aktiviere wenn eines deiner Monster angegriffen wird: Negiere diesen Angriff.',
    trapTrigger:'onOwnMonsterAttacked',
    effect:{ trigger:'onOwnMonsterAttacked', actions:[{ type:'cancelAttack' }] }
  },
  'T003': {
    id:'T003', name:'Fallenloch', type:CardType.Trap,
    rarity:Rarity.Uncommon,
    description:'Aktiviere wenn der Gegner ein Monster mit 1000+ ATK beschwört: Zerstöre es.',
    trapTrigger:'onOpponentSummon',
    effect:{ trigger:'onOpponentSummon', actions:[{ type:'destroySummonedIf', minAtk:1000 }] }
  },
  'T004': {
    id:'T004', name:'Schwächungsfluch', type:CardType.Trap,
    rarity:Rarity.Common,
    description:'Aktiviere in der Kampfphase: Wähle ein Monster des Gegners – es verliert bis Kampfphasenende 1000 ATK.',
    trapTrigger:'manual', target:'oppMonster',
    effect:{ trigger:'manual', actions:[{ type:'tempAtkBonus', target:'oppMonster', value:-1000 }] }
  },
};

// ── Fusionsrezepte ─────────────────────────────────────────
export const FUSION_RECIPES: FusionRecipe[] = [
  { materials:['M001','M002'], result:'M027' },   // Lavakoloss
  { materials:['M003','M004'], result:'M028' },   // Sturmleviathan
  { materials:['M005','M020'], result:'M029' },   // Schattendracos
  { materials:['M002','M006'], result:'M030' },   // Strahlender Golem
  { materials:['M003','M008'], result:'M031' },   // Tsunamischlange
  { materials:['M004','M009'], result:'M032' },   // Wirbeladler
  { materials:['M007','M002'], result:'M033' },   // Eisenkolossos
  { materials:['M001','M022'], result:'M034' },   // Flammender Phönix
  { materials:['M006','M024'], result:'M035' },   // Himmelsdrache
  { materials:['M011','M005'], result:'M036' },   // Leerenphantom
];

// ── Decks ──────────────────────────────────────────────────
export const PLAYER_DECK_IDS: string[] = [
  'M001','M001','M002','M002','M003','M003',
  'M004','M005','M006','M008',
  'M009','M019','M020','M022','M023',
  'S001','S002','S003','S005',
  'T001','T003'
];

export const OPPONENT_DECK_IDS: string[] = [
  'M002','M002','M003','M003','M004','M004',
  'M007','M007','M009','M009',
  'M024','M025','M026','M006',
  'M011','M016',
  'S001','S002','S004',
  'T002','T004'
];

export function makeDeck(ids: string[]): CardData[] {
  return ids.map(id => {
    const card = CARD_DB[id];
    if (!card.effect) return { ...card };
    // Deep-clone effect so deck copies don't share the same object references.
    // Functions inside are shared (fine — they're never mutated), but own properties are isolated.
    return { ...card, effect: { ...card.effect } };
  });
}

export function checkFusion(id1: string, id2: string): FusionRecipe | null {
  return FUSION_RECIPES.find(r =>
    (r.materials[0]===id1 && r.materials[1]===id2) ||
    (r.materials[0]===id2 && r.materials[1]===id1)
  ) ?? null;
}

// ── Gegner-Konfigurationen ──────────────────────────────────
// Jeder Gegner hat ein thematisches Deck aus den bestehenden Karten.
// In Phase 3 werden diese mit den neuen Karten erweitert.
export const OPPONENT_CONFIGS: OpponentConfig[] = [
  {
    id: 1,
    name: 'Lehrling Finn',
    title: 'Krieger-Lehrling',
    race: Race.Warrior,
    flavor: 'Ein unerfahrener Kämpfer. Perfekt zum Üben.',
    coinsWin: 100, coinsLoss: 20,
    deckIds: [
      'M007','M007','M012','M012','M009','M009',
      'M001','M003','M008','M008',
      'S002','S002','S005',
      'T002',
    ],
  },
  {
    id: 2,
    name: 'Gärtnerin Mira',
    title: 'Hüterin des Waldes',
    race: Race.Plant,
    flavor: 'Sie nährt ihre Monster mit Lichtzauber und Heilkräutern.',
    coinsWin: 150, coinsLoss: 30,
    deckIds: [
      'M012','M012','M008','M008','M010','M010',
      'M021','M021','M003','M014',
      'S002','S002','S005','S006',
      'T001','T002',
    ],
  },
  {
    id: 3,
    name: 'Flüsterin Syl',
    title: 'Elfische Verzauberin',
    race: Race.Elf,
    flavor: 'Ihre sanfte Stimme verbirgt tödliche Magie.',
    coinsWin: 200, coinsLoss: 40,
    deckIds: [
      'M008','M008','M010','M010','M006','M006',
      'M019','M021','M015',
      'S002','S003','S003','S005','S006',
      'T002','T003',
    ],
  },
  {
    id: 4,
    name: 'Tiefseefischer Rok',
    title: 'Herr der Tiefsee',
    race: Race.Water,
    flavor: 'Aus den dunkelsten Tiefen beschwört er uralte Schrecken.',
    coinsWin: 200, coinsLoss: 40,
    deckIds: [
      'M003','M003','M014','M014','M008','M008',
      'M019','M019','M026',
      'S001','S002','S005','S006',
      'T001','T003','T004',
    ],
  },
  {
    id: 5,
    name: 'Vulkanschmied Tor',
    title: 'Meister der Flammen',
    race: Race.Fire,
    flavor: 'In seiner Esse schmiedete er Waffen, die Berge schmelzen.',
    coinsWin: 250, coinsLoss: 50,
    deckIds: [
      'M001','M001','M013','M013','M016','M016',
      'M022','M022','M023',
      'S001','S001','S002','S003','S005',
      'T001','T001','T003',
    ],
  },
  {
    id: 6,
    name: 'Steinhüter Grom',
    title: 'Wächter der Felsen',
    race: Race.Stone,
    flavor: 'Sein Körper ist so hart wie der Stein, den er beherrscht.',
    coinsWin: 300, coinsLoss: 60,
    deckIds: [
      'M002','M002','M007','M007','M012','M012',
      'M015','M021','M024',
      'S002','S002','S003','S005','S006',
      'T001','T002','T002','T003','T004',
    ],
  },
  {
    id: 7,
    name: 'Schattenhändler Vex',
    title: 'Händler der Dunkelheit',
    race: Race.Demon,
    flavor: 'Er verkauft Seelen – und zahlt immer seinen Preis.',
    coinsWin: 300, coinsLoss: 60,
    deckIds: [
      'M005','M005','M011','M011','M020','M020',
      'M025','M025','M004',
      'S001','S001','S004','S004','S005',
      'T001','T003','T003','T004','T004',
    ],
  },
  {
    id: 8,
    name: 'Windweberin Ara',
    title: 'Beherrscherin der Lüfte',
    race: Race.Flyer,
    flavor: 'Sie tanzt mit dem Wind und lässt ihre Feinde straucheln.',
    coinsWin: 400, coinsLoss: 80,
    deckIds: [
      'M004','M004','M009','M009','M023','M023',
      'M015','M026','M022',
      'S001','S003','S003','S005','S006',
      'T001','T002','T003','T003','T004',
    ],
  },
  {
    id: 9,
    name: 'Erzmagier Theron',
    title: 'Meister der Arkanen',
    race: Race.Spellcaster,
    flavor: 'Jahrzehnte studierte er verbotene Zauberkünste.',
    coinsWin: 400, coinsLoss: 80,
    deckIds: [
      'M010','M010','M023','M023','M006','M006',
      'M024','M025','M026','M015',
      'S001','S002','S004','S005','S006',
      'T001','T002','T003','T003','T004',
    ],
  },
  {
    id: 10,
    name: 'Drachenfürst Varek',
    title: 'Herr der Drachen',
    race: Race.Dragon,
    flavor: 'Der stärkste Duellant des Reiches. Keine Gnade.',
    coinsWin: 500, coinsLoss: 100,
    deckIds: [
      'M004','M004','M026','M026','M023','M023',
      'M024','M025','M015','M022',
      'S001','S001','S004','S005','S006',
      'T001','T001','T002','T003','T004',
    ],
  },
];
