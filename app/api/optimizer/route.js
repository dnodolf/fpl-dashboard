// app/api/optimizer/route.js
// Updated to use unified position utilities - SLEEPER AUTHORITY

import { NextResponse } from 'next/server';
import { FormationOptimizerService } from '../../services/formationOptimizerService.js';
import { normalizePosition } from '../../../utils/positionUtils.js';
import { transformPlayerForClient } from '../../utils/playerTransformUtils.js';
import { cacheService } from '../../services/cacheService.js';
import { USER_ID } from '../../config/constants';
import GameweekService from '../../services/gameweekService.js';

const optimizerService = new FormationOptimizerService();

/**
 * Fetch live fixture data for a gameweek from FPL API.
 * Returns teams whose matches are finished or in-progress (locked).
 */
let teamMapCache = null;
async function getLockedTeams(gwNumber) {
  if (!gwNumber) return { lockedTeams: new Set(), fixtureList: [] };
  try {
    // Fetch team abbreviation map (cached)
    if (!teamMapCache) {
      const res = await fetch('https://fantasy.premierleague.com/api/bootstrap-static/', {
        cache: 'no-store',
        headers: { 'User-Agent': 'FPL-Dashboard/1.0' }
      });
      if (res.ok) {
        const data = await res.json();
        teamMapCache = {};
        for (const team of (data.teams || [])) {
          teamMapCache[team.id] = team.short_name;
        }
        setTimeout(() => { teamMapCache = null; }, 60 * 60 * 1000);
      }
    }
    const teamMap = teamMapCache || {};

    const fixturesRes = await fetch(
      `https://fantasy.premierleague.com/api/fixtures/?event=${gwNumber}`,
      { cache: 'no-store' }
    );
    if (!fixturesRes.ok) return { lockedTeams: new Set(), fixtureList: [] };
    const fixtures = await fixturesRes.json();

    const lockedTeams = new Set();
    const fixtureList = fixtures
      .sort((a, b) => new Date(a.kickoff_time) - new Date(b.kickoff_time))
      .map(f => {
        const isFinished = f.finished_provisional || f.finished;
        const isLive = f.started && !isFinished;
        const homeAbbr = teamMap[f.team_h] || `T${f.team_h}`;
        const awayAbbr = teamMap[f.team_a] || `T${f.team_a}`;
        // Players are locked once their match has started (can't sub them)
        if (isFinished || isLive) {
          lockedTeams.add(homeAbbr.toUpperCase());
          lockedTeams.add(awayAbbr.toUpperCase());
        }
        return {
          homeTeam: homeAbbr,
          awayTeam: awayAbbr,
          homeScore: f.team_h_score,
          awayScore: f.team_a_score,
          kickoffTime: f.kickoff_time,
          minutes: f.minutes,
          status: isFinished ? 'finished' : isLive ? 'live' : 'upcoming'
        };
      });

    return { lockedTeams, fixtureList };
  } catch (e) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('⚠️ Failed to fetch fixture data for locked teams:', e.message);
    }
    return { lockedTeams: new Set(), fixtureList: [] };
  }
}

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

    // Fetch player data and live fixture status in parallel
    const currentGW = requestData.currentGameweek;
    const [players, { lockedTeams, fixtureList }] = await Promise.all([
      fetchPlayerData(baseUrl, forceRefresh),
      getLockedTeams(currentGW)
    ]);

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
    const analysis = await optimizerService.analyzeCurrentRoster(players, userId, scoringMode, currentGW, lockedTeams);

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
      scoringMode,
      fixtureList
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