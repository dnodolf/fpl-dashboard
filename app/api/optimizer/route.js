// app/api/optimizer/route.js
// Updated to use unified position utilities - SLEEPER AUTHORITY

import { NextResponse } from 'next/server';
import { FormationOptimizerService } from '../../services/formationOptimizerService.js';
import { normalizePosition } from '../../../utils/positionUtils.js';

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
    return result.players || [];
  } catch (error) {
    console.error('Error fetching player data:', error);
    throw error;
  }
}

export async function POST(request) {
  try {
    const requestData = await request.json();
    const userId = requestData.userId || 'ThatDerekGuy';
    const analysisType = requestData.analysisType || 'current_roster';
    const forceRefresh = requestData.forceRefresh || false;

    // Check cache
    const cacheKey = `${userId}_${analysisType}`;
    if (!forceRefresh && cachedResults && cacheTimestamp) {
      const isValid = (Date.now() - cacheTimestamp) < CACHE_DURATION;
      if (isValid && cachedResults.userId === userId) {
        console.log('📋 Returning cached optimizer results');
        return NextResponse.json({
          ...cachedResults,
          cached: true,
          cache_age: Math.round((Date.now() - cacheTimestamp) / 1000 / 60)
        });
      }
    }

    console.log(`🔍 OPTIMIZER: Starting ${analysisType} analysis for ${userId}`);

    // Get base URL for API calls
    const { protocol, host } = new URL(request.url);
    const baseUrl = `${protocol}//${host}`;

    // Fetch integrated player data
    const players = await fetchPlayerData(baseUrl);
    
    if (!players || players.length === 0) {
      throw new Error('No player data available');
    }

    console.log(`📊 Processing ${players.length} players for optimization`);

    // Debug position distribution
    const positionCounts = {};
    players.forEach(player => {
      const pos = normalizePosition(player);
      positionCounts[pos] = (positionCounts[pos] || 0) + 1;
    });
    console.log('📊 Position distribution:', positionCounts);

    // Debug goalkeepers specifically
    const goalkeepers = players.filter(p => normalizePosition(p) === 'GKP');
    console.log(`🥅 GOALKEEPERS FOUND: ${goalkeepers.length}`);
    goalkeepers.forEach(gk => {
      console.log(`  ${gk.name || gk.full_name} (${gk.team_abbr || gk.team}) - fantasy_positions: ${JSON.stringify(gk.fantasy_positions)}`);
    });

    // Also check for Ederson specifically
    const ederson = players.find(p => 
      (p.name || p.full_name || '').toLowerCase().includes('ederson')
    );
    if (ederson) {
      console.log(`🔍 EDERSON DEBUG:`);
      debugPlayerPosition(ederson);
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
      formation: formation.formation,
      points: formation.totalPoints,
      totalPoints: formation.totalPoints,
      players: formation.players?.map(p => ({
        id: p.sleeper_id || p.id || p.player_id,
        player_id: p.sleeper_id || p.id || p.player_id,
        sleeper_id: p.sleeper_id || p.id || p.player_id,
        name: p.name || p.web_name || 'Unknown Player',
        web_name: p.web_name || p.name || 'Unknown Player',
        full_name: p.full_name || p.name || p.web_name || 'Unknown Player',
        position: normalizePosition(p), // Use unified position logic
        team: p.team || p.team_abbr || 'Unknown',
        team_abbr: p.team_abbr || p.team || 'Unknown',
        points: optimizerService.getPlayerPoints(p),
        predicted_pts: optimizerService.getPlayerPoints(p),
        minutes: optimizerService.getPlayerMinutes(p) || 90
      })) || [],
      valid: formation.valid
    })) || [];

    const result = {
      success: true,
      userId: analysis.roster?.userName || userId,
      stats,
      current: {
        formation: analysis.current?.formation || 'Unknown',
        players: analysis.current?.players?.map(p => {
          return {
            id: p.sleeper_id || p.id || p.player_id,
            player_id: p.sleeper_id || p.id || p.player_id,
            sleeper_id: p.sleeper_id || p.id || p.player_id,
            name: p.name || p.web_name || 'Unknown Player',
            web_name: p.web_name || p.name || 'Unknown Player',
            full_name: p.full_name || p.name || p.web_name || 'Unknown Player',
            position: normalizePosition(p), // Use unified position logic
            team: p.team || p.team_abbr || 'Unknown',
            team_abbr: p.team_abbr || p.team || 'Unknown',
            points: optimizerService.getPlayerPoints(p),
            current_gw_prediction: optimizerService.getPlayerPoints(p),
            predicted_pts: optimizerService.getPlayerPoints(p),
            minutes: optimizerService.getPlayerMinutes(p)
          };
        }) || [],
        points: analysis.current?.points || 0,
        totalPoints: analysis.current?.points || 0
      },
      optimal: analysis.optimal ? {
        formation: analysis.optimal.formation,
        players: analysis.optimal.players?.map(p => ({
          id: p.sleeper_id || p.id || p.player_id,
          player_id: p.sleeper_id || p.id || p.player_id,
          sleeper_id: p.sleeper_id || p.id || p.player_id,
          name: p.name || p.web_name || 'Unknown Player',
          web_name: p.web_name || p.name || 'Unknown Player',
          full_name: p.full_name || p.name || p.web_name || 'Unknown Player',
          position: normalizePosition(p), // Use unified position logic
          team: p.team || p.team_abbr || 'Unknown',
          team_abbr: p.team_abbr || p.team || 'Unknown',
          points: optimizerService.getPlayerPoints(p),
          predicted_pts: optimizerService.getPlayerPoints(p),
          minutes: optimizerService.getPlayerMinutes(p)
        })) || [],
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
        playersAnalyzed: players.length,
        formationsChecked: formationsData.length,
        positionDistribution: positionCounts
      }
    };

    // Cache successful results
    cachedResults = result;
    cacheTimestamp = Date.now();

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