// app/api/test-ffh-stats/route.js
// Test route to validate FFH Stats Service

import { NextResponse } from 'next/server';
import ffhStatsService from '../../services/ffhStatsService.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'overview';
    
    console.log(`🧪 FFH Stats Test: Action=${action}`);
    
    switch (action) {
      case 'overview':
        return await handleOverview();
        
      case 'player':
        const playerName = searchParams.get('name') || 'Mateta';
        return await handlePlayerDetail(playerName);
        
      case 'position':
        const positionId = parseInt(searchParams.get('position')) || 3;
        return await handlePositionAnalysis(positionId);
        
      case 'sample':
        return await handleSampleAnalysis();
        
      case 'cache':
        return await handleCacheStatus();
        
      default:
        return NextResponse.json({
          error: 'Invalid action',
          availableActions: ['overview', 'player', 'position', 'sample', 'cache']
        }, { status: 400 });
    }
    
  } catch (error) {
    console.error('FFH Stats Test error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}

/**
 * Overview of the stats service
 */
async function handleOverview() {
  const stats = await ffhStatsService.fetchCurrentSeasonStats();
  
  // Calculate some basic analytics
  const analytics = analyzeStatsOverview(stats);
  
  return NextResponse.json({
    success: true,
    overview: {
      totalPlayers: stats.totalPlayers,
      lastUpdated: stats.lastUpdated,
      dataSource: stats.dataSource
    },
    analytics: analytics,
    samplePlayers: stats.players.slice(0, 3).map(p => ({
      name: p.web_name,
      position: p.position_id,
      minutes: p.minutes,
      sampleSize: p.sampleSize.category,
      keyStats: {
        shots_on_target_per_90: p.per90.shots_on_target_per_90.toFixed(2),
        key_pass_per_90: p.per90.key_pass_per_90.toFixed(2),
        tackles_won_per_90: p.per90.tackles_won_per_90.toFixed(2)
      }
    }))
  });
}

/**
 * Detailed player analysis
 */
async function handlePlayerDetail(playerName) {
  const stats = await ffhStatsService.fetchCurrentSeasonStats();
  
  const player = stats.players.find(p => 
    p.web_name.toLowerCase().includes(playerName.toLowerCase())
  );
  
  if (!player) {
    return NextResponse.json({
      success: false,
      error: `Player '${playerName}' not found`,
      suggestion: 'Try partial names like "Salah" or "Haaland"'
    }, { status: 404 });
  }
  
  // Calculate potential Sleeper bonus points
  const sleeperAnalysis = calculateSleeperBonusPreview(player);
  
  return NextResponse.json({
    success: true,
    player: {
      basic: {
        name: player.web_name,
        position: getPositionName(player.position_id),
        team: player.teamContext?.code_name,
        cost: player.now_cost,
        status: player.status
      },
      seasonStats: {
        minutes: player.minutes,
        appearances: player.appearances,
        starts: player.starts,
        goals: player.goals,
        assists: player.assists,
        clean_sheets: player.clean_sheets
      },
      sleeperStats: {
        shots_on_target: player.shots_on_target,
        key_pass: player.key_pass,
        tackles_won: player.tackles_won,
        intercepts: player.intercepts,
        saves: player.saves,
        succ_drib: player.succ_drib
      },
      per90Stats: player.per90,
      sampleSize: player.sampleSize,
      teamContext: player.teamContext,
      sleeperAnalysis: sleeperAnalysis
    }
  });
}

/**
 * Position-based analysis
 */
async function handlePositionAnalysis(positionId) {
  const stats = await ffhStatsService.fetchCurrentSeasonStats();
  const averages = await ffhStatsService.getPositionalAverages();
  
  const positionPlayers = stats.players
    .filter(p => p.position_id === positionId && p.sampleSize.category !== 'small')
    .sort((a, b) => b.minutes - a.minutes);
  
  const topPerformers = getTopPerformers(positionPlayers, positionId);
  
  return NextResponse.json({
    success: true,
    position: {
      id: positionId,
      name: getPositionName(positionId),
      totalPlayers: positionPlayers.length,
      averages: averages[positionId],
      topPerformers: topPerformers,
      samplePlayers: positionPlayers.slice(0, 5).map(p => ({
        name: p.web_name,
        team: p.teamContext?.code_name,
        minutes: p.minutes,
        keyStats: getKeyStatsForPosition(p, positionId)
      }))
    }
  });
}

/**
 * Sample size analysis
 */
async function handleSampleAnalysis() {
  const stats = await ffhStatsService.fetchCurrentSeasonStats();
  
  const sampleSizeBreakdown = {
    small: stats.players.filter(p => p.sampleSize.category === 'small').length,
    medium: stats.players.filter(p => p.sampleSize.category === 'medium').length,
    large: stats.players.filter(p => p.sampleSize.category === 'large').length
  };
  
  const lowMinutesPlayers = stats.players
    .filter(p => p.minutes < 270 && p.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes)
    .slice(0, 10);
  
  return NextResponse.json({
    success: true,
    sampleAnalysis: {
      breakdown: sampleSizeBreakdown,
      totalPlayers: stats.totalPlayers,
      percentages: {
        small: ((sampleSizeBreakdown.small / stats.totalPlayers) * 100).toFixed(1),
        medium: ((sampleSizeBreakdown.medium / stats.totalPlayers) * 100).toFixed(1),
        large: ((sampleSizeBreakdown.large / stats.totalPlayers) * 100).toFixed(1)
      },
      lowMinutesPlayers: lowMinutesPlayers.map(p => ({
        name: p.web_name,
        position: getPositionName(p.position_id),
        minutes: p.minutes,
        appearances: p.appearances,
        reliability: p.sampleSize.reliability
      }))
    }
  });
}

/**
 * Cache status
 */
async function handleCacheStatus() {
  const cacheStatus = ffhStatsService.getCacheStatus();
  
  return NextResponse.json({
    success: true,
    cache: {
      ...cacheStatus,
      ageMinutes: cacheStatus.age ? Math.floor(cacheStatus.age / (1000 * 60)) : null
    }
  });
}

/**
 * Helper functions
 */
function analyzeStatsOverview(stats) {
  const players = stats.players;
  
  return {
    positionBreakdown: {
      goalkeepers: players.filter(p => p.position_id === 1).length,
      defenders: players.filter(p => p.position_id === 2).length,
      midfielders: players.filter(p => p.position_id === 3).length,
      forwards: players.filter(p => p.position_id === 4).length
    },
    sampleSizes: {
      reliable: players.filter(p => p.sampleSize.category === 'large').length,
      moderate: players.filter(p => p.sampleSize.category === 'medium').length,
      limited: players.filter(p => p.sampleSize.category === 'small').length
    },
    highActivity: {
      topSavers: players.filter(p => p.per90.saves_per_90 > 3).length,
      topTacklers: players.filter(p => p.per90.tackles_won_per_90 > 2).length,
      topCreators: players.filter(p => p.per90.key_pass_per_90 > 1.5).length
    }
  };
}

function calculateSleeperBonusPreview(player) {
  // Rough estimation using common Sleeper scoring values
  const sleeperScoring = {
    saves: 1.0,
    tackles_won: 1.0,
    intercepts: 0.5,
    key_pass: 1.0,
    shots_on_target: 1.0,
    succ_drib: 0.5
  };
  
  const bonusPerGame = 
    (player.per90.saves_per_90 * sleeperScoring.saves) +
    (player.per90.tackles_won_per_90 * sleeperScoring.tackles_won) +
    (player.per90.intercepts_per_90 * sleeperScoring.intercepts) +
    (player.per90.key_pass_per_90 * sleeperScoring.key_pass) +
    (player.per90.shots_on_target_per_90 * sleeperScoring.shots_on_target) +
    (player.per90.succ_drib_per_90 * sleeperScoring.succ_drib);
  
  return {
    estimatedBonusPerGame: Math.round(bonusPerGame * 100) / 100,
    breakdown: {
      saves: Math.round(player.per90.saves_per_90 * sleeperScoring.saves * 100) / 100,
      tackles: Math.round(player.per90.tackles_won_per_90 * sleeperScoring.tackles_won * 100) / 100,
      intercepts: Math.round(player.per90.intercepts_per_90 * sleeperScoring.intercepts * 100) / 100,
      keyPasses: Math.round(player.per90.key_pass_per_90 * sleeperScoring.key_pass * 100) / 100,
      shotsOnTarget: Math.round(player.per90.shots_on_target_per_90 * sleeperScoring.shots_on_target * 100) / 100
    }
  };
}

function getTopPerformers(players, positionId) {
  switch (positionId) {
    case 1: // GKP
      return {
        topSavers: players
          .sort((a, b) => b.per90.saves_per_90 - a.per90.saves_per_90)
          .slice(0, 3)
          .map(p => ({ name: p.web_name, saves_per_90: p.per90.saves_per_90.toFixed(2) })),
        topCSRate: players
          .sort((a, b) => b.per90.clean_sheet_rate - a.per90.clean_sheet_rate)
          .slice(0, 3)
          .map(p => ({ name: p.web_name, cs_rate: (p.per90.clean_sheet_rate * 100).toFixed(1) }))
      };
      
    case 2: // DEF
      return {
        topTacklers: players
          .sort((a, b) => b.per90.tackles_won_per_90 - a.per90.tackles_won_per_90)
          .slice(0, 3)
          .map(p => ({ name: p.web_name, tackles_per_90: p.per90.tackles_won_per_90.toFixed(2) })),
        topInterceptors: players
          .sort((a, b) => b.per90.intercepts_per_90 - a.per90.intercepts_per_90)
          .slice(0, 3)
          .map(p => ({ name: p.web_name, intercepts_per_90: p.per90.intercepts_per_90.toFixed(2) }))
      };
      
    case 3: // MID
      return {
        topCreators: players
          .sort((a, b) => b.per90.key_pass_per_90 - a.per90.key_pass_per_90)
          .slice(0, 3)
          .map(p => ({ name: p.web_name, key_pass_per_90: p.per90.key_pass_per_90.toFixed(2) })),
        topTacklers: players
          .sort((a, b) => b.per90.tackles_won_per_90 - a.per90.tackles_won_per_90)
          .slice(0, 3)
          .map(p => ({ name: p.web_name, tackles_per_90: p.per90.tackles_won_per_90.toFixed(2) }))
      };
      
    case 4: // FWD
      return {
        topShooters: players
          .sort((a, b) => b.per90.shots_on_target_per_90 - a.per90.shots_on_target_per_90)
          .slice(0, 3)
          .map(p => ({ name: p.web_name, shots_ot_per_90: p.per90.shots_on_target_per_90.toFixed(2) })),
        topDribblers: players
          .sort((a, b) => b.per90.succ_drib_per_90 - a.per90.succ_drib_per_90)
          .slice(0, 3)
          .map(p => ({ name: p.web_name, dribbles_per_90: p.per90.succ_drib_per_90.toFixed(2) }))
      };
      
    default:
      return {};
  }
}

function getKeyStatsForPosition(player, positionId) {
  switch (positionId) {
    case 1: // GKP
      return {
        saves_per_90: player.per90.saves_per_90.toFixed(2),
        clean_sheet_rate: (player.per90.clean_sheet_rate * 100).toFixed(1) + '%'
      };
    case 2: // DEF
      return {
        tackles_per_90: player.per90.tackles_won_per_90.toFixed(2),
        intercepts_per_90: player.per90.intercepts_per_90.toFixed(2),
        blocks_per_90: player.per90.blocks_per_90.toFixed(2)
      };
    case 3: // MID
      return {
        key_pass_per_90: player.per90.key_pass_per_90.toFixed(2),
        tackles_per_90: player.per90.tackles_won_per_90.toFixed(2),
        shots_ot_per_90: player.per90.shots_on_target_per_90.toFixed(2)
      };
    case 4: // FWD
      return {
        shots_ot_per_90: player.per90.shots_on_target_per_90.toFixed(2),
        key_pass_per_90: player.per90.key_pass_per_90.toFixed(2),
        goals_per_90: player.per90.goals_per_90.toFixed(2)
      };
    default:
      return {};
  }
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