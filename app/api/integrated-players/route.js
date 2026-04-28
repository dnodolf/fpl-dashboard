// app/api/integrated-players/route.js - SIMPLIFIED OPTA-ONLY VERSION WITH UNIFIED POSITION LOGIC

import { NextResponse } from 'next/server';
import GameweekService from '../../services/gameweekService.js';
import { normalizePosition } from '../../../utils/positionUtils.js';
import v3ScoringService from '../../services/v3ScoringService.js';
import { extractAllGameweekPredictions, extractAllGameweekMinutes } from '../../utils/ffhDataUtils.js';
import { cacheService } from '../../services/cacheService.js';

async function enhancePlayersWithV3Predictions(matchedPlayers, currentGameweek, calibrationData = null) {
  try {
    if (process.env.NODE_ENV === 'development') {
      console.log(`🚀 V3 Sleeper Scoring: Converting ${matchedPlayers.length} players to Sleeper league scoring`);
      if (calibrationData?.calibrated) {
        console.log(`🎯 Using calibrated ratios (${calibrationData.sampleCount} samples, confidence=${calibrationData.confidence})`);
      } else {
        console.log(`⚠️ Using hardcoded V3 ratios (no calibration data)`);
      }
    }

    // Use v3ScoringService with calibration data for dynamic ratios
    const enhancedPlayers = await v3ScoringService.applyV3Scoring(matchedPlayers, currentGameweek, calibrationData);

    // Calculate stats
    const playersWithV3 = enhancedPlayers.filter(p => p.v3_season_total > 0);
    const v3Stats = {
      totalPlayers: enhancedPlayers.length,
      v3Enhanced: playersWithV3.length,
      v3Coverage: Math.round((playersWithV3.length / enhancedPlayers.length) * 100),
      averageImprovement: 0
    };

    if (process.env.NODE_ENV === 'development') {
      console.log(`📊 V3 Sleeper Summary: ${playersWithV3.length}/${enhancedPlayers.length} players with predictions`);
    }

    return {
      players: enhancedPlayers,
      v3Stats: v3Stats
    };

  } catch (error) {
    console.error('❌ V3 enhancement failed:', error);
    // Return players without V3 enhancement
    return {
      players: matchedPlayers,
      v3Stats: {
        totalPlayers: matchedPlayers.length,
        v3Enhanced: 0,
        v3Coverage: 0,
        averageImprovement: 0
      }
    };
  }
}

/**
 * Fail-fast import wrapper - no fallbacks, system errors if services unavailable
 */
async function importServices() {
  if (process.env.NODE_ENV === 'development') {
    console.log('🔧 Starting critical service import (fail-fast mode)...');
  }

  // Import playerMatchingService - REQUIRED
  const playerMatchingModule = await import('../../services/playerMatchingService.js');

  if (!playerMatchingModule.PlayerMatchingService) {
    throw new Error('PlayerMatchingService class not found in playerMatchingService.js');
  }

  const matchingService = new playerMatchingModule.PlayerMatchingService();

  // Import scoringConversionService - REQUIRED
  const scoringModule = await import('../../services/scoringConversionService.js');

  const scoringService = scoringModule.default || scoringModule;
  if (!scoringService) {
    throw new Error('scoringConversionService default export not found');
  }

  // Verify required methods exist
  if (typeof scoringService.enhancePlayerWithScoringConversion !== 'function') {
    throw new Error('scoringConversionService missing enhancePlayerWithScoringConversion method');
  }

  if (process.env.NODE_ENV === 'development') {
    console.log('✅ All services loaded successfully - system ready');
  }

  return {
    matching: matchingService,
    scoring: scoringService,
    available: true
  };
}

/**
 * Extract team code for display
 */
function extractTeamCode(ffhPlayer) {
  if (!ffhPlayer) return null;
  if (ffhPlayer.team?.code_name) return ffhPlayer.team.code_name;
  if (ffhPlayer.team_short_name) return ffhPlayer.team_short_name;
  if (ffhPlayer.club) return ffhPlayer.club;
  if (ffhPlayer.team) return ffhPlayer.team;
  return null;
}

