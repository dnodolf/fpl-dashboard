// app/services/gameweekService.js
// Enhanced Gameweek Service - Fetches live data from FPL API

class GameweekService {
  constructor() {
    this.CACHE_KEY = 'fpl_gameweek_cache';
    this.CACHE_DURATION = 10 * 60 * 1000; // 10 minutes (shorter cache for gameweek data)
    this.API_BASE = 'https://fantasy.premierleague.com/api';
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

  // Fetch bootstrap data (contains current gameweek info)
  async fetchBootstrapData() {
    const response = await fetch(`${this.API_BASE}/bootstrap-static/`);
    if (!response.ok) {
      throw new Error(`FPL API error: ${response.status}`);
    }
    return await response.json();
  }

  // Fetch fixtures data
  async fetchFixtures() {
    const response = await fetch(`${this.API_BASE}/fixtures/`);
    if (!response.ok) {
      throw new Error(`FPL API error: ${response.status}`);
    }
    return await response.json();
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

      // Fetch both bootstrap and fixtures data
      const [bootstrap, fixtures] = await Promise.all([
        this.fetchBootstrapData(),
        this.fetchFixtures()
      ]);

      // Extract current gameweek from bootstrap
      const currentEvent = bootstrap.events.find(event => event.is_current) || 
                          bootstrap.events.find(event => event.is_next);

      if (!currentEvent) {
        throw new Error('Could not determine current gameweek from FPL API');
      }

      // Get fixtures for current gameweek
      const currentGwFixtures = fixtures.filter(fixture => 
        fixture.event === currentEvent.id && 
        fixture.kickoff_time
      );

      // Determine gameweek status and timing
      const now = new Date();
      const gameweekData = this.analyzeGameweek(currentEvent, currentGwFixtures, now);

      // Cache the result
      this.setCachedData(gameweekData);

      console.log('✅ Gameweek data updated from FPL API');
      return gameweekData;

    } catch (error) {
      console.error('❌ Error fetching gameweek data:', error);
      
      // Fallback to hardcoded logic if API fails
      console.log('🔄 Falling back to hardcoded gameweek logic...');
      return this.getFallbackGameweek();
    }
  }

  // Analyze gameweek status based on fixtures
  analyzeGameweek(event, fixtures, now) {
    if (!fixtures.length) {
      // No fixtures scheduled yet
      return {
        number: event.id,
        status: 'upcoming',
        statusDisplay: `🏁 GW ${event.id} (Upcoming)`,
        date: 'TBD',
        fullDate: null,
        name: event.name,
        deadline: event.deadline_time,
        source: 'fpl_api'
      };
    }

    // Sort fixtures by kickoff time
    const sortedFixtures = fixtures
      .map(f => ({ ...f, kickoff: new Date(f.kickoff_time) }))
      .sort((a, b) => a.kickoff - b.kickoff);

    const firstKickoff = sortedFixtures[0].kickoff;
    const lastKickoff = sortedFixtures[sortedFixtures.length - 1].kickoff;
    const deadline = new Date(event.deadline_time);

    // Determine status
    let status, statusDisplay, displayDate;

    if (now < deadline) {
      // Before deadline - upcoming
      status = 'upcoming';
      statusDisplay = `🏁 GW ${event.id} (Upcoming)`;
      displayDate = firstKickoff.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      });
    } else if (now >= deadline && now < lastKickoff) {
      // After deadline, games still playing - live
      status = 'live';
      statusDisplay = `🔴 GW ${event.id} (Live)`;
      displayDate = lastKickoff.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      });
    } else {
      // All games finished - completed, but this logic might need refinement
      // based on whether the gameweek is officially finished
      status = event.finished ? 'completed' : 'live';
      statusDisplay = event.finished ? `✅ GW ${event.id} (Completed)` : `🔴 GW ${event.id} (Live)`;
      displayDate = lastKickoff.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      });
    }

    return {
      number: event.id,
      status,
      statusDisplay,
      date: displayDate,
      fullDate: firstKickoff.toISOString(),
      name: event.name,
      deadline: event.deadline_time,
      deadlineFormatted: deadline.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      fixtures: {
        first: firstKickoff,
        last: lastKickoff,
        count: fixtures.length,
        finished: fixtures.filter(f => f.finished).length
      },
      source: 'fpl_api'
    };
  }

  // Fallback to original hardcoded logic if API fails
  getFallbackGameweek() {
    const now = new Date();
    const currentDate = now.toISOString().slice(0, 10);

    // Simplified hardcoded gameweek dates (keep a few for fallback)
    const gameweekDates = [
      { gw: 1, start: '2025-08-15', end: '2025-08-18' },
      { gw: 2, start: '2025-08-22', end: '2025-08-25' },
      { gw: 3, start: '2025-08-30', end: '2025-09-01' },
      { gw: 4, start: '2025-09-13', end: '2025-09-15' },
      { gw: 5, start: '2025-09-20', end: '2025-09-22' }
    ];

    for (let i = 0; i < gameweekDates.length; i++) {
      const gw = gameweekDates[i];
      
      if (currentDate < gw.start) {
        return {
          number: gw.gw,
          status: 'upcoming',
          statusDisplay: `🏁 GW ${gw.gw} (Upcoming)`,
          date: new Date(gw.start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          fullDate: gw.start,
          source: 'fallback'
        };
      } else if (currentDate >= gw.start && currentDate <= gw.end) {
        return {
          number: gw.gw,
          status: 'live',
          statusDisplay: `🔴 GW ${gw.gw} (Live)`,
          date: new Date(gw.end).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          fullDate: gw.end,
          source: 'fallback'
        };
      }
    }

    // Default fallback
    return {
      number: 1,
      status: 'upcoming',
      statusDisplay: '🏁 GW 1 (Upcoming)',
      date: 'Aug 15',
      fullDate: '2025-08-15',
      source: 'fallback'
    };
  }

  // Get next few gameweeks for planning
  async getUpcomingGameweeks(count = 5) {
    try {
      const [bootstrap, fixtures] = await Promise.all([
        this.fetchBootstrapData(),
        this.fetchFixtures()
      ]);

      const currentEvent = bootstrap.events.find(event => event.is_current) || 
                          bootstrap.events.find(event => event.is_next);

      if (!currentEvent) return [];

      // Get next few events
      const upcomingEvents = bootstrap.events
        .filter(event => event.id >= currentEvent.id)
        .slice(0, count);

      return upcomingEvents.map(event => {
        const eventFixtures = fixtures.filter(f => f.event === event.id);
        const firstKickoff = eventFixtures.length > 0 ? 
          new Date(Math.min(...eventFixtures.map(f => new Date(f.kickoff_time)))) : 
          null;

        return {
          number: event.id,
          name: event.name,
          deadline: event.deadline_time,
          firstFixture: firstKickoff,
          fixtureCount: eventFixtures.length
        };
      });
    } catch (error) {
      console.error('Error fetching upcoming gameweeks:', error);
      return [];
    }
  }
}

// Export singleton instance
export default new GameweekService();