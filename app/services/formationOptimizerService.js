// app/services/formationOptimizerService.js

/**
 * Formation Optimizer Service for FPL Dashboard
 * Optimizes lineups using Sleeper formations and predicted points
 * ENHANCED: Now handles both FFH results and predictions arrays intelligently
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
      GK: 1,
      DEF: 3,
      MID: 5,
      FWD: 2,
      total: 11,
      displayName: '3-5-2',
      description: '3 Defenders, 5 Midfielders, 2 Forwards'
    },
    '4-4-2': {
      GK: 1,
      DEF: 4,
      MID: 4,
      FWD: 2,
      total: 11,
      displayName: '4-4-2',
      description: '4 Defenders, 4 Midfielders, 2 Forwards'
    },
    '4-5-1': {
      GK: 1,
      DEF: 4,
      MID: 5,
      FWD: 1,
      total: 11,
      displayName: '4-5-1',
      description: '4 Defenders, 5 Midfielders, 1 Forward'
    },
    '3-4-3': {
      GK: 1,
      DEF: 3,
      MID: 4,
      FWD: 3,
      total: 11,
      displayName: '3-4-3',
      description: '3 Defenders, 4 Midfielders, 3 Forwards'
    },
    '4-3-3': {
      GK: 1,
      DEF: 4,
      MID: 3,
      FWD: 3,
      total: 11,
      displayName: '4-3-3',
      description: '4 Defenders, 3 Midfielders, 3 Forwards'
    },
    '5-4-1': {
      GK: 1,
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
 * Parse formation from Sleeper metadata - ENHANCED
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
 * Calculate formation based on actual starting players' positions - FIXED FOR CONSISTENT MAPPING
 */
