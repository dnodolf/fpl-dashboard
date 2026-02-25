// app/api/optimizer/route.js
// Updated to use unified position utilities - SLEEPER AUTHORITY

import { NextResponse } from 'next/server';
import { FormationOptimizerService } from '../../services/formationOptimizerService.js';
import { normalizePosition } from '../../../utils/positionUtils.js';
import { transformPlayerForClient } from '../../utils/playerTransformUtils.js';
import { cacheService } from '../../services/cacheService.js';
import { USER_ID } from '../../config/constants';

const optimizerService = new FormationOptimizerService();

/**
 * Fetch integrated player data
 */
async function fetchPlayerData(baseUrl, forceRefresh = false) {
  try {
    const response = await fetch(`${baseUrl}/api/integrated-players`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        includeMatching: true,
        includeScoring: true,
        forceRefresh: forceRefresh
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch player data: ${response.status}`);
    }

    const result = await response.json();
    return result.players || [];
  } catch (error) {
    console.error('Error fetching player data:', error);
    throw error;
  }
}

export async function POST(request) {
  try {
    const requestData = await request.json();
    const userId = requestData.userId || USER_ID;
    const analysisType = requestData.analysisType || 'current_roster';
    const forceRefresh = requestData.forceRefresh || false;
    const scoringMode = requestData.scoringMode || 'ffh';

    // Check cache
    const cacheKey = `optimizer_${userId}_${analysisType}_${scoringMode}`;
    if (!forceRefresh) {
      const cached = cacheService.get(cacheKey);
      if (cached) {
        if (process.env.NODE_ENV === 'development') {
          console.log('📋 Returning cached optimizer results');
        }
        return NextResponse.json({
          ...cached,
          cached: true,
          cache_age: Math.round(cached._age / 1000 / 60)
        });
      }
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(`🔍 OPTIMIZER: Starting ${analysisType} analysis for ${userId}`);
    }

    // Clear service cache if force refresh
    if (forceRefresh) {
      if (process.env.NODE_ENV === 'development') {
        console.log('🔄 Clearing optimizer service cache due to forceRefresh');
      }
      const { FormationOptimizerService } = await import('../../services/formationOptimizerService.js');
      const optimizerService = new FormationOptimizerService();
      optimizerService.clearCache();
    }

    // Get base URL for API calls
    const { protocol, host } = new URL(request.url);
    const baseUrl = `${protocol}//${host}`;

    // Fetch integrated player data (pass forceRefresh to clear player data cache too)
    let players = await fetchPlayerData(baseUrl, forceRefresh);
    
    if (!players || players.length === 0) {
      throw new Error('No player data available');
    }

    // V3 scoring: players from integrated-players already have calibrated v3 fields
    // (v3_current_gw, v3_season_total, v3_season_avg) baked in via calibrationService.
    // Do NOT re-run applyV3Scoring here — it would overwrite calibrated values with
    // hardcoded fallback ratios since we don't have calibration data in this route.
    if (scoringMode === 'v3') {
      if (!requestData.currentGameweek) {
        throw new Error('currentGameweek is required for v3 scoring mode');
      }
      const v3Count = players.filter(p => p.v3_current_gw > 0).length;
      if (process.env.NODE_ENV === 'development') {
        console.log(`📊 V3 mode: ${v3Count} players already have calibrated v3 fields from integrated-players`);
      }
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(`📊 Processing ${players.length} players for optimization`);
    }

    // Debug position distribution
    const positionCounts = {};
    players.forEach(player => {
      const pos = normalizePosition(player);
      positionCounts[pos] = (positionCounts[pos] || 0) + 1;
    });
    if (process.env.NODE_ENV === 'development') {
      console.log('📊 Position distribution:', positionCounts);
      console.log('🎯 Analyzing current roster...');
    }
    const analysis = await optimizerService.analyzeCurrentRoster(players, userId, scoringMode);

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
      formation: formation.formation,
      points: formation.totalPoints,
      totalPoints: formation.totalPoints,
      players: formation.players?.map(p => transformPlayerForClient(p, optimizerService)) || [],
      valid: formation.valid
    })) || [];

    const result = {
      success: true,
      userId: analysis.roster?.userName || userId,
      stats,
      current: {
        formation: analysis.current?.formation || 'Unknown',
        players: analysis.current?.players?.map(p => transformPlayerForClient(p, optimizerService)) || [],
        points: analysis.current?.points || 0,
        totalPoints: analysis.current?.points || 0
      },
      optimal: analysis.optimal ? {
        formation: analysis.optimal.formation,
        players: analysis.optimal.players?.map(p => transformPlayerForClient(p, optimizerService)) || [],
        points: analysis.optimal.totalPoints,
        totalPoints: analysis.optimal.totalPoints,
        valid: analysis.optimal.valid
      } : null,
      recommendations: analysis.recommendations || [],
      formations: formationsData,
      roster: {
        userName: analysis.roster?.userName || userId,
        formation: analysis.roster?.formation || 'Unknown',
        wins: analysis.roster?.wins || 0,
        losses: analysis.roster?.losses || 0,
        totalPlayers: analysis.roster?.players?.length || 0
      },
      metadata: {
        timestamp: new Date().toISOString(),
        analysisType,
        scoringMode,
        playersAnalyzed: players.length,
        formationsChecked: formationsData.length,
        positionDistribution: positionCounts
      },
      scoringMode
    };

    // Cache successful results
    cacheService.set(cacheKey, result, 5 * 60 * 1000); // 5 minutes

    return NextResponse.json(result);

  } catch (error) {
    console.error('Optimizer error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function GET(request) {
  return POST(request);
}