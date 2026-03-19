// ============================================================
// AETHERIAL CLASH - Kartendatenbank
// ============================================================
import type { CardData, FusionRecipe, OpponentConfig, Attribute, Race, CardType, RarityLevel } from './types.js';

export const ATTR: Record<string, Attribute> = { FIRE: 'fire', WATER: 'water', EARTH: 'earth', WIND: 'wind', LIGHT: 'light', DARK: 'dark' };
export const TYPE: Record<string, CardType> = { NORMAL: 'normal', EFFECT: 'effect', FUSION: 'fusion', SPELL: 'spell', TRAP: 'trap' };

export const RACE: Record<string, Race> = {
  FEUER:   'feuer',
  DRACHE:  'drache',
  FLUG:    'flug',
  STEIN:   'stein',
  PFLANZE: 'pflanze',
  KRIEGER: 'krieger',
  MAGIER:  'magier',
  ELFE:    'elfe',
  DAEMON:  'daemon',
  WASSER:  'wasser',
};

export const RACE_NAME: Record<string, string> = {
  feuer: 'Feuer', drache: 'Drache', flug: 'Flug', stein: 'Stein',
  pflanze: 'Pflanze', krieger: 'Krieger', magier: 'Magier',
  elfe: 'Elfe', daemon: 'Dämon', wasser: 'Wasser',
};

export const RACE_ICON: Record<string, string> = {
  feuer: '🔥', drache: '🐲', flug: '🦅', stein: '🪨',
  pflanze: '🌿', krieger: '⚔️', magier: '🔮',
  elfe: '✨', daemon: '💀', wasser: '🌊',
};

export const RARITY: Record<string, RarityLevel> = {
  COMMON:     'common',
  UNCOMMON:   'uncommon',
  RARE:       'rare',
  SUPER_RARE: 'super_rare',
  ULTRA_RARE: 'ultra_rare',
};

export const RARITY_NAME:  Record<string, string> = { common:'Common', uncommon:'Uncommon', rare:'Rare', super_rare:'Super Rare', ultra_rare:'Ultra Rare' };
export const RARITY_COLOR: Record<string, string> = { common:'#aaa', uncommon:'#7ec8e3', rare:'#f5c518', super_rare:'#c084fc', ultra_rare:'#f97316' };

export const ATTR_SYMBOL: Record<string, string> = { fire: '♨', water: '◎', earth: '◆', wind: '∿', light: '☀', dark: '☽' };
export const ATTR_NAME:   Record<string, string> = { fire: 'Feuer', water: 'Wasser', earth: 'Erde', wind: 'Wind', light: 'Licht', dark: 'Dunkel' };

