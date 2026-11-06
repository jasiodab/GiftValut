import { pricingConfig } from "./config";

type CacheEntry<T> = { value: T; expiresAt: number };
const store = new Map<string, CacheEntry<any>>();
const MAX_ENTRIES = 500;

function makeRoom(now: number) {
  if (store.size < MAX_ENTRIES) return;
  for (const [key, entry] of store) {
    if (entry.expiresAt <= now) store.delete(key);
  }
  while (store.size >= MAX_ENTRIES) {
    const oldestKey = store.keys().next().value;
    if (!oldestKey) break;
    store.delete(oldestKey);
  }
}

export const priceCache = {
  get<T>(key: string): T | null {
    const e = store.get(key);
    if (!e) return null;
    if (e.expiresAt < Date.now()) { store.delete(key); return null; }
    return e.value as T;
  },
  set<T>(key: string, value: T, ttlSeconds?: number) {
    const now = Date.now();
    makeRoom(now);
    store.delete(key);
    store.set(key, { value, expiresAt: now + (ttlSeconds ?? pricingConfig.cacheTtlSeconds) * 1000 });
  },
  delete(key: string) { store.delete(key); },
  clear() { store.clear(); }
};
