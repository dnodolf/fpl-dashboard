// app/services/enhancedDataService.js
import { cacheService } from './cacheService';

// Dynamic import to avoid build issues
let ffhApiService = null;

async function getFFHService() {
  if (!ffhApiService) {
    const module = await import('./ffhApiService');
    ffhApiService = module.ffhApiService;
  }
  return ffhApiService;
}

class EnhancedDataService {
  constructor() {
    this.listeners = new Set();
    this.requestQueue = new Map();
    this.lastUpdateTimestamp = null;
  }

  // Unified data fetching with intelligent caching
  async fetchPlayerData(source = 'auto', forceRefresh = false) {
    const cacheKey = `player-data-${source}`;
    
    // Return cached data if available and not forcing refresh
    if (!forceRefresh) {
      const cached = cacheService.get(cacheKey);
      if (cached) {
        this.notifyListeners('data-loaded', { ...cached, fromCache: true });
        return cached;
      }
    }

    try {
      this.notifyListeners('loading-start', { source });
      
      let data;
      switch (source) {
        case 'ffh':
          data = await this.fetchFFHData();
          break;
        case 'sheets':
          data = await this.fetchSheetsData();
          break;
        case 'auto':
        default:
          data = await this.fetchAutoSource();
          break;
      }

      // Cache the results
      cacheService.set(cacheKey, data);
      this.lastUpdateTimestamp = Date.now();
      
      this.notifyListeners('data-loaded', { ...data, fromCache: false });
      return data;

    } catch (error) {
      this.notifyListeners('error', { error: error.message, source });
      throw error;
    }
  }

