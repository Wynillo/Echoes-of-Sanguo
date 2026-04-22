import type { SlotId } from './progression.js';
import { MAX_CURRENCY_AMOUNT } from './economy-config.js';
import { verifyHMAC, deriveKey } from './storage-security.js';

const CURRENCY_ID_COINS = 'coins';
const HMAC_CACHE = new Map<SlotId, Promise<string>>();

function _currencyKey(slot: SlotId, currencyId: string): string {
  return `tcg_s${slot}_currency_${currencyId}`;
}

async function getCachedKey(slot: SlotId): Promise<string> {
  if (!HMAC_CACHE.has(slot)) {
    HMAC_CACHE.set(slot, deriveKey(`eos-hmac-v1-currency-s${slot}`));
  }
  return HMAC_CACHE.get(slot)!;
}

export async function verifyCurrencyIntegrity(slot: SlotId): Promise<boolean> {
  try {
    const key = await getCachedKey(slot);
    const currencyKey = _currencyKey(slot, CURRENCY_ID_COINS);
    
    const raw = localStorage.getItem(currencyKey);
    const sig = localStorage.getItem(currencyKey + '.hmac');
    const ts = localStorage.getItem(currencyKey + '.ts');
    
    if (sig === null || ts === null || raw === null) {
      return true;
    }
    
    const wrapped = JSON.stringify({ data: raw, ts });
    return verifyHMAC(key, wrapped, sig);
  } catch {
    return false;
  }
}

export async function signCurrencyValue(slot: SlotId, value: number): Promise<void> {
  const { computeHMAC } = await import('./storage-security.js');
  const key = await getCachedKey(slot);
  const currencyKey = _currencyKey(slot, CURRENCY_ID_COINS);
  
  const wrapped = JSON.stringify({ data: String(value), ts: Date.now() });
  const sig = await computeHMAC(key, wrapped);
  
  localStorage.setItem(currencyKey, String(value));
  localStorage.setItem(currencyKey + '.hmac', sig);
  localStorage.setItem(currencyKey + '.ts', String(Date.now()));
}

export function getCurrency(slot: SlotId, currencyId: string): number {
  const key = _currencyKey(slot, currencyId);
  const raw = localStorage.getItem(key);
  
  if (raw === null || raw === '') return 0;
  
  if (/\b(__proto__|constructor|prototype)\b/.test(raw)) {
    console.warn('[Currencies] Blocked prototype pollution attempt.');
    return 0;
  }
  
  try {
    const parsed = JSON.parse(raw) as number;
    if (typeof parsed !== 'number' || parsed < 0) return 0;
    return parsed;
  } catch {
    return 0;
  }
}

export function addCurrency(slot: SlotId, currencyId: string, amount: number): number {
  const key = _currencyKey(slot, currencyId);
  const current = getCurrency(slot, currencyId);
  const next = Math.max(0, current + Math.max(0, amount));
  const bounded = Math.min(next, MAX_CURRENCY_AMOUNT);
  
  if (bounded < next) {
    console.warn(`[Currencies] Currency amount capped at ${MAX_CURRENCY_AMOUNT}`);
  }
  
  localStorage.setItem(key, String(bounded));
  return bounded;
}

export function spendCurrency(slot: SlotId, currencyId: string, amount: number): boolean {
  if (amount <= 0) return false;
  const key = _currencyKey(slot, currencyId);
  const current = getCurrency(slot, currencyId);
  if (current < amount) return false;
  localStorage.setItem(key, String(current - amount));
  return true;
}
