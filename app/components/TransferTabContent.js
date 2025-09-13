// app/components/TransferTabContent.js
// Transfer analysis component following existing dashboard patterns
'use client';

import { useState, useMemo } from 'react';

// Fixture difficulty mapping (consistent with your existing system)
const FIXTURE_DIFFICULTY = {
  1: { difficulty: 2, color: 'text-green-500' },    // Easy
  2: { difficulty: 2, color: 'text-green-500' },
  3: { difficulty: 3, color: 'text-yellow-500' },   // Medium
  4: { difficulty: 4, color: 'text-orange-500' },   // Hard
  5: { difficulty: 5, color: 'text-red-500' },      // Very Hard
};

// Team ID to difficulty mapping (you may need to adjust based on your data)
const TEAM_DIFFICULTY = {
  'ARS': 4, 'MCI': 5, 'LIV': 5, 'CHE': 4, 'TOT': 3,
  'NEW': 3, 'BHA': 2, 'AVL': 3, 'WOL': 2, 'EVE': 2,
  'BRE': 2, 'FUL': 2, 'CRY': 2, 'BOU': 2, 'SHU': 1,
  'LUT': 1, 'BUR': 1, 'MUN': 4, 'WHU': 3, 'NFO': 2
};

const TransferTabContent = ({ players, currentGameweek, isDarkMode, scoringMode = 'existing' }) => {
  // Calculate default gameweek range: current GW + next 4 (total of 5)
  const currentGW = currentGameweek?.number;
  const defaultStartGW = currentGW;
  const defaultEndGW = currentGW + 4;
  
  const [startGameweek, setStartGameweek] = useState(defaultStartGW);
  const [endGameweek, setEndGameweek] = useState(defaultEndGW);
  const [selectedPositions, setSelectedPositions] = useState([]);
  const [selectedComparison, setSelectedComparison] = useState(null);

  // Calculate transfer recommendations with efficient approach
  const transferRecommendations = useMemo(() => {
    if (!players || players.length === 0) return [];

    const myPlayers = players.filter(p => p.owned_by === 'ThatDerekGuy');
    const freeAgents = players.filter(p => !p.owned_by || p.owned_by === 'Free Agent');
    const gameweekCount = endGameweek - startGameweek + 1;

    // Only log once per unique calculation to avoid spam
    const logKey = `${freeAgents.length}-${startGameweek}-${endGameweek}`;
    if (!window.lastTransferLog || window.lastTransferLog !== logKey) {
      console.log(`🔄 Transfers: ${freeAgents.length} free agents | GW${startGameweek}-${endGameweek} (${gameweekCount}wks)`);
      window.lastTransferLog = logKey;
    }

    // Step 1: Find top 5 players in each position based on predicted points
    const positions = ['GKP', 'DEF', 'MID', 'FWD'];
    const topPlayersByPosition = {};
    
    positions.forEach(position => {
      const positionPlayers = freeAgents.filter(p => p.position === position);
      
      // Calculate points for each player and sort by highest
      const playersWithPoints = positionPlayers.map(player => ({
        ...player,
        calculatedPoints: getGameweekRangePoints(player, startGameweek, endGameweek)
      }));
      
      // Get top 5 for this position
      topPlayersByPosition[position] = playersWithPoints
        .sort((a, b) => b.calculatedPoints - a.calculatedPoints)
        .slice(0, 5);
        
      // Removed individual position logging - will show summary only
    });

    // Step 2: Always show top 5 available in each position (regardless of net gain)
    const recommendations = [];
    
    positions.forEach(position => {
      const topPlayersInPosition = topPlayersByPosition[position];
      const myPositionPlayers = myPlayers.filter(p => p.position === position);
      
      topPlayersInPosition.forEach(topPlayer => {
        // For each top player, find the best comparison from my current players
        let bestCurrentPlayer = null;
        let bestNetGain = -Infinity;
        
        if (position === 'GKP') {
          // GKP: only compare against my GKPs
          myPositionPlayers.forEach(myPlayer => {
            const myPlayerPoints = getGameweekRangePoints(myPlayer, startGameweek, endGameweek);
            const netGain = topPlayer.calculatedPoints - myPlayerPoints;
            if (netGain > bestNetGain) {
              bestNetGain = netGain;
              bestCurrentPlayer = myPlayer;
            }
          });
        } else {
          // Outfield: compare against all my outfield players
          const myOutfieldPlayers = myPlayers.filter(p => ['DEF', 'MID', 'FWD'].includes(p.position));
          myOutfieldPlayers.forEach(myPlayer => {
            const myPlayerPoints = getGameweekRangePoints(myPlayer, startGameweek, endGameweek);
            const netGain = topPlayer.calculatedPoints - myPlayerPoints;
            if (netGain > bestNetGain) {
              bestNetGain = netGain;
              bestCurrentPlayer = myPlayer;
            }
          });
        }
        
        // Add recommendation (even if net negative)
        if (bestCurrentPlayer) {
          recommendations.push({
            currentPlayer: bestCurrentPlayer,
            recommendedPlayer: topPlayer,
            netGain: bestNetGain,
            confidence: getRecommendationConfidence(topPlayer),
            fixtureRating: getFixtureRating(topPlayer, gameweekCount),
            formTrend: getFormTrend(topPlayer),
            minutesExpected: getExpectedMinutes(topPlayer, gameweekCount),
            topPlayerRank: topPlayersInPosition.indexOf(topPlayer) + 1 // 1-5 rank in position
          });
        }
      });
    });

    // Create position summary for logging (only if we logged the initial message)
    if (!window.lastTransferPoolLog || window.lastTransferPoolLog !== logKey) {
      const positionCounts = positions.map(pos => `${pos}:${topPlayersByPosition[pos]?.length || 0}`).join(' ');
      console.log(`📊 Transfer pool: ${recommendations.length} total (${positionCounts})`);
      window.lastTransferPoolLog = logKey;
    }
    
    // Step 3: Sort by position first, then by rank within position
    return recommendations
      .sort((a, b) => {
        // First sort by position order
        const posOrder = ['GKP', 'DEF', 'MID', 'FWD'];
        const posA = posOrder.indexOf(a.recommendedPlayer.position);
        const posB = posOrder.indexOf(b.recommendedPlayer.position);
        if (posA !== posB) return posA - posB;
        
        // Then by rank within position (1st, 2nd, 3rd, etc.)
        return a.topPlayerRank - b.topPlayerRank;
      });

  }, [players, startGameweek, endGameweek, scoringMode]);

  // Position colors for consistency (matching your image)
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
        pill: 'bg-gray-500'
      };
    }
  };

  const handlePositionToggle = (position) => {
    setSelectedPositions(prev => 
      prev.includes(position) 
        ? prev.filter(p => p !== position)
        : [...prev, position]
    );
  };

  // Helper functions
  function getGameweekRangePoints(player, startGW, endGW) {
    // Calculate points for a specific gameweek range
    if (!player.predictions || !Array.isArray(player.predictions)) {
      // Fallback if no predictions available
      const fallbackPpg = scoringMode === 'v3' ? (player.v3_current_gw || 0) : (player.current_gw_prediction || 0);
      const gameweekCount = endGW - startGW + 1;
      return fallbackPpg * gameweekCount;
    }
    
    let totalPoints = 0;
    
    for (let gw = startGW; gw <= endGW; gw++) {
      const prediction = player.predictions.find(p => p.gw === gw);
      if (prediction) {
        const gwPoints = scoringMode === 'v3' 
          ? (prediction.v3_predicted_pts || prediction.predicted_pts || 0)
          : (prediction.predicted_pts || 0);
        totalPoints += gwPoints;
      }
    }
    
    return totalPoints;
  }

  function getExpectedMinutes(player, gameweeks) {
    if (!player.predictions || !Array.isArray(player.predictions)) return 0;
    
    const currentGW = currentGameweek?.number;
    const targetGameweeks = Array.from({length: gameweeks}, (_, i) => currentGW + i);
    
    const totalMinutes = targetGameweeks.reduce((total, gw) => {
      const prediction = player.predictions.find(p => p.gw === gw);
      return total + (prediction?.predicted_mins || 0);
    }, 0);

    return Math.round(totalMinutes / gameweeks); // Average per game
  }

  function getFixtureRating(player, gameweeks) {
    // Simplified fixture difficulty - you can enhance with your fixture data
    const teamDiff = TEAM_DIFFICULTY[player.team_abbr] || 3;
    if (teamDiff <= 2) return 'easy';
    if (teamDiff <= 3) return 'medium';
    return 'hard';
  }

  function getFormTrend(player) {
    // Enhanced form calculation using available data
    const currentPpg = player.ppg_value || player.sleeper_season_avg || 0;
    const rosPoints = player.sleeper_points_ros || player.predicted_points || 0;
    const seasonGames = 38;
    const projectedPpg = rosPoints / seasonGames;
    
    // Compare current PPG vs projected PPG
    const formDiff = currentPpg - projectedPpg;
    
    if (formDiff > 0.5) return 'up';
    if (formDiff < -0.5) return 'down';
    return 'neutral';
  }

  function getRecommendationConfidence(player) {
    // Base confidence on minutes and consistency
    const avgMinutes = getExpectedMinutes(player, 3);
    if (avgMinutes > 80) return 'high';
    if (avgMinutes > 60) return 'medium';
    return 'low';
  }

  function renderFormTrendIcon(trend) {
    const icons = {
      up: '📈',
      neutral: '➡️', 
      down: '📉'
    };
    return icons[trend] || '➡️';
  }

  function renderFixtureDifficultyBadge(rating) {
    const configs = {
      easy: { bg: 'bg-green-100', text: 'text-green-800', label: 'Easy' },
      medium: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Medium' },
      hard: { bg: 'bg-red-100', text: 'text-red-800', label: 'Hard' }
    };
    
    const config = configs[rating] || configs.medium;
    
    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    );
  }

  function renderConfidenceBadge(confidence) {
    const configs = {
      high: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'High' },
      medium: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Med' },
      low: { bg: 'bg-orange-100', text: 'text-orange-800', label: 'Low' }
    };
    
    const config = configs[confidence] || configs.medium;
    
    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    );
  }

  function renderInjuryBadge(injuryStatus) {
    if (!injuryStatus) return null;
    
    const normalizedStatus = injuryStatus.toLowerCase();
    let config;
    
    if (normalizedStatus.includes('out') || normalizedStatus.includes('injured')) {
      config = { 
        bg: 'bg-red-100', 
        text: 'text-red-800', 
        border: 'border-red-200',
        icon: '🏥', 
        label: 'OUT' 
      };
    } else if (normalizedStatus.includes('gtd') || normalizedStatus.includes('doubtful') || normalizedStatus.includes('questionable')) {
      config = { 
        bg: 'bg-yellow-100', 
        text: 'text-yellow-800', 
        border: 'border-yellow-200',
        icon: '⚠️', 
        label: 'GTD' 
      };
    } else if (normalizedStatus.includes('fit') || normalizedStatus.includes('available')) {
      config = { 
        bg: 'bg-green-100', 
        text: 'text-green-800', 
        border: 'border-green-200',
        icon: '✅', 
        label: 'FIT' 
      };
    } else {
      config = { 
        bg: 'bg-gray-100', 
        text: 'text-gray-800', 
        border: 'border-gray-200',
        icon: '❓', 
        label: injuryStatus.substring(0, 3).toUpperCase() 
      };
    }
    
    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold border ${config.bg} ${config.text} ${config.border}`}>
        <span className="mr-1">{config.icon}</span>
        {config.label}
      </span>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Controls Section */}
      <div className={`p-4 rounded-lg shadow-sm ${isDarkMode ? 'bg-gray-800' : 'bg-white border border-gray-200'}`}>
        <div className="flex flex-wrap gap-4 items-center justify-between">
          
          {/* Position Multi-Select Filter - Left Side */}
          <div className="flex items-center gap-3">
            <label className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              Positions:
            </label>
            <div className="flex gap-2">
              {['GKP', 'DEF', 'MID', 'FWD'].map(position => {
                const colors = getPositionColor(position);
                const isSelected = selectedPositions.includes(position);
                return (
                  <button
                    key={position}
                    onClick={() => handlePositionToggle(position)}
                    className={`px-4 py-2 rounded-full text-sm font-semibold transition-all transform hover:scale-105 ${
                      isSelected 
                        ? `${colors.pill} text-white shadow-lg`
                        : isDarkMode 
                          ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                          : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                    }`}
                  >
                    {position}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              GW {startGameweek} to {endGameweek} ({endGameweek - startGameweek + 1} weeks)
            </span>
          </div>
        </div>
      </div>

      {/* Position Sections */}
      <div className="space-y-6">
        {['FWD', 'MID', 'DEF', 'GKP'].filter(position => selectedPositions.length === 0 || selectedPositions.includes(position)).map(position => {
          const positionPlayers = transferRecommendations.filter(rec => rec.recommendedPlayer.position === position);
          const myPositionPlayers = players.filter(p => p.owned_by === 'ThatDerekGuy' && p.position === position);
          const colors = getPositionColor(position);
          
          return (
            <div key={position} className={`rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white border border-gray-200'}`}>
              {/* Position Header with pill style */}
              <div className={`px-6 py-4 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                <div className="flex items-center gap-4">
                  <div className={`px-4 py-2 rounded-full ${colors.pill} text-white font-semibold text-sm shadow-lg`}>
                    {position}
                  </div>
                  <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {position === 'FWD' ? 'Forwards' : 
                     position === 'MID' ? 'Midfielders' : 
                     position === 'DEF' ? 'Defenders' : 'Goalkeepers'}
                  </h3>
                </div>
              </div>
              
              {/* Two Column Layout */}
              <div className="grid grid-cols-2 gap-0">
                
                {/* Left Column - Available Players */}
                <div className={`border-r ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                  <div className={`px-4 py-3 bg-opacity-50 ${isDarkMode ? 'bg-green-900' : 'bg-green-50'}`}>
                    <h4 className={`text-sm font-medium ${isDarkMode ? 'text-green-300' : 'text-green-700'}`}>
                      Top 5 Available
                    </h4>
                  </div>
                  <div className="divide-y divide-gray-200 dark:divide-gray-700">
                    {positionPlayers.length > 0 ? positionPlayers.map((rec, index) => (
                      <div
                        key={`avail-${rec.recommendedPlayer.player_id}`}
                        className={`p-3 cursor-pointer transition-colors hover:bg-opacity-50 ${
                          isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'
                        }`}
                        onClick={() => setSelectedComparison(rec)}
                      >
                        <div className="flex items-center justify-between">
                          {/* Player Info */}
                          <div className="flex items-center gap-3">
                            <div className={`w-6 h-6 rounded-full ${colors.accent} flex items-center justify-center text-xs font-semibold text-white`}>
                              {index + 1}
                            </div>
                            <div>
                              <div className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                {rec.recommendedPlayer.web_name || rec.recommendedPlayer.name}
                              </div>
                              <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                {rec.recommendedPlayer.team_abbr}
                                {rec.recommendedPlayer.injury_status && (
                                  <span className="ml-1 text-xs">
                                    {rec.recommendedPlayer.injury_status.includes('out') ? '🔴' :
                                     rec.recommendedPlayer.injury_status.includes('gtd') ? '🟡' : ''}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          {/* Points */}
                          <div className="text-right">
                            <div className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                              {rec.recommendedPlayer.calculatedPoints.toFixed(1)}
                            </div>
                          </div>
                        </div>
                      </div>
                    )) : (
                      <div className={`p-3 text-center text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        No available players
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Right Column - My Roster */}
                <div>
                  <div className={`px-4 py-3 bg-opacity-50 ${isDarkMode ? 'bg-blue-900' : 'bg-blue-50'}`}>
                    <h4 className={`text-sm font-medium ${isDarkMode ? 'text-blue-300' : 'text-blue-700'}`}>
                      My Roster
                    </h4>
                  </div>
                  <div className="divide-y divide-gray-200 dark:divide-gray-700">
                    {myPositionPlayers.length > 0 ? myPositionPlayers.map((player, index) => (
                      <div
                        key={`my-${player.player_id}`}
                        className="p-3"
                      >
                        <div className="flex items-center justify-between">
                          {/* Player Info */}
                          <div className="flex items-center gap-3">
                            <div className={`w-6 h-6 rounded-full ${colors.accent} flex items-center justify-center text-xs font-semibold text-white opacity-60`}>
                              {index + 1}
                            </div>
                            <div>
                              <div className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                {player.web_name || player.name}
                              </div>
                              <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                {player.team_abbr}
                                {player.injury_status && (
                                  <span className="ml-1 text-xs">
                                    {player.injury_status.includes('out') ? '🔴' :
                                     player.injury_status.includes('gtd') ? '🟡' : ''}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          {/* Points */}
                          <div className="text-right">
                            <div className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                              {getGameweekRangePoints(player, startGameweek, endGameweek).toFixed(1)}
                            </div>
                          </div>
                        </div>
                      </div>
                    )) : (
                      <div className={`p-3 text-center text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        No players in roster
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* No results message */}
      {transferRecommendations.length === 0 && (
        <div className={`text-center py-8 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white border border-gray-200'}`}>
          <div className={`text-2xl mb-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            🎉
          </div>
          <div className={`mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'} font-medium`}>
            Your team is well optimized!
          </div>
          <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            No significant upgrades found in the available free agents.
          </div>
        </div>
      )}

      {/* Comparison Modal */}
      {selectedComparison && (
        <ComparisonModal
          comparison={selectedComparison}
          startGameweek={startGameweek}
          endGameweek={endGameweek}
          currentGameweek={currentGameweek}
          isDarkMode={isDarkMode}
          onClose={() => setSelectedComparison(null)}
        />
      )}
    </div>
  );
};

// Comparison Modal Component
const ComparisonModal = ({ comparison, startGameweek, endGameweek, currentGameweek, isDarkMode, onClose }) => {
  const gameweekCount = endGameweek - startGameweek + 1;
  
  // Get gameweek predictions for both players
  const getGameweekPredictions = (player) => {
    if (!player.predictions) return [];
    const predictions = [];
    for (let gw = startGameweek; gw <= endGameweek; gw++) {
      const prediction = player.predictions.find(p => p.gw === gw);
      predictions.push({
        gameweek: gw,
        points: prediction?.predicted_pts || 0,
        minutes: prediction?.predicted_mins || 0
      });
    }
    return predictions;
  };

  const currentPredictions = getGameweekPredictions(comparison.currentPlayer);
  const recommendedPredictions = getGameweekPredictions(comparison.recommendedPlayer);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className={`max-w-4xl w-full max-h-[90vh] overflow-y-auto rounded-lg ${
        isDarkMode ? 'bg-gray-800' : 'bg-white'
      }`}>
        
        {/* Header */}
        <div className={`p-6 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          <div className="flex items-center justify-between">
            <h2 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Player Comparison
            </h2>
            <button
              onClick={onClose}
              className={`p-2 rounded-full hover:bg-gray-100 ${isDarkMode ? 'hover:bg-gray-700 text-gray-400' : 'text-gray-500'}`}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-6 mb-6">
            
            {/* Current Player */}
            <div className={`p-4 rounded-lg border ${
              isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-red-50 border-red-200'
            }`}>
              <div className="flex items-center justify-between mb-3">
                <h3 className={`font-medium text-red-600`}>
                  OUT: {comparison.currentPlayer.web_name}
                </h3>
                <span className={`text-xs px-2 py-1 rounded ${
                  isDarkMode ? 'bg-gray-600 text-gray-300' : 'bg-gray-200 text-gray-700'
                }`}>
                  {comparison.currentPlayer.position}
                </span>
              </div>
              <div className="space-y-1">
                <div className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Team: {comparison.currentPlayer.team_abbr}
                </div>
                <div className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  GW{startGameweek}-{endGameweek}: {getGameweekPredictions(comparison.currentPlayer).reduce((sum, p) => sum + p.points, 0).toFixed(1)} pts
                </div>
                <div className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Owner: {comparison.currentPlayer.owned_by}
                </div>
              </div>
            </div>

            {/* Recommended Player */}
            <div className={`p-4 rounded-lg border ${
              isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-green-50 border-green-200'
            }`}>
              <div className="flex items-center justify-between mb-3">
                <h3 className={`font-medium text-green-600`}>
                  IN: {comparison.recommendedPlayer.web_name}
                </h3>
                <span className={`text-xs px-2 py-1 rounded ${
                  isDarkMode ? 'bg-gray-600 text-gray-300' : 'bg-gray-200 text-gray-700'
                }`}>
                  {comparison.recommendedPlayer.position}
                </span>
              </div>
              <div className="space-y-1">
                <div className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Team: {comparison.recommendedPlayer.team_abbr}
                </div>
                <div className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  GW{startGameweek}-{endGameweek}: {getGameweekPredictions(comparison.recommendedPlayer).reduce((sum, p) => sum + p.points, 0).toFixed(1)} pts
                </div>
                <div className={`text-lg font-bold text-green-600`}>
                  Net gain: +{comparison.netGain.toFixed(1)}
                </div>
              </div>
            </div>
          </div>

          {/* Gameweek Breakdown */}
          <div className="mb-6">
            <h4 className={`text-lg font-medium mb-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Gameweeks {startGameweek}-{endGameweek} ({gameweekCount} GWs)
            </h4>
            
            <div className={`overflow-x-auto border rounded-lg ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
              <table className="min-w-full">
                <thead className={isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}>
                  <tr>
                    <th className={`px-4 py-3 text-left text-xs font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>
                      Gameweek
                    </th>
                    <th className={`px-4 py-3 text-left text-xs font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>
                      Current Player
                    </th>
                    <th className={`px-4 py-3 text-left text-xs font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>
                      Recommended
                    </th>
                    <th className={`px-4 py-3 text-left text-xs font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>
                      Difference
                    </th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDarkMode ? 'divide-gray-700' : 'divide-gray-200'}`}>
                  {Array.from({length: gameweekCount}, (_, i) => {
                    const current = currentPredictions[i] || { gameweek: startGameweek + i, points: 0, minutes: 0 };
                    const recommended = recommendedPredictions[i] || { gameweek: startGameweek + i, points: 0, minutes: 0 };
                    const diff = recommended.points - current.points;
                    
                    return (
                      <tr key={current.gameweek} className={isDarkMode ? 'bg-gray-800' : 'bg-white'}>
                        <td className={`px-4 py-3 text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          GW {current.gameweek}
                        </td>
                        <td className={`px-4 py-3 text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                          {current.points.toFixed(1)} pts ({current.minutes}min)
                        </td>
                        <td className={`px-4 py-3 text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                          {recommended.points.toFixed(1)} pts ({recommended.minutes}min)
                        </td>
                        <td className={`px-4 py-3 text-sm font-medium ${
                          diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-600' : isDarkMode ? 'text-gray-400' : 'text-gray-500'
                        }`}>
                          {diff > 0 ? '+' : ''}{diff.toFixed(1)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 justify-end">
            <button
              onClick={onClose}
              className={`px-4 py-2 border rounded-md font-medium transition-colors ${
                isDarkMode 
                  ? 'border-gray-600 text-gray-300 hover:bg-gray-700' 
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              Close
            </button>
            <button
              className="px-4 py-2 bg-green-600 text-white rounded-md font-medium hover:bg-green-700 transition-colors"
              onClick={() => {
                // You can add transfer action logic here later
                alert(`Transfer suggestion: Drop ${comparison.currentPlayer.web_name}, pickup ${comparison.recommendedPlayer.web_name}`);
              }}
            >
              Consider Transfer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TransferTabContent;