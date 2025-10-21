// app/services/sleeperScoringCalculator.js
// Pure Sleeper scoring calculator based on Derek's league settings

/**
 * Sleeper Scoring System - Derek's Custom EPL League
 * Based on actual scoring settings from images
 */
export const SLEEPER_SCORING = {
  FORWARD: {
    // Scoring actions
    goals: 4,
    assists: 3,
    shots_on_target: 1,
    key_passes: 0.5,
    successful_dribbles: 1,
    accurate_crosses: 0.5,
    tackles_won: 0.5,
    penalty_kick_saves: 4,
    aerials_won: 0.5,
    saves: 2,
    smothers: 1,
    penalty_kicks_drawn: 2,
    high_claims_succeeded: 1,
    interceptions: 0.5,
    blocked_shots: 0.5,

    // Penalties
    yellow_cards: -1,
    red_cards: -3,
    second_yellow: -2,
    penalty_kicks_missed: -3,
    dispossessed: -0.25,
    own_goals: -3
  },

  MIDFIELDER: {
    // Scoring actions
    goals: 5,
    assists: 3,
    shots_on_target: 0.5,
    key_passes: 1,
    successful_dribbles: 0.5,
    accurate_crosses: 0.5,
    tackles_won: 0.5,
    interceptions: 1,
    clean_sheets: 1,
    saves: 2,
    penalty_kick_saves: 4,
    aerials_won: 0.5,
    smothers: 1,
    blocked_shots: 0.5,
    penalty_kicks_drawn: 2,
    high_claims_succeeded: 1,

    // Penalties
    yellow_cards: -1,
    red_cards: -3,
    second_yellow: -2,
    penalty_kicks_missed: -3,
    dispossessed: -0.25,
    own_goals: -3
  },

  DEFENDER: {
    // Scoring actions
    goals: 6,
    assists: 3,
    tackles_won: 1,
    interceptions: 0.5,
    blocked_shots: 1,
    aerials_won: 0.5,
    clean_sheets: 4,
    shots_on_target: 0.5,
    saves: 2,
    penalty_kick_saves: 4,
    smothers: 1,
    penalty_kicks_drawn: 2,
    high_claims_succeeded: 1,
    accurate_crosses: 0.5,
    successful_dribbles: 0.5,
    key_passes: 0.5,

    // Penalties
    goals_against: -0.25,
    yellow_cards: -1,
    red_cards: -3,
    second_yellow: -2,
    penalty_kicks_missed: -4,
    dispossessed: -0.5,
    own_goals: -4
  },

  GOALKEEPER: {
    // Scoring actions
    clean_sheets: 5,
    saves: 1,
    high_claims_succeeded: 1,
    smothers: 1,
    penalty_kick_saves: 4,
    tackles_won: 0.5,
    shots_on_target: 0.5,
    penalty_kicks_drawn: 2,
    assists: 3,
    key_passes: 0.5,
    successful_dribbles: 0.5,
    aerials_won: 0.5,
    blocked_shots: 0.5,
    effective_clearances: 0.5,
    goals: 6,
    accurate_crosses: 0.5,
    interceptions: 0.5,

    // Penalties
    goals_against: -0.5,
    yellow_cards: -2,
    red_cards: -5,
    second_yellow: -2,
    penalty_kicks_missed: -4,
    dispossessed: -0.5,
    own_goals: -4
  }
};

/**
 * FPL Scoring System (Premier League official)
 */
export const FPL_SCORING = {
  FORWARD: {
    playing_60_plus: 2,
    playing_under_60: 1,
    goals: 4,
    assists: 3,
    clean_sheets: 0,
    goals_conceded_per_2: 0,
    saves_per_3: 0,
    penalty_save: 0,
    penalty_miss: -2,
    yellow_card: -1,
    red_card: -3,
    own_goal: -2,
    bonus_max: 3,
    defensive_contributions_per_12: 2
  },

  MIDFIELDER: {
    playing_60_plus: 2,
    playing_under_60: 1,
    goals: 5,
    assists: 3,
    clean_sheets: 1,
    goals_conceded_per_2: 0,
    saves_per_3: 0,
    penalty_save: 0,
    penalty_miss: -2,
    yellow_card: -1,
    red_card: -3,
    own_goal: -2,
    bonus_max: 3,
    defensive_contributions_per_12: 2
  },

  DEFENDER: {
    playing_60_plus: 2,
    playing_under_60: 1,
    goals: 6,
    assists: 3,
    clean_sheets: 4,
    goals_conceded_per_2: -1,
    saves_per_3: 0,
    penalty_save: 0,
    penalty_miss: -2,
    yellow_card: -1,
    red_card: -3,
    own_goal: -2,
    bonus_max: 3,
    defensive_contributions_per_10: 2
  },

  GOALKEEPER: {
    playing_60_plus: 2,
    playing_under_60: 1,
    goals: 10,
    assists: 3,
    clean_sheets: 4,
    goals_conceded_per_2: -1,
    saves_per_3: 1,
    penalty_save: 5,
    penalty_miss: -2,
    yellow_card: -1,
    red_card: -3,
    own_goal: -2,
    bonus_max: 3,
    defensive_contributions_per_10: 2
  }
};

