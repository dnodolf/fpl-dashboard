'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import v3ScoringService from './services/v3ScoringService';
import { OptimizerTabContent } from './components/OptimizerTabContent';
import TransferTabContent from './components/TransferTabContent';
import ComparisonTabContent from './components/ComparisonTabContent';
import CheatSheetTabContent from './components/CheatSheetTabContent';
import HomeTabContent from './components/HomeTabContent';
import MatchingTabContent from './components/MatchingTabContent';
import DashboardHeader from './components/DashboardHeader';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LoadingSpinner } from './components/LoadingSpinner';
import { EPL_TEAMS, TEAM_DISPLAY_NAMES, isEPLPlayer } from './constants/teams';
import CacheManager from './utils/cacheManager';
import { usePlayerData } from './hooks/usePlayerData';
import { useGameweek } from './hooks/useGameweek';
import { USER_ID, TOTAL_GAMEWEEKS, OWNERSHIP_STATUS, FILTER_OPTIONS } from './config/constants';
import { MatchingStatsCard } from './components/stats/MatchingStatsCard';
import { OptimizerStatsCard } from './components/stats/OptimizerStatsCard';
import { PlayerModal } from './components/PlayerModal';
import { getNextNGameweeksTotal, getAvgMinutesNextN } from './utils/predictionUtils';
import { getSleeperPositionStyle, getPositionColors } from './constants/positionColors';
import { timeAgo } from './utils/newsUtils';

