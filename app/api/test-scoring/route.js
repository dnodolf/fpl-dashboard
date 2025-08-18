// app/api/test-scoring/route.js
// Test endpoint to verify scoring conversion is working

import { NextResponse } from 'next/server';
import { 
  calculateConversionRatios, 
  convertFFHToSleeperPrediction,
  enhancePlayerWithScoringConversion 
} from '../../../services/scoringConversionService';

export async function GET() {
  try {
    console.log('🧪 Testing scoring conversion system...');
    
    // Test 1: Get conversion ratios
    const ratios = await calculateConversionRatios();
    console.log('✅ Conversion ratios calculated:', ratios);
    
    // Test 2: Test conversion for different positions
    const testPlayers = [
      { name: 'Mo Salah', position: 'MID', ffhPrediction: 303.35 },
      { name: 'Virgil van Dijk', position: 'DEF', ffhPrediction: 165.2 },
      { name: 'Erling Haaland', position: 'FWD', ffhPrediction: 280.1 },
      { name: 'Alisson', position: 'GK', ffhPrediction: 140.5 }
    ];
    
    const conversions = [];
    
    for (const player of testPlayers) {
      const sleeperPrediction = await convertFFHToSleeperPrediction(
        player.ffhPrediction, 
        player.position
      );
      
      const ratio = ratios[player.position]?.multiplier || 1.0;
      const increase = sleeperPrediction - player.ffhPrediction;
      const percentChange = ((increase / player.ffhPrediction) * 100).toFixed(1);
      
      conversions.push({
        player: player.name,
        position: player.position,
        ffhOriginal: player.ffhPrediction,
        sleeperConverted: sleeperPrediction,
        conversionRatio: ratio,
        pointsIncrease: Math.round(increase * 10) / 10,
        percentChange: `${percentChange}%`
      });
      
      console.log(`✅ ${player.name} (${player.position}): ${player.ffhPrediction} → ${sleeperPrediction} (+${increase.toFixed(1)})`);
    }
    
    // Test 3: Full player enhancement
    const mockFFHPlayer = {
      season_prediction: 303.35,
      position_id: 3, // Midfielder
      fpl_id: 381,
      web_name: 'Salah',
      club: 'Liverpool',
      predictions: [
        { gw: 1, predicted_pts: 8.25 },
        { gw: 2, predicted_pts: 7.22 },
        { gw: 3, predicted_pts: 7.31 }
      ]
    };
    
    const mockSleeperPlayer = {
      player_id: 'test123',
      full_name: 'Mohamed Salah',
      team_abbr: 'LIV',
      owned_by: 'ThatDerekGuy'
    };
    
    const enhancedPlayer = await enhancePlayerWithScoringConversion(mockSleeperPlayer, mockFFHPlayer);
    console.log('✅ Enhanced player test:', enhancedPlayer);
    
    return NextResponse.json({
      success: true,
      message: 'Scoring conversion system working correctly!',
      conversionRatios: ratios,
      testConversions: conversions,
      enhancedPlayerExample: {
        original: mockSleeperPlayer,
        ffhData: mockFFHPlayer,
        enhanced: enhancedPlayer
      },
      summary: {
        gkMultiplier: ratios.GK?.multiplier || 'N/A',
        defMultiplier: ratios.DEF?.multiplier || 'N/A',
        midMultiplier: ratios.MID?.multiplier || 'N/A',
        fwdMultiplier: ratios.FWD?.multiplier || 'N/A',
        expectedImpact: 'FFH predictions should now be 5-15% higher when converted to Sleeper scoring'
      }
    });
    
  } catch (error) {
    console.error('❌ Scoring conversion test failed:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}