import type { Owner, EffectSignal, BattleContext, PromptOptions } from './types';
import type { GameState } from './engine';
import type { FieldCard, FieldSpellTrap, CardData } from './types';
import { CardType } from './types';

export interface TrapResolverDeps {
  getState(): GameState;
  getTrapZones(owner: Owner): (FieldSpellTrap | null)[];
  getMonsterAt(owner: Owner, zone: number): FieldCard | null;
  promptPlayer(opts: PromptOptions): Promise<boolean>;
  activateTrap(owner: Owner, zone: number, args: FieldCard[]): Promise<EffectSignal | null>;
  showActivation?(card: CardData, text: string): Promise<void> | void;
  playSfx?(sfxId: string): void;
  addLog(msg: string): void;
  get owner(): Owner;
}

export class TrapResolver {
  constructor(private deps: TrapResolverDeps) {}

  async checkTrapActivation(
    triggerType: string,
    args: FieldCard[],
    checkingPlayerTraps: boolean,
  ): Promise<EffectSignal | null> {
    const owner: Owner = checkingPlayerTraps ? 'player' : 'opponent';
    const opponent: Owner = checkingPlayerTraps ? 'opponent' : 'player';
    
    const state = this.deps.getState();
    
    if (state[opponent].fieldFlags?.negateTraps) {
      return null;
    }

    const traps = this.deps.getTrapZones(owner);

    for (let i = 0; i < traps.length; i++) {
      const fst = traps[i];
      
      if (!fst || fst.card.type !== CardType.Trap || fst.faceDown || fst.used || fst.card.trapTrigger !== triggerType) {
        continue;
      }

      if (checkingPlayerTraps) {
        const result = await this.promptPlayerTrapActivation(i, fst, args);
        if (result) {
          return result;
        }
      } else {
        return await this.deps.activateTrap(owner, i, args);
      }
    }

    return null;
  }

  private async promptPlayerTrapActivation(
    zoneIndex: number,
    fst: FieldSpellTrap,
    args: FieldCard[],
  ): Promise<EffectSignal | null> {
    const promptFn = this.deps.promptPlayer;
    
    const battleContext: BattleContext = { triggerType: fst.card.trapTrigger! };
    
    if (args[0]) {
      battleContext.attackerName = args[0].card.name;
      battleContext.attackerAtk = args[0].effectiveATK();
      battleContext.attackerCardId = args[0].card.id;
    }
    
    if (args[1]) {
      battleContext.defenderName = args[1].card.name;
      battleContext.defenderDef = args[1].effectiveDEF();
      battleContext.defenderAtk = args[1].effectiveATK();
      battleContext.defenderPos = args[1].position;
      battleContext.defenderCardId = args[1].card.id;
    }

    const activate = await promptFn({
      title: 'Activate trap?',
      cardId: fst.card.id,
      message: `${fst.card.name}: ${fst.card.description}`,
      yes: 'Yes, activate!',
      no: 'No, skip',
      battleContext,
    });

    if (activate) {
      return await this.deps.activateTrap('player', zoneIndex, args);
    }

    return null;
  }
}
