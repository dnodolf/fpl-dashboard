// app/api/ffh/players/route.js
import { NextResponse } from 'next/server';

// FFH API Service (inline to avoid import issues)
class FFHApiService {
  constructor() {
    this.baseUrl = 'https://data.fantasyfootballhub.co.uk/api';
    this.authStatic = process.env.FFH_AUTH_STATIC || 'r5C(e3.JeS^:_7LF';
    this.bearerToken = process.env.FFH_BEARER_TOKEN;
  }

  getHeaders() {
    return {
      'Accept-Language': 'en-US',
      'Authorization': this.authStatic,
      'Content-Type': 'application/json',
      'Token': this.bearerToken
    };
  }

  async getPlayerPredictions(params = {}) {
    try {
      // Use params from request or defaults
      const first = params.first || 0;
      const last = params.last || 99999;
      
      const url = `${this.baseUrl}/player-predictions/?orderBy=points&focus=range&positions=1,2,3,4&min_cost=40&max_cost=145&search_term=&gw_start=1&gw_end=47&first=${first}&last=${last}&use_predicted_fixtures=false&selected_players=`;
      
      console.log(`🔥 Fetching FFH data from: ${url}`);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders(),
        cache: 'no-store'
      });

      if (!response.ok) {
        throw new Error(`FFH API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data.results || data || [];
    } catch (error) {
      console.error('Error fetching FFH predictions:', error);
      throw new Error(`Failed to fetch FFH predictions: ${error.message}`);
    }
  }

  transformFFHData(ffhPlayers) {
    return ffhPlayers.map(player => ({
      name: player.web_name || player.name || '',
      position: this.mapFFHPosition(player.element_type || player.position),
      team: this.mapFFHTeam(player.team_short_name || player.team),
      ownership: `${Math.round((player.selected_by_percent || 0))}%`,
      price: (player.now_cost || player.cost || 0) / 10,
      predicted_points: player.total_points || player.points || 0,
      sleeper_points: this.convertToSleeperPoints(player.total_points || player.points || 0, player.element_type),
      form: player.form || '',
      owned_by: '',
      is_available: true,
      
      // Additional FFH data
      ffh_id: player.id,
      element_type: player.element_type,
      team_code: player.team_short_name,
      cost: player.now_cost || player.cost,
      minutes: player.minutes || 0,
      goals_scored: player.goals_scored || 0,
      assists: player.assists || 0,
      clean_sheets: player.clean_sheets || 0,
      goals_conceded: player.goals_conceded || 0,
      saves: player.saves || 0,
      bonus: player.bonus || 0,
      
      // Raw FFH data for position matching
      opta_uuid: player.opta_uuid || player.opta_id,
      opta_id: player.opta_id || player.opta_uuid,
      fpl_id: player.id,
      position_id: player.element_type,
      _raw: player
    }));
  }

  mapFFHPosition(elementType) {
    const positionMap = {
      1: 'GKP',
      2: 'DEF', 
      3: 'MID',
      4: 'FWD'
    };
    return positionMap[elementType] || 'Unknown';
  }

  mapFFHTeam(teamCode) {
    const teamMap = {
      'ARS': 'ARS', 'AVL': 'AVL', 'BOU': 'BOU', 'BRE': 'BRE',
      'BHA': 'BHA', 'BUR': 'BUR', 'CHE': 'CHE', 'CRY': 'CRY',
      'EVE': 'EVE', 'FUL': 'FUL', 'LIV': 'LIV', 'LUT': 'LUT',
      'MCI': 'MCI', 'MUN': 'MUN', 'NEW': 'NEW', 'NFO': 'NFO',
      'SHU': 'SHU', 'TOT': 'TOT', 'WHU': 'WHU', 'WOL': 'WOL'
    };
    return teamMap[teamCode] || teamCode;
  }

  convertToSleeperPoints(fplPoints, position) {
    const conversionRatios = {
      1: 1.2,  // GKP
      2: 1.15, // DEF 
      3: 1.1,  // MID
      4: 1.05  // FWD
    };
    
    const ratio = conversionRatios[position] || 1.0;
    return Math.round((fplPoints * ratio) * 10) / 10;
  }
}

const ffhService = new FFHApiService();

export async function GET() {
  try {
    console.log('FFH GET: Fetching player data...');
    
    // Get predictions from FFH
    const predictions = await ffhService.getPlayerPredictions();
    
    if (!predictions || predictions.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No player predictions received from FFH API',
        players: []
      }, { status: 404 });
    }

    // Transform to dashboard format
    const transformedPlayers = ffhService.transformFFHData(predictions);
    
    console.log(`✅ FFH GET: Successfully fetched ${transformedPlayers.length} players`);
    
    return NextResponse.json({
      success: true,
      data: transformedPlayers,
      players: transformedPlayers, // For compatibility
      count: transformedPlayers.length,
      source: 'Fantasy Football Hub',
      lastUpdated: new Date().toISOString()
    });

  } catch (error) {
    console.error('FFH GET route error:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      data: [],
      players: [],
      details: 'Check FFH_BEARER_TOKEN and FFH_AUTH_STATIC in environment variables'
    }, { status: 500 });
  }
}

// NEW: Add POST handler for integrated-players route
export async function POST(request) {
  try {
    console.log('FFH POST: Processing request...');
    
    // Parse request body
    const requestData = await request.json();
    const endpoint = requestData.endpoint || 'player-predictions';
    const params = requestData.params || {};
    
    console.log(`FFH POST: Endpoint=${endpoint}, Params=`, params);
    
    // Only handle player-predictions for now
    if (endpoint !== 'player-predictions') {
      return NextResponse.json({
        success: false,
        error: `Unsupported endpoint: ${endpoint}`,
        data: []
      }, { status: 400 });
    }
    
    // Get predictions from FFH with custom params
    const predictions = await ffhService.getPlayerPredictions(params);
    
    if (!predictions || predictions.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No player predictions received from FFH API',
        data: []
      }, { status: 404 });
    }

    // Return raw FFH data (not transformed) for the integrated-players route
    console.log(`✅ FFH POST: Successfully fetched ${predictions.length} raw players`);
    
    return NextResponse.json({
      success: true,
      data: predictions,
      count: predictions.length,
      source: 'Fantasy Football Hub',
      lastUpdated: new Date().toISOString(),
      totalPlayers: predictions.length
    });

  } catch (error) {
    console.error('FFH POST route error:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      data: [],
      details: 'Check FFH_BEARER_TOKEN and FFH_AUTH_STATIC in environment variables'
    }, { status: 500 });
  }
}

// Health check endpoint
export async function HEAD() {
  try {
    const testUrl = `https://data.fantasyfootballhub.co.uk/api/player-predictions/?first=0&last=1`;
    const response = await fetch(testUrl, {
      method: 'GET',
      headers: {
        'Accept-Language': 'en-US',
        'Authorization': process.env.FFH_AUTH_STATIC || 'r5C(e3.JeS^:_7LF',
        'Content-Type': 'application/json',
        'Token': process.env.FFH_BEARER_TOKEN
      }
    });

    return new NextResponse(null, { 
      status: response.ok ? 200 : 503,
      headers: {
        'X-Health-Status': response.ok ? 'FFH API connection successful' : 'FFH API connection failed'
      }
    });
  } catch (error) {
    return new NextResponse(null, { status: 503 });
  }
}