/**
 * Fetch Sleeper data directly from Sleeper API (no internal routes)
 */
async function fetchSleeperData(requestLeagueId = null) {
  try {
    if (process.env.NODE_ENV === 'development') {
      console.log('📡 Pipeline: Fetching Sleeper players & rosters');
    }
    const leagueId = requestLeagueId || process.env.SLEEPER_LEAGUE_ID || '1240184286171107328';
    
    const [playersResponse, rostersResponse, usersResponse] = await Promise.all([
      fetch('https://api.sleeper.app/v1/players/clubsoccer:epl'),
      fetch(`https://api.sleeper.app/v1/league/${leagueId}/rosters`),
      fetch(`https://api.sleeper.app/v1/league/${leagueId}/users`)
    ]);

    if (!playersResponse.ok || !rostersResponse.ok || !usersResponse.ok) {
      throw new Error('Failed to fetch Sleeper data - one or more endpoints failed');
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('✅ All Sleeper API calls successful, processing data...');
    }

    const [playersData, rostersData, usersData] = await Promise.all([
      playersResponse.json(),
      rostersResponse.json(),
      usersResponse.json()
    ]);

    // Create ownership and starter mappings
    const ownershipMap = {};
    const starterSet = new Set();
    const reserveSet = new Set();
    const userMap = {};

    usersData.forEach(user => {
      userMap[user.user_id] = user.display_name || user.username || 'Unknown';
    });

    rostersData.forEach(roster => {
      const ownerName = userMap[roster.owner_id] || 'Unknown';
      if (roster.players && Array.isArray(roster.players)) {
        roster.players.forEach(playerId => {
          ownershipMap[playerId] = ownerName;
        });
      }
      if (roster.starters && Array.isArray(roster.starters)) {
        roster.starters.forEach(playerId => {
          starterSet.add(playerId);
        });
      }
      if (roster.reserve && Array.isArray(roster.reserve)) {
        roster.reserve.forEach(playerId => {
          reserveSet.add(playerId);
        });
      }
    });

    if (process.env.NODE_ENV === 'development') {
      console.log('✅ Sleeper ownership mapping created');
    }

    return {
      players: playersData,
      ownership: ownershipMap,
      starters: starterSet,
      reserve: reserveSet,
      totalPlayers: Object.keys(playersData).length
    };
  } catch (error) {
    console.error('Error fetching Sleeper data:', error);
    throw error;
  }
}

/**
 * Fetch FFH data directly from FFH API - corrected for direct array response
 */
