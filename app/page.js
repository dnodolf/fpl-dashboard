'use client';

import { useState, useEffect } from 'react';
import GameweekService from './services/gameweekService';
import v3ScoringService from './services/v3ScoringService';
import { OptimizerTabContent } from './components/OptimizerTabContent';
import TransferTabContent from './components/TransferTabContent';
import ComparisonTabContent from './components/ComparisonTabContent';

// ----------------- EPL TEAMS FILTER -----------------
const EPL_TEAMS = [
  'Arsenal', 'Aston Villa', 'Bournemouth', 'Brentford', 'Brighton', 
  'Burnley', 'Chelsea', 'Crystal Palace', 'Everton', 'Fulham', 
  'Leeds United', 'Liverpool', 'Man. City', 'Manchester Utd', 'Newcastle', 
  'Nottingham', 'Sunderland', 'Tottenham', 'West Ham', 'Wolves'
];

// Team mappings for display name to data value
const TEAM_MAPPINGS = {
  'Arsenal': 'ARS', 'Aston Villa': 'AVL', 'Bournemouth': 'BOU', 
  'Brentford': 'BRE', 'Brighton': 'BHA', 'Burnley': 'BUR',
  'Chelsea': 'CHE', 'Crystal Palace': 'CRY', 'Everton': 'EVE', 
  'Fulham': 'FUL', 'Leeds United': 'LEE', 'Liverpool': 'LIV', 
  'Man. City': 'MCI', 'Manchester Utd': 'MUN', 'Newcastle': 'NEW', 
  'Nottingham': 'NFO', 'Sunderland': 'SUN', 'Tottenham': 'TOT', 
  'West Ham': 'WHU', 'Wolves': 'WOL'
};

// Reverse mapping for abbreviation to display name
const TEAM_DISPLAY_NAMES = Object.fromEntries(
  Object.entries(TEAM_MAPPINGS).map(([display, abbrev]) => [abbrev, display])
);

// Helper function to check if player is on EPL team
const isEPLPlayer = (player) => {
  // The actual team abbreviations are in team_abbr, not team
  const playerTeamAbbr = (player.team_abbr || '').trim();
  
  // Check if the team_abbr matches any EPL team abbreviation
  return Object.values(TEAM_MAPPINGS).includes(playerTeamAbbr);
};

// ----------------- LOADING SPINNER COMPONENT -----------------
const LoadingSpinner = ({ message = "Loading..." }) => (
  <div className="flex items-center justify-center p-8">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mr-3"></div>
    <span className="text-white">{message}</span>
  </div>
);

