// app/api/fpl-gameweek/route.js
// Server-side API endpoint to fetch FPL data and avoid CORS issues

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
        // Add timeout
        signal: AbortSignal.timeout(10000) // 10 second timeout
      }),
      fetch('https://fantasy.premierleague.com/api/fixtures/', {
        headers: {
          'User-Agent': 'FPL-Dashboard/1.0',
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(10000) // 10 second timeout
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

    // Return error response but don't crash
    return Response.json({
      success: false,
      error: error.message,
      fallback: true,
      dataTimestamp: new Date().toISOString()
    }, { status: 503 }); // Service Unavailable
  }
}

// Function to analyze current gameweek with better match counting
function analyzeCurrentGameweekEnhanced(bootstrapData, fixturesData) {
  try {
    // Find current or next event
    const currentEvent = bootstrapData.events?.find(event => event.is_current) || 
                        bootstrapData.events?.find(event => event.is_next) ||
                        bootstrapData.events?.[0];

    if (!currentEvent) {
      throw new Error('No current gameweek found in FPL data');
    }

    // Get all fixtures for this gameweek
    const currentGwFixtures = fixturesData?.filter(f => f.event === currentEvent.id) || [];
    
    console.log(`📅 Analyzing GW${currentEvent.id} with ${currentGwFixtures.length} fixtures`);

    // Count finished matches more accurately
    const finishedMatches = currentGwFixtures.filter(fixture => {
      // A match is finished if:
      // 1. It has finished = true, OR
      // 2. It has started = true AND has team scores, OR  
      // 3. It has both team_a_score and team_h_score (not null)
      return fixture.finished || 
             (fixture.started && fixture.team_a_score !== null && fixture.team_h_score !== null) ||
             (fixture.team_a_score !== null && fixture.team_h_score !== null);
    });

    const liveMatches = currentGwFixtures.filter(fixture => {
      // A match is live if it has started but not finished
      return fixture.started && !fixture.finished;
    });

    const upcomingMatches = currentGwFixtures.filter(fixture => {
      // A match is upcoming if it hasn't started yet
      return !fixture.started && !fixture.finished;
    });

    console.log(`📊 GW${currentEvent.id} Match Status:`);
    console.log(`   Finished: ${finishedMatches.length}/${currentGwFixtures.length}`);
    console.log(`   Live: ${liveMatches.length}`);
    console.log(`   Upcoming: ${upcomingMatches.length}`);

    // Determine gameweek status
    let status = 'upcoming';
    let statusDisplay = `🏁 GW ${currentEvent.id} (Upcoming)`;
    let displayDate = 'TBD';

    if (currentGwFixtures.length > 0) {
      if (finishedMatches.length === currentGwFixtures.length) {
        // All matches finished
        status = 'completed';
        statusDisplay = `✅ GW ${currentEvent.id} (Completed)`;
        displayDate = 'Finished';
      } else if (finishedMatches.length > 0 || liveMatches.length > 0) {
        // Some matches finished or live
        status = 'live';
        statusDisplay = `🔴 GW ${currentEvent.id} (Live)`;
        displayDate = `${finishedMatches.length}/${currentGwFixtures.length} matches finished`;
      } else {
        // No matches started yet
        const firstFixture = currentGwFixtures
          .filter(f => f.kickoff_time)
          .sort((a, b) => new Date(a.kickoff_time) - new Date(b.kickoff_time))[0];
        
        if (firstFixture) {
          const kickoffDate = new Date(firstFixture.kickoff_time);
          displayDate = kickoffDate.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric' 
          });
        }
      }
    }

    // Calculate deadline info
    const deadline = new Date(currentEvent.deadline_time);
    
    const gameweekData = {
      number: currentEvent.id,
      status,
      statusDisplay,
      date: displayDate,
      fullDate: currentEvent.deadline_time,
      name: currentEvent.name,
      deadline: currentEvent.deadline_time,
      deadlineFormatted: deadline.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      fixtures: {
        total: currentGwFixtures.length,
        finished: finishedMatches.length,
        live: liveMatches.length,
        upcoming: upcomingMatches.length
      },
      source: 'fpl_api'
    };

    console.log(`📅 Enhanced gameweek analysis: GW${gameweekData.number} (${gameweekData.status})`);
    console.log(`   Status: ${statusDisplay}`);
    console.log(`   Matches: ${gameweekData.fixtures.finished}/${gameweekData.fixtures.total} finished`);
    
    return gameweekData;

  } catch (error) {
    console.error('Error analyzing gameweek:', error);
    throw error;
  }
}

// Get upcoming gameweeks
function getUpcomingGameweeks(bootstrapData, fixturesData, count = 5) {
  try {
    const currentEvent = bootstrapData.events?.find(event => event.is_current) || 
                        bootstrapData.events?.find(event => event.is_next);

    if (!currentEvent) return [];

    // Get next few events
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