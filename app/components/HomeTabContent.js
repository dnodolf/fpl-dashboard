// app/components/HomeTabContent.js
'use client';

import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import LeagueStandings from './LeagueStandings';
import { USER_ID } from '../config/constants';
import { getSleeperPositionStyle } from '../constants/positionColors';
import PlayerAvatar from './common/PlayerAvatar';
import { getNextNGameweeksTotal } from '../utils/predictionUtils';

const HomeTabContent = ({ players, currentGameweek, scoringMode }) => {
  const [optimizerData, setOptimizerData] = useState(null);
  const [loadingOptimizer, setLoadingOptimizer] = useState(true);

  // Fetch optimizer data to check if lineup is optimized
  useEffect(() => {
    const fetchOptimizerData = async () => {
      try {
        setLoadingOptimizer(true);
        const response = await fetch('/api/optimizer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: USER_ID,
            scoringMode,
            currentGameweek: currentGameweek?.number
          })
        });

        if (response.ok) {
          const data = await response.json();
          setOptimizerData(data);
        }
      } catch (error) {
        console.error('Error fetching optimizer data:', error);
      } finally {
        setLoadingOptimizer(false);
      }
    };

    if (currentGameweek?.number) {
      fetchOptimizerData();
    }
  }, [currentGameweek, scoringMode]);

  // Get my players
  const myPlayers = players.filter(p => p.owned_by === USER_ID);

  // Count players by availability status
  const availabilityStats = {
    healthy: myPlayers.filter(p => {
      const chance = p.chance_next_round ?? p.chance_of_playing_next_round ?? 100;
      return chance >= 75;
    }).length,
    doubtful: myPlayers.filter(p => {
      const chance = p.chance_next_round ?? p.chance_of_playing_next_round ?? 100;
      return chance >= 25 && chance < 75;
    }).length,
    out: myPlayers.filter(p => {
      const chance = p.chance_next_round ?? p.chance_of_playing_next_round ?? 100;
      return chance < 25;
    }).length
  };

  // Find upgrade opportunities
  const freeAgents = players.filter(p => !p.owned_by || p.owned_by === 'Free Agent');

  const upgradeOpportunities = {
    next5: 0,
    ros: 0
  };

  const currentGW = currentGameweek?.number || 1;

  myPlayers.forEach(myPlayer => {
    const myNext5 = getNextNGameweeksTotal(myPlayer, scoringMode, currentGW, 5);
    const myROS = getROSPoints(myPlayer, scoringMode);

    // Count how many FAs are better for next 5
    const betterNext5 = freeAgents.filter(fa => {
      if (fa.position !== myPlayer.position) return false;
      const faNext5 = getNextNGameweeksTotal(fa, scoringMode, currentGW, 5);
      return faNext5 > myNext5;
    }).length;

    // Count how many FAs are better ROS
    const betterROS = freeAgents.filter(fa => {
      if (fa.position !== myPlayer.position) return false;
      const faROS = getROSPoints(fa, scoringMode);
      return faROS > myROS;
    }).length;

    if (betterNext5 > 0) upgradeOpportunities.next5++;
    if (betterROS > 0) upgradeOpportunities.ros++;
  });

  // Get players with injury/news
  const playersWithNews = myPlayers.filter(p => p.news && p.news.length > 0);

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg shadow-lg p-6 text-center">
        <h1 className="text-3xl font-bold text-white mb-2">
          ⚽ Fantasy FC Playbook
        </h1>
        <p className="text-blue-100">
          Gameweek {currentGameweek?.number || '?'} • {scoringMode === 'v3' ? 'V3 Sleeper' : 'FFH'} Scoring
        </p>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Lineup Optimization Status */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-400">Lineup Status</h3>
            {loadingOptimizer ? (
              <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
            ) : optimizerData?.stats?.playersToSwap === 0 ? (
              <span className="text-2xl">✅</span>
            ) : (
              <span className="text-2xl">⚠️</span>
            )}
          </div>
          {loadingOptimizer ? (
            <p className="text-xs text-gray-500">Checking...</p>
          ) : optimizerData?.stats?.playersToSwap === 0 ? (
            <>
              <p className="text-2xl font-bold text-green-400">Optimized</p>
              <p className="text-xs text-gray-400 mt-1">Your lineup is optimal!</p>
            </>
          ) : (
            <>
              <p className="text-2xl font-bold text-yellow-400">
                {optimizerData?.stats?.playersToSwap || 0} Changes
              </p>
              <p className="text-xs text-gray-400 mt-1">
                +{optimizerData?.stats?.improvement?.toFixed(1) || 0} pts possible
              </p>
            </>
          )}
        </div>

        {/* Player Availability */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-400">Availability</h3>
            <span className="text-2xl">🏥</span>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-green-400">Healthy:</span>
              <span className="font-bold text-white">{availabilityStats.healthy}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-yellow-400">Doubtful:</span>
              <span className="font-bold text-white">{availabilityStats.doubtful}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-red-400">Out:</span>
              <span className="font-bold text-white">{availabilityStats.out}</span>
            </div>
          </div>
        </div>

        {/* Upgrade Opportunities - Next 5 */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-400">Upgrades (Next 5)</h3>
            <span className="text-2xl">📈</span>
          </div>
          <p className="text-2xl font-bold text-blue-400">{upgradeOpportunities.next5}</p>
          <p className="text-xs text-gray-400 mt-1">
            {upgradeOpportunities.next5 === 0
              ? 'No clear upgrades available'
              : `${upgradeOpportunities.next5} position${upgradeOpportunities.next5 !== 1 ? 's' : ''} could be upgraded`}
          </p>
        </div>

        {/* Upgrade Opportunities - ROS */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-400">Upgrades (ROS)</h3>
            <span className="text-2xl">🎯</span>
          </div>
          <p className="text-2xl font-bold text-purple-400">{upgradeOpportunities.ros}</p>
          <p className="text-xs text-gray-400 mt-1">
            {upgradeOpportunities.ros === 0
              ? 'Strong roster for ROS'
              : `${upgradeOpportunities.ros} position${upgradeOpportunities.ros !== 1 ? 's' : ''} could be upgraded`}
          </p>
        </div>
      </div>

      {/* League Standings */}
      <LeagueStandings currentUserId={USER_ID} />

      {/* My Current Roster */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <span>👥</span>
          <span>My Roster ({myPlayers.length} players)</span>
        </h2>

        {/* Players with News/Injuries */}
        {playersWithNews.length > 0 && (
          <div className="mb-6 bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-4">
            <h3 className="text-sm font-bold text-yellow-400 mb-3 flex items-center gap-2">
              <span>📰</span>
              <span>Player News ({playersWithNews.length})</span>
            </h3>
            <div className="space-y-2">
              {playersWithNews.map(player => (
                <div key={player.sleeper_id} className="flex items-start gap-3 text-sm">
                  <PlayerAvatar player={player} size="md" />
                  <span className={getSleeperPositionStyle(player.position)}>
                    {player.position}
                  </span>
                  <div className="flex-1">
                    <p className="font-medium text-white">{player.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{player.news}</p>
                  </div>
                  <span className="text-xs text-yellow-400">
                    {player.chance_next_round ?? player.chance_of_playing_next_round ?? 100}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Roster by Position */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {['GKP', 'DEF', 'MID', 'FWD'].map(position => {
            const positionPlayers = myPlayers.filter(p => p.position === position);
            return (
              <div key={position} className="bg-gray-900/50 rounded-lg p-4">
                <h3 className="font-bold text-white mb-3 flex items-center gap-2">
                  <span className={getSleeperPositionStyle(position)}>{position}</span>
                  <span className="text-gray-400 text-sm">({positionPlayers.length})</span>
                </h3>
                <div className="space-y-2">
                  {positionPlayers.map(player => {
                    const chance = player.chance_next_round ?? player.chance_of_playing_next_round ?? 100;
                    const points = scoringMode === 'v3'
                      ? (player.v3_current_gw || 0)
                      : (player.current_gw_prediction || 0);

                    return (
                      <div key={player.sleeper_id} className="flex items-center gap-2 text-sm">
                        <PlayerAvatar player={player} size="sm" />
                        <div className="flex-1 min-w-0">
                          <p className="text-white truncate font-medium">{player.web_name || player.name}</p>
                          <p className="text-xs text-gray-400">{player.team_abbr}</p>
                        </div>
                        <div className="flex items-center gap-2 ml-2">
                          {chance < 75 && (
                            <span className={`text-xs ${
                              chance < 25 ? 'text-red-400' :
                              chance < 50 ? 'text-orange-400' :
                              'text-yellow-400'
                            }`}>
                              {chance}%
                            </span>
                          )}
                          <span className="text-white font-bold">{points.toFixed(1)}</span>
                        </div>
                      </div>
                    );
                  })}
                  {positionPlayers.length === 0 && (
                    <p className="text-gray-500 text-xs italic">No players</p>
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

// Helper function for ROS points
const getROSPoints = (player, scoringMode) => {
  if (scoringMode === 'v3') {
    return player.v3_season_total || 0;
  }
  return player.predicted_points || 0;
};

HomeTabContent.propTypes = {
  players: PropTypes.array.isRequired,
  currentGameweek: PropTypes.object,
  scoringMode: PropTypes.string.isRequired
};

export default HomeTabContent;
