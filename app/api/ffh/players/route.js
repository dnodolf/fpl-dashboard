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
      'Token': `Bearer ${this.bearerToken}`
    };
  }

  async getPlayerPredictions() {
    try {
      const url = `${this.baseUrl}/player-predictions/?orderBy=points&focus=range&positions=1,2,3,4&min_cost=40&max_cost=145&search_term=&gw_start=1&gw_end=47&first=0&last=99999&use_predicted_fixtures=false&selected_players=`;
      
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
      bonus: player.bonus || 0
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
    console.log('Fetching FFH player data...');
    
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
    
    console.log(`Successfully fetched ${transformedPlayers.length} players from FFH`);
    
    return NextResponse.json({
      success: true,
      players: transformedPlayers,
      count: transformedPlayers.length,
      source: 'Fantasy Football Hub',
      lastUpdated: new Date().toISOString()
    });

  } catch (error) {
    console.error('FFH API route error:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      players: [],
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
        'Token': `Bearer ${process.env.FFH_BEARER_TOKEN}`
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