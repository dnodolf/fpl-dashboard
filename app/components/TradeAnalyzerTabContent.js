// app/components/TradeAnalyzerTabContent.js
// Trade Analyzer component for evaluating player trades

'use client';

import { useState, useMemo } from 'react';

const TradeAnalyzerTabContent = ({ players, currentGameweek, scoringMode = 'ffh' }) => {
  const [selectedOpponent, setSelectedOpponent] = useState('');
  const [yourPlayers, setYourPlayers] = useState([]);
  const [theirPlayers, setTheirPlayers] = useState([]);
  const [step, setStep] = useState(1); // 1: Select Opponent, 2: Build Trade, 3: Analysis

  // Get unique owners (excluding you and free agents)
  const opponents = useMemo(() => {
    const owners = new Set();
    players.forEach(p => {
      if (p.owned_by && p.owned_by !== 'ThatDerekGuy' && p.owned_by !== 'Free Agent') {
        owners.add(p.owned_by);
      }
    });
    return Array.from(owners).sort();
  }, [players]);

  // Your roster
  const yourRoster = useMemo(() => {
    return players.filter(p => p.owned_by === 'ThatDerekGuy');
  }, [players]);

  // Opponent's roster
  const opponentRoster = useMemo(() => {
    if (!selectedOpponent) return [];
    return players.filter(p => p.owned_by === selectedOpponent);
  }, [players, selectedOpponent]);

  // Calculate trade analysis
  const tradeAnalysis = useMemo(() => {
    if (yourPlayers.length === 0 || theirPlayers.length === 0) return null;

    const getPoints = (player, field) => {
      if (scoringMode === 'v3') {
        if (field === 'ros') return player.v3_season_total || 0;
        if (field === 'next5') {
          // Sum next 5 gameweeks from predictions
          if (!player.predictions || !Array.isArray(player.predictions)) return 0;
          const currentGW = currentGameweek?.number || 9;
          return player.predictions
            .filter(p => p.gw >= currentGW && p.gw < currentGW + 5)
            .reduce((sum, p) => sum + ((p.predicted_pts || 0) * (player.v3_conversion_ratio || 1)), 0);
        }
        if (field === 'currentGW') return player.v3_current_gw || 0;
      } else {
        if (field === 'ros') return player.predicted_points || 0;
        if (field === 'next5') {
          if (!player.predictions || !Array.isArray(player.predictions)) return 0;
          const currentGW = currentGameweek?.number || 9;
          return player.predictions
            .filter(p => p.gw >= currentGW && p.gw < currentGW + 5)
            .reduce((sum, p) => sum + (p.predicted_pts || 0), 0);
        }
        if (field === 'currentGW') return player.current_gw_prediction || 0;
      }
      return 0;
    };

    // Calculate totals
    const yourROS = yourPlayers.reduce((sum, p) => sum + getPoints(p, 'ros'), 0);
    const theirROS = theirPlayers.reduce((sum, p) => sum + getPoints(p, 'ros'), 0);
    const yourNext5 = yourPlayers.reduce((sum, p) => sum + getPoints(p, 'next5'), 0);
    const theirNext5 = theirPlayers.reduce((sum, p) => sum + getPoints(p, 'next5'), 0);

    const netROS = theirROS - yourROS;
    const netNext5 = theirNext5 - yourNext5;

    // Position analysis
    const yourPositions = {};
    const theirPositions = {};
    yourPlayers.forEach(p => {
      yourPositions[p.position] = (yourPositions[p.position] || 0) + getPoints(p, 'ros');
    });
    theirPlayers.forEach(p => {
      theirPositions[p.position] = (theirPositions[p.position] || 0) + getPoints(p, 'ros');
    });

    const positionImpact = {};
    ['GKP', 'DEF', 'MID', 'FWD'].forEach(pos => {
      const giving = yourPositions[pos] || 0;
      const getting = theirPositions[pos] || 0;
      if (giving > 0 || getting > 0) {
        positionImpact[pos] = getting - giving;
      }
    });

    // Recommendation
    let recommendation = 'NEUTRAL';
    let recommendationText = '⚠️ CONSIDER';
    let recommendationColor = 'text-yellow-500';

    if (netROS >= 20) {
      recommendation = 'STRONG_ACCEPT';
      recommendationText = '✅ STRONG ACCEPT';
      recommendationColor = 'text-green-500';
    } else if (netROS >= 10) {
      recommendation = 'ACCEPT';
      recommendationText = '✅ ACCEPT';
      recommendationColor = 'text-green-400';
    } else if (netROS >= 5) {
      recommendation = 'SLIGHT_ACCEPT';
      recommendationText = '✔️ SLIGHT ACCEPT';
      recommendationColor = 'text-blue-400';
    } else if (netROS <= -20) {
      recommendation = 'STRONG_REJECT';
      recommendationText = '❌ STRONG REJECT';
      recommendationColor = 'text-red-500';
    } else if (netROS <= -10) {
      recommendation = 'REJECT';
      recommendationText = '❌ REJECT';
      recommendationColor = 'text-red-400';
    } else if (netROS <= -5) {
      recommendation = 'SLIGHT_REJECT';
      recommendationText = '✖️ SLIGHT REJECT';
      recommendationColor = 'text-orange-400';
    }

    return {
      yourROS,
      theirROS,
      netROS,
      yourNext5,
      theirNext5,
      netNext5,
      positionImpact,
      recommendation,
      recommendationText,
      recommendationColor
    };
  }, [yourPlayers, theirPlayers, scoringMode, currentGameweek]);

  // Add/Remove players
  const addYourPlayer = (player) => {
    if (!yourPlayers.find(p => p.id === player.id)) {
      setYourPlayers([...yourPlayers, player]);
    }
  };

  const removeYourPlayer = (playerId) => {
    setYourPlayers(yourPlayers.filter(p => p.id !== playerId));
  };

  const addTheirPlayer = (player) => {
    if (!theirPlayers.find(p => p.id === player.id)) {
      setTheirPlayers([...theirPlayers, player]);
    }
  };

  const removeTheirPlayer = (playerId) => {
    setTheirPlayers(theirPlayers.filter(p => p.id !== playerId));
  };

  const resetTrade = () => {
    setYourPlayers([]);
    setTheirPlayers([]);
    setStep(2);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Trade Analyzer</h2>
          <p className="text-sm text-gray-400 mt-1">
            Evaluate trades with league managers
          </p>
        </div>
        <div className="text-sm text-gray-400">
          Step {step} of 3
        </div>
      </div>

      {/* Step 1: Select Opponent */}
      {step === 1 && (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Step 1: Select Trade Partner</h3>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {opponents.map(opponent => (
              <button
                key={opponent}
                onClick={() => {
                  setSelectedOpponent(opponent);
                  setStep(2);
                }}
                className="p-4 bg-gray-700 hover:bg-gray-600 border border-gray-600 hover:border-blue-500 rounded-lg text-white font-medium transition-colors"
              >
                {opponent}
              </button>
            ))}
          </div>

          {opponents.length === 0 && (
            <p className="text-center text-gray-400 py-8">
              No other managers found in league
            </p>
          )}
        </div>
      )}

      {/* Step 2: Build Trade */}
      {step === 2 && selectedOpponent && (
        <div className="space-y-4">
          {/* Trade Partner Header */}
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 flex items-center justify-between">
            <div>
              <span className="text-sm text-gray-400">Trading with:</span>
              <h3 className="text-xl font-bold text-white">{selectedOpponent}</h3>
            </div>
            <button
              onClick={() => {
                setSelectedOpponent('');
                setYourPlayers([]);
                setTheirPlayers([]);
                setStep(1);
              }}
              className="text-sm text-gray-400 hover:text-white"
            >
              Change Partner
            </button>
          </div>

          {/* Trade Builder Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Your Players */}
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <h4 className="font-semibold text-white mb-3">You Give Up</h4>

              {/* Selected Players */}
              {yourPlayers.length > 0 && (
                <div className="mb-4 space-y-2">
                  {yourPlayers.map(player => (
                    <div key={player.id} className="flex items-center justify-between bg-red-900/20 border border-red-600/30 rounded p-2">
                      <div>
                        <div className="text-sm font-medium text-white">{player.full_name || player.name}</div>
                        <div className="text-xs text-gray-400">{player.position} • {player.team_abbr || player.team}</div>
                      </div>
                      <button
                        onClick={() => removeYourPlayer(player.id)}
                        className="text-red-400 hover:text-red-300 text-xl"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Available Players */}
              <div className="space-y-1 max-h-96 overflow-y-auto">
                {yourRoster
                  .filter(p => !yourPlayers.find(yp => yp.id === p.id))
                  .sort((a, b) => {
                    const aVal = scoringMode === 'v3' ? (a.v3_season_total || 0) : (a.predicted_points || 0);
                    const bVal = scoringMode === 'v3' ? (b.v3_season_total || 0) : (b.predicted_points || 0);
                    return bVal - aVal;
                  })
                  .map(player => (
                    <button
                      key={player.id}
                      onClick={() => addYourPlayer(player)}
                      className="w-full flex items-center justify-between p-2 bg-gray-700 hover:bg-gray-600 rounded text-left transition-colors"
                    >
                      <div>
                        <div className="text-sm font-medium text-white">{player.full_name || player.name}</div>
                        <div className="text-xs text-gray-400">{player.position} • {player.team_abbr || player.team}</div>
                      </div>
                      <div className="text-xs text-gray-400">
                        {scoringMode === 'v3' ? (player.v3_season_total || 0).toFixed(1) : (player.predicted_points || 0).toFixed(1)} pts
                      </div>
                    </button>
                  ))}
              </div>
            </div>

            {/* Their Players */}
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <h4 className="font-semibold text-white mb-3">You Receive</h4>

              {/* Selected Players */}
              {theirPlayers.length > 0 && (
                <div className="mb-4 space-y-2">
                  {theirPlayers.map(player => (
                    <div key={player.id} className="flex items-center justify-between bg-green-900/20 border border-green-600/30 rounded p-2">
                      <div>
                        <div className="text-sm font-medium text-white">{player.full_name || player.name}</div>
                        <div className="text-xs text-gray-400">{player.position} • {player.team_abbr || player.team}</div>
                      </div>
                      <button
                        onClick={() => removeTheirPlayer(player.id)}
                        className="text-green-400 hover:text-green-300 text-xl"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Available Players */}
              <div className="space-y-1 max-h-96 overflow-y-auto">
                {opponentRoster
                  .filter(p => !theirPlayers.find(tp => tp.id === p.id))
                  .sort((a, b) => {
                    const aVal = scoringMode === 'v3' ? (a.v3_season_total || 0) : (a.predicted_points || 0);
                    const bVal = scoringMode === 'v3' ? (b.v3_season_total || 0) : (b.predicted_points || 0);
                    return bVal - aVal;
                  })
                  .map(player => (
                    <button
                      key={player.id}
                      onClick={() => addTheirPlayer(player)}
                      className="w-full flex items-center justify-between p-2 bg-gray-700 hover:bg-gray-600 rounded text-left transition-colors"
                    >
                      <div>
                        <div className="text-sm font-medium text-white">{player.full_name || player.name}</div>
                        <div className="text-xs text-gray-400">{player.position} • {player.team_abbr || player.team}</div>
                      </div>
                      <div className="text-xs text-gray-400">
                        {scoringMode === 'v3' ? (player.v3_season_total || 0).toFixed(1) : (player.predicted_points || 0).toFixed(1)} pts
                      </div>
                    </button>
                  ))}
              </div>
            </div>
          </div>

          {/* Analyze Button */}
          <div className="flex justify-center gap-3">
            <button
              onClick={resetTrade}
              className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
            >
              Reset Trade
            </button>
            <button
              onClick={() => setStep(3)}
              disabled={yourPlayers.length === 0 || theirPlayers.length === 0}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Analyze Trade →
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Analysis */}
      {step === 3 && tradeAnalysis && (
        <div className="space-y-4">
          {/* Back Button */}
          <button
            onClick={() => setStep(2)}
            className="text-sm text-gray-400 hover:text-white"
          >
            ← Back to Trade Builder
          </button>

          {/* Recommendation Card */}
          <div className={`bg-gray-800 border-2 rounded-lg p-6 ${
            tradeAnalysis.recommendation.includes('ACCEPT') ? 'border-green-600' :
            tradeAnalysis.recommendation.includes('REJECT') ? 'border-red-600' :
            'border-yellow-600'
          }`}>
            <div className="text-center">
              <h3 className={`text-3xl font-bold mb-2 ${tradeAnalysis.recommendationColor}`}>
                {tradeAnalysis.recommendationText}
              </h3>
              <p className="text-xl text-white">
                Net Gain: <span className={tradeAnalysis.netROS >= 0 ? 'text-green-400' : 'text-red-400'}>
                  {tradeAnalysis.netROS >= 0 ? '+' : ''}{tradeAnalysis.netROS.toFixed(1)} pts ROS
                </span>
              </p>
            </div>
          </div>

          {/* Trade Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* You Give */}
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <h4 className="font-semibold text-red-400 mb-3 flex items-center gap-2">
                <span>🔴</span> You Give Up
              </h4>
              <div className="space-y-2 mb-4">
                {yourPlayers.map(player => (
                  <div key={player.id} className="text-sm text-white">
                    • {player.full_name || player.name} ({player.position})
                  </div>
                ))}
              </div>
              <div className="text-sm text-gray-400">
                Total ROS: {tradeAnalysis.yourROS.toFixed(1)} pts
              </div>
              <div className="text-sm text-gray-400">
                Next 5 GWs: {tradeAnalysis.yourNext5.toFixed(1)} pts
              </div>
            </div>

            {/* You Receive */}
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <h4 className="font-semibold text-green-400 mb-3 flex items-center gap-2">
                <span>🟢</span> You Receive
              </h4>
              <div className="space-y-2 mb-4">
                {theirPlayers.map(player => (
                  <div key={player.id} className="text-sm text-white">
                    • {player.full_name || player.name} ({player.position})
                  </div>
                ))}
              </div>
              <div className="text-sm text-gray-400">
                Total ROS: {tradeAnalysis.theirROS.toFixed(1)} pts
              </div>
              <div className="text-sm text-gray-400">
                Next 5 GWs: {tradeAnalysis.theirNext5.toFixed(1)} pts
              </div>
            </div>
          </div>

          {/* Detailed Analysis */}
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <h4 className="font-semibold text-white mb-4">Position Impact</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(tradeAnalysis.positionImpact).map(([pos, impact]) => (
                <div key={pos} className="text-center">
                  <div className="text-sm text-gray-400 mb-1">{pos}</div>
                  <div className={`text-lg font-bold ${
                    impact > 0 ? 'text-green-400' : impact < 0 ? 'text-red-400' : 'text-gray-400'
                  }`}>
                    {impact >= 0 ? '+' : ''}{impact.toFixed(1)}
                  </div>
                  <div className="text-xs text-gray-500">
                    {impact > 0 ? 'Upgrade' : impact < 0 ? 'Downgrade' : 'Even'}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Next 5 Gameweeks */}
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <h4 className="font-semibold text-white mb-4">Short-Term Outlook (Next 5 GWs)</h4>
            <div className="flex items-center justify-between">
              <div className="text-center">
                <div className="text-sm text-gray-400 mb-1">You Give</div>
                <div className="text-2xl font-bold text-red-400">{tradeAnalysis.yourNext5.toFixed(1)}</div>
              </div>
              <div className="text-3xl text-gray-600">→</div>
              <div className="text-center">
                <div className="text-sm text-gray-400 mb-1">Net Change</div>
                <div className={`text-2xl font-bold ${
                  tradeAnalysis.netNext5 >= 0 ? 'text-green-400' : 'text-red-400'
                }`}>
                  {tradeAnalysis.netNext5 >= 0 ? '+' : ''}{tradeAnalysis.netNext5.toFixed(1)}
                </div>
              </div>
              <div className="text-3xl text-gray-600">→</div>
              <div className="text-center">
                <div className="text-sm text-gray-400 mb-1">You Get</div>
                <div className="text-2xl font-bold text-green-400">{tradeAnalysis.theirNext5.toFixed(1)}</div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-center gap-3">
            <button
              onClick={resetTrade}
              className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
            >
              Analyze Another Trade
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TradeAnalyzerTabContent;
