'use client';

import { useState, useMemo } from 'react';
import PropTypes from 'prop-types';

/**
 * Transfer Pair Recommendations Component
 *
 * Suggests "Drop X, Add Y" transfer pairs with net gain calculations
 * Ranks your weakest performers against best available replacements
 */
export default function TransferPairRecommendations({
  myPlayers,
  availablePlayers,
  scoringMode,
  currentGameweek,
  nextNGameweeks = 5
}) {
  const [selectedPosition, setSelectedPosition] = useState('ALL');
  const [minGain, setMinGain] = useState(5); // Minimum points gain to show
  const [sortMode, setSortMode] = useState('confidence'); // 'confidence', 'next1', 'next3', 'next5', 'season'

  // V3 Conversion ratios (same as v3ScoringService.js)
  const V3_CONVERSION_RATIOS = {
    GKP: 0.90,
    DEF: 1.15,
    MID: 1.05,
    FWD: 0.97
  };

  /**
   * Calculate transfer pairs with net gain
   */
  const transferPairs = useMemo(() => {
    if (!myPlayers?.length || !availablePlayers?.length) return [];

    const pairs = [];
    const positions = selectedPosition === 'ALL'
      ? ['GKP', 'DEF', 'MID', 'FWD']
      : [selectedPosition];

    positions.forEach(position => {
      // Get my players in this position
      const myPositionPlayers = myPlayers.filter(p => p.position === position);

      // Get available players in this position
      const availablePositionPlayers = availablePlayers.filter(p => p.position === position);

      // For each of my players, find better replacements
      myPositionPlayers.forEach(dropPlayer => {
        const dropScore = getPlayerScore(dropPlayer, scoringMode);

        availablePositionPlayers.forEach(addPlayer => {
          const addScore = getPlayerScore(addPlayer, scoringMode);
          const netGain = addScore - dropScore;

          // Calculate short-term gains
          const nextGW = currentGameweek + 1;
          const next1Drop = getGameweekRangeScore(dropPlayer, scoringMode, nextGW, nextGW);
          const next1Add = getGameweekRangeScore(addPlayer, scoringMode, nextGW, nextGW);
          const next1Gain = next1Add - next1Drop;

          const next3Drop = getGameweekRangeScore(dropPlayer, scoringMode, nextGW, nextGW + 2);
          const next3Add = getGameweekRangeScore(addPlayer, scoringMode, nextGW, nextGW + 2);
          const next3Gain = next3Add - next3Drop;

          const next5Drop = getGameweekRangeScore(dropPlayer, scoringMode, nextGW, nextGW + 4);
          const next5Add = getGameweekRangeScore(addPlayer, scoringMode, nextGW, nextGW + 4);
          const next5Gain = next5Add - next5Drop;

          // Confidence-weighted score (next GW 100%, next 3 GW 80%, ROS 50%)
          const confidenceScore = (next1Gain * 1.0) + (next3Gain * 0.8) + (netGain * 0.5);

          // Calculate transfer recommendation rating (0-100%)
          // Based on: positive gains across all timeframes = good
          const maxPossibleScore = Math.max(
            Math.abs(next1Gain),
            Math.abs(next3Gain / 3),
            Math.abs(next5Gain / 5),
            Math.abs(netGain / 38)
          ) * 3; // Multiply by 3 to get rough max score

          const actualScore = (next1Gain * 1.0) + (next3Gain / 3 * 0.8) + (netGain / 38 * 0.5);
          const transferRating = maxPossibleScore > 0
            ? Math.min(100, Math.max(0, (actualScore / maxPossibleScore) * 100))
            : 50;

          // Only include if net gain meets minimum threshold
          if (netGain >= minGain) {
            pairs.push({
              drop: dropPlayer,
              add: addPlayer,
              dropScore,
              addScore,
              netGain,
              next1Gain,
              next3Gain,
              next5Gain,
              confidenceScore,
              transferRating,
              position,
              // Additional context
              dropForm: getFormIndicator(dropPlayer, scoringMode),
              addForm: getFormIndicator(addPlayer, scoringMode),
              dropFixtures: getFixtureDifficulty(dropPlayer, currentGameweek, nextNGameweeks),
              addFixtures: getFixtureDifficulty(addPlayer, currentGameweek, nextNGameweeks)
            });
          }
        });
      });
    });

    // Sort by selected mode
    return pairs.sort((a, b) => {
      switch (sortMode) {
        case 'next1':
          return b.next1Gain - a.next1Gain;
        case 'next3':
          return b.next3Gain - a.next3Gain;
        case 'next5':
          return b.next5Gain - a.next5Gain;
        case 'season':
          return b.netGain - a.netGain;
        case 'confidence':
        default:
          return b.confidenceScore - a.confidenceScore;
      }
    });
  }, [myPlayers, availablePlayers, scoringMode, selectedPosition, minGain, currentGameweek, nextNGameweeks, sortMode]);

  /**
   * Get player score based on scoring mode (using season total)
   */
  function getPlayerScore(player, mode) {
    if (!player) return 0;

    if (mode === 'v3') {
      return player.v3_season_total || 0;
    } else {
      return player.predicted_points || player.season_prediction || 0;
    }
  }

  /**
   * Get player score for specific gameweek range
   */
  function getGameweekRangeScore(player, mode, startGW, endGW) {
    if (!player?.predictions?.length) return 0;

    const v3Ratio = mode === 'v3' ? (V3_CONVERSION_RATIOS[player.position] || 1.0) : 1.0;
    let total = 0;

    for (let gw = startGW; gw <= endGW && gw <= 38; gw++) {
      const prediction = player.predictions.find(p => p.gw === gw);
      if (prediction) {
        const pts = prediction.predicted_pts || 0;
        total += mode === 'v3' ? (pts * v3Ratio) : pts;
      }
    }

    return total;
  }

  /**
   * Get form indicator (📈📉➡️)
   */
  function getFormIndicator(player, mode) {
    if (!player) return '➡️';

    const currentGW = mode === 'v3'
      ? (player.v3_current_gw || 0)
      : (player.current_gw_prediction || 0);

    const seasonAvg = mode === 'v3'
      ? (player.v3_season_avg || 0)
      : (player.season_prediction_avg || 0);

    if (currentGW > seasonAvg * 1.1) return '📈';
    if (currentGW < seasonAvg * 0.9) return '📉';
    return '➡️';
  }

  /**
   * Get average fixture difficulty for next N gameweeks
   * Uses predicted points vs season average to estimate difficulty
   */
  function getFixtureDifficulty(player, currentGW, nextN) {
    if (!player?.predictions?.length) return 3; // Default to medium

    const seasonAvg = player.season_prediction_avg || 0;
    if (seasonAvg === 0) return 3;

    let totalDifficulty = 0;
    let count = 0;

    for (let gw = currentGW; gw < currentGW + nextN && gw <= 38; gw++) {
      const prediction = player.predictions.find(p => p.gw === gw);
      if (prediction) {
        const expectedVsAverage = prediction.predicted_pts / seasonAvg;
        let difficulty = 3; // Default medium

        if (expectedVsAverage < 0.7) difficulty = 5; // Very hard
        else if (expectedVsAverage < 0.85) difficulty = 4; // Hard
        else if (expectedVsAverage > 1.3) difficulty = 1; // Easy
        else if (expectedVsAverage > 1.15) difficulty = 2; // Good
        else difficulty = 3; // Average

        totalDifficulty += difficulty;
        count++;
      }
    }

    if (count === 0) return 3;
    return Math.round((totalDifficulty / count) * 10) / 10; // Round to 1 decimal
  }

  /**
   * Get difficulty color
   */
  function getDifficultyColor(difficulty) {
    if (difficulty <= 2) return 'bg-green-600';
    if (difficulty === 3) return 'bg-yellow-600';
    if (difficulty === 4) return 'bg-orange-600';
    return 'bg-red-600';
  }

  /**
   * Get transfer recommendation badge
   */
  function getTransferRecommendation(rating) {
    if (rating >= 80) {
      return {
        label: 'Strong Buy',
        color: 'bg-green-600',
        icon: '🔥',
        percentage: rating.toFixed(0) + '%'
      };
    } else if (rating >= 60) {
      return {
        label: 'Good',
        color: 'bg-green-500',
        icon: '✓',
        percentage: rating.toFixed(0) + '%'
      };
    } else if (rating >= 40) {
      return {
        label: 'Consider',
        color: 'bg-yellow-500',
        icon: '~',
        percentage: rating.toFixed(0) + '%'
      };
    } else if (rating >= 20) {
      return {
        label: 'Weak',
        color: 'bg-orange-500',
        icon: '⚠',
        percentage: rating.toFixed(0) + '%'
      };
    } else {
      return {
        label: 'Avoid',
        color: 'bg-red-500',
        icon: '✗',
        percentage: rating.toFixed(0) + '%'
      };
    }
  }

  /**
   * Get position color
   */
  function getPositionColor(position) {
    const colors = {
      'GKP': 'bg-yellow-600',
      'DEF': 'bg-green-600',
      'MID': 'bg-blue-600',
      'FWD': 'bg-red-600'
    };
    return colors[position] || 'bg-gray-600';
  }

  // Top 10 recommendations
  const topRecommendations = transferPairs.slice(0, 10);

  return (
    <div className="bg-gray-800 rounded-lg p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-white">Transfer Recommendations</h2>
          <p className="text-sm text-gray-400 mt-1">
            Smart transfer suggestions with confidence ratings based on short & long-term gains
          </p>
        </div>

        {/* Filters */}
        <div className="flex gap-3">
          {/* Sort Mode */}
          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value)}
            className="px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="confidence">⭐ Smart (Weighted)</option>
            <option value="next1">Next GW</option>
            <option value="next3">Next 3 GW</option>
            <option value="next5">Next 5 GW</option>
            <option value="season">Season Total</option>
          </select>

          {/* Position Filter */}
          <select
            value={selectedPosition}
            onChange={(e) => setSelectedPosition(e.target.value)}
            className="px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">All Positions</option>
            <option value="GKP">GKP Only</option>
            <option value="DEF">DEF Only</option>
            <option value="MID">MID Only</option>
            <option value="FWD">FWD Only</option>
          </select>

          {/* Min Gain Filter */}
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-400">Min Gain:</label>
            <input
              type="number"
              value={minGain}
              onChange={(e) => setMinGain(Number(e.target.value))}
              min="0"
              step="5"
              className="w-20 px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-400">pts</span>
          </div>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-700 rounded-lg p-4">
          <div className="text-sm text-gray-400">Total Opportunities</div>
          <div className="text-2xl font-bold text-white">{transferPairs.length}</div>
        </div>
        <div className="bg-gray-700 rounded-lg p-4">
          <div className="text-sm text-gray-400">Best Gain Available</div>
          <div className="text-2xl font-bold text-green-400">
            +{transferPairs[0]?.netGain?.toFixed(1) || 0} pts
          </div>
        </div>
        <div className="bg-gray-700 rounded-lg p-4">
          <div className="text-sm text-gray-400">Avg Top 5 Gain</div>
          <div className="text-2xl font-bold text-blue-400">
            +{(transferPairs.slice(0, 5).reduce((sum, p) => sum + p.netGain, 0) / Math.min(5, transferPairs.length) || 0).toFixed(1)} pts
          </div>
        </div>
      </div>

      {/* Transfer Pairs Table */}
      {topRecommendations.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          No transfer recommendations found with min gain of {minGain} pts
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider pb-3 pr-4">
                  Rank
                </th>
                <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider pb-3 pr-4">
                  Drop Player
                </th>
                <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider pb-3 pr-4">
                  Add Player
                </th>
                <th className="text-center text-xs font-semibold text-gray-400 uppercase tracking-wider pb-3 pr-4">
                  Rating
                </th>
                <th className="text-right text-xs font-semibold text-gray-400 uppercase tracking-wider pb-3 pr-4">
                  Next GW
                </th>
                <th className="text-right text-xs font-semibold text-gray-400 uppercase tracking-wider pb-3 pr-4">
                  Next 3
                </th>
                <th className="text-right text-xs font-semibold text-gray-400 uppercase tracking-wider pb-3 pr-4">
                  Next 5
                </th>
                <th className="text-right text-xs font-semibold text-gray-400 uppercase tracking-wider pb-3 pr-4">
                  Season
                </th>
                <th className="text-center text-xs font-semibold text-gray-400 uppercase tracking-wider pb-3 px-4">
                  Fixtures
                </th>
              </tr>
            </thead>
            <tbody>
              {topRecommendations.map((pair, index) => (
                <tr key={index} className="border-b border-gray-700 hover:bg-gray-750 transition-colors">
                  {/* Rank */}
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${
                        index === 0 ? 'bg-yellow-600 text-white' :
                        index === 1 ? 'bg-gray-400 text-white' :
                        index === 2 ? 'bg-orange-600 text-white' :
                        'bg-gray-600 text-white'
                      }`}>
                        {index + 1}
                      </span>
                    </div>
                  </td>

                  {/* Drop Player */}
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded text-xs font-bold text-white ${getPositionColor(pair.position)}`}>
                        {pair.position}
                      </span>
                      <div>
                        <div className="font-semibold text-white">{pair.drop.name}</div>
                        <div className="text-xs text-gray-400">{pair.drop.team} {pair.dropForm}</div>
                      </div>
                    </div>
                  </td>

                  {/* Add Player */}
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2">
                      <div>
                        <div className="font-semibold text-white">{pair.add.name}</div>
                        <div className="text-xs text-gray-400">{pair.add.team} {pair.addForm}</div>
                      </div>
                    </div>
                  </td>

                  {/* Transfer Rating */}
                  <td className="py-3 pr-4">
                    {(() => {
                      const rec = getTransferRecommendation(pair.transferRating);
                      return (
                        <div className="flex flex-col items-center gap-1">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold text-white ${rec.color}`}>
                            {rec.icon} {rec.label}
                          </span>
                          <span className="text-xs text-gray-400">{rec.percentage}</span>
                        </div>
                      );
                    })()}
                  </td>

                  {/* Next GW Gain */}
                  <td className="py-3 pr-4 text-right">
                    <span className={`font-semibold ${pair.next1Gain >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {pair.next1Gain >= 0 ? '+' : ''}{pair.next1Gain.toFixed(1)}
                    </span>
                  </td>

                  {/* Next 3 GW Gain */}
                  <td className="py-3 pr-4 text-right">
                    <span className={`font-semibold ${pair.next3Gain >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {pair.next3Gain >= 0 ? '+' : ''}{pair.next3Gain.toFixed(1)}
                    </span>
                  </td>

                  {/* Next 5 GW Gain */}
                  <td className="py-3 pr-4 text-right">
                    <span className={`font-semibold ${pair.next5Gain >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {pair.next5Gain >= 0 ? '+' : ''}{pair.next5Gain.toFixed(1)}
                    </span>
                  </td>

                  {/* Season Net Gain */}
                  <td className="py-3 pr-4 text-right">
                    <span className={`font-semibold ${pair.netGain >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {pair.netGain >= 0 ? '+' : ''}{pair.netGain.toFixed(1)}
                    </span>
                  </td>

                  {/* Fixtures */}
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-center gap-2">
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-gray-400">Drop:</span>
                        <span className={`px-2 py-1 rounded text-xs font-bold text-white ${getDifficultyColor(pair.dropFixtures)}`}>
                          {pair.dropFixtures.toFixed(1)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-gray-400">Add:</span>
                        <span className={`px-2 py-1 rounded text-xs font-bold text-white ${getDifficultyColor(pair.addFixtures)}`}>
                          {pair.addFixtures.toFixed(1)}
                        </span>
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Legend */}
      <div className="mt-4 pt-4 border-t border-gray-700 space-y-2 text-xs text-gray-400">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="font-semibold">Rating:</span>
            <span className="px-2 py-0.5 rounded bg-green-600 text-white">🔥 Strong Buy (80%+)</span>
            <span className="px-2 py-0.5 rounded bg-green-500 text-white">✓ Good (60-79%)</span>
            <span className="px-2 py-0.5 rounded bg-yellow-500 text-white">~ Consider (40-59%)</span>
            <span className="px-2 py-0.5 rounded bg-orange-500 text-white">⚠ Weak (20-39%)</span>
            <span className="px-2 py-0.5 rounded bg-red-500 text-white">✗ Avoid (&lt;20%)</span>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="font-semibold">Form:</span>
            <span>📈 Hot</span>
            <span>➡️ Steady</span>
            <span>📉 Cold</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold">Fixtures (avg difficulty):</span>
            <span className="px-2 py-1 rounded bg-green-600 text-white">1-2</span>
            <span className="px-2 py-1 rounded bg-yellow-600 text-white">3</span>
            <span className="px-2 py-1 rounded bg-orange-600 text-white">4</span>
            <span className="px-2 py-1 rounded bg-red-600 text-white">5</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-semibold">⭐ Smart Sort:</span>
          <span>Weights next GW (100%) + next 3 GW (80%) + season (50%) for balanced short & long term value</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-semibold">Rating Calculation:</span>
          <span>Considers consistency across all timeframes - positive gains in short, medium, and long term = higher rating</span>
        </div>
      </div>
    </div>
  );
}

TransferPairRecommendations.propTypes = {
  myPlayers: PropTypes.array.isRequired,
  availablePlayers: PropTypes.array.isRequired,
  scoringMode: PropTypes.string.isRequired,
  currentGameweek: PropTypes.number.isRequired,
  nextNGameweeks: PropTypes.number
};
