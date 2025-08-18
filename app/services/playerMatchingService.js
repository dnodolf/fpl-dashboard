// app/services/playerMatchingService.js

export class PlayerMatchingService {
  constructor() {
    // Name aliases for better matching
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

    // Team code mappings
    this.teamCodeMap = {
      'ARS': 'ARS', 'AVL': 'AVL', 'BOU': 'BOU', 'BRE': 'BRE',
      'BHA': 'BHA', 'BUR': 'BUR', 'CHE': 'CHE', 'CRY': 'CRY',
      'EVE': 'EVE', 'FUL': 'FUL', 'LIV': 'LIV', 'LUT': 'LUT',
      'MCI': 'MCI', 'MUN': 'MUN', 'NEW': 'NEW', 'NFO': 'NFO',
      'SHU': 'SHU', 'TOT': 'TOT', 'WHU': 'WHU', 'WOL': 'WOL'
    };

    // Position mappings
    this.positionMap = {
      'GKP': 1, 'GK': 1,
      'DEF': 2, 'D': 2,
      'MID': 3, 'M': 3,
      'FWD': 4, 'F': 4
    };

    // In-memory match cache
    this.matchCache = new Map();
  }

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

  // Normalize team name
  normalizeTeamForMatching(team) {
    if (!team) return '';
    const normalized = team.toUpperCase().trim();
    return this.teamCodeMap[normalized] || normalized;
  }

  // Calculate string similarity using Levenshtein distance
  calculateNameSimilarity(name1, name2) {
    if (!name1 || !name2) return 0;
    
    const len1 = name1.length;
    const len2 = name2.length;
    
    if (len1 === 0) return len2 === 0 ? 1 : 0;
    if (len2 === 0) return 0;

    // Create matrix
    const matrix = Array(len1 + 1).fill().map(() => Array(len2 + 1).fill(0));
    
    // Initialize first row and column
    for (let i = 0; i <= len1; i++) matrix[i][0] = i;
    for (let j = 0; j <= len2; j++) matrix[0][j] = j;
    
    // Fill the matrix
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = name1[i - 1] === name2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,     // deletion
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j - 1] + cost // substitution
        );
      }
    }
    
    const distance = matrix[len1][len2];
    const maxLength = Math.max(len1, len2);
    return (maxLength - distance) / maxLength;
  }

  // Find best FFH match for a Sleeper player
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
        ffh: cachedMatch ? `${cachedMatch.web_name || cachedMatch.name} (${this.getFFHTeam(cachedMatch)})` : 'No match',
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
          ffh: `${override.web_name || override.name} (${this.getFFHTeam(override)})`,
          method: 'Manual Override',
          confidence: 'High',
          score: 1.0
        });
        return override;
      }
    }

    // Filter by position if available
    let positionMatches = ffhPlayers;
    if (sleeperPlayer.position) {
      const sleeperPositionId = this.positionMap[sleeperPlayer.position];
      if (sleeperPositionId) {
        positionMatches = ffhPlayers.filter(p => 
          this.getFFHPositionId(p) === sleeperPositionId
        );
      }
    }

    if (positionMatches.length === 0) {
      diagnostics.push({
        sleeper: `${sleeperPlayer.name || sleeperPlayer.full_name} (${sleeperTeam})`,
        ffh: 'No position matches',
        method: 'Position Filter',
        confidence: 'None',
        score: 0
      });
      return null;
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
          ffh: `${optaMatch.web_name || optaMatch.name} (${this.getFFHTeam(optaMatch)})`,
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
          ffh: `${fplMatch.web_name || fplMatch.name} (${this.getFFHTeam(fplMatch)})`,
          method: 'FPL ID',
          confidence: 'High',
          score: 1.0
        });
        return fplMatch;
      }
    }

    // Name similarity matching
    const candidates = [];
    positionMatches.forEach(ffhPlayer => {
      const ffhName = this.normalizeNameForMatching(ffhPlayer.web_name || ffhPlayer.name);
      const similarity = this.calculateNameSimilarity(sleeperName, ffhName);
      
      if (similarity >= 0.7) {
        candidates.push({
          player: ffhPlayer,
          score: similarity,
          ffhName
        });
      }
    });

    if (candidates.length === 0) {
      diagnostics.push({
        sleeper: `${sleeperPlayer.name || sleeperPlayer.full_name} (${sleeperTeam})`,
        ffh: 'No name similarity matches',
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
    
    // Determine confidence level
    const confidence = bestMatch.score >= 0.95 ? 'High' : 
                     bestMatch.score >= 0.85 ? 'Medium' : 'Low';

    if (bestMatch.score >= 0.7) {
      this.matchCache.set(sleeperKey, bestMatch.player);
      diagnostics.push({
        sleeper: `${sleeperPlayer.name || sleeperPlayer.full_name} (${sleeperTeam})`,
        ffh: `${bestMatch.player.web_name || bestMatch.player.name} (${this.getFFHTeam(bestMatch.player)})`,
        method: 'Name Similarity',
        confidence,
        score: bestMatch.score
      });
      return bestMatch.player;
    }

    // No good match found
    diagnostics.push({
      sleeper: `${sleeperPlayer.name || sleeperPlayer.full_name} (${sleeperTeam})`,
      ffh: 'Score too low',
      method: 'Name Similarity',
      confidence: 'None',
      score: bestMatch.score
    });
    this.matchCache.set(sleeperKey, null);
    return null;
  }

  // Helper methods for extracting data from different FFH formats
  getFFHTeam(ffhPlayer) {
    return ffhPlayer.team_short_name || 
           ffhPlayer.team_abbr || 
           ffhPlayer.team || 
           '';
  }

  getFFHPositionId(ffhPlayer) {
    return ffhPlayer.element_type || 
           ffhPlayer.position_id || 
           ffhPlayer.position || 
           0;
  }

  // Match all players
  async matchAllPlayers(sleeperPlayers, ffhPlayers) {
    const diagnostics = [];
    const matches = [];
    const stats = {
      total: sleeperPlayers.length,
      matched: 0,
      byMethod: {},
      byConfidence: {}
    };

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
        
        // Track method stats
        const method = diagnostics[diagnostics.length - 1]?.method || 'Unknown';
        stats.byMethod[method] = (stats.byMethod[method] || 0) + 1;
        
        // Track confidence stats
        const confidence = diagnostics[diagnostics.length - 1]?.confidence || 'Unknown';
        stats.byConfidence[confidence] = (stats.byConfidence[confidence] || 0) + 1;
      }
    }

    stats.matchRate = stats.total > 0 ? Math.round((stats.matched / stats.total) * 100) : 0;

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

  // Clear cache
  clearCache() {
    this.matchCache.clear();
  }

  // Get cache stats
  getCacheStats() {
    return {
      size: this.matchCache.size,
      keys: Array.from(this.matchCache.keys()).slice(0, 10) // First 10 for debugging
    };
  }
}