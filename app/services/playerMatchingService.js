// app/services/playerMatchingService.js
class PlayerMatchingService {
  constructor() {
    this.matchCache = new Map();
    this.similarityCache = new Map();
    
    // Team code mappings (from your Apps Script)
    this.teamCodeFix = {
      'ARS': 'ARS', 'AVL': 'AVL', 'BOU': 'BOU', 'BRE': 'BRE',
      'BHA': 'BHA', 'BUR': 'BUR', 'CHE': 'CHE', 'CRY': 'CRY',
      'EVE': 'EVE', 'FUL': 'FUL', 'LIV': 'LIV', 'LUT': 'LUT',
      'MCI': 'MCI', 'MUN': 'MUN', 'NEW': 'NEW', 'NFO': 'NFO',
      'SHU': 'SHU', 'TOT': 'TOT', 'WHU': 'WHU', 'WOL': 'WOL'
    };

    // Name aliases for common variations (from your Apps Script)
    this.nameAliases = {
      'alex': 'alexander',
      'andy': 'andrew',
      'bobby': 'robert',
      'charlie': 'charles',
      'chris': 'christopher',
      'dave': 'david',
      'eddie': 'edward',
      'fred': 'frederick',
      'gerry': 'gerard',
      'jimmy': 'james',
      'johnny': 'john',
      'mike': 'michael',
      'nick': 'nicholas',
      'pat': 'patrick',
      'rick': 'richard',
      'rob': 'robert',
      'sam': 'samuel',
      'steve': 'stephen',
      'tom': 'thomas',
      'tony': 'anthony',
      'will': 'william'
    };

    // Manual overrides for problematic matches
    this.manualOverrides = {};
  }

