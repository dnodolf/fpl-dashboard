// app/services/ffhApiService.js
class FFHApiService {
  constructor() {
    this.baseUrl = 'https://data.fantasyfootballhub.co.uk/api';
    this.authStatic = process.env.FFH_AUTH_STATIC;
    this.bearerToken = process.env.FFH_BEARER_TOKEN;

    if (!this.authStatic || !this.bearerToken) {
      console.warn('⚠️ FFH credentials not configured. FFH predictions will be unavailable.');
    }
  }

  // Get common headers for FFH API
  getHeaders() {
    return {
      'Accept-Language': 'en-US',
      'Authorization': this.authStatic,
      'Content-Type': 'application/json',
      'Token': this.bearerToken
    };
  }

  // Fetch player predictions
  async getPlayerPredictions() {
    try {
      const url = `${this.baseUrl}/player-predictions/?orderBy=points&focus=range&positions=1,2,3,4&min_cost=40&max_cost=145&search_term=&gw_start=1&gw_end=47&first=0&last=99999&use_predicted_fixtures=false&selected_players=`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders(),
        cache: 'no-store' // Always get fresh data
      });

      if (!response.ok) {
        throw new Error(`FFH API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data.results || data || [];
    } catch (error) {
      console.error('Error fetching FFH predictions:', error);
      throw new Error(`Failed to fetch FFH predictions: ${error.message}`);
    }
  }

  // Fetch custom player stats
  async getCustomPlayerStats() {
    try {
      const url = `${this.baseUrl}/players-custom?mingw=1&maxgw=39&type=total&venue=all&season=2025&sortOn=appearance&qty=99999&sortOrder=desc&playerSearch=&minCost=40&maxCost=145&positions=1%2C2%2C3%2C4&min_fdr=1&max_fdr=5&page_No=1&lowMins=false&ppm=0`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders(),
        cache: 'no-store'
      });

      if (!response.ok) {
        throw new Error(`FFH Custom API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data.results || data || [];
    } catch (error) {
      console.error('Error fetching FFH custom stats:', error);
      throw new Error(`Failed to fetch FFH custom stats: ${error.message}`);
    }
  }

  // Transform FFH data to our dashboard format
  transformFFHData(ffhPlayers) {
    return ffhPlayers.map(player => ({
      name: player.web_name || player.name || '',
      position: this.mapFFHPosition(player.element_type || player.position),
      team: this.mapFFHTeam(player.team_short_name || player.team),
      ownership: `${Math.round((player.selected_by_percent || 0))}%`,
      price: (player.now_cost || player.cost || 0) / 10, // FFH prices are in tenths
      predicted_points: player.total_points || player.points || 0,
      sleeper_points: this.convertToSleeperPoints(player.total_points || player.points || 0, player.element_type),
      form: player.form || '',
      owned_by: '', // Will be populated from Sleeper data
      is_available: true, // Will be updated from Sleeper data
      
      // Additional FFH data
      ffh_id: player.id,
      element_type: player.element_type,
      team_code: player.team_short_name,
      cost: player.now_cost || player.cost,
      minutes: player.minutes || 0,
      goals_scored: player.goals_scored || 0,
      assists: player.assists || 0,
      clean_sheets: player.clean_sheets || 0,
      goals_conceded: player.goals_conceded || 0,
      saves: player.saves || 0,
      bonus: player.bonus || 0,
      influence: player.influence || 0,
      creativity: player.creativity || 0,
      threat: player.threat || 0
    }));
  }

  // Map FFH position codes to readable positions
  mapFFHPosition(elementType) {
    const positionMap = {
      1: 'GKP',
      2: 'DEF', 
      3: 'MID',
      4: 'FWD'
    };
    return positionMap[elementType] || 'Unknown';
  }

  // Map FFH team codes
  mapFFHTeam(teamCode) {
    // Your existing team code mappings from config.gs
    const teamMap = {
      'ARS': 'ARS', 'AVL': 'AVL', 'BOU': 'BOU', 'BRE': 'BRE',
      'BHA': 'BHA', 'BUR': 'BUR', 'CHE': 'CHE', 'CRY': 'CRY',
      'EVE': 'EVE', 'FUL': 'FUL', 'LIV': 'LIV', 'LUT': 'LUT',
      'MCI': 'MCI', 'MUN': 'MUN', 'NEW': 'NEW', 'NFO': 'NFO',
      'SHU': 'SHU', 'TOT': 'TOT', 'WHU': 'WHU', 'WOL': 'WOL'
    };
    return teamMap[teamCode] || teamCode;
  }

  // Basic scoring conversion (simplified version of your Apps Script logic)
  convertToSleeperPoints(fplPoints, position) {
    // Basic conversion ratios based on your Apps Script
    const conversionRatios = {
      1: 1.2,  // GKP
      2: 1.15, // DEF 
      3: 1.1,  // MID
      4: 1.05  // FWD
    };
    
    const ratio = conversionRatios[position] || 1.0;
    return Math.round((fplPoints * ratio) * 10) / 10; // Round to 1 decimal
  }

  // Health check
  async healthCheck() {
    try {
      const testUrl = `${this.baseUrl}/player-predictions/?first=0&last=1`;
      const response = await fetch(testUrl, {
        method: 'GET',
        headers: this.getHeaders()
      });

      return {
        success: response.ok,
        status: response.status,
        message: response.ok ? 'FFH API connection successful' : 'FFH API connection failed'
      };
    } catch (error) {
      return {
        success: false,
        status: 0,
        message: `FFH API error: ${error.message}`
      };
    }
  }
}

// Export singleton instance
export const ffhApiService = new FFHApiService();