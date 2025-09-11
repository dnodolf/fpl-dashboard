// app/api/test-v3-predictions/route.js
// Test route for V3 Prediction Engine

import { NextResponse } from 'next/server';
import sleeperPredictionServiceV3 from '../../services/sleeperPredictionServiceV3';
import ffhStatsService from '../../services/ffhStatsService';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'test-conversion';
    const playerName = searchParams.get('player') || 'Mateta';
    
    console.log(`🧪 V3 Test: Action=${action}, Player=${playerName}`);
    
    switch (action) {
      case 'test-conversion':
        return await testStatConversion(playerName);
        
      case 'batch-test':
        return await batchTestPlayers();
        
      case 'position-analysis':
        const position = searchParams.get('position') || '3';
        return await testPositionAnalysis(parseInt(position));
        
      case 'sleeper-scoring':
        return await showSleeperScoring();
        
      default:
        return NextResponse.json({
          error: 'Invalid action',
          availableActions: ['test-conversion', 'batch-test', 'position-analysis', 'sleeper-scoring']
        }, { status: 400 });
    }
    
  } catch (error) {
    console.error('V3 Test error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}

/**
 * Test stat conversion for a specific player
 */
async function testStatConversion(playerName) {
  // Get FFH stats data
  const ffhStatsData = await ffhStatsService.fetchCurrentSeasonStats();
  
  // Get Sleeper scoring settings
  const sleeperScoring = await fetchSleeperScoringSettings();
  
  // Initialize V3 engine
  await sleeperPredictionServiceV3.initialize(sleeperScoring, ffhStatsService);
  
  // Test the conversion
  const result = sleeperPredictionServiceV3.testStatConversion(playerName, ffhStatsData);
  
  return NextResponse.json({
    success: true,
    testResult: result,
    comparisonToAverages: await compareToPositionalAverages(result.player.position, result.sleeperBonus.weightedStats)
  });
}

/**
 * Batch test multiple representative players
 */
async function batchTestPlayers() {
  const testPlayers = [
    'Mateta',     // Forward
    'Rice',       // Defensive Midfielder  
    'Fernandes',  // Creative Midfielder
    'Pope',       // Goalkeeper
    'Tarkowski'   // Defender
  ];
  
  const ffhStatsData = await ffhStatsService.fetchCurrentSeasonStats();
  const sleeperScoring = await fetchSleeperScoringSettings();
  
  await sleeperPredictionServiceV3.initialize(sleeperScoring, ffhStatsService);
  
  const results = sleeperPredictionServiceV3.batchTestConversion(testPlayers, ffhStatsData);
  
  return NextResponse.json({
    success: true,
    batchResults: results,
    summary: createBatchSummary(results)
  });
}

/**
 * Test position-specific analysis
 */
async function testPositionAnalysis(positionId) {
  const ffhStatsData = await ffhStatsService.fetchCurrentSeasonStats();
  const sleeperScoring = await fetchSleeperScoringSettings();
  
  await sleeperPredictionServiceV3.initialize(sleeperScoring, ffhStatsService);
  
  // Get players for this position with enough minutes
  const positionPlayers = ffhStatsData.players
    .filter(p => p.position_id === positionId && p.minutes >= 180)
    .slice(0, 10); // Top 10 by minutes
  
  const results = positionPlayers.map(player => {
    const bonusResult = sleeperPredictionServiceV3.calculateSleeperBonusPoints(player);
    return {
      name: player.web_name,
      team: player.teamContext?.code_name,
      minutes: player.minutes,
      sampleCategory: player.sampleSize.category,
      totalBonusPoints: bonusResult.totalBonusPoints,
      topStats: getTopStatsForPosition(bonusResult.breakdown, positionId)
    };
  });
  
  return NextResponse.json({
    success: true,
    position: getPositionName(positionId),
    playersAnalyzed: results.length,
    results: results.sort((a, b) => b.totalBonusPoints - a.totalBonusPoints)
  });
}

/**
 * Show current Sleeper scoring settings
 */
async function showSleeperScoring() {
  const sleeperScoring = await fetchSleeperScoringSettings();
  
  // Organize by position for readability
  const organizedScoring = {
    goalkeepers: extractPositionScoring(sleeperScoring, 'gk'),
    defenders: extractPositionScoring(sleeperScoring, 'd'),
    midfielders: extractPositionScoring(sleeperScoring, 'm'),
    forwards: extractPositionScoring(sleeperScoring, 'f')
  };
  
  return NextResponse.json({
    success: true,
    sleeperScoring: organizedScoring,
    rawScoring: sleeperScoring
  });
}

/**
 * Helper functions
 */
async function fetchSleeperScoringSettings() {
  try {
    const leagueId = process.env.SLEEPER_LEAGUE_ID || '1240184286171107328';
    const response = await fetch(`https://api.sleeper.app/v1/league/${leagueId}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch Sleeper scoring: ${response.status}`);
    }
    
    const leagueData = await response.json();
    return leagueData.scoring_settings || {};
  } catch (error) {
    console.error('Error fetching Sleeper scoring:', error);
    // Return fallback scoring based on your screenshots
    return {
      'pos_gk_sv': 1,
      'pos_gk_hcs': 1,
      'pos_gk_cs': 5,
      'pos_d_tkw': 1,
      'pos_d_int': 0.5,
      'pos_d_bs': 1,
      'pos_d_cs': 4,
      'pos_m_kp': 1,
      'pos_m_tkw': 0.5,
      'pos_m_int': 1,
      'pos_m_sot': 0.5,
      'pos_f_sot': 1,
      'pos_f_kp': 0.5
    };
  }
}

function compareToPositionalAverages(position, weightedStats) {
  // This would compare the player's weighted stats to position averages
  // For now, just return the weighted stats
  return {
    position: position,
    weightedStats: Object.keys(weightedStats).reduce((acc, key) => {
      acc[key] = Math.round(weightedStats[key] * 100) / 100;
      return acc;
    }, {})
  };
}

function createBatchSummary(results) {
  const successful = results.filter(r => !r.error);
  const failed = results.filter(r => r.error);
  
  return {
    totalTested: results.length,
    successful: successful.length,
    failed: failed.length,
    averageBonusPoints: successful.length > 0 
      ? successful.reduce((sum, r) => sum + r.sleeperBonus.totalBonusPoints, 0) / successful.length
      : 0,
    topBonusEarner: successful.length > 0 
      ? successful.sort((a, b) => b.sleeperBonus.totalBonusPoints - a.sleeperBonus.totalBonusPoints)[0]
      : null
  };
}

function getTopStatsForPosition(breakdown, positionId) {
  const allStats = Object.keys(breakdown);
  
  // Sort by total points and take top 3
  return allStats
    .sort((a, b) => breakdown[b].totalPoints - breakdown[a].totalPoints)
    .slice(0, 3)
    .map(statKey => ({
      stat: statKey,
      per90: breakdown[statKey].per90Rate,
      points: breakdown[statKey].totalPoints
    }));
}

function extractPositionScoring(sleeperScoring, posPrefix) {
  const positionScoring = {};
  
  Object.keys(sleeperScoring).forEach(key => {
    if (key.startsWith(`pos_${posPrefix}_`)) {
      const statName = key.replace(`pos_${posPrefix}_`, '');
      positionScoring[statName] = sleeperScoring[key];
    }
  });
  
  return positionScoring;
}

function getPositionName(positionId) {
  const positions = {
    1: 'Goalkeeper',
    2: 'Defender',
    3: 'Midfielder', 
    4: 'Forward'
  };
  return positions[positionId] || 'Unknown';
}