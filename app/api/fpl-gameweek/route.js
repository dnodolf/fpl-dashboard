// app/api/fpl-gameweek/route.js
// Gameweek API using hardcoded schedule + live fixture counts from FPL

import GameweekService from '../../services/gameweekService.js';

// Fetch live fixture status from FPL API for a given gameweek
async function fetchFixtureCounts(gwNumber) {
  try {
    const res = await fetch(`https://fantasy.premierleague.com/api/fixtures/?event=${gwNumber}`, {
      cache: 'no-store'
    });
    if (!res.ok) return null;
    const fixtures = await res.json();
    // Use finished_provisional (set at full-time) rather than finished (set when points are confirmed)
    const finished = fixtures.filter(f => f.finished_provisional || f.finished).length;
    const started = fixtures.filter(f => f.started && !f.finished_provisional && !f.finished).length;
    const total = fixtures.length;
    return { finished, started, remaining: total - finished - started, total };
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

    // If GW is live, fetch actual fixture counts from FPL
    if (currentGameweek.status === 'live') {
      const fixtureCounts = await fetchFixtureCounts(currentGameweek.number);
      if (fixtureCounts) {
        currentGameweek.fixtureCounts = fixtureCounts;
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