// app/components/OptimizerTabContent.js - COMPLETE UPDATED FILE
// Enhanced Optimizer Tab Component with all fixes

import { useState, useEffect } from 'react';
import MyPlayersTable from './MyPlayersTable.js';

// ----------------- OPTIMIZER HOOK -----------------
function useOptimizerData(userId = 'ThatDerekGuy') {
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
          analysisType: 'current_roster'
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
  }, [userId]);

  return { ...data, refetch: fetchOptimizerData };
}

// ----------------- FORMATION VISUALIZATION COMPONENT - PROPER LAYOUTS -----------------
const FormationVisualization = ({ lineup, isDarkMode, isOptimal = false, optimalPlayerIds = [] }) => {
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

  // Player Card Component - OPTIMIZED FOR READABILITY
  const PlayerCard = ({ player, isInOptimal = false }) => {
    // Extract last name only for better readability
    const getLastName = (player) => {
      if (player.web_name) return player.web_name;
      if (player.name) {
        const nameParts = player.name.split(' ');
        return nameParts[nameParts.length - 1];
      }
      return 'Unknown';
    };

    // Check if player is optimal (only for current lineup)
    const playerIsOptimal = !isOptimal && optimalPlayerIds.includes(player.id || player.player_id || player.sleeper_id);

    return (
      <div className={`relative flex flex-col items-center p-2 m-1 rounded-lg border text-xs ${
        isDarkMode 
          ? 'bg-gray-700 border-gray-600 text-white' 
          : 'bg-white border-gray-300 text-gray-900'
      }`} style={{ minWidth: '72px', maxWidth: '88px' }}>
        
        {/* Optimization Indicator - Only show on current lineup */}
        {!isOptimal && (
          <div className={`absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-xs ${
            playerIsOptimal 
              ? 'bg-green-500 text-white' 
              : 'bg-red-500 text-white'
          }`}>
            {playerIsOptimal ? '✓' : '✗'}
          </div>
        )}
        
        <div className="font-medium text-center leading-tight truncate w-full" title={player.full_name || player.name}>
          {getLastName(player)}
        </div>
        <div className="opacity-75 text-xs">{player.team_abbr || player.team}</div>
        <div className="font-semibold mt-1">
          {(() => {
            // Extract predicted points
            const points = player.current_gw_prediction || 
                          player.predicted_pts || 
                          player.points || 0;
            return typeof points === 'number' ? points.toFixed(1) : '0.0';
          })()}
        </div>
      </div>
    );
  };

  const currentFormation = lineup.formation || 'Unknown';
  const totalPoints = lineup.points || lineup.totalPoints || 0;
  const layout = getFormationLayout(currentFormation);
  
  return (
    <div className={`relative border-2 rounded-lg overflow-hidden ${
      isDarkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-300'
    } ${isOptimal ? 'ring-2 ring-green-500' : ''}`} style={{ height: '420px' }}>
      
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
      <div className="relative z-10 h-full flex flex-col justify-between py-12 px-4">
        
        {/* Forwards - Show exactly layout.fwd players */}
        {layout.fwd > 0 && (
          <div className="flex justify-center gap-2 flex-wrap">
            {playersByPosition.FWD.slice(0, layout.fwd).map((player, idx) => (
              <PlayerCard key={`fwd-${player.id || idx}`} player={player} isInOptimal={optimalPlayerIds.includes(player.id || player.player_id || player.sleeper_id)} />
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
              <PlayerCard key={`mid-${player.id || idx}`} player={player} isInOptimal={optimalPlayerIds.includes(player.id || player.player_id || player.sleeper_id)} />
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
              <PlayerCard key={`def-${player.id || idx}`} player={player} isInOptimal={optimalPlayerIds.includes(player.id || player.player_id || player.sleeper_id)} />
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
            <PlayerCard key={`gkp-${player.id || idx}`} player={player} isInOptimal={optimalPlayerIds.includes(player.id || player.player_id || player.sleeper_id)} />
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
const ActionableRecommendations = ({ recommendations, current, optimal, isDarkMode }) => {
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
    
    // Formation change recommendation
    if (current?.formation !== optimal?.formation) {
      changes.push({
        type: 'formation',
        action: `Switch from ${current?.formation} to ${optimal?.formation}`,
        reason: `Gain ${((optimal?.points || 0) - (current?.points || 0)).toFixed(1)} points`,
        priority: 'high'
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

// ----------------- FORMATION COMPARISON COMPONENT - ENHANCED -----------------
const FormationComparison = ({ allFormations, currentFormation, isDarkMode }) => {
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

  // Sort formations by points
  const sortedFormations = [...allFormations].sort((a, b) => b.points - a.points);
  const bestFormation = sortedFormations[0];
  const bestPoints = bestFormation?.points || 0;

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
            const isCurrent = formation.formation === currentFormation;
            const isBest = formation === bestFormation;
            const pointsDiff = bestPoints - formation.points;
            
            return (
              <div key={formation.formation} 
                className={`flex items-center justify-between p-3 rounded-lg ${
                  isCurrent 
                    ? (isDarkMode ? 'bg-blue-900 border border-blue-700' : 'bg-blue-50 border border-blue-200')
                    : isBest ?
                      (isDarkMode ? 'bg-green-900 border border-green-700' : 'bg-green-50 border border-green-200')
                      : (isDarkMode ? 'bg-gray-700' : 'bg-gray-50')
                }`}>
                
                {/* Left: Formation Name */}
                <div className="flex items-center gap-2">
                  <span className={`text-lg font-bold ${
                    isCurrent ? 
                      (isDarkMode ? 'text-blue-100' : 'text-blue-800') :
                      isBest ?
                        (isDarkMode ? 'text-green-100' : 'text-green-800') :
                        (isDarkMode ? 'text-white' : 'text-gray-900')
                  }`}>
                    {formation.formation}
                  </span>
                  
                  {isCurrent && (
                    <span className="px-2 py-1 text-xs font-medium rounded bg-blue-600 text-white">
                      CURRENT
                    </span>
                  )}
                </div>
                
                {/* Middle: Points */}
                <div className={`text-lg font-bold ${
                  isCurrent ? 
                    (isDarkMode ? 'text-blue-100' : 'text-blue-800') :
                    isBest ?
                      (isDarkMode ? 'text-green-100' : 'text-green-800') :
                      (isDarkMode ? 'text-white' : 'text-gray-900')
                }`}>
                  {formation.points.toFixed(1)} pts
                </div>
                
                {/* Right: Status */}
                <div className="text-right">
                  {isBest ? (
                    <span className="px-2 py-1 text-xs font-medium rounded bg-green-600 text-white">
                      BEST
                    </span>
                  ) : (
                    <div className={`text-sm ${isDarkMode ? 'text-red-400' : 'text-red-600'}`}>
                      -{pointsDiff.toFixed(1)} pts
                    </div>
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
export const OptimizerTabContent = ({ isDarkMode, players, currentGameweek }) => {
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
  } = useOptimizerData();

  // Calculate optimal player IDs for comparison - FIXED
  const optimalPlayerIds = optimal?.players?.map(p => {
    const id = p.id || p.player_id || p.sleeper_id;
    console.log('Optimal player ID:', id, 'for player:', p.name || p.web_name);
    return id;
  }) || [];
  
  const currentPlayerIds = current?.players?.map(p => {
    const id = p.id || p.player_id || p.sleeper_id;
    console.log('Current player ID:', id, 'for player:', p.name || p.web_name);
    return id;
  }) || [];
  
  console.log('All optimal IDs:', optimalPlayerIds);
  console.log('All current IDs:', currentPlayerIds);

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
                {current?.formation || 'N/A'} • {stats.currentPoints.toFixed(1)} points
              </span>
            </div>
          </div>
          <FormationVisualization 
            lineup={current} 
            isDarkMode={isDarkMode} 
            optimalPlayerIds={optimalPlayerIds}
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
                {optimal?.formation || 'N/A'} • {stats.optimalPoints.toFixed(1)} points
              </span>
            </div>
          </div>
          <FormationVisualization 
            lineup={optimal} 
            isDarkMode={isDarkMode} 
            isOptimal={true}
            optimalPlayerIds={optimalPlayerIds}
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
        />
        <FormationComparison 
          allFormations={allFormations} 
          currentFormation={current?.formation} 
          isDarkMode={isDarkMode} 
        />
      </div>

      {/* My Players Table */}
      <div className={`p-6 rounded-lg border ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <MyPlayersTable 
          players={players || []} 
          isDarkMode={isDarkMode}
          currentGameweek={currentGameweek}
          optimalPlayerIds={optimalPlayerIds}
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