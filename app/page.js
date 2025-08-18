'use client';
import { useState, useEffect } from 'react';

// Mock data structure matching your current system
const mockPlayerData = [
  {
    name: "Erling Haaland",
    position: "FWD",
    team: "MCI",
    ownership: "65%",
    price: 15.0,
    predicted_points: 8.5,
    sleeper_points: 12.3,
    form: "WWWLW",
    owned_by: "TeamA",
    is_available: false
  },
  {
    name: "Mohamed Salah",
    position: "MID",
    team: "LIV",
    ownership: "45%",
    price: 13.0,
    predicted_points: 7.8,
    sleeper_points: 11.2,
    form: "WWDWL",
    owned_by: "",
    is_available: true
  },
  {
    name: "Kevin De Bruyne",
    position: "MID",
    team: "MCI",
    ownership: "35%",
    price: 12.5,
    predicted_points: 7.2,
    sleeper_points: 10.8,
    form: "LWWWW",
    owned_by: "TeamB",
    is_available: false
  },
  {
    name: "Bukayo Saka",
    position: "MID",
    team: "ARS",
    ownership: "40%",
    price: 9.5,
    predicted_points: 6.5,
    sleeper_points: 9.1,
    form: "WWLWW",
    owned_by: "",
    is_available: true
  },
  {
    name: "Virgil van Dijk",
    position: "DEF",
    team: "LIV",
    ownership: "30%",
    price: 6.5,
    predicted_points: 5.2,
    sleeper_points: 7.8,
    form: "WWDWL",
    owned_by: "",
    is_available: true
  },
  {
    name: "Alisson",
    position: "GKP",
    team: "LIV",
    ownership: "25%",
    price: 5.5,
    predicted_points: 4.8,
    sleeper_points: 6.2,
    form: "WWDWL",
    owned_by: "TeamC",
    is_available: false
  }
];

const formations = [
  { name: "3-4-3", positions: { GKP: 1, DEF: 3, MID: 4, FWD: 3 } },
  { name: "3-5-2", positions: { GKP: 1, DEF: 3, MID: 5, FWD: 2 } },
  { name: "4-3-3", positions: { GKP: 1, DEF: 4, MID: 3, FWD: 3 } },
  { name: "4-4-2", positions: { GKP: 1, DEF: 4, MID: 4, FWD: 2 } },
  { name: "4-5-1", positions: { GKP: 1, DEF: 4, MID: 5, FWD: 1 } }
];

