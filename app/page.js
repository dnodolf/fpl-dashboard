'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import v3ScoringService from './services/v3ScoringService';
import { OptimizerTabContent } from './components/OptimizerTabContent';
import TransferTabContent from './components/TransferTabContent';
import ComparisonTabContent from './components/ComparisonTabContent';
import CheatSheetTabContent from './components/CheatSheetTabContent';
import HomeTabContent from './components/HomeTabContent';
import LeagueStandings from './components/LeagueStandings';
import { LoadingSpinner } from './components/LoadingSpinner';
import { EPL_TEAMS, TEAM_MAPPINGS, TEAM_DISPLAY_NAMES, isEPLPlayer } from './constants/teams';
import CacheManager, { getDataFreshnessStatus, formatCacheAge } from './utils/cacheManager';
import { usePlayerData } from './hooks/usePlayerData';
import { useGameweek } from './hooks/useGameweek';
import { USER_ID, TOTAL_GAMEWEEKS, NEXT_N_GAMEWEEKS, OWNERSHIP_STATUS, FILTER_OPTIONS } from './config/constants';
import { MatchingStatsCard } from './components/stats/MatchingStatsCard';
import { OptimizerStatsCard } from './components/stats/OptimizerStatsCard';
import { TransferStatsCard } from './components/stats/TransferStatsCard';
import { UnmatchedPlayersTable } from './components/stats/UnmatchedPlayersTable';
import { PlayerModal } from './components/PlayerModal';

