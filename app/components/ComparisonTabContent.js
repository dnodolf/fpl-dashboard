'use client';

import { useState, useMemo, useEffect } from 'react';
import PropTypes from 'prop-types';
import { getScoringValue } from '../services/v3ScoringService.js';
import { TOTAL_GAMEWEEKS, USER_ID } from '../config/constants';
import { convertToV3Points } from '../services/v3/conversionRatios';
import { getNextNGameweeksTotal, getAvgMinutesNextN } from '../utils/predictionUtils';

// Get fixture difficulty color
const getDifficultyColor = (difficulty) => {
  switch(difficulty) {
    case 1: return 'bg-green-500';
    case 2: return 'bg-green-400';
    case 3: return 'bg-yellow-500';
    case 4: return 'bg-orange-500';
    case 5: return 'bg-red-500';
    default: return 'bg-gray-500';
  }
};

const ComparisonTabContent = ({ players = [], currentGameweek, scoringMode = 'ffh', onPlayerClick, preSelectedPlayer1, onClearPreSelection }) => {
  const [selectedPlayer1, setSelectedPlayer1] = useState(null);
  const [selectedPlayer2, setSelectedPlayer2] = useState(null);
  const [searchTerm1, setSearchTerm1] = useState('');
  const [searchTerm2, setSearchTerm2] = useState('');
  const [showSuggestions1, setShowSuggestions1] = useState(false);
  const [showSuggestions2, setShowSuggestions2] = useState(false);

  // Get my players for quick selection
  const myPlayers = useMemo(() => {
    return players.filter(p =>
      p.owned_by === USER_ID || p.owned_by === 'You'
    ).sort((a, b) => {
      // Sort by position then name
      const posOrder = { GKP: 0, DEF: 1, MID: 2, FWD: 3 };
      if (posOrder[a.position] !== posOrder[b.position]) {
        return posOrder[a.position] - posOrder[b.position];
      }
      return (a.name || a.full_name || '').localeCompare(b.name || b.full_name || '');
    });
  }, [players]);

  // Handle pre-selected player from Compare button
  useEffect(() => {
    if (preSelectedPlayer1 && !selectedPlayer1) {
      setSelectedPlayer1(preSelectedPlayer1);
      setSearchTerm1(preSelectedPlayer1.name || preSelectedPlayer1.full_name || '');
      if (onClearPreSelection) {
        onClearPreSelection();
      }
    }
  }, [preSelectedPlayer1, selectedPlayer1, onClearPreSelection]);

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

      // Core Stats (using centralized utilities for consistency)
      rosPoints: getScoringValue(player, 'season_total', scoringMode),
      next5GW: getNextNGameweeksTotal(player, scoringMode, currentGameweek, 5),
      avgMinsNext5: getAvgMinutesNextN(player, currentGameweek, 5),
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

  // Helper function to extract fixtures for next 5 GWs and all remaining
  const getPlayerFixtures = (player) => {
    if (!player || !player.predictions || !currentGameweek) return { next5: [], remaining: [] };

    const currentGW = currentGameweek.number || 15;
    const predictions = player.predictions || [];

    const allFixtures = predictions
      .filter(p => p.gw > currentGW && p.gw <= TOTAL_GAMEWEEKS)
      .map(p => {
        let opponent = 'TBD';
        let opponentFull = 'TBD';
        let difficulty = 3;
        let isHome = true;

        if (p.opp && Array.isArray(p.opp) && p.opp.length > 0) {
          const oppData = p.opp[0];
          if (Array.isArray(oppData) && oppData.length >= 3) {
            opponent = (oppData[0] || 'TBD').toUpperCase();
            opponentFull = oppData[1] || 'TBD';
            difficulty = oppData[2] || 3;
            isHome = opponentFull.includes('(H)');
          }
        }

        const ffhPoints = p.predicted_pts || 0;
        const predictedPoints = scoringMode === 'v3' ? convertToV3Points(ffhPoints, player.position) : ffhPoints;

        return {
          gw: p.gw,
          opponent,
          opponentFull,
          isHome,
          difficulty,
          predictedMinutes: p.xmins || p.predicted_mins || 90,
          predictedPoints
        };
      });

    return {
      next5: allFixtures.slice(0, 5),
      remaining: allFixtures
    };
  };

  const player1Fixtures = getPlayerFixtures(selectedPlayer1);
  const player2Fixtures = getPlayerFixtures(selectedPlayer2);

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

            {/* My Players dropdown */}
            {!selectedPlayer1 && myPlayers.length > 0 && (
              <div className="mt-3">
                <label className="block text-sm text-gray-400 mb-1">Or select from your team:</label>
                <select
                  onChange={(e) => {
                    const player = myPlayers.find(p => p.player_id === e.target.value);
                    if (player) selectPlayer1(player);
                  }}
                  value=""
                  className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                >
                  <option value="">-- Choose a player --</option>
                  {myPlayers.map(player => (
                    <option key={player.player_id} value={player.player_id}>
                      {player.name || player.full_name} • {player.position} • {player.team_abbr || player.team}
                    </option>
                  ))}
                </select>
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

            {/* My Players dropdown */}
            {!selectedPlayer2 && myPlayers.length > 0 && (
              <div className="mt-3">
                <label className="block text-sm text-gray-400 mb-1">Or select from your team:</label>
                <select
                  onChange={(e) => {
                    const player = myPlayers.find(p => p.player_id === e.target.value);
                    if (player) selectPlayer2(player);
                  }}
                  value=""
                  className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                >
                  <option value="">-- Choose a player --</option>
                  {myPlayers.map(player => (
                    <option key={player.player_id} value={player.player_id}>
                      {player.name || player.full_name} • {player.position} • {player.team_abbr || player.team}
                    </option>
                  ))}
                </select>
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

            {/* Next 5 Gameweeks Bar Charts - Side by Side */}
            {player1Fixtures.next5.length > 0 && player2Fixtures.next5.length > 0 && (
              <div className="mt-6 grid grid-cols-2 gap-6">
                {/* Player 1 Chart */}
                <div className="bg-gray-700 rounded-lg p-4">
                  <h4 className="text-white font-semibold mb-3">Next 5 Gameweeks</h4>
                  <div className="relative h-48">
                    {/* Y-axis labels */}
                    <div className="absolute left-0 top-0 bottom-12 w-8 flex flex-col justify-between text-xs text-gray-400">
                      {(() => {
                        const maxPoints = Math.max(...player1Fixtures.next5.map(f => f.predictedPoints), 1);
                        const roundedMax = Math.ceil(maxPoints);
                        return [roundedMax, Math.round(roundedMax * 0.5), 0].map((val, i) => (
                          <div key={i} className="text-right">{val}</div>
                        ));
                      })()}
                    </div>

                    {/* Chart area */}
                    <div className="absolute left-10 right-0 top-0 bottom-12">
                      {/* Grid lines */}
                      <div className="absolute inset-0 flex flex-col justify-between">
                        <div className="border-t border-gray-600"></div>
                        <div className="border-t border-gray-600"></div>
                        <div className="border-t border-gray-600"></div>
                      </div>

                      {/* Bar chart */}
                      <div className="absolute inset-0 flex items-end justify-between gap-2">
                        {(() => {
                          const maxPoints = Math.max(...player1Fixtures.next5.map(f => f.predictedPoints), 1);
                          return player1Fixtures.next5.map((fixture) => {
                            const heightPercent = (fixture.predictedPoints / maxPoints) * 100;

                            return (
                              <div key={fixture.gw} className="flex-1 flex flex-col items-center justify-end group relative h-full">
                                {/* Points label above bar */}
                                <div className="text-xs font-bold text-white mb-1 absolute" style={{ bottom: `${heightPercent}%` }}>
                                  {fixture.predictedPoints.toFixed(1)}
                                </div>

                                {/* Bar */}
                                <div
                                  className="w-1/2 bg-blue-500 rounded-t transition-all hover:opacity-80 relative"
                                  style={{ height: `${heightPercent}%`, minHeight: '2px' }}
                                />
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </div>

                    {/* X-axis labels */}
                    <div className="absolute left-10 right-0 bottom-0 h-12 flex items-start justify-between gap-2">
                      {player1Fixtures.next5.map((fixture) => (
                        <div key={fixture.gw} className="flex-1 flex flex-col items-center text-center">
                          <div className="text-xs font-medium text-gray-300">GW{fixture.gw}</div>
                          <div className="text-xs text-gray-500">{fixture.isHome ? 'vs' : '@'} {fixture.opponent}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Player 2 Chart */}
                <div className="bg-gray-700 rounded-lg p-4">
                  <h4 className="text-white font-semibold mb-3">Next 5 Gameweeks</h4>
                  <div className="relative h-48">
                    {/* Y-axis labels */}
                    <div className="absolute left-0 top-0 bottom-12 w-8 flex flex-col justify-between text-xs text-gray-400">
                      {(() => {
                        const maxPoints = Math.max(...player2Fixtures.next5.map(f => f.predictedPoints), 1);
                        const roundedMax = Math.ceil(maxPoints);
                        return [roundedMax, Math.round(roundedMax * 0.5), 0].map((val, i) => (
                          <div key={i} className="text-right">{val}</div>
                        ));
                      })()}
                    </div>

                    {/* Chart area */}
                    <div className="absolute left-10 right-0 top-0 bottom-12">
                      {/* Grid lines */}
                      <div className="absolute inset-0 flex flex-col justify-between">
                        <div className="border-t border-gray-600"></div>
                        <div className="border-t border-gray-600"></div>
                        <div className="border-t border-gray-600"></div>
                      </div>

                      {/* Bar chart */}
                      <div className="absolute inset-0 flex items-end justify-between gap-2">
                        {(() => {
                          const maxPoints = Math.max(...player2Fixtures.next5.map(f => f.predictedPoints), 1);
                          return player2Fixtures.next5.map((fixture) => {
                            const heightPercent = (fixture.predictedPoints / maxPoints) * 100;

                            return (
                              <div key={fixture.gw} className="flex-1 flex flex-col items-center justify-end group relative h-full">
                                {/* Points label above bar */}
                                <div className="text-xs font-bold text-white mb-1 absolute" style={{ bottom: `${heightPercent}%` }}>
                                  {fixture.predictedPoints.toFixed(1)}
                                </div>

                                {/* Bar */}
                                <div
                                  className="w-1/2 bg-green-500 rounded-t transition-all hover:opacity-80 relative"
                                  style={{ height: `${heightPercent}%`, minHeight: '2px' }}
                                />
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </div>

                    {/* X-axis labels */}
                    <div className="absolute left-10 right-0 bottom-0 h-12 flex items-start justify-between gap-2">
                      {player2Fixtures.next5.map((fixture) => (
                        <div key={fixture.gw} className="flex-1 flex flex-col items-center text-center">
                          <div className="text-xs font-medium text-gray-300">GW{fixture.gw}</div>
                          <div className="text-xs text-gray-500">{fixture.isHome ? 'vs' : '@'} {fixture.opponent}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Rest of Season Fixtures Tables - Side by Side */}
            {player1Fixtures.remaining.length > 0 && player2Fixtures.remaining.length > 0 && (
              <div className="mt-6 grid grid-cols-2 gap-6">
                {/* Player 1 Fixtures */}
                <div className="bg-gray-700 rounded-lg p-4">
                  <h4 className="text-white font-semibold mb-3">
                    Rest of Season ({player1Fixtures.remaining.length} fixtures)
                  </h4>
                  <div className="overflow-y-auto max-h-96">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-gray-700">
                        <tr className="border-b border-gray-600">
                          <th className="text-left py-2 px-2 text-gray-400 font-medium">GW</th>
                          <th className="text-left py-2 px-2 text-gray-400 font-medium">Opp</th>
                          <th className="text-center py-2 px-2 text-gray-400 font-medium">Diff</th>
                          <th className="text-right py-2 px-2 text-gray-400 font-medium">Pts</th>
                        </tr>
                      </thead>
                      <tbody>
                        {player1Fixtures.remaining.map((fixture) => (
                          <tr key={fixture.gw} className="border-b border-gray-600 hover:bg-gray-600">
                            <td className="py-2 px-2 text-white font-medium">{fixture.gw}</td>
                            <td className="py-2 px-2 text-white">
                              {fixture.isHome ? 'vs ' : '@ '}{fixture.opponent}
                            </td>
                            <td className="py-2 px-2 text-center">
                              <span className={`inline-block w-6 h-6 ${getDifficultyColor(fixture.difficulty)} rounded text-white text-xs font-bold flex items-center justify-center`}>
                                {fixture.difficulty}
                              </span>
                            </td>
                            <td className="py-2 px-2 text-right text-white font-bold">
                              {fixture.predictedPoints.toFixed(1)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Player 2 Fixtures */}
                <div className="bg-gray-700 rounded-lg p-4">
                  <h4 className="text-white font-semibold mb-3">
                    Rest of Season ({player2Fixtures.remaining.length} fixtures)
                  </h4>
                  <div className="overflow-y-auto max-h-96">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-gray-700">
                        <tr className="border-b border-gray-600">
                          <th className="text-left py-2 px-2 text-gray-400 font-medium">GW</th>
                          <th className="text-left py-2 px-2 text-gray-400 font-medium">Opp</th>
                          <th className="text-center py-2 px-2 text-gray-400 font-medium">Diff</th>
                          <th className="text-right py-2 px-2 text-gray-400 font-medium">Pts</th>
                        </tr>
                      </thead>
                      <tbody>
                        {player2Fixtures.remaining.map((fixture) => (
                          <tr key={fixture.gw} className="border-b border-gray-600 hover:bg-gray-600">
                            <td className="py-2 px-2 text-white font-medium">{fixture.gw}</td>
                            <td className="py-2 px-2 text-white">
                              {fixture.isHome ? 'vs ' : '@ '}{fixture.opponent}
                            </td>
                            <td className="py-2 px-2 text-center">
                              <span className={`inline-block w-6 h-6 ${getDifficultyColor(fixture.difficulty)} rounded text-white text-xs font-bold flex items-center justify-center`}>
                                {fixture.difficulty}
                              </span>
                            </td>
                            <td className="py-2 px-2 text-right text-white font-bold">
                              {fixture.predictedPoints.toFixed(1)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

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

ComparisonTabContent.propTypes = {
  players: PropTypes.arrayOf(PropTypes.object),
  currentGameweek: PropTypes.shape({
    number: PropTypes.number.isRequired
  }),
  scoringMode: PropTypes.oneOf(['ffh', 'v3']),
  onPlayerClick: PropTypes.func,
  preSelectedPlayer1: PropTypes.object,
  onClearPreSelection: PropTypes.func
};

ComparisonTabContent.defaultProps = {
  players: [],
  scoringMode: 'ffh',
  currentGameweek: { number: 1 },
  onPlayerClick: () => {},
  preSelectedPlayer1: null,
  onClearPreSelection: null
};

export default ComparisonTabContent;