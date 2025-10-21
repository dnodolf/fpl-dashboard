// app/services/ffhDetailedStatsService.js
// Service to fetch detailed player stats from FFH's granular endpoint

/**
 * FFH Detailed Player Stats Service
 * Fetches comprehensive player data including granular stats for all gameweeks
 */
class FFHDetailedStatsService {
  constructor() {
    this.baseUrl = 'https://www.fantasyfootballhub.co.uk';
    this.bearerToken = process.env.FFH_BEARER_TOKEN;
    this.cache = new Map();
    this.cacheExpiry = 30 * 60 * 1000; // 30 minutes
  }

  /**
   * Get detailed player data with granular stats
   * This endpoint provides per-gameweek predictions with detailed stat breakdowns
   */
  async fetchDetailedPlayerData(runAsOf = '2025-6-10T00:00:00Z') {
    const cacheKey = `detailed_${runAsOf}`;

    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      console.log('📦 Using cached FFH detailed player data');
      return cached.data;
    }

    try {
      console.log('🔍 Fetching FFH detailed player data...');

      const url = `${this.baseUrl}/player-data/player-data.json`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'accept': '*/*',
          'accept-language': 'en-US,en;q=0.9',
          'cache-control': 'no-cache',
          'pragma': 'no-cache',
          'runasof': runAsOf,
          'sec-ch-ua': '"Google Chrome";v="141", "Not?A_Brand";v="8", "Chromium";v="141"',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': '"Windows"',
          'sec-fetch-dest': 'empty',
          'sec-fetch-mode': 'cors',
          'sec-fetch-site': 'same-origin',
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
          'referer': 'https://www.fantasyfootballhub.co.uk/'
        }
      });

      if (!response.ok) {
        throw new Error(`FFH detailed stats error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      // Cache the result
      this.cache.set(cacheKey, {
        data,
        timestamp: Date.now()
      });

      console.log(`✅ Fetched FFH detailed data for ${data?.length || 0} players`);
      return data;

    } catch (error) {
      console.error('❌ Error fetching FFH detailed stats:', error);
      throw error;
    }
  }

  /**
   * Get granular stats for a specific player by Opta ID or FPL ID
   */
  async getPlayerDetailedStats(playerIdentifier, identifierType = 'opta_id') {
    try {
      const allPlayers = await this.fetchDetailedPlayerData();

      const player = allPlayers.find(p => {
        if (identifierType === 'opta_id') {
          return p.opta_uuid === playerIdentifier || p.opta_id === playerIdentifier;
        } else if (identifierType === 'fpl_id') {
          return p.fpl_id === playerIdentifier || p.id === playerIdentifier;
        } else if (identifierType === 'name') {
          return p.web_name?.toLowerCase() === playerIdentifier?.toLowerCase() ||
                 p.name?.toLowerCase() === playerIdentifier?.toLowerCase();
        }
        return false;
      });

      if (!player) {
        console.warn(`⚠️ Player not found: ${playerIdentifier} (${identifierType})`);
        return null;
      }

      return this.parsePlayerStats(player);

    } catch (error) {
      console.error(`Error getting player detailed stats:`, error);
      return null;
    }
  }

  /**
   * Parse and structure player stats data
   */
  parsePlayerStats(rawPlayer) {
    if (!rawPlayer) return null;

    const parsed = {
      // Basic info
      player_id: rawPlayer.id || rawPlayer.fpl_id,
      opta_id: rawPlayer.opta_uuid || rawPlayer.opta_id,
      fpl_id: rawPlayer.fpl_id || rawPlayer.id,
      name: rawPlayer.web_name || rawPlayer.name,
      full_name: `${rawPlayer.first_name || ''} ${rawPlayer.second_name || ''}`.trim(),
      position_id: rawPlayer.position_id,
      team: rawPlayer.team?.code_name || rawPlayer.team_short_name,

      // Current season stats
      current_cost: rawPlayer.now_cost,

      // Gameweek predictions (if available)
      predictions: this.parsePredictions(rawPlayer.predictions || []),

      // Historical stats (for profiling)
      historical_stats: this.parseHistoricalStats(rawPlayer.summary?.history || []),

      // Form data (recent performance)
      form_data: rawPlayer.form_data || {},

      // Season aggregates
      season_stats: this.parseSeasonStats(rawPlayer),

      // Raw data for reference
      _raw: rawPlayer
    };

    return parsed;
  }

  /**
   * Parse gameweek predictions with granular stat breakdowns
   */
  parsePredictions(predictions) {
    if (!Array.isArray(predictions)) return [];

    return predictions.map(pred => ({
      gameweek: pred.gw,
      opponent: pred.opp?.[0]?.[0] || '',
      opponent_full: pred.opp?.[0]?.[1] || '',
      fixture_difficulty: pred.opp?.[0]?.[2] || 3,
      predicted_points: pred.predicted_pts || 0,
      predicted_minutes: pred.xmins || 0,
      captain_points: pred.capt || 0,
      status: pred.status || 'a',
      fitness: pred.fitness || 1,

      // Detailed stat predictions (if available in this endpoint)
      predicted_goals: pred.xg || 0,
      predicted_assists: pred.xa || 0,
      predicted_clean_sheet: pred.xcs || 0,
      predicted_saves: pred.xsaves || 0,

      // Additional stats (if available)
      predicted_key_passes: pred.xkp || 0,
      predicted_shots: pred.xshots || 0,
      predicted_shots_on_target: pred.xsot || 0,
      predicted_tackles: pred.xtackles || 0,
      predicted_interceptions: pred.xint || 0,
      predicted_dribbles: pred.xdribbles || 0,
      predicted_aerials: pred.xaerial || 0,
      predicted_crosses: pred.xcrosses || 0,
      predicted_blocks: pred.xblocks || 0,
      predicted_clearances: pred.xclearances || 0
    }));
  }

  /**
   * Parse historical gameweek results
   */
  parseHistoricalStats(history) {
    if (!Array.isArray(history)) return [];

    return history.map(gw => ({
      gameweek: gw.round,
      minutes: gw.minutes,
      goals_scored: gw.goals_scored || 0,
      assists: gw.assists || 0,
      clean_sheets: gw.clean_sheets || 0,
      goals_conceded: gw.goals_conceded || 0,
      saves: gw.saves || 0,
      bonus: gw.bonus || 0,
      yellow_cards: gw.yellow_cards || 0,
      red_cards: gw.red_cards || 0,
      own_goals: gw.own_goals || 0,
      penalties_missed: gw.penalties_missed || 0,
      penalties_saved: gw.penalties_saved || 0,
      total_points: gw.total_points || 0,

      // Expected stats
      expected_goals: parseFloat(gw.expected_goals || 0),
      expected_assists: parseFloat(gw.expected_assists || 0),
      expected_goals_conceded: parseFloat(gw.expected_goals_conceded || 0),
      expected_goal_involvements: parseFloat(gw.expected_goal_involvements || 0),

      // BPS
      bps: gw.bps || 0,
      influence: parseFloat(gw.influence || 0),
      creativity: parseFloat(gw.creativity || 0),
      threat: parseFloat(gw.threat || 0),
      ict_index: parseFloat(gw.ict_index || 0)
    }));
  }

  /**
   * Parse season aggregate stats
   */
  parseSeasonStats(player) {
    const history = player.summary?.history || [];

    if (history.length === 0) {
      return {
        games_played: 0,
        total_points: 0,
        ppg: 0
      };
    }

    const totals = history.reduce((acc, gw) => ({
      minutes: acc.minutes + (gw.minutes || 0),
      goals: acc.goals + (gw.goals_scored || 0),
      assists: acc.assists + (gw.assists || 0),
      clean_sheets: acc.clean_sheets + (gw.clean_sheets || 0),
      saves: acc.saves + (gw.saves || 0),
      points: acc.points + (gw.total_points || 0),
      yellow_cards: acc.yellow_cards + (gw.yellow_cards || 0),
      red_cards: acc.red_cards + (gw.red_cards || 0)
    }), {
      minutes: 0, goals: 0, assists: 0, clean_sheets: 0,
      saves: 0, points: 0, yellow_cards: 0, red_cards: 0
    });

    const gamesPlayed = history.filter(gw => gw.minutes > 0).length;

    return {
      games_played: gamesPlayed,
      total_minutes: totals.minutes,
      total_goals: totals.goals,
      total_assists: totals.assists,
      total_clean_sheets: totals.clean_sheets,
      total_saves: totals.saves,
      total_points: totals.points,
      total_yellow_cards: totals.yellow_cards,
      total_red_cards: totals.red_cards,

      // Per 90 stats
      goals_per_90: gamesPlayed > 0 ? (totals.goals / totals.minutes * 90) : 0,
      assists_per_90: gamesPlayed > 0 ? (totals.assists / totals.minutes * 90) : 0,
      saves_per_90: gamesPlayed > 0 ? (totals.saves / totals.minutes * 90) : 0,

      // Averages
      ppg: gamesPlayed > 0 ? totals.points / gamesPlayed : 0,
      minutes_per_game: gamesPlayed > 0 ? totals.minutes / gamesPlayed : 0
    };
  }

  /**
   * Calculate player-specific stat averages for Sleeper scoring
   * Uses historical data to estimate tackles, interceptions, etc. per 90
   */
  calculatePlayerProfile(playerStats) {
    const formData = playerStats.form_data || {};
    const historicalStats = playerStats.historical_stats || [];

    // Calculate per-90 rates from form_data arrays
    const profile = {
      // Available from form_data
      key_passes_per_90: this.calculatePer90Average(formData.kp, formData.mins),
      shots_per_90: this.calculatePer90Average(formData.shots, formData.mins),
      expected_goals_per_90: this.calculatePer90Average(formData.xg, formData.mins),
      expected_assists_per_90: this.calculatePer90Average(formData.xa, formData.mins),

      // Estimated from position (if not in form_data)
      estimated_tackles_per_90: this.estimateTacklesPerPosition(playerStats.position_id),
      estimated_interceptions_per_90: this.estimateInterceptionsPerPosition(playerStats.position_id),
      estimated_dribbles_per_90: this.estimateDribblesPerPosition(playerStats.position_id, formData),
      estimated_aerials_per_90: this.estimateAerialsPerPosition(playerStats.position_id),
      estimated_crosses_per_90: this.estimateCrossesPerPosition(playerStats.position_id),
      estimated_blocks_per_90: this.estimateBlocksPerPosition(playerStats.position_id)
    };

    return profile;
  }

  /**
   * Calculate per-90 average from form data arrays
   */
  calculatePer90Average(statArray, minutesArray) {
    if (!Array.isArray(statArray) || !Array.isArray(minutesArray)) return 0;
    if (statArray.length === 0 || minutesArray.length === 0) return 0;

    const validEntries = statArray
      .map((stat, idx) => ({
        stat: stat || 0,
        mins: minutesArray[idx] || 0
      }))
      .filter(entry => entry.mins > 0 && entry.stat !== null);

    if (validEntries.length === 0) return 0;

    const totalStats = validEntries.reduce((sum, entry) => sum + entry.stat, 0);
    const totalMinutes = validEntries.reduce((sum, entry) => sum + entry.mins, 0);

    return totalMinutes > 0 ? (totalStats / totalMinutes * 90) : 0;
  }

  /**
   * Position-based stat estimates (typical values)
   */
  estimateTacklesPerPosition(positionId) {
    const estimates = { 1: 0.2, 2: 3.5, 3: 2.0, 4: 0.5 }; // GK, DEF, MID, FWD
    return estimates[positionId] || 0;
  }

  estimateInterceptionsPerPosition(positionId) {
    const estimates = { 1: 0.3, 2: 2.5, 3: 1.5, 4: 0.3 };
    return estimates[positionId] || 0;
  }

  estimateDribblesPerPosition(positionId, formData) {
    // If we have shot data, attacking players likely dribble more
    const baseDribbles = { 1: 0.1, 2: 0.8, 3: 1.5, 4: 1.2 };
    return baseDribbles[positionId] || 0;
  }

  estimateAerialsPerPosition(positionId) {
    const estimates = { 1: 0.5, 2: 3.0, 3: 1.0, 4: 2.5 };
    return estimates[positionId] || 0;
  }

  estimateCrossesPerPosition(positionId) {
    const estimates = { 1: 0, 2: 0.8, 3: 1.2, 4: 0.3 };
    return estimates[positionId] || 0;
  }

  estimateBlocksPerPosition(positionId) {
    const estimates = { 1: 0.1, 2: 1.5, 3: 0.5, 4: 0.2 };
    return estimates[positionId] || 0;
  }

  /**
   * Clear cache (useful for testing)
   */
  clearCache() {
    this.cache.clear();
    console.log('🧹 FFH detailed stats cache cleared');
  }
}

// Export singleton instance
export const ffhDetailedStatsService = new FFHDetailedStatsService();

export default ffhDetailedStatsService;
