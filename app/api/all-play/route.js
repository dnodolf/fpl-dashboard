// app/api/all-play/route.js
import { NextResponse } from 'next/server';

const SLEEPER_BASE = 'https://api.sleeper.app/v1';

async function sleeperGet(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Sleeper HTTP ${res.status}: ${url}`);
  return res.json();
}

export async function GET() {
  try {
    const leagueId = process.env.SLEEPER_LEAGUE_ID;
    if (!leagueId) {
      return NextResponse.json({ success: false, error: 'SLEEPER_LEAGUE_ID not configured', weeks: [], allPlay: [] }, { status: 500 });
    }

    // Fetch rosters + users in parallel
    const [rawRosters, users] = await Promise.all([
      sleeperGet(`${SLEEPER_BASE}/league/${leagueId}/rosters`),
      sleeperGet(`${SLEEPER_BASE}/league/${leagueId}/users`),
    ]);

    const userMap = {};
    users.forEach(u => { userMap[u.user_id] = u.display_name || 'Unknown'; });

    const rosters = rawRosters.map(r => ({
      ...r,
      displayName: userMap[r.owner_id] || 'Unknown',
    }));

    // roster_id → displayName
    const rosterMap = {};
    rosters.forEach(r => { rosterMap[r.roster_id] = r.displayName; });

    // Infer completed weeks from max games played
    const gamesPlayed = rosters.reduce((max, r) => {
      const g = (r.settings?.wins || 0) + (r.settings?.losses || 0) + (r.settings?.ties || 0);
      return Math.max(max, g);
    }, 0);

    if (gamesPlayed === 0) {
      return NextResponse.json({
        success: true, weeks: [], allPlay: [],
        leagueSize: rosters.length, weeksPlayed: 0,
      });
    }

    // Fetch all completed weeks in parallel
    const weekResults = await Promise.all(
      Array.from({ length: gamesPlayed }, (_, i) => i + 1).map(async (week) => {
        try {
          const res = await fetch(
            `${SLEEPER_BASE}/league/${leagueId}/matchups/${week}`,
            { cache: 'no-store' }
          );
          if (!res.ok) return null;
          const matchups = await res.json();
          return matchups?.length ? { week, matchups } : null;
        } catch {
          return null;
        }
      })
    );

    const weeks = weekResults
      .filter(Boolean)
      .map(({ week, matchups }) => {
        // Group by matchup_id for head-to-head pairing
        const groups = {};
        matchups.forEach(m => {
          if (!groups[m.matchup_id]) groups[m.matchup_id] = [];
          groups[m.matchup_id].push(m);
        });

        const allScores = matchups.map(m => ({ roster_id: m.roster_id, points: m.points || 0 }));
        const leagueSize = allScores.length;
        const sorted = [...allScores].sort((a, b) => b.points - a.points);

        const rosterResults = matchups.map(m => {
          const group = groups[m.matchup_id] || [];
          const opponent = group.find(o => o.roster_id !== m.roster_id);
          const myPoints = m.points || 0;
          const oppPoints = opponent?.points || 0;

          let apWins = 0, apTies = 0;
          allScores.forEach(s => {
            if (s.roster_id === m.roster_id) return;
            if (myPoints > s.points) apWins++;
            else if (myPoints === s.points) apTies++;
          });

          return {
            roster_id: m.roster_id,
            displayName: rosterMap[m.roster_id] || 'Unknown',
            points: myPoints,
            opponent_id: opponent?.roster_id ?? null,
            opponent_name: rosterMap[opponent?.roster_id] || 'Unknown',
            opponent_points: oppPoints,
            won: myPoints > oppPoints,
            tied: myPoints === oppPoints,
            all_play_wins: apWins,
            all_play_ties: apTies,
            all_play_losses: leagueSize - 1 - apWins - apTies,
            score_rank: sorted.findIndex(s => s.roster_id === m.roster_id) + 1,
            league_size: leagueSize,
          };
        });

        return { week, rosters: rosterResults };
      });

    // Aggregate all-play totals per roster
    const allPlayMap = {};
    weeks.forEach(({ rosters: weekRosters }) => {
      weekRosters.forEach(r => {
        if (!allPlayMap[r.roster_id]) {
          allPlayMap[r.roster_id] = {
            roster_id: r.roster_id,
            displayName: r.displayName,
            wins: 0, losses: 0, ties: 0,
          };
        }
        allPlayMap[r.roster_id].wins += r.all_play_wins;
        allPlayMap[r.roster_id].losses += r.all_play_losses;
        allPlayMap[r.roster_id].ties += r.all_play_ties;
      });
    });

    return NextResponse.json({
      success: true,
      weeks,
      allPlay: Object.values(allPlayMap),
      leagueSize: weeks[0]?.rosters.length || 0,
      weeksPlayed: weeks.length,
    });

  } catch (error) {
    console.error('All-play API error:', error);
    return NextResponse.json(
      { success: false, error: error.message, weeks: [], allPlay: [] },
      { status: 500 }
    );
  }
}