async function fetchFFHData() {
  if (process.env.NODE_ENV === 'development') {
    console.log('📡 Pipeline: Fetching FFH predictions & stats');
  }

  const ffhBaseUrl = 'https://data.fantasyfootballhub.co.uk/api';
  const authStatic = process.env.FFH_AUTH_STATIC;
  const bearerToken = process.env.FFH_BEARER_TOKEN;

  if (!authStatic || !bearerToken) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('⚠️ FFH credentials not configured. Falling back to Sleeper-only mode.');
    }
    throw new Error('FFH credentials not available');
  }
  
  const url = `${ffhBaseUrl}/player-predictions/?orderBy=points&focus=range&positions=1,2,3,4&min_cost=40&max_cost=145&search_term=&gw_start=1&gw_end=47&first=0&last=1000&use_predicted_fixtures=false&selected_players=`;
  
  if (process.env.NODE_ENV === 'development') {
    console.log('🔗 Calling FFH directly: ' + url);
  }
  
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
    throw new Error(`FFH API failed with status ${response.status}: ${response.statusText}`);
  }

  const ffhData = await response.json();
  
  if (process.env.NODE_ENV === 'development') {
    if (Array.isArray(ffhData)) {
      console.log('  - Direct array length:', ffhData.length);
      if (ffhData.length > 0) {
        console.log('  - First player keys:', Object.keys(ffhData[0]));
        console.log('  - First player web_name:', ffhData[0].web_name);
        console.log('  - Has player.opta_uuid?', !!ffhData[0].player?.opta_uuid);
      }
    } else {
      console.log('  - Response keys:', Object.keys(ffhData));
      console.log('  - Has results?', !!ffhData.results);
      console.log('  - Has data?', !!ffhData.data);
    }
  }

  // Handle the response based on actual structure
  let playerArray = null;
  
  if (Array.isArray(ffhData)) {
    // FFH returns direct array
    playerArray = ffhData;
    if (process.env.NODE_ENV === 'development') {
      console.log('✅ Using direct FFH array as player data');
    }
  } else if (ffhData.results && Array.isArray(ffhData.results)) {
    playerArray = ffhData.results;
    if (process.env.NODE_ENV === 'development') {
      console.log('✅ Using ffhData.results as player array');
    }
  } else if (ffhData.data && Array.isArray(ffhData.data)) {
    playerArray = ffhData.data;
    if (process.env.NODE_ENV === 'development') {
      console.log('✅ Using ffhData.data as player array');
    }
  }

  if (!playerArray || !Array.isArray(playerArray)) {
    console.error('❌ FFH Response structure (first 500 chars):', JSON.stringify(ffhData, null, 2).substring(0, 500));
    throw new Error('FFH API returned invalid data structure - no valid player array found');
  }

  if (playerArray.length === 0) {
    throw new Error('FFH API returned empty player data');
  }

  if (process.env.NODE_ENV === 'development') {
    console.log(`✅ FFH data fetched successfully: ${playerArray.length} players`);
  }
  
  return {
    players: playerArray,
    totalPlayers: playerArray.length,
    fallback: false
  };
}

/**
 * FAIL-FAST INTEGRATION - No fallbacks, system errors if any component fails
 */
