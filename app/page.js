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

// ----------------- SIMPLIFIED HEADER COMPONENT -----------------
const DashboardHeader = ({ 
  isDarkMode, 
  setIsDarkMode, 
  lastUpdated, 
  players = [], 
  matchedCount = 0,
  matchRate = 0,
  updateData,
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
            <div className="text-sm opacity-75 mt-1">
              <span>Last updated: {new Date(lastUpdated).toLocaleString()}</span>
              <span className="ml-4">• Match Rate: {matchRate}%</span>
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
          
          <button 
            onClick={() => updateData()}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm transition-colors font-medium"
            title="Update player data and predictions"
          >
            🔄 Update Data
          </button>
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

// ----------------- PLAYER TABLE COMPONENT -----------------
const PlayerTable = ({ players, isDarkMode }) => {
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'desc' });

  // Get player data with proper fallbacks
  const getPlayerName = (player) => {
    return player.web_name || player.name || player.full_name || 'Unknown Player';
  };

  const getTeam = (player) => {
    return player.team?.code_name || player.team_abbr || player.team_name || player.club || player.team || '';
  };

  const getPosition = (player) => {
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

  const getOwner = (player) => {
    if (player.owned_by) return player.owned_by;
    if (player.owner_name) return player.owner_name;
    return player.is_available === false ? 'Owned' : 'Free Agent';
  };

  const getSeasonPoints = (player) => {
    // For integrated players, prefer Sleeper converted points
    if (player.sleeper_season_total) return player.sleeper_season_total;
    if (player.sleeper_season_avg) return player.sleeper_season_avg * 38;
    if (player.ffh_season_prediction) return player.ffh_season_prediction;
    if (player.predicted_pts) return player.predicted_pts;
    if (player.total_points) return player.total_points;
    if (player.points) return player.points;
    return 0;
  };

  const getNext5Games = (player) => {
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
    const seasonPoints = getSeasonPoints(player);
    return seasonPoints > 0 ? (seasonPoints / 38) * 5 : 0;
  };

  // Sorting function
  const handleSort = (key) => {
    let direction = 'desc';
    if (sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = 'asc';
    }
    setSortConfig({ key, direction });
  };

  // Sort players
  const sortedPlayers = [...players].sort((a, b) => {
    if (!sortConfig.key) return 0;

    let aValue, bValue;

    switch (sortConfig.key) {
      case 'name':
        aValue = getPlayerName(a).toLowerCase();
        bValue = getPlayerName(b).toLowerCase();
        break;
      case 'team':
        aValue = getTeam(a);
        bValue = getTeam(b);
        break;
      case 'position':
        aValue = getPosition(a);
        bValue = getPosition(b);
        break;
      case 'owner':
        aValue = getOwner(a);
        bValue = getOwner(b);
        break;
      case 'seasonPoints':
        aValue = getSeasonPoints(a);
        bValue = getSeasonPoints(b);
        break;
      case 'next5Points':
        aValue = getNext5Games(a);
        bValue = getNext5Games(b);
        break;
      default:
        return 0;
    }

    if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const getSortIcon = (columnKey) => {
    if (sortConfig.key !== columnKey) {
      return <span className="text-gray-400 ml-1">↕️</span>;
    }
    return sortConfig.direction === 'desc' ? 
      <span className="text-blue-500 ml-1">↓</span> : 
      <span className="text-blue-500 ml-1">↑</span>;
  };

  const getPositionBadgeColor = (position) => {
    const colors = {
      'GK': 'bg-yellow-500 text-white',
      'DEF': 'bg-blue-500 text-white',
      'MID': 'bg-green-500 text-white',
      'FWD': 'bg-red-500 text-white'
    };
    return colors[position] || 'bg-gray-500 text-white';
  };

  const getOwnerColor = (owner) => {
    if (owner === 'Free Agent') return 'text-green-600 font-medium';
    if (owner === 'ThatDerekGuy') return 'text-blue-600 font-medium'; // Your team
    return 'text-gray-400';
  };

  return (
    <div className={`rounded-lg overflow-hidden ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className={`${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
            <tr>
              <th 
                className="px-4 py-3 text-left text-sm font-medium cursor-pointer hover:bg-opacity-80"
                onClick={() => handleSort('name')}
              >
                Player Name {getSortIcon('name')}
              </th>
              <th 
                className="px-4 py-3 text-left text-sm font-medium cursor-pointer hover:bg-opacity-80"
                onClick={() => handleSort('team')}
              >
                Team {getSortIcon('team')}
              </th>
              <th 
                className="px-4 py-3 text-left text-sm font-medium cursor-pointer hover:bg-opacity-80"
                onClick={() => handleSort('position')}
              >
                Position {getSortIcon('position')}
              </th>
              <th 
                className="px-4 py-3 text-left text-sm font-medium cursor-pointer hover:bg-opacity-80"
                onClick={() => handleSort('owner')}
              >
                Owner {getSortIcon('owner')}
              </th>
              <th 
                className="px-4 py-3 text-right text-sm font-medium cursor-pointer hover:bg-opacity-80"
                onClick={() => handleSort('seasonPoints')}
              >
                Season Points {getSortIcon('seasonPoints')}
              </th>
              <th 
                className="px-4 py-3 text-right text-sm font-medium cursor-pointer hover:bg-opacity-80"
                onClick={() => handleSort('next5Points')}
              >
                Next 5 GW {getSortIcon('next5Points')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {sortedPlayers.map((player, index) => (
              <tr 
                key={player.id || player.fpl_id || player.code || player.sleeper_id || index}
                className={`hover:bg-opacity-50 ${
                  isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'
                }`}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center">
                    <span className="font-medium">{getPlayerName(player)}</span>
                    {player.match_confidence && (
                      <span className={`ml-2 px-2 py-1 rounded-full text-xs ${
                        player.match_confidence === 'High' ? 'bg-green-100 text-green-800' :
                        player.match_confidence === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {player.match_confidence}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm">
                  {getTeam(player)}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPositionBadgeColor(getPosition(player))}`}>
                    {getPosition(player)}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm">
                  <span className={getOwnerColor(getOwner(player))}>
                    {getOwner(player)}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-sm font-medium">
                  {getSeasonPoints(player).toFixed(1)}
                </td>
                <td className="px-4 py-3 text-right text-sm font-medium">
                  {getNext5Games(player).toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {sortedPlayers.length === 0 && (
        <div className="text-center py-8">
          <div className="text-4xl mb-4">🔍</div>
          <h3 className="text-lg font-medium mb-2">No players found</h3>
          <p className="opacity-75">Try adjusting your filters to see more results.</p>
        </div>
      )}
    </div>
  );
};

// ----------------- IMPROVED DATA HOOK - AUTO-LOAD FULL DATA -----------------
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

  const fetchData = async (source = 'auto', forceRefresh = false, useIntegrated = true) => {
    setData(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      // ALWAYS use integrated endpoint for full data
      const endpoint = '/api/integrated-players';
      const requestOptions = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          includeMatching: true,
          includeScoring: true,
          forceRefresh
        })
      };
      
      console.log(`🔄 Fetching integrated player data (refresh: ${forceRefresh})...`);
      
      const response = await fetch(endpoint, requestOptions);
      const result = await response.json();
      
      console.log('API Response:', result); // Debug log
      
      if (result.success !== false && result.players) {
        const playerCount = result.players?.length || 0;
        console.log(`✅ Successfully loaded ${playerCount} players`);
        
        setData({
          players: result.players || [],
          loading: false,
          error: null,
          lastUpdated: result.lastUpdated || new Date().toISOString(),
          source: result.source || 'integrated',
          quality: result.quality || { completenessScore: 100 },
          ownershipData: result.ownershipData || false,
          enhanced: result.enhanced || true,
          cached: result.fromCache || false,
          ownershipCount: result.ownershipCount || result.players?.length || 0,
          integrated: true,
          integration: result.integration
        });
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
    // Auto-load full integrated data on first mount (use cache for speed)
    fetchData('auto', false, true);
  }, []);

  return { ...data, refetch: fetchData };
}

// ----------------- UPDATED MAIN DASHBOARD COMPONENT -----------------
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

  // Calculate match statistics
  const matchedCount = players.filter(player => player.match_confidence).length;
  const matchRate = players.length > 0 ? Math.round((matchedCount / players.length) * 100) : 0;

  // Single update function - always refresh data
  const updateData = () => {
    refetch('auto', true, true); // Force refresh with integrated matching
  };

  // SAME filter logic as before...
  const filteredPlayers = players.filter(player => {
    const getPlayerName = (p) => p.web_name || p.name || p.full_name || '';
    const getPlayerPosition = (p) => {
      if (p.position) return p.position.toUpperCase();
      if (p.position_id) {
        const positions = { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' };
        return positions[p.position_id] || '';
      }
      if (p.element_type) {
        const positions = { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' };
        return positions[p.element_type] || '';
      }
      return '';
    };
    const getPlayerTeam = (p) => p.team?.code_name || p.team_abbr || p.team_name || p.club || p.team || '';
    const getPlayerOwner = (p) => {
      if (p.owned_by) return p.owned_by;
      if (p.owner_name) return p.owner_name;
      return p.is_available === false ? 'Owned' : 'Free Agent';
    };
    const getPlayerPoints = (p) => {
      if (p.sleeper_season_total) return p.sleeper_season_total;
      if (p.sleeper_season_avg) return p.sleeper_season_avg * 38;
      if (p.ffh_season_prediction) return p.ffh_season_prediction;
      if (p.predicted_pts) return p.predicted_pts;
      if (p.total_points) return p.total_points;
      if (p.points) return p.points;
      return 0;
    };

    // Apply all filters
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      const name = getPlayerName(player).toLowerCase();
      if (!name.includes(searchTerm)) return false;
    }

    if (filters.position !== 'all') {
      const playerPosition = getPlayerPosition(player);
      const filterPosition = filters.position.toUpperCase();
      const positionMatches = {
        'GK': ['GK', 'GKP'],
        'DEF': ['DEF', 'D'],
        'MID': ['MID', 'M'],
        'FWD': ['FWD', 'F']
      };
      const validPositions = positionMatches[filterPosition] || [filterPosition];
      if (!validPositions.includes(playerPosition)) return false;
    }

    if (filters.team !== 'all') {
      const playerTeam = getPlayerTeam(player);
      if (playerTeam !== filters.team) return false;
    }

    if (filters.availability !== 'all') {
      const owner = getPlayerOwner(player);
      const isAvailable = owner === 'Free Agent';
      if (filters.availability === 'available' && !isAvailable) return false;
      if (filters.availability === 'owned' && isAvailable) return false;
    }

    if (filters.minPoints > 0) {
      const points = getPlayerPoints(player);
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
      <div className={`min-h-screen ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-800'}`}>
        <div className="flex items-center justify-center min-h-screen">
          <LoadingSpinner 
            message="Loading player data..." 
            details="Fetching predictions and ownership data"
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
          <ErrorDisplay 
            error={error} 
            onRetry={updateData} 
            isDarkMode={isDarkMode}
          />
        </div>
      </div>
    );
  }

  // Main render
  return (
    <ErrorBoundary>
      <div className={`min-h-screen transition-colors ${
        isDarkMode ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-800'
      }`}>
        
        <DashboardHeader
          isDarkMode={isDarkMode}
          setIsDarkMode={setIsDarkMode}
          lastUpdated={lastUpdated}
          players={players}
          matchedCount={matchedCount}
          matchRate={matchRate}
          updateData={updateData}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
        />

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 py-6">
          {/* Simplified Stats Cards */}
          <StatsCards 
            players={players}
            matchedCount={matchedCount}
            matchRate={matchRate}
            filteredPlayers={filteredPlayers}
            isDarkMode={isDarkMode}
          />

          {/* Tab Content */}
          {activeTab === 'players' && (
            <>
              {/* Filters */}
              <div className={`p-4 rounded-lg mb-6 shadow-sm ${
                isDarkMode ? 'bg-gray-800' : 'bg-white border border-gray-200'
              }`}>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${
                      isDarkMode ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      Search Players
                    </label>
                    <input
                      type="text"
                      placeholder="Search by name..."
                      value={filters.search}
                      onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                      className={`w-full px-3 py-2 border rounded-lg transition-colors ${
                        isDarkMode 
                          ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                          : 'bg-white border-gray-300 text-gray-800 placeholder-gray-500'
                      }`}
                    />
                  </div>

                  {/* Other filter inputs with same improved styling */}
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${
                      isDarkMode ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      Position
                    </label>
                    <select
                      value={filters.position}
                      onChange={(e) => setFilters(prev => ({ ...prev, position: e.target.value }))}
                      className={`w-full px-3 py-2 border rounded-lg transition-colors ${
                        isDarkMode 
                          ? 'bg-gray-700 border-gray-600 text-white' 
                          : 'bg-white border-gray-300 text-gray-800'
                      }`}
                    >
                      <option value="all">All Positions</option>
                      <option value="gk">Goalkeepers</option>
                      <option value="def">Defenders</option>
                      <option value="mid">Midfielders</option>
                      <option value="fwd">Forwards</option>
                    </select>
                  </div>

                  {/* Team, Availability, and Min Points filters with same styling... */}
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Team</label>
                    <select
                      value={filters.team}
                      onChange={(e) => setFilters(prev => ({ ...prev, team: e.target.value }))}
                      className={`w-full px-3 py-2 border rounded-lg transition-colors ${
                        isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-800'
                      }`}
                    >
                      <option value="all">All Teams</option>
                      {teams.map(team => (
                        <option key={team} value={team}>{team}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Availability</label>
                    <select
                      value={filters.availability}
                      onChange={(e) => setFilters(prev => ({ ...prev, availability: e.target.value }))}
                      className={`w-full px-3 py-2 border rounded-lg transition-colors ${
                        isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-800'
                      }`}
                    >
                      <option value="all">All Players</option>
                      <option value="available">Free Agents</option>
                      <option value="owned">Owned Players</option>
                    </select>
                  </div>

                  <div>
                    <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Min Season Points</label>
                    <input
                      type="number"
                      placeholder="0"
                      value={filters.minPoints}
                      onChange={(e) => setFilters(prev => ({ ...prev, minPoints: Number(e.target.value) }))}
                      className={`w-full px-3 py-2 border rounded-lg transition-colors ${
                        isDarkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 text-gray-800 placeholder-gray-500'
                      }`}
                    />
                  </div>
                </div>
              </div>

              {/* Player Table */}
              <PlayerTable players={filteredPlayers} isDarkMode={isDarkMode} />
            </>
          )}

          {/* Other tabs remain the same */}
          {activeTab === 'matching' && (
            <PlayerMatchingTab isDarkMode={isDarkMode} players={players} />
          )}

          {/* Other tab content... */}
        </main>
      </div>
    </ErrorBoundary>
  );
}