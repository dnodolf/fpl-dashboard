// app/services/playerMatchingService.js - PRIORITY 1: FIELD MAPPING FIXES

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

    // ✅ FIXED: Added Chris Richards manual override
    this.manualOverrides = {
      'chris richards|CRY': 'richards',
      'luis diaz|LIV': 'luis díaz',
      'mo salah|LIV': 'mohamed salah',
      'son heung min|TOT': 'heung-min son',
      'estevao|CHE': 'estevao',
      'igor jesus|NFO': 'igor jesus',
      'jacob bruun larsen|BUR': 'bruun larsen',
      'martin zubimendi|ARS': 'martín zubimendi'
    };

    // Team code mappings
    this.teamCodeMap = {
      'ARS': 'ARS', 'AVL': 'AVL', 'BOU': 'BOU', 'BRE': 'BRE',
      'BHA': 'BHA', 'BUR': 'BUR', 'CHE': 'CHE', 'CRY': 'CRY',
      'EVE': 'EVE', 'FUL': 'FUL', 'LIV': 'LIV', 'LUT': 'LUT',
      'MCI': 'MCI', 'MUN': 'MUN', 'NEW': 'NEW', 'NFO': 'NFO',
      'SHU': 'SHU', 'TOT': 'TOT', 'WHU': 'WHU', 'WOL': 'WOL',
      'SUN': 'SUN', 'LEI': 'LEI', 'IPS': 'IPS', 'SOU': 'SOU',
      'BURNLEY': 'BUR', 'WOLVES': 'WOL', 'WOLVERHAMPTON': 'WOL'
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
  // ✅ PRIORITY 1: ROBUST FIELD EXTRACTION
  // ===============================

  /**
   * ✅ CRITICAL FIX: Standardize FFH player data extraction
   * Handles ALL field name variations from FFH API
   */
  extractFFHData(ffhPlayer) {
    if (!ffhPlayer) return null;

    return {
      // Name extraction with fallbacks
      name: ffhPlayer.web_name || 
            ffhPlayer.name || 
            (ffhPlayer.first_name && ffhPlayer.second_name ? 
              `${ffhPlayer.first_name} ${ffhPlayer.second_name}` : '') ||
            '',

      // Team extraction with nested object support
      team: ffhPlayer.team?.code_name ||     // ✅ FIXED: Handle nested team object
            ffhPlayer.team_short_name || 
            ffhPlayer.club || 
            ffhPlayer.team_abbr ||
            (typeof ffhPlayer.team === 'string' ? ffhPlayer.team : '') ||
            '',

      // ID extraction with all variations
      opta_id: ffhPlayer.opta_uuid ||        // ✅ FIXED: FFH uses opta_uuid
               ffhPlayer.opta_id ||
               '',

      fpl_id: ffhPlayer.fpl_id || 
              ffhPlayer.id || 
              ffhPlayer.element_id ||
              null,

      // Position with fallbacks
      position_id: ffhPlayer.position_id || 
                   ffhPlayer.element_type ||
                   null,

      // Raw player for debugging
      _raw: ffhPlayer
    };
  }

  /**
   * ✅ CRITICAL FIX: Standardize Sleeper player data extraction
   * Handles ALL field name variations from Sleeper API
   */
  extractSleeperData(sleeperPlayer) {
    if (!sleeperPlayer) return null;

    return {
      // Name extraction
      name: sleeperPlayer.full_name || 
            sleeperPlayer.name ||
            (sleeperPlayer.first_name && sleeperPlayer.last_name ?
              `${sleeperPlayer.first_name} ${sleeperPlayer.last_name}` : '') ||
            '',

      // Team extraction
      team: sleeperPlayer.team_abbr || 
            sleeperPlayer.team ||
            '',

      // ID extraction
      opta_id: sleeperPlayer.opta_id || '',
      rotowire_id: sleeperPlayer.rotowire_id || null,
      player_id: sleeperPlayer.id || sleeperPlayer.player_id || '',

      // Position extraction
      position: sleeperPlayer.fantasy_positions?.[0] || 
                sleeperPlayer.position ||
                '',

      // Raw player for debugging  
      _raw: sleeperPlayer
    };
  }

  // ===============================
  // HELPER METHODS (Updated to use standardized data)
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

  // ✅ UPDATED: Use standardized data extraction
  getFFHPlayerName(ffhPlayer) {
    const standardized = this.extractFFHData(ffhPlayer);
    return standardized?.name || '';
  }

  // ✅ UPDATED: Use standardized data extraction
  getFFHTeam(ffhPlayer) {
    const standardized = this.extractFFHData(ffhPlayer);
    return standardized?.team || '';
  }

  // ✅ UPDATED: Use standardized data extraction
  getFFHPlayerId(ffhPlayer) {
    const standardized = this.extractFFHData(ffhPlayer);
    if (!standardized) return `unknown_${Date.now()}`;
    
    return standardized.fpl_id || 
           standardized.opta_id || 
           `${standardized.name}_${standardized.team}`;
  }

  // Calculate name similarity with enhanced similar surname detection
  calculateNameSimilarity(name1, name2) {
    if (!name1 || !name2) return 0;
    
    // Split names into parts
    const parts1 = name1.toLowerCase().split(' ').filter(p => p.length > 1);
    const parts2 = name2.toLowerCase().split(' ').filter(p => p.length > 1);
    
    // ENHANCED: Check for similar surname but different first name cases
    if (parts1.length >= 2 && parts2.length >= 2) {
      const lastName1 = parts1[parts1.length - 1];
      const lastName2 = parts2[parts2.length - 1];
      const firstName1 = parts1[0];
      const firstName2 = parts2[0];
      
      const lastNameSim = this.levenshteinSimilarity(lastName1, lastName2);
      const firstNameSim = this.levenshteinSimilarity(firstName1, firstName2);
      
      // If surnames are similar but first names are completely different, penalize heavily
      if (lastNameSim > 0.8 && firstNameSim < 0.3) {
        console.log(`⚠️ BLOCKED: Similar surname detected: "${name1}" vs "${name2}" - Last:${lastNameSim.toFixed(2)}, First:${firstNameSim.toFixed(2)}`);
        return 0.1; // Very low score to prevent false matches
      }
      
      // Special case for exact surname match but different first names
      if (lastName1 === lastName2 && firstName1 !== firstName2) {
        const firstNameLength = Math.min(firstName1.length, firstName2.length);
        if (firstNameLength > 2 && !firstName1.startsWith(firstName2.charAt(0)) && !firstName2.startsWith(firstName1.charAt(0))) {
          console.log(`⚠️ BLOCKED: Exact surname match but different first names: "${name1}" vs "${name2}"`);
          return 0.1;
        }
      }
    }
    
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
  // ✅ UPDATED: MULTI-TIER MATCHING WITH STANDARDIZED DATA
  // ===============================

  findBestFFHMatchOptimal(sleeperPlayer, availableFFHPlayers, diagnostics) {
    if (!sleeperPlayer) return null;

    // ✅ CRITICAL: Use standardized data extraction
    const sleeperData = this.extractSleeperData(sleeperPlayer);
    if (!sleeperData || !sleeperData.name) return null;

    const sleeperName = this.normalizeNameForMatching(sleeperData.name);
    const sleeperTeam = this.normalizeTeamForMatching(sleeperData.team);
    const sleeperKey = `${sleeperName}|${sleeperTeam}`;

    // Enhanced debugging for problematic cases
    const isChrisRichards = sleeperData.name.toLowerCase().includes('chris richards');
    if (isChrisRichards) {
      console.log('🔍 CHRIS RICHARDS DEBUG (STANDARDIZED):');
      console.log('- Raw Sleeper:', sleeperData._raw.full_name, sleeperData._raw.team_abbr);
      console.log('- Standardized:', sleeperData);
      console.log('- Normalized Name:', sleeperName);
      console.log('- Normalized Team:', sleeperTeam);
      console.log('- Override Key:', sleeperKey);
    }

    // TIER 0: Manual Overrides (Highest Priority)
    if (this.manualOverrides[sleeperKey]) {
      const targetName = this.normalizeNameForMatching(this.manualOverrides[sleeperKey]);
      const override = availableFFHPlayers.find(p => {
        const ffhData = this.extractFFHData(p);
        if (!ffhData) return false;
        
        const ffhName = this.normalizeNameForMatching(ffhData.name);
        const ffhTeam = this.normalizeTeamForMatching(ffhData.team);
        
        if (isChrisRichards) {
          console.log(`  Override check: "${ffhName}" (${ffhTeam}) vs target "${targetName}"`);
        }
        
        return ffhName === targetName || ffhName.includes(targetName) || targetName.includes(ffhName);
      });
      
      if (override) {
        const ffhData = this.extractFFHData(override);
        if (isChrisRichards) console.log('✅ CHRIS RICHARDS: Manual override matched!');
        
        diagnostics.push({
          sleeper: `${sleeperData.name} (${sleeperTeam})`,
          ffh: `${ffhData.name} (${ffhData.team})`,
          method: 'Manual Override',
          confidence: 'High',
          score: 1.0
        });
        return override;
      }
    }

    // ✅ TIER 1: Opta ID Match (FIXED FIELD MAPPING)
    if (sleeperData.opta_id) {
      const optaMatch = availableFFHPlayers.find(p => {
        const ffhData = this.extractFFHData(p);
        return ffhData && ffhData.opta_id && ffhData.opta_id === sleeperData.opta_id;
      });
      
      if (optaMatch) {
        const ffhData = this.extractFFHData(optaMatch);
        if (isChrisRichards) console.log('✅ CHRIS RICHARDS: Opta ID matched!');
        
        diagnostics.push({
          sleeper: `${sleeperData.name} (${sleeperTeam})`,
          ffh: `${ffhData.name} (${ffhData.team})`,
          method: 'Opta ID',
          confidence: 'High',
          score: 1.0
        });
        return optaMatch;
      }
    }

    // ✅ TIER 2: FPL ID Match (FIXED FIELD MAPPING)
    if (sleeperData.rotowire_id) {
      const fplMatch = availableFFHPlayers.find(p => {
        const ffhData = this.extractFFHData(p);
        return ffhData && ffhData.fpl_id && 
               String(ffhData.fpl_id) === String(sleeperData.rotowire_id);
      });
      
      if (fplMatch) {
        const ffhData = this.extractFFHData(fplMatch);
        if (isChrisRichards) console.log('✅ CHRIS RICHARDS: FPL ID matched!');
        
        diagnostics.push({
          sleeper: `${sleeperData.name} (${sleeperTeam})`,
          ffh: `${ffhData.name} (${ffhData.team})`,
          method: 'FPL ID',
          confidence: 'High',
          score: 1.0
        });
        return fplMatch;
      }
    }

    // TIER 3: Name + Team Match (Good for remaining players)
    if (sleeperTeam) {
      const teamMatches = availableFFHPlayers.filter(p => {
        const ffhData = this.extractFFHData(p);
        if (!ffhData) return false;
        
        const ffhTeam = this.normalizeTeamForMatching(ffhData.team);
        return ffhTeam === sleeperTeam;
      });
      
      if (isChrisRichards) {
        console.log(`- Team matches found: ${teamMatches.length}`);
        teamMatches.forEach(tm => {
          const ffhData = this.extractFFHData(tm);
          console.log(`  - ${ffhData.name} (${ffhData.team})`);
        });
      }
      
      if (teamMatches.length > 0) {
        let bestTeamMatch = null;
        let bestTeamScore = 0;
        
        for (const ffhPlayer of teamMatches) {
          const ffhData = this.extractFFHData(ffhPlayer);
          if (!ffhData) continue;
          
          const ffhName = this.normalizeNameForMatching(ffhData.name);
          const score = this.calculateNameSimilarity(sleeperName, ffhName);
          
          if (isChrisRichards) {
            console.log(`    Name similarity: "${sleeperName}" vs "${ffhName}" = ${score.toFixed(3)}`);
          }
          
          if (score >= 0.6 && score > bestTeamScore) {
            bestTeamScore = score;
            bestTeamMatch = ffhPlayer;
          }
        }
        
        if (bestTeamMatch) {
          const ffhData = this.extractFFHData(bestTeamMatch);
          const confidence = this.assignConfidence(bestTeamScore);
          
          if (isChrisRichards) {
            console.log(`✅ CHRIS RICHARDS: Best team match found with score ${bestTeamScore.toFixed(3)}`);
          }
          
          diagnostics.push({
            sleeper: `${sleeperData.name} (${sleeperTeam})`,
            ffh: `${ffhData.name} (${ffhData.team})`,
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
      const ffhData = this.extractFFHData(ffhPlayer);
      if (!ffhData) continue;
      
      const ffhName = this.normalizeNameForMatching(ffhData.name);
      const score = this.calculateNameSimilarity(sleeperName, ffhName);
      
      if (isChrisRichards && score > 0.1) {
        console.log(`    Name-only: "${sleeperName}" vs "${ffhName}" = ${score.toFixed(3)} (need >= 0.85)`);
      }
      
      if (score >= 0.85 && score > bestScore) {
        bestScore = score;
        bestMatch = ffhPlayer;
      }
    }
    
    if (bestMatch) {
      const ffhData = this.extractFFHData(bestMatch);
      if (isChrisRichards) {
        console.log(`✅ CHRIS RICHARDS: Name-only match found with score ${bestScore.toFixed(3)}`);
      }
      
      diagnostics.push({
        sleeper: `${sleeperData.name} (${sleeperTeam})`,
        ffh: `${ffhData.name} (${ffhData.team})`,
        method: 'Name Only',
        confidence: 'Medium',
        score: bestScore
      });
      return bestMatch;
    }

    // No match found
    if (isChrisRichards) {
      console.log('❌ CHRIS RICHARDS: No match found in any tier');
    }
    
    diagnostics.push({
      sleeper: `${sleeperData.name} (${sleeperTeam})`,
      ffh: 'No match found',
      method: 'No Match',
      confidence: 'None',
      score: 0
    });
    return null;
  }

  // ===============================
  // MAIN MATCHING METHOD (unchanged)
  // ===============================

  async matchAllPlayers(sleeperPlayers, ffhPlayers) {
    const diagnostics = [];
    const matches = [];

    // ✅ ADD THIS DEBUG CODE:
    console.log('🔍 MATCHING SERVICE: Starting with', sleeperPlayers.length, 'players');
    
    // Check if Chris Richards is in the input
    const chrisInInput = sleeperPlayers.find(p => 
      p.id === '2168' || (p.name && p.name.toLowerCase().includes('chris richards'))
    );
    console.log('🔍 CHRIS RICHARDS IN SERVICE INPUT:', !!chrisInInput);
    if (chrisInInput) {
      console.log('- Service Input Data:', { 
        id: chrisInInput.id, 
        name: chrisInInput.name, 
        team: chrisInInput.team_abbr || chrisInInput.team,
        opta_id: chrisInInput.opta_id 
      });
    }
    // ✅ END DEBUG CODE

    const stats = {
      total: sleeperPlayers.length,
      matched: 0,
      byMethod: {},
      byConfidence: {}
    };

    console.log(`🔄 STANDARDIZED MATCHING: Processing ${sleeperPlayers.length} Sleeper players against ${ffhPlayers.length} FFH players`);

    // Track which FFH players have been used
    const usedFFHPlayerIds = new Set();
    
    for (const sleeperPlayer of sleeperPlayers) {
      // Filter out already used FFH players

    // ✅ ADD THIS DEBUG CODE:
    const isChris = sleeperPlayer.id === '2168' || 
                   (sleeperPlayer.name && sleeperPlayer.name.toLowerCase().includes('chris richards'));
    
    if (isChris) {
      console.log('🔍 PROCESSING CHRIS RICHARDS IN LOOP:');
      console.log('- Player data:', { 
        id: sleeperPlayer.id, 
        name: sleeperPlayer.name, 
        team: sleeperPlayer.team_abbr || sleeperPlayer.team 
      });
    }
    // ✅ END DEBUG CODE

      const availableFFHPlayers = ffhPlayers.filter(p => {
        const ffhId = this.getFFHPlayerId(p);
        return !usedFFHPlayerIds.has(ffhId);
      });

      if (availableFFHPlayers.length === 0) {
        console.log(`⚠️ No available FFH players remaining for ${sleeperPlayer.full_name || sleeperPlayer.name}`);
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
        console.log(`❌ No match: ${sleeperPlayer.full_name || sleeperPlayer.name}`);
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

    console.log(`✅ STANDARDIZED MATCHING COMPLETE:`);
    console.log(`  Total: ${stats.total} Sleeper players`);
    console.log(`  Matched: ${stats.matched} players (${stats.matchRate}%)`);
    console.log(`  Methods:`, stats.byMethod);
    console.log(`  Confidence:`, stats.byConfidence);

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
        duplicateCheck: 'PASS - Using standardized field mapping'
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

  // Legacy compatibility methods
  normalizeName(name) {
    return this.normalizeNameForMatching(name);
  }

  similarity(name1, name2) {
    return this.calculateNameSimilarity(name1, name2);
  }

  clearCache() {
    // No cache in this implementation
  }

  getCacheStats() {
    return { size: 0, keys: [] };
  }
}