// ── Kartendatenbank ──────────────────────────────────────────
export const CARD_DB: Record<string, CardData> = {

  // ===== NORMALE MONSTER =====
  'M001': {
    id:'M001', name:'Feuersalamander', type:TYPE.NORMAL,
    attribute:ATTR.FIRE, race:RACE.FEUER, rarity:RARITY.COMMON, level:3, atk:1000, def:800,
    description:'Ein von lebenden Flammen umhüllter Salamander. Seine Schuppen brennen bei Berührung.',
  },
  'M002': {
    id:'M002', name:'Steingolem', type:TYPE.NORMAL,
    attribute:ATTR.EARTH, race:RACE.STEIN, rarity:RARITY.COMMON, level:4, atk:800, def:2000,
    description:'Ein massiver, animierter Steinkoloß. Fast unverwundbar gegen physische Angriffe.',
  },
  'M003': {
    id:'M003', name:'Meeresschlange', type:TYPE.NORMAL,
    attribute:ATTR.WATER, race:RACE.WASSER, rarity:RARITY.COMMON, level:4, atk:1200, def:900,
    description:'Ein schlangenartiges Ungeheuer aus den Tiefen des Ozeans.',
  },
  'M004': {
    id:'M004', name:'Winddracos', type:TYPE.NORMAL,
    attribute:ATTR.WIND, race:RACE.DRACHE, rarity:RARITY.COMMON, level:4, atk:1300, def:1000,
    description:'Ein flinker Drache, der auf Windströmungen reitet.',
  },
  'M005': {
    id:'M005', name:'Schattenwolf', type:TYPE.NORMAL,
    attribute:ATTR.DARK, race:RACE.DAEMON, rarity:RARITY.COMMON, level:3, atk:1100, def:800,
    description:'Ein Wolf, der sich zwischen den Schatten bewegt.',
  },
  'M006': {
    id:'M006', name:'Kristallritter', type:TYPE.NORMAL,
    attribute:ATTR.LIGHT, race:RACE.KRIEGER, rarity:RARITY.UNCOMMON, level:4, atk:1500, def:1200,
    description:'Ein in magischen Kristall gehüllter Ritter.',
  },
  'M007': {
    id:'M007', name:'Eisenkrieger', type:TYPE.NORMAL,
    attribute:ATTR.EARTH, race:RACE.KRIEGER, rarity:RARITY.COMMON, level:4, atk:1400, def:1100,
    description:'Ein erfahrener Krieger in schwerem Eisenpanzer.',
  },
  'M008': {
    id:'M008', name:'Korallenfee', type:TYPE.NORMAL,
    attribute:ATTR.WATER, race:RACE.ELFE, rarity:RARITY.COMMON, level:3, atk:800, def:1000,
    description:'Eine zarte Fee, die in bunten Korallenriffen lebt.',
  },
  'M009': {
    id:'M009', name:'Sturmfalke', type:TYPE.NORMAL,
    attribute:ATTR.WIND, race:RACE.FLUG, rarity:RARITY.COMMON, level:3, atk:1100, def:900,
    description:'Ein Falke, der Stürme aus seinen Schwingen ruft.',
  },
  'M010': {
    id:'M010', name:'Sonnenriester', type:TYPE.NORMAL,
    attribute:ATTR.LIGHT, race:RACE.MAGIER, rarity:RARITY.COMMON, level:4, atk:1000, def:1500,
    description:'Ein Priester, der der Sonnengottheit geweiht ist.',
  },
  'M011': {
    id:'M011', name:'Knochenschütze', type:TYPE.NORMAL,
    attribute:ATTR.DARK, race:RACE.DAEMON, rarity:RARITY.COMMON, level:3, atk:1000, def:700,
    description:'Ein Skelettsoldaat mit tödlicher Präzision.',
  },
  'M012': {
    id:'M012', name:'Moostroll', type:TYPE.NORMAL,
    attribute:ATTR.EARTH, race:RACE.PFLANZE, rarity:RARITY.COMMON, level:3, atk:900, def:1100,
    description:'Ein uralter Troll, bedeckt mit Moos und Flechten.',
  },
  'M013': {
    id:'M013', name:'Gluteber', type:TYPE.NORMAL,
    attribute:ATTR.FIRE, race:RACE.FEUER, rarity:RARITY.COMMON, level:4, atk:1400, def:600,
    description:'Ein riesiger Eber, der aus lodernden Flammen besteht.',
  },
  'M014': {
    id:'M014', name:'Tiefsee-Angler', type:TYPE.NORMAL,
    attribute:ATTR.WATER, race:RACE.WASSER, rarity:RARITY.COMMON, level:3, atk:1000, def:800,
    description:'Ein bizarres Wesen aus den finstersten Meerestiefen.',
  },
  'M015': {
    id:'M015', name:'Silberpaladin', type:TYPE.NORMAL,
    attribute:ATTR.LIGHT, race:RACE.KRIEGER, rarity:RARITY.UNCOMMON, level:5, atk:1900, def:1600,
    description:'Ein edler Paladin in silbernem Rüstzeug.',
  },
  'M016': {
    id:'M016', name:'Magmakrabbe', type:TYPE.NORMAL,
    attribute:ATTR.FIRE, race:RACE.FEUER, rarity:RARITY.COMMON, level:3, atk:900, def:1000,
    description:'Eine Krabbe aus erstarrter Lava mit glühenden Augen.',
  },

  // ===== EFFEKT-MONSTER =====
  'M019': {
    id:'M019', name:'Frosthexe', type:TYPE.EFFECT,
    attribute:ATTR.WATER, race:RACE.WASSER, rarity:RARITY.UNCOMMON, level:4, atk:1200, def:1000,
    description:'[Effekt] Bei Beschwörung: Gegner verliert 300 LP.',
    effect: { trigger:'onSummon', apply(gs, owner){ gs.dealDamage(owner==='player'?'opponent':'player', 300); } }
  },
  'M020': {
    id:'M020', name:'Dunkelassassin', type:TYPE.EFFECT,
    attribute:ATTR.DARK, race:RACE.DAEMON, rarity:RARITY.UNCOMMON, level:4, atk:1400, def:800,
    description:'[Effekt] Wenn dieses Monster ein Monster im Kampf zerstört: Ziehe 1 Karte.',
    effect: { trigger:'onDestroyByBattle', apply(gs, owner){ gs.drawCard(owner, 1); } }
  },
  'M021': {
    id:'M021', name:'Naturschamane', type:TYPE.EFFECT,
    attribute:ATTR.EARTH, race:RACE.PFLANZE, rarity:RARITY.UNCOMMON, level:3, atk:900, def:900,
    description:'[Effekt] Bei Beschwörung: Alle deine Erde-Monster erhalten +200 ATK.',
    effect: { trigger:'onSummon', apply(gs, owner){
      gs.getState()[owner].field.monsters.forEach(fm => {
        if(fm && fm.card.attribute === ATTR.EARTH) fm.permATKBonus = (fm.permATKBonus||0) + 200;
      });
    }}
  },
  'M022': {
    id:'M022', name:'Flammenphönix', type:TYPE.EFFECT,
    attribute:ATTR.FIRE, race:RACE.FEUER, rarity:RARITY.RARE, level:5, atk:1700, def:1300,
    description:'[Effekt] Wenn durch den Gegner zerstört: Kann einmalig mit 500 weniger ATK als Spezialbeschwörung aus dem Friedhof beschworen werden.',
    effect: { trigger:'passive', phoenixRevival: true }
  },
  'M023': {
    id:'M023', name:'Blitzmagier', type:TYPE.EFFECT,
    attribute:ATTR.WIND, race:RACE.MAGIER, rarity:RARITY.RARE, level:5, atk:1800, def:1200,
    description:'[Effekt] Bei Beschwörung: Füge dem Gegner 500 Schaden zu.',
    effect: { trigger:'onSummon', apply(gs, owner){ gs.dealDamage(owner==='player'?'opponent':'player', 500); } }
  },
  'M024': {
    id:'M024', name:'Heiliger Krieger', type:TYPE.EFFECT,
    attribute:ATTR.LIGHT, race:RACE.KRIEGER, rarity:RARITY.RARE, level:6, atk:2100, def:1800,
    description:'[Passiv] Im Kampf gegen ein DUNKEL-Monster: +500 ATK.',
    effect: { trigger:'passive', vsAttrBonus: { attr: ATTR.DARK, atk: 500 } }
  },
  'M025': {
    id:'M025', name:'Schattensensenmann', type:TYPE.EFFECT,
    attribute:ATTR.DARK, race:RACE.DAEMON, rarity:RARITY.RARE, level:6, atk:2000, def:1600,
    description:'[Effekt] Wenn dieses Monster ein Monster zerstört: Erhalte 500 LP.',
    effect: { trigger:'onDestroyByBattle', apply(gs, owner){ gs.gainLP(owner, 500); } }
  },
  'M026': {
    id:'M026', name:'Wasserdrache', type:TYPE.EFFECT,
    attribute:ATTR.WATER, race:RACE.DRACHE, rarity:RARITY.RARE, level:6, atk:2200, def:1700,
    description:'[Effekt] Bei Beschwörung: Füge 1 Wasserkarte aus deinem Deck in deine Hand hinzu.',
    effect: { trigger:'onSummon', apply(gs, owner){
      const st = gs.getState();
      const deck = st[owner].deck;
      const idx = deck.findIndex(c => c.attribute === ATTR.WATER);
      if(idx !== -1){
        const [c] = deck.splice(idx,1);
        st[owner].hand.push(c);
        gs.addLog(`${owner==='player'?'Du':'Gegner'}: ${c.name} durch Wasserdrache auf die Hand genommen.`);
      }
    }}
  },

  // ===== FUSIONSMONSTER =====
  'M027': {
    id:'M027', name:'Lavakoloss', type:TYPE.FUSION,
    attribute:ATTR.FIRE, race:RACE.FEUER, rarity:RARITY.RARE, level:6, atk:2100, def:1800,
    description:'[Fusion] Feuersalamander + Steingolem. Ein gewaltiger Titan aus Lava und Stein.',
  },
  'M028': {
    id:'M028', name:'Sturmleviathan', type:TYPE.FUSION,
    attribute:ATTR.WATER, race:RACE.DRACHE, rarity:RARITY.SUPER_RARE, level:7, atk:2400, def:1900,
    description:'[Fusion] Meeresschlange + Winddracos. Ein uraltes Seeungeheuer, das Sturmseen beherrscht.',
  },
  'M029': {
    id:'M029', name:'Schattendracos', type:TYPE.FUSION,
    attribute:ATTR.DARK, race:RACE.DRACHE, rarity:RARITY.SUPER_RARE, level:8, atk:2600, def:2100,
    description:'[Fusion] Schattenwolf + Dunkelassassin. Ein finsterer Drache aus der Dunkelheit selbst.',
    effect:{ trigger:'onDestroyByBattle', apply(gs, owner){ gs.drawCard(owner,1); } }
  },
  'M030': {
    id:'M030', name:'Strahlender Golem', type:TYPE.FUSION,
    attribute:ATTR.LIGHT, race:RACE.STEIN, rarity:RARITY.RARE, level:7, atk:2300, def:2400,
    description:'[Fusion] Steingolem + Kristallritter. Ein Golem, der in heiligem Licht erstrahlt.',
  },
  'M031': {
    id:'M031', name:'Tsunamischlange', type:TYPE.FUSION,
    attribute:ATTR.WATER, race:RACE.WASSER, rarity:RARITY.RARE, level:6, atk:2000, def:1600,
    description:'[Fusion] Meeresschlange + Korallenfee. Eine Schlange, die Tsunamis herbeiruft.',
  },
  'M032': {
    id:'M032', name:'Wirbeladler', type:TYPE.FUSION,
    attribute:ATTR.WIND, race:RACE.FLUG, rarity:RARITY.RARE, level:5, atk:1900, def:1500,
    description:'[Fusion] Winddracos + Sturmfalke. Ein Adler, der Wirbelstürme erschafft.',
  },
  'M033': {
    id:'M033', name:'Eisenkolossos', type:TYPE.FUSION,
    attribute:ATTR.EARTH, race:RACE.STEIN, rarity:RARITY.SUPER_RARE, level:7, atk:2500, def:2200,
    description:'[Fusion] Eisenkrieger + Steingolem. Ein unaufhaltsamer Kolossos aus Eisen und Stein.',
  },
  'M034': {
    id:'M034', name:'Flammender Phönix', type:TYPE.FUSION,
    attribute:ATTR.FIRE, race:RACE.FEUER, rarity:RARITY.SUPER_RARE, level:7, atk:2400, def:2000,
    description:'[Fusion] Feuersalamander + Flammenphönix. Bei Beschwörung: Füge dem Gegner 800 Schaden zu.',
    effect:{ trigger:'onSummon', apply(gs, owner){ gs.dealDamage(owner==='player'?'opponent':'player', 800); } }
  },
  'M035': {
    id:'M035', name:'Himmelsdrache', type:TYPE.FUSION,
    attribute:ATTR.LIGHT, race:RACE.DRACHE, rarity:RARITY.ULTRA_RARE, level:9, atk:2900, def:2400,
    description:'[Fusion] Kristallritter + Heiliger Krieger. Der mächtigste Drache des Himmels. Kann nicht durch Effekte als Ziel gewählt werden.',
    effect:{ trigger:'passive', cannotBeTargeted: true }
  },
  'M036': {
    id:'M036', name:'Leerenphantom', type:TYPE.FUSION,
    attribute:ATTR.DARK, race:RACE.DAEMON, rarity:RARITY.ULTRA_RARE, level:7, atk:2500, def:2100,
    description:'[Fusion] Knochenschütze + Schattenwolf. Durchbohrender Angriff: Überschussschaden trifft die LP.',
    effect:{ trigger:'passive', piercing: true }
  },

  // ===== ZAUBERKARTEN =====
  'S001': {
    id:'S001', name:'Feuerball', type:TYPE.SPELL,
    race:RACE.FEUER, rarity:RARITY.COMMON,
    description:'Füge dem Gegner 800 Schadenspunkte zu.',
    spellType:'normal',
    effect:{ apply(gs, owner){ gs.dealDamage(owner==='player'?'opponent':'player', 800); } }
  },
  'S002': {
    id:'S002', name:'Heilquelle', type:TYPE.SPELL,
    race:RACE.PFLANZE, rarity:RARITY.COMMON,
    description:'Erhalte 1000 Lebenspunkte.',
    spellType:'normal',
    effect:{ apply(gs, owner){ gs.gainLP(owner, 1000); } }
  },
  'S003': {
    id:'S003', name:'Kraftschub', type:TYPE.SPELL,
    rarity:RARITY.COMMON,
    description:'Wähle ein Monster auf deinem Spielfeld. Es erhält bis zum Ende des Zuges +700 ATK.',
    spellType:'targeted', target:'ownMonster',
    effect:{ apply(gs, owner, target){
      if(target) { (target as {tempATKBonus: number}).tempATKBonus = ((target as {tempATKBonus: number}).tempATKBonus||0) + 700; }
    }}
  },
  'S004': {
    id:'S004', name:'Dunkles Ritual', type:TYPE.SPELL,
    race:RACE.DAEMON, rarity:RARITY.UNCOMMON,
    description:'Wähle ein DUNKEL-Monster auf deinem Spielfeld. Es erhält dauerhaft +500 ATK.',
    spellType:'targeted', target:'ownDarkMonster',
    effect:{ apply(gs, owner, target){
      if(target && (target as {card: CardData}).card.attribute === ATTR.DARK){
        (target as {permATKBonus: number}).permATKBonus = ((target as {permATKBonus: number}).permATKBonus||0) + 500;
      }
    }}
  },
  'S005': {
    id:'S005', name:'Kartenzug', type:TYPE.SPELL,
    rarity:RARITY.COMMON,
    description:'Ziehe 2 Karten.',
    spellType:'normal',
    effect:{ apply(gs, owner){ gs.drawCard(owner, 2); } }
  },
  'S006': {
    id:'S006', name:'Monsterwiederbelebung', type:TYPE.SPELL,
    rarity:RARITY.UNCOMMON,
    description:'Beschwöre ein Monster aus deinem Friedhof als Spezialbeschwörung.',
    spellType:'fromGrave', target:'ownGraveMonster',
    effect:{ apply(gs, owner, target){
      if(target) { gs.specialSummonFromGrave(owner, target as CardData); }
    }}
  },

  // ===== FALLENKARTEN =====
  'T001': {
    id:'T001', name:'Gegenexplosion', type:TYPE.TRAP,
    rarity:RARITY.COMMON,
    description:'Aktiviere wenn ein Monster des Gegners angreift: Füge dem Gegner Schaden gleich ATK des angreifenden Monsters ÷ 2 zu.',
    trapTrigger:'onAttack',
    effect:{ apply(gs, owner, attacker){
      const opp = owner==='player'?'opponent':'player';
      const dmg = Math.floor((attacker as {effectiveATK(): number}).effectiveATK() / 2);
      gs.dealDamage(opp, dmg);
      gs.addLog(`Gegenexplosion! ${dmg} Schaden an ${opp==='player'?'den Spieler':'den Gegner'}!`);
      return { cancelAttack: true };
    }}
  },
  'T002': {
    id:'T002', name:'Spiegelschild', type:TYPE.TRAP,
    rarity:RARITY.COMMON,
    description:'Aktiviere wenn eines deiner Monster angegriffen wird: Negiere diesen Angriff.',
    trapTrigger:'onOwnMonsterAttacked',
    effect:{ apply(gs, owner, attacker, defender){
      gs.addLog(`Spiegelschild! Angriff negiert!`);
      return { cancelAttack: true };
    }}
  },
  'T003': {
    id:'T003', name:'Fallenloch', type:TYPE.TRAP,
    rarity:RARITY.UNCOMMON,
    description:'Aktiviere wenn der Gegner ein Monster mit 1000+ ATK beschwört: Zerstöre es.',
    trapTrigger:'onOpponentSummon',
    effect:{ apply(gs, owner, summonedFieldCard){
      const fc = summonedFieldCard as {card: CardData} | null;
      if(fc && fc.card.atk !== undefined && fc.card.atk >= 1000){
        gs.addLog(`Fallenloch! ${fc.card.name} wird zerstört!`);
        return { destroySummoned: true };
      }
      return {};
    }}
  },
  'T004': {
    id:'T004', name:'Schwächungsfluch', type:TYPE.TRAP,
    rarity:RARITY.COMMON,
    description:'Aktiviere in der Kampfphase: Wähle ein Monster des Gegners – es verliert bis Kampfphasenende 1000 ATK.',
    trapTrigger:'manual', target:'oppMonster',
    effect:{ apply(gs, owner, target){
      if(target){ (target as {tempATKBonus: number}).tempATKBonus = ((target as {tempATKBonus: number}).tempATKBonus||0) - 1000; }
    }}
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
    race: RACE.KRIEGER,
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
    race: RACE.PFLANZE,
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
    race: RACE.ELFE,
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
    race: RACE.WASSER,
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
    race: RACE.FEUER,
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
    race: RACE.STEIN,
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
    race: RACE.DAEMON,
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
    race: RACE.FLUG,
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
    race: RACE.MAGIER,
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
    race: RACE.DRACHE,
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
