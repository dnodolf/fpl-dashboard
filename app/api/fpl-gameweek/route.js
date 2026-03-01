// app/api/fpl-gameweek/route.js
// Gameweek API using hardcoded schedule + live fixture data from FPL

import GameweekService from '../../services/gameweekService.js';

// Fetch FPL team ID → abbreviation mapping from bootstrap-static
let teamMapCache = null;
async function getTeamMap() {
  if (teamMapCache) return teamMapCache;
  try {
    const res = await fetch('https://fantasy.premierleague.com/api/bootstrap-static/', {
      cache: 'no-store',
      headers: { 'User-Agent': 'FPL-Dashboard/1.0' }
    });
    if (!res.ok) return {};
    const data = await res.json();
    teamMapCache = {};
    for (const team of (data.teams || [])) {
      teamMapCache[team.id] = team.short_name;
    }
    // Cache for 1 hour then reset
    setTimeout(() => { teamMapCache = null; }, 60 * 60 * 1000);
    return teamMapCache;
  } catch {
    return {};
  }
}

// Fetch live fixture data from FPL API for a given gameweek
async function fetchFixtureData(gwNumber) {
  try {
    const [fixturesRes, teamMap] = await Promise.all([
      fetch(`https://fantasy.premierleague.com/api/fixtures/?event=${gwNumber}`, { cache: 'no-store' }),
      getTeamMap()
    ]);
    if (!fixturesRes.ok) return null;
    const fixtures = await fixturesRes.json();

    // Build fixture details sorted by kickoff time
    const fixtureList = fixtures
      .sort((a, b) => new Date(a.kickoff_time) - new Date(b.kickoff_time))
      .map(f => {
        const isFinished = f.finished_provisional || f.finished;
        const isLive = f.started && !isFinished;
        return {
          homeTeam: teamMap[f.team_h] || `T${f.team_h}`,
          awayTeam: teamMap[f.team_a] || `T${f.team_a}`,
          homeScore: f.team_h_score,
          awayScore: f.team_a_score,
          kickoffTime: f.kickoff_time,
          minutes: f.minutes,
          status: isFinished ? 'finished' : isLive ? 'live' : 'upcoming'
        };
      });

    // Compute counts from the detailed data
    const finished = fixtureList.filter(f => f.status === 'finished').length;
    const started = fixtureList.filter(f => f.status === 'live').length;
    const total = fixtureList.length;

    return {
      counts: { finished, started, remaining: total - finished - started, total },
      fixtures: fixtureList
    };
  } catch {
    return null;
  }
}

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    if (process.env.NODE_ENV === 'development') {
      console.log('📅 FPL Gameweek API: Using hardcoded schedule...');
    }

    // Get gameweek data from our reliable hardcoded service
    const currentGameweek = await GameweekService.getCurrentGameweek();
    const upcomingGameweeks = await GameweekService.getUpcomingGameweeks();

    // If GW is live, fetch actual fixture data from FPL
    if (currentGameweek.status === 'live') {
      const fixtureData = await fetchFixtureData(currentGameweek.number);
      if (fixtureData) {
        currentGameweek.fixtureCounts = fixtureData.counts;
        currentGameweek.fixtureList = fixtureData.fixtures;
      }
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(`✅ Returning GW${currentGameweek.number} (${currentGameweek.status})`);
    }

    return Response.json({
      success: true,
      currentGameweek,
      upcomingGameweeks,
      dataTimestamp: new Date().toISOString(),
      source: 'hardcoded_schedule'
    });

  } catch (error) {
    console.error('❌ Gameweek API Error:', error.message);

    // Simple fallback
    return Response.json({
      success: false,
      error: error.message,
      currentGameweek: {
        number: 5,
        status: 'upcoming',
        statusDisplay: '🏁 GW 5 (Upcoming)',
        date: 'Sep 21',
        name: 'Gameweek 5',
        deadline: '2024-09-21T17:30:00Z',
        deadlineFormatted: 'Sep 21, 5:30 PM',
        source: 'api_emergency_fallback'
      },
      upcomingGameweeks: [],
      dataTimestamp: new Date().toISOString()
    });
  }
}
