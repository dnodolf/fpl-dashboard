/**
 * OptimizerStatsCard Component
 * Displays optimization statistics comparing current vs optimal roster
 */

'use client';

import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { USER_ID } from '../../config/constants';
import { getNextNGameweeksTotal } from '../../utils/predictionUtils';

export function OptimizerStatsCard({ scoringMode = 'ffh', currentGameweek = { number: 15 } }) {
  const [rawData, setRawData] = useState(null); // Store raw API data
  const [stats, setStats] = useState({
    currentPoints: 0,
    optimalPoints: 0,
    optimalPlayerPercentage: 0,
    playersToSwap: 0,
    optimalPlayersInCurrent: 0,
    totalPlayers: 11
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOptimizerStats = async () => {
      try {
        const response = await fetch('/api/optimizer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: USER_ID,
            forceRefresh: false,
            scoringMode: scoringMode,
            currentGameweek: currentGameweek.number || 4
          })
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            // Store raw data for recalculation
            setRawData(data);
          }
        }
      } catch (error) {
        console.error('Failed to fetch optimizer stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchOptimizerStats();
  }, [scoringMode, currentGameweek.number]); // Refetch when scoring mode or gameweek changes

  // Recalculate stats when scoring mode or raw data changes
  useEffect(() => {
    if (!rawData) return;

    // Quiet recalculation - only log final results

    const { current, optimal } = rawData;

    // Calculate points using predictions array for consistency
    const gw = currentGameweek?.number || 1;
    const currentPoints = current?.players ? current.players.reduce((sum, player) => {
      return sum + getNextNGameweeksTotal(player, scoringMode, gw, 1);
    }, 0) : 0;

    const optimalPoints = optimal?.players ? optimal.players.reduce((sum, player) => {
      return sum + getNextNGameweeksTotal(player, scoringMode, gw, 1);
    }, 0) : 0;

    // Calculate optimal player stats
    const optimalPlayerIds = optimal?.players?.map(p => p.id || p.player_id || p.sleeper_id) || [];
    const currentPlayerIds = current?.players?.map(p => p.id || p.player_id || p.sleeper_id) || [];

    const optimalPlayersInCurrent = currentPlayerIds.filter(id => optimalPlayerIds.includes(id)).length;
    const totalPlayers = currentPlayerIds.length || 11;
    const optimalPlayerPercentage = totalPlayers > 0 ? (optimalPlayersInCurrent / totalPlayers) * 100 : 0;

    setStats({
      currentPoints,
      optimalPoints,
      optimalPlayerPercentage,
      playersToSwap: totalPlayers - optimalPlayersInCurrent,
      optimalPlayersInCurrent,
      totalPlayers
    });
  }, [rawData, scoringMode]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className={`p-4 rounded-lg shadow-sm bg-gray-800`}>
            <div className="animate-pulse">
              <div className="h-8 bg-gray-300 rounded mb-2"></div>
              <div className="h-4 bg-gray-300 rounded"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      {/* Current Roster Points */}
      <div className={`p-4 rounded-lg shadow-sm bg-gray-800`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold text-blue-600">{stats.currentPoints.toFixed(1)}</div>
            <div className={`text-sm text-gray-400`}>Current Roster Points</div>
          </div>
          <div className="text-blue-500 text-2xl">⚽</div>
        </div>
      </div>

      {/* Optimized Roster Points */}
      <div className={`p-4 rounded-lg shadow-sm bg-gray-800`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold text-green-600">{stats.optimalPoints.toFixed(1)}</div>
            <div className={`text-sm text-gray-400`}>Optimized Roster Points</div>
          </div>
          <div className="text-green-500 text-2xl">🎯</div>
        </div>
      </div>

      {/* % Optimal Players */}
      <div className={`p-4 rounded-lg shadow-sm bg-gray-800`}>
        <div className="flex items-center justify-between">
          <div>
            <div className={`text-2xl font-bold ${
              stats.optimalPlayerPercentage >= 80
                ? 'text-green-600'
                : stats.optimalPlayerPercentage >= 60
                  ? 'text-yellow-600'
                  : 'text-red-600'
            }`}>
              {stats.optimalPlayerPercentage.toFixed(0)}%
            </div>
            <div className={`text-sm text-gray-400`}>
              % Optimal Players ({stats.optimalPlayersInCurrent}/{stats.totalPlayers})
            </div>
          </div>
          <div className="text-purple-500 text-2xl">📊</div>
        </div>
      </div>

      {/* Players to Swap */}
      <div className={`p-4 rounded-lg shadow-sm bg-gray-800`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold text-red-600">{stats.playersToSwap}</div>
            <div className={`text-sm text-gray-400`}>Players to Swap</div>
          </div>
          <div className="text-red-500 text-2xl">🔄</div>
        </div>
      </div>
    </div>
  );
}

OptimizerStatsCard.propTypes = {
  scoringMode: PropTypes.oneOf(['ffh', 'v3', 'v4']),
  currentGameweek: PropTypes.shape({
    number: PropTypes.number.isRequired
  })
};

OptimizerStatsCard.defaultProps = {
  scoringMode: 'ffh',
  currentGameweek: { number: 15 }
};
