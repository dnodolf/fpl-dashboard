// app/api/matchup/route.js
import { NextResponse } from 'next/server';
import { sleeperApiService } from '../../services/sleeperApiService';

export async function POST(request) {
  try {
    const { userId, week, scoringMode = 'ffh' } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId is required' },
        { status: 400 }
      );
    }

    if (!week) {
      return NextResponse.json(
        { success: false, error: 'week is required' },
        { status: 400 }
      );
    }

    console.log(`🏆 Matchup API: Fetching matchup for user ${userId}, week ${week}, scoring: ${scoringMode}`);

    // Get matchup data from Sleeper
    const matchupData = await sleeperApiService.getUserMatchup(userId, week);

    // Get all players data to enrich the matchup
    const sleeperPlayers = await sleeperApiService.getPlayers();

    // Fetch integrated player data with predictions
    const integratedResponse = await fetch(`${request.nextUrl.origin}/api/integrated-players`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ forceRefresh: false })
    });

    if (!integratedResponse.ok) {
      throw new Error('Failed to fetch integrated player data');
    }

    const integratedData = await integratedResponse.json();
    const playerPredictions = integratedData.players || [];

    // Create a map of player predictions by sleeper_id
    const predictionMap = {};
    playerPredictions.forEach(p => {
      if (p.sleeper_id) {
        predictionMap[p.sleeper_id] = p;
      }
    });

    // Enrich user starters with player data and predictions
    const enrichPlayer = (playerId) => {
      const sleeperPlayer = sleeperPlayers[playerId] || {};
      const predictions = predictionMap[playerId] || {};

      return {
        sleeper_id: playerId,
        name: sleeperPlayer.full_name || predictions.name || 'Unknown',
        first_name: sleeperPlayer.first_name || '',
        last_name: sleeperPlayer.last_name || '',
        position: sleeperPlayer.fantasy_positions?.[0] || predictions.position || '',
        team: sleeperPlayer.team_abbr || predictions.team || '',
        team_abbr: sleeperPlayer.team_abbr || predictions.team_abbr || '',
        opponent: predictions.opponent || '',
        injury_status: sleeperPlayer.injury_status || predictions.injury_status || '',

        // Predictions (FFH)
        current_gw_prediction: predictions.current_gw_prediction || 0,
        season_prediction_avg: predictions.season_prediction_avg || 0,
        predicted_points: predictions.predicted_points || 0,

        // V3 Scoring
        v3_current_gw: predictions.v3_current_gw || 0,
        v3_season_avg: predictions.v3_season_avg || 0,
        v3_season_total: predictions.v3_season_total || 0,

        // News
        news: predictions.news || '',

        // Additional data
        opta_id: sleeperPlayer.opta_id || predictions.opta_id || '',
        web_name: predictions.web_name || sleeperPlayer.last_name || '',
        full_name: sleeperPlayer.full_name || predictions.name || ''
      };
    };

    const userStarters = (matchupData.userRoster.starters || []).map(enrichPlayer);
    const opponentStarters = (matchupData.opponentRoster.starters || []).map(enrichPlayer);

    // Calculate projected points based on scoring mode
    const calculateProjectedPoints = (players) => {
      return players.reduce((sum, player) => {
        const points = scoringMode === 'v3'
          ? (player.v3_current_gw || 0)
          : (player.current_gw_prediction || 0);
        return sum + points;
      }, 0);
    };

    const userProjectedPoints = calculateProjectedPoints(userStarters);
    const opponentProjectedPoints = calculateProjectedPoints(opponentStarters);

    // Calculate win probability (simple linear scale based on point difference)
    const totalProjected = userProjectedPoints + opponentProjectedPoints;
    const userWinProbability = totalProjected > 0
      ? (userProjectedPoints / totalProjected) * 100
      : 50;

    const response = {
      success: true,
      week,
      scoringMode,
      user: {
        userId: matchupData.userRoster.owner_id,
        displayName: matchupData.userRoster.displayName || 'You',
        rosterId: matchupData.userRoster.roster_id,
        record: {
          wins: matchupData.userRoster.settings?.wins || 0,
          losses: matchupData.userRoster.settings?.losses || 0,
          ties: matchupData.userRoster.settings?.ties || 0
        },
        starters: userStarters,
        projectedPoints: userProjectedPoints,
        actualPoints: matchupData.userRoster.points || 0
      },
      opponent: {
        userId: matchupData.opponentRoster.owner_id,
        displayName: matchupData.opponentRoster.displayName || 'Opponent',
        rosterId: matchupData.opponentRoster.roster_id,
        record: {
          wins: matchupData.opponentRoster.settings?.wins || 0,
          losses: matchupData.opponentRoster.settings?.losses || 0,
          ties: matchupData.opponentRoster.settings?.ties || 0
        },
        starters: opponentStarters,
        projectedPoints: opponentProjectedPoints,
        actualPoints: matchupData.opponentRoster.points || 0
      },
      winProbability: {
        user: userWinProbability,
        opponent: 100 - userWinProbability
      }
    };

    console.log(`✅ Matchup API: ${response.user.displayName} (${userProjectedPoints.toFixed(1)}) vs ${response.opponent.displayName} (${opponentProjectedPoints.toFixed(1)})`);

    return NextResponse.json(response);

  } catch (error) {
    console.error('❌ Matchup API Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch matchup data',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
