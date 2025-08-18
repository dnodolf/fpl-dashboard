// app/api/sleeper/route.js
import { NextResponse } from 'next/server';
import { sleeperApiService } from '../../services/sleeperApiService';
import { cacheService } from '../../services/cacheService';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const endpoint = searchParams.get('endpoint') || 'rosters';
    const forceRefresh = searchParams.get('refresh') === 'true';

    const cacheKey = `sleeper-${endpoint}`;
    
    // Check cache first unless forcing refresh
    if (!forceRefresh) {
      const cached = cacheService.get(cacheKey);
      if (cached) {
        return NextResponse.json({
          success: true,
          data: cached.data,
          cached: true,
          age: cached._age,
          lastUpdated: cached.lastUpdated
        });
      }
    }

    let data;
    let message;

    switch (endpoint) {
      case 'rosters':
        data = await sleeperApiService.getRosters();
        message = `Fetched ${data.length} rosters`;
        break;
        
      case 'players':
        data = await sleeperApiService.getPlayers();
        const playerCount = Object.keys(data).length;
        message = `Fetched ${playerCount} players`;
        break;
        
      case 'league':
        data = await sleeperApiService.getLeague();
        message = `Fetched league: ${data.name}`;
        break;
        
      case 'ownership':
        const rosters = await sleeperApiService.getRosters();
        data = sleeperApiService.createOwnershipMap(rosters);
        message = `Created ownership map for ${Object.keys(data).length} players`;
        break;
        
      case 'scoring':
        data = await sleeperApiService.getScoringSettings();
        message = `Fetched scoring settings`;
        break;
        
      default:
        return NextResponse.json({
          success: false,
          error: `Unknown endpoint: ${endpoint}. Available: rosters, players, league, ownership, scoring`
        }, { status: 400 });
    }

    // Cache the result
    const result = {
      data,
      message,
      lastUpdated: new Date().toISOString(),
      endpoint
    };
    
    cacheService.set(cacheKey, result);

    return NextResponse.json({
      success: true,
      ...result,
      cached: false
    });

  } catch (error) {
    console.error('Sleeper API error:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      endpoint: 'unknown'
    }, { status: 500 });
  }
}

// Health check
export async function HEAD() {
  try {
    const health = await sleeperApiService.healthCheck();
    return new NextResponse(null, { 
      status: health.success ? 200 : 503,
      headers: {
        'X-Health-Status': health.message
      }
    });
  } catch (error) {
    return new NextResponse(null, { status: 503 });
  }
}