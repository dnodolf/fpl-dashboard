/**
 * Cache Manager
 * Client-side localStorage cache management with compression and cleanup
 */

const CACHE_KEY = 'fpl_dashboard_cache';
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

const CacheManager = {
  // Get size of data in bytes
  getDataSize: (obj) => {
    return new Blob([JSON.stringify(obj)]).size;
  },

  // Check if localStorage has enough space
  checkStorageSpace: () => {
    try {
      // Try to get rough localStorage usage
      let totalSize = 0;
      for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          totalSize += localStorage[key].length;
        }
      }
      return totalSize;
    } catch (error) {
      return 0;
    }
  },

  // Clean up old cache data and other stale items
  cleanupStorage: () => {
    try {
      if (process.env.NODE_ENV === 'development') {
        console.log('🧹 Cleaning up localStorage...');
      }

      // Remove old FPL cache
      localStorage.removeItem(CACHE_KEY);

      // Remove other potential cache items that might be stale
      const keysToCheck = Object.keys(localStorage);
      keysToCheck.forEach(key => {
        if (key.includes('cache') || key.includes('temp') || key.includes('old')) {
          try {
            localStorage.removeItem(key);
          } catch (e) {
            // Continue cleanup even if one item fails
          }
        }
      });

      if (process.env.NODE_ENV === 'development') {
        console.log('✅ localStorage cleanup completed');
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('⚠️ Storage cleanup failed:', error);
      }
    }
  },

  // Compress data by removing non-essential fields
  compressData: (data) => {
    if (!data || !data.players) return data;

    const compressed = {
      ...data,
      players: data.players.map(player => {
        // Keep only essential fields for caching
        return {
          // Core identity
          player_id: player.player_id,
          name: player.name,
          full_name: player.full_name,
          web_name: player.web_name,
          position: player.position,
          team: player.team,
          team_abbr: player.team_abbr,

          // Essential stats only
          predictions: player.predictions,
          season_prediction_avg: player.season_prediction_avg,
          current_gw_prediction: player.current_gw_prediction,
          news: player.news,
          injury_status: player.injury_status,

          // Sleeper data (minimal)
          owned_by: player.owned_by,
          sleeper_season_total: player.sleeper_season_total,
          sleeper_season_avg: player.sleeper_season_avg,

          // V3 data (if exists)
          v3_season_total: player.v3_season_total,
          v3_season_avg: player.v3_season_avg,
          v3_current_gw: player.v3_current_gw,

          // Market data
          now_cost: player.now_cost,
          ownership_percentage: player.ownership_percentage,

          // Remove large fields like:
          // - sleeper_gw_predictions (JSON strings)
          // - ffh_gw_predictions (JSON strings)
          // - detailed match history
          // - other verbose fields
        };
      })
    };

    return compressed;
  },

  set: (data) => {
    try {
      // First, try with compressed data
      const compressedData = CacheManager.compressData(data);
      const cacheData = {
        data: compressedData,
        timestamp: Date.now(),
        compressed: true
      };

      const dataString = JSON.stringify(cacheData);
      const dataSize = new Blob([dataString]).size;

      // Log cache size for monitoring (deduplicated)
      const sizeStr = `${(dataSize / 1024 / 1024).toFixed(2)}MB (compressed)`;
      if (process.env.NODE_ENV === 'development') {
        if (typeof window !== 'undefined' && (!window._lastCacheLog || window._lastCacheLog !== sizeStr)) {
          console.log(`💾 Cache size: ${sizeStr}`);
          window._lastCacheLog = sizeStr;
        }
      }

      // Check if still too large (>4MB threshold for safety)
      if (dataSize > 4 * 1024 * 1024) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('📦 Data still too large after compression, skipping cache');
        }
        return;
      }

      // Try to save
      localStorage.setItem(CACHE_KEY, dataString);

    } catch (error) {
      if (error.name === 'QuotaExceededError') {
        if (process.env.NODE_ENV === 'development') {
          console.warn('📦 Storage quota exceeded, attempting cleanup...');
        }

        // Clean up storage and try again
        CacheManager.cleanupStorage();

        try {
          // Try again with compressed data
          const compressedData = CacheManager.compressData(data);
          const cacheData = {
            data: compressedData,
            timestamp: Date.now(),
            compressed: true
          };
          localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
          if (process.env.NODE_ENV === 'development') {
            console.log('✅ Compressed cache saved after cleanup');
          }
        } catch (retryError) {
          if (process.env.NODE_ENV === 'development') {
            console.warn('❌ Cache save failed even after compression and cleanup. Skipping cache.');
          }
          // Don't cache this time, but continue without failing
        }
      } else {
        if (process.env.NODE_ENV === 'development') {
          console.warn('Could not save to cache:', error);
        }
      }
    }
  },

  get: () => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (!cached) return null;

      const cacheData = JSON.parse(cached);
      const age = Date.now() - cacheData.timestamp;

      if (age > CACHE_DURATION) {
        localStorage.removeItem(CACHE_KEY);
        return null;
      }

      return {
        ...cacheData.data,
        fromCache: true,
        cacheAge: Math.round(age / 1000) // seconds
      };
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('Could not read from cache:', error);
      }
      return null;
    }
  },

  clear: () => {
    try {
      localStorage.removeItem(CACHE_KEY);
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('Could not clear cache:', error);
      }
    }
  },

  getAge: () => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (!cached) return null;

      const cacheData = JSON.parse(cached);
      return Math.round((Date.now() - cacheData.timestamp) / 1000);
    } catch (error) {
      return null;
    }
  }
};

/**
 * Get data freshness status
 * @param {string|number} lastUpdated - Last update timestamp
 * @returns {Object} Status object with status, message, and color
 */
export const getDataFreshnessStatus = (lastUpdated) => {
  if (!lastUpdated) return { status: 'unknown', message: 'Unknown', color: 'gray' };

  const now = Date.now();
  const updateTime = new Date(lastUpdated).getTime();
  const ageMinutes = Math.round((now - updateTime) / (1000 * 60));

  if (ageMinutes < 30) {
    return { status: 'fresh', message: `${ageMinutes}m ago`, color: 'green' };
  } else if (ageMinutes < 120) {
    return { status: 'stale', message: `${ageMinutes}m ago`, color: 'yellow' };
  } else {
    const ageHours = Math.round(ageMinutes / 60);
    return { status: 'old', message: `${ageHours}h ago`, color: 'red' };
  }
};

/**
 * Format cache age in human-readable format
 * @param {number} ageSeconds - Age in seconds
 * @returns {string} Formatted age string
 */
export const formatCacheAge = (ageSeconds) => {
  if (!ageSeconds) return '';

  if (ageSeconds < 60) {
    return 'less than a minute ago';
  } else if (ageSeconds < 3600) {
    const minutes = Math.round(ageSeconds / 60);
    return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
  } else if (ageSeconds < 86400) {
    const hours = Math.round(ageSeconds / 3600);
    return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  } else {
    const days = Math.round(ageSeconds / 86400);
    return `${days} day${days !== 1 ? 's' : ''} ago`;
  }
};

export default CacheManager;