// ----------------- ERROR BOUNDARY COMPONENT -----------------
const ErrorBoundary = ({ children }) => {
  const [hasError, setHasError] = useState(false);
  
  useEffect(() => {
    const handleError = () => setHasError(true);
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (hasError) {
    return (
      <div className="text-center p-8">
        <h2 className="text-white">Something went wrong.</h2>
        <button onClick={() => setHasError(false)} className="mt-4 px-4 py-2 bg-blue-500 text-white rounded">
          Try again
        </button>
      </div>
    );
  }

  return children;
};

// ----------------- CURRENT GAMEWEEK FUNCTION -----------------
const getCurrentGameweek = async () => {
  try {
    return await GameweekService.getCurrentGameweek();
  } catch (error) {
    console.error('Error getting current gameweek:', error);
    // Return a safe fallback
    return {
      number: 2,
      status: 'upcoming',
      statusDisplay: '🏁 GW 2 (Upcoming)',
      date: 'Aug 22',
      fullDate: '2025-08-22',
      source: 'error_fallback'
    };
  }
};

// ----------------- CACHE MANAGER -----------------
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
      console.log('🧹 Cleaning up localStorage...');

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

      console.log('✅ localStorage cleanup completed');
    } catch (error) {
      console.warn('⚠️ Storage cleanup failed:', error);
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
      if (!window._lastCacheLog || window._lastCacheLog !== sizeStr) {
        console.log(`💾 Cache size: ${sizeStr}`);
        window._lastCacheLog = sizeStr;
      }

      // Check if still too large (>4MB threshold for safety)
      if (dataSize > 4 * 1024 * 1024) {
        console.warn('📦 Data still too large after compression, skipping cache');
        return;
      }

      // Try to save
      localStorage.setItem(CACHE_KEY, dataString);

    } catch (error) {
      if (error.name === 'QuotaExceededError') {
        console.warn('📦 Storage quota exceeded, attempting cleanup...');

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
          console.log('✅ Compressed cache saved after cleanup');
        } catch (retryError) {
          console.warn('❌ Cache save failed even after compression and cleanup. Skipping cache.');
          // Don't cache this time, but continue without failing
        }
      } else {
        console.warn('Could not save to cache:', error);
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
      console.warn('Could not read from cache:', error);
      return null;
    }
  },

  clear: () => {
    try {
      localStorage.removeItem(CACHE_KEY);
    } catch (error) {
      console.warn('Could not clear cache:', error);
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

// ----------------- DATA FRESHNESS UTILS -----------------
const getDataFreshnessStatus = (lastUpdated) => {
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

const formatCacheAge = (ageSeconds) => {
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

// ----------------- CUSTOM HOOK FOR PLAYER DATA -----------------
function usePlayerData() {
  const [data, setData] = useState({
    players: [],
    loading: true,
    error: null,
    lastUpdated: null,
    source: 'loading',
    quality: null,
    ownershipData: false,
    ownershipCount: 0,
    enhanced: false,
    integrated: false,
    integration: null
  });

  const fetchData = async (type = 'auto', forceRefresh = false, useCache = true) => {
    try {
      setData(prev => ({ ...prev, loading: true, error: null }));

      if (!forceRefresh && useCache) {
        const cachedData = CacheManager.get();
        if (cachedData) {
          setData(prev => ({
            ...prev,
            loading: false,
            ...cachedData
          }));
          return;
        }
      }
      const response = await fetch('/api/integrated-players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          includeMatching: true,
          includeScoring: true,
          forceRefresh
        })
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const result = await response.json();
      
      // Direct check for players array
      if (result.players && Array.isArray(result.players)) {
        const newData = {
          players: result.players,
          loading: false,
          error: null,
          lastUpdated: result.timestamp,
          source: 'integrated',
          quality: 'high',
          ownershipData: true,
          enhanced: true,
          cached: result.cached || false,
          ownershipCount: result.count || result.players.length,
          integrated: true,
          integration: result.stats
        };

        CacheManager.set(newData);
        setData(newData);
      } else {
        throw new Error('No player data received from API');
      }
    } catch (error) {
      console.error('Error fetching player data:', error);
      setData(prev => ({
        ...prev,
        loading: false,
        error: error.message
      }));
    }
  };

  useEffect(() => {
    fetchData('auto', false, true);
  }, []);

  return { ...data, refetch: fetchData };
}

// Update data function with caching
const fetchData = async (type = 'auto', forceRefresh = false, useCache = true) => {
  try {
    setData(prev => ({ ...prev, loading: true, error: null }));

    // Check cache first unless force refresh
    if (!forceRefresh && useCache) {
      const cachedData = CacheManager.get();
      if (cachedData) {
        console.log('⚡ Loading from cache');
        setData(prev => ({
          ...prev,
          loading: false,
          ...cachedData
        }));
        return;
      }
    }

    console.log('🔄 Fetching fresh data from API');
    
    const response = await fetch('/api/integrated-players', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        includeMatching: true,
        includeScoring: true,
        forceRefresh
      })
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    const result = await response.json();
    
    // ADD DEBUG LINES:
    console.log('🔍 API Response received:', {
      hasPlayers: !!result.players,
      playersLength: result.players?.length,
      isArray: Array.isArray(result.players),
      firstPlayer: result.players?.[0]?.name,
      resultKeys: Object.keys(result)
    });
    
    // Check if we have players data (API working) instead of success field
    if (result.players && Array.isArray(result.players)) {
      console.log('✅ Setting player data:', result.players.length, 'players');
      
      const newData = {
        players: result.players,
        loading: false,
        error: null,
        lastUpdated: result.timestamp,
        source: 'integrated',
        quality: 'high',
        ownershipData: true,
        enhanced: true,
        cached: result.cached || false,
        ownershipCount: result.count || result.players.length,
        integrated: true,
        integration: result.stats
      };

      // Save to cache
      CacheManager.set(newData);
      
      setData(newData);
      console.log('✅ State should be updated with:', newData.players.length, 'players');
    } else {
      throw new Error(result.error || 'Failed to fetch integrated player data');
    }
  } catch (error) {
    console.error('❌ Error fetching player data:', error);
    setData(prev => ({
      ...prev,
      loading: false,
      error: error.message
    }));
  }
};

// ----------------- SLEEPER POSITION COLORS -----------------
const getSleeperPositionStyle = (position) => {
  switch (position) {
    case 'GKP':
    case 'GK':
    case 'G':
      // Sleeper GKP: Better contrast yellow
      return 'bg-yellow-600 text-white border border-yellow-500'; 
    case 'DEF':
    case 'D':
      // Sleeper DEF: Better contrast cyan
      return 'bg-cyan-600 text-white border border-cyan-500'; 
    case 'MID':
    case 'M':
      // Sleeper MID: Better contrast pink
      return 'bg-pink-600 text-white border border-pink-500'; 
    case 'FWD':
    case 'F':
      // Sleeper FWD: Better contrast purple
      return 'bg-purple-600 text-white border border-purple-500'; 
    default:
      return 'bg-gray-600 text-white border border-gray-500';
  }
};

// ----------------- NEW: ENHANCED MATCHING STATS COMPONENT -----------------
const MatchingStats = ({ players, integration }) => {
  const optaAnalysis = integration?.optaAnalysis;
  
  if (!optaAnalysis) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className={`p-4 rounded-lg shadow-sm bg-gray-800`}>
          <div className="text-center">
            <div className="text-lg font-medium text-gray-500">Loading matching statistics...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      {/* Sleeper Players with Opta ID */}
      <div className={`p-4 rounded-lg shadow-sm bg-gray-800`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold text-blue-600">
              {optaAnalysis.sleeperWithOpta?.toLocaleString()}/{integration.sleeperTotal?.toLocaleString()}
            </div>
            <div className={`text-sm text-gray-400`}>
              Sleeper w/ Opta ({optaAnalysis.sleeperOptaRate}%)
            </div>
          </div>
          <div className="text-blue-500 text-2xl">👥</div>
        </div>
      </div>

      {/* FFH Players with Opta ID */}
      <div className={`p-4 rounded-lg shadow-sm bg-gray-800`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold text-green-600">
              {optaAnalysis.ffhWithOpta?.toLocaleString()}/{integration.ffhTotal?.toLocaleString()}
            </div>
            <div className={`text-sm text-gray-400`}>
              FFH w/ Opta ({optaAnalysis.ffhOptaRate}%)
            </div>
          </div>
          <div className="text-green-500 text-2xl">⚽</div>
        </div>
      </div>

      {/* Successful Matches */}
      <div className={`p-4 rounded-lg shadow-sm bg-gray-800`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold text-purple-600">
              {optaAnalysis.optaMatches?.toLocaleString()}/{optaAnalysis.ffhWithOpta?.toLocaleString()}
            </div>
            <div className={`text-sm text-gray-400`}>
              Successful Matches ({optaAnalysis.optaMatchRate}%)
            </div>
          </div>
          <div className="text-purple-500 text-2xl">🔗</div>
        </div>
      </div>

      {/* Unmatched Sleeper Players */}
      <div className={`p-4 rounded-lg shadow-sm bg-gray-800`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold text-orange-600">
              {optaAnalysis.unmatchedSleeperWithOpta?.length?.toLocaleString() || 0}
            </div>
            <div className={`text-sm text-gray-400`}>
              Unmatched Sleeper w/ Opta
            </div>
          </div>
          <div className="text-orange-500 text-2xl">❌</div>
        </div>
      </div>
    </div>
  );
};

// ----------------- OTHER STATS COMPONENTS (UNCHANGED) -----------------
const OptimizerStats = ({ scoringMode = 'existing', currentGameweek = { number: 4 } }) => {
  const [rawData, setRawData] = useState(null); // Store raw API data
  const [stats, setStats] = useState({
    currentPoints: 0,
    optimalPoints: 0,
    optimalPlayerPercentage: 0,
    playersToSwap: 0,
    optimalPlayersInCurrent: 0,
    totalPlayers: 11
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOptimizerStats = async () => {
      try {
        const response = await fetch('/api/optimizer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            userId: 'ThatDerekGuy', 
            forceRefresh: false,
            scoringMode: scoringMode,
            currentGameweek: currentGameweek.number || 4
          })
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            // Store raw data for recalculation
            setRawData(data);
          }
        }
      } catch (error) {
        console.error('Failed to fetch optimizer stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchOptimizerStats();
  }, [scoringMode, currentGameweek.number]); // Refetch when scoring mode or gameweek changes

  // Recalculate stats when scoring mode or raw data changes
  useEffect(() => {
    if (!rawData) return;

    // Quiet recalculation - only log final results
    
    const { current, optimal } = rawData;
    
    // Calculate points using the same logic as OptimizerTabContent
    const currentPoints = current?.players ? current.players.reduce((sum, player) => {
      let points = 0;
      if (scoringMode === 'v3') {
        points = player.v3_current_gw || 0;
      } else {
        points = player.current_gw_prediction || 0;
      }
      return sum + points;
    }, 0) : 0;

    const optimalPoints = optimal?.players ? optimal.players.reduce((sum, player) => {
      let points = 0;
      if (scoringMode === 'v3') {
        points = player.v3_current_gw || 0;
      } else {
        points = player.current_gw_prediction || 0;
      }
      return sum + points;
    }, 0) : 0;

    console.log(`📊 Points: ${Math.round(currentPoints * 100) / 100} → ${Math.round(optimalPoints * 100) / 100} (${scoringMode})`);

    // Calculate optimal player stats
    const optimalPlayerIds = optimal?.players?.map(p => p.id || p.player_id || p.sleeper_id) || [];
    const currentPlayerIds = current?.players?.map(p => p.id || p.player_id || p.sleeper_id) || [];
    
    const optimalPlayersInCurrent = currentPlayerIds.filter(id => optimalPlayerIds.includes(id)).length;
    const totalPlayers = currentPlayerIds.length || 11;
    const optimalPlayerPercentage = totalPlayers > 0 ? (optimalPlayersInCurrent / totalPlayers) * 100 : 0;
    
    setStats({
      currentPoints,
      optimalPoints,
      optimalPlayerPercentage,
      playersToSwap: totalPlayers - optimalPlayersInCurrent,
      optimalPlayersInCurrent,
      totalPlayers
    });
  }, [rawData, scoringMode]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className={`p-4 rounded-lg shadow-sm bg-gray-800`}>
            <div className="animate-pulse">
              <div className="h-8 bg-gray-300 rounded mb-2"></div>
              <div className="h-4 bg-gray-300 rounded"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      {/* Current Roster Points */}
      <div className={`p-4 rounded-lg shadow-sm bg-gray-800`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold text-blue-600">{stats.currentPoints.toFixed(1)}</div>
            <div className={`text-sm text-gray-400`}>Current Roster Points</div>
          </div>
          <div className="text-blue-500 text-2xl">⚽</div>
        </div>
      </div>

      {/* Optimized Roster Points */}
      <div className={`p-4 rounded-lg shadow-sm bg-gray-800`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold text-green-600">{stats.optimalPoints.toFixed(1)}</div>
            <div className={`text-sm text-gray-400`}>Optimized Roster Points</div>
          </div>
          <div className="text-green-500 text-2xl">🎯</div>
        </div>
      </div>

      {/* % Optimal Players */}
      <div className={`p-4 rounded-lg shadow-sm bg-gray-800`}>
        <div className="flex items-center justify-between">
          <div>
            <div className={`text-2xl font-bold ${
              stats.optimalPlayerPercentage >= 80 
                ? 'text-green-600'
                : stats.optimalPlayerPercentage >= 60
                  ? 'text-yellow-600'
                  : 'text-red-600'
            }`}>
              {stats.optimalPlayerPercentage.toFixed(0)}%
            </div>
            <div className={`text-sm text-gray-400`}>
              % Optimal Players ({stats.optimalPlayersInCurrent}/{stats.totalPlayers})
            </div>
          </div>
          <div className="text-purple-500 text-2xl">📊</div>
        </div>
      </div>

      {/* Players to Swap */}
      <div className={`p-4 rounded-lg shadow-sm bg-gray-800`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold text-red-600">{stats.playersToSwap}</div>
            <div className={`text-sm text-gray-400`}>Players to Swap</div>
          </div>
          <div className="text-red-500 text-2xl">🔄</div>
        </div>
      </div>
    </div>
  );
};

const TransferStats = ({ players, scoringMode = 'existing', gameweekRange }) => {
  // Calculate transfer analytics - FIX: Use correct ownership logic
  const freeAgents = players.filter(p => !p.owned_by || p.owned_by === 'Free Agent');
  const myPlayers = players.filter(p => p.owned_by === 'ThatDerekGuy'); // YOUR players specifically

  // Helper function to get player points (enhanced to match transfer tab logic with gameweek range support)
  const getPlayerPoints = (player) => {
    // If gameweek range is specified and valid, use gameweek range calculations
    if (gameweekRange && gameweekRange.start && gameweekRange.end) {
      return getGameweekRangePoints(player, gameweekRange.start, gameweekRange.end);
    }

    // Otherwise use season-based points
    if (scoringMode === 'v3') {
      return player.v3_season_avg || player.sleeper_season_avg || player.total_points || 0;
    }
    return player.sleeper_season_avg || player.sleeper_points_ros || player.total_points || 0;
  };

  // Gameweek range points calculation (same logic as TransferTabContent)
  function getGameweekRangePoints(player, startGW, endGW) {
    const gameweekCount = endGW - startGW + 1;

    // Check if player has gameweek-specific predictions
    if (!player.predictions || !Array.isArray(player.predictions) || player.predictions.length === 0) {
      // For players without predictions, use the same data source as Players tab
      let seasonTotal = 0;

      if (scoringMode === 'v3') {
        seasonTotal = player.v3_season_total || player.sleeper_season_total || player.predicted_points || 0;
      } else {
        seasonTotal = player.sleeper_season_total || player.predicted_points || 0;
      }

      if (seasonTotal > 0) {
        // Adjust proportionally for the gameweek range
        return (seasonTotal / 38) * gameweekCount;
      }

      // Final fallback to PPG if no season total available
      let fallbackPpg = 0;

      if (scoringMode === 'v3') {
        fallbackPpg = player.v3_season_avg || player.v3_current_gw || player.sleeper_season_avg || 0;
      } else {
        fallbackPpg = player.sleeper_season_avg || player.sleeper_points_ros / 38 || player.current_gw_prediction || 0;
      }

      return fallbackPpg * gameweekCount;
    }

    let totalPoints = 0;
    let predictionsFound = 0;

    for (let gw = startGW; gw <= endGW; gw++) {
      const prediction = player.predictions.find(p => p.gw === gw);
      if (prediction) {
        const gwPoints = scoringMode === 'v3'
          ? (prediction.v3_predicted_pts || prediction.predicted_pts || 0)
          : (prediction.predicted_pts || 0);
        totalPoints += gwPoints;
        predictionsFound++;
      }
    }

    // If we have some predictions but not all, extrapolate
    if (predictionsFound > 0 && predictionsFound < gameweekCount) {
      const avgPointsPerGW = totalPoints / predictionsFound;
      const missingGWs = gameweekCount - predictionsFound;
      totalPoints += avgPointsPerGW * missingGWs;
    }

    return totalPoints;
  }

  // Calculate position-specific upgrade counts
  const positions = ['FWD', 'MID', 'DEF', 'GKP'];
  const positionUpgrades = {};

  positions.forEach(position => {
    const myPositionPlayers = myPlayers.filter(p => p.position === position);
    const freeAgentsInPosition = freeAgents.filter(p => p.position === position);

    if (myPositionPlayers.length === 0) {
      positionUpgrades[position] = 0;
      return;
    }

    // Find worst player in my team for this position
    const worstMyPlayer = myPositionPlayers.reduce((worst, current) => {
      const worstPoints = getPlayerPoints(worst);
      const currentPoints = getPlayerPoints(current);
      return currentPoints < worstPoints ? current : worst;
    });

    const worstMyPlayerPoints = getPlayerPoints(worstMyPlayer);

    // Count how many free agents would outperform my worst player in this position
    const upgradeCount = freeAgentsInPosition.filter(fa => {
      const faPoints = getPlayerPoints(fa);
      return faPoints > worstMyPlayerPoints;
    }).length;

    positionUpgrades[position] = upgradeCount;
  });

  // Position configurations with emojis and colors
  const positionConfigs = {
    FWD: { emoji: '🎯', color: 'text-purple-600', bg: 'bg-purple-100', name: 'FWD' },
    MID: { emoji: '⚽', color: 'text-blue-600', bg: 'bg-blue-100', name: 'MID' },
    DEF: { emoji: '🛡️', color: 'text-green-600', bg: 'bg-green-100', name: 'DEF' },
    GKP: { emoji: '🥅', color: 'text-orange-600', bg: 'bg-orange-100', name: 'GKP' }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      {positions.map(position => {
        const config = positionConfigs[position];
        const upgradeCount = positionUpgrades[position];

        return (
          <div key={position} className={`p-4 rounded-lg shadow-sm bg-gray-800`}>
            <div className="flex items-center justify-between">
              <div>
                <div className={`text-2xl font-bold ${config.color}`}>{upgradeCount}</div>
                <div className={`text-sm text-gray-400`}>{config.name} Upgrades</div>
              </div>
              <div className="text-2xl">{config.emoji}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ----------------- NEW: UNMATCHED PLAYERS TABLE COMPONENT -----------------
// Enhanced UnmatchedPlayersTable with search and pagination

const UnmatchedPlayersTable = ({ optaAnalysis }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });

  const unmatchedPlayers = optaAnalysis?.unmatchedSleeperWithOpta || [];

  console.log('UNMATCHED PLAYERS RAW DATA:', unmatchedPlayers.slice(0, 3));

  if (unmatchedPlayers.length === 0) {
    return (
      <div className={`rounded-lg shadow-sm border p-6 text-center bg-gray-800 border-gray-700`}>
        <div className="text-green-600 text-4xl mb-2">🎉</div>
        <h3 className={`text-lg font-medium mb-2 text-white`}>
          Perfect Match Rate!
        </h3>
        <p className={'text-gray-400'}>
          All Sleeper players with Opta IDs have been successfully matched to FFH players.
        </p>
      </div>
    );
  }

  // Filter players based on search term
  const filteredPlayers = unmatchedPlayers.filter(player => {
    if (!searchTerm) return true;
    
    const searchLower = searchTerm.toLowerCase();
    const searchableText = [
      player.name || '',
      player.team || '',
      player.position || '',
      player.opta_id || ''
    ].join(' ').toLowerCase();
    
    return searchableText.includes(searchLower);
  });

  // Sort players
  const sortedPlayers = [...filteredPlayers].sort((a, b) => {
    const getValue = (player, key) => {
      switch (key) {
        case 'name': return (player.name || '').toLowerCase();
        case 'position': return player.position || '';
        case 'team': return player.team || '';
        case 'opta_id': return player.opta_id || '';
        default: return '';
      }
    };

    const aValue = getValue(a, sortConfig.key);
    const bValue = getValue(b, sortConfig.key);
    
    if (sortConfig.direction === 'asc') {
      return aValue.localeCompare(bValue);
    } else {
      return bValue.localeCompare(aValue);
    }
  });

  // Pagination
  const totalPages = Math.ceil(sortedPlayers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentPlayers = sortedPlayers.slice(startIndex, endIndex);

  // Handle sort
  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
    setCurrentPage(1); // Reset to first page when sorting
  };

  // Render sort icon
  const renderSortIcon = (columnKey) => {
    if (sortConfig.key !== columnKey) {
      return <span className="text-gray-400 ml-1">↕️</span>;
    }
    return sortConfig.direction === 'asc' ? 
      <span className="text-blue-500 ml-1">↑</span> : 
      <span className="text-blue-500 ml-1">↓</span>;
  };

  // Handle items per page change
  const handleItemsPerPageChange = (newItemsPerPage) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1); // Reset to first page
  };

  // Generate page numbers for pagination
  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;
    
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      const startPage = Math.max(1, currentPage - 2);
      const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
      
      if (startPage > 1) {
        pages.push(1);
        if (startPage > 2) pages.push('...');
      }
      
      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }
      
      if (endPage < totalPages) {
        if (endPage < totalPages - 1) pages.push('...');
        pages.push(totalPages);
      }
    }
    
    return pages;
  };

  return (
    <div className={`rounded-lg shadow-sm border overflow-hidden bg-gray-800 border-gray-700`}>
      {/* Header with Search and Controls */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className={`text-lg font-medium text-white`}>
              Unmatched Sleeper Players ({filteredPlayers.length}{searchTerm && ` of ${unmatchedPlayers.length}`})
            </h3>
            <p className={`text-sm mt-1 text-gray-400`}>
              These Sleeper players have Opta IDs but no corresponding FFH player was found.
            </p>
          </div>
          
          {/* Search and Items Per Page */}
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search Input */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search players..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1); // Reset to first page when searching
                }}
                className="w-full sm:w-64 px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-700 border-gray-600 text-white placeholder-gray-400"
              />
              {searchTerm && (
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setCurrentPage(1);
                  }}
                  className="absolute right-2 top-2 text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              )}
            </div>
            
            {/* Items Per Page */}
            <select
              value={itemsPerPage}
              onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
              className="px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-700 border-gray-600 text-white"
            >
              <option value={10}>10 per page</option>
              <option value={25}>25 per page</option>
              <option value={50}>50 per page</option>
              <option value={100}>100 per page</option>
              <option value={filteredPlayers.length}>Show all ({filteredPlayers.length})</option>
            </select>
          </div>
        </div>
      </div>
      
      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className={'bg-gray-700'}>
            <tr>
              <th 
                className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-opacity-75 ${
                  'text-gray-300 hover:bg-gray-600'
                }`}
                onClick={() => handleSort('name')}
              >
                <div className="flex items-center">
                  Player {renderSortIcon('name')}
                </div>
              </th>
              <th 
                className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-opacity-75 ${
                  'text-gray-300 hover:bg-gray-600'
                }`}
                onClick={() => handleSort('position')}
              >
                <div className="flex items-center">
                  Position {renderSortIcon('position')}
                </div>
              </th>
              <th 
                className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-opacity-75 ${
                  'text-gray-300 hover:bg-gray-600'
                }`}
                onClick={() => handleSort('team')}
              >
                <div className="flex items-center">
                  Team {renderSortIcon('team')}
                </div>
              </th>
              <th 
                className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-opacity-75 ${
                  'text-gray-300 hover:bg-gray-600'
                }`}
                onClick={() => handleSort('opta_id')}
              >
                <div className="flex items-center">
                  Opta ID {renderSortIcon('opta_id')}
                </div>
              </th>
            </tr>
          </thead>
          <tbody className={`divide-y ${'bg-gray-800 divide-gray-700'}`}>
{currentPlayers.length > 0 ? (
  currentPlayers.map((player, index) => (
    <tr key={`unmatched-${startIndex + index}`} className={`${'hover:bg-gray-700'}`}>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className={`text-sm font-medium text-white`}>
          {player.full_name || player.name || 'Unknown'}
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          getSleeperPositionStyle(player.position)
        }`}>
          {player.position || 'N/A'}
        </span>
      </td>
      <td className={`px-6 py-4 whitespace-nowrap text-sm text-gray-300`}>
        {player.team_abbr || player.team || 'Free Agent'}
      </td>
      <td className={`px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-400`}>
        {player.opta_id || 'N/A'}
      </td>
    </tr>
  ))
            ) : (
              <tr>
                <td colSpan={4} className={`px-6 py-4 text-center text-gray-400`}>
                  {searchTerm ? `No players found matching "${searchTerm}"` : 'No unmatched players'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      
      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className={`px-6 py-3 border-t flex items-center justify-between border-gray-700 bg-gray-750`}>
          {/* Results Info */}
          <div className={`text-sm text-gray-400`}>
            Showing {startIndex + 1} to {Math.min(endIndex, sortedPlayers.length)} of {sortedPlayers.length} results
            {searchTerm && ` (filtered from ${unmatchedPlayers.length} total)`}
          </div>
          
          {/* Pagination Controls */}
          <div className="flex items-center gap-2">
            {/* Previous Button */}
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                currentPage === 1
                  ? 'opacity-50 cursor-not-allowed'
                  : 'text-gray-300 hover:text-white hover:bg-gray-600'
              }`}
            >
              Previous
            </button>
            
            {/* Page Numbers */}
            <div className="flex items-center gap-1">
              {getPageNumbers().map((page, index) => (
                <button
                  key={index}
                  onClick={() => typeof page === 'number' && setCurrentPage(page)}
                  disabled={page === '...'}
                  className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                    page === currentPage
                      ? 'bg-blue-500 text-white'
                      : page === '...'
                      ? 'opacity-50 cursor-not-allowed'
                      : 'text-gray-300 hover:text-white hover:bg-gray-600'
                  }`}
                >
                  {page}
                </button>
              ))}
            </div>
            
            {/* Next Button */}
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                currentPage === totalPages
                  ? 'opacity-50 cursor-not-allowed'
                  : 'text-gray-300 hover:text-white hover:bg-gray-600'
              }`}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ----------------- NEW: MATCHING TAB CONTENT COMPONENT -----------------
const MatchingTabContent = ({ players, integration }) => {
  const optaAnalysis = integration?.optaAnalysis;
  
  return (
    <div className="space-y-6">
      {/* Summary Section */}
      <div className={`rounded-lg shadow-sm border p-6 bg-gray-800 border-gray-700`}>
        <h3 className={`text-lg font-medium mb-4 text-white`}>
          🎯 Opta-Only Matching Summary
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className={`text-sm font-medium mb-2 text-gray-300`}>
              Coverage Analysis
            </h4>
            <ul className={`text-sm space-y-1 text-gray-400`}>
              <li>• {optaAnalysis?.sleeperOptaRate || 0}% of Sleeper players have Opta IDs</li>
              <li>• {optaAnalysis?.ffhOptaRate || 0}% of FFH players have Opta IDs</li>
              <li>• {optaAnalysis?.optaMatchRate || 0}% match rate (matched/FFH players)</li>
              <li>• 100% match confidence (exact ID matching)</li>
            </ul>
          </div>
          <div>
            <h4 className={`text-sm font-medium mb-2 text-gray-300`}>
              Matching Method
            </h4>
            <ul className={`text-sm space-y-1 text-gray-400`}>
              <li>• <strong>Opta ID Only:</strong> No complex name matching</li>
              <li>• <strong>Zero False Positives:</strong> Exact ID matches only</li>
              <li>• <strong>High Performance:</strong> ~90% faster than multi-tier</li>
              <li>• <strong>Reliable:</strong> No manual overrides needed</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Unmatched Players Table */}
      <UnmatchedPlayersTable optaAnalysis={optaAnalysis} />
      
      {/* Debug Information (Optional) */}
      {optaAnalysis?.duplicateOptas && optaAnalysis.duplicateOptas.size > 0 && (
        <div className={`rounded-lg shadow-sm border p-6 bg-gray-800 border-gray-700`}>
          <h3 className={`text-lg font-medium mb-4 text-white`}>
            ⚠️ Duplicate Opta IDs Detected
          </h3>
          <p className={`text-sm mb-4 text-gray-400`}>
            These Sleeper players share the same Opta ID (only first match is used):
          </p>
          <div className="space-y-2">
            {Array.from(optaAnalysis.duplicateOptas.entries()).map(([optaId, players]) => (
              <div key={optaId} className={`p-3 rounded border bg-gray-700 border-gray-600`}>
                <div className={`text-sm font-medium text-white`}>
                  Opta ID: {optaId}
                </div>
                <div className={`text-xs mt-1 text-gray-400`}>
                  Players: {players.map(p => `${p.name} (${p.team})`).join(', ')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ----------------- ENHANCED GAMEWEEK DISPLAY COMPONENT -----------------
const GameweekDisplay = ({ gameweek }) => {
  const getStatusIcon = (status) => {
    switch (status) {
      case 'upcoming': return '🏁';
      case 'live': return '🔴';
      case 'completed': return '✅';
      default: return '⚽';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'upcoming': return 'bg-blue-900 border-blue-700';
      case 'live': return 'bg-red-900 border-red-700';
      case 'completed': return 'bg-green-900 border-green-700';
      default: return 'bg-gray-900 border-gray-700';
    }
  };

  const getTextColor = (status) => {
    switch (status) {
      case 'upcoming': return 'text-blue-100';
      case 'live': return 'text-red-100';
      case 'completed': return 'text-green-100';
      default: return 'text-gray-100';
    }
  };

  const getSubTextColor = (status) => {
    switch (status) {
      case 'upcoming': return 'text-blue-200';
      case 'live': return 'text-red-200';
      case 'completed': return 'text-green-200';
      default: return 'text-gray-200';
    }
  };

  const getHoverColor = (status) => {
    switch (status) {
      case 'upcoming': return 'hover:bg-blue-800 hover:border-blue-600';
      case 'live': return 'hover:bg-red-800 hover:border-red-600';
      case 'completed': return 'hover:bg-green-800 hover:border-green-600';
      default: return 'hover:bg-gray-800 hover:border-gray-600';
    }
  };

  // Handle click to open Premier League fixtures page
  const handleGameweekClick = () => {
    const gameweekNumber = gameweek.number;
    const fixturesUrl = `https://fantasy.premierleague.com/fixtures/${gameweekNumber}`;
    
    // Open in new tab
    window.open(fixturesUrl, '_blank', 'noopener,noreferrer');
    
    // Log for debugging
    console.log(`🔗 Opening Premier League fixtures for GW${gameweekNumber}: ${fixturesUrl}`);
  };

  return (
    <button
      onClick={handleGameweekClick}
      className={`${getStatusColor(gameweek.status)} ${getHoverColor(gameweek.status)} border rounded-lg px-3 py-2 transition-all duration-200 cursor-pointer transform hover:scale-105 active:scale-95`}
      title={`Click to view GW${gameweek.number} fixtures on Premier League website`}
    >
      <div className={`text-sm font-medium ${getTextColor(gameweek.status)} flex items-center gap-1`}>
        {getStatusIcon(gameweek.status)} GW {gameweek.number} ({gameweek.status === 'upcoming' ? 'Upcoming' : gameweek.status === 'live' ? 'Live' : 'Completed'})
        <span className="text-xs opacity-70 ml-1">🔗</span>
      </div>
      <div className={`text-xs ${getSubTextColor(gameweek.status)}`}>
        {gameweek.status === 'upcoming' ? 'Starts' : gameweek.status === 'live' ? 'Ends' : 'Finished'}: {gameweek.date}
        {gameweek.deadlineFormatted && gameweek.status === 'upcoming' && (
          <div className="mt-1">Deadline: {gameweek.deadlineFormatted}</div>
        )}
        {gameweek.source && gameweek.source !== 'fpl_api' && (
          <div className="mt-1 opacity-75">⚠️ {gameweek.source}</div>
        )}
        <div className="mt-1 text-xs opacity-60">Click to view fixtures</div>
      </div>
    </button>
  );
};

// ----------------- DASHBOARD HEADER COMPONENT -----------------
const DashboardHeader = ({ lastUpdated, players, updateData, activeTab, setActiveTab, currentGameweek, scoringMode, setScoringMode }) => {
  const freshnessStatus = getDataFreshnessStatus(lastUpdated);
  const cacheAge = CacheManager.getAge();

  return (
    <header className={`bg-gray-800 border-gray-700 border-b sticky top-0 z-50`}>
      <div className="max-w-7xl mx-auto px-4 py-4">
        {/* Top Row: Title, Gameweek, Update Button */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <h1 className={`text-2xl font-bold text-white`}>⚽ Fantasy FC Playbook</h1>
           
            {/* Data Freshness Indicator */}
            <div className="flex items-center gap-2 text-sm">
              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-${freshnessStatus.color}-100 text-${freshnessStatus.color}-800`}>
                🕒 {freshnessStatus.message}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Current Gameweek with Enhanced Display */}
            <GameweekDisplay gameweek={currentGameweek} />

            {/* Scoring Mode Toggle */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-300">
                Scoring:
              </span>
              <button
                onClick={() => setScoringMode(scoringMode === 'existing' ? 'v3' : 'existing')}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                  scoringMode === 'v3'
                    ? 'bg-green-500 text-white hover:bg-green-600'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {scoringMode === 'v3' ? '🚀 v3' : '📊 Standard'}
              </button>
            </div>


            {/* Update Data Button */}
            <button
              onClick={() => updateData('manual', true, false)}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              🔄 Update Data
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex space-x-1">
          {[
            { id: 'players', label: 'Players' },
            { id: 'matching', label: 'Matching' },
            { id: 'optimizer', label: 'Optimizer' },
            { id: 'transfers', label: 'Transfers' },
            { id: 'comparison', label: 'Comparison' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 font-medium rounded-lg transition-colors ${
                activeTab === tab.id
                  ? 'bg-blue-500 text-white'
                  : 'text-gray-300 hover:text-white hover:bg-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
};

// ----------------- MAIN DASHBOARD COMPONENT -----------------
export default function FPLDashboard() {
  const [activeTab, setActiveTab] = useState('players');
  const [filters, setFilters] = useState({
    position: [], // Changed to array for multi-select
    team: 'all',
    owner: 'my_players_and_free_agents',
    minPoints: 0.1,
    search: ''
  });
  const [sortConfig, setSortConfig] = useState({ key: 'sleeper_points_ros', direction: 'desc' });
  const [scoringMode, setScoringMode] = useState('existing'); // 'existing' or 'v3'

  // Shared gameweek range state for transfers tab
  const [transferGameweekRange, setTransferGameweekRange] = useState(null);

  // Current gameweek state - will be updated by loadGameweek()
  const [currentGameweek, setCurrentGameweek] = useState({
    number: 4, // Updated to current gameweek fallback
    status: 'upcoming', 
    statusDisplay: '🏁 GW 4 (Upcoming)',
    date: 'Sep 13',
    fullDate: '2025-09-13',
    source: 'loading'
  });
  
  const { players, loading, error, lastUpdated, source, quality, ownershipData, ownershipCount, enhanced, refetch, integrated, integration } = usePlayerData();
  
  // Processed players with scoring mode applied
  const [processedPlayers, setProcessedPlayers] = useState([]);

  // Load gameweek data
  useEffect(() => {
    const loadGameweek = async () => {
      try {
        const gameweek = await getCurrentGameweek();
        setCurrentGameweek(gameweek);
        
        console.log(`📅 Dashboard: Loaded GW${gameweek.number} (${gameweek.status})`);
      } catch (error) {
        console.error('Failed to load gameweek:', error);
        // Keep the fallback currentGameweek state
      }
    };

    loadGameweek();
  }, []);

  // Process players when scoring mode or players change
  useEffect(() => {
    if (players && Array.isArray(players) && players.length > 0) {
      // Create a unique key for this processing session
      const logKey = `${scoringMode}-${players.length}-${currentGameweek.number}`;

      if (scoringMode === 'v3') {
        // Only log if this combination hasn't been logged yet
        if (!window._lastScoringLog || window._lastScoringLog !== logKey) {
          console.log(`📊 Dashboard: Applying V3 scoring to ${players.length} players`);
          window._lastScoringLog = logKey;
        }
        const enhancedPlayers = v3ScoringService.applyV3Scoring(players, currentGameweek);
        setProcessedPlayers(enhancedPlayers);
      } else {
        // Only log if this combination hasn't been logged yet
        if (!window._lastScoringLog || window._lastScoringLog !== logKey) {
          console.log(`📊 Dashboard: Using standard scoring for ${players.length} players`);
          window._lastScoringLog = logKey;
        }
        setProcessedPlayers(players);
      }
    }
  }, [players, scoringMode, currentGameweek.number]);

  // Update data function
  const updateData = (type = 'manual', forceRefresh = true, useCache = false) => {
    if (forceRefresh) {
      CacheManager.clear();
    }
    refetch(type, forceRefresh, useCache);
  };

  // Position color utility (shared with transfers tab)
  const getPositionColor = (position) => {
    switch (position) {
      case 'FWD': return { 
        bg: 'bg-purple-100', 
        text: 'text-purple-800', 
        border: 'border-purple-200', 
        accent: 'bg-purple-500',
        pill: 'bg-gradient-to-r from-purple-500 to-purple-600'
      };
      case 'MID': return { 
        bg: 'bg-pink-100', 
        text: 'text-pink-800', 
        border: 'border-pink-200', 
        accent: 'bg-pink-500',
        pill: 'bg-gradient-to-r from-pink-500 to-pink-600'
      };
      case 'DEF': return { 
        bg: 'bg-teal-100', 
        text: 'text-teal-800', 
        border: 'border-teal-200', 
        accent: 'bg-teal-500',
        pill: 'bg-gradient-to-r from-teal-500 to-teal-600'
      };
      case 'GKP': return { 
        bg: 'bg-yellow-100', 
        text: 'text-yellow-800', 
        border: 'border-yellow-200', 
        accent: 'bg-yellow-500',
        pill: 'bg-gradient-to-r from-yellow-500 to-yellow-600'
      };
      default: return { 
        bg: 'bg-gray-100', 
        text: 'text-gray-800', 
        border: 'border-gray-200', 
        accent: 'bg-gray-500',
        pill: 'bg-gradient-to-r from-gray-500 to-gray-600'
      };
    }
  };

  // Sorting function
  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Get sort value for a player and column
  const getSortValue = (player, key) => {
    switch (key) {
      case 'name':
        return (player.name || `${player.first_name || ''} ${player.last_name || ''}`.trim()).toLowerCase();
      case 'position':
        return player.position || '';
      case 'team':
        return player.team || '';
      case 'sleeper_points_ros':
        return v3ScoringService.getScoringValue(player, 'points_ros', scoringMode);
      case 'sleeper_points_next5':
        // Use specific gameweek predictions from the predictions array (better logic)
        if (player.predictions && Array.isArray(player.predictions)) {
          const currentGW = currentGameweek?.number;
          const targetGameweeks = Array.from({length: 5}, (_, i) => currentGW + i);
          let totalPoints = 0;
          const gameweekDetails = [];
          
          targetGameweeks.forEach(gw => {
            const prediction = player.predictions.find(p => p.gw === gw);
            if (prediction) {
              const gwPoints = scoringMode === 'v3' 
                ? (prediction.v3_predicted_pts || prediction.predicted_pts || 0)
                : (prediction.predicted_pts || 0);
              totalPoints += gwPoints;
              gameweekDetails.push({ gw, points: gwPoints });
            }
          });
          
          // Debug logging for Lammens
          if (player.name?.includes('Lammens') || player.web_name?.includes('Lammens')) {
            console.log(`🔍 Players table calc for ${player.name || player.web_name}:`, {
              scoringMode,
              currentGW,
              targetGameweeks,
              totalPoints,
              gameweekDetails,
              predictionsLength: player.predictions?.length
            });
          }
          
          return totalPoints;
        }
        
        // Fallback to old logic if predictions array not available
        if (player.sleeper_gw_predictions) {
          try {
            const gwPreds = JSON.parse(player.sleeper_gw_predictions);
            const next5 = Object.values(gwPreds).slice(0, 5);
            return next5.length > 0 ? next5.reduce((a, b) => a + b, 0) : 0;
          } catch (e) {
            // Fall through
          }
        }
        if (player.ffh_gw_predictions) {
          try {
            const gwPreds = JSON.parse(player.ffh_gw_predictions);
            const next5 = Object.values(gwPreds).slice(0, 5);
            return next5.length > 0 ? next5.reduce((a, b) => a + b, 0) : 0;
          } catch (e) {
            // Fall through
          }
        }
        const seasonPoints = getSortValue(player, 'sleeper_points_ros');
        return seasonPoints > 0 ? (seasonPoints / 38) * 5 : 0;
      case 'avg_minutes_next5':
        if (player.avg_minutes_next5 && player.avg_minutes_next5 > 0) {
          return player.avg_minutes_next5;
        }
        
        if (player.predictions && Array.isArray(player.predictions)) {
          const next5Predictions = player.predictions.slice(0, 5);
          if (next5Predictions.length > 0) {
            const totalMinutes = next5Predictions.reduce((total, pred) => total + (pred.xmins || 0), 0);
            return totalMinutes / next5Predictions.length;
          }
        }
        
        if (player.ffh_gw_minutes) {
          try {
            const gwMinutes = JSON.parse(player.ffh_gw_minutes);
            const next5Minutes = Object.values(gwMinutes).slice(0, 5);
            if (next5Minutes.length > 0) {
              return next5Minutes.reduce((a, b) => a + b, 0) / next5Minutes.length;
            }
          } catch (e) {
            // Continue to default
          }
        }
        
        return 0;
      case 'current_ppg':
        // Use FFH season average (actual current PPG)
        return player.ffh_season_avg || 0;
      case 'predicted_ppg':
        // Use Sleeper season average (predicted PPG after conversion)
        return player.sleeper_season_avg || 0;
      case 'owned_by':
        return player.owned_by || 'Free Agent';
      default:
        return '';
    }
  };

  // Filter players based on current filters
  const filteredPlayers = processedPlayers.filter(player => {
    // EPL TEAMS ONLY: Only show players from actual EPL teams
    if (!isEPLPlayer(player)) {
      return false;
    }

    // Position filter - multi-select
    if (filters.position.length > 0) {
      const playerPos = player.position;
      const isPositionMatch = filters.position.some(filterPos => {
        // Handle goalkeeper variations
        if (filterPos === 'GKP') {
          return playerPos === 'GKP' || playerPos === 'GK';
        } else {
          return playerPos === filterPos;
        }
      });
      if (!isPositionMatch) return false;
    }

// Team filter  
if (filters.team !== 'all' && player.team_abbr !== filters.team) {
  return false;
}

    // Owner filter
    if (filters.owner !== 'all') {
      if (filters.owner === 'my_players_and_free_agents') {
        // Show only my players OR free agents
        const isMyPlayer = player.owned_by === 'ThatDerekGuy';
        const isFreeAgent = !player.owned_by || player.owned_by === 'Free Agent';
        if (!isMyPlayer && !isFreeAgent) return false;
      } else if (filters.owner === 'Free Agent' && player.owned_by && player.owned_by !== 'Free Agent') {
        return false;
      } else if (filters.owner === 'ThatDerekGuy' && player.owned_by !== 'ThatDerekGuy') {
        return false;
      } else if (filters.owner !== 'Free Agent' && filters.owner !== 'ThatDerekGuy' && player.owned_by !== filters.owner) {
        return false;
      }
    }

    // Min points filter
    const getRosPoints = (player) => {
      if (player.sleeper_season_total) return player.sleeper_season_total;
      if (player.sleeper_season_avg) return player.sleeper_season_avg * 38;
      if (player.ffh_season_prediction) return player.ffh_season_prediction;
      if (player.predicted_pts) return player.predicted_pts;
      if (player.total_points) return player.total_points;
      return 0;
    };
    
    const playerPoints = getRosPoints(player);
    if (playerPoints < filters.minPoints) {
      return false;
    }

    // Search filter
    if (filters.search)
      // Search filter
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      const searchableText = [
        player.name || '',
        player.first_name || '',
        player.last_name || '',
        player.team || '',
        player.position || ''
      ].join(' ').toLowerCase();
      
      if (!searchableText.includes(searchTerm)) {
        return false;
      }
    }

    return true;
  });

  // Sort players based on sort config
  const sortedPlayers = [...filteredPlayers].sort((a, b) => {
    const aValue = getSortValue(a, sortConfig.key);
    const bValue = getSortValue(b, sortConfig.key);
    
    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
    } else {
      const aStr = String(aValue);
      const bStr = String(bValue);
      if (sortConfig.direction === 'asc') {
        return aStr.localeCompare(bStr);
      } else {
        return bStr.localeCompare(aStr);
      }
    }
  });

  // Get unique teams and owners for filter dropdowns
  const teams = EPL_TEAMS.sort();
  const owners = [...new Set(processedPlayers.filter(isEPLPlayer).map(p => p.owned_by).filter(Boolean))].sort();

  // Render sort icon
  const renderSortIcon = (columnKey) => {
    if (sortConfig.key !== columnKey) {
      return <span className="text-gray-400 ml-1">↕️</span>;
    }
    return sortConfig.direction === 'asc' ? 
      <span className="text-blue-500 ml-1">↑</span> : 
      <span className="text-blue-500 ml-1">↓</span>;
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white">
        <div className="flex items-center justify-center min-h-screen">
          <LoadingSpinner 
            message="Loading player data..." 
          />
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 text-white">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center p-8">
            <h2 className="text-2xl font-bold text-red-600 mb-4">❌ Error Loading Data</h2>
            <p className={`mb-4 text-gray-400`}>{error}</p>
            <button
              onClick={updateData}
              className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Render tab-specific stats
  const renderStatsCards = () => {
    switch(activeTab) {
      case 'players': 
        return null; // No stats cards for players tab
      case 'matching': 
        return <MatchingStats players={processedPlayers} integration={integration} />;
      case 'optimizer': 
        return <OptimizerStats scoringMode={scoringMode} currentGameweek={currentGameweek} />;
      case 'transfers':
        return <TransferStats
          players={processedPlayers}
          scoringMode={scoringMode}
          gameweekRange={transferGameweekRange}
        />;
      default: 
        return null;
    }
  };

  // Main render
  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-900 text-white">
        
        <DashboardHeader
          lastUpdated={lastUpdated}
          players={processedPlayers}
          updateData={updateData}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          currentGameweek={currentGameweek}
          scoringMode={scoringMode}
          setScoringMode={setScoringMode}
        />

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 py-6">
          
          {/* Tab-Specific Stats Cards */}
          {renderStatsCards()}

          {/* Content based on active tab */}
          {activeTab === 'players' && (
            <>
              {/* Filters */}
              <div className={`p-4 rounded-lg mb-6 shadow-sm bg-gray-800`}>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {/* Position Filter - Multi-select */}
                  <div>
                    <label className={`block text-sm font-medium mb-2 text-gray-300`}>
                      Positions ({filters.position.length > 0 ? filters.position.length : 'All'})
                    </label>
                    <div className="flex gap-2">
                      {['GKP', 'DEF', 'MID', 'FWD'].map(pos => {
                        const colors = getPositionColor(pos);
                        const isSelected = filters.position.includes(pos);
                        return (
                          <button
                            key={pos}
                            onClick={() => {
                              if (isSelected) {
                                setFilters(prev => ({ 
                                  ...prev, 
                                  position: prev.position.filter(p => p !== pos) 
                                }));
                              } else {
                                setFilters(prev => ({ 
                                  ...prev, 
                                  position: [...prev.position, pos] 
                                }));
                              }
                            }}
                            className={`px-4 py-2 rounded-full text-sm font-semibold transition-all transform hover:scale-105 ${
                              isSelected 
                                ? `${colors.pill} text-white shadow-lg`
                                : 'bg-gray-700 hover:bg-gray-600 text-gray-300 border-2 border-transparent hover:border-gray-300'
                            }`}
                          >
                            {pos}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Owner Filter */}
                  <div>
                    <label className={`block text-sm font-medium mb-2 text-gray-300`}>
                      Owner
                    </label>
                    <select
                      value={filters.owner}
                      onChange={(e) => setFilters(prev => ({ ...prev, owner: e.target.value }))}
                      className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-700 border-gray-600 text-white"
                    >
                      <option value="all">All Owners</option>
                      <option value="my_players_and_free_agents">My Players + FAs</option>
                      <option value="ThatDerekGuy">My Players Only</option>
                      <option value="Free Agent">Free Agents Only</option>
                      {owners.map(owner => (
                        <option key={owner} value={owner}>{owner}</option>
                      ))}
                    </select>
                  </div>

                  {/* Min Points Filter */}
                  <div>
                    <label className={`block text-sm font-medium mb-2 text-gray-300`}>
                      Min ROS Points
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={filters.minPoints}
                      onChange={(e) => setFilters(prev => ({ ...prev, minPoints: parseFloat(e.target.value) || 0 }))}
                      className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-700 border-gray-600 text-white"
                      placeholder="0"
                    />
                  </div>

                  {/* Search Filter */}
                  <div>
                    <label className={`block text-sm font-medium mb-2 text-gray-300`}>
                      Search
                    </label>
                    <input
                      type="text"
                      value={filters.search}
                      onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                      placeholder="Player name, team..."
                      className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                    />
                  </div>
                </div>
              </div>

              {/* Results Summary */}
              <div className="mb-4 flex items-center justify-between">
                <div className={`text-sm text-gray-400`}>
                  Showing {sortedPlayers.length.toLocaleString()} of {players.length.toLocaleString()} players
                  <span className="ml-2 text-xs">
                    (Free Agents: {processedPlayers.filter(p => !p.owned_by || p.owned_by === 'Free Agent').length}, 
                     Owned: {processedPlayers.filter(p => p.owned_by && p.owned_by !== 'Free Agent').length})
                  </span>
                </div>
                <div className="text-sm text-gray-500">
                  Click column headers to sort
                </div>
              </div>
              {/* Players Table */}
              <div className={`rounded-lg shadow-sm border overflow-hidden bg-gray-800 border-gray-700`}>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className={'bg-gray-700'}>
                      <tr>
                        {/* Sortable headers */}
                        <th 
                          className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-opacity-75 ${
                            'text-gray-300 hover:bg-gray-600'
                          }`}
                          onClick={() => handleSort('name')}
                        >
                          <div className="flex items-center">
                            Player {renderSortIcon('name')}
                          </div>
                        </th>
                        <th 
                          className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-opacity-75 ${
                            'text-gray-300 hover:bg-gray-600'
                          }`}
                          onClick={() => handleSort('position')}
                        >
                          <div className="flex items-center">
                            Position {renderSortIcon('position')}
                          </div>
                        </th>
                        <th 
                          className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-opacity-75 ${
                            'text-gray-300 hover:bg-gray-600'
                          }`}
                          onClick={() => handleSort('team')}
                        >
                          <div className="flex items-center">
                            Team {renderSortIcon('team')}
                          </div>
                        </th>
                        <th 
                          className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-opacity-75 ${
                            'text-gray-300 hover:bg-gray-600'
                          }`}
                          onClick={() => handleSort('owned_by')}
                        >
                          <div className="flex items-center">
                            Ownership {renderSortIcon('owned_by')}
                          </div>
                        </th>
                        <th 
                          className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-opacity-75 ${
                            'text-gray-300 hover:bg-gray-600'
                          }`}
                          onClick={() => handleSort('sleeper_points_ros')}
                        >
                          <div className="flex items-center">
                            ROS Points {renderSortIcon('sleeper_points_ros')}
                          </div>
                        </th>
                        <th 
                          className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-opacity-75 ${
                            'text-gray-300 hover:bg-gray-600'
                          }`}
                          onClick={() => handleSort('sleeper_points_next5')}
                        >
                          <div className="flex items-center">
                            Next 5 GW {renderSortIcon('sleeper_points_next5')}
                          </div>
                        </th>
                        <th 
                          className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-opacity-75 ${
                            'text-gray-300 hover:bg-gray-600'
                          }`}
                          onClick={() => handleSort('avg_minutes_next5')}
                        >
                          <div className="flex items-center">
                            Avg Mins (Next 5) {renderSortIcon('avg_minutes_next5')}
                          </div>
                        </th>
                        <th 
                          className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-opacity-75 ${
                            'text-gray-300 hover:bg-gray-600'
                          }`}
                          onClick={() => handleSort('predicted_ppg')}
                        >
                          <div className="flex items-center">
                            PPG (Predicted) {renderSortIcon('predicted_ppg')}
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${'bg-gray-800 divide-gray-700'}`}>
                      {sortedPlayers.map((player, index) => (
                        <tr key={`${player.sleeper_id || player.id || index}`} className={`${'hover:bg-gray-700'}`}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div>
                                <div className={`text-sm font-medium text-white flex items-center gap-2`}>
                                  {player.name || `${player.first_name || ''} ${player.last_name || ''}`.trim()}
                                  {player.news && player.news.trim() !== '' && (
                                    <span
                                      className="text-orange-400 hover:text-orange-300 cursor-pointer transition-colors"
                                      title={player.news}
                                    >
                                      📰
                                    </span>
                                  )}
                                </div>
                                {player.injury_status && (
                                  <div className="text-xs text-red-600">
                                    🏥 {player.injury_status}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getSleeperPositionStyle(player.position)}`}>
                              {player.position || 'N/A'}
                            </span>
                          </td>
                          <td className={`px-6 py-4 whitespace-nowrap text-sm text-gray-300`}>
                            {TEAM_DISPLAY_NAMES[player.team_abbr] || player.team_abbr || 'N/A'}
                          </td>
<td className="px-6 py-4 whitespace-nowrap text-sm">
  {player.owned_by && player.owned_by !== 'Free Agent' && player.owned_by !== '' ? (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
      player.owned_by === 'ThatDerekGuy' 
        ? 'bg-indigo-100 text-indigo-900 border border-indigo-400'  // Deep indigo for "My Player"
        : 'bg-orange-100 text-orange-900 border border-orange-400'   // Orange for other owners
    }`}>
      {player.owned_by === 'ThatDerekGuy' ? '👤 My Player' : player.owned_by}
    </span>
  ) : (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-300">
      ⚡ Free Agent
    </span>
  )}
</td>
                          <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium text-white`}>
                            {(() => {
                              const seasonTotal = v3ScoringService.getScoringValue(player, 'season_total', scoringMode);
                              return seasonTotal > 0 ? seasonTotal.toFixed(1) : 'N/A';
                            })()}
                          </td>
                          <td className={`px-6 py-4 whitespace-nowrap text-sm text-gray-300`}>
                            {(() => {
                              // Pure FFH data - sum first 5 predictions ONLY
                              if (player.predictions && Array.isArray(player.predictions)) {
                                const first5Predictions = player.predictions.slice(0, 5);
                                const totalPoints = first5Predictions.reduce((sum, pred) => {
                                  return sum + (pred.predicted_pts || 0);
                                }, 0);
                                return totalPoints.toFixed(1);
                              }
                              // No fallbacks - return 0 if no predictions
                              return '0.0';
                            })()}
                          </td>
                          <td className={`px-6 py-4 whitespace-nowrap text-sm text-gray-300`}>
                            {(() => {
                              // Pure FFH data - average of first 5 predictions xmins ONLY
                              if (player.predictions && Array.isArray(player.predictions)) {
                                const first5Predictions = player.predictions.slice(0, 5);
                                if (first5Predictions.length > 0) {
                                  const totalMinutes = first5Predictions.reduce((sum, pred) => sum + (pred.xmins || 0), 0);
                                  const avgMinutes = totalMinutes / first5Predictions.length;
                                  return avgMinutes.toFixed(0);
                                }
                              }
                              // No fallbacks - return 0 if no predictions
                              return '0';
                            })()}
                          </td>
                          <td className={`px-6 py-4 whitespace-nowrap text-sm text-gray-300`}>
                            {(() => {
                              const predictedPpg = v3ScoringService.getScoringValue(player, 'season_avg', scoringMode);
                              return predictedPpg.toFixed(1);
                            })()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* No Results Message */}
              {sortedPlayers.length === 0 && (
                <div className="text-center py-8">
                  <div className={`mb-2 text-gray-400`}>No players match your current filters</div>
                  <button
                    onClick={() => {
                      setFilters({
                        position: [], // Clear to empty array
                        team: 'all',
                        owner: 'all',
                        minPoints: 0,
                        search: ''
                      });
                    }}
                    className="text-blue-500 hover:text-blue-600 text-sm underline"
                  >
                    Clear all filters
                  </button>
                </div>
              )}
            </>
          )}

          {/* Matching statistics and information */}
          {activeTab === 'matching' && (
            <MatchingTabContent players={processedPlayers} integration={integration} />
          )}

          {/* Optimizing lineup for the current GW */}
          {activeTab === 'optimizer' && (
            <OptimizerTabContent 
 
              players={processedPlayers}
              currentGameweek={currentGameweek}
              scoringMode={scoringMode}
            />
          )}
          
          {/* Get recommendations and explore free agents to pick up */}
          {activeTab === 'transfers' && (
            <TransferTabContent
              players={processedPlayers}
              currentGameweek={currentGameweek}
              scoringMode={scoringMode}
              gameweekRange={transferGameweekRange}
              onGameweekRangeChange={setTransferGameweekRange}
            />
          )}

          {/* Compare 2 players side by side */}
          {activeTab === 'comparison' && (
            <ComparisonTabContent
              players={processedPlayers}
              currentGameweek={currentGameweek}
              scoringMode={scoringMode}
            />
          )}

        </main>
      </div>
    </ErrorBoundary>
  );
}