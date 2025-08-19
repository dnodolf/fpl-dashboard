'use client';

import { useState, useEffect } from 'react';

// ----------------- LOADING SPINNER COMPONENT -----------------
const LoadingSpinner = ({ message = "Loading..." }) => (
  <div className="flex items-center justify-center p-8">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mr-3"></div>
    <span>{message}</span>
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
        <h2>Something went wrong.</h2>
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
        statusDisplay: `GW ${gw.gw} (Upcoming)`,
        date: startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        fullDate: gw.start
      };
    } else if (currentDate >= gw.start && currentDate <= gw.end) {
      // Live gameweek
      const endDate = new Date(gw.end);
      return {
        number: gw.gw,
        status: 'live',
        statusDisplay: `GW ${gw.gw} (Live)`,
        date: endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        fullDate: gw.end
      };
    }
  }

  // Default to GW 1 if before season start
  return {
    number: 1,
    status: 'upcoming',
    statusDisplay: 'GW 1 (Upcoming)',
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

// ----------------- TAB-SPECIFIC STATS COMPONENTS -----------------
const MatchingStats = ({ players, integration }) => {
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
      <div className="p-4 rounded-lg shadow-sm bg-white border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold text-blue-600">
              {integration?.sleeperTotal?.toLocaleString() || totalSleeperCount.toLocaleString()}
            </div>
            <div className="text-sm text-gray-600">Total Players</div>
          </div>
          <div className="text-blue-500 text-2xl">👥</div>
        </div>
      </div>

      {/* Matched Players */}
      <div className="p-4 rounded-lg shadow-sm bg-white border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold text-green-600">
              {integration?.enhancedTotal?.toLocaleString() || matchedCount.toLocaleString()}
            </div>
            <div className="text-sm text-gray-600">Matched Players</div>
          </div>
          <div className="text-green-500 text-2xl">🔗</div>
        </div>
      </div>

      {/* Match Success Rate */}
      <div className="p-4 rounded-lg shadow-sm bg-white border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold text-purple-600">
              {integration?.matchingStats?.matchRate || matchRate}%
            </div>
            <div className="text-sm text-gray-600">Match Success</div>
          </div>
          <div className="text-purple-500 text-2xl">📊</div>
        </div>
      </div>

      {/* Match Confidence Breakdown */}
      <div className="p-4 rounded-lg shadow-sm bg-white border border-gray-200">
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
            <div className="text-sm text-gray-600">High • Med • Low</div>
          </div>
          <div className="text-orange-500 text-2xl">🎯</div>
        </div>
      </div>
    </div>
  );
};

const OptimizerStats = () => (
  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
    {/* Current Roster Points */}
    <div className="p-4 rounded-lg shadow-sm bg-white border border-gray-200">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-2xl font-bold text-blue-600">--</div>
          <div className="text-sm text-gray-600">Current Roster Points</div>
        </div>
        <div className="text-blue-500 text-2xl">⚽</div>
      </div>
    </div>

    {/* Optimized Roster Points */}
    <div className="p-4 rounded-lg shadow-sm bg-white border border-gray-200">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-2xl font-bold text-green-600">--</div>
          <div className="text-sm text-gray-600">Optimized Roster Points</div>
        </div>
        <div className="text-green-500 text-2xl">🚀</div>
      </div>
    </div>

    {/* % Optimized */}
    <div className="p-4 rounded-lg shadow-sm bg-white border border-gray-200">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-2xl font-bold text-purple-600">--%</div>
          <div className="text-sm text-gray-600">% Optimized</div>
        </div>
        <div className="text-purple-500 text-2xl">📈</div>
      </div>
    </div>

    {/* Players to Swap */}
    <div className="p-4 rounded-lg shadow-sm bg-white border border-gray-200">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-2xl font-bold text-orange-600">--</div>
          <div className="text-sm text-gray-600">Players to Swap</div>
        </div>
        <div className="text-orange-500 text-2xl">🔄</div>
      </div>
    </div>
  </div>
);

