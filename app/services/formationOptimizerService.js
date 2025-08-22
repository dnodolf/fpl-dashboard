// app/services/formationOptimizerService.js

/**
 * Formation Optimizer Service for FPL Dashboard
 * Optimizes lineups using Sleeper formations and predicted points
 */

export class FormationOptimizerService {
  constructor() {
    this.leagueId = process.env.SLEEPER_LEAGUE_ID || '1240184286171107328';
    this.cache = new Map();
    this.cacheTimeout = 10 * 60 * 1000; // 10 minutes
  }

  /**
   * Valid Sleeper formations with position requirements
   */
  static VALID_FORMATIONS = {
    '3-5-2': {
      GKP: 1,
      DEF: 3,
      MID: 5,
      FWD: 2,
      total: 11,
      displayName: '3-5-2',
      description: '3 Defenders, 5 Midfielders, 2 Forwards'
    },
    '4-4-2': {
      GKP: 1,
      DEF: 4,
      MID: 4,
      FWD: 2,
      total: 11,
      displayName: '4-4-2',
      description: '4 Defenders, 4 Midfielders, 2 Forwards'
    },
    '4-5-1': {
      GKP: 1,
      DEF: 4,
      MID: 5,
      FWD: 1,
      total: 11,
      displayName: '4-5-1',
      description: '4 Defenders, 5 Midfielders, 1 Forward'
    },
    '3-4-3': {
      GKP: 1,
      DEF: 3,
      MID: 4,
      FWD: 3,
      total: 11,
      displayName: '3-4-3',
      description: '3 Defenders, 4 Midfielders, 3 Forwards'
    },
    '4-3-3': {
      GKP: 1,
      DEF: 4,
      MID: 3,
      FWD: 3,
      total: 11,
      displayName: '4-3-3',
      description: '4 Defenders, 3 Midfielders, 3 Forwards'
    },
    '5-4-1': {
      GKP: 1,
      DEF: 5,
      MID: 4,
      FWD: 1,
      total: 11,
      displayName: '5-4-1',
      description: '5 Defenders, 4 Midfielders, 1 Forward'
    }
  };

