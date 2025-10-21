// app/api/test-ffh-granular/route.js
// Test endpoint to verify FFH granular stats access
import { NextResponse } from 'next/server';
import ffhDetailedStatsService from '../../services/ffhDetailedStatsService.js';

export async function GET(request) {
  try {
    console.log('🧪 Testing FFH granular stats endpoint...');

    // Test fetching Salah's detailed stats
    const salahStats = await ffhDetailedStatsService.getPlayerDetailedStats('M.Salah', 'name');

    if (!salahStats) {
      return NextResponse.json({
        error: 'Could not fetch Salah stats',
        message: 'Player not found or API error'
      }, { status: 404 });
    }

    // Calculate player profile
    const profile = ffhDetailedStatsService.calculatePlayerProfile(salahStats);

    const response = {
      success: true,
      player: {
        name: salahStats.name,
        full_name: salahStats.full_name,
        position_id: salahStats.position_id,
        team: salahStats.team,
        opta_id: salahStats.opta_id
      },

      predictions_available: salahStats.predictions?.length || 0,
      predictions_sample: salahStats.predictions?.slice(0, 3) || [],

      historical_games: salahStats.historical_stats?.length || 0,
      historical_sample: salahStats.historical_stats?.slice(0, 3) || [],

      season_stats: salahStats.season_stats,

      form_data_fields: Object.keys(salahStats.form_data || {}),

      player_profile: profile,

      // Check what granular stats are actually in predictions
      prediction_fields: salahStats.predictions?.[0] ? Object.keys(salahStats.predictions[0]) : []
    };

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('❌ FFH granular test error:', error);
    return NextResponse.json({
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}
