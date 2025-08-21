// app/api/integrated-players/route.js
// Fixed import paths to match your actual file structure

import { NextResponse } from 'next/server';

// Cache for API responses
let cachedData = null;
let cacheTimestamp = null;
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

/**
 * Safe import wrapper for your services
 */
async function importYourServices() {
  try {
    // FIXED: Corrected import paths to match your actual file structure
    const [playerMatchingModule, scoringModule] = await Promise.all([
      import('../../services/playerMatchingService.js').catch(() => null),
      import('../../services/scoringConversionService.js').catch(() => null)
    ]);

    // Your playerMatchingService uses export class
    const PlayerMatchingService = playerMatchingModule?.PlayerMatchingService;
    const matchingService = PlayerMatchingService ? new PlayerMatchingService() : null;

    // Your scoringConversionService uses module.exports  
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

// ✅ FIXED: Add this helper function to your integrated-players/route.js
// Place this before the integratePlayersWithYourServices function

function extractFFHTeam(ffhPlayer) {
  // Handle different possible team data structures
  if (ffhPlayer.team?.code_name) {
    return ffhPlayer.team.code_name;
  }
  if (ffhPlayer.team_short_name) {
    return ffhPlayer.team_short_name;
  }
  if (ffhPlayer.club) {
    return ffhPlayer.club;
  }
  if (ffhPlayer.team) {
    return ffhPlayer.team;
  }
  return null;
}

/**
 * Fallback matching function using your algorithm logic
 */
// ✅ FIXED: Update the fallbackFindBestMatch function 
// Replace the existing team comparison section with this:

function fallbackFindBestMatch(sleeperPlayer, ffhPlayers) {
  if (!sleeperPlayer?.full_name && !sleeperPlayer?.name) {
    return { player: null, method: 'No Match', confidence: 'None', score: 0 };
  }

  const sleeperName = (sleeperPlayer.full_name || sleeperPlayer.name || '').toLowerCase().trim();
  let bestMatch = null;
  let bestScore = 0;
  let bestMethod = 'No Match';

  for (const ffhPlayer of ffhPlayers) {
    const ffhName = (ffhPlayer.web_name || ffhPlayer.name || '').toLowerCase().trim();
    
    // Enhanced similarity calculation
    let score = 0;
    let method = 'Name Similarity';
    
    // Exact match
    if (sleeperName === ffhName) {
      score = 1.0;
      method = 'Exact Name Match';
    }
    // Substring match
    else if (sleeperName.includes(ffhName) || ffhName.includes(sleeperName)) {
      score = 0.8;
      method = 'Name Substring';
    }
    // Word overlap
    else {
      const sleeperWords = sleeperName.split(' ').filter(w => w.length > 2);
      const ffhWords = ffhName.split(' ').filter(w => w.length > 2);
      
      let matches = 0;
      for (const sWord of sleeperWords) {
        for (const fWord of ffhWords) {
          if (sWord === fWord) matches++;
          else if (sWord.includes(fWord) || fWord.includes(sWord)) matches += 0.7;
        }
      }
      
      if (sleeperWords.length > 0 && ffhWords.length > 0) {
        score = matches / Math.max(sleeperWords.length, ffhWords.length);
      }
      method = 'Word Overlap';
    }
    
    // ✅ FIXED: Team boost with better team extraction
    const sleeperTeam = (sleeperPlayer.team_abbr || sleeperPlayer.team || '').toUpperCase();
    const ffhTeam = extractFFHTeam(ffhPlayer)?.toUpperCase();
    
    if (sleeperTeam && ffhTeam && sleeperTeam === ffhTeam) {
      score = Math.min(score + 0.2, 1.0);
      method = method + ' + Team';
    }
    
    // Lowered threshold to match your relaxed service (0.4 instead of 0.7)
    if (score > bestScore && score >= 0.4) {
      bestScore = score;
      bestMatch = ffhPlayer;
      bestMethod = method;
    }
  }

  if (bestMatch) {
    const confidence = bestScore >= 0.85 ? 'High' : bestScore >= 0.65 ? 'Medium' : 'Low';
    return {
      player: bestMatch,
      method: bestMethod,
      confidence,
      score: bestScore
    };
  }

  return { player: null, method: 'No Match', confidence: 'None', score: 0 };
}

/**
 * Fallback scoring conversion using your original multipliers
 */
function fallbackConvertFFHToSleeper(ffhPrediction, position) {
  if (!ffhPrediction || ffhPrediction <= 0) return 0;
  
  // Your original position-specific multipliers
  const multipliers = {
    'GK': 0.8,    // Goalkeepers less affected
    'GKP': 0.8,
    'DEF': 0.9,   // Defenders moderately affected  
    'D': 0.9,
    'MID': 1.0,   // Midfielders baseline
    'M': 1.0,
    'FWD': 1.1,   // Forwards most affected
    'F': 1.1
  };
  
  const pos = position?.toUpperCase() || 'MID';
  const multiplier = multipliers[pos] || 1.0;
  
  return Math.round(ffhPrediction * multiplier * 100) / 100;
}

/**
 * Extract position from various data formats (from your service)
 */
// ✅ FIXED: Update the normalizePosition function in your integrated-players route
// Replace the existing normalizePosition function with this improved version

function normalizePosition(player) {
  // From FFH position_id
  if (player.position_id) {
    const positions = { 1: 'GKP', 2: 'DEF', 3: 'MID', 4: 'FWD' };
    return positions[player.position_id] || 'MID';
  }
  
  // From Sleeper fantasy_positions
  if (player.fantasy_positions && Array.isArray(player.fantasy_positions)) {
    const pos = player.fantasy_positions[0];
    if (pos === 'G') return 'GKP';
    if (pos === 'D') return 'DEF';  // ✅ FIXED: Chris Richards case
    if (pos === 'M') return 'MID';
    if (pos === 'F') return 'FWD';
  }
  
  // From position string
  if (player.position) {
    const pos = player.position.toString().toUpperCase();
    if (pos.includes('GK') || pos.includes('KEEPER')) return 'GKP';
    if (pos.includes('DEF') || pos === 'D') return 'DEF';  // ✅ FIXED: Handle 'D'
    if (pos.includes('MID') || pos === 'M') return 'MID';
    if (pos.includes('FWD') || pos === 'F' || pos.includes('FORWARD')) return 'FWD';
  }
  
  return 'MID'; // Default fallback
}

/**
 * Fetch Sleeper data (same as before)
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
 * Fetch FFH data (same as before)
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
 * Main integration function using your services
 */
async function integratePlayersWithYourServices() {
  console.log('🚀 Starting integration with your existing services...');
  
  try {
    // Import your services
    console.log('🔧 Importing services...');
    const services = await importYourServices();
    console.log('✅ Services import complete:', { available: services.available });
    
    // Fetch data from both sources
    console.log('📡 Fetching data from APIs...');
    const [sleeperData, ffhData] = await Promise.all([
      fetchSleeperData(),
      fetchFFHData()
    ]);

    console.log(`📊 Data fetched - Sleeper: ${sleeperData.totalPlayers}, FFH: ${ffhData.totalPlayers}`);
    console.log(`🔧 Services available: ${services.available ? 'Yes' : 'No (using fallbacks)'}`);

    // ✅ DEBUG: Check if Chris Richards is in Sleeper data
    const chrisRichards = Object.entries(sleeperData.players).find(([id, player]) => 
      player.full_name === 'Chris Richards' || id === '2168'
    );
    if (chrisRichards) {
      console.log('🔍 DEBUG: Found Chris Richards in Sleeper data:');
      console.log('- ID:', chrisRichards[0]);
      console.log('- Data:', JSON.stringify(chrisRichards[1], null, 2));
    } else {
      console.log('❌ DEBUG: Chris Richards NOT found in Sleeper data!');
      // Log a few sample players to see the structure
      const samplePlayers = Object.entries(sleeperData.players).slice(0, 3);
      console.log('📝 Sample Sleeper players:', samplePlayers.map(([id, p]) => ({ id, name: p.full_name, team: p.team_abbr })));
    }

    // ✅ DEBUG: Check if Chris Richards equivalent is in FFH data
    const ffhRichards = ffhData.players.find(player => 
      player.web_name === 'Richards' && 
      (player.team?.code_name === 'CRY' || player.club === 'Crystal Palace')
    );
    if (ffhRichards) {
      console.log('🔍 DEBUG: Found Richards in FFH data:');
      console.log('- Name:', ffhRichards.web_name);
      console.log('- Team:', ffhRichards.team);
      console.log('- Club:', ffhRichards.club);
      console.log('- FPL ID:', ffhRichards.fpl_id);
      console.log('- Predictions:', ffhRichards.predictions ? ffhRichards.predictions.length : 'NONE');
    } else {
      console.log('❌ DEBUG: Richards NOT found in FFH data!');
      // Log a few Crystal Palace players
      const cryPlayers = ffhData.players.filter(p => 
        p.team?.code_name === 'CRY' || p.club === 'Crystal Palace'
      ).slice(0, 5);
      console.log('📝 Sample CRY players:', cryPlayers.map(p => ({ name: p.web_name, team: p.team, club: p.club })));
    }

    const enhancedPlayers = [];
    const matchingStats = {
      total: 0,
      matched: 0,
      byMethod: { 'Name Similarity': 0, 'Name + Team': 0, 'No Match': 0 },
      byConfidence: { 'High': 0, 'Medium': 0, 'Low': 0, 'None': 0 }
    };

    // Convert Sleeper players to array for your service
    const sleeperPlayersArray = Object.entries(sleeperData.players).map(([id, player]) => ({
      ...player,
      id,
      name: player.full_name,
      team: player.team_abbr
    }));

    // ✅ DEBUG: Check Chris Richards in the array
const chrisInArray = sleeperPlayersArray.find(p => 
  p.id === '2168' || (p.name && p.name.toLowerCase().includes('chris richards'))
);

console.log('🔍 CHRIS RICHARDS IN ARRAY:', !!chrisInArray);
if (chrisInArray) {
  console.log('- Array Data:', JSON.stringify(chrisInArray, null, 2));
} else {
  console.log('❌ Chris Richards NOT in sleeperPlayersArray!');
  
  // Check raw data
  const chrisRaw = Object.entries(sleeperData.players).find(([id, player]) => 
    id === '2168' || player.full_name === 'Chris Richards'
  );
  if (chrisRaw) {
    console.log('- Raw Chris:', { id: chrisRaw[0], name: chrisRaw[1].full_name, team: chrisRaw[1].team_abbr });
  }
}

    console.log('🔄 Starting player matching process...');
    console.log(`📊 Processing ${sleeperPlayersArray.length} Sleeper players against ${ffhData.players.length} FFH players`);

    let matchResults = [];
    
if (services.available && services.matching) {
  // Use your enhanced matching service
  console.log('🎯 Using your PlayerMatchingService...');
  try {
    const matchingResult = await services.matching.matchAllPlayers(sleeperPlayersArray, ffhData.players, true);
    matchResults = matchingResult.matches || [];
    console.log(`✅ Your service matched: ${matchResults.length} players`);
  } catch (serviceError) {
    console.warn('Your service failed, using fallback:', serviceError.message);
    // Fall through to manual matching
  }
}
    
    // If service matching failed or unavailable, use fallback
    if (matchResults.length === 0) {
      console.log('🔄 Using fallback matching...');
      matchResults = sleeperPlayersArray.map(sleeperPlayer => {
        const matchResult = fallbackFindBestMatch(sleeperPlayer, ffhData.players);
        return {
          sleeperPlayer,
          ffhPlayer: matchResult.player,
          confidence: matchResult.confidence,
          method: matchResult.method,
          score: matchResult.score
        };
      });
    }

    // Process each matched result
    for (const matchResult of matchResults) {
      const { sleeperPlayer, ffhPlayer, confidence, method } = matchResult;
      
      if (!sleeperPlayer.id) continue;
      
      // ✅ DEBUG: Log Chris Richards specifically
      if (sleeperPlayer.full_name === 'Chris Richards' || sleeperPlayer.id === '2168') {
        console.log('🔍 DEBUG: Chris Richards matching details:');
        console.log('- Sleeper ID:', sleeperPlayer.id);
        console.log('- Sleeper Name:', sleeperPlayer.full_name);
        console.log('- Sleeper Team:', sleeperPlayer.team_abbr);
        console.log('- Sleeper Position:', sleeperPlayer.position);
        console.log('- FFH Player Found:', !!ffhPlayer);
        if (ffhPlayer) {
          console.log('- FFH Name:', ffhPlayer.web_name);
          console.log('- FFH Team Structure:', JSON.stringify(ffhPlayer.team, null, 2));
          console.log('- FFH Club:', ffhPlayer.club);
          console.log('- FFH Position ID:', ffhPlayer.position_id);
          console.log('- FFH Predictions Array:', ffhPlayer.predictions ? ffhPlayer.predictions.length : 'MISSING');
          console.log('- FFH Season Prediction:', ffhPlayer.season_prediction);
          if (ffhPlayer.predictions && ffhPlayer.predictions.length > 0) {
            console.log('- Sample FFH Prediction:', JSON.stringify(ffhPlayer.predictions[0], null, 2));
          }
        }
        console.log('- Match Confidence:', confidence);
        console.log('- Match Method:', method);
        console.log('- Match Score:', matchResult.score);
      }
      
      matchingStats.total++;
      
      // Normalize position
      const position = normalizePosition(sleeperPlayer);
      
      // Base player record
      let enhancedPlayer = {
        // Core identifiers
        player_id: sleeperPlayer.id,
        sleeper_id: sleeperPlayer.id,
        
        // Player info
        name: sleeperPlayer.full_name || sleeperPlayer.name,
        web_name: sleeperPlayer.last_name || sleeperPlayer.name,
        full_name: sleeperPlayer.full_name || sleeperPlayer.name,
        position: position,
        team: sleeperPlayer.team || sleeperPlayer.team_abbr || 'Unknown',
        team_abbr: sleeperPlayer.team_abbr || sleeperPlayer.team || 'UNK',
        
        // Ownership info
        owned_by: sleeperData.ownership[sleeperPlayer.id] || 'Free Agent',
        owner_name: sleeperData.ownership[sleeperPlayer.id] || 'Free Agent',
        is_available: !sleeperData.ownership[sleeperPlayer.id],
        
        // Sleeper metadata
        fantasy_positions: sleeperPlayer.fantasy_positions || [position],
        years_exp: sleeperPlayer.years_exp || 0,
        age: sleeperPlayer.age || null
      };

      if (ffhPlayer) {
        // Found a match! Apply scoring conversion
        matchingStats.matched++;
        matchingStats.byMethod[method] = (matchingStats.byMethod[method] || 0) + 1;
        matchingStats.byConfidence[confidence] = (matchingStats.byConfidence[confidence] || 0) + 1;
        
        // Extract FFH predictions
        const ffhSeasonPrediction = ffhPlayer.season_prediction || 
                                   ffhPlayer.range_prediction || 
                                   ffhPlayer.predicted_pts || 0;
        
        // ✅ FIXED: Include the full predictions array with xmins data
        if (ffhPlayer.predictions && Array.isArray(ffhPlayer.predictions)) {
          enhancedPlayer.predictions = ffhPlayer.predictions; // ✅ KEY FIX: Preserve predictions array
          
          const gwPredictions = {};
          const sleeperGwPredictions = {};
          
          ffhPlayer.predictions.forEach(pred => {
            if (pred.gw && pred.predicted_pts) {
              const pts = typeof pred.predicted_pts === 'object' ? 
                         pred.predicted_pts.predicted_pts : pred.predicted_pts;
              if (typeof pts === 'number') {
                gwPredictions[pred.gw] = pts;
                sleeperGwPredictions[pred.gw] = fallbackConvertFFHToSleeper(pts, position);
              }
            }
          });
          
          enhancedPlayer.ffh_gw_predictions = JSON.stringify(gwPredictions);
          enhancedPlayer.sleeper_gw_predictions = JSON.stringify(sleeperGwPredictions);
          
          // ✅ ADDED: Calculate next 5 gameweeks predicted minutes
          const next5Predictions = ffhPlayer.predictions.slice(0, 5);
          if (next5Predictions.length > 0) {
            const totalMinutes = next5Predictions.reduce((total, pred) => total + (pred.xmins || 0), 0);
            enhancedPlayer.avg_minutes_next5 = totalMinutes / next5Predictions.length;
            
            // Also add individual gameweek minute predictions
            const gwMinutePredictions = {};
            ffhPlayer.predictions.forEach(pred => {
              if (pred.gw && pred.xmins) {
                gwMinutePredictions[pred.gw] = pred.xmins;
              }
            });
            enhancedPlayer.ffh_gw_minutes = JSON.stringify(gwMinutePredictions);
          }
        }
        
        // Apply scoring conversion
        let sleeperSeasonTotal;
        if (services.available && services.scoring?.enhancePlayerWithScoringConversion) {
          // Use your sophisticated scoring service
          try {
            const enhanced = await services.scoring.enhancePlayerWithScoringConversion(enhancedPlayer, ffhPlayer);
            sleeperSeasonTotal = enhanced.sleeper_season_total;
            // Copy over any additional fields from your service
            enhancedPlayer = { ...enhancedPlayer, ...enhanced };
          } catch (conversionError) {
            console.warn('Scoring service failed, using fallback:', conversionError.message);
            sleeperSeasonTotal = fallbackConvertFFHToSleeper(ffhSeasonPrediction, position);
          }
        } else if (services.scoring?.convertFFHToSleeperPrediction) {
          // Use simple conversion function
          try {
            sleeperSeasonTotal = await services.scoring.convertFFHToSleeperPrediction(ffhSeasonPrediction, position);
          } catch (conversionError) {
            sleeperSeasonTotal = fallbackConvertFFHToSleeper(ffhSeasonPrediction, position);
          }
        } else {
          // Use fallback conversion
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
        
        // Add conversion ratio for transparency
        enhancedPlayer.sleeper_conversion_ratio = fallbackConvertFFHToSleeper(1, position);
        
        // FFH metadata
        enhancedPlayer.ffh_id = ffhPlayer.fpl_id || ffhPlayer.id;
        enhancedPlayer.ffh_web_name = ffhPlayer.web_name || ffhPlayer.name;
        enhancedPlayer.ffh_team = extractFFHTeam(ffhPlayer);
        enhancedPlayer.ffh_position_id = ffhPlayer.position_id;
        
        // ✅ DEBUG: Log Chris Richards enhancement results
        if (sleeperPlayer.full_name === 'Chris Richards' || sleeperPlayer.id === '2168') {
          console.log('🔍 DEBUG: Chris Richards enhancement results:');
          console.log('- Enhanced Position:', position);
          console.log('- FFH Season Prediction:', ffhSeasonPrediction);
          console.log('- Sleeper Season Total:', enhancedPlayer.sleeper_season_total);
          console.log('- Avg Minutes Next 5:', enhancedPlayer.avg_minutes_next5);
          console.log('- Predictions Array Length:', enhancedPlayer.predictions?.length);
          if (enhancedPlayer.predictions && enhancedPlayer.predictions.length > 0) {
            console.log('- First Prediction xmins:', enhancedPlayer.predictions[0].xmins);
          }
        }
        
        console.log(`✅ Enhanced ${enhancedPlayer.name} (${position}): ${ffhSeasonPrediction} → ${enhancedPlayer.sleeper_season_total} pts (${confidence}), Avg Mins: ${enhancedPlayer.avg_minutes_next5 || 'N/A'}`);
        
      } else {
        // No FFH match found
        matchingStats.byMethod['No Match']++;
        matchingStats.byConfidence['None']++;
        
        const estimatedPoints = { 'GKP': 120, 'DEF': 110, 'MID': 90, 'FWD': 100 }[position] || 90;
        enhancedPlayer.sleeper_season_total = estimatedPoints;
        enhancedPlayer.sleeper_season_avg = estimatedPoints / 38;
        enhancedPlayer.ffh_season_prediction = 0;
        enhancedPlayer.match_confidence = 'None';
        enhancedPlayer.ffh_matched = false;
        enhancedPlayer.scoring_conversion_applied = false;
        enhancedPlayer.avg_minutes_next5 = 0; // ✅ ADDED: Default for unmatched players
        
        // ✅ DEBUG: Log if Chris Richards wasn't matched
        if (sleeperPlayer.full_name === 'Chris Richards' || sleeperPlayer.id === '2168') {
          console.log('❌ DEBUG: Chris Richards was NOT matched to any FFH player!');
        }
      }
      
      enhancedPlayers.push(enhancedPlayer);
    }

    // Calculate final statistics - FIXED VERSION
    const finalStats = {
      total: sleeperPlayersArray.length,
      matched: enhancedPlayers.filter(p => p.ffh_matched).length,
      byMethod: {},
      byConfidence: {},
      matchRate: 0
    };

    // Count by method and confidence from actual enhanced players
    enhancedPlayers.forEach(player => {
      if (player.ffh_matched) {
        const method = player.match_method || 'Name Similarity';
        const confidence = player.match_confidence || 'None';
        
        finalStats.byMethod[method] = (finalStats.byMethod[method] || 0) + 1;
        finalStats.byConfidence[confidence] = (finalStats.byConfidence[confidence] || 0) + 1;
      } else {
        finalStats.byMethod['No Match'] = (finalStats.byMethod['No Match'] || 0) + 1;
        finalStats.byConfidence['None'] = (finalStats.byConfidence['None'] || 0) + 1;
      }
    });

    finalStats.matchRate = finalStats.total > 0 ? 
      Math.round((finalStats.matched / finalStats.total) * 100) : 0;

    console.log('📈 Integration complete:', finalStats);

    return {
      success: true,
      players: enhancedPlayers,
      integration: {
        matchingStats: finalStats,
        sleeperTotal: sleeperData.totalPlayers,
        ffhTotal: ffhData.totalPlayers,
        enhancedTotal: finalStats.matched, // FIXED: Use actual matched count, not total
        servicesUsed: services.available
      },
      quality: {
        completenessScore: 100,
        matchingQuality: `${finalStats.matchRate}%`,
        scoringConversion: services.available ? 'Your sophisticated service' : 'Fallback multipliers'
      },
      source: 'integrated-with-your-services',
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

    console.log('🔄 Integration request:', { forceRefresh, clearCache });

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
    const result = await integratePlayersWithYourServices();

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