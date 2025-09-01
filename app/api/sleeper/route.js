// app/api/sleeper/route.js
// Updated to use unified position utilities - SLEEPER AUTHORITY

import { NextResponse } from 'next/server';
import { mapSleeperPosition, normalizePosition } from '../../../utils/positionUtils.js';

class SleeperApiService {
  constructor() {
    this.baseUrl = 'https://api.sleeper.app/v1';
    this.leagueId = process.env.SLEEPER_LEAGUE_ID || '1240184286171107328';
  }

  async getAllPlayers() {
    try {
      const response = await fetch(`${this.baseUrl}/players/clubsoccer:epl`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store'
      });

      if (!response.ok) {
        throw new Error(`Sleeper players API failed: ${response.status} ${response.statusText}`);
      }

      const players = await response.json();
      return players;
    } catch (error) {
      console.error('Error fetching Sleeper players:', error);
      throw error;
    }
  }

  async getLeagueRosters() {
    try {
      const response = await fetch(`${this.baseUrl}/league/${this.leagueId}/rosters`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store'
      });

      if (!response.ok) {
        throw new Error(`Sleeper rosters API failed: ${response.status} ${response.statusText}`);
      }

      const rosters = await response.json();
      return rosters;
    } catch (error) {
      console.error('Error fetching Sleeper rosters:', error);
      throw error;
    }
  }

  async getLeagueUsers() {
    try {
      const response = await fetch(`${this.baseUrl}/league/${this.leagueId}/users`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store'
      });

      if (!response.ok) {
        throw new Error(`Sleeper users API failed: ${response.status} ${response.statusText}`);
      }

      const users = await response.json();
      return users;
    } catch (error) {
      console.error('Error fetching Sleeper users:', error);
      throw error;
    }
  }

  async createOwnershipMap() {
    try {
      const [rosters, users] = await Promise.all([
        this.getLeagueRosters(),
        this.getLeagueUsers()
      ]);

      const ownershipMap = {};
      const userMap = {};

      // Create user ID to name mapping
      users.forEach(user => {
        userMap[user.user_id] = user.display_name || user.username || 'Unknown';
      });

      // Map each player to their owner
      rosters.forEach(roster => {
        const ownerName = userMap[roster.owner_id] || 'Unknown';
        if (roster.players && Array.isArray(roster.players)) {
          roster.players.forEach(playerId => {
            ownershipMap[playerId] = ownerName;
          });
        }
      });

      return {
        ownershipMap,
        rosters,
        users,
        userMap
      };
    } catch (error) {
      console.error('Error creating ownership map:', error);
      throw error;
    }
  }

  async getScoringSettings() {
    try {
      const response = await fetch(`${this.baseUrl}/league/${this.leagueId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store'
      });

      if (!response.ok) {
        throw new Error(`Sleeper league API failed: ${response.status} ${response.statusText}`);
      }

      const league = await response.json();
      return league.scoring_settings || {};
    } catch (error) {
      console.error('Error fetching Sleeper scoring settings:', error);
      throw error;
    }
  }

  // Transform Sleeper player data to our format using unified position logic
  transformSleeperPlayers(playersData, ownershipMap = {}) {
    return Object.entries(playersData).map(([playerId, player]) => ({
      sleeper_id: playerId,
      name: player.full_name || '',
      first_name: player.first_name || '',
      last_name: player.last_name || '',
      position: normalizePosition(player), // Use unified position logic
      team: player.team_abbr || '',
      owned_by: ownershipMap[playerId] || '',
      is_available: !ownershipMap[playerId],
      opta_id: player.opta_id || '',
      rotowire_id: player.rotowire_id || '',
      
      // Raw Sleeper data (preserved for debugging)
      fantasy_positions: player.fantasy_positions || [],
      sleeper_raw_position: player.position || '', // Keep original for reference
      injury_status: player.injury_status || '',
      years_exp: player.years_exp || 0,
      weight: player.weight || '',
      height: player.height || '',
      age: player.age || 0
    }));
  }
}

const sleeperService = new SleeperApiService();

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const endpoint = searchParams.get('endpoint') || 'players';
    const includeOwnership = searchParams.get('ownership') !== 'false';

    console.log(`Sleeper API request: endpoint=${endpoint}, ownership=${includeOwnership}`);

    switch (endpoint) {
      case 'players':
        const players = await sleeperService.getAllPlayers();
        let result = { players, total: Object.keys(players).length };

        if (includeOwnership) {
          const ownershipData = await sleeperService.createOwnershipMap();
          const transformedPlayers = sleeperService.transformSleeperPlayers(players, ownershipData.ownershipMap);
          
          result = {
            players: transformedPlayers,
            total: transformedPlayers.length,
            ownership: ownershipData.ownershipMap,
            rosters: ownershipData.rosters,
            users: ownershipData.users
          };
        }

        return NextResponse.json({
          success: true,
          data: result,
          timestamp: new Date().toISOString()
        });

      case 'rosters':
        const rosters = await sleeperService.getLeagueRosters();
        return NextResponse.json({
          success: true,
          data: { rosters },
          timestamp: new Date().toISOString()
        });

      case 'users':
        const users = await sleeperService.getLeagueUsers();
        return NextResponse.json({
          success: true,
          data: { users },
          timestamp: new Date().toISOString()
        });

      case 'scoring':
        const scoring = await sleeperService.getScoringSettings();
        return NextResponse.json({
          success: true,
          data: { scoring },
          timestamp: new Date().toISOString()
        });

      default:
        return NextResponse.json({
          success: false,
          error: `Unknown endpoint: ${endpoint}`,
          available: ['players', 'rosters', 'users', 'scoring']
        }, { status: 400 });
    }

  } catch (error) {
    console.error('Sleeper API error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function POST(request) {
  // Forward POST requests to GET for simplicity
  return GET(request);
}