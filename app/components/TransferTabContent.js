// app/components/TransferTabContent.js
// Transfer analysis component following existing dashboard patterns

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

const TransferTabContent = ({ players, currentGameweek, isDarkMode }) => {
  const [selectedGameweeks, setSelectedGameweeks] = useState(5); // Default next 5 games
  const [selectedPosition, setSelectedPosition] = useState('all');
  const [showUpgradesOnly, setShowUpgradesOnly] = useState(true);
  const [selectedComparison, setSelectedComparison] = useState(null);

  // Calculate transfer recommendations
  const transferRecommendations = useMemo(() => {
    if (!players || players.length === 0) return [];

    const myPlayers = players.filter(p => p.owned_by === 'ThatDerekGuy');
    const freeAgents = players.filter(p => !p.owned_by || p.owned_by === 'Free Agent');

    console.log('=== RECOMMENDATION DEBUG ===');
    console.log('My players count:', myPlayers.length);
    console.log('My player names:', myPlayers.map(p => p.name));
    console.log('Free agents count:', freeAgents.length);

    const recommendations = [];

    // Group by position for better comparisons
    const positions = ['GKP', 'DEF', 'MID', 'FWD'];
    
    positions.forEach(position => {
      const myPositionPlayers = myPlayers.filter(p => p.position === position);
      const freeAgentsPosition = freeAgents.filter(p => p.position === position);

      console.log(`${position} - My players:`, myPositionPlayers.map(p => p.name));
      console.log(`${position} - Free agents:`, freeAgentsPosition.length);

      myPositionPlayers.forEach(myPlayer => {
        freeAgentsPosition.forEach(freeAgent => {
          const myPlayerPoints = getNextXGameweekPoints(myPlayer, selectedGameweeks);
          const freeAgentPoints = getNextXGameweekPoints(freeAgent, selectedGameweeks);
          
          const netGain = freeAgentPoints - myPlayerPoints;

          console.log(`Comparing: ${myPlayer.name} (${myPlayerPoints.toFixed(1)}) vs ${freeAgent.name} (${freeAgentPoints.toFixed(1)}) = ${netGain.toFixed(1)} gain`);

          if (netGain > 0.1) { // Lowered threshold for testing
            recommendations.push({
              currentPlayer: myPlayer,
              recommendedPlayer: freeAgent,
              netGain: netGain,
              confidence: getRecommendationConfidence(freeAgent),
              fixtureRating: getFixtureRating(freeAgent, selectedGameweeks),
              formTrend: getFormTrend(freeAgent),
              minutesExpected: getExpectedMinutes(freeAgent, selectedGameweeks)
            });
          }
        });
      });
    });

    console.log('Final recommendations:', recommendations.map(r => `${r.currentPlayer.name} -> ${r.recommendedPlayer.name} (+${r.netGain.toFixed(1)})`));

    // Sort by net gain descending
    return recommendations
      .sort((a, b) => b.netGain - a.netGain)
      .slice(0, 20); // Top 20 recommendations

  }, [players, selectedGameweeks]);

  // Filter recommendations based on position and upgrades toggle
  const filteredRecommendations = useMemo(() => {
    let filtered = transferRecommendations;

    if (selectedPosition !== 'all') {
      filtered = filtered.filter(rec => rec.currentPlayer.position === selectedPosition);
    }

    if (showUpgradesOnly) {
      filtered = filtered.filter(rec => rec.netGain > 0);
    }

    return filtered;
  }, [transferRecommendations, selectedPosition, showUpgradesOnly]);

  // Helper functions
  function getNextXGameweekPoints(player, gameweeks) {
    if (!player.predictions || !Array.isArray(player.predictions)) return 0;
    
    const currentGW = currentGameweek?.number || 2;
    const targetGameweeks = Array.from({length: gameweeks}, (_, i) => currentGW + i);
    
    return targetGameweeks.reduce((total, gw) => {
      const prediction = player.predictions.find(p => p.gw === gw);
      return total + (prediction?.predicted_pts || 0);
    }, 0);
  }

  function getExpectedMinutes(player, gameweeks) {
    if (!player.predictions || !Array.isArray(player.predictions)) return 0;
    
    const currentGW = currentGameweek?.number || 2;
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
    // Simple form calculation based on recent points
    const recent = player.predictions?.slice(0, 3) || [];
    const avgRecent = recent.reduce((sum, p) => sum + (p.predicted_pts || 0), 0) / Math.max(recent.length, 1);
    
    if (avgRecent > 6) return 'up';
    if (avgRecent > 4) return 'neutral';
    return 'down';
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

  return (
    <div className="space-y-6">
      
      {/* Controls Section */}
      <div className={`p-4 rounded-lg shadow-sm ${isDarkMode ? 'bg-gray-800' : 'bg-white border border-gray-200'}`}>
        <div className="flex flex-wrap gap-4 items-center">
          
          {/* Gameweeks Slider */}
          <div className="flex items-center gap-3">
            <label className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              Next {selectedGameweeks} games
            </label>
            <input
              type="range"
              min="3"
              max="10"
              value={selectedGameweeks}
              onChange={(e) => setSelectedGameweeks(parseInt(e.target.value))}
              className="w-20"
            />
          </div>

          {/* Position Filter */}
          <div>
            <select
              value={selectedPosition}
              onChange={(e) => setSelectedPosition(e.target.value)}
              className={`p-2 border rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                isDarkMode 
                  ? 'bg-gray-700 border-gray-600 text-white' 
                  : 'bg-white border-gray-300 text-gray-900'
              }`}
            >
              <option value="all">All Positions</option>
              <option value="GKP">Goalkeepers</option>
              <option value="DEF">Defenders</option>
              <option value="MID">Midfielders</option>
              <option value="FWD">Forwards</option>
            </select>
          </div>

          {/* Show Upgrades Only Toggle */}
          <div className="flex items-center">
            <input
              type="checkbox"
              id="upgradesOnly"
              checked={showUpgradesOnly}
              onChange={(e) => setShowUpgradesOnly(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200"
            />
            <label htmlFor="upgradesOnly" className={`ml-2 text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              Show upgrades only
            </label>
          </div>
        </div>
      </div>

      {/* Recommendations Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredRecommendations.map((rec, index) => (
          <div
            key={`${rec.currentPlayer.player_id}-${rec.recommendedPlayer.player_id}`}
            className={`p-4 rounded-lg shadow-sm border cursor-pointer hover:shadow-md transition-shadow ${
              isDarkMode ? 'bg-gray-800 border-gray-700 hover:bg-gray-750' : 'bg-white border-gray-200 hover:bg-gray-50'
            }`}
            onClick={() => setSelectedComparison(rec)}
          >
            
            {/* Header: Position & Net Gain */}
            <div className="flex items-center justify-between mb-3">
              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                rec.currentPlayer.position === 'GKP' ? 'bg-yellow-100 text-yellow-800' :
                rec.currentPlayer.position === 'DEF' ? 'bg-green-100 text-green-800' :
                rec.currentPlayer.position === 'MID' ? 'bg-blue-100 text-blue-800' :
                'bg-red-100 text-red-800'
              }`}>
                {rec.currentPlayer.position}
              </span>
              <span className="text-lg font-bold text-green-600">
                +{rec.netGain.toFixed(1)}
              </span>
            </div>

            {/* Player Swap */}
            <div className="space-y-2 mb-3">
              <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                <span className="text-red-500">OUT:</span> {rec.currentPlayer.web_name}
              </div>
              <div className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                <span className="text-green-500">IN:</span> {rec.recommendedPlayer.web_name}
              </div>
              <div className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                {rec.recommendedPlayer.team_abbr}
              </div>
            </div>

            {/* Key Stats */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Next {selectedGameweeks} games
                </span>
                <span className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {getNextXGameweekPoints(rec.recommendedPlayer, selectedGameweeks).toFixed(1)} pts
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  ~{rec.minutesExpected} mins/game
                </span>
                <div className="flex items-center gap-1">
                  {renderFormTrendIcon(rec.formTrend)}
                  <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Form
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs">
                  {renderFixtureDifficultyBadge(rec.fixtureRating)}
                </span>
                {renderConfidenceBadge(rec.confidence)}
              </div>
            </div>

            {/* Click indicator */}
            <div className={`mt-3 pt-2 border-t text-center text-xs ${
              isDarkMode ? 'border-gray-700 text-gray-500' : 'border-gray-200 text-gray-500'
            }`}>
              Click to compare
            </div>
          </div>
        ))}
      </div>

      {/* No results message */}
      {filteredRecommendations.length === 0 && (
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
          selectedGameweeks={selectedGameweeks}
          currentGameweek={currentGameweek}
          isDarkMode={isDarkMode}
          onClose={() => setSelectedComparison(null)}
        />
      )}
    </div>
  );
};

// Comparison Modal Component
const ComparisonModal = ({ comparison, selectedGameweeks, currentGameweek, isDarkMode, onClose }) => {
  const currentGW = currentGameweek?.number || 2;
  
  // Get gameweek predictions for both players
  const getGameweekPredictions = (player) => {
    if (!player.predictions) return [];
    return Array.from({length: selectedGameweeks}, (_, i) => {
      const gw = currentGW + i;
      const prediction = player.predictions.find(p => p.gw === gw);
      return {
        gameweek: gw,
        points: prediction?.predicted_pts || 0,
        minutes: prediction?.predicted_mins || 0
      };
    });
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
                  Next {selectedGameweeks}: {getGameweekPredictions(comparison.currentPlayer).reduce((sum, p) => sum + p.points, 0).toFixed(1)} pts
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
                  Next {selectedGameweeks}: {getGameweekPredictions(comparison.recommendedPlayer).reduce((sum, p) => sum + p.points, 0).toFixed(1)} pts
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
              Next {selectedGameweeks} Gameweeks
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
                  {Array.from({length: selectedGameweeks}, (_, i) => {
                    const current = currentPredictions[i] || { gameweek: currentGW + i, points: 0, minutes: 0 };
                    const recommended = recommendedPredictions[i] || { gameweek: currentGW + i, points: 0, minutes: 0 };
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