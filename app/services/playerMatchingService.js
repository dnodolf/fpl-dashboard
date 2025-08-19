// app/services/playerMatchingService.js - OPTIMIZED MULTI-TIER MATCHING

export class PlayerMatchingService {
  constructor() {
    // Name aliases for better matching
    this.nameAliases = {
      'mo': 'mohamed', 'joao': 'joão', 'charly': 'carlos', 'will': 'william',
      'bill': 'william', 'harry': 'harold', 'tom': 'thomas', 'nick': 'nicholas',
      'alex': 'alexander', 'matt': 'matthew', 'matty': 'matthew', 'joe': 'joseph',
      'jota': 'diogo', 'leo': 'leonardo', 'eddie': 'edward', 'phil': 'philip',
      'mikey': 'michael', 'ben': 'benjamin', 'kyle': 'kyle', 'kev': 'kevin',
      'ronnie': 'ronald', 'cris': 'cristiano', 'erling': 'haaland', 'cole': 'palmer'
    };

    // Manual overrides for problematic matches
    this.manualOverrides = {
      'luis diaz|LIV': 'luis díaz',
      'mo salah|LIV': 'mohamed salah',
      'son heung min|TOT': 'heung-min son',
      'estevao|CHE': 'estevao',
      'igor jesus|NFO': 'igor jesus',
      'martin zubimendi|ARS': 'martín zubimendi'
    };

    // Team code mappings
    this.teamCodeMap = {
      'ARS': 'ARS', 'AVL': 'AVL', 'BOU': 'BOU', 'BRE': 'BRE',
      'BHA': 'BHA', 'BUR': 'BUR', 'CHE': 'CHE', 'CRY': 'CRY',
      'EVE': 'EVE', 'FUL': 'FUL', 'LIV': 'LIV', 'LUT': 'LUT',
      'MCI': 'MCI', 'MUN': 'MUN', 'NEW': 'NEW', 'NFO': 'NFO',
      'SHU': 'SHU', 'TOT': 'TOT', 'WHU': 'WHU', 'WOL': 'WOL',
      'SUN': 'SUN', 'LEI': 'LEI', 'IPS': 'IPS', 'SOU': 'SOU'
    };

    // Position mappings
    this.positionMap = {
      'GKP': 1, 'GK': 1, 'G': 1,
      'DEF': 2, 'D': 2,
      'MID': 3, 'M': 3,
      'FWD': 4, 'F': 4
    };
  }

  // ===============================
  // HELPER METHODS
  // ===============================

  // Normalize name for matching
  normalizeNameForMatching(name) {
    if (!name) return '';
    
    let normalized = name.toLowerCase()
      .trim()
      .replace(/[àáâãäå]/g, 'a')
      .replace(/[èéêë]/g, 'e')
      .replace(/[ìíîï]/g, 'i')
      .replace(/[òóôõö]/g, 'o')
      .replace(/[ùúûü]/g, 'u')
      .replace(/[ñ]/g, 'n')
      .replace(/[ç]/g, 'c')
      .replace(/[ý]/g, 'y')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Apply name aliases
    Object.entries(this.nameAliases).forEach(([alias, full]) => {
      const regex = new RegExp(`\\b${alias}\\b`, 'g');
      normalized = normalized.replace(regex, full);
    });

    return normalized;
  }

  // Normalize team for matching
  normalizeTeamForMatching(team) {
    if (!team) return '';
    const normalized = team.toUpperCase().trim();
    return this.teamCodeMap[normalized] || normalized;
  }

  // Get FFH player name (handles different formats)
  getFFHPlayerName(ffhPlayer) {
    if (ffhPlayer.web_name) {
      return ffhPlayer.web_name;
    }
    if (ffhPlayer.first_name && ffhPlayer.second_name) {
      return `${ffhPlayer.first_name} ${ffhPlayer.second_name}`;
    }
    return ffhPlayer.name || '';
  }

  // Get FFH team
  getFFHTeam(ffhPlayer) {
    return ffhPlayer.club || 
           ffhPlayer.team_short_name || 
           ffhPlayer.team_abbr || 
           ffhPlayer.team || 
           '';
  }

  // Get FFH player ID (prioritize fpl_id)
  getFFHPlayerId(ffhPlayer) {
    return ffhPlayer.fpl_id || 
           ffhPlayer.id || 
           ffhPlayer.element_id || 
           `${this.getFFHPlayerName(ffhPlayer)}_${this.getFFHTeam(ffhPlayer)}`;
  }

