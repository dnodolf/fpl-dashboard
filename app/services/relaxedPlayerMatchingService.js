// app/services/relaxedPlayerMatchingService.js

export class RelaxedPlayerMatchingService {
  constructor() {
    // Same aliases as before
    this.nameAliases = {
      'mo': 'mohamed', 'joao': 'joão', 'charly': 'carlos', 'will': 'william',
      'bill': 'william', 'harry': 'harold', 'tom': 'thomas', 'nick': 'nicholas',
      'alex': 'alexander', 'matt': 'matthew', 'matty': 'matthew', 'joe': 'joseph',
      'jota': 'diogo', 'leo': 'leonardo', 'eddie': 'edward', 'phil': 'philip',
      'mikey': 'michael', 'ben': 'benjamin', 'kyle': 'kyle', 'kev': 'kevin',
      'ronnie': 'ronald', 'cris': 'cristiano'
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

    // Position mappings - RELAXED
    this.positionMap = {
      'GKP': [1], 'GK': [1], 'G': [1],
      'DEF': [2], 'D': [2], 'DEFENDER': [2],
      'MID': [3], 'M': [3], 'MIDFIELDER': [3],
      'FWD': [4], 'F': [4], 'FORWARD': [4], 'STRIKER': [4]
    };

    // In-memory match cache
    this.matchCache = new Map();
  }

  // More flexible name normalization
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

  // Normalize team name
  normalizeTeamForMatching(team) {
    if (!team) return '';
    return team.toUpperCase().trim();
  }

  // RELAXED name similarity - lower threshold
  calculateNameSimilarity(name1, name2) {
    if (!name1 || !name2) return 0;
    
    // Check for exact substring matches first
    if (name1.includes(name2) || name2.includes(name1)) {
      return 0.9;
    }
    
    // Check first name matches
    const name1Parts = name1.split(' ');
    const name2Parts = name2.split(' ');
    
    for (const part1 of name1Parts) {
      for (const part2 of name2Parts) {
        if (part1.length > 2 && part2.length > 2 && part1 === part2) {
          return 0.8;
        }
      }
    }
    
    // Levenshtein distance
    const len1 = name1.length;
    const len2 = name2.length;
    
    if (len1 === 0) return len2 === 0 ? 1 : 0;
    if (len2 === 0) return 0;

    const matrix = Array(len1 + 1).fill().map(() => Array(len2 + 1).fill(0));
    
    for (let i = 0; i <= len1; i++) matrix[i][0] = i;
    for (let j = 0; j <= len2; j++) matrix[0][j] = j;
    
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = name1[i - 1] === name2[j - 1] ? 0 : 1;
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

  // RELAXED position matching
  isPositionMatch(sleeperPosition, ffhElementType) {
    if (!sleeperPosition || !ffhElementType) return true; // Allow if position unknown
    
    const sleeperPositions = this.positionMap[sleeperPosition.toUpperCase()] || [];
    return sleeperPositions.length === 0 || sleeperPositions.includes(ffhElementType);
  }

  // RELAXED matching with lower thresholds
  findBestFFHMatch(sleeperPlayer, ffhPlayers, diagnostics = []) {
    if (!sleeperPlayer?.name && !sleeperPlayer?.full_name) {
      return null;
    }

    const sleeperName = this.normalizeNameForMatching(sleeperPlayer.name || sleeperPlayer.full_name);
    const sleeperTeam = this.normalizeTeamForMatching(sleeperPlayer.team);
    const sleeperKey = `${sleeperName}|${sleeperTeam}`;

    // Check cache first
    if (this.matchCache.has(sleeperKey)) {
      const cachedMatch = this.matchCache.get(sleeperKey);
      diagnostics.push({
        sleeper: `${sleeperPlayer.name || sleeperPlayer.full_name} (${sleeperTeam})`,
        ffh: cachedMatch ? `${cachedMatch.web_name || cachedMatch.name}` : 'No match',
        method: 'Cache',
        confidence: cachedMatch ? 'High' : 'None',
        score: cachedMatch ? 1.0 : 0
      });
      return cachedMatch;
    }

    // Check manual overrides
    if (this.manualOverrides[sleeperKey]) {
      const override = ffhPlayers.find(p => 
        this.normalizeNameForMatching(p.web_name || p.name) === this.normalizeNameForMatching(this.manualOverrides[sleeperKey])
      );
      
      if (override) {
        this.matchCache.set(sleeperKey, override);
        diagnostics.push({
          sleeper: `${sleeperPlayer.name || sleeperPlayer.full_name} (${sleeperTeam})`,
          ffh: `${override.web_name || override.name}`,
          method: 'Manual Override',
          confidence: 'High',
          score: 1.0
        });
        return override;
      }
    }

    // RELAXED position filtering - allow if uncertain
    let positionMatches = ffhPlayers;
    if (sleeperPlayer.position) {
      positionMatches = ffhPlayers.filter(p => 
        this.isPositionMatch(sleeperPlayer.position, p.element_type || p.position_id)
      );
      
      // If no position matches, don't filter by position
      if (positionMatches.length === 0) {
        positionMatches = ffhPlayers;
      }
    }

    // Try Opta ID match first
    if (sleeperPlayer.opta_id) {
      const optaMatch = positionMatches.find(p => 
        p.opta_uuid && p.opta_uuid === sleeperPlayer.opta_id
      );
      
      if (optaMatch) {
        this.matchCache.set(sleeperKey, optaMatch);
        diagnostics.push({
          sleeper: `${sleeperPlayer.name || sleeperPlayer.full_name} (${sleeperTeam})`,
          ffh: `${optaMatch.web_name || optaMatch.name}`,
          method: 'Opta ID',
          confidence: 'High',
          score: 1.0
        });
        return optaMatch;
      }
    }

    // Try FPL ID match
    if (sleeperPlayer.rotowire_id) {
      const fplMatch = positionMatches.find(p => 
        String(p.id || p.element_id) === String(sleeperPlayer.rotowire_id)
      );
      
      if (fplMatch) {
        this.matchCache.set(sleeperKey, fplMatch);
        diagnostics.push({
          sleeper: `${sleeperPlayer.name || sleeperPlayer.full_name} (${sleeperTeam})`,
          ffh: `${fplMatch.web_name || fplMatch.name}`,
          method: 'FPL ID',
          confidence: 'High',
          score: 1.0
        });
        return fplMatch;
      }
    }

    // RELAXED name similarity matching - LOWERED THRESHOLD from 0.7 to 0.5
    const candidates = [];
    positionMatches.forEach(ffhPlayer => {
      const ffhName = this.normalizeNameForMatching(ffhPlayer.web_name || ffhPlayer.name);
      const similarity = this.calculateNameSimilarity(sleeperName, ffhName);
      
      if (similarity >= 0.5) { // LOWERED from 0.7
        candidates.push({
          player: ffhPlayer,
          score: similarity,
          ffhName
        });
      }
    });

    if (candidates.length === 0) {
      // FALLBACK: Try even more relaxed matching - just first name
      const sleeperFirstName = sleeperName.split(' ')[0];
      if (sleeperFirstName.length > 2) {
        positionMatches.forEach(ffhPlayer => {
          const ffhName = this.normalizeNameForMatching(ffhPlayer.web_name || ffhPlayer.name);
          if (ffhName.includes(sleeperFirstName) || sleeperFirstName.includes(ffhName.split(' ')[0])) {
            candidates.push({
              player: ffhPlayer,
              score: 0.6, // Give it a decent score
              ffhName
            });
          }
        });
      }
    }

    if (candidates.length === 0) {
      diagnostics.push({
        sleeper: `${sleeperPlayer.name || sleeperPlayer.full_name} (${sleeperTeam})`,
        ffh: 'No matches found',
        method: 'Name Similarity',
        confidence: 'None',
        score: 0
      });
      this.matchCache.set(sleeperKey, null);
      return null;
    }

    // Sort by similarity score
    candidates.sort((a, b) => b.score - a.score);
    const bestMatch = candidates[0];
    
    // RELAXED confidence thresholds
    const confidence = bestMatch.score >= 0.85 ? 'High' : 
                     bestMatch.score >= 0.65 ? 'Medium' : 'Low';

    // LOWERED acceptance threshold from 0.7 to 0.5
    if (bestMatch.score >= 0.5) {
      this.matchCache.set(sleeperKey, bestMatch.player);
      diagnostics.push({
        sleeper: `${sleeperPlayer.name || sleeperPlayer.full_name} (${sleeperTeam})`,
        ffh: `${bestMatch.player.web_name || bestMatch.player.name}`,
        method: 'Name Similarity',
        confidence,
        score: bestMatch.score
      });
      return bestMatch.player;
    }

    // Still no good match
    diagnostics.push({
      sleeper: `${sleeperPlayer.name || sleeperPlayer.full_name} (${sleeperTeam})`,
      ffh: `Best: ${bestMatch.player.web_name || bestMatch.player.name} (${bestMatch.score.toFixed(2)})`,
      method: 'Name Similarity',
      confidence: 'Rejected',
      score: bestMatch.score
    });
    this.matchCache.set(sleeperKey, null);
    return null;
  }

  // Same as before but with relaxed matching
  async matchAllPlayers(sleeperPlayers, ffhPlayers) {
    const diagnostics = [];
    const matches = [];
    const stats = {
      total: sleeperPlayers.length,
      matched: 0,
      byMethod: {},
      byConfidence: {}
    };

    console.log(`🔄 RELAXED MATCHING: Processing ${sleeperPlayers.length} Sleeper players against ${ffhPlayers.length} FFH players`);

    for (const sleeperPlayer of sleeperPlayers) {
      const ffhMatch = this.findBestFFHMatch(sleeperPlayer, ffhPlayers, diagnostics);
      
      if (ffhMatch) {
        matches.push({
          sleeperPlayer,
          ffhPlayer: ffhMatch,
          confidence: diagnostics[diagnostics.length - 1]?.confidence || 'Unknown',
          method: diagnostics[diagnostics.length - 1]?.method || 'Unknown',
          score: diagnostics[diagnostics.length - 1]?.score || 0
        });
        stats.matched++;
        
        const method = diagnostics[diagnostics.length - 1]?.method || 'Unknown';
        stats.byMethod[method] = (stats.byMethod[method] || 0) + 1;
        
        const confidence = diagnostics[diagnostics.length - 1]?.confidence || 'Unknown';
        stats.byConfidence[confidence] = (stats.byConfidence[confidence] || 0) + 1;
      }
    }

    stats.matchRate = stats.total > 0 ? Math.round((stats.matched / stats.total) * 100) : 0;

    console.log(`✅ RELAXED MATCHING COMPLETE: ${stats.matched}/${stats.total} players matched (${stats.matchRate}%)`);

    return {
      matches,
      diagnostics,
      stats,
      summary: {
        totalSleeperPlayers: sleeperPlayers.length,
        totalFFHPlayers: ffhPlayers.length,
        matchedPlayers: stats.matched,
        matchRate: `${stats.matchRate}%`,
        newMatches: matches.filter(m => m.method !== 'Cache').length,
        averageConfidence: this.calculateAverageConfidence(matches)
      }
    };
  }

  calculateAverageConfidence(matches) {
    if (matches.length === 0) return 0;
    
    const confidenceValues = { 'High': 1, 'Medium': 0.7, 'Low': 0.4, 'None': 0 };
    const total = matches.reduce((sum, match) => {
      return sum + (confidenceValues[match.confidence] || 0);
    }, 0);
    
    return Math.round((total / matches.length) * 100);
  }

  clearCache() {
    this.matchCache.clear();
  }

  getCacheStats() {
    return {
      size: this.matchCache.size,
      keys: Array.from(this.matchCache.keys()).slice(0, 10)
    };
  }
}