export default function FPLDashboard() {
  const [activeTab, setActiveTab] = useState('players');
  const [players, setPlayers] = useState(mockPlayerData);
  const [filters, setFilters] = useState({
    position: 'all',
    availability: 'all',
    team: 'all',
    minPoints: 0
  });
  const [selectedFormation, setSelectedFormation] = useState('4-3-3');
  const [isDarkMode, setIsDarkMode] = useState(true);

  // Filter players based on current filters
  const filteredPlayers = players.filter(player => {
    if (filters.position !== 'all' && player.position !== filters.position) return false;
    if (filters.availability === 'available' && !player.is_available) return false;
    if (filters.availability === 'owned' && player.is_available) return false;
    if (filters.team !== 'all' && player.team !== filters.team) return false;
    if (player.sleeper_points < filters.minPoints) return false;
    return true;
  });

  // Get unique teams for filter dropdown
  const teams = [...new Set(players.map(p => p.team))].sort();

  const PlayerCard = ({ player }) => (
    <div className={`p-4 rounded-lg border ${
      isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
    } hover:scale-105 transition-transform shadow-lg`}>
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="font-bold text-lg">{player.name}</h3>
          <div className="flex gap-2 text-sm mt-1">
            <span className={`px-2 py-1 rounded text-xs font-medium ${
              player.position === 'GKP' ? 'bg-yellow-500 text-black' :
              player.position === 'DEF' ? 'bg-blue-500 text-white' :
              player.position === 'MID' ? 'bg-green-500 text-white' :
              'bg-red-500 text-white'
            }`}>
              {player.position}
            </span>
            <span className="bg-gray-500 text-white px-2 py-1 rounded text-xs">
              {player.team}
            </span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-green-400">
            {player.sleeper_points.toFixed(1)}
          </div>
          <div className="text-sm opacity-75">Sleeper Pts</div>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <span className="opacity-75">Price:</span> £{player.price}m
        </div>
        <div>
          <span className="opacity-75">Ownership:</span> {player.ownership}
        </div>
        <div>
          <span className="opacity-75">FPL Pts:</span> {player.predicted_points}
        </div>
        <div>
          <span className={`px-2 py-1 rounded text-xs ${
            player.is_available ? 'bg-green-500' : 'bg-red-500'
          } text-white`}>
            {player.is_available ? 'Available' : `Owned by ${player.owned_by}`}
          </span>
        </div>
      </div>
    </div>
  );

  const FormationOptimizer = () => {
    const formation = formations.find(f => f.name === selectedFormation);
    
    const getOptimalLineup = () => {
      const lineup = {};
      let totalPoints = 0;
      
      Object.entries(formation.positions).forEach(([pos, count]) => {
        const positionPlayers = players
          .filter(p => p.position === pos)
          .sort((a, b) => b.sleeper_points - a.sleeper_points)
          .slice(0, count);
        
        lineup[pos] = positionPlayers;
        totalPoints += positionPlayers.reduce((sum, p) => sum + p.sleeper_points, 0);
      });
      
      return { lineup, totalPoints };
    };

    const { lineup, totalPoints } = getOptimalLineup();
    
    return (
      <div className="space-y-6">
        <div className="flex gap-4 flex-wrap">
          {formations.map(f => (
            <button
              key={f.name}
              onClick={() => setSelectedFormation(f.name)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedFormation === f.name
                  ? 'bg-blue-500 text-white'
                  : isDarkMode 
                    ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {f.name}
            </button>
          ))}
        </div>
        
        <div className={`p-6 rounded-lg ${
          isDarkMode ? 'bg-gray-800' : 'bg-white'
        } border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'} shadow-lg`}>
          <h3 className="text-xl font-bold mb-4">Optimal Lineup ({selectedFormation})</h3>
          
          <div className="grid gap-4">
            {Object.entries(lineup).map(([pos, posPlayers]) => (
              <div key={pos}>
                <h4 className="font-medium mb-2 text-lg">{pos} ({posPlayers.length} players)</h4>
                <div className="grid gap-2">
                  {posPlayers.map(player => (
                    <div key={player.name} className={`p-3 rounded ${
                      isDarkMode ? 'bg-gray-700' : 'bg-gray-100'
                    } flex justify-between items-center`}>
                      <div>
                        <span className="font-medium">{player.name}</span>
                        <span className="text-sm opacity-75 ml-2">({player.team})</span>
                      </div>
                      <span className="font-bold text-green-400">
                        {player.sleeper_points.toFixed(1)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-6 pt-4 border-t border-gray-600">
            <div className="text-2xl font-bold text-center">
              Total Expected Points: <span className="text-green-400">{totalPoints.toFixed(1)}</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`min-h-screen transition-colors ${
      isDarkMode ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'
    }`}>
      {/* Header */}
      <header className={`${
        isDarkMode ? 'bg-gray-800' : 'bg-white'
      } shadow-sm border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold">🏆 FPL Roster Explorer</h1>
            <div className="flex gap-4 items-center">
              <button
                onClick={() => setIsDarkMode(!isDarkMode)}
                className={`p-2 rounded-lg transition-colors ${
                  isDarkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'
                }`}
              >
                {isDarkMode ? '☀️' : '🌙'}
              </button>
              <button className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium transition-colors">
                🔄 Update Data
              </button>
            </div>
          </div>
          
          {/* Navigation Tabs */}
          <nav className="mt-4">
            <div className="flex gap-1 overflow-x-auto">
              {[
                { id: 'players', label: '👥 Players', desc: 'Browse all players' },
                { id: 'optimizer', label: '⚡ Optimizer', desc: 'Find optimal lineups' },
                { id: 'transfers', label: '🔄 Transfers', desc: 'Transfer suggestions' },
                { id: 'analytics', label: '📊 Analytics', desc: 'Performance insights' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-3 rounded-lg font-medium transition-colors min-w-max ${
                    activeTab === tab.id
                      ? 'bg-blue-500 text-white'
                      : isDarkMode 
                        ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  <div className="text-sm">{tab.label}</div>
                  <div className="text-xs opacity-75">{tab.desc}</div>
                </button>
              ))}
            </div>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        
        {/* Players Tab */}
        {activeTab === 'players' && (
          <div>
            {/* Filters */}
            <div className={`p-4 rounded-lg mb-6 ${
              isDarkMode ? 'bg-gray-800' : 'bg-white'
            } border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'} shadow-lg`}>
              <h2 className="text-lg font-bold mb-4">🔍 Filters</h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Position</label>
                  <select
                    value={filters.position}
                    onChange={(e) => setFilters({...filters, position: e.target.value})}
                    className={`w-full p-2 rounded border ${
                      isDarkMode 
                        ? 'bg-gray-700 border-gray-600 text-white' 
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                  >
                    <option value="all">All Positions</option>
                    <option value="GKP">Goalkeeper</option>
                    <option value="DEF">Defender</option>
                    <option value="MID">Midfielder</option>
                    <option value="FWD">Forward</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">Availability</label>
                  <select
                    value={filters.availability}
                    onChange={(e) => setFilters({...filters, availability: e.target.value})}
                    className={`w-full p-2 rounded border ${
                      isDarkMode 
                        ? 'bg-gray-700 border-gray-600 text-white' 
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                  >
                    <option value="all">All Players</option>
                    <option value="available">Available Only</option>
                    <option value="owned">Owned Only</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">Team</label>
                  <select
                    value={filters.team}
                    onChange={(e) => setFilters({...filters, team: e.target.value})}
                    className={`w-full p-2 rounded border ${
                      isDarkMode 
                        ? 'bg-gray-700 border-gray-600 text-white' 
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                  >
                    <option value="all">All Teams</option>
                    {teams.map(team => (
                      <option key={team} value={team}>{team}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">Min Points</label>
                  <input
                    type="number"
                    value={filters.minPoints}
                    onChange={(e) => setFilters({...filters, minPoints: Number(e.target.value)})}
                    className={`w-full p-2 rounded border ${
                      isDarkMode 
                        ? 'bg-gray-700 border-gray-600 text-white' 
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                    placeholder="0"
                  />
                </div>
              </div>
            </div>

            {/* Player Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPlayers.map(player => (
                <PlayerCard key={player.name} player={player} />
              ))}
            </div>
            
            {filteredPlayers.length === 0 && (
              <div className="text-center py-12">
                <div className="text-4xl mb-4">🔍</div>
                <h3 className="text-xl font-medium mb-2">No players found</h3>
                <p className="opacity-75">Try adjusting your filters</p>
              </div>
            )}
          </div>
        )}

        {/* Optimizer Tab */}
        {activeTab === 'optimizer' && <FormationOptimizer />}

        {/* Transfers Tab */}
        {activeTab === 'transfers' && (
          <div className={`p-8 rounded-lg text-center ${
            isDarkMode ? 'bg-gray-800' : 'bg-white'
          } border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'} shadow-lg`}>
            <div className="text-6xl mb-4">🔄</div>
            <h2 className="text-2xl font-bold mb-4">Transfer Suggestions</h2>
            <p className="opacity-75 mb-6">AI-powered transfer recommendations coming soon!</p>
            <div className="text-sm opacity-50">
              This will analyze your team and suggest optimal transfers based on upcoming fixtures, 
              form, and predicted points.
            </div>
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <div className={`p-8 rounded-lg text-center ${
            isDarkMode ? 'bg-gray-800' : 'bg-white'
          } border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'} shadow-lg`}>
            <div className="text-6xl mb-4">📊</div>
            <h2 className="text-2xl font-bold mb-4">Advanced Analytics</h2>
            <p className="opacity-75 mb-6">Detailed performance insights and predictions!</p>
            <div className="text-sm opacity-50">
              Charts, trends, player comparison tools, and prediction accuracy tracking.
            </div>
          </div>
        )}
      </main>
    </div>
  );
}