// Enhanced Optimizer Tab Component for page.js
// This replaces the placeholder optimizer tab content

import { useState, useEffect } from 'react';

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

// ----------------- FORMATION VISUALIZATION COMPONENT -----------------
const FormationVisualization = ({ lineup, isDarkMode, isOptimal = false }) => {
  if (!lineup || !lineup.players || lineup.players.length === 0) {
    return (
      <div className={`p-8 text-center border-2 border-dashed rounded-lg ${
        isDarkMode ? 'border-gray-600 text-gray-400' : 'border-gray-300 text-gray-500'
      }`}>
        <div className="text-4xl mb-2">⚽</div>
        <div>No lineup data available</div>
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
    const pos = player.position || 'MID';
    if (playersByPosition[pos]) {
      playersByPosition[pos].push(player);
    }
  });

  // Position colors matching Sleeper style
  const getPositionStyle = (position) => {
    switch (position) {
      case 'GKP':
        return 'bg-yellow-500 text-black border-yellow-600';
      case 'DEF':
        return 'bg-cyan-500 text-black border-cyan-600';
      case 'MID':
        return 'bg-green-500 text-black border-green-600';
      case 'FWD':
        return 'bg-red-500 text-white border-red-600';
      default:
        return 'bg-gray-500 text-white border-gray-600';
    }
  };

  const PlayerCard = ({ player }) => (
    <div className={`${getPositionStyle(player.position)} border-2 rounded-lg p-2 min-w-[80px] text-center shadow-sm`}>
      <div className="font-bold text-xs mb-1 truncate" title={player.name}>
        {player.name?.split(' ').pop() || 'Unknown'}
      </div>
      <div className="text-xs font-medium">
        {player.points?.toFixed(1) || '0.0'} pts
      </div>
      {player.minutes > 0 && (
        <div className="text-xs opacity-75">
          {Math.round(player.minutes)}min
        </div>
      )}
    </div>
  );

  return (
    <div className={`p-6 rounded-lg border-2 min-h-[400px] relative ${
      isDarkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-300'
    } ${isOptimal ? 'ring-2 ring-green-500' : ''}`}>
      
      {/* Field Background */}
      <div className="absolute inset-4 bg-gradient-to-b from-green-600 to-green-700 rounded-lg opacity-20"></div>
      
      {/* Formation Layout */}
      <div className="relative z-10 h-full flex flex-col justify-between py-4">
        
        {/* Forwards */}
        {playersByPosition.FWD.length > 0 && (
          <div className="flex justify-center gap-3">
            {playersByPosition.FWD.map((player, idx) => (
              <PlayerCard key={`fwd-${player.id}-${idx}`} player={player} />
            ))}
          </div>
        )}
        
        {/* Midfielders */}
        {playersByPosition.MID.length > 0 && (
          <div className="flex justify-center gap-3 flex-wrap">
            {playersByPosition.MID.map((player, idx) => (
              <PlayerCard key={`mid-${player.id}-${idx}`} player={player} />
            ))}
          </div>
        )}
        
        {/* Defenders */}
        {playersByPosition.DEF.length > 0 && (
          <div className="flex justify-center gap-3 flex-wrap">
            {playersByPosition.DEF.map((player, idx) => (
              <PlayerCard key={`def-${player.id}-${idx}`} player={player} />
            ))}
          </div>
        )}
        
        {/* Goalkeeper */}
        {playersByPosition.GKP.length > 0 && (
          <div className="flex justify-center">
            {playersByPosition.GKP.map((player, idx) => (
              <PlayerCard key={`gkp-${player.id}-${idx}`} player={player} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ----------------- RECOMMENDATIONS COMPONENT -----------------
const RecommendationsPanel = ({ recommendations, isDarkMode }) => {
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

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-100 border-red-200';
      case 'medium': return 'text-orange-600 bg-orange-100 border-orange-200';
      case 'low': return 'text-yellow-600 bg-yellow-100 border-yellow-200';
      case 'info': return 'text-blue-600 bg-blue-100 border-blue-200';
      default: return 'text-gray-600 bg-gray-100 border-gray-200';
    }
  };

  const getRecommendationIcon = (type) => {
    switch (type) {
      case 'formation_change': return '🔄';
      case 'player_swap': return '↔️';
      case 'general_optimization': return '📈';
      case 'optimal': return '✅';
      default: return '💡';
    }
  };

  return (
    <div className={`rounded-lg border p-6 ${
      isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
    }`}>
      <h3 className={`text-lg font-medium mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
        🔄 Recommended Changes
      </h3>
      
      <div className="space-y-3">
        {recommendations.map((rec, index) => (
          <div key={index} className={`p-4 rounded-lg border ${
            isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'
          }`}>
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3 flex-1">
                <span className="text-xl">{getRecommendationIcon(rec.type)}</span>
                <div className="flex-1">
                  <div className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {rec.message}
                  </div>
                  
                  {rec.type === 'player_swap' && rec.playerOut && rec.playerIn && (
                    <div className={`text-sm mt-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                      <div className="flex items-center gap-4">
                        <span className="text-red-600">
                          ❌ {rec.playerOut.name} ({rec.playerOut.position}) - {rec.playerOut.points?.toFixed(1)} pts
                        </span>
                        <span>→</span>
                        <span className="text-green-600">
                          ✅ {rec.playerIn.name} ({rec.playerIn.position}) - {rec.playerIn.points?.toFixed(1)} pts
                        </span>
                      </div>
                    </div>
                  )}
                  
                  {rec.type === 'formation_change' && (
                    <div className={`text-sm mt-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                      {rec.from} → {rec.to}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-2 ml-4">
                {typeof rec.impact === 'number' && rec.impact !== 0 && (
                  <span className={`px-2 py-1 rounded text-sm font-medium ${
                    rec.impact > 0 ? 'text-green-700 bg-green-100' : 'text-red-700 bg-red-100'
                  }`}>
                    {rec.impact > 0 ? '+' : ''}{rec.impact.toFixed(1)} pts
                  </span>
                )}
                <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getPriorityColor(rec.priority)}`}>
                  {rec.priority?.toUpperCase()}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {/* Summary */}
      <div className={`mt-4 p-3 rounded-lg ${
        isDarkMode ? 'bg-green-900 border border-green-700' : 'bg-green-50 border border-green-200'
      }`}>
        <div className={`text-center font-medium ${isDarkMode ? 'text-green-100' : 'text-green-800'}`}>
          Total Potential Improvement: +{recommendations
            .filter(r => typeof r.impact === 'number' && r.impact > 0)
            .reduce((sum, r) => sum + r.impact, 0)
            .toFixed(1)} points per gameweek
        </div>
      </div>
    </div>
  );
};

// ----------------- FORMATION COMPARISON COMPONENT -----------------
const FormationComparison = ({ allFormations, currentFormation, isDarkMode }) => {
  if (!allFormations || allFormations.length === 0) {
    return (
      <div className={`rounded-lg border p-6 text-center ${
        isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      }`}>
        <div className="text-gray-400 text-2xl mb-2">📊</div>
        <div className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
          No formation data available
        </div>
      </div>
    );
  }

  const sortedFormations = [...allFormations].sort((a, b) => b.points - a.points);
  const bestFormation = sortedFormations[0];

  return (
    <div className={`rounded-lg border p-6 ${
      isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
    }`}>
      <h3 className={`text-lg font-medium mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
        📊 Formation Analysis
      </h3>
      
      <div className="space-y-3">
        {sortedFormations.map((formation, index) => {
          const isCurrent = formation.name === currentFormation;
          const isOptimal = index === 0;
          const pointsDiff = formation.points - (bestFormation?.points || 0);
          
          return (
            <div key={formation.name} className={`p-3 rounded-lg border flex items-center justify-between ${
              isCurrent ? 
                (isDarkMode ? 'bg-blue-900 border-blue-700' : 'bg-blue-50 border-blue-200') :
                isOptimal ?
                  (isDarkMode ? 'bg-green-900 border-green-700' : 'bg-green-50 border-green-200') :
                  (isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200')
            }`}>
              <div className="flex items-center gap-3">
                <div className={`font-medium ${
                  isCurrent ? 
                    (isDarkMode ? 'text-blue-100' : 'text-blue-800') :
                    isOptimal ?
                      (isDarkMode ? 'text-green-100' : 'text-green-800') :
                      (isDarkMode ? 'text-white' : 'text-gray-900')
                }`}>
                  {formation.name}
                </div>
                
                <div className="flex gap-1">
                  {isCurrent && (
                    <span className="px-2 py-1 text-xs font-medium rounded bg-blue-600 text-white">
                      CURRENT
                    </span>
                  )}
                  {isOptimal && (
                    <span className="px-2 py-1 text-xs font-medium rounded bg-green-600 text-white">
                      OPTIMAL
                    </span>
                  )}
                </div>
              </div>
              
              <div className="text-right">
                <div className={`font-bold ${
                  isCurrent ? 
                    (isDarkMode ? 'text-blue-100' : 'text-blue-800') :
                    isOptimal ?
                      (isDarkMode ? 'text-green-100' : 'text-green-800') :
                      (isDarkMode ? 'text-white' : 'text-gray-900')
                }`}>
                  {formation.points.toFixed(1)} pts
                </div>
                {!isOptimal && pointsDiff !== 0 && (
                  <div className={`text-xs ${pointsDiff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {pointsDiff >= 0 ? '+' : ''}{pointsDiff.toFixed(1)}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ----------------- MAIN OPTIMIZER TAB CONTENT -----------------
export const OptimizerTabContent = ({ isDarkMode }) => {
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

  return (
    <div className="space-y-6">
      
      {/* Lineup Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
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
                {current?.formation || 'Unknown'} • {stats.currentPoints.toFixed(1)} points
              </span>
            </div>
          </div>
          <FormationVisualization lineup={current} isDarkMode={isDarkMode} />
        </div>

        {/* VS Section */}
        <div className="flex flex-col items-center justify-center p-6">
          <div className={`text-center ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
            <div className="mb-2">Recommended:</div>
            <div className="font-bold text-xl mb-2">
              {optimal?.formation === current?.formation ? 'Same Formation' : `Switch to ${optimal?.formation || 'N/A'}`}
            </div>
            <div className="text-3xl mb-2">→</div>
            <div className={`px-4 py-2 rounded-lg font-bold ${
              stats.improvement > 0 ? 'bg-green-600 text-white' : 
              stats.improvement < 0 ? 'bg-red-600 text-white' : 
              'bg-gray-600 text-white'
            }`}>
              {stats.improvement > 0 ? '+' : ''}{stats.improvement.toFixed(1)} points
            </div>
          </div>
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
          <FormationVisualization lineup={optimal} isDarkMode={isDarkMode} isOptimal={true} />
        </div>
      </div>

      {/* Recommendations and Formation Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RecommendationsPanel recommendations={recommendations} isDarkMode={isDarkMode} />
        <FormationComparison 
          allFormations={allFormations} 
          currentFormation={current?.formation} 
          isDarkMode={isDarkMode} 
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