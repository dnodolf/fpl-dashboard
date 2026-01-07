/**
 * V4 Scoring Service
 *
 * Main orchestrator for V4 ensemble predictions
 * Combines Statistical + ML + Consensus models
 *
 * Usage:
 *   import { enhanceWithV4Scoring } from '@/app/services/v4ScoringService';
 *   const enhanced = await enhanceWithV4Scoring(players);
 */

import { trainMLModel, getMLModel } from './v4/mlModel.js';
import { enhancePlayersWithV4 } from './v4/ensembleCombiner.js';

// Training data cache
let trainingDataLoaded = false;
let modelTrained = false;

/**
 * Initialize V4 models
 * Loads training data and trains ML model
 * Call this once at application startup
 */
export async function initializeV4Models() {
  if (modelTrained) {
    console.log('[V4 Service] Models already initialized');
    return true;
  }

  try {
    console.log('[V4 Service] Initializing V4 models...');

    // Load training data
    const trainingData = await loadTrainingData();

    if (!trainingData || trainingData.length === 0) {
      console.warn('[V4 Service] No training data available - using untrained models');
      return false;
    }

    // Train ML model
    console.log(`[V4 Service] Training ML model on ${trainingData.length} samples...`);
    await trainMLModel(trainingData);

    trainingDataLoaded = true;
    modelTrained = true;

    console.log('[V4 Service] ✅ V4 models initialized successfully');
    return true;

  } catch (error) {
    console.error('[V4 Service] Failed to initialize models:', error);
    return false;
  }
}

/**
 * Load training data from JSON file
 * Returns array of training records
 */
async function loadTrainingData() {
  try {
    // In Next.js, we need to load this dynamically
    // Try to load from the data directory
    const fs = await import('fs');
    const path = await import('path');

    const trainingPath = path.join(process.cwd(), 'app', 'data', 'v4_training_data.json');

    if (!fs.existsSync(trainingPath)) {
      console.warn('[V4 Service] Training data file not found:', trainingPath);
      return [];
    }

    const data = JSON.parse(fs.readFileSync(trainingPath, 'utf-8'));
    return data.records || [];

  } catch (error) {
    console.error('[V4 Service] Error loading training data:', error);
    return [];
  }
}

/**
 * Enhance players with V4 predictions
 * Main entry point for getting V4 scores
 *
 * @param {Array} players - Array of player objects with FFH and V3 predictions
 * @param {Object} options - Optional configuration
 * @returns {Array} Players enhanced with v4_* fields
 */
export async function enhanceWithV4Scoring(players, options = {}) {
  try {
    // Ensure models are initialized
    if (!modelTrained && !options.skipTraining) {
      await initializeV4Models();
    }

    // Build context map for each player
    const contextMap = buildContextMap(players, options);

    // Enhance players with V4 predictions (calls ensemble combiner)
    const enhanced = enhancePlayersWithV4(players, contextMap);

    console.log(`[V4 Service] Enhanced ${enhanced.length} players with V4 predictions`);

    return enhanced;

  } catch (error) {
    console.error('[V4 Service] Error enhancing players:', error);
    // Return players unchanged if V4 fails
    return players;
  }
}

/**
 * Build context map for players
 * Context includes fixtures, form, team strength, etc.
 */
function buildContextMap(players, options = {}) {
  const contextMap = {};

  for (const player of players) {
    const playerId = player.player_id || player.id;

    contextMap[playerId] = {
      // Fixture context
      opponent: player.opponent || options.opponent,
      fixtureDifficulty: player.fixture_difficulty || options.fixtureDifficulty,

      // Form context
      recentForm: {
        last3Avg: player.form_last_3 || calculateRecentForm(player, 3),
        last5Avg: player.form_last_5 || calculateRecentForm(player, 5),
        seasonAvg: player.season_prediction_avg || player.v3_season_avg || 0
      },

      // Availability
      injured: player.injured || player.chance_of_playing_this_round < 75,
      suspended: player.suspended || false,
      in_squad: player.in_squad !== false,

      // Team strength (if available)
      team: player.team,
      teamStrength: options.teamStrengthMap?.[player.team],

      // Gameweek context
      currentGameweek: options.currentGameweek,
      remainingGameweeks: options.remainingGameweeks || 38 - (options.currentGameweek || 0)
    };
  }

  return contextMap;
}

/**
 * Calculate recent form from historical data
 * Placeholder - would use actual historical data in production
 */
function calculateRecentForm(player, numGames = 3) {
  // TODO: Implement actual historical lookup
  // For now, use season average as proxy
  return player.season_prediction_avg || player.v3_season_avg || 0;
}

/**
 * Get V4 prediction for a single player
 * Useful for on-demand calculations
 */
export async function getV4Prediction(player, context = {}) {
  if (!modelTrained) {
    await initializeV4Models();
  }

  const players = [player];
  const contextMap = { [player.player_id || player.id]: context };

  const enhanced = enhancePlayersWithV4(players, contextMap);
  return enhanced[0];
}

/**
 * Get V4 scoring mode helper
 * Returns the correct field names for V4 mode
 */
export function getV4ScoringFields() {
  return {
    seasonTotal: 'v4_season_total',
    seasonAvg: 'v4_season_avg',
    currentGW: 'v4_current_gw',
    confidence: 'v4_confidence'
  };
}

/**
 * Check if V4 models are ready
 */
export function isV4Ready() {
  return modelTrained;
}

/**
 * Get V4 model status for debugging
 */
export function getV4Status() {
  return {
    trainingDataLoaded,
    modelTrained,
    mlModel: getMLModel()?.trained || false
  };
}

/**
 * Reset V4 models (for testing)
 */
export function resetV4Models() {
  trainingDataLoaded = false;
  modelTrained = false;
  console.log('[V4 Service] Models reset');
}

// Export for backward compatibility
export default {
  initializeV4Models,
  enhanceWithV4Scoring,
  getV4Prediction,
  getV4ScoringFields,
  isV4Ready,
  getV4Status,
  resetV4Models
};
