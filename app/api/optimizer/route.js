// app/api/optimizer/route.js

import { NextResponse } from 'next/server';
import { FormationOptimizerService } from '../../services/formationOptimizerService.js';

const optimizerService = new FormationOptimizerService();

// Cache for optimizer results
let cachedResults = null;
let cacheTimestamp = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch integrated player data
 */
async function fetchPlayerData(baseUrl) {
  try {
    const response = await fetch(`${baseUrl}/api/integrated-players`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        includeMatching: true,
        includeScoring: true,
        forceRefresh: false
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch player data: ${response.status}`);
    }

    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to get player data');
    }

    return result.players || [];
  } catch (error) {
    console.error('Error fetching player data:', error);
    throw error;
  }
}

/**
 * POST handler - Main optimizer endpoint
 */
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { 
      userId = 'ThatDerekGuy',
      forceRefresh = false,
      analysisType = 'current_roster' // 'current_roster', 'all_formations', 'specific_formation'
    } = body;

    console.log('🎯 Optimizer request:', { userId, forceRefresh, analysisType });

    // Check cache unless force refresh
    const now = Date.now();
    if (!forceRefresh && cachedResults && cacheTimestamp && (now - cacheTimestamp) < CACHE_DURATION) {
      console.log('⚡ Serving optimizer results from cache');
      return NextResponse.json({
        ...cachedResults,
        fromCache: true,
        cacheAge: Math.round((now - cacheTimestamp) / 1000)
      });
    }

    // Get base URL for internal API calls
    const baseUrl = new URL(request.url).origin;

    // Fetch current player data
    console.log('📊 Fetching player data...');
    const players = await fetchPlayerData(baseUrl);
    console.log(`✅ Got ${players.length} players`);

    if (players.length === 0) {
      throw new Error('No player data available');
    }

    // Perform optimization analysis
    console.log('🎯 Analyzing current roster...');
    const analysis = await optimizerService.analyzeCurrentRoster(players, userId);

    if (analysis.error) {
      throw new Error(analysis.error);
    }

    // Calculate additional stats
    const stats = {
      currentPoints: analysis.current?.points || 0,
      optimalPoints: analysis.optimal?.totalPoints || 0,
      improvement: analysis.improvement || 0,
      efficiency: analysis.efficiency || 0,
      playersToSwap: analysis.recommendations.filter(r => r.type === 'player_swap').length,
      formationChange: analysis.recommendations.some(r => r.type === 'formation_change')
    };

    // Prepare formations data for visualization
    const formationsData = analysis.allFormations?.map(formation => ({
      name: formation.formation,
      points: formation.totalPoints,
      players: formation.players.map(p => ({
        id: p.sleeper_id || p.id,
        name: p.name,
        position: p.normalizedPosition,
        team: p.team,
        points: p.predictedPoints,
        minutes: p.avg_minutes_next5 || 0
      })),
      valid: formation.valid
    })) || [];

    const result = {
      success: true,
      userId: analysis.roster?.userName || userId,
      stats,
      current: {
        formation: analysis.current?.formation || 'Unknown',
        players: analysis.current?.players?.map(p => ({
          id: p.sleeper_id || p.id,
          name: p.name,
          position: optimizerService.normalizePosition(p),
          team: p.team,
          points: optimizerService.getPlayerPoints(p),
          minutes: p.avg_minutes_next5 || 0
        })) || [],
        totalPoints: analysis.current?.points || 0
      },
      optimal: analysis.optimal ? {
        formation: analysis.optimal.formation,
        players: analysis.optimal.players.map(p => ({
          id: p.sleeper_id || p.id,
          name: p.name,
          position: p.normalizedPosition,
          team: p.team,
          points: p.predictedPoints,
          minutes: p.avg_minutes_next5 || 0
        })),
        totalPoints: analysis.optimal.totalPoints
      } : null,
      recommendations: analysis.recommendations,
      allFormations: formationsData,
      roster: {
        totalPlayers: analysis.roster?.players?.length || 0,
        wins: analysis.roster?.wins || 0,
        losses: analysis.roster?.losses || 0,
        seasonPoints: analysis.roster?.points || 0
      },
      lastUpdated: new Date().toISOString(),
      fromCache: false
    };

    // Cache the results
    cachedResults = result;
    cacheTimestamp = now;

    console.log('✅ Optimizer analysis complete:', {
      current: stats.currentPoints.toFixed(1),
      optimal: stats.optimalPoints.toFixed(1),
      improvement: stats.improvement.toFixed(1),
      efficiency: stats.efficiency.toFixed(1) + '%'
    });

    return NextResponse.json(result);

  } catch (error) {
    console.error('❌ Optimizer error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      stats: {
        currentPoints: 0,
        optimalPoints: 0,
        improvement: 0,
        efficiency: 0,
        playersToSwap: 0,
        formationChange: false
      },
      current: null,
      optimal: null,
      recommendations: [],
      lastUpdated: new Date().toISOString()
    }, { status: 500 });
  }
}

/**
 * GET handler - Redirect to POST
 */
export async function GET(request) {
  console.log('🔄 GET request received, redirecting to POST logic');
  
  const mockRequest = {
    json: () => Promise.resolve({ 
      userId: 'ThatDerekGuy',
      forceRefresh: false,
      analysisType: 'current_roster'
    }),
    url: request.url
  };
  
  return POST(mockRequest);
}