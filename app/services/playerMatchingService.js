// app/services/playerMatchingService.js
// Updated to use unified position utilities - SLEEPER AUTHORITY

import { normalizePosition } from '../../utils/positionUtils.js';

export class PlayerMatchingService {
  constructor() {
    // Team code mappings for field extraction
    this.teamCodeMap = {
      'ARS': 'ARS', 'AVL': 'AVL', 'BOU': 'BOU', 'BRE': 'BRE',
      'BHA': 'BHA', 'BUR': 'BUR', 'CHE': 'CHE', 'CRY': 'CRY',
      'EVE': 'EVE', 'FUL': 'FUL', 'LIV': 'LIV', 'LUT': 'LUT',
      'MCI': 'MCI', 'MUN': 'MUN', 'NEW': 'NEW', 'NFO': 'NFO',
      'SHU': 'SHU', 'TOT': 'TOT', 'WHU': 'WHU', 'WOL': 'WOL',
      'SUN': 'SUN', 'LEI': 'LEI', 'IPS': 'IPS', 'SOU': 'SOU',
      'BURNLEY': 'BUR', 'WOLVES': 'WOL', 'WOLVERHAMPTON': 'WOL'
    };
  }

  /**
   * Extract standardized FFH player data
   */
  extractFFHData(ffhPlayer) {
    if (!ffhPlayer) return null;

    return {
      name: ffhPlayer.web_name || 
            ffhPlayer.name || 
            (ffhPlayer.first_name && ffhPlayer.second_name ? 
              `${ffhPlayer.first_name} ${ffhPlayer.second_name}` : '') ||
            '',

      team: ffhPlayer.team?.code_name ||
            ffhPlayer.team_short_name || 
            ffhPlayer.club || 
            ffhPlayer.team_abbr ||
            (typeof ffhPlayer.team === 'string' ? ffhPlayer.team : '') ||
            '',

      opta_id: ffhPlayer.opta_uuid ||
               ffhPlayer.opta_id ||
               ffhPlayer.player?.opta_uuid ||
               ffhPlayer.player?.opta_id ||
               '',

      fpl_id: ffhPlayer.fpl_id || 
              ffhPlayer.id || 
              ffhPlayer.element_id ||
              ffhPlayer.player?.fpl_id ||
              null,

      position_id: ffhPlayer.position_id || 
                   ffhPlayer.element_type ||
                   ffhPlayer.player?.position_id ||
                   null,

      _raw: ffhPlayer
    };
  }

  /**
   * Extract standardized Sleeper player data using unified position logic
   */
  extractSleeperData(sleeperPlayer) {
    if (!sleeperPlayer) return null;

    return {
      name: sleeperPlayer.full_name || 
            sleeperPlayer.name ||
            (sleeperPlayer.first_name && sleeperPlayer.last_name ?
              `${sleeperPlayer.first_name} ${sleeperPlayer.last_name}` : '') ||
            '',

      team: sleeperPlayer.team_abbr || 
            sleeperPlayer.team ||
            '',

      opta_id: sleeperPlayer.opta_id || '',
      rotowire_id: sleeperPlayer.rotowire_id || null,
      player_id: sleeperPlayer.id || sleeperPlayer.player_id || '',

      position: normalizePosition(sleeperPlayer), // Use unified position logic

      _raw: sleeperPlayer
    };
  }

  /**
   * Find best match between Sleeper and FFH player using Opta ID
   */
  async findBestMatch(sleeperPlayer, ffhPlayers) {
    if (!sleeperPlayer || !ffhPlayers || !Array.isArray(ffhPlayers)) {
      return null;
    }

    // Extract standardized data
    const sleeperData = this.extractSleeperData(sleeperPlayer);
    if (!sleeperData || !sleeperData.opta_id) {
      return null;
    }

    // Find exact Opta ID match
    for (const ffhPlayer of ffhPlayers) {
      const ffhData = this.extractFFHData(ffhPlayer);
      
      if (ffhData && ffhData.opta_id && ffhData.opta_id === sleeperData.opta_id) {
        return ffhPlayer; // Return original FFH player object
      }
    }

    return null; // No match found
  }

