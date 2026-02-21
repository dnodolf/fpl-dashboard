// app/services/sleeperMatchupService.js
// Fetches historical Sleeper player stats and computes fantasy points per player per GW.
// Uses the Sleeper stats API (/stats/clubsoccer:epl/regular/{season}/{week}) which returns
// raw stats with pos_*_* fields that map directly to this league's scoring settings.
//
// The /league/{id}/matchups/{week} endpoint returns null for EPL leagues — use stats instead.

import { cacheService } from './cacheService.js';

const SLEEPER_API_BASE = 'https://api.sleeper.app/v1';
const CACHE_TTL_GW = 24 * 60 * 60 * 1000;    // 24 hours — historical GW data never changes
const CACHE_TTL_SCORING = 60 * 60 * 1000;     // 1 hour — scoring settings rarely change
const SLEEPER_SEASON = '2025';                  // 2025-26 PL season uses season=2025 in Sleeper

/**
 * Fetch this league's scoring settings (pos_* keys with non-zero values).
 * Used to compute fantasy points from raw Sleeper player stats.
 */
async function fetchLeagueScoringSettings(leagueId) {
  const cacheKey = `sleeper-scoring-settings-${leagueId}`;
  const cached = cacheService.get(cacheKey);
  if (cached?.scoring) return cached.scoring;

  const response = await fetch(`${SLEEPER_API_BASE}/league/${leagueId}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Sleeper league API failed: ${response.status}`);

  const leagueData = await response.json();
  const rawScoring = leagueData.scoring_settings || {};

  // Keep only pos_* keys with non-zero values — these are the only ones that affect scoring
  const scoring = {};
  for (const [key, value] of Object.entries(rawScoring)) {
    if (key.startsWith('pos_') && value !== 0) {
      scoring[key] = value;
    }
  }

  if (process.env.NODE_ENV === 'development') {
    console.log(`🏆 Sleeper scoring settings: ${Object.keys(scoring).length} active pos_* rules`);
  }

  cacheService.set(cacheKey, { scoring }, CACHE_TTL_SCORING);
  return scoring;
}

/**
 * Compute fantasy points for a player in one GW from their raw Sleeper stats.
 * The pos_*_* stat keys map 1:1 to scoring setting keys — just multiply and sum.
 */
function computePlayerFantasyPoints(playerStats, scoringSettings) {
  let total = 0;
  for (const [key, value] of Object.entries(playerStats)) {
    const weight = scoringSettings[key];
    if (weight && value) {
      total += weight * value;
    }
  }
  return Math.round(total * 100) / 100;
}

/**
 * Fetch player stats for a single past GW and compute fantasy points.
 * Returns { sleeperId: points } or null on failure.
 */
async function fetchGWStats(leagueId, gw, scoringSettings) {
  const cacheKey = `sleeper-gw-stats-${gw}`;
  const cached = cacheService.get(cacheKey);
  if (cached?.pointsMap) return cached.pointsMap;

  try {
    const url = `${SLEEPER_API_BASE}/stats/clubsoccer:epl/regular/${SLEEPER_SEASON}/${gw}`;
    const response = await fetch(url, { cache: 'no-store' });

    if (!response.ok) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`⚠️ Sleeper stats GW${gw}: HTTP ${response.status}`);
      }
      return null;
    }

    const stats = await response.json();
    if (!stats || typeof stats !== 'object') return null;

    // Compute fantasy points for each player
    const pointsMap = {};
    for (const [playerId, playerStats] of Object.entries(stats)) {
      // Skip team entries (e.g. "TEAM_1032") and empty stat objects
      if (playerId.startsWith('TEAM') || !playerStats || typeof playerStats !== 'object') continue;
      if (Object.keys(playerStats).length === 0) continue;

      const pts = computePlayerFantasyPoints(playerStats, scoringSettings);
      // Include all players, even those with 0 pts (calibration service filters zeros)
      pointsMap[playerId] = pts;
    }

    cacheService.set(cacheKey, { pointsMap }, CACHE_TTL_GW);
    return pointsMap;

  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(`⚠️ Sleeper stats GW${gw} fetch failed:`, error.message);
    }
    return null;
  }
}

/**
 * Fetch historical Sleeper fantasy points for all players across all past GWs.
 * Runs all GW fetches concurrently since each is independent.
 *
 * Returns:
 * {
 *   history: { [sleeperId]: { [gw]: fantasyPoints } },
 *   sampleCount: total data points,
 *   gwsLoaded: number of past GWs fetched
 * }
 * Or null on complete failure.
 */
export async function fetchSleeperMatchupHistory(currentGWNumber) {
  const leagueId = process.env.SLEEPER_LEAGUE_ID || '1240184286171107328';
  const pastGWs = Math.max(0, currentGWNumber - 1);

  if (pastGWs < 1) {
    if (process.env.NODE_ENV === 'development') {
      console.log('📊 Sleeper Stats: No past GWs to fetch (GW1)');
    }
    return null;
  }

  try {
    // Fetch scoring settings first (needed to compute points from raw stats)
    const scoringSettings = await fetchLeagueScoringSettings(leagueId);

    const gwNumbers = Array.from({ length: pastGWs }, (_, i) => i + 1);
    const gwResults = await Promise.all(
      gwNumbers.map(gw => fetchGWStats(leagueId, gw, scoringSettings))
    );

    // Combine into nested structure: { sleeperId: { gw: points } }
    const history = {};
    let totalSamples = 0;

    gwNumbers.forEach((gw, i) => {
      const gwMap = gwResults[i];
      if (!gwMap) return;

      for (const [playerId, pts] of Object.entries(gwMap)) {
        if (!history[playerId]) history[playerId] = {};
        history[playerId][gw] = pts;
        totalSamples++;
      }
    });

    const playerCount = Object.keys(history).length;
    const loadedGWs = gwResults.filter(Boolean).length;

    if (process.env.NODE_ENV === 'development') {
      console.log(`📊 Sleeper Stats History: ${playerCount} players, ${totalSamples} data points across ${loadedGWs}/${pastGWs} GWs`);
    }

    if (playerCount === 0) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('⚠️ Sleeper stats: No player data found — check stats API or season value');
      }
      return null;
    }

    return {
      history,
      sampleCount: totalSamples,
      gwsLoaded: pastGWs
    };

  } catch (error) {
    console.error('❌ Sleeper stats history fetch failed:', error.message);
    return null;
  }
}