calculateFormationFromPlayers(players) {
  if (!players || players.length === 0) {
    return null;
  }

  // Count players by position - CONSISTENT WITH VISUALIZATION
  const positionCounts = {
    GKP: 0,   // Use GKP consistently
    DEF: 0,
    MID: 0,
    FWD: 0
  };

  players.forEach(player => {
    let position = player.position;
    
    // Normalize GK variations to GKP
    if (position === 'GK' || position === 'G') {
      position = 'GKP';
    }
    
    if (positionCounts.hasOwnProperty(position)) {
      positionCounts[position]++;
    } else {
      console.warn(`Unknown position in formation calculation: ${position} for player ${player.name || player.web_name}`);
    }
  });

  // Generate formation string (DEF-MID-FWD, GKP is assumed to be 1)
  const formation = `${positionCounts.DEF}-${positionCounts.MID}-${positionCounts.FWD}`;
  
  console.log('🏗️ Calculated formation from players:', {
    players: players.length,
    positions: positionCounts,
    formation: formation
  });

  return formation;
}

  /**
   * Get predicted points for a player - ENHANCED VERSION
   * Now handles both results and predictions arrays intelligently
   */
  getPlayerPoints(player) {
    // Priority 1: Use current gameweek prediction if available (NEW)
    if (player.current_gameweek_prediction && player.current_gameweek_prediction.predicted_pts) {
      return player.current_gameweek_prediction.predicted_pts;
    }
    
    // Priority 2: Look for current predictions from results array (active gameweeks) (NEW)
    if (player.current_predictions && Array.isArray(player.current_predictions)) {
      const sortedCurrent = player.current_predictions.sort((a, b) => b.gw - a.gw);
      if (sortedCurrent.length > 0 && sortedCurrent[0].predicted_pts) {
        return sortedCurrent[0].predicted_pts;
      }
    }
    
    // Priority 3: Look for upcoming predictions (future gameweeks) (NEW)
    if (player.upcoming_predictions && Array.isArray(player.upcoming_predictions)) {
      const sortedUpcoming = player.upcoming_predictions.sort((a, b) => a.gw - b.gw);
      if (sortedUpcoming.length > 0 && sortedUpcoming[0].predicted_pts) {
        return sortedUpcoming[0].predicted_pts;
      }
    }
    
    // Priority 4: Use all predictions array (fallback) (NEW)
    if (player.predictions && Array.isArray(player.predictions)) {
      const validPredictions = player.predictions
        .filter(p => p.predicted_pts && typeof p.predicted_pts === 'number')
        .sort((a, b) => a.gw - b.gw);
      
      if (validPredictions.length > 0) {
        return validPredictions[0].predicted_pts;
      }
    }
    
    // Priority 5: Season-based averages (EXISTING)
    if (player.sleeper_season_total) return player.sleeper_season_total / 38;
    if (player.sleeper_season_avg) return player.sleeper_season_avg;
    if (player.ffh_season_prediction) return player.ffh_season_prediction / 38;
    if (player.predicted_pts) return player.predicted_pts / 38;
    if (player.current_ppg) return player.current_ppg;
    if (player.total_points) return player.total_points / 38;
    
    // Priority 6: Try to extract from gameweek predictions JSON (EXISTING)
    if (player.sleeper_gw_predictions) {
      try {
        const gwPreds = JSON.parse(player.sleeper_gw_predictions);
        const values = Object.values(gwPreds);
        if (values.length > 0) {
          // Return average of next few gameweeks
          const next3 = values.slice(0, 3);
          return next3.reduce((a, b) => a + b, 0) / next3.length;
        }
      } catch (e) {
        // Continue to next option
      }
    }
    
    return 0;
  }

  /**
   * Get predicted minutes for a player - ENHANCED VERSION
   * Now handles both results and predictions arrays intelligently
   */
  getPlayerMinutes(player) {
    // Priority 1: Use current gameweek prediction if available (NEW)
    if (player.current_gameweek_prediction && player.current_gameweek_prediction.predicted_mins) {
      return player.current_gameweek_prediction.predicted_mins;
    }
    
    // Priority 2: Look for current predictions from results array (NEW)
    if (player.current_predictions && Array.isArray(player.current_predictions)) {
      const sortedCurrent = player.current_predictions.sort((a, b) => b.gw - a.gw);
      if (sortedCurrent.length > 0 && sortedCurrent[0].predicted_mins) {
        return sortedCurrent[0].predicted_mins;
      }
    }
    
    // Priority 3: Look for upcoming predictions (NEW)
    if (player.upcoming_predictions && Array.isArray(player.upcoming_predictions)) {
      const sortedUpcoming = player.upcoming_predictions.sort((a, b) => a.gw - b.gw);
      if (sortedUpcoming.length > 0 && sortedUpcoming[0].predicted_mins) {
        return sortedUpcoming[0].predicted_mins;
      }
    }
    
    // Priority 4: Use all predictions array (fallback) (NEW)
    if (player.predictions && Array.isArray(player.predictions)) {
      const validPredictions = player.predictions
        .filter(p => p.predicted_mins && typeof p.predicted_mins === 'number')
        .sort((a, b) => a.gw - b.gw);
      
      if (validPredictions.length > 0) {
        return validPredictions[0].predicted_mins;
      }
    }
    
    // Priority 5: Use pre-calculated average (EXISTING)
    if (player.avg_minutes_next5) return player.avg_minutes_next5;
    
    // Priority 6: Try to extract from gameweek minutes JSON (EXISTING)
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
  console.log(`🔍 First 3 players:`, availablePlayers.slice(0, 3).map(p => ({
    name: p.name || p.web_name || 'Unknown',
    position: p.position,
    id: p.id || p.player_id || p.sleeper_id
  })));

  // Group players by position - CONSISTENT MAPPING TO MATCH FORMATION VISUALIZATION
  const playersByPosition = {
    GKP: [], // Use GKP to match FormationVisualization
    DEF: [],
    MID: [],
    FWD: []
  };

  availablePlayers.forEach(player => {
    // Normalize position to match FormationVisualization expectations
    let position = player.position;
    
    // Convert various GK formats to GKP for consistency
    if (position === 'GK' || position === 'G') {
      position = 'GKP';
    }
    
    if (playersByPosition.hasOwnProperty(position)) {
      playersByPosition[position].push({
        ...player,
        position: position, // Ensure position is normalized
        points: this.getPlayerPoints(player)
      });
    } else {
      console.warn(`🚨 Unknown position: "${position}" for player ${player.name || player.web_name}`);
    }
  });

  // DEBUG: Log position counts
  console.log(`📊 ${formationType} position counts:`, {
    GKP: playersByPosition.GKP.length,
    DEF: playersByPosition.DEF.length,
    MID: playersByPosition.MID.length,
    FWD: playersByPosition.FWD.length
  });

  // Sort each position by points (descending)
  Object.keys(playersByPosition).forEach(position => {
    playersByPosition[position].sort((a, b) => (b.points || 0) - (a.points || 0));
  });

  // UPDATED: Check requirements using formation config but match to our position groups
  const positionMapping = {
    GK: 'GKP', // Formation config uses GK, we use GKP
    DEF: 'DEF',
    MID: 'MID',
    FWD: 'FWD'
  };

  const missingPositions = [];
  Object.entries(formationConfig).forEach(([configPosition, required]) => {
    if (configPosition === 'total' || configPosition === 'displayName' || configPosition === 'description') return;
    
    const ourPosition = positionMapping[configPosition] || configPosition;
    const available = playersByPosition[ourPosition]?.length || 0;
    
    if (available < required) {
      missingPositions.push(`${configPosition}: need ${required}, have ${available}`);
    }
  });

  if (missingPositions.length > 0) {
    console.log(`❌ ${formationType} failed:`, missingPositions.join(', '));
    return {
      formation: formationType,
      valid: false,
      reason: `Missing players: ${missingPositions.join(', ')}`,
      totalPoints: 0,
      players: []
    };
  }

  // Select the best players for each position using the mapping
  const selectedPlayers = [];
  let totalPoints = 0;

  Object.entries(formationConfig).forEach(([configPosition, required]) => {
    if (configPosition === 'total' || configPosition === 'displayName' || configPosition === 'description') return;
    
    const ourPosition = positionMapping[configPosition] || configPosition;
    const bestPlayers = playersByPosition[ourPosition].slice(0, required);
    selectedPlayers.push(...bestPlayers);
    totalPoints += bestPlayers.reduce((sum, player) => sum + (player.points || 0), 0);
  });

  console.log(`✅ ${formationType} successful: ${totalPoints.toFixed(1)} pts with ${selectedPlayers.length} players`);

  return {
    formation: formationType,
    valid: true,
    players: selectedPlayers,
    totalPoints: totalPoints,
    points: totalPoints, // Add this alias for compatibility
    efficiency: this.calculateFormationEfficiency ? this.calculateFormationEfficiency(selectedPlayers) : 100,
    playerCount: selectedPlayers.length
  };
}

