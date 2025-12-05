/**
 * TransferStatsCard Component
 * Displays position-specific upgrade opportunities from free agents
 */

import PropTypes from 'prop-types';
import { USER_ID, OWNERSHIP_STATUS, TOTAL_GAMEWEEKS } from '../../config/constants';

export function TransferStatsCard({ players, scoringMode = 'ffh', gameweekRange }) {
  // Calculate transfer analytics - FIX: Use correct ownership logic
  const freeAgents = players.filter(p => !p.owned_by || p.owned_by === OWNERSHIP_STATUS.FREE_AGENT);
  const myPlayers = players.filter(p => p.owned_by === USER_ID); // YOUR players specifically

  // Helper function to get player points (enhanced to match transfer tab logic with gameweek range support)
  const getPlayerPoints = (player) => {
    // If gameweek range is specified and valid, use gameweek range calculations
    if (gameweekRange && gameweekRange.start && gameweekRange.end) {
      return getGameweekRangePoints(player, gameweekRange.start, gameweekRange.end);
    }

    // Otherwise use season-based points
    if (scoringMode === 'v3') {
      return player.v3_season_avg || player.sleeper_season_avg || player.total_points || 0;
    }
    return player.sleeper_season_avg || player.sleeper_points_ros || player.total_points || 0;
  };

  // Gameweek range points calculation (same logic as TransferTabContent)
  function getGameweekRangePoints(player, startGW, endGW) {
    const gameweekCount = endGW - startGW + 1;

    // Check if player has gameweek-specific predictions
    if (!player.predictions || !Array.isArray(player.predictions) || player.predictions.length === 0) {
      // For players without predictions, use the same data source as Players tab
      let seasonTotal = 0;

      if (scoringMode === 'v3') {
        seasonTotal = player.v3_season_total || player.sleeper_season_total || player.predicted_points || 0;
      } else {
        seasonTotal = player.sleeper_season_total || player.predicted_points || 0;
      }

      if (seasonTotal > 0) {
        // Adjust proportionally for the gameweek range
        return (seasonTotal / TOTAL_GAMEWEEKS) * gameweekCount;
      }

      // Final fallback to PPG if no season total available
      let fallbackPpg = 0;

      if (scoringMode === 'v3') {
        fallbackPpg = player.v3_season_avg || player.v3_current_gw || player.sleeper_season_avg || 0;
      } else {
        fallbackPpg = player.sleeper_season_avg || player.sleeper_points_ros / TOTAL_GAMEWEEKS || player.current_gw_prediction || 0;
      }

      return fallbackPpg * gameweekCount;
    }

    let totalPoints = 0;
    let predictionsFound = 0;

    for (let gw = startGW; gw <= endGW; gw++) {
      const prediction = player.predictions.find(p => p.gw === gw);
      if (prediction) {
        const gwPoints = scoringMode === 'v3'
          ? (prediction.v3_predicted_pts || prediction.predicted_pts || 0)
          : (prediction.predicted_pts || 0);
        totalPoints += gwPoints;
        predictionsFound++;
      }
    }

    // If we have some predictions but not all, extrapolate
    if (predictionsFound > 0 && predictionsFound < gameweekCount) {
      const avgPointsPerGW = totalPoints / predictionsFound;
      const missingGWs = gameweekCount - predictionsFound;
      totalPoints += avgPointsPerGW * missingGWs;
    }

    return totalPoints;
  }

  // Calculate position-specific upgrade counts
  const positions = ['FWD', 'MID', 'DEF', 'GKP'];
  const positionUpgrades = {};

  positions.forEach(position => {
    const myPositionPlayers = myPlayers.filter(p => p.position === position);
    const freeAgentsInPosition = freeAgents.filter(p => p.position === position);

    if (myPositionPlayers.length === 0) {
      positionUpgrades[position] = 0;
      return;
    }

    // Find worst player in my team for this position
    const worstMyPlayer = myPositionPlayers.reduce((worst, current) => {
      const worstPoints = getPlayerPoints(worst);
      const currentPoints = getPlayerPoints(current);
      return currentPoints < worstPoints ? current : worst;
    });

    const worstMyPlayerPoints = getPlayerPoints(worstMyPlayer);

    // Count how many free agents would outperform my worst player in this position
    const upgradeCount = freeAgentsInPosition.filter(fa => {
      const faPoints = getPlayerPoints(fa);
      return faPoints > worstMyPlayerPoints;
    }).length;

    positionUpgrades[position] = upgradeCount;
  });

  // Position configurations with emojis and colors
  const positionConfigs = {
    FWD: { emoji: '🎯', color: 'text-purple-600', bg: 'bg-purple-100', name: 'FWD' },
    MID: { emoji: '⚽', color: 'text-blue-600', bg: 'bg-blue-100', name: 'MID' },
    DEF: { emoji: '🛡️', color: 'text-green-600', bg: 'bg-green-100', name: 'DEF' },
    GKP: { emoji: '🥅', color: 'text-orange-600', bg: 'bg-orange-100', name: 'GKP' }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      {positions.map(position => {
        const config = positionConfigs[position];
        const upgradeCount = positionUpgrades[position];

        return (
          <div key={position} className={`p-4 rounded-lg shadow-sm bg-gray-800`}>
            <div className="flex items-center justify-between">
              <div>
                <div className={`text-2xl font-bold ${config.color}`}>{upgradeCount}</div>
                <div className={`text-sm text-gray-400`}>{config.name} Upgrades</div>
              </div>
              <div className="text-2xl">{config.emoji}</div>
            </div>
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
    predictions: PropTypes.array,
    v3_season_avg: PropTypes.number,
    v3_season_total: PropTypes.number,
    sleeper_season_avg: PropTypes.number,
    sleeper_season_total: PropTypes.number,
    total_points: PropTypes.number
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
