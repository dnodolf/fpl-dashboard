/**
 * Shared player utility functions.
 *
 * Centralises the patterns that were repeated 30-40× across the codebase:
 *   - getPlayerId    — resolves sleeper_id / player_id / id
 *   - getPlayerName  — resolves web_name / full_name / name
 *   - getTeamDisplay — resolves TEAM_DISPLAY_NAMES / team_abbr / team
 *   - buildTierGroups — groups a ranked player array into tier buckets
 */

import { TEAM_DISPLAY_NAMES } from '../constants/teams';

/**
 * Canonical player ID: sleeper_id takes priority, then player_id, then id.
 * Consistent with formationOptimizerService which needs the triple fallback.
 *
 * @param {Object} player
 * @returns {string|number|null}
 */
export function getPlayerId(player) {
  return player?.sleeper_id ?? player?.player_id ?? player?.id ?? null;
}

/**
 * Canonical display name: web_name (short) → full_name → name → 'Unknown'.
 *
 * @param {Object} player
 * @returns {string}
 */
export function getPlayerName(player) {
  return player?.web_name || player?.full_name || player?.name || 'Unknown';
}

/**
 * Canonical team display string: looks up the pretty name, falls back
 * to abbreviation then raw team string.
 *
 * @param {Object} player
 * @returns {string}
 */
export function getTeamDisplay(player) {
  return TEAM_DISPLAY_NAMES[player?.team_abbr] ?? player?.team_abbr ?? player?.team ?? '';
}

/**
 * Group a ranked player array into tier buckets, sorted by tier number.
 * Players without a draftTier are placed in tier 99 (unranked).
 *
 * @param {Array} players — already filtered/ranked array (each has .draftTier)
 * @returns {Array<{ tierNumber: number, players: Array }>}
 */
export function buildTierGroups(players) {
  const groups = {};
  players.forEach(p => {
    const tier = p.draftTier || 99;
    if (!groups[tier]) groups[tier] = [];
    groups[tier].push(p);
  });
  return Object.entries(groups)
    .map(([tier, tierPlayers]) => ({ tierNumber: parseInt(tier, 10), players: tierPlayers }))
    .sort((a, b) => a.tierNumber - b.tierNumber);
}
