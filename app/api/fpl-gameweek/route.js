// app/api/fpl-gameweek/route.js
// Server-side API endpoint to fetch FPL data with complete 38 gameweek fallback

export async function GET() {
  try {
    console.log('📡 Fetching FPL data from server...');

    // Fetch both bootstrap and fixtures data from FPL API
    const [bootstrapResponse, fixturesResponse] = await Promise.all([
      fetch('https://fantasy.premierleague.com/api/bootstrap-static/', {
        headers: {
          'User-Agent': 'FPL-Dashboard/1.0',
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(10000)
      }),
      fetch('https://fantasy.premierleague.com/api/fixtures/', {
        headers: {
          'User-Agent': 'FPL-Dashboard/1.0',
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(10000)
      })
    ]);

    if (!bootstrapResponse.ok) {
      throw new Error(`Bootstrap API failed: ${bootstrapResponse.status}`);
    }

    if (!fixturesResponse.ok) {
      throw new Error(`Fixtures API failed: ${fixturesResponse.status}`);
    }

    const [bootstrapData, fixturesData] = await Promise.all([
      bootstrapResponse.json(),
      fixturesResponse.json()
    ]);

    console.log('✅ Successfully fetched FPL data');
    console.log(`📊 Found ${bootstrapData.events?.length} events and ${fixturesData?.length} fixtures`);

    // Process the data to extract current gameweek
    const currentGameweek = analyzeCurrentGameweek(bootstrapData, fixturesData);
    const upcomingGameweeks = getUpcomingGameweeks(bootstrapData, fixturesData);

    return Response.json({
      success: true,
      currentGameweek,
      upcomingGameweeks,
      dataTimestamp: new Date().toISOString(),
      source: 'fpl_api'
    });

  } catch (error) {
    console.error('❌ FPL API Error:', error.message);

    // Return enhanced fallback with COMPLETE 38 gameweek schedule
    const enhancedFallback = getProductionFallback();
    const upcomingFallback = getUpcomingGameweeksFallback();
    
    return Response.json({
      success: false,
      error: error.message,
      currentGameweek: enhancedFallback,
      upcomingGameweeks: upcomingFallback,
      fallback: true,
      dataTimestamp: new Date().toISOString(),
      source: 'production_fallback'
    }, { status: 200 });
  }
}

// Complete 2025-26 Premier League season schedule (all 38 gameweeks)
function getComplete2025Schedule() {
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
    { gw: 38, start: '2026-05-24', end: '2026-05-24', deadline: '2026-05-24T15:00:00Z' } // Final day
  ];
}

// Enhanced production fallback with complete schedule
function getProductionFallback() {
  const now = new Date();
  const currentTime = now.getTime();
  const gameweekDates = getComplete2025Schedule();

  // Find the current actionable gameweek 
  let currentGameweek = null;
  
  for (let i = 0; i < gameweekDates.length; i++) {
    const gw = gameweekDates[i];
    const startTime = new Date(gw.start).getTime();
    const endTime = new Date(gw.end).getTime() + (24 * 60 * 60 * 1000);
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
        source: 'production_fallback'
      };
      break;
    } else if (currentTime >= deadlineTime && currentTime <= endTime) {
      // Live gameweek with estimated progress
      const hoursSinceDeadline = (currentTime - deadlineTime) / (1000 * 60 * 60);
      const estimatedFinished = Math.min(10, Math.max(0, Math.floor(hoursSinceDeadline / 6))); // Rough estimate
      
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
          count: 10,
          finished: estimatedFinished
        },
        source: 'production_fallback'
      };
      break;
    }
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
      source: 'production_fallback'
    };
  }

  console.log(`📅 Production fallback: GW${currentGameweek.number} (${currentGameweek.status})`);
  return currentGameweek;
}

// Get upcoming gameweeks fallback with complete schedule
function getUpcomingGameweeksFallback(count = 5) {
  const gameweekDates = getComplete2025Schedule();
  const now = new Date();
  
  // Find current position in schedule
  const currentIndex = gameweekDates.findIndex(gw => 
    new Date(gw.deadline).getTime() > now.getTime()
  );
  
  // Get upcoming gameweeks starting from current
  const startIndex = Math.max(0, currentIndex);
  const upcomingGws = gameweekDates
    .slice(startIndex, startIndex + count)
    .map(gw => ({
      number: gw.gw,
      name: `Gameweek ${gw.gw}`,
      deadline: gw.deadline,
      firstFixture: new Date(gw.start),
      fixtureCount: 10
    }));

  return upcomingGws;
}