/**
 * Find the best formation and lineup from available players - ENHANCED
 * Now ensures all formations are tested even if they don't have optimal players
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
  
  console.log('🔍 Testing formations:', formations);

  // Test each formation
  for (const formation of formations) {
    try {
      const result = this.optimizeFormation(formation, availablePlayers);
      
      // Always add result even if not completely valid
      // This ensures all formations appear in comparison
      if (result.valid) {
        results.push(result);
        console.log(`✅ ${formation}: ${result.totalPoints.toFixed(1)} pts (valid)`);
      } else {
        // Create a placeholder result for invalid formations
        const placeholderResult = {
          formation: formation,
          totalPoints: 0,
          players: [],
          valid: false,
          reason: result.reason || 'Not enough players for this formation'
        };
        results.push(placeholderResult);
        console.log(`❌ ${formation}: 0.0 pts (invalid - ${placeholderResult.reason})`);
      }
    } catch (error) {
      console.warn(`Formation ${formation} optimization failed:`, error.message);
      
      // Add placeholder for failed formations too
      const errorResult = {
        formation: formation,
        totalPoints: 0,
        players: [],
        valid: false,
        reason: `Error: ${error.message}`
      };
      results.push(errorResult);
    }
  }

  // Sort by total points (valid formations first, then invalid)
  results.sort((a, b) => {
    if (a.valid && !b.valid) return -1;
    if (!a.valid && b.valid) return 1;
    return (b.totalPoints || 0) - (a.totalPoints || 0);
  });

  console.log('🏆 Formation results:', results.map(r => ({
    formation: r.formation,
    points: r.totalPoints,
    valid: r.valid
  })));

return {
  allFormations: results.map(result => ({
    ...result,
    formation: result.formation || result.name, // Ensure formation property exists
    name: result.formation || result.name       // Keep name for compatibility
  })),
  optimalFormation: results.find(r => r.valid) || null,
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
 * Analyze current roster vs optimal - ENHANCED WITH FORMATION CALCULATION
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

    // ENHANCED: Calculate actual formation from starting players
    const actualFormation = this.calculateFormationFromPlayers(currentStarters);
    const metadataFormation = currentRoster.formation;
    
    console.log('🔍 Formation Debug:', {
      metadata: metadataFormation,
      calculated: actualFormation,
      starters: currentStarters.length,
      starterPositions: currentStarters.map(p => ({ name: p.name || p.web_name, position: p.position }))
    });

    // Use calculated formation as primary, metadata as fallback
    const currentFormation = actualFormation || metadataFormation;

    const currentPoints = currentStarters.reduce((total, player) => {
      return total + this.getPlayerPoints(player);
    }, 0);

    // Find optimal lineup from current roster
    const optimalResults = this.optimizeAllFormations(currentPlayers);
    const optimalLineup = optimalResults.optimalFormation;

    // Generate recommendations with enhanced prediction info
    const recommendations = this.generateRecommendations(
      { ...currentRoster, formation: currentFormation }, // Use calculated formation
      currentStarters,
      optimalLineup
    );

    // Add prediction source analysis
    const predictionAnalysis = this.analyzePredictionSources(currentStarters);

    return {
      current: {
        formation: currentFormation, // Use calculated formation
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
      roster: { ...currentRoster, formation: currentFormation }, // Use calculated formation
      predictionAnalysis,
      formationDebug: {
        metadata: metadataFormation,
        calculated: actualFormation,
        final: currentFormation
      }
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
   * Analyze prediction sources for transparency - NEW METHOD
   */
  analyzePredictionSources(players) {
    const sources = {
      current_gameweek: 0,
      results_array: 0,
      predictions_array: 0,
      season_average: 0,
      fallback: 0
    };

    players.forEach(player => {
      if (player.current_gameweek_prediction) {
        sources.current_gameweek++;
      } else if (player.current_predictions && player.current_predictions.length > 0) {
        sources.results_array++;
      } else if (player.upcoming_predictions && player.upcoming_predictions.length > 0) {
        sources.predictions_array++;
      } else if (player.sleeper_season_total || player.sleeper_season_avg) {
        sources.season_average++;
      } else {
        sources.fallback++;
      }
    });

    return {
      sources,
      total: players.length,
      quality: sources.current_gameweek + sources.results_array + sources.predictions_array,
      qualityPercentage: players.length > 0 ? 
        Math.round(((sources.current_gameweek + sources.results_array + sources.predictions_array) / players.length) * 100) : 0
    };
  }

  /**
   * Generate specific recommendations for lineup changes - ENHANCED
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

    // Generate swap recommendations with enhanced prediction info
    for (let i = 0; i < Math.min(playersToAdd.length, playersToRemove.length); i++) {
      const playerIn = playersToAdd[i];
      const playerOut = playersToRemove[i];
      const pointsGained = this.getPlayerPoints(playerIn) - this.getPlayerPoints(playerOut);
      
      // NEW: Get prediction source info
      const playerInSource = this.getPredictionSource(playerIn);
      const playerOutSource = this.getPredictionSource(playerOut);

      recommendations.push({
        type: 'player_swap',
        message: `Replace ${playerOut.name} with ${playerIn.name}`,
        playerOut: {
          name: playerOut.name,
          position: playerOut.position,
          points: this.getPlayerPoints(playerOut),
          predictionSource: playerOutSource // NEW
        },
        playerIn: {
          name: playerIn.name,
          position: playerIn.position,
          points: this.getPlayerPoints(playerIn),
          predictionSource: playerInSource // NEW
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
   * Get prediction source for a player - NEW METHOD
   */
  getPredictionSource(player) {
    if (player.current_gameweek_prediction) {
      return `Current GW${player.current_gameweek_prediction.gw} (${player.current_gameweek_prediction.source})`;
    }
    if (player.current_predictions && player.current_predictions.length > 0) {
      return `Results array (GW${player.current_predictions[0].gw})`;
    }
    if (player.upcoming_predictions && player.upcoming_predictions.length > 0) {
      return `Predictions array (GW${player.upcoming_predictions[0].gw})`;
    }
    if (player.sleeper_season_total) {
      return 'Season average';
    }
    return 'Fallback';
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
  }
}