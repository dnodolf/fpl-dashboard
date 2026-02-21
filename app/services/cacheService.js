// app/services/cacheService.js
class CacheService {
  constructor() {
    this.memoryCache = new Map();
    this.cacheExpiry = new Map();
    
    // Cache duration strategies
    this.cacheDurations = {
      'ffh-players': 10 * 60 * 1000,        // 10 minutes - predictions change
      'sleeper-rosters': 1 * 60 * 1000,    // 1 minute - rosters can change frequently  
      'player-matches': 24 * 60 * 60 * 1000, // 24 hours - matches rarely change
      'scoring-ratios': 7 * 24 * 60 * 60 * 1000, // 7 days - scoring systems stable
      'sheets-data': 5 * 60 * 1000          // 5 minutes - manual updates
    };
  }

  set(key, data, customTTL = null) {
    const cacheType = this.getCacheType(key);
    const ttl = customTTL || this.cacheDurations[cacheType] || 5 * 60 * 1000;
    
    this.memoryCache.set(key, {
      data,
      timestamp: Date.now(),
      type: cacheType
    });
    
    this.cacheExpiry.set(key, Date.now() + ttl);
    
    // Cleanup old entries periodically
    this.cleanup();
  }

  get(key) {
    if (!this.memoryCache.has(key)) return null;
    
    const expiry = this.cacheExpiry.get(key);
    if (Date.now() > expiry) {
      this.delete(key);
      return null;
    }
    
    const cached = this.memoryCache.get(key);
    return {
      ...cached.data,
      _cached: true,
      _age: Date.now() - cached.timestamp
    };
  }

  getCacheType(key) {
    if (key.includes('ffh')) return 'ffh-players';
    if (key.includes('sleeper-roster')) return 'sleeper-rosters';
    if (key.includes('match')) return 'player-matches';
    if (key.includes('scoring')) return 'scoring-ratios';
    if (key.includes('sheets')) return 'sheets-data';
    return 'default';
  }

  // Cache statistics for monitoring
  getStats() {
    const stats = {
      totalEntries: this.memoryCache.size,
      byType: {},
      hitRate: 0, // Would need to track hits/misses
      oldestEntry: null,
      newestEntry: null
    };

    for (const [key, value] of this.memoryCache.entries()) {
      const type = value.type;
      stats.byType[type] = (stats.byType[type] || 0) + 1;
      
      if (!stats.oldestEntry || value.timestamp < stats.oldestEntry) {
        stats.oldestEntry = value.timestamp;
      }
      if (!stats.newestEntry || value.timestamp > stats.newestEntry) {
        stats.newestEntry = value.timestamp;
      }
    }

    return stats;
  }

  cleanup() {
    const now = Date.now();
    for (const [key, expiry] of this.cacheExpiry.entries()) {
      if (now > expiry) {
        this.delete(key);
      }
    }
  }

  delete(key) {
    this.memoryCache.delete(key);
    this.cacheExpiry.delete(key);
  }

  clear() {
    this.memoryCache.clear();
    this.cacheExpiry.clear();
  }
}

export const cacheService = new CacheService();