// Analyze FPL data to determine current gameweek
function analyzeCurrentGameweek(bootstrapData, fixturesData) {
  try {
    // Find current or next event
    const currentEvent = bootstrapData.events?.find(event => event.is_current) || 
                        bootstrapData.events?.find(event => event.is_next) ||
                        bootstrapData.events?.[0];

    if (!currentEvent) {
      throw new Error('No current event found in FPL data');
    }

    console.log(`🎯 Current event: GW${currentEvent.id} - ${currentEvent.name}`);

    // Get fixtures for current gameweek
    const currentGwFixtures = fixturesData?.filter(fixture => 
      fixture.event === currentEvent.id && 
      fixture.kickoff_time
    ) || [];

    console.log(`⚽ Found ${currentGwFixtures.length} fixtures for GW${currentEvent.id}`);

    // Determine gameweek status and timing
    const now = new Date();
    const deadline = new Date(currentEvent.deadline_time);
    
    let status, statusDisplay, displayDate, fixtures = null;

    if (currentGwFixtures.length > 0) {
      // Sort fixtures by kickoff time
      const sortedFixtures = currentGwFixtures
        .map(f => ({ ...f, kickoff: new Date(f.kickoff_time) }))
        .sort((a, b) => a.kickoff - b.kickoff);

      const firstKickoff = sortedFixtures[0].kickoff;
      const lastKickoff = sortedFixtures[sortedFixtures.length - 1].kickoff;
      const finishedCount = currentGwFixtures.filter(f => f.finished).length;

      // Enhanced logging for debugging
      console.log(`🕐 Current time: ${now.toISOString()}`);
      console.log(`⏰ Deadline: ${deadline.toISOString()}`);
      console.log(`🏁 First kickoff: ${firstKickoff.toISOString()}`);
      console.log(`🏁 Last kickoff: ${lastKickoff.toISOString()}`);
      console.log(`✅ Finished matches: ${finishedCount}/${currentGwFixtures.length}`);

      if (now < deadline) {
        // Before deadline - upcoming
        status = 'upcoming';
        statusDisplay = `🏁 GW ${currentEvent.id} (Upcoming)`;
        displayDate = firstKickoff.toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric' 
        });
      } else if (now >= deadline && finishedCount < currentGwFixtures.length) {
        // After deadline, games still playing - live
        status = 'live';
        statusDisplay = `🔴 GW ${currentEvent.id} (Live)`;
        displayDate = lastKickoff.toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric' 
        });
        fixtures = {
          first: firstKickoff,
          last: lastKickoff,
          count: currentGwFixtures.length,
          finished: finishedCount
        };
      } else {
        // All games finished - find next actionable gameweek
        const nextEvent = bootstrapData.events?.find(event => 
          event.id > currentEvent.id && !event.finished
        );
        
        if (nextEvent) {
          // Return next upcoming gameweek
          const nextDeadline = new Date(nextEvent.deadline_time);
          return {
            number: nextEvent.id,
            status: 'upcoming',
            statusDisplay: `🏁 GW ${nextEvent.id} (Upcoming)`,
            date: nextDeadline.toLocaleDateString('en-US', { 
              month: 'short', 
              day: 'numeric' 
            }),
            fullDate: nextEvent.deadline_time,
            name: nextEvent.name,
            deadline: nextEvent.deadline_time,
            deadlineFormatted: nextDeadline.toLocaleDateString('en-US', { 
              month: 'short', 
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            }),
            fixtures: null,
            source: 'fpl_api'
          };
        } else {
          // No next event found
          status = 'completed';
          statusDisplay = `✅ GW ${currentEvent.id} (Completed)`;
          displayDate = lastKickoff.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric' 
          });
        }
      }
    } else {
      // No fixtures scheduled yet
      status = 'upcoming';
      statusDisplay = `🏁 GW ${currentEvent.id} (Upcoming)`;
      displayDate = 'TBD';
    }

    const gameweekData = {
      number: currentEvent.id,
      status,
      statusDisplay,
      date: displayDate,
      fullDate: currentGwFixtures.length > 0 ? currentGwFixtures[0].kickoff_time : null,
      name: currentEvent.name,
      deadline: currentEvent.deadline_time,
      deadlineFormatted: deadline.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      fixtures,
      source: 'fpl_api'
    };

    console.log(`📅 Processed gameweek: GW${gameweekData.number} (${gameweekData.status})`);
    return gameweekData;

  } catch (error) {
    console.error('Error analyzing gameweek:', error);
    throw error;
  }
}

// Get upcoming gameweeks from FPL API
function getUpcomingGameweeks(bootstrapData, fixturesData, count = 5) {
  try {
    const currentEvent = bootstrapData.events?.find(event => event.is_current) || 
                        bootstrapData.events?.find(event => event.is_next);

    if (!currentEvent) return [];

    // Get next few events (up to 38 total)
    const upcomingEvents = bootstrapData.events
      ?.filter(event => event.id >= currentEvent.id)
      ?.slice(0, count) || [];

    return upcomingEvents.map(event => {
      const eventFixtures = fixturesData?.filter(f => f.event === event.id) || [];
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
    console.error('Error getting upcoming gameweeks:', error);
    return [];
  }
}