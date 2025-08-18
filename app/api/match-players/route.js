// app/api/match-players/route.js
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { forceRefresh = false } = await request.json();

    console.log('Starting simplified player matching process...');

    // For now, return a placeholder response
    // We'll implement full matching once all services are stable
    const result = {
      matches: [],
      stats: {
        total: 0,
        matched: 0,
        matchRate: 0,
        byMethod: {},
        byConfidence: {}
      },
      summary: {
        totalSleeperPlayers: 0,
        totalFFHPlayers: 0,
        matchedPlayers: 0,
        matchRate: '0%',
        newMatches: 0,
        averageConfidence: 0
      },
      lastUpdated: new Date().toISOString(),
      status: 'Service under development'
    };

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
      details: 'Player matching service is being implemented'
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    success: false,
    error: 'Player matching service under development',
    suggestion: 'This feature will be available in the next update.'
  }, { status: 503 });
}