/**
 * Prediction Utilities
 * Centralized functions for calculating player prediction metrics
 *
 * SCORING RULES (v3.8):
 * - v3_pts is embedded per prediction by v3/core.js (calibrated ratios)
 * - v4_pts is embedded per prediction by v4/core.js (V3 + Sleeper blend)
 * - If v3_pts/v4_pts is missing, fall back to ffhPoints (NOT convertToV3Points)
 */

/**
 * Get the correct points value for a single prediction entry based on scoring mode.
 * Single source of truth — all scoring logic flows through here.
 */
function getPredictionPoints(prediction, scoringMode) {
  const ffhPoints = prediction.predicted_pts || 0;

  if (scoringMode === 'v4') {
    return prediction.v4_pts ?? prediction.v3_pts ?? ffhPoints;
  }
  if (scoringMode === 'v3') {
    return prediction.v3_pts ?? ffhPoints;
  }
  return ffhPoints;
}

/**
 * Calculate total points for next N gameweeks
 * @param {Object} player - Player object with predictions array
 * @param {string} scoringMode - 'ffh', 'v3', or 'v4'
 * @param {number} currentGW - Current gameweek number
 * @param {number} numGameweeks - Number of gameweeks to calculate (default: 5)
 * @returns {number} Total predicted points for next N gameweeks
 */
export function getNextNGameweeksTotal(player, scoringMode, currentGW, numGameweeks = 5) {
  if (!player?.predictions?.length || !currentGW) return 0;

  const targetGameweeks = Array.from({ length: numGameweeks }, (_, i) => currentGW + i);
  let totalPoints = 0;

  targetGameweeks.forEach(gw => {
    const prediction = player.predictions.find(p => p.gw === gw);
    if (prediction) {
      totalPoints += getPredictionPoints(prediction, scoringMode);
    }
  });

  return totalPoints;
}

/**
 * Calculate average minutes for next N gameweeks
 * @param {Object} player - Player object with predictions array
 * @param {number} currentGW - Current gameweek number
 * @param {number} numGameweeks - Number of gameweeks to calculate (default: 5)
 * @returns {number} Average predicted minutes per game
 */
export function getAvgMinutesNextN(player, currentGW, numGameweeks = 5) {
  if (!player?.predictions?.length || !currentGW) return 0;

  const targetGameweeks = Array.from({ length: numGameweeks }, (_, i) => currentGW + i);
  let totalMins = 0;
  let count = 0;

  targetGameweeks.forEach(gw => {
    const prediction = player.predictions.find(p => p.gw === gw);
    if (prediction && prediction.xmins !== undefined) {
      totalMins += prediction.xmins || 0;
      count++;
    }
  });

  return count > 0 ? totalMins / count : 0;
}

/**
 * Get predictions for next N gameweeks with details
 * @param {Object} player - Player object with predictions array
 * @param {string} scoringMode - 'ffh', 'v3', or 'v4'
 * @param {number} currentGW - Current gameweek number
 * @param {number} numGameweeks - Number of gameweeks to get (default: 5)
 * @returns {Array} Array of prediction objects with GW, points, minutes
 */
export function getNextNGameweeksDetails(player, scoringMode, currentGW, numGameweeks = 5) {
  if (!player?.predictions?.length || !currentGW) return [];

  const targetGameweeks = Array.from({ length: numGameweeks }, (_, i) => currentGW + i);
  const details = [];

  targetGameweeks.forEach(gw => {
    const prediction = player.predictions.find(p => p.gw === gw);
    if (prediction) {
      details.push({
        gw,
        points: getPredictionPoints(prediction, scoringMode),
        minutes: prediction.xmins || 0,
        opponent: prediction.opp || null
      });
    }
  });

  return details;
}
