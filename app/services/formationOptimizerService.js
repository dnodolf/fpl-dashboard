// app/services/formationOptimizerService.js
// Updated to use unified position utilities - SLEEPER AUTHORITY

import { normalizePosition } from '../../utils/positionUtils.js';

export class FormationOptimizerService {
  constructor() {
    this.cache = new Map();
  }

  // Valid formation configurations - exactly 6 formations to evaluate
  static VALID_FORMATIONS = {
    '3-5-2': { GKP: 1, DEF: 3, MID: 5, FWD: 2 },
    '4-4-2': { GKP: 1, DEF: 4, MID: 4, FWD: 2 },
    '4-5-1': { GKP: 1, DEF: 4, MID: 5, FWD: 1 },
    '3-4-3': { GKP: 1, DEF: 3, MID: 4, FWD: 3 },
    '4-3-3': { GKP: 1, DEF: 4, MID: 3, FWD: 3 },
    '5-4-1': { GKP: 1, DEF: 5, MID: 4, FWD: 1 }
  };

  /**
   * Get player's predicted points - enhanced with multiple fallback strategies including v3 scoring
   */
  getPlayerPoints(player) {
    // Priority 0: V3 current gameweek prediction (if available)
    if (player.v3_current_gw && player.v3_current_gw > 0) {
      return player.v3_current_gw;
    }
    
    // Priority 1: Use current gameweek Sleeper prediction
    if (player.current_gw_prediction && player.current_gw_prediction > 0) {
      return player.current_gw_prediction;
    }
    
    // Priority 2: Use next gameweek prediction
    if (player.next_gw_prediction && player.next_gw_prediction > 0) {
      return player.next_gw_prediction;
    }
    
    // Priority 3: V3 season average (if available)
    if (player.v3_season_avg && player.v3_season_avg > 0) {
      return player.v3_season_avg;
    }
    
    // Priority 4: Use predicted PPG
    if (player.predicted_ppg && player.predicted_ppg > 0) {
      return player.predicted_ppg;
    }
    
    // Priority 5: Use season average
    if (player.sleeper_season_avg && player.sleeper_season_avg > 0) {
      return player.sleeper_season_avg;
    }
    
    // Priority 6: Use current PPG
    if (player.current_ppg && player.current_ppg > 0) {
      return player.current_ppg;
    }
    
    // Priority 6: Extract from gameweek predictions JSON
    if (player.sleeper_gw_predictions) {
      try {
        const gwPreds = JSON.parse(player.sleeper_gw_predictions);
        const values = Object.values(gwPreds);
        if (values.length > 0) {
          const avg = values.reduce((a, b) => a + b, 0) / values.length;
          if (avg > 0) return Math.round(avg * 100) / 100;
        }
      } catch (e) {
        // Continue to fallback
      }
    }
    
    return 0; // Default to 0 if no predictions available
  }

  /**
   * Get player's predicted minutes - enhanced with multiple fallback strategies
   */
  getPlayerMinutes(player) {
    // Priority 1: Use avg_predicted_minutes if available
    if (player.avg_predicted_minutes && player.avg_predicted_minutes > 0) {
      return player.avg_predicted_minutes;
    }
    
    // Priority 2: Use predicted_minutes (current gameweek)
    if (player.predicted_minutes && player.predicted_minutes > 0) {
      return player.predicted_minutes;
    }
    
    // Priority 3: Use minutes from player data
    if (player.minutes && player.minutes > 0) {
      return player.minutes;
    }
    
    // Priority 4: Use avg_minutes if available
    if (player.avg_minutes && player.avg_minutes > 0) {
      return player.avg_minutes;
    }
    
    // Priority 5: Use avg_minutes_next5 if available
    if (player.avg_minutes_next5 && player.avg_minutes_next5 > 0) {
      return player.avg_minutes_next5;
    }
    
    // Priority 6: Try to extract from gameweek minutes JSON
    if (player.ffh_gw_minutes) {
      try {
        const gwMins = JSON.parse(player.ffh_gw_minutes);
        const values = Object.values(gwMins);
        if (values.length > 0) {
          return values[0]; // Return next gameweek minutes
        }
      } catch (e) {
        // Continue to fallback
      }
    }
    
    return 90; // Default full minutes
  }

