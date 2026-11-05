import { pricingConfig } from "./config";

type CacheEntry<T> = { value: T; expiresAt: number };
const store = new Map<string, CacheEntry<any>>();

export const priceCache = {
  get<T>(key: string): T | null {
    const e = store.get(key);
    if (!e) return null;
    if (e.expiresAt < Date.now()) { store.delete(key); return null; }
    return e.value as T;
  },
  set<T>(key: string, value: T, ttlSeconds?: number) {
    store.set(key, { value, expiresAt: Date.now() + (ttlSeconds ?? pricingConfig.cacheTtlSeconds) * 1000 });
  },
  delete(key: string) { store.delete(key); },
  clear() { store.clear(); }
};
