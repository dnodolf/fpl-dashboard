// app/api/players/route.js
import { NextResponse } from 'next/server';
import { enhancedDataService } from '../../services/enhancedDataService';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const source = searchParams.get('source') || 'auto';
    const refresh = searchParams.get('refresh') === 'true';
    const includeMatching = searchParams.get('matching') === 'true';

    console.log(`Fetching player data: source=${source}, refresh=${refresh}, matching=${includeMatching}`);

    // Get player data using enhanced service
    const playerData = await enhancedDataService.fetchPlayerData(source, refresh);

    // Add ownership data from Sleeper if requested
    if (includeMatching || source === 'auto') {
      try {
        // Fetch Sleeper ownership data
        const ownershipResponse = await fetch(
          new URL('/api/sleeper?endpoint=ownership', request.url)
        );
        
        if (ownershipResponse.ok) {
          const ownershipResult = await ownershipResponse.json();
          if (ownershipResult.success) {
            // Merge ownership data with player data
            playerData.players = playerData.players.map(player => {
              const ownedBy = ownershipResult.data[player.sleeper_id] || 
                            ownershipResult.data[player.name] || '';
              
              return {
                ...player,
                owned_by: ownedBy,
                is_available: !ownedBy
              };
            });
            
            playerData.ownershipData = true;
          }
        }
      } catch (ownershipError) {
        console.warn('Could not fetch ownership data:', ownershipError.message);
        playerData.ownershipData = false;
      }
    }

    // Add data quality metrics
    const qualityMetrics = enhancedDataService.getDataQuality(playerData.players);

    return NextResponse.json({
      success: true,
      ...playerData,
      quality: qualityMetrics,
      enhanced: true
    });

  } catch (error) {
    console.error('Enhanced players API error:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      players: [],
      fallbackSuggestion: 'Try /api/sheets/players or /api/ffh/players directly'
    }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { action, data } = await request.json();

    switch (action) {
      case 'search':
        const { searchTerm, filters } = data;
        const playerData = await enhancedDataService.fetchPlayerData('auto');
        const searchResults = enhancedDataService.searchPlayers(
          playerData.players, 
          searchTerm, 
          filters
        );
        
        return NextResponse.json({
          success: true,
          players: searchResults,
          total: searchResults.length,
          searchTerm,
          filters
        });

      case 'optimize':
        const { formation, strategy = 'points' } = data;
        const optimizationData = await enhancedDataService.fetchPlayerData('auto');
        const optimization = enhancedDataService.optimizeFormation(
          optimizationData.players, 
          formation, 
          strategy
        );
        
        return NextResponse.json({
          success: true,
          optimization,
          formation,
          strategy
        });

      default:
        return NextResponse.json({
          success: false,
          error: `Unknown action: ${action}. Available: search, optimize`
        }, { status: 400 });
    }

  } catch (error) {
    console.error('Enhanced players POST error:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}