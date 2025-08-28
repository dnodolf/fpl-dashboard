// app/api/integrated-players/route.js - SIMPLIFIED OPTA-ONLY VERSION WITH FFH GAMEWEEK FIX

import { NextResponse } from 'next/server';
import GameweekService from '../../services/gameweekService.js';

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
        if (typeof pts === 'number') {
          allPredictions.set(pred.gw, {
            gw: pred.gw,
            predicted_pts: pts,
            predicted_mins: pred.xmins || pred.predicted_mins || 0,
            source: 'predictions',
            opp: pred.opp,
            capt: pred.capt,
            status: pred.status,
            fitness: pred.fitness
          });
        }
      }
    });
  }
  
  // Step 2: Process the 'results' array (current/completed gameweeks)
  // ONLY process season 2025 results - ignore previous seasons
  // This will OVERWRITE predictions array data for the same gameweek (results are more current)
  if (ffhPlayer.results && Array.isArray(ffhPlayer.results)) {
    ffhPlayer.results.forEach(result => {
      // FILTER: Only process season 2025 results
      if (result.season !== 2025) {
        return; // Skip results from previous seasons
      }
      
      if (result.gw && result.predicted_pts) {
        const prediction = result.predicted_pts;
        let pts = null;
        let mins = null;
        
        // Handle different prediction formats in results
        if (typeof prediction === 'object') {
          pts = prediction.predicted_pts;
          mins = prediction.predicted_mins || 0;
        } else {
          pts = prediction;
          mins = 0;
        }
        
        if (typeof pts === 'number') {
          allPredictions.set(result.gw, {
            gw: result.gw,
            predicted_pts: pts,
            predicted_mins: mins,
            source: 'results',
            season: result.season, // Track season for filtering
            opp: result.opp,
            actual_pts: result.actual_pts,
            mins: result.mins,
            injured: result.injured,
            in_squad: result.in_squad,
            suspended: result.suspended
          });
        }
      }
    });
  }
  
  // Step 3: Convert Map back to arrays for different use cases
  const combinedPredictions = Array.from(allPredictions.values()).sort((a, b) => a.gw - b.gw);
  
  return {
    all: combinedPredictions,
    upcoming: combinedPredictions.filter(p => p.source === 'predictions'),
    current: combinedPredictions.filter(p => p.source === 'results' && p.season === 2025),
    byGameweek: Object.fromEntries(allPredictions)
  };
}

/**
 * Extract team from FFH player data
 */
function extractFFHTeam(ffhPlayer) {
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
    'GK': 0.8, 'GKP': 0.8,
    'DEF': 0.9, 'D': 0.9,
    'MID': 1.0, 'M': 1.0,
    'FWD': 1.1, 'F': 1.1
  };
  
  const pos = position?.toUpperCase() || 'MID';
  const multiplier = multipliers[pos] || 1.0;
  
  return Math.round(ffhPrediction * multiplier * 100) / 100;
}

/**
 * Normalize position - PRIORITIZES SLEEPER DATA FIRST
 */
