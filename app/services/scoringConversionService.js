// app/services/scoringConversionService.js

export class ScoringConversionService {
  constructor() {
    this.cachedScoringSettings = null;
    this.cachedConversionRatios = null;
  }

  // FPL Scoring System (what FFH predictions are based on)
  getFPLScoringSystem() {
    return {
      goals: { GKP: 6, DEF: 6, MID: 5, FWD: 4 },
      assists: { GKP: 3, DEF: 3, MID: 3, FWD: 3 },
      clean_sheets: { GKP: 4, DEF: 4, MID: 1, FWD: 0 },
      goals_conceded: { GKP: -1, DEF: -1, MID: 0, FWD: 0 }, // per 2 goals
      yellow_cards: { GKP: -1, DEF: -1, MID: -1, FWD: -1 },
      red_cards: { GKP: -3, DEF: -3, MID: -3, FWD: -3 },
      own_goals: { GKP: -2, DEF: -2, MID: -2, FWD: -2 },
      penalty_missed: { GKP: -2, DEF: -2, MID: -2, FWD: -2 },
      penalty_saved: { GKP: 5, DEF: 0, MID: 0, FWD: 0 },
      saves: { GKP: 1, DEF: 0, MID: 0, FWD: 0 }, // per 3 saves
      bonus: { GKP: 1, DEF: 1, MID: 1, FWD: 1 }, // 1-3 points based on BPS
      minutes: { GKP: 1, DEF: 1, MID: 1, FWD: 1 } // 1 point for 60+ mins
    };
  }

