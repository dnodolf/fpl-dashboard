// app/services/ffhCustomStatsService.js
// Fetches rich Opta season stats from FFH players-custom endpoint

import { cacheService } from './cacheService.js';

const FFH_BASE_URL = 'https://data.fantasyfootballhub.co.uk/api';
const CACHE_KEY = 'ffh-custom-stats';
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

/**
 * Fetch FFH players-custom endpoint for Opta season stats.
 * Returns an object keyed by FPL element code (maps to player.code/ffh_code) with stats, or null on failure.
 */
export async function fetchFFHCustomStats(currentGW) {
  const cached = cacheService.get(CACHE_KEY);
  if (cached && cached.statsMap) {
    if (process.env.NODE_ENV === 'development') {
      console.log('📊 FFH Custom Stats: Returning cached data');
    }
    return cached.statsMap;
  }

  try {
    const authStatic = process.env.FFH_AUTH_STATIC;
    const bearerToken = process.env.FFH_BEARER_TOKEN;

    if (!authStatic || !bearerToken) {
      if (process.env.NODE_ENV === 'development') {
        console.log('⚠️ FFH Custom Stats: No credentials, skipping');
      }
      return null;
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(`📡 FFH Custom Stats: Fetching players-custom (GW1-${currentGW})...`);
    }

    const maxGW = currentGW || 38;
    const url = `${FFH_BASE_URL}/players-custom/?mingw=1&maxgw=${maxGW}&type=total&venue=all&season=2025&sortOn=appearance&qty=999&sortOrder=desc&playerSearch=&minCost=37&maxCost=146&positions=1,2,3,4&min_fdr=1&max_fdr=5&page_No=1&lowMins=false&ppm=0`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept-Language': 'en-US',
        'Authorization': authStatic,
        'Content-Type': 'application/json',
        'Token': bearerToken
      },
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error(`FFH Custom Stats API returned ${response.status}`);
    }

    const data = await response.json();
    const playerArray = Array.isArray(data) ? data : null;

    if (!playerArray || playerArray.length === 0) {
      throw new Error('FFH Custom Stats returned no data');
    }

    // Build stats map keyed by FPL element code
    const statsMap = {};
    for (const p of playerArray) {
      if (!p.code) continue;

      statsMap[p.code] = {
        // xG / xA
        xg: p.xg1 || 0,
        xa: p.xa || 0,
        xgi: p.xgi || 0,
        xpts: p.xpts || 0,

        // Shooting
        shots: p.shots || 0,
        shots_on_target: p.shots_on_target || 0,
        shots_in_box: p.shots_in_box || 0,
        big_chance: p.big_chance || 0,
        goals: p.goals || 0,

        // Passing / Creativity
        key_pass: p.key_pass || 0,
        big_chance_created: p.big_chance_created || 0,
        assists: p.assists || 0,
        acc_pass: p.acc_pass || 0,
        total_pass: p.total_pass || 0,

        // Defending
        tackles: p.tackles || 0,
        tackles_won: p.tackles_won || 0,
        intercepts: p.intercepts || 0,
        clearances: p.clearances || 0,
        blocks: p.blocks || 0,
        recoveries: p.recoveries || 0,

        // GK
        saves: p.saves || 0,
        goals_conceded: p.goals_conceded || 0,

        // ICT Index
        influence: p.influence || 0,
        creativity: p.creativity || 0,
        threat: p.threat || 0,

        // Playing time
        mins: p.mins || 0,
        appearance: p.appearance || 0,
        starts: p.starts || 0,

        // Misc
        clean_sheets: p.clean_sheets || 0,
        bps: p.bps || 0,
        bonus: p.bonus || 0,
        yellow_card: p.yellow_card || 0,
        red_card: p.red_card || 0,
        touches_in_opp_box: p.touches_in_opp_box || 0,
        succ_drib: p.succ_drib || 0,
        fouls: p.fouls || 0,
        offside: p.offside || 0,
        pen_taken: p.pen_taken || 0,
        pen_goal: p.pen_goal || 0
      };
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(`✅ FFH Custom Stats: ${Object.keys(statsMap).length} players loaded`);
    }

    cacheService.set(CACHE_KEY, { statsMap }, CACHE_TTL);
    return statsMap;
  } catch (error) {
    console.error('❌ FFH Custom Stats fetch failed (graceful fallback):', error.message);
    return null;
  }
}
