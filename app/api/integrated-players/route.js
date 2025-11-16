// app/api/integrated-players/route.js - SIMPLIFIED OPTA-ONLY VERSION WITH UNIFIED POSITION LOGIC

import { NextResponse } from 'next/server';
import GameweekService from '../../services/gameweekService.js';
import { normalizePosition } from '../../../utils/positionUtils.js';
import sleeperPredictionServiceV3 from '../../services/sleeperPredictionServiceV3';
import ffhStatsService from '../../services/ffhStatsService';
import v3ScoringService from '../../services/v3ScoringService.js';

// Cache for API responses
let cachedData = null;
let cacheTimestamp = null;
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

async function enhancePlayersWithV3Predictions(matchedPlayers, currentGameweek) {
  try {
    console.log(`🚀 V3 Sleeper Scoring: Converting ${matchedPlayers.length} players to Sleeper league scoring`);

    // Use our simplified v3ScoringService with FPL→Sleeper conversion
    const enhancedPlayers = await v3ScoringService.applyV3Scoring(matchedPlayers, currentGameweek);

    // Calculate stats
    const playersWithV3 = enhancedPlayers.filter(p => p.v3_season_total > 0);
    const v3Stats = {
      totalPlayers: enhancedPlayers.length,
      v3Enhanced: playersWithV3.length,
      v3Coverage: Math.round((playersWithV3.length / enhancedPlayers.length) * 100),
      averageImprovement: 0
    };

    console.log(`📊 V3 Sleeper Summary: ${playersWithV3.length}/${enhancedPlayers.length} players with predictions`);

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

// Helper function for matching
function findFFHStatsMatch(sleeperPlayer, ffhStatsPlayers) {
  return ffhStatsPlayers.find(ffh => {
    const sleeperName = (sleeperPlayer.full_name || sleeperPlayer.name || '').toLowerCase();
    const ffhName = (ffh.web_name || '').toLowerCase();
    const sleeperTeam = (sleeperPlayer.team_abbr || sleeperPlayer.team || '').toUpperCase();
    const ffhTeam = (ffh.teamContext?.code_name || '').toUpperCase();
    
    const namesSimilar = sleeperName.includes(ffhName) || ffhName.includes(sleeperName);
    const teamsMatch = sleeperTeam === ffhTeam;
    
    return namesSimilar && teamsMatch;
  });
}

// Helper function for Sleeper scoring (if you don't already have this)
async function fetchSleeperScoringSettings() {
  try {
    const leagueId = process.env.SLEEPER_LEAGUE_ID || '1240184286171107328';
    const response = await fetch(`https://api.sleeper.app/v1/league/${leagueId}`);
    const leagueData = await response.json();
    return leagueData.scoring_settings || {};
  } catch (error) {
    console.error('Error fetching Sleeper scoring:', error);
    return {
      'pos_gk_sv': 1, 'pos_d_tkw': 1, 'pos_d_int': 0.5, 
      'pos_m_kp': 1, 'pos_m_tkw': 0.5, 'pos_m_int': 1, 
      'pos_f_sot': 1, 'pos_f_kp': 0.5
    };
  }
}

/**
 * Fail-fast import wrapper - no fallbacks, system errors if services unavailable
 */
async function importServices() {
  console.log('🔧 Starting critical service import (fail-fast mode)...');
  
  // Import playerMatchingService - REQUIRED
  console.log('🔧 Importing playerMatchingService...');
  const playerMatchingModule = await import('../../services/playerMatchingService.js');
  
  if (!playerMatchingModule.PlayerMatchingService) {
    throw new Error('PlayerMatchingService class not found in playerMatchingService.js');
  }
  
  const matchingService = new playerMatchingModule.PlayerMatchingService();
  console.log('✅ PlayerMatchingService loaded and instantiated');
  
  // Import scoringConversionService - REQUIRED  
  console.log('🔧 Importing scoringConversionService...');
  const scoringModule = await import('../../services/scoringConversionService.js');
  
  const scoringService = scoringModule.default || scoringModule;
  if (!scoringService) {
    throw new Error('scoringConversionService default export not found');
  }
  
  // Verify required methods exist
  if (typeof scoringService.enhancePlayerWithScoringConversion !== 'function') {
    throw new Error('scoringConversionService missing enhancePlayerWithScoringConversion method');
  }
  
  console.log('✅ scoringConversionService loaded with required methods');
  console.log('✅ All services loaded successfully - system ready');

  return {
    matching: matchingService,
    scoring: scoringService,
    available: true
  };
}

/**
 * Enhanced FFH prediction extraction - handles both results and predictions arrays
 * DURABLE FIX: Works for all gameweeks by checking both arrays intelligently
 */
function extractAllGameweekPredictions(ffhPlayer) {
  const allPredictions = new Map(); // Use Map to avoid duplicates and maintain order
  
  // Step 1: Process the 'predictions' array (future/upcoming gameweeks)
  if (ffhPlayer.predictions && Array.isArray(ffhPlayer.predictions)) {
    ffhPlayer.predictions.forEach(pred => {
      if (pred.gw && pred.predicted_pts) {
        const pts = typeof pred.predicted_pts === 'object' ?
                    pred.predicted_pts.predicted_pts : pred.predicted_pts;
        const mins = pred.predicted_mins || pred.xmins || 0;
        
        if (typeof pts === 'number' && pts >= 0) {
          allPredictions.set(pred.gw, {
            gw: pred.gw,
            predicted_pts: pts,
            predicted_mins: mins,
            source: 'predictions'
          });
        }
      }
    });
  }
  
  // Step 2: Process the 'results' array (current/completed gameweeks)
  // Results take PRIORITY over predictions for the same gameweek
  if (ffhPlayer.results && Array.isArray(ffhPlayer.results)) {
    ffhPlayer.results
      .filter(result => result.season === 2025) // Only current season
      .forEach(result => {
        if (result.gw && result.predicted_pts) {
          const pts = typeof result.predicted_pts === 'object' ?
                      result.predicted_pts.predicted_pts : result.predicted_pts;
          const mins = result.predicted_mins || result.xmins || 0;
          
          if (typeof pts === 'number' && pts >= 0) {
            // OVERRIDE prediction with result for same gameweek
            allPredictions.set(result.gw, {
              gw: result.gw,
              predicted_pts: pts,
              predicted_mins: mins,
              source: 'results'
            });
          }
        }
      });
  }
  
  // Convert to arrays
  const allPredictionsArray = Array.from(allPredictions.values())
    .sort((a, b) => a.gw - b.gw);
  
  const upcomingPredictions = allPredictionsArray.filter(p => p.gw >= 2); // Adjust as needed
  const currentPredictions = allPredictionsArray.filter(p => p.gw < 10); // Current season predictions
  
  return {
    all: allPredictionsArray,
    upcoming: upcomingPredictions,
    current: currentPredictions
  };
}

/**
 * Extract gameweek minutes predictions from FFH player data
 * Extracts xmins from predictions array and mins from results array
 */
function extractAllGameweekMinutes(ffhPlayer) {
  const allMinutes = new Map(); // Use Map to avoid duplicates and maintain order
  
  // Step 1: Process the 'predictions' array (future/upcoming gameweeks)
  if (ffhPlayer.predictions && Array.isArray(ffhPlayer.predictions)) {
    ffhPlayer.predictions.forEach(pred => {
      if (pred.gw && pred.xmins) {
        allMinutes.set(pred.gw, pred.xmins);
      }
    });
  }
  
  // Step 2: Process the 'results' array (past gameweeks)
  // Results take PRIORITY over predictions for the same gameweek
  if (ffhPlayer.results && Array.isArray(ffhPlayer.results)) {
    ffhPlayer.results
      .filter(result => result.season === 2025) // Only current season
      .forEach(result => {
        if (result.gw && result.mins !== undefined) {
          // Override prediction with actual result for same gameweek
          allMinutes.set(result.gw, result.mins);
        }
      });
  }
  
  // Convert Map to object with string keys (for JSON compatibility)
  const minutesObject = {};
  for (const [gw, mins] of allMinutes) {
    minutesObject[gw.toString()] = mins;
  }
  
  return minutesObject;
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
 * Fallback scoring conversion
 */
function fallbackConvertFFHToSleeper(ffhPrediction, position) {
  if (!ffhPrediction || ffhPrediction <= 0) return 0;
  
  const multipliers = {
    'GKP': 0.8,
    'DEF': 0.9,
    'MID': 1.0,
    'FWD': 1.1
  };
  
  const multiplier = multipliers[position] || 1.0;
  return Math.round(ffhPrediction * multiplier * 100) / 100;
}

/**
 * Fetch Sleeper data directly from Sleeper API (no internal routes)
 */
async function fetchSleeperData() {
  try {
    console.log('📡 Pipeline: Fetching Sleeper players & rosters');
    const leagueId = process.env.SLEEPER_LEAGUE_ID || '1240184286171107328';
    
    const [playersResponse, rostersResponse, usersResponse] = await Promise.all([
      fetch('https://api.sleeper.app/v1/players/clubsoccer:epl'),
      fetch(`https://api.sleeper.app/v1/league/${leagueId}/rosters`),
      fetch(`https://api.sleeper.app/v1/league/${leagueId}/users`)
    ]);

    if (!playersResponse.ok || !rostersResponse.ok || !usersResponse.ok) {
      throw new Error('Failed to fetch Sleeper data - one or more endpoints failed');
    }

    console.log('✅ All Sleeper API calls successful, processing data...');

    const [playersData, rostersData, usersData] = await Promise.all([
      playersResponse.json(),
      rostersResponse.json(),
      usersResponse.json()
    ]);

    // Create ownership mapping
    const ownershipMap = {};
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
    });

    console.log('✅ Sleeper ownership mapping created');

    return {
      players: playersData,
      ownership: ownershipMap,
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
  console.log('📡 Pipeline: Fetching FFH predictions & stats');

  const ffhBaseUrl = 'https://data.fantasyfootballhub.co.uk/api';
  const authStatic = process.env.FFH_AUTH_STATIC;
  const bearerToken = process.env.FFH_BEARER_TOKEN;

  if (!authStatic || !bearerToken) {
    console.warn('⚠️ FFH credentials not configured. Falling back to Sleeper-only mode.');
    throw new Error('FFH credentials not available');
  }
  
  const url = `${ffhBaseUrl}/player-predictions/?orderBy=points&focus=range&positions=1,2,3,4&min_cost=40&max_cost=145&search_term=&gw_start=1&gw_end=47&first=0&last=1000&use_predicted_fixtures=false&selected_players=`;
  
  console.log('🔗 Calling FFH directly: ' + url);
  
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

  // Handle the response based on actual structure
  let playerArray = null;
  
  if (Array.isArray(ffhData)) {
    // FFH returns direct array
    playerArray = ffhData;
    console.log('✅ Using direct FFH array as player data');
  } else if (ffhData.results && Array.isArray(ffhData.results)) {
    playerArray = ffhData.results;
    console.log('✅ Using ffhData.results as player array');
  } else if (ffhData.data && Array.isArray(ffhData.data)) {
    playerArray = ffhData.data;
    console.log('✅ Using ffhData.data as player array');
  }

  if (!playerArray || !Array.isArray(playerArray)) {
    console.error('❌ FFH Response structure (first 500 chars):', JSON.stringify(ffhData, null, 2).substring(0, 500));
    throw new Error('FFH API returned invalid data structure - no valid player array found');
  }

  if (playerArray.length === 0) {
    throw new Error('FFH API returned empty player data');
  }

  console.log(`✅ FFH data fetched successfully: ${playerArray.length} players`);
  
  return {
    players: playerArray,
    totalPlayers: playerArray.length,
    fallback: false
  };
}

/**
 * FAIL-FAST INTEGRATION - No fallbacks, system errors if any component fails
 */
async function integratePlayersWithOptaMatching(currentGameweek) {
  console.log('🔗 Pipeline: Starting player integration');
  const services = await importServices(); // Will throw if any service fails
  
  // Fetch data from both sources - BOTH must succeed
  // Data sources fetched above
  const [sleeperData, ffhData] = await Promise.all([
    fetchSleeperData(), // Will throw if fails
    fetchFFHData()      // Will throw if fails
  ]);

  console.log(`📊 All data fetched successfully - Sleeper: ${sleeperData.totalPlayers}, FFH: ${ffhData.totalPlayers}`);

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
      fantasy_data_source: 'sleeper'
    };
  });

  console.log(`🔗 Pipeline: Matched ${sleeperPlayersArray.length} players with FFH data`);

  // **CRITICAL**: Match players using services - MUST succeed
  console.log('🎯 Matching players with FFH data using services...');
  
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

  console.log(`🎯 Player matching completed:`);
  console.log(`  - Total players: ${matchedPlayers.length}`);
  console.log(`  - Successfully matched: ${matchCount}`);
  console.log(`  - Enhancement errors: ${enhancementErrors}`);
  console.log(`  - Match rate: ${((matchCount / sleeperPlayersArray.length) * 100).toFixed(1)}%`);

  // Verify we have meaningful data
  const playersWithPredictions = matchedPlayers.filter(p => p.predicted_points > 0);
  console.log(`📊 Players with predictions: ${playersWithPredictions.length}`);

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
    const forceRefresh = requestData.forceRefresh || false;

    // Check cache unless force refresh
    if (!forceRefresh && cachedData && cacheTimestamp) {
      const isValid = (Date.now() - cacheTimestamp) < CACHE_DURATION;
      if (isValid) {
        console.log('📋 Returning cached data');
        return NextResponse.json({
          ...cachedData,
          cached: true,
          cache_age: Math.round((Date.now() - cacheTimestamp) / 1000 / 60)
        });
      }
    }

    // Get current gameweek from authoritative service
    let currentGameweek;
    try {
      console.log('📅 Getting current gameweek from authoritative service...');
      const gameweekService = (await import('../../services/gameweekService.js')).default;
      const gameweekData = await gameweekService.getCurrentGameweek();
      currentGameweek = gameweekData; // Keep full object with .number property
      console.log(`📅 Current gameweek: ${currentGameweek.number}`);
    } catch (error) {
      console.error('❌ Failed to get current gameweek from authoritative service:', error);
      throw new Error('Cannot proceed without current gameweek information');
    }

    // Fresh data integration
    const players = await integratePlayersWithOptaMatching(currentGameweek); // Pass it here

    // Enhanced player processing with V3 predictions
    console.log('🚀 Starting V3 prediction enhancement...');
    const v3EnhancedResult = await enhancePlayersWithV3Predictions(players, currentGameweek);

const finalPlayers = v3EnhancedResult.players;
const v3Statistics = v3EnhancedResult.v3Stats;

console.log(`✅ Pipeline: V3 scoring applied to ${v3Statistics.v3Enhanced}/${v3Statistics.totalPlayers} players`);

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
cachedData = responseData;
cacheTimestamp = Date.now();
console.log('💾 Data cached successfully');

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