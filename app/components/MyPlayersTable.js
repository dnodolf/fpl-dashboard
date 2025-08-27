// app/components/MyPlayersTable.js - COMPLETE CORRECTED FILE
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
    // Try current gameweek prediction first
    if (player.current_gameweek_prediction?.predicted_mins) {
      return player.current_gameweek_prediction.predicted_mins;
    }
    
    // Try predictions array for current GW
    if (player.predictions && Array.isArray(player.predictions)) {
      const currentGWPred = player.predictions.find(p => p.gw === (currentGameweek?.number || 2));
      if (currentGWPred?.xmins) {
        return currentGWPred.xmins;
      }
      // Fall back to first available prediction
      const firstPred = player.predictions[0];
      if (firstPred?.xmins) {
        return firstPred.xmins;
      }
    }
    
    // Try current predictions array
    if (player.current_predictions && Array.isArray(player.current_predictions)) {
      const latest = player.current_predictions[0];
      if (latest?.predicted_mins || latest?.xmins) {
        return latest.predicted_mins || latest.xmins;
      }
    }
    
    // Try upcoming predictions array
    if (player.upcoming_predictions && Array.isArray(player.upcoming_predictions)) {
      const next = player.upcoming_predictions[0];
      if (next?.predicted_mins || next?.xmins) {
        return next.predicted_mins || next.xmins;
      }
    }
    
    return player.predicted_mins || player.xmins || 0;
  };

  const getPlayerPPG = (player) => {
    // FFH form data PPG
    if (player.form_data?.ppg) return player.form_data.ppg;
    
    // Current PPG
    if (player.current_ppg) return player.current_ppg;
    
    // Calculated PPG
    if (player.ppg) return player.ppg;
    
    // Season average
    if (player.season_prediction_avg) return player.season_prediction_avg;
    
    // Fallback calculation
    if (player.total_points && player.games_played) {
      return player.total_points / player.games_played;
    }
    
    return 0;
  };

  const getFixtureDifficulty = (player) => {
    // Try various fixture difficulty fields
    if (player.fixture_difficulty) return player.fixture_difficulty;
    if (player.predicted_fixture_predictions) return player.predicted_fixture_predictions;
    
    // Try to extract from predictions
    if (player.predictions && Array.isArray(player.predictions)) {
      const currentGWPred = player.predictions.find(p => p.gw === (currentGameweek?.number || 2));
      if (currentGWPred?.opp && Array.isArray(currentGWPred.opp)) {
        // Extract difficulty from opponent data [team, match, difficulty]
        return currentGWPred.opp[0]?.[2] || 'N/A';
      }
    }
    
    return 'N/A';
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

  // Get position badge color
  const getPositionBadgeColor = (position) => {
    switch(position) {
      case 'GKP': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'DEF': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'MID': return 'bg-green-100 text-green-800 border-green-200';
      case 'FWD': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Get fixture difficulty color
  const getFixtureDifficultyColor = (difficulty) => {
    if (!difficulty || difficulty === 'N/A') return 'bg-gray-100 text-gray-600';
    const diff = parseFloat(difficulty);
    if (isNaN(diff)) return 'bg-gray-100 text-gray-600';
    if (diff <= 2) return 'bg-green-100 text-green-700';
    if (diff <= 3) return 'bg-yellow-100 text-yellow-700';
    if (diff <= 4) return 'bg-orange-100 text-orange-700';
    return 'bg-red-100 text-red-700';
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

                    {/* Position */}
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                        isDarkMode ? 
                          'bg-gray-700 text-gray-300 border-gray-600' :
                          getPositionBadgeColor(player.position)
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

                    {/* Fixture Difficulty */}
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        isDarkMode ? 
                          'bg-gray-700 text-gray-300' :
                          getFixtureDifficultyColor(player.fixture_difficulty_value)
                      }`}>
                        {player.fixture_difficulty_value || 'N/A'}
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