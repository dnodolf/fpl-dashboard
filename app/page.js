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

// ----------------- HEADER COMPONENT -----------------
const DashboardHeader = ({ 
  isDarkMode, 
  setIsDarkMode, 
  lastUpdated, 
  source, 
  players = [], 
  quality, 
  ownershipData, 
  ownershipCount,
  enhanced,
  refetch,
  activeTab,
  setActiveTab
}) => (
  <header className={`${
    isDarkMode ? 'bg-gray-800' : 'bg-white'
  } shadow-sm border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
    <div className="max-w-7xl mx-auto px-4 py-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">🏆 FPL Roster Explorer</h1>
          {lastUpdated && (
            <div className="text-sm opacity-75 mt-1 space-x-4">
              <span>Last updated: {new Date(lastUpdated).toLocaleString()}</span>
              {source && <span>• Source: {source}</span>}
              {enhanced && <span>• Enhanced ✨</span>}
              {ownershipData && <span>• Ownership data: {ownershipCount} players</span>}
              {quality && (
                <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                  quality.completenessScore >= 90 ? 'bg-green-100 text-green-800' :
                  quality.completenessScore >= 70 ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  Data Quality: {quality.completenessScore}%
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex gap-4 items-center">
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className={`p-2 rounded-lg transition-colors ${
              isDarkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'
            }`}
          >
            {isDarkMode ? '☀️' : '🌙'}
          </button>
          <div className="flex gap-2">
            <button 
              onClick={() => refetch('sheets')}
              className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded text-sm transition-colors"
              title="Load from Google Sheets"
            >
              📊 Sheets
            </button>
            <button 
              onClick={() => refetch('ffh')}
              className="bg-green-500 hover:bg-green-600 text-white px-3 py-2 rounded text-sm transition-colors"
              title="Load fresh FFH predictions"
            >
              🔄 FFH
            </button>
            <button 
              onClick={() => refetch('auto', true, true)}
              className="bg-purple-500 hover:bg-purple-600 text-white px-3 py-2 rounded text-sm transition-colors"
              title="Use integrated matching system"
            >
              🔗 Integrated
            </button>
            <button 
              onClick={() => refetch('auto', true)}
              className="bg-orange-500 hover:bg-orange-600 text-white px-3 py-2 rounded text-sm transition-colors"
              title="Auto-select best source with fresh data"
            >
              ⚡ Refresh
            </button>
          </div>
        </div>
      </div>
      
      {/* Navigation Tabs */}
      <nav className="mt-4">
        <div className="flex gap-1 overflow-x-auto">
          {[
            { id: 'players', label: '👥 Players', desc: `Browse ${players?.length || 0} players` },
            { id: 'matching', label: '🔗 Matching', desc: 'Player matching system' },
            { id: 'optimizer', label: '⚡ Optimizer', desc: 'Find optimal lineups' },
            { id: 'transfers', label: '🔄 Transfers', desc: 'Transfer suggestions' },
            { id: 'analytics', label: '📊 Analytics', desc: 'Performance insights' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 rounded-lg font-medium transition-colors min-w-max ${
                activeTab === tab.id
                  ? 'bg-blue-500 text-white'
                  : isDarkMode 
                    ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              <div className="text-sm">{tab.label}</div>
              <div className="text-xs opacity-75">{tab.desc}</div>
            </button>
          ))}
        </div>
      </nav>
    </div>
  </header>
);

// ----------------- PLAYER CARD COMPONENT -----------------
const PlayerCard = ({ player, isDarkMode }) => {
  // Handle different data structures
  const getName = () => {
    if (player.web_name) return player.web_name;
    if (player.first_name && player.second_name) return `${player.first_name} ${player.second_name}`;
    if (player.name) return player.name;
    if (player.full_name) return player.full_name;
    return 'Unknown Player';
  };

  const getTeam = () => {
    if (player.team?.code_name) return player.team.code_name;
    if (player.team_abbr) return player.team_abbr;
    if (player.team_name) return player.team_name;
    if (player.club) return player.club;
    if (player.team) return player.team;
    return 'Unknown Team';
  };

  const getPosition = () => {
    if (player.position) return player.position;
    if (player.position_id) {
      const positions = { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' };
      return positions[player.position_id] || 'Unknown';
    }
    if (player.element_type) {
      const positions = { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' };
      return positions[player.element_type] || 'Unknown';
    }
    return 'Unknown';
  };

  const getPrice = () => {
    if (player.ffh_price) return player.ffh_price.toFixed(1);
    if (player.now_cost) return (player.now_cost / 10).toFixed(1);
    if (player.cost) return (player.cost / 10).toFixed(1);
    if (player.price) return player.price;
    return 'N/A';
  };

  const getPoints = () => {
    // For integrated players, prefer Sleeper converted points
    if (player.sleeper_season_total) return player.sleeper_season_total.toFixed(1);
    if (player.sleeper_season_avg) return (player.sleeper_season_avg * 38).toFixed(1);
    if (player.ffh_season_prediction) return player.ffh_season_prediction.toFixed(1);
    if (player.predicted_pts) return player.predicted_pts.toFixed(1);
    if (player.total_points) return player.total_points;
    if (player.points) return player.points;
    return 'N/A';
  };

  const getOwnership = () => {
    if (player.owned_by) return player.owned_by;
    if (player.owner_name) return player.owner_name;
    if (player.selected_by_percent) return `${player.selected_by_percent}%`;
    return player.is_available === false ? 'Owned' : 'Available';
  };

  const getPositionColor = () => {
    const position = getPosition();
    const colors = {
      'GK': 'bg-yellow-100 text-yellow-800',
      'GKP': 'bg-yellow-100 text-yellow-800',
      'DEF': 'bg-blue-100 text-blue-800',
      'MID': 'bg-green-100 text-green-800',
      'FWD': 'bg-red-100 text-red-800'
    };
    return colors[position] || 'bg-gray-100 text-gray-800';
  };

  const getMatchingBadge = () => {
    if (!player.match_confidence) return null;
    
    const colors = {
      'High': 'bg-green-100 text-green-800',
      'Medium': 'bg-yellow-100 text-yellow-800',
      'Low': 'bg-red-100 text-red-800'
    };
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[player.match_confidence] || 'bg-gray-100 text-gray-800'}`}>
        🔗 {player.match_confidence}
      </span>
    );
  };

  return (
    <div className={`rounded-lg p-4 transition-all hover:shadow-lg ${
      isDarkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'
    }`}>
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="font-semibold text-lg">{getName()}</h3>
          <p className="text-sm opacity-75">{getTeam()}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPositionColor()}`}>
            {getPosition()}
          </span>
          {getMatchingBadge()}
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <span className="opacity-75">Price:</span>
          <span className="font-medium ml-1">£{getPrice()}m</span>
        </div>
        <div>
          <span className="opacity-75">Points:</span>
          <span className="font-medium ml-1">{getPoints()}</span>
        </div>
        
        {/* Show both FPL and Sleeper points for integrated players */}
        {player.sleeper_season_total && player.ffh_season_prediction && (
          <>
            <div>
              <span className="opacity-75">FPL Pts:</span>
              <span className="font-medium ml-1">{player.ffh_season_prediction.toFixed(1)}</span>
            </div>
            <div>
              <span className="opacity-75">Sleeper Pts:</span>
              <span className="font-medium ml-1">{player.sleeper_season_total.toFixed(1)}</span>
            </div>
          </>
        )}
        
        <div className="col-span-2">
          <span className="opacity-75">Owner:</span>
          <span className={`font-medium ml-1 ${player.is_available ? 'text-green-600' : 'text-blue-600'}`}>
            {getOwnership()}
          </span>
        </div>
        
        {player.sleeper_conversion_ratio && (
          <div className="col-span-2">
            <span className="opacity-75">Conversion:</span>
            <span className="font-medium ml-1">{player.sleeper_conversion_ratio}x</span>
          </div>
        )}
      </div>
    </div>
  );
};

// ----------------- PLAYER MATCHING TAB COMPONENT -----------------
const PlayerMatchingTab = ({ isDarkMode, players }) => {
  const [matchingState, setMatchingState] = useState({
    loading: false,
    result: null,
    error: null
  });

  const runMatching = async (options = {}) => {
    setMatchingState({ loading: true, result: null, error: null });
    
    try {
      const response = await fetch('/api/integrated-players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          includeMatching: true,
          includeScoring: true,
          forceRefresh: options.forceRefresh || false,
          clearCache: options.clearCache || false
        })
      });

      const result = await response.json();
      
      if (result.success) {
        setMatchingState({ loading: false, result, error: null });
      } else {
        throw new Error(result.error || 'Matching failed');
      }
    } catch (error) {
      setMatchingState({ 
        loading: false, 
        result: null, 
        error: error.message 
      });
    }
  };

  const { loading, result, error } = matchingState;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className={`p-6 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
        <h2 className="text-2xl font-bold mb-4">🔗 Player Matching System</h2>
        <p className="text-gray-400 mb-4">
          Match Sleeper players with FFH predictions and convert scoring systems
        </p>
        
        <div className="flex gap-3">
          <button
            onClick={() => runMatching()}
            disabled={loading}
            className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white px-4 py-2 rounded transition-colors"
          >
            {loading ? '🔄 Processing...' : '▶️ Run Matching'}
          </button>
          
          <button
            onClick={() => runMatching({ clearCache: true, forceRefresh: true })}
            disabled={loading}
            className="bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white px-4 py-2 rounded transition-colors"
          >
            🔄 Fresh Run
          </button>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className={`p-6 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
          <LoadingSpinner message="Running player matching and scoring conversion..." />
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className={`p-6 rounded-lg border-l-4 border-red-500 ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
          <h3 className="text-lg font-semibold text-red-600 mb-2">❌ Matching Error</h3>
          <p className="text-gray-400">{error}</p>
          <button
            onClick={() => runMatching()}
            className="mt-3 bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
              <div className="text-2xl font-bold text-green-600">
                {result.integration?.matchingStats?.matched || 0}
              </div>
              <div className="text-sm opacity-75">✅ Players Matched</div>
            </div>
            
            <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
              <div className="text-2xl font-bold text-blue-600">
                {result.quality?.matchingQuality || '0%'}
              </div>
              <div className="text-sm opacity-75">📊 Match Rate</div>
            </div>
            
            <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
              <div className="text-2xl font-bold text-purple-600">
                {result.quality?.averageConfidence || 0}%
              </div>
              <div className="text-sm opacity-75">🎯 Avg Confidence</div>
            </div>
          </div>

          {/* Matching Methods Breakdown */}
          {result.integration?.matchingStats?.byMethod && (
            <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
              <h3 className="font-semibold mb-3">🔍 Matching Methods Used</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Object.entries(result.integration.matchingStats.byMethod).map(([method, count]) => (
                  <div key={method} className="text-center">
                    <div className="text-lg font-bold">{count}</div>
                    <div className="text-xs opacity-75">{method}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sample Matched Players */}
          {result.players && result.players.length > 0 && (
            <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
              <h3 className="font-semibold mb-3">👥 Sample Matched Players</h3>
              <div className="space-y-2">
                {result.players.slice(0, 10).map((player, index) => (
                  <div key={index} className={`p-3 rounded border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="font-medium">{player.name}</span>
                        <span className="ml-2 text-sm opacity-75">
                          {player.position} • {player.team}
                        </span>
                      </div>
                      <div className="text-right text-sm">
                        {player.match_confidence && (
                          <div className={`px-2 py-1 rounded text-xs ${
                            player.match_confidence === 'High' ? 'bg-green-100 text-green-800' :
                            player.match_confidence === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {player.match_confidence}
                          </div>
                        )}
                        {player.owned_by && (
                          <div className="text-xs opacity-75 mt-1">
                            Owned by: {player.owned_by}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {result.players.length > 10 && (
                <div className="text-center mt-3 text-sm opacity-75">
                  ... and {result.players.length - 10} more players
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ----------------- DATA HOOK -----------------
function usePlayerData() {
  const [data, setData] = useState({
    players: [],
    loading: true,
    error: null,
    lastUpdated: null,
    source: null,
    quality: null,
    ownershipData: false,
    enhanced: false
  });

  const fetchData = async (source = 'auto', forceRefresh = false, useIntegrated = false) => {
    setData(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      let endpoint = '/api/players';
      let requestOptions = {};
      
      if (useIntegrated) {
        // Use the new integrated endpoint
        endpoint = '/api/integrated-players';
        requestOptions = {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            includeMatching: true,
            includeScoring: true,
            forceRefresh
          })
        };
      } else {
        // Use the original endpoint
        const params = new URLSearchParams({
          source,
          refresh: forceRefresh.toString(),
          matching: 'true'
        });
        endpoint = `/api/players?${params}`;
        requestOptions = { method: 'GET' };
      }
      
      const response = await fetch(endpoint, requestOptions);
      const result = await response.json();
      
      console.log('API Response:', result); // Debug log
      
      if (result.success !== false && result.players) {
        setData({
          players: result.players || [],
          loading: false,
          error: null,
          lastUpdated: result.lastUpdated || new Date().toISOString(),
          source: result.source || source,
          quality: result.quality || { completenessScore: 100 },
          ownershipData: result.ownershipData || false,
          enhanced: result.enhanced || false,
          cached: result.fromCache,
          ownershipCount: result.ownershipCount || result.players?.length || 0,
          integrated: useIntegrated,
          integration: result.integration
        });
      } else {
        throw new Error(result.error || 'Failed to fetch data');
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
    fetchData('auto');
  }, []);

  return { ...data, refetch: fetchData };
}

// ----------------- MAIN DASHBOARD COMPONENT START -----------------
export default function FPLDashboard() {
  const [activeTab, setActiveTab] = useState('players');
  const [filters, setFilters] = useState({
    position: 'all',
    availability: 'all',
    team: 'all',
    minPoints: 0,
    search: ''
  });
  const [isDarkMode, setIsDarkMode] = useState(true);
  
  const { players, loading, error, lastUpdated, source, quality, ownershipData, ownershipCount, enhanced, refetch, integrated, integration } = usePlayerData();

  // Enhanced refetch with integrated option
  const enhancedRefetch = (source = 'auto', forceRefresh = false, useIntegrated = false) => {
    refetch(source, forceRefresh, useIntegrated);
  };

  // Filter players
  const filteredPlayers = players.filter(player => {
    // Search filter
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      const name = (player.web_name || player.name || player.full_name || `${player.first_name || ''} ${player.second_name || ''}`).toLowerCase();
      if (!name.includes(searchTerm)) return false;
    }

    // Position filter
    if (filters.position !== 'all') {
      const position = player.position || 
        (player.position_id && { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' }[player.position_id]) ||
        (player.element_type && { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' }[player.element_type]) ||
        '';
      if (position.toLowerCase() !== filters.position.toLowerCase()) return false;
    }

    // Team filter
    if (filters.team !== 'all') {
      const team = player.team?.code_name || player.team_abbr || player.team_name || player.club || player.team || '';
      if (team !== filters.team) return false;
    }

    // Points filter
    if (filters.minPoints > 0) {
      const points = player.predicted_pts || player.total_points || player.points || player.sleeper_season_total || 0;
      if (points < filters.minPoints) return false;
    }

    return true;
  });

  // Get unique teams for filter
  const teams = [...new Set(players.map(player => 
    player.team?.code_name || player.team_abbr || player.team_name || player.club || player.team
  ).filter(Boolean))].sort();

  // Loading state
  if (loading) {
    return (
      <div className={`min-h-screen ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
        <div className="flex items-center justify-center min-h-screen">
          <LoadingSpinner message="Loading player data..." />
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={`min-h-screen ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center p-8">
            <div className="text-6xl mb-4">⚠️</div>
            <h2 className="text-2xl font-bold mb-4">Error Loading Data</h2>
            <p className="text-gray-400 mb-6">{error}</p>
            <div className="space-x-4">
              <button onClick={() => enhancedRefetch('sheets')} className="bg-blue-500 hover:bg-blue-600 px-4 py-2 rounded">Try Google Sheets</button>
              <button onClick={() => enhancedRefetch('ffh')} className="bg-green-500 hover:bg-green-600 px-4 py-2 rounded">Try FFH API</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Main render
  return (
    <ErrorBoundary>
      <div className={`min-h-screen transition-colors ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
        
        <DashboardHeader
          isDarkMode={isDarkMode}
          setIsDarkMode={setIsDarkMode}
          lastUpdated={lastUpdated}
          source={source}
          players={players}
          quality={quality}
          ownershipData={ownershipData}
          ownershipCount={ownershipCount}
          enhanced={enhanced}
          refetch={enhancedRefetch}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
        />

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 py-6">
          {/* Enhanced Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
            <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
              <div className="text-2xl font-bold">{players.length}</div>
              <div className="text-sm opacity-75">👥 Total Players</div>
            </div>
            <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
              <div className="text-2xl font-bold">{filteredPlayers.length}</div>
              <div className="text-sm opacity-75">🔍 Filtered</div>
            </div>
            <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
              <div className="text-2xl font-bold">{source?.toUpperCase() || 'FFH'}</div>
              <div className="text-sm opacity-75">📊 Data Source</div>
            </div>
            <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
              <div className="text-2xl font-bold text-green-600">{quality?.completenessScore || 100}%</div>
              <div className="text-sm opacity-75">🏆 Data Quality</div>
            </div>
            <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
              <div className="text-2xl font-bold text-purple-600">
                {integrated ? '🔗' : '📊'}
              </div>
              <div className="text-sm opacity-75">
                {integrated ? 'Integrated' : 'Standard'}
              </div>
            </div>
          </div>

          {/* Tab Content */}
          {activeTab === 'players' && (
            <>
              {/* Filters */}
              <div className={`p-4 rounded-lg mb-6 ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Search Players</label>
                    <input
                      type="text"
                      placeholder="Search by name..."
                      value={filters.search}
                      onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                      className={`w-full px-3 py-2 border rounded-lg ${
                        isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Position</label>
                    <select
                      value={filters.position}
                      onChange={(e) => setFilters(prev => ({ ...prev, position: e.target.value }))}
                      className={`w-full px-3 py-2 border rounded-lg ${
                        isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'
                      }`}
                    >
                      <option value="all">All Positions</option>
                      <option value="gk">Goalkeepers</option>
                      <option value="def">Defenders</option>
                      <option value="mid">Midfielders</option>
                      <option value="fwd">Forwards</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Team</label>
                    <select
                      value={filters.team}
                      onChange={(e) => setFilters(prev => ({ ...prev, team: e.target.value }))}
                      className={`w-full px-3 py-2 border rounded-lg ${
                        isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'
                      }`}
                    >
                      <option value="all">All Teams</option>
                      {teams.map(team => (
                        <option key={team} value={team}>{team}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Availability</label>
                    <select
                      value={filters.availability}
                      onChange={(e) => setFilters(prev => ({ ...prev, availability: e.target.value }))}
                      className={`w-full px-3 py-2 border rounded-lg ${
                        isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'
                      }`}
                    >
                      <option value="all">All Players</option>
                      <option value="available">Available</option>
                      <option value="owned">Owned</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Min Points</label>
                    <input
                      type="number"
                      placeholder="0"
                      value={filters.minPoints}
                      onChange={(e) => setFilters(prev => ({ ...prev, minPoints: Number(e.target.value) }))}
                      className={`w-full px-3 py-2 border rounded-lg ${
                        isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'
                      }`}
                    />
                  </div>
                </div>
              </div>

              {/* Player Grid */}
              {filteredPlayers.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredPlayers.map((player, index) => (
                    <PlayerCard 
                      key={player.id || player.fpl_id || player.code || player.sleeper_id || index} 
                      player={player} 
                      isDarkMode={isDarkMode}
                    />
                  ))}
                </div>
              ) : (
                <div className={`text-center p-8 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
                  <div className="text-4xl mb-4">🔍</div>
                  <h3 className="text-lg font-medium mb-2">No players found</h3>
                  <p className="opacity-75">Try adjusting your filters to see more results.</p>
                </div>
              )}
            </>
          )}

          {activeTab === 'matching' && (
            <PlayerMatchingTab isDarkMode={isDarkMode} players={players} />
          )}

          {activeTab === 'optimizer' && (
            <div className={`p-8 text-center rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
              <div className="text-4xl mb-4">⚡</div>
              <h3 className="text-lg font-medium mb-2">Optimizer Coming Soon</h3>
              <p className="opacity-75">Formation optimization feature will be available in the next update.</p>
            </div>
          )}

          {activeTab === 'transfers' && (
            <div className={`p-8 text-center rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
              <div className="text-4xl mb-4">🔄</div>
              <h3 className="text-lg font-medium mb-2">Transfer Suggestions Coming Soon</h3>
              <p className="opacity-75">AI-powered transfer recommendations will be available soon.</p>
            </div>
          )}

          {activeTab === 'analytics' && (
            <div className={`p-8 text-center rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
              <div className="text-4xl mb-4">📊</div>
              <h3 className="text-lg font-medium mb-2">Analytics Coming Soon</h3>
              <p className="opacity-75">Performance analytics and insights will be available in the next update.</p>
            </div>
          )}
        </main>
      </div>
    </ErrorBoundary>
  );
}