  /**
   * Get FFH player ID for deduplication
   */
  getFFHPlayerId(ffhPlayer) {
    const standardized = this.extractFFHData(ffhPlayer);
    if (!standardized) return `unknown_${Date.now()}`;
    
    return standardized.fpl_id || 
           standardized.opta_id || 
           `${standardized.name}_${standardized.team}`;
  }

  /**
   * Pure Opta ID matching - simplified and fast
   */
  async matchAllPlayers(sleeperPlayers, ffhPlayers) {
    console.log('🎯 OPTA-ONLY MATCHING: Starting with', sleeperPlayers.length, 'Sleeper players');
    
    const stats = {
      sleeperWithOpta: 0,
      ffhWithOpta: 0,
      optaMatches: 0,
      unmatchedSleeperWithOpta: [],
      duplicateOptas: new Map()
    };

    const matches = [];
    const usedFFHIds = new Set();
    
    // Build Sleeper Opta map and count
    const sleeperOptaMap = new Map();
    sleeperPlayers.forEach((player, index) => {
      const sleeperData = this.extractSleeperData(player);
      if (sleeperData && sleeperData.opta_id) {
        stats.sleeperWithOpta++;
        
        // Track duplicates
        if (sleeperOptaMap.has(sleeperData.opta_id)) {
          const existing = sleeperOptaMap.get(sleeperData.opta_id);
          if (!stats.duplicateOptas.has(sleeperData.opta_id)) {
            stats.duplicateOptas.set(sleeperData.opta_id, [existing]);
          }
          stats.duplicateOptas.get(sleeperData.opta_id).push({
            name: sleeperData.name,
            team: sleeperData.team,
            position: sleeperData.position,
            index
          });
        } else {
          sleeperOptaMap.set(sleeperData.opta_id, {
            name: sleeperData.name,
            team: sleeperData.team,
            position: sleeperData.position,
            index,
            player: player
          });
        }
      }
    });

    // Build FFH Opta map and count
    const ffhOptaMap = new Map();
    ffhPlayers.forEach((player, index) => {
      const ffhData = this.extractFFHData(player);
      if (ffhData && ffhData.opta_id) {
        stats.ffhWithOpta++;
        ffhOptaMap.set(ffhData.opta_id, player);
      }
    });

    // Match players via Opta ID
    for (const [optaId, sleeperInfo] of sleeperOptaMap) {
      if (ffhOptaMap.has(optaId)) {
        const ffhPlayer = ffhOptaMap.get(optaId);
        const ffhId = this.getFFHPlayerId(ffhPlayer);
        
        // Ensure no duplicates
        if (!usedFFHIds.has(ffhId)) {
          matches.push({
            sleeperPlayer: sleeperInfo.player,
            ffhPlayer,
            confidence: 'High',
            method: 'Opta ID',
            score: 1.0,
            opta_id: optaId
          });
          usedFFHIds.add(ffhId);
          stats.optaMatches++;
        }
      } else {
        // Track unmatched Sleeper players with Opta IDs
        stats.unmatchedSleeperWithOpta.push({
          opta_id: optaId,
          name: sleeperInfo.name,
          team: sleeperInfo.team,
          position: sleeperInfo.position,
          player: sleeperInfo.player
        });
      }
    }

    // Calculate rates
    const sleeperOptaRate = Math.round((stats.sleeperWithOpta / sleeperPlayers.length) * 100);
    const ffhOptaRate = Math.round((stats.ffhWithOpta / ffhPlayers.length) * 100);
    const optaMatchRate = stats.ffhWithOpta > 0 ?
        Math.round((stats.optaMatches / stats.ffhWithOpta) * 100) : 0;

    console.log(`📊 OPTA COVERAGE:`);
    console.log(`  Sleeper with Opta: ${stats.sleeperWithOpta}/${sleeperPlayers.length} (${sleeperOptaRate}%)`);
    console.log(`  FFH with Opta: ${stats.ffhWithOpta}/${ffhPlayers.length} (${ffhOptaRate}%)`);
    console.log(`  Successful matches: ${stats.optaMatches}/${stats.ffhWithOpta} (${optaMatchRate}%)`);
    console.log(`  Unmatched Sleeper with Opta: ${stats.unmatchedSleeperWithOpta.length}`);

    // Show sample matches
    console.log(`✅ SAMPLE MATCHES (first 5):`);
    matches.slice(0, 5).forEach(match => {
      const sleeperData = this.extractSleeperData(match.sleeperPlayer);
      const ffhData = this.extractFFHData(match.ffhPlayer);
      console.log(`  ${sleeperData.name} (${sleeperData.team}) → ${ffhData.name} (${ffhData.team})`);
    });

    if (stats.unmatchedSleeperWithOpta.length > 0) {
      console.log(`❌ UNMATCHED SLEEPER PLAYERS (first 5):`);
      stats.unmatchedSleeperWithOpta.slice(0, 5).forEach(player => {
        console.log(`  ${player.name} (${player.team}) - ${player.position}`);
      });
    }

    return {
      matches,
      stats: {
        total: sleeperPlayers.length,
        matched: stats.optaMatches,
        matchRate: Math.round((stats.optaMatches / sleeperPlayers.length) * 100),
        byMethod: { 'Opta ID': stats.optaMatches },
        byConfidence: { 'High': stats.optaMatches }
      },
      optaAnalysis: {
        sleeperWithOpta: stats.sleeperWithOpta,
        sleeperOptaRate,
        ffhWithOpta: stats.ffhWithOpta,
        ffhOptaRate,
        optaMatches: stats.optaMatches,
        optaMatchRate,
        unmatchedSleeperWithOpta: stats.unmatchedSleeperWithOpta,
        duplicateOptas: stats.duplicateOptas
      },
      summary: {
        totalSleeperPlayers: sleeperPlayers.length,
        totalFFHPlayers: ffhPlayers.length,
        matchedPlayers: stats.optaMatches,
        matchRate: `${optaMatchRate}%`,
        uniqueFFHPlayersUsed: stats.optaMatches,
        approach: 'OPTA-ONLY with Unified Position Authority'
      }
    };
  }

