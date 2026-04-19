/**
 * Live Draft API Route
 * Thin proxy for Sleeper draft endpoints used by the real-time Draft Assistant.
 *
 * Endpoints (via ?type=):
 *   drafts   — GET /league/{leagueId}/drafts        (5 min cache — setup only)
 *   draft    — GET /draft/{draftId}                 (30s cache — metadata)
 *   picks    — GET /draft/{draftId}/picks           (no cache — live polling)
 *   users    — GET /league/{leagueId}/users         (5 min cache — setup only)
 */

import { NextResponse } from 'next/server';

const SLEEPER_BASE = 'https://api.sleeper.app/v1';

async function fetchJSON(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Sleeper ${res.status}: ${url}`);
  return res.json();
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const leagueId = searchParams.get('leagueId');
    const draftId = searchParams.get('draftId');

    switch (type) {
      case 'drafts': {
        if (!leagueId) return NextResponse.json({ error: 'leagueId required' }, { status: 400 });
        const data = await fetchJSON(`${SLEEPER_BASE}/league/${leagueId}/drafts`);
        return NextResponse.json(data, {
          headers: { 'Cache-Control': 'public, max-age=300' }, // 5 min
        });
      }

      case 'draft': {
        if (!draftId) return NextResponse.json({ error: 'draftId required' }, { status: 400 });
        const data = await fetchJSON(`${SLEEPER_BASE}/draft/${draftId}`);
        return NextResponse.json(data, {
          headers: { 'Cache-Control': 'public, max-age=30' }, // 30s
        });
      }

      case 'picks': {
        if (!draftId) return NextResponse.json({ error: 'draftId required' }, { status: 400 });
        const data = await fetchJSON(`${SLEEPER_BASE}/draft/${draftId}/picks`);
        return NextResponse.json(data, {
          headers: { 'Cache-Control': 'no-store' }, // always fresh
        });
      }

      case 'users': {
        if (!leagueId) return NextResponse.json({ error: 'leagueId required' }, { status: 400 });
        const data = await fetchJSON(`${SLEEPER_BASE}/league/${leagueId}/users`);
        // Build a clean user map: userId → { displayName, avatar }
        const userMap = {};
        if (Array.isArray(data)) {
          data.forEach(u => {
            userMap[u.user_id] = {
              displayName: u.display_name || u.username || `User ${u.user_id}`,
              avatar: u.avatar || null,
            };
          });
        }
        return NextResponse.json(userMap, {
          headers: { 'Cache-Control': 'public, max-age=300' }, // 5 min
        });
      }

      default:
        return NextResponse.json({ error: 'Invalid type. Use: drafts, draft, picks, users' }, { status: 400 });
    }
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Live draft API error:', err);
    }
    return NextResponse.json({ error: err.message || 'Failed to fetch from Sleeper' }, { status: 500 });
  }
}