/**
 * Calculate expected Sleeper points from FPL predicted points
 * Uses statistical conversion based on scoring systems
 */
export function convertFPLToSleeperPoints(fplPoints, position, predictedMinutes = 90) {
  const posKey = position.toUpperCase();

  // Base conversion ratio based on goal scoring values
  // This is the primary differentiator between systems
  const baseRatios = {
    'GKP': 0.9,  // GK: FPL 10 vs Sleeper 6 for goals (Sleeper has more save opportunities)
    'DEF': 1.0,  // DEF: Both 6 for goals, Sleeper has more defensive stat rewards
    'MID': 1.0,  // MID: Both 5 for goals, similar systems
    'FWD': 1.0   // FWD: Both 4 for goals, similar systems
  };

  let sleeperPoints = fplPoints * (baseRatios[posKey] || 1.0);

  // Sleeper doesn't have appearance points (FPL gives 1-2 pts)
  // So subtract estimated appearance points from FPL total
  const estimatedAppearancePoints = predictedMinutes >= 60 ? 2 : (predictedMinutes > 0 ? 1 : 0);
  sleeperPoints -= estimatedAppearancePoints;

  // Sleeper rewards more granular defensive stats
  // Add bonus for defenders and midfielders
  if (posKey === 'DEF') {
    sleeperPoints *= 1.15; // 15% bonus for defensive stat rewards
  } else if (posKey === 'MID') {
    sleeperPoints *= 1.05; // 5% bonus for midfield versatility
  } else if (posKey === 'GKP') {
    sleeperPoints *= 1.10; // 10% bonus for save/claim rewards
  }

  // Sleeper has dispossession penalties
  // Reduce slightly for attacking players who lose ball more
  if (posKey === 'FWD') {
    sleeperPoints *= 0.97; // 3% penalty for dispossessions
  } else if (posKey === 'MID') {
    sleeperPoints *= 0.99; // 1% penalty for dispossessions
  }

  return Math.max(0, sleeperPoints);
}

/**
 * Estimate individual stat contributions from FPL points
 * This is a simplified model based on typical player profiles
 */
export function estimateStatsFromFPLPoints(fplPoints, position, playerName = '') {
  const posKey = position.toUpperCase();

  // Typical point distribution patterns
  // Based on how FPL points are usually earned
  const distribution = {
    'FWD': {
      goals_pct: 0.50,      // 50% from goals
      assists_pct: 0.25,    // 25% from assists
      bonus_pct: 0.15,      // 15% from bonus
      other_pct: 0.10       // 10% from misc
    },
    'MID': {
      goals_pct: 0.35,
      assists_pct: 0.30,
      clean_sheets_pct: 0.10,
      bonus_pct: 0.15,
      other_pct: 0.10
    },
    'DEF': {
      goals_pct: 0.15,
      assists_pct: 0.10,
      clean_sheets_pct: 0.50,
      bonus_pct: 0.15,
      other_pct: 0.10
    },
    'GKP': {
      saves_pct: 0.20,
      clean_sheets_pct: 0.60,
      bonus_pct: 0.15,
      other_pct: 0.05
    }
  };

  const dist = distribution[posKey] || distribution['MID'];

  // Estimate stat counts
  const estimates = {
    position: posKey,
    fpl_points: fplPoints,
    estimated_goals: 0,
    estimated_assists: 0,
    estimated_clean_sheets: 0,
    estimated_saves: 0
  };

  // Calculate estimated stats based on FPL scoring
  if (posKey === 'FWD') {
    estimates.estimated_goals = (fplPoints * dist.goals_pct) / FPL_SCORING.FORWARD.goals;
    estimates.estimated_assists = (fplPoints * dist.assists_pct) / FPL_SCORING.FORWARD.assists;
  } else if (posKey === 'MID') {
    estimates.estimated_goals = (fplPoints * dist.goals_pct) / FPL_SCORING.MIDFIELDER.goals;
    estimates.estimated_assists = (fplPoints * dist.assists_pct) / FPL_SCORING.MIDFIELDER.assists;
    estimates.estimated_clean_sheets = (fplPoints * dist.clean_sheets_pct) / FPL_SCORING.MIDFIELDER.clean_sheets;
  } else if (posKey === 'DEF') {
    estimates.estimated_goals = (fplPoints * dist.goals_pct) / FPL_SCORING.DEFENDER.goals;
    estimates.estimated_assists = (fplPoints * dist.assists_pct) / FPL_SCORING.DEFENDER.assists;
    estimates.estimated_clean_sheets = (fplPoints * dist.clean_sheets_pct) / FPL_SCORING.DEFENDER.clean_sheets;
  } else if (posKey === 'GKP') {
    estimates.estimated_saves = (fplPoints * dist.saves_pct) / (FPL_SCORING.GOALKEEPER.saves_per_3 / 3);
    estimates.estimated_clean_sheets = (fplPoints * dist.clean_sheets_pct) / FPL_SCORING.GOALKEEPER.clean_sheets;
  }

  return estimates;
}

export default {
  SLEEPER_SCORING,
  FPL_SCORING,
  convertFPLToSleeperPoints,
  estimateStatsFromFPLPoints
};
