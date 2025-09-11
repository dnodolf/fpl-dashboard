// app/services/sleeperPredictionServiceV3.js
// V3 Prediction Engine - Core Implementation

class SleeperPredictionServiceV3 {
  constructor() {
    this.sleeperScoring = null;
    this.isInitialized = false;
    this.positionalAverages = null;
  }

  /**
   * Initialize with Sleeper scoring settings
   */
  async initialize(sleeperScoringSettings, ffhStatsService = null) {
    try {
      this.sleeperScoring = sleeperScoringSettings;
      
      // Get positional averages for sample size weighting
      if (ffhStatsService) {
        this.positionalAverages = await ffhStatsService.getPositionalAverages();
      }
      
      this.isInitialized = true;
      console.log('✅ V3 Prediction Engine initialized');
      return true;
    } catch (error) {
      console.error('❌ V3 Prediction Engine initialization failed:', error);
      return false;
    }
  }

  /**
   * Convert FFH current season stats to Sleeper bonus points
   * This is the core function we'll test first
   */
  calculateSleeperBonusPoints(ffhStatsPlayer) {
    if (!this.isInitialized || !this.sleeperScoring) {
      throw new Error('V3 Prediction Engine not initialized');
    }

    const position = this.getPositionFromFFH(ffhStatsPlayer);
    const per90Stats = ffhStatsPlayer.per90;
    const sampleSize = ffhStatsPlayer.sampleSize;

    // Apply sample size weighting
    const weightedStats = this.applySmallSampleWeighting(per90Stats, position, sampleSize);

    // Convert to Sleeper points
    const sleeperBonus = this.convertStatsToSleeperPoints(weightedStats, position);

    return {
      totalBonusPoints: Math.round(sleeperBonus.total * 100) / 100,
      breakdown: sleeperBonus.breakdown,
      weightedStats: weightedStats,
      sampleWeight: {
        playerWeight: sampleSize.playerWeight,
        positionalWeight: sampleSize.positionalWeight,
        reliability: sampleSize.reliability
      }
    };
  }

  /**
   * Apply sample size weighting to per-90 stats
   */
  applySmallSampleWeighting(playerStats, position, sampleSize) {
    const positionId = this.getPositionId(position);
    const posAverages = this.positionalAverages?.[positionId] || {};
    
    const weightedStats = {};
    
    Object.keys(playerStats).forEach(statKey => {
      const playerValue = playerStats[statKey] || 0;
      const posAverage = posAverages[statKey] || 0;
      
      // Weighted average based on sample size
      weightedStats[statKey] = (
        (playerValue * sampleSize.playerWeight) + 
        (posAverage * sampleSize.positionalWeight)
      );
    });

    return weightedStats;
  }

  /**
   * Convert weighted stats to Sleeper points based on position
   */
  convertStatsToSleeperPoints(stats, position) {
    const posPrefix = this.getPositionPrefix(position);
    const breakdown = {};
    let total = 0;

    // Define stat mappings for each position
    const statMappings = this.getStatMappings(position);

    Object.keys(statMappings).forEach(statKey => {
      const scoringKey = statMappings[statKey];
      const pointsPerStat = this.sleeperScoring[scoringKey] || 0;
      const statValue = stats[statKey] || 0;
      const points = statValue * pointsPerStat;
      
      breakdown[statKey] = {
        per90Rate: Math.round(statValue * 100) / 100,
        pointsPerStat: pointsPerStat,
        totalPoints: Math.round(points * 100) / 100
      };
      
      total += points;
    });

    return {
      total: total,
      breakdown: breakdown
    };
  }

  /**
   * Get stat mappings for each position
   */
  getStatMappings(position) {
    const posPrefix = this.getPositionPrefix(position);
    
    const baseMappings = {
      'tackles_won_per_90': `pos_${posPrefix}_tkw`,
      'intercepts_per_90': `pos_${posPrefix}_int`,
      'shots_on_target_per_90': `pos_${posPrefix}_sot`,
      'key_pass_per_90': `pos_${posPrefix}_kp`,
      'succ_drib_per_90': `pos_${posPrefix}_acnc`
    };

    // Position-specific additions
    if (position === 'Goalkeeper') {
      baseMappings['saves_per_90'] = `pos_${posPrefix}_sv`;
      baseMappings['clearances_per_90'] = `pos_${posPrefix}_hcs`; // Using high claims as proxy
    } else if (position === 'Defender') {
      baseMappings['blocks_per_90'] = `pos_${posPrefix}_bs`;
      baseMappings['clearances_per_90'] = `pos_${posPrefix}_clr`; // If available
    }

    return baseMappings;
  }

  /**
   * Utility functions
   */
  getPositionFromFFH(ffhStatsPlayer) {
    const positionMap = {
      1: 'Goalkeeper',
      2: 'Defender', 
      3: 'Midfielder',
      4: 'Forward'
    };
    return positionMap[ffhStatsPlayer.position_id] || 'Midfielder';
  }

  getPositionId(positionName) {
    const positionMap = {
      'Goalkeeper': 1,
      'Defender': 2,
      'Midfielder': 3,
      'Forward': 4
    };
    return positionMap[positionName] || 3;
  }

  getPositionPrefix(position) {
    const prefixMap = {
      'Goalkeeper': 'gk',
      'Defender': 'd',
      'Midfielder': 'm',
      'Forward': 'f'
    };
    return prefixMap[position] || 'm';
  }

  /**
   * Test function to validate calculations
   */
  testStatConversion(playerName, ffhStatsData) {
    const player = ffhStatsData.players.find(p => 
      p.web_name.toLowerCase().includes(playerName.toLowerCase())
    );
    
    if (!player) {
      throw new Error(`Player '${playerName}' not found in FFH stats data`);
    }

    const result = this.calculateSleeperBonusPoints(player);
    
    return {
      player: {
        name: player.web_name,
        position: this.getPositionFromFFH(player),
        team: player.teamContext?.code_name,
        minutes: player.minutes,
        sampleCategory: player.sampleSize.category
      },
      sleeperBonus: result,
      rawStats: player.per90
    };
  }

  /**
   * Batch test multiple players
   */
  batchTestConversion(playerNames, ffhStatsData) {
    return playerNames.map(name => {
      try {
        return this.testStatConversion(name, ffhStatsData);
      } catch (error) {
        return {
          player: { name: name },
          error: error.message
        };
      }
    });
  }
}

// Export singleton
const sleeperPredictionServiceV3 = new SleeperPredictionServiceV3();
export default sleeperPredictionServiceV3;