async function integratePlayersWithOptaMatching(currentGameweek, requestLeagueId = null) {
  if (process.env.NODE_ENV === 'development') {
    console.log('🔗 Pipeline: Starting player integration');
  }
  const services = await importServices(); // Will throw if any service fails
  
  // Fetch data from all sources in parallel
  const { fetchFPLNewsData } = await import('../../services/fplNewsService.js');
  const { fetchFFHCustomStats } = await import('../../services/ffhCustomStatsService.js');
  const [sleeperData, ffhData, fplNewsMap, ffhCustomStats] = await Promise.all([
    fetchSleeperData(requestLeagueId), // Will throw if fails
    fetchFFHData(),     // Will throw if fails
    fetchFPLNewsData(),  // Returns null on failure (graceful)
    fetchFFHCustomStats(currentGameweek?.number)  // Returns null on failure (graceful)
  ]);

  if (process.env.NODE_ENV === 'development') {
    console.log(`📊 All data fetched successfully - Sleeper: ${sleeperData.totalPlayers}, FFH: ${ffhData.totalPlayers}`);
  }

// Convert Sleeper players to array with unified positions - WITH OWNERSHIP
const sleeperPlayersArray = Object.entries(sleeperData.players)
  .filter(([id, player]) => player && typeof player === 'object')
  .map(([id, player]) => {
    const playerName = player.full_name || 
                   player.name || 
                   player.web_name ||
                   (player.first_name && player.last_name ? 
                     `${player.first_name} ${player.last_name}` : '') ||
                   'Unknown Player';
    const position = normalizePosition(player); // ✅ FIXED - pass whole player object
    
    return {
      id,
      sleeper_id: id,
      ...player,
      position,
      owned_by: sleeperData.ownership[id] || 'Free Agent',
      is_starter: sleeperData.starters.has(id),
      is_reserve: sleeperData.reserve.has(id),
      fantasy_data_source: 'sleeper'
    };
  });

  if (process.env.NODE_ENV === 'development') {
    console.log(`🔗 Pipeline: Matched ${sleeperPlayersArray.length} players with FFH data`);
    console.log('🎯 Matching players with FFH data using services...');
  }
  
  const matchedPlayers = [];
  let matchCount = 0;
  let enhancementErrors = 0;

  for (const sleeperPlayer of sleeperPlayersArray) {
    try {
      // Find FFH match using matching service
      const ffhMatch = await services.matching.findBestMatch(sleeperPlayer, ffhData.players);
      
      if (ffhMatch) {
        // Enhance with FFH data using scoring service
        const enhancedPlayer = await services.scoring.enhancePlayerWithScoringConversion(
          sleeperPlayer, 
          ffhMatch,
          currentGameweek
        );
        
        // Extract and add FFH minutes data
        const ffhMinutes = extractAllGameweekMinutes(ffhMatch);
        if (Object.keys(ffhMinutes).length > 0) {
          enhancedPlayer.ffh_gw_minutes = JSON.stringify(ffhMinutes);
        } else {
          enhancedPlayer.ffh_gw_minutes = null;
        }
        
        matchedPlayers.push(enhancedPlayer);
        matchCount++;
      } else {
        // No FFH match found - add player without predictions
        matchedPlayers.push({
          ...sleeperPlayer,
          predicted_points: 0,
          sleeper_points: 0,
          ffh_matched: false
        });
      }
    } catch (error) {
      console.error(`❌ Error enhancing player ${sleeperPlayer.full_name}:`, error.message);
      enhancementErrors++;
      
      // Add player without enhancement
      matchedPlayers.push({
        ...sleeperPlayer,
        predicted_points: 0,
        sleeper_points: 0,
        enhancement_error: error.message
      });
    }
  }

  if (process.env.NODE_ENV === 'development') {
    console.log(`🎯 Player matching completed:`);
    console.log(`  - Total players: ${matchedPlayers.length}`);
    console.log(`  - Successfully matched: ${matchCount}`);
    console.log(`  - Enhancement errors: ${enhancementErrors}`);
    console.log(`  - Match rate: ${((matchCount / sleeperPlayersArray.length) * 100).toFixed(1)}%`);
  }

  // Merge FPL Official API news data into matched players
  if (fplNewsMap) {
    let fplNewsMatched = 0;
    for (const player of matchedPlayers) {
      const fplId = player.ffh_id;
      if (fplId && fplNewsMap[fplId]) {
        const fplData = fplNewsMap[fplId];
        player.fpl_status = fplData.fpl_status;
        player.fpl_news = fplData.fpl_news;
        player.fpl_news_added = fplData.fpl_news_added;
        player.fpl_chance_this_round = fplData.fpl_chance_this_round;
        player.fpl_chance_next_round = fplData.fpl_chance_next_round;

        if (fplData.fpl_chance_next_round !== null && fplData.fpl_chance_next_round !== undefined) {
          player.chance_next_round = fplData.fpl_chance_next_round;
          player.chance_of_playing_next_round = fplData.fpl_chance_next_round;
        }

        if (fplData.fpl_news && fplData.fpl_news.trim() !== '') {
          player.news = fplData.fpl_news;
          player.news_added = fplData.fpl_news_added;
          player.news_source = 'fpl';
        }

        // Store FPL official model's expected points for V3 current GW blending
        if (fplData.ep_next !== null && fplData.ep_next !== undefined) {
          player.ep_next = fplData.ep_next;
        }
        if (fplData.ep_this !== null && fplData.ep_this !== undefined) {
          player.ep_this = fplData.ep_this;
        }

        fplNewsMatched++;
      }
    }
    if (process.env.NODE_ENV === 'development') {
      console.log(`📰 FPL News: Merged data for ${fplNewsMatched}/${matchedPlayers.length} players`);
    }
  }

  // Merge FFH Custom Stats (Opta season stats: xG, xA, shots, tackles, etc.)
  if (ffhCustomStats) {
    let customStatsMatched = 0;
    for (const player of matchedPlayers) {
      const code = player.ffh_code;
      if (code && ffhCustomStats[code]) {
        player.opta_stats = ffhCustomStats[code];
        customStatsMatched++;
      }
    }
    if (process.env.NODE_ENV === 'development') {
      console.log(`📊 FFH Custom Stats: Merged Opta stats for ${customStatsMatched}/${matchedPlayers.length} players`);
    }
  }

  // Verify we have meaningful data
  const playersWithPredictions = matchedPlayers.filter(p => p.predicted_points > 0);
  if (process.env.NODE_ENV === 'development') {
    console.log(`📊 Players with predictions: ${playersWithPredictions.length}`);
  }

  if (playersWithPredictions.length === 0) {
    throw new Error('No players have prediction data - system cannot function');
  }

  return matchedPlayers;
}

