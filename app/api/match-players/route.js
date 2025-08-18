// app/api/match-players/route.js
import { NextResponse } from 'next/server';
import { PlayerMatchingService } from '../../services/playerMatchingService.js';

const matchingService = new PlayerMatchingService();

export async function POST(request) {
  try {
    const { forceRefresh = false, clearCache = false } = await request.json();

    console.log('Starting advanced player matching process...', { forceRefresh, clearCache });

    if (clearCache) {
      matchingService.clearCache();
      console.log('Matching cache cleared');
    }

    // Get data from all sources
    const baseUrl = new URL(request.url).origin;
    
    // Fetch Sleeper players
    console.log('Fetching Sleeper players...');
    const sleeperResponse = await fetch(`${baseUrl}/api/sleeper?endpoint=players&ownership=true`);
    if (!sleeperResponse.ok) {
      throw new Error(`Sleeper API failed: ${sleeperResponse.status}`);
    }
    const sleeperResult = await sleeperResponse.json();
    
    if (!sleeperResult.success) {
      throw new Error(sleeperResult.error || 'Failed to fetch Sleeper players');
    }

    // Fetch FFH players
    console.log('Fetching FFH players...');
    const ffhResponse = await fetch(`${baseUrl}/api/ffh/players`);
    if (!ffhResponse.ok) {
      throw new Error(`FFH API failed: ${ffhResponse.status}`);
    }
    const ffhResult = await ffhResponse.json();
    
    if (!ffhResult.success) {
      throw new Error(ffhResult.error || 'Failed to fetch FFH players');
    }

    const sleeperPlayers = sleeperResult.players || [];
    const ffhPlayers = ffhResult.players || [];

    console.log(`Got ${sleeperPlayers.length} Sleeper players and ${ffhPlayers.length} FFH players`);

    if (sleeperPlayers.length === 0) {
      throw new Error('No Sleeper players found');
    }

    if (ffhPlayers.length === 0) {
      throw new Error('No FFH players found');
    }

    // Perform matching
    console.log('Performing player matching...');
    const matchingResult = await matchingService.matchAllPlayers(sleeperPlayers, ffhPlayers);

    console.log(`Matching completed: ${matchingResult.stats.matched}/${matchingResult.stats.total} players matched`);

    return NextResponse.json({
      success: true,
      ...matchingResult,
      cached: false,
      lastUpdated: new Date().toISOString(),
      cacheStats: matchingService.getCacheStats()
    });

  } catch (error) {
    console.error('Player matching error:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      details: 'Check that both Sleeper and FFH APIs are working',
      suggestion: 'Try testing /api/sleeper?endpoint=players and /api/ffh/players individually'
    }, { status: 500 });
  }
}

export async function GET() {
  try {
    // Return cached matching results or trigger new matching
    const result = {
      cacheStats: matchingService.getCacheStats(),
      serviceStatus: 'Active',
      lastRun: new Date().toISOString(),
      availableEndpoints: [
        'POST /api/match-players - Run player matching',
        'GET /api/match-players - Get service status'
      ]
    };

    return NextResponse.json({
      success: true,
      ...result
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}