// app/api/test-ffh-detailed/route.js
// Test endpoint to explore FFH API response structure
import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const authStatic = process.env.FFH_AUTH_STATIC;
    const bearerToken = process.env.FFH_BEARER_TOKEN;

    if (!authStatic || !bearerToken) {
      return NextResponse.json({
        error: 'Missing FFH credentials',
        message: 'FFH_AUTH_STATIC and FFH_BEARER_TOKEN must be set'
      }, { status: 500 });
    }

    // Test: Fetch a single player's detailed data
    const url = `https://data.fantasyfootballhub.co.uk/api/player-predictions/?orderBy=points&focus=range&positions=1,2,3,4&min_cost=40&max_cost=145&search_term=Salah&gw_start=9&gw_end=38&first=0&last=1&use_predicted_fixtures=false&selected_players=`;

    console.log('🔍 Testing FFH API detailed response...');
    console.log('URL:', url);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept-Language': 'en-US',
        'Authorization': authStatic,
        'Content-Type': 'application/json',
        'Token': bearerToken
      },
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error(`FFH API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const player = data.results?.[0] || data[0];

    if (!player) {
      return NextResponse.json({
        error: 'No player data returned',
        raw_response: data
      });
    }

    // Analyze structure
    const analysis = {
      player_name: player.web_name || player.name,
      total_fields: Object.keys(player).length,

      // Core prediction fields
      has_predictions_array: !!player.predictions,
      predictions_count: player.predictions?.length || 0,
      prediction_sample: player.predictions?.[0],

      // Check for granular stats
      available_stats: {
        goals_scored: player.goals_scored,
        assists: player.assists,
        clean_sheets: player.clean_sheets,
        saves: player.saves,
        bonus: player.bonus,
        minutes: player.minutes,
        goals_conceded: player.goals_conceded,
        yellow_cards: player.yellow_cards,
        red_cards: player.red_cards,
        own_goals: player.own_goals,
        penalties_missed: player.penalties_missed,
        penalties_saved: player.penalties_saved,
        // Sleeper-specific stats
        tackles: player.tackles,
        interceptions: player.interceptions,
        clearances: player.clearances,
        key_passes: player.key_passes,
        big_chances_created: player.big_chances_created,
        dribbles: player.dribbles,
        shots: player.shots,
        shots_on_target: player.shots_on_target,
        aerials_won: player.aerials_won,
        blocks: player.blocks,
        crosses: player.crosses,
        dispossessed: player.dispossessed,
        fouls: player.fouls,
        offsides: player.offsides
      },

      // All field names
      all_fields: Object.keys(player),

      // Raw first player
      raw_player: player
    };

    return NextResponse.json(analysis, {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });

  } catch (error) {
    console.error('❌ FFH detailed test error:', error);
    return NextResponse.json({
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}
