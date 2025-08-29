'use client';

import { useState, useEffect } from 'react';
import GameweekService from './services/gameweekService';
import { OptimizerTabContent } from './components/OptimizerTabContent';
import TransferTabContent from './components/TransferTabContent';

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
  if (!player.team) return false;
  
  const playerTeam = player.team.trim();
  
  // Check if it's an EPL abbreviation
  return Object.values(TEAM_MAPPINGS).includes(playerTeam) || EPL_TEAMS.includes(playerTeam);
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
  set: (data) => {
    try {
      const cacheData = {
        data,
        timestamp: Date.now()
      };
      localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
    } catch (error) {
      console.warn('Could not save to cache:', error);
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
      
      if (result.success) {
        const newData = {
          players: result.players || [],
          loading: false,
          error: null,
          lastUpdated: result.lastUpdated,
          source: result.source || 'integrated',
          quality: result.quality,
          ownershipData: result.ownershipData || false,
          enhanced: result.enhanced || true,
          cached: result.fromCache || false,
          ownershipCount: result.ownershipCount || result.players?.length || 0,
          integrated: true,
          integration: result.integration
        };

        // Save to cache
        CacheManager.set(newData);
        
        setData(newData);
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

  useEffect(() => {
    // Auto-load with cache for speed
    fetchData('auto', false, true);
  }, []);

  return { ...data, refetch: fetchData };
}

// ----------------- SLEEPER POSITION COLORS -----------------
const getSleeperPositionStyle = (position) => {
  switch (position) {
    case 'GKP':
    case 'GK':
    case 'G':
      return 'bg-yellow-100 text-yellow-800 border border-yellow-300'; // Goalkeeper - Yellow
    case 'DEF':
    case 'D':
      return 'bg-cyan-100 text-cyan-800 border border-cyan-300'; // Defender - Cyan/Light Blue
    case 'MID':
    case 'M':
      return 'bg-green-100 text-green-800 border border-green-300'; // Midfielder - Green
    case 'FWD':
    case 'F':
      return 'bg-red-100 text-red-800 border border-red-300'; // Forward - Red
    default:
      return 'bg-gray-100 text-gray-800 border border-gray-300';
  }
};

// ----------------- NEW: ENHANCED MATCHING STATS COMPONENT -----------------
const MatchingStats = ({ players, integration, isDarkMode }) => {
  const optaAnalysis = integration?.optaAnalysis;
  
  if (!optaAnalysis) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className={`p-4 rounded-lg shadow-sm ${isDarkMode ? 'bg-gray-800' : 'bg-white border border-gray-200'}`}>
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
      <div className={`p-4 rounded-lg shadow-sm ${isDarkMode ? 'bg-gray-800' : 'bg-white border border-gray-200'}`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold text-blue-600">
              {optaAnalysis.sleeperWithOpta?.toLocaleString()}/{integration.sleeperTotal?.toLocaleString()}
            </div>
            <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Sleeper w/ Opta ({optaAnalysis.sleeperOptaRate}%)
            </div>
          </div>
          <div className="text-blue-500 text-2xl">👥</div>
        </div>
      </div>

      {/* FFH Players with Opta ID */}
      <div className={`p-4 rounded-lg shadow-sm ${isDarkMode ? 'bg-gray-800' : 'bg-white border border-gray-200'}`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold text-green-600">
              {optaAnalysis.ffhWithOpta?.toLocaleString()}/{integration.ffhTotal?.toLocaleString()}
            </div>
            <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              FFH w/ Opta ({optaAnalysis.ffhOptaRate}%)
            </div>
          </div>
          <div className="text-green-500 text-2xl">⚽</div>
        </div>
      </div>

      {/* Successful Matches */}
      <div className={`p-4 rounded-lg shadow-sm ${isDarkMode ? 'bg-gray-800' : 'bg-white border border-gray-200'}`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold text-purple-600">
              {optaAnalysis.optaMatches?.toLocaleString()}/{optaAnalysis.ffhWithOpta?.toLocaleString()}
            </div>
            <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Successful Matches ({optaAnalysis.optaMatchRate}%)
            </div>
          </div>
          <div className="text-purple-500 text-2xl">🔗</div>
        </div>
      </div>

      {/* Unmatched Sleeper Players */}
      <div className={`p-4 rounded-lg shadow-sm ${isDarkMode ? 'bg-gray-800' : 'bg-white border border-gray-200'}`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold text-orange-600">
              {optaAnalysis.unmatchedSleeperWithOpta?.length?.toLocaleString() || 0}
            </div>
            <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
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
const OptimizerStats = ({ isDarkMode }) => {
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
          body: JSON.stringify({ userId: 'ThatDerekGuy', forceRefresh: false })
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            // Calculate optimal player stats
            const optimalPlayerIds = data.optimal?.players?.map(p => p.id || p.player_id || p.sleeper_id) || [];
            const currentPlayerIds = data.current?.players?.map(p => p.id || p.player_id || p.sleeper_id) || [];
            
            const optimalPlayersInCurrent = currentPlayerIds.filter(id => optimalPlayerIds.includes(id)).length;
            const totalPlayers = currentPlayerIds.length || 11;
            const optimalPlayerPercentage = totalPlayers > 0 ? (optimalPlayersInCurrent / totalPlayers) * 100 : 0;
            
            setStats({
              currentPoints: data.stats?.currentPoints || 0,
              optimalPoints: data.stats?.optimalPoints || 0,
              optimalPlayerPercentage,
              playersToSwap: totalPlayers - optimalPlayersInCurrent,
              optimalPlayersInCurrent,
              totalPlayers
            });
          }
        }
      } catch (error) {
        console.error('Failed to fetch optimizer stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchOptimizerStats();
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className={`p-4 rounded-lg shadow-sm ${isDarkMode ? 'bg-gray-800' : 'bg-white border border-gray-200'}`}>
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
      <div className={`p-4 rounded-lg shadow-sm ${isDarkMode ? 'bg-gray-800' : 'bg-white border border-gray-200'}`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold text-blue-600">{stats.currentPoints.toFixed(1)}</div>
            <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Current Roster Points</div>
          </div>
          <div className="text-blue-500 text-2xl">⚽</div>
        </div>
      </div>

      {/* Optimized Roster Points */}
      <div className={`p-4 rounded-lg shadow-sm ${isDarkMode ? 'bg-gray-800' : 'bg-white border border-gray-200'}`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold text-green-600">{stats.optimalPoints.toFixed(1)}</div>
            <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Optimized Roster Points</div>
          </div>
          <div className="text-green-500 text-2xl">🎯</div>
        </div>
      </div>

      {/* % Optimal Players */}
      <div className={`p-4 rounded-lg shadow-sm ${isDarkMode ? 'bg-gray-800' : 'bg-white border border-gray-200'}`}>
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
            <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              % Optimal Players ({stats.optimalPlayersInCurrent}/{stats.totalPlayers})
            </div>
          </div>
          <div className="text-purple-500 text-2xl">📊</div>
        </div>
      </div>

      {/* Players to Swap */}
      <div className={`p-4 rounded-lg shadow-sm ${isDarkMode ? 'bg-gray-800' : 'bg-white border border-gray-200'}`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold text-red-600">{stats.playersToSwap}</div>
            <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Players to Swap</div>
          </div>
          <div className="text-red-500 text-2xl">🔄</div>
        </div>
      </div>
    </div>
  );
};

const TransferStats = ({ players, isDarkMode }) => {
  // Calculate transfer analytics - FIX: Use correct ownership logic
  const freeAgents = players.filter(p => !p.owned_by || p.owned_by === 'Free Agent');
  const myPlayers = players.filter(p => p.owned_by === 'ThatDerekGuy'); // YOUR players specifically
  
  // Find outperforming free agents compared to YOUR players
  const outperformingFAs = freeAgents.filter(fa => {
    const faPoints = fa.sleeper_points_ros || fa.total_points || 0;
    return myPlayers.some(myPlayer => (myPlayer.sleeper_points_ros || myPlayer.total_points || 0) < faPoints);
  });

  // Calculate recommended moves (best FA vs worst of YOUR players)
  const worstMyPlayer = myPlayers.sort((a, b) => 
    (a.sleeper_points_ros || a.total_points || 0) - (b.sleeper_points_ros || b.total_points || 0)
  )[0];
  const bestFA = freeAgents.sort((a, b) => 
    (b.sleeper_points_ros || b.total_points || 0) - (a.sleeper_points_ros || a.total_points || 0)
  )[0];

  const hasUpgrades = outperformingFAs.length > 0;
  const statusMessage = hasUpgrades ? "Upgrades Available" : "Team Optimized";
  const statusColor = hasUpgrades ? "orange" : "green";

  // Calculate potential point gain
  const potentialGain = (bestFA && worstMyPlayer) ? 
    ((bestFA.sleeper_points_ros || bestFA.total_points || 0) - 
     (worstMyPlayer.sleeper_points_ros || worstMyPlayer.total_points || 0)) : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      {/* Available Free Agents */}
      <div className={`p-4 rounded-lg shadow-sm ${isDarkMode ? 'bg-gray-800' : 'bg-white border border-gray-200'}`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold text-blue-600">{freeAgents.length}</div>
            <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Available Free Agents</div>
          </div>
          <div className="text-blue-500 text-2xl">🆓</div>
        </div>
      </div>

      {/* Outperforming Free Agents */}
      <div className={`p-4 rounded-lg shadow-sm ${isDarkMode ? 'bg-gray-800' : 'bg-white border border-gray-200'}`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold text-green-600">{outperformingFAs.length}</div>
            <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Upgrades Available</div>
          </div>
          <div className="text-green-500 text-2xl">⭐</div>
        </div>
      </div>

      {/* Your Squad Size */}
      <div className={`p-4 rounded-lg shadow-sm ${isDarkMode ? 'bg-gray-800' : 'bg-white border border-gray-200'}`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold text-purple-600">{myPlayers.length}</div>
            <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Your Squad Size</div>
          </div>
          <div className="text-purple-500 text-2xl">👤</div>
        </div>
      </div>

      {/* Best Potential Gain */}
      <div className={`p-4 rounded-lg shadow-sm ${isDarkMode ? 'bg-gray-800' : 'bg-white border border-gray-200'}`}>
        <div className="flex items-center justify-between">
          <div>
            <div className={`text-2xl font-bold ${potentialGain > 0 ? 'text-green-600' : 'text-gray-500'}`}>
              {potentialGain > 0 ? `+${potentialGain.toFixed(1)}` : '0.0'}
            </div>
            <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Best Potential Gain</div>
          </div>
          <div className={`text-2xl ${potentialGain > 0 ? 'text-green-500' : 'text-gray-400'}`}>📈</div>
        </div>
      </div>
    </div>
  );
};

// ----------------- NEW: UNMATCHED PLAYERS TABLE COMPONENT -----------------
// Enhanced UnmatchedPlayersTable with search and pagination

const UnmatchedPlayersTable = ({ optaAnalysis, isDarkMode }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });

  const unmatchedPlayers = optaAnalysis?.unmatchedSleeperWithOpta || [];
  
  if (unmatchedPlayers.length === 0) {
    return (
      <div className={`rounded-lg shadow-sm border p-6 text-center ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <div className="text-green-600 text-4xl mb-2">🎉</div>
        <h3 className={`text-lg font-medium mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
          Perfect Match Rate!
        </h3>
        <p className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
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
    <div className={`rounded-lg shadow-sm border overflow-hidden ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
      {/* Header with Search and Controls */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className={`text-lg font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Unmatched Sleeper Players ({filteredPlayers.length}{searchTerm && ` of ${unmatchedPlayers.length}`})
            </h3>
            <p className={`text-sm mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
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
                className={`w-full sm:w-64 px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  isDarkMode 
                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                }`}
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
              className={`px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                isDarkMode 
                  ? 'bg-gray-700 border-gray-600 text-white' 
                  : 'bg-white border-gray-300 text-gray-900'
              }`}
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
          <thead className={isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}>
            <tr>
              <th 
                className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-opacity-75 ${
                  isDarkMode ? 'text-gray-300 hover:bg-gray-600' : 'text-gray-500 hover:bg-gray-100'
                }`}
                onClick={() => handleSort('name')}
              >
                <div className="flex items-center">
                  Player {renderSortIcon('name')}
                </div>
              </th>
              <th 
                className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-opacity-75 ${
                  isDarkMode ? 'text-gray-300 hover:bg-gray-600' : 'text-gray-500 hover:bg-gray-100'
                }`}
                onClick={() => handleSort('position')}
              >
                <div className="flex items-center">
                  Position {renderSortIcon('position')}
                </div>
              </th>
              <th 
                className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-opacity-75 ${
                  isDarkMode ? 'text-gray-300 hover:bg-gray-600' : 'text-gray-500 hover:bg-gray-100'
                }`}
                onClick={() => handleSort('team')}
              >
                <div className="flex items-center">
                  Team {renderSortIcon('team')}
                </div>
              </th>
              <th 
                className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-opacity-75 ${
                  isDarkMode ? 'text-gray-300 hover:bg-gray-600' : 'text-gray-500 hover:bg-gray-100'
                }`}
                onClick={() => handleSort('opta_id')}
              >
                <div className="flex items-center">
                  Opta ID {renderSortIcon('opta_id')}
                </div>
              </th>
            </tr>
          </thead>
          <tbody className={`divide-y ${isDarkMode ? 'bg-gray-800 divide-gray-700' : 'bg-white divide-gray-200'}`}>
            {currentPlayers.length > 0 ? (
              currentPlayers.map((player, index) => (
                <tr key={`unmatched-${startIndex + index}`} className={`${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}`}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      {player.name || 'Unknown'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      getSleeperPositionStyle(player.position)
                    }`}>
                      {player.position || 'N/A'}
                    </span>
                  </td>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-900'}`}>
                    {player.team || 'N/A'}
                  </td>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm font-mono ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    {player.opta_id || 'N/A'}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className={`px-6 py-4 text-center ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  {searchTerm ? `No players found matching "${searchTerm}"` : 'No unmatched players'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      
      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className={`px-6 py-3 border-t flex items-center justify-between ${isDarkMode ? 'border-gray-700 bg-gray-750' : 'border-gray-200 bg-gray-50'}`}>
          {/* Results Info */}
          <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
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
                  : isDarkMode
                    ? 'text-gray-300 hover:text-white hover:bg-gray-600'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
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
                      : isDarkMode
                        ? 'text-gray-300 hover:text-white hover:bg-gray-600'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
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
                  : isDarkMode
                    ? 'text-gray-300 hover:text-white hover:bg-gray-600'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
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
const MatchingTabContent = ({ players, integration, isDarkMode }) => {
  const optaAnalysis = integration?.optaAnalysis;
  
  return (
    <div className="space-y-6">
      {/* Summary Section */}
      <div className={`rounded-lg shadow-sm border p-6 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <h3 className={`text-lg font-medium mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
          🎯 Opta-Only Matching Summary
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className={`text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              Coverage Analysis
            </h4>
            <ul className={`text-sm space-y-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              <li>• {optaAnalysis?.sleeperOptaRate || 0}% of Sleeper players have Opta IDs</li>
              <li>• {optaAnalysis?.ffhOptaRate || 0}% of FFH players have Opta IDs</li>
              <li>• {optaAnalysis?.optaMatchRate || 0}% match rate (matched/FFH players)</li>
              <li>• 100% match confidence (exact ID matching)</li>
            </ul>
          </div>
          <div>
            <h4 className={`text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              Matching Method
            </h4>
            <ul className={`text-sm space-y-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              <li>• <strong>Opta ID Only:</strong> No complex name matching</li>
              <li>• <strong>Zero False Positives:</strong> Exact ID matches only</li>
              <li>• <strong>High Performance:</strong> ~90% faster than multi-tier</li>
              <li>• <strong>Reliable:</strong> No manual overrides needed</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Unmatched Players Table */}
      <UnmatchedPlayersTable optaAnalysis={optaAnalysis} isDarkMode={isDarkMode} />
      
      {/* Debug Information (Optional) */}
      {optaAnalysis?.duplicateOptas && optaAnalysis.duplicateOptas.size > 0 && (
        <div className={`rounded-lg shadow-sm border p-6 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <h3 className={`text-lg font-medium mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            ⚠️ Duplicate Opta IDs Detected
          </h3>
          <p className={`text-sm mb-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            These Sleeper players share the same Opta ID (only first match is used):
          </p>
          <div className="space-y-2">
            {Array.from(optaAnalysis.duplicateOptas.entries()).map(([optaId, players]) => (
              <div key={optaId} className={`p-3 rounded border ${isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
                <div className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  Opta ID: {optaId}
                </div>
                <div className={`text-xs mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
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
const GameweekDisplay = ({ gameweek, isDarkMode }) => {
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
      case 'upcoming': return isDarkMode ? 'bg-blue-900 border-blue-700' : 'bg-blue-50 border-blue-200';
      case 'live': return isDarkMode ? 'bg-red-900 border-red-700' : 'bg-red-50 border-red-200';
      case 'completed': return isDarkMode ? 'bg-green-900 border-green-700' : 'bg-green-50 border-green-200';
      default: return isDarkMode ? 'bg-gray-900 border-gray-700' : 'bg-gray-50 border-gray-200';
    }
  };

  const getTextColor = (status) => {
    switch (status) {
      case 'upcoming': return isDarkMode ? 'text-blue-100' : 'text-blue-900';
      case 'live': return isDarkMode ? 'text-red-100' : 'text-red-900';
      case 'completed': return isDarkMode ? 'text-green-100' : 'text-green-900';
      default: return isDarkMode ? 'text-gray-100' : 'text-gray-900';
    }
  };

  const getSubTextColor = (status) => {
    switch (status) {
      case 'upcoming': return isDarkMode ? 'text-blue-200' : 'text-blue-600';
      case 'live': return isDarkMode ? 'text-red-200' : 'text-red-600';
      case 'completed': return isDarkMode ? 'text-green-200' : 'text-green-600';
      default: return isDarkMode ? 'text-gray-200' : 'text-gray-600';
    }
  };

  const getHoverColor = (status) => {
    switch (status) {
      case 'upcoming': return isDarkMode ? 'hover:bg-blue-800 hover:border-blue-600' : 'hover:bg-blue-100 hover:border-blue-300';
      case 'live': return isDarkMode ? 'hover:bg-red-800 hover:border-red-600' : 'hover:bg-red-100 hover:border-red-300';
      case 'completed': return isDarkMode ? 'hover:bg-green-800 hover:border-green-600' : 'hover:bg-green-100 hover:border-green-300';
      default: return isDarkMode ? 'hover:bg-gray-800 hover:border-gray-600' : 'hover:bg-gray-100 hover:border-gray-300';
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
        {gameweek.fixtures && gameweek.status === 'live' && (
          <div className="mt-1">{gameweek.fixtures.finished}/{gameweek.fixtures.count} matches finished</div>
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
const DashboardHeader = ({ isDarkMode, setIsDarkMode, lastUpdated, players, updateData, activeTab, setActiveTab, currentGameweek }) => {
  const freshnessStatus = getDataFreshnessStatus(lastUpdated);
  const cacheAge = CacheManager.getAge();

  return (
    <header className={`${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-b sticky top-0 z-50`}>
      <div className="max-w-7xl mx-auto px-4 py-4">
        {/* Top Row: Title, Gameweek, Update Button */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <h1 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>⚽ FPL Dashboard</h1>
            
            {/* Data Freshness Indicator */}
            <div className="flex items-center gap-2 text-sm">
              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-${freshnessStatus.color}-100 text-${freshnessStatus.color}-800`}>
                🕒 {freshnessStatus.message}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Current Gameweek with Enhanced Display */}
            <GameweekDisplay gameweek={currentGameweek} isDarkMode={isDarkMode} />

            {/* Dark Mode Toggle */}
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={`p-2 rounded-lg transition-colors ${
                isDarkMode ? 'bg-gray-700 text-yellow-400 hover:bg-gray-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {isDarkMode ? '☀️' : '🌙'}
            </button>

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
            { id: 'transfers', label: 'Transfers' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 font-medium rounded-lg transition-colors ${
                activeTab === tab.id
                  ? 'bg-blue-500 text-white'
                  : isDarkMode 
                    ? 'text-gray-300 hover:text-white hover:bg-gray-700'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
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
    position: 'all',
    team: 'all',
    owner: 'all',
    minPoints: 0,
    search: ''
  });
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [sortConfig, setSortConfig] = useState({ key: 'sleeper_points_ros', direction: 'desc' });
  
  // Current gameweek state
  const [currentGameweek, setCurrentGameweek] = useState({
    number: 2,
    status: 'upcoming', 
    statusDisplay: '🏁 GW 2 (Upcoming)',
    date: 'Aug 22',
    fullDate: '2025-08-22',
    source: 'loading'
  });
  
  const { players, loading, error, lastUpdated, source, quality, ownershipData, ownershipCount, enhanced, refetch, integrated, integration } = usePlayerData();

  // Load gameweek data
  useEffect(() => {
    const loadGameweek = async () => {
      try {
        const gameweek = await getCurrentGameweek();
        setCurrentGameweek(gameweek);
        
        // Log source for debugging
        console.log(`📅 Gameweek loaded from: ${gameweek.source || 'unknown'}`);
        
        // If we have deadline info, show it in console for verification
        if (gameweek.deadline) {
          console.log(`⏰ GW${gameweek.number} deadline: ${gameweek.deadlineFormatted || gameweek.deadline}`);
        }
      } catch (error) {
        console.error('Failed to load gameweek:', error);
        // Keep the fallback currentGameweek state
      }
    };

    loadGameweek();
  }, []);

  // Update data function
  const updateData = (type = 'manual', forceRefresh = true, useCache = false) => {
    if (forceRefresh) {
      CacheManager.clear();
    }
    refetch(type, forceRefresh, useCache);
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
        if (player.sleeper_season_total) return player.sleeper_season_total;
        if (player.sleeper_season_avg) return player.sleeper_season_avg * 38;
        if (player.ffh_season_prediction) return player.ffh_season_prediction;
        if (player.predicted_pts) return player.predicted_pts;
        if (player.total_points) return player.total_points;
        return 0;
      case 'sleeper_points_next5':
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
        return player.current_ppg || 0;
      case 'predicted_ppg':
        return player.predicted_ppg || 0;
      case 'owned_by':
        return player.owned_by || 'Free Agent';
      default:
        return '';
    }
  };

  // Filter players based on current filters
  const filteredPlayers = players.filter(player => {
    // EPL TEAMS ONLY: Only show players from actual EPL teams
    if (!isEPLPlayer(player)) {
      return false;
    }

    // Position filter
    if (filters.position !== 'all') {
      const playerPos = player.position;
      const filterPos = filters.position;
      
      // Handle goalkeeper variations
      if (filterPos === 'GKP') {
        if (playerPos !== 'GKP' && playerPos !== 'GK') return false;
      } else {
        if (playerPos !== filterPos) return false;
      }
    }

    // Team filter
    if (filters.team !== 'all' && player.team !== filters.team) {
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
  const owners = [...new Set(players.filter(isEPLPlayer).map(p => p.owned_by).filter(Boolean))].sort();

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
      <div className={`min-h-screen ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-800'}`}>
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
      <div className={`min-h-screen ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-800'}`}>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center p-8">
            <h2 className="text-2xl font-bold text-red-600 mb-4">❌ Error Loading Data</h2>
            <p className={`mb-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>{error}</p>
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
        return <MatchingStats players={players} integration={integration} isDarkMode={isDarkMode} />;
      case 'optimizer': 
        return <OptimizerStats isDarkMode={isDarkMode} />;
      case 'transfers': 
        return <TransferStats players={players} isDarkMode={isDarkMode} />;
      default: 
        return null;
    }
  };

  // Main render
  return (
    <ErrorBoundary>
      <div className={`min-h-screen transition-colors ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-800'}`}>
        
        <DashboardHeader
          isDarkMode={isDarkMode}
          setIsDarkMode={setIsDarkMode}
          lastUpdated={lastUpdated}
          players={players}
          updateData={updateData}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          currentGameweek={currentGameweek}
        />

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 py-6">
          
          {/* Tab-Specific Stats Cards */}
          {renderStatsCards()}

          {/* Content based on active tab */}
          {activeTab === 'players' && (
            <>
              {/* Filters */}
              <div className={`p-4 rounded-lg mb-6 shadow-sm ${isDarkMode ? 'bg-gray-800' : 'bg-white border border-gray-200'}`}>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  {/* Position Filter */}
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      Position
                    </label>
                    <select
                      value={filters.position}
                      onChange={(e) => setFilters(prev => ({ ...prev, position: e.target.value }))}
                      className={`w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        isDarkMode 
                          ? 'bg-gray-700 border-gray-600 text-white' 
                          : 'bg-white border-gray-300 text-gray-900'
                      }`}
                    >
                      <option value="all">All Positions</option>
                      <option value="GKP">Goalkeeper</option>
                      <option value="DEF">Defender</option>
                      <option value="MID">Midfielder</option>
                      <option value="FWD">Forward</option>
                    </select>
                  </div>

                  {/* Team Filter */}
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      Team
                    </label>
                    <select
                      value={filters.team}
                      onChange={(e) => setFilters(prev => ({ ...prev, team: e.target.value }))}
                      className={`w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        isDarkMode 
                          ? 'bg-gray-700 border-gray-600 text-white' 
                          : 'bg-white border-gray-300 text-gray-900'
                      }`}
                    >
                      <option value="all">All Teams</option>
                      {EPL_TEAMS.map(teamName => (
                        <option key={teamName} value={TEAM_MAPPINGS[teamName]}>{teamName}</option>
                      ))}
                    </select>
                  </div>

                  {/* Owner Filter */}
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      Owner
                    </label>
                    <select
                      value={filters.owner}
                      onChange={(e) => setFilters(prev => ({ ...prev, owner: e.target.value }))}
                      className={`w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        isDarkMode 
                          ? 'bg-gray-700 border-gray-600 text-white' 
                          : 'bg-white border-gray-300 text-gray-900'
                      }`}
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
                    <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      Min ROS Points
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={filters.minPoints}
                      onChange={(e) => setFilters(prev => ({ ...prev, minPoints: parseFloat(e.target.value) || 0 }))}
                      className={`w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        isDarkMode 
                          ? 'bg-gray-700 border-gray-600 text-white' 
                          : 'bg-white border-gray-300 text-gray-900'
                      }`}
                      placeholder="0"
                    />
                  </div>

                  {/* Search Filter */}
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      Search
                    </label>
                    <input
                      type="text"
                      value={filters.search}
                      onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                      placeholder="Player name, team..."
                      className={`w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        isDarkMode 
                          ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                          : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                      }`}
                    />
                  </div>
                </div>
              </div>

              {/* Results Summary */}
              <div className="mb-4 flex items-center justify-between">
                <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Showing {sortedPlayers.length.toLocaleString()} of {players.length.toLocaleString()} players
                  <span className="ml-2 text-xs">
                    (Free Agents: {players.filter(p => !p.owned_by || p.owned_by === 'Free Agent').length}, 
                     Owned: {players.filter(p => p.owned_by && p.owned_by !== 'Free Agent').length})
                  </span>
                </div>
                <div className={`text-sm ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                  Click column headers to sort
                </div>
              </div>
              {/* Players Table */}
              <div className={`rounded-lg shadow-sm border overflow-hidden ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className={isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}>
                      <tr>
                        {/* Sortable headers */}
                        <th 
                          className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-opacity-75 ${
                            isDarkMode ? 'text-gray-300 hover:bg-gray-600' : 'text-gray-500 hover:bg-gray-100'
                          }`}
                          onClick={() => handleSort('name')}
                        >
                          <div className="flex items-center">
                            Player {renderSortIcon('name')}
                          </div>
                        </th>
                        <th 
                          className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-opacity-75 ${
                            isDarkMode ? 'text-gray-300 hover:bg-gray-600' : 'text-gray-500 hover:bg-gray-100'
                          }`}
                          onClick={() => handleSort('position')}
                        >
                          <div className="flex items-center">
                            Position {renderSortIcon('position')}
                          </div>
                        </th>
                        <th 
                          className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-opacity-75 ${
                            isDarkMode ? 'text-gray-300 hover:bg-gray-600' : 'text-gray-500 hover:bg-gray-100'
                          }`}
                          onClick={() => handleSort('team')}
                        >
                          <div className="flex items-center">
                            Team {renderSortIcon('team')}
                          </div>
                        </th>
                        <th 
                          className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-opacity-75 ${
                            isDarkMode ? 'text-gray-300 hover:bg-gray-600' : 'text-gray-500 hover:bg-gray-100'
                          }`}
                          onClick={() => handleSort('owned_by')}
                        >
                          <div className="flex items-center">
                            Ownership {renderSortIcon('owned_by')}
                          </div>
                        </th>
                        <th 
                          className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-opacity-75 ${
                            isDarkMode ? 'text-gray-300 hover:bg-gray-600' : 'text-gray-500 hover:bg-gray-100'
                          }`}
                          onClick={() => handleSort('sleeper_points_ros')}
                        >
                          <div className="flex items-center">
                            ROS Points {renderSortIcon('sleeper_points_ros')}
                          </div>
                        </th>
                        <th 
                          className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-opacity-75 ${
                            isDarkMode ? 'text-gray-300 hover:bg-gray-600' : 'text-gray-500 hover:bg-gray-100'
                          }`}
                          onClick={() => handleSort('sleeper_points_next5')}
                        >
                          <div className="flex items-center">
                            Next 5 GW {renderSortIcon('sleeper_points_next5')}
                          </div>
                        </th>
                        <th 
                          className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-opacity-75 ${
                            isDarkMode ? 'text-gray-300 hover:bg-gray-600' : 'text-gray-500 hover:bg-gray-100'
                          }`}
                          onClick={() => handleSort('avg_minutes_next5')}
                        >
                          <div className="flex items-center">
                            Avg Mins (Next 5) {renderSortIcon('avg_minutes_next5')}
                          </div>
                        </th>
                        <th 
                          className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-opacity-75 ${
                            isDarkMode ? 'text-gray-300 hover:bg-gray-600' : 'text-gray-500 hover:bg-gray-100'
                          }`}
                          onClick={() => handleSort('current_ppg')}
                        >
                          <div className="flex items-center">
                            PPG (Current) {renderSortIcon('current_ppg')}
                          </div>
                        </th>
                        <th 
                          className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-opacity-75 ${
                            isDarkMode ? 'text-gray-300 hover:bg-gray-600' : 'text-gray-500 hover:bg-gray-100'
                          }`}
                          onClick={() => handleSort('predicted_ppg')}
                        >
                          <div className="flex items-center">
                            PPG (Predicted) {renderSortIcon('predicted_ppg')}
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${isDarkMode ? 'bg-gray-800 divide-gray-700' : 'bg-white divide-gray-200'}`}>
                      {sortedPlayers.map((player, index) => (
                        <tr key={`${player.sleeper_id || player.id || index}`} className={`${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}`}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div>
                                <div className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                  {player.name || `${player.first_name || ''} ${player.last_name || ''}`.trim()}
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
                          <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-900'}`}>
                            {TEAM_DISPLAY_NAMES[player.team] || player.team || 'N/A'}
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
                          <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                            {(() => {
                              if (player.sleeper_season_total) return player.sleeper_season_total.toFixed(1);
                              if (player.sleeper_season_avg) return (player.sleeper_season_avg * 38).toFixed(1);
                              if (player.ffh_season_prediction) return player.ffh_season_prediction.toFixed(1);
                              if (player.predicted_pts) return player.predicted_pts.toFixed(1);
                              if (player.total_points) return player.total_points.toFixed(1);
                              return 'N/A';
                            })()}
                          </td>
                          <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-900'}`}>
                            {(() => {
                              if (player.sleeper_gw_predictions) {
                                try {
                                  const gwPreds = JSON.parse(player.sleeper_gw_predictions);
                                  const next5 = Object.values(gwPreds).slice(0, 5);
                                  return next5.length > 0 ? next5.reduce((a, b) => a + b, 0).toFixed(1) : 'N/A';
                                } catch (e) {
                                  // Fall through to next option
                                }
                              }
                              if (player.ffh_gw_predictions) {
                                try {
                                  const gwPreds = JSON.parse(player.ffh_gw_predictions);
                                  const next5 = Object.values(gwPreds).slice(0, 5);
                                  return next5.length > 0 ? next5.reduce((a, b) => a + b, 0).toFixed(1) : 'N/A';
                                } catch (e) {
                                  // Fall through to estimation
                                }
                              }
                              // Estimate: season points / 38 * 5
                              const seasonPoints = player.sleeper_season_total || (player.sleeper_season_avg * 38) || player.ffh_season_prediction || player.predicted_pts || player.total_points || 0;
                              return seasonPoints > 0 ? ((seasonPoints / 38) * 5).toFixed(1) : 'N/A';
                            })()}
                          </td>
                          <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-900'}`}>
                            {(() => {
                              // Try pre-calculated average first
                              if (player.avg_minutes_next5 && player.avg_minutes_next5 > 0) {
                                return player.avg_minutes_next5.toFixed(0);
                              }
                              
                              // Calculate from predictions array with xmins
                              if (player.predictions && Array.isArray(player.predictions)) {
                                const next5Predictions = player.predictions.slice(0, 5);
                                if (next5Predictions.length > 0) {
                                  const totalMinutes = next5Predictions.reduce((total, pred) => total + (pred.xmins || 0), 0);
                                  const avgMinutes = totalMinutes / next5Predictions.length;
                                  return avgMinutes > 0 ? avgMinutes.toFixed(0) : '0';
                                }
                              }
                              
                              // Parse FFH gameweek minute predictions
                              if (player.ffh_gw_minutes) {
                                try {
                                  const gwMinutes = JSON.parse(player.ffh_gw_minutes);
                                  const next5Minutes = Object.values(gwMinutes).slice(0, 5);
                                  if (next5Minutes.length > 0) {
                                    const avgMinutes = next5Minutes.reduce((a, b) => a + b, 0) / next5Minutes.length;
                                    return avgMinutes > 0 ? avgMinutes.toFixed(0) : '0';
                                  }
                                } catch (e) {
                                  // Continue to next option
                                }
                              }
                              
                              // Estimate from points (rough approximation)
                              if (player.sleeper_gw_predictions || player.ffh_gw_predictions) {
                                try {
                                  const predStr = player.sleeper_gw_predictions || player.ffh_gw_predictions;
                                  const gwPreds = JSON.parse(predStr);
                                  const next5Points = Object.values(gwPreds).slice(0, 5);
                                  if (next5Points.length > 0) {
                                    const avgPoints = next5Points.reduce((a, b) => a + b, 0) / next5Points.length;
                                    const position = player.position || 'MID';
                                    
                                    // Rough estimation based on position and points
                                    if (avgPoints > 3) { // Likely starter
                                      if (position === 'GKP') return '90';
                                      if (position === 'DEF') return '85';
                                      if (position === 'MID') return '80';
                                      if (position === 'FWD') return '75';
                                    } else if (avgPoints > 1.5) { // Regular player
                                      if (position === 'GKP') return '45';
                                      if (position === 'DEF') return '70';
                                      if (position === 'MID') return '65';
                                      if (position === 'FWD') return '60';
                                    } else if (avgPoints > 0.5) { // Substitute
                                      return '25';
                                    }
                                  }
                                } catch (e) {
                                  // Continue to default
                                }
                              }
                              
                              // Final fallback: Show 0 or N/A for unmatched players
                              return player.ffh_matched ? '0' : 'N/A';
                            })()}
                          </td>
                          <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-900'}`}>
                            {player.current_ppg ? player.current_ppg.toFixed(1) : 'N/A'}
                          </td>
                          <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-900'}`}>
                            {player.predicted_ppg ? player.predicted_ppg.toFixed(1) : 'N/A'}
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
                  <div className={`mb-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>No players match your current filters</div>
                  <button
                    onClick={() => {
                      setFilters({
                        position: 'all',
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
            <MatchingTabContent players={players} integration={integration} isDarkMode={isDarkMode} />
          )}

          {/* Optimizing lineup for the current GW */}
          {activeTab === 'optimizer' && (
            <OptimizerTabContent 
              isDarkMode={isDarkMode} 
              players={players}
              currentGameweek={currentGameweek}
            />
          )}
          
          {/* Get recommendations and explore free agents to pick up */}
          {activeTab === 'transfers' && (
            <TransferTabContent 
              players={players}
              currentGameweek={currentGameweek} 
              isDarkMode={isDarkMode}
            />
          )}

        </main>
      </div>
    </ErrorBoundary>
  );
}