  // Calculate name similarity
  calculateNameSimilarity(name1, name2) {
    if (!name1 || !name2) return 0;
    
    // Split names into parts
    const parts1 = name1.toLowerCase().split(' ').filter(p => p.length > 1);
    const parts2 = name2.toLowerCase().split(' ').filter(p => p.length > 1);
    
    // Check for any matching parts
    let bestMatch = 0;
    
    for (const part1 of parts1) {
      for (const part2 of parts2) {
        // Exact match
        if (part1 === part2 && part1.length > 2) {
          return 0.9;
        }
        
        // Substring match
        if ((part1.includes(part2) || part2.includes(part1)) && Math.min(part1.length, part2.length) > 2) {
          bestMatch = Math.max(bestMatch, 0.8);
        }
        
        // Levenshtein for individual parts
        const similarity = this.levenshteinSimilarity(part1, part2);
        if (similarity > 0.7 && Math.min(part1.length, part2.length) > 2) {
          bestMatch = Math.max(bestMatch, similarity * 0.7);
        }
      }
    }
    
    return bestMatch;
  }

  // Levenshtein distance helper
  levenshteinSimilarity(str1, str2) {
    const len1 = str1.length;
    const len2 = str2.length;
    
    if (len1 === 0) return len2 === 0 ? 1 : 0;
    if (len2 === 0) return 0;

    const matrix = Array(len1 + 1).fill().map(() => Array(len2 + 1).fill(0));
    
    for (let i = 0; i <= len1; i++) matrix[i][0] = i;
    for (let j = 0; j <= len2; j++) matrix[0][j] = j;
    
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }
    
