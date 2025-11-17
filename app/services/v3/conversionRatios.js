/**
 * V3 Sleeper Scoring - Conversion Ratios
 * FPL to Sleeper position-based conversion multipliers
 */

/**
 * Fallback position-based FPL to Sleeper conversion ratios
 * Used when player archetype cannot be determined
 */
export const FALLBACK_CONVERSION_RATIOS = {
  GKP: 0.90,  // GKP: Subtract appearance points, add save bonuses
  DEF: 1.15,  // DEF: Add defensive stat rewards (tackles, interceptions, blocks)
  MID: 1.05,  // MID: Add versatility bonus (goals, assists, defensive actions)
  FWD: 0.97   // FWD: Subtract dispossession penalties
};
