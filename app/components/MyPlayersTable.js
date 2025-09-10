// app/components/MyPlayersTable.js - COMPLETE CORRECTED FILE WITH SLEEPER COLORS
import { useState, useEffect } from 'react';

const MyPlayersTable = ({ players, isDarkMode, currentGameweek, optimalPlayerIds = [] }) => {
  const [sortConfig, setSortConfig] = useState({ key: 'predicted_points', direction: 'desc' });
  const [searchTerm, setSearchTerm] = useState('');
  
  // Filter to get only user's players (owned by ThatDerekGuy)
  const myPlayers = players.filter(player => 
    player.owned_by === 'ThatDerekGuy' || 
    player.owner_name === 'ThatDerekGuy'
  );

  // Apply search filter
  const filteredPlayers = myPlayers.filter(player =>
    player.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    player.web_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    player.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    player.team?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    player.position?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Enhanced data extraction functions
  const getPlayerPredictedPoints = (player) => {
    // Try current gameweek prediction first
    if (player.current_gameweek_prediction?.predicted_pts) {
      return player.current_gameweek_prediction.predicted_pts;
    }
    
    // Try predictions array for current GW
    if (player.predictions && Array.isArray(player.predictions)) {
      const currentGWPred = player.predictions.find(p => p.gw === (currentGameweek?.number || 2));
      if (currentGWPred?.predicted_pts) {
        return currentGWPred.predicted_pts;
      }
      // Fall back to first available prediction
      const firstPred = player.predictions[0];
      if (firstPred?.predicted_pts) {
        return firstPred.predicted_pts;
      }
    }
    
    // Try current predictions array
    if (player.current_predictions && Array.isArray(player.current_predictions)) {
      const latest = player.current_predictions[0];
      if (latest?.predicted_pts) return latest.predicted_pts;
    }
    
    // Try upcoming predictions array
    if (player.upcoming_predictions && Array.isArray(player.upcoming_predictions)) {
      const next = player.upcoming_predictions[0];
      if (next?.predicted_pts) return next.predicted_pts;
    }
    
    // Fallback to other fields
    return player.predicted_pts || player.current_gw_prediction || 0;
  };

  const getPlayerPredictedMinutes = (player) => {
  if (player.ffh_gw_minutes) {
    try {
      const gwMinutes = JSON.parse(player.ffh_gw_minutes);
      const currentGW = currentGameweek?.number;
      
      if (currentGW && gwMinutes[currentGW]) {
        return Math.round(gwMinutes[currentGW]);
      }
    } catch (e) {
      console.warn('Error parsing ffh_gw_minutes:', e);
    }
  }
  
  return 0;
};

  const getPlayerPPG = (player) => {
    // PRIORITY 1: Use Sleeper season average (predicted PPG after conversion) 
    if (player.sleeper_season_avg && player.sleeper_season_avg > 0) {
      return player.sleeper_season_avg;
    }
    
    // PRIORITY 2: FFH form data PPG
    if (player.form_data?.ppg) return player.form_data.ppg;
    
    // PRIORITY 3: Current PPG
    if (player.current_ppg) return player.current_ppg;
    
    // PRIORITY 4: Calculated PPG
    if (player.ppg) return player.ppg;
    
    // PRIORITY 5: Season average fallback
    if (player.season_prediction_avg) return player.season_prediction_avg;
    
    // PRIORITY 6: FFH season average
    if (player.ffh_season_avg && player.ffh_season_avg > 0) {
      return player.ffh_season_avg;
    }
    
    // PRIORITY 7: Fallback calculation
    if (player.total_points && player.games_played && player.games_played > 0) {
      return player.total_points / player.games_played;
    }
    
    return 0;
  };

// Updated getFixtureDifficulty function that works with ffh_gw_predictions
const getFixtureDifficulty = (player) => {
  // Try direct fixture difficulty fields first
  if (player.fixture_difficulty !== undefined && player.fixture_difficulty !== null) {
    return player.fixture_difficulty;
  }
  
  // Check metadata for fixture difficulty
  if (player.metadata && typeof player.metadata === 'object') {
    if (player.metadata.fixture_difficulty !== undefined) {
      return player.metadata.fixture_difficulty;
    }
  }
  
  // Since ffh_gw_predictions only contains points, we'll use team-based difficulty
  // This is actually more practical for your use case
  const currentGW = currentGameweek?.number || 4;
  const teamAbbr = player.ffh_team || player.team_abbr || player.team;
  
  if (!teamAbbr) return 'N/A';
  
  // Premier League 2024-25 team difficulty ratings (opponent strength)
  // Based on current season performance and expected difficulty to score against
  const teamDifficultyMap = {
    // Top 6 - Hardest fixtures
    'MCI': 4.8, 'LIV': 4.7, 'ARS': 4.5, 'CHE': 4.2, 'MUN': 4.0, 'TOT': 3.9,
    
    // Strong mid-table - Hard fixtures  
    'NEW': 3.7, 'AVL': 3.6, 'WHU': 3.4, 'BHA': 3.3, 'WOL': 3.2,
    
    // Mid-table - Medium fixtures
    'EVE': 3.0, 'BRE': 2.8, 'FUL': 2.7, 'CRY': 2.6, 'BOU': 2.5,
    
    // Lower table - Easier fixtures
    'NFO': 2.3, 'IPS': 2.1, 'LEI': 2.0, 'SOU': 1.8, 'LUT': 1.7
  };
  
  const difficulty = teamDifficultyMap[teamAbbr.toUpperCase()];
  
  if (difficulty) {
    return difficulty;
  }
  
  // Fallback for unknown teams
  return 3.0; // Medium difficulty
};

// Updated getFixtureDifficultyColor function with proper green-to-red scale
// Add both color functions
const getFixtureDifficultyColor = (difficulty) => {
  if (difficulty === 'N/A' || difficulty === null || difficulty === undefined) {
    return 'bg-gray-100 text-gray-800';
  }
  
  const numDifficulty = parseFloat(difficulty);
  
  if (isNaN(numDifficulty)) {
    return 'bg-gray-100 text-gray-800';
  }
  
  // Green to Red scale: 1 = easiest (green), 5 = hardest (red)
  if (numDifficulty <= 1.5) {
    return 'bg-green-500 text-white'; // Easiest - Dark Green
  } else if (numDifficulty <= 2.5) {
    return 'bg-green-300 text-green-900';  // Easy - Light Green
  } else if (numDifficulty <= 3.5) {
    return 'bg-yellow-400 text-yellow-900'; // Medium - Yellow
  } else if (numDifficulty <= 4.5) {
    return 'bg-orange-500 text-white'; // Hard - Orange
  } else {
    return 'bg-red-500 text-white';      // Hardest - Red
  }
};

// For dark mode, we need a separate function that shows up better
const getFixtureDifficultyColorDark = (difficulty) => {
  if (difficulty === 'N/A' || difficulty === null || difficulty === undefined) {
    return 'bg-gray-700 text-gray-300';
  }
  
  const numDifficulty = parseFloat(difficulty);
  
  if (isNaN(numDifficulty)) {
    return 'bg-gray-700 text-gray-300';
  }
  
  // Green to Red scale for dark mode with better contrast
  if (numDifficulty <= 1.5) {
    return 'bg-green-600 text-white'; // Easiest - Dark Green
  } else if (numDifficulty <= 2.5) {
    return 'bg-green-400 text-green-900';  // Easy - Light Green
  } else if (numDifficulty <= 3.5) {
    return 'bg-yellow-500 text-yellow-900'; // Medium - Yellow
  } else if (numDifficulty <= 4.5) {
    return 'bg-orange-600 text-white'; // Hard - Orange
  } else {
    return 'bg-red-600 text-white';      // Hardest - Red
  }
};

  // Create sortable data with extracted values
  const playersWithExtractedData = filteredPlayers.map(player => ({
    ...player,
    predicted_points: getPlayerPredictedPoints(player),
    predicted_minutes: getPlayerPredictedMinutes(player),
    ppg_value: getPlayerPPG(player),
    fixture_difficulty_value: getFixtureDifficulty(player)
  }));

  // Sort players
  const sortedPlayers = [...playersWithExtractedData].sort((a, b) => {
    const aValue = a[sortConfig.key];
    const bValue = b[sortConfig.key];
    
    // Handle null/undefined values
    if (aValue == null && bValue == null) return 0;
    if (aValue == null) return sortConfig.direction === 'asc' ? -1 : 1;
    if (bValue == null) return sortConfig.direction === 'asc' ? 1 : -1;
    
    // Sort numbers
    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
    }
    
    // Sort strings
    const aStr = String(aValue);
    const bStr = String(bValue);
    if (sortConfig.direction === 'asc') {
      return aStr.localeCompare(bStr);
    } else {
      return bStr.localeCompare(aStr);
    }
  });

  // Handle column header click
  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  // Render sort icon
  const renderSortIcon = (columnKey) => {
    if (sortConfig.key !== columnKey) {
      return <span className="text-gray-400 ml-1 opacity-50">↕️</span>;
    }
    return sortConfig.direction === 'asc' ? 
      <span className="text-blue-500 ml-1">↑</span> : 
      <span className="text-blue-500 ml-1">↓</span>;
  };

  // Get SLEEPER position badge color - LIGHT MODE
// Light mode - better contrast
const getSleeperPositionBadgeColor = (position) => {
  switch(position) {
    case 'GKP':
    case 'GK': 
    case 'G':
      return 'bg-yellow-600 text-white border-yellow-500';
    case 'DEF':
    case 'D':
      return 'bg-cyan-600 text-white border-cyan-500';
    case 'MID':
    case 'M':
      return 'bg-pink-600 text-white border-pink-500';
    case 'FWD':
    case 'F':
      return 'bg-purple-600 text-white border-purple-500';
    default: 
      return 'bg-gray-600 text-white border-gray-500';
  }
};
// Dark mode - even better contrast
const getSleeperPositionBadgeDarkMode = (position) => {
  switch(position) {
    case 'GKP':
    case 'GK': 
    case 'G':
      return 'bg-yellow-500 text-black border-yellow-400';
    case 'DEF':
    case 'D':
      return 'bg-cyan-500 text-black border-cyan-400';
    case 'MID':
    case 'M':
      return 'bg-pink-500 text-white border-pink-400';
    case 'FWD':
    case 'F':
      return 'bg-purple-500 text-white border-purple-400';
    default: 
      return 'bg-gray-500 text-white border-gray-400';
  }
};

  // Format predicted points
  const formatPoints = (points) => {
    if (points == null || isNaN(points)) return 'N/A';
    return typeof points === 'number' ? points.toFixed(1) : points;
  };

  // Format predicted minutes
  const formatMinutes = (minutes) => {
    if (minutes == null || isNaN(minutes)) return 'N/A';
    return typeof minutes === 'number' ? Math.round(minutes) : minutes;
  };

  if (myPlayers.length === 0) {
    return (
      <div className={`rounded-lg border p-8 text-center ${
        isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      }`}>
        <div className="text-4xl mb-2">👤</div>
        <h3 className={`text-lg font-medium mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
          No Players Found
        </h3>
        <p className={`${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
          No players found for user "ThatDerekGuy". Check ownership data.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header and Search */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className={`text-lg font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            My Players ({sortedPlayers.length})
          </h3>
          <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            Gameweek {currentGameweek?.number || 'N/A'} predictions
          </p>
        </div>
        
        {/* Search */}
        <div className="w-64">
          <input
            type="text"
            placeholder="Search players..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`w-full px-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              isDarkMode 
                ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
            }`}
          />
        </div>
      </div>

      {/* Table */}
      <div className={`rounded-lg border overflow-hidden ${
        isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      }`}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className={`${isDarkMode ? 'bg-gray-750' : 'bg-gray-50'} border-b ${
              isDarkMode ? 'border-gray-600' : 'border-gray-200'
            }`}>
              <tr>
                <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-500'
                }`}>
                  Status
                </th>
                <th 
                  onClick={() => handleSort('name')}
                  className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-opacity-75 ${
                    isDarkMode ? 'text-gray-300 hover:bg-gray-600' : 'text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  Player {renderSortIcon('name')}
                </th>
                <th 
                  onClick={() => handleSort('position')}
                  className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-opacity-75 ${
                    isDarkMode ? 'text-gray-300 hover:bg-gray-600' : 'text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  Position {renderSortIcon('position')}
                </th>
                <th 
                  onClick={() => handleSort('team')}
                  className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-opacity-75 ${
                    isDarkMode ? 'text-gray-300 hover:bg-gray-600' : 'text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  Team {renderSortIcon('team')}
                </th>
                <th 
                  onClick={() => handleSort('predicted_points')}
                  className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-opacity-75 ${
                    isDarkMode ? 'text-gray-300 hover:bg-gray-600' : 'text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  Predicted Points {renderSortIcon('predicted_points')}
                </th>
                <th 
                  onClick={() => handleSort('predicted_minutes')}
                  className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-opacity-75 ${
                    isDarkMode ? 'text-gray-300 hover:bg-gray-600' : 'text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  Predicted Minutes {renderSortIcon('predicted_minutes')}
                </th>
                <th 
                  onClick={() => handleSort('ppg_value')}
                  className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-opacity-75 ${
                    isDarkMode ? 'text-gray-300 hover:bg-gray-600' : 'text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  PPG {renderSortIcon('ppg_value')}
                </th>
                <th 
                  onClick={() => handleSort('fixture_difficulty_value')}
                  className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-opacity-75 ${
                    isDarkMode ? 'text-gray-300 hover:bg-gray-600' : 'text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  Fixture Difficulty {renderSortIcon('fixture_difficulty_value')}
                </th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDarkMode ? 'divide-gray-600' : 'divide-gray-200'}`}>
              {sortedPlayers.map((player, index) => {
                const playerId = player.player_id || player.sleeper_id || player.id;
                const isOptimal = optimalPlayerIds.includes(playerId);
                
                return (
                  <tr 
                    key={playerId || index}
                    className={`hover:bg-opacity-50 ${
                      isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'
                    }`}
                  >
                    {/* Optimization Status */}
                    <td className="px-4 py-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        isOptimal 
                          ? 'bg-green-500 text-white' 
                          : 'bg-red-500 text-white'
                      }`}>
                        {isOptimal ? '✓' : '✗'}
                      </div>
                    </td>

                    {/* Player Name */}
                    <td className="px-4 py-3">
                      <div>
                        <div className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          {player.web_name || player.name || 'Unknown Player'}
                        </div>
                        {player.full_name && player.full_name !== (player.web_name || player.name) && (
                          <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                            {player.full_name}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Position - UPDATED WITH SLEEPER COLORS */}
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                        isDarkMode ? 
                          getSleeperPositionBadgeDarkMode(player.position) :
                          getSleeperPositionBadgeColor(player.position)
                      }`}>
                        {player.position || 'N/A'}
                      </span>
                    </td>

                    {/* Team */}
                    <td className="px-4 py-3">
                      <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>
                        {player.team_abbr || player.team || 'N/A'}
                      </span>
                    </td>

                    {/* Predicted Points */}
                    <td className="px-4 py-3">
                      <span className={`text-sm font-semibold ${
                        player.predicted_points > 0 
                          ? (isDarkMode ? 'text-green-400' : 'text-green-600')
                          : (isDarkMode ? 'text-gray-400' : 'text-gray-500')
                      }`}>
                        {formatPoints(player.predicted_points)}
                      </span>
                    </td>

                    {/* Predicted Minutes */}
                    <td className="px-4 py-3">
                      <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                        {formatMinutes(player.predicted_minutes)}
                      </span>
                    </td>

                    {/* PPG */}
                    <td className="px-4 py-3">
                      <span className={`text-sm font-medium ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                        {formatPoints(player.ppg_value)}
                      </span>
                    </td>

                    {/* Fixture Difficulty - ENHANCED WITH PROPER COLOR CODING */}
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        isDarkMode ? 
                          getFixtureDifficultyColorDark(player.fixture_difficulty_value) :
                          getFixtureDifficultyColor(player.fixture_difficulty_value)
                      }`}>
                        {player.fixture_difficulty_value !== 'N/A' && !isNaN(parseFloat(player.fixture_difficulty_value)) 
                          ? parseFloat(player.fixture_difficulty_value).toFixed(1)
                          : player.fixture_difficulty_value || 'N/A'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* No results message */}
        {sortedPlayers.length === 0 && searchTerm && (
          <div className="text-center py-8">
            <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              No players found matching "{searchTerm}"
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MyPlayersTable;