  // Main matching function (port of your Apps Script logic)
  async findBestFFHMatch(sleeperPlayer, ffhPlayers, persistentMatchMap = {}) {
    const sleeperName = this.normalizeNameForMatching(sleeperPlayer.full_name || '');
    const sleeperTeam = this.normalizeTeamForMatching(sleeperPlayer.team_abbr || '');
    const sleeperKey = `${sleeperName}|${sleeperTeam}`;

    const diagnostics = {
      sleeper: `${sleeperPlayer.full_name} (${sleeperTeam})`,
      ffh: '',
      method: '',
      confidence: '',
      score: 0
    };

    // 1. Check persistent match map first
    if (persistentMatchMap[sleeperKey]) {
      const mapped = ffhPlayers.find(p => 
        `${this.normalizeNameForMatching(p.web_name || p.name)}|${this.normalizeTeamForMatching(p.team_short_name || p.team)}` === persistentMatchMap[sleeperKey]
      );
      
      if (mapped) {
        diagnostics.ffh = `${mapped.web_name || mapped.name} (${mapped.team_short_name || mapped.team})`;
        diagnostics.method = 'Persistent Map';
        diagnostics.confidence = 'High';
        diagnostics.score = 1.0;
        return { match: mapped, diagnostics };
      }
    }

    // 2. Check manual overrides
    if (this.manualOverrides[sleeperKey]) {
      const override = ffhPlayers.find(p => 
        `${this.normalizeNameForMatching(p.web_name || p.name)}|${this.normalizeTeamForMatching(p.team_short_name || p.team)}` === this.manualOverrides[sleeperKey]
      );
      
      if (override) {
        diagnostics.ffh = `${override.web_name || override.name} (${override.team_short_name || override.team})`;
        diagnostics.method = 'Manual Override';
        diagnostics.confidence = 'High';
        diagnostics.score = 1.0;
        return { match: override, diagnostics };
      }
    }

    // 3. Opta ID matching (most reliable when available)
    if (sleeperPlayer.opta_id) {
      const optaMatch = ffhPlayers.find(p => p.opta_id === sleeperPlayer.opta_id);
      
      if (optaMatch) {
        diagnostics.ffh = `${optaMatch.web_name || optaMatch.name} (${optaMatch.team_short_name || optaMatch.team})`;
        diagnostics.method = 'Opta ID';
        diagnostics.confidence = 'High';
        diagnostics.score = 1.0;
        return { match: optaMatch, diagnostics };
      }
    }

    // 4. FPL ID matching (secondary ID matching)
    if (sleeperPlayer.fpl_id) {
      const fplMatch = ffhPlayers.find(p => p.id === sleeperPlayer.fpl_id);
      
      if (fplMatch) {
        diagnostics.ffh = `${fplMatch.web_name || fplMatch.name} (${fplMatch.team_short_name || fplMatch.team})`;
        diagnostics.method = 'FPL ID';
        diagnostics.confidence = 'High';
        diagnostics.score = 1.0;
        return { match: fplMatch, diagnostics };
      }
    }

    // 5. Name similarity matching with team and position filtering
    const sleeperPositions = sleeperPlayer.fantasy_positions || [sleeperPlayer.position] || [];
    let bestMatch = null;
    let bestScore = 0;
    const minScore = 0.7; // Minimum similarity threshold

    for (const ffhPlayer of ffhPlayers) {
      const ffhName = this.normalizeNameForMatching(ffhPlayer.web_name || ffhPlayer.name);
      const ffhTeam = this.normalizeTeamForMatching(ffhPlayer.team_short_name || ffhPlayer.team);
      const ffhPosition = this.mapFFHPosition(ffhPlayer.element_type || ffhPlayer.position);

      // Team filter - must match unless unknown
      if (sleeperTeam && ffhTeam && sleeperTeam !== ffhTeam) {
        continue;
      }

      // Position filter - at least one position must match
      if (sleeperPositions.length > 0 && ffhPosition) {
        const positionMatch = sleeperPositions.some(pos => 
          this.normalizePosition(pos) === this.normalizePosition(ffhPosition)
        );
        if (!positionMatch) {
          continue;
        }
      }

      // Calculate name similarity
      const similarity = this.calculateNameSimilarity(sleeperName, ffhName);
      
      if (similarity > bestScore && similarity >= minScore) {
        bestScore = similarity;
        bestMatch = ffhPlayer;
      }
    }

    if (bestMatch) {
      diagnostics.ffh = `${bestMatch.web_name || bestMatch.name} (${bestMatch.team_short_name || bestMatch.team})`;
      diagnostics.method = 'Name Similarity';
      diagnostics.confidence = bestScore > 0.9 ? 'High' : bestScore > 0.8 ? 'Medium' : 'Low';
      diagnostics.score = bestScore;
      return { match: bestMatch, diagnostics };
    }

    // 6. Fuzzy matching (relaxed criteria)
    for (const ffhPlayer of ffhPlayers) {
      const ffhName = this.normalizeNameForMatching(ffhPlayer.web_name || ffhPlayer.name);
      const ffhTeam = this.normalizeTeamForMatching(ffhPlayer.team_short_name || ffhPlayer.team);

      // Only team matching (no position requirement)
      if (sleeperTeam && ffhTeam && sleeperTeam === ffhTeam) {
        const similarity = this.calculateNameSimilarity(sleeperName, ffhName);
        
        if (similarity >= 0.6) { // Lower threshold for fuzzy matching
          diagnostics.ffh = `${ffhPlayer.web_name || ffhPlayer.name} (${ffhPlayer.team_short_name || ffhPlayer.team})`;
          diagnostics.method = 'Fuzzy Match';
          diagnostics.confidence = 'Low';
          diagnostics.score = similarity;
          return { match: ffhPlayer, diagnostics };
        }
      }
    }

    // No match found
    diagnostics.method = 'No Match';
    diagnostics.confidence = 'None';
    return { match: null, diagnostics };
  }

  // Name normalization (port from Apps Script utils.gs)
  normalizeNameForMatching(name) {
    if (!name || typeof name !== 'string') return '';
    
    let normalized = name
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, '') // Remove accents
      .toLowerCase()
      .replace(/[-']/g, ' ') // Replace hyphens and apostrophes with spaces
      .replace(/\./g, '') // Remove periods
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/\b(jr|sr|iii|ii|iv)\b/gi, '') // Remove suffixes
      .trim();
    
    // Apply name aliases
    const parts = normalized.split(' ').filter(part => part.length > 0);
    if (parts.length > 0 && this.nameAliases[parts[0]]) {
      parts[0] = this.nameAliases[parts[0]];
    }
    
    return parts.join(' ');
  }

