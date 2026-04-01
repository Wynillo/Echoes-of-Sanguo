#!/usr/bin/env node
/**
 * Generate eos-engine.d.ts — a standalone type definitions file for modders.
 *
 * Extracts modding-relevant types from src/types.ts, src/trigger-bus.ts, and
 * src/mod-api.ts, wraps them in `declare global { ... }`, and writes
 * dist/eos-engine.d.ts.
 *
 * Usage: node scripts/generate-engine-dts.js
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const typesSource = readFileSync(join(root, 'src/types.ts'), 'utf8');

// Extract the types we want to expose to modders.
// We manually curate them to avoid leaking internal engine details.

const output = `// eos-engine.d.ts — Auto-generated type definitions for Echoes of Sanguo modding.
// Add this file to your project to get type safety for EOS modding.
// Extend EffectDescriptorMap via declaration merging to add custom effect types.
//
// Generated: ${new Date().toISOString().slice(0, 10)}

declare global {
  // ── Primitive Unions ──────────────────────────────────────────
  type Owner        = 'player' | 'opponent';
  type Phase        = 'draw' | 'main' | 'battle' | 'end';
  type Position     = 'atk' | 'def';
  type TrapTrigger  = 'onAttack' | 'onOwnMonsterAttacked' | 'onOpponentSummon' | 'manual';
  type EffectTrigger= 'onSummon' | 'onDestroyByBattle' | 'onDestroyByOpponent' | 'passive' | 'onFlip';
  type SpellType    = 'normal' | 'targeted' | 'fromGrave' | 'field';

  // ── Int-based Enums ───────────────────────────────────────────
  const enum CardType {
    Monster   = 1,
    Fusion    = 2,
    Spell     = 3,
    Trap      = 4,
    Equipment = 5,
  }

  const enum Attribute {
    Light = 1,
    Dark  = 2,
    Fire  = 3,
    Water = 4,
    Earth = 5,
    Wind  = 6,
  }

  const enum Race {
    Dragon      = 1,
    Spellcaster = 2,
    Warrior     = 3,
    Beast       = 4,
    Plant       = 5,
    Rock        = 6,
    Phoenix     = 7,
    Undead      = 8,
    Aqua        = 9,
    Insect      = 10,
    Machine     = 11,
    Pyro        = 12,
  }

  const enum Rarity {
    Common    = 1,
    Uncommon  = 2,
    Rare      = 4,
    SuperRare = 6,
    UltraRare = 8,
  }

  // ── Effect System ─────────────────────────────────────────────

  type ValueExpr =
    | number
    | { from: 'attacker.effectiveATK'; multiply: number; round: 'floor' | 'ceil' }
    | { from: 'summoned.atk';          multiply: number; round: 'floor' | 'ceil' };

  type StatTarget = 'ownMonster' | 'oppMonster' | 'attacker' | 'defender' | 'summonedFC';

  interface CardFilter {
    race?:      Race;
    attr?:      Attribute;
    cardType?:  CardType;
    cardId?:    string;
    maxAtk?:    number;
    minAtk?:    number;
    maxDef?:    number;
    maxLevel?:  number;
    minLevel?:  number;
    random?:    number;
  }

  /**
   * Open map of effect action types → payloads.
   * Extend via declaration merging to add custom effect types:
   *
   * \\\`\\\`\\\`ts
   * declare global {
   *   interface EffectDescriptorMap {
   *     teleportMonster: { from: 'hand' | 'field'; to: 'hand' | 'field' };
   *   }
   * }
   * \\\`\\\`\\\`
   */
  interface EffectDescriptorMap {
    dealDamage:              { target: 'opponent' | 'self'; value: ValueExpr };
    gainLP:                  { target: 'opponent' | 'self'; value: number | ValueExpr };
    draw:                    { target: 'self' | 'opponent'; count: number };
    buffField:               { value: number; filter?: CardFilter };
    tempBuffField:           { value: number; filter?: CardFilter };
    debuffField:             { atkD: number; defD: number };
    tempDebuffField:         { atkD: number; defD?: number };
    bounceStrongestOpp:      {};
    bounceAttacker:          {};
    bounceAllOppMonsters:    {};
    searchDeckToHand:        { filter: CardFilter };
    tempAtkBonus:            { target: StatTarget; value: number };
    permAtkBonus:            { target: StatTarget; value: number; filter?: CardFilter };
    tempDefBonus:            { target: StatTarget; value: number };
    permDefBonus:            { target: StatTarget; value: number };
    reviveFromGrave:         {};
    cancelAttack:            {};
    destroyAttacker:         {};
    destroySummonedIf:       { minAtk: number };
    destroyAllOpp:           {};
    destroyAll:              {};
    destroyWeakestOpp:       {};
    destroyStrongestOpp:     {};
    sendTopCardsToGrave:     { count: number };
    sendTopCardsToGraveOpp:  { count: number };
    salvageFromGrave:        { filter: CardFilter };
    recycleFromGraveToDeck:  { filter: CardFilter };
    shuffleGraveIntoDeck:    {};
    shuffleDeck:             {};
    peekTopCard:             {};
    specialSummonFromHand:   { filter?: CardFilter };
    discardFromHand:         { count: number };
    discardOppHand:          { count: number };
    passive_piercing:        {};
    passive_untargetable:    {};
    passive_directAttack:    {};
    passive_vsAttrBonus:     { attr: Attribute; atk: number };
    passive_phoenixRevival:  {};
    passive_indestructible:  {};
    passive_effectImmune:    {};
    passive_cantBeAttacked:  {};
  }

  type EffectDescriptor = {
    [K in keyof EffectDescriptorMap]: { type: K } & EffectDescriptorMap[K]
  }[keyof EffectDescriptorMap];

  interface EffectSignal {
    cancelAttack?:     boolean;
    destroySummoned?:  boolean;
    destroyAttacker?:  boolean;
  }

  interface CardEffectBlock {
    trigger:    EffectTrigger | TrapTrigger;
    actions:    EffectDescriptor[];
  }

  // ── Card ──────────────────────────────────────────────────────

  interface CardData {
    id:           string;
    name:         string;
    type:         CardType;
    attribute?:   Attribute;
    race?:        Race;
    rarity?:      Rarity;
    level?:       number;
    atk?:         number;
    def?:         number;
    description:  string;
    effect?:      CardEffectBlock;
    spellType?:   SpellType;
    trapTrigger?: TrapTrigger;
    target?:      string;
    atkBonus?:    number;
    defBonus?:    number;
    equipRequirement?: { race?: Race; attr?: Attribute };
  }

  // ── Effect Context (passed to effect handlers) ────────────────

  interface EffectContext {
    engine:       any;
    owner:        Owner;
    targetFC?:    any;
    targetCard?:  CardData;
    attacker?:    any;
    defender?:    any;
    summonedFC?:  any;
  }

  // ── TriggerBus Context ────────────────────────────────────────

  interface TriggerContext extends EffectContext {
    card?:      CardData;
    fieldCard?: any;
    zone?:      number | null;
  }

  // ── Effect Implementation (for registerEffect) ────────────────

  type EffectImpl = (action: any, ctx: EffectContext) => EffectSignal | void;

  // ── Mod API (available on window.EchoesOfSanguoMod) ───────────

  interface EchoesOfSanguoModApi {
    CARD_DB:          Record<string, CardData>;
    FUSION_RECIPES:   Array<{ materials: [string, string]; result: string }>;
    OPPONENT_CONFIGS: Array<any>;
    STARTER_DECKS:    Record<number, string[]>;
    EFFECT_REGISTRY:  Map<string, EffectImpl>;
    registerEffect(type: string, impl: EffectImpl): void;
    loadModTcg(source: string | ArrayBuffer, onProgress?: (percent: number) => void): Promise<any>;
    unloadModCards(source: string): boolean;
    getLoadedMods(): ReadonlyArray<{ source: string; cardIds: string[]; opponentIds: number[]; timestamp: number }>;
    emitTrigger(event: string, ctx: TriggerContext): void;
    addTriggerHook(event: string, handler: (ctx: TriggerContext) => void): () => void;
  }

  interface Window {
    EchoesOfSanguoMod: EchoesOfSanguoModApi;
  }
}

export {};
`;

mkdirSync(join(root, 'dist'), { recursive: true });
writeFileSync(join(root, 'dist/eos-engine.d.ts'), output);
console.log('Generated dist/eos-engine.d.ts');
