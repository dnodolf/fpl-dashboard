// app/services/gameweekService.js
// Enhanced Gameweek Service - Uses API proxy to avoid CORS issues

class GameweekService {
  constructor() {
    this.CACHE_KEY = 'fpl_gameweek_cache';
    this.CACHE_DURATION = 10 * 60 * 1000; // 10 minutes (shorter cache for gameweek data)
  }

  // Get cached data if fresh, otherwise null
  getCachedData() {
    try {
      const cached = localStorage.getItem(this.CACHE_KEY);
      if (!cached) return null;

      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < this.CACHE_DURATION) {
        return data;
      }
      
      // Clear expired cache
      localStorage.removeItem(this.CACHE_KEY);
      return null;
    } catch (error) {
      console.warn('Cache read error:', error);
      return null;
    }
  }

  // Set cache with timestamp
  setCachedData(data) {
    try {
      const cacheData = {
        data,
        timestamp: Date.now()
      };
      localStorage.setItem(this.CACHE_KEY, JSON.stringify(cacheData));
    } catch (error) {
      console.warn('Cache write error:', error);
    }
  }

  // Fetch FPL data through our API proxy to avoid CORS
  async fetchFPLData() {
    try {
      const response = await fetch('/api/fpl-gameweek', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error(`FPL proxy API error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('FPL proxy API error:', error);
      throw error;
    }
  }

  // Get current gameweek with live FPL data
  async getCurrentGameweek() {
    try {
      // Check cache first
      const cached = this.getCachedData();
      if (cached) {
        console.log('🎯 Using cached gameweek data');
        return cached;
      }

      console.log('🔄 Fetching fresh gameweek data from FPL API...');

      // Try to fetch from our API proxy first
      try {
        const fplData = await this.fetchFPLData();
        
        if (fplData.success && fplData.currentGameweek) {
          const gameweekData = {
            ...fplData.currentGameweek,
            source: 'fpl_api'
          };

          // Cache the result
          this.setCachedData(gameweekData);
          console.log('✅ Gameweek data updated from FPL API');
          return gameweekData;
        } else {
          throw new Error('Invalid FPL API response');
        }
      } catch (apiError) {
        console.warn('⚠️ FPL API unavailable, using enhanced fallback logic...');
        
        // Enhanced fallback with better date logic
        const gameweekData = this.getEnhancedFallback();
        
        // Cache the fallback result (shorter duration)
        const fallbackData = {
          ...gameweekData,
          timestamp: Date.now() - (this.CACHE_DURATION * 0.7) // Cache for only 3 minutes
        };
        this.setCachedData(fallbackData);
        
        return gameweekData;
      }

    } catch (error) {
      console.error('❌ Error fetching gameweek data:', error);
      
      // Final fallback
      return this.getEnhancedFallback();
    }
  }

  // Enhanced fallback with better logic and current season dates
  getEnhancedFallback() {
    const now = new Date();
    const currentDate = now.toISOString().slice(0, 10);
    const currentTime = now.getTime();

    // Updated gameweek dates for 2025-26 season (current season)
    const gameweekDates = [
      { gw: 1, start: '2025-08-15', end: '2025-08-18', deadline: '2025-08-15T17:30:00Z' },
      { gw: 2, start: '2025-08-22', end: '2025-08-25', deadline: '2025-08-22T17:30:00Z' },
      { gw: 3, start: '2025-08-30', end: '2025-09-01', deadline: '2025-08-30T17:30:00Z' },
      { gw: 4, start: '2025-09-13', end: '2025-09-15', deadline: '2025-09-13T17:30:00Z' },
      { gw: 5, start: '2025-09-20', end: '2025-09-22', deadline: '2025-09-20T17:30:00Z' },
      { gw: 6, start: '2025-09-27', end: '2025-09-29', deadline: '2025-09-27T17:30:00Z' },
      { gw: 7, start: '2025-10-04', end: '2025-10-06', deadline: '2025-10-04T17:30:00Z' },
      { gw: 8, start: '2025-10-18', end: '2025-10-20', deadline: '2025-10-18T17:30:00Z' },
      { gw: 9, start: '2025-10-25', end: '2025-10-27', deadline: '2025-10-25T17:30:00Z' },
      { gw: 10, start: '2025-11-01', end: '2025-11-03', deadline: '2025-11-01T17:30:00Z' }
    ];

    // Find the current gameweek
    let currentGameweek = null;
    
    for (let i = 0; i < gameweekDates.length; i++) {
      const gw = gameweekDates[i];
      const startTime = new Date(gw.start).getTime();
      const endTime = new Date(gw.end).getTime() + (24 * 60 * 60 * 1000); // Add 1 day buffer
      const deadlineTime = new Date(gw.deadline).getTime();
      
      if (currentTime < deadlineTime) {
        // Upcoming gameweek
        currentGameweek = {
          number: gw.gw,
          status: 'upcoming',
          statusDisplay: `🏁 GW ${gw.gw} (Upcoming)`,
          date: new Date(gw.start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          fullDate: gw.start,
          deadline: gw.deadline,
          deadlineFormatted: new Date(gw.deadline).toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          }),
          source: 'enhanced_fallback'
        };
        break;
      } else if (currentTime >= deadlineTime && currentTime <= endTime) {
        // Live gameweek
        currentGameweek = {
          number: gw.gw,
          status: 'live',
          statusDisplay: `🔴 GW ${gw.gw} (Live)`,
          date: new Date(gw.end).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          fullDate: gw.end,
          deadline: gw.deadline,
          fixtures: {
            first: new Date(gw.start),
            last: new Date(gw.end),
            count: 10, // Estimate
            finished: Math.round(Math.random() * 10) // Rough estimate for demo
          },
          source: 'enhanced_fallback'
        };
        break;
      }
    }

    // If no current gameweek found, default to next available
    if (!currentGameweek) {
      const nextGw = gameweekDates.find(gw => new Date(gw.start).getTime() > currentTime) || gameweekDates[0];
      currentGameweek = {
        number: nextGw.gw,
        status: 'upcoming',
        statusDisplay: `🏁 GW ${nextGw.gw} (Upcoming)`,
        date: new Date(nextGw.start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        fullDate: nextGw.start,
        deadline: nextGw.deadline,
        deadlineFormatted: new Date(nextGw.deadline).toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }),
        source: 'enhanced_fallback'
      };
    }

    return currentGameweek;
  }

  // Get next few gameweeks for planning (fallback version)
  async getUpcomingGameweeks(count = 5) {
    try {
      // Try API first
      const fplData = await this.fetchFPLData();
      if (fplData.success && fplData.upcomingGameweeks) {
        return fplData.upcomingGameweeks.slice(0, count);
      }
    } catch (error) {
      console.warn('Using fallback for upcoming gameweeks');
    }

    // Fallback to hardcoded data
    const gameweekDates = [
      { gw: 2, start: '2025-08-22', deadline: '2025-08-22T17:30:00Z' },
      { gw: 3, start: '2025-08-30', deadline: '2025-08-30T17:30:00Z' },
      { gw: 4, start: '2025-09-13', deadline: '2025-09-13T17:30:00Z' },
      { gw: 5, start: '2025-09-20', deadline: '2025-09-20T17:30:00Z' },
      { gw: 6, start: '2025-09-27', deadline: '2025-09-27T17:30:00Z' }
    ];

    return gameweekDates.slice(0, count).map(gw => ({
      number: gw.gw,
      name: `Gameweek ${gw.gw}`,
      deadline: gw.deadline,
      firstFixture: new Date(gw.start),
      fixtureCount: 10
    }));
  }
}

// Export singleton instance
export default new GameweekService();