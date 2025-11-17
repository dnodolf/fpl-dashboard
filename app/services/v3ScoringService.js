/**
 * V3 Sleeper Scoring Service - Backward Compatibility Wrapper
 *
 * This file maintains backward compatibility by re-exporting from the modular v3/ directory.
 * All logic has been split into focused modules for better maintainability:
 *
 * - v3/conversionRatios.js - Position-based conversion constants
 * - v3/adjustments.js - Form, fixture, injury, and playing time adjustments
 * - v3/matchup.js - Matchup analysis and start/sit recommendations
 * - v3/core.js - Main scoring calculation functions
 */

// Re-export everything from the core module
export {
  calculateV3Prediction,
  applyV3Scoring,
  getScoringValue,
  default
} from './v3/core.js';

// Re-export constants for external use
export { FALLBACK_CONVERSION_RATIOS } from './v3/conversionRatios.js';

// Re-export adjustment functions if needed externally
export {
  applyPlayingTimeAdjustment,
  calculateFormMomentum,
  calculateFixtureRunQuality,
  calculateInjuryReturnAdjustment
} from './v3/adjustments.js';

// Re-export matchup functions if needed externally
export {
  extractCurrentGameweekMatchup,
  calculateStartRecommendation,
  calculateSingleGameweekMatchup
} from './v3/matchup.js';