    const distance = matrix[len1][len2];
    const maxLength = Math.max(len1, len2);
    return (maxLength - distance) / maxLength;
  }

  // Assign confidence based on score
  assignConfidence(score) {
    if (score >= 0.85) return 'High';
    if (score >= 0.65) return 'Medium';
    if (score >= 0.4) return 'Low';
    return 'None';
  }

  // ===============================
  // MULTI-TIER MATCHING ENGINE
  // ===============================

  // Find best FFH match using multi-tier priority system
  findBestFFHMatchOptimal(sleeperPlayer, availableFFHPlayers, diagnostics) {
    if (!sleeperPlayer?.full_name && !sleeperPlayer?.name) {
      return null;
    }

    const sleeperName = this.normalizeNameForMatching(sleeperPlayer.full_name || sleeperPlayer.name);
    const sleeperTeam = this.normalizeTeamForMatching(sleeperPlayer.team_abbr || sleeperPlayer.team);
    const sleeperKey = `${sleeperName}|${sleeperTeam}`;

    // TIER 0: Manual Overrides (Highest Priority)
    if (this.manualOverrides[sleeperKey]) {
      const override = availableFFHPlayers.find(p => 
        this.normalizeNameForMatching(this.getFFHPlayerName(p)) === 
        this.normalizeNameForMatching(this.manualOverrides[sleeperKey])
      );
      
      if (override) {
        diagnostics.push({
          sleeper: `${sleeperPlayer.full_name || sleeperPlayer.name} (${sleeperTeam})`,
          ffh: `${this.getFFHPlayerName(override)} (${this.getFFHTeam(override)})`,
          method: 'Manual Override',
          confidence: 'High',
          score: 1.0
        });
        return override;
      }
    }

    // TIER 1: Opta ID Match (Best - Official Provider)
    if (sleeperPlayer.opta_id) {
      const optaMatch = availableFFHPlayers.find(p => 
        p.opta_uuid && p.opta_uuid === sleeperPlayer.opta_id
      );
      
      if (optaMatch) {
        diagnostics.push({
          sleeper: `${sleeperPlayer.full_name || sleeperPlayer.name} (${sleeperTeam})`,
          ffh: `${this.getFFHPlayerName(optaMatch)} (${this.getFFHTeam(optaMatch)})`,
          method: 'Opta ID',
          confidence: 'High',
          score: 1.0
        });
        return optaMatch;
      }
    }

    // TIER 2: FPL ID Match (Second best - Direct FPL connection)
    if (sleeperPlayer.rotowire_id) {
      const fplMatch = availableFFHPlayers.find(p => 
        String(p.fpl_id || p.id || p.element_id) === String(sleeperPlayer.rotowire_id)
      );
      
      if (fplMatch) {
        diagnostics.push({
          sleeper: `${sleeperPlayer.full_name || sleeperPlayer.name} (${sleeperTeam})`,
          ffh: `${this.getFFHPlayerName(fplMatch)} (${this.getFFHTeam(fplMatch)})`,
          method: 'FPL ID',
          confidence: 'High',
          score: 1.0
        });
        return fplMatch;
      }
    }

    // TIER 3: Name + Team Match (Good for remaining players)
    if (sleeperTeam) {
      const teamMatches = availableFFHPlayers.filter(p =>
        this.normalizeTeamForMatching(this.getFFHTeam(p)) === sleeperTeam
      );
      
      if (teamMatches.length > 0) {
        let bestTeamMatch = null;
        let bestTeamScore = 0;
        
        for (const ffhPlayer of teamMatches) {
          const ffhName = this.normalizeNameForMatching(this.getFFHPlayerName(ffhPlayer));
          const score = this.calculateNameSimilarity(sleeperName, ffhName);
          
          if (score >= 0.6 && score > bestTeamScore) { // Good threshold for team matches
            bestTeamScore = score;
            bestTeamMatch = ffhPlayer;
          }
        }
        
        if (bestTeamMatch) {
          const confidence = this.assignConfidence(bestTeamScore);
          diagnostics.push({
            sleeper: `${sleeperPlayer.full_name || sleeperPlayer.name} (${sleeperTeam})`,
            ffh: `${this.getFFHPlayerName(bestTeamMatch)} (${this.getFFHTeam(bestTeamMatch)})`,
            method: 'Name+Team',
            confidence,
            score: bestTeamScore
          });
          return bestTeamMatch;
        }
      }
    }

    // TIER 4: Name Only Match (Last resort - very high threshold)
    let bestMatch = null;
    let bestScore = 0;
    
    for (const ffhPlayer of availableFFHPlayers) {
      const ffhName = this.normalizeNameForMatching(this.getFFHPlayerName(ffhPlayer));
      const score = this.calculateNameSimilarity(sleeperName, ffhName);
      
      if (score >= 0.85 && score > bestScore) { // Very high threshold for name-only
        bestScore = score;
        bestMatch = ffhPlayer;
      }
    }
    
    if (bestMatch) {
      diagnostics.push({
        sleeper: `${sleeperPlayer.full_name || sleeperPlayer.name} (${sleeperTeam})`,
        ffh: `${this.getFFHPlayerName(bestMatch)} (${this.getFFHTeam(bestMatch)})`,
        method: 'Name Only',
        confidence: 'Medium',
        score: bestScore
      });
      return bestMatch;
    }

    // No match found
    diagnostics.push({
      sleeper: `${sleeperPlayer.full_name || sleeperPlayer.name} (${sleeperTeam})`,
      ffh: 'No match found',
      method: 'No Match',
      confidence: 'None',
      score: 0
    });
    return null;
  }

  // ===============================
  // MAIN MATCHING METHOD
  // ===============================

  // Match all players with multi-tier system and duplicate prevention
  async matchAllPlayers(sleeperPlayers, ffhPlayers) {
    const diagnostics = [];
    const matches = [];
    const stats = {
      total: sleeperPlayers.length,
      matched: 0,
      byMethod: {},
      byConfidence: {}
    };

    console.log(`🔄 MULTI-TIER MATCHING: Processing ${sleeperPlayers.length} Sleeper players against ${ffhPlayers.length} FFH players`);

    // Track which FFH players have been used
    const usedFFHPlayerIds = new Set();
    
    console.log('🎯 Processing with optimal multi-tier matching...');
    
    for (const sleeperPlayer of sleeperPlayers) {
      // Filter out already used FFH players
      const availableFFHPlayers = ffhPlayers.filter(p => {
        const ffhId = this.getFFHPlayerId(p);
        return !usedFFHPlayerIds.has(ffhId);
      });

      if (availableFFHPlayers.length === 0) {
        console.log(`⚠️ No available FFH players remaining for ${sleeperPlayer.full_name || sleeperPlayer.name}`);
        diagnostics.push({
          sleeper: `${sleeperPlayer.full_name || sleeperPlayer.name}`,
          ffh: 'No available FFH players remaining',
          method: 'No Match',
          confidence: 'None',
          score: 0
        });
        continue;
      }

      const ffhMatch = this.findBestFFHMatchOptimal(
        sleeperPlayer, 
        availableFFHPlayers, 
        diagnostics
      );
      
      if (ffhMatch) {
        matches.push({
          sleeperPlayer,
          ffhPlayer: ffhMatch,
          confidence: diagnostics[diagnostics.length - 1]?.confidence || 'Medium',
          method: diagnostics[diagnostics.length - 1]?.method || 'Unknown',
          score: diagnostics[diagnostics.length - 1]?.score || 0.5
        });
        
        // Mark this FFH player as used
        const ffhId = this.getFFHPlayerId(ffhMatch);
        usedFFHPlayerIds.add(ffhId);
        stats.matched++;
        
        console.log(`✅ ${diagnostics[diagnostics.length - 1]?.method}: ${sleeperPlayer.full_name || sleeperPlayer.name} → ${this.getFFHPlayerName(ffhMatch)}`);
      } else {
        console.log(`❌ No match: ${sleeperPlayer.full_name || sleeperPlayer.name} (${sleeperPlayer.team_abbr || sleeperPlayer.team})`);
      }
    }

    // Update stats
    const unmatchedCount = sleeperPlayers.length - matches.length;
    if (unmatchedCount > 0) {
      stats.byMethod['No Match'] = unmatchedCount;
      stats.byConfidence['None'] = unmatchedCount;
    }

    matches.forEach(match => {
      const method = match.method || 'Unknown';
      const confidence = match.confidence || 'Unknown';
      
      stats.byMethod[method] = (stats.byMethod[method] || 0) + 1;
      stats.byConfidence[confidence] = (stats.byConfidence[confidence] || 0) + 1;
    });

    stats.matchRate = stats.total > 0 ? Math.round((stats.matched / stats.total) * 100) : 0;

    console.log(`✅ MULTI-TIER MATCHING COMPLETE:`);
    console.log(`  Total: ${stats.total} Sleeper players`);
    console.log(`  Matched: ${stats.matched} players (${stats.matchRate}%)`);
    console.log(`  Unique FFH players used: ${usedFFHPlayerIds.size}`);
    console.log(`  Methods:`, stats.byMethod);
    console.log(`  Confidence:`, stats.byConfidence);

    // Validation check for duplicates
    const ffhPlayerUsage = new Map();
    let duplicateCount = 0;
    
    matches.forEach(match => {
      const ffhId = this.getFFHPlayerId(match.ffhPlayer);
      if (ffhPlayerUsage.has(ffhId)) {
        console.error(`🚨 DUPLICATE: FFH player ${ffhId} matched to multiple Sleeper players!`);
        duplicateCount++;
      } else {
        ffhPlayerUsage.set(ffhId, match.sleeperPlayer.full_name || match.sleeperPlayer.name);
      }
    });

    return {
      matches,
      diagnostics,
      stats,
      summary: {
        totalSleeperPlayers: sleeperPlayers.length,
        totalFFHPlayers: ffhPlayers.length,
        matchedPlayers: stats.matched,
        matchRate: `${stats.matchRate}%`,
        uniqueFFHPlayersUsed: usedFFHPlayerIds.size,
        averageConfidence: this.calculateAverageConfidence(matches),
        duplicateCheck: duplicateCount === 0 ? 'PASS' : `FAIL (${duplicateCount} duplicates)`,
        tierBreakdown: this.calculateTierBreakdown(stats.byMethod)
      }
    };
  }

  // ===============================
  // UTILITY METHODS
  // ===============================

  calculateAverageConfidence(matches) {
    if (matches.length === 0) return 0;
    
    const confidenceValues = { 'High': 1, 'Medium': 0.7, 'Low': 0.4, 'None': 0 };
    const total = matches.reduce((sum, match) => {
      return sum + (confidenceValues[match.confidence] || 0);
    }, 0);
    
    return Math.round((total / matches.length) * 100);
  }

  calculateTierBreakdown(byMethod) {
    const tierMapping = {
      'Manual Override': 'Tier 0',
      'Opta ID': 'Tier 1', 
      'FPL ID': 'Tier 2',
      'Name+Team': 'Tier 3',
      'Name Only': 'Tier 4',
      'No Match': 'Unmatched'
    };
    
    const tierBreakdown = {};
    Object.entries(byMethod).forEach(([method, count]) => {
      const tier = tierMapping[method] || method;
      tierBreakdown[tier] = count;
    });
    
    return tierBreakdown;
  }

  // Legacy compatibility methods
  normalizeName(name) {
    return this.normalizeNameForMatching(name);
  }

  similarity(name1, name2) {
    return this.calculateNameSimilarity(name1, name2);
  }

  // Clear any internal caching if needed
  clearCache() {
    // No cache in this implementation, but keeping for compatibility
  }

  getCacheStats() {
    return { size: 0, keys: [] };
  }
}