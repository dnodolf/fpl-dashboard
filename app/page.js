'use client';

import { useState, useEffect } from 'react';
import { Search, Filter, Trophy, RotateCcw, Download, Sun, Moon, Users, TrendingUp } from 'lucide-react';

const FPLDashboard = () => {
  // State management
  const [players, setPlayers] = useState([]);
  const [filteredPlayers, setFilteredPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('players');
  const [dataSource, setDataSource] = useState('ffh');
  const [darkMode, setDarkMode] = useState(false);
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [positionFilter, setPositionFilter] = useState('all');
  const [teamFilter, setTeamFilter] = useState('all');
  const [availabilityFilter, setAvailabilityFilter] = useState('all');
  const [minPoints, setMinPoints] = useState(0);

  // Fetch player data
  const fetchPlayers = async (source = 'ffh', refresh = false) => {
    setLoading(true);
    setError(null);
    
    try {
      console.log(`Fetching players from ${source}...`);
      const response = await fetch(`/api/players?source=${source}&refresh=${refresh}&matching=true`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('API Response:', data);
      
      if (data.players && Array.isArray(data.players)) {
        console.log(`Successfully loaded ${data.players.length} players`);
        setPlayers(data.players);
        setFilteredPlayers(data.players);
      } else {
        console.error('Invalid data structure:', data);
        throw new Error('Invalid data structure received from API');
      }
    } catch (err) {
      console.error('Error fetching players:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Initial data load
  useEffect(() => {
    fetchPlayers(dataSource);
  }, []);

  // Apply filters
  useEffect(() => {
    let filtered = [...players];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(player =>
        player.web_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        player.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        player.second_name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Position filter
    if (positionFilter !== 'all') {
      filtered = filtered.filter(player => {
        const position = getPositionName(player.position_id || player.element_type);
        return position.toLowerCase() === positionFilter.toLowerCase();
      });
    }

    // Team filter
    if (teamFilter !== 'all') {
      filtered = filtered.filter(player => 
        player.team?.code_name === teamFilter || 
        player.team_abbr === teamFilter
      );
    }

    // Points filter
    if (minPoints > 0) {
      filtered = filtered.filter(player => 
        (player.predicted_pts || player.total_points || 0) >= minPoints
      );
    }

    setFilteredPlayers(filtered);
  }, [players, searchTerm, positionFilter, teamFilter, availabilityFilter, minPoints]);

  // Helper functions
  const getPositionName = (positionId) => {
    const positions = {
      1: 'GK',
      2: 'DEF',
      3: 'MID',
      4: 'FWD'
    };
    return positions[positionId] || 'Unknown';
  };

  const getPositionColor = (positionId) => {
    const colors = {
      1: 'bg-yellow-100 text-yellow-800',
      2: 'bg-blue-100 text-blue-800',
      3: 'bg-green-100 text-green-800',
      4: 'bg-red-100 text-red-800'
    };
    return colors[positionId] || 'bg-gray-100 text-gray-800';
  };

  const getTeams = () => {
    const teams = new Set();
    players.forEach(player => {
      if (player.team?.code_name) teams.add(player.team.code_name);
      if (player.team_abbr) teams.add(player.team_abbr);
    });
    return Array.from(teams).sort();
  };

  const handleSourceChange = async (source) => {
    setDataSource(source);
    await fetchPlayers(source);
  };

  const handleRefresh = () => {
    fetchPlayers(dataSource, true);
  };

  // Component rendering
  const LoadingSpinner = () => (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      <span className="ml-3 text-lg">Loading player data...</span>
    </div>
  );

  const ErrorMessage = () => (
    <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
      <h3 className="text-lg font-semibold text-red-800 mb-2">Error Loading Data</h3>
      <p className="text-red-600 mb-4">{error}</p>
      <button 
        onClick={handleRefresh}
        className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 flex items-center gap-2 mx-auto"
      >
        <RotateCcw className="w-4 h-4" />
        Try Again
      </button>
    </div>
  );

  const PlayerCard = ({ player }) => (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-2">
        <div>
          <h3 className="font-semibold text-gray-900">{player.web_name || `${player.first_name} ${player.second_name}`}</h3>
          <p className="text-sm text-gray-600">{player.team?.code_name || player.team_abbr || 'Unknown Team'}</p>
        </div>
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPositionColor(player.position_id || player.element_type)}`}>
          {getPositionName(player.position_id || player.element_type)}
        </span>
      </div>
      
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-gray-500">Price:</span>
          <span className="font-medium ml-1">£{((player.now_cost || player.cost || 0) / 10).toFixed(1)}m</span>
        </div>
        <div>
          <span className="text-gray-500">Points:</span>
          <span className="font-medium ml-1">{player.predicted_pts?.toFixed(1) || player.total_points || 'N/A'}</span>
        </div>
        {player.form && (
          <div>
            <span className="text-gray-500">Form:</span>
            <span className="font-medium ml-1">{player.form}</span>
          </div>
        )}
        {player.selected_by_percent && (
          <div>
            <span className="text-gray-500">Ownership:</span>
            <span className="font-medium ml-1">{player.selected_by_percent}%</span>
          </div>
        )}
      </div>
    </div>
  );

  const StatsBar = () => (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <div className="bg-white rounded-lg p-4 border border-gray-200">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-blue-500" />
          <span className="text-sm text-gray-600">Total Players</span>
        </div>
        <p className="text-2xl font-bold text-gray-900">{players.length}</p>
      </div>
      
      <div className="bg-white rounded-lg p-4 border border-gray-200">
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-green-500" />
          <span className="text-sm text-gray-600">Filtered</span>
        </div>
        <p className="text-2xl font-bold text-gray-900">{filteredPlayers.length}</p>
      </div>
      
      <div className="bg-white rounded-lg p-4 border border-gray-200">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-purple-500" />
          <span className="text-sm text-gray-600">Data Source</span>
        </div>
        <p className="text-lg font-bold text-gray-900">{dataSource.toUpperCase()}</p>
      </div>
      
      <div className="bg-white rounded-lg p-4 border border-gray-200">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-500" />
          <span className="text-sm text-gray-600">Data Quality</span>
        </div>
        <p className="text-lg font-bold text-green-600">100%</p>
      </div>
    </div>
  );

  return (
    <div className={`min-h-screen transition-colors ${darkMode ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
      {/* Header */}
      <header className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-b sticky top-0 z-10`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <Trophy className="w-8 h-8 text-blue-500" />
              <h1 className="text-xl font-bold">FPL Roster Explorer</h1>
            </div>
            
            <div className="flex items-center gap-4">
              <p className="text-sm text-gray-500">
                Last updated: {new Date().toLocaleString()} • Source: Fantasy Football Hub
              </p>
              <p className="text-sm text-green-600 font-medium">
                Enhanced ✨ • Ownership data: {players.length} players
              </p>
              <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-sm font-medium">
                Data Quality: 100%
              </span>
              
              <button
                onClick={() => setDarkMode(!darkMode)}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
              
              <button
                onClick={() => handleSourceChange('sheets')}
                className={`px-3 py-1 rounded ${dataSource === 'sheets' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'}`}
              >
                📊 Sheets
              </button>
              
              <button
                onClick={() => handleSourceChange('ffh')}
                className={`px-3 py-1 rounded ${dataSource === 'ffh' ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-700'}`}
              >
                🔄 FFH
              </button>
              
              <button
                onClick={handleRefresh}
                className="bg-purple-500 text-white px-3 py-1 rounded hover:bg-purple-600 flex items-center gap-1"
                disabled={loading}
              >
                <RotateCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-b`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {[
              { id: 'players', label: 'Players', icon: Users, count: filteredPlayers.length },
              { id: 'optimizer', label: 'Optimizer', icon: TrendingUp, disabled: true },
              { id: 'transfers', label: 'Transfers', icon: RotateCcw, disabled: true },
              { id: 'analytics', label: 'Analytics', icon: Trophy, disabled: true }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                disabled={tab.disabled}
                className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : tab.disabled
                    ? 'border-transparent text-gray-400 cursor-not-allowed'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
                {tab.count !== undefined && (
                  <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs">
                    Browse {tab.count} players
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {error ? (
          <ErrorMessage />
        ) : loading ? (
          <LoadingSpinner />
        ) : (
          <>
            <StatsBar />

            {/* Filters */}
            <div className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-lg border p-6 mb-6`}>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Search Players</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      placeholder="Search by name..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                        darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'
                      }`}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Position</label>
                  <select
                    value={positionFilter}
                    onChange={(e) => setPositionFilter(e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'
                    }`}
                  >
                    <option value="all">All Positions</option>
                    <option value="gk">Goalkeepers</option>
                    <option value="def">Defenders</option>
                    <option value="mid">Midfielders</option>
                    <option value="fwd">Forwards</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Team</label>
                  <select
                    value={teamFilter}
                    onChange={(e) => setTeamFilter(e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'
                    }`}
                  >
                    <option value="all">All Teams</option>
                    {getTeams().map(team => (
                      <option key={team} value={team}>{team}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Availability</label>
                  <select
                    value={availabilityFilter}
                    onChange={(e) => setAvailabilityFilter(e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'
                    }`}
                  >
                    <option value="all">All Players</option>
                    <option value="available">Available</option>
                    <option value="owned">Owned</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Min Points</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={minPoints}
                    onChange={(e) => setMinPoints(Number(e.target.value))}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'
                    }`}
                  />
                </div>
              </div>
            </div>

            {/* Player Grid */}
            {filteredPlayers.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredPlayers.map((player, index) => (
                  <PlayerCard key={player.id || player.fpl_id || index} player={player} />
                ))}
              </div>
            ) : (
              <div className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-lg border p-8 text-center`}>
                <Filter className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No players found</h3>
                <p className="text-gray-500 dark:text-gray-400">Try adjusting your filters to see more results.</p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default FPLDashboard;