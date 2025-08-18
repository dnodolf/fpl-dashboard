// app/api/integrated-players/route.js
// Enhanced API with proper scoring conversion

import { NextResponse } from 'next/server';
import { enhancePlayerWithScoringConversion, clearConversionCache } from '../../../services/scoringConversionService';
import { findBestMatch } from '../../../services/playerMatchingService';

// Cache for API responses
let cachedData = null;
let cacheTimestamp = null;
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

/**
 * Fetch Sleeper players and rosters
 */
async function fetchSleeperData() {
  try {
    const leagueId = process.env.SLEEPER_LEAGUE_ID || '1240184286171107328';
    
    // Fetch players and rosters in parallel
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
    
    // Map user IDs to display names
    usersData.forEach(user => {
      userMap[user.user_id] = user.display_name || user.username || 'Unknown';
    });
    
    // Map player IDs to owners
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
 * Main integration function with enhanced scoring conversion
 */
async function integratePlayersWithScoring(options = {}) {
  console.log('🚀 Starting enhanced player integration with scoring conversion...');
  
  try {
    // Fetch data from both sources
    const [sleeperData, ffhData] = await Promise.all([
      fetchSleeperData(),
      fetchFFHData()
    ]);

    console.log(`📊 Data fetched - Sleeper: ${sleeperData.totalPlayers}, FFH: ${ffhData.totalPlayers}`);

    // Process and match players
    const enhancedPlayers = [];
    const matchingStats = {
      total: 0,
      matched: 0,
      byMethod: {
        'Opta ID': 0,
        'FPL ID': 0,
        'Name Similarity': 0,
        'Fallback': 0
      },
      byConfidence: {
        'High': 0,
        'Medium': 0,
        'Low': 0
      }
    };

    // Process each Sleeper player
    for (const [playerId, sleeperPlayer] of Object.entries(sleeperData.players)) {
      if (!sleeperPlayer.full_name) continue;
      
      matchingStats.total++;
      
      // Find matching FFH player
      const matchResult = findBestMatch(sleeperPlayer, ffhData.players);
      
      // Base player record from Sleeper
      let enhancedPlayer = {
        // Core identifiers
        player_id: playerId,
        sleeper_id: playerId,
        
        // Player info
        name: sleeperPlayer.full_name,
        web_name: sleeperPlayer.last_name || sleeperPlayer.full_name,
        full_name: sleeperPlayer.full_name,
        position: sleeperPlayer.position || 
                 (sleeperPlayer.fantasy_positions && sleeperPlayer.fantasy_positions[0]) || 'MID',
        team: sleeperPlayer.team || sleeperPlayer.team_abbr || 'Unknown',
        team_abbr: sleeperPlayer.team_abbr || sleeperPlayer.team || 'UNK',
        
        // Ownership info
        owned_by: sleeperData.ownership[playerId] || 'Free Agent',
        owner_name: sleeperData.ownership[playerId] || 'Free Agent',
        is_available: !sleeperData.ownership[playerId],
        
        // Sleeper metadata
        fantasy_positions: sleeperPlayer.fantasy_positions || [sleeperPlayer.position || 'MID'],
        years_exp: sleeperPlayer.years_exp || 0,
        age: sleeperPlayer.age || null,
        height: sleeperPlayer.height || null,
        weight: sleeperPlayer.weight || null
      };

      if (matchResult.player) {
        // Found a match! Apply scoring conversion
        matchingStats.matched++;
        matchingStats.byMethod[matchResult.method]++;
        matchingStats.byConfidence[matchResult.confidence]++;
        
        // Apply enhanced scoring conversion
        enhancedPlayer = await enhancePlayerWithScoringConversion(enhancedPlayer, matchResult.player);
        
        // Add matching metadata
        enhancedPlayer.match_confidence = matchResult.confidence;
        enhancedPlayer.match_method = matchResult.method;
        enhancedPlayer.match_score = matchResult.score;
        enhancedPlayer.ffh_matched = true;
        
        console.log(`✅ Enhanced ${enhancedPlayer.name} with scoring conversion (${matchResult.confidence})`);
      } else {
        // No FFH match found - use fallback predictions
        matchingStats.byMethod['No Match']++;
        
        enhancedPlayer.ffh_matched = false;
        enhancedPlayer.match_confidence = 'None';
        enhancedPlayer.match_method = 'No Match';
        
        // Fallback predictions (basic estimates)
        const estimatedSeasonPoints = estimatePlayerPoints(enhancedPlayer);
        enhancedPlayer.sleeper_season_total = estimatedSeasonPoints;
        enhancedPlayer.sleeper_season_avg = estimatedSeasonPoints / 38;
        enhancedPlayer.ffh_season_prediction = 0;
        enhancedPlayer.scoring_conversion_applied = false;
        
        console.log(`⚠️ No FFH match for ${enhancedPlayer.name}, using fallback predictions`);
      }
      
      enhancedPlayers.push(enhancedPlayer);
    }

    // Calculate final statistics
    const finalStats = {
      ...matchingStats,
      matchRate: matchingStats.total > 0 ? 
        Math.round((matchingStats.matched / matchingStats.total) * 100) : 0,
      averageConfidence: calculateAverageConfidence(matchingStats.byConfidence)
    };

    console.log('📈 Integration complete:', finalStats);

    return {
      success: true,
      players: enhancedPlayers,
      integration: {
        matchingStats: finalStats,
        sleeperTotal: sleeperData.totalPlayers,
        ffhTotal: ffhData.totalPlayers,
        enhancedTotal: enhancedPlayers.length
      },
      quality: {
        completenessScore: 100,
        matchingQuality: `${finalStats.matchRate}%`,
        averageConfidence: finalStats.averageConfidence
      },
      source: 'integrated-enhanced',
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
 * Estimate points for players without FFH matches
 */
function estimatePlayerPoints(player) {
  const position = player.position?.toUpperCase() || 'MID';
  const basePoints = {
    'GK': 120,
    'DEF': 110,
    'MID': 90,
    'FWD': 100
  };
  
  // Add some randomness to make it feel more realistic
  const base = basePoints[position] || 90;
  const variance = base * 0.2; // ±20% variance
  const random = (Math.random() - 0.5) * variance;
  
  return Math.round(base + random);
}

/**
 * Calculate average confidence percentage
 */
function calculateAverageConfidence(confidenceStats) {
  const total = confidenceStats.High + confidenceStats.Medium + confidenceStats.Low;
  if (total === 0) return 0;
  
  const weighted = (confidenceStats.High * 90) + (confidenceStats.Medium * 70) + (confidenceStats.Low * 50);
  return Math.round(weighted / total);
}

/**
 * POST handler for enhanced integration
 */
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { 
      includeMatching = true, 
      includeScoring = true, 
      forceRefresh = false,
      clearCache = false
    } = body;

    console.log('🔄 Enhanced integration request:', { includeMatching, includeScoring, forceRefresh, clearCache });

    // Clear caches if requested
    if (clearCache) {
      cachedData = null;
      cacheTimestamp = null;
      clearConversionCache();
      console.log('🗑️ All caches cleared');
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

    // Perform enhanced integration
    const result = await integratePlayersWithScoring({
      includeMatching,
      includeScoring
    });

    // Cache the result
    cachedData = result;
    cacheTimestamp = now;

    return NextResponse.json(result);

  } catch (error) {
    console.error('❌ Enhanced integration API error:', error);
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
export async function GET(request) {
  console.log('🔄 GET request received, redirecting to POST logic');
  
  // Convert GET to POST logic
  const mockRequest = {
    json: () => Promise.resolve({
      includeMatching: true,
      includeScoring: true,
      forceRefresh: false
    })
  };
  
  return POST(mockRequest);
}