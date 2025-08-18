// app/api/debug-matching/route.js
import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const baseUrl = new URL(request.url).origin;
    
    console.log('🔍 DEBUGGING PLAYER MATCHING SYSTEM');
    
    // Step 1: Check individual APIs
    console.log('\n--- STEP 1: Testing Individual APIs ---');
    
    // Test Sleeper API
    const sleeperResponse = await fetch(`${baseUrl}/api/sleeper?endpoint=players&ownership=true`);
    const sleeperResult = await sleeperResponse.json();
    
    console.log('Sleeper API Result:', {
      success: sleeperResult.success,
      playerCount: sleeperResult.players?.length || 0,
      hasOwnership: sleeperResult.hasOwnership,
      ownershipCount: sleeperResult.ownershipCount,
      samplePlayer: sleeperResult.players?.[0] ? {
        name: sleeperResult.players[0].name,
        position: sleeperResult.players[0].position,
        team: sleeperResult.players[0].team,
        owned_by: sleeperResult.players[0].owned_by
      } : 'No players'
    });
    
    // Test FFH API
    const ffhResponse = await fetch(`${baseUrl}/api/ffh/players`);
    const ffhResult = await ffhResponse.json();
    
    console.log('FFH API Result:', {
      success: ffhResult.success,
      playerCount: ffhResult.players?.length || 0,
      source: ffhResult.source,
      samplePlayer: ffhResult.players?.[0] ? {
        name: ffhResult.players[0].web_name || ffhResult.players[0].name,
        position: ffhResult.players[0].element_type,
        team: ffhResult.players[0].team_short_name,
        points: ffhResult.players[0].total_points
      } : 'No players'
    });
    
    // Step 2: Test integrated matching
    console.log('\n--- STEP 2: Testing Integrated Matching ---');
    
    const integratedResponse = await fetch(`${baseUrl}/api/integrated-players`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        includeMatching: true,
        includeScoring: true,
        forceRefresh: true
      })
    });
    
    const integratedResult = await integratedResponse.json();
    
    console.log('Integrated API Result:', {
      success: integratedResult.success,
      playerCount: integratedResult.players?.length || 0,
      integration: integratedResult.integration,
      quality: integratedResult.quality,
      sampleIntegratedPlayer: integratedResult.players?.[0] ? {
        name: integratedResult.players[0].name,
        position: integratedResult.players[0].position,
        team: integratedResult.players[0].team,
        match_confidence: integratedResult.players[0].match_confidence,
        sleeper_season_total: integratedResult.players[0].sleeper_season_total
      } : 'No players'
    });
    
    // Step 3: Detailed matching analysis
    if (sleeperResult.success && ffhResult.success && sleeperResult.players && ffhResult.players) {
      console.log('\n--- STEP 3: Detailed Matching Analysis ---');
      
      const sleeperSample = sleeperResult.players.slice(0, 10);
      const ffhSample = ffhResult.players.slice(0, 10);
      
      console.log('Sleeper Sample Players:');
      sleeperSample.forEach((p, i) => {
        console.log(`  ${i+1}. ${p.name || p.full_name} | ${p.position} | ${p.team} | ${p.owned_by || 'Free'}`);
      });
      
      console.log('FFH Sample Players:');
      ffhSample.forEach((p, i) => {
        console.log(`  ${i+1}. ${p.web_name || p.name} | ${p.element_type} | ${p.team_short_name} | ${p.total_points}pts`);
      });
      
      // Test a specific match
      const testSleeper = sleeperSample[0];
      const potentialFFHMatches = ffhResult.players.filter(ffh => {
        const ffhName = (ffh.web_name || ffh.name || '').toLowerCase();
        const sleeperName = (testSleeper.name || testSleeper.full_name || '').toLowerCase();
        return ffhName.includes(sleeperName.split(' ')[0]) || sleeperName.includes(ffhName.split(' ')[0]);
      });
      
      console.log(`\nTest Match for "${testSleeper.name || testSleeper.full_name}":`);
      console.log(`  Potential FFH matches found: ${potentialFFHMatches.length}`);
      potentialFFHMatches.slice(0, 3).forEach(match => {
        console.log(`    - ${match.web_name || match.name} (${match.team_short_name})`);
      });
    }
    
    return NextResponse.json({
      success: true,
      debug: {
        sleeper: {
          success: sleeperResult.success,
          count: sleeperResult.players?.length || 0,
          hasOwnership: sleeperResult.hasOwnership,
          sampleNames: sleeperResult.players?.slice(0, 5).map(p => p.name || p.full_name) || []
        },
        ffh: {
          success: ffhResult.success,
          count: ffhResult.players?.length || 0,
          sampleNames: ffhResult.players?.slice(0, 5).map(p => p.web_name || p.name) || []
        },
        integrated: {
          success: integratedResult.success,
          count: integratedResult.players?.length || 0,
          matchingStats: integratedResult.integration?.matchingStats,
          qualityStats: integratedResult.quality
        }
      },
      recommendations: [
        integratedResult.players?.length < 50 ? 'LOW_MATCH_COUNT: Matching may be too restrictive' : 'MATCH_COUNT_OK',
        sleeperResult.players?.length < 100 ? 'LOW_SLEEPER_COUNT: Check Sleeper API' : 'SLEEPER_OK',
        ffhResult.players?.length < 100 ? 'LOW_FFH_COUNT: Check FFH API' : 'FFH_OK'
      ],
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Debug error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      debug: 'Failed to run debug analysis'
    }, { status: 500 });
  }
}