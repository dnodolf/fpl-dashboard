/**
 * Application Constants
 * Centralized configuration for magic numbers and constant values
 */

// User Configuration
export const USER_ID = 'ThatDerekGuy';

// Premier League Season Configuration
export const TOTAL_GAMEWEEKS = 38;
export const NEXT_N_GAMEWEEKS = 5;

// Cache Configuration (in minutes)
export const CACHE_DURATION_MINUTES = 30;

// Ownership Status
export const OWNERSHIP_STATUS = {
  FREE_AGENT: 'Free Agent',
  MY_PLAYER: USER_ID,
};

// Filter Options
export const FILTER_OPTIONS = {
  ALL: 'all',
  MY_PLAYERS_AND_FAS: 'my_players_and_free_agents',
  MY_PLAYERS_ONLY: USER_ID,
  FREE_AGENTS_ONLY: 'Free Agent',
};

// Scoring Modes
export const SCORING_MODES = {
  FFH: 'ffh',
  V3: 'v3',
};

// Position Types
export const POSITIONS = {
  GKP: 'GKP',
  DEF: 'DEF',
  MID: 'MID',
  FWD: 'FWD',
};

// Position Aliases (for goalkeeper)
export const POSITION_ALIASES = {
  GK: 'GKP',
};
