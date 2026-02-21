// app/api/players/route.js
import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const source = searchParams.get('source') || 'auto';
    const refresh = searchParams.get('refresh') === 'true';
    const includeMatching = searchParams.get('matching') === 'true';

    if (process.env.NODE_ENV === 'development') {
      console.log(`Fetching player data: source=${source}, refresh=${refresh}, matching=${includeMatching}`);
    }

    let playerData;
    const baseUrl = new URL(request.url).origin;

    // Route to appropriate data source
    switch (source) {
      case 'sheets':
        const sheetsResponse = await fetch(`${baseUrl}/api/sheets/players`);
        if (!sheetsResponse.ok) {
          throw new Error(`Sheets API error: ${sheetsResponse.status}`);
        }
        playerData = await sheetsResponse.json();
        break;
        
      case 'ffh':
        const ffhResponse = await fetch(`${baseUrl}/api/ffh/players`);
        if (!ffhResponse.ok) {
          throw new Error(`FFH API error: ${ffhResponse.status}`);
        }
        playerData = await ffhResponse.json();
        break;
        
      case 'auto':
      default:
        // Try Google Sheets first, fallback to FFH
        try {
          const sheetsResponse = await fetch(`${baseUrl}/api/sheets/players`);
          if (sheetsResponse.ok) {
            const sheetsResult = await sheetsResponse.json();
            if (sheetsResult.success && sheetsResult.players && sheetsResult.players.length > 0) {
              playerData = sheetsResult;
              playerData.source = 'sheets-primary';
              break;
            }
          }
        } catch (sheetsError) {
          if (process.env.NODE_ENV === 'development') {
            console.warn('Sheets failed, trying FFH:', sheetsError.message);
          }
        }
        
        // Fallback to FFH
        const ffhFallbackResponse = await fetch(`${baseUrl}/api/ffh/players`);
        if (!ffhFallbackResponse.ok) {
          throw new Error(`Both sources failed. Sheets worked but no data, FFH API error: ${ffhFallbackResponse.status}`);
        }
        playerData = await ffhFallbackResponse.json();
        playerData.source = 'ffh-fallback';
        break;
    }

    if (!playerData.success) {
      throw new Error(playerData.error || 'Failed to fetch player data');
    }

    // Add ownership data from Sleeper if requested
    if (includeMatching || source === 'auto') {
      try {
        const ownershipResponse = await fetch(`${baseUrl}/api/sleeper?endpoint=ownership`);
        
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
            playerData.ownershipCount = Object.keys(ownershipResult.data).length;
          }
        }
      } catch (ownershipError) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('Could not fetch ownership data:', ownershipError.message);
        }
        playerData.ownershipData = false;
      }
    }

    // Add simple data quality metrics
    const players = playerData.players || [];
    const quality = {
      totalPlayers: players.length,
      hasName: players.filter(p => p.name).length,
      hasPosition: players.filter(p => p.position).length,
      hasTeam: players.filter(p => p.team).length,
      hasPoints: players.filter(p => p.sleeper_points > 0).length,
      completenessScore: players.length > 0 ? 
        Math.round(((players.filter(p => p.name && p.position && p.team).length / players.length) * 100)) : 0
    };

    return NextResponse.json({
      success: true,
      ...playerData,
      quality,
      enhanced: true,
      timestamp: new Date().toISOString()
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
        
        // Get player data first
        const playersResponse = await fetch('/api/players?source=auto');
        const playersResult = await playersResponse.json();
        
        if (!playersResult.success) {
          throw new Error('Could not fetch player data for search');
        }
        
        // Simple search implementation
        const filteredPlayers = playersResult.players.filter(player => {
          // Search term filter
          if (searchTerm) {
            const term = searchTerm.toLowerCase();
            const searchableFields = [
              player.name || '',
              player.team || '',
              player.position || ''
            ].join(' ').toLowerCase();
            
            if (!searchableFields.includes(term)) {
              return false;
            }
          }

          // Apply filters
          if (filters.position && filters.position !== 'all' && player.position !== filters.position) {
            return false;
          }
          if (filters.team && filters.team !== 'all' && player.team !== filters.team) {
            return false;
          }
          if (filters.minPoints && (player.sleeper_points || 0) < filters.minPoints) {
            return false;
          }

          return true;
        });
        
        return NextResponse.json({
          success: true,
          players: filteredPlayers,
          total: filteredPlayers.length,
          searchTerm,
          filters
        });

      default:
        return NextResponse.json({
          success: false,
          error: `Unknown action: ${action}. Available: search`
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