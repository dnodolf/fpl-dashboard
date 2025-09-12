// app/components/OptimizerTabContent.js - COMPLETE UPDATED FILE
// Enhanced Optimizer Tab Component with Sleeper position colors

import { useState, useEffect } from 'react';
import MyPlayersTable from './MyPlayersTable.js';
import v3ScoringService from '../services/v3ScoringService.js';

// ----------------- SLEEPER POSITION COLORS FUNCTIONS -----------------
// Get Sleeper position badge classes for player cards
const getSleeperPositionCardStyle = (position, isDarkMode = false) => {
  const baseClasses = 'inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium border';
  
  switch (position) {
    case 'GKP':
    case 'GK':
    case 'G':
      return `${baseClasses} ${isDarkMode 
        ? 'bg-yellow-500 text-black border-yellow-400' 
        : 'bg-yellow-600 text-white border-yellow-500'}`;
    case 'DEF':
    case 'D':
      return `${baseClasses} ${isDarkMode 
        ? 'bg-cyan-500 text-black border-cyan-400' 
        : 'bg-cyan-600 text-white border-cyan-500'}`;
    case 'MID':
    case 'M':
      return `${baseClasses} ${isDarkMode 
        ? 'bg-pink-500 text-white border-pink-400' 
        : 'bg-pink-600 text-white border-pink-500'}`;
    case 'FWD':
    case 'F':
      return `${baseClasses} ${isDarkMode 
        ? 'bg-purple-500 text-white border-purple-400' 
        : 'bg-purple-600 text-white border-purple-500'}`;
    default:
      return `${baseClasses} ${isDarkMode 
        ? 'bg-gray-500 text-white border-gray-400' 
        : 'bg-gray-600 text-white border-gray-500'}`;
  }
};