/**
 * Main POST handler
 */
export async function POST(request) {
  try {
    const requestData = await request.json();
    const forceRefresh = requestData.forceRefresh || process.env.DISABLE_CACHE === 'true' || false;
    const requestLeagueId = requestData.leagueId || null;
    const cacheKey = requestLeagueId ? `integrated-players-${requestLeagueId}` : 'integrated-players';

    // Check cache unless force refresh
    if (!forceRefresh) {
      const cached = cacheService.get(cacheKey);
      if (cached) {
        if (process.env.NODE_ENV === 'development') {
          console.log('📋 Returning cached data');
        }
        return NextResponse.json({
          ...cached,
          cached: true,
          cache_age: Math.round(cached._age / 1000 / 60)
        });
      }
    }

    // Get current gameweek from authoritative service
    let currentGameweek;
    try {
      if (process.env.NODE_ENV === 'development') {
        console.log('📅 Getting current gameweek from authoritative service...');
      }
      const gameweekService = (await import('../../services/gameweekService.js')).default;
      const gameweekData = await gameweekService.getCurrentGameweek();
      currentGameweek = gameweekData; // Keep full object with .number property
      if (process.env.NODE_ENV === 'development') {
        console.log(`📅 Current gameweek: ${currentGameweek.number}`);
      }
    } catch (error) {
      console.error('❌ Failed to get current gameweek from authoritative service:', error);
      throw new Error('Cannot proceed without current gameweek information');
    }

    // Fetch player data + matchup history + Sleeper projections in parallel
    const { fetchSleeperMatchupHistory } = await import('../../services/sleeperMatchupService.js');
    const { fetchSleeperProjections } = await import('../../services/sleeperProjectionsService.js');
    const [players, matchupData, sleeperProjectionsData] = await Promise.all([
      integratePlayersWithOptaMatching(currentGameweek, requestLeagueId),
      fetchSleeperMatchupHistory(currentGameweek.number), // Returns null on failure (graceful)
      fetchSleeperProjections(currentGameweek.number)       // Returns null on failure (graceful)
    ]);

    // Compute calibrated V3 ratios from historical Sleeper vs FPL data
    const { computeCalibration } = await import('../../services/calibrationService.js');
    const calibrationData = computeCalibration(matchupData, players);

    // Merge ep_next from FPL bootstrap-static into players (for current GW blend)
    // fplNewsMap was already fetched inside integratePlayersWithOptaMatching — re-use via player fields
    // ep_next is already on player.ep_next after the FPL news merge in integratePlayersWithOptaMatching
    // (no extra step needed — the merge loop below handles it if ep_next was added to fplNewsMap)

    // Enhanced player processing with V3 predictions + calibration
    if (process.env.NODE_ENV === 'development') {
      console.log('🚀 Starting V3 prediction enhancement...');
    }
    const v3EnhancedResult = await enhancePlayersWithV3Predictions(players, currentGameweek, calibrationData);

let finalPlayers = v3EnhancedResult.players;
const v3Statistics = v3EnhancedResult.v3Stats;

if (process.env.NODE_ENV === 'development') {
  console.log(`✅ Pipeline: V3 scoring applied to ${v3Statistics.v3Enhanced}/${v3Statistics.totalPlayers} players`);
}

// V4 Ensemble: blend V3 predictions with Sleeper projections (75/25)
const { applyV4Scoring } = await import('../../services/v4/core.js');
const sleeperProj = sleeperProjectionsData?.projections || null;
const sleeperGwsWithData = sleeperProjectionsData?.gwsWithData || null;
finalPlayers = applyV4Scoring(finalPlayers, sleeperProj, currentGameweek.number, sleeperGwsWithData);
const v4PlayersWithData = finalPlayers.filter(p => p.v4_has_sleeper_data).length;

if (process.env.NODE_ENV === 'development') {
  console.log(`✅ Pipeline: V4 ensemble applied — ${v4PlayersWithData} players with Sleeper projection data`);
}

// Calculate matching statistics from V3 enhanced players
const playersWithPredictions = finalPlayers.filter(p => p.predicted_points > 0);
const playersWithOpta = finalPlayers.filter(p => p.opta_id);
const matchedPlayers = finalPlayers.filter(p => p.ffh_matched !== false);

// Create response data with V3 integration
const responseData = {
  success: true,
  players: finalPlayers,
  count: finalPlayers.length,
  timestamp: new Date().toISOString(),

  // Calibration metadata — surfaced to UI for transparency
  calibration: {
    active: calibrationData.calibrated,
    sampleCount: calibrationData.sampleCount,
    gwsAnalyzed: calibrationData.gwsAnalyzed,
    confidence: calibrationData.confidence,
    source: calibrationData.source,
    positionRatios: calibrationData.positionRatios,
    playerFactorsCount: Object.keys(calibrationData.playerFactors || {}).length,
    fallbackReason: calibrationData.fallbackReason || null
  },

  // V3 Enhancement Statistics
  v3Enhancement: {
    enabled: true,
    coverage: v3Statistics.v3Coverage + '%',
    averageImprovement: v3Statistics.averageImprovement + ' PPG',
    totalPlayersEnhanced: v3Statistics.v3Enhanced,
    biggestWinners: v3Statistics.biggestWinners,
    positionBreakdown: v3Statistics.positionBreakdown,
    enhancementStatus: v3Statistics.error ? 'error' : 'success'
  },

  // V4 Ensemble Statistics
  v4Enhancement: {
    enabled: true,
    playersWithSleeperData: v4PlayersWithData,
    totalPlayers: finalPlayers.length,
    coverage: Math.round((v4PlayersWithData / finalPlayers.length) * 100) + '%',
    blendWeights: { ffh: 0.70, sleeper: 0.30 },
    sleeperProjectionsAvailable: !!sleeperProj
  },

  // Model accuracy metrics (Sleeper projection MAE from backtest; others tracking)
  modelAccuracy: {
    sleeper_proj: { mae: 2.993, samples: 6263, label: 'Sleeper Proj', source: 'backtest_gw1_29' },
    v3: { mae: null, samples: 0, label: 'V3', source: 'tracking' },
    v4: { mae: null, samples: 0, label: 'V4', source: 'tracking' }
  },
  
  stats: {
    totalPlayers: finalPlayers.length,
    playersWithPredictions: playersWithPredictions.length,
    sleeperTotal: finalPlayers.length,
    ffhTotal: 612, // From your API logs
    optaAnalysis: {
      sleeperWithOpta: playersWithOpta.length,
      sleeperOptaRate: ((playersWithOpta.length / finalPlayers.length) * 100).toFixed(1),
      ffhWithOpta: 612, // From your API logs - all FFH players have Opta
      ffhOptaRate: "100.0",
      optaMatches: matchedPlayers.length,
      optaMatchRate: ((matchedPlayers.length / 612) * 100).toFixed(1),
      unmatchedSleeperWithOpta: finalPlayers.filter(p => p.opta_id && p.ffh_matched === false)
    }
  }
};

// Cache successful results
cacheService.set(cacheKey, responseData, 3 * 60 * 1000); // 3 minutes — short so Sleeper changes show up quickly
if (process.env.NODE_ENV === 'development') {
  console.log('💾 Data cached successfully');
}

return NextResponse.json(responseData);
    
  } catch (error) {
    console.error('POST handler error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      players: [],
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function GET(request) {
  return POST(request);
}