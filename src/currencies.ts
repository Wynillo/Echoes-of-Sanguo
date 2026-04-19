import type { SlotId } from './progression.js';
import { MAX_CURRENCY_AMOUNT } from './economy-config.js';

/**
 * Safely parse JSON string with prototype pollution protection.
 * Duplicated from progression.ts to avoid circular dependency.
 */
function safeJsonParse<T>(raw: string | null, fallback: T): T {
  if (raw === null || raw === '') return fallback;
  
  // Block prototype pollution attempts
  if (/\b(__proto__|constructor|prototype)\b/.test(raw)) {
    console.warn('[Currencies] Blocked prototype pollution attempt.');
    return fallback;
  }
  
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function _currencyKey(slot: SlotId, currencyId: string): string {
  return `tcg_s${slot}_currency_${currencyId}`;
}

export function getCurrency(slot: SlotId, currencyId: string): number {
  const raw = localStorage.getItem(_currencyKey(slot, currencyId));
  const parsed = safeJsonParse(raw, null as number | null);
  if (parsed === null) return 0;
  return typeof parsed === 'number' && parsed >= 0 ? parsed : 0;
}

export function addCurrency(slot: SlotId, currencyId: string, amount: number): number {
  const current = getCurrency(slot, currencyId);
  const next = Math.max(0, current + Math.max(0, amount));
  
  // Enforce upper bound to prevent overflow
  const bounded = Math.min(next, MAX_CURRENCY_AMOUNT);
  if (bounded < next) {
    console.warn(`[Currencies] Currency amount capped at ${MAX_CURRENCY_AMOUNT}`);
  }
  
  localStorage.setItem(_currencyKey(slot, currencyId), JSON.stringify(bounded));
  return bounded;
}

export function spendCurrency(slot: SlotId, currencyId: string, amount: number): boolean {
  if (amount <= 0) return false;
  const current = getCurrency(slot, currencyId);
  if (current < amount) return false;
  localStorage.setItem(_currencyKey(slot, currencyId), JSON.stringify(current - amount));
  return true;
}