// ----------------- ERROR BOUNDARY COMPONENT -----------------
const ErrorBoundary = ({ children }) => {
  const [hasError, setHasError] = useState(false);
  
  useEffect(() => {
    const handleError = () => setHasError(true);
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (hasError) {
    return (
      <div className="text-center p-8">
        <h2 className="text-white">Something went wrong.</h2>
        <button onClick={() => setHasError(false)} className="mt-4 px-4 py-2 bg-blue-500 text-white rounded">
          Try again
        </button>
      </div>
    );
  }

  return children;
};


// ----------------- SLEEPER POSITION COLORS -----------------
const getSleeperPositionStyle = (position) => {
  switch (position) {
    case 'GKP':
    case 'GK':
    case 'G':
      // Sleeper GKP: Better contrast yellow
      return 'bg-yellow-600 text-white border border-yellow-500'; 
    case 'DEF':
    case 'D':
      // Sleeper DEF: Better contrast cyan
      return 'bg-cyan-600 text-white border border-cyan-500'; 
    case 'MID':
    case 'M':
      // Sleeper MID: Better contrast pink
      return 'bg-pink-600 text-white border border-pink-500'; 
    case 'FWD':
    case 'F':
      // Sleeper FWD: Better contrast purple
      return 'bg-purple-600 text-white border border-purple-500'; 
    default:
      return 'bg-gray-600 text-white border border-gray-500';
  }
};

// ----------------- MATCHING TAB CONTENT COMPONENT -----------------
const MatchingTabContent = ({ players, integration }) => {
  const optaAnalysis = integration?.optaAnalysis;
  
  return (
    <div className="space-y-6">
      {/* Summary Section */}
      <div className={`rounded-lg shadow-sm border p-6 bg-gray-800 border-gray-700`}>
        <h3 className={`text-lg font-medium mb-4 text-white`}>
          🎯 Opta-Only Matching Summary
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className={`text-sm font-medium mb-2 text-gray-300`}>
              Coverage Analysis
            </h4>
            <ul className={`text-sm space-y-1 text-gray-400`}>
              <li>• {optaAnalysis?.sleeperOptaRate || 0}% of Sleeper players have Opta IDs</li>
              <li>• {optaAnalysis?.ffhOptaRate || 0}% of FFH players have Opta IDs</li>
              <li>• {optaAnalysis?.optaMatchRate || 0}% match rate (matched/FFH players)</li>
              <li>• 100% match confidence (exact ID matching)</li>
            </ul>
          </div>
          <div>
            <h4 className={`text-sm font-medium mb-2 text-gray-300`}>
              Matching Method
            </h4>
            <ul className={`text-sm space-y-1 text-gray-400`}>
              <li>• <strong>Opta ID Only:</strong> No complex name matching</li>
              <li>• <strong>Zero False Positives:</strong> Exact ID matches only</li>
              <li>• <strong>High Performance:</strong> ~90% faster than multi-tier</li>
              <li>• <strong>Reliable:</strong> No manual overrides needed</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Unmatched Players Table */}
      <UnmatchedPlayersTable optaAnalysis={optaAnalysis} />
      
      {/* Debug Information (Optional) */}
      {optaAnalysis?.duplicateOptas && optaAnalysis.duplicateOptas.size > 0 && (
        <div className={`rounded-lg shadow-sm border p-6 bg-gray-800 border-gray-700`}>
          <h3 className={`text-lg font-medium mb-4 text-white`}>
            ⚠️ Duplicate Opta IDs Detected
          </h3>
          <p className={`text-sm mb-4 text-gray-400`}>
            These Sleeper players share the same Opta ID (only first match is used):
          </p>
          <div className="space-y-2">
            {Array.from(optaAnalysis.duplicateOptas.entries()).map(([optaId, players]) => (
              <div key={optaId} className={`p-3 rounded border bg-gray-700 border-gray-600`}>
                <div className={`text-sm font-medium text-white`}>
                  Opta ID: {optaId}
                </div>
                <div className={`text-xs mt-1 text-gray-400`}>
                  Players: {players.map(p => `${p.name} (${p.team})`).join(', ')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ----------------- ENHANCED GAMEWEEK DISPLAY COMPONENT -----------------
const GameweekDisplay = ({ gameweek }) => {
  const getStatusIcon = (status) => {
    switch (status) {
      case 'upcoming': return '🏁';
      case 'live': return '🔴';
      case 'completed': return '✅';
      default: return '⚽';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'upcoming': return 'bg-blue-900 border-blue-700';
      case 'live': return 'bg-red-900 border-red-700';
      case 'completed': return 'bg-green-900 border-green-700';
      default: return 'bg-gray-900 border-gray-700';
    }
  };

  const getTextColor = (status) => {
    switch (status) {
      case 'upcoming': return 'text-blue-100';
      case 'live': return 'text-red-100';
      case 'completed': return 'text-green-100';
      default: return 'text-gray-100';
    }
  };

  const getSubTextColor = (status) => {
    switch (status) {
      case 'upcoming': return 'text-blue-200';
      case 'live': return 'text-red-200';
      case 'completed': return 'text-green-200';
      default: return 'text-gray-200';
    }
  };

  const getHoverColor = (status) => {
    switch (status) {
      case 'upcoming': return 'hover:bg-blue-800 hover:border-blue-600';
      case 'live': return 'hover:bg-red-800 hover:border-red-600';
      case 'completed': return 'hover:bg-green-800 hover:border-green-600';
      default: return 'hover:bg-gray-800 hover:border-gray-600';
    }
  };

  // Handle click to open Premier League fixtures page
  const handleGameweekClick = () => {
    const gameweekNumber = gameweek.number;
    const fixturesUrl = `https://fantasy.premierleague.com/fixtures/${gameweekNumber}`;
    
    // Open in new tab
    window.open(fixturesUrl, '_blank', 'noopener,noreferrer');
    
    // Log for debugging
    console.log(`🔗 Opening Premier League fixtures for GW${gameweekNumber}: ${fixturesUrl}`);
  };

  return (
    <button
      onClick={handleGameweekClick}
      className={`${getStatusColor(gameweek.status)} ${getHoverColor(gameweek.status)} border rounded-lg px-3 py-2 transition-all duration-200 cursor-pointer transform hover:scale-105 active:scale-95`}
      title={`Click to view GW${gameweek.number} fixtures on Premier League website`}
    >
      <div className={`text-sm font-medium ${getTextColor(gameweek.status)} flex items-center gap-1`}>
        {getStatusIcon(gameweek.status)} GW {gameweek.number} ({gameweek.status === 'upcoming' ? 'Upcoming' : gameweek.status === 'live' ? 'Live' : 'Completed'})
        <span className="text-xs opacity-70 ml-1">🔗</span>
      </div>
      <div className={`text-xs ${getSubTextColor(gameweek.status)}`}>
        {gameweek.status === 'upcoming' ? 'Starts' : gameweek.status === 'live' ? 'Ends' : 'Finished'}: {gameweek.date}
        {gameweek.deadlineFormatted && gameweek.status === 'upcoming' && (
          <div className="mt-1">Deadline: {gameweek.deadlineFormatted}</div>
        )}
        {gameweek.source && gameweek.source !== 'fpl_api' && (
          <div className="mt-1 opacity-75">⚠️ {gameweek.source}</div>
        )}
        <div className="mt-1 text-xs opacity-60">Click to view fixtures</div>
      </div>
    </button>
  );
};

// ----------------- DASHBOARD HEADER COMPONENT -----------------
const DashboardHeader = ({ lastUpdated, players, updateData, activeTab, setActiveTab, currentGameweek, scoringMode, setScoringMode }) => {
  const freshnessStatus = getDataFreshnessStatus(lastUpdated);
  const cacheAge = CacheManager.getAge();

  return (
    <header className={`bg-gray-800 border-gray-700 border-b sticky top-0 z-50`}>
      <div className="max-w-7xl mx-auto px-2 sm:px-4 py-2 sm:py-4">
        {/* Top Row: Title, Gameweek, Update Button */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-4 mb-2 sm:mb-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 w-full sm:w-auto">
            <h1 className={`text-lg sm:text-2xl font-bold text-white whitespace-nowrap`}>⚽ Fantasy FC Playbook</h1>

            {/* Data Freshness Indicator - Hidden on mobile */}
            <div className="hidden sm:flex flex-col gap-1 text-sm">
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-${freshnessStatus.color}-100 text-${freshnessStatus.color}-800`}>
                  🕒 {freshnessStatus.message}
                </span>
              </div>
              {lastUpdated && (
                <div className="text-xs text-gray-400">
                  Last data pull: {new Date(lastUpdated).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                  })} (FFH + Sleeper)
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto justify-between sm:justify-end">
            {/* Current Gameweek with Enhanced Display */}
            <GameweekDisplay gameweek={currentGameweek} />

            {/* Scoring Mode Toggle - 3 Options: FFH / V3 / V4 */}
            <div className="flex items-center gap-1 sm:gap-2">
              <span className="text-xs sm:text-sm text-gray-300 hidden sm:inline">
                Scoring:
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => setScoringMode('ffh')}
                  className={`px-2 sm:px-3 py-1 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                    scoringMode === 'ffh'
                      ? 'bg-blue-500 text-white hover:bg-blue-600'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                  title="Fantasy Football Hub (FPL scoring)"
                >
                  📊 FFH
                </button>
                <button
                  onClick={() => setScoringMode('v3')}
                  className={`px-2 sm:px-3 py-1 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                    scoringMode === 'v3'
                      ? 'bg-green-500 text-white hover:bg-green-600'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                  title="V3 Sleeper conversion (position-based ratios)"
                >
                  🚀 V3
                </button>
                <button
                  onClick={() => setScoringMode('v4')}
                  className={`px-2 sm:px-3 py-1 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                    scoringMode === 'v4'
                      ? 'bg-purple-500 text-white hover:bg-purple-600'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                  title="V4 Ensemble (ML-enhanced predictions)"
                >
                  🤖 V4
                </button>
              </div>
            </div>


            {/* Update Data Button */}
            <button
              onClick={() => updateData('manual', true, false)}
              className="bg-blue-500 hover:bg-blue-600 text-white px-2 sm:px-4 py-1 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center gap-1 sm:gap-2 whitespace-nowrap"
            >
              🔄 <span className="hidden sm:inline">Update Data</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex space-x-1 overflow-x-auto pb-2 -mb-2 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
          {[
            { id: 'home', label: 'Home' },
            { id: 'players', label: 'Players' },
            { id: 'matching', label: 'Matching' },
            { id: 'optimizer', label: 'Start/Sit' },
            { id: 'transfers', label: 'Transfers' },
            { id: 'comparison', label: 'Comparison' },
            { id: 'cheatsheet', label: 'Cheat Sheet' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 font-medium rounded-lg transition-colors whitespace-nowrap flex-shrink-0 ${
                activeTab === tab.id
                  ? 'bg-blue-500 text-white'
                  : 'text-gray-300 hover:text-white hover:bg-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
};

// ----------------- MAIN DASHBOARD COMPONENT -----------------
export default function FPLDashboard() {
  const [activeTab, setActiveTab] = useState('home');
  const [filters, setFilters] = useState({
    position: [], // Changed to array for multi-select
    team: FILTER_OPTIONS.ALL,
    owner: FILTER_OPTIONS.MY_PLAYERS_AND_FAS,
    minPoints: 0.1,
    search: ''
  });
  const [sortConfig, setSortConfig] = useState({ key: 'sleeper_points_ros', direction: 'desc' });
  const [scoringMode, setScoringMode] = useState('v3'); // 'ffh' or 'v3'

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
  // Note: V3 scoring is already applied server-side in the API
  // We just need to trigger a re-render when scoringMode changes
  useEffect(() => {
    if (players && Array.isArray(players) && players.length > 0) {
      // Create a unique key for logging
      const logKey = `${scoringMode}-${players.length}`;

      // Only log if this combination hasn't been logged yet
      if (!window._lastScoringLog || window._lastScoringLog !== logKey) {
        console.log(`📊 Dashboard: Displaying ${scoringMode === 'v3' ? 'V3 Sleeper' : 'FFH'} scoring for ${players.length} players`);

        // Debug: Check if V3 data exists
        const samplePlayer = players.find(p => p.predicted_points > 0);
        if (samplePlayer) {
          console.log('Sample player data:', {
            name: samplePlayer.name,
            ffh_predicted: samplePlayer.predicted_points,
            v3_season_total: samplePlayer.v3_season_total,
            v3_current_gw: samplePlayer.v3_current_gw,
            v3_confidence: samplePlayer.v3_confidence,
            // NEW V3 Enhancement Fields
            v3_minutes_adjustment: samplePlayer.v3_minutes_adjustment,
            v3_expected_minutes: samplePlayer.v3_expected_minutes,
            v3_form_multiplier: samplePlayer.v3_form_multiplier,
            v3_form_trend: samplePlayer.v3_form_trend,
            v3_fixture_multiplier: samplePlayer.v3_fixture_multiplier,
            v3_fixture_rating: samplePlayer.v3_fixture_rating
          });
        }

        window._lastScoringLog = logKey;
      }

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

  // Position color utility (shared with transfers tab) - memoized
  const getPositionColor = useCallback((position) => {
    switch (position) {
      case 'FWD': return {
        bg: 'bg-purple-100',
        text: 'text-purple-800',
        border: 'border-purple-200',
        accent: 'bg-purple-500',
        pill: 'bg-gradient-to-r from-purple-500 to-purple-600'
      };
      case 'MID': return {
        bg: 'bg-pink-100',
        text: 'text-pink-800',
        border: 'border-pink-200',
        accent: 'bg-pink-500',
        pill: 'bg-gradient-to-r from-pink-500 to-pink-600'
      };
      case 'DEF': return {
        bg: 'bg-teal-100',
        text: 'text-teal-800',
        border: 'border-teal-200',
        accent: 'bg-teal-500',
        pill: 'bg-gradient-to-r from-teal-500 to-teal-600'
      };
      case 'GKP': return {
        bg: 'bg-yellow-100',
        text: 'text-yellow-800',
        border: 'border-yellow-200',
        accent: 'bg-yellow-500',
        pill: 'bg-gradient-to-r from-yellow-500 to-yellow-600'
      };
      default: return {
        bg: 'bg-gray-100',
        text: 'text-gray-800',
        border: 'border-gray-200',
        accent: 'bg-gray-500',
        pill: 'bg-gradient-to-r from-gray-500 to-gray-600'
      };
    }
  }, []);

  // Sorting function (memoized to prevent unnecessary re-renders)
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

  // Get sort value for a player and column (memoized for performance)
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
        // Use specific gameweek predictions from the predictions array (better logic)
        if (player.predictions && Array.isArray(player.predictions)) {
          const currentGW = currentGameweek?.number;
          const targetGameweeks = Array.from({length: 5}, (_, i) => currentGW + i);
          let totalPoints = 0;
          const gameweekDetails = [];

          targetGameweeks.forEach(gw => {
            const prediction = player.predictions.find(p => p.gw === gw);
            if (prediction) {
              const gwPoints = scoringMode === 'v3'
                ? (prediction.v3_predicted_pts || prediction.predicted_pts || 0)
                : (prediction.predicted_pts || 0);
              totalPoints += gwPoints;
              gameweekDetails.push({ gw, points: gwPoints });
            }
          });

          // Debug logging for Lammens
          if (player.name?.includes('Lammens') || player.web_name?.includes('Lammens')) {
            console.log(`🔍 Players table calc for ${player.name || player.web_name}:`, {
              scoringMode,
              currentGW,
              targetGameweeks,
              totalPoints,
              gameweekDetails,
              predictionsLength: player.predictions?.length
            });
          }

          return totalPoints;
        }

        // Fallback to old logic if predictions array not available
        if (player.sleeper_gw_predictions) {
          try {
            const gwPreds = JSON.parse(player.sleeper_gw_predictions);
            const next5 = Object.values(gwPreds).slice(0, 5);
            return next5.length > 0 ? next5.reduce((a, b) => a + b, 0) : 0;
          } catch (e) {
            // Fall through
          }
        }
        if (player.ffh_gw_predictions) {
          try {
            const gwPreds = JSON.parse(player.ffh_gw_predictions);
            const next5 = Object.values(gwPreds).slice(0, 5);
            return next5.length > 0 ? next5.reduce((a, b) => a + b, 0) : 0;
          } catch (e) {
            // Fall through
          }
        }
        const seasonPoints = v3ScoringService.getScoringValue(player, 'points_ros', scoringMode);
        return seasonPoints > 0 ? (seasonPoints / TOTAL_GAMEWEEKS) * NEXT_N_GAMEWEEKS : 0;
      case 'avg_minutes_next5':
        if (player.avg_minutes_next5 && player.avg_minutes_next5 > 0) {
          return player.avg_minutes_next5;
        }

        if (player.predictions && Array.isArray(player.predictions)) {
          const next5Predictions = player.predictions.slice(0, 5);
          if (next5Predictions.length > 0) {
            const totalMinutes = next5Predictions.reduce((total, pred) => total + (pred.xmins || 0), 0);
            return totalMinutes / next5Predictions.length;
          }
        }

        if (player.ffh_gw_minutes) {
          try {
            const gwMinutes = JSON.parse(player.ffh_gw_minutes);
            const next5Minutes = Object.values(gwMinutes).slice(0, 5);
            if (next5Minutes.length > 0) {
              return next5Minutes.reduce((a, b) => a + b, 0) / next5Minutes.length;
            }
          } catch (e) {
            // Continue to default
          }
        }

        return 0;
      case 'current_ppg':
        // Use FFH season average (actual current PPG)
        return player.ffh_season_avg || 0;
      case 'predicted_ppg':
        // Use Sleeper season average (predicted PPG after conversion)
        return player.sleeper_season_avg || 0;
      case 'owned_by':
        return player.owned_by || 'Free Agent';
      default:
        return '';
    }
  }, [scoringMode, currentGameweek]);

  // Filter players based on current filters (memoized for performance)
  const filteredPlayers = useMemo(() => {
    return processedPlayers.filter(player => {
      // EPL TEAMS ONLY: Only show players from actual EPL teams
      if (!isEPLPlayer(player)) {
        return false;
      }

      // Position filter - multi-select
      if (filters.position.length > 0) {
        const playerPos = player.position;
        const isPositionMatch = filters.position.some(filterPos => {
          // Handle goalkeeper variations
          if (filterPos === 'GKP') {
            return playerPos === 'GKP' || playerPos === 'GK';
          } else {
            return playerPos === filterPos;
          }
        });
        if (!isPositionMatch) return false;
      }

      // Team filter
      if (filters.team !== 'all' && player.team_abbr !== filters.team) {
        return false;
      }

      // Owner filter
      if (filters.owner !== FILTER_OPTIONS.ALL) {
        if (filters.owner === FILTER_OPTIONS.MY_PLAYERS_AND_FAS) {
          // Show only my players OR free agents
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
      const getRosPoints = (player) => {
        if (player.sleeper_season_total) return player.sleeper_season_total;
        if (player.sleeper_season_avg) return player.sleeper_season_avg * TOTAL_GAMEWEEKS;
        if (player.ffh_season_prediction) return player.ffh_season_prediction;
        if (player.predicted_pts) return player.predicted_pts;
        if (player.total_points) return player.total_points;
        return 0;
      };

      const playerPoints = getRosPoints(player);
      if (playerPoints < filters.minPoints) {
        return false;
      }

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

        if (!searchableText.includes(searchTerm)) {
          return false;
        }
      }

      return true;
    });
  }, [processedPlayers, filters.position, filters.team, filters.owner, filters.minPoints, filters.search]);

  // Sort players based on sort config (memoized for performance)
  const sortedPlayers = useMemo(() => {
    return [...filteredPlayers].sort((a, b) => {
      const aValue = getSortValue(a, sortConfig.key);
      const bValue = getSortValue(b, sortConfig.key);

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
      } else {
        const aStr = String(aValue);
        const bStr = String(bValue);
        if (sortConfig.direction === 'asc') {
          return aStr.localeCompare(bStr);
        } else {
          return bStr.localeCompare(aStr);
        }
      }
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
          <LoadingSpinner 
            message="Loading player data..." 
          />
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
            <p className={`mb-4 text-gray-400`}>{error}</p>
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
      case 'players': 
        return null; // No stats cards for players tab
      case 'matching':
        return <MatchingStatsCard players={processedPlayers} integration={integration} />;
      case 'optimizer':
        return <OptimizerStatsCard scoringMode={scoringMode} currentGameweek={currentGameweek} />;
      case 'transfers':
        return <TransferStatsCard
          players={processedPlayers}
          scoringMode={scoringMode}
          gameweekRange={transferGameweekRange}
        />;
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
            />
          )}

          {activeTab === 'players' && (
            <>
              {/* Filters */}
              <div className={`p-4 rounded-lg mb-6 shadow-sm bg-gray-800`}>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {/* Position Filter - Multi-select */}
                  <div>
                    <label className={`block text-sm font-medium mb-2 text-gray-300`}>
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
                    <label className={`block text-sm font-medium mb-2 text-gray-300`}>
                      Owner
                    </label>
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
                    <label className={`block text-sm font-medium mb-2 text-gray-300`}>
                      Min ROS Points
                    </label>
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
                    <label className={`block text-sm font-medium mb-2 text-gray-300`}>
                      Search
                    </label>
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
                <div className={`text-sm text-gray-400`}>
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
              <div className={`rounded-lg shadow-sm border overflow-hidden bg-gray-800 border-gray-700`}>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className={'bg-gray-700'}>
                      <tr>
                        {/* Sortable headers */}
                        <th 
                          className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-opacity-75 ${
                            'text-gray-300 hover:bg-gray-600'
                          }`}
                          onClick={() => handleSort('name')}
                        >
                          <div className="flex items-center">
                            Player {renderSortIcon('name')}
                          </div>
                        </th>
                        <th 
                          className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-opacity-75 ${
                            'text-gray-300 hover:bg-gray-600'
                          }`}
                          onClick={() => handleSort('position')}
                        >
                          <div className="flex items-center">
                            Position {renderSortIcon('position')}
                          </div>
                        </th>
                        <th 
                          className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-opacity-75 ${
                            'text-gray-300 hover:bg-gray-600'
                          }`}
                          onClick={() => handleSort('team')}
                        >
                          <div className="flex items-center">
                            Team {renderSortIcon('team')}
                          </div>
                        </th>
                        <th 
                          className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-opacity-75 ${
                            'text-gray-300 hover:bg-gray-600'
                          }`}
                          onClick={() => handleSort('owned_by')}
                        >
                          <div className="flex items-center">
                            Ownership {renderSortIcon('owned_by')}
                          </div>
                        </th>
                        <th 
                          className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-opacity-75 ${
                            'text-gray-300 hover:bg-gray-600'
                          }`}
                          onClick={() => handleSort('sleeper_points_ros')}
                        >
                          <div className="flex items-center">
                            ROS Points {renderSortIcon('sleeper_points_ros')}
                          </div>
                        </th>
                        <th 
                          className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-opacity-75 ${
                            'text-gray-300 hover:bg-gray-600'
                          }`}
                          onClick={() => handleSort('sleeper_points_next5')}
                        >
                          <div className="flex items-center">
                            Next 5 GW {renderSortIcon('sleeper_points_next5')}
                          </div>
                        </th>
                        <th 
                          className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-opacity-75 ${
                            'text-gray-300 hover:bg-gray-600'
                          }`}
                          onClick={() => handleSort('avg_minutes_next5')}
                        >
                          <div className="flex items-center">
                            Avg Mins (Next 5) {renderSortIcon('avg_minutes_next5')}
                          </div>
                        </th>
                        <th 
                          className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-opacity-75 ${
                            'text-gray-300 hover:bg-gray-600'
                          }`}
                          onClick={() => handleSort('predicted_ppg')}
                        >
                          <div className="flex items-center">
                            PPG (Predicted) {renderSortIcon('predicted_ppg')}
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${'bg-gray-800 divide-gray-700'}`}>
                      {sortedPlayers.map((player, index) => (
                        <tr key={`${player.sleeper_id || player.id || index}`} className={`${'hover:bg-gray-700'}`}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div>
                                <div className={`text-sm font-medium flex items-center gap-2`}>
                                  <button
                                    onClick={() => handlePlayerClick(player)}
                                    className="text-white hover:text-blue-400 underline decoration-transparent hover:decoration-blue-400 transition-all cursor-pointer text-left"
                                  >
                                    {player.name || `${player.first_name || ''} ${player.last_name || ''}`.trim()}
                                  </button>
                                  {player.news && player.news.trim() !== '' && (
                                    <span
                                      className="text-orange-400 hover:text-orange-300 cursor-pointer transition-colors"
                                      title={player.news}
                                    >
                                      📰
                                    </span>
                                  )}
                                </div>
                                {player.injury_status && (
                                  <div className="text-xs text-red-600">
                                    🏥 {player.injury_status}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getSleeperPositionStyle(player.position)}`}>
                              {player.position || 'N/A'}
                            </span>
                          </td>
                          <td className={`px-6 py-4 whitespace-nowrap text-sm text-gray-300`}>
                            {TEAM_DISPLAY_NAMES[player.team_abbr] || player.team_abbr || 'N/A'}
                          </td>
<td className="px-6 py-4 whitespace-nowrap text-sm">
  {player.owned_by && player.owned_by !== OWNERSHIP_STATUS.FREE_AGENT && player.owned_by !== '' ? (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
      player.owned_by === USER_ID
        ? 'bg-indigo-100 text-indigo-900 border border-indigo-400'  // Deep indigo for "My Player"
        : 'bg-orange-100 text-orange-900 border border-orange-400'   // Orange for other owners
    }`}>
      {player.owned_by === USER_ID ? '👤 My Player' : player.owned_by}
    </span>
  ) : (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-300">
      ⚡ Free Agent
    </span>
  )}
</td>
                          <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium text-white`}>
                            {(() => {
                              const seasonTotal = v3ScoringService.getScoringValue(player, 'season_total', scoringMode);
                              return seasonTotal > 0 ? seasonTotal.toFixed(1) : 'N/A';
                            })()}
                          </td>
                          <td className={`px-6 py-4 whitespace-nowrap text-sm text-gray-300`}>
                            {(() => {
                              // Pure FFH data - sum first 5 predictions ONLY
                              if (player.predictions && Array.isArray(player.predictions)) {
                                const first5Predictions = player.predictions.slice(0, 5);
                                const totalPoints = first5Predictions.reduce((sum, pred) => {
                                  return sum + (pred.predicted_pts || 0);
                                }, 0);
                                return totalPoints.toFixed(1);
                              }
                              // No fallbacks - return 0 if no predictions
                              return '0.0';
                            })()}
                          </td>
                          <td className={`px-6 py-4 whitespace-nowrap text-sm text-gray-300`}>
                            {(() => {
                              // Pure FFH data - average of first 5 predictions xmins ONLY
                              if (player.predictions && Array.isArray(player.predictions)) {
                                const first5Predictions = player.predictions.slice(0, 5);
                                if (first5Predictions.length > 0) {
                                  const totalMinutes = first5Predictions.reduce((sum, pred) => sum + (pred.xmins || 0), 0);
                                  const avgMinutes = totalMinutes / first5Predictions.length;
                                  return avgMinutes.toFixed(0);
                                }
                              }
                              // No fallbacks - return 0 if no predictions
                              return '0';
                            })()}
                          </td>
                          <td className={`px-6 py-4 whitespace-nowrap text-sm text-gray-300`}>
                            {(() => {
                              const predictedPpg = v3ScoringService.getScoringValue(player, 'season_avg', scoringMode);
                              return predictedPpg.toFixed(1);
                            })()}
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
                  <div className={`mb-2 text-gray-400`}>No players match your current filters</div>
                  <button
                    onClick={() => {
                      setFilters({
                        position: [], // Clear to empty array
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

          {/* Matching statistics and information */}
          {activeTab === 'matching' && (
            <MatchingTabContent players={processedPlayers} integration={integration} />
          )}

          {/* Optimizing lineup for the current GW */}
          {activeTab === 'optimizer' && (
            <OptimizerTabContent 
 
              players={processedPlayers}
              currentGameweek={currentGameweek}
              scoringMode={scoringMode}
            />
          )}
          
          {/* Get recommendations and explore free agents to pick up */}
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

          {/* Compare 2 players side by side */}
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

          {/* Cheat Sheet - Quick reference rankings */}
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