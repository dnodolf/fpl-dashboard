// app/api/sleeper/route.js
import { NextResponse } from 'next/server';

class SleeperApiService {
  constructor() {
    this.leagueId = process.env.SLEEPER_LEAGUE_ID || '1240184286171107328';
    this.myOwnerName = process.env.MY_OWNER_NAME || 'ThatDerekGuy';
    this.baseUrl = 'https://api.sleeper.app/v1';
  }

  async fetchSleeperRosters() {
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
      return rosters || [];
    } catch (error) {
      console.error('Error fetching Sleeper rosters:', error);
      throw error;
    }
  }

  async fetchSleeperPlayers() {
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
      return players || {};
    } catch (error) {
      console.error('Error fetching Sleeper players:', error);
      throw error;
    }
  }

  async fetchSleeperUsers() {
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
      return users || [];
    } catch (error) {
      console.error('Error fetching Sleeper users:', error);
      throw error;
    }
  }

  async getOwnershipMap() {
    try {
      const [rosters, users] = await Promise.all([
        this.fetchSleeperRosters(),
        this.fetchSleeperUsers()
      ]);

      // Create user lookup map
      const userMap = users.reduce((map, user) => {
        map[user.user_id] = user.display_name || user.username || 'Unknown';
        return map;
      }, {});

      // Create ownership map
      const ownershipMap = {};
      
      rosters.forEach(roster => {
        const ownerName = userMap[roster.owner_id] || 'Unknown Owner';
        
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

  // Transform Sleeper player data to our format
  transformSleeperPlayers(playersData, ownershipMap = {}) {
    return Object.entries(playersData).map(([playerId, player]) => ({
      sleeper_id: playerId,
      name: player.full_name || '',
      first_name: player.first_name || '',
      last_name: player.last_name || '',
      position: this.mapSleeperPosition(player.fantasy_positions?.[0] || player.position),
      team: player.team_abbr || '',
      owned_by: ownershipMap[playerId] || '',
      is_available: !ownershipMap[playerId],
      opta_id: player.opta_id || '',
      rotowire_id: player.rotowire_id || '',
      
      // Raw Sleeper data
      fantasy_positions: player.fantasy_positions || [],
      injury_status: player.injury_status || '',
      years_exp: player.years_exp || 0,
      weight: player.weight || '',
      height: player.height || '',
      age: player.age || 0
    }));
  }

  mapSleeperPosition(position) {
    const positionMap = {
      'G': 'GKP',
      'D': 'DEF',
      'M': 'MID', 
      'F': 'FWD'
    };
    return positionMap[position] || position || 'Unknown';
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
        const players = await sleeperService.fetchSleeperPlayers();
        let ownershipMap = {};
        
        if (includeOwnership) {
          try {
            const ownership = await sleeperService.getOwnershipMap();
            ownershipMap = ownership.ownershipMap;
          } catch (ownershipError) {
            console.warn('Could not fetch ownership data:', ownershipError.message);
          }
        }

        const transformedPlayers = sleeperService.transformSleeperPlayers(players, ownershipMap);

        return NextResponse.json({
          success: true,
          players: transformedPlayers,
          count: transformedPlayers.length,
          source: 'Sleeper API',
          hasOwnership: includeOwnership && Object.keys(ownershipMap).length > 0,
          ownershipCount: Object.keys(ownershipMap).length,
          lastUpdated: new Date().toISOString()
        });

      case 'rosters':
        const rosters = await sleeperService.fetchSleeperRosters();
        return NextResponse.json({
          success: true,
          rosters,
          count: rosters.length,
          lastUpdated: new Date().toISOString()
        });

      case 'users':
        const users = await sleeperService.fetchSleeperUsers();
        return NextResponse.json({
          success: true,
          users,
          count: users.length,
          lastUpdated: new Date().toISOString()
        });

      case 'ownership':
        const ownership = await sleeperService.getOwnershipMap();
        return NextResponse.json({
          success: true,
          data: ownership.ownershipMap,
          rosters: ownership.rosters,
          users: ownership.users,
          count: Object.keys(ownership.ownershipMap).length,
          lastUpdated: new Date().toISOString()
        });

      case 'scoring':
        const scoring = await sleeperService.getScoringSettings();
        return NextResponse.json({
          success: true,
          settings: scoring,
          lastUpdated: new Date().toISOString()
        });

      default:
        return NextResponse.json({
          success: false,
          error: `Unknown endpoint: ${endpoint}. Available: players, rosters, users, ownership, scoring`
        }, { status: 400 });
    }

  } catch (error) {
    console.error('Sleeper API route error:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      details: 'Check SLEEPER_LEAGUE_ID environment variable'
    }, { status: 500 });
  }
}