class DataService {
  constructor() {
    this.cache = new Map();
    this.cacheExpiry = new Map();
    this.defaultCacheTime = 5 * 60 * 1000; // 5 minutes
  }

  // Cache management
  setCache(key, data, expiry = this.defaultCacheTime) {
    this.cache.set(key, data);
    this.cacheExpiry.set(key, Date.now() + expiry);
  }

  getCache(key) {
    if (!this.cache.has(key)) return null;
    
    const expiry = this.cacheExpiry.get(key);
    if (Date.now() > expiry) {
      this.cache.delete(key);
      this.cacheExpiry.delete(key);
      return null;
    }
    
    return this.cache.get(key);
  }

  clearCache(key) {
    if (key) {
      this.cache.delete(key);
      this.cacheExpiry.delete(key);
    } else {
      this.cache.clear();
      this.cacheExpiry.clear();
    }
  }

  // API calls with caching and error handling
  async fetchWithRetry(url, options = {}, retries = 3) {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch(url, {
          ...options,
          timeout: 10000, // 10 second timeout
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return await response.json();
      } catch (error) {
        console.warn(`Attempt ${i + 1} failed:`, error.message);
        
        if (i === retries - 1) throw error;
        
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
      }
    }
  }

  // Enhanced player data fetching
  async getPlayerData(forceRefresh = false) {
    const cacheKey = 'playerData';
    
    if (!forceRefresh) {
      const cached = this.getCache(cacheKey);
      if (cached) return cached;
    }

    try {
      // This will be replaced with real API calls
      const mockData = await this.getMockPlayerData();
      
      this.setCache(cacheKey, mockData, 10 * 60 * 1000); // 10 minutes
      return mockData;
      
    } catch (error) {
      console.error('Error fetching player data:', error);
      throw new Error('Failed to fetch player data. Please try again.');
    }
  }

  // Player search with debouncing and caching
  searchPlayers(players, searchTerm, filters = {}) {
    if (!searchTerm && Object.keys(filters).length === 0) return players;

    return players.filter(player => {
      // Search term filter
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const name = (player.name || '').toLowerCase();
        const team = (player.team || '').toLowerCase();
        
        if (!name.includes(term) && !team.includes(term)) {
          return false;
        }
      }

      // Position filter
      if (filters.position && filters.position !== 'all') {
        if (player.position !== filters.position) return false;
      }

      // Availability filter
      if (filters.availability && filters.availability !== 'all') {
        if (filters.availability === 'available' && !player.is_available) return false;
        if (filters.availability === 'owned' && player.is_available) return false;
      }

      // Team filter
      if (filters.team && filters.team !== 'all') {
        if (player.team !== filters.team) return false;
      }

      // Points filter
      if (filters.minPoints && player.sleeper_points < filters.minPoints) {
        return false;
      }

      return true;
    });
  }

  // Placeholder for mock data (will be replaced with real APIs)
  async getMockPlayerData() {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return [
      {
        name: "Erling Haaland",
        position: "FWD",
        team: "MCI",
        ownership: "65%",
        price: 15.0,
        predicted_points: 8.5,
        sleeper_points: 12.3,
        form: "WWWLW",
        owned_by: "TeamA",
        is_available: false
      },
      // ... more mock data
    ];
  }

  // Formation optimization
  optimizeFormation(players, formation) {
    const lineup = {};
    let totalPoints = 0;

    Object.entries(formation.positions).forEach(([position, count]) => {
      const positionPlayers = players
        .filter(p => p.position === position)
        .sort((a, b) => b.sleeper_points - a.sleeper_points)
        .slice(0, count);

      lineup[position] = positionPlayers;
      totalPoints += positionPlayers.reduce((sum, p) => sum + p.sleeper_points, 0);
    });

    return { lineup, totalPoints };
  }
}

// Export singleton instance
export const dataService = new DataService();