function normalizePosition(player) {
  // Priority 1: Sleeper fantasy_positions (most authoritative)
  if (player.fantasy_positions && Array.isArray(player.fantasy_positions)) {
    const pos = player.fantasy_positions[0];
    if (pos === 'G') return 'GKP';
    if (pos === 'D') return 'DEF';
    if (pos === 'M') return 'MID';
    if (pos === 'F') return 'FWD';
  }
  
  // Priority 2: Sleeper position string
  if (player.position) {
    const pos = player.position.toString().toUpperCase();
    if (pos === 'G' || pos.includes('GK') || pos.includes('KEEPER')) return 'GKP';
    if (pos === 'D' || pos.includes('DEF')) return 'DEF';
    if (pos === 'M' || pos.includes('MID')) return 'MID';
    if (pos === 'F' || pos.includes('FWD') || pos.includes('FORWARD')) return 'FWD';
  }
  
  // Priority 3: FFH position_id (fallback only)
  if (player.position_id) {
    const positions = { 1: 'GKP', 2: 'DEF', 3: 'MID', 4: 'FWD' };
    return positions[player.position_id] || 'MID';
  }
  
  return 'MID';
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
 * Fetch FFH data
 */
async function fetchFFHData() {
  try {
    const baseUrl = 'https://data.fantasyfootballhub.co.uk/api/player-predictions/';
    const params = new URLSearchParams({
      orderBy: 'points',
      focus: 'range',
      positions: '1,2,3,4',
      min_cost: '40',
      max_cost: '145',
      search_term: '',
      gw_start: '1',
      gw_end: '47',
      first: '0',
      last: '99999',
      use_predicted_fixtures: 'false',
      selected_players: ''
    });

    const response = await fetch(`${baseUrl}?${params}`, {
      headers: {
        'Accept-Language': 'en-US',
        'Authorization': process.env.FFH_AUTH_STATIC || 'r5C(e3.JeS^:_7LF',
        'Content-Type': 'application/json',
        'Token': process.env.FFH_BEARER_TOKEN || ''
      }
    });

    if (!response.ok) {
      throw new Error(`FFH API failed: ${response.status}`);
    }

    const data = await response.json();
    return {
      players: data.results || data || [],
      totalPlayers: (data.results || data || []).length
    };
  } catch (error) {
    console.error('Error fetching FFH data:', error);
    throw error;
  }
}

/**
 * Main integration function - SIMPLIFIED WITH FFH GAMEWEEK FIX
 */
async function integratePlayersWithOptaMatching() {
  console.log('🚀 Starting OPTA-ONLY integration with FFH gameweek fix...');
  
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

    console.log('🎯 Starting OPTA-ONLY matching...');
    console.log(`📊 Processing ${sleeperPlayersArray.length} Sleeper vs ${ffhData.players.length} FFH players`);

    let matchResults = [];
    let optaAnalysis = null;
    
    if (services.available && services.matching) {
      try {
        const matchingResult = await services.matching.matchAllPlayers(sleeperPlayersArray, ffhData.players);
        matchResults = matchingResult.matches || [];
        optaAnalysis = matchingResult.optaAnalysis;
        console.log(`✅ Opta-only matching: ${matchResults.length} players matched`);
      } catch (serviceError) {
        console.error('Matching service failed:', serviceError.message);
        throw serviceError;
      }
    } else {
      throw new Error('Matching service not available');
    }

    const enhancedPlayers = [];

    // Process each matched result
    for (const matchResult of matchResults) {
      const { sleeperPlayer, ffhPlayer, confidence, method } = matchResult;
      
      if (!sleeperPlayer.id) continue;
      
    // FORCE SLEEPER POSITION - DO NOT LET FFH OVERRIDE
    const position = sleeperPlayer.fantasy_positions?.[0] === 'M' ? 'MID' :
        sleeperPlayer.fantasy_positions?.[0] === 'F' ? 'FWD' :
        sleeperPlayer.fantasy_positions?.[0] === 'D' ? 'DEF' :
        sleeperPlayer.fantasy_positions?.[0] === 'G' ? 'GKP' :
        'MID'; // Default  
            
      // Base player record
      let enhancedPlayer = {
        player_id: sleeperPlayer.id,
        sleeper_id: sleeperPlayer.id,
        name: sleeperPlayer.full_name || sleeperPlayer.name,
        web_name: sleeperPlayer.last_name || sleeperPlayer.name,
        full_name: sleeperPlayer.full_name || sleeperPlayer.name,
        position: position,
        team: sleeperPlayer.team || sleeperPlayer.team_abbr || 'Unknown',
        team_abbr: sleeperPlayer.team_abbr || sleeperPlayer.team || 'UNK',
        owned_by: sleeperData.ownership[sleeperPlayer.id] || 'Free Agent',
        owner_name: sleeperData.ownership[sleeperPlayer.id] || 'Free Agent',
        is_available: !sleeperData.ownership[sleeperPlayer.id],
        fantasy_positions: sleeperPlayer.fantasy_positions || [position],
        years_exp: sleeperPlayer.years_exp || 0,
        age: sleeperPlayer.age || null
      };

      if (ffhPlayer) {
        // Extract FFH predictions
        const ffhSeasonPrediction = ffhPlayer.season_prediction || 
                                   ffhPlayer.range_prediction || 
                                   ffhPlayer.predicted_pts || 0;
        
        // NEW: Use enhanced prediction extraction that handles both arrays
        const allPredictions = extractAllGameweekPredictions(ffhPlayer);
        
        // Store the complete predictions data for compatibility
        enhancedPlayer.predictions = allPredictions.all;
        enhancedPlayer.upcoming_predictions = allPredictions.upcoming;
        enhancedPlayer.current_predictions = allPredictions.current;
        
        // Build gameweek prediction objects (existing functionality preserved)
        const gwPredictions = {};
        const sleeperGwPredictions = {};
        const gwMinutePredictions = {};
        
        allPredictions.all.forEach(pred => {
          if (pred.gw && typeof pred.predicted_pts === 'number') {
            gwPredictions[pred.gw] = pred.predicted_pts;
            sleeperGwPredictions[pred.gw] = fallbackConvertFFHToSleeper(pred.predicted_pts, position);
            if (pred.predicted_mins) {
              gwMinutePredictions[pred.gw] = pred.predicted_mins;
            }
          }
        });
        
        enhancedPlayer.ffh_gw_predictions = JSON.stringify(gwPredictions);
        enhancedPlayer.sleeper_gw_predictions = JSON.stringify(sleeperGwPredictions);
        enhancedPlayer.ffh_gw_minutes = JSON.stringify(gwMinutePredictions);
        
        // Calculate next 5 gameweeks intelligently
        // Prioritize upcoming gameweeks, then current ones, sorted by gameweek number
        const next5 = [...allPredictions.upcoming, ...allPredictions.current]
          .sort((a, b) => a.gw - b.gw)
          .slice(0, 5);
        
        if (next5.length > 0) {
          const totalMinutes = next5.reduce((total, pred) => total + (pred.predicted_mins || 0), 0);
          enhancedPlayer.avg_minutes_next5 = totalMinutes / next5.length;
        }
        
        // Store current gameweek prediction for optimizer use
        // Use GameweekService to get the exact current gameweek, then find that prediction
        const currentPrediction = currentGameweek && allPredictions.byGameweek[currentGameweek] ? 
          allPredictions.byGameweek[currentGameweek] : 
          (allPredictions.current.length > 0 ? 
            allPredictions.current.find(p => p.gw === currentGameweek) || 
            allPredictions.current[allPredictions.current.length - 1] : 
            null);
        
        if (currentPrediction) {
          enhancedPlayer.current_gameweek_prediction = {
            gw: currentPrediction.gw,
            predicted_pts: currentPrediction.predicted_pts,
            predicted_mins: currentPrediction.predicted_mins,
            source: currentPrediction.source
          };
        }
        
        // Extract PPG data from FFH player (existing code continues unchanged)
        if (ffhPlayer.player && ffhPlayer.player.form_data && typeof ffhPlayer.player.form_data.ppg === 'number') {
          enhancedPlayer.current_ppg = ffhPlayer.player.form_data.ppg;
        }
        
        // Extract predicted season PPG (existing code continues unchanged)
        if (typeof ffhPlayer.season_prediction_avg === 'number') {
          enhancedPlayer.predicted_ppg = ffhPlayer.season_prediction_avg;
        }
        
        // Apply scoring conversion
        let sleeperSeasonTotal;
        if (services.available && services.scoring?.enhancePlayerWithScoringConversion) {
          try {
            const enhanced = await services.scoring.enhancePlayerWithScoringConversion(enhancedPlayer, ffhPlayer);
            sleeperSeasonTotal = enhanced.sleeper_season_total;
            enhancedPlayer = { ...enhancedPlayer, ...enhanced };
          } catch (conversionError) {
            console.warn('Scoring service failed, using fallback:', conversionError.message);
            sleeperSeasonTotal = fallbackConvertFFHToSleeper(ffhSeasonPrediction, position);
          }
        } else {
          sleeperSeasonTotal = fallbackConvertFFHToSleeper(ffhSeasonPrediction, position);
        }
        
        // Ensure we have the essential predictions
        if (!enhancedPlayer.sleeper_season_total) {
          enhancedPlayer.sleeper_season_total = sleeperSeasonTotal;
          enhancedPlayer.sleeper_season_avg = sleeperSeasonTotal / 38;
          enhancedPlayer.ffh_season_prediction = ffhSeasonPrediction;
        }
        
        // Add matching metadata
        enhancedPlayer.match_confidence = confidence;
        enhancedPlayer.match_method = method;
        enhancedPlayer.ffh_matched = true;
        enhancedPlayer.scoring_conversion_applied = true;
        enhancedPlayer.sleeper_conversion_ratio = fallbackConvertFFHToSleeper(1, position);
        
        // FFH metadata
        enhancedPlayer.ffh_id = ffhPlayer.fpl_id || ffhPlayer.id;
        enhancedPlayer.ffh_web_name = ffhPlayer.web_name || ffhPlayer.name;
        enhancedPlayer.ffh_team = extractFFHTeam(ffhPlayer);
        enhancedPlayer.ffh_position_id = ffhPlayer.position_id;
        
        // Enhanced logging to show which array was used for predictions
        const predictionSource = currentPrediction ? `${currentPrediction.source} (GW${currentPrediction.gw})` : 'none';
        console.log(`✅ Enhanced ${enhancedPlayer.name} (${position}): ${ffhSeasonPrediction} → ${enhancedPlayer.sleeper_season_total} pts, Prediction source: ${predictionSource}, Avg Mins: ${enhancedPlayer.avg_minutes_next5 || 'N/A'}, PPG: ${enhancedPlayer.current_ppg || 'N/A'} → ${enhancedPlayer.predicted_ppg || 'N/A'}`);
      }
      
      enhancedPlayer.position = position;

      enhancedPlayers.push(enhancedPlayer);
    }

    // Calculate final statistics
    const finalStats = {
      total: sleeperPlayersArray.length,
      matched: enhancedPlayers.length,
      matchRate: enhancedPlayers.length > 0 ? Math.round((enhancedPlayers.length / sleeperPlayersArray.length) * 100) : 0,
      byMethod: { 'Opta ID': enhancedPlayers.length },
      byConfidence: { 'High': enhancedPlayers.length }
    };

    console.log('📈 OPTA-ONLY Integration complete with FFH gameweek fix:', finalStats);

    return {
      success: true,
      players: enhancedPlayers,
      integration: {
        matchingStats: finalStats,
        sleeperTotal: sleeperData.totalPlayers,
        ffhTotal: ffhData.totalPlayers,
        enhancedTotal: enhancedPlayers.length,
        servicesUsed: services.available,
        currentGameweek: currentGameweek,
        optaAnalysis // Include the detailed Opta analysis
      },
      quality: {
        completenessScore: 100,
        matchingQuality: `${Math.round((enhancedPlayers.length / ffhData.totalPlayers) * 100)}%`,
        scoringConversion: services.available ? 'Sophisticated service' : 'Fallback multipliers'
      },
      source: 'opta-only-integrated-with-gameweek-fix',
      enhanced: true,
      lastUpdated: new Date().toISOString(),
      fromCache: false
    };
    
  } catch (error) {
    console.error('❌ Integration failed:', error);
    throw error;
  }
}

