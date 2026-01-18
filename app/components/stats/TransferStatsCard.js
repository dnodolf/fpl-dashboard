/**
 * TransferStatsCard Component
 * Displays position-specific upgrade opportunities from Transfer Pair Recommendations
 * Uses same logic as TransferPairRecommendations for consistency
 */

import PropTypes from 'prop-types';
import { USER_ID, OWNERSHIP_STATUS } from '../../config/constants';

// V3 Conversion ratios (same as TransferPairRecommendations)
const V3_CONVERSION_RATIOS = {
  GKP: 0.90,
  DEF: 1.15,
  MID: 1.05,
  FWD: 0.97
};

export function TransferStatsCard({ players, scoringMode = 'ffh', gameweekRange }) {
  const myPlayers = players.filter(p => p.owned_by === USER_ID);
  const freeAgents = players.filter(p => !p.owned_by || p.owned_by === OWNERSHIP_STATUS.FREE_AGENT);

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
   * Calculate transfer pairs per position (same logic as TransferPairRecommendations)
   */
  const positions = ['FWD', 'MID', 'DEF', 'GKP'];
  const positionStats = {};

  positions.forEach(position => {
    const myPositionPlayers = myPlayers.filter(p => p.position === position);
    const availablePositionPlayers = freeAgents.filter(p => p.position === position);

    let upgradeCount = 0;
    let bestGain = 0;

    // For each of my players, count better replacements
    myPositionPlayers.forEach(dropPlayer => {
      const dropScore = getPlayerScore(dropPlayer, scoringMode);

      availablePositionPlayers.forEach(addPlayer => {
        const addScore = getPlayerScore(addPlayer, scoringMode);
        const netGain = addScore - dropScore;

        // Count upgrades with minimum 5 point gain (matching TransferPairRecommendations default)
        if (netGain >= 5) {
          upgradeCount++;
          if (netGain > bestGain) {
            bestGain = netGain;
          }
        }
      });
    });

    positionStats[position] = {
      count: upgradeCount,
      bestGain: bestGain
    };
  });

  // Position configurations with emojis and colors
  const positionConfigs = {
    FWD: { emoji: '🎯', color: 'text-purple-400', name: 'FWD' },
    MID: { emoji: '⚽', color: 'text-blue-400', name: 'MID' },
    DEF: { emoji: '🛡️', color: 'text-green-400', name: 'DEF' },
    GKP: { emoji: '🥅', color: 'text-yellow-400', name: 'GKP' }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      {positions.map(position => {
        const config = positionConfigs[position];
        const stats = positionStats[position];

        return (
          <div key={position} className="p-4 rounded-lg shadow-sm bg-gray-800">
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className={`text-2xl font-bold ${config.color}`}>{stats.count}</div>
                <div className="text-sm text-gray-400">{config.name} Upgrades</div>
              </div>
              <div className="text-2xl">{config.emoji}</div>
            </div>
            {stats.bestGain > 0 && (
              <div className="text-xs text-gray-500 mt-1">
                Best: +{stats.bestGain.toFixed(1)} pts
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

TransferStatsCard.propTypes = {
  players: PropTypes.arrayOf(PropTypes.shape({
    position: PropTypes.string,
    owned_by: PropTypes.string,
    predicted_points: PropTypes.number,
    season_prediction: PropTypes.number,
    v3_season_total: PropTypes.number
  })).isRequired,
  scoringMode: PropTypes.oneOf(['ffh', 'v3']),
  gameweekRange: PropTypes.shape({
    start: PropTypes.number,
    end: PropTypes.number
  })
};

TransferStatsCard.defaultProps = {
  scoringMode: 'ffh',
  gameweekRange: null
};
