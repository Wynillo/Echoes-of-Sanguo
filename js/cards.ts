// ============================================================
// ECHOES OF SANGUO - Kartendatenbank
// Runtime data store — populated at startup by loading base.tcg
// ============================================================
import type { CardData, FusionRecipe, FusionFormula, OpponentConfig } from './types.js';
import { CardType, Rarity, isMonsterType } from './types.js';
import {
  getRaceByKey, getAttrByKey, getRarityById,
  TYPE_META,
} from './type-metadata.js';

export const TYPE = CardType;
export const RARITY = Rarity;

// ── Display helpers (backward-compatible re-exports from type-metadata) ──

/** @deprecated Use getRarityById() from type-metadata.ts instead */
export const RARITY_COLOR: Record<number, string> = new Proxy({} as Record<number, string>, {
  get(_t, prop) { const id = Number(prop); return getRarityById(id)?.color ?? '#aaa'; },
  ownKeys() { return TYPE_META.rarities.map(r => String(r.id)); },
  getOwnPropertyDescriptor() { return { configurable: true, enumerable: true }; },
});

/** @deprecated Use getRarityById() from type-metadata.ts instead */
export const RARITY_NAME: Record<number, string> = new Proxy({} as Record<number, string>, {
  get(_t, prop) { const id = Number(prop); return getRarityById(id)?.value ?? ''; },
  ownKeys() { return TYPE_META.rarities.map(r => String(r.id)); },
  getOwnPropertyDescriptor() { return { configurable: true, enumerable: true }; },
});

/** @deprecated Use getRaceByKey() from type-metadata.ts instead */
export const RACE_ICON: Record<string, string> = new Proxy({} as Record<string, string>, {
  get(_t, prop) { return getRaceByKey(String(prop))?.icon ?? ''; },
  ownKeys() { return TYPE_META.races.map(r => r.key); },
  getOwnPropertyDescriptor() { return { configurable: true, enumerable: true }; },
});

/** @deprecated Use getRaceByKey() from type-metadata.ts instead */
export const RACE_NAME: Record<string, string> = new Proxy({} as Record<string, string>, {
  get(_t, prop) { return getRaceByKey(String(prop))?.value ?? ''; },
  ownKeys() { return TYPE_META.races.map(r => r.key); },
  getOwnPropertyDescriptor() { return { configurable: true, enumerable: true }; },
});

/** @deprecated Use getAttrByKey() from type-metadata.ts instead */
export const ATTR_SYMBOL: Record<string, string> = new Proxy({} as Record<string, string>, {
  get(_t, prop) { return getAttrByKey(String(prop))?.symbol ?? '✦'; },
  ownKeys() { return TYPE_META.attributes.map(a => a.key); },
  getOwnPropertyDescriptor() { return { configurable: true, enumerable: true }; },
});

/** @deprecated Use getAttrByKey() from type-metadata.ts instead */
export const ATTR_NAME: Record<string, string> = new Proxy({} as Record<string, string>, {
  get(_t, prop) { return getAttrByKey(String(prop))?.value ?? ''; },
  ownKeys() { return TYPE_META.attributes.map(a => a.key); },
  getOwnPropertyDescriptor() { return { configurable: true, enumerable: true }; },
});

// ── Runtime data stores (populated by tcg-loader from base.tcg) ──
export const CARD_DB: Record<string, CardData> = {};
export const FUSION_RECIPES: FusionRecipe[] = [];
export const FUSION_FORMULAS: FusionFormula[] = [];
export const OPPONENT_CONFIGS: OpponentConfig[] = [];
export const STARTER_DECKS: Record<number, string[]> = {};
// Fallback deck IDs used by engine when no deck is specified — set from first starter deck
export const PLAYER_DECK_IDS: string[] = [];
export const OPPONENT_DECK_IDS: string[] = [];

export function makeDeck(ids: string[]): CardData[] {
  return ids.flatMap(id => {
    const card = CARD_DB[id];
    if (!card) {
      console.warn(`[makeDeck] Unknown card ID "${id}" – skipping.`);
      return [];
    }
    if (!card.effect) return [{ ...card }];
    // Deep-clone effect so deck copies don't share the same object references.
    return [{ ...card, effect: { ...card.effect, actions: [...card.effect.actions] } }];
  });
}

