// app/services/ffhStatsService.js
// FFH Current Season Stats Service - Fetches rich player statistics

class FFHStatsService {
  constructor() {
    this.cachedStats = null;
    this.cacheTimestamp = null;
    this.cacheDuration = 15 * 60 * 1000; // 15 minutes
  }

  /**
   * Fetch current season statistics for all players
   */
  async fetchCurrentSeasonStats() {
    // Check cache first
    if (this.cachedStats && this.cacheTimestamp && 
        (Date.now() - this.cacheTimestamp) < this.cacheDuration) {
      console.log('✅ FFH Stats: Using cached data');
      return this.cachedStats;
    }

    try {
      console.log('🔥 FFH Stats: Fetching current season data...');
      
      const response = await fetch(this.buildApiUrl(), {
        method: 'GET',
        headers: {
          'Accept-Language': 'en-US',
          'Authorization': process.env.FFH_AUTH_STATIC || 'r5C(e3.JeS^:_7LF',
          'Content-Type': 'application/json',
          'Token': process.env.FFH_BEARER_TOKEN
        },
        cache: 'no-store'
      });

      if (!response.ok) {
        throw new Error(`FFH Stats API failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      // Process the response
      const processedStats = this.processStatsResponse(data);
      
      // Cache the results
      this.cachedStats = processedStats;
      this.cacheTimestamp = Date.now();
      
      console.log(`✅ FFH Stats: Processed ${processedStats.players.length} players`);
      return processedStats;
      
    } catch (error) {
      console.error('❌ FFH Stats Service error:', error);
      throw error;
    }
  }

  /**
   * Build the API URL for the players-custom endpoint
   */
  buildApiUrl() {
    const baseUrl = 'https://data.fantasyfootballhub.co.uk/api/players-custom';
    const params = new URLSearchParams({
      mingw: '1',
      maxgw: '39',
      type: 'total',
      venue: 'all',
      season: '2025',
      sortOn: 'appearance',
      qty: '99999',
      sortOrder: 'desc',
      playerSearch: '',
      minCost: '40',
      maxCost: '145',
      positions: '1,2,3,4',
      min_fdr: '1',
      max_fdr: '5',
      page_No: '1',
      lowMins: 'false',
      ppm: '0'
    });
    
    return `${baseUrl}?${params.toString()}`;
  }

  /**
   * Process the raw FFH stats response
   */
  processStatsResponse(data) {
    // Handle different response structures
    let playersArray = [];
    
    if (Array.isArray(data)) {
      playersArray = data;
    } else if (data.results && Array.isArray(data.results)) {
      playersArray = data.results;
    } else if (data.data && Array.isArray(data.data)) {
      playersArray = data.data;
    } else {
      console.warn('⚠️ FFH Stats: Unexpected response structure');
      playersArray = [];
    }

    const processedPlayers = playersArray.map(player => this.processPlayerStats(player));
    
    return {
      players: processedPlayers,
      totalPlayers: processedPlayers.length,
      lastUpdated: new Date().toISOString(),
      dataSource: 'ffh_players_custom'
    };
  }

  /**
   * Process individual player statistics
   */
  processPlayerStats(rawPlayer) {
    const minutes = parseFloat(rawPlayer.mins) || 0;
    const appearances = parseFloat(rawPlayer.appearance) || 0;
    
    // Calculate per-90 stats for all Sleeper-relevant metrics
    const per90Stats = this.calculatePer90Stats(rawPlayer, minutes);
    
    // Determine sample size quality
    const sampleSize = this.getSampleSizeCategory(minutes, appearances);
    
    // Extract team context
    const teamContext = this.extractTeamContext(rawPlayer.team);
    
    return {
      // Basic identifiers
      web_name: rawPlayer.web_name,
      search_term: rawPlayer.search_term,
      code: rawPlayer.code,
      position_id: rawPlayer.position_id,
      now_cost: rawPlayer.now_cost,
      status: rawPlayer.status,
      
      // Season totals
      minutes: minutes,
      appearances: appearances,
      starts: parseFloat(rawPlayer.starts) || 0,
      
      // Core performance stats
      goals: parseFloat(rawPlayer.goals) || 0,
      assists: parseFloat(rawPlayer.assists) || 0,
      clean_sheets: parseFloat(rawPlayer.clean_sheets) || 0,
      
      // Sleeper-specific raw stats
      shots_on_target: parseFloat(rawPlayer.shots_on_target) || 0,
      key_pass: parseFloat(rawPlayer.key_pass) || 0,
      tackles_won: parseFloat(rawPlayer.tackles_won) || 0,
      intercepts: parseFloat(rawPlayer.intercepts) || 0,
      blocks: parseFloat(rawPlayer.blocks) || 0,
      clearances: parseFloat(rawPlayer.clearances) || 0,
      succ_drib: parseFloat(rawPlayer.succ_drib) || 0,
      saves: parseFloat(rawPlayer.saves) || 0,
      
      // Advanced metrics
      xg1: parseFloat(rawPlayer.xg1) || 0,
      xa: parseFloat(rawPlayer.xa) || 0,
      xfpl: parseFloat(rawPlayer.xfpl) || 0,
      
      // Per-90 calculated stats
      per90: per90Stats,
      
      // Sample size assessment
      sampleSize: sampleSize,
      
      // Team context
      teamContext: teamContext,
      
      // Processing metadata
      processedAt: new Date().toISOString()
    };
  }

  /**
   * Calculate per-90 minute statistics
   */
  calculatePer90Stats(player, minutes) {
    if (minutes === 0) {
      return this.getZeroMinutesPer90();
    }

    const per90Factor = 90 / minutes;

    return {
      // Attacking stats
      goals_per_90: (parseFloat(player.goals) || 0) * per90Factor,
      assists_per_90: (parseFloat(player.assists) || 0) * per90Factor,
      shots_on_target_per_90: (parseFloat(player.shots_on_target) || 0) * per90Factor,
      key_pass_per_90: (parseFloat(player.key_pass) || 0) * per90Factor,
      succ_drib_per_90: (parseFloat(player.succ_drib) || 0) * per90Factor,
      
      // Defensive stats
      tackles_won_per_90: (parseFloat(player.tackles_won) || 0) * per90Factor,
      intercepts_per_90: (parseFloat(player.intercepts) || 0) * per90Factor,
      blocks_per_90: (parseFloat(player.blocks) || 0) * per90Factor,
      clearances_per_90: (parseFloat(player.clearances) || 0) * per90Factor,
      
      // Goalkeeper stats
      saves_per_90: (parseFloat(player.saves) || 0) * per90Factor,
      
      // Clean sheet rate (different calculation)
      clean_sheet_rate: this.calculateCleanSheetRate(player),
      
      // Expected stats
      xg_per_90: (parseFloat(player.xg1) || 0) * per90Factor,
      xa_per_90: (parseFloat(player.xa) || 0) * per90Factor
    };
  }

  /**
   * Get default per-90 stats for players with zero minutes
   */
  getZeroMinutesPer90() {
    return {
      goals_per_90: 0,
      assists_per_90: 0,
      shots_on_target_per_90: 0,
      key_pass_per_90: 0,
      succ_drib_per_90: 0,
      tackles_won_per_90: 0,
      intercepts_per_90: 0,
      blocks_per_90: 0,
      clearances_per_90: 0,
      saves_per_90: 0,
      clean_sheet_rate: 0,
      xg_per_90: 0,
      xa_per_90: 0
    };
  }

  /**
   * Calculate clean sheet rate (games with clean sheet / games played)
   */
  calculateCleanSheetRate(player) {
    const appearances = parseFloat(player.appearance) || 0;
    const cleanSheets = parseFloat(player.clean_sheets) || 0;
    
    if (appearances === 0) return 0;
    return cleanSheets / appearances;
  }

  /**
   * Categorize sample size for reliability assessment
   */
  getSampleSizeCategory(minutes, appearances) {
    if (minutes < 270) { // Less than 3 full games
      return {
        category: 'small',
        reliability: 0.3,
        description: 'Small sample - use with caution',
        playerWeight: 0.3,
        positionalWeight: 0.7
      };
    } else if (minutes < 540) { // 3-6 full games
      return {
        category: 'medium',
        reliability: 0.6,
        description: 'Medium sample - moderate confidence',
        playerWeight: 0.6,
        positionalWeight: 0.4
      };
    } else { // 6+ full games
      return {
        category: 'large',
        reliability: 0.85,
        description: 'Large sample - high confidence',
        playerWeight: 0.85,
        positionalWeight: 0.15
      };
    }
  }

  /**
   * Extract team context for fixture difficulty assessment
   */
  extractTeamContext(teamData) {
    if (!teamData) return null;

    return {
      code_name: teamData.code_name,
      official_name: teamData.official_name,
      fdr: teamData.fdr,
      
      // Attacking strength
      att_rating: teamData.att_rating,
      att_rating_home: teamData.att_rating_home,
      att_rating_away: teamData.att_rating_away,
      att_form: teamData.att_form,
      att_str: teamData.att_str,
      
      // Defensive strength
      def_rating: teamData.def_rating,
      def_rating_home: teamData.def_rating_home,
      def_rating_away: teamData.def_rating_away,
      def_form: teamData.def_form,
      def_str: teamData.def_str,
      
      // Overall ratings
      overall_rating_home: teamData.overall_rating_home,
      overall_rating_away: teamData.overall_rating_away
    };
  }

  /**
   * Get player stats by Opta ID (for integration with existing system)
   */
  async getPlayerStatsByOptaId(optaId) {
    const allStats = await this.fetchCurrentSeasonStats();
    
    // Note: We need to match by code/web_name since this endpoint 
    // doesn't include opta_id directly
    // Will need to cross-reference with existing FFH data for exact matching
    
    return allStats.players.find(player => {
      // Placeholder matching logic - will need to enhance
      // based on how we can link this data to existing player records
      return player.code && player.web_name;
    });
  }

  /**
   * Get positional averages for sample size weighting
   */
  async getPositionalAverages() {
    const allStats = await this.fetchCurrentSeasonStats();
    const averages = {
      1: {}, // GKP
      2: {}, // DEF  
      3: {}, // MID
      4: {}  // FWD
    };

    // Group players by position
    const playersByPosition = {
      1: allStats.players.filter(p => p.position_id === 1 && p.sampleSize.category !== 'small'),
      2: allStats.players.filter(p => p.position_id === 2 && p.sampleSize.category !== 'small'),
      3: allStats.players.filter(p => p.position_id === 3 && p.sampleSize.category !== 'small'),
      4: allStats.players.filter(p => p.position_id === 4 && p.sampleSize.category !== 'small')
    };

    // Calculate averages for each position
    Object.keys(playersByPosition).forEach(positionId => {
      const players = playersByPosition[positionId];
      if (players.length === 0) return;

      const statKeys = Object.keys(players[0].per90);
      const positionAverages = {};

      statKeys.forEach(statKey => {
        const values = players.map(p => p.per90[statKey]).filter(v => v > 0);
        positionAverages[statKey] = values.length > 0 
          ? values.reduce((sum, val) => sum + val, 0) / values.length 
          : 0;
      });

      averages[positionId] = positionAverages;
    });

    return averages;
  }

  /**
   * Clear cache (for testing/debugging)
   */
  clearCache() {
    this.cachedStats = null;
    this.cacheTimestamp = null;
    console.log('🔄 FFH Stats: Cache cleared');
  }

  /**
   * Get cache status
   */
  getCacheStatus() {
    const isValid = this.cachedStats && this.cacheTimestamp && 
                   (Date.now() - this.cacheTimestamp) < this.cacheDuration;
    
    return {
      hasCache: !!this.cachedStats,
      isValid: isValid,
      age: this.cacheTimestamp ? Date.now() - this.cacheTimestamp : null,
      playersCount: this.cachedStats ? this.cachedStats.players.length : 0
    };
  }
}

// Export singleton instance
const ffhStatsService = new FFHStatsService();
export default ffhStatsService;