// app/services/sleeperApiService.js
class SleeperApiService {
  constructor() {
    this.baseUrl = 'https://api.sleeper.app/v1';
    this.leagueId = process.env.SLEEPER_LEAGUE_ID;
  }

  // Get league information
  async getLeague() {
    try {
      const response = await fetch(`${this.baseUrl}/league/${this.leagueId}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Error fetching league:', error);
      throw error;
    }
  }

  // Get all rosters with ownership data
  async getRosters() {
    try {
      const response = await fetch(`${this.baseUrl}/league/${this.leagueId}/rosters`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const rosters = await response.json();
      const users = await this.getUsers();
      
      // Combine rosters with user information
      return rosters.map(roster => ({
        ...roster,
        user: users.find(user => user.user_id === roster.owner_id) || {},
        displayName: users.find(user => user.user_id === roster.owner_id)?.display_name || 'Unknown'
      }));
    } catch (error) {
      console.error('Error fetching rosters:', error);
      throw error;
    }
  }

  // Get league users
  async getUsers() {
    try {
      const response = await fetch(`${this.baseUrl}/league/${this.leagueId}/users`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Error fetching users:', error);
      throw error;
    }
  }

  // Get all EPL players from Sleeper
  async getPlayers() {
    try {
      const response = await fetch(`${this.baseUrl}/players/clubsoccer:epl`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Error fetching Sleeper players:', error);
      throw error;
    }
  }

  // Create ownership map from rosters
  createOwnershipMap(rosters) {
    const ownershipMap = {};
    
    rosters.forEach(roster => {
      if (roster.players) {
        roster.players.forEach(playerId => {
          ownershipMap[playerId] = roster.displayName || 'Unknown';
        });
      }
    });
    
    return ownershipMap;
  }

  // Get league scoring settings
  async getScoringSettings() {
    try {
      const league = await this.getLeague();
      return league.scoring_settings || {};
    } catch (error) {
      console.error('Error fetching scoring settings:', error);
      return {};
    }
  }

  // Get matchups for a specific week
  async getMatchups(week) {
    try {
      const response = await fetch(`${this.baseUrl}/league/${this.leagueId}/matchups/${week}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error(`Error fetching matchups for week ${week}:`, error);
      throw error;
    }
  }

  // Get user's matchup for a specific week
  async getUserMatchup(userId, week) {
    try {
      const [matchups, rosters] = await Promise.all([
        this.getMatchups(week),
        this.getRosters()
      ]);

      // Find user's roster (support both owner_id and displayName)
      const userRoster = rosters.find(r =>
        r.owner_id === userId || r.displayName === userId
      );
      if (!userRoster) {
        throw new Error(`No roster found for user ${userId}`);
      }

      // Find user's matchup by matchup_id
      const userMatchupData = matchups.find(m => m.roster_id === userRoster.roster_id);
      if (!userMatchupData) {
        throw new Error(`No matchup found for roster ${userRoster.roster_id} in week ${week}`);
      }

      // Find opponent's matchup (same matchup_id but different roster_id)
      const opponentMatchupData = matchups.find(
        m => m.matchup_id === userMatchupData.matchup_id && m.roster_id !== userRoster.roster_id
      );

      if (!opponentMatchupData) {
        throw new Error(`No opponent found for matchup ${userMatchupData.matchup_id}`);
      }

      // Find opponent's roster
      const opponentRoster = rosters.find(r => r.roster_id === opponentMatchupData.roster_id);

      return {
        week,
        userRoster: {
          ...userRoster,
          matchupData: userMatchupData,
          points: userMatchupData.points || 0,
          starters: userMatchupData.starters || [],
          players: userMatchupData.players || []
        },
        opponentRoster: {
          ...opponentRoster,
          matchupData: opponentMatchupData,
          points: opponentMatchupData.points || 0,
          starters: opponentMatchupData.starters || [],
          players: opponentMatchupData.players || []
        }
      };
    } catch (error) {
      console.error(`Error fetching user matchup for week ${week}:`, error);
      throw error;
    }
  }

  // Transform Sleeper player data
  transformSleeperData(sleeperPlayers, ownershipMap = {}) {
    return Object.entries(sleeperPlayers).map(([playerId, player]) => ({
      sleeper_id: playerId,
      name: player.full_name || '',
      position: player.fantasy_positions?.[0] || player.position || '',
      team: player.team_abbr || '',
      opta_id: player.opta_id || '',
      owned_by: ownershipMap[playerId] || '',
      is_available: !ownershipMap[playerId],
      
      // Additional Sleeper data
      first_name: player.first_name || '',
      last_name: player.last_name || '',
      fantasy_positions: player.fantasy_positions || [],
      height: player.height || '',
      weight: player.weight || '',
      age: player.age || 0,
      injury_status: player.injury_status || '',
      injury_notes: player.injury_notes || ''
    }));
  }

  // Health check
  async healthCheck() {
    try {
      const league = await this.getLeague();
      return {
        success: true,
        status: 200,
        message: `Connected to league: ${league.name}`,
        leagueInfo: {
          name: league.name,
          season: league.season,
          totalRosters: league.total_rosters,
          status: league.status
        }
      };
    } catch (error) {
      return {
        success: false,
        status: 0,
        message: `Sleeper API error: ${error.message}`
      };
    }
  }
}

export const sleeperApiService = new SleeperApiService();