/**
 * POST handler
 */
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { forceRefresh = false, clearCache = false } = body;

    console.log('🔄 OPTA-ONLY Integration request with FFH gameweek fix:', { forceRefresh, clearCache });

    if (clearCache) {
      cachedData = null;
      cacheTimestamp = null;
      console.log('🗑️ Cache cleared');
    }

    // Check cache
    const now = Date.now();
    if (!forceRefresh && cachedData && cacheTimestamp && (now - cacheTimestamp) < CACHE_DURATION) {
      console.log('⚡ Serving from cache');
      return NextResponse.json({
        ...cachedData,
        fromCache: true,
        cacheAge: Math.round((now - cacheTimestamp) / 1000)
      });
    }

    // Perform integration
    const result = await integratePlayersWithOptaMatching();

    // Cache the result
    cachedData = result;
    cacheTimestamp = now;

    return NextResponse.json(result);

  } catch (error) {
    console.error('❌ Integration API error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      players: [],
      source: 'error',
      lastUpdated: new Date().toISOString()
    }, { status: 500 });
  }
}

/**
 * GET handler
 */
export async function GET() {
  console.log('🔄 GET request received, redirecting to POST logic');
  
  const mockRequest = {
    json: () => Promise.resolve({ forceRefresh: false })
  };
  
  return POST(mockRequest);
}