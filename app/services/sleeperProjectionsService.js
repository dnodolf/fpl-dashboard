// app/services/sleeperProjectionsService.js
// Fetches Sleeper projected stats for future GWs and computes fantasy points
// using the league's custom scoring settings. Same pos_* stat format as actuals.

import { cacheService } from './cacheService.js';
import { computePlayerFantasyPoints, fetchLeagueScoringSettings } from './sleeperMatchupService.js';

const SLEEPER_API_BASE = 'https://api.sleeper.app/v1';
const SLEEPER_SEASON = '2025';
const CACHE_TTL = 2 * 60 * 60 * 1000; // 2 hours

/**
 * Fetch projected stats for a single GW and compute fantasy points.
 * Returns { [sleeperId]: projectedPoints } or null on failure.
 */
async function fetchGWProjections(gw, scoringSettings) {
  const cacheKey = `sleeper-proj-gw-${gw}`;
  const cached = cacheService.get(cacheKey);
  if (cached?.pointsMap) return cached.pointsMap;

  try {
    const url = `${SLEEPER_API_BASE}/projections/clubsoccer:epl/regular/${SLEEPER_SEASON}/${gw}`;
    const response = await fetch(url, { cache: 'no-store' });

    if (!response.ok) return null;

    const projections = await response.json();
    if (!projections || typeof projections !== 'object') return null;

    const pointsMap = {};
    for (const [playerId, projStats] of Object.entries(projections)) {
      if (playerId.startsWith('TEAM') || !projStats || typeof projStats !== 'object') continue;
      if (Object.keys(projStats).length === 0) continue;

      pointsMap[playerId] = computePlayerFantasyPoints(projStats, scoringSettings);
    }

    cacheService.set(cacheKey, { pointsMap }, CACHE_TTL);
    return pointsMap;

  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(`Sleeper projections GW${gw} fetch failed:`, error.message);
    }
    return null;
  }
}

/**
 * Fetch Sleeper projected points for all GWs from currentGW to 38.
 * Returns { projections: { [sleeperId]: { [gw]: points } }, playerCount, gwsLoaded }
 * or null on complete failure.
 */
export async function fetchSleeperProjections(currentGWNumber) {
  const leagueId = process.env.SLEEPER_LEAGUE_ID || '1240184286171107328';

  try {
    const scoringSettings = await fetchLeagueScoringSettings(leagueId);

    const gwNumbers = Array.from({ length: 38 - currentGWNumber + 1 }, (_, i) => currentGWNumber + i);

    // Fetch all GWs in parallel (batches of 5 to be polite to API)
    const allResults = [];
    for (let i = 0; i < gwNumbers.length; i += 5) {
      const batch = gwNumbers.slice(i, i + 5);
      const results = await Promise.all(
        batch.map(gw => fetchGWProjections(gw, scoringSettings))
      );
      allResults.push(...batch.map((gw, j) => ({ gw, result: results[j] })));
    }

    // Combine into nested structure: { sleeperId: { gw: points } }
    const projections = {};
    let totalSamples = 0;

    for (const { gw, result } of allResults) {
      if (!result) continue;
      for (const [playerId, pts] of Object.entries(result)) {
        if (!projections[playerId]) projections[playerId] = {};
        projections[playerId][gw] = pts;
        totalSamples++;
      }
    }

    const playerCount = Object.keys(projections).length;
    // Track which GWs had projection data — absence of a player in a GW with data = blank fixture
    const gwsWithData = new Set(allResults.filter(r => r.result).map(r => r.gw));

    if (process.env.NODE_ENV === 'development') {
      console.log(`Sleeper Projections: ${playerCount} players, ${totalSamples} data points across ${gwsWithData.size}/${gwNumbers.length} GWs`);
    }

    if (playerCount === 0) return null;

    return { projections, playerCount, gwsLoaded: gwsWithData.size, gwsWithData };

  } catch (error) {
    console.error('Sleeper projections fetch failed:', error.message);
    return null;
  }
}
