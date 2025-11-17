/**
 * EPL Teams Constants
 * Team lists, mappings, and helper functions
 */

export const EPL_TEAMS = [
  'Arsenal', 'Aston Villa', 'Bournemouth', 'Brentford', 'Brighton',
  'Burnley', 'Chelsea', 'Crystal Palace', 'Everton', 'Fulham',
  'Leeds United', 'Liverpool', 'Man. City', 'Manchester Utd', 'Newcastle',
  'Nottingham', 'Sunderland', 'Tottenham', 'West Ham', 'Wolves'
];

// Team mappings for display name to data value
export const TEAM_MAPPINGS = {
  'Arsenal': 'ARS', 'Aston Villa': 'AVL', 'Bournemouth': 'BOU',
  'Brentford': 'BRE', 'Brighton': 'BHA', 'Burnley': 'BUR',
  'Chelsea': 'CHE', 'Crystal Palace': 'CRY', 'Everton': 'EVE',
  'Fulham': 'FUL', 'Leeds United': 'LEE', 'Liverpool': 'LIV',
  'Man. City': 'MCI', 'Manchester Utd': 'MUN', 'Newcastle': 'NEW',
  'Nottingham': 'NFO', 'Sunderland': 'SUN', 'Tottenham': 'TOT',
  'West Ham': 'WHU', 'Wolves': 'WOL'
};

// Reverse mapping for abbreviation to display name
export const TEAM_DISPLAY_NAMES = Object.fromEntries(
  Object.entries(TEAM_MAPPINGS).map(([display, abbrev]) => [abbrev, display])
);

/**
 * Helper function to check if player is on EPL team
 * @param {Object} player - Player object
 * @returns {boolean} True if player is on an EPL team
 */
export const isEPLPlayer = (player) => {
  // The actual team abbreviations are in team_abbr, not team
  const playerTeamAbbr = (player.team_abbr || '').trim();

  // Check if the team_abbr matches any EPL team abbreviation
  return Object.values(TEAM_MAPPINGS).includes(playerTeamAbbr);
};
