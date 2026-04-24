const MASTER_SEED = 'eos_progression_master_seed_v1';
const SALT = 'eos_salt_v1';
const ENCODER = new TextEncoder();
const PBKDF2_ITERATIONS = 100000;

type SlotKeyMap = Record<number, CryptoKey | undefined>;
const keyCache: SlotKeyMap = { 1: undefined, 2: undefined, 3: undefined };

async function deriveKey(seed: string): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    ENCODER.encode(seed),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: ENCODER.encode(SALT),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'HMAC', hash: 'SHA-256', length: 256 },
    false,
    ['sign', 'verify']
  );
}

export async function ensureSlotKey(slot: number): Promise<CryptoKey> {
  if (!keyCache[slot]) {
    keyCache[slot] = await deriveKey(`${MASTER_SEED}_slot_${slot}`);
  }
  return keyCache[slot]!;
}

export function getCachedSlotKey(slot: number): CryptoKey | null {
  return keyCache[slot] ?? null;
}

export interface SlotBoundData<T> {
  slot: number;
  data: T;
  timestamp: number;
}

export async function createSignedPayload<T>(slot: number, data: T): Promise<{ payload: string; signature: string }> {
  const key = await ensureSlotKey(slot);
  
  const payload: SlotBoundData<T> = {
    slot,
    data,
    timestamp: Date.now(),
  };
  
  const payloadStr = JSON.stringify(payload);
  const payloadBytes = ENCODER.encode(payloadStr);
  const signatureBytes = await crypto.subtle.sign('HMAC', key, payloadBytes);
  const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBytes)));
  
  return { payload: payloadStr, signature };
}

export async function verifySignedPayload<T>(
  slot: number,
  payloadStr: string,
  signature: string
): Promise<T | null> {
  try {
    const key = await ensureSlotKey(slot);
    const payloadBytes = ENCODER.encode(payloadStr);
    const signatureBytes = Uint8Array.from(atob(signature), c => c.charCodeAt(0));
    
    const valid = await crypto.subtle.verify('HMAC', key, signatureBytes, payloadBytes);
    if (!valid) return null;
    
    const parsed = JSON.parse(payloadStr) as SlotBoundData<T>;
    if (parsed.slot !== slot) return null;
    
    return parsed.data;
  } catch {
    return null;
  }
}

if (typeof window !== 'undefined' && window.addEventListener) {
  window.addEventListener('beforeunload', () => {
    keyCache[1] = undefined;
    keyCache[2] = undefined;
    keyCache[3] = undefined;
  });
}