// ----------------- OPTIMIZER HOOK -----------------
function useOptimizerData(userId = 'ThatDerekGuy', scoringMode = 'existing', currentGameweek = 2) {
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

      const response = await fetch('/api/optimizer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          forceRefresh,
          analysisType: 'current_roster',
          scoringMode,
          currentGameweek
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
const FormationVisualization = ({ lineup, isDarkMode, isOptimal = false, optimalPlayerIds = [], scoringMode = 'existing' }) => {
  if (!lineup || !lineup.players || lineup.players.length === 0) {
    return (
      <div className={`p-8 text-center border-2 border-dashed rounded-lg ${
        isDarkMode ? 'bg-gray-800 border-gray-600 text-gray-400' : 'bg-gray-50 border-gray-300 text-gray-500'
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
    
    // Handle common formation patterns
    switch(formation) {
      case '3-5-2': return { def: 3, mid: 5, fwd: 2 };
      case '4-5-1': return { def: 4, mid: 5, fwd: 1 };
      case '4-4-2': return { def: 4, mid: 4, fwd: 2 };
      case '4-3-3': return { def: 4, mid: 3, fwd: 3 };
      case '3-4-3': return { def: 3, mid: 4, fwd: 3 };
      case '5-4-1': return { def: 5, mid: 4, fwd: 1 };
      case '5-3-2': return { def: 5, mid: 3, fwd: 2 };
      default: return { def: 4, mid: 4, fwd: 2 }; // fallback
    }
  };

  // Player Card Component - UPDATED WITH SLEEPER COLORS AND PREDICTED MINUTES
  const PlayerCard = ({ player, isInOptimal = false, scoringMode = 'existing' }) => {
    // Extract last name only for better readability
    const getLastName = (player) => {
      if (player.web_name) return player.web_name;
      if (player.name) {
        const nameParts = player.name.split(' ');
        return nameParts[nameParts.length - 1];
      }
      return 'Unknown';
    };

    // FIXED: Check if this player is in the optimal lineup
    // We need to check if this specific player ID is in the optimalPlayerIds array
    const playerId = player.id || player.player_id || player.sleeper_id;
    const isPlayerOptimal = optimalPlayerIds.includes(playerId);

    // Extract predicted minutes
    const getPredictedMinutes = (player) => {
      // Try current gameweek prediction first
      if (player.current_gameweek_prediction?.predicted_mins) {
        return Math.round(player.current_gameweek_prediction.predicted_mins);
      }
      
      // Try predictions array for current GW
      if (player.predictions && Array.isArray(player.predictions)) {
        const firstPred = player.predictions[0];
        if (firstPred?.xmins) {
          return Math.round(firstPred.xmins);
        }
      }
      
      // Try other fields
      if (player.predicted_mins) return Math.round(player.predicted_mins);
      if (player.xmins) return Math.round(player.xmins);
      
      return null;
    };

    const predictedMinutes = getPredictedMinutes(player);

    return (
      <div className={`relative flex flex-col items-center p-2 m-1 rounded-lg border text-xs ${
        isDarkMode 
          ? 'bg-gray-700 border-gray-600 text-white' 
          : 'bg-white border-gray-300 text-gray-900'
      }`} style={{ minWidth: '72px', maxWidth: '88px' }}>
        
        {/* FIXED: Checkmark logic - Only show on optimal lineup side */}
        {isOptimal && (
          <div className={`absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-xs ${
            isPlayerOptimal 
              ? 'bg-green-500 text-white' 
              : 'bg-red-500 text-white'
          }`}>
            {isPlayerOptimal ? '✓' : '✗'}
          </div>
        )}
        
        <div className="font-medium text-center leading-tight truncate w-full" title={player.full_name || player.name}>
          {getLastName(player)}
        </div>
        
        {/* Position badge with Sleeper colors */}
        <div className="mt-1">
          <span className={getSleeperPositionCardStyle(player.position, isDarkMode)}>
            {player.position || 'N/A'}
          </span>
        </div>
        
        <div className="opacity-75 text-xs mt-1">{player.team_abbr || player.team}</div>
        
        {/* Predicted Points */}
        <div className="font-semibold mt-1">
          {(() => {
            // Use explicit field-based logic to match FormationVisualization
            let points = 0;
            if (scoringMode === 'v3') {
              points = player.v3_current_gw || 0;
            } else {
              points = player.current_gw_prediction || 0;
            }
            return points.toFixed(1);
          })()}
        </div>
        
        {/* Predicted Minutes */}
        {predictedMinutes && (
          <div className={`text-xs mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            {predictedMinutes}min
          </div>
        )}
      </div>
    );
  };

  const currentFormation = lineup.formation || 'Unknown';
  // Recalculate total points based on current scoring mode - be very specific about which field to use
  const totalPoints = lineup.players ? lineup.players.reduce((sum, player) => {
    let points = 0;
    if (scoringMode === 'v3') {
      points = player.v3_current_gw || 0;
    } else {
      points = player.current_gw_prediction || 0;
    }
    return sum + points;
  }, 0) : (lineup.points || lineup.totalPoints || 0);
  const layout = getFormationLayout(currentFormation);
  
  return (
    <div className={`relative border-2 rounded-lg overflow-hidden ${
      isDarkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-300'
      } ${isOptimal ? 'ring-2 ring-green-500' : ''}`} style={{ height: '480px' }}>
      
      {/* Field Background */}
      <div className="absolute inset-2 bg-gradient-to-b from-green-600 to-green-700 rounded-lg opacity-20"></div>
      
      {/* Formation and Points Header */}
      <div className="absolute top-3 left-4 right-4 flex justify-between items-center z-20">
        <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
          {currentFormation}
        </span>
        <span className={`text-sm font-semibold ${
          isOptimal 
            ? (isDarkMode ? 'text-green-400' : 'text-green-600')
            : (isDarkMode ? 'text-blue-400' : 'text-blue-600')
        }`}>
          {totalPoints.toFixed(1)} pts
        </span>
      </div>
      
      {/* Formation Layout - PROPER FORMATION STRUCTURE */}
      <div className="relative z-10 h-full flex flex-col justify-between py-8 px-4">
        
        {/* Forwards - Show exactly layout.fwd players */}
        {layout.fwd > 0 && (
          <div className="flex justify-center gap-2 flex-wrap">
            {playersByPosition.FWD.slice(0, layout.fwd).map((player, idx) => (
              <PlayerCard key={`fwd-${player.id || idx}`} player={player} isInOptimal={isOptimal} scoringMode={scoringMode} />
            ))}
            {/* Fill missing FWD slots if needed */}
            {Array.from({ length: Math.max(0, layout.fwd - playersByPosition.FWD.length) }).map((_, idx) => (
              <div key={`empty-fwd-${idx}`} className={`flex flex-col items-center p-2 m-1 rounded-lg border-2 border-dashed text-xs ${
                isDarkMode ? 'border-gray-600 text-gray-500' : 'border-gray-300 text-gray-400'
              }`} style={{ minWidth: '72px', maxWidth: '88px' }}>
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
              <PlayerCard key={`mid-${player.id || idx}`} player={player} isInOptimal={isOptimal} scoringMode={scoringMode} />
            ))}
            {/* Fill missing MID slots if needed */}
            {Array.from({ length: Math.max(0, layout.mid - playersByPosition.MID.length) }).map((_, idx) => (
              <div key={`empty-mid-${idx}`} className={`flex flex-col items-center p-2 m-1 rounded-lg border-2 border-dashed text-xs ${
                isDarkMode ? 'border-gray-600 text-gray-500' : 'border-gray-300 text-gray-400'
              }`} style={{ minWidth: '72px', maxWidth: '88px' }}>
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
              <PlayerCard key={`def-${player.id || idx}`} player={player} isInOptimal={isOptimal} scoringMode={scoringMode} />
            ))}
            {/* Fill missing DEF slots if needed */}
            {Array.from({ length: Math.max(0, layout.def - playersByPosition.DEF.length) }).map((_, idx) => (
              <div key={`empty-def-${idx}`} className={`flex flex-col items-center p-2 m-1 rounded-lg border-2 border-dashed text-xs ${
                isDarkMode ? 'border-gray-600 text-gray-500' : 'border-gray-300 text-gray-400'
              }`} style={{ minWidth: '72px', maxWidth: '88px' }}>
                <div>Empty</div>
                <div className="text-xs opacity-50">DEF</div>
              </div>
            ))}
          </div>
        )}
        
        {/* Goalkeeper - Always show 1 */}
        <div className="flex justify-center">
          {playersByPosition.GKP.slice(0, 1).map((player, idx) => (
            <PlayerCard key={`gkp-${player.id || idx}`} player={player} isInOptimal={isOptimal} scoringMode={scoringMode} />
          ))}
          {/* Show empty GKP slot if needed */}
          {playersByPosition.GKP.length === 0 && (
            <div className={`flex flex-col items-center p-2 m-1 rounded-lg border-2 border-dashed text-xs ${
              isDarkMode ? 'border-gray-600 text-gray-500' : 'border-gray-300 text-gray-400'
            }`} style={{ minWidth: '72px', maxWidth: '88px' }}>
              <div>Empty</div>
              <div className="text-xs opacity-50">GKP</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ----------------- ACTIONABLE RECOMMENDATIONS COMPONENT -----------------
const ActionableRecommendations = ({ recommendations, current, optimal, isDarkMode, recalculatedStats, scoringMode = 'existing' }) => {
  if (!recommendations || recommendations.length === 0) {
    return (
      <div className={`rounded-lg border p-6 text-center ${
        isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      }`}>
        <div className="text-green-600 text-4xl mb-2">✅</div>
        <h3 className={`text-lg font-medium mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
          Perfect Lineup!
        </h3>
        <p className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
          Your current lineup is already optimized.
        </p>
      </div>
    );
  }

  // Generate clear, actionable recommendations
  const getActionableChanges = () => {
    const changes = [];
    
    // Formation change recommendation using recalculated stats
    if (recalculatedStats?.formationChange) {
      changes.push({
        type: 'formation',
        action: `Switch from ${current?.formation} to ${optimal?.formation}`,
        reason: `Gain ${recalculatedStats.improvement.toFixed(1)} points`,
        priority: 'high'
      });
    }
    
    // Add specific player swap recommendations
    if (current?.players && optimal?.players) {
      const currentPlayerIdsForSwaps = new Set(current.players.map(p => p.sleeper_id || p.id || p.player_id));
      const optimalPlayers = optimal.players.filter(p => {
        const playerId = p.sleeper_id || p.id || p.player_id;
        return !currentPlayerIdsForSwaps.has(playerId);
      });
      
      // Show top 3 player swaps
      optimalPlayers.slice(0, 3).forEach(newPlayer => {
        let newPlayerPoints = 0;
        if (scoringMode === 'v3') {
          newPlayerPoints = newPlayer.v3_current_gw || 0;
        } else {
          newPlayerPoints = newPlayer.current_gw_prediction || 0;
        }
        
        // Find the player they would replace (same position)
        const currentSamePosition = current.players.filter(p => p.position === newPlayer.position);
        const worstCurrentPlayer = currentSamePosition.reduce((worst, player) => {
          let playerPoints = 0;
          if (scoringMode === 'v3') {
            playerPoints = player.v3_current_gw || 0;
          } else {
            playerPoints = player.current_gw_prediction || 0;
          }
          
          let worstPoints = 999;
          if (worst) {
            if (scoringMode === 'v3') {
              worstPoints = worst.v3_current_gw || 0;
            } else {
              worstPoints = worst.current_gw_prediction || 0;
            }
          }
          
          return playerPoints < worstPoints ? player : worst;
        }, null);
        
        if (worstCurrentPlayer) {
          let worstPoints = 0;
          if (scoringMode === 'v3') {
            worstPoints = worstCurrentPlayer.v3_current_gw || 0;
          } else {
            worstPoints = worstCurrentPlayer.current_gw_prediction || 0;
          }
          
          const improvement = newPlayerPoints - worstPoints;
          if (improvement > 0.5) { // Only show if meaningful improvement
            changes.push({
              type: 'player',
              action: `Replace ${worstCurrentPlayer.name || worstCurrentPlayer.web_name} with ${newPlayer.name || newPlayer.web_name}`,
              reason: `+${improvement.toFixed(1)} points`,
              priority: improvement > 2 ? 'high' : 'medium'
            });
          }
        }
      });
    }
    
    // Add specific player swaps from recommendations
    recommendations.slice(0, 3).forEach(rec => {
      if (rec.action && rec.improvement) {
        changes.push({
          type: 'player',
          action: rec.action,
          reason: `+${rec.improvement.toFixed(1)} points`,
          priority: rec.improvement > 1 ? 'high' : 'medium'
        });
      }
    });
    
    return changes;
  };

  const actionableChanges = getActionableChanges();

  return (
    <div className={`rounded-lg border ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
      <div className="p-4 border-b border-gray-200">
        <h3 className={`text-lg font-medium flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
          🎯 Quick Actions
        </h3>
        <p className={`text-sm mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
          Make these changes to optimize your lineup
        </p>
      </div>
      <div className="p-4 space-y-3">
        {actionableChanges.map((change, index) => (
          <div key={index} className={`p-3 rounded-lg border-l-4 ${
            change.priority === 'high' 
              ? `bg-red-50 border-red-400 ${isDarkMode ? 'bg-red-900/20 border-red-600' : ''}`
              : `bg-blue-50 border-blue-400 ${isDarkMode ? 'bg-blue-900/20 border-blue-600' : ''}`
          }`}>
            <div className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              {change.action}
            </div>
            <div className={`text-xs mt-1 ${
              change.priority === 'high'
                ? (isDarkMode ? 'text-red-400' : 'text-red-600')
                : (isDarkMode ? 'text-blue-400' : 'text-blue-600')
            }`}>
              {change.reason}
            </div>
          </div>
        ))}
        
        {actionableChanges.length === 0 && (
          <div className="text-center py-4">
            <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              No specific recommendations available
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

// ----------------- FORMATION COMPARISON COMPONENT - FIXED LAYOUT -----------------
const FormationComparison = ({ allFormations, currentFormation, isDarkMode, scoringMode = 'existing' }) => {
  if (!allFormations || allFormations.length === 0) {
    return (
      <div className={`rounded-lg border p-6 text-center ${
        isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      }`}>
        <div className="text-4xl mb-2">📊</div>
        <h3 className={`text-lg font-medium mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
          Formation Analysis
        </h3>
        <p className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
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
    <div className={`rounded-lg border ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
      <div className="p-4 border-b border-gray-200">
        <h3 className={`text-lg font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
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
                    ? (isDarkMode ? 'bg-gray-900 border border-gray-600 opacity-60' : 'bg-gray-100 border border-gray-300 opacity-60')
                    : isCurrent 
                      ? (isDarkMode ? 'bg-blue-900 border border-blue-700' : 'bg-blue-50 border border-blue-200')
                      : isBest
                        ? (isDarkMode ? 'bg-green-900 border border-green-700' : 'bg-green-50 border border-green-200')
                        : (isDarkMode ? 'bg-gray-700' : 'bg-gray-50')
                }`}>
                
                {/* Left: Formation Name */}
                <div className="flex items-center gap-3 flex-1">
                  <span className={`text-2xl font-bold ${
                    isInvalid
                      ? (isDarkMode ? 'text-gray-500' : 'text-gray-400')
                      : isCurrent 
                        ? (isDarkMode ? 'text-blue-100' : 'text-blue-800') 
                        : isBest
                          ? (isDarkMode ? 'text-green-100' : 'text-green-800')
                          : (isDarkMode ? 'text-white' : 'text-gray-900')
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
                      ? (isDarkMode ? 'text-gray-500' : 'text-gray-400')
                      : isCurrent 
                        ? (isDarkMode ? 'text-blue-100' : 'text-blue-800') 
                        : isBest
                          ? (isDarkMode ? 'text-green-100' : 'text-green-800')
                          : (isDarkMode ? 'text-white' : 'text-gray-900')
                  }`}>
                    {isInvalid ? 'N/A' : `${formationPoints.toFixed(1)} pts`}
                  </span>
                </div>
                
                {/* Right: Status */}
                <div className="flex-1 text-right">
                  {isInvalid ? (
                    <span className={`text-sm ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                      Not enough players
                    </span>
                  ) : isBest ? (
                    <span className="px-3 py-1.5 text-sm font-medium rounded bg-green-600 text-white">
                      BEST
                    </span>
                  ) : (
                    <span className={`text-lg font-medium ${isDarkMode ? 'text-red-400' : 'text-red-600'}`}>
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
export const OptimizerTabContent = ({ isDarkMode, players, currentGameweek, scoringMode = 'existing' }) => {
  const { 
    loading, 
    error, 
    stats, 
    current, 
    optimal, 
    recommendations, 
    allFormations,
    roster,
    refetch 
  } = useOptimizerData('ThatDerekGuy', scoringMode, currentGameweek?.number || 2);

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
        <span className={isDarkMode ? 'text-white' : 'text-gray-900'}>
          Analyzing your lineup...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`rounded-lg border p-6 text-center ${
        isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      }`}>
        <div className="text-red-500 text-4xl mb-2">❌</div>
        <h3 className={`text-lg font-medium mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
          Optimization Failed
        </h3>
        <p className={`mb-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
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

  // DEBUG: Log formation data
  console.log('Current formation from API:', current?.formation);
  console.log('Optimal formation from API:', optimal?.formation);
  console.log('All formations:', allFormations);

  return (
    <div className="space-y-6">
      
      {/* Lineup Comparison - Main Focus */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Current Lineup */}
        <div className="space-y-4">
          <div className="text-center">
            <h3 className={`text-lg font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Current Lineup
            </h3>
            <div className="flex items-center justify-center gap-2 mt-1">
              <span className="px-2 py-1 text-xs font-medium rounded bg-blue-600 text-white">
                ACTIVE
              </span>
              <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                {current?.formation || 'N/A'} • {currentPoints.toFixed(1)} points
              </span>
            </div>
          </div>
          
          <FormationVisualization 
            lineup={current} 
            isDarkMode={isDarkMode} 
            optimalPlayerIds={optimalPlayerIdsForDisplay}
            scoringMode={scoringMode}
          />
        </div>

        {/* Optimal Lineup */}
        <div className="space-y-4">
          <div className="text-center">
            <h3 className={`text-lg font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Optimal Lineup
            </h3>
            <div className="flex items-center justify-center gap-2 mt-1">
              <span className="px-2 py-1 text-xs font-medium rounded bg-green-600 text-white">
                RECOMMENDED
              </span>
              <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                {optimal?.formation || 'N/A'} • {optimalPoints.toFixed(1)} points
              </span>
            </div>
          </div>
          <FormationVisualization 
            lineup={optimal} 
            isDarkMode={isDarkMode} 
            isOptimal={true}
            optimalPlayerIds={optimalPlayerIdsForDisplay}
            scoringMode={scoringMode}
          />
        </div>
      </div>

      {/* Actionable Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ActionableRecommendations 
          recommendations={recommendations} 
          current={current}
          optimal={optimal}
          isDarkMode={isDarkMode}
          recalculatedStats={recalculatedStats}
          scoringMode={scoringMode}
        />
        <FormationComparison 
          allFormations={allFormations} 
          currentFormation={current?.formation} 
          isDarkMode={isDarkMode}
          scoringMode={scoringMode}
        />
      </div>

      {/* My Players Table */}
      <div className={`p-6 rounded-lg border ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <MyPlayersTable 
          players={players || []} 
          isDarkMode={isDarkMode}
          currentGameweek={currentGameweek}
          optimalPlayerIds={optimalPlayerIdsForDisplay}
          scoringMode={scoringMode}
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