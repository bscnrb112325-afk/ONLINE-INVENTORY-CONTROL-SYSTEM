/**
 * Cache Service
 * Simulates a Redis-like in-memory data store for the POS and Inventory real-time lookups.
 * In a production environment, this would be backed by `redis` or `ioredis`.
 */

class CacheService {
  private store: Map<string, any>;

  constructor() {
    this.store = new Map();
  }

  // Get a value from the cache
  async get(key: string): Promise<any> {
    console.log(`[CacheService - Redis Simulated] GET ${key}`);
    return this.store.get(key);
  }

  // Set a value in the cache with an optional TTL in seconds
  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    console.log(`[CacheService - Redis Simulated] SET ${key}`);
    this.store.set(key, value);
    
    // Simulate TTL
    if (ttlSeconds) {
      setTimeout(() => {
        this.store.delete(key);
      }, ttlSeconds * 1000);
    }
  }

  // Delete a key
  async del(key: string): Promise<void> {
    console.log(`[CacheService - Redis Simulated] DEL ${key}`);
    this.store.delete(key);
  }

  // Clear all
  async flush(): Promise<void> {
    console.log(`[CacheService - Redis Simulated] FLUSHALL`);
    this.store.clear();
  }
}

export const cacheService = new CacheService();
