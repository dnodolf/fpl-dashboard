/**
 * Application Constants
 * Centralized configuration for magic numbers and constant values
 */

// Default User Configuration (fallback when no user config is set)
export const DEFAULT_USER_ID = 'ThatDerekGuy';
export const DEFAULT_LEAGUE_ID = '1240184286171107328';

// Legacy alias — components should migrate to receiving userId as a prop
export const USER_ID = DEFAULT_USER_ID;

// Premier League Season Configuration
export const TOTAL_GAMEWEEKS = 38;
export const NEXT_N_GAMEWEEKS = 5;

// Cache Configuration (in minutes)
export const CACHE_DURATION_MINUTES = 30;

// Ownership Status
export const OWNERSHIP_STATUS = {
  FREE_AGENT: 'Free Agent',
  MY_PLAYER: USER_ID, // legacy — components should compare against dynamic userId prop
};

// Filter Options
export const FILTER_OPTIONS = {
  ALL: 'all',
  MY_PLAYERS_AND_FAS: 'my_players_and_free_agents',
  MY_PLAYERS_ONLY: USER_ID, // legacy — components should compare against dynamic userId prop
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
