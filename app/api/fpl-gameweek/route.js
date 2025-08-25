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

      if (now < deadline) {
        // Before deadline - upcoming
        status = 'upcoming';
        statusDisplay = `🏁 GW ${currentEvent.id} (Upcoming)`;
        displayDate = firstKickoff.toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric' 
        });
      } else if (now >= deadline && finishedCount < currentGwFixtures.length) {
        // After deadline, games still playing - live (this is actionable)
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
        // All games finished - this gameweek is completed, find next actionable one
        const nextEvent = bootstrapData.events?.find(event => 
          event.id > currentEvent.id && !event.finished
        );
        
        if (nextEvent) {
          // Return next upcoming gameweek instead of completed one
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
          // No next event found, fall back to current completed one
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