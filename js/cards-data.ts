// ============================================================
// AETHERIAL CLASH – Erweiterte Kartendatenbank
// 672 neue Karten + STARTER_DECKS
// Lädt nach cards.ts und erweitert CARD_DB global.
// ============================================================
import { CardType, Attribute, Race, Rarity } from './types.js';
import type { CardEffectBlock, CardData } from './types.js';
import { CARD_DB, FUSION_RECIPES } from './cards.js';

// Wraps every CARD_DB write — warns in the console if an ID is reused.
// This is a development guard only; the last write still wins.
function _addCard(id: string, def: CardData): void {
  if (CARD_DB[id]) {
    throw new Error(`[CARD_DB] ID-Kollision: "${id}" – Karte existiert bereits als "${CARD_DB[id].name}". IDs müssen eindeutig sein.`);
  }
  CARD_DB[id] = def;
}

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

  // ── Rassen-Attribut-Map ─────────────────────────────────────
  const RACE_ATTR: Record<Race, Attribute> = {
    [Race.Fire]: Attribute.Fire, [Race.Dragon]: Attribute.Wind, [Race.Flyer]: Attribute.Wind, [Race.Stone]: Attribute.Earth,
    [Race.Plant]: Attribute.Earth, [Race.Warrior]: Attribute.Light, [Race.Spellcaster]: Attribute.Dark, [Race.Elf]: Attribute.Light,
    [Race.Demon]: Attribute.Dark, [Race.Water]: Attribute.Water,
  };

  // ── Stat-Bias [ATK-Bonus, DEF-Bonus] ──────────────────────
  const RACE_BIAS: Record<Race, [number, number]> = {
    [Race.Fire]:        [+100,-100],
    [Race.Dragon]:      [+200,   0],
    [Race.Flyer]:       [ +50, -50],
    [Race.Stone]:       [-200,+300],
    [Race.Plant]:       [-100,+100],
    [Race.Warrior]:     [+100, +50],
    [Race.Spellcaster]: [ -50,-100],
    [Race.Elf]:         [-150, +50],
    [Race.Demon]:       [+150, -50],
    [Race.Water]:       [   0,   0],
  };

  // ── Basis-Stats pro Level ──────────────────────────────────
  const LVL_BASE: Record<number, [number, number]> = {
    1:[400,300], 2:[600,500], 3:[900,700],  4:[1200,900],
    5:[1600,1200], 6:[1900,1500], 7:[2200,1800], 8:[2500,2000], 9:[2800,2200],
  };

  function calcStats(level: number, race: Race, idx: number) {
    const b=LVL_BASE[level], bi=RACE_BIAS[race];
    const j=((idx%5)-2)*50;
    return {
      atk:Math.max(100, b[0]+bi[0]+j),
      def:Math.max(0,   b[1]+bi[1]-j),
    };
  }

  function rarityForIdx(idx: number): Rarity {
    if(idx<14) return Rarity.Common;
    if(idx<16) return Rarity.Uncommon;
    if(idx<20) return Rarity.Common;
    if(idx<24) return Rarity.Uncommon;
    if(idx<28) return Rarity.Uncommon;
    if(idx<30) return Rarity.Rare;
    if(idx<32) return Rarity.Uncommon;
    return Rarity.Rare;
  }

  function levelForIdx(idx: number): number {
    if(idx<4)  return 1;
    if(idx<8)  return 2;
    if(idx<16) return 3;
    if(idx<24) return 4;
    if(idx<30) return 5;
    return 6;
  }

  // ── Normal-Monster-Namensarrays (34 pro Rasse) ─────────────
  const NORMAL_NAMES: Record<Race, string[]> = {
    [Race.Fire]: [
      'Funkenelf','Glutwurm','Aschemaus','Zunderkäfer',
      'Kohlekatze','Gluttaube','Lavamolch','Flammenwelpe',
      'Brandspinne','Feuerfuchs','Glutlöwe','Lavakröte',
      'Aschegeist','Pyrofalk','Rußtroll','Feuerkrabbe',
      'Flammenbär','Glutstier','Lavaechse','Feuerbock',
      'Pyrowolf','Glutkobold','Lavariese','Flammenoger',
      'Feuertitan','Glutdrache','Pyrohai','Flammenfürst',
      'Lavagigant','Feueroger',
      'Lavakönig','Glutkoloss','Pyrogigant','Feuerteufel',
    ],
    [Race.Dragon]: [
      'Wyrmling','Drachenwelpe','Schuppenfuchs','Kleindrakon',
      'Eisdrachenwelpe','Klauenechse','Nestdrache','Schuppenlizard',
      'Bergwyrm','Schuppenwächter','Klauenwurm','Höhlendrache',
      'Moordrache','Sumpfwyrm','Walddrache','Steinwyrm',
      'Schattenwyrm','Eisdrache','Felsdrache','Dunkelwyrm',
      'Sturmdrache','Blitzwyrm','Glutwyrm','Aschenwyrm',
      'Drachenfürst','Drachenritter','Titanwyrm','Hordenwyrm',
      'Uraltdrache','Urwyrm',
      'Wyrmgott','Drachengott','Schuppengott','Drachenkaiser',
    ],
    [Race.Flyer]: [
      'Flatterwing','Federgeist','Windvogel','Luftwelpe',
      'Sturmtaube','Windgeist','Äthervogel','Federdrache',
      'Wolkenläufer','Sturmfalke','Windwächter','Federrabe',
      'Luftgeist','Äthertaucher','Windkreischer','Sturmschwalbe',
      'Himmelsjäger','Sturmadler','Winddrache','Gewittervogel',
      'Federkoloss','Wolkenwächter','Ätherwächter','Sturmreiter',
      'Himmelskoloss','Sturmschwinge','Wolkengigant','Äthertitan',
      'Himmelsgigant','Windfürst',
      'Sturmgott','Windkaiser','Himmelsfürst','Äthergott',
    ],
    [Race.Stone]: [
      'Kieselwurm','Granitlaus','Felskäfer','Sandgeist',
      'Erdmaus','Steinkobold','Felskröte','Granitechse',
      'Felskrabbler','Erdgeist','Granitgolem','Bergkröte',
      'Steinechse','Felskatze','Granitbär','Erdkobold',
      'Berggolem','Steinriese','Felskoloss','Granitgigant',
      'Erdritter','Steinwächter','Felsgardist','Bergwächter',
      'Steinkoloss','Felstitan','Granitfürst','Erdriese',
      'Bergfürst','Felsriese',
      'Steinkaiser','Erdkoloss','Granitkönig','Felsgott',
    ],
    [Race.Plant]: [
      'Moosgeist','Blütenfee','Pilzkobold','Rankengeist',
      'Dornenrebe','Waldgeist','Baumelf','Blütensprite',
      'Dornenranke','Wurzelgeist','Waldkobold','Waldtroll',
      'Baumgardist','Pilzriese','Blütenwächter','Rankenläufer',
      'Baumschildkröte','Waldriese','Blütendrache','Mooskoloss',
      'Dornenritter','Waldwächter','Rankengardist','Baumgigant',
      'Waldgigant','Dornenfürst','Blütentitan','Rankentitan',
      'Waldkoloss','Moostitan',
      'Waldgott','Blütengott','Rankenkaiser','Dornenkönig',
    ],
    [Race.Warrior]: [
      'Schildknappe','Schwertlehrling','Speerträger','Bogenschütze',
      'Schwertknecht','Schildläufer','Speersöldner','Bogensöldner',
      'Klingenläufer','Schwertsoldat','Schildgardist','Lanzenwächter',
      'Axtkrieger','Schwertgardist','Schildritter','Lanzensoldat',
      'Klinge','Rüstungsbrecher','Schwertritter','Schildheld',
      'Lanzenkämpfer','Klingenritter','Schwertmeister','Axtmeister',
      'Kriegerheld','Klingenmeister','Schwerttitan','Schildtitan',
      'Lanzenfürst','Schlachtherr',
      'Klingengott','Schwertkaiser','Schildkaiser','Kriegskönig',
    ],
    [Race.Spellcaster]: [
      'Runenfuchs','Zauberlehrling','Kristallauge','Arkangeist',
      'Runensprite','Arkaner Kobold','Zauberfuchs','Kristallsprite',
      'Runenwächter','Zauberschüler','Kristallseher','Arkanist',
      'Runenmeister','Zauberwächter','Kristallwächter','Arkanwächter',
      'Geistbeschwörer','Zauberhändler','Kristallmagier','Runenmagier',
      'Arkanzauberer','Beschwörer','Elementarmagier','Mystiker',
      'Erzbeschwörer','Runenlord','Zaubertitan','Kristalltitan',
      'Arkanmeister','Zaubermeister',
      'Magiergott','Runenkaiser','Zauberkönig','Arkankaiser',
    ],
    [Race.Elf]: [
      'Waldelf','Mondelf','Sternenfee','Lichtfee',
      'Mondfee','Sternenelf','Wiesenfee','Elfensprite',
      'Schattentänzerin','Wiesennixe','Sternenwandlerin','Mondtänzerin',
      'Lichtelfin','Wiesenwächter','Sternenwächter','Mondwächter',
      'Elfenritterin','Sternenschwerterin','Mondkämpferin','Lichtkämpferin',
      'Elfenkriegerin','Sternenritterin','Mondwächterin','Lichtwächterin',
      'Elfenfürstin','Mondkönigin','Lichtfürstin','Elfentitan',
      'Mondtitan','Sternentitan',
      'Elfengöttin','Mondgöttin','Lichtgöttin','Elfenkaiser',
    ],
    [Race.Demon]: [
      'Schattenfunke','Höllenfunke','Dunkelgeist','Schattenwelpe',
      'Höllenkobold','Dunkelsprite','Schattenläufer','Höllenkatze',
      'Dunkelklaue','Höllenwächter','Schattensoldat','Dunkeltroll',
      'Höllenritter','Schattengardist','Dunkelsöldner','Schattenmagier',
      'Höllenfürst','Dunkelritter','Schattenwächter','Höllenkoloss',
      'Dunkelkoloss','Schattengigant','Höllengigant','Dunkelgigant',
      'Schattentitan','Höllentitan','Dunkeltitan','Schattenmeister',
      'Höllenmeister','Dunkelmeister',
      'Schattengott','Höllengott','Dunkelgott','Schattenkaiser',
    ],
    [Race.Water]: [
      'Wellenwelpe','Tröpfchengeist','Schaumgeist','Nebelfee',
      'Wellenwächter','Tiefseefisch','Nebelgeist','Eisgeist',
      'Korallenwächter','Tiefseequalle','Nebelfisch','Strudelbote',
      'Eismeerkrabbe','Wellenkämpfer','Strudellöwe','Nebelläufer',
      'Tiefseekrabbe','Wellengardist','Eisschildkröte','Strudelritter',
      'Meereskoloss','Tiefseegigant','Eisritter','Wellengigant',
      'Tiefseefürst','Meerestitan','Eisgigant','Strudelgigant',
      'Wellentitan','Tiefseekönig',
      'Meereskaiser','Tiefseegott','Eisgott','Strudelgott',
    ],
  };

  const NM_PREFIX: Record<Race, string> = {
    [Race.Fire]:'NFE', [Race.Dragon]:'NDR', [Race.Flyer]:'NFL', [Race.Stone]:'NST', [Race.Plant]:'NPF',
    [Race.Warrior]:'NKR', [Race.Spellcaster]:'NMA', [Race.Elf]:'NEL', [Race.Demon]:'NDA', [Race.Water]:'NWA',
  };

  const NM_FLAVOR: Record<Race, (r: number) => string> = {
    [Race.Fire]:        r=>`Ein feuriges Wesen der Stufe ${r}.`,
    [Race.Dragon]:      r=>`Ein imposanter Drache der Stufe ${r}.`,
    [Race.Flyer]:       r=>`Ein fliegendes Wesen der Stufe ${r}.`,
    [Race.Stone]:       r=>`Ein steinernes Wesen mit hoher Verteidigung, Stufe ${r}.`,
    [Race.Plant]:       r=>`Ein pflanzliches Wesen der Stufe ${r}.`,
    [Race.Warrior]:     r=>`Ein kampferprobter Krieger der Stufe ${r}.`,
    [Race.Spellcaster]: r=>`Ein magisches Wesen der Stufe ${r}.`,
    [Race.Elf]:         r=>`Eine elfische Kreatur der Stufe ${r}.`,
    [Race.Demon]:       r=>`Ein dunkles dämonisches Wesen der Stufe ${r}.`,
    [Race.Water]:       r=>`Ein wasserbewohnendes Wesen der Stufe ${r}.`,
  };

  // ── 340 Normal-Monster generieren ─────────────────────────
  for(const raceVal of Object.values(Race).filter((v): v is Race => typeof v === 'number')) {
    const names=NORMAL_NAMES[raceVal];
    const prefix=NM_PREFIX[raceVal], attr=RACE_ATTR[raceVal];
    names.forEach((name,idx)=>{
      const level=levelForIdx(idx);
      const id=prefix+String(idx+1).padStart(2,'0');
      const {atk,def}=calcStats(level,raceVal,idx);
      _addCard(id, {
        id, name, type:CardType.Monster,
        attribute:attr, race:raceVal, rarity:rarityForIdx(idx),
        level, atk, def,
        description:NM_FLAVOR[raceVal](level),
      });
    });
  }

  // ── Effekt-Monster (200) ───────────────────────────────────
  // Format: [id, name, level, rarity, atk, def, desc, effect]
  const EFFECT_ENTRIES: [string, string, number, Rarity, number, number, string, CardEffectBlock][] = [

    // ── FEUER (EFE01–EFE20) ──────────────────────────────────
    ['EFE01','Glutspeier',      3,Rarity.Uncommon, 900, 600, '[Effekt] Bei Beschwörung: Gegner verliert 200 LP.', fxBurnSummon(200)],
    ['EFE02','Lavabrenner',     3,Rarity.Uncommon,1000, 700, '[Effekt] Bei Beschwörung: Gegner verliert 300 LP.', fxBurnSummon(300)],
    ['EFE03','Feuergeist',      4,Rarity.Uncommon,1200, 800, '[Effekt] Bei Beschwörung: Gegner verliert 400 LP.', fxBurnSummon(400)],
    ['EFE04','Aschewächter',    4,Rarity.Rare,    1300, 900, '[Effekt] Bei Beschwörung: Gegner verliert 500 LP.', fxBurnSummon(500)],
    ['EFE05','Gluthüter',       5,Rarity.Rare,    1600,1100, '[Effekt] Bei Beschwörung: Gegner verliert 600 LP.', fxBurnSummon(600)],
    ['EFE06','Feuerspucker',    3,Rarity.Uncommon, 800, 700, '[Effekt] Wenn im Kampf vernichtet: Gegner verliert 200 LP.', fxBurnDestroy(200)],
    ['EFE07','Lavawächter',     4,Rarity.Uncommon,1100, 900, '[Effekt] Wenn im Kampf vernichtet: Gegner verliert 300 LP.', fxBurnDestroy(300)],
    ['EFE08','Flammenjäger',    5,Rarity.Rare,    1500,1100, '[Effekt] Wenn im Kampf vernichtet: Gegner verliert 400 LP.', fxBurnDestroy(400)],
    ['EFE09','Pyrogeist',       4,Rarity.Rare,    1100, 800, '[Effekt] Bei Beschwörung: Alle Feuer-Monster erhalten +200 ATK.', fxBuffRaceSummon(Race.Fire,200)],
    ['EFE10','Glutmeister',     5,Rarity.Rare,    1500,1100, '[Effekt] Bei Beschwörung: Alle Feuer-Monster erhalten +300 ATK.', fxBuffRaceSummon(Race.Fire,300)],
    ['EFE11','Feuersänger',     3,Rarity.Uncommon, 950, 700, '[Effekt] Bei Beschwörung: Erhalte 200 LP.', fxHealSummon(200)],
    ['EFE12','Lavakönig',       4,Rarity.Uncommon,1100, 900, '[Effekt] Wenn im Kampf vernichtet: Ziehe 1 Karte.', fxDrawDestroy(1)],
    ['EFE13','Flammenmeister',  5,Rarity.Rare,    1700,1200, '[Effekt] Bei Beschwörung: Gegner verliert 800 LP.', fxBurnSummon(800)],
    ['EFE14','Pyrotitan',       6,Rarity.Rare,    1900,1400, '[Effekt] Bei Beschwörung: Gegner verliert 1000 LP.', fxBurnSummon(1000)],
    ['EFE15','Glutkoloss',      6,Rarity.SuperRare,2100,1500,'[Effekt] Bei Beschwörung: Alle Feuer-Monster erhalten +400 ATK.', fxBuffRaceSummon(Race.Fire,400)],
    ['EFE16','Lavagott',        7,Rarity.SuperRare,2200,1700,'[Effekt] Bei Beschwörung: Gegner verliert 1200 LP.', fxBurnSummon(1200)],
    ['EFE17','Feuerdrache',     7,Rarity.SuperRare,2300,1800,'[Effekt] Wenn im Kampf vernichtet: Gegner verliert 800 LP.', fxBurnDestroy(800)],
    ['EFE18','Pyrokaiser',      8,Rarity.SuperRare,2500,1900,'[Effekt] Bei Beschwörung: Gegner verliert 1500 LP.', fxBurnSummon(1500)],
    ['EFE19','Glutkaiser',      8,Rarity.UltraRare,2700,2100,'[Effekt] Bei Beschwörung: Gegner verliert 2000 LP.', fxBurnSummon(2000)],
    ['EFE20','Feuergott',       9,Rarity.UltraRare,3000,2300,'[Effekt] Bei Beschwörung: Alle Feuer-Monster erhalten +500 ATK. Gegner verliert 1000 LP.', fxBuffRaceSummon(Race.Fire,500)],

    // ── DRACHE (EDR01–EDR20) ──────────────────────────────────
    ['EDR01','Schuppenwyrm',    3,Rarity.Uncommon,1100, 700, '[Passiv] Durchbohrender Angriff.', fxPiercing()],
    ['EDR02','Klauenwächter',   4,Rarity.Uncommon,1400, 900, '[Passiv] Durchbohrender Angriff.', fxPiercing()],
    ['EDR03','Schattenwyrm',    4,Rarity.Rare,    1300, 900, '[Passiv] Kann nicht als Ziel gewählt werden.', fxUntargetable()],
    ['EDR04','Schildwyrm',      5,Rarity.Rare,    1700,1200, '[Passiv] Kann nicht als Ziel gewählt werden.', fxUntargetable()],
    ['EDR05','Eisdrachegeist',  4,Rarity.Uncommon,1300, 900, '[Effekt] Bei Beschwörung: Alle Drachen-Monster erhalten +200 ATK.', fxBuffRaceSummon(Race.Dragon,200)],
    ['EDR06','Drachenwächter',  5,Rarity.Rare,    1700,1200, '[Effekt] Bei Beschwörung: Alle Drachen-Monster erhalten +300 ATK.', fxBuffRaceSummon(Race.Dragon,300)],
    ['EDR07','Wyrmgeist',       4,Rarity.Uncommon,1200,1000, '[Effekt] Wenn im Kampf vernichtet: Ziehe 1 Karte.', fxDrawDestroy(1)],
    ['EDR08','Klauentänzer',    4,Rarity.Uncommon,1400, 800, '[Effekt] Bei Beschwörung: Gegner verliert 300 LP.', fxBurnSummon(300)],
    ['EDR09','Sturmwyrm',       5,Rarity.Rare,    1800,1200, '[Effekt] Bei Beschwörung: Gegner verliert 400 LP.', fxBurnSummon(400)],
    ['EDR10','Drachenfürst',    6,Rarity.Rare,    2100,1600, '[Effekt] Bei Beschwörung: Alle Drachen-Monster erhalten +400 ATK.', fxBuffRaceSummon(Race.Dragon,400)],
    ['EDR11','Donnerdrache',    5,Rarity.Rare,    1800,1300, '[Effekt] Bei Beschwörung: Gegner verliert 500 LP.', fxBurnSummon(500)],
    ['EDR12','Drachenanführer', 6,Rarity.SuperRare,2200,1700,'[Effekt] Bei Beschwörung: Alle Drachen-Monster erhalten +500 ATK.', fxBuffRaceSummon(Race.Dragon,500)],
    ['EDR13','Urwyrm',          6,Rarity.Rare,    2100,1600, '[Effekt] Bei Beschwörung: Gegner verliert 600 LP.', fxBurnSummon(600)],
    ['EDR14','Titanwyrm',       7,Rarity.SuperRare,2400,1900,'[Passiv] Durchbohrender Angriff.', fxPiercing()],
    ['EDR15','Schuppentitan',   7,Rarity.SuperRare,2400,1900,'[Effekt] Bei Beschwörung: Alle Drachen-Monster erhalten +600 ATK.', fxBuffRaceSummon(Race.Dragon,600)],
    ['EDR16','Wyrmfürst',       7,Rarity.SuperRare,2300,1900,'[Passiv] Kann nicht als Ziel gewählt werden.', fxUntargetable()],
    ['EDR17','Drachengigant',   8,Rarity.SuperRare,2600,2100,'[Effekt] Bei Beschwörung: Gegner verliert 1000 LP.', fxBurnSummon(1000)],
    ['EDR18','Urdrachenwächter',8,Rarity.SuperRare,2600,2200,'[Passiv] Durchbohrender Angriff.', fxPiercing()],
    ['EDR19','Wyrmkönig',       9,Rarity.UltraRare,2900,2400,'[Passiv] Durchbohrender Angriff. Kann nicht als Ziel gewählt werden.', fxPiercing()],
    ['EDR20','Drachenkaiser',   9,Rarity.UltraRare,3100,2500,'[Effekt] Bei Beschwörung: Alle Drachen-Monster erhalten +800 ATK.', fxBuffRaceSummon(Race.Dragon,800)],

    // ── FLUG (EFL01–EFL20) ───────────────────────────────────
    ['EFL01','Sturmgeist',      3,Rarity.Uncommon, 950, 600, '[Passiv] Kann nicht als Ziel gewählt werden.', fxUntargetable()],
    ['EFL02','Windtänzer',      3,Rarity.Uncommon,1000, 700, '[Effekt] Bei Beschwörung: Ein Gegnermonster verliert 200 ATK und 200 DEF.', fxDebuffAllOpp(200,200)],
    ['EFL03','Federgeist',      4,Rarity.Uncommon,1150, 800, '[Effekt] Bei Beschwörung: Alle Gegnermonster verlieren 200 ATK.', fxDebuffAllOpp(200,0)],
    ['EFL04','Ätherjäger',      4,Rarity.Rare,    1300, 900, '[Passiv] Kann nicht als Ziel gewählt werden.', fxUntargetable()],
    ['EFL05','Windwächter',     4,Rarity.Uncommon,1100, 800, '[Effekt] Wenn im Kampf vernichtet: Ziehe 1 Karte.', fxDrawDestroy(1)],
    ['EFL06','Windgeist',       4,Rarity.Uncommon,1200, 850, '[Effekt] Bei Beschwörung: Gegner verliert 200 LP.', fxBurnSummon(200)],
    ['EFL07','Sturmtänzer',     5,Rarity.Rare,    1550,1100, '[Effekt] Bei Beschwörung: Alle Gegnermonster verlieren 300 ATK.', fxDebuffAllOpp(300,0)],
    ['EFL08','Federdrache',     5,Rarity.Rare,    1600,1100, '[Effekt] Wenn im Kampf vernichtet: Gegner verliert 300 LP.', fxBurnDestroy(300)],
    ['EFL09','Himmelsreiter',   5,Rarity.Rare,    1700,1200, '[Passiv] Kann nicht als Ziel gewählt werden.', fxUntargetable()],
    ['EFL10','Gewitterfalke',   5,Rarity.Rare,    1650,1050, '[Effekt] Bei Beschwörung: Gegner verliert 400 LP.', fxBurnSummon(400)],
    ['EFL11','Windfürst',       6,Rarity.Rare,    1950,1450, '[Effekt] Bei Beschwörung: Alle Gegnermonster verlieren 400 ATK.', fxDebuffAllOpp(400,0)],
    ['EFL12','Ätherfürst',      6,Rarity.Rare,    2000,1500, '[Passiv] Kann nicht als Ziel gewählt werden.', fxUntargetable()],
    ['EFL13','Wolkenkämpfer',   6,Rarity.SuperRare,2100,1600,'[Effekt] Bei Beschwörung: Alle Gegnermonster verlieren 500 ATK.', fxDebuffAllOpp(500,0)],
    ['EFL14','Sturmschwinge',   7,Rarity.SuperRare,2250,1800,'[Effekt] Bei Beschwörung: Gegner verliert 500 LP.', fxBurnSummon(500)],
    ['EFL15','Himmelskoloss',   7,Rarity.SuperRare,2300,1800,'[Passiv] Kann nicht als Ziel gewählt werden.', fxUntargetable()],
    ['EFL16','Windgott',        7,Rarity.SuperRare,2350,1900,'[Effekt] Bei Beschwörung: Alle Gegnermonster verlieren 600 ATK.', fxDebuffAllOpp(600,0)],
    ['EFL17','Sturmgott',       8,Rarity.SuperRare,2600,2000,'[Effekt] Wenn im Kampf vernichtet: Ziehe 2 Karten.', fxDrawDestroy(2)],
    ['EFL18','Äthergott',       8,Rarity.SuperRare,2700,2100,'[Passiv] Kann nicht als Ziel gewählt werden.', fxUntargetable()],
    ['EFL19','Himmelsgott',     9,Rarity.UltraRare,2850,2350,'[Effekt] Bei Beschwörung: Alle Gegnermonster verlieren 800 ATK.', fxDebuffAllOpp(800,0)],
    ['EFL20','Ätherkaiser',     9,Rarity.UltraRare,2950,2400,'[Passiv] Kann nicht als Ziel gewählt werden.', fxUntargetable()],

    // ── STEIN (EST01–EST20) ──────────────────────────────────
    ['EST01','Felswächter',     3,Rarity.Uncommon, 700,1100, '[Effekt] Bei Beschwörung: Erhalte 200 LP.', fxHealSummon(200)],
    ['EST02','Granitgeist',     3,Rarity.Uncommon, 750,1050, '[Effekt] Wenn im Kampf vernichtet: Erhalte 300 LP.', fxHealDestroy(300)],
    ['EST03','Steinwächter',    4,Rarity.Uncommon,1000,1300, '[Effekt] Bei Beschwörung: Erhalte 300 LP.', fxHealSummon(300)],
    ['EST04','Erdwächter',      4,Rarity.Rare,    1050,1350, '[Effekt] Wenn im Kampf vernichtet: Ziehe 1 Karte.', fxDrawDestroy(1)],
    ['EST05','Bergwächter',     4,Rarity.Uncommon, 950,1400, '[Effekt] Bei Beschwörung: Erhalte 400 LP.', fxHealSummon(400)],
    ['EST06','Kieselhüter',     4,Rarity.Uncommon, 900,1350, '[Effekt] Wenn im Kampf vernichtet: Erhalte 200 LP.', fxHealDestroy(200)],
    ['EST07','Steinriese',      5,Rarity.Rare,    1350,1700, '[Effekt] Bei Beschwörung: Erhalte 500 LP.', fxHealSummon(500)],
    ['EST08','Felskoloss',      5,Rarity.Rare,    1400,1750, '[Effekt] Wenn im Kampf vernichtet: Erhalte 400 LP.', fxHealDestroy(400)],
    ['EST09','Granitriese',     5,Rarity.Rare,    1300,1800, '[Effekt] Bei Beschwörung: Erhalte 600 LP.', fxHealSummon(600)],
    ['EST10','Bergkoloss',      5,Rarity.Rare,    1350,1700, '[Effekt] Wenn im Kampf vernichtet: Ziehe 1 Karte.', fxDrawDestroy(1)],
    ['EST11','Steinmagier',     5,Rarity.Rare,    1200,1800, '[Effekt] Bei Beschwörung: Erhalte 800 LP.', fxHealSummon(800)],
    ['EST12','Erdfürst',        6,Rarity.Rare,    1600,2100, '[Effekt] Wenn im Kampf vernichtet: Erhalte 600 LP.', fxHealDestroy(600)],
    ['EST13','Steinkoloss',     6,Rarity.Rare,    1700,2200, '[Effekt] Bei Beschwörung: Erhalte 1000 LP.', fxHealSummon(1000)],
    ['EST14','Felsgigant',      6,Rarity.SuperRare,1750,2400,'[Effekt] Wenn im Kampf vernichtet: Ziehe 2 Karten.', fxDrawDestroy(2)],
    ['EST15','Granitgott',      7,Rarity.SuperRare,2000,2800,'[Effekt] Bei Beschwörung: Erhalte 1200 LP.', fxHealSummon(1200)],
    ['EST16','Erdtitan',        7,Rarity.SuperRare,2100,2900,'[Effekt] Wenn im Kampf vernichtet: Erhalte 800 LP.', fxHealDestroy(800)],
    ['EST17','Steinfürst',      7,Rarity.SuperRare,2050,3000,'[Effekt] Bei Beschwörung: Erhalte 1500 LP.', fxHealSummon(1500)],
    ['EST18','Bergfürst',       8,Rarity.SuperRare,2300,3100,'[Effekt] Wenn im Kampf vernichtet: Ziehe 2 Karten.', fxDrawDestroy(2)],
    ['EST19','Steinkaiser',     9,Rarity.UltraRare,2600,3400,'[Effekt] Bei Beschwörung: Erhalte 2000 LP.', fxHealSummon(2000)],
    ['EST20','Erdgott',         9,Rarity.UltraRare,2700,3500,'[Effekt] Wenn im Kampf vernichtet: Erhalte 1000 LP. Ziehe 2 Karten.', fxHealDestroy(1000)],

    // ── PFLANZE (EPF01–EPF20) ─────────────────────────────────
    ['EPF01','Moosheiler',      3,Rarity.Uncommon, 800, 900, '[Effekt] Bei Beschwörung: Erhalte 200 LP.', fxHealSummon(200)],
    ['EPF02','Dornenheiler',    3,Rarity.Uncommon, 750, 950, '[Effekt] Bei Beschwörung: Erhalte 300 LP.', fxHealSummon(300)],
    ['EPF03','Waldheiler',      4,Rarity.Uncommon, 900,1100, '[Effekt] Bei Beschwörung: Erhalte 400 LP.', fxHealSummon(400)],
    ['EPF04','Blütenwächter',   4,Rarity.Rare,    1000,1100, '[Effekt] Wenn im Kampf vernichtet: Ziehe 1 Karte.', fxDrawDestroy(1)],
    ['EPF05','Rankenwächter',   4,Rarity.Uncommon, 950,1100, '[Effekt] Bei Beschwörung: Erhalte 500 LP.', fxHealSummon(500)],
    ['EPF06','Moosriese',       4,Rarity.Uncommon, 850,1200, '[Effekt] Wenn im Kampf vernichtet: Erhalte 200 LP.', fxHealDestroy(200)],
    ['EPF07','Waldgeist',       5,Rarity.Rare,    1300,1400, '[Effekt] Bei Beschwörung: Erhalte 600 LP.', fxHealSummon(600)],
    ['EPF08','Baumgeist',       5,Rarity.Rare,    1350,1450, '[Effekt] Bei Beschwörung: Erhalte 800 LP.', fxHealSummon(800)],
    ['EPF09','Dornenwächter',   5,Rarity.Rare,    1200,1500, '[Effekt] Wenn im Kampf vernichtet: Ziehe 2 Karten.', fxDrawDestroy(2)],
    ['EPF10','Rankendämon',     5,Rarity.Rare,    1400,1300, '[Effekt] Wenn im Kampf vernichtet: Erhalte 400 LP.', fxHealDestroy(400)],
    ['EPF11','Waldkoloss',      5,Rarity.Rare,    1400,1500, '[Effekt] Bei Beschwörung: Alle Pflanze-Monster erhalten +200 ATK.', fxBuffRaceSummon(Race.Plant,200)],
    ['EPF12','Moostitan',       6,Rarity.Rare,    1600,1800, '[Effekt] Bei Beschwörung: Erhalte 1000 LP.', fxHealSummon(1000)],
    ['EPF13','Waldtitan',       6,Rarity.Rare,    1700,1900, '[Effekt] Wenn im Kampf vernichtet: Ziehe 2 Karten.', fxDrawDestroy(2)],
    ['EPF14','Blütengott',      6,Rarity.SuperRare,1750,2000,'[Effekt] Bei Beschwörung: Alle Pflanze-Monster erhalten +300 ATK.', fxBuffRaceSummon(Race.Plant,300)],
    ['EPF15','Rankengott',      7,Rarity.SuperRare,2000,2200,'[Effekt] Bei Beschwörung: Erhalte 1500 LP.', fxHealSummon(1500)],
    ['EPF16','Waldgott',        7,Rarity.SuperRare,2100,2300,'[Effekt] Wenn im Kampf vernichtet: Erhalte 600 LP.', fxHealDestroy(600)],
    ['EPF17','Dornengott',      7,Rarity.SuperRare,2000,2400,'[Effekt] Bei Beschwörung: Alle Pflanze-Monster erhalten +400 ATK.', fxBuffRaceSummon(Race.Plant,400)],
    ['EPF18','Blütentitan',     8,Rarity.SuperRare,2300,2600,'[Effekt] Bei Beschwörung: Erhalte 2000 LP.', fxHealSummon(2000)],
    ['EPF19','Waldkaiser',      9,Rarity.UltraRare,2600,2900,'[Effekt] Bei Beschwörung: Erhalte 2500 LP.', fxHealSummon(2500)],
    ['EPF20','Urwald',          9,Rarity.UltraRare,2700,3000,'[Effekt] Wenn im Kampf vernichtet: Erhalte 1000 LP. Alle Pflanze-Monster erhalten +500 ATK.', fxBuffRaceSummon(Race.Plant,500)],

    // ── KRIEGER (EKR01–EKR20) ────────────────────────────────
    ['EKR01','Klingenläufer',   3,Rarity.Uncommon,1050, 800, '[Effekt] Bei Beschwörung: Alle Krieger-Monster erhalten +200 ATK.', fxBuffRaceSummon(Race.Warrior,200)],
    ['EKR02','Schwertgeist',    3,Rarity.Uncommon,1100, 750, '[Effekt] Wenn im Kampf vernichtet: Ziehe 1 Karte.', fxDrawDestroy(1)],
    ['EKR03','Schildläufer',    4,Rarity.Uncommon,1250, 950, '[Effekt] Bei Beschwörung: Alle Krieger-Monster erhalten +200 ATK.', fxBuffRaceSummon(Race.Warrior,200)],
    ['EKR04','Axtgeist',        4,Rarity.Rare,    1350, 950, '[Effekt] Bei Beschwörung: Alle Krieger-Monster erhalten +300 ATK.', fxBuffRaceSummon(Race.Warrior,300)],
    ['EKR05','Lanzengeist',     4,Rarity.Uncommon,1200,1000, '[Effekt] Wenn im Kampf vernichtet: Erhalte 200 LP.', fxHealDestroy(200)],
    ['EKR06','Schlachtgeist',   4,Rarity.Uncommon,1300, 900, '[Effekt] Bei Beschwörung: Gegner verliert 200 LP.', fxBurnSummon(200)],
    ['EKR07','Klinge',          5,Rarity.Rare,    1700,1200, '[Effekt] Bei Beschwörung: Alle Krieger-Monster erhalten +400 ATK.', fxBuffRaceSummon(Race.Warrior,400)],
    ['EKR08','Rüstungsbrecher', 5,Rarity.Rare,    1750,1150, '[Effekt] Wenn im Kampf vernichtet: Ziehe 2 Karten.', fxDrawDestroy(2)],
    ['EKR09','Doppelklingen',   5,Rarity.Rare,    1650,1250, '[Passiv] Durchbohrender Angriff.', fxPiercing()],
    ['EKR10','Schwertritter',   5,Rarity.Rare,    1700,1300, '[Effekt] Bei Beschwörung: Gegner verliert 400 LP.', fxBurnSummon(400)],
    ['EKR11','Schlachtmeister', 6,Rarity.Rare,    2050,1600, '[Effekt] Bei Beschwörung: Alle Krieger-Monster erhalten +500 ATK.', fxBuffRaceSummon(Race.Warrior,500)],
    ['EKR12','Klingenritter',   6,Rarity.Rare,    2100,1600, '[Passiv] Durchbohrender Angriff.', fxPiercing()],
    ['EKR13','Kriegsherr',      6,Rarity.SuperRare,2200,1700,'[Effekt] Bei Beschwörung: Alle Krieger-Monster erhalten +600 ATK.', fxBuffRaceSummon(Race.Warrior,600)],
    ['EKR14','Heldenkämpfer',   7,Rarity.SuperRare,2400,1900,'[Effekt] Wenn im Kampf vernichtet: Ziehe 2 Karten.', fxDrawDestroy(2)],
    ['EKR15','Schwertmeister',  7,Rarity.SuperRare,2450,1950,'[Passiv] Durchbohrender Angriff.', fxPiercing()],
    ['EKR16','Klingenkoloss',   7,Rarity.SuperRare,2400,2000,'[Effekt] Bei Beschwörung: Alle Krieger-Monster erhalten +700 ATK.', fxBuffRaceSummon(Race.Warrior,700)],
    ['EKR17','Kriegstitan',     8,Rarity.SuperRare,2650,2100,'[Effekt] Bei Beschwörung: Gegner verliert 800 LP.', fxBurnSummon(800)],
    ['EKR18','Klingenfürst',    8,Rarity.SuperRare,2700,2100,'[Passiv] Durchbohrender Angriff.', fxPiercing()],
    ['EKR19','Schlachtgott',    9,Rarity.UltraRare,2900,2350,'[Effekt] Bei Beschwörung: Alle Krieger-Monster erhalten +800 ATK.', fxBuffRaceSummon(Race.Warrior,800)],
    ['EKR20','Kriegskaiser',    9,Rarity.UltraRare,3000,2400,'[Passiv] Durchbohrender Angriff.', fxPiercing()],

    // ── MAGIER (EMA01–EMA20) ──────────────────────────────────
    ['EMA01','Runenzieher',     3,Rarity.Uncommon, 850, 600, '[Effekt] Bei Beschwörung: Ziehe 1 Karte.', fxDrawSummon(1)],
    ['EMA02','Arkanzieher',     3,Rarity.Uncommon, 800, 700, '[Effekt] Bei Beschwörung: Ziehe 1 Karte.', fxDrawSummon(1)],
    ['EMA03','Zauberleser',     4,Rarity.Uncommon, 950, 800, '[Effekt] Bei Beschwörung: Ziehe 1 Karte.', fxDrawSummon(1)],
    ['EMA04','Kristallseher',   4,Rarity.Rare,    1000, 850, '[Effekt] Bei Beschwörung: Ziehe 2 Karten.', fxDrawSummon(2)],
    ['EMA05','Wissenswächter',  4,Rarity.Uncommon, 900, 900, '[Effekt] Wenn im Kampf vernichtet: Ziehe 1 Karte.', fxDrawDestroy(1)],
    ['EMA06','Runenmeister',    4,Rarity.Uncommon, 950, 800, '[Effekt] Bei Beschwörung: Gegner verliert 300 LP.', fxBurnSummon(300)],
    ['EMA07','Arkanseher',      5,Rarity.Rare,    1300,1100, '[Effekt] Bei Beschwörung: Ziehe 2 Karten.', fxDrawSummon(2)],
    ['EMA08','Zauberfürst',     5,Rarity.Rare,    1400,1100, '[Effekt] Wenn im Kampf vernichtet: Ziehe 2 Karten.', fxDrawDestroy(2)],
    ['EMA09','Magiergeist',     5,Rarity.Rare,    1200,1200, '[Effekt] Bei Beschwörung: Alle Magier-Monster erhalten +200 ATK.', fxBuffRaceSummon(Race.Spellcaster,200)],
    ['EMA10','Wissenssammler',  5,Rarity.Rare,    1350,1100, '[Effekt] Bei Beschwörung: Ziehe 1 Karte. Gegner verliert 200 LP.', fxDrawSummon(1)],
    ['EMA11','Runenwächter',    5,Rarity.Rare,    1300,1200, '[Effekt] Bei Beschwörung: Ziehe 2 Karten. Erhalte 200 LP.', fxDrawSummon(2)],
    ['EMA12','Arkanfürst',      6,Rarity.Rare,    1600,1600, '[Effekt] Bei Beschwörung: Ziehe 2 Karten.', fxDrawSummon(2)],
    ['EMA13','Zaubertitan',     6,Rarity.Rare,    1700,1600, '[Effekt] Wenn im Kampf vernichtet: Ziehe 3 Karten.', fxDrawDestroy(3)],
    ['EMA14','Magierkoloss',    6,Rarity.SuperRare,1800,1700,'[Effekt] Bei Beschwörung: Alle Magier-Monster erhalten +300 ATK.', fxBuffRaceSummon(Race.Spellcaster,300)],
    ['EMA15','Arkantitan',      7,Rarity.SuperRare,2000,1900,'[Effekt] Bei Beschwörung: Ziehe 3 Karten.', fxDrawSummon(3)],
    ['EMA16','Runenkönig',      7,Rarity.SuperRare,2100,2000,'[Passiv] Kann nicht als Ziel gewählt werden.', fxUntargetable()],
    ['EMA17','Wissensgott',     7,Rarity.SuperRare,2000,2000,'[Effekt] Wenn im Kampf vernichtet: Ziehe 3 Karten.', fxDrawDestroy(3)],
    ['EMA18','Arkankaiser',     8,Rarity.SuperRare,2300,2100,'[Effekt] Bei Beschwörung: Ziehe 3 Karten. Gegner verliert 500 LP.', fxDrawSummon(3)],
    ['EMA19','Magiergott',      9,Rarity.UltraRare,2500,2300,'[Effekt] Bei Beschwörung: Ziehe 3 Karten. Alle Magier-Monster erhalten +500 ATK.', fxBuffRaceSummon(Race.Spellcaster,500)],
    ['EMA20','Arkankaiser II',  9,Rarity.UltraRare,2700,2500,'[Passiv] Kann nicht als Ziel gewählt werden.', fxUntargetable()],

    // ── ELFE (EEL01–EEL20) ───────────────────────────────────
    ['EEL01','Mondtänzerin',    3,Rarity.Uncommon, 700, 900, '[Effekt] Bei Beschwörung: Alle Gegnermonster verlieren 200 ATK.', fxDebuffAllOpp(200,0)],
    ['EEL02','Sternentänzerin', 3,Rarity.Uncommon, 650,1000, '[Effekt] Bei Beschwörung: Alle Gegnermonster verlieren 200 DEF.', fxDebuffAllOpp(0,200)],
    ['EEL03','Lichtelfin',      4,Rarity.Uncommon, 850,1000, '[Effekt] Bei Beschwörung: Alle Gegnermonster verlieren 300 ATK.', fxDebuffAllOpp(300,0)],
    ['EEL04','Waldelfin',       4,Rarity.Rare,     900, 950, '[Effekt] Bei Beschwörung: Alle Gegnermonster verlieren 200 ATK und 200 DEF.', fxDebuffAllOpp(200,200)],
    ['EEL05','Mondelfe',        4,Rarity.Uncommon, 800,1100, '[Effekt] Wenn im Kampf vernichtet: Ziehe 1 Karte.', fxDrawDestroy(1)],
    ['EEL06','Sternenelfin',    4,Rarity.Uncommon, 750,1000, '[Effekt] Bei Beschwörung: Erhalte 200 LP.', fxHealSummon(200)],
    ['EEL07','Elfentänzerin',   5,Rarity.Rare,    1150,1300, '[Effekt] Bei Beschwörung: Alle Gegnermonster verlieren 400 ATK.', fxDebuffAllOpp(400,0)],
    ['EEL08','Mondkämpferin',   5,Rarity.Rare,    1200,1350, '[Effekt] Bei Beschwörung: Alle Gegnermonster verlieren 300 ATK und 300 DEF.', fxDebuffAllOpp(300,300)],
    ['EEL09','Lichtelfe',       5,Rarity.Rare,    1100,1400, '[Passiv] Kann nicht als Ziel gewählt werden.', fxUntargetable()],
    ['EEL10','Elfenmagierin',   5,Rarity.Rare,    1050,1350, '[Effekt] Bei Beschwörung: Ziehe 1 Karte.', fxDrawSummon(1)],
    ['EEL11','Sternenfürstin',  5,Rarity.Rare,    1150,1250, '[Effekt] Wenn im Kampf vernichtet: Gegner verliert 300 LP.', fxBurnDestroy(300)],
    ['EEL12','Mondfürstin',     6,Rarity.Rare,    1400,1700, '[Effekt] Bei Beschwörung: Alle Gegnermonster verlieren 500 ATK.', fxDebuffAllOpp(500,0)],
    ['EEL13','Elfenfürstin',    6,Rarity.Rare,    1500,1700, '[Effekt] Bei Beschwörung: Alle Gegnermonster verlieren 400 ATK und 400 DEF.', fxDebuffAllOpp(400,400)],
    ['EEL14','Sternenkönigin',  6,Rarity.SuperRare,1600,1900,'[Passiv] Kann nicht als Ziel gewählt werden.', fxUntargetable()],
    ['EEL15','Mondkönigin',     7,Rarity.SuperRare,1800,2200,'[Effekt] Bei Beschwörung: Alle Gegnermonster verlieren 600 ATK.', fxDebuffAllOpp(600,0)],
    ['EEL16','Lichtkönigin',    7,Rarity.SuperRare,1900,2300,'[Effekt] Bei Beschwörung: Alle Gegnermonster verlieren 500 ATK und 500 DEF.', fxDebuffAllOpp(500,500)],
    ['EEL17','Elfengöttin',     7,Rarity.SuperRare,1900,2400,'[Passiv] Kann nicht als Ziel gewählt werden.', fxUntargetable()],
    ['EEL18','Mondgöttin',      8,Rarity.SuperRare,2100,2700,'[Effekt] Bei Beschwörung: Alle Gegnermonster verlieren 700 ATK.', fxDebuffAllOpp(700,0)],
    ['EEL19','Sternenkaiser',   9,Rarity.UltraRare,2400,3000,'[Effekt] Bei Beschwörung: Alle Gegnermonster verlieren 800 ATK und 800 DEF.', fxDebuffAllOpp(800,800)],
    ['EEL20','Elfenkaiser',     9,Rarity.UltraRare,2600,3200,'[Passiv] Kann nicht als Ziel gewählt werden.', fxUntargetable()],

    // ── DÄMON (EDA01–EDA20) ───────────────────────────────────
    ['EDA01','Schattenpakt',    3,Rarity.Uncommon,1200, 600, '[Effekt] Bei Beschwörung: Du verlierst 200 LP. Gegner verliert 500 LP.', fxBurnSummon(500)],
    ['EDA02','Höllenvertrag',   3,Rarity.Uncommon,1100, 700, '[Effekt] Wenn im Kampf vernichtet: Gegner verliert 300 LP.', fxBurnDestroy(300)],
    ['EDA03','Dunkelpakt',      4,Rarity.Uncommon,1400, 800, '[Effekt] Bei Beschwörung: Gegner verliert 400 LP.', fxBurnSummon(400)],
    ['EDA04','Seelenreaper',    4,Rarity.Rare,    1500, 800, '[Effekt] Wenn im Kampf vernichtet: Gegner verliert 500 LP.', fxBurnDestroy(500)],
    ['EDA05','Dunkelgeist',     4,Rarity.Uncommon,1300, 900, '[Passiv] Kann den Gegner direkt angreifen.', fxCanDirectAttack()],
    ['EDA06','Schattenreaper',  4,Rarity.Uncommon,1350, 850, '[Passiv] Durchbohrender Angriff.', fxPiercing()],
    ['EDA07','Höllenpakt',      5,Rarity.Rare,    1800,1100, '[Effekt] Bei Beschwörung: Gegner verliert 600 LP.', fxBurnSummon(600)],
    ['EDA08','Düsterfürst',     5,Rarity.Rare,    1750,1200, '[Passiv] Durchbohrender Angriff.', fxPiercing()],
    ['EDA09','Seelendieb',      5,Rarity.Rare,    1700,1150, '[Effekt] Wenn im Kampf vernichtet: Gegner verliert 600 LP.', fxBurnDestroy(600)],
    ['EDA10','Dunkelfürst',     5,Rarity.Rare,    1800,1100, '[Effekt] Bei Beschwörung: Alle Dämon-Monster erhalten +300 ATK.', fxBuffRaceSummon(Race.Demon,300)],
    ['EDA11','Abgrundläufer',   6,Rarity.Rare,    2100,1500, '[Effekt] Bei Beschwörung: Gegner verliert 800 LP.', fxBurnSummon(800)],
    ['EDA12','Höllenritter',    6,Rarity.Rare,    2050,1600, '[Passiv] Durchbohrender Angriff.', fxPiercing()],
    ['EDA13','Seelenfresser',   6,Rarity.SuperRare,2200,1600,'[Effekt] Wenn im Kampf vernichtet: Gegner verliert 800 LP.', fxBurnDestroy(800)],
    ['EDA14','Schattenkönig',   7,Rarity.SuperRare,2450,1900,'[Effekt] Bei Beschwörung: Gegner verliert 1000 LP.', fxBurnSummon(1000)],
    ['EDA15','Höllenkönig',     7,Rarity.SuperRare,2500,1900,'[Passiv] Durchbohrender Angriff.', fxPiercing()],
    ['EDA16','Abgrundfürst',    7,Rarity.SuperRare,2400,2000,'[Effekt] Bei Beschwörung: Alle Dämon-Monster erhalten +500 ATK.', fxBuffRaceSummon(Race.Demon,500)],
    ['EDA17','Dunkeltitan',     8,Rarity.SuperRare,2700,2100,'[Effekt] Wenn im Kampf vernichtet: Gegner verliert 1000 LP.', fxBurnDestroy(1000)],
    ['EDA18','Schattenkaiser',  8,Rarity.SuperRare,2750,2100,'[Passiv] Durchbohrender Angriff.', fxPiercing()],
    ['EDA19','Höllenkaiser',    9,Rarity.UltraRare,3050,2450,'[Effekt] Bei Beschwörung: Gegner verliert 1500 LP. Alle Dämon-Monster erhalten +600 ATK.', fxBuffRaceSummon(Race.Demon,600)],
    ['EDA20','Chaosgott',       9,Rarity.UltraRare,3150,2500,'[Passiv] Durchbohrender Angriff.', fxPiercing()],

    // ── WASSER (EWA01–EWA20) ──────────────────────────────────
    ['EWA01','Wellentänzerin',  3,Rarity.Uncommon,1000, 800, '[Effekt] Bei Beschwörung: Spiele das stärkste Gegnermonster auf die Hand zurück.', fxBounceOppSummon()],
    ['EWA02','Tiefseejäger',    3,Rarity.Uncommon, 950, 800, '[Effekt] Wenn im Kampf vernichtet: Ziehe 1 Karte.', fxDrawDestroy(1)],
    ['EWA03','Nebelwächter',    4,Rarity.Uncommon,1150, 900, '[Effekt] Bei Beschwörung: Gegner verliert 200 LP.', fxBurnSummon(200)],
    ['EWA04','Eiswächter',      4,Rarity.Rare,    1200, 950, '[Effekt] Bei Beschwörung: Spiele das stärkste Gegnermonster auf die Hand zurück.', fxBounceOppSummon()],
    ['EWA05','Strudelhüter',    4,Rarity.Uncommon,1100,1000, '[Effekt] Wenn im Kampf vernichtet: Erhalte 200 LP.', fxHealDestroy(200)],
    ['EWA06','Korallenfürst',   4,Rarity.Uncommon,1100, 950, '[Effekt] Bei Beschwörung: Erhalte 300 LP.', fxHealSummon(300)],
    ['EWA07','Meerestänzer',    5,Rarity.Rare,    1500,1200, '[Effekt] Bei Beschwörung: Spiele das stärkste Gegnermonster auf die Hand zurück.', fxBounceOppSummon()],
    ['EWA08','Eisdrache',       5,Rarity.Rare,    1600,1200, '[Effekt] Wenn im Kampf vernichtet: Ziehe 2 Karten.', fxDrawDestroy(2)],
    ['EWA09','Tiefseefürst',    5,Rarity.Rare,    1550,1250, '[Effekt] Bei Beschwörung: Gegner verliert 400 LP.', fxBurnSummon(400)],
    ['EWA10','Wellenfürst',     5,Rarity.Rare,    1500,1300, '[Effekt] Wenn im Kampf vernichtet: Erhalte 400 LP.', fxHealDestroy(400)],
    ['EWA11','Sturmflut',       6,Rarity.Rare,    1900,1600, '[Effekt] Bei Beschwörung: Spiele das stärkste Gegnermonster auf die Hand zurück.', fxBounceOppSummon()],
    ['EWA12','Meerestitan',     6,Rarity.Rare,    1950,1600, '[Effekt] Wenn im Kampf vernichtet: Ziehe 2 Karten. Erhalte 200 LP.', fxDrawDestroy(2)],
    ['EWA13','Tiefseewächter',  6,Rarity.SuperRare,2000,1700,'[Passiv] Kann nicht als Ziel gewählt werden.', fxUntargetable()],
    ['EWA14','Wellengott',      7,Rarity.SuperRare,2250,1950,'[Effekt] Bei Beschwörung: Spiele das stärkste Gegnermonster auf die Hand zurück.', fxBounceOppSummon()],
    ['EWA15','Meereskaiser',    7,Rarity.SuperRare,2300,2000,'[Effekt] Bei Beschwörung: Ziehe 2 Karten.', fxDrawSummon(2)],
    ['EWA16','Tiefseegott',     7,Rarity.SuperRare,2350,2000,'[Passiv] Kann nicht als Ziel gewählt werden.', fxUntargetable()],
    ['EWA17','Eiskaiser',       8,Rarity.SuperRare,2600,2100,'[Effekt] Bei Beschwörung: Spiele das stärkste Gegnermonster auf die Hand zurück.', fxBounceOppSummon()],
    ['EWA18','Ozeanfürst',      8,Rarity.SuperRare,2650,2200,'[Effekt] Wenn im Kampf vernichtet: Ziehe 2 Karten.', fxDrawDestroy(2)],
    ['EWA19','Tiefseekönig',    9,Rarity.UltraRare,2900,2500,'[Effekt] Bei Beschwörung: Spiele alle Gegnermonster auf die Hand zurück. Gegner verliert 500 LP.', fxBounceOppSummon()],
    ['EWA20','Ozeankaiser',     9,Rarity.UltraRare,3000,2600,'[Passiv] Kann nicht als Ziel gewählt werden.', fxUntargetable()],
  ];

  const EFFECT_ATTR: Record<string, Attribute> = {
    EFE:Attribute.Fire, EDR:Attribute.Wind, EFL:Attribute.Wind, EST:Attribute.Earth, EPF:Attribute.Earth,
    EKR:Attribute.Light, EMA:Attribute.Dark, EEL:Attribute.Light, EDA:Attribute.Dark, EWA:Attribute.Water,
  };
  const EFFECT_RACE: Record<string, Race> = {
    EFE:Race.Fire, EDR:Race.Dragon, EFL:Race.Flyer, EST:Race.Stone, EPF:Race.Plant,
    EKR:Race.Warrior, EMA:Race.Spellcaster, EEL:Race.Elf, EDA:Race.Demon, EWA:Race.Water,
  };

  EFFECT_ENTRIES.forEach(([id,name,level,rarity,atk,def,desc,effect])=>{
    const pfx=id.slice(0,3);
    _addCard(id, {
      id, name, type:CardType.Monster,
      attribute:EFFECT_ATTR[pfx],
      race:EFFECT_RACE[pfx],
      rarity,
      level, atk, def, description:desc, effect,
    });
  });

  // ── 20 neue Fusionsmonster ─────────────────────────────────
  const FUSION_NEW: [string, string, number, Rarity, Attribute, Race, number, number, string, CardEffectBlock][] = [
    // Feuer
    ['FFE1','Feuerkoloss',      7,Rarity.SuperRare,Attribute.Fire,  Race.Fire,   2400,1900, '[Fusion] Bei Beschwörung: Alle Feuer-Monster erhalten +400 ATK. Gegner verliert 800 LP.', fxBuffRaceSummon(Race.Fire,400)],
    ['FFE2','Infernodrakon',    8,Rarity.UltraRare,Attribute.Fire,  Race.Fire,   2800,2200, '[Fusion] Bei Beschwörung: Gegner verliert 2000 LP.', fxBurnSummon(2000)],
    // Drache
    ['FDR1','Finsterdrache',    7,Rarity.SuperRare,Attribute.Dark,  Race.Dragon,  2500,2000, '[Fusion] Durchbohrender Angriff. Kann nicht als Ziel gewählt werden.', fxPiercing()],
    ['FDR2','Urnachtdrache',    8,Rarity.UltraRare,Attribute.Dark,  Race.Dragon,  2900,2300, '[Fusion] Alle Drachen-Monster erhalten +500 ATK.', fxBuffRaceSummon(Race.Dragon,500)],
    // Flug
    ['FFL1','Äthersturm',       6,Rarity.SuperRare,Attribute.Wind,  Race.Flyer,    2100,1800, '[Fusion] Kann nicht als Ziel gewählt werden. Alle Gegnermonster verlieren 400 ATK.', fxDebuffAllOpp(400,0)],
    ['FFL2','Himmelsherrscher', 8,Rarity.UltraRare,Attribute.Wind,  Race.Flyer,    2700,2100, '[Fusion] Alle Gegnermonster verlieren 800 ATK.', fxDebuffAllOpp(800,0)],
    // Stein
    ['FST1','Urgestein',        7,Rarity.SuperRare,Attribute.Earth, Race.Stone,   1900,3100, '[Fusion] Bei Beschwörung: Erhalte 1500 LP.', fxHealSummon(1500)],
    ['FST2','Erdgötze',         8,Rarity.UltraRare,Attribute.Earth, Race.Stone,   2200,3400, '[Fusion] Bei Beschwörung: Erhalte 3000 LP.', fxHealSummon(3000)],
    // Pflanze
    ['FPF1','Waldentität',      6,Rarity.SuperRare,Attribute.Earth, Race.Plant, 2000,2200, '[Fusion] Bei Beschwörung: Erhalte 1500 LP. Alle Pflanze-Monster erhalten +300 ATK.', fxBuffRaceSummon(Race.Plant,300)],
    ['FPF2','Urwald',           7,Rarity.UltraRare,Attribute.Earth, Race.Plant, 2200,2500, '[Fusion] Bei Beschwörung: Erhalte 2500 LP.', fxHealSummon(2500)],
    // Krieger
    ['FKR1','Schlachtgott',     7,Rarity.SuperRare,Attribute.Light, Race.Warrior, 2500,2100, '[Fusion] Alle Krieger-Monster erhalten +600 ATK. Durchbohrender Angriff.', fxPiercing()],
    ['FKR2','Kriegslegende',    8,Rarity.UltraRare,Attribute.Light, Race.Warrior, 2900,2300, '[Fusion] Bei Beschwörung: Alle Krieger-Monster erhalten +800 ATK.', fxBuffRaceSummon(Race.Warrior,800)],
    // Magier
    ['FMA1','Runenkoloss',      7,Rarity.SuperRare,Attribute.Dark,  Race.Spellcaster,  2300,2000, '[Fusion] Bei Beschwörung: Ziehe 3 Karten.', fxDrawSummon(3)],
    ['FMA2','Arkangott',        8,Rarity.UltraRare,Attribute.Dark,  Race.Spellcaster,  2700,2200, '[Fusion] Kann nicht als Ziel gewählt werden. Bei Beschwörung: Ziehe 3 Karten.', fxDrawSummon(3)],
    // Elfe
    ['FEL1','Mondkönigin',      6,Rarity.SuperRare,Attribute.Light, Race.Elf,    2000,2300, '[Fusion] Alle Gegnermonster verlieren 600 ATK und 600 DEF.', fxDebuffAllOpp(600,600)],
    ['FEL2','Sternengöttin',    7,Rarity.UltraRare,Attribute.Light, Race.Elf,    2400,2600, '[Fusion] Kann nicht als Ziel gewählt werden. Alle Gegnermonster verlieren 800 ATK.', fxDebuffAllOpp(800,0)],
    // Dämon
    ['FDA1','Abgrundtitan',     7,Rarity.SuperRare,Attribute.Dark,  Race.Demon,  2700,2200, '[Fusion] Durchbohrender Angriff. Bei Beschwörung: Gegner verliert 1000 LP.', fxBurnSummon(1000)],
    ['FDA2','Chaosgötze',       9,Rarity.UltraRare,Attribute.Dark,  Race.Demon,  3100,2600, '[Fusion] Durchbohrender Angriff. Alle Dämon-Monster erhalten +800 ATK.', fxBuffRaceSummon(Race.Demon,800)],
    // Wasser
    ['FWA1','Tsunamigott',      7,Rarity.SuperRare,Attribute.Water, Race.Water,  2400,2100, '[Fusion] Bei Beschwörung: Stärkstes Gegnermonster auf die Hand. Gegner verliert 500 LP.', fxBounceOppSummon()],
    ['FWA2','Ozeankaiser',      8,Rarity.UltraRare,Attribute.Water, Race.Water,  2800,2400, '[Fusion] Kann nicht als Ziel gewählt werden. Bei Beschwörung: Stärkstes Gegnermonster zurück auf die Hand.', fxBounceOppSummon()],
  ];

  FUSION_NEW.forEach(([id,name,level,rarity,attr,race,atk,def,desc,effect])=>{
    _addCard(id, {
      id, name, type:CardType.Fusion,
      attribute:attr, race, rarity,
      level, atk, def, description:desc, effect,
    });
  });

  // ── Erweiterte Fusionsrezepte ────────────────────────────────
  FUSION_RECIPES.push(
    { materials:['NFE25','NFE29'],  result:'FFE1' },
    { materials:['NFE31','EFE18'],  result:'FFE2' },
    { materials:['NDR25','NDR29'],  result:'FDR1' },
    { materials:['NDR31','EDR17'],  result:'FDR2' },
    { materials:['NFL25','NFL29'],  result:'FFL1' },
    { materials:['NFL31','EFL17'],  result:'FFL2' },
    { materials:['NST25','NST29'],  result:'FST1' },
    { materials:['NST31','EST19'],  result:'FST2' },
    { materials:['NPF25','NPF29'],  result:'FPF1' },
    { materials:['NPF31','EPF18'],  result:'FPF2' },
    { materials:['NKR25','NKR29'],  result:'FKR1' },
    { materials:['NKR31','EKR17'],  result:'FKR2' },
    { materials:['NMA25','NMA29'],  result:'FMA1' },
    { materials:['NMA31','EMA18'],  result:'FMA2' },
    { materials:['NEL25','NEL29'],  result:'FEL1' },
    { materials:['NEL31','EEL18'],  result:'FEL2' },
    { materials:['NDA25','NDA29'],  result:'FDA1' },
    { materials:['NDA31','EDA17'],  result:'FDA2' },
    { materials:['NWA25','NWA29'],  result:'FWA1' },
    { materials:['NWA31','EWA17'],  result:'FWA2' },
  );

  // ── 70 Zauberkarten (7 pro Rasse) ────────────────────────────
  const SPELL_ENTRIES: [string, string, Race, Rarity, string, CardEffectBlock][] = [
    // Feuer
    ['ZFE1','Flammenangriff',  Race.Fire,   Rarity.Common,     'Füge dem Gegner 600 Schadenspunkte zu.',                             { trigger:'onSummon', actions:[{ type:'dealDamage', target:'opponent', value:600 }] }],
    ['ZFE2','Lavastrom',       Race.Fire,   Rarity.Uncommon,   'Füge dem Gegner 1000 Schadenspunkte zu.',                            { trigger:'onSummon', actions:[{ type:'dealDamage', target:'opponent', value:1000 }] }],
    ['ZFE3','Glutwand',        Race.Fire,   Rarity.Common,     'Alle deine Feuer-Monster erhalten bis zum Ende des Zuges +500 ATK.',  { trigger:'onSummon', actions:[{ type:'tempBuffAtkRace', race:Race.Fire, value:500 }] }],
    ['ZFE4','Ascheregen',      Race.Fire,   Rarity.Uncommon,   'Füge dem Gegner 500 Schaden zu und erhalte 500 LP.',                 { trigger:'onSummon', actions:[{ type:'dealDamage', target:'opponent', value:500 }, { type:'gainLP', target:'self', value:500 }] }],
    ['ZFE5','Inferno',         Race.Fire,   Rarity.Rare,       'Füge dem Gegner 1500 Schadenspunkte zu.',                            { trigger:'onSummon', actions:[{ type:'dealDamage', target:'opponent', value:1500 }] }],
    ['ZFE6','Pyroexplosion',   Race.Fire,   Rarity.Rare,       'Füge dem Gegner 2000 Schadenspunkte zu.',                            { trigger:'onSummon', actions:[{ type:'dealDamage', target:'opponent', value:2000 }] }],
    ['ZFE7','Vulkansturm',     Race.Fire,   Rarity.SuperRare, 'Füge dem Gegner 2500 Schadenspunkte zu.',                            { trigger:'onSummon', actions:[{ type:'dealDamage', target:'opponent', value:2500 }] }],
    // Drache
    ['ZDR1','Drachenklaue',    Race.Dragon,  Rarity.Common,     'Alle deine Drachen erhalten +600 ATK bis Rundenende.',               { trigger:'onSummon', actions:[{ type:'tempBuffAtkRace', race:Race.Dragon, value:600 }] }],
    // ZDR2: Not expressible as descriptor — needs special handling
    ['ZDR2','Drachenschuppe',  Race.Dragon,  Rarity.Uncommon,   'Alle deine Drachen können nicht als Ziel gewählt werden.',           {apply(gs,o){gs.getState()[o].field.monsters.forEach(fm=>{if(fm&&fm.card.race===Race.Dragon)(fm as unknown as {card: {effect: unknown}}).card=Object.assign({},fm.card,{effect:{trigger:'passive',cannotBeTargeted:true}});});}} as unknown as CardEffectBlock],
    ['ZDR3','Urnacht',         Race.Dragon,  Rarity.Common,     'Ziehe 2 Karten.',                                                   { trigger:'onSummon', actions:[{ type:'draw', target:'self', count:2 }] }],
    ['ZDR4','Drachenangriff',  Race.Dragon,  Rarity.Uncommon,   'Alle deine Drachen erhalten +1000 ATK bis Rundenende.',              { trigger:'onSummon', actions:[{ type:'tempBuffAtkRace', race:Race.Dragon, value:1000 }] }],
    ['ZDR5','Wyrmbeschwörung', Race.Dragon,  Rarity.Rare,       'Füge dem Gegner 800 Schaden zu. Ziehe 1 Karte.',                    { trigger:'onSummon', actions:[{ type:'dealDamage', target:'opponent', value:800 }, { type:'draw', target:'self', count:1 }] }],
    ['ZDR6','Schuppenpanzer',  Race.Dragon,  Rarity.Rare,       'Alle deine Drachen erhalten +1500 ATK bis Rundenende.',              { trigger:'onSummon', actions:[{ type:'tempBuffAtkRace', race:Race.Dragon, value:1500 }] }],
    ['ZDR7','Drachensturm',    Race.Dragon,  Rarity.SuperRare, 'Alle Gegnermonster verlieren 1000 ATK. Füge dem Gegner 500 Schaden zu.',{ trigger:'onSummon', actions:[{ type:'debuffAllOpp', atkD:1000, defD:0 }, { type:'dealDamage', target:'opponent', value:500 }] }],
    // Flug
    ['ZFL1','Windstoß',        Race.Flyer,    Rarity.Common,     'Alle Gegnermonster verlieren 300 ATK bis Rundenende.',               { trigger:'onSummon', actions:[{ type:'tempDebuffAllOpp', atkD:300 }] }],
    ['ZFL2','Sturmschrei',     Race.Flyer,    Rarity.Uncommon,   'Alle Gegnermonster verlieren 500 ATK bis Rundenende.',               { trigger:'onSummon', actions:[{ type:'tempDebuffAllOpp', atkD:500 }] }],
    ['ZFL3','Federleicht',     Race.Flyer,    Rarity.Common,     'Ziehe 1 Karte. Erhalte 300 LP.',                                    { trigger:'onSummon', actions:[{ type:'draw', target:'self', count:1 }, { type:'gainLP', target:'self', value:300 }] }],
    ['ZFL4','Windbarriere',    Race.Flyer,    Rarity.Uncommon,   'Alle deine Flug-Monster erhalten +500 ATK bis Rundenende.',          { trigger:'onSummon', actions:[{ type:'tempBuffAtkRace', race:Race.Flyer, value:500 }] }],
    ['ZFL5','Sturmschwinge',   Race.Flyer,    Rarity.Rare,       'Alle Gegnermonster verlieren 800 ATK bis Rundenende.',               { trigger:'onSummon', actions:[{ type:'tempDebuffAllOpp', atkD:800 }] }],
    ['ZFL6','Himmelsfall',     Race.Flyer,    Rarity.Rare,       'Füge dem Gegner 1200 Schaden zu. Alle Gegnermonster verlieren 400 ATK.',{ trigger:'onSummon', actions:[{ type:'dealDamage', target:'opponent', value:1200 }, { type:'tempDebuffAllOpp', atkD:400 }] }],
    ['ZFL7','Ätherstrom',      Race.Flyer,    Rarity.SuperRare, 'Alle Gegnermonster verlieren 1200 ATK bis Rundenende.',              { trigger:'onSummon', actions:[{ type:'tempDebuffAllOpp', atkD:1200 }] }],
    // Stein
    ['ZST1','Erdwall',         Race.Stone,   Rarity.Common,     'Erhalte 800 Lebenspunkte.',                                         { trigger:'onSummon', actions:[{ type:'gainLP', target:'self', value:800 }] }],
    ['ZST2','Steinschild',     Race.Stone,   Rarity.Common,     'Erhalte 1200 Lebenspunkte.',                                        { trigger:'onSummon', actions:[{ type:'gainLP', target:'self', value:1200 }] }],
    ['ZST3','Granitpanzer',    Race.Stone,   Rarity.Uncommon,   'Alle deine Stein-Monster erhalten +600 ATK bis Rundenende.',        { trigger:'onSummon', actions:[{ type:'tempBuffAtkRace', race:Race.Stone, value:600 }] }],
    ['ZST4','Felsenheilung',   Race.Stone,   Rarity.Uncommon,   'Erhalte 2000 Lebenspunkte.',                                        { trigger:'onSummon', actions:[{ type:'gainLP', target:'self', value:2000 }] }],
    ['ZST5','Erderschütterung',Race.Stone,   Rarity.Rare,       'Alle Gegnermonster verlieren 600 ATK dauerhaft.',                   { trigger:'onSummon', actions:[{ type:'debuffAllOpp', atkD:600, defD:0 }] }],
    ['ZST6','Steinwelle',      Race.Stone,   Rarity.Rare,       'Erhalte 3000 LP. Füge dem Gegner 500 Schaden zu.',                  { trigger:'onSummon', actions:[{ type:'gainLP', target:'self', value:3000 }, { type:'dealDamage', target:'opponent', value:500 }] }],
    ['ZST7','Urstein',         Race.Stone,   Rarity.SuperRare, 'Erhalte 4000 Lebenspunkte.',                                        { trigger:'onSummon', actions:[{ type:'gainLP', target:'self', value:4000 }] }],
    // Pflanze
    ['ZPF1','Heilranke',       Race.Plant, Rarity.Common,     'Erhalte 800 Lebenspunkte.',                                         { trigger:'onSummon', actions:[{ type:'gainLP', target:'self', value:800 }] }],
    ['ZPF2','Blütenregen',     Race.Plant, Rarity.Common,     'Erhalte 1200 Lebenspunkte. Ziehe 1 Karte.',                         { trigger:'onSummon', actions:[{ type:'gainLP', target:'self', value:1200 }, { type:'draw', target:'self', count:1 }] }],
    ['ZPF3','Waldmagie',       Race.Plant, Rarity.Uncommon,   'Alle deine Pflanze-Monster erhalten +400 ATK bis Rundenende.',      { trigger:'onSummon', actions:[{ type:'tempBuffAtkRace', race:Race.Plant, value:400 }] }],
    ['ZPF4','Wurzelnetz',      Race.Plant, Rarity.Uncommon,   'Erhalte 2000 LP und ziehe 1 Karte.',                                { trigger:'onSummon', actions:[{ type:'gainLP', target:'self', value:2000 }, { type:'draw', target:'self', count:1 }] }],
    ['ZPF5','Dornenschutz',    Race.Plant, Rarity.Rare,       'Erhalte 2500 LP.',                                                  { trigger:'onSummon', actions:[{ type:'gainLP', target:'self', value:2500 }] }],
    ['ZPF6','Natur rebellen',  Race.Plant, Rarity.Rare,       'Alle deine Pflanze-Monster erhalten +700 ATK. Erhalte 500 LP.',     { trigger:'onSummon', actions:[{ type:'tempBuffAtkRace', race:Race.Plant, value:700 }, { type:'gainLP', target:'self', value:500 }] }],
    ['ZPF7','Urwaldmagie',     Race.Plant, Rarity.SuperRare, 'Erhalte 4000 LP. Ziehe 2 Karten.',                                  { trigger:'onSummon', actions:[{ type:'gainLP', target:'self', value:4000 }, { type:'draw', target:'self', count:2 }] }],
    // Krieger
    ['ZKR1','Schlachtruf',     Race.Warrior, Rarity.Common,     'Alle deine Krieger-Monster erhalten bis Rundenende +500 ATK.',      { trigger:'onSummon', actions:[{ type:'tempBuffAtkRace', race:Race.Warrior, value:500 }] }],
    // ZKR2: Not expressible as descriptor — needs special handling (targets single monster, not race-based)
    ['ZKR2','Klingenmeister',  Race.Warrior, Rarity.Common,     'Wähle ein Monster auf deinem Feld. Es erhält +800 ATK bis Rundenende.', {apply(gs,o){const m=gs.getState()[o].field.monsters.find(fm=>fm);if(m)m.tempATKBonus=(m.tempATKBonus||0)+800;}} as unknown as CardEffectBlock],
    ['ZKR3','Kriegertaktik',   Race.Warrior, Rarity.Uncommon,   'Ziehe 2 Karten.',                                                   { trigger:'onSummon', actions:[{ type:'draw', target:'self', count:2 }] }],
    ['ZKR4','Schlachthymne',   Race.Warrior, Rarity.Uncommon,   'Alle deine Krieger erhalten +800 ATK bis Rundenende.',              { trigger:'onSummon', actions:[{ type:'tempBuffAtkRace', race:Race.Warrior, value:800 }] }],
    ['ZKR5','Klingenregen',    Race.Warrior, Rarity.Rare,       'Füge dem Gegner 800 Schaden zu. Alle Krieger +500 ATK.',            { trigger:'onSummon', actions:[{ type:'dealDamage', target:'opponent', value:800 }, { type:'tempBuffAtkRace', race:Race.Warrior, value:500 }] }],
    ['ZKR6','Schlachtrausch',  Race.Warrior, Rarity.Rare,       'Alle deine Krieger erhalten +1200 ATK bis Rundenende.',             { trigger:'onSummon', actions:[{ type:'tempBuffAtkRace', race:Race.Warrior, value:1200 }] }],
    ['ZKR7','Kriegsende',      Race.Warrior, Rarity.SuperRare, 'Füge dem Gegner 1500 Schaden zu. Alle Krieger +1000 ATK.',          { trigger:'onSummon', actions:[{ type:'dealDamage', target:'opponent', value:1500 }, { type:'tempBuffAtkRace', race:Race.Warrior, value:1000 }] }],
    // Magier
    ['ZMA1','Runenziehen',     Race.Spellcaster,  Rarity.Common,     'Ziehe 2 Karten.',                                                   { trigger:'onSummon', actions:[{ type:'draw', target:'self', count:2 }] }],
    ['ZMA2','Arkanzauber',     Race.Spellcaster,  Rarity.Common,     'Füge dem Gegner 500 Schaden zu. Ziehe 1 Karte.',                    { trigger:'onSummon', actions:[{ type:'dealDamage', target:'opponent', value:500 }, { type:'draw', target:'self', count:1 }] }],
    ['ZMA3','Wissensquell',    Race.Spellcaster,  Rarity.Uncommon,   'Ziehe 3 Karten.',                                                   { trigger:'onSummon', actions:[{ type:'draw', target:'self', count:3 }] }],
    ['ZMA4','Magiersegen',     Race.Spellcaster,  Rarity.Uncommon,   'Alle deine Magier-Monster erhalten +500 ATK bis Rundenende.',       { trigger:'onSummon', actions:[{ type:'tempBuffAtkRace', race:Race.Spellcaster, value:500 }] }],
    ['ZMA5','Wissensexplosion',Race.Spellcaster,  Rarity.Rare,       'Ziehe 3 Karten. Füge dem Gegner 300 Schaden zu.',                   { trigger:'onSummon', actions:[{ type:'draw', target:'self', count:3 }, { type:'dealDamage', target:'opponent', value:300 }] }],
    ['ZMA6','Arkanblitz',      Race.Spellcaster,  Rarity.Rare,       'Füge dem Gegner 1500 Schaden zu. Ziehe 1 Karte.',                   { trigger:'onSummon', actions:[{ type:'dealDamage', target:'opponent', value:1500 }, { type:'draw', target:'self', count:1 }] }],
    ['ZMA7','Omniszauber',     Race.Spellcaster,  Rarity.SuperRare, 'Ziehe 4 Karten. Füge dem Gegner 500 Schaden zu.',                   { trigger:'onSummon', actions:[{ type:'draw', target:'self', count:4 }, { type:'dealDamage', target:'opponent', value:500 }] }],
    // Elfe
    ['ZEL1','Mondsegen',       Race.Elf,    Rarity.Common,     'Erhalte 600 LP. Alle Gegnermonster verlieren 200 ATK bis Rundenende.',{ trigger:'onSummon', actions:[{ type:'gainLP', target:'self', value:600 }, { type:'tempDebuffAllOpp', atkD:200 }] }],
    ['ZEL2','Sternenstaub',    Race.Elf,    Rarity.Common,     'Alle Gegnermonster verlieren 400 ATK bis Rundenende.',              { trigger:'onSummon', actions:[{ type:'tempDebuffAllOpp', atkD:400 }] }],
    ['ZEL3','Lichthauch',      Race.Elf,    Rarity.Uncommon,   'Alle Gegnermonster verlieren dauerhaft 300 ATK.',                   { trigger:'onSummon', actions:[{ type:'debuffAllOpp', atkD:300, defD:0 }] }],
    ['ZEL4','Elfensegen',      Race.Elf,    Rarity.Uncommon,   'Erhalte 1500 LP. Ziehe 1 Karte.',                                   { trigger:'onSummon', actions:[{ type:'gainLP', target:'self', value:1500 }, { type:'draw', target:'self', count:1 }] }],
    ['ZEL5','Mondstrahl',      Race.Elf,    Rarity.Rare,       'Alle Gegnermonster verlieren dauerhaft 500 ATK und 500 DEF.',       { trigger:'onSummon', actions:[{ type:'debuffAllOpp', atkD:500, defD:500 }] }],
    ['ZEL6','Sternenregen',    Race.Elf,    Rarity.Rare,       'Alle Gegnermonster verlieren dauerhaft 700 ATK.',                   { trigger:'onSummon', actions:[{ type:'debuffAllOpp', atkD:700, defD:0 }] }],
    ['ZEL7','Mondfinsternis',  Race.Elf,    Rarity.SuperRare, 'Alle Gegnermonster verlieren dauerhaft 1000 ATK.',                  { trigger:'onSummon', actions:[{ type:'debuffAllOpp', atkD:1000, defD:0 }] }],
    // Dämon
    ['ZDA1','Seelenpakt',      Race.Demon,  Rarity.Common,     'Alle deine Dämon-Monster erhalten +600 ATK bis Rundenende.',        { trigger:'onSummon', actions:[{ type:'tempBuffAtkRace', race:Race.Demon, value:600 }] }],
    ['ZDA2','Höllenpakt',      Race.Demon,  Rarity.Common,     'Füge dem Gegner 800 Schaden zu.',                                   { trigger:'onSummon', actions:[{ type:'dealDamage', target:'opponent', value:800 }] }],
    ['ZDA3','Dunkles Opfer',   Race.Demon,  Rarity.Uncommon,   'Alle deine Dämon-Monster erhalten dauerhaft +400 ATK.',             { trigger:'onSummon', actions:[{ type:'buffAtkRace', race:Race.Demon, value:400 }] }],
    ['ZDA4','Abgrundfluch',    Race.Demon,  Rarity.Uncommon,   'Füge dem Gegner 1200 Schaden zu.',                                  { trigger:'onSummon', actions:[{ type:'dealDamage', target:'opponent', value:1200 }] }],
    ['ZDA5','Chaosaufstieg',   Race.Demon,  Rarity.Rare,       'Alle deine Dämon-Monster erhalten dauerhaft +600 ATK.',             { trigger:'onSummon', actions:[{ type:'buffAtkRace', race:Race.Demon, value:600 }] }],
    ['ZDA6','Höllensturm',     Race.Demon,  Rarity.Rare,       'Füge dem Gegner 2000 Schaden zu.',                                  { trigger:'onSummon', actions:[{ type:'dealDamage', target:'opponent', value:2000 }] }],
    ['ZDA7','Untergang',       Race.Demon,  Rarity.SuperRare, 'Füge dem Gegner 2500 Schaden zu. Alle Dämon-Monster +800 ATK.',     { trigger:'onSummon', actions:[{ type:'dealDamage', target:'opponent', value:2500 }, { type:'tempBuffAtkRace', race:Race.Demon, value:800 }] }],
    // Wasser
    ['ZWA1','Rückzug',         Race.Water,  Rarity.Common,     'Spiele das Monster mit der höchsten ATK des Gegners auf dessen Hand zurück.', { trigger:'onSummon', actions:[{ type:'bounceStrongestOpp' }] }],
    ['ZWA2','Nebelbank',       Race.Water,  Rarity.Common,     'Erhalte 500 LP. Ziehe 1 Karte.',                                    { trigger:'onSummon', actions:[{ type:'gainLP', target:'self', value:500 }, { type:'draw', target:'self', count:1 }] }],
    ['ZWA3','Eissturm',        Race.Water,  Rarity.Uncommon,   'Alle Gegnermonster verlieren 500 ATK bis Rundenende.',              { trigger:'onSummon', actions:[{ type:'tempDebuffAllOpp', atkD:500 }] }],
    ['ZWA4','Tiefenstrudel',   Race.Water,  Rarity.Uncommon,   'Füge dem Gegner 800 Schaden zu. Ziehe 1 Karte.',                    { trigger:'onSummon', actions:[{ type:'dealDamage', target:'opponent', value:800 }, { type:'draw', target:'self', count:1 }] }],
    ['ZWA5','Tsunami',         Race.Water,  Rarity.Rare,       'Füge dem Gegner 1500 Schaden zu. Alle Gegnermonster verlieren 300 ATK.',{ trigger:'onSummon', actions:[{ type:'dealDamage', target:'opponent', value:1500 }, { type:'tempDebuffAllOpp', atkD:300 }] }],
    ['ZWA6','Ozeanflut',       Race.Water,  Rarity.Rare,       'Spiele alle Gegnermonster auf die Hand zurück.',                    { trigger:'onSummon', actions:[{ type:'bounceAllOppMonsters' }] }],
    ['ZWA7','Meeresgewalt',    Race.Water,  Rarity.SuperRare, 'Füge dem Gegner 2500 Schaden zu. Ziehe 2 Karten.',                  { trigger:'onSummon', actions:[{ type:'dealDamage', target:'opponent', value:2500 }, { type:'draw', target:'self', count:2 }] }],
  ];

  SPELL_ENTRIES.forEach(([id,name,race,rarity,desc,effect])=>{
    _addCard(id, {
      id, name, type:CardType.Spell,
      race, rarity,
      description:desc,
      spellType:'normal',
      effect,
    });
  });

  // ── 40 Fallenkarten (4 pro Rasse) ───────────────────────────
  const TRAP_ENTRIES: [string, string, Race, Rarity, string, string, CardEffectBlock][] = [
    // Feuer
    ['QFE1','Flammenbarriere', Race.Fire,   Rarity.Uncommon, 'Aktiviere wenn der Gegner ein Monster beschwört: Füge dem Gegner Schaden gleich Hälfte des ATK des beschworten Monsters zu.',  'onOpponentSummon', { trigger:'onOpponentSummon', actions:[{ type:'dealDamage', target:'opponent', value:{ from:'summoned.atk', multiply:0.5, round:'floor' } }] }],
    ['QFE2','Gegenfeuer',      Race.Fire,   Rarity.Common,   'Aktiviere wenn ein Gegnermonster angreift: Füge dem Gegner 400 Schaden zu.',                                                    'onAttack',         { trigger:'onAttack', actions:[{ type:'dealDamage', target:'opponent', value:400 }, { type:'cancelAttack' }] }],
    ['QFE3','Lavabrand',       Race.Fire,   Rarity.Rare,     'Aktiviere wenn ein Gegnermonster angreift: Füge dem Gegner Schaden gleich der ATK des angreifenden Monsters zu.',               'onAttack',         { trigger:'onAttack', actions:[{ type:'dealDamage', target:'opponent', value:{ from:'attacker.effectiveATK', multiply:1, round:'floor' } }, { type:'cancelAttack' }] }],
    ['QFE4','Pyrosperre',      Race.Fire,   Rarity.SuperRare,'Aktiviere wenn ein Gegnermonster angreift: Negiere Angriff und füge dem Gegner 1000 Schaden zu.',                              'onAttack',         { trigger:'onAttack', actions:[{ type:'dealDamage', target:'opponent', value:1000 }, { type:'cancelAttack' }] }],
    // Drache
    ['QDR1','Drachenwut',      Race.Dragon,  Rarity.Common,   'Aktiviere wenn eines deiner Monster angegriffen wird: Es erhält bis Kampfende +1000 ATK.',                                      'onOwnMonsterAttacked', { trigger:'onOwnMonsterAttacked', actions:[{ type:'tempAtkBonus', target:'defender', value:1000 }] }],
    ['QDR2','Schuppenwand',    Race.Dragon,  Rarity.Uncommon, 'Aktiviere wenn ein Gegnermonster angreift: Negiere den Angriff.',                                                               'onAttack',         { trigger:'onAttack', actions:[{ type:'cancelAttack' }] }],
    ['QDR3','Wyrmfalle',       Race.Dragon,  Rarity.Rare,     'Aktiviere wenn der Gegner ein Monster beschwört: Zerstöre es wenn ATK ≥ 2000.',                                                'onOpponentSummon', { trigger:'onOpponentSummon', actions:[{ type:'destroySummonedIf', minAtk:2000 }] }],
    ['QDR4','Drachenfalle',    Race.Dragon,  Rarity.SuperRare,'Aktiviere wenn ein Gegnermonster angreift: Zerstöre das angreifende Monster.',                                                 'onAttack',         { trigger:'onAttack', actions:[{ type:'destroyAttacker' }] }],
    // Flug
    ['QFL1','Windschild',      Race.Flyer,    Rarity.Common,   'Aktiviere wenn eines deiner Monster angegriffen wird: Negiere den Angriff.',                                                    'onOwnMonsterAttacked', { trigger:'onOwnMonsterAttacked', actions:[{ type:'cancelAttack' }] }],
    ['QFL2','Federsenke',      Race.Flyer,    Rarity.Uncommon, 'Aktiviere wenn ein Gegnermonster angreift: Es verliert bis Kampfende 800 ATK.',                                                'onAttack',         { trigger:'onAttack', actions:[{ type:'tempAtkBonus', target:'attacker', value:-800 }] }],
    ['QFL3','Sturmfalle',      Race.Flyer,    Rarity.Rare,     'Aktiviere wenn der Gegner ein Monster beschwört: Es verliert dauerhaft 500 ATK.',                                              'onOpponentSummon', { trigger:'onOpponentSummon', actions:[{ type:'permAtkBonus', target:'summonedFC', value:-500 }] }],
    ['QFL4','Luftloch',        Race.Flyer,    Rarity.SuperRare,'Aktiviere wenn ein Gegnermonster angreift: Negiere Angriff. Gegner verliert 500 LP.',                                          'onAttack',         { trigger:'onAttack', actions:[{ type:'dealDamage', target:'opponent', value:500 }, { type:'cancelAttack' }] }],
    // Stein
    ['QST1','Steinwall',       Race.Stone,   Rarity.Common,   'Aktiviere wenn eines deiner Monster angegriffen wird: Es erhält bis Kampfende +1500 DEF.',                                     'onOwnMonsterAttacked', { trigger:'onOwnMonsterAttacked', actions:[{ type:'tempDefBonus', target:'defender', value:1500 }] }],
    ['QST2','Felssperre',      Race.Stone,   Rarity.Uncommon, 'Aktiviere wenn ein Gegnermonster angreift: Negiere den Angriff.',                                                               'onAttack',         { trigger:'onAttack', actions:[{ type:'cancelAttack' }] }],
    ['QST3','Erdbebenfall',    Race.Stone,   Rarity.Rare,     'Aktiviere wenn der Gegner ein Monster beschwört: Alle Gegnermonster verlieren 400 ATK dauerhaft.',                              'onOpponentSummon', { trigger:'onOpponentSummon', actions:[{ type:'debuffAllOpp', atkD:400, defD:0 }] }],
    ['QST4','Granitkäfig',     Race.Stone,   Rarity.SuperRare,'Aktiviere wenn ein Gegnermonster angreift: Negiere Angriff. Das angreifende Monster verliert 1000 ATK dauerhaft.',             'onAttack',         { trigger:'onAttack', actions:[{ type:'permAtkBonus', target:'attacker', value:-1000 }, { type:'cancelAttack' }] }],
    // Pflanze
    ['QPF1','Dornenschild',    Race.Plant, Rarity.Common,   'Aktiviere wenn eines deiner Monster angegriffen wird: Erhalte 500 LP.',                                                        'onOwnMonsterAttacked', { trigger:'onOwnMonsterAttacked', actions:[{ type:'gainLP', target:'self', value:500 }] }],
    ['QPF2','Heilrankenfall',  Race.Plant, Rarity.Uncommon, 'Aktiviere wenn ein Gegnermonster angreift: Negiere den Angriff. Erhalte 800 LP.',                                              'onAttack',         { trigger:'onAttack', actions:[{ type:'gainLP', target:'self', value:800 }, { type:'cancelAttack' }] }],
    ['QPF3','Rankensperre',    Race.Plant, Rarity.Rare,     'Aktiviere wenn der Gegner ein Monster beschwört: Es verliert dauerhaft 600 ATK.',                                              'onOpponentSummon', { trigger:'onOpponentSummon', actions:[{ type:'permAtkBonus', target:'summonedFC', value:-600 }] }],
    ['QPF4','Moossog',         Race.Plant, Rarity.SuperRare,'Aktiviere wenn ein Gegnermonster angreift: Negiere Angriff. Erhalte LP gleich ATK des angreifenden Monsters ÷ 2.',             'onAttack',         { trigger:'onAttack', actions:[{ type:'gainLP', target:'self', value:{ from:'attacker.effectiveATK', multiply:0.5, round:'floor' } }, { type:'cancelAttack' }] }],
    // Krieger
    ['QKR1','Kampfruf',        Race.Warrior, Rarity.Common,   'Aktiviere wenn eines deiner Monster angegriffen wird: Es erhält bis Kampfende +800 ATK.',                                      'onOwnMonsterAttacked', { trigger:'onOwnMonsterAttacked', actions:[{ type:'tempAtkBonus', target:'defender', value:800 }] }],
    ['QKR2','Gegenwehr',       Race.Warrior, Rarity.Uncommon, 'Aktiviere wenn ein Gegnermonster angreift: Negiere den Angriff.',                                                               'onAttack',         { trigger:'onAttack', actions:[{ type:'cancelAttack' }] }],
    ['QKR3','Klingensperre',   Race.Warrior, Rarity.Rare,     'Aktiviere wenn der Gegner ein Monster beschwört: Es verliert dauerhaft 500 ATK.',                                              'onOpponentSummon', { trigger:'onOpponentSummon', actions:[{ type:'permAtkBonus', target:'summonedFC', value:-500 }] }],
    ['QKR4','Heldenfalle',     Race.Warrior, Rarity.SuperRare,'Aktiviere wenn ein Gegnermonster angreift: Es verliert bis Kampfende 1500 ATK.',                                              'onAttack',         { trigger:'onAttack', actions:[{ type:'tempAtkBonus', target:'attacker', value:-1500 }] }],
    // Magier
    ['QMA1','Runensperre',     Race.Spellcaster,  Rarity.Common,   'Aktiviere wenn ein Gegnermonster angreift: Ziehe 1 Karte.',                                                                    'onAttack',         { trigger:'onAttack', actions:[{ type:'draw', target:'self', count:1 }] }],
    ['QMA2','Arkanfalle',      Race.Spellcaster,  Rarity.Uncommon, 'Aktiviere wenn der Gegner ein Monster beschwört: Ziehe 1 Karte. Gegner verliert 300 LP.',                                      'onOpponentSummon', { trigger:'onOpponentSummon', actions:[{ type:'draw', target:'self', count:1 }, { type:'dealDamage', target:'opponent', value:300 }] }],
    ['QMA3','Wissensfalle',    Race.Spellcaster,  Rarity.Rare,     'Aktiviere wenn ein Gegnermonster angreift: Negiere Angriff. Ziehe 2 Karten.',                                                  'onAttack',         { trigger:'onAttack', actions:[{ type:'draw', target:'self', count:2 }, { type:'cancelAttack' }] }],
    ['QMA4','Magiersperre',    Race.Spellcaster,  Rarity.SuperRare,'Aktiviere wenn der Gegner ein Monster beschwört: Es verliert dauerhaft 800 ATK. Ziehe 2 Karten.',                             'onOpponentSummon', { trigger:'onOpponentSummon', actions:[{ type:'permAtkBonus', target:'summonedFC', value:-800 }, { type:'draw', target:'self', count:2 }] }],
    // Elfe
    ['QEL1','Elfenzauber',     Race.Elf,    Rarity.Common,   'Aktiviere wenn ein Gegnermonster angreift: Es verliert bis Kampfende 600 ATK.',                                                'onAttack',         { trigger:'onAttack', actions:[{ type:'tempAtkBonus', target:'attacker', value:-600 }] }],
    ['QEL2','Mondfalle',       Race.Elf,    Rarity.Uncommon, 'Aktiviere wenn der Gegner ein Monster beschwört: Es verliert dauerhaft 400 ATK und 400 DEF.',                                  'onOpponentSummon', { trigger:'onOpponentSummon', actions:[{ type:'permAtkBonus', target:'summonedFC', value:-400 }, { type:'permDefBonus', target:'summonedFC', value:-400 }] }],
    ['QEL3','Sternenfalle',    Race.Elf,    Rarity.Rare,     'Aktiviere wenn ein Gegnermonster angreift: Negiere Angriff. Es verliert dauerhaft 500 ATK.',                                   'onAttack',         { trigger:'onAttack', actions:[{ type:'permAtkBonus', target:'attacker', value:-500 }, { type:'cancelAttack' }] }],
    ['QEL4','Lichtfalle',      Race.Elf,    Rarity.SuperRare,'Aktiviere wenn der Gegner ein Monster beschwört: Es verliert dauerhaft 800 ATK und 800 DEF.',                                 'onOpponentSummon', { trigger:'onOpponentSummon', actions:[{ type:'permAtkBonus', target:'summonedFC', value:-800 }, { type:'permDefBonus', target:'summonedFC', value:-800 }] }],
    // Dämon
    ['QDA1','Seelenfalle',     Race.Demon,  Rarity.Common,   'Aktiviere wenn ein Gegnermonster angreift: Füge dem Gegner 500 Schaden zu.',                                                   'onAttack',         { trigger:'onAttack', actions:[{ type:'dealDamage', target:'opponent', value:500 }] }],
    ['QDA2','Höllenfalle',     Race.Demon,  Rarity.Uncommon, 'Aktiviere wenn der Gegner ein Monster beschwört: Füge dem Gegner 400 Schaden zu.',                                             'onOpponentSummon', { trigger:'onOpponentSummon', actions:[{ type:'dealDamage', target:'opponent', value:400 }] }],
    ['QDA3','Abgrundfalle',    Race.Demon,  Rarity.Rare,     'Aktiviere wenn ein Gegnermonster angreift: Negiere Angriff. Füge dem Gegner 800 Schaden zu.',                                  'onAttack',         { trigger:'onAttack', actions:[{ type:'dealDamage', target:'opponent', value:800 }, { type:'cancelAttack' }] }],
    ['QDA4','Chaosfalle',      Race.Demon,  Rarity.SuperRare,'Aktiviere wenn ein Gegnermonster angreift: Zerstöre es. Füge dem Gegner 500 Schaden zu.',                                     'onAttack',         { trigger:'onAttack', actions:[{ type:'dealDamage', target:'opponent', value:500 }, { type:'destroyAttacker' }] }],
    // Wasser
    ['QWA1','Strudelfalle',    Race.Water,  Rarity.Common,   'Aktiviere wenn ein Gegnermonster angreift: Es verliert bis Kampfende 500 ATK.',                                                'onAttack',         { trigger:'onAttack', actions:[{ type:'tempAtkBonus', target:'attacker', value:-500 }] }],
    ['QWA2','Eisfalle',        Race.Water,  Rarity.Uncommon, 'Aktiviere wenn der Gegner ein Monster beschwört: Es verliert dauerhaft 400 ATK.',                                              'onOpponentSummon', { trigger:'onOpponentSummon', actions:[{ type:'permAtkBonus', target:'summonedFC', value:-400 }] }],
    ['QWA3','Tiefseefalle',    Race.Water,  Rarity.Rare,     'Aktiviere wenn ein Gegnermonster angreift: Negiere Angriff. Spiele es auf die Hand zurück.',                                   'onAttack',         { trigger:'onAttack', actions:[{ type:'bounceAttacker' }, { type:'cancelAttack' }] }],
    ['QWA4','Ozeanfalle',      Race.Water,  Rarity.SuperRare,'Aktiviere wenn ein Gegnermonster angreift: Negiere Angriff. Alle Gegnermonster auf die Hand zurück.',                         'onAttack',         { trigger:'onAttack', actions:[{ type:'bounceAllOppMonsters' }, { type:'cancelAttack' }] }],
  ];

  TRAP_ENTRIES.forEach(([id,name,race,rarity,desc,trapTrigger,effect])=>{
    _addCard(id, {
      id, name, type:CardType.Trap,
      race, rarity,
      description:desc,
      trapTrigger: trapTrigger as import('./types.js').TrapTrigger,
      effect,
    });
  });

  // ── Starterdecks (40 Karten je Rasse) ────────────────────────
