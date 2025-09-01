// app/api/integrated-players/route.js - SIMPLIFIED OPTA-ONLY VERSION WITH UNIFIED POSITION LOGIC

import { NextResponse } from 'next/server';
import GameweekService from '../../services/gameweekService.js';
import { normalizePosition, debugPlayerPosition } from '../../../utils/positionUtils.js';

// Cache for API responses
let cachedData = null;
let cacheTimestamp = null;
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

/**
 * Safe import wrapper for services
 */
async function importServices() {
  try {
    const [playerMatchingModule, scoringModule] = await Promise.all([
      import('../../services/playerMatchingService.js').catch(() => null),
      import('../../services/scoringConversionService.js').catch(() => null)
    ]);

    const PlayerMatchingService = playerMatchingModule?.PlayerMatchingService;
    const matchingService = PlayerMatchingService ? new PlayerMatchingService() : null;
    const scoringService = scoringModule?.default || scoringModule;

    return {
      matching: matchingService,
      scoring: scoringService,
      available: !!(matchingService && scoringService)
    };
  } catch (error) {
    console.warn('Service import failed:', error.message);
    return { matching: null, scoring: null, available: false };
  }
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
 * Fetch Sleeper data
 */
async function fetchSleeperData() {
  try {
    const leagueId = process.env.SLEEPER_LEAGUE_ID || '1240184286171107328';
    
    const [playersResponse, rostersResponse, usersResponse] = await Promise.all([
      fetch('https://api.sleeper.app/v1/players/clubsoccer:epl'),
      fetch(`https://api.sleeper.app/v1/league/${leagueId}/rosters`),
      fetch(`https://api.sleeper.app/v1/league/${leagueId}/users`)
    ]);

    if (!playersResponse.ok || !rostersResponse.ok || !usersResponse.ok) {
      throw new Error('Failed to fetch Sleeper data');
    }

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
 * Fetch FFH data with enhanced error handling
 */
async function fetchFFHData() {
  try {
    console.log('🔥 Fetching FFH players data...');
    
    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/ffh/players`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: 'player-predictions',
        params: { first: 0, last: 1000 }
      }),
      cache: 'no-store'
    });

    if (!response.ok) {
      console.warn(`FFH API responded with ${response.status}, falling back to Sleeper-only mode`);
      return { players: [], totalPlayers: 0, fallback: true };
    }

    let responseText;
    try {
      responseText = await response.text();
    } catch (error) {
      console.warn('Failed to read FFH response body, falling back to Sleeper-only mode');
      return { players: [], totalPlayers: 0, fallback: true };
    }

    // Clean up potential malformed response
    if (responseText.startsWith('<!DOCTYPE') || responseText.includes('<html>')) {
      console.warn('FFH returned HTML instead of JSON, falling back to Sleeper-only mode');
      return { players: [], totalPlayers: 0, fallback: true };
    }

    let ffhData;
    try {
      // Remove any potential markdown formatting or extra characters
      const cleanResponse = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      ffhData = JSON.parse(cleanResponse);
    } catch (parseError) {
      console.warn('FFH returned malformed JSON, falling back to Sleeper-only mode:', parseError.message);
      return { players: [], totalPlayers: 0, fallback: true };
    }

    if (!ffhData.data || !Array.isArray(ffhData.data)) {
      console.warn('FFH data structure unexpected, falling back to Sleeper-only mode');
      return { players: [], totalPlayers: 0, fallback: true };
    }

    console.log(`✅ FFH data fetched successfully: ${ffhData.data.length} players`);
    
    return {
      players: ffhData.data,
      totalPlayers: ffhData.data.length,
      fallback: false
    };
    
  } catch (error) {
    console.warn('FFH API completely failed, operating in Sleeper-only mode:', error.message);
    return { players: [], totalPlayers: 0, fallback: true };
  }
}

/**
 * UNIFIED SLEEPER POSITION AUTHORITY INTEGRATION
 */
async function integratePlayersWithOptaMatching() {
  console.log('🚀 Starting UNIFIED POSITION integration with Sleeper authority...');
  
  try {
    // Import services
    console.log('🔧 Importing services...');
    const services = await importServices();
    console.log('✅ Services import complete:', { available: services.available });
    
    // Get current gameweek for intelligent prediction handling
    let currentGameweek = null;
    try {
      const gwData = await GameweekService.getCurrentGameweek();
      currentGameweek = gwData.number;
      console.log(`📅 Current gameweek: ${currentGameweek}`);
    } catch (error) {
      console.warn('Could not get current gameweek, using fallback logic:', error.message);
    }
    
    // Fetch data from both sources
    console.log('📡 Fetching data from APIs...');
    const [sleeperData, ffhData] = await Promise.all([
      fetchSleeperData(),
      fetchFFHData()
    ]);

    console.log(`📊 Data fetched - Sleeper: ${sleeperData.totalPlayers}, FFH: ${ffhData.totalPlayers}`);

    // Convert Sleeper players to array
    const sleeperPlayersArray = Object.entries(sleeperData.players).map(([id, player]) => ({
      ...player,
      id,
      name: player.full_name,
      team: player.team_abbr
    }));

    const enhancedPlayers = [];

    // UNIFIED APPROACH: Process each Sleeper player and match with FFH if available
    console.log('🎯 Processing all Sleeper players with unified position authority...');
    
    for (const sleeperPlayer of sleeperPlayersArray) {
      if (!sleeperPlayer.id) continue;
      
      // STEP 1: Get authoritative position from Sleeper (NEVER override this)
      const position = normalizePosition(sleeperPlayer, sleeperPlayer.full_name?.toLowerCase().includes('ederson'));
      
      // STEP 2: Try to find matching FFH player if FFH data is available
      let ffhPlayer = null;
      if (!ffhData.fallback && services.available && services.matching) {
        // Use Opta ID matching for FFH data
        if (sleeperPlayer.opta_id) {
          ffhPlayer = ffhData.players.find(fp => {
            const ffhOptaId = fp.opta_uuid || fp.opta_id || fp.player?.opta_uuid || fp.player?.opta_id;
            return ffhOptaId === sleeperPlayer.opta_id;
          });
        }
      }
      
      // STEP 3: Build enhanced player record with Sleeper position authority
      let enhancedPlayer = {
        player_id: sleeperPlayer.id,
        sleeper_id: sleeperPlayer.id,
        name: sleeperPlayer.full_name || sleeperPlayer.name,
        web_name: sleeperPlayer.last_name || sleeperPlayer.name,
        full_name: sleeperPlayer.full_name || sleeperPlayer.name,
        position: position, // SLEEPER AUTHORITY - never changed
        team: sleeperPlayer.team || sleeperPlayer.team_abbr || 'Unknown',
        team_abbr: sleeperPlayer.team_abbr || sleeperPlayer.team || 'UNK',
        owned_by: sleeperData.ownership[sleeperPlayer.id] || 'Free Agent',
        owner_name: sleeperData.ownership[sleeperPlayer.id] || 'Free Agent',
        is_available: !sleeperData.ownership[sleeperPlayer.id],
        fantasy_positions: sleeperPlayer.fantasy_positions || [position],
        years_exp: sleeperPlayer.years_exp || 0,
        age: sleeperPlayer.age || null,
        
        // Sleeper metadata
        sleeper_position_source: sleeperPlayer.fantasy_positions?.[0] || sleeperPlayer.position || 'unknown',
        sleeper_opta_id: sleeperPlayer.opta_id || '',
        sleeper_rotowire_id: sleeperPlayer.rotowire_id || '',
        sleeper_team_id: sleeperPlayer.team || '',
      };

      // STEP 4: Add FFH predictions if available (position NEVER changes)
      if (ffhPlayer) {
        // Extract FFH predictions using enhanced logic
        const ffhSeasonPrediction = ffhPlayer.season_prediction || 
                                   ffhPlayer.range_prediction || 
                                   ffhPlayer.predicted_pts || 0;
        
        // Use enhanced prediction extraction that handles both arrays
        const allPredictions = extractAllGameweekPredictions(ffhPlayer);
        
        // Store the complete predictions data
        enhancedPlayer.predictions = allPredictions.all;
        enhancedPlayer.upcoming_predictions = allPredictions.upcoming;
        enhancedPlayer.current_predictions = allPredictions.current;
        
        // Build gameweek prediction objects
        const gwPredictions = {};
        const sleeperGwPredictions = {};
        const gwMinutePredictions = {};
        
        allPredictions.all.forEach(pred => {
          if (pred.gw && typeof pred.predicted_pts === 'number') {
            gwPredictions[pred.gw] = pred.predicted_pts;
            // Use SLEEPER position for scoring conversion
            sleeperGwPredictions[pred.gw] = fallbackConvertFFHToSleeper(pred.predicted_pts, position);
            if (pred.predicted_mins) {
              gwMinutePredictions[pred.gw] = pred.predicted_mins;
            }
          }
        });
        
        // Add FFH-derived fields (but position remains from Sleeper)
        enhancedPlayer = {
          ...enhancedPlayer,
          
          // FFH predictions (converted using SLEEPER position)
          ffh_season_prediction: ffhSeasonPrediction,
          ffh_season_avg: ffhSeasonPrediction / 38,
          ffh_gw_predictions: JSON.stringify(gwPredictions),
          sleeper_season_total: fallbackConvertFFHToSleeper(ffhSeasonPrediction, position),
          sleeper_season_avg: Math.round(fallbackConvertFFHToSleeper(ffhSeasonPrediction, position) / 38 * 100) / 100,
          sleeper_gw_predictions: JSON.stringify(sleeperGwPredictions),
          ffh_gw_minutes: JSON.stringify(gwMinutePredictions),
          
          // Enhanced prediction fields for UI
          current_gw_prediction: sleeperGwPredictions[currentGameweek] || 0,
          next_gw_prediction: sleeperGwPredictions[currentGameweek + 1] || 0,
          avg_predicted_minutes: allPredictions.all.length > 0 ? 
            Math.round(allPredictions.all.reduce((sum, p) => sum + (p.predicted_mins || 0), 0) / allPredictions.all.length) : 
            null,
          
          // Stats for UI
          current_ppg: ffhSeasonPrediction > 0 ? Math.round((ffhSeasonPrediction / 38) * 100) / 100 : null,
          predicted_ppg: sleeperGwPredictions[currentGameweek] || 0,
          
          // FFH metadata  
          ffh_matched: true,
          ffh_id: ffhPlayer.fpl_id || ffhPlayer.id,
          ffh_web_name: ffhPlayer.web_name || ffhPlayer.name,
          ffh_team: extractTeamCode(ffhPlayer),
          ffh_position_id: ffhPlayer.position_id,
          
          // Matching metadata
          match_confidence: 'High',
          match_method: 'Opta ID'
        };
      } else {
        // No FFH match - Sleeper only with estimated data
        enhancedPlayer = {
          ...enhancedPlayer,
          
          // Sleeper-only estimates
          ffh_matched: false,
          current_gw_prediction: 0,
          next_gw_prediction: 0,
          current_ppg: null,
          predicted_ppg: 0,
          avg_predicted_minutes: null,
          
          // Empty prediction objects
          ffh_season_prediction: 0,
          ffh_season_avg: 0,
          ffh_gw_predictions: JSON.stringify({}),
          sleeper_season_total: 0,
          sleeper_season_avg: 0,
          sleeper_gw_predictions: JSON.stringify({}),
          ffh_gw_minutes: JSON.stringify({})
        };
      }

      enhancedPlayers.push(enhancedPlayer);
    }

    console.log(`✅ Enhanced ${enhancedPlayers.length} players with unified position authority`);
    
    // Debug log for goalkeepers
    const goalkeepers = enhancedPlayers.filter(p => p.position === 'GKP');
    console.log(`🥅 GOALKEEPERS FOUND: ${goalkeepers.length}`);
    goalkeepers.forEach(gk => {
      console.log(`  ${gk.name} (${gk.team}) - Position: ${gk.position}, Source: ${gk.sleeper_position_source}`);
    });

    return NextResponse.json({
      success: true,
      total: enhancedPlayers.length,
      matched: enhancedPlayers.filter(p => p.ffh_matched).length,
      players: enhancedPlayers,
      timestamp: new Date().toISOString(),
      gameweek: currentGameweek,
      ffh_fallback: ffhData.fallback,
      summary: {
        total_sleeper_players: sleeperPlayersArray.length,
        total_ffh_players: ffhData.totalPlayers,
        matched_players: enhancedPlayers.filter(p => p.ffh_matched).length,
        sleeper_only_players: enhancedPlayers.filter(p => !p.ffh_matched).length,
        position_distribution: {
          GKP: enhancedPlayers.filter(p => p.position === 'GKP').length,
          DEF: enhancedPlayers.filter(p => p.position === 'DEF').length,
          MID: enhancedPlayers.filter(p => p.position === 'MID').length,
          FWD: enhancedPlayers.filter(p => p.position === 'FWD').length
        }
      }
    });

  } catch (error) {
    console.error('Integration failed:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      players: [],
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
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

// Fresh data integration
const result = await integratePlayersWithOptaMatching();

// Cache successful results
if (result.status !== 500) {
  // clone the response so we can consume it without locking
  const clone = result.clone();
  const resultData = await clone.json();
  if (resultData.success) {
    cachedData = resultData;
    cacheTimestamp = Date.now();
    console.log('💾 Data cached successfully');
  }
}

return result;

    
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