import type { Owner } from '../../types.js';

type DispatchFn = (amount: number, owner: Owner) => void;

let _dispatch: DispatchFn | null = null;

export function setDamageNumberDispatch(fn: DispatchFn | null) {
  _dispatch = fn;
}

export function showDamageNumber(amount: number, owner: Owner): void {
  _dispatch?.(amount, owner);
}
