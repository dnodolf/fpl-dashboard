/**
 * Player Image Utilities
 *
 * Provides helper functions for player images from Sleeper CDN
 */

/**
 * Get player image URL from Sleeper CDN
 * @param {Object} player - Player object with player_id
 * @returns {string|null} Image URL or null if no player_id
 */
export function getPlayerImageUrl(player) {
  if (!player?.player_id) return null;
  return `https://sleepercdn.com/content/clubsoccer/players/${player.player_id}.jpg`;
}

/**
 * Get fallback image URL (team logo or default avatar)
 * @param {Object} player - Player object with team info
 * @returns {string} Fallback image URL
 */
export function getFallbackImageUrl(player) {
  // Could be enhanced to show team logos
  // For now, return a data URL for a simple player icon
  return 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"%3E%3Ccircle cx="12" cy="8" r="4"/%3E%3Cpath d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/%3E%3C/svg%3E';
}

/**
 * Handle image load error
 * @param {Event} e - Error event
 * @param {Object} player - Player object for fallback
 */
export function handleImageError(e, player) {
  if (e.target.dataset.fallbackAttempted) {
    // Already tried fallback, hide image entirely
    e.target.style.display = 'none';
  } else {
    // Try fallback image
    e.target.dataset.fallbackAttempted = 'true';
    e.target.src = getFallbackImageUrl(player);
  }
}