  // Fetch Sleeper league scoring settings
  async fetchSleeperScoringSettings(leagueId) {
    if (this.cachedScoringSettings) {
      return this.cachedScoringSettings;
    }

    try {
      const response = await fetch(`https://api.sleeper.app/v1/league/${leagueId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store'
      });

      if (!response.ok) {
        throw new Error(`Sleeper league API failed: ${response.status}`);
      }

      const data = await response.json();
      this.cachedScoringSettings = data.scoring_settings || {};
      
      console.log('Fetched Sleeper scoring settings:', Object.keys(this.cachedScoringSettings).length, 'rules');
      return this.cachedScoringSettings;

    } catch (error) {
      console.error('Error fetching Sleeper scoring settings:', error);
      throw error;
    }
  }

  // Calculate position-specific conversion ratios
  async calculateScoringConversionRatios(leagueId) {
    if (this.cachedConversionRatios) {
      return this.cachedConversionRatios;
    }

    try {
      const sleeperScoring = await this.fetchSleeperScoringSettings(leagueId);
      const fplScoring = this.getFPLScoringSystem();
      
      const positions = ['GKP', 'DEF', 'MID', 'FWD'];
      const conversionRatios = {};

      positions.forEach(position => {
        const ratio = this.calculatePositionRatio(position, fplScoring, sleeperScoring);
        conversionRatios[position] = ratio;
      });

      this.cachedConversionRatios = conversionRatios;
      console.log('Calculated conversion ratios:', conversionRatios);
      
      return conversionRatios;

    } catch (error) {
      console.error('Error calculating conversion ratios:', error);
      // Return default ratios if calculation fails
      return {
        GKP: { multiplier: 1.2, breakdown: {} },
        DEF: { multiplier: 1.15, breakdown: {} },
        MID: { multiplier: 1.1, breakdown: {} },
        FWD: { multiplier: 1.05, breakdown: {} }
      };
    }
  }

  // Calculate ratio for a specific position
  calculatePositionRatio(position, fplScoring, sleeperScoring) {
    const breakdown = {};
    let totalWeightedRatio = 0;
    let totalWeight = 0;

    // Compare each scoring category
    const categories = ['goals', 'assists', 'clean_sheets', 'yellow_cards', 'red_cards'];
    
    categories.forEach(category => {
      const fplValue = fplScoring[category]?.[position] || 0;
      let sleeperValue = 0;

      // Map FPL categories to Sleeper categories
      switch (category) {
        case 'goals':
          sleeperValue = sleeperScoring.goal || sleeperScoring.goals_scored || 0;
          break;
        case 'assists':
          sleeperValue = sleeperScoring.assist || sleeperScoring.assists || 0;
          break;
        case 'clean_sheets':
          sleeperValue = sleeperScoring.clean_sheet || sleeperScoring.cs || 0;
          break;
        case 'yellow_cards':
          sleeperValue = sleeperScoring.yellow_card || sleeperScoring.yc || 0;
          break;
        case 'red_cards':
          sleeperValue = sleeperScoring.red_card || sleeperScoring.rc || 0;
          break;
      }

      if (fplValue !== 0 && sleeperValue !== 0) {
        const ratio = sleeperValue / fplValue;
        const weight = Math.abs(fplValue); // Weight by importance
        
        breakdown[category] = ratio;
        totalWeightedRatio += ratio * weight;
        totalWeight += weight;
      }
    });

    // Calculate overall multiplier
    const multiplier = totalWeight > 0 ? totalWeightedRatio / totalWeight : this.getDefaultMultiplier(position);

    return {
      multiplier: Math.round(multiplier * 100) / 100, // Round to 2 decimal places
      breakdown
    };
  }

  // Get default multiplier if calculation fails
  getDefaultMultiplier(position) {
    const defaults = {
      'GKP': 1.2,
      'DEF': 1.15,
      'MID': 1.1,
      'FWD': 1.05
    };
    return defaults[position] || 1.0;
  }

  // Convert FFH prediction to Sleeper points
  convertFFHToSleeperPrediction(fplPoints, position, conversionRatios) {
    if (!fplPoints || fplPoints <= 0) return 0;
    
    const ratio = conversionRatios[position]?.multiplier || this.getDefaultMultiplier(position);
    return Math.round((fplPoints * ratio) * 10) / 10; // Round to 1 decimal place
  }

  // Convert FFH gameweek predictions to Sleeper scoring
  convertFFHGWPredictionsToSleeper(ffhGwPredictions, position, conversionRatios) {
    if (!ffhGwPredictions || typeof ffhGwPredictions !== 'object') {
      return {};
    }

    const sleeperGwPredictions = {};
    const ratio = conversionRatios[position]?.multiplier || this.getDefaultMultiplier(position);

    Object.entries(ffhGwPredictions).forEach(([gw, points]) => {
      if (typeof points === 'number' && points > 0) {
        sleeperGwPredictions[gw] = Math.round((points * ratio) * 10) / 10;
      }
    });

    return sleeperGwPredictions;
  }

  // Get FFH prediction data from player object
  getFFHRangePrediction(ffhPlayer) {
    try {
      // Try different possible structures
      if (ffhPlayer.total_points) return ffhPlayer.total_points;
      if (ffhPlayer.predicted_points) return ffhPlayer.predicted_points;
      if (ffhPlayer.points) return ffhPlayer.points;
      
      // Try nested structures
      if (ffhPlayer.player?.total_points) return ffhPlayer.player.total_points;
      if (ffhPlayer.player?.predicted_points) return ffhPlayer.player.predicted_points;
      
      return 0;
    } catch (error) {
      console.warn('Error extracting FFH prediction:', error);
      return 0;
    }
  }

  // Get FFH gameweek predictions
  getFFHGwPredictions(ffhPlayer) {
    try {
      const predictions = {};
      const predArray = ffhPlayer.predictions || ffhPlayer.player?.predictions || [];
      
      if (Array.isArray(predArray)) {
        predArray.forEach(item => {
          if (!item) return;
          
          const gw = Number(item.gw);
          let pts = null;
          
          if (typeof item.predicted_pts === 'number') {
            pts = item.predicted_pts;
          } else if (item.predicted_pts?.predicted_pts) {
            pts = item.predicted_pts.predicted_pts;
          } else if (typeof item.predicted_pts === 'string') {
            const n = Number(item.predicted_pts);
            if (!isNaN(n)) pts = n;
          }
          
          if (gw && !isNaN(gw) && typeof pts === 'number') {
            predictions[String(gw)] = pts;
          }
        });
      }
      
      return predictions;
    } catch (error) {
      console.warn('Error extracting FFH GW predictions:', error);
      return {};
    }
  }

  // Create enhanced player record with scoring conversion
  createEnhancedPlayerRecord(sleeperPlayer, ffhPlayer, conversionRatios, ownershipMap = {}) {
    const position = this.normalizePosition(sleeperPlayer.position);
    
    // Get FFH predictions
    const ffhSeasonPrediction = this.getFFHRangePrediction(ffhPlayer);
    const ffhGwPredictions = this.getFFHGwPredictions(ffhPlayer);
    
    // Convert to Sleeper predictions
    const sleeperSeasonTotal = this.convertFFHToSleeperPrediction(ffhSeasonPrediction, position, conversionRatios);
    const sleeperSeasonAvg = sleeperSeasonTotal / 38; // Assuming 38 gameweeks
    const sleeperGwPredictions = this.convertFFHGWPredictionsToSleeper(ffhGwPredictions, position, conversionRatios);
    
    // Get ownership info
    const ownerName = ownershipMap[sleeperPlayer.sleeper_id] || '';
    
    return {
      // Core identifiers
      player_id: sleeperPlayer.sleeper_id,
      sleeper_id: sleeperPlayer.sleeper_id,
      ffh_id: ffhPlayer.id || ffhPlayer.element_id,
      
      // Player info
      name: sleeperPlayer.name || sleeperPlayer.full_name,
      full_name: sleeperPlayer.name || sleeperPlayer.full_name,
      first_name: sleeperPlayer.first_name || '',
      last_name: sleeperPlayer.last_name || '',
      position,
      team: sleeperPlayer.team,
      
      // Ownership
      owner_name: ownerName,
      owned_by: ownerName,
      is_available: !ownerName,
      
      // FFH Original Data
      ffh_season_prediction: ffhSeasonPrediction,
      ffh_gw_predictions: JSON.stringify(ffhGwPredictions),
      ffh_web_name: ffhPlayer.web_name || ffhPlayer.name,
      ffh_team: ffhPlayer.team_short_name || ffhPlayer.team,
      ffh_price: (ffhPlayer.now_cost || ffhPlayer.cost || 0) / 10,
      
      // Sleeper Converted Data
      sleeper_season_total: sleeperSeasonTotal,
      sleeper_season_avg: Math.round(sleeperSeasonAvg * 100) / 100,
      sleeper_gw_predictions: JSON.stringify(sleeperGwPredictions),
      sleeper_conversion_ratio: conversionRatios[position]?.multiplier || 1.0,
      
      // Additional metadata
      has_historical_data: true,
      conversion_quality: this.assessConversionQuality(ffhSeasonPrediction, sleeperSeasonTotal),
      last_updated: new Date().toISOString()
    };
  }

  // Normalize position names
  normalizePosition(position) {
    const positionMap = {
      'G': 'GKP', 'GK': 'GKP', 'GKP': 'GKP',
      'D': 'DEF', 'DEF': 'DEF',
      'M': 'MID', 'MID': 'MID',
      'F': 'FWD', 'FWD': 'FWD'
    };
    return positionMap[position] || position || 'Unknown';
  }

  // Assess quality of conversion
  assessConversionQuality(originalPoints, convertedPoints) {
    if (!originalPoints || !convertedPoints) return 'No Data';
    
    const ratio = convertedPoints / originalPoints;
    
    if (ratio >= 0.8 && ratio <= 1.5) return 'Good';
    if (ratio >= 0.6 && ratio <= 2.0) return 'Fair';
    return 'Poor';
  }

  // Clear cache
  clearCache() {
    this.cachedScoringSettings = null;
    this.cachedConversionRatios = null;
  }

  // Get cache status
  getCacheStatus() {
    return {
      hasScoringSettings: !!this.cachedScoringSettings,
      hasConversionRatios: !!this.cachedConversionRatios,
      scoringRulesCount: this.cachedScoringSettings ? Object.keys(this.cachedScoringSettings).length : 0
    };
  }
}