  /**
   * Enhanced formation optimization that provides better error messages
   */
  optimizeFormation(formationType, availablePlayers) {
    const formationConfig = FormationOptimizerService.VALID_FORMATIONS[formationType];
    
    if (!formationConfig) {
      return {
        formation: formationType,
        valid: false,
        reason: 'Unknown formation type',
        totalPoints: 0,
        players: []
      };
    }

    console.log(`🔍 ${formationType} - Available players:`, availablePlayers.length);

    // Group players by position using unified position logic
    const playersByPosition = {
      GKP: [],
      DEF: [],
      MID: [],
      FWD: []
    };

    availablePlayers.forEach(player => {
      // Use unified position normalization
      const position = normalizePosition(player);
      
      if (playersByPosition.hasOwnProperty(position)) {
        playersByPosition[position].push({
          ...player,
          position: position, // Ensure position is normalized
          points: this.getPlayerPoints(player)
        });
      } else {
        console.warn(`🚨 Invalid position: "${position}" for player ${player.name || player.web_name}`);
      }
    });

    // DEBUG: Log position counts
    console.log(`📊 ${formationType} position distribution:`, {
      GKP: playersByPosition.GKP.length,
      DEF: playersByPosition.DEF.length, 
      MID: playersByPosition.MID.length,
      FWD: playersByPosition.FWD.length
    });

    // Check if we have enough players for this formation
    const requirements = formationConfig;
    for (const [pos, needed] of Object.entries(requirements)) {
      const available = playersByPosition[pos].length;
      if (available < needed) {
        return {
          formation: formationType,
          valid: false,
          reason: `Not enough ${pos} players (need ${needed}, have ${available})`,
          totalPoints: 0,
          players: [],
          requirements,
          available: playersByPosition
        };
      }
    }

    // Sort players by points descending within each position
    Object.keys(playersByPosition).forEach(pos => {
      playersByPosition[pos].sort((a, b) => (b.points || 0) - (a.points || 0));
    });

    // Select optimal players for this formation
    const selectedPlayers = [];
    let totalPoints = 0;

    Object.entries(requirements).forEach(([pos, count]) => {
      const topPlayers = playersByPosition[pos].slice(0, count);
      selectedPlayers.push(...topPlayers);
      totalPoints += topPlayers.reduce((sum, p) => sum + (p.points || 0), 0);
    });

    return {
      formation: formationType,
      valid: true,
      totalPoints: Math.round(totalPoints * 100) / 100,
      players: selectedPlayers,
      requirements,
      available: playersByPosition
    };
  }

  /**
   * Optimize all valid formations for given players
   */
  optimizeAllFormations(availablePlayers) {
    const formations = Object.keys(FormationOptimizerService.VALID_FORMATIONS);
    const results = [];

    formations.forEach(formation => {
      const result = this.optimizeFormation(formation, availablePlayers);
      results.push(result);
    });

    // Sort by total points descending
    results.sort((a, b) => (b.totalPoints || 0) - (a.totalPoints || 0));

    return results;
  }

