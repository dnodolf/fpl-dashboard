/**
 * V3 Sleeper Scoring - Conversion Ratios
 * Single source of truth for FPL to Sleeper position-based conversion multipliers
 */

/**
 * Position-based FPL to Sleeper conversion ratios
 * These ratios convert Fantasy Premier League predicted points to Sleeper custom league scoring
 */
export const V3_CONVERSION_RATIOS = {
  GKP: 0.90,  // GKP: Subtract appearance points, add save bonuses
  DEF: 1.15,  // DEF: Add defensive stat rewards (tackles, interceptions, blocks)
  MID: 1.05,  // MID: Add versatility bonus (goals, assists, defensive actions)
  FWD: 0.97   // FWD: Subtract dispossession penalties
};

/**
 * Get V3 conversion ratio for a player's position
 * @param {string} position - Player position (GKP, DEF, MID, FWD)
 * @returns {number} Conversion ratio (defaults to 1.0 if position unknown)
 */
export function getV3ConversionRatio(position) {
  return V3_CONVERSION_RATIOS[position] || 1.0;
}

/**
 * Convert FFH points to V3 Sleeper points
 * @param {number} ffhPoints - Fantasy Premier League points
 * @param {string} position - Player position
 * @returns {number} V3 Sleeper points
 */
export function convertToV3Points(ffhPoints, position) {
  if (!ffhPoints || ffhPoints <= 0) return 0;
  return ffhPoints * getV3ConversionRatio(position);
}

// Legacy export for backwards compatibility
export const FALLBACK_CONVERSION_RATIOS = V3_CONVERSION_RATIOS;
