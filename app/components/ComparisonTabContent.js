'use client';

import { useState, useMemo } from 'react';
import { getScoringValue } from '../services/v3ScoringService.js';

const ComparisonTabContent = ({ players = [], currentGameweek, scoringMode = 'ffh' }) => {
  const [selectedPlayer1, setSelectedPlayer1] = useState(null);
  const [selectedPlayer2, setSelectedPlayer2] = useState(null);
  const [searchTerm1, setSearchTerm1] = useState('');
  const [searchTerm2, setSearchTerm2] = useState('');
  const [showSuggestions1, setShowSuggestions1] = useState(false);
  const [showSuggestions2, setShowSuggestions2] = useState(false);

  // Filter players for auto-suggestions
  const filteredPlayers1 = useMemo(() => {
    if (!searchTerm1) return [];
    return players.filter(player =>
      player.name?.toLowerCase().includes(searchTerm1.toLowerCase()) ||
      player.full_name?.toLowerCase().includes(searchTerm1.toLowerCase()) ||
      player.web_name?.toLowerCase().includes(searchTerm1.toLowerCase()) ||
      player.team_abbr?.toLowerCase().includes(searchTerm1.toLowerCase()) ||
      player.team?.toLowerCase().includes(searchTerm1.toLowerCase())
    ).slice(0, 10); // Show top 10 suggestions
  }, [players, searchTerm1]);

  const filteredPlayers2 = useMemo(() => {
    if (!searchTerm2) return [];
    return players.filter(player =>
      player.name?.toLowerCase().includes(searchTerm2.toLowerCase()) ||
      player.full_name?.toLowerCase().includes(searchTerm2.toLowerCase()) ||
      player.web_name?.toLowerCase().includes(searchTerm2.toLowerCase()) ||
      player.team_abbr?.toLowerCase().includes(searchTerm2.toLowerCase()) ||
      player.team?.toLowerCase().includes(searchTerm2.toLowerCase())
    ).slice(0, 10); // Show top 10 suggestions
  }, [players, searchTerm2]);

  // Helper functions for player selection
  const selectPlayer1 = (player) => {
    setSelectedPlayer1(player);
    setSearchTerm1(player.name || player.full_name || '');
    setShowSuggestions1(false);
  };

  const selectPlayer2 = (player) => {
    setSelectedPlayer2(player);
    setSearchTerm2(player.name || player.full_name || '');
    setShowSuggestions2(false);
  };

  const handleSearch1Change = (value) => {
    setSearchTerm1(value);
    setShowSuggestions1(value.length > 0);
    if (value.length === 0) {
      setSelectedPlayer1(null);
    }
  };

  const handleSearch2Change = (value) => {
    setSearchTerm2(value);
    setShowSuggestions2(value.length > 0);
    if (value.length === 0) {
      setSelectedPlayer2(null);
    }
  };

  // Get comparison stats for a player
  const getPlayerStats = (player) => {
    if (!player) return null;

    return {
      // Basic Info
      name: player.name || player.full_name || 'Unknown',
      team: player.team_abbr || player.team || 'Unknown',
      position: player.position || 'Unknown',

      // Core Stats
      rosPoints: getScoringValue(player, 'season_total', scoringMode),
      next5GW: (() => {
        if (player.predictions && Array.isArray(player.predictions)) {
          const first5 = player.predictions.slice(0, 5);
          return first5.reduce((sum, pred) => sum + (pred.predicted_pts || 0), 0);
        }
        return 0;
      })(),
      avgMinsNext5: (() => {
        if (player.predictions && Array.isArray(player.predictions)) {
          const first5 = player.predictions.slice(0, 5);
          const totalMins = first5.reduce((sum, pred) => sum + (pred.xmins || 0), 0);
          return first5.length > 0 ? (totalMins / first5.length) : 0;
        }
        return 0;
      })(),
      ppgPredicted: getScoringValue(player, 'season_avg', scoringMode),
      currentGW: getScoringValue(player, 'current_gw', scoringMode),

      // V3 Enhanced (if available)
      v3SeasonTotal: player.v3_season_total || 0,
      v3SeasonAvg: player.v3_season_avg || 0,
      v3CurrentGW: player.v3_current_gw || 0,
      v3Confidence: player.v3_confidence || 'none',

      // News
      news: player.news || ''
    };
  };

  const player1Stats = getPlayerStats(selectedPlayer1);
  const player2Stats = getPlayerStats(selectedPlayer2);

  // Helper function to compare values and show difference
  const getComparisonClass = (val1, val2, reverse = false) => {
    if (!val1 || !val2 || val1 === val2) return 'text-gray-300';
    const better = reverse ? val1 < val2 : val1 > val2;
    return better ? 'text-green-400' : 'text-red-400';
  };

  const formatValue = (value, type = 'number') => {
    if (value === null || value === undefined) return 'N/A';
    if (type === 'decimal') return Number(value).toFixed(1);
    if (type === 'currency') return `£${Number(value).toFixed(1)}m`;
    if (type === 'percentage') return `${Number(value).toFixed(1)}%`;
    return Number(value).toFixed(1);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white mb-2">Player Comparison</h2>
        <p className="text-gray-400">Compare two players side by side</p>
      </div>

      {/* Player Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Player 1 Selection */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-white mb-4">Player 1</h3>
          <div className="relative">
            <input
              type="text"
              placeholder="Start typing a player name..."
              value={searchTerm1}
              onChange={(e) => handleSearch1Change(e.target.value)}
              onFocus={() => setShowSuggestions1(searchTerm1.length > 0)}
              className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
            />

            {/* Auto-suggestions dropdown */}
            {showSuggestions1 && filteredPlayers1.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-gray-700 border border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {filteredPlayers1.map(player => (
                  <div
                    key={player.player_id}
                    onClick={() => selectPlayer1(player)}
                    className="px-3 py-2 hover:bg-gray-600 cursor-pointer border-b border-gray-600 last:border-b-0"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-white font-medium">
                          {player.name || player.full_name}
                        </div>
                        <div className="text-gray-400 text-sm">
                          {player.position} • {player.team_abbr || player.team}
                        </div>
                      </div>
                      <div className="text-gray-400 text-xs">
                        {getScoringValue(player, 'season_total', scoringMode).toFixed(1)} pts
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Selected player display */}
            {selectedPlayer1 && (
              <div className="mt-3 p-3 bg-gray-700 rounded border-l-4 border-blue-500">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-white font-medium">{selectedPlayer1.name || selectedPlayer1.full_name}</div>
                    <div className="text-gray-400 text-sm">{selectedPlayer1.position} • {selectedPlayer1.team_abbr || selectedPlayer1.team}</div>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedPlayer1(null);
                      setSearchTerm1('');
                      setShowSuggestions1(false);
                    }}
                    className="text-red-400 hover:text-red-300"
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Player 2 Selection */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-white mb-4">Player 2</h3>
          <div className="relative">
            <input
              type="text"
              placeholder="Start typing a player name..."
              value={searchTerm2}
              onChange={(e) => handleSearch2Change(e.target.value)}
              onFocus={() => setShowSuggestions2(searchTerm2.length > 0)}
              className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
            />

            {/* Auto-suggestions dropdown */}
            {showSuggestions2 && filteredPlayers2.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-gray-700 border border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {filteredPlayers2.map(player => (
                  <div
                    key={player.player_id}
                    onClick={() => selectPlayer2(player)}
                    className="px-3 py-2 hover:bg-gray-600 cursor-pointer border-b border-gray-600 last:border-b-0"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-white font-medium">
                          {player.name || player.full_name}
                        </div>
                        <div className="text-gray-400 text-sm">
                          {player.position} • {player.team_abbr || player.team}
                        </div>
                      </div>
                      <div className="text-gray-400 text-xs">
                        {getScoringValue(player, 'season_total', scoringMode).toFixed(1)} pts
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Selected player display */}
            {selectedPlayer2 && (
              <div className="mt-3 p-3 bg-gray-700 rounded border-l-4 border-green-500">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-white font-medium">{selectedPlayer2.name || selectedPlayer2.full_name}</div>
                    <div className="text-gray-400 text-sm">{selectedPlayer2.position} • {selectedPlayer2.team_abbr || selectedPlayer2.team}</div>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedPlayer2(null);
                      setSearchTerm2('');
                      setShowSuggestions2(false);
                    }}
                    className="text-red-400 hover:text-red-300"
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Comparison Results */}
      {player1Stats && player2Stats && (
        <div className="bg-gray-800 rounded-lg overflow-hidden">
          <div className="bg-gray-700 px-6 py-4 border-b border-gray-600">
            <h3 className="text-xl font-semibold text-white">Comparison Results</h3>
          </div>

          <div className="p-6">
            {/* Player Headers */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="text-center">
                <div className="text-xl font-bold text-white">{player1Stats.name}</div>
                <div className="text-sm text-gray-400">{player1Stats.position} • {player1Stats.team}</div>
                {player1Stats.news && (
                  <span className="text-orange-400 text-sm" title={player1Stats.news}>📰</span>
                )}
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-gray-400">VS</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-white">{player2Stats.name}</div>
                <div className="text-sm text-gray-400">{player2Stats.position} • {player2Stats.team}</div>
                {player2Stats.news && (
                  <span className="text-orange-400 text-sm" title={player2Stats.news}>📰</span>
                )}
              </div>
            </div>

            {/* Stats Comparison */}
            <div className="space-y-3">
              {/* Core Predictions */}
              <div className="bg-gray-700 rounded p-4">
                <h4 className="text-white font-semibold mb-3">Core Predictions</h4>
                <div className="space-y-2">
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div className={`text-right ${getComparisonClass(player1Stats.rosPoints, player2Stats.rosPoints)}`}>
                      {formatValue(player1Stats.rosPoints)}
                    </div>
                    <div className="text-center text-gray-400">ROS Points</div>
                    <div className={`text-left ${getComparisonClass(player2Stats.rosPoints, player1Stats.rosPoints)}`}>
                      {formatValue(player2Stats.rosPoints)}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div className={`text-right ${getComparisonClass(player1Stats.next5GW, player2Stats.next5GW)}`}>
                      {formatValue(player1Stats.next5GW)}
                    </div>
                    <div className="text-center text-gray-400">Next 5 GW</div>
                    <div className={`text-left ${getComparisonClass(player2Stats.next5GW, player1Stats.next5GW)}`}>
                      {formatValue(player2Stats.next5GW)}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div className={`text-right ${getComparisonClass(player1Stats.avgMinsNext5, player2Stats.avgMinsNext5)}`}>
                      {formatValue(player1Stats.avgMinsNext5)}
                    </div>
                    <div className="text-center text-gray-400">Avg Mins Next 5</div>
                    <div className={`text-left ${getComparisonClass(player2Stats.avgMinsNext5, player1Stats.avgMinsNext5)}`}>
                      {formatValue(player2Stats.avgMinsNext5)}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div className={`text-right ${getComparisonClass(player1Stats.ppgPredicted, player2Stats.ppgPredicted)}`}>
                      {formatValue(player1Stats.ppgPredicted, 'decimal')}
                    </div>
                    <div className="text-center text-gray-400">PPG Predicted</div>
                    <div className={`text-left ${getComparisonClass(player2Stats.ppgPredicted, player1Stats.ppgPredicted)}`}>
                      {formatValue(player2Stats.ppgPredicted, 'decimal')}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div className={`text-right ${getComparisonClass(player1Stats.currentGW, player2Stats.currentGW)}`}>
                      {formatValue(player1Stats.currentGW, 'decimal')}
                    </div>
                    <div className="text-center text-gray-400">Current GW</div>
                    <div className={`text-left ${getComparisonClass(player2Stats.currentGW, player1Stats.currentGW)}`}>
                      {formatValue(player2Stats.currentGW, 'decimal')}
                    </div>
                  </div>
                </div>
              </div>

              {/* V3 Enhanced (if available) */}
              {scoringMode === 'v3' && (player1Stats.v3SeasonTotal > 0 || player2Stats.v3SeasonTotal > 0) && (
                <div className="bg-gray-700 rounded p-4">
                  <h4 className="text-white font-semibold mb-3">V3 Enhanced Predictions</h4>
                  <div className="space-y-2">
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div className={`text-right ${getComparisonClass(player1Stats.v3SeasonTotal, player2Stats.v3SeasonTotal)}`}>
                        {formatValue(player1Stats.v3SeasonTotal)}
                      </div>
                      <div className="text-center text-gray-400">V3 Season Total</div>
                      <div className={`text-left ${getComparisonClass(player2Stats.v3SeasonTotal, player1Stats.v3SeasonTotal)}`}>
                        {formatValue(player2Stats.v3SeasonTotal)}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div className={`text-right ${getComparisonClass(player1Stats.v3SeasonAvg, player2Stats.v3SeasonAvg)}`}>
                        {formatValue(player1Stats.v3SeasonAvg, 'decimal')}
                      </div>
                      <div className="text-center text-gray-400">V3 Season Avg</div>
                      <div className={`text-left ${getComparisonClass(player2Stats.v3SeasonAvg, player1Stats.v3SeasonAvg)}`}>
                        {formatValue(player2Stats.v3SeasonAvg, 'decimal')}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div className="text-right text-gray-300">{player1Stats.v3Confidence}</div>
                      <div className="text-center text-gray-400">V3 Confidence</div>
                      <div className="text-left text-gray-300">{player2Stats.v3Confidence}</div>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {(!selectedPlayer1 || !selectedPlayer2) && (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">⚖️</div>
          <h3 className="text-xl font-semibold text-white mb-2">Select Two Players to Compare</h3>
          <p className="text-gray-400">Choose players from the dropdowns above to see a detailed comparison</p>
        </div>
      )}
    </div>
  );
};

export default ComparisonTabContent;