  /**
   * Get current roster for a user
   */
  async getCurrentRoster(userId) {
    const cacheKey = `roster_${userId}`;
    
    // Check cache
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < 300000) { // 5 minutes
        return cached.data;
      }
    }

    try {
      const leagueId = process.env.SLEEPER_LEAGUE_ID || '1240184286171107328';
      
      const [rostersResponse, usersResponse] = await Promise.all([
        fetch(`https://api.sleeper.app/v1/league/${leagueId}/rosters`),
        fetch(`https://api.sleeper.app/v1/league/${leagueId}/users`)
      ]);

      if (!rostersResponse.ok || !usersResponse.ok) {
        throw new Error('Failed to fetch roster data');
      }

      const [rosters, users] = await Promise.all([
        rostersResponse.json(),
        usersResponse.json()
      ]);

      // Find user by name
      const user = users.find(u => 
        (u.display_name || u.username || '').toLowerCase().includes(userId.toLowerCase())
      );

      if (!user) {
        throw new Error(`User ${userId} not found`);
      }

      // Find roster for this user
      const roster = rosters.find(r => r.owner_id === user.user_id);
      
      if (!roster) {
        throw new Error(`No roster found for ${userId}`);
      }

      const result = {
        userId: user.user_id,
        userName: user.display_name || user.username,
        rosterId: roster.roster_id,
        players: roster.players || [],
        starters: roster.starters || [],
        formation: this.parseFormation(roster.metadata?.formation),
        wins: roster.settings?.wins || 0,
        losses: roster.settings?.losses || 0,
        points: roster.settings?.fpts || 0,
        pointsAgainst: roster.settings?.fpts_against || 0
      };

      // Cache the result
      this.cache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });

      return result;
    } catch (error) {
      console.error('Error fetching current roster:', error);
      throw error;
    }
  }

  /**
   * Parse formation from Sleeper metadata
   */
  parseFormation(formationString) {
    if (!formationString) return null;
    
    try {
      const formations = JSON.parse(formationString);
      // Get the primary formation (usually key "1")
      return formations["1"] || Object.values(formations)[0] || null;
    } catch (error) {
      console.warn('Failed to parse formation:', formationString);
      return null;
    }
  }

  /**
   * Calculate formation based on actual starting players' positions
   */
  calculateFormationFromPlayers(players) {
    if (!players || players.length === 0) {
      return null;
    }

    // Count players by position using unified logic
    const positionCounts = {
      GKP: 0,
      DEF: 0,
      MID: 0,
      FWD: 0
    };

    players.forEach(player => {
      const position = normalizePosition(player); // Use unified logic
      
      if (positionCounts.hasOwnProperty(position)) {
        positionCounts[position]++;
      } else {
        console.warn(`🚨 Unknown position "${position}" for player ${player.name}`);
      }
    });

    // Build formation string (excluding goalkeeper)
    return `${positionCounts.DEF}-${positionCounts.MID}-${positionCounts.FWD}`;
  }

  /**
   * Analyze current roster and provide optimization recommendations
   */
  async analyzeCurrentRoster(allPlayers, userId) {
    try {
      console.log(`🔍 Analyzing roster for ${userId}...`);
      
      // Get current roster from Sleeper
      const rosterInfo = await this.getCurrentRoster(userId);
      
      // Filter to only owned players
      const myPlayers = allPlayers.filter(p => {
        const playerId = p.sleeper_id || p.player_id || p.id;
        return rosterInfo.players.includes(playerId);
      });

      console.log(`📋 Found ${myPlayers.length} owned players for ${rosterInfo.userName}`);

      if (myPlayers.length === 0) {
        return {
          error: `No players found for ${userId}. Check if the username is correct.`,
          roster: rosterInfo
        };
      }

      // Debug position distribution
      const positionCounts = {};
      myPlayers.forEach(player => {
        const pos = normalizePosition(player);
        positionCounts[pos] = (positionCounts[pos] || 0) + 1;
      });
      
      console.log('📊 Position distribution:', positionCounts);

      // Get current formation from starters
      const currentStarters = myPlayers.filter(p => {
        const playerId = p.sleeper_id || p.player_id || p.id;
        return rosterInfo.starters.includes(playerId);
      });

      const currentFormation = this.calculateFormationFromPlayers(currentStarters);
      const currentPoints = currentStarters.reduce((sum, p) => sum + this.getPlayerPoints(p), 0);

      console.log(`📈 Current: ${currentFormation} with ${currentPoints.toFixed(1)} points`);

      // Optimize all possible formations
      const allFormationResults = this.optimizeAllFormations(myPlayers);
      const validFormations = allFormationResults.filter(f => f.valid);
      
      if (validFormations.length === 0) {
        return {
          error: 'No valid formations possible with current roster',
          roster: rosterInfo,
          current: {
            formation: currentFormation,
            points: currentPoints,
            players: currentStarters
          }
        };
      }

      const optimalFormation = validFormations[0];
      const improvement = optimalFormation.totalPoints - currentPoints;
      const efficiency = currentPoints > 0 ? (currentPoints / optimalFormation.totalPoints) * 100 : 0;

      // Generate recommendations
      const recommendations = [];
      
      if (currentFormation !== optimalFormation.formation) {
        recommendations.push({
          type: 'formation_change',
          message: `Switch from ${currentFormation} to ${optimalFormation.formation}`,
          impact: 0, // Don't show points for formation changes
          formation: optimalFormation.formation
        });
      }

      // Player swap recommendations
      const currentPlayerIds = new Set(currentStarters.map(p => p.sleeper_id || p.player_id || p.id));
      const benchPlayers = myPlayers.filter(p => !currentPlayerIds.has(p.sleeper_id || p.player_id || p.id));
      
      benchPlayers.forEach(benchPlayer => {
        const benchPosition = normalizePosition(benchPlayer);
        const benchPoints = this.getPlayerPoints(benchPlayer);
        
        currentStarters.forEach(starter => {
          const starterPosition = normalizePosition(starter);
          const starterPoints = this.getPlayerPoints(starter);
          
          if (benchPosition === starterPosition && benchPoints > starterPoints + 0.5) {
            recommendations.push({
              type: 'player_swap',
              message: `Start ${benchPlayer.web_name || benchPlayer.name} over ${starter.web_name || starter.name}`,
              impact: benchPoints - starterPoints,
              benchPlayer: benchPlayer,
              starterPlayer: starter
            });
          }
        });
      });

      return {
        roster: rosterInfo,
        current: {
          formation: currentFormation,
          points: Math.round(currentPoints * 100) / 100,
          players: currentStarters
        },
        optimal: optimalFormation,
        improvement: Math.round(improvement * 100) / 100,
        efficiency: Math.round(efficiency * 100) / 100,
        recommendations: recommendations.slice(0, 5), // Top 5 recommendations
        allFormations: allFormationResults
      };

    } catch (error) {
      console.error('Error analyzing roster:', error);
      return {
        error: error.message,
        roster: null
      };
    }
  }

  /**
   * Clear cache (for testing)
   */
  clearCache() {
    this.cache.clear();
    console.log('🔄 Formation optimizer cache cleared');
  }
}