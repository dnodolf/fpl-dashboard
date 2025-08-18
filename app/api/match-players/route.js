// app/api/match-players/route.js
import { NextResponse } from 'next/server';
import { playerMatchingService } from '../../services/playerMatchingService';
import { sleeperApiService } from '../../services/sleeperApiService';
import { ffhApiService } from '../../services/ffhApiService';
import { googleSheetsService } from '../../services/googleSheetsService';
import { cacheService } from '../../services/cacheService';

export async function POST(request) {
  try {
    const { forceRefresh = false } = await request.json();
    const cacheKey = 'player-matching-results';

    // Check cache first unless forcing refresh
    if (!forceRefresh) {
      const cached = cacheService.get(cacheKey);
      if (cached) {
        return NextResponse.json({
          success: true,
          ...cached.data,
          cached: true,
          age: cached._age
        });
      }
    }

    console.log('Starting player matching process...');

    // Fetch data from all sources
    const [ffhPlayers, sleeperPlayersData, rosters] = await Promise.all([
      ffhApiService.getPlayerPredictions(),
      sleeperApiService.getPlayers(),
      sleeperApiService.getRosters()
    ]);

    // Transform Sleeper data
    const ownershipMap = sleeperApiService.createOwnershipMap(rosters);
    const sleeperPlayers = sleeperApiService.transformSleeperData(sleeperPlayersData, ownershipMap);

    // Get persistent match map from Google Sheets (if available)
    let persistentMatchMap = {};
    try {
      persistentMatchMap = await googleSheetsService.getMatchMap();
    } catch (error) {
      console.warn('Could not load persistent match map:', error.message);
    }

    // Perform matching
    const matchingResults = await playerMatchingService.matchPlayers(
      sleeperPlayers,
      ffhPlayers,
      persistentMatchMap
    );

    // Get matching statistics
    const stats = playerMatchingService.getMatchingStats(matchingResults.matches);

    // Save new matches to persistent map
    if (Object.keys(matchingResults.newMatches).length > 0) {
      try {
        const updatedMatchMap = { ...persistentMatchMap, ...matchingResults.newMatches };
        await googleSheetsService.saveMatchMap(updatedMatchMap);
        console.log(`Saved ${Object.keys(matchingResults.newMatches).length} new matches`);
      } catch (error) {
        console.warn('Could not save new matches:', error.message);
      }
    }

    // Log diagnostics
    try {
      await googleSheetsService.logDiagnostics(matchingResults.diagnostics);
    } catch (error) {
      console.warn('Could not log diagnostics:', error.message);
    }

    const result = {
      matches: matchingResults.matches,
      stats,
      summary: {
        totalSleeperPlayers: sleeperPlayers.length,
        totalFFHPlayers: ffhPlayers.length,
        matchedPlayers: stats.matched,
        matchRate: `${(stats.matchRate * 100).toFixed(1)}%`,
        newMatches: Object.keys(matchingResults.newMatches).length,
        averageConfidence: stats.averageScore.toFixed(3)
      },
      lastUpdated: new Date().toISOString()
    };

    // Cache the results
    cacheService.set(cacheKey, { data: result }, 30 * 60 * 1000); // 30 minutes

    return NextResponse.json({
      success: true,
      ...result,
      cached: false
    });

  } catch (error) {
    console.error('Player matching error:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      details: 'Check that FFH and Sleeper APIs are accessible'
    }, { status: 500 });
  }
}

export async function GET() {
  try {
    // Return cached matching results if available
    const cached = cacheService.get('player-matching-results');
    
    if (cached) {
      return NextResponse.json({
        success: true,
        ...cached.data,
        cached: true,
        age: cached._age
      });
    }

    return NextResponse.json({
      success: false,
      error: 'No cached matching results available. Use POST to trigger matching.',
      suggestion: 'Send POST request to this endpoint to start player matching process.'
    }, { status: 404 });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}