// ----------------- MAIN DASHBOARD COMPONENT -----------------
export default function FPLDashboard() {
  const [activeTab, setActiveTab] = useState('home');
  const [filters, setFilters] = useState({
    position: [],
    team: FILTER_OPTIONS.ALL,
    owner: FILTER_OPTIONS.MY_PLAYERS_AND_FAS,
    minPoints: 0.1,
    search: ''
  });
  const [sortConfig, setSortConfig] = useState({ key: 'sleeper_points_ros', direction: 'desc' });
  const [scoringMode, setScoringMode] = useState('v3');

  // Shared gameweek range state for transfers tab
  const [transferGameweekRange, setTransferGameweekRange] = useState(null);

  // Player modal state
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Comparison tab pre-selection state
  const [comparisonPlayer1, setComparisonPlayer1] = useState(null);

  // Use gameweek hook for current gameweek data
  const currentGameweek = useGameweek();

  const { players, loading, error, lastUpdated, source, quality, ownershipData, ownershipCount, enhanced, refetch, integrated, integration } = usePlayerData();

  // Processed players with scoring mode applied
  const [processedPlayers, setProcessedPlayers] = useState([]);

  // Process players when scoring mode or players change
  useEffect(() => {
    if (players && Array.isArray(players) && players.length > 0) {
      setProcessedPlayers(players);
    }
  }, [players, scoringMode]);

  // Update data function
  const updateData = (type = 'manual', forceRefresh = true, useCache = false) => {
    if (forceRefresh) {
      CacheManager.clear();
    }
    refetch(type, forceRefresh, useCache);
  };

  // Position color utility (shared with transfers tab)
  const getPositionColor = useCallback((position) => {
    const colors = getPositionColors(position);

    const lightBgMap = {
      'GKP': 'bg-yellow-100',
      'DEF': 'bg-teal-100',
      'MID': 'bg-pink-100',
      'FWD': 'bg-purple-100'
    };

    const textMap = {
      'GKP': 'text-yellow-800',
      'DEF': 'text-teal-800',
      'MID': 'text-pink-800',
      'FWD': 'text-purple-800'
    };

    const borderMap = {
      'GKP': 'border-yellow-200',
      'DEF': 'border-teal-200',
      'MID': 'border-pink-200',
      'FWD': 'border-purple-200'
    };

    const normalizedPos = position?.toUpperCase() || 'GKP';

    return {
      bg: lightBgMap[normalizedPos] || 'bg-gray-100',
      text: textMap[normalizedPos] || 'text-gray-800',
      border: borderMap[normalizedPos] || 'border-gray-200',
      accent: colors.accent,
      pill: colors.pill
    };
  }, []);

  // Sorting function
  const handleSort = useCallback((key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  }, [sortConfig.key, sortConfig.direction]);

  // Player modal handlers
  const handlePlayerClick = useCallback((player) => {
    setSelectedPlayer(player);
    setIsModalOpen(true);
  }, []);

  const handleModalClose = useCallback(() => {
    setIsModalOpen(false);
    setSelectedPlayer(null);
  }, []);

  const handleCompare = useCallback((player) => {
    setComparisonPlayer1(player);
    setActiveTab('comparison');
  }, []);

  // Get sort value for a player and column
  const getSortValue = useCallback((player, key) => {
    switch (key) {
      case 'name':
        return (player.name || `${player.first_name || ''} ${player.last_name || ''}`.trim()).toLowerCase();
      case 'position':
        return player.position || '';
      case 'team':
        return player.team || '';
      case 'sleeper_points_ros':
        return v3ScoringService.getScoringValue(player, 'points_ros', scoringMode);
      case 'sleeper_points_next5':
        return getNextNGameweeksTotal(player, scoringMode, currentGameweek?.number, 5);
      case 'avg_minutes_next5':
        return getAvgMinutesNextN(player, currentGameweek?.number, 5);
      case 'current_ppg':
        return player.ffh_season_avg || 0;
      case 'predicted_ppg':
        return player.sleeper_season_avg || 0;
      case 'owned_by':
        return player.owned_by || 'Free Agent';
      default:
        return '';
    }
  }, [scoringMode, currentGameweek]);

  // Filter players based on current filters
  const filteredPlayers = useMemo(() => {
    return processedPlayers.filter(player => {
      if (!isEPLPlayer(player)) return false;

      // Position filter - multi-select
      if (filters.position.length > 0) {
        const playerPos = player.position;
        const isPositionMatch = filters.position.some(filterPos => {
          if (filterPos === 'GKP') {
            return playerPos === 'GKP' || playerPos === 'GK';
          }
          return playerPos === filterPos;
        });
        if (!isPositionMatch) return false;
      }

      // Team filter
      if (filters.team !== 'all' && player.team_abbr !== filters.team) return false;

      // Owner filter
      if (filters.owner !== FILTER_OPTIONS.ALL) {
        if (filters.owner === FILTER_OPTIONS.MY_PLAYERS_AND_FAS) {
          const isMyPlayer = player.owned_by === USER_ID;
          const isFreeAgent = !player.owned_by || player.owned_by === OWNERSHIP_STATUS.FREE_AGENT;
          if (!isMyPlayer && !isFreeAgent) return false;
        } else if (filters.owner === OWNERSHIP_STATUS.FREE_AGENT && player.owned_by && player.owned_by !== OWNERSHIP_STATUS.FREE_AGENT) {
          return false;
        } else if (filters.owner === USER_ID && player.owned_by !== USER_ID) {
          return false;
        } else if (filters.owner !== OWNERSHIP_STATUS.FREE_AGENT && filters.owner !== USER_ID && player.owned_by !== filters.owner) {
          return false;
        }
      }

      // Min points filter
      const getRosPoints = (p) => {
        if (p.sleeper_season_total) return p.sleeper_season_total;
        if (p.sleeper_season_avg) return p.sleeper_season_avg * TOTAL_GAMEWEEKS;
        if (p.ffh_season_prediction) return p.ffh_season_prediction;
        if (p.predicted_pts) return p.predicted_pts;
        if (p.total_points) return p.total_points;
        return 0;
      };

      if (getRosPoints(player) < filters.minPoints) return false;

      // Search filter
      if (filters.search) {
        const searchTerm = filters.search.toLowerCase();
        const searchableText = [
          player.name || '',
          player.first_name || '',
          player.last_name || '',
          player.team || '',
          player.position || ''
        ].join(' ').toLowerCase();
        if (!searchableText.includes(searchTerm)) return false;
      }

      return true;
    });
  }, [processedPlayers, filters.position, filters.team, filters.owner, filters.minPoints, filters.search]);

  // Sort players based on sort config
  const sortedPlayers = useMemo(() => {
    return [...filteredPlayers].sort((a, b) => {
      const aValue = getSortValue(a, sortConfig.key);
      const bValue = getSortValue(b, sortConfig.key);

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
      }
      const aStr = String(aValue);
      const bStr = String(bValue);
      return sortConfig.direction === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
    });
  }, [filteredPlayers, sortConfig.key, sortConfig.direction, scoringMode, currentGameweek]);

  // Get unique teams and owners for filter dropdowns
  const teams = EPL_TEAMS.sort();
  const owners = [...new Set(processedPlayers.filter(isEPLPlayer).map(p => p.owned_by).filter(Boolean))].sort();

  // Render sort icon
  const renderSortIcon = (columnKey) => {
    if (sortConfig.key !== columnKey) {
      return <span className="text-gray-400 ml-1">↕️</span>;
    }
    return sortConfig.direction === 'asc' ?
      <span className="text-blue-500 ml-1">↑</span> :
      <span className="text-blue-500 ml-1">↓</span>;
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white">
        <div className="flex items-center justify-center min-h-screen">
          <LoadingSpinner message="Loading player data..." />
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 text-white">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center p-8">
            <h2 className="text-2xl font-bold text-red-600 mb-4">❌ Error Loading Data</h2>
            <p className="mb-4 text-gray-400">{error}</p>
            <button
              onClick={updateData}
              className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Render tab-specific stats
  const renderStatsCards = () => {
    switch(activeTab) {
      case 'matching':
        return <MatchingStatsCard players={processedPlayers} integration={integration} />;
      case 'optimizer':
        return <OptimizerStatsCard scoringMode={scoringMode} currentGameweek={currentGameweek} />;
      default:
        return null;
    }
  };

  // Main render
  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-900 text-white">

        <DashboardHeader
          lastUpdated={lastUpdated}
          players={processedPlayers}
          updateData={updateData}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          currentGameweek={currentGameweek}
          scoringMode={scoringMode}
          setScoringMode={setScoringMode}
        />

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 py-6">

          {/* Tab-Specific Stats Cards */}
          {renderStatsCards()}

          {/* Content based on active tab */}
          {activeTab === 'home' && (
            <HomeTabContent
              players={processedPlayers}
              currentGameweek={currentGameweek}
              scoringMode={scoringMode}
              onPlayerClick={handlePlayerClick}
            />
          )}

          {activeTab === 'players' && (
            <>
              {/* Filters */}
              <div className="p-4 rounded-lg mb-6 shadow-sm bg-gray-800">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {/* Position Filter - Multi-select */}
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-300">
                      Positions ({filters.position.length > 0 ? filters.position.length : 'All'})
                    </label>
                    <div className="flex gap-2">
                      {['GKP', 'DEF', 'MID', 'FWD'].map(pos => {
                        const colors = getPositionColor(pos);
                        const isSelected = filters.position.includes(pos);
                        return (
                          <button
                            key={pos}
                            onClick={() => {
                              if (isSelected) {
                                setFilters(prev => ({
                                  ...prev,
                                  position: prev.position.filter(p => p !== pos)
                                }));
                              } else {
                                setFilters(prev => ({
                                  ...prev,
                                  position: [...prev.position, pos]
                                }));
                              }
                            }}
                            className={`px-4 py-2 rounded-full text-sm font-semibold transition-all transform hover:scale-105 ${
                              isSelected
                                ? `${colors.pill} text-white shadow-lg`
                                : 'bg-gray-700 hover:bg-gray-600 text-gray-300 border-2 border-transparent hover:border-gray-300'
                            }`}
                          >
                            {pos}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Owner Filter */}
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-300">Owner</label>
                    <select
                      value={filters.owner}
                      onChange={(e) => setFilters(prev => ({ ...prev, owner: e.target.value }))}
                      className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-700 border-gray-600 text-white"
                    >
                      <option value={FILTER_OPTIONS.ALL}>All Owners</option>
                      <option value={FILTER_OPTIONS.MY_PLAYERS_AND_FAS}>My Players + FAs</option>
                      <option value={USER_ID}>My Players Only</option>
                      <option value={OWNERSHIP_STATUS.FREE_AGENT}>Free Agents Only</option>
                      {owners.map(owner => (
                        <option key={owner} value={owner}>{owner}</option>
                      ))}
                    </select>
                  </div>

                  {/* Min Points Filter */}
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-300">Min ROS Points</label>
                    <input
                      type="number"
                      step="0.1"
                      value={filters.minPoints}
                      onChange={(e) => setFilters(prev => ({ ...prev, minPoints: parseFloat(e.target.value) || 0 }))}
                      className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-700 border-gray-600 text-white"
                      placeholder="0"
                    />
                  </div>

                  {/* Search Filter */}
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-300">Search</label>
                    <input
                      type="text"
                      value={filters.search}
                      onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                      placeholder="Player name, team..."
                      className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                    />
                  </div>
                </div>
              </div>

              {/* Results Summary */}
              <div className="mb-4 flex items-center justify-between">
                <div className="text-sm text-gray-400">
                  Showing {sortedPlayers.length.toLocaleString()} of {players.length.toLocaleString()} players
                  <span className="ml-2 text-xs">
                    (Free Agents: {processedPlayers.filter(p => !p.owned_by || p.owned_by === OWNERSHIP_STATUS.FREE_AGENT).length},
                     Owned: {processedPlayers.filter(p => p.owned_by && p.owned_by !== OWNERSHIP_STATUS.FREE_AGENT).length})
                  </span>
                </div>
                <div className="text-sm text-gray-500">
                  Click column headers to sort
                </div>
              </div>

              {/* Players Table */}
              <div className="rounded-lg shadow-sm border overflow-hidden bg-gray-800 border-gray-700">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-700">
                      <tr>
                        {[
                          { key: 'name', label: 'Player' },
                          { key: 'position', label: 'Position' },
                          { key: 'team', label: 'Team' },
                          { key: 'owned_by', label: 'Ownership' },
                          { key: 'sleeper_points_ros', label: 'ROS Points' },
                          { key: 'sleeper_points_next5', label: 'Next 5 GW' },
                          { key: 'avg_minutes_next5', label: 'Avg Mins (Next 5)' },
                          { key: 'predicted_ppg', label: 'PPG (Predicted)' }
                        ].map(col => (
                          <th
                            key={col.key}
                            className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer text-gray-300 hover:bg-gray-600"
                            onClick={() => handleSort(col.key)}
                          >
                            <div className="flex items-center">
                              {col.label} {renderSortIcon(col.key)}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-gray-800 divide-y divide-gray-700">
                      {sortedPlayers.map((player, index) => (
                        <tr key={`${player.sleeper_id || player.id || index}`} className="hover:bg-gray-700">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div>
                                <div className="text-sm font-medium flex items-center gap-2">
                                  <button
                                    onClick={() => handlePlayerClick(player)}
                                    className="text-white hover:text-blue-400 underline decoration-transparent hover:decoration-blue-400 transition-all cursor-pointer text-left"
                                  >
                                    {player.name || `${player.first_name || ''} ${player.last_name || ''}`.trim()}
                                  </button>
                                  {(player.news?.trim() || (player.fpl_status && player.fpl_status !== 'a')) && (() => {
                                    const statusColor = player.fpl_status === 'i' || player.fpl_status === 's'
                                      ? 'text-red-400 hover:text-red-300'
                                      : player.fpl_status === 'd'
                                        ? 'text-orange-400 hover:text-orange-300'
                                        : 'text-orange-400 hover:text-orange-300';
                                    const newsText = player.news?.trim() || '';
                                    const timestamp = player.news_added ? timeAgo(player.news_added) : '';
                                    const tooltip = [newsText, timestamp].filter(Boolean).join(' · ');
                                    return (
                                      <span className={`${statusColor} cursor-pointer transition-colors`} title={tooltip || 'Status alert'}>
                                        📰
                                      </span>
                                    );
                                  })()}
                                </div>
                                {player.injury_status && (
                                  <div className="text-xs text-red-600">🏥 {player.injury_status}</div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getSleeperPositionStyle(player.position)}`}>
                              {player.position || 'N/A'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                            {TEAM_DISPLAY_NAMES[player.team_abbr] || player.team_abbr || 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            {player.owned_by && player.owned_by !== OWNERSHIP_STATUS.FREE_AGENT && player.owned_by !== '' ? (
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                player.owned_by === USER_ID
                                  ? 'bg-indigo-100 text-indigo-900 border border-indigo-400'
                                  : 'bg-orange-100 text-orange-900 border border-orange-400'
                              }`}>
                                {player.owned_by === USER_ID ? '👤 My Player' : player.owned_by}
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-300">
                                ⚡ Free Agent
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                            {(() => {
                              const seasonTotal = v3ScoringService.getScoringValue(player, 'season_total', scoringMode);
                              return seasonTotal > 0 ? seasonTotal.toFixed(1) : 'N/A';
                            })()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                            {(() => {
                              if (player.predictions && Array.isArray(player.predictions)) {
                                const totalPoints = player.predictions.slice(0, 5).reduce((sum, pred) => sum + (pred.predicted_pts || 0), 0);
                                return totalPoints.toFixed(1);
                              }
                              return '0.0';
                            })()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                            {(() => {
                              if (player.predictions && Array.isArray(player.predictions)) {
                                const first5 = player.predictions.slice(0, 5);
                                if (first5.length > 0) {
                                  const avgMinutes = first5.reduce((sum, pred) => sum + (pred.xmins || 0), 0) / first5.length;
                                  return avgMinutes.toFixed(0);
                                }
                              }
                              return '0';
                            })()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                            {v3ScoringService.getScoringValue(player, 'season_avg', scoringMode).toFixed(1)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* No Results Message */}
              {sortedPlayers.length === 0 && (
                <div className="text-center py-8">
                  <div className="mb-2 text-gray-400">No players match your current filters</div>
                  <button
                    onClick={() => {
                      setFilters({
                        position: [],
                        team: FILTER_OPTIONS.ALL,
                        owner: FILTER_OPTIONS.ALL,
                        minPoints: 0,
                        search: ''
                      });
                    }}
                    className="text-blue-500 hover:text-blue-600 text-sm underline"
                  >
                    Clear all filters
                  </button>
                </div>
              )}
            </>
          )}

          {activeTab === 'matching' && (
            <MatchingTabContent players={processedPlayers} integration={integration} />
          )}

          {activeTab === 'optimizer' && (
            <OptimizerTabContent
              players={processedPlayers}
              currentGameweek={currentGameweek}
              scoringMode={scoringMode}
              onPlayerClick={handlePlayerClick}
            />
          )}

          {activeTab === 'transfers' && (
            <TransferTabContent
              players={processedPlayers}
              currentGameweek={currentGameweek}
              scoringMode={scoringMode}
              gameweekRange={transferGameweekRange}
              onGameweekRangeChange={setTransferGameweekRange}
              onPlayerClick={handlePlayerClick}
            />
          )}

          {activeTab === 'comparison' && (
            <ComparisonTabContent
              players={processedPlayers}
              currentGameweek={currentGameweek}
              scoringMode={scoringMode}
              onPlayerClick={handlePlayerClick}
              preSelectedPlayer1={comparisonPlayer1}
              onClearPreSelection={() => setComparisonPlayer1(null)}
            />
          )}

          {activeTab === 'cheatsheet' && (
            <CheatSheetTabContent
              players={processedPlayers}
              scoringMode={scoringMode}
              currentGameweek={currentGameweek}
              onPlayerClick={handlePlayerClick}
            />
          )}

        </main>

        {/* Player Detail Modal */}
        <PlayerModal
          player={selectedPlayer}
          isOpen={isModalOpen}
          onClose={handleModalClose}
          currentGameweek={currentGameweek}
          scoringMode={scoringMode}
          onCompare={handleCompare}
        />
      </div>
    </ErrorBoundary>
  );
}
