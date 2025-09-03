// app/api/fpl-gameweek/route.js
// Simplified gameweek API using only hardcoded schedule

import GameweekService from '../../services/gameweekService.js';

export async function GET() {
  try {
    console.log('📅 FPL Gameweek API: Using hardcoded schedule...');

    // Get gameweek data from our reliable hardcoded service
    const currentGameweek = await GameweekService.getCurrentGameweek();
    const upcomingGameweeks = await GameweekService.getUpcomingGameweeks();

    console.log(`✅ Returning GW${currentGameweek.number} (${currentGameweek.status})`);

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