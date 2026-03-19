// ============================================================
// AETHERIAL CLASH – Erweiterte Kartendatenbank
// 672 neue Karten + STARTER_DECKS
// Lädt nach cards.ts und erweitert CARD_DB global.
// ============================================================
import type { CardEffect, CardData, RarityLevel } from './types.js';
import { CARD_DB, RARITY, RACE, ATTR, TYPE, FUSION_RECIPES } from './cards.js';

// Wraps every CARD_DB write — warns in the console if an ID is reused.
// This is a development guard only; the last write still wins.
function _addCard(id: string, def: CardData): void {
  if (CARD_DB[id]) {
    throw new Error(`[CARD_DB] ID-Kollision: "${id}" – Karte existiert bereits als "${CARD_DB[id].name}". IDs müssen eindeutig sein.`);
  }
  CARD_DB[id] = def;
}

  // ── Effekt-Fabriken ─────────────────────────────────────────
  function fxBurnSummon(n: number): CardEffect      { return { trigger:'onSummon',          apply(gs,o){ gs.dealDamage(o==='player'?'opponent':'player', n); } }; }
  function fxHealSummon(n: number): CardEffect      { return { trigger:'onSummon',          apply(gs,o){ gs.gainLP(o, n); } }; }
  function fxDrawSummon(n: number): CardEffect      { return { trigger:'onSummon',          apply(gs,o){ gs.drawCard(o, n); } }; }
  function fxBurnDestroy(n: number): CardEffect     { return { trigger:'onDestroyByBattle', apply(gs,o){ gs.dealDamage(o==='player'?'opponent':'player', n); } }; }
  function fxHealDestroy(n: number): CardEffect     { return { trigger:'onDestroyByBattle', apply(gs,o){ gs.gainLP(o, n); } }; }
  function fxDrawDestroy(n: number): CardEffect     { return { trigger:'onDestroyByBattle', apply(gs,o){ gs.drawCard(o, n); } }; }
  function fxBuffRaceSummon(race: string, n: number): CardEffect {
    return { trigger:'onSummon', apply(gs,o){
      gs.getState()[o].field.monsters.forEach(fm=>{
        if(fm && fm.card.race===race) fm.permATKBonus=(fm.permATKBonus||0)+n;
      });
    }};
  }
  function fxDebuffAllOpp(atkD: number, defD: number): CardEffect {
    return { trigger:'onSummon', apply(gs,o){
      const op=o==='player'?'opponent':'player';
      gs.getState()[op].field.monsters.forEach(fm=>{
        if(!fm) return;
        if(atkD) fm.permATKBonus=(fm.permATKBonus||0)-atkD;
        if(defD) fm.permDEFBonus=(fm.permDEFBonus||0)-defD;
      });
    }};
  }
  function fxBounceOppSummon(): CardEffect {
    return { trigger:'onSummon', apply(gs,o){
      const op=o==='player'?'opponent':'player';
      const st=gs.getState()[op].field.monsters;
      const strongest = st.reduce<number|null>((a,b,i)=>(!b?a: (!a||b.effectiveATK()>st[a]!.effectiveATK()?i:a)),null);
      if(strongest!==null && st[strongest]){
        const fc=st[strongest]!;
        gs.getState()[op].hand.push(fc.card);
        st[strongest]=null;
        gs.addLog(`${fc.card.name} wurde auf die Hand zurückgespielt!`);
      }
    }};
  }
  function fxPiercing(): CardEffect         { return { trigger:'passive', piercing:true }; }
  function fxUntargetable(): CardEffect    { return { trigger:'passive', cannotBeTargeted:true }; }
  function fxCanDirectAttack(): CardEffect { return { trigger:'passive', canDirectAttack:true }; }

  // ── Rassen-Attribut-Map ─────────────────────────────────────
  const RACE_ATTR: Record<string, string> = {
    feuer:'fire', drache:'wind', flug:'wind', stein:'earth',
    pflanze:'earth', krieger:'light', magier:'dark', elfe:'light',
    daemon:'dark', wasser:'water',
  };

  // ── Stat-Bias [ATK-Bonus, DEF-Bonus] ──────────────────────
  const RACE_BIAS: Record<string, [number, number]> = {
    feuer:   [+100,-100],
    drache:  [+200,   0],
    flug:    [ +50, -50],
    stein:   [-200,+300],
    pflanze: [-100,+100],
    krieger: [+100, +50],
    magier:  [ -50,-100],
    elfe:    [-150, +50],
    daemon:  [+150, -50],
    wasser:  [   0,   0],
  };

  // ── Basis-Stats pro Level ──────────────────────────────────
  const LVL_BASE: Record<number, [number, number]> = {
    1:[400,300], 2:[600,500], 3:[900,700],  4:[1200,900],
    5:[1600,1200], 6:[1900,1500], 7:[2200,1800], 8:[2500,2000], 9:[2800,2200],
  };

  function calcStats(level: number, race: string, idx: number) {
    const b=LVL_BASE[level], bi=RACE_BIAS[race];
    const j=((idx%5)-2)*50;
    return {
      atk:Math.max(100, b[0]+bi[0]+j),
      def:Math.max(0,   b[1]+bi[1]-j),
    };
  }

  function rarityForIdx(idx: number): RarityLevel {
    if(idx<14) return RARITY.COMMON;
    if(idx<16) return RARITY.UNCOMMON;
    if(idx<20) return RARITY.COMMON;
    if(idx<24) return RARITY.UNCOMMON;
    if(idx<28) return RARITY.UNCOMMON;
    if(idx<30) return RARITY.RARE;
    if(idx<32) return RARITY.UNCOMMON;
    return RARITY.RARE;
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
  const NORMAL_NAMES: Record<string, string[]> = {
    feuer: [
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
    drache: [
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
    flug: [
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
    stein: [
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
    pflanze: [
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
    krieger: [
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
    magier: [
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
    elfe: [
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
    daemon: [
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
    wasser: [
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

  const NM_PREFIX: Record<string, string> = {
    feuer:'NFE', drache:'NDR', flug:'NFL', stein:'NST', pflanze:'NPF',
    krieger:'NKR', magier:'NMA', elfe:'NEL', daemon:'NDA', wasser:'NWA',
  };

  const RACE_REF: Record<string, string> = {
    feuer:RACE.FEUER, drache:RACE.DRACHE, flug:RACE.FLUG, stein:RACE.STEIN,
    pflanze:RACE.PFLANZE, krieger:RACE.KRIEGER, magier:RACE.MAGIER,
    elfe:RACE.ELFE, daemon:RACE.DAEMON, wasser:RACE.WASSER,
  };

  const NM_FLAVOR: Record<string, (r: number) => string> = {
    feuer:   r=>`Ein feuriges Wesen der Stufe ${r}.`,
    drache:  r=>`Ein imposanter Drache der Stufe ${r}.`,
    flug:    r=>`Ein fliegendes Wesen der Stufe ${r}.`,
    stein:   r=>`Ein steinernes Wesen mit hoher Verteidigung, Stufe ${r}.`,
    pflanze: r=>`Ein pflanzliches Wesen der Stufe ${r}.`,
    krieger: r=>`Ein kampferprobter Krieger der Stufe ${r}.`,
    magier:  r=>`Ein magisches Wesen der Stufe ${r}.`,
    elfe:    r=>`Eine elfische Kreatur der Stufe ${r}.`,
    daemon:  r=>`Ein dunkles dämonisches Wesen der Stufe ${r}.`,
    wasser:  r=>`Ein wasserbewohnendes Wesen der Stufe ${r}.`,
  };

  // ── 340 Normal-Monster generieren ─────────────────────────
  for(const [race, names] of Object.entries(NORMAL_NAMES)) {
    const prefix=NM_PREFIX[race], attr=RACE_ATTR[race], raceRef=RACE_REF[race];
    names.forEach((name,idx)=>{
      const level=levelForIdx(idx);
      const id=prefix+String(idx+1).padStart(2,'0');
      const {atk,def}=calcStats(level,race,idx);
      _addCard(id, {
        id, name, type:TYPE.NORMAL,
        attribute:attr, race:raceRef, rarity:rarityForIdx(idx),
        level, atk, def,
        description:NM_FLAVOR[race](level),
      });
    });
  }

  // ── Effekt-Monster (200) ───────────────────────────────────
  // Format: [id, name, level, rarity, atk, def, desc, effect]
  const EFFECT_ENTRIES: [string, string, number, RarityLevel, number, number, string, CardEffect][] = [

    // ── FEUER (EFE01–EFE20) ──────────────────────────────────
    ['EFE01','Glutspeier',      3,'uncommon', 900, 600, '[Effekt] Bei Beschwörung: Gegner verliert 200 LP.', fxBurnSummon(200)],
    ['EFE02','Lavabrenner',     3,'uncommon',1000, 700, '[Effekt] Bei Beschwörung: Gegner verliert 300 LP.', fxBurnSummon(300)],
    ['EFE03','Feuergeist',      4,'uncommon',1200, 800, '[Effekt] Bei Beschwörung: Gegner verliert 400 LP.', fxBurnSummon(400)],
    ['EFE04','Aschewächter',    4,'rare',    1300, 900, '[Effekt] Bei Beschwörung: Gegner verliert 500 LP.', fxBurnSummon(500)],
    ['EFE05','Gluthüter',       5,'rare',    1600,1100, '[Effekt] Bei Beschwörung: Gegner verliert 600 LP.', fxBurnSummon(600)],
    ['EFE06','Feuerspucker',    3,'uncommon', 800, 700, '[Effekt] Wenn im Kampf vernichtet: Gegner verliert 200 LP.', fxBurnDestroy(200)],
    ['EFE07','Lavawächter',     4,'uncommon',1100, 900, '[Effekt] Wenn im Kampf vernichtet: Gegner verliert 300 LP.', fxBurnDestroy(300)],
    ['EFE08','Flammenjäger',    5,'rare',    1500,1100, '[Effekt] Wenn im Kampf vernichtet: Gegner verliert 400 LP.', fxBurnDestroy(400)],
    ['EFE09','Pyrogeist',       4,'rare',    1100, 800, '[Effekt] Bei Beschwörung: Alle Feuer-Monster erhalten +200 ATK.', fxBuffRaceSummon(RACE.FEUER,200)],
    ['EFE10','Glutmeister',     5,'rare',    1500,1100, '[Effekt] Bei Beschwörung: Alle Feuer-Monster erhalten +300 ATK.', fxBuffRaceSummon(RACE.FEUER,300)],
    ['EFE11','Feuersänger',     3,'uncommon', 950, 700, '[Effekt] Bei Beschwörung: Erhalte 200 LP.', fxHealSummon(200)],
    ['EFE12','Lavakönig',       4,'uncommon',1100, 900, '[Effekt] Wenn im Kampf vernichtet: Ziehe 1 Karte.', fxDrawDestroy(1)],
    ['EFE13','Flammenmeister',  5,'rare',    1700,1200, '[Effekt] Bei Beschwörung: Gegner verliert 800 LP.', fxBurnSummon(800)],
    ['EFE14','Pyrotitan',       6,'rare',    1900,1400, '[Effekt] Bei Beschwörung: Gegner verliert 1000 LP.', fxBurnSummon(1000)],
    ['EFE15','Glutkoloss',      6,'super_rare',2100,1500,'[Effekt] Bei Beschwörung: Alle Feuer-Monster erhalten +400 ATK.', fxBuffRaceSummon(RACE.FEUER,400)],
    ['EFE16','Lavagott',        7,'super_rare',2200,1700,'[Effekt] Bei Beschwörung: Gegner verliert 1200 LP.', fxBurnSummon(1200)],
    ['EFE17','Feuerdrache',     7,'super_rare',2300,1800,'[Effekt] Wenn im Kampf vernichtet: Gegner verliert 800 LP.', fxBurnDestroy(800)],
    ['EFE18','Pyrokaiser',      8,'super_rare',2500,1900,'[Effekt] Bei Beschwörung: Gegner verliert 1500 LP.', fxBurnSummon(1500)],
    ['EFE19','Glutkaiser',      8,'ultra_rare',2700,2100,'[Effekt] Bei Beschwörung: Gegner verliert 2000 LP.', fxBurnSummon(2000)],
    ['EFE20','Feuergott',       9,'ultra_rare',3000,2300,'[Effekt] Bei Beschwörung: Alle Feuer-Monster erhalten +500 ATK. Gegner verliert 1000 LP.', fxBuffRaceSummon(RACE.FEUER,500)],

    // ── DRACHE (EDR01–EDR20) ──────────────────────────────────
    ['EDR01','Schuppenwyrm',    3,'uncommon',1100, 700, '[Passiv] Durchbohrender Angriff.', fxPiercing()],
    ['EDR02','Klauenwächter',   4,'uncommon',1400, 900, '[Passiv] Durchbohrender Angriff.', fxPiercing()],
    ['EDR03','Schattenwyrm',    4,'rare',    1300, 900, '[Passiv] Kann nicht als Ziel gewählt werden.', fxUntargetable()],
    ['EDR04','Schildwyrm',      5,'rare',    1700,1200, '[Passiv] Kann nicht als Ziel gewählt werden.', fxUntargetable()],
    ['EDR05','Eisdrachegeist',  4,'uncommon',1300, 900, '[Effekt] Bei Beschwörung: Alle Drachen-Monster erhalten +200 ATK.', fxBuffRaceSummon(RACE.DRACHE,200)],
    ['EDR06','Drachenwächter',  5,'rare',    1700,1200, '[Effekt] Bei Beschwörung: Alle Drachen-Monster erhalten +300 ATK.', fxBuffRaceSummon(RACE.DRACHE,300)],
    ['EDR07','Wyrmgeist',       4,'uncommon',1200,1000, '[Effekt] Wenn im Kampf vernichtet: Ziehe 1 Karte.', fxDrawDestroy(1)],
    ['EDR08','Klauentänzer',    4,'uncommon',1400, 800, '[Effekt] Bei Beschwörung: Gegner verliert 300 LP.', fxBurnSummon(300)],
    ['EDR09','Sturmwyrm',       5,'rare',    1800,1200, '[Effekt] Bei Beschwörung: Gegner verliert 400 LP.', fxBurnSummon(400)],
    ['EDR10','Drachenfürst',    6,'rare',    2100,1600, '[Effekt] Bei Beschwörung: Alle Drachen-Monster erhalten +400 ATK.', fxBuffRaceSummon(RACE.DRACHE,400)],
    ['EDR11','Donnerdrache',    5,'rare',    1800,1300, '[Effekt] Bei Beschwörung: Gegner verliert 500 LP.', fxBurnSummon(500)],
    ['EDR12','Drachenanführer', 6,'super_rare',2200,1700,'[Effekt] Bei Beschwörung: Alle Drachen-Monster erhalten +500 ATK.', fxBuffRaceSummon(RACE.DRACHE,500)],
    ['EDR13','Urwyrm',          6,'rare',    2100,1600, '[Effekt] Bei Beschwörung: Gegner verliert 600 LP.', fxBurnSummon(600)],
    ['EDR14','Titanwyrm',       7,'super_rare',2400,1900,'[Passiv] Durchbohrender Angriff.', fxPiercing()],
    ['EDR15','Schuppentitan',   7,'super_rare',2400,1900,'[Effekt] Bei Beschwörung: Alle Drachen-Monster erhalten +600 ATK.', fxBuffRaceSummon(RACE.DRACHE,600)],
    ['EDR16','Wyrmfürst',       7,'super_rare',2300,1900,'[Passiv] Kann nicht als Ziel gewählt werden.', fxUntargetable()],
    ['EDR17','Drachengigant',   8,'super_rare',2600,2100,'[Effekt] Bei Beschwörung: Gegner verliert 1000 LP.', fxBurnSummon(1000)],
    ['EDR18','Urdrachenwächter',8,'super_rare',2600,2200,'[Passiv] Durchbohrender Angriff.', fxPiercing()],
    ['EDR19','Wyrmkönig',       9,'ultra_rare',2900,2400,'[Passiv] Durchbohrender Angriff. Kann nicht als Ziel gewählt werden.', fxPiercing()],
    ['EDR20','Drachenkaiser',   9,'ultra_rare',3100,2500,'[Effekt] Bei Beschwörung: Alle Drachen-Monster erhalten +800 ATK.', fxBuffRaceSummon(RACE.DRACHE,800)],

    // ── FLUG (EFL01–EFL20) ───────────────────────────────────
    ['EFL01','Sturmgeist',      3,'uncommon', 950, 600, '[Passiv] Kann nicht als Ziel gewählt werden.', fxUntargetable()],
    ['EFL02','Windtänzer',      3,'uncommon',1000, 700, '[Effekt] Bei Beschwörung: Ein Gegnermonster verliert 200 ATK und 200 DEF.', fxDebuffAllOpp(200,200)],
    ['EFL03','Federgeist',      4,'uncommon',1150, 800, '[Effekt] Bei Beschwörung: Alle Gegnermonster verlieren 200 ATK.', fxDebuffAllOpp(200,0)],
    ['EFL04','Ätherjäger',      4,'rare',    1300, 900, '[Passiv] Kann nicht als Ziel gewählt werden.', fxUntargetable()],
    ['EFL05','Windwächter',     4,'uncommon',1100, 800, '[Effekt] Wenn im Kampf vernichtet: Ziehe 1 Karte.', fxDrawDestroy(1)],
    ['EFL06','Windgeist',       4,'uncommon',1200, 850, '[Effekt] Bei Beschwörung: Gegner verliert 200 LP.', fxBurnSummon(200)],
    ['EFL07','Sturmtänzer',     5,'rare',    1550,1100, '[Effekt] Bei Beschwörung: Alle Gegnermonster verlieren 300 ATK.', fxDebuffAllOpp(300,0)],
    ['EFL08','Federdrache',     5,'rare',    1600,1100, '[Effekt] Wenn im Kampf vernichtet: Gegner verliert 300 LP.', fxBurnDestroy(300)],
    ['EFL09','Himmelsreiter',   5,'rare',    1700,1200, '[Passiv] Kann nicht als Ziel gewählt werden.', fxUntargetable()],
    ['EFL10','Gewitterfalke',   5,'rare',    1650,1050, '[Effekt] Bei Beschwörung: Gegner verliert 400 LP.', fxBurnSummon(400)],
    ['EFL11','Windfürst',       6,'rare',    1950,1450, '[Effekt] Bei Beschwörung: Alle Gegnermonster verlieren 400 ATK.', fxDebuffAllOpp(400,0)],
    ['EFL12','Ätherfürst',      6,'rare',    2000,1500, '[Passiv] Kann nicht als Ziel gewählt werden.', fxUntargetable()],
    ['EFL13','Wolkenkämpfer',   6,'super_rare',2100,1600,'[Effekt] Bei Beschwörung: Alle Gegnermonster verlieren 500 ATK.', fxDebuffAllOpp(500,0)],
    ['EFL14','Sturmschwinge',   7,'super_rare',2250,1800,'[Effekt] Bei Beschwörung: Gegner verliert 500 LP.', fxBurnSummon(500)],
    ['EFL15','Himmelskoloss',   7,'super_rare',2300,1800,'[Passiv] Kann nicht als Ziel gewählt werden.', fxUntargetable()],
    ['EFL16','Windgott',        7,'super_rare',2350,1900,'[Effekt] Bei Beschwörung: Alle Gegnermonster verlieren 600 ATK.', fxDebuffAllOpp(600,0)],
    ['EFL17','Sturmgott',       8,'super_rare',2600,2000,'[Effekt] Wenn im Kampf vernichtet: Ziehe 2 Karten.', fxDrawDestroy(2)],
    ['EFL18','Äthergott',       8,'super_rare',2700,2100,'[Passiv] Kann nicht als Ziel gewählt werden.', fxUntargetable()],
    ['EFL19','Himmelsgott',     9,'ultra_rare',2850,2350,'[Effekt] Bei Beschwörung: Alle Gegnermonster verlieren 800 ATK.', fxDebuffAllOpp(800,0)],
    ['EFL20','Ätherkaiser',     9,'ultra_rare',2950,2400,'[Passiv] Kann nicht als Ziel gewählt werden.', fxUntargetable()],

    // ── STEIN (EST01–EST20) ──────────────────────────────────
    ['EST01','Felswächter',     3,'uncommon', 700,1100, '[Effekt] Bei Beschwörung: Erhalte 200 LP.', fxHealSummon(200)],
    ['EST02','Granitgeist',     3,'uncommon', 750,1050, '[Effekt] Wenn im Kampf vernichtet: Erhalte 300 LP.', fxHealDestroy(300)],
    ['EST03','Steinwächter',    4,'uncommon',1000,1300, '[Effekt] Bei Beschwörung: Erhalte 300 LP.', fxHealSummon(300)],
    ['EST04','Erdwächter',      4,'rare',    1050,1350, '[Effekt] Wenn im Kampf vernichtet: Ziehe 1 Karte.', fxDrawDestroy(1)],
    ['EST05','Bergwächter',     4,'uncommon', 950,1400, '[Effekt] Bei Beschwörung: Erhalte 400 LP.', fxHealSummon(400)],
    ['EST06','Kieselhüter',     4,'uncommon', 900,1350, '[Effekt] Wenn im Kampf vernichtet: Erhalte 200 LP.', fxHealDestroy(200)],
    ['EST07','Steinriese',      5,'rare',    1350,1700, '[Effekt] Bei Beschwörung: Erhalte 500 LP.', fxHealSummon(500)],
    ['EST08','Felskoloss',      5,'rare',    1400,1750, '[Effekt] Wenn im Kampf vernichtet: Erhalte 400 LP.', fxHealDestroy(400)],
    ['EST09','Granitriese',     5,'rare',    1300,1800, '[Effekt] Bei Beschwörung: Erhalte 600 LP.', fxHealSummon(600)],
    ['EST10','Bergkoloss',      5,'rare',    1350,1700, '[Effekt] Wenn im Kampf vernichtet: Ziehe 1 Karte.', fxDrawDestroy(1)],
    ['EST11','Steinmagier',     5,'rare',    1200,1800, '[Effekt] Bei Beschwörung: Erhalte 800 LP.', fxHealSummon(800)],
    ['EST12','Erdfürst',        6,'rare',    1600,2100, '[Effekt] Wenn im Kampf vernichtet: Erhalte 600 LP.', fxHealDestroy(600)],
    ['EST13','Steinkoloss',     6,'rare',    1700,2200, '[Effekt] Bei Beschwörung: Erhalte 1000 LP.', fxHealSummon(1000)],
    ['EST14','Felsgigant',      6,'super_rare',1750,2400,'[Effekt] Wenn im Kampf vernichtet: Ziehe 2 Karten.', fxDrawDestroy(2)],
    ['EST15','Granitgott',      7,'super_rare',2000,2800,'[Effekt] Bei Beschwörung: Erhalte 1200 LP.', fxHealSummon(1200)],
    ['EST16','Erdtitan',        7,'super_rare',2100,2900,'[Effekt] Wenn im Kampf vernichtet: Erhalte 800 LP.', fxHealDestroy(800)],
    ['EST17','Steinfürst',      7,'super_rare',2050,3000,'[Effekt] Bei Beschwörung: Erhalte 1500 LP.', fxHealSummon(1500)],
    ['EST18','Bergfürst',       8,'super_rare',2300,3100,'[Effekt] Wenn im Kampf vernichtet: Ziehe 2 Karten.', fxDrawDestroy(2)],
    ['EST19','Steinkaiser',     9,'ultra_rare',2600,3400,'[Effekt] Bei Beschwörung: Erhalte 2000 LP.', fxHealSummon(2000)],
    ['EST20','Erdgott',         9,'ultra_rare',2700,3500,'[Effekt] Wenn im Kampf vernichtet: Erhalte 1000 LP. Ziehe 2 Karten.', fxHealDestroy(1000)],

    // ── PFLANZE (EPF01–EPF20) ─────────────────────────────────
    ['EPF01','Moosheiler',      3,'uncommon', 800, 900, '[Effekt] Bei Beschwörung: Erhalte 200 LP.', fxHealSummon(200)],
    ['EPF02','Dornenheiler',    3,'uncommon', 750, 950, '[Effekt] Bei Beschwörung: Erhalte 300 LP.', fxHealSummon(300)],
    ['EPF03','Waldheiler',      4,'uncommon', 900,1100, '[Effekt] Bei Beschwörung: Erhalte 400 LP.', fxHealSummon(400)],
    ['EPF04','Blütenwächter',   4,'rare',    1000,1100, '[Effekt] Wenn im Kampf vernichtet: Ziehe 1 Karte.', fxDrawDestroy(1)],
    ['EPF05','Rankenwächter',   4,'uncommon', 950,1100, '[Effekt] Bei Beschwörung: Erhalte 500 LP.', fxHealSummon(500)],
    ['EPF06','Moosriese',       4,'uncommon', 850,1200, '[Effekt] Wenn im Kampf vernichtet: Erhalte 200 LP.', fxHealDestroy(200)],
    ['EPF07','Waldgeist',       5,'rare',    1300,1400, '[Effekt] Bei Beschwörung: Erhalte 600 LP.', fxHealSummon(600)],
    ['EPF08','Baumgeist',       5,'rare',    1350,1450, '[Effekt] Bei Beschwörung: Erhalte 800 LP.', fxHealSummon(800)],
    ['EPF09','Dornenwächter',   5,'rare',    1200,1500, '[Effekt] Wenn im Kampf vernichtet: Ziehe 2 Karten.', fxDrawDestroy(2)],
    ['EPF10','Rankendämon',     5,'rare',    1400,1300, '[Effekt] Wenn im Kampf vernichtet: Erhalte 400 LP.', fxHealDestroy(400)],
    ['EPF11','Waldkoloss',      5,'rare',    1400,1500, '[Effekt] Bei Beschwörung: Alle Pflanze-Monster erhalten +200 ATK.', fxBuffRaceSummon(RACE.PFLANZE,200)],
    ['EPF12','Moostitan',       6,'rare',    1600,1800, '[Effekt] Bei Beschwörung: Erhalte 1000 LP.', fxHealSummon(1000)],
    ['EPF13','Waldtitan',       6,'rare',    1700,1900, '[Effekt] Wenn im Kampf vernichtet: Ziehe 2 Karten.', fxDrawDestroy(2)],
    ['EPF14','Blütengott',      6,'super_rare',1750,2000,'[Effekt] Bei Beschwörung: Alle Pflanze-Monster erhalten +300 ATK.', fxBuffRaceSummon(RACE.PFLANZE,300)],
    ['EPF15','Rankengott',      7,'super_rare',2000,2200,'[Effekt] Bei Beschwörung: Erhalte 1500 LP.', fxHealSummon(1500)],
    ['EPF16','Waldgott',        7,'super_rare',2100,2300,'[Effekt] Wenn im Kampf vernichtet: Erhalte 600 LP.', fxHealDestroy(600)],
    ['EPF17','Dornengott',      7,'super_rare',2000,2400,'[Effekt] Bei Beschwörung: Alle Pflanze-Monster erhalten +400 ATK.', fxBuffRaceSummon(RACE.PFLANZE,400)],
    ['EPF18','Blütentitan',     8,'super_rare',2300,2600,'[Effekt] Bei Beschwörung: Erhalte 2000 LP.', fxHealSummon(2000)],
    ['EPF19','Waldkaiser',      9,'ultra_rare',2600,2900,'[Effekt] Bei Beschwörung: Erhalte 2500 LP.', fxHealSummon(2500)],
    ['EPF20','Urwald',          9,'ultra_rare',2700,3000,'[Effekt] Wenn im Kampf vernichtet: Erhalte 1000 LP. Alle Pflanze-Monster erhalten +500 ATK.', fxBuffRaceSummon(RACE.PFLANZE,500)],

    // ── KRIEGER (EKR01–EKR20) ────────────────────────────────
    ['EKR01','Klingenläufer',   3,'uncommon',1050, 800, '[Effekt] Bei Beschwörung: Alle Krieger-Monster erhalten +200 ATK.', fxBuffRaceSummon(RACE.KRIEGER,200)],
    ['EKR02','Schwertgeist',    3,'uncommon',1100, 750, '[Effekt] Wenn im Kampf vernichtet: Ziehe 1 Karte.', fxDrawDestroy(1)],
    ['EKR03','Schildläufer',    4,'uncommon',1250, 950, '[Effekt] Bei Beschwörung: Alle Krieger-Monster erhalten +200 ATK.', fxBuffRaceSummon(RACE.KRIEGER,200)],
    ['EKR04','Axtgeist',        4,'rare',    1350, 950, '[Effekt] Bei Beschwörung: Alle Krieger-Monster erhalten +300 ATK.', fxBuffRaceSummon(RACE.KRIEGER,300)],
    ['EKR05','Lanzengeist',     4,'uncommon',1200,1000, '[Effekt] Wenn im Kampf vernichtet: Erhalte 200 LP.', fxHealDestroy(200)],
    ['EKR06','Schlachtgeist',   4,'uncommon',1300, 900, '[Effekt] Bei Beschwörung: Gegner verliert 200 LP.', fxBurnSummon(200)],
    ['EKR07','Klinge',          5,'rare',    1700,1200, '[Effekt] Bei Beschwörung: Alle Krieger-Monster erhalten +400 ATK.', fxBuffRaceSummon(RACE.KRIEGER,400)],
    ['EKR08','Rüstungsbrecher', 5,'rare',    1750,1150, '[Effekt] Wenn im Kampf vernichtet: Ziehe 2 Karten.', fxDrawDestroy(2)],
    ['EKR09','Doppelklingen',   5,'rare',    1650,1250, '[Passiv] Durchbohrender Angriff.', fxPiercing()],
    ['EKR10','Schwertritter',   5,'rare',    1700,1300, '[Effekt] Bei Beschwörung: Gegner verliert 400 LP.', fxBurnSummon(400)],
    ['EKR11','Schlachtmeister', 6,'rare',    2050,1600, '[Effekt] Bei Beschwörung: Alle Krieger-Monster erhalten +500 ATK.', fxBuffRaceSummon(RACE.KRIEGER,500)],
    ['EKR12','Klingenritter',   6,'rare',    2100,1600, '[Passiv] Durchbohrender Angriff.', fxPiercing()],
    ['EKR13','Kriegsherr',      6,'super_rare',2200,1700,'[Effekt] Bei Beschwörung: Alle Krieger-Monster erhalten +600 ATK.', fxBuffRaceSummon(RACE.KRIEGER,600)],
    ['EKR14','Heldenkämpfer',   7,'super_rare',2400,1900,'[Effekt] Wenn im Kampf vernichtet: Ziehe 2 Karten.', fxDrawDestroy(2)],
    ['EKR15','Schwertmeister',  7,'super_rare',2450,1950,'[Passiv] Durchbohrender Angriff.', fxPiercing()],
    ['EKR16','Klingenkoloss',   7,'super_rare',2400,2000,'[Effekt] Bei Beschwörung: Alle Krieger-Monster erhalten +700 ATK.', fxBuffRaceSummon(RACE.KRIEGER,700)],
    ['EKR17','Kriegstitan',     8,'super_rare',2650,2100,'[Effekt] Bei Beschwörung: Gegner verliert 800 LP.', fxBurnSummon(800)],
    ['EKR18','Klingenfürst',    8,'super_rare',2700,2100,'[Passiv] Durchbohrender Angriff.', fxPiercing()],
    ['EKR19','Schlachtgott',    9,'ultra_rare',2900,2350,'[Effekt] Bei Beschwörung: Alle Krieger-Monster erhalten +800 ATK.', fxBuffRaceSummon(RACE.KRIEGER,800)],
    ['EKR20','Kriegskaiser',    9,'ultra_rare',3000,2400,'[Passiv] Durchbohrender Angriff.', fxPiercing()],

    // ── MAGIER (EMA01–EMA20) ──────────────────────────────────
    ['EMA01','Runenzieher',     3,'uncommon', 850, 600, '[Effekt] Bei Beschwörung: Ziehe 1 Karte.', fxDrawSummon(1)],
    ['EMA02','Arkanzieher',     3,'uncommon', 800, 700, '[Effekt] Bei Beschwörung: Ziehe 1 Karte.', fxDrawSummon(1)],
    ['EMA03','Zauberleser',     4,'uncommon', 950, 800, '[Effekt] Bei Beschwörung: Ziehe 1 Karte.', fxDrawSummon(1)],
    ['EMA04','Kristallseher',   4,'rare',    1000, 850, '[Effekt] Bei Beschwörung: Ziehe 2 Karten.', fxDrawSummon(2)],
    ['EMA05','Wissenswächter',  4,'uncommon', 900, 900, '[Effekt] Wenn im Kampf vernichtet: Ziehe 1 Karte.', fxDrawDestroy(1)],
    ['EMA06','Runenmeister',    4,'uncommon', 950, 800, '[Effekt] Bei Beschwörung: Gegner verliert 300 LP.', fxBurnSummon(300)],
    ['EMA07','Arkanseher',      5,'rare',    1300,1100, '[Effekt] Bei Beschwörung: Ziehe 2 Karten.', fxDrawSummon(2)],
    ['EMA08','Zauberfürst',     5,'rare',    1400,1100, '[Effekt] Wenn im Kampf vernichtet: Ziehe 2 Karten.', fxDrawDestroy(2)],
    ['EMA09','Magiergeist',     5,'rare',    1200,1200, '[Effekt] Bei Beschwörung: Alle Magier-Monster erhalten +200 ATK.', fxBuffRaceSummon(RACE.MAGIER,200)],
    ['EMA10','Wissenssammler',  5,'rare',    1350,1100, '[Effekt] Bei Beschwörung: Ziehe 1 Karte. Gegner verliert 200 LP.', fxDrawSummon(1)],
    ['EMA11','Runenwächter',    5,'rare',    1300,1200, '[Effekt] Bei Beschwörung: Ziehe 2 Karten. Erhalte 200 LP.', fxDrawSummon(2)],
    ['EMA12','Arkanfürst',      6,'rare',    1600,1600, '[Effekt] Bei Beschwörung: Ziehe 2 Karten.', fxDrawSummon(2)],
    ['EMA13','Zaubertitan',     6,'rare',    1700,1600, '[Effekt] Wenn im Kampf vernichtet: Ziehe 3 Karten.', fxDrawDestroy(3)],
    ['EMA14','Magierkoloss',    6,'super_rare',1800,1700,'[Effekt] Bei Beschwörung: Alle Magier-Monster erhalten +300 ATK.', fxBuffRaceSummon(RACE.MAGIER,300)],
    ['EMA15','Arkantitan',      7,'super_rare',2000,1900,'[Effekt] Bei Beschwörung: Ziehe 3 Karten.', fxDrawSummon(3)],
    ['EMA16','Runenkönig',      7,'super_rare',2100,2000,'[Passiv] Kann nicht als Ziel gewählt werden.', fxUntargetable()],
    ['EMA17','Wissensgott',     7,'super_rare',2000,2000,'[Effekt] Wenn im Kampf vernichtet: Ziehe 3 Karten.', fxDrawDestroy(3)],
    ['EMA18','Arkankaiser',     8,'super_rare',2300,2100,'[Effekt] Bei Beschwörung: Ziehe 3 Karten. Gegner verliert 500 LP.', fxDrawSummon(3)],
    ['EMA19','Magiergott',      9,'ultra_rare',2500,2300,'[Effekt] Bei Beschwörung: Ziehe 3 Karten. Alle Magier-Monster erhalten +500 ATK.', fxBuffRaceSummon(RACE.MAGIER,500)],
    ['EMA20','Arkankaiser II',  9,'ultra_rare',2700,2500,'[Passiv] Kann nicht als Ziel gewählt werden.', fxUntargetable()],

    // ── ELFE (EEL01–EEL20) ───────────────────────────────────
    ['EEL01','Mondtänzerin',    3,'uncommon', 700, 900, '[Effekt] Bei Beschwörung: Alle Gegnermonster verlieren 200 ATK.', fxDebuffAllOpp(200,0)],
    ['EEL02','Sternentänzerin', 3,'uncommon', 650,1000, '[Effekt] Bei Beschwörung: Alle Gegnermonster verlieren 200 DEF.', fxDebuffAllOpp(0,200)],
    ['EEL03','Lichtelfin',      4,'uncommon', 850,1000, '[Effekt] Bei Beschwörung: Alle Gegnermonster verlieren 300 ATK.', fxDebuffAllOpp(300,0)],
    ['EEL04','Waldelfin',       4,'rare',     900, 950, '[Effekt] Bei Beschwörung: Alle Gegnermonster verlieren 200 ATK und 200 DEF.', fxDebuffAllOpp(200,200)],
    ['EEL05','Mondelfe',        4,'uncommon', 800,1100, '[Effekt] Wenn im Kampf vernichtet: Ziehe 1 Karte.', fxDrawDestroy(1)],
    ['EEL06','Sternenelfin',    4,'uncommon', 750,1000, '[Effekt] Bei Beschwörung: Erhalte 200 LP.', fxHealSummon(200)],
    ['EEL07','Elfentänzerin',   5,'rare',    1150,1300, '[Effekt] Bei Beschwörung: Alle Gegnermonster verlieren 400 ATK.', fxDebuffAllOpp(400,0)],
    ['EEL08','Mondkämpferin',   5,'rare',    1200,1350, '[Effekt] Bei Beschwörung: Alle Gegnermonster verlieren 300 ATK und 300 DEF.', fxDebuffAllOpp(300,300)],
    ['EEL09','Lichtelfe',       5,'rare',    1100,1400, '[Passiv] Kann nicht als Ziel gewählt werden.', fxUntargetable()],
    ['EEL10','Elfenmagierin',   5,'rare',    1050,1350, '[Effekt] Bei Beschwörung: Ziehe 1 Karte.', fxDrawSummon(1)],
    ['EEL11','Sternenfürstin',  5,'rare',    1150,1250, '[Effekt] Wenn im Kampf vernichtet: Gegner verliert 300 LP.', fxBurnDestroy(300)],
    ['EEL12','Mondfürstin',     6,'rare',    1400,1700, '[Effekt] Bei Beschwörung: Alle Gegnermonster verlieren 500 ATK.', fxDebuffAllOpp(500,0)],
    ['EEL13','Elfenfürstin',    6,'rare',    1500,1700, '[Effekt] Bei Beschwörung: Alle Gegnermonster verlieren 400 ATK und 400 DEF.', fxDebuffAllOpp(400,400)],
    ['EEL14','Sternenkönigin',  6,'super_rare',1600,1900,'[Passiv] Kann nicht als Ziel gewählt werden.', fxUntargetable()],
    ['EEL15','Mondkönigin',     7,'super_rare',1800,2200,'[Effekt] Bei Beschwörung: Alle Gegnermonster verlieren 600 ATK.', fxDebuffAllOpp(600,0)],
    ['EEL16','Lichtkönigin',    7,'super_rare',1900,2300,'[Effekt] Bei Beschwörung: Alle Gegnermonster verlieren 500 ATK und 500 DEF.', fxDebuffAllOpp(500,500)],
    ['EEL17','Elfengöttin',     7,'super_rare',1900,2400,'[Passiv] Kann nicht als Ziel gewählt werden.', fxUntargetable()],
    ['EEL18','Mondgöttin',      8,'super_rare',2100,2700,'[Effekt] Bei Beschwörung: Alle Gegnermonster verlieren 700 ATK.', fxDebuffAllOpp(700,0)],
    ['EEL19','Sternenkaiser',   9,'ultra_rare',2400,3000,'[Effekt] Bei Beschwörung: Alle Gegnermonster verlieren 800 ATK und 800 DEF.', fxDebuffAllOpp(800,800)],
    ['EEL20','Elfenkaiser',     9,'ultra_rare',2600,3200,'[Passiv] Kann nicht als Ziel gewählt werden.', fxUntargetable()],

    // ── DÄMON (EDA01–EDA20) ───────────────────────────────────
    ['EDA01','Schattenpakt',    3,'uncommon',1200, 600, '[Effekt] Bei Beschwörung: Du verlierst 200 LP. Gegner verliert 500 LP.', fxBurnSummon(500)],
    ['EDA02','Höllenvertrag',   3,'uncommon',1100, 700, '[Effekt] Wenn im Kampf vernichtet: Gegner verliert 300 LP.', fxBurnDestroy(300)],
    ['EDA03','Dunkelpakt',      4,'uncommon',1400, 800, '[Effekt] Bei Beschwörung: Gegner verliert 400 LP.', fxBurnSummon(400)],
    ['EDA04','Seelenreaper',    4,'rare',    1500, 800, '[Effekt] Wenn im Kampf vernichtet: Gegner verliert 500 LP.', fxBurnDestroy(500)],
    ['EDA05','Dunkelgeist',     4,'uncommon',1300, 900, '[Passiv] Kann den Gegner direkt angreifen.', fxCanDirectAttack()],
    ['EDA06','Schattenreaper',  4,'uncommon',1350, 850, '[Passiv] Durchbohrender Angriff.', fxPiercing()],
    ['EDA07','Höllenpakt',      5,'rare',    1800,1100, '[Effekt] Bei Beschwörung: Gegner verliert 600 LP.', fxBurnSummon(600)],
    ['EDA08','Düsterfürst',     5,'rare',    1750,1200, '[Passiv] Durchbohrender Angriff.', fxPiercing()],
    ['EDA09','Seelendieb',      5,'rare',    1700,1150, '[Effekt] Wenn im Kampf vernichtet: Gegner verliert 600 LP.', fxBurnDestroy(600)],
    ['EDA10','Dunkelfürst',     5,'rare',    1800,1100, '[Effekt] Bei Beschwörung: Alle Dämon-Monster erhalten +300 ATK.', fxBuffRaceSummon(RACE.DAEMON,300)],
    ['EDA11','Abgrundläufer',   6,'rare',    2100,1500, '[Effekt] Bei Beschwörung: Gegner verliert 800 LP.', fxBurnSummon(800)],
    ['EDA12','Höllenritter',    6,'rare',    2050,1600, '[Passiv] Durchbohrender Angriff.', fxPiercing()],
    ['EDA13','Seelenfresser',   6,'super_rare',2200,1600,'[Effekt] Wenn im Kampf vernichtet: Gegner verliert 800 LP.', fxBurnDestroy(800)],
    ['EDA14','Schattenkönig',   7,'super_rare',2450,1900,'[Effekt] Bei Beschwörung: Gegner verliert 1000 LP.', fxBurnSummon(1000)],
    ['EDA15','Höllenkönig',     7,'super_rare',2500,1900,'[Passiv] Durchbohrender Angriff.', fxPiercing()],
    ['EDA16','Abgrundfürst',    7,'super_rare',2400,2000,'[Effekt] Bei Beschwörung: Alle Dämon-Monster erhalten +500 ATK.', fxBuffRaceSummon(RACE.DAEMON,500)],
    ['EDA17','Dunkeltitan',     8,'super_rare',2700,2100,'[Effekt] Wenn im Kampf vernichtet: Gegner verliert 1000 LP.', fxBurnDestroy(1000)],
    ['EDA18','Schattenkaiser',  8,'super_rare',2750,2100,'[Passiv] Durchbohrender Angriff.', fxPiercing()],
    ['EDA19','Höllenkaiser',    9,'ultra_rare',3050,2450,'[Effekt] Bei Beschwörung: Gegner verliert 1500 LP. Alle Dämon-Monster erhalten +600 ATK.', fxBuffRaceSummon(RACE.DAEMON,600)],
    ['EDA20','Chaosgott',       9,'ultra_rare',3150,2500,'[Passiv] Durchbohrender Angriff.', fxPiercing()],

    // ── WASSER (EWA01–EWA20) ──────────────────────────────────
    ['EWA01','Wellentänzerin',  3,'uncommon',1000, 800, '[Effekt] Bei Beschwörung: Spiele das stärkste Gegnermonster auf die Hand zurück.', fxBounceOppSummon()],
    ['EWA02','Tiefseejäger',    3,'uncommon', 950, 800, '[Effekt] Wenn im Kampf vernichtet: Ziehe 1 Karte.', fxDrawDestroy(1)],
    ['EWA03','Nebelwächter',    4,'uncommon',1150, 900, '[Effekt] Bei Beschwörung: Gegner verliert 200 LP.', fxBurnSummon(200)],
    ['EWA04','Eiswächter',      4,'rare',    1200, 950, '[Effekt] Bei Beschwörung: Spiele das stärkste Gegnermonster auf die Hand zurück.', fxBounceOppSummon()],
    ['EWA05','Strudelhüter',    4,'uncommon',1100,1000, '[Effekt] Wenn im Kampf vernichtet: Erhalte 200 LP.', fxHealDestroy(200)],
    ['EWA06','Korallenfürst',   4,'uncommon',1100, 950, '[Effekt] Bei Beschwörung: Erhalte 300 LP.', fxHealSummon(300)],
    ['EWA07','Meerestänzer',    5,'rare',    1500,1200, '[Effekt] Bei Beschwörung: Spiele das stärkste Gegnermonster auf die Hand zurück.', fxBounceOppSummon()],
    ['EWA08','Eisdrache',       5,'rare',    1600,1200, '[Effekt] Wenn im Kampf vernichtet: Ziehe 2 Karten.', fxDrawDestroy(2)],
    ['EWA09','Tiefseefürst',    5,'rare',    1550,1250, '[Effekt] Bei Beschwörung: Gegner verliert 400 LP.', fxBurnSummon(400)],
    ['EWA10','Wellenfürst',     5,'rare',    1500,1300, '[Effekt] Wenn im Kampf vernichtet: Erhalte 400 LP.', fxHealDestroy(400)],
    ['EWA11','Sturmflut',       6,'rare',    1900,1600, '[Effekt] Bei Beschwörung: Spiele das stärkste Gegnermonster auf die Hand zurück.', fxBounceOppSummon()],
    ['EWA12','Meerestitan',     6,'rare',    1950,1600, '[Effekt] Wenn im Kampf vernichtet: Ziehe 2 Karten. Erhalte 200 LP.', fxDrawDestroy(2)],
    ['EWA13','Tiefseewächter',  6,'super_rare',2000,1700,'[Passiv] Kann nicht als Ziel gewählt werden.', fxUntargetable()],
    ['EWA14','Wellengott',      7,'super_rare',2250,1950,'[Effekt] Bei Beschwörung: Spiele das stärkste Gegnermonster auf die Hand zurück.', fxBounceOppSummon()],
    ['EWA15','Meereskaiser',    7,'super_rare',2300,2000,'[Effekt] Bei Beschwörung: Ziehe 2 Karten.', fxDrawSummon(2)],
    ['EWA16','Tiefseegott',     7,'super_rare',2350,2000,'[Passiv] Kann nicht als Ziel gewählt werden.', fxUntargetable()],
    ['EWA17','Eiskaiser',       8,'super_rare',2600,2100,'[Effekt] Bei Beschwörung: Spiele das stärkste Gegnermonster auf die Hand zurück.', fxBounceOppSummon()],
    ['EWA18','Ozeanfürst',      8,'super_rare',2650,2200,'[Effekt] Wenn im Kampf vernichtet: Ziehe 2 Karten.', fxDrawDestroy(2)],
    ['EWA19','Tiefseekönig',    9,'ultra_rare',2900,2500,'[Effekt] Bei Beschwörung: Spiele alle Gegnermonster auf die Hand zurück. Gegner verliert 500 LP.', fxBounceOppSummon()],
    ['EWA20','Ozeankaiser',     9,'ultra_rare',3000,2600,'[Passiv] Kann nicht als Ziel gewählt werden.', fxUntargetable()],
  ];

  const EFFECT_ATTR: Record<string, string> = {
    EFE:'fire', EDR:'wind', EFL:'wind', EST:'earth', EPF:'earth',
    EKR:'light', EMA:'dark', EEL:'light', EDA:'dark', EWA:'water',
  };
  const EFFECT_RACE: Record<string, string> = {
    EFE:RACE.FEUER, EDR:RACE.DRACHE, EFL:RACE.FLUG, EST:RACE.STEIN, EPF:RACE.PFLANZE,
    EKR:RACE.KRIEGER, EMA:RACE.MAGIER, EEL:RACE.ELFE, EDA:RACE.DAEMON, EWA:RACE.WASSER,
  };

  EFFECT_ENTRIES.forEach(([id,name,level,rarity,atk,def,desc,effect])=>{
    const pfx=id.slice(0,3);
    _addCard(id, {
      id, name, type:TYPE.EFFECT,
      attribute:EFFECT_ATTR[pfx],
      race:EFFECT_RACE[pfx],
      rarity,
      level, atk, def, description:desc, effect,
    });
  });

  // ── 20 neue Fusionsmonster ─────────────────────────────────
  const FUSION_NEW: [string, string, number, RarityLevel, string, string, number, number, string, CardEffect][] = [
    // Feuer
    ['FFE1','Feuerkoloss',      7,'super_rare',ATTR.FIRE,  RACE.FEUER,   2400,1900, '[Fusion] Bei Beschwörung: Alle Feuer-Monster erhalten +400 ATK. Gegner verliert 800 LP.', fxBuffRaceSummon(RACE.FEUER,400)],
    ['FFE2','Infernodrakon',    8,'ultra_rare',ATTR.FIRE,  RACE.FEUER,   2800,2200, '[Fusion] Bei Beschwörung: Gegner verliert 2000 LP.', fxBurnSummon(2000)],
    // Drache
    ['FDR1','Finsterdrache',    7,'super_rare',ATTR.DARK,  RACE.DRACHE,  2500,2000, '[Fusion] Durchbohrender Angriff. Kann nicht als Ziel gewählt werden.', fxPiercing()],
    ['FDR2','Urnachtdrache',    8,'ultra_rare',ATTR.DARK,  RACE.DRACHE,  2900,2300, '[Fusion] Alle Drachen-Monster erhalten +500 ATK.', fxBuffRaceSummon(RACE.DRACHE,500)],
    // Flug
    ['FFL1','Äthersturm',       6,'super_rare',ATTR.WIND,  RACE.FLUG,    2100,1800, '[Fusion] Kann nicht als Ziel gewählt werden. Alle Gegnermonster verlieren 400 ATK.', fxDebuffAllOpp(400,0)],
    ['FFL2','Himmelsherrscher', 8,'ultra_rare',ATTR.WIND,  RACE.FLUG,    2700,2100, '[Fusion] Alle Gegnermonster verlieren 800 ATK.', fxDebuffAllOpp(800,0)],
    // Stein
    ['FST1','Urgestein',        7,'super_rare',ATTR.EARTH, RACE.STEIN,   1900,3100, '[Fusion] Bei Beschwörung: Erhalte 1500 LP.', fxHealSummon(1500)],
    ['FST2','Erdgötze',         8,'ultra_rare',ATTR.EARTH, RACE.STEIN,   2200,3400, '[Fusion] Bei Beschwörung: Erhalte 3000 LP.', fxHealSummon(3000)],
    // Pflanze
    ['FPF1','Waldentität',      6,'super_rare',ATTR.EARTH, RACE.PFLANZE, 2000,2200, '[Fusion] Bei Beschwörung: Erhalte 1500 LP. Alle Pflanze-Monster erhalten +300 ATK.', fxBuffRaceSummon(RACE.PFLANZE,300)],
    ['FPF2','Urwald',           7,'ultra_rare',ATTR.EARTH, RACE.PFLANZE, 2200,2500, '[Fusion] Bei Beschwörung: Erhalte 2500 LP.', fxHealSummon(2500)],
    // Krieger
    ['FKR1','Schlachtgott',     7,'super_rare',ATTR.LIGHT, RACE.KRIEGER, 2500,2100, '[Fusion] Alle Krieger-Monster erhalten +600 ATK. Durchbohrender Angriff.', fxPiercing()],
    ['FKR2','Kriegslegende',    8,'ultra_rare',ATTR.LIGHT, RACE.KRIEGER, 2900,2300, '[Fusion] Bei Beschwörung: Alle Krieger-Monster erhalten +800 ATK.', fxBuffRaceSummon(RACE.KRIEGER,800)],
    // Magier
    ['FMA1','Runenkoloss',      7,'super_rare',ATTR.DARK,  RACE.MAGIER,  2300,2000, '[Fusion] Bei Beschwörung: Ziehe 3 Karten.', fxDrawSummon(3)],
    ['FMA2','Arkangott',        8,'ultra_rare',ATTR.DARK,  RACE.MAGIER,  2700,2200, '[Fusion] Kann nicht als Ziel gewählt werden. Bei Beschwörung: Ziehe 3 Karten.', fxDrawSummon(3)],
    // Elfe
    ['FEL1','Mondkönigin',      6,'super_rare',ATTR.LIGHT, RACE.ELFE,    2000,2300, '[Fusion] Alle Gegnermonster verlieren 600 ATK und 600 DEF.', fxDebuffAllOpp(600,600)],
    ['FEL2','Sternengöttin',    7,'ultra_rare',ATTR.LIGHT, RACE.ELFE,    2400,2600, '[Fusion] Kann nicht als Ziel gewählt werden. Alle Gegnermonster verlieren 800 ATK.', fxDebuffAllOpp(800,0)],
    // Dämon
    ['FDA1','Abgrundtitan',     7,'super_rare',ATTR.DARK,  RACE.DAEMON,  2700,2200, '[Fusion] Durchbohrender Angriff. Bei Beschwörung: Gegner verliert 1000 LP.', fxBurnSummon(1000)],
    ['FDA2','Chaosgötze',       9,'ultra_rare',ATTR.DARK,  RACE.DAEMON,  3100,2600, '[Fusion] Durchbohrender Angriff. Alle Dämon-Monster erhalten +800 ATK.', fxBuffRaceSummon(RACE.DAEMON,800)],
    // Wasser
    ['FWA1','Tsunamigott',      7,'super_rare',ATTR.WATER, RACE.WASSER,  2400,2100, '[Fusion] Bei Beschwörung: Stärkstes Gegnermonster auf die Hand. Gegner verliert 500 LP.', fxBounceOppSummon()],
    ['FWA2','Ozeankaiser',      8,'ultra_rare',ATTR.WATER, RACE.WASSER,  2800,2400, '[Fusion] Kann nicht als Ziel gewählt werden. Bei Beschwörung: Stärkstes Gegnermonster zurück auf die Hand.', fxBounceOppSummon()],
  ];

  FUSION_NEW.forEach(([id,name,level,rarity,attr,race,atk,def,desc,effect])=>{
    _addCard(id, {
      id, name, type:TYPE.FUSION,
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
  const SPELL_ENTRIES: [string, string, string, RarityLevel, string, CardEffect][] = [
    // Feuer
    ['ZFE1','Flammenangriff',  RACE.FEUER,   'common',     'Füge dem Gegner 600 Schadenspunkte zu.',                             {apply(gs,o){gs.dealDamage(o==='player'?'opponent':'player',600);}}],
    ['ZFE2','Lavastrom',       RACE.FEUER,   'uncommon',   'Füge dem Gegner 1000 Schadenspunkte zu.',                            {apply(gs,o){gs.dealDamage(o==='player'?'opponent':'player',1000);}}],
    ['ZFE3','Glutwand',        RACE.FEUER,   'common',     'Alle deine Feuer-Monster erhalten bis zum Ende des Zuges +500 ATK.',  {apply(gs,o){gs.getState()[o].field.monsters.forEach(fm=>{if(fm&&fm.card.race===RACE.FEUER)fm.tempATKBonus=(fm.tempATKBonus||0)+500;});}}],
    ['ZFE4','Ascheregen',      RACE.FEUER,   'uncommon',   'Füge dem Gegner 500 Schaden zu und erhalte 500 LP.',                 {apply(gs,o){gs.dealDamage(o==='player'?'opponent':'player',500);gs.gainLP(o,500);}}],
    ['ZFE5','Inferno',         RACE.FEUER,   'rare',       'Füge dem Gegner 1500 Schadenspunkte zu.',                            {apply(gs,o){gs.dealDamage(o==='player'?'opponent':'player',1500);}}],
    ['ZFE6','Pyroexplosion',   RACE.FEUER,   'rare',       'Füge dem Gegner 2000 Schadenspunkte zu.',                            {apply(gs,o){gs.dealDamage(o==='player'?'opponent':'player',2000);}}],
    ['ZFE7','Vulkansturm',     RACE.FEUER,   'super_rare', 'Füge dem Gegner 2500 Schadenspunkte zu.',                            {apply(gs,o){gs.dealDamage(o==='player'?'opponent':'player',2500);}}],
    // Drache
    ['ZDR1','Drachenklaue',    RACE.DRACHE,  'common',     'Alle deine Drachen erhalten +600 ATK bis Rundenende.',               {apply(gs,o){gs.getState()[o].field.monsters.forEach(fm=>{if(fm&&fm.card.race===RACE.DRACHE)fm.tempATKBonus=(fm.tempATKBonus||0)+600;});}}],
    ['ZDR2','Drachenschuppe',  RACE.DRACHE,  'uncommon',   'Alle deine Drachen können nicht als Ziel gewählt werden.',           {apply(gs,o){gs.getState()[o].field.monsters.forEach(fm=>{if(fm&&fm.card.race===RACE.DRACHE)(fm as unknown as {card: {effect: unknown}}).card=Object.assign({},fm.card,{effect:{trigger:'passive',cannotBeTargeted:true}});});}}],
    ['ZDR3','Urnacht',         RACE.DRACHE,  'common',     'Ziehe 2 Karten.',                                                   {apply(gs,o){gs.drawCard(o,2);}}],
    ['ZDR4','Drachenangriff',  RACE.DRACHE,  'uncommon',   'Alle deine Drachen erhalten +1000 ATK bis Rundenende.',              {apply(gs,o){gs.getState()[o].field.monsters.forEach(fm=>{if(fm&&fm.card.race===RACE.DRACHE)fm.tempATKBonus=(fm.tempATKBonus||0)+1000;});}}],
    ['ZDR5','Wyrmbeschwörung', RACE.DRACHE,  'rare',       'Füge dem Gegner 800 Schaden zu. Ziehe 1 Karte.',                    {apply(gs,o){gs.dealDamage(o==='player'?'opponent':'player',800);gs.drawCard(o,1);}}],
    ['ZDR6','Schuppenpanzer',  RACE.DRACHE,  'rare',       'Alle deine Drachen erhalten +1500 ATK bis Rundenende.',              {apply(gs,o){gs.getState()[o].field.monsters.forEach(fm=>{if(fm&&fm.card.race===RACE.DRACHE)fm.tempATKBonus=(fm.tempATKBonus||0)+1500;});}}],
    ['ZDR7','Drachensturm',    RACE.DRACHE,  'super_rare', 'Alle Gegnermonster verlieren 1000 ATK. Füge dem Gegner 500 Schaden zu.',{apply(gs,o){const op=o==='player'?'opponent':'player';gs.getState()[op].field.monsters.forEach(fm=>{if(fm)fm.permATKBonus=(fm.permATKBonus||0)-1000;});gs.dealDamage(op,500);}}],
    // Flug
    ['ZFL1','Windstoß',        RACE.FLUG,    'common',     'Alle Gegnermonster verlieren 300 ATK bis Rundenende.',               {apply(gs,o){const op=o==='player'?'opponent':'player';gs.getState()[op].field.monsters.forEach(fm=>{if(fm)fm.tempATKBonus=(fm.tempATKBonus||0)-300;});}}],
    ['ZFL2','Sturmschrei',     RACE.FLUG,    'uncommon',   'Alle Gegnermonster verlieren 500 ATK bis Rundenende.',               {apply(gs,o){const op=o==='player'?'opponent':'player';gs.getState()[op].field.monsters.forEach(fm=>{if(fm)fm.tempATKBonus=(fm.tempATKBonus||0)-500;});}}],
    ['ZFL3','Federleicht',     RACE.FLUG,    'common',     'Ziehe 1 Karte. Erhalte 300 LP.',                                    {apply(gs,o){gs.drawCard(o,1);gs.gainLP(o,300);}}],
    ['ZFL4','Windbarriere',    RACE.FLUG,    'uncommon',   'Alle deine Flug-Monster erhalten +500 ATK bis Rundenende.',          {apply(gs,o){gs.getState()[o].field.monsters.forEach(fm=>{if(fm&&fm.card.race===RACE.FLUG)fm.tempATKBonus=(fm.tempATKBonus||0)+500;});}}],
    ['ZFL5','Sturmschwinge',   RACE.FLUG,    'rare',       'Alle Gegnermonster verlieren 800 ATK bis Rundenende.',               {apply(gs,o){const op=o==='player'?'opponent':'player';gs.getState()[op].field.monsters.forEach(fm=>{if(fm)fm.tempATKBonus=(fm.tempATKBonus||0)-800;});}}],
    ['ZFL6','Himmelsfall',     RACE.FLUG,    'rare',       'Füge dem Gegner 1200 Schaden zu. Alle Gegnermonster verlieren 400 ATK.',{apply(gs,o){const op=o==='player'?'opponent':'player';gs.dealDamage(op,1200);gs.getState()[op].field.monsters.forEach(fm=>{if(fm)fm.tempATKBonus=(fm.tempATKBonus||0)-400;});}}],
    ['ZFL7','Ätherstrom',      RACE.FLUG,    'super_rare', 'Alle Gegnermonster verlieren 1200 ATK bis Rundenende.',              {apply(gs,o){const op=o==='player'?'opponent':'player';gs.getState()[op].field.monsters.forEach(fm=>{if(fm)fm.tempATKBonus=(fm.tempATKBonus||0)-1200;});}}],
    // Stein
    ['ZST1','Erdwall',         RACE.STEIN,   'common',     'Erhalte 800 Lebenspunkte.',                                         {apply(gs,o){gs.gainLP(o,800);}}],
    ['ZST2','Steinschild',     RACE.STEIN,   'common',     'Erhalte 1200 Lebenspunkte.',                                        {apply(gs,o){gs.gainLP(o,1200);}}],
    ['ZST3','Granitpanzer',    RACE.STEIN,   'uncommon',   'Alle deine Stein-Monster erhalten +600 ATK bis Rundenende.',        {apply(gs,o){gs.getState()[o].field.monsters.forEach(fm=>{if(fm&&fm.card.race===RACE.STEIN)fm.tempATKBonus=(fm.tempATKBonus||0)+600;});}}],
    ['ZST4','Felsenheilung',   RACE.STEIN,   'uncommon',   'Erhalte 2000 Lebenspunkte.',                                        {apply(gs,o){gs.gainLP(o,2000);}}],
    ['ZST5','Erderschütterung',RACE.STEIN,   'rare',       'Alle Gegnermonster verlieren 600 ATK dauerhaft.',                   {apply(gs,o){const op=o==='player'?'opponent':'player';gs.getState()[op].field.monsters.forEach(fm=>{if(fm)fm.permATKBonus=(fm.permATKBonus||0)-600;});}}],
    ['ZST6','Steinwelle',      RACE.STEIN,   'rare',       'Erhalte 3000 LP. Füge dem Gegner 500 Schaden zu.',                  {apply(gs,o){gs.gainLP(o,3000);gs.dealDamage(o==='player'?'opponent':'player',500);}}],
    ['ZST7','Urstein',         RACE.STEIN,   'super_rare', 'Erhalte 4000 Lebenspunkte.',                                        {apply(gs,o){gs.gainLP(o,4000);}}],
    // Pflanze
    ['ZPF1','Heilranke',       RACE.PFLANZE, 'common',     'Erhalte 800 Lebenspunkte.',                                         {apply(gs,o){gs.gainLP(o,800);}}],
    ['ZPF2','Blütenregen',     RACE.PFLANZE, 'common',     'Erhalte 1200 Lebenspunkte. Ziehe 1 Karte.',                         {apply(gs,o){gs.gainLP(o,1200);gs.drawCard(o,1);}}],
    ['ZPF3','Waldmagie',       RACE.PFLANZE, 'uncommon',   'Alle deine Pflanze-Monster erhalten +400 ATK bis Rundenende.',      {apply(gs,o){gs.getState()[o].field.monsters.forEach(fm=>{if(fm&&fm.card.race===RACE.PFLANZE)fm.tempATKBonus=(fm.tempATKBonus||0)+400;});}}],
    ['ZPF4','Wurzelnetz',      RACE.PFLANZE, 'uncommon',   'Erhalte 2000 LP und ziehe 1 Karte.',                                {apply(gs,o){gs.gainLP(o,2000);gs.drawCard(o,1);}}],
    ['ZPF5','Dornenschutz',    RACE.PFLANZE, 'rare',       'Erhalte 2500 LP.',                                                  {apply(gs,o){gs.gainLP(o,2500);}}],
    ['ZPF6','Natur rebellen',  RACE.PFLANZE, 'rare',       'Alle deine Pflanze-Monster erhalten +700 ATK. Erhalte 500 LP.',     {apply(gs,o){gs.getState()[o].field.monsters.forEach(fm=>{if(fm&&fm.card.race===RACE.PFLANZE)fm.tempATKBonus=(fm.tempATKBonus||0)+700;});gs.gainLP(o,500);}}],
    ['ZPF7','Urwaldmagie',     RACE.PFLANZE, 'super_rare', 'Erhalte 4000 LP. Ziehe 2 Karten.',                                  {apply(gs,o){gs.gainLP(o,4000);gs.drawCard(o,2);}}],
    // Krieger
    ['ZKR1','Schlachtruf',     RACE.KRIEGER, 'common',     'Alle deine Krieger-Monster erhalten bis Rundenende +500 ATK.',      {apply(gs,o){gs.getState()[o].field.monsters.forEach(fm=>{if(fm&&fm.card.race===RACE.KRIEGER)fm.tempATKBonus=(fm.tempATKBonus||0)+500;});}}],
    ['ZKR2','Klingenmeister',  RACE.KRIEGER, 'common',     'Wähle ein Monster auf deinem Feld. Es erhält +800 ATK bis Rundenende.', {apply(gs,o){const m=gs.getState()[o].field.monsters.find(fm=>fm);if(m)m.tempATKBonus=(m.tempATKBonus||0)+800;}}],
    ['ZKR3','Kriegertaktik',   RACE.KRIEGER, 'uncommon',   'Ziehe 2 Karten.',                                                   {apply(gs,o){gs.drawCard(o,2);}}],
    ['ZKR4','Schlachthymne',   RACE.KRIEGER, 'uncommon',   'Alle deine Krieger erhalten +800 ATK bis Rundenende.',              {apply(gs,o){gs.getState()[o].field.monsters.forEach(fm=>{if(fm&&fm.card.race===RACE.KRIEGER)fm.tempATKBonus=(fm.tempATKBonus||0)+800;});}}],
    ['ZKR5','Klingenregen',    RACE.KRIEGER, 'rare',       'Füge dem Gegner 800 Schaden zu. Alle Krieger +500 ATK.',            {apply(gs,o){gs.dealDamage(o==='player'?'opponent':'player',800);gs.getState()[o].field.monsters.forEach(fm=>{if(fm&&fm.card.race===RACE.KRIEGER)fm.tempATKBonus=(fm.tempATKBonus||0)+500;});}}],
    ['ZKR6','Schlachtrausch',  RACE.KRIEGER, 'rare',       'Alle deine Krieger erhalten +1200 ATK bis Rundenende.',             {apply(gs,o){gs.getState()[o].field.monsters.forEach(fm=>{if(fm&&fm.card.race===RACE.KRIEGER)fm.tempATKBonus=(fm.tempATKBonus||0)+1200;});}}],
    ['ZKR7','Kriegsende',      RACE.KRIEGER, 'super_rare', 'Füge dem Gegner 1500 Schaden zu. Alle Krieger +1000 ATK.',          {apply(gs,o){gs.dealDamage(o==='player'?'opponent':'player',1500);gs.getState()[o].field.monsters.forEach(fm=>{if(fm&&fm.card.race===RACE.KRIEGER)fm.tempATKBonus=(fm.tempATKBonus||0)+1000;});}}],
    // Magier
    ['ZMA1','Runenziehen',     RACE.MAGIER,  'common',     'Ziehe 2 Karten.',                                                   {apply(gs,o){gs.drawCard(o,2);}}],
    ['ZMA2','Arkanzauber',     RACE.MAGIER,  'common',     'Füge dem Gegner 500 Schaden zu. Ziehe 1 Karte.',                    {apply(gs,o){gs.dealDamage(o==='player'?'opponent':'player',500);gs.drawCard(o,1);}}],
    ['ZMA3','Wissensquell',    RACE.MAGIER,  'uncommon',   'Ziehe 3 Karten.',                                                   {apply(gs,o){gs.drawCard(o,3);}}],
    ['ZMA4','Magiersegen',     RACE.MAGIER,  'uncommon',   'Alle deine Magier-Monster erhalten +500 ATK bis Rundenende.',       {apply(gs,o){gs.getState()[o].field.monsters.forEach(fm=>{if(fm&&fm.card.race===RACE.MAGIER)fm.tempATKBonus=(fm.tempATKBonus||0)+500;});}}],
    ['ZMA5','Wissensexplosion',RACE.MAGIER,  'rare',       'Ziehe 3 Karten. Füge dem Gegner 300 Schaden zu.',                   {apply(gs,o){gs.drawCard(o,3);gs.dealDamage(o==='player'?'opponent':'player',300);}}],
    ['ZMA6','Arkanblitz',      RACE.MAGIER,  'rare',       'Füge dem Gegner 1500 Schaden zu. Ziehe 1 Karte.',                   {apply(gs,o){gs.dealDamage(o==='player'?'opponent':'player',1500);gs.drawCard(o,1);}}],
    ['ZMA7','Omniszauber',     RACE.MAGIER,  'super_rare', 'Ziehe 4 Karten. Füge dem Gegner 500 Schaden zu.',                   {apply(gs,o){gs.drawCard(o,4);gs.dealDamage(o==='player'?'opponent':'player',500);}}],
    // Elfe
    ['ZEL1','Mondsegen',       RACE.ELFE,    'common',     'Erhalte 600 LP. Alle Gegnermonster verlieren 200 ATK bis Rundenende.',{apply(gs,o){gs.gainLP(o,600);const op=o==='player'?'opponent':'player';gs.getState()[op].field.monsters.forEach(fm=>{if(fm)fm.tempATKBonus=(fm.tempATKBonus||0)-200;});}}],
    ['ZEL2','Sternenstaub',    RACE.ELFE,    'common',     'Alle Gegnermonster verlieren 400 ATK bis Rundenende.',              {apply(gs,o){const op=o==='player'?'opponent':'player';gs.getState()[op].field.monsters.forEach(fm=>{if(fm)fm.tempATKBonus=(fm.tempATKBonus||0)-400;});}}],
    ['ZEL3','Lichthauch',      RACE.ELFE,    'uncommon',   'Alle Gegnermonster verlieren dauerhaft 300 ATK.',                   {apply(gs,o){const op=o==='player'?'opponent':'player';gs.getState()[op].field.monsters.forEach(fm=>{if(fm)fm.permATKBonus=(fm.permATKBonus||0)-300;});}}],
    ['ZEL4','Elfensegen',      RACE.ELFE,    'uncommon',   'Erhalte 1500 LP. Ziehe 1 Karte.',                                   {apply(gs,o){gs.gainLP(o,1500);gs.drawCard(o,1);}}],
    ['ZEL5','Mondstrahl',      RACE.ELFE,    'rare',       'Alle Gegnermonster verlieren dauerhaft 500 ATK und 500 DEF.',       {apply(gs,o){const op=o==='player'?'opponent':'player';gs.getState()[op].field.monsters.forEach(fm=>{if(fm){fm.permATKBonus=(fm.permATKBonus||0)-500;fm.permDEFBonus=(fm.permDEFBonus||0)-500;}});}}],
    ['ZEL6','Sternenregen',    RACE.ELFE,    'rare',       'Alle Gegnermonster verlieren dauerhaft 700 ATK.',                   {apply(gs,o){const op=o==='player'?'opponent':'player';gs.getState()[op].field.monsters.forEach(fm=>{if(fm)fm.permATKBonus=(fm.permATKBonus||0)-700;});}}],
    ['ZEL7','Mondfinsternis',  RACE.ELFE,    'super_rare', 'Alle Gegnermonster verlieren dauerhaft 1000 ATK.',                  {apply(gs,o){const op=o==='player'?'opponent':'player';gs.getState()[op].field.monsters.forEach(fm=>{if(fm)fm.permATKBonus=(fm.permATKBonus||0)-1000;});}}],
    // Dämon
    ['ZDA1','Seelenpakt',      RACE.DAEMON,  'common',     'Alle deine Dämon-Monster erhalten +600 ATK bis Rundenende.',        {apply(gs,o){gs.getState()[o].field.monsters.forEach(fm=>{if(fm&&fm.card.race===RACE.DAEMON)fm.tempATKBonus=(fm.tempATKBonus||0)+600;});}}],
    ['ZDA2','Höllenpakt',      RACE.DAEMON,  'common',     'Füge dem Gegner 800 Schaden zu.',                                   {apply(gs,o){gs.dealDamage(o==='player'?'opponent':'player',800);}}],
    ['ZDA3','Dunkles Opfer',   RACE.DAEMON,  'uncommon',   'Alle deine Dämon-Monster erhalten dauerhaft +400 ATK.',             {apply(gs,o){gs.getState()[o].field.monsters.forEach(fm=>{if(fm&&fm.card.race===RACE.DAEMON)fm.permATKBonus=(fm.permATKBonus||0)+400;});}}],
    ['ZDA4','Abgrundfluch',    RACE.DAEMON,  'uncommon',   'Füge dem Gegner 1200 Schaden zu.',                                  {apply(gs,o){gs.dealDamage(o==='player'?'opponent':'player',1200);}}],
    ['ZDA5','Chaosaufstieg',   RACE.DAEMON,  'rare',       'Alle deine Dämon-Monster erhalten dauerhaft +600 ATK.',             {apply(gs,o){gs.getState()[o].field.monsters.forEach(fm=>{if(fm&&fm.card.race===RACE.DAEMON)fm.permATKBonus=(fm.permATKBonus||0)+600;});}}],
    ['ZDA6','Höllensturm',     RACE.DAEMON,  'rare',       'Füge dem Gegner 2000 Schaden zu.',                                  {apply(gs,o){gs.dealDamage(o==='player'?'opponent':'player',2000);}}],
    ['ZDA7','Untergang',       RACE.DAEMON,  'super_rare', 'Füge dem Gegner 2500 Schaden zu. Alle Dämon-Monster +800 ATK.',     {apply(gs,o){gs.dealDamage(o==='player'?'opponent':'player',2500);gs.getState()[o].field.monsters.forEach(fm=>{if(fm&&fm.card.race===RACE.DAEMON)fm.tempATKBonus=(fm.tempATKBonus||0)+800;});}}],
    // Wasser
    ['ZWA1','Rückzug',         RACE.WASSER,  'common',     'Spiele das Monster mit der höchsten ATK des Gegners auf dessen Hand zurück.', {apply(gs,o){const op=o==='player'?'opponent':'player';const st=gs.getState()[op].field.monsters;const idx=st.reduce<number|null>((a,b,i)=>(!b?a:(!a&&a!==0||b.card.atk!==undefined&&st[a as number]&&b.card.atk>st[a as number]!.card.atk!?i:a)),null);if(idx!==null&&st[idx]){gs.getState()[op].hand.push(st[idx]!.card);st[idx]=null;}}}],
    ['ZWA2','Nebelbank',       RACE.WASSER,  'common',     'Erhalte 500 LP. Ziehe 1 Karte.',                                    {apply(gs,o){gs.gainLP(o,500);gs.drawCard(o,1);}}],
    ['ZWA3','Eissturm',        RACE.WASSER,  'uncommon',   'Alle Gegnermonster verlieren 500 ATK bis Rundenende.',              {apply(gs,o){const op=o==='player'?'opponent':'player';gs.getState()[op].field.monsters.forEach(fm=>{if(fm)fm.tempATKBonus=(fm.tempATKBonus||0)-500;});}}],
    ['ZWA4','Tiefenstrudel',   RACE.WASSER,  'uncommon',   'Füge dem Gegner 800 Schaden zu. Ziehe 1 Karte.',                    {apply(gs,o){gs.dealDamage(o==='player'?'opponent':'player',800);gs.drawCard(o,1);}}],
    ['ZWA5','Tsunami',         RACE.WASSER,  'rare',       'Füge dem Gegner 1500 Schaden zu. Alle Gegnermonster verlieren 300 ATK.',{apply(gs,o){const op=o==='player'?'opponent':'player';gs.dealDamage(op,1500);gs.getState()[op].field.monsters.forEach(fm=>{if(fm)fm.tempATKBonus=(fm.tempATKBonus||0)-300;});}}],
    ['ZWA6','Ozeanflut',       RACE.WASSER,  'rare',       'Spiele alle Gegnermonster auf die Hand zurück.',                    {apply(gs,o){const op=o==='player'?'opponent':'player';const st=gs.getState()[op].field.monsters;for(let i=0;i<st.length;i++){if(st[i]){gs.getState()[op].hand.push(st[i]!.card);st[i]=null;}}}}],
    ['ZWA7','Meeresgewalt',    RACE.WASSER,  'super_rare', 'Füge dem Gegner 2500 Schaden zu. Ziehe 2 Karten.',                  {apply(gs,o){gs.dealDamage(o==='player'?'opponent':'player',2500);gs.drawCard(o,2);}}],
  ];

  SPELL_ENTRIES.forEach(([id,name,race,rarity,desc,effect])=>{
    _addCard(id, {
      id, name, type:TYPE.SPELL,
      race, rarity,
      description:desc,
      spellType:'normal',
      effect,
    });
  });

  // ── 40 Fallenkarten (4 pro Rasse) ───────────────────────────
  const TRAP_ENTRIES: [string, string, string, RarityLevel, string, string, CardEffect][] = [
    // Feuer
    ['QFE1','Flammenbarriere', RACE.FEUER,   'uncommon', 'Aktiviere wenn der Gegner ein Monster beschwört: Füge dem Gegner Schaden gleich Hälfte des ATK des beschworten Monsters zu.',  'onOpponentSummon', {apply(gs,o,fc){if(fc){const d=Math.floor((fc as {card:{atk:number}}).card.atk/2);gs.dealDamage(o==='player'?'opponent':'player',d);gs.addLog(`Flammenbarriere! ${d} Schaden!`); return {cancelAttack:false};}return{};}},   ],
    ['QFE2','Gegenfeuer',      RACE.FEUER,   'common',   'Aktiviere wenn ein Gegnermonster angreift: Füge dem Gegner 400 Schaden zu.',                                                    'onAttack',         {apply(gs,o,atk){gs.dealDamage(o==='player'?'opponent':'player',400);gs.addLog('Gegenfeuer! 400 Schaden!');return{cancelAttack:true};}},  ],
    ['QFE3','Lavabrand',       RACE.FEUER,   'rare',     'Aktiviere wenn ein Gegnermonster angreift: Füge dem Gegner Schaden gleich der ATK des angreifenden Monsters zu.',               'onAttack',         {apply(gs,o,atk){const a=atk as {effectiveATK?:()=>number,card:{atk:number}};const d=a.effectiveATK?a.effectiveATK():a.card.atk;gs.dealDamage(o==='player'?'opponent':'player',d);gs.addLog(`Lavabrand! ${d} Schaden!`);return{cancelAttack:true};}},  ],
    ['QFE4','Pyrosperre',      RACE.FEUER,   'super_rare','Aktiviere wenn ein Gegnermonster angreift: Negiere Angriff und füge dem Gegner 1000 Schaden zu.',                              'onAttack',         {apply(gs,o,atk){gs.dealDamage(o==='player'?'opponent':'player',1000);gs.addLog('Pyrosperre! Angriff negiert! 1000 Schaden!');return{cancelAttack:true};}}, ],
    // Drache
    ['QDR1','Drachenwut',      RACE.DRACHE,  'common',   'Aktiviere wenn eines deiner Monster angegriffen wird: Es erhält bis Kampfende +1000 ATK.',                                      'onOwnMonsterAttacked',{apply(gs,o,atk,def){if(def)(def as {tempATKBonus:number}).tempATKBonus=((def as {tempATKBonus:number}).tempATKBonus||0)+1000;gs.addLog('Drachenwut! +1000 ATK!');return{};}},  ],
    ['QDR2','Schuppenwand',    RACE.DRACHE,  'uncommon', 'Aktiviere wenn ein Gegnermonster angreift: Negiere den Angriff.',                                                               'onAttack',         {apply(gs,o,atk){gs.addLog('Schuppenwand! Angriff negiert!');return{cancelAttack:true};}},  ],
    ['QDR3','Wyrmfalle',       RACE.DRACHE,  'rare',     'Aktiviere wenn der Gegner ein Monster beschwört: Zerstöre es wenn ATK ≥ 2000.',                                                'onOpponentSummon', {apply(gs,o,fc){if(fc&&(fc as {card:{atk:number}}).card.atk>=2000){gs.addLog(`Wyrmfalle! ${(fc as {card:{name:string}}).card.name} zerstört!`);return{destroySummoned:true};}return{};}},  ],
    ['QDR4','Drachenfalle',    RACE.DRACHE,  'super_rare','Aktiviere wenn ein Gegnermonster angreift: Zerstöre das angreifende Monster.',                                                 'onAttack',         {apply(gs,o,atk){gs.addLog(`Drachenfalle! ${(atk as {card:{name:string}}).card.name} zerstört!`);return{cancelAttack:true,destroyAttacker:true};}}, ],
    // Flug
    ['QFL1','Windschild',      RACE.FLUG,    'common',   'Aktiviere wenn eines deiner Monster angegriffen wird: Negiere den Angriff.',                                                    'onOwnMonsterAttacked',{apply(gs,o){gs.addLog('Windschild! Angriff negiert!');return{cancelAttack:true};}},  ],
    ['QFL2','Federsenke',      RACE.FLUG,    'uncommon', 'Aktiviere wenn ein Gegnermonster angreift: Es verliert bis Kampfende 800 ATK.',                                                'onAttack',         {apply(gs,o,atk){if(atk)(atk as {tempATKBonus:number}).tempATKBonus=((atk as {tempATKBonus:number}).tempATKBonus||0)-800;gs.addLog('Federsenke! -800 ATK!');return{};}},  ],
    ['QFL3','Sturmfalle',      RACE.FLUG,    'rare',     'Aktiviere wenn der Gegner ein Monster beschwört: Es verliert dauerhaft 500 ATK.',                                              'onOpponentSummon', {apply(gs,o,fc){if(fc){(fc as {permATKBonus:number}).permATKBonus=((fc as {permATKBonus:number}).permATKBonus||0)-500;gs.addLog(`Sturmfalle! ${(fc as {card:{name:string}}).card.name} -500 ATK!`);}return{};}},  ],
    ['QFL4','Luftloch',        RACE.FLUG,    'super_rare','Aktiviere wenn ein Gegnermonster angreift: Negiere Angriff. Gegner verliert 500 LP.',                                          'onAttack',         {apply(gs,o,atk){gs.dealDamage(o==='player'?'opponent':'player',500);gs.addLog('Luftloch! Angriff negiert! 500 Schaden!');return{cancelAttack:true};}}, ],
    // Stein
    ['QST1','Steinwall',       RACE.STEIN,   'common',   'Aktiviere wenn eines deiner Monster angegriffen wird: Es erhält bis Kampfende +1500 DEF.',                                     'onOwnMonsterAttacked',{apply(gs,o,atk,def){if(def)(def as {tempDEFBonus:number}).tempDEFBonus=((def as {tempDEFBonus:number}).tempDEFBonus||0)+1500;gs.addLog('Steinwall! +1500 DEF!');return{};}},  ],
    ['QST2','Felssperre',      RACE.STEIN,   'uncommon', 'Aktiviere wenn ein Gegnermonster angreift: Negiere den Angriff.',                                                               'onAttack',         {apply(gs,o){gs.addLog('Felssperre! Angriff negiert!');return{cancelAttack:true};}},  ],
    ['QST3','Erdbebenfall',    RACE.STEIN,   'rare',     'Aktiviere wenn der Gegner ein Monster beschwört: Alle Gegnermonster verlieren 400 ATK dauerhaft.',                              'onOpponentSummon', {apply(gs,o){const op=o==='player'?'opponent':'player';gs.getState()[op].field.monsters.forEach(fm=>{if(fm)fm.permATKBonus=(fm.permATKBonus||0)-400;});gs.addLog('Erdbebenfall! Alle Gegner -400 ATK!');return{};}},  ],
    ['QST4','Granitkäfig',     RACE.STEIN,   'super_rare','Aktiviere wenn ein Gegnermonster angreift: Negiere Angriff. Das angreifende Monster verliert 1000 ATK dauerhaft.',             'onAttack',         {apply(gs,o,atk){if(atk)(atk as {permATKBonus:number}).permATKBonus=((atk as {permATKBonus:number}).permATKBonus||0)-1000;gs.addLog('Granitkäfig! Angriff negiert! -1000 ATK dauerhaft!');return{cancelAttack:true};}}, ],
    // Pflanze
    ['QPF1','Dornenschild',    RACE.PFLANZE, 'common',   'Aktiviere wenn eines deiner Monster angegriffen wird: Erhalte 500 LP.',                                                        'onOwnMonsterAttacked',{apply(gs,o){gs.gainLP(o,500);gs.addLog('Dornenschild! +500 LP!');return{};}},  ],
    ['QPF2','Heilrankenfall',  RACE.PFLANZE, 'uncommon', 'Aktiviere wenn ein Gegnermonster angreift: Negiere den Angriff. Erhalte 800 LP.',                                              'onAttack',         {apply(gs,o){gs.gainLP(o,800);gs.addLog('Heilrankenfall! Angriff negiert! +800 LP!');return{cancelAttack:true};}},  ],
    ['QPF3','Rankensperre',    RACE.PFLANZE, 'rare',     'Aktiviere wenn der Gegner ein Monster beschwört: Es verliert dauerhaft 600 ATK.',                                              'onOpponentSummon', {apply(gs,o,fc){if(fc){(fc as {permATKBonus:number}).permATKBonus=((fc as {permATKBonus:number}).permATKBonus||0)-600;gs.addLog(`Rankensperre! ${(fc as {card:{name:string}}).card.name} -600 ATK!`);}return{};}},  ],
    ['QPF4','Moossog',         RACE.PFLANZE, 'super_rare','Aktiviere wenn ein Gegnermonster angreift: Negiere Angriff. Erhalte LP gleich ATK des angreifenden Monsters ÷ 2.',             'onAttack',         {apply(gs,o,atk){const a=atk as {effectiveATK?:()=>number,card:{atk:number}};const h=Math.floor((a.effectiveATK?a.effectiveATK():a.card.atk)/2);gs.gainLP(o,h);gs.addLog(`Moossog! Angriff negiert! +${h} LP!`);return{cancelAttack:true};}}, ],
    // Krieger
    ['QKR1','Kampfruf',        RACE.KRIEGER, 'common',   'Aktiviere wenn eines deiner Monster angegriffen wird: Es erhält bis Kampfende +800 ATK.',                                      'onOwnMonsterAttacked',{apply(gs,o,atk,def){if(def)(def as {tempATKBonus:number}).tempATKBonus=((def as {tempATKBonus:number}).tempATKBonus||0)+800;gs.addLog('Kampfruf! +800 ATK!');return{};}},  ],
    ['QKR2','Gegenwehr',       RACE.KRIEGER, 'uncommon', 'Aktiviere wenn ein Gegnermonster angreift: Negiere den Angriff.',                                                               'onAttack',         {apply(gs,o){gs.addLog('Gegenwehr! Angriff negiert!');return{cancelAttack:true};}},  ],
    ['QKR3','Klingensperre',   RACE.KRIEGER, 'rare',     'Aktiviere wenn der Gegner ein Monster beschwört: Es verliert dauerhaft 500 ATK.',                                              'onOpponentSummon', {apply(gs,o,fc){if(fc){(fc as {permATKBonus:number}).permATKBonus=((fc as {permATKBonus:number}).permATKBonus||0)-500;gs.addLog(`Klingensperre! ${(fc as {card:{name:string}}).card.name} -500 ATK!`);}return{};}},  ],
    ['QKR4','Heldenfalle',     RACE.KRIEGER, 'super_rare','Aktiviere wenn ein Gegnermonster angreift: Es verliert bis Kampfende 1500 ATK.',                                              'onAttack',         {apply(gs,o,atk){if(atk)(atk as {tempATKBonus:number}).tempATKBonus=((atk as {tempATKBonus:number}).tempATKBonus||0)-1500;gs.addLog('Heldenfalle! -1500 ATK!');return{};}}, ],
    // Magier
    ['QMA1','Runensperre',     RACE.MAGIER,  'common',   'Aktiviere wenn ein Gegnermonster angreift: Ziehe 1 Karte.',                                                                    'onAttack',         {apply(gs,o){gs.drawCard(o,1);gs.addLog('Runensperre! +1 Karte!');return{};}},  ],
    ['QMA2','Arkanfalle',      RACE.MAGIER,  'uncommon', 'Aktiviere wenn der Gegner ein Monster beschwört: Ziehe 1 Karte. Gegner verliert 300 LP.',                                      'onOpponentSummon', {apply(gs,o,fc){gs.drawCard(o,1);gs.dealDamage(o==='player'?'opponent':'player',300);gs.addLog('Arkanfalle! +1 Karte, 300 Schaden!');return{};}},  ],
    ['QMA3','Wissensfalle',    RACE.MAGIER,  'rare',     'Aktiviere wenn ein Gegnermonster angreift: Negiere Angriff. Ziehe 2 Karten.',                                                  'onAttack',         {apply(gs,o){gs.drawCard(o,2);gs.addLog('Wissensfalle! Angriff negiert! +2 Karten!');return{cancelAttack:true};}},  ],
    ['QMA4','Magiersperre',    RACE.MAGIER,  'super_rare','Aktiviere wenn der Gegner ein Monster beschwört: Es verliert dauerhaft 800 ATK. Ziehe 2 Karten.',                             'onOpponentSummon', {apply(gs,o,fc){if(fc)(fc as {permATKBonus:number}).permATKBonus=((fc as {permATKBonus:number}).permATKBonus||0)-800;gs.drawCard(o,2);gs.addLog('Magiersperre! -800 ATK, +2 Karten!');return{};}}, ],
    // Elfe
    ['QEL1','Elfenzauber',     RACE.ELFE,    'common',   'Aktiviere wenn ein Gegnermonster angreift: Es verliert bis Kampfende 600 ATK.',                                                'onAttack',         {apply(gs,o,atk){if(atk)(atk as {tempATKBonus:number}).tempATKBonus=((atk as {tempATKBonus:number}).tempATKBonus||0)-600;gs.addLog('Elfenzauber! -600 ATK!');return{};}},  ],
    ['QEL2','Mondfalle',       RACE.ELFE,    'uncommon', 'Aktiviere wenn der Gegner ein Monster beschwört: Es verliert dauerhaft 400 ATK und 400 DEF.',                                  'onOpponentSummon', {apply(gs,o,fc){if(fc){(fc as {permATKBonus:number,permDEFBonus:number}).permATKBonus=((fc as {permATKBonus:number}).permATKBonus||0)-400;(fc as {permDEFBonus:number}).permDEFBonus=((fc as {permDEFBonus:number}).permDEFBonus||0)-400;}gs.addLog('Mondfalle! -400 ATK/-400 DEF!');return{};}},  ],
    ['QEL3','Sternenfalle',    RACE.ELFE,    'rare',     'Aktiviere wenn ein Gegnermonster angreift: Negiere Angriff. Es verliert dauerhaft 500 ATK.',                                   'onAttack',         {apply(gs,o,atk){if(atk)(atk as {permATKBonus:number}).permATKBonus=((atk as {permATKBonus:number}).permATKBonus||0)-500;gs.addLog('Sternenfalle! Angriff negiert! -500 ATK dauerhaft!');return{cancelAttack:true};}},  ],
    ['QEL4','Lichtfalle',      RACE.ELFE,    'super_rare','Aktiviere wenn der Gegner ein Monster beschwört: Es verliert dauerhaft 800 ATK und 800 DEF.',                                 'onOpponentSummon', {apply(gs,o,fc){if(fc){(fc as {permATKBonus:number,permDEFBonus:number}).permATKBonus=((fc as {permATKBonus:number}).permATKBonus||0)-800;(fc as {permDEFBonus:number}).permDEFBonus=((fc as {permDEFBonus:number}).permDEFBonus||0)-800;}gs.addLog('Lichtfalle! -800 ATK/-800 DEF!');return{};}}, ],
    // Dämon
    ['QDA1','Seelenfalle',     RACE.DAEMON,  'common',   'Aktiviere wenn ein Gegnermonster angreift: Füge dem Gegner 500 Schaden zu.',                                                   'onAttack',         {apply(gs,o,atk){gs.dealDamage(o==='player'?'opponent':'player',500);gs.addLog('Seelenfalle! 500 Schaden!');return{};}},  ],
    ['QDA2','Höllenfalle',     RACE.DAEMON,  'uncommon', 'Aktiviere wenn der Gegner ein Monster beschwört: Füge dem Gegner 400 Schaden zu.',                                             'onOpponentSummon', {apply(gs,o){gs.dealDamage(o==='player'?'opponent':'player',400);gs.addLog('Höllenfalle! 400 Schaden!');return{};}},  ],
    ['QDA3','Abgrundfalle',    RACE.DAEMON,  'rare',     'Aktiviere wenn ein Gegnermonster angreift: Negiere Angriff. Füge dem Gegner 800 Schaden zu.',                                  'onAttack',         {apply(gs,o,atk){gs.dealDamage(o==='player'?'opponent':'player',800);gs.addLog('Abgrundfalle! Angriff negiert! 800 Schaden!');return{cancelAttack:true};}},  ],
    ['QDA4','Chaosfalle',      RACE.DAEMON,  'super_rare','Aktiviere wenn ein Gegnermonster angreift: Zerstöre es. Füge dem Gegner 500 Schaden zu.',                                     'onAttack',         {apply(gs,o,atk){gs.dealDamage(o==='player'?'opponent':'player',500);gs.addLog('Chaosfalle! Monster zerstört! 500 Schaden!');return{cancelAttack:true,destroyAttacker:true};}}, ],
    // Wasser
    ['QWA1','Strudelfalle',    RACE.WASSER,  'common',   'Aktiviere wenn ein Gegnermonster angreift: Es verliert bis Kampfende 500 ATK.',                                                'onAttack',         {apply(gs,o,atk){if(atk)(atk as {tempATKBonus:number}).tempATKBonus=((atk as {tempATKBonus:number}).tempATKBonus||0)-500;gs.addLog('Strudelfalle! -500 ATK!');return{};}},  ],
    ['QWA2','Eisfalle',        RACE.WASSER,  'uncommon', 'Aktiviere wenn der Gegner ein Monster beschwört: Es verliert dauerhaft 400 ATK.',                                              'onOpponentSummon', {apply(gs,o,fc){if(fc)(fc as {permATKBonus:number}).permATKBonus=((fc as {permATKBonus:number}).permATKBonus||0)-400;gs.addLog(`Eisfalle! ${fc?(fc as {card:{name:string}}).card.name:''} -400 ATK!`);return{};}},  ],
    ['QWA3','Tiefseefalle',    RACE.WASSER,  'rare',     'Aktiviere wenn ein Gegnermonster angreift: Negiere Angriff. Spiele es auf die Hand zurück.',                                   'onAttack',         {apply(gs,o,atk){const op=o==='player'?'opponent':'player';if(atk){const fc=atk as {card:CardData};gs.getState()[op].hand.push(fc.card);const st=gs.getState()[op].field.monsters;const i=st.indexOf(atk as never);if(i!==-1)st[i]=null;}gs.addLog('Tiefseefalle! Monster auf Hand zurückgespielt!');return{cancelAttack:true};}},  ],
    ['QWA4','Ozeanfalle',      RACE.WASSER,  'super_rare','Aktiviere wenn ein Gegnermonster angreift: Negiere Angriff. Alle Gegnermonster auf die Hand zurück.',                         'onAttack',         {apply(gs,o,atk){const op=o==='player'?'opponent':'player';const st=gs.getState()[op].field.monsters;for(let i=0;i<st.length;i++){if(st[i]){gs.getState()[op].hand.push(st[i]!.card);st[i]=null;}}gs.addLog('Ozeanfalle! Alle Gegnermonster zurückgespielt!');return{cancelAttack:true};}}, ],
  ];

  TRAP_ENTRIES.forEach(([id,name,race,rarity,desc,trapTrigger,effect])=>{
    _addCard(id, {
      id, name, type:TYPE.TRAP,
      race, rarity,
      description:desc,
      trapTrigger: trapTrigger as import('./types.js').TrapTrigger,
      effect,
    });
  });

  // ── Starterdecks (40 Karten je Rasse) ────────────────────────
export const STARTER_DECKS: Record<string, string[]> = {
    feuer: [
      'NFE01','NFE01','NFE02','NFE02','NFE05','NFE05','NFE06','NFE06',
      'NFE09','NFE09','NFE10','NFE10','NFE11','NFE11','NFE15','NFE15',
      'NFE17','NFE17','NFE19','NFE19',
      'EFE01','EFE01','EFE02','EFE02','EFE06','EFE09',
      'ZFE1','ZFE1','ZFE2','ZFE3','ZFE3','ZFE4',
      'S003','S005',
      'T001','T002','QFE1','QFE2','QFE3','QFE4',
    ],
    drache: [
      'NDR01','NDR01','NDR02','NDR02','NDR05','NDR05','NDR06','NDR06',
      'NDR09','NDR09','NDR10','NDR10','NDR11','NDR11','NDR15','NDR15',
      'NDR17','NDR17','NDR19','NDR19',
      'EDR01','EDR01','EDR03','EDR03','EDR07','EDR05',
      'ZDR1','ZDR1','ZDR3','ZDR3','ZDR5','ZDR4',
      'S003','S005',
      'T001','T002','QDR1','QDR2','QDR3','QDR4',
    ],
    flug: [
      'NFL01','NFL01','NFL02','NFL02','NFL05','NFL05','NFL06','NFL06',
      'NFL09','NFL09','NFL10','NFL10','NFL11','NFL11','NFL15','NFL15',
      'NFL17','NFL17','NFL19','NFL19',
      'EFL01','EFL01','EFL02','EFL02','EFL05','EFL07',
      'ZFL1','ZFL1','ZFL2','ZFL3','ZFL3','ZFL4',
      'S003','S005',
      'T001','T002','QFL1','QFL2','QFL3','QFL4',
    ],
    stein: [
      'NST01','NST01','NST02','NST02','NST05','NST05','NST06','NST06',
      'NST09','NST09','NST10','NST10','NST11','NST11','NST15','NST15',
      'NST17','NST17','NST19','NST19',
      'EST01','EST01','EST03','EST03','EST05','EST09',
      'ZST1','ZST1','ZST2','ZST3','ZST3','ZST4',
      'S002','S005',
      'T002','T004','QST1','QST2','QST3','QST4',
    ],
    pflanze: [
      'NPF01','NPF01','NPF02','NPF02','NPF05','NPF05','NPF06','NPF06',
      'NPF09','NPF09','NPF10','NPF10','NPF11','NPF11','NPF15','NPF15',
      'NPF17','NPF17','NPF19','NPF19',
      'EPF01','EPF01','EPF03','EPF03','EPF04','EPF07',
      'ZPF1','ZPF1','ZPF2','ZPF3','ZPF3','ZPF4',
      'S002','S005',
      'T002','T004','QPF1','QPF2','QPF3','QPF4',
    ],
    krieger: [
      'NKR01','NKR01','NKR02','NKR02','NKR05','NKR05','NKR06','NKR06',
      'NKR09','NKR09','NKR10','NKR10','NKR11','NKR11','NKR15','NKR15',
      'NKR17','NKR17','NKR19','NKR19',
      'EKR01','EKR01','EKR03','EKR03','EKR06','EKR09',
      'ZKR1','ZKR1','ZKR2','ZKR3','ZKR3','ZKR4',
      'S003','S005',
      'T001','T002','QKR1','QKR2','QKR3','QKR4',
    ],
    magier: [
      'NMA01','NMA01','NMA02','NMA02','NMA05','NMA05','NMA06','NMA06',
      'NMA09','NMA09','NMA10','NMA10','NMA11','NMA11','NMA15','NMA15',
      'NMA17','NMA17','NMA19','NMA19',
      'EMA01','EMA01','EMA03','EMA03','EMA05','EMA07',
      'ZMA1','ZMA1','ZMA2','ZMA3','ZMA3','ZMA4',
      'S005','S005',
      'T003','T004','QMA1','QMA2','QMA3','QMA4',
    ],
    elfe: [
      'NEL01','NEL01','NEL02','NEL02','NEL05','NEL05','NEL06','NEL06',
      'NEL09','NEL09','NEL10','NEL10','NEL11','NEL11','NEL15','NEL15',
      'NEL17','NEL17','NEL19','NEL19',
      'EEL01','EEL01','EEL02','EEL02','EEL05','EEL07',
      'ZEL1','ZEL1','ZEL2','ZEL3','ZEL3','ZEL4',
      'S002','S005',
      'T002','T004','QEL1','QEL2','QEL3','QEL4',
    ],
    daemon: [
      'NDA01','NDA01','NDA02','NDA02','NDA05','NDA05','NDA06','NDA06',
      'NDA09','NDA09','NDA10','NDA10','NDA11','NDA11','NDA15','NDA15',
      'NDA17','NDA17','NDA19','NDA19',
      'EDA01','EDA01','EDA02','EDA02','EDA06','EDA08',
      'ZDA1','ZDA1','ZDA2','ZDA3','ZDA3','ZDA4',
      'S003','S005',
      'T001','T002','QDA1','QDA2','QDA3','QDA4',
    ],
    wasser: [
      'NWA01','NWA01','NWA02','NWA02','NWA05','NWA05','NWA06','NWA06',
      'NWA09','NWA09','NWA10','NWA10','NWA11','NWA11','NWA15','NWA15',
      'NWA17','NWA17','NWA19','NWA19',
      'EWA01','EWA01','EWA03','EWA03','EWA05','EWA07',
      'ZWA1','ZWA1','ZWA2','ZWA3','ZWA3','ZWA4',
      'S002','S005',
      'T002','T004','QWA1','QWA2','QWA3','QWA4',
    ],
};
