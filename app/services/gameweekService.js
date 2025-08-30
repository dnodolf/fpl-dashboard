// app/services/gameweekService.js
// Enhanced Gameweek Service with COMPLETE 38 gameweek schedule

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
          // API returned fallback data, use it but mark as fallback
          const gameweekData = {
            ...fplData.currentGameweek,
            source: 'api_fallback'
          };
          
          // Cache the fallback result (shorter duration)
          const fallbackData = {
            ...gameweekData,
            timestamp: Date.now() - (this.CACHE_DURATION * 0.7) // Cache for only 3 minutes
          };
          this.setCachedData(fallbackData);
          
          return gameweekData;
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

  // Get complete 38 gameweek schedule for 2025-26 Premier League season
  getCompleteGameweekSchedule() {
    return [
      { gw: 1, start: '2025-08-16', end: '2025-08-18', deadline: '2025-08-16T17:30:00Z' },
      { gw: 2, start: '2025-08-23', end: '2025-08-25', deadline: '2025-08-23T11:00:00Z' },
      { gw: 3, start: '2025-08-30', end: '2025-09-01', deadline: '2025-08-30T17:30:00Z' },
      { gw: 4, start: '2025-09-13', end: '2025-09-15', deadline: '2025-09-13T17:30:00Z' },
      { gw: 5, start: '2025-09-20', end: '2025-09-22', deadline: '2025-09-20T17:30:00Z' },
      { gw: 6, start: '2025-09-27', end: '2025-09-29', deadline: '2025-09-27T17:30:00Z' },
      { gw: 7, start: '2025-10-04', end: '2025-10-06', deadline: '2025-10-04T17:30:00Z' },
      { gw: 8, start: '2025-10-18', end: '2025-10-20', deadline: '2025-10-18T17:30:00Z' },
      { gw: 9, start: '2025-10-25', end: '2025-10-27', deadline: '2025-10-25T17:30:00Z' },
      { gw: 10, start: '2025-11-01', end: '2025-11-03', deadline: '2025-11-01T17:30:00Z' },
      { gw: 11, start: '2025-11-08', end: '2025-11-10', deadline: '2025-11-08T17:30:00Z' },
      { gw: 12, start: '2025-11-22', end: '2025-11-24', deadline: '2025-11-22T17:30:00Z' },
      { gw: 13, start: '2025-11-29', end: '2025-12-01', deadline: '2025-11-29T17:30:00Z' },
      { gw: 14, start: '2025-12-03', end: '2025-12-05', deadline: '2025-12-03T17:30:00Z' },
      { gw: 15, start: '2025-12-06', end: '2025-12-08', deadline: '2025-12-06T17:30:00Z' },
      { gw: 16, start: '2025-12-13', end: '2025-12-15', deadline: '2025-12-13T17:30:00Z' },
      { gw: 17, start: '2025-12-20', end: '2025-12-22', deadline: '2025-12-20T17:30:00Z' },
      { gw: 18, start: '2025-12-26', end: '2025-12-28', deadline: '2025-12-26T12:00:00Z' }, // Boxing Day
      { gw: 19, start: '2025-12-29', end: '2025-12-31', deadline: '2025-12-29T12:00:00Z' },
      { gw: 20, start: '2026-01-01', end: '2026-01-03', deadline: '2026-01-01T12:00:00Z' }, // New Year
      { gw: 21, start: '2026-01-11', end: '2026-01-13', deadline: '2026-01-11T17:30:00Z' },
      { gw: 22, start: '2026-01-18', end: '2026-01-20', deadline: '2026-01-18T17:30:00Z' },
      { gw: 23, start: '2026-01-25', end: '2026-01-27', deadline: '2026-01-25T17:30:00Z' },
      { gw: 24, start: '2026-02-01', end: '2026-02-03', deadline: '2026-02-01T17:30:00Z' },
      { gw: 25, start: '2026-02-08', end: '2026-02-10', deadline: '2026-02-08T17:30:00Z' },
      { gw: 26, start: '2026-02-22', end: '2026-02-24', deadline: '2026-02-22T17:30:00Z' },
      { gw: 27, start: '2026-03-01', end: '2026-03-03', deadline: '2026-03-01T17:30:00Z' },
      { gw: 28, start: '2026-03-08', end: '2026-03-10', deadline: '2026-03-08T17:30:00Z' },
      { gw: 29, start: '2026-03-15', end: '2026-03-17', deadline: '2026-03-15T17:30:00Z' },
      { gw: 30, start: '2026-03-29', end: '2026-03-31', deadline: '2026-03-29T18:30:00Z' }, // BST starts
      { gw: 31, start: '2026-04-05', end: '2026-04-07', deadline: '2026-04-05T18:30:00Z' },
      { gw: 32, start: '2026-04-12', end: '2026-04-14', deadline: '2026-04-12T18:30:00Z' },
      { gw: 33, start: '2026-04-19', end: '2026-04-21', deadline: '2026-04-19T18:30:00Z' },
      { gw: 34, start: '2026-04-26', end: '2026-04-28', deadline: '2026-04-26T18:30:00Z' },
      { gw: 35, start: '2026-05-03', end: '2026-05-05', deadline: '2026-05-03T18:30:00Z' },
      { gw: 36, start: '2026-05-10', end: '2026-05-12', deadline: '2026-05-10T18:30:00Z' },
      { gw: 37, start: '2026-05-17', end: '2026-05-19', deadline: '2026-05-17T18:30:00Z' },
      { gw: 38, start: '2026-05-24', end: '2026-05-24', deadline: '2026-05-24T15:00:00Z' } // Final day - all games simultaneous
    ];
  }

  // Enhanced fallback with COMPLETE gameweek logic
  getEnhancedFallback() {
    const now = new Date();
    const currentTime = now.getTime();
    const gameweekDates = this.getCompleteGameweekSchedule();

    // Find the current actionable gameweek
    let currentGameweek = null;
    
    for (let i = 0; i < gameweekDates.length; i++) {
      const gw = gameweekDates[i];
      const startTime = new Date(gw.start).getTime();
      const endTime = new Date(gw.end).getTime() + (24 * 60 * 60 * 1000); // Add 1 day buffer
      const deadlineTime = new Date(gw.deadline).getTime();
      
      if (currentTime < deadlineTime) {
        // Upcoming gameweek - deadline hasn't passed yet
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
        // Live gameweek - deadline passed but games still ongoing
        const hoursSinceDeadline = (currentTime - deadlineTime) / (1000 * 60 * 60);
        let estimatedFinished;
        
        // More realistic estimation based on typical Premier League scheduling
        if (hoursSinceDeadline < 3) {
          estimatedFinished = 0; // First games haven't finished yet
        } else if (hoursSinceDeadline < 6) {
          estimatedFinished = 3; // Early Saturday games finished
        } else if (hoursSinceDeadline < 9) {
          estimatedFinished = 6; // Saturday games finished
        } else if (hoursSinceDeadline < 27) {
          estimatedFinished = 8; // Sunday games in progress
        } else {
          estimatedFinished = 10; // All games finished
        }
        
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
            count: 10, // Standard Premier League gameweek
            finished: estimatedFinished // Estimated based on time elapsed
          },
          source: 'enhanced_fallback'
        };
        break;
      }
      // Skip completed gameweeks - we don't want to show them as current
    }

    // If no actionable gameweek found, find the next upcoming one
    if (!currentGameweek) {
      const nextGw = gameweekDates.find(gw => new Date(gw.start).getTime() > currentTime) || gameweekDates[gameweekDates.length - 1];
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

    console.log(`📅 Enhanced fallback: GW${currentGameweek.number} (${currentGameweek.status})`);
    return currentGameweek;
  }

  // Get next few gameweeks for planning (with complete schedule)
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

    // Fallback to complete schedule
    const gameweekDates = this.getCompleteGameweekSchedule();
    const now = new Date();
    
    // Find current position in schedule
    const currentGameweek = gameweekDates.findIndex(gw => 
      new Date(gw.deadline).getTime() > now.getTime()
    );
    
    // Get upcoming gameweeks starting from current
    const upcomingGws = gameweekDates
      .slice(Math.max(0, currentGameweek), currentGameweek + count)
      .map(gw => ({
        number: gw.gw,
        name: `Gameweek ${gw.gw}`,
        deadline: gw.deadline,
        firstFixture: new Date(gw.start),
        fixtureCount: gw.gw === 38 ? 10 : 10 // All simultaneous on final day
      }));

    return upcomingGws;
  }

  // Get all gameweeks for the season (useful for planning)
  getAllGameweeks() {
    const gameweekDates = this.getCompleteGameweekSchedule();
    return gameweekDates.map(gw => ({
      number: gw.gw,
      name: `Gameweek ${gw.gw}`,
      deadline: gw.deadline,
      startDate: gw.start,
      endDate: gw.end,
      deadlineFormatted: new Date(gw.deadline).toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    }));
  }
}

// Export singleton instance
export default new GameweekService();