  /**
   * Fetch current roster data from Sleeper API
   */
  async fetchCurrentRoster(userId = 'ThatDerekGuy') {
    try {
      const cacheKey = `roster_${userId}`;
      const cached = this.cache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }

      // Fetch rosters and users
      const [rostersResponse, usersResponse] = await Promise.all([
        fetch(`https://api.sleeper.app/v1/league/${this.leagueId}/rosters`),
        fetch(`https://api.sleeper.app/v1/league/${this.leagueId}/users`)
      ]);

      if (!rostersResponse.ok || !usersResponse.ok) {
        throw new Error('Failed to fetch Sleeper data');
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
   * Get predicted points for a player
   */
  getPlayerPoints(player) {
    // Priority order for point sources
    if (player.sleeper_season_total) return player.sleeper_season_total / 38;
    if (player.sleeper_season_avg) return player.sleeper_season_avg;
    if (player.ffh_season_prediction) return player.ffh_season_prediction / 38;
    if (player.predicted_pts) return player.predicted_pts / 38;
    if (player.current_ppg) return player.current_ppg;
    if (player.total_points) return player.total_points / 38;
    
    // Try to extract from gameweek predictions
    if (player.sleeper_gw_predictions) {
      try {
        const gwPreds = JSON.parse(player.sleeper_gw_predictions);
        const values = Object.values(gwPreds);
        if (values.length > 0) {
          return values.reduce((a, b) => a + b, 0) / values.length;
        }
      } catch (e) {
        // Continue to next option
      }
    }
    
    return 0;
  }

  /**
   * Normalize position names
   */
  normalizePosition(player) {
    const pos = player.position?.toUpperCase();
    if (pos === 'GK' || pos === 'G') return 'GKP';
    if (pos === 'D') return 'DEF';
    if (pos === 'M') return 'MID';
    if (pos === 'F') return 'FWD';
    return pos || 'MID';
  }

  /**
   * Find optimal lineup for a given formation
   */
  optimizeFormation(formation, availablePlayers) {
    const formationConfig = FormationOptimizerService.VALID_FORMATIONS[formation];
    if (!formationConfig) {
      throw new Error(`Invalid formation: ${formation}`);
    }

    const lineup = { formation, players: [], totalPoints: 0 };
    const usedPlayers = new Set();

    // Group players by position
    const playersByPosition = {
      GKP: [],
      DEF: [],
      MID: [],
      FWD: []
    };

    availablePlayers.forEach(player => {
      const position = this.normalizePosition(player);
      const points = this.getPlayerPoints(player);
      
      if (playersByPosition[position]) {
        playersByPosition[position].push({
          ...player,
          normalizedPosition: position,
          predictedPoints: points
        });
      }
    });

    // Sort each position by predicted points (descending)
    Object.keys(playersByPosition).forEach(pos => {
      playersByPosition[pos].sort((a, b) => b.predictedPoints - a.predictedPoints);
    });

    // Select players for each position
    for (const [position, required] of Object.entries(formationConfig)) {
      if (position === 'total' || position === 'displayName' || position === 'description') continue;
      
      const availableForPosition = playersByPosition[position] || [];
      const selectedForPosition = [];
      
      for (let i = 0; i < required && i < availableForPosition.length; i++) {
        const player = availableForPosition[i];
        if (!usedPlayers.has(player.sleeper_id || player.id)) {
          selectedForPosition.push(player);
          usedPlayers.add(player.sleeper_id || player.id);
          lineup.totalPoints += player.predictedPoints;
        }
      }
      
      // If we don't have enough players for this position, formation is invalid
      if (selectedForPosition.length < required) {
        return {
          formation,
          players: [],
          totalPoints: 0,
          valid: false,
          error: `Not enough ${position} players (need ${required}, have ${selectedForPosition.length})`
        };
      }
      
      lineup.players.push(...selectedForPosition);
    }

    return {
      ...lineup,
      valid: true,
      efficiency: lineup.players.length === 11 ? 100 : (lineup.players.length / 11) * 100
    };
  }

  /**
   * Find the best formation and lineup from available players
   */
  optimizeAllFormations(availablePlayers) {
    if (!availablePlayers || availablePlayers.length === 0) {
      return {
        currentFormation: null,
        optimalFormation: null,
        recommendations: [],
        error: 'No players available'
      };
    }

    const results = [];
    const formations = Object.keys(FormationOptimizerService.VALID_FORMATIONS);

    // Test each formation
    for (const formation of formations) {
      try {
        const result = this.optimizeFormation(formation, availablePlayers);
        if (result.valid) {
          results.push(result);
        }
      } catch (error) {
        console.warn(`Formation ${formation} optimization failed:`, error.message);
      }
    }

    // Sort by total points
    results.sort((a, b) => b.totalPoints - a.totalPoints);

    return {
      allFormations: results,
      optimalFormation: results[0] || null,
      formationComparison: this.compareFormations(results)
    };
  }

  /**
   * Compare formations and generate insights
   */
  compareFormations(formationResults) {
    if (formationResults.length === 0) return [];

    const best = formationResults[0];
    const comparisons = formationResults.map((result, index) => ({
      formation: result.formation,
      points: result.totalPoints,
      rank: index + 1,
      pointsDifference: result.totalPoints - best.totalPoints,
      percentageOfBest: best.totalPoints > 0 ? (result.totalPoints / best.totalPoints) * 100 : 0
    }));

    return comparisons;
  }

  /**
   * Analyze current roster vs optimal
   */
  async analyzeCurrentRoster(players, userId = 'ThatDerekGuy') {
    try {
      // Get current roster from Sleeper
      const currentRoster = await this.fetchCurrentRoster(userId);
      
      // Get player data for current roster
      const currentPlayers = currentRoster.players
        .map(playerId => players.find(p => 
          (p.sleeper_id || p.id || p.player_id) === playerId
        ))
        .filter(Boolean);

      // Calculate current lineup points
      const currentStarters = currentRoster.starters
        .map(playerId => players.find(p => 
          (p.sleeper_id || p.id || p.player_id) === playerId
        ))
        .filter(Boolean);

      const currentPoints = currentStarters.reduce((total, player) => {
        return total + this.getPlayerPoints(player);
      }, 0);

      // Find optimal lineup from current roster
      const optimalResults = this.optimizeAllFormations(currentPlayers);
      const optimalLineup = optimalResults.optimalFormation;

      // Generate recommendations
      const recommendations = this.generateRecommendations(
        currentRoster,
        currentStarters,
        optimalLineup
      );

      return {
        current: {
          formation: currentRoster.formation,
          players: currentStarters,
          points: currentPoints,
          playerCount: currentStarters.length
        },
        optimal: optimalLineup,
        improvement: optimalLineup ? optimalLineup.totalPoints - currentPoints : 0,
        efficiency: optimalLineup && optimalLineup.totalPoints > 0 ? 
          (currentPoints / optimalLineup.totalPoints) * 100 : 0,
        recommendations,
        allFormations: optimalResults.allFormations,
        roster: currentRoster
      };
    } catch (error) {
      console.error('Error analyzing current roster:', error);
      return {
        current: null,
        optimal: null,
        improvement: 0,
        efficiency: 0,
        recommendations: [],
        error: error.message
      };
    }
  }

  /**
   * Generate specific recommendations for lineup changes
   */
  generateRecommendations(currentRoster, currentStarters, optimalLineup) {
    if (!optimalLineup || !optimalLineup.valid) {
      return [{
        type: 'error',
        message: 'Cannot generate recommendations - no valid optimal lineup found',
        impact: 0
      }];
    }

    const recommendations = [];
    const currentStarterIds = new Set(currentStarters.map(p => p.sleeper_id || p.id));
    const optimalPlayerIds = new Set(optimalLineup.players.map(p => p.sleeper_id || p.id));

    // Check if formation needs to change
    if (currentRoster.formation !== optimalLineup.formation) {
      recommendations.push({
        type: 'formation_change',
        message: `Switch formation from ${currentRoster.formation || 'Unknown'} to ${optimalLineup.formation}`,
        from: currentRoster.formation,
        to: optimalLineup.formation,
        impact: 'Formation optimization',
        priority: 'high'
      });
    }

    // Find players to add/remove
    const playersToAdd = optimalLineup.players.filter(p => 
      !currentStarterIds.has(p.sleeper_id || p.id)
    );

    const playersToRemove = currentStarters.filter(p => 
      !optimalPlayerIds.has(p.sleeper_id || p.id)
    );

    // Generate swap recommendations
    for (let i = 0; i < Math.min(playersToAdd.length, playersToRemove.length); i++) {
      const playerIn = playersToAdd[i];
      const playerOut = playersToRemove[i];
      const pointsGained = this.getPlayerPoints(playerIn) - this.getPlayerPoints(playerOut);

      recommendations.push({
        type: 'player_swap',
        message: `Replace ${playerOut.name} with ${playerIn.name}`,
        playerOut: {
          name: playerOut.name,
          position: playerOut.position,
          points: this.getPlayerPoints(playerOut)
        },
        playerIn: {
          name: playerIn.name,
          position: playerIn.position,
          points: this.getPlayerPoints(playerIn)
        },
        impact: pointsGained,
        priority: pointsGained > 1 ? 'high' : pointsGained > 0.5 ? 'medium' : 'low'
      });
    }

    // If no specific swaps, add general recommendation
    if (recommendations.length === 0 || recommendations.every(r => r.type === 'formation_change')) {
      const totalImprovement = optimalLineup.totalPoints - currentStarters.reduce((sum, p) => sum + this.getPlayerPoints(p), 0);
      
      if (totalImprovement > 0.1) {
        recommendations.push({
          type: 'general_optimization',
          message: `Your lineup can be improved by ${totalImprovement.toFixed(1)} points`,
          impact: totalImprovement,
          priority: totalImprovement > 2 ? 'high' : 'medium'
        });
      } else {
        recommendations.push({
          type: 'optimal',
          message: 'Your current lineup is already optimal!',
          impact: 0,
          priority: 'info'
        });
      }
    }

    return recommendations.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1, info: 0 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
  }
}