export function checkFusion(id1: string, id2: string): FusionRecipe | null {
  // Step 1: Explicit recipe lookup (highest priority)
  const explicit = FUSION_RECIPES.find(r =>
    (r.materials[0]===id1 && r.materials[1]===id2) ||
    (r.materials[0]===id2 && r.materials[1]===id1)
  );
  if (explicit) return explicit;

  // Step 2: Type-based formula lookup (Forbidden Memories style)
  const card1 = CARD_DB[id1];
  const card2 = CARD_DB[id2];
  if (!card1 || !card2) return null;
  if (card1.type !== CardType.Monster || card2.type !== CardType.Monster) return null;

  const threshold = Math.max(card1.atk ?? 0, card2.atk ?? 0);

  // FUSION_FORMULAS is pre-sorted by descending priority
  for (const formula of FUSION_FORMULAS) {
    if (matchesFormula(card1, card2, formula)) {
      const resultId = selectFusionResult(formula.resultPool, threshold);
      if (resultId) {
        return { materials: [id1, id2], result: resultId };
      }
    }
  }
  return null;
}

/** Check if two cards match a fusion formula's type requirements. */
function matchesFormula(c1: CardData, c2: CardData, f: FusionFormula): boolean {
  switch (f.comboType) {
    case 'race+race':
      return (c1.race === f.operand1 && c2.race === f.operand2) ||
             (c1.race === f.operand2 && c2.race === f.operand1);
    case 'race+attr':
      return (c1.race === f.operand1 && c2.attribute === f.operand2) ||
             (c2.race === f.operand1 && c1.attribute === f.operand2);
    case 'attr+attr':
      return (c1.attribute === f.operand1 && c2.attribute === f.operand2) ||
             (c1.attribute === f.operand2 && c2.attribute === f.operand1);
    default:
      return false;
  }
}

/**
 * Select the best fusion result from a pool.
 * Rule: result ATK must be >= threshold (highest material ATK),
 * then pick the lowest ATK among eligible candidates.
 */
function selectFusionResult(pool: string[], threshold: number): string | null {
  const candidates = pool
    .map(id => CARD_DB[id])
    .filter(card => card && (card.atk ?? 0) >= threshold)
    .sort((a, b) => (a.atk ?? 0) - (b.atk ?? 0)); // ascending — pick lowest

  if (candidates.length === 0) return null;
  return candidates[0].id;
}

// ── Multi-Card Fusion Chain (FM-style) ───────────────────

export interface FusionChainStep {
  inputA: string;           // current result card ID
  inputB: string;           // next card ID being combined
  output: string;           // surviving card ID after this step
  fused: boolean;           // true if a real fusion occurred
  discardedId: string | null; // card discarded at this step (null if fused — both consumed into result)
}

export interface FusionChainResult {
  finalCardId: string;
  steps: FusionChainStep[];
  consumedIds: string[];    // all original input card IDs that were consumed (not the final result)
}

/**
 * Resolve a multi-card fusion chain using FM rules.
 * Cards are combined in order: card[0]+card[1], then result+card[2], etc.
 *
 * At each step:
 * 1. If legitimate fusion → combine into fusion result
 * 2. If not a fusion and exactly one is a monster → keep the monster, discard the other
 * 3. If not a fusion and neither/both are monsters → discard inputA (current result), keep inputB
 *
 * Pure function — no state mutation. Safe for preview.
 */
export function resolveFusionChain(cardIds: string[]): FusionChainResult {
  if (cardIds.length === 0) {
    return { finalCardId: '', steps: [], consumedIds: [] };
  }
  if (cardIds.length === 1) {
    return { finalCardId: cardIds[0], steps: [], consumedIds: [] };
  }

  const steps: FusionChainStep[] = [];
  const consumedIds: string[] = [];
  let currentId = cardIds[0];

  for (let i = 1; i < cardIds.length; i++) {
    const nextId = cardIds[i];
    const recipe = checkFusion(currentId, nextId);

    if (recipe) {
      // Legitimate fusion — both consumed, result replaces current
      steps.push({ inputA: currentId, inputB: nextId, output: recipe.result, fused: true, discardedId: null });
      consumedIds.push(currentId, nextId);
      currentId = recipe.result;
    } else {
      // No fusion — apply fallback rules
      const cardA = CARD_DB[currentId];
      const cardB = CARD_DB[nextId];
      const aIsMon = cardA && isMonsterType(cardA.type);
      const bIsMon = cardB && isMonsterType(cardB.type);

      if (aIsMon && !bIsMon) {
        // Keep monster (A), discard non-monster (B)
        steps.push({ inputA: currentId, inputB: nextId, output: currentId, fused: false, discardedId: nextId });
        consumedIds.push(nextId);
        // currentId stays the same
      } else if (!aIsMon && bIsMon) {
        // Keep monster (B), discard non-monster (A)
        steps.push({ inputA: currentId, inputB: nextId, output: nextId, fused: false, discardedId: currentId });
        consumedIds.push(currentId);
        currentId = nextId;
      } else {
        // Neither or both are monsters — discard first (A), keep second (B)
        steps.push({ inputA: currentId, inputB: nextId, output: nextId, fused: false, discardedId: currentId });
        consumedIds.push(currentId);
        currentId = nextId;
      }
    }
  }

  return { finalCardId: currentId, steps, consumedIds };
}
