export class CacheService {
  private static cache = new Map<string, { data: any; expiry: number }>();

  static async get(key: string) {
    const cached = this.cache.get(key);
    if (cached && cached.expiry > Date.now()) {
      return cached.data;
    }
    this.cache.delete(key);
    return null;
  }

  static set(key: string, data: any, ttlMs = 300000) { // 5min default
    this.cache.set(key, {
      data,
      expiry: Date.now() + ttlMs
    });
  }

  static async getOrFetch(key: string, fetchFn: () => Promise<any>, ttlMs = 300000) {
    let data = await this.get(key);
    if (!data) {
      data = await fetchFn();
      this.set(key, data, ttlMs);
    }
    return data;
  }
}