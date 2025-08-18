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
      'SHU': 'SHU', 'TOT': 'TOT', 'WHU': 'WHU', 'WOL': 'WOL'
    };

    // Position mappings - MUCH MORE FLEXIBLE
    this.positionMap = {
      'GKP': 1, 'GK': 1, 'G': 1,
      'DEF': 2, 'D': 2,
      'MID': 3, 'M': 3,
      'FWD': 4, 'F': 4
    };

    // In-memory match cache
    this.matchCache = new Map();
  }

  // Normalize name for matching - MORE AGGRESSIVE
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

  // MUCH MORE FLEXIBLE name similarity
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

 // Find best FFH match - NOW WITH TEAM RESTRICTION
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
    if (cachedMatch) {
      diagnostics.push({
        sleeper: `${sleeperPlayer.name || sleeperPlayer.full_name} (${sleeperTeam})`,
        ffh: `${cachedMatch.web_name || cachedMatch.name} (${this.getFFHTeam(cachedMatch)})`,
        method: 'Cache',
        confidence: 'High',
        score: 1.0
      });
      return cachedMatch;
    }
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

  // Position filtering
  let positionMatches = ffhPlayers;
  if (sleeperPlayer.position) {
    const sleeperPositionId = this.positionMap[sleeperPlayer.position.toUpperCase()];
    if (sleeperPositionId) {
      const strictMatches = ffhPlayers.filter(p => 
        this.getFFHPositionId(p) === sleeperPositionId
      );
      if (strictMatches.length > 0) {
        positionMatches = strictMatches;
      }
    }
  }

  // Team filtering (NEW) - narrow to players on same team if possible
  const teamMatches = positionMatches.filter(p =>
    this.normalizeTeamForMatching(this.getFFHTeam(p)) === sleeperTeam
  );
  const searchPool = teamMatches.length > 0 ? teamMatches : positionMatches;

  // Opta ID match
  if (sleeperPlayer.opta_id) {
    const optaMatch = searchPool.find(p => 
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

  // FPL ID match
  if (sleeperPlayer.rotowire_id) {
    const fplMatch = searchPool.find(p => 
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

  // Name similarity matching (restricted to searchPool)
  const candidates = [];
  searchPool.forEach(ffhPlayer => {
    const ffhName = this.normalizeNameForMatching(ffhPlayer.web_name || ffhPlayer.name);
    const similarity = this.calculateNameSimilarity(sleeperName, ffhName);
    if (similarity >= 0.4) {
      candidates.push({ player: ffhPlayer, score: similarity, ffhName });
    }
  });

  // Backup flexible matching
  if (candidates.length === 0) {
    const sleeperParts = sleeperName.split(' ');
    const longestPart = sleeperParts.reduce((a, b) => a.length > b.length ? a : b, '');
    if (longestPart.length > 3) {
      searchPool.forEach(ffhPlayer => {
        const ffhName = this.normalizeNameForMatching(ffhPlayer.web_name || ffhPlayer.name);
        if (ffhName.includes(longestPart) || longestPart.includes(ffhName.replace(/\./g, ''))) {
          candidates.push({ player: ffhPlayer, score: 0.5, ffhName });
        }
      });
    }
  }

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

  // Pick best similarity match
  candidates.sort((a, b) => b.score - a.score);
  const bestMatch = candidates[0];
  const confidence = bestMatch.score >= 0.8 ? 'High' : bestMatch.score >= 0.6 ? 'Medium' : 'Low';

  if (bestMatch.score >= 0.4) {
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

  // No good match
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

  // Match all players - with progress logging
async matchAllPlayers(sleeperPlayers, ffhPlayers) {
  const diagnostics = [];
  const matches = [];
  const stats = { total: sleeperPlayers.length, matched: 0, byMethod: {}, byConfidence: {} };

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
    }
  }

  // 🚨 Dedupe FFH players (keep best score/confidence)
  const seen = new Map();
  for (const m of matches) {
    const ffhId = m.ffhPlayer.id || m.ffhPlayer.element_id;
    const current = seen.get(ffhId);

    if (!current) {
      seen.set(ffhId, m);
    } else {
      const isBetter = m.score > current.score ||
        (m.score === current.score && this.confidenceRank(m.confidence) > this.confidenceRank(current.confidence));
      if (isBetter) seen.set(ffhId, m);
    }
  }

  const dedupedMatches = Array.from(seen.values());

  stats.matchRate = stats.total > 0 ? Math.round((dedupedMatches.length / stats.total) * 100) : 0;

  return {
    matches: dedupedMatches,
    diagnostics,
    stats,
    summary: {
      totalSleeperPlayers: sleeperPlayers.length,
      totalFFHPlayers: ffhPlayers.length,
      matchedPlayers: dedupedMatches.length,
      matchRate: `${stats.matchRate}%`,
      newMatches: dedupedMatches.filter(m => m.method !== 'Cache').length,
      averageConfidence: this.calculateAverageConfidence(dedupedMatches)
    }
  };
}

// Helper to rank confidence levels numerically
confidenceRank(confidence) {
  switch (confidence) {
    case 'High': return 3;
    case 'Medium': return 2;
    case 'Low': return 1;
    default: return 0;
  }
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