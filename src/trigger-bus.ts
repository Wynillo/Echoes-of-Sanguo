import type { InternalEffectContext, CardData } from './types';
import type { FieldCard } from './field';

/** Context passed to TriggerBus handlers — extends InternalEffectContext with the triggering card. */
export interface TriggerContext extends InternalEffectContext {
  /** The card that caused this trigger (e.g. the summoned monster). */
  card?: CardData;
  /** The FieldCard instance on the board, if applicable. */
  fieldCard?: FieldCard;
  /** The board zone index, if applicable. */
  zone?: number | null;
}

type TriggerHandler = (ctx: TriggerContext) => void;

const handlers = new Map<string, Set<TriggerHandler>>();

export const TriggerBus = {
  /** Subscribe to a trigger event. Returns an unsubscribe function. */
  on(event: string, handler: TriggerHandler): () => void {
    if (!handlers.has(event)) handlers.set(event, new Set());
    handlers.get(event)!.add(handler);
    return () => { handlers.get(event)?.delete(handler); };
  },

  /** Fire all handlers registered for the given event. */
  emit(event: string, ctx: TriggerContext): void {
    handlers.get(event)?.forEach(h => h(ctx));
  },

  /** Remove all handlers. Used in test teardown. */
  clear(): void {
    handlers.clear();
  },
};
