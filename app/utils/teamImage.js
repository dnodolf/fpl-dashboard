/**
 * Team Image Utilities
 *
 * Provides helper functions for team logos from Premier League CDN
 */

// Mapping from team abbreviations to Premier League team IDs (2024-25 season)
const TEAM_ID_MAP = {
  'ARS': 3,    // Arsenal
  'AVL': 7,    // Aston Villa
  'BOU': 91,   // Bournemouth
  'BRE': 94,   // Brentford
  'BHA': 36,   // Brighton
  'CHE': 8,    // Chelsea
  'CRY': 31,   // Crystal Palace
  'EVE': 11,   // Everton
  'FUL': 54,   // Fulham
  'IPS': 40,   // Ipswich Town
  'LEI': 13,   // Leicester City
  'LIV': 14,   // Liverpool
  'MCI': 43,   // Manchester City
  'MUN': 1,    // Manchester United
  'NEW': 4,    // Newcastle United
  'NFO': 17,   // Nottingham Forest
  'SOU': 20,   // Southampton
  'TOT': 6,    // Tottenham Hotspur
  'WHU': 21,   // West Ham United
  'WOL': 39,   // Wolverhampton Wanderers
};

/**
 * Get team logo URL from Premier League CDN
 * @param {string} teamAbbr - Team abbreviation (e.g., 'ARS', 'LIV')
 * @returns {string|null} Logo URL or null if team not found
 */
export function getTeamLogoUrl(teamAbbr) {
  if (!teamAbbr) return null;

  const abbr = teamAbbr.toUpperCase().trim();
  const teamId = TEAM_ID_MAP[abbr];

  if (!teamId) return null;

  return `https://resources.premierleague.com/premierleague/badges/70/t${teamId}.png`;
}

/**
 * Get team logo URL from player object
 * @param {Object} player - Player object with team_abbr field
 * @returns {string|null} Logo URL or null if team not found
 */
export function getTeamLogoFromPlayer(player) {
  const teamAbbr = player?.team_abbr || player?.team_code || player?.team;
  return getTeamLogoUrl(teamAbbr);
}

/**
 * Team abbreviation to full name mapping
 */
export const TEAM_FULL_NAMES = {
  'ARS': 'Arsenal',
  'AVL': 'Aston Villa',
  'BOU': 'Bournemouth',
  'BRE': 'Brentford',
  'BHA': 'Brighton',
  'CHE': 'Chelsea',
  'CRY': 'Crystal Palace',
  'EVE': 'Everton',
  'FUL': 'Fulham',
  'IPS': 'Ipswich Town',
  'LEI': 'Leicester City',
  'LIV': 'Liverpool',
  'MCI': 'Manchester City',
  'MUN': 'Manchester United',
  'NEW': 'Newcastle United',
  'NFO': 'Nottingham Forest',
  'SOU': 'Southampton',
  'TOT': 'Tottenham',
  'WHU': 'West Ham',
  'WOL': 'Wolves',
};

/**
 * Get full team name from abbreviation
 * @param {string} teamAbbr - Team abbreviation
 * @returns {string} Full team name or original abbreviation if not found
 */
export function getTeamFullName(teamAbbr) {
  if (!teamAbbr) return 'Unknown';
  const abbr = teamAbbr.toUpperCase().trim();
  return TEAM_FULL_NAMES[abbr] || teamAbbr;
}
