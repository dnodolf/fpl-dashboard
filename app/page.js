'use client';

import { useState, useEffect } from 'react';

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
const getCurrentGameweek = () => {
  const now = new Date();
  const currentDate = now.toISOString().split('T')[0]; // YYYY-MM-DD format
  
  // Complete 38-gameweek schedule for 2025-26 season based on Fantrax schedule
  const gameweekDates = [
    { gw: 1, start: '2025-08-15', end: '2025-08-18' },
    { gw: 2, start: '2025-08-22', end: '2025-08-25' },
    { gw: 3, start: '2025-08-30', end: '2025-09-01' },
    { gw: 4, start: '2025-09-13', end: '2025-09-15' },
    { gw: 5, start: '2025-09-20', end: '2025-09-22' },
    { gw: 6, start: '2025-09-27', end: '2025-09-29' },
    { gw: 7, start: '2025-10-04', end: '2025-10-06' },
    { gw: 8, start: '2025-10-18', end: '2025-10-20' },
    { gw: 9, start: '2025-10-25', end: '2025-10-27' },
    { gw: 10, start: '2025-11-01', end: '2025-11-03' },
    { gw: 11, start: '2025-11-08', end: '2025-11-10' },
    { gw: 12, start: '2025-11-22', end: '2025-11-24' },
    { gw: 13, start: '2025-11-29', end: '2025-12-01' },
    { gw: 14, start: '2025-12-03', end: '2025-12-05' },
    { gw: 15, start: '2025-12-06', end: '2025-12-08' },
    { gw: 16, start: '2025-12-13', end: '2025-12-15' },
    { gw: 17, start: '2025-12-20', end: '2025-12-22' },
    { gw: 18, start: '2025-12-26', end: '2025-12-28' },
    { gw: 19, start: '2025-12-29', end: '2025-12-30' },
    { gw: 20, start: '2026-01-01', end: '2026-01-02' },
    { gw: 21, start: '2026-01-14', end: '2026-01-16' },
    { gw: 22, start: '2026-01-18', end: '2026-01-20' },
    { gw: 23, start: '2026-01-25', end: '2026-01-27' },
    { gw: 24, start: '2026-02-01', end: '2026-02-03' },
    { gw: 25, start: '2026-02-22', end: '2026-02-24' },
    { gw: 26, start: '2026-02-25', end: '2026-02-26' },
    { gw: 27, start: '2026-03-03', end: '2026-03-05' },
    { gw: 28, start: '2026-03-08', end: '2026-03-10' },
    { gw: 29, start: '2026-03-15', end: '2026-03-17' },
    { gw: 30, start: '2026-04-04', end: '2026-04-06' },
    { gw: 31, start: '2026-04-11', end: '2026-04-13' },
    { gw: 32, start: '2026-04-18', end: '2026-04-20' },
    { gw: 33, start: '2026-04-25', end: '2026-04-27' },
    { gw: 34, start: '2026-05-02', end: '2026-05-04' },
    { gw: 35, start: '2026-05-09', end: '2026-05-11' },
    { gw: 36, start: '2026-05-16', end: '2026-05-18' },
    { gw: 37, start: '2026-05-23', end: '2026-05-25' },
    { gw: 38, start: '2026-05-24', end: '2026-05-24' }
  ];

  // Find current gameweek
  for (let i = 0; i < gameweekDates.length; i++) {
    const gw = gameweekDates[i];
    
    if (currentDate < gw.start) {
      // Upcoming gameweek
      const startDate = new Date(gw.start);
      return {
        number: gw.gw,
        status: 'upcoming',
        statusDisplay: `🏁 GW ${gw.gw} (Upcoming)`,
        date: startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        fullDate: gw.start
      };
    } else if (currentDate >= gw.start && currentDate <= gw.end) {
      // Live gameweek
      const endDate = new Date(gw.end);
      return {
        number: gw.gw,
        status: 'live',
        statusDisplay: `🔴 GW ${gw.gw} (Live)`,
        date: endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        fullDate: gw.end
      };
    }
  }

  // Default to GW 1 if before season start
  return {
    number: 1,
    status: 'upcoming',
    statusDisplay: '🏁 GW 1 (Upcoming)',
    date: 'Aug 15',
    fullDate: '2025-08-15'
  };
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

// ----------------- TAB-SPECIFIC STATS COMPONENTS -----------------
const MatchingStats = ({ players, integration, isDarkMode }) => {
  const matchedCount = players.filter(player => player.match_confidence).length;
  const totalSleeperCount = integration?.matchingStats?.total || players.length;
  const matchRate = integration?.matchingStats?.matchRate || 
    (players.length > 0 ? Math.round((matchedCount / players.length) * 100) : 0);

  // Calculate confidence breakdown
  const confidenceStats = players.reduce((acc, player) => {
    if (player.match_confidence) {
      const confidence = player.match_confidence;
      acc[confidence] = (acc[confidence] || 0) + 1;
    }
    return acc;
  }, {});

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      {/* Total Players */}
      <div className={`p-4 rounded-lg shadow-sm ${isDarkMode ? 'bg-gray-800' : 'bg-white border border-gray-200'}`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold text-blue-600">
              {integration?.sleeperTotal?.toLocaleString() || totalSleeperCount.toLocaleString()}
            </div>
            <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Total Players</div>
          </div>
          <div className="text-blue-500 text-2xl">👥</div>
        </div>
      </div>

      {/* Matched Players */}
      <div className={`p-4 rounded-lg shadow-sm ${isDarkMode ? 'bg-gray-800' : 'bg-white border border-gray-200'}`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold text-green-600">
              {integration?.enhancedTotal?.toLocaleString() || matchedCount.toLocaleString()}
            </div>
            <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Matched Players</div>
          </div>
          <div className="text-green-500 text-2xl">🔗</div>
        </div>
      </div>

      {/* Match Success Rate */}
      <div className={`p-4 rounded-lg shadow-sm ${isDarkMode ? 'bg-gray-800' : 'bg-white border border-gray-200'}`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold text-purple-600">
              {integration?.matchingStats?.matchRate || matchRate}%
            </div>
            <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Match Success</div>
          </div>
          <div className="text-purple-500 text-2xl">📊</div>
        </div>
      </div>

      {/* Match Confidence Breakdown */}
      <div className={`p-4 rounded-lg shadow-sm ${isDarkMode ? 'bg-gray-800' : 'bg-white border border-gray-200'}`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1">
              <span className="text-2xl font-bold text-green-500">
                {confidenceStats.High || 0}
              </span>
              <span className="text-2xl font-bold text-yellow-500">
                {confidenceStats.Medium || 0}
              </span>
              <span className="text-2xl font-bold text-red-500">
                {confidenceStats.Low || 0}
              </span>
            </div>
            <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>High • Med • Low</div>
          </div>
          <div className="text-orange-500 text-2xl">🎯</div>
        </div>
      </div>
    </div>
  );
};

const OptimizerStats = ({ isDarkMode }) => (
  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
    {/* Current Roster Points */}
    <div className={`p-4 rounded-lg shadow-sm ${isDarkMode ? 'bg-gray-800' : 'bg-white border border-gray-200'}`}>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-2xl font-bold text-blue-600">--</div>
          <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Current Roster Points</div>
        </div>
        <div className="text-blue-500 text-2xl">⚽</div>
      </div>
    </div>

    {/* Optimized Roster Points */}
    <div className={`p-4 rounded-lg shadow-sm ${isDarkMode ? 'bg-gray-800' : 'bg-white border border-gray-200'}`}>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-2xl font-bold text-green-600">--</div>
          <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Optimized Roster Points</div>
        </div>
        <div className="text-green-500 text-2xl">🚀</div>
      </div>
    </div>

    {/* % Optimized */}
    <div className={`p-4 rounded-lg shadow-sm ${isDarkMode ? 'bg-gray-800' : 'bg-white border border-gray-200'}`}>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-2xl font-bold text-purple-600">--%</div>
          <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>% Optimized</div>
        </div>
        <div className="text-purple-500 text-2xl">📈</div>
      </div>
    </div>

    {/* Players to Swap */}
    <div className={`p-4 rounded-lg shadow-sm ${isDarkMode ? 'bg-gray-800' : 'bg-white border border-gray-200'}`}>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-2xl font-bold text-orange-600">--</div>
          <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Players to Swap</div>
        </div>
        <div className="text-orange-500 text-2xl">🔄</div>
      </div>
    </div>
  </div>
);

const TransferStats = ({ players, isDarkMode }) => {
  // Calculate transfer analytics
  const freeAgents = players.filter(p => !p.owned_by);
  const ownedPlayers = players.filter(p => p.owned_by);
  
  // Find outperforming free agents (simplistic calculation for now)
  const outperformingFAs = freeAgents.filter(fa => {
    const faPoints = fa.sleeper_points_ros || fa.total_points || 0;
    return ownedPlayers.some(owned => (owned.sleeper_points_ros || owned.total_points || 0) < faPoints);
  });

  // Calculate recommended moves (best FA vs worst owned)
  const worstOwned = ownedPlayers.sort((a, b) => 
    (a.sleeper_points_ros || a.total_points || 0) - (b.sleeper_points_ros || b.total_points || 0)
  )[0];
  const bestFA = freeAgents.sort((a, b) => 
    (b.sleeper_points_ros || b.total_points || 0) - (a.sleeper_points_ros || a.total_points || 0)
  )[0];

  const hasUpgrades = outperformingFAs.length > 0;
  const statusMessage = hasUpgrades ? "Upgrades Available" : "Team Optimized";
  const statusColor = hasUpgrades ? "orange" : "green";

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
            <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Show Upgrades Only</div>
          </div>
          <div className="text-green-500 text-2xl">⭐</div>
        </div>
      </div>

      {/* Recommended Moves */}
      <div className={`p-4 rounded-lg shadow-sm ${isDarkMode ? 'bg-gray-800' : 'bg-white border border-gray-200'}`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold text-purple-600">
              {(bestFA && worstOwned) ? 1 : 0}
            </div>
            <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Recommended Moves</div>
          </div>
          <div className="text-purple-500 text-2xl">💡</div>
        </div>
      </div>

      {/* Status */}
      <div className={`p-4 rounded-lg shadow-sm ${isDarkMode ? 'bg-gray-800' : 'bg-white border border-gray-200'}`}>
        <div className="flex items-center justify-between">
          <div>
            <div className={`text-lg font-bold text-${statusColor}-600`}>
              {statusMessage}
            </div>
            <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Status</div>
          </div>
          <div className={`text-${statusColor}-500 text-2xl`}>
            {hasUpgrades ? "🚨" : "✅"}
          </div>
        </div>
      </div>
    </div>
  );
};

// ----------------- DASHBOARD HEADER COMPONENT -----------------
const DashboardHeader = ({ isDarkMode, setIsDarkMode, lastUpdated, players, updateData, activeTab, setActiveTab }) => {
  const currentGameweek = getCurrentGameweek();
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
            <div className={`${isDarkMode ? 'bg-blue-900 border-blue-700' : 'bg-blue-50 border-blue-200'} border rounded-lg px-3 py-2`}>
              <div className={`text-sm font-medium ${isDarkMode ? 'text-blue-100' : 'text-blue-900'}`}>
                {currentGameweek.statusDisplay}
              </div>
              <div className={`text-xs ${isDarkMode ? 'text-blue-200' : 'text-blue-600'}`}>
                {currentGameweek.status === 'upcoming' ? 'Starts' : 'Ends'}: {currentGameweek.date}
              </div>
            </div>

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
    minPoints: 0, // ✅ FIXED: Changed back to 0
    search: ''
  });
  const [isDarkMode, setIsDarkMode] = useState(true); // ✅ FIXED: Back to dark mode default
  const [sortConfig, setSortConfig] = useState({ key: 'sleeper_points_ros', direction: 'desc' }); // ✅ ADDED: Sorting state
  
  const { players, loading, error, lastUpdated, source, quality, ownershipData, ownershipCount, enhanced, refetch, integrated, integration } = usePlayerData();

  // Update data function
  const updateData = (type = 'manual', forceRefresh = true, useCache = false) => {
    if (forceRefresh) {
      CacheManager.clear();
    }
    refetch(type, forceRefresh, useCache);
  };

  // ✅ ADDED: Sorting function
  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // ✅ REVERTED: Use original working point field names
  const getSortValue = (player, key) => {
    switch (key) {
      case 'name':
        return (player.name || `${player.first_name || ''} ${player.last_name || ''}`.trim()).toLowerCase();
      case 'position':
        return player.position || '';
      case 'team':
        return player.team || '';
      case 'sleeper_points_ros':
        // Use original working field names
        if (player.sleeper_season_total) return player.sleeper_season_total;
        if (player.sleeper_season_avg) return player.sleeper_season_avg * 38;
        if (player.ffh_season_prediction) return player.ffh_season_prediction;
        if (player.predicted_pts) return player.predicted_pts;
        if (player.total_points) return player.total_points;
        return 0;
      case 'sleeper_points_next5':
        // Try to get next 5 games from GW predictions
        if (player.sleeper_gw_predictions) {
          try {
            const gwPreds = JSON.parse(player.sleeper_gw_predictions);
            const next5 = Object.values(gwPreds).slice(0, 5);
            return next5.length > 0 ? next5.reduce((a, b) => a + b, 0) : 0;
          } catch (e) {
            // Fall back to estimation
          }
        }
        if (player.ffh_gw_predictions) {
          try {
            const gwPreds = JSON.parse(player.ffh_gw_predictions);
            const next5 = Object.values(gwPreds).slice(0, 5);
            return next5.length > 0 ? next5.reduce((a, b) => a + b, 0) : 0;
          } catch (e) {
            // Fall back to estimation
          }
        }
        // Estimate: season points / 38 * 5
        const seasonPoints = this.getSortValue(player, 'sleeper_points_ros');
        return seasonPoints > 0 ? (seasonPoints / 38) * 5 : 0;
      case 'owned_by':
        return player.owned_by || 'Free Agent';
      default:
        return '';
    }
  };

  // Filter players based on current filters
  const filteredPlayers = players.filter(player => {
    // Position filter
    if (filters.position !== 'all' && player.position !== filters.position) {
      return false;
    }

    // Team filter
    if (filters.team !== 'all' && player.team !== filters.team) {
      return false;
    }

    // ✅ FIXED: Owner filter - correct logic for free agents
    if (filters.owner !== 'all') {
      if (filters.owner === 'Free Agent' && player.owned_by && player.owned_by !== 'Free Agent') return false;
      if (filters.owner === 'ThatDerekGuy' && player.owned_by !== 'ThatDerekGuy') return false;
      if (filters.owner !== 'Free Agent' && filters.owner !== 'ThatDerekGuy' && player.owned_by !== filters.owner) return false;
    }

    // Min points filter - ✅ REVERTED: Use original working point logic
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

  // ✅ ADDED: Sort players based on sort config
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
  const teams = [...new Set(players.map(p => p.team).filter(Boolean))].sort();
  const owners = [...new Set(players.map(p => p.owned_by).filter(Boolean))].sort();

  // ✅ ADDED: Render sort icon
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
                      {teams.map(team => (
                        <option key={team} value={team}>{team}</option>
                      ))}
                    </select>
                  </div>

                  {/* ✅ SIMPLIFIED: Owner Filter (removed availability dropdown) */}
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
                      <option value="ThatDerekGuy">My Players</option>
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

              {/* Results Summary with Debug Info */}
              <div className="mb-4 flex items-center justify-between">
                <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Showing {sortedPlayers.length.toLocaleString()} of {players.length.toLocaleString()} players
                  {/* Debug: Show free agent count */}
                  <span className="ml-2 text-xs">
                    (Free Agents: {players.filter(p => !p.owned_by).length}, 
                     Owned: {players.filter(p => p.owned_by).length})
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
                        {/* ✅ ADDED: Sortable headers */}
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
                            {/* ✅ FIXED: Sleeper position colors */}
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getSleeperPositionStyle(player.position)}`}>
                              {player.position || 'N/A'}
                            </span>
                          </td>
                          <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-900'}`}>
                            {player.team || 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            {player.owned_by ? (
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                player.owned_by === 'ThatDerekGuy' 
                                  ? 'bg-blue-100 text-blue-800 border border-blue-300'
                                  : 'bg-purple-100 text-purple-800 border border-purple-300'
                              }`}>
                                {player.owned_by === 'ThatDerekGuy' ? '👤 My Player' : player.owned_by}
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-300">
                                🆓 Free Agent
                              </span>
                            )}
                          </td>
                          <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                            {(() => {
                              // ✅ REVERTED: Use original working point logic
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
                              // ✅ REVERTED: Use original working next 5 logic
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
                        minPoints: 0, // ✅ FIXED: Back to 0
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

          {/* Other tabs content - placeholder for now */}
          {activeTab === 'matching' && (
            <div className={`rounded-lg shadow-sm border p-6 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
              <h3 className={`text-lg font-medium mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Player Matching Details</h3>
              <p className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
                Detailed matching statistics and diagnostics will be displayed here.
                Currently showing {players.filter(p => p.match_confidence).length} successfully matched players.
              </p>
            </div>
          )}

          {activeTab === 'optimizer' && (
            <div className={`rounded-lg shadow-sm border p-6 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
              <h3 className={`text-lg font-medium mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Formation Optimizer</h3>
              <p className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
                Formation optimization tools will be available here soon.
                Analyze different formations and find the optimal lineup based on predicted points.
              </p>
            </div>
          )}

          {activeTab === 'transfers' && (
            <div className={`rounded-lg shadow-sm border p-6 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
              <h3 className={`text-lg font-medium mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Transfer Analysis</h3>
              <p className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
                Smart transfer recommendations and roster analysis will be displayed here.
                Compare your current roster with available free agents to find optimal moves.
              </p>
            </div>
          )}

        </main>
      </div>
    </ErrorBoundary>
  );
}