export const STARTER_DECKS: Record<Race, string[]> = {
    [Race.Fire]: [
      'NFE01','NFE01','NFE02','NFE02','NFE05','NFE05','NFE06','NFE06',
      'NFE09','NFE09','NFE10','NFE10','NFE11','NFE11','NFE15','NFE15',
      'NFE17','NFE17','NFE19','NFE19',
      'EFE01','EFE01','EFE02','EFE02','EFE06','EFE09',
      'ZFE1','ZFE1','ZFE2','ZFE3','ZFE3','ZFE4',
      'S003','S005',
      'T001','T002','QFE1','QFE2','QFE3','QFE4',
    ],
    [Race.Dragon]: [
      'NDR01','NDR01','NDR02','NDR02','NDR05','NDR05','NDR06','NDR06',
      'NDR09','NDR09','NDR10','NDR10','NDR11','NDR11','NDR15','NDR15',
      'NDR17','NDR17','NDR19','NDR19',
      'EDR01','EDR01','EDR03','EDR03','EDR07','EDR05',
      'ZDR1','ZDR1','ZDR3','ZDR3','ZDR5','ZDR4',
      'S003','S005',
      'T001','T002','QDR1','QDR2','QDR3','QDR4',
    ],
    [Race.Flyer]: [
      'NFL01','NFL01','NFL02','NFL02','NFL05','NFL05','NFL06','NFL06',
      'NFL09','NFL09','NFL10','NFL10','NFL11','NFL11','NFL15','NFL15',
      'NFL17','NFL17','NFL19','NFL19',
      'EFL01','EFL01','EFL02','EFL02','EFL05','EFL07',
      'ZFL1','ZFL1','ZFL2','ZFL3','ZFL3','ZFL4',
      'S003','S005',
      'T001','T002','QFL1','QFL2','QFL3','QFL4',
    ],
    [Race.Stone]: [
      'NST01','NST01','NST02','NST02','NST05','NST05','NST06','NST06',
      'NST09','NST09','NST10','NST10','NST11','NST11','NST15','NST15',
      'NST17','NST17','NST19','NST19',
      'EST01','EST01','EST03','EST03','EST05','EST09',
      'ZST1','ZST1','ZST2','ZST3','ZST3','ZST4',
      'S002','S005',
      'T002','T004','QST1','QST2','QST3','QST4',
    ],
    [Race.Plant]: [
      'NPF01','NPF01','NPF02','NPF02','NPF05','NPF05','NPF06','NPF06',
      'NPF09','NPF09','NPF10','NPF10','NPF11','NPF11','NPF15','NPF15',
      'NPF17','NPF17','NPF19','NPF19',
      'EPF01','EPF01','EPF03','EPF03','EPF04','EPF07',
      'ZPF1','ZPF1','ZPF2','ZPF3','ZPF3','ZPF4',
      'S002','S005',
      'T002','T004','QPF1','QPF2','QPF3','QPF4',
    ],
    [Race.Warrior]: [
      'NKR01','NKR01','NKR02','NKR02','NKR05','NKR05','NKR06','NKR06',
      'NKR09','NKR09','NKR10','NKR10','NKR11','NKR11','NKR15','NKR15',
      'NKR17','NKR17','NKR19','NKR19',
      'EKR01','EKR01','EKR03','EKR03','EKR06','EKR09',
      'ZKR1','ZKR1','ZKR2','ZKR3','ZKR3','ZKR4',
      'S003','S005',
      'T001','T002','QKR1','QKR2','QKR3','QKR4',
    ],
    [Race.Spellcaster]: [
      'NMA01','NMA01','NMA02','NMA02','NMA05','NMA05','NMA06','NMA06',
      'NMA09','NMA09','NMA10','NMA10','NMA11','NMA11','NMA15','NMA15',
      'NMA17','NMA17','NMA19','NMA19',
      'EMA01','EMA01','EMA03','EMA03','EMA05','EMA07',
      'ZMA1','ZMA1','ZMA2','ZMA3','ZMA3','ZMA4',
      'S005','S005',
      'T003','T004','QMA1','QMA2','QMA3','QMA4',
    ],
    [Race.Elf]: [
      'NEL01','NEL01','NEL02','NEL02','NEL05','NEL05','NEL06','NEL06',
      'NEL09','NEL09','NEL10','NEL10','NEL11','NEL11','NEL15','NEL15',
      'NEL17','NEL17','NEL19','NEL19',
      'EEL01','EEL01','EEL02','EEL02','EEL05','EEL07',
      'ZEL1','ZEL1','ZEL2','ZEL3','ZEL3','ZEL4',
      'S002','S005',
      'T002','T004','QEL1','QEL2','QEL3','QEL4',
    ],
    [Race.Demon]: [
      'NDA01','NDA01','NDA02','NDA02','NDA05','NDA05','NDA06','NDA06',
      'NDA09','NDA09','NDA10','NDA10','NDA11','NDA11','NDA15','NDA15',
      'NDA17','NDA17','NDA19','NDA19',
      'EDA01','EDA01','EDA02','EDA02','EDA06','EDA08',
      'ZDA1','ZDA1','ZDA2','ZDA3','ZDA3','ZDA4',
      'S003','S005',
      'T001','T002','QDA1','QDA2','QDA3','QDA4',
    ],
    [Race.Water]: [
      'NWA01','NWA01','NWA02','NWA02','NWA05','NWA05','NWA06','NWA06',
      'NWA09','NWA09','NWA10','NWA10','NWA11','NWA11','NWA15','NWA15',
      'NWA17','NWA17','NWA19','NWA19',
      'EWA01','EWA01','EWA03','EWA03','EWA05','EWA07',
      'ZWA1','ZWA1','ZWA2','ZWA3','ZWA3','ZWA4',
      'S002','S005',
      'T002','T004','QWA1','QWA2','QWA3','QWA4',
    ],
};

// Sentinel export: importing this module guarantees CARD_DB is fully populated.
export const CARDS_DB_INITIALIZED = true;
