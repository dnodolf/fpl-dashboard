// app/services/formationOptimizerService.js
// Updated to use unified position utilities - SLEEPER AUTHORITY

import { normalizePosition } from '../../utils/positionUtils.js';
import { getNextNGameweeksTotal } from '../utils/predictionUtils.js';

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
   * Get player's predicted points using predictions array (single source of truth).
   * Uses getNextNGameweeksTotal() for consistency with all other components.
   */
  getPlayerPoints(player) {
    // CRITICAL: Check player availability first - if unavailable, return 0
    const chanceOfPlaying = player.chance_next_round ??
                           player.chance_of_playing_next_round ??
                           100;

    if (chanceOfPlaying !== null && chanceOfPlaying !== undefined && chanceOfPlaying < 25) {
      return 0;
    }

    // Primary: Use predictions array via getNextNGameweeksTotal (same as all display components)
    if (this.currentGW && player.predictions?.length) {
      const pts = getNextNGameweeksTotal(player, this.scoringMode, this.currentGW, 1);
      if (pts > 0) return pts;
    }

    // Fallback for players without predictions array: use season averages
    if (this.scoringMode === 'v4' || this.scoringMode === 'v3') {
      if (player.v3_season_avg && player.v3_season_avg > 0) return player.v3_season_avg;
    }
    if (player.season_prediction_avg && player.season_prediction_avg > 0) {
      return player.season_prediction_avg;
    }

    return 0;
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
  optimizeFormation(formationType, availablePlayers, lockedStarterIds = new Set(), lockedBenchIds = new Set()) {
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

    if (process.env.NODE_ENV === 'development') {
      console.log(`🔍 ${formationType} - Available players:`, availablePlayers.length);
    }

    // Separate locked starters (must be included) from flexible players
    const lockedStarters = [];
    const flexiblePlayers = [];

    availablePlayers.forEach(player => {
      const pid = player.sleeper_id || player.player_id || player.id;
      const position = normalizePosition(player);
      const enriched = {
        ...player,
        position: position,
        points: this.getPlayerPoints(player)
      };

      if (lockedStarterIds.has(pid)) {
        lockedStarters.push(enriched);
      } else if (!lockedBenchIds.has(pid)) {
        // Only include players that aren't locked on the bench
        flexiblePlayers.push(enriched);
      }
    });

    // Count locked starters by position
    const lockedByPosition = { GKP: [], DEF: [], MID: [], FWD: [] };
    lockedStarters.forEach(p => {
      if (lockedByPosition.hasOwnProperty(p.position)) {
        lockedByPosition[p.position].push(p);
      }
    });

    // Check if locked starters exceed formation requirements (formation impossible)
    const requirements = formationConfig;
    for (const [pos, needed] of Object.entries(requirements)) {
      if (lockedByPosition[pos].length > needed) {
        return {
          formation: formationType,
          valid: false,
          reason: `Too many locked ${pos} players (${lockedByPosition[pos].length}) for this formation (needs ${needed})`,
          totalPoints: 0,
          players: [],
          requirements
        };
      }
    }

    // Group flexible players by position
    const flexByPosition = { GKP: [], DEF: [], MID: [], FWD: [] };
    flexiblePlayers.forEach(player => {
      if (flexByPosition.hasOwnProperty(player.position)) {
        flexByPosition[player.position].push(player);
      }
    });

    // Check if we have enough total players (locked + flexible) for this formation
    for (const [pos, needed] of Object.entries(requirements)) {
      const available = lockedByPosition[pos].length + flexByPosition[pos].length;
      if (available < needed) {
        return {
          formation: formationType,
          valid: false,
          reason: `Not enough ${pos} players (need ${needed}, have ${available})`,
          totalPoints: 0,
          players: [],
          requirements
        };
      }
    }

    // Sort flexible players by points descending within each position
    Object.keys(flexByPosition).forEach(pos => {
      flexByPosition[pos].sort((a, b) => (b.points || 0) - (a.points || 0));
    });

    // Select optimal players: locked starters first, fill remaining slots with best flexible
    const selectedPlayers = [];
    let totalPoints = 0;

    Object.entries(requirements).forEach(([pos, count]) => {
      const locked = lockedByPosition[pos];
      selectedPlayers.push(...locked);
      totalPoints += locked.reduce((sum, p) => sum + (p.points || 0), 0);

      const remaining = count - locked.length;
      if (remaining > 0) {
        const topFlex = flexByPosition[pos].slice(0, remaining);
        selectedPlayers.push(...topFlex);
        totalPoints += topFlex.reduce((sum, p) => sum + (p.points || 0), 0);
      }
    });

    return {
      formation: formationType,
      valid: true,
      totalPoints: Math.round(totalPoints * 100) / 100,
      players: selectedPlayers,
      requirements
    };
  }

  /**
   * Optimize all valid formations for given players
   */
  optimizeAllFormations(availablePlayers, lockedStarterIds = new Set(), lockedBenchIds = new Set()) {
    const formations = Object.keys(FormationOptimizerService.VALID_FORMATIONS);
    const results = [];

    formations.forEach(formation => {
      const result = this.optimizeFormation(formation, availablePlayers, lockedStarterIds, lockedBenchIds);
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
      if (process.env.NODE_ENV === 'development') {
        console.warn('Failed to parse formation:', formationString);
      }
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
        if (process.env.NODE_ENV === 'development') {
          console.warn(`🚨 Unknown position "${position}" for player ${player.name}`);
        }
      }
    });

    // Build formation string (excluding goalkeeper)
    return `${positionCounts.DEF}-${positionCounts.MID}-${positionCounts.FWD}`;
  }

  /**
   * Analyze current roster and provide optimization recommendations
   */
  async analyzeCurrentRoster(allPlayers, userId, scoringMode = 'ffh', currentGW = null, lockedTeams = null) {
    this.scoringMode = scoringMode;
    this.currentGW = currentGW;
    this.lockedTeams = lockedTeams || new Set();
    try {
      if (process.env.NODE_ENV === 'development') {
        console.log(`🔍 Analyzing roster for ${userId}...`);
      }
      
      // Get current roster from Sleeper
      const rosterInfo = await this.getCurrentRoster(userId);
      
      // Filter to only owned players
      const myPlayers = allPlayers.filter(p => {
        const playerId = p.sleeper_id || p.player_id || p.id;
        return rosterInfo.players.includes(playerId);
      });

      if (process.env.NODE_ENV === 'development') {
        console.log(`📋 Found ${myPlayers.length} owned players for ${rosterInfo.userName}`);
      }

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
      
      if (process.env.NODE_ENV === 'development') {
        console.log('📊 Position distribution:', positionCounts);
      }

      // Get current formation from starters
      const currentStarters = myPlayers.filter(p => {
        const playerId = p.sleeper_id || p.player_id || p.id;
        return rosterInfo.starters.includes(playerId);
      });

      const currentFormation = this.calculateFormationFromPlayers(currentStarters);
      const currentPoints = currentStarters.reduce((sum, p) => sum + this.getPlayerPoints(p), 0);

      // Determine locked players: players whose team match has started/finished
      const starterIds = new Set(rosterInfo.starters);
      const lockedStarterIds = new Set();
      const lockedBenchIds = new Set();
      if (this.lockedTeams.size > 0) {
        myPlayers.forEach(p => {
          const teamAbbr = (p.team_abbr || p.team || '').toUpperCase();
          if (this.lockedTeams.has(teamAbbr)) {
            const pid = p.sleeper_id || p.player_id || p.id;
            if (starterIds.has(pid)) {
              lockedStarterIds.add(pid);
            } else {
              lockedBenchIds.add(pid);
            }
          }
        });
        if (process.env.NODE_ENV === 'development' && (lockedStarterIds.size > 0 || lockedBenchIds.size > 0)) {
          console.log(`🔒 Locked: ${lockedStarterIds.size} starters, ${lockedBenchIds.size} bench players`);
        }
      }

      // Mark players as locked for client-side display
      myPlayers.forEach(p => {
        const pid = p.sleeper_id || p.player_id || p.id;
        p._locked = lockedStarterIds.has(pid) || lockedBenchIds.has(pid);
        p._lockedAsStarter = lockedStarterIds.has(pid);
        p._lockedAsBench = lockedBenchIds.has(pid);
      });

      if (process.env.NODE_ENV === 'development') {
        console.log(`📈 Current: ${currentFormation} with ${currentPoints.toFixed(1)} points`);
      }

      // Optimize all possible formations (respecting locked constraints)
      const allFormationResults = this.optimizeAllFormations(myPlayers, lockedStarterIds, lockedBenchIds);
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
        const benchPlayerId = benchPlayer.sleeper_id || benchPlayer.player_id || benchPlayer.id;
        // Skip locked bench players — they can't be moved to starters
        if (lockedBenchIds.has(benchPlayerId)) return;

        const benchPosition = normalizePosition(benchPlayer);
        const benchPoints = this.getPlayerPoints(benchPlayer);

        currentStarters.forEach(starter => {
          const starterId = starter.sleeper_id || starter.player_id || starter.id;
          // Skip locked starters — they can't be benched
          if (lockedStarterIds.has(starterId)) return;

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
    if (process.env.NODE_ENV === 'development') {
      console.log('🔄 Formation optimizer cache cleared');
    }
  }
}