  // Team normalization
  normalizeTeamForMatching(team) {
    if (!team || typeof team !== 'string') return '';
    const upperTeam = team.toUpperCase().trim();
    return this.teamCodeFix[upperTeam] || upperTeam;
  }

  // Position mapping and normalization
  mapFFHPosition(elementType) {
    const positionMap = {
      1: 'GKP',
      2: 'DEF', 
      3: 'MID',
      4: 'FWD'
    };
    return positionMap[elementType] || elementType;
  }

  normalizePosition(position) {
    const posMap = {
      'GK': 'GKP', 'GKP': 'GKP', 'GOALKEEPER': 'GKP',
      'DEF': 'DEF', 'DEFENDER': 'DEF', 'D': 'DEF',
      'MID': 'MID', 'MIDFIELDER': 'MID', 'M': 'MID',
      'FWD': 'FWD', 'FORWARD': 'FWD', 'F': 'FWD', 'ATT': 'FWD'
    };
    return posMap[position?.toUpperCase()] || position;
  }

  // Levenshtein distance calculation (from Apps Script utils.gs)
  calculateNameSimilarity(str1, str2) {
    if (str1 === str2) return 1.0;
    
    const maxLength = Math.max(str1.length, str2.length);
    if (maxLength === 0) return 1.0;
    
    const distance = this.levenshteinDistance(str1, str2);
    return 1 - (distance / maxLength);
  }

  levenshteinDistance(str1, str2) {
    const cacheKey = `${str1}|${str2}`;
    if (this.similarityCache.has(cacheKey)) {
      return this.similarityCache.get(cacheKey);
    }

    const matrix = [];
    const len1 = str1.length;
    const len2 = str2.length;

    // Initialize matrix
    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }

    // Fill matrix
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,       // deletion
          matrix[i][j - 1] + 1,       // insertion
          matrix[i - 1][j - 1] + cost // substitution
        );
      }
    }

    const distance = matrix[len1][len2];
    this.similarityCache.set(cacheKey, distance);
    return distance;
  }

  // Batch matching for multiple players
  async matchPlayers(sleeperPlayers, ffhPlayers, persistentMatchMap = {}) {
    const results = [];
    const newMatches = {};
    
    for (const sleeperPlayer of sleeperPlayers) {
      const result = await this.findBestFFHMatch(sleeperPlayer, ffhPlayers, persistentMatchMap);
      results.push({
        sleeperPlayer,
        ffhPlayer: result.match,
        diagnostics: result.diagnostics
      });

      // Track new matches for persistent map
      if (result.match && result.diagnostics.method !== 'Persistent Map') {
        const sleeperKey = `${this.normalizeNameForMatching(sleeperPlayer.full_name)}|${this.normalizeTeamForMatching(sleeperPlayer.team_abbr)}`;
        const ffhKey = `${this.normalizeNameForMatching(result.match.web_name || result.match.name)}|${this.normalizeTeamForMatching(result.match.team_short_name || result.match.team)}`;
        newMatches[sleeperKey] = ffhKey;
      }
    }

    return {
      matches: results,
      newMatches,
      diagnostics: results.map(r => r.diagnostics),
      matchRate: results.filter(r => r.ffhPlayer).length / results.length
    };
  }

  // Get match statistics
  getMatchingStats(results) {
    const stats = {
      total: results.length,
      matched: 0,
      byMethod: {},
      byConfidence: {},
      averageScore: 0
    };

    let totalScore = 0;
    
    results.forEach(result => {
      if (result.ffhPlayer) {
        stats.matched++;
        
        const method = result.diagnostics.method;
        const confidence = result.diagnostics.confidence;
        
        stats.byMethod[method] = (stats.byMethod[method] || 0) + 1;
        stats.byConfidence[confidence] = (stats.byConfidence[confidence] || 0) + 1;
        
        totalScore += result.diagnostics.score;
      }
    });

    stats.matchRate = stats.matched / stats.total;
    stats.averageScore = stats.matched > 0 ? totalScore / stats.matched : 0;

    return stats;
  }

  // Clear caches
  clearCaches() {
    this.matchCache.clear();
    this.similarityCache.clear();
  }
}

export const playerMatchingService = new PlayerMatchingService();