const TransferStats = ({ players }) => {
  // Calculate transfer analytics
  const freeAgents = players.filter(p => !p.owned_by);
  const ownedPlayers = players.filter(p => p.owned_by);
  
  // Find outperforming free agents (simplistic calculation for now)
  const outperformingFAs = freeAgents.filter(fa => {
    const faPoints = fa.sleeper_points_ros || 0;
    return ownedPlayers.some(owned => (owned.sleeper_points_ros || 0) < faPoints);
  });

  // Calculate recommended moves (best FA vs worst owned)
  const worstOwned = ownedPlayers.sort((a, b) => 
    (a.sleeper_points_ros || 0) - (b.sleeper_points_ros || 0)
  )[0];
  const bestFA = freeAgents.sort((a, b) => 
    (b.sleeper_points_ros || 0) - (a.sleeper_points_ros || 0)
  )[0];

  const hasUpgrades = outperformingFAs.length > 0;
  const statusMessage = hasUpgrades ? "Upgrades Available" : "Team Optimized";
  const statusColor = hasUpgrades ? "orange" : "green";

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      {/* Available Free Agents */}
      <div className="p-4 rounded-lg shadow-sm bg-white border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold text-blue-600">{freeAgents.length}</div>
            <div className="text-sm text-gray-600">Available Free Agents</div>
          </div>
          <div className="text-blue-500 text-2xl">🆓</div>
        </div>
      </div>

      {/* Outperforming Free Agents */}
      <div className="p-4 rounded-lg shadow-sm bg-white border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold text-green-600">{outperformingFAs.length}</div>
            <div className="text-sm text-gray-600">Outperforming Free Agents</div>
          </div>
          <div className="text-green-500 text-2xl">⭐</div>
        </div>
      </div>

      {/* Recommended Moves */}
      <div className="p-4 rounded-lg shadow-sm bg-white border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold text-purple-600">
              {(bestFA && worstOwned) ? 1 : 0}
            </div>
            <div className="text-sm text-gray-600">Recommended Moves</div>
          </div>
          <div className="text-purple-500 text-2xl">💡</div>
        </div>
      </div>

      {/* Status */}
      <div className="p-4 rounded-lg shadow-sm bg-white border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <div className={`text-lg font-bold text-${statusColor}-600`}>
              {statusMessage}
            </div>
            <div className="text-sm text-gray-600">Status</div>
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
const DashboardHeader = ({ lastUpdated, players, updateData, activeTab, setActiveTab }) => {
  const currentGameweek = getCurrentGameweek();
  const freshnessStatus = getDataFreshnessStatus(lastUpdated);
  const cacheAge = CacheManager.getAge();

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 py-4">
        {/* Top Row: Title, Gameweek, Update Button */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-gray-900">⚽ FPL Dashboard</h1>
            
            {/* Data Freshness Indicator */}
            <div className="flex items-center gap-2 text-sm">
              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-${freshnessStatus.color}-100 text-${freshnessStatus.color}-800`}>
                🕒 {freshnessStatus.message}
              </span>
              {cacheAge && (
                <span className="text-gray-500 text-xs">
                  (cached {cacheAge}s ago)
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Current Gameweek with Enhanced Display */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
              <div className="text-sm font-medium text-blue-900">
                {currentGameweek.statusDisplay}
              </div>
              <div className="text-xs text-blue-600">
                {currentGameweek.status === 'upcoming' ? 'Starts' : 'Ends'}: {currentGameweek.date}
              </div>
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
            { id: 'transfers', label: 'Transfers' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 font-medium rounded-lg transition-colors ${
                activeTab === tab.id
                  ? 'bg-blue-500 text-white'
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
    availability: 'all',
    team: 'all',
    minPoints: 0.1, // ✅ PHASE 1: Changed default from 0 to 0.1
    search: ''
  });
  const [showUpgradesOnly, setShowUpgradesOnly] = useState(false); // ✅ PHASE 1: Quick action filter
  
  const { players, loading, error, lastUpdated, source, quality, ownershipData, ownershipCount, enhanced, refetch, integrated, integration } = usePlayerData();

  // Update data function
  const updateData = (type = 'manual', forceRefresh = true, useCache = false) => {
    if (forceRefresh) {
      CacheManager.clear();
    }
    refetch(type, forceRefresh, useCache);
  };

  // Filter players based on current filters and quick actions
  const filteredPlayers = players.filter(player => {
    // Position filter
    if (filters.position !== 'all' && player.position !== filters.position) {
      return false;
    }

    // Availability filter
    if (filters.availability !== 'all') {
      if (filters.availability === 'available' && player.owned_by) return false;
      if (filters.availability === 'owned' && !player.owned_by) return false;
    }

    // Team filter
    if (filters.team !== 'all' && player.team !== filters.team) {
      return false;
    }

    // Min points filter
    const playerPoints = player.sleeper_points_ros || 0;
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

    // ✅ PHASE 1: Show Upgrades Only filter
    if (showUpgradesOnly && player.owned_by) {
      return false; // Only show available players when "upgrades only" is active
    }

    return true;
  });

  // Sort players by ROS points (highest first) as default
  const sortedPlayers = [...filteredPlayers].sort((a, b) => {
    const aPoints = a.sleeper_points_ros || 0;
    const bPoints = b.sleeper_points_ros || 0;
    return bPoints - aPoints;
  });

  // Get unique teams for filter dropdown
  const teams = [...new Set(players.map(p => p.team).filter(Boolean))].sort();

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 text-gray-800">
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
      <div className="min-h-screen bg-gray-50 text-gray-800">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center p-8">
            <h2 className="text-2xl font-bold text-red-600 mb-4">❌ Error Loading Data</h2>
            <p className="text-gray-600 mb-4">{error}</p>
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
        return null; // ✅ PHASE 1: No stats cards for players tab
      case 'matching': 
        return <MatchingStats players={players} integration={integration} />;
      case 'optimizer': 
        return <OptimizerStats />;
      case 'transfers': 
        return <TransferStats players={players} />;
      default: 
        return null;
    }
  };

  // Main render
  return (
    <ErrorBoundary>
      <div className="min-h-screen transition-colors bg-gray-50 text-gray-800">
        
        <DashboardHeader
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
              <div className="p-4 rounded-lg mb-6 shadow-sm bg-white border border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                  {/* Position Filter */}
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700">
                      Position
                    </label>
                    <select
                      value={filters.position}
                      onChange={(e) => setFilters(prev => ({ ...prev, position: e.target.value }))}
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="all">All Positions</option>
                      <option value="GKP">Goalkeeper</option>
                      <option value="DEF">Defender</option>
                      <option value="MID">Midfielder</option>
                      <option value="FWD">Forward</option>
                    </select>
                  </div>

                  {/* Availability Filter */}
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700">
                      Availability
                    </label>
                    <select
                      value={filters.availability}
                      onChange={(e) => setFilters(prev => ({ ...prev, availability: e.target.value }))}
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="all">All Players</option>
                      <option value="available">Free Agents</option>
                      <option value="owned">Owned Players</option>
                    </select>
                  </div>

                  {/* Team Filter */}
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700">
                      Team
                    </label>
                    <select
                      value={filters.team}
                      onChange={(e) => setFilters(prev => ({ ...prev, team: e.target.value }))}
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="all">All Teams</option>
                      {teams.map(team => (
                        <option key={team} value={team}>{team}</option>
                      ))}
                    </select>
                  </div>

                  {/* Min Points Filter */}
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700">
                      Min ROS Points
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={filters.minPoints}
                      onChange={(e) => setFilters(prev => ({ ...prev, minPoints: parseFloat(e.target.value) || 0 }))}
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="0.1"
                    />
                  </div>

                  {/* Search Filter */}
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700">
                      Search
                    </label>
                    <input
                      type="text"
                      value={filters.search}
                      onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                      placeholder="Player name, team..."
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  {/* ✅ PHASE 1: Quick Action - Show Upgrades Only */}
                  <div className="flex items-end">
                    <button
                      onClick={() => setShowUpgradesOnly(!showUpgradesOnly)}
                      className={`px-4 py-2 rounded-md font-medium transition-colors ${
                        showUpgradesOnly 
                          ? 'bg-orange-500 text-white' 
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      {showUpgradesOnly ? '✅ Upgrades Only' : '🔍 Show Upgrades Only'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Results Summary */}
              <div className="mb-4 flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Showing {sortedPlayers.length.toLocaleString()} of {players.length.toLocaleString()} players
                  {showUpgradesOnly && <span className="ml-2 text-orange-600 font-medium">(Upgrades Only)</span>}
                </div>
                <div className="text-sm text-gray-500">
                  Sorted by ROS Points (highest first)
                </div>
              </div>

              {/* Players Table */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Player
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Position
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Team
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          ROS Points
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Next 5 GW
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Ownership
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {sortedPlayers.map((player, index) => (
                        <tr key={`${player.sleeper_id || player.id || index}`} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div>
                                <div className="text-sm font-medium text-gray-900">
                                  {player.name || `${player.first_name || ''} ${player.last_name || ''}`.trim()}
                                  {/* ✅ PHASE 1: Removed match confidence badges */}
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
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              player.position === 'GKP' ? 'bg-yellow-100 text-yellow-800' :
                              player.position === 'DEF' ? 'bg-blue-100 text-blue-800' :
                              player.position === 'MID' ? 'bg-green-100 text-green-800' :
                              player.position === 'FWD' ? 'bg-red-100 text-red-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {player.position || 'N/A'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {player.team || 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {player.sleeper_points_ros ? player.sleeper_points_ros.toFixed(1) : 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {player.sleeper_points_next5 ? player.sleeper_points_next5.toFixed(1) : 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {player.owned_by ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                {player.owned_by}
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                Free Agent
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {player.match_confidence ? (
                              <span className="text-xs text-gray-500">
                                Matched
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400">
                                No prediction
                              </span>
                            )}
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
                  <div className="text-gray-500 mb-2">No players match your current filters</div>
                  <button
                    onClick={() => {
                      setFilters({
                        position: 'all',
                        availability: 'all',
                        team: 'all',
                        minPoints: 0.1,
                        search: ''
                      });
                      setShowUpgradesOnly(false);
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
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Player Matching Details</h3>
              <p className="text-gray-600">
                Detailed matching statistics and diagnostics will be displayed here.
                Currently showing {players.filter(p => p.match_confidence).length} successfully matched players.
              </p>
            </div>
          )}

          {activeTab === 'optimizer' && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Formation Optimizer</h3>
              <p className="text-gray-600">
                Formation optimization tools will be available here soon.
                Analyze different formations and find the optimal lineup based on predicted points.
              </p>
            </div>
          )}

          {activeTab === 'transfers' && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Transfer Analysis</h3>
              <p className="text-gray-600">
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