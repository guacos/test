import * as Crypto from 'expo-crypto';

/** Erzeugt eine weltweit eindeutige ID (UUID v4). */
export function neueId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return Crypto.randomUUID();
}
