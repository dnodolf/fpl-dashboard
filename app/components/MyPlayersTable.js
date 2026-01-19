// app/components/MyPlayersTable.js - COMPLETE CORRECTED FILE WITH SLEEPER COLORS
import { useState, useEffect } from 'react';
import v3ScoringService from '../services/v3ScoringService.js';
import { getPositionBadgeWithBorder } from '../constants/positionColors';
import { USER_ID } from '../config/constants';
import { getDifficultyColor } from '../constants/designTokens';
import PlayerAvatar from './common/PlayerAvatar';

const MyPlayersTable = ({ players, currentGameweek, optimalPlayerIds = [], scoringMode = 'ffh', hideColumns = [] }) => {
  const [sortConfig, setSortConfig] = useState({ key: 'predicted_points', direction: 'desc' });
  const [searchTerm, setSearchTerm] = useState('');
  
  // Filter to get only user's players (owned by USER_ID)
  const myPlayers = players.filter(player =>
    player.owned_by === USER_ID ||
    player.owner_name === USER_ID
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
    // Use explicit field-based logic to match optimizer components
    if (scoringMode === 'v3') {
      const points = player.v3_current_gw || 0;
      return points;
    } else {
      return player.current_gw_prediction || 0;
    }
  };
  
  // Legacy function for backward compatibility (now uses v3 service)
  const getPlayerPredictedPointsLegacy = (player) => {
    // Try current gameweek prediction first
    if (player.current_gameweek_prediction?.predicted_pts) {
      return player.current_gameweek_prediction.predicted_pts;
    }
    
    // Try predictions array for current GW
    if (player.predictions && Array.isArray(player.predictions)) {
      const currentGWPred = player.predictions.find(p => p.gw === currentGameweek?.number);
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
    // Use explicit field-based logic for season average
    if (scoringMode === 'v3') {
      return player.v3_season_avg || 0;
    } else {
      return player.sleeper_season_avg || 0;
    }
  };
  
  // Legacy PPG function for reference
  const getPlayerPPGLegacy = (player) => {
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
  const currentGW = currentGameweek?.number;
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

// Using centralized difficulty color function from designTokens

  // Calculate start percentage based on chance of playing
  const calculateStartPercentage = (player) => {
    // Use FFH's chance_of_playing_next_round field
    const chanceOfPlaying = player.chance_next_round ??
                           player.chance_of_playing_next_round ??
                           100; // Default to 100% if not specified

    return chanceOfPlaying;
  };

  // Create sortable data with extracted values
  const playersWithExtractedData = filteredPlayers.map(player => ({
    ...player,
    predicted_points: getPlayerPredictedPoints(player),
    predicted_minutes: getPlayerPredictedMinutes(player),
    ppg_value: getPlayerPPG(player),
    fixture_difficulty_value: getFixtureDifficulty(player),
    start_percentage: calculateStartPercentage(player),
    // Extract THIS WEEK matchup and START/BENCH recommendation (V3 only)
    this_week_opponent: player.v3_this_week_opponent || 'TBD',
    this_week_is_home: player.v3_this_week_is_home !== undefined ? player.v3_this_week_is_home : true,
    this_week_matchup_label: player.v3_this_week_matchup_label || '❓ Unknown',
    this_week_matchup_color: player.v3_this_week_matchup_color || 'text-gray-500',
    start_recommendation: player.v3_start_recommendation || 'UNKNOWN',
    start_label: player.v3_start_label || '❓ N/A',
    start_color: player.v3_start_color || 'text-gray-500'
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

  // Get SLEEPER position badge color - now using centralized utility
const getSleeperPositionBadgeColor = (position) => {
  return getPositionBadgeWithBorder(position);
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
      <div className="rounded-lg border p-8 text-center bg-gray-800 border-gray-700">
        <div className="text-4xl mb-2">👤</div>
        <h3 className="text-lg font-medium mb-2 text-white">
          No Players Found
        </h3>
        <p className="text-gray-400">
          No players found for user "{USER_ID}". Check ownership data.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header and Search */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-white">
            My Players ({sortedPlayers.length})
          </h3>
          <p className="text-sm text-gray-400">
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
            className="w-full px-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-700 border-gray-600 text-white placeholder-gray-400"
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border overflow-hidden bg-gray-800 border-gray-700">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-700 border-b border-gray-600 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-300">
                  Status
                </th>
                <th 
                  onClick={() => handleSort('name')}
                  className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-opacity-75 text-gray-300 hover:bg-gray-600"
                >
                  Player {renderSortIcon('name')}
                </th>
                <th 
                  onClick={() => handleSort('position')}
                  className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-opacity-75 text-gray-300 hover:bg-gray-600"
                >
                  Position {renderSortIcon('position')}
                </th>
                <th 
                  onClick={() => handleSort('team')}
                  className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-opacity-75 text-gray-300 hover:bg-gray-600"
                >
                  Team {renderSortIcon('team')}
                </th>
                <th 
                  onClick={() => handleSort('predicted_points')}
                  className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-opacity-75 text-gray-300 hover:bg-gray-600"
                >
                  Predicted Points {scoringMode === 'v3' ? '🚀' : '📊'} {renderSortIcon('predicted_points')}
                </th>
                <th
                  onClick={() => handleSort('predicted_minutes')}
                  className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-opacity-75 text-gray-300 hover:bg-gray-600"
                >
                  Predicted Minutes {renderSortIcon('predicted_minutes')}
                </th>
                {!hideColumns.includes('ppg') && (
                  <th
                    onClick={() => handleSort('ppg_value')}
                    className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-opacity-75 text-gray-300 hover:bg-gray-600"
                  >
                    PPG {scoringMode === 'v3' ? '🚀' : '📊'} {renderSortIcon('ppg_value')}
                  </th>
                )}
                <th
                  onClick={() => handleSort('fixture_difficulty_value')}
                  className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-opacity-75 text-gray-300 hover:bg-gray-600"
                >
                  Fixture Difficulty {renderSortIcon('fixture_difficulty_value')}
                </th>
                <th
                  onClick={() => handleSort('this_week_opponent')}
                  className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-opacity-75 text-gray-300 hover:bg-gray-600"
                >
                  THIS WEEK 🔥 {renderSortIcon('this_week_opponent')}
                </th>
                <th
                  onClick={() => handleSort('start_percentage')}
                  className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-opacity-75 text-gray-300 hover:bg-gray-600"
                >
                  START % {renderSortIcon('start_percentage')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-600">
              {sortedPlayers.map((player, index) => {
                const playerId = player.player_id || player.sleeper_id || player.id;
                const isOptimal = Array.isArray(optimalPlayerIds) ? optimalPlayerIds.includes(playerId) : false;
                
                return (
                  <tr 
                    key={playerId || index}
                    className="hover:bg-opacity-50 hover:bg-gray-700"
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

                    {/* Player Avatar & Name */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <PlayerAvatar player={player} size="sm" />
                        <span className="text-sm font-medium text-white">
                          {player.full_name || player.web_name || player.name || 'Unknown Player'}
                        </span>
                      </div>
                    </td>

                    {/* Position - UPDATED WITH SLEEPER COLORS */}
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getSleeperPositionBadgeColor(player.position)}`}>
                        {player.position || 'N/A'}
                      </span>
                    </td>

                    {/* Team */}
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium text-gray-200">
                        {player.team_abbr || player.team || 'N/A'}
                      </span>
                    </td>

                    {/* Predicted Points */}
                    <td className="px-4 py-3">
                      <span className={`text-sm font-semibold ${
                        player.predicted_points > 0
                          ? 'text-green-400'
                          : 'text-gray-400'
                      }`}>
                        {formatPoints(player.predicted_points)}
                      </span>
                    </td>

                    {/* Predicted Minutes */}
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-300">
                        {formatMinutes(player.predicted_minutes)}
                      </span>
                    </td>

                    {/* PPG */}
                    {!hideColumns.includes('ppg') && (
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-blue-400">
                          {formatPoints(player.ppg_value)}
                        </span>
                      </td>
                    )}

                    {/* Fixture Difficulty - ENHANCED WITH PROPER COLOR CODING */}
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getDifficultyColor(player.fixture_difficulty_value)}`}>
                        {player.fixture_difficulty_value !== 'N/A' && !isNaN(parseFloat(player.fixture_difficulty_value))
                          ? parseFloat(player.fixture_difficulty_value).toFixed(1)
                          : player.fixture_difficulty_value || 'N/A'}
                      </span>
                    </td>

                    {/* THIS WEEK Matchup - NEW */}
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-medium text-gray-200">
                          vs {player.this_week_opponent} {player.this_week_is_home ? '(H)' : '(A)'}
                        </span>
                        <span className={`text-xs font-medium ${player.this_week_matchup_color}`}>
                          {player.this_week_matchup_label}
                        </span>
                      </div>
                    </td>

                    {/* START % - Chance of playing */}
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-sm font-bold ${
                        player.start_percentage === null || player.start_percentage === undefined ? 'text-gray-400' :
                        player.start_percentage >= 75 ? 'text-green-400' :
                        player.start_percentage >= 50 ? 'text-yellow-400' :
                        player.start_percentage >= 25 ? 'text-orange-400' :
                        'text-red-400'
                      }`}>
                        {player.start_percentage !== null && player.start_percentage !== undefined
                          ? `${player.start_percentage}%`
                          : '100%'}
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
            <p className="text-sm text-gray-400">
              No players found matching "{searchTerm}"
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MyPlayersTable;