// app/api/standings/route.js
import { NextResponse } from 'next/server';
import { sleeperApiService } from '../../services/sleeperApiService';

export async function GET() {
  try {
    console.log('📊 Standings API: Fetching league standings');

    // Get rosters with user info
    const rosters = await sleeperApiService.getRosters();

    // Calculate standings
    const standings = rosters.map(roster => {
      const settings = roster.settings || {};

      return {
        roster_id: roster.roster_id,
        owner_id: roster.owner_id,
        displayName: roster.displayName || 'Unknown',
        wins: settings.wins || 0,
        losses: settings.losses || 0,
        ties: settings.ties || 0,
        pointsFor: settings.fpts || 0,
        pointsAgainst: settings.fpts_against || 0,
        // Calculate win percentage for sorting
        winPct: settings.wins / Math.max((settings.wins + settings.losses + settings.ties), 1)
      };
    });

    // Sort by wins (descending), then by points for (descending)
    standings.sort((a, b) => {
      // First by wins
      if (b.wins !== a.wins) {
        return b.wins - a.wins;
      }
      // Then by points for
      return b.pointsFor - a.pointsFor;
    });

    console.log(`✅ Standings API: Retrieved ${standings.length} teams`);

    return NextResponse.json(
      {
        success: true,
        standings,
        count: standings.length
      },
      {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      }
    );

  } catch (error) {
    console.error('❌ Standings API Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch standings',
        standings: []
      },
      { status: 500 }
    );
  }
}
