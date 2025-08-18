// app/api/integrated-players/route.js
// Fixed to work with your existing services

import { NextResponse } from 'next/server';

// Import from your existing services (match what you actually have)
// We'll use dynamic imports to avoid build errors
// import { matchPlayerWithFFH } from '../../../services/playerMatchingService';
// import { convertPredictions } from '../../../services/scoringConversionService';

// Cache for API responses
let cachedData = null;
let cacheTimestamp = null;
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

/**
 * Dynamic import wrapper to safely import services
 */
async function importServices() {
  try {
    const [matchingService, scoringService] = await Promise.all([
      import('../../../services/playerMatchingService.js'),
      import('../../../services/scoringConversionService.js')
    ]);
    
    return {
      matching: matchingService,
      scoring: scoringService
    };
  } catch (error) {
    console.warn('Could not import services, using fallback methods:', error.message);
    return null;
  }
}

/**
 * Fallback matching function if service import fails
 */
function fallbackFindBestMatch(sleeperPlayer, ffhPlayers) {
  if (!sleeperPlayer.full_name || !ffhPlayers.length) {
    return { player: null, method: 'No Match', confidence: 'None', score: 0 };
  }
  
  const sleeperName = sleeperPlayer.full_name.toLowerCase().replace(/[^a-z\s]/g, '');
  let bestMatch = null;
  let bestScore = 0;
  
  for (const ffhPlayer of ffhPlayers) {
    const ffhName = (ffhPlayer.web_name || ffhPlayer.name || '').toLowerCase().replace(/[^a-z\s]/g, '');
    
    // Simple similarity check
    let score = 0;
    if (sleeperName === ffhName) score = 1.0;
    else if (sleeperName.includes(ffhName) || ffhName.includes(sleeperName)) score = 0.8;
    else {
      // Check if last names match
      const sleeperParts = sleeperName.split(' ');
      const ffhParts = ffhName.split(' ');
      if (sleeperParts.length > 1 && ffhParts.length > 1) {
        const sleeperLast = sleeperParts[sleeperParts.length - 1];
        const ffhLast = ffhParts[ffhParts.length - 1];
        if (sleeperLast === ffhLast) score = 0.6;
      }
    }
    
    if (score > bestScore && score >= 0.4) {
      bestScore = score;
      bestMatch = ffhPlayer;
    }
  }
  
  if (bestMatch) {
    const confidence = bestScore >= 0.8 ? 'High' : bestScore >= 0.6 ? 'Medium' : 'Low';
    return {
      player: bestMatch,
      method: 'Name Similarity',
      confidence,
      score: bestScore
    };
  }
  
  return { player: null, method: 'No Match', confidence: 'None', score: 0 };
}

/**
 * Fallback scoring conversion if service import fails
 */
function fallbackConvertFFHToSleeper(ffhPrediction, position) {
  if (!ffhPrediction) return 0;
  
  // Use your original position multipliers
  const multipliers = {
    'GK': 0.8,
    'DEF': 0.9, 
    'D': 0.9,
    'MID': 1.0,
    'M': 1.0,
    'FWD': 1.1,
    'F': 1.1
  };
  
  const pos = position?.toUpperCase() || 'MID';
  const multiplier = multipliers[pos] || 1.0;
  
  return Math.round(ffhPrediction * multiplier * 100) / 100;
}

/**
 * Fetch Sleeper players and rosters
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
 * Fetch FFH predictions
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
 * Main integration function with smart service loading
 */
