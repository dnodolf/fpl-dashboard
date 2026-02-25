// app/components/OptimizerTabContent.js - COMPLETE UPDATED FILE
// Enhanced Optimizer Tab Component with Sleeper position colors

import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import MyPlayersTable from './MyPlayersTable.js';
import v3ScoringService from '../services/v3ScoringService.js';
import { getSleeperPositionCardStyle, getPositionColors } from '../constants/positionColors';
import { getDifficultyColor } from '../constants/designTokens';
import { getFPLStatusBadge } from '../utils/newsUtils';
import { USER_ID } from '../config/constants';
import PlayerAvatar from './common/PlayerAvatar';

// ----------------- OPTIMIZER HOOK -----------------
function useOptimizerData(userId = USER_ID, scoringMode = 'ffh', currentGameweek) {
  const [data, setData] = useState({
    loading: true,
    error: null,
    stats: {
      currentPoints: 0,
      optimalPoints: 0,
      improvement: 0,
      efficiency: 0,
      playersToSwap: 0,
      formationChange: false
    },
    current: null,
    optimal: null,
    recommendations: [],
    allFormations: [],
    roster: null,
    lastUpdated: null
  });

  const fetchOptimizerData = async (forceRefresh = false) => {
    try {
      setData(prev => ({ ...prev, loading: true, error: null }));

      // Validate currentGameweek if using v3 scoring
      if (scoringMode === 'v3' && !currentGameweek?.number) {
        throw new Error('Current gameweek data is required for v3 scoring mode');
      }

      const response = await fetch('/api/optimizer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          forceRefresh,
          analysisType: 'current_roster',
          scoringMode,
          currentGameweek: currentGameweek?.number || currentGameweek
        })
      });

      if (!response.ok) {
        throw new Error(`Optimizer API failed: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        setData({
          loading: false,
          error: null,
          ...result
        });
      } else {
        throw new Error(result.error || 'Optimizer analysis failed');
      }
    } catch (error) {
      console.error('❌ Error fetching optimizer data:', error);
      setData(prev => ({
        ...prev,
        loading: false,
        error: error.message
      }));
    }
  };

  useEffect(() => {
    fetchOptimizerData();
  }, [userId, scoringMode, currentGameweek]);

  return { ...data, refetch: fetchOptimizerData };
}

// ----------------- FORMATION VISUALIZATION COMPONENT - PROPER LAYOUTS -----------------
const FormationVisualization = ({ lineup, isOptimal = false, optimalPlayerIds = [], scoringMode = 'ffh', currentLineup = null, optimalLineup = null, onPlayerClick, currentGameweek = null, benchPlayers = null }) => {
  if (!lineup || !lineup.players || lineup.players.length === 0) {
    return (
      <div className={`p-8 text-center border-2 border-dashed rounded-lg ${
        'bg-gray-800 border-gray-600 text-gray-400'
      }`}>
        <div className="text-4xl mb-2">⚽</div>
        <p>No lineup data available</p>
      </div>
    );
  }

  // Group players by position
  const playersByPosition = {
    GKP: [],
    DEF: [],
    MID: [],
    FWD: []
  };

  lineup.players.forEach(player => {
    const pos = player.position || 'Unknown';
    if (playersByPosition[pos]) {
      playersByPosition[pos].push(player);
    }
  });

  // Get formation layout based on formation string
  const getFormationLayout = (formation) => {
    if (!formation) return { def: 4, mid: 4, fwd: 2 }; // default 4-4-2
    
    const parts = formation.split('-').map(n => parseInt(n));
    if (parts.length === 3) {
      return { def: parts[0], mid: parts[1], fwd: parts[2] };
    }
    
    // Handle the 6 formation patterns we evaluate
    switch(formation) {
      case '3-5-2': return { def: 3, mid: 5, fwd: 2 };
      case '4-4-2': return { def: 4, mid: 4, fwd: 2 };
      case '4-5-1': return { def: 4, mid: 5, fwd: 1 };
      case '3-4-3': return { def: 3, mid: 4, fwd: 3 };
      case '4-3-3': return { def: 4, mid: 3, fwd: 3 };
      case '5-4-1': return { def: 5, mid: 4, fwd: 1 };
      default: return { def: 4, mid: 4, fwd: 2 }; // fallback
    }
  };

  // Player Card Component - UPDATED WITH SLEEPER COLORS AND PREDICTED MINUTES
  const PlayerCard = ({ player, isInOptimal = false, scoringMode = 'ffh', currentLineup = null, optimalLineup = null }) => {
    // Extract last name only for better readability
    const getLastName = (player) => {
      if (player.web_name) return player.web_name;
      if (player.name) {
        const nameParts = player.name.split(' ');
        return nameParts[nameParts.length - 1];
      }
      return 'Unknown';
    };

    // Check if this player is in current lineup (for showing correct indicators)
    const playerId = player.id || player.player_id || player.sleeper_id;

    // For optimal lineup display: ✓ if player is ALSO in current, ✗ if player is NOT in current
    const currentPlayerIds = currentLineup?.players?.map(p => p.id || p.player_id || p.sleeper_id) || [];
    const isInCurrentLineup = currentPlayerIds.includes(playerId);

    // For current lineup display: Check if player is in optimal lineup (should be kept) or not (should be benched)
    const optimalPlayerIds = optimalLineup?.players?.map(p => p.id || p.player_id || p.sleeper_id) || [];
    const isInOptimalLineup = optimalPlayerIds.includes(playerId);

    // Extract predicted minutes
    const getPredictedMinutes = (player) => {
      if (player.current_gameweek_prediction?.predicted_mins) {
        return Math.round(player.current_gameweek_prediction.predicted_mins);
      }
      if (player.predictions && Array.isArray(player.predictions)) {
        const gwNum = currentGameweek?.number;
        const gwPred = gwNum ? player.predictions.find(p => p.gw === gwNum) : player.predictions[0];
        if (gwPred?.xmins != null) return Math.round(gwPred.xmins);
      }
      if (player.predicted_mins) return Math.round(player.predicted_mins);
      if (player.xmins) return Math.round(player.xmins);
      return null;
    };

    // Extract next opponent from predictions
    const getNextOpponent = (player) => {
      if (!player.predictions?.length) return null;
      const gwNum = currentGameweek?.number;
      const nextPred = gwNum ? player.predictions.find(p => p.gw === gwNum) : player.predictions[0];
      if (!nextPred?.opp?.[0] || !Array.isArray(nextPred.opp[0])) return null;
      const [code, full, difficulty] = nextPred.opp[0];
      return { code: (code || '').toUpperCase(), isHome: (full || '').includes('(H)'), difficulty: difficulty || 3 };
    };

    const predictedMinutes = getPredictedMinutes(player);
    const opponent = getNextOpponent(player);
    const fplBadge = player.fpl_status && player.fpl_status !== 'a' ? getFPLStatusBadge(player.fpl_status) : null;

    // Get position colors for subtle background
    const posColors = getPositionColors(player.position);

    // Map position to subtle background color
    const positionBgMap = {
      GKP: 'bg-yellow-900/50 border-yellow-700/50',
      DEF: 'bg-cyan-900/50 border-cyan-700/50',
      MID: 'bg-pink-900/50 border-pink-700/50',
      FWD: 'bg-purple-900/50 border-purple-700/50'
    };
    const positionBg = positionBgMap[player.position?.toUpperCase()] || 'bg-gray-700 border-gray-600';

    return (
      <button
        onClick={() => onPlayerClick?.(player)}
        className={`relative flex flex-col items-center p-1.5 m-0.5 rounded-lg border text-xs text-white ${positionBg} hover:brightness-125 transition-all cursor-pointer`}
        style={{ width: 'clamp(68px, 100%, 80px)' }}
      >

        {/* Show indicators on optimal lineup: ✓ for players in current lineup, ✗ for swaps needed */}
        {isOptimal && (
          <div className={`absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-xs ${
            isInCurrentLineup
              ? 'bg-green-500 text-white'
              : 'bg-blue-500 text-white'
          }`}>
            {isInCurrentLineup ? '✓' : '+'}
          </div>
        )}

        {/* Show indicators on current lineup: ✓ for players also in optimal, ✗ for players to bench */}
        {!isOptimal && optimalLineup && (
          <div className={`absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-xs ${
            isInOptimalLineup
              ? 'bg-green-500 text-white'
              : 'bg-red-500 text-white'
          }`}>
            {isInOptimalLineup ? '✓' : '✗'}
          </div>
        )}

        {/* Injury/status indicator */}
        {fplBadge && (
          <div className={`absolute -top-1 -left-1 w-4 h-4 rounded-full flex items-center justify-center text-[8px] ${
            player.fpl_status === 'i' || player.fpl_status === 's' ? 'bg-red-500' :
            player.fpl_status === 'd' ? 'bg-orange-500' : 'bg-gray-500'
          }`} title={`${fplBadge.badge}${player.fpl_news ? ': ' + player.fpl_news : ''}`}>
            {fplBadge.icon}
          </div>
        )}

        {/* Player Avatar */}
        <PlayerAvatar player={player} size="xs" />

        <div className="font-medium text-center leading-tight truncate w-full text-[10px]" title={player.full_name || player.name}>
          {getLastName(player)}
        </div>

        <div className="opacity-75 text-[10px]">{player.team_abbr || player.team}</div>

        {/* Predicted Points - green if optimal, red if should be benched */}
        <div className={`font-semibold text-[11px] ${
          isOptimal
            ? (isInCurrentLineup ? 'text-green-400' : 'text-blue-400')
            : (isInOptimalLineup ? 'text-green-400' : 'text-red-400')
        }`}>
          {(() => {
            const points = scoringMode === 'v3'
              ? (player.v3_current_gw || 0)
              : (player.current_gw_prediction || 0);
            return points.toFixed(1);
          })()}
        </div>

        {/* Minutes + Opponent row */}
        <div className="flex items-center gap-1 text-[9px] mt-0.5">
          {predictedMinutes != null && (
            <span className="text-gray-400">{predictedMinutes}m</span>
          )}
          {opponent && (
            <span className={`px-1 rounded ${getDifficultyColor(opponent.difficulty)} text-[8px] font-medium`}>
              {opponent.code}{opponent.isHome ? '(H)' : '(A)'}
            </span>
          )}
        </div>
      </button>
    );
  };

  const currentFormation = lineup.formation || 'Unknown';
  // Recalculate total points based on current scoring mode
  const totalPoints = lineup.players ? lineup.players.reduce((sum, player) => {
    const points = scoringMode === 'v3'
      ? (player.v3_current_gw || 0)
      : (player.current_gw_prediction || 0);
    return sum + points;
  }, 0) : (lineup.points || lineup.totalPoints || 0);
  const layout = getFormationLayout(currentFormation);
  
  return (
    <div className={`border-2 rounded-lg overflow-hidden ${
      'bg-gray-800 border-gray-600'
      } ${isOptimal ? 'ring-2 ring-green-500' : ''}`}>

      {/* Pitch area */}
      <div className="relative">
        {/* Field Background */}
        <div className="absolute inset-2 bg-gradient-to-b from-green-600 to-green-700 rounded-lg opacity-20"></div>

        {/* Formation and Points Header */}
        <div className="absolute top-3 left-4 right-4 flex justify-between items-center z-20">
          <span className={`text-sm font-medium text-gray-300`}>
            {currentFormation}
          </span>
          <span className={`text-sm font-semibold ${
            isOptimal
              ? 'text-green-400'
              : 'text-blue-400'
          }`}>
            {totalPoints.toFixed(1)} pts
          </span>
        </div>

        {/* Formation Layout - PROPER FORMATION STRUCTURE */}
        <div className="relative z-10 flex flex-col justify-between py-8 px-4" style={{ minHeight: '480px' }}>
        
        {/* Forwards - Show exactly layout.fwd players */}
        {layout.fwd > 0 && (
          <div className="flex justify-center gap-2 flex-wrap">
            {playersByPosition.FWD.slice(0, layout.fwd).map((player, idx) => (
              <PlayerCard key={`fwd-${player.id || idx}`} player={player} isInOptimal={isOptimal} scoringMode={scoringMode} currentLineup={currentLineup} optimalLineup={optimalLineup} />
            ))}
            {/* Fill missing FWD slots if needed */}
            {Array.from({ length: Math.max(0, layout.fwd - playersByPosition.FWD.length) }).map((_, idx) => (
              <div key={`empty-fwd-${idx}`} className={`flex flex-col items-center p-2 m-1 rounded-lg border-2 border-dashed text-xs ${
                'border-gray-600 text-gray-500'
              }`} style={{ width: 'clamp(68px, 100%, 80px)' }}>
                <div>Empty</div>
                <div className="text-xs opacity-50">FWD</div>
              </div>
            ))}
          </div>
        )}
        
        {/* Midfielders - Show exactly layout.mid players */}
        {layout.mid > 0 && (
          <div className="flex justify-center gap-2 flex-wrap">
            {playersByPosition.MID.slice(0, layout.mid).map((player, idx) => (
              <PlayerCard key={`mid-${player.id || idx}`} player={player} isInOptimal={isOptimal} scoringMode={scoringMode} currentLineup={currentLineup} optimalLineup={optimalLineup} />
            ))}
            {/* Fill missing MID slots if needed */}
            {Array.from({ length: Math.max(0, layout.mid - playersByPosition.MID.length) }).map((_, idx) => (
              <div key={`empty-mid-${idx}`} className={`flex flex-col items-center p-2 m-1 rounded-lg border-2 border-dashed text-xs ${
                'border-gray-600 text-gray-500'
              }`} style={{ width: 'clamp(68px, 100%, 80px)' }}>
                <div>Empty</div>
                <div className="text-xs opacity-50">MID</div>
              </div>
            ))}
          </div>
        )}
        
        {/* Defenders - Show exactly layout.def players */}
        {layout.def > 0 && (
          <div className="flex justify-center gap-2 flex-wrap">
            {playersByPosition.DEF.slice(0, layout.def).map((player, idx) => (
              <PlayerCard key={`def-${player.id || idx}`} player={player} isInOptimal={isOptimal} scoringMode={scoringMode} currentLineup={currentLineup} optimalLineup={optimalLineup} />
            ))}
            {/* Fill missing DEF slots if needed */}
            {Array.from({ length: Math.max(0, layout.def - playersByPosition.DEF.length) }).map((_, idx) => (
              <div key={`empty-def-${idx}`} className={`flex flex-col items-center p-2 m-1 rounded-lg border-2 border-dashed text-xs ${
                'border-gray-600 text-gray-500'
              }`} style={{ width: 'clamp(68px, 100%, 80px)' }}>
                <div>Empty</div>
                <div className="text-xs opacity-50">DEF</div>
              </div>
            ))}
          </div>
        )}
        
        {/* Goalkeeper - Always show 1 */}
        <div className="flex justify-center">
          {playersByPosition.GKP.slice(0, 1).map((player, idx) => (
            <PlayerCard key={`gkp-${player.id || idx}`} player={player} isInOptimal={isOptimal} scoringMode={scoringMode} currentLineup={currentLineup} optimalLineup={optimalLineup} />
          ))}
          {/* Show empty GKP slot if needed */}
          {playersByPosition.GKP.length === 0 && (
            <div className={`flex flex-col items-center p-2 m-1 rounded-lg border-2 border-dashed text-xs ${
              'border-gray-600 text-gray-500'
            }`} style={{ width: 'clamp(68px, 100%, 80px)' }}>
              <div>Empty</div>
              <div className="text-xs opacity-50">GKP</div>
            </div>
          )}
        </div>
      </div>
      </div>

      {/* Bench Players */}
      {benchPlayers && benchPlayers.length > 0 && (
        <div className="border-t border-gray-600 px-3 py-2">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider text-center mb-1">Bench</div>
          <div className="flex justify-center gap-1 flex-wrap">
            {benchPlayers.map((player, idx) => (
              <PlayerCard key={`bench-${player.id || idx}`} player={player} isInOptimal={isOptimal} scoringMode={scoringMode} currentLineup={currentLineup} optimalLineup={optimalLineup} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ----------------- ACTIONABLE RECOMMENDATIONS COMPONENT -----------------
const ActionableRecommendations = ({ recommendations, current, optimal, recalculatedStats, scoringMode = 'ffh', currentGameweek = null }) => {
  // Extract opponent info from player predictions
  const extractOpponent = (p) => {
    if (!p.predictions?.length) return null;
    const gwNum = currentGameweek;
    const pred = gwNum ? p.predictions.find(pr => pr.gw === gwNum) : p.predictions[0];
    if (!pred?.opp?.[0] || !Array.isArray(pred.opp[0])) return null;
    const [code, full, difficulty] = pred.opp[0];
    return { code: (code || '').toUpperCase(), isHome: (full || '').includes('(H)'), difficulty: difficulty || 3 };
  };

  // Extract predicted minutes
  const extractMinutes = (p) => {
    if (p.current_gameweek_prediction?.predicted_mins) return Math.round(p.current_gameweek_prediction.predicted_mins);
    if (p.predictions?.length) {
      const gwNum = currentGameweek;
      const pred = gwNum ? p.predictions.find(pr => pr.gw === gwNum) : p.predictions[0];
      if (pred?.xmins != null) return Math.round(pred.xmins);
    }
    if (p.predicted_mins) return Math.round(p.predicted_mins);
    return null;
  };

  // Get explicit bench and start recommendations by comparing current vs optimal
  const getExplicitChanges = () => {
    if (!current?.players || !optimal?.players) {
      return { toBench: [], toStart: [], netGain: 0 };
    }

    const currentIds = new Set(current.players.map(p => p.id || p.player_id || p.sleeper_id));
    const optimalIds = new Set(optimal.players.map(p => p.id || p.player_id || p.sleeper_id));

    // Players to BENCH: in current but NOT in optimal
    const toBench = current.players.filter(p => {
      const id = p.id || p.player_id || p.sleeper_id;
      return !optimalIds.has(id);
    }).map(p => {
      const pts = scoringMode === 'v3' ? (p.v3_current_gw || 0) : (p.current_gw_prediction || 0);
      return {
        name: p.full_name || p.web_name || p.name,
        position: p.position,
        team: p.team_abbr || p.team,
        points: pts,
        minutes: extractMinutes(p),
        opponent: extractOpponent(p),
        fplStatus: p.fpl_status
      };
    }).sort((a, b) => a.points - b.points);

    // Players to START: in optimal but NOT in current
    const toStart = optimal.players.filter(p => {
      const id = p.id || p.player_id || p.sleeper_id;
      return !currentIds.has(id);
    }).map(p => {
      const pts = scoringMode === 'v3' ? (p.v3_current_gw || 0) : (p.current_gw_prediction || 0);
      return {
        name: p.full_name || p.web_name || p.name,
        position: p.position,
        team: p.team_abbr || p.team,
        points: pts,
        minutes: extractMinutes(p),
        opponent: extractOpponent(p),
        fplStatus: p.fpl_status
      };
    }).sort((a, b) => b.points - a.points);

    // Calculate net gain
    const currentPts = current.players.reduce((sum, p) => {
      return sum + (scoringMode === 'v3' ? (p.v3_current_gw || 0) : (p.current_gw_prediction || 0));
    }, 0);
    const optimalPts = optimal.players.reduce((sum, p) => {
      return sum + (scoringMode === 'v3' ? (p.v3_current_gw || 0) : (p.current_gw_prediction || 0));
    }, 0);
    const netGain = optimalPts - currentPts;

    return { toBench, toStart, netGain };
  };

  const { toBench, toStart, netGain } = getExplicitChanges();

  // Perfect lineup - no changes needed
  if (toBench.length === 0 && toStart.length === 0) {
    return (
      <div className={`rounded-lg border p-6 text-center ${
        'bg-gray-800 border-gray-700'
      }`}>
        <div className="text-green-600 text-4xl mb-2">✅</div>
        <h3 className={`text-lg font-medium mb-2 text-white`}>
          Perfect Lineup!
        </h3>
        <p className={'text-gray-400'}>
          Your current lineup is already optimized.
        </p>
      </div>
    );
  }

  return (
    <div className={`rounded-lg border ${'bg-gray-800 border-gray-700'}`}>
      <div className="p-4 border-b border-gray-600">
        <h3 className={`text-lg font-medium flex items-center gap-2 text-white`}>
          🎯 Lineup Changes
        </h3>
        <p className={`text-sm mt-1 text-gray-400`}>
          Make these changes for <span className="font-bold text-green-400">+{netGain.toFixed(1)} pts</span>
        </p>
      </div>

      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* BENCH Column */}
        {toBench.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <h4 className="text-sm font-semibold text-red-400 uppercase">🔴 Bench ({toBench.length})</h4>
            </div>
            <div className="space-y-2">
              {toBench.map((player, idx) => (
                <div key={idx} className="p-2 rounded-lg bg-red-900/20 border border-red-600/30">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-sm font-medium text-white flex items-center gap-1.5">
                        {player.name}
                        {player.fplStatus && player.fplStatus !== 'a' && (() => {
                          const badge = getFPLStatusBadge(player.fplStatus);
                          return badge ? <span className={`text-[9px] px-1 py-0.5 rounded ${badge.color}`}>{badge.badge}</span> : null;
                        })()}
                      </div>
                      <div className="text-xs text-gray-400">
                        {player.position} • {player.team}
                        {player.opponent && (
                          <span className="ml-1">
                            vs <span className={`px-1 rounded ${getDifficultyColor(player.opponent.difficulty)} text-[10px]`}>
                              {player.opponent.code}{player.opponent.isHome ? '(H)' : '(A)'}
                            </span>
                          </span>
                        )}
                        {player.minutes != null && <span className="ml-1 text-gray-500">{player.minutes}m</span>}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-red-400">{player.points.toFixed(1)}</div>
                      <div className="text-xs text-gray-500">pts</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* START Column */}
        {toStart.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <h4 className="text-sm font-semibold text-green-400 uppercase">🟢 Start ({toStart.length})</h4>
            </div>
            <div className="space-y-2">
              {toStart.map((player, idx) => (
                <div key={idx} className="p-2 rounded-lg bg-green-900/20 border border-green-600/30">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-sm font-medium text-white flex items-center gap-1.5">
                        {player.name}
                        {player.fplStatus && player.fplStatus !== 'a' && (() => {
                          const badge = getFPLStatusBadge(player.fplStatus);
                          return badge ? <span className={`text-[9px] px-1 py-0.5 rounded ${badge.color}`}>{badge.badge}</span> : null;
                        })()}
                      </div>
                      <div className="text-xs text-gray-400">
                        {player.position} • {player.team}
                        {player.opponent && (
                          <span className="ml-1">
                            vs <span className={`px-1 rounded ${getDifficultyColor(player.opponent.difficulty)} text-[10px]`}>
                              {player.opponent.code}{player.opponent.isHome ? '(H)' : '(A)'}
                            </span>
                          </span>
                        )}
                        {player.minutes != null && <span className="ml-1 text-gray-500">{player.minutes}m</span>}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-green-400">{player.points.toFixed(1)}</div>
                      <div className="text-xs text-gray-500">pts</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ----------------- FORMATION COMPARISON COMPONENT - FIXED LAYOUT -----------------
const FormationComparison = ({ allFormations, currentFormation, scoringMode = 'ffh' }) => {
  if (!allFormations || allFormations.length === 0) {
    return (
      <div className={`rounded-lg border p-6 text-center ${
        'bg-gray-800 border-gray-700'
      }`}>
        <div className="text-4xl mb-2">📊</div>
        <h3 className={`text-lg font-medium mb-2 text-white`}>
          Formation Analysis
        </h3>
        <p className={'text-gray-400'}>
          No formation comparison data available.
        </p>
      </div>
    );
  }

  // Recalculate formation points based on current scoring mode
  const formationsWithRecalculatedPoints = allFormations.map(formation => {
    if (!formation.players || !Array.isArray(formation.players)) {
      return { ...formation, recalculatedPoints: 0 };
    }
    
    const recalculatedPoints = formation.players.reduce((sum, player) => {
      let points = 0;
      if (scoringMode === 'v3') {
        points = player.v3_current_gw || 0;
      } else {
        points = player.current_gw_prediction || 0;
      }
      return sum + points;
    }, 0);
    
    return { ...formation, recalculatedPoints };
  });

  // Sort formations by recalculated points and validity
  const sortedFormations = [...formationsWithRecalculatedPoints].sort((a, b) => {
    const aValid = a.valid !== false && a.recalculatedPoints > 0;
    const bValid = b.valid !== false && b.recalculatedPoints > 0;
    
    // Valid formations first
    if (aValid && !bValid) return -1;
    if (!aValid && bValid) return 1;
    
    // Within same validity, sort by recalculated points
    return b.recalculatedPoints - a.recalculatedPoints;
  });
  
  const bestFormation = sortedFormations.find(f => f.valid !== false && f.recalculatedPoints > 0);
  const bestPoints = bestFormation?.recalculatedPoints || 0;

  return (
    <div className={`rounded-lg border ${'bg-gray-800 border-gray-700'}`}>
      <div className="p-4 border-b border-gray-200">
        <h3 className={`text-lg font-medium text-white`}>
          📊 Formation Comparison
        </h3>
      </div>
      <div className="p-4">
        <div className="space-y-3">
          {sortedFormations.slice(0, 6).map((formation, index) => {
            const formationName = formation.formation || formation.name || 'Unknown';
            const isCurrent = formationName === currentFormation;
            const isBest = formation === bestFormation;
            const formationPoints = formation.recalculatedPoints;
            const pointsDiff = bestPoints - formationPoints;
            const isInvalid = formation.valid === false || formationPoints === 0;
            
            return (
              <div key={formationName || index} 
                className={`flex items-center justify-between p-4 rounded-lg ${
                  isInvalid
                    ? 'bg-gray-900 border border-gray-600 opacity-60'
                    : isCurrent
                      ? 'bg-blue-900 border border-blue-700'
                      : isBest
                        ? 'bg-green-900 border border-green-700'
                        : 'bg-gray-700'
                }`}>
                
                {/* Left: Formation Name */}
                <div className="flex items-center gap-3 flex-1">
                  <span className={`text-2xl font-bold ${
                    isInvalid
                      ? 'text-gray-500'
                      : isCurrent 
                        ? 'text-blue-100' 
                        : isBest
                          ? 'text-green-100'
                          : 'text-white'
                  }`}>
                    {formationName}
                  </span>
                  
                  {isCurrent && !isInvalid && (
                    <span className="px-2 py-1 text-xs font-medium rounded bg-blue-600 text-white">
                      CURRENT
                    </span>
                  )}
                  
                  {isInvalid && (
                    <span className="px-2 py-1 text-xs font-medium rounded bg-red-600 text-white">
                      INVALID
                    </span>
                  )}
                </div>
                
                {/* Middle: Points */}
                <div className="flex-1 text-center">
                  <span className={`text-xl font-bold ${
                    isInvalid
                      ? 'text-gray-500'
                      : isCurrent 
                        ? 'text-blue-100' 
                        : isBest
                          ? 'text-green-100'
                          : 'text-white'
                  }`}>
                    {isInvalid ? 'N/A' : `${formationPoints.toFixed(1)} pts`}
                  </span>
                </div>
                
                {/* Right: Status */}
                <div className="flex-1 text-right">
                  {isInvalid ? (
                    <span className="text-sm text-gray-500">
                      Not enough players
                    </span>
                  ) : isBest ? (
                    <span className="px-3 py-1.5 text-sm font-medium rounded bg-green-600 text-white">
                      BEST
                    </span>
                  ) : (
                    <span className="text-lg font-medium text-red-400">
                      -{pointsDiff.toFixed(1)} pts
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ----------------- MAIN OPTIMIZER TAB CONTENT - ENHANCED -----------------
export const OptimizerTabContent = ({ players, currentGameweek, scoringMode = 'ffh', onPlayerClick }) => {
  // Don't render if gameweek data isn't loaded for v3 scoring
  if (scoringMode === 'v3' && !currentGameweek?.number) {
    return (
      <div className={`p-8 text-center text-gray-300`}>
        <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
        <p>Loading gameweek data for v3 scoring...</p>
      </div>
    );
  }

  const { 
    loading, 
    error, 
    stats, 
    current, 
    optimal, 
    recommendations, 
    formations,
    roster,
    refetch 
  } = useOptimizerData(USER_ID, scoringMode, currentGameweek);

  // Calculate optimal player IDs for comparison - for FormationVisualization checkmarks
  const optimalPlayerIdsForDisplay = optimal?.players?.map(p => {
    const id = p.id || p.player_id || p.sleeper_id;
    return id;
  }) || [];
  
  // Recalculate points based on current scoring mode - use explicit field logic
  const currentPoints = current?.players ? current.players.reduce((sum, player) => {
    let points = 0;
    if (scoringMode === 'v3') {
      points = player.v3_current_gw || 0;
    } else {
      points = player.current_gw_prediction || 0;
    }
    return sum + points;
  }, 0) : (stats.currentPoints || 0);

  const optimalPoints = optimal?.players ? optimal.players.reduce((sum, player) => {
    let points = 0;
    if (scoringMode === 'v3') {
      points = player.v3_current_gw || 0;
    } else {
      points = player.current_gw_prediction || 0;
    }
    return sum + points;
  }, 0) : (stats.optimalPoints || 0);

  // Recalculate all stats based on new point values
  const improvement = optimalPoints - currentPoints;
  const efficiency = currentPoints > 0 ? (optimalPoints / currentPoints) * 100 : 0;
  
  // Calculate how many players need to be swapped
  const currentPlayerIds = new Set(current?.players?.map(p => p.sleeper_id || p.id || p.player_id) || []);
  const optimalPlayerIds = new Set(optimal?.players?.map(p => p.sleeper_id || p.id || p.player_id) || []);
  const playersToSwap = current?.players ? current.players.filter(p => {
    const playerId = p.sleeper_id || p.id || p.player_id;
    return !optimalPlayerIds.has(playerId);
  }).length : 0;
  
  // Check if formation change is needed
  const formationChange = current?.formation !== optimal?.formation;

  // Create updated stats object
  const recalculatedStats = {
    currentPoints,
    optimalPoints,
    improvement,
    efficiency,
    playersToSwap,
    formationChange
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mr-3"></div>
        <span className="text-white">
          Analyzing your lineup...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`rounded-lg border p-6 text-center ${
        'bg-gray-800 border-gray-700'
      }`}>
        <div className="text-red-500 text-4xl mb-2">❌</div>
        <h3 className={`text-lg font-medium mb-2 text-white`}>
          Optimization Failed
        </h3>
        <p className={`mb-4 text-gray-400`}>
          {error}
        </p>
        <button
          onClick={() => refetch(true)}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Gameweek Header - Prominent Display */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg shadow-lg p-6 text-center border border-blue-500">
        <div className="flex items-center justify-center gap-3">
          <span className="text-4xl">⚽</span>
          <div>
            <h2 className="text-3xl font-bold text-white">
              Gameweek {currentGameweek?.number || 'N/A'}
            </h2>
            <p className="text-blue-100 text-sm mt-1">
              Start/Sit Recommendations
            </p>
          </div>
        </div>
      </div>

      {/* Lineup Comparison - Main Focus */}
      {(() => {
        // Filter to only my roster players, then compute bench as roster minus starters
        const myRoster = players?.filter(p => p.owned_by === USER_ID) || [];
        const currentStarterIds = new Set(current?.players?.map(p => p.id || p.player_id || p.sleeper_id) || []);
        const optimalStarterIds = new Set(optimal?.players?.map(p => p.id || p.player_id || p.sleeper_id) || []);
        const currentBench = myRoster.filter(p => {
          const pid = p.id || p.player_id || p.sleeper_id;
          return !currentStarterIds.has(pid);
        });
        const optimalBench = myRoster.filter(p => {
          const pid = p.id || p.player_id || p.sleeper_id;
          return !optimalStarterIds.has(pid);
        });

        return (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Current Lineup */}
            <div className="space-y-4">
              <div className="text-center">
                <h3 className={`text-lg font-medium text-white`}>
                  Current Lineup
                </h3>
                <div className="flex items-center justify-center gap-2 mt-1">
                  <span className="px-2 py-1 text-xs font-medium rounded bg-blue-600 text-white">
                    ACTIVE
                  </span>
                  <span className={`text-sm text-gray-400`}>
                    {current?.formation || 'N/A'} • {currentPoints.toFixed(1)} points
                  </span>
                </div>
              </div>

              <FormationVisualization
                lineup={current}
                optimalPlayerIds={optimalPlayerIdsForDisplay}
                scoringMode={scoringMode}
                optimalLineup={optimal}
                onPlayerClick={onPlayerClick}
                currentGameweek={currentGameweek?.number}
                benchPlayers={currentBench}
              />
            </div>

            {/* Optimal Lineup */}
            <div className="space-y-4">
              <div className="text-center">
                <h3 className={`text-lg font-medium text-white`}>
                  Optimal Lineup
                </h3>
                <div className="flex items-center justify-center gap-2 mt-1">
                  <span className="px-2 py-1 text-xs font-medium rounded bg-green-600 text-white">
                    RECOMMENDED
                  </span>
                  <span className={`text-sm text-gray-400`}>
                    {optimal?.formation || 'N/A'} • {optimalPoints.toFixed(1)} points
                  </span>
                </div>
              </div>
              <FormationVisualization
                lineup={optimal}
                isOptimal={true}
                optimalPlayerIds={optimalPlayerIdsForDisplay}
                scoringMode={scoringMode}
                currentLineup={current}
                onPlayerClick={onPlayerClick}
                currentGameweek={currentGameweek?.number}
                benchPlayers={optimalBench}
              />
            </div>
          </div>
        );
      })()}

      {/* Actionable Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ActionableRecommendations
          recommendations={recommendations}
          current={current}
          optimal={optimal}
          recalculatedStats={recalculatedStats}
          scoringMode={scoringMode}
          currentGameweek={currentGameweek?.number}
        />
        <FormationComparison
          allFormations={formations}
          currentFormation={current?.formation}
          scoringMode={scoringMode}
        />
      </div>

      {/* My Players Table */}
      <div className={`p-6 rounded-lg border ${'bg-gray-800 border-gray-700'}`}>
        <MyPlayersTable
          players={players || []}
          currentGameweek={currentGameweek}
          optimalPlayerIds={optimalPlayerIdsForDisplay}
          scoringMode={scoringMode}
          hideColumns={['ppg']}
          onPlayerClick={onPlayerClick}
        />
      </div>

      {/* Refresh Button */}
      <div className="text-center">
        <button
          onClick={() => refetch(true)}
          className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 mx-auto"
        >
          🔄 Refresh Analysis
        </button>
      </div>
    </div>
  );
};

OptimizerTabContent.propTypes = {
  players: PropTypes.arrayOf(PropTypes.object).isRequired,
  currentGameweek: PropTypes.shape({
    number: PropTypes.number.isRequired
  }).isRequired,
  scoringMode: PropTypes.oneOf(['ffh', 'v3']),
  onPlayerClick: PropTypes.func
};

OptimizerTabContent.defaultProps = {
  scoringMode: 'ffh'
};