import { NextResponse } from 'next/server';

/**
 * POST /api/validate-league
 * Validates a Sleeper league ID and returns league info + roster owners.
 * Used by the SetupModal to let users pick their roster.
 */
export async function POST(request) {
  try {
    const { leagueId } = await request.json();

    if (!leagueId || typeof leagueId !== 'string') {
      return NextResponse.json(
        { error: 'League ID is required' },
        { status: 400 }
      );
    }

    const cleanId = leagueId.trim();

    // Fetch league info
    const leagueRes = await fetch(`https://api.sleeper.app/v1/league/${cleanId}`, {
      cache: 'no-store',
    });

    if (!leagueRes.ok) {
      return NextResponse.json(
        { error: 'League not found. Check your Sleeper league ID and try again.' },
        { status: 404 }
      );
    }

    const league = await leagueRes.json();

    if (!league || !league.league_id) {
      return NextResponse.json(
        { error: 'Invalid league data returned from Sleeper.' },
        { status: 404 }
      );
    }

    // Fetch rosters and users in parallel
    const [rostersRes, usersRes] = await Promise.all([
      fetch(`https://api.sleeper.app/v1/league/${cleanId}/rosters`, { cache: 'no-store' }),
      fetch(`https://api.sleeper.app/v1/league/${cleanId}/users`, { cache: 'no-store' }),
    ]);

    if (!rostersRes.ok || !usersRes.ok) {
      return NextResponse.json(
        { error: 'Could not fetch league rosters. The league may be private or inactive.' },
        { status: 400 }
      );
    }

    const [rosters, users] = await Promise.all([
      rostersRes.json(),
      usersRes.json(),
    ]);

    // Build user ID → display name map
    const userMap = {};
    if (Array.isArray(users)) {
      users.forEach(u => {
        if (u.user_id && u.display_name) {
          userMap[u.user_id] = u.display_name;
        }
      });
    }

    // Build roster owner list
    const rosterOwners = Array.isArray(rosters)
      ? rosters
          .map(r => ({
            rosterId: r.roster_id,
            ownerId: r.owner_id,
            displayName: userMap[r.owner_id] || `Roster ${r.roster_id}`,
            playerCount: r.players?.length || 0,
            wins: r.settings?.wins || 0,
            losses: r.settings?.losses || 0,
          }))
          .sort((a, b) => b.wins - a.wins || a.losses - b.losses)
      : [];

    return NextResponse.json({
      valid: true,
      league: {
        id: league.league_id,
        name: league.name,
        season: league.season,
        sport: league.sport,
        totalRosters: league.total_rosters,
        status: league.status,
      },
      rosterOwners,
    });
  } catch (error) {
    console.error('League validation error:', error);
    return NextResponse.json(
      { error: 'Failed to validate league. Please try again.' },
      { status: 500 }
    );
  }
}
