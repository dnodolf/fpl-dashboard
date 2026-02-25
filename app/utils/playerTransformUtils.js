/**
 * Player Transformation Utilities
 * Shared utilities for transforming player data for client consumption
 */

import { normalizePosition } from '../../utils/positionUtils.js';

/**
 * Transform player object for client consumption
 * Handles field normalization, position standardization, and V3 scoring preservation
 *
 * @param {Object} player - Raw player object from API
 * @param {Object} optimizerService - Optional optimizer service for calculating points/minutes
 * @returns {Object} Transformed player object
 */
export function transformPlayerForClient(player, optimizerService = null) {
  const transformed = {
    // Core identifiers
    id: player.sleeper_id || player.id || player.player_id,
    player_id: player.sleeper_id || player.id || player.player_id,
    sleeper_id: player.sleeper_id || player.id || player.player_id,

    // Name fields
    name: player.name || player.web_name || 'Unknown Player',
    web_name: player.web_name || player.name || 'Unknown Player',
    full_name: player.full_name || player.name || player.web_name || 'Unknown Player',

    // Position (use unified position logic)
    position: normalizePosition(player),

    // Team fields
    team: player.team || player.team_abbr || 'Unknown',
    team_abbr: player.team_abbr || player.team || 'Unknown',

    // V3 Sleeper scoring fields (preserve if they exist)
    v3_current_gw: player.v3_current_gw || null,
    v3_season_avg: player.v3_season_avg || null,
    v3_season_total: player.v3_season_total || null,

    // FFH prediction fields
    current_gw_prediction: player.current_gw_prediction || null,
    sleeper_season_avg: player.sleeper_season_avg || null,

    // Predictions array (needed for opponent/fixture display)
    predictions: player.predictions || null,

    // Minutes predictions
    predicted_mins: player.predicted_mins || null,
    current_gameweek_prediction: player.current_gameweek_prediction || null,

    // Availability and injury status
    fpl_status: player.fpl_status || null,
    fpl_news: player.fpl_news || null,
    chance_next_round: player.chance_next_round ?? player.chance_of_playing_next_round ?? null
  };

  // Add calculated points if optimizer service provided
  if (optimizerService) {
    transformed.points = optimizerService.getPlayerPoints(player);
    transformed.predicted_pts = optimizerService.getPlayerPoints(player);
    transformed.minutes = optimizerService.getPlayerMinutes(player) || 90;
  } else {
    // Use existing values if no optimizer
    transformed.points = player.points || player.predicted_pts || 0;
    transformed.predicted_pts = player.predicted_pts || player.points || 0;
    transformed.minutes = player.minutes || 90;
  }

  return transformed;
}

/**
 * Transform array of players for client consumption
 *
 * @param {Array} players - Array of player objects
 * @param {Object} optimizerService - Optional optimizer service
 * @returns {Array} Array of transformed players
 */
export function transformPlayersForClient(players, optimizerService = null) {
  if (!players || !Array.isArray(players)) {
    return [];
  }

  return players.map(player => transformPlayerForClient(player, optimizerService));
}
