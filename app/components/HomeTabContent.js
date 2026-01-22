// app/components/HomeTabContent.js
'use client';

import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { USER_ID } from '../config/constants';
import { getSleeperPositionStyle } from '../constants/positionColors';
import PlayerAvatar from './common/PlayerAvatar';

const HomeTabContent = ({ players, currentGameweek, scoringMode, onPlayerClick }) => {
  const [optimizerData, setOptimizerData] = useState(null);
  const [loadingOptimizer, setLoadingOptimizer] = useState(true);
  const [standings, setStandings] = useState([]);
  const [loadingStandings, setLoadingStandings] = useState(true);
  const [standingsExpanded, setStandingsExpanded] = useState(false);

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

  // Fetch league standings
  useEffect(() => {
    const fetchStandings = async () => {
      try {
        setLoadingStandings(true);
        const response = await fetch('/api/standings');
        if (response.ok) {
          const data = await response.json();
          setStandings(data.standings || []);
        }
      } catch (error) {
        console.error('Error fetching standings:', error);
      } finally {
        setLoadingStandings(false);
      }
    };
    fetchStandings();
  }, []);

  // Get my players
  const myPlayers = players.filter(p => p.owned_by === USER_ID);

  // Helper to get current GW points
  const getPlayerPoints = (player) => {
    return scoringMode === 'v3'
      ? (player.v3_current_gw || 0)
      : (player.current_gw_prediction || 0);
  };

  // Get top 3 players for this GW
  const top3ThisGW = [...myPlayers]
    .sort((a, b) => getPlayerPoints(b) - getPlayerPoints(a))
    .slice(0, 3);

  // Find user's league standing
  const userStanding = standings.find(s => s.displayName === USER_ID);
  const userRank = userStanding ? standings.indexOf(userStanding) + 1 : null;

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

        {/* Top 3 This Gameweek */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-400">Top 3 This GW</h3>
            <span className="text-2xl">⭐</span>
          </div>
          <div className="space-y-1.5">
            {top3ThisGW.map((player, idx) => (
              <div key={player.sleeper_id} className="flex items-center gap-2 text-sm">
                <span className="text-gray-500 w-4">{idx + 1}.</span>
                <span className={getSleeperPositionStyle(player.position)}>{player.position}</span>
                <button
                  onClick={() => onPlayerClick?.(player)}
                  className="text-white truncate flex-1 text-left hover:text-blue-400 transition-colors"
                >
                  {player.web_name || player.name}
                </button>
                <span className="text-green-400 font-bold">{getPlayerPoints(player).toFixed(1)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* League Standing */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-400">League Standing</h3>
            <span className="text-2xl">🏆</span>
          </div>
          {loadingStandings ? (
            <div className="animate-pulse">
              <div className="h-8 bg-gray-700 rounded w-16 mb-1"></div>
              <div className="h-4 bg-gray-700 rounded w-24"></div>
            </div>
          ) : userRank ? (
            <>
              <p className="text-2xl font-bold text-yellow-400">#{userRank}</p>
              <p className="text-xs text-gray-400 mt-1">
                {userStanding.wins}-{userStanding.losses}
                {userStanding.ties > 0 && `-${userStanding.ties}`} record
              </p>
              <button
                onClick={() => setStandingsExpanded(!standingsExpanded)}
                className="text-xs text-blue-400 hover:text-blue-300 mt-2 flex items-center gap-1"
              >
                {standingsExpanded ? '▼' : '▶'} View standings table
              </button>
            </>
          ) : (
            <p className="text-gray-500 text-sm">Unable to load</p>
          )}
        </div>
      </div>

      {/* Expanded Standings Table */}
      {standingsExpanded && standings.length > 0 && (
        <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-900">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase">#</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase">Team</th>
                <th className="px-4 py-2 text-center text-xs font-medium text-gray-400 uppercase">W-L-T</th>
                <th className="px-4 py-2 text-center text-xs font-medium text-gray-400 uppercase">PF</th>
                <th className="px-4 py-2 text-center text-xs font-medium text-gray-400 uppercase">PA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {standings.map((team, index) => {
                const isCurrentUser = team.displayName === USER_ID;
                return (
                  <tr
                    key={team.roster_id}
                    className={`${
                      isCurrentUser
                        ? 'bg-blue-900/30 border-l-4 border-blue-500'
                        : 'hover:bg-gray-700'
                    }`}
                  >
                    <td className="px-4 py-2 text-gray-300 font-medium">{index + 1}</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <span className={`font-medium ${isCurrentUser ? 'text-blue-400' : 'text-white'}`}>
                          {team.displayName}
                        </span>
                        {isCurrentUser && (
                          <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded">You</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-center text-gray-300">
                      {team.wins}-{team.losses}{team.ties > 0 && `-${team.ties}`}
                    </td>
                    <td className="px-4 py-2 text-center text-green-400 font-medium">
                      {team.pointsFor.toFixed(1)}
                    </td>
                    <td className="px-4 py-2 text-center text-red-400 font-medium">
                      {team.pointsAgainst.toFixed(1)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

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
                    <button
                      onClick={() => onPlayerClick?.(player)}
                      className="font-medium text-white hover:text-blue-400 transition-colors text-left"
                    >
                      {player.name}
                    </button>
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
            const positionPlayers = myPlayers
              .filter(p => p.position === position)
              .sort((a, b) => getPlayerPoints(b) - getPlayerPoints(a));
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
                          <button
                            onClick={() => onPlayerClick?.(player)}
                            className="text-white truncate font-medium hover:text-blue-400 transition-colors text-left block w-full"
                          >
                            {player.web_name || player.name}
                          </button>
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

HomeTabContent.propTypes = {
  players: PropTypes.array.isRequired,
  currentGameweek: PropTypes.object,
  scoringMode: PropTypes.string.isRequired,
  onPlayerClick: PropTypes.func
};

export default HomeTabContent;