async function integratePlayersWithServices() {
  console.log('🚀 Starting enhanced player integration...');
  
  try {
    // Try to load your existing services
    const services = await importServices();
    
    // Fetch data from both sources
    const [sleeperData, ffhData] = await Promise.all([
      fetchSleeperData(),
      fetchFFHData()
    ]);

    console.log(`📊 Data fetched - Sleeper: ${sleeperData.totalPlayers}, FFH: ${ffhData.totalPlayers}`);

    const enhancedPlayers = [];
    const matchingStats = {
      total: 0,
      matched: 0,
      byMethod: { 'Name Similarity': 0, 'No Match': 0 },
      byConfidence: { 'High': 0, 'Medium': 0, 'Low': 0, 'None': 0 }
    };

    // Choose matching function
    const findBestMatch = services?.matching?.findBestMatch || 
                         services?.matching?.matchPlayerWithFFH || 
                         fallbackFindBestMatch;
    
    // Choose conversion function
    const convertFFHToSleeper = services?.scoring?.convertFFHToSleeperPrediction || 
                               services?.scoring?.convertPredictions || 
                               fallbackConvertFFHToSleeper;

    console.log(`🔧 Using ${services ? 'imported' : 'fallback'} services for processing`);

    // Process each Sleeper player
    for (const [playerId, sleeperPlayer] of Object.entries(sleeperData.players)) {
      if (!sleeperPlayer.full_name) continue;
      
      matchingStats.total++;
      
      // Find matching FFH player
      const matchResult = findBestMatch(sleeperPlayer, ffhData.players);
      
      // Base player record
      let enhancedPlayer = {
        player_id: playerId,
        sleeper_id: playerId,
        name: sleeperPlayer.full_name,
        web_name: sleeperPlayer.last_name || sleeperPlayer.full_name,
        full_name: sleeperPlayer.full_name,
        position: sleeperPlayer.position || 
                 (sleeperPlayer.fantasy_positions && sleeperPlayer.fantasy_positions[0]) || 'MID',
        team: sleeperPlayer.team || sleeperPlayer.team_abbr || 'Unknown',
        team_abbr: sleeperPlayer.team_abbr || sleeperPlayer.team || 'UNK',
        owned_by: sleeperData.ownership[playerId] || 'Free Agent',
        owner_name: sleeperData.ownership[playerId] || 'Free Agent',
        is_available: !sleeperData.ownership[playerId],
        fantasy_positions: sleeperPlayer.fantasy_positions || [sleeperPlayer.position || 'MID']
      };

      if (matchResult.player) {
        matchingStats.matched++;
        matchingStats.byMethod[matchResult.method] = (matchingStats.byMethod[matchResult.method] || 0) + 1;
        matchingStats.byConfidence[matchResult.confidence] = (matchingStats.byConfidence[matchResult.confidence] || 0) + 1;
        
        // Extract FFH predictions
        const ffhSeasonPrediction = matchResult.player.season_prediction || 
                                   matchResult.player.range_prediction || 
                                   matchResult.player.predicted_pts || 0;
        
        // Convert to Sleeper scoring
        let sleeperSeasonTotal;
        if (typeof convertFFHToSleeper === 'function') {
          try {
            sleeperSeasonTotal = convertFFHToSleeper(ffhSeasonPrediction, enhancedPlayer.position);
          } catch (error) {
            console.warn('Service conversion failed, using fallback:', error.message);
            sleeperSeasonTotal = fallbackConvertFFHToSleeper(ffhSeasonPrediction, enhancedPlayer.position);
          }
        } else {
          sleeperSeasonTotal = fallbackConvertFFHToSleeper(ffhSeasonPrediction, enhancedPlayer.position);
        }
        
        // Add predictions
        enhancedPlayer.ffh_season_prediction = ffhSeasonPrediction;
        enhancedPlayer.sleeper_season_total = sleeperSeasonTotal;
        enhancedPlayer.sleeper_season_avg = sleeperSeasonTotal / 38;
        enhancedPlayer.match_confidence = matchResult.confidence;
        enhancedPlayer.match_method = matchResult.method;
        enhancedPlayer.ffh_matched = true;
        enhancedPlayer.scoring_conversion_applied = true;
        
        // Add gameweek predictions if available
        if (matchResult.player.predictions && Array.isArray(matchResult.player.predictions)) {
          const gwPredictions = {};
          matchResult.player.predictions.forEach(pred => {
            if (pred.gw && pred.predicted_pts) {
              const pts = typeof pred.predicted_pts === 'object' ? 
                         pred.predicted_pts.predicted_pts : pred.predicted_pts;
              if (typeof pts === 'number') {
                // Convert GW prediction to Sleeper scoring too
                const convertedGwPts = fallbackConvertFFHToSleeper(pts, enhancedPlayer.position);
                gwPredictions[pred.gw] = convertedGwPts;
              }
            }
          });
          enhancedPlayer.sleeper_gw_predictions = JSON.stringify(gwPredictions);
          enhancedPlayer.ffh_gw_predictions = JSON.stringify(gwPredictions); // Keep for compatibility
        }
        
        console.log(`✅ Enhanced ${enhancedPlayer.name}: ${ffhSeasonPrediction} → ${sleeperSeasonTotal} (${matchResult.confidence})`);
        
      } else {
        matchingStats.byMethod['No Match']++;
        matchingStats.byConfidence['None']++;
        
        // Fallback predictions for unmatched players
        const estimatedPoints = { 'GK': 120, 'DEF': 110, 'MID': 90, 'FWD': 100 }[enhancedPlayer.position] || 90;
        enhancedPlayer.sleeper_season_total = estimatedPoints;
        enhancedPlayer.sleeper_season_avg = estimatedPoints / 38;
        enhancedPlayer.ffh_season_prediction = 0;
        enhancedPlayer.match_confidence = 'None';
        enhancedPlayer.ffh_matched = false;
        enhancedPlayer.scoring_conversion_applied = false;
      }
      
      enhancedPlayers.push(enhancedPlayer);
    }

    // Calculate final statistics
    const finalStats = {
      ...matchingStats,
      matchRate: matchingStats.total > 0 ? 
        Math.round((matchingStats.matched / matchingStats.total) * 100) : 0
    };

    console.log('📈 Integration complete:', finalStats);

    return {
      success: true,
      players: enhancedPlayers,
      integration: { matchingStats: finalStats },
      quality: { 
        matchingQuality: `${finalStats.matchRate}%`,
        completenessScore: 100 
      },
      source: 'integrated-enhanced',
      enhanced: true,
      usingServices: !!services,
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

    console.log('🔄 Enhanced integration request:', { forceRefresh, clearCache });

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
    const result = await integratePlayersWithServices();

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
 * GET handler for backwards compatibility
 */
export async function GET() {
  console.log('🔄 GET request received, redirecting to POST logic');
  
  const mockRequest = {
    json: () => Promise.resolve({ forceRefresh: false })
  };
  
  return POST(mockRequest);
}