  // Auto-source selection with fallback strategy
  async fetchAutoSource() {
    try {
      // Try Google Sheets first (user's curated data)
      const sheetsData = await this.fetchSheetsData();
      if (sheetsData.players && sheetsData.players.length > 0) {
        return { ...sheetsData, source: 'sheets-primary' };
      }
    } catch (sheetsError) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('Google Sheets failed, falling back to FFH:', sheetsError.message);
      }
    }

    try {
      // Fallback to FFH API
      const ffhData = await this.fetchFFHData();
      return { ...ffhData, source: 'ffh-fallback' };
    } catch (ffhError) {
      throw new Error(`Both data sources failed. Sheets: ${sheetsError?.message}, FFH: ${ffhError.message}`);
    }
  }

  async fetchFFHData() {
    const ffhService = await getFFHService();
    const players = await ffhService.getPlayerPredictions();
    const transformedPlayers = ffhService.transformFFHData(players);
    
    return {
      players: transformedPlayers,
      count: transformedPlayers.length,
      source: 'Fantasy Football Hub',
      lastUpdated: new Date().toISOString()
    };
  }

  async fetchSheetsData() {
    const response = await fetch('/api/sheets/players');
    if (!response.ok) {
      throw new Error(`Sheets API error: ${response.status}`);
    }
    
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'Sheets API failed');
    }
    
    return result;
  }

  // Enhanced search with multiple strategies
  searchPlayers(players, searchTerm, filters = {}) {
    if (!searchTerm && Object.keys(filters).every(key => !filters[key] || filters[key] === 'all')) {
      return players;
    }

    return players.filter(player => {
      // Multi-field search
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const searchableFields = [
          player.name || '',
          player.team || '',
          player.position || '',
          player.owned_by || ''
        ].join(' ').toLowerCase();
        
        if (!searchableFields.includes(term)) {
          return false;
        }
      }

      // Advanced filters
      if (filters.position && filters.position !== 'all' && player.position !== filters.position) {
        return false;
      }

      if (filters.availability && filters.availability !== 'all') {
        if (filters.availability === 'available' && !player.is_available) return false;
        if (filters.availability === 'owned' && player.is_available) return false;
      }

      if (filters.team && filters.team !== 'all' && player.team !== filters.team) {
        return false;
      }

      if (filters.minPoints && (player.sleeper_points || 0) < filters.minPoints) {
        return false;
      }

      if (filters.maxPrice && (player.price || 0) > filters.maxPrice) {
        return false;
      }

      if (filters.minOwnership) {
        const ownership = parseFloat((player.ownership || '0%').replace('%', ''));
        if (ownership < filters.minOwnership) return false;
      }

      return true;
    });
  }

  // Enhanced formation optimization with multiple strategies
  optimizeFormation(players, formation, strategy = 'points') {
    const lineup = {};
    let totalPoints = 0;
    let totalCost = 0;

    Object.entries(formation.positions).forEach(([position, count]) => {
      let positionPlayers = players.filter(p => p.position === position);

      // Apply optimization strategy
      switch (strategy) {
        case 'points':
          positionPlayers = positionPlayers.sort((a, b) => (b.sleeper_points || 0) - (a.sleeper_points || 0));
          break;
        case 'value':
          positionPlayers = positionPlayers.sort((a, b) => {
            const aValue = (a.sleeper_points || 0) / Math.max(a.price || 1, 0.1);
            const bValue = (b.sleeper_points || 0) / Math.max(b.price || 1, 0.1);
            return bValue - aValue;
          });
          break;
        case 'form':
          positionPlayers = positionPlayers.sort((a, b) => {
            const aForm = this.calculateFormScore(a.form || '');
            const bForm = this.calculateFormScore(b.form || '');
            return bForm - aForm;
          });
          break;
        case 'ownership':
          positionPlayers = positionPlayers.sort((a, b) => {
            const aOwn = parseFloat((a.ownership || '0%').replace('%', ''));
            const bOwn = parseFloat((b.ownership || '0%').replace('%', ''));
            return aOwn - bOwn; // Lower ownership = more differential
          });
          break;
      }

      const selectedPlayers = positionPlayers.slice(0, count);
      lineup[position] = selectedPlayers;
      
      totalPoints += selectedPlayers.reduce((sum, p) => sum + (p.sleeper_points || 0), 0);
      totalCost += selectedPlayers.reduce((sum, p) => sum + (p.price || 0), 0);
    });

    return { 
      lineup, 
      totalPoints: Math.round(totalPoints * 10) / 10,
      totalCost: Math.round(totalCost * 10) / 10,
      strategy,
      averageOwnership: this.calculateAverageOwnership(lineup)
    };
  }

  calculateFormScore(form) {
    if (!form) return 0;
    
    const scores = { 'W': 3, 'D': 1, 'L': 0 };
    const recentWeight = [1, 0.8, 0.6, 0.4, 0.2]; // More recent games weighted higher
    
    return form.split('').reverse().reduce((total, result, index) => {
      const weight = recentWeight[index] || 0.1;
      return total + (scores[result] || 0) * weight;
    }, 0);
  }

  calculateAverageOwnership(lineup) {
    const allPlayers = Object.values(lineup).flat();
    const totalOwnership = allPlayers.reduce((sum, player) => {
      return sum + parseFloat((player.ownership || '0%').replace('%', ''));
    }, 0);
    
    return Math.round((totalOwnership / allPlayers.length) * 10) / 10;
  }

  // Data quality metrics
  getDataQuality(players) {
    const metrics = {
      totalPlayers: players.length,
      completenessScore: 0,
      issues: [],
      coverage: {
        hasName: 0,
        hasPosition: 0,
        hasTeam: 0,
        hasPoints: 0,
        hasPrice: 0
      }
    };

    players.forEach(player => {
      if (player.name) metrics.coverage.hasName++;
      if (player.position) metrics.coverage.hasPosition++;
      if (player.team) metrics.coverage.hasTeam++;
      if (player.sleeper_points > 0) metrics.coverage.hasPoints++;
      if (player.price > 0) metrics.coverage.hasPrice++;

      // Identify potential issues
      if (!player.name) metrics.issues.push(`Missing name for player ID: ${player.id}`);
      if (player.sleeper_points > 50) metrics.issues.push(`Unusually high points for ${player.name}: ${player.sleeper_points}`);
      if (player.price > 20) metrics.issues.push(`Unusually high price for ${player.name}: £${player.price}m`);
    });

    // Calculate completeness score
    const totalFields = Object.keys(metrics.coverage).length;
    const avgCompleteness = Object.values(metrics.coverage).reduce((sum, count) => {
      return sum + (count / players.length);
    }, 0) / totalFields;
    
    metrics.completenessScore = Math.round(avgCompleteness * 100);

    return metrics;
  }

  // Event system for real-time updates
  addListener(callback) {
    this.listeners.add(callback);
  }

  removeListener(callback) {
    this.listeners.delete(callback);
  }

  notifyListeners(event, data) {
    this.listeners.forEach(callback => {
      try {
        callback(event, data);
      } catch (error) {
        console.error('Listener error:', error);
      }
    });
  }

  // Health check with detailed diagnostics
  async healthCheck() {
    const checks = {
      sheets: { status: 'unknown', message: '', responseTime: 0 },
      ffh: { status: 'unknown', message: '', responseTime: 0 },
      cache: { status: 'unknown', message: '', stats: null }
    };

    // Test Google Sheets
    try {
      const start = Date.now();
      const sheetsResponse = await fetch('/api/sheets/players');
      checks.sheets.responseTime = Date.now() - start;
      
      if (sheetsResponse.ok) {
        const data = await sheetsResponse.json();
        checks.sheets.status = data.success ? 'healthy' : 'error';
        checks.sheets.message = data.success ? `${data.count} players` : data.error;
      } else {
        checks.sheets.status = 'error';
        checks.sheets.message = `HTTP ${sheetsResponse.status}`;
      }
    } catch (error) {
      checks.sheets.status = 'error';
      checks.sheets.message = error.message;
    }

    // Test FFH API
    try {
      const ffhHealth = await ffhApiService.healthCheck();
      checks.ffh = ffhHealth;
    } catch (error) {
      checks.ffh.status = 'error';
      checks.ffh.message = error.message;
    }

    // Cache status
    try {
      checks.cache.status = 'healthy';
      checks.cache.stats = cacheService.getStats();
      checks.cache.message = `${checks.cache.stats.totalEntries} entries`;
    } catch (error) {
      checks.cache.status = 'error';
      checks.cache.message = error.message;
    }

    return {
      overall: Object.values(checks).every(check => check.status === 'healthy') ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      checks
    };
  }
}

export const enhancedDataService = new EnhancedDataService();