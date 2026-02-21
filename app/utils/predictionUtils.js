/**
 * Prediction Utilities
 * Centralized functions for calculating player prediction metrics
 */

import { convertToV3Points } from '../services/v3/conversionRatios';

/**
 * Calculate total points for next N gameweeks
 * @param {Object} player - Player object with predictions array
 * @param {string} scoringMode - 'ffh' or 'v3'
 * @param {number} currentGW - Current gameweek number
 * @param {number} numGameweeks - Number of gameweeks to calculate (default: 5)
 * @returns {number} Total predicted points for next N gameweeks
 */
export function getNextNGameweeksTotal(player, scoringMode, currentGW, numGameweeks = 5) {
  if (!player?.predictions?.length || !currentGW) return 0;

  // Get predictions for next N gameweeks starting from current GW
  const targetGameweeks = Array.from({ length: numGameweeks }, (_, i) => currentGW + i);
  let totalPoints = 0;

  targetGameweeks.forEach(gw => {
    const prediction = player.predictions.find(p => p.gw === gw);
    if (prediction) {
      const ffhPoints = prediction.predicted_pts || 0;
      const gwPoints = scoringMode === 'v3'
        // Prefer server-computed v3_pts (calibrated); fall back to static ratio
        ? (prediction.v3_pts !== undefined ? prediction.v3_pts : convertToV3Points(ffhPoints, player.position))
        : ffhPoints;
      totalPoints += gwPoints;
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
 * @param {string} scoringMode - 'ffh' or 'v3'
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
      const ffhPoints = prediction.predicted_pts || 0;
      const points = scoringMode === 'v3'
        // Prefer server-computed v3_pts (calibrated); fall back to static ratio
        ? (prediction.v3_pts !== undefined ? prediction.v3_pts : convertToV3Points(ffhPoints, player.position))
        : ffhPoints;

      details.push({
        gw,
        points,
        minutes: prediction.xmins || 0,
        opponent: prediction.opp || null
      });
    }
  });

  return details;
}
