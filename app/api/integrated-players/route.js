// app/api/integrated-players/route.js
import { NextResponse } from 'next/server';
import { PlayerMatchingService } from '../../services/playerMatchingService.js';
import { ScoringConversionService } from '../../services/scoringConversionService.js';

const matchingService = new PlayerMatchingService();
const scoringService = new ScoringConversionService();

export async function POST(request) {
  try {
    const { 
      forceRefresh = false, 
      clearCache = false, 
      includeScoring = true,
      includeMatching = true 
    } = await request.json();

    console.log('Starting integrated player data processing...', {
      forceRefresh, clearCache, includeScoring, includeMatching
    });

    if (clearCache) {
      matchingService.clearCache();
      scoringService.clearCache();
      console.log('All caches cleared');
    }

    const baseUrl = new URL(request.url).origin;
    const leagueId = process.env.SLEEPER_LEAGUE_ID || '1240184286171107328';

    // Step 1: Fetch all data sources
    console.log('Step 1: Fetching data from all sources...');
    
    const [sleeperResponse, ffhResponse] = await Promise.all([
      fetch(`${baseUrl}/api/sleeper?endpoint=players&ownership=true`),
      fetch(`${baseUrl}/api/ffh/players`)
    ]);

    if (!sleeperResponse.ok) {
      throw new Error(`Sleeper API failed: ${sleeperResponse.status}`);
    }
    if (!ffhResponse.ok) {
      throw new Error(`FFH API failed: ${ffhResponse.status}`);
    }

    const [sleeperResult, ffhResult] = await Promise.all([
      sleeperResponse.json(),
      ffhResponse.json()
    ]);

    if (!sleeperResult.success || !ffhResult.success) {
      throw new Error('Failed to fetch player data from one or more sources');
    }

    const sleeperPlayers = sleeperResult.players || [];
    const ffhPlayers = ffhResult.players || [];
    const ownershipMap = {}; // Will be populated from Sleeper data

    // Extract ownership from Sleeper data
    sleeperPlayers.forEach(player => {
      if (player.owned_by) {
        ownershipMap[player.sleeper_id] = player.owned_by;
      }
    });

    console.log(`Fetched ${sleeperPlayers.length} Sleeper players and ${ffhPlayers.length} FFH players`);

    // Step 2: Calculate scoring conversion ratios if needed
    let conversionRatios = null;
    if (includeScoring) {
      console.log('Step 2: Calculating scoring conversion ratios...');
      conversionRatios = await scoringService.calculateScoringConversionRatios(leagueId);
      console.log('Conversion ratios calculated:', Object.keys(conversionRatios));
    }

    // Step 3: Perform player matching if needed
    let matchingResult = null;
    if (includeMatching) {
      console.log('Step 3: Performing player matching...');
      matchingResult = await matchingService.matchAllPlayers(sleeperPlayers, ffhPlayers);
      console.log(`Matching completed: ${matchingResult.stats.matched}/${matchingResult.stats.total} matched`);
    }

    // Step 4: Create integrated player records
    console.log('Step 4: Creating integrated player records...');
    const integratedPlayers = [];
    
    if (matchingResult && conversionRatios) {
      // Full integration with matching and scoring
      matchingResult.matches.forEach(match => {
        const enhancedRecord = scoringService.createEnhancedPlayerRecord(
          match.sleeperPlayer,
          match.ffhPlayer,
          conversionRatios,
          ownershipMap
        );
        
        // Add matching metadata
        enhancedRecord.match_confidence = match.confidence;
        enhancedRecord.match_method = match.method;
        enhancedRecord.match_score = match.score;
        
        integratedPlayers.push(enhancedRecord);
      });
    } else if (matchingResult && !conversionRatios) {
      // Just matching, no scoring conversion
      matchingResult.matches.forEach(match => {
        const basicRecord = {
          // Core data
          player_id: match.sleeperPlayer.sleeper_id,
          sleeper_id: match.sleeperPlayer.sleeper_id,
          ffh_id: match.ffhPlayer.id || match.ffhPlayer.element_id,
          
          // Player info
          name: match.sleeperPlayer.name || match.sleeperPlayer.full_name,
          position: match.sleeperPlayer.position,
          team: match.sleeperPlayer.team,
          
          // Ownership
          owned_by: ownershipMap[match.sleeperPlayer.sleeper_id] || '',
          is_available: !ownershipMap[match.sleeperPlayer.sleeper_id],
          
          // FFH data
          ffh_predicted_points: scoringService.getFFHRangePrediction(match.ffhPlayer),
          ffh_web_name: match.ffhPlayer.web_name || match.ffhPlayer.name,
          ffh_team: match.ffhPlayer.team_short_name || match.ffhPlayer.team,
          
          // Matching metadata
          match_confidence: match.confidence,
          match_method: match.method,
          match_score: match.score
        };
        
        integratedPlayers.push(basicRecord);
      });
    } else {
      // Fallback: just return Sleeper players with ownership
      sleeperPlayers.forEach(player => {
        integratedPlayers.push({
          player_id: player.sleeper_id,
          sleeper_id: player.sleeper_id,
          name: player.name || player.full_name,
          position: player.position,
          team: player.team,
          owned_by: player.owned_by || '',
          is_available: !player.owned_by,
          integration_level: 'basic'
        });
      });
    }

    // Step 5: Compile results
    const result = {
      success: true,
      players: integratedPlayers,
      count: integratedPlayers.length,
      
      // Data source info
      sources: {
        sleeper: {
          count: sleeperPlayers.length,
          hasOwnership: sleeperResult.hasOwnership
        },
        ffh: {
          count: ffhPlayers.length,
          source: ffhResult.source
        }
      },
      
      // Integration results
      integration: {
        matchingEnabled: includeMatching,
        scoringEnabled: includeScoring,
        matchingStats: matchingResult?.stats,
        conversionRatios: conversionRatios ? Object.keys(conversionRatios) : null
      },
      
      // Quality metrics
      quality: {
        dataCompleteness: Math.round((integratedPlayers.filter(p => p.name && p.position && p.team).length / integratedPlayers.length) * 100),
        matchingQuality: matchingResult ? `${matchingResult.stats.matchRate}%` : 'N/A',
        averageConfidence: matchingResult?.summary.averageConfidence || 0
      },
      
      // Metadata
      lastUpdated: new Date().toISOString(),
      processingTime: Date.now() - Date.now(), // Will be calculated properly
      cached: false
    };

    console.log(`Integration completed: ${result.count} players processed`);
    
    return NextResponse.json(result);

  } catch (error) {
    console.error('Integrated player data error:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      details: 'Check that all required APIs (Sleeper, FFH) are working',
      suggestion: 'Try testing individual endpoints first: /api/sleeper?endpoint=players, /api/ffh/players'
    }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const quick = searchParams.get('quick') === 'true';
    
    if (quick) {
      // Quick status check
      return NextResponse.json({
        success: true,
        status: 'Integrated Player Data Service Active',
        services: {
          matching: 'Available',
          scoring: 'Available'
        },
        cacheStatus: {
          matching: matchingService.getCacheStats(),
          scoring: scoringService.getCacheStatus()
        },
        endpoints: [
          'POST /api/integrated-players - Full player integration',
          'GET /api/integrated-players?quick=true - Service status'
        ]
      });
    }

    // Trigger a quick integration
    const baseUrl = new URL(request.url).origin;
    const response = await fetch(`${baseUrl}/api/integrated-players`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ includeScoring: false, includeMatching: true })
    });

    const result = await response.json();
    return NextResponse.json(result);

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error.message,
      status: 'Service Error'
    }, { status: 500 });
  }
}