  /**
   * Get matching statistics
   */
  async getMatchingStats(sleeperPlayers, ffhPlayers) {
    let totalMatches = 0;
    let totalSleeper = Array.isArray(sleeperPlayers) ? sleeperPlayers.length : Object.keys(sleeperPlayers).length;
    
    const sleeperArray = Array.isArray(sleeperPlayers) ? 
      sleeperPlayers : Object.values(sleeperPlayers);

    for (const sleeperPlayer of sleeperArray) {
      const match = await this.findBestMatch(sleeperPlayer, ffhPlayers);
      if (match) totalMatches++;
    }

    return {
      totalSleeper,
      totalFFH: ffhPlayers.length,
      totalMatches,
      matchRate: totalSleeper > 0 ? ((totalMatches / totalSleeper) * 100).toFixed(1) : '0.0'
    };
  }

  // Utility methods for legacy compatibility
  calculateAverageConfidence(matches) {
    return 100; // All Opta matches are High confidence
  }

  normalizeName(name) {
    return name?.toLowerCase().trim() || '';
  }

  similarity(name1, name2) {
    return name1 === name2 ? 1.0 : 0.0; // Not used in Opta-only matching
  }

  clearCache() {
    // No cache in this implementation
  }

  getCacheStats() {
    return { size: 0, keys: [] };
  }
}