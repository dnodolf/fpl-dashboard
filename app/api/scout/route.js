// app/api/scout/route.js
// League Scouting Report — projects GW points for all 12 teams

import { NextResponse } from 'next/server';
import { FormationOptimizerService } from '../../services/formationOptimizerService.js';
import { normalizePosition } from '../../../utils/positionUtils.js';
import { transformPlayerForClient } from '../../utils/playerTransformUtils.js';
import { cacheService } from '../../services/cacheService.js';

/**
 * Fetch integrated player data (same pattern as optimizer route)
 */
async function fetchPlayerData(baseUrl) {
  const response = await fetch(`${baseUrl}/api/integrated-players`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ includeMatching: true, includeScoring: true })
  });
  if (!response.ok) throw new Error(`Failed to fetch player data: ${response.status}`);
  const result = await response.json();
  return result.players || [];
}

/**
 * Fetch all rosters and users from Sleeper
 */
async function fetchLeagueRosters() {
  const leagueId = process.env.SLEEPER_LEAGUE_ID || '1240184286171107328';
  const [rostersRes, usersRes] = await Promise.all([
    fetch(`https://api.sleeper.app/v1/league/${leagueId}/rosters`, { cache: 'no-store' }),
    fetch(`https://api.sleeper.app/v1/league/${leagueId}/users`, { cache: 'no-store' })
  ]);

  if (!rostersRes.ok || !usersRes.ok) throw new Error('Failed to fetch league data');
  const [rosters, users] = await Promise.all([rostersRes.json(), usersRes.json()]);

  const userMap = {};
  users.forEach(u => { userMap[u.user_id] = u.display_name || u.username; });

  return rosters.map(r => ({
    roster_id: r.roster_id,
    owner_id: r.owner_id,
    displayName: userMap[r.owner_id] || `Team ${r.roster_id}`,
    playerIds: r.players || [],
    starters: r.starters || [],
    wins: r.settings?.wins || 0,
    losses: r.settings?.losses || 0,
    ties: r.settings?.ties || 0,
    pointsFor: r.settings?.fpts || 0,
    pointsAgainst: r.settings?.fpts_against || 0
  }));
}

export async function POST(request) {
  try {
    const body = await request.json();
    const scoringMode = body.scoringMode || 'ffh';
    const currentGW = body.currentGameweek;

    // Cache key includes scoring mode and GW
    const cacheKey = `scout_${scoringMode}_${currentGW}`;
    const cached = cacheService.get(cacheKey);
    if (cached && !body.forceRefresh) {
      return NextResponse.json({ ...cached, cached: true });
    }

    const { host } = new URL(request.url);
    const isLocalhost = host.startsWith('localhost') || host.startsWith('127.0.0.1');
    const baseUrl = `${isLocalhost ? 'http' : 'https'}://${host}`;

    // Fetch players + rosters in parallel
    const [allPlayers, leagueRosters] = await Promise.all([
      fetchPlayerData(baseUrl),
      fetchLeagueRosters()
    ]);

    // Set up optimizer
    const optimizer = new FormationOptimizerService();
    optimizer.scoringMode = scoringMode;
    optimizer.currentGW = currentGW;

    // For each team, find their players and compute optimal lineup
    const teams = leagueRosters.map(roster => {
      // Match roster player IDs to full player objects
      const idSet = new Set(roster.playerIds);
      const teamPlayers = allPlayers.filter(p => {
        const sid = p.sleeper_id || p.player_id || p.id;
        return idSet.has(sid);
      });

      // Run optimizer across all formations
      const formations = optimizer.optimizeAllFormations(teamPlayers);
      const bestFormation = formations.find(f => f.valid) || { formation: 'N/A', totalPoints: 0, players: [] };

      // Transform optimal XI for client
      const optimalXI = (bestFormation.players || []).map(p => transformPlayerForClient(p, optimizer));

      // Count positions of full roster for depth info
      const positionDepth = { GKP: 0, DEF: 0, MID: 0, FWD: 0 };
      teamPlayers.forEach(p => {
        const pos = normalizePosition(p);
        if (positionDepth.hasOwnProperty(pos)) positionDepth[pos]++;
      });

      // Identify injury concerns
      const injuries = teamPlayers
        .filter(p => p.fpl_status && p.fpl_status !== 'a')
        .map(p => ({
          name: p.web_name || p.name,
          position: normalizePosition(p),
          status: p.fpl_status,
          news: p.fpl_news || null
        }));

      return {
        displayName: roster.displayName,
        roster_id: roster.roster_id,
        owner_id: roster.owner_id,
        projectedPoints: Math.round(bestFormation.totalPoints * 10) / 10,
        optimalFormation: bestFormation.formation,
        optimalXI,
        rosterSize: teamPlayers.length,
        positionDepth,
        injuries,
        wins: roster.wins,
        losses: roster.losses,
        ties: roster.ties,
        pointsFor: roster.pointsFor,
        pointsAgainst: roster.pointsAgainst
      };
    });

    // Sort by projected points descending
    teams.sort((a, b) => b.projectedPoints - a.projectedPoints);

    const result = {
      success: true,
      teams,
      metadata: {
        timestamp: new Date().toISOString(),
        scoringMode,
        currentGameweek: currentGW,
        teamsAnalyzed: teams.length
      }
    };

    cacheService.set(cacheKey, result, 5 * 60 * 1000);
    return NextResponse.json(result);

  } catch (error) {
    console.error('Scout error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
