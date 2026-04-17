/**
 * Draft Analysis API Route
 * Proxies Sleeper draft endpoints to fetch historical draft data for analysis.
 */

import { NextResponse } from 'next/server';

const SLEEPER_BASE = 'https://api.sleeper.app/v1';

async function fetchJSON(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) return null;
  return res.json();
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const leagueId = searchParams.get('leagueId');

    if (!leagueId) {
      return NextResponse.json({ error: 'leagueId is required' }, { status: 400 });
    }

    // Fetch drafts for this league
    const drafts = await fetchJSON(`${SLEEPER_BASE}/league/${leagueId}/drafts`);
    if (!drafts?.length) {
      return NextResponse.json({ error: 'No drafts found for this league' }, { status: 404 });
    }

    // Use the most recent draft
    const draft = drafts[0];
    const draftId = draft.draft_id;

    // Fetch picks, traded picks, and users in parallel
    const [picks, tradedPicks, users] = await Promise.all([
      fetchJSON(`${SLEEPER_BASE}/draft/${draftId}/picks`),
      fetchJSON(`${SLEEPER_BASE}/draft/${draftId}/traded_picks`),
      fetchJSON(`${SLEEPER_BASE}/league/${leagueId}/users`),
    ]);

    // Build user display name map
    const userMap = {};
    if (Array.isArray(users)) {
      users.forEach(u => {
        userMap[u.user_id] = u.display_name || u.username || `User ${u.user_id}`;
      });
    }

    return NextResponse.json(
      {
        draft: {
          draft_id: draft.draft_id,
          status: draft.status,
          type: draft.type,
          season: draft.season,
          settings: draft.settings,
          draft_order: draft.draft_order,
          slot_to_roster_id: draft.slot_to_roster_id,
        },
        picks: Array.isArray(picks) ? picks : [],
        tradedPicks: Array.isArray(tradedPicks) ? tradedPicks : [],
        users: userMap,
      },
      {
        headers: {
          'Cache-Control': 'public, max-age=3600', // 1 hour cache for historical data
        },
      }
    );
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Draft analysis API error:', err);
    }
    return NextResponse.json({ error: 'Failed to fetch draft data' }, { status: 500 });
  }
}
