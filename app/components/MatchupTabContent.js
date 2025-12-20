// app/components/MatchupTabContent.js
'use client';

import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';

// Sleeper position colors - matching the rest of the app
const getSleeperPositionStyle = (position) => {
  const baseClasses = 'inline-flex items-center px-2 py-0.5 rounded text-xs font-bold border';

  switch (position) {
    case 'GKP':
    case 'GK':
    case 'G':
      return `${baseClasses} bg-yellow-500 text-black border-yellow-400`;
    case 'DEF':
    case 'D':
      return `${baseClasses} bg-cyan-500 text-black border-cyan-400`;
    case 'MID':
    case 'M':
      return `${baseClasses} bg-pink-500 text-white border-pink-400`;
    case 'FWD':
    case 'F':
      return `${baseClasses} bg-purple-500 text-white border-purple-400`;
    default:
      return `${baseClasses} bg-gray-500 text-white border-gray-400`;
  }
};

// Player row component for the matchup view
const PlayerMatchupRow = ({ userPlayer, opponentPlayer, scoringMode }) => {
  const getUserPoints = (player) => {
    if (!player) return 0;
    return scoringMode === 'v3'
      ? (player.v3_current_gw || 0)
      : (player.current_gw_prediction || 0);
  };

  const userPoints = getUserPoints(userPlayer);
  const opponentPoints = getUserPoints(opponentPlayer);
  const userWinning = userPoints > opponentPoints;
  const opponentWinning = opponentPoints > userPoints;

  // Get position for display (should match between both players in same row)
  const position = userPlayer?.position || opponentPlayer?.position || '';

  return (
    <div className={`grid grid-cols-[1fr,auto,1fr] gap-4 p-3 rounded-lg ${
      userWinning ? 'bg-green-900/20 border border-green-700/30' :
      opponentWinning ? 'bg-red-900/20 border border-red-700/30' :
      'bg-gray-800 border border-gray-700'
    }`}>
      {/* User Player (Left) */}
      <div className="flex items-center justify-end gap-3">
        {userPlayer && (
          <>
            <div className="text-right flex-1">
              <div className="flex items-center justify-end gap-2">
                <span className="text-white font-medium">
                  {userPlayer.name || userPlayer.web_name}
                </span>
                {userPlayer.injury_status && (
                  <span className="text-red-400 text-xs">🤕</span>
                )}
              </div>
              <div className="text-xs text-gray-400 mt-0.5">
                {userPlayer.team_abbr} • vs {userPlayer.opponent || '?'}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className={getSleeperPositionStyle(userPlayer.position)}>
                {userPlayer.position}
              </span>
              <span className={`text-lg font-bold ${
                userWinning ? 'text-green-400' : 'text-white'
              }`}>
                {userPoints.toFixed(1)}
              </span>
            </div>
          </>
        )}
      </div>

      {/* VS Divider */}
      <div className="flex items-center justify-center">
        <div className="bg-gray-700 text-gray-300 px-3 py-1 rounded-full text-xs font-medium">
          VS
        </div>
      </div>

      {/* Opponent Player (Right) */}
      <div className="flex items-center gap-3">
        {opponentPlayer && (
          <>
            <div className="flex flex-col items-start gap-1">
              <span className={getSleeperPositionStyle(opponentPlayer.position)}>
                {opponentPlayer.position}
              </span>
              <span className={`text-lg font-bold ${
                opponentWinning ? 'text-green-400' : 'text-white'
              }`}>
                {opponentPoints.toFixed(1)}
              </span>
            </div>
            <div className="text-left flex-1">
              <div className="flex items-center gap-2">
                <span className="text-white font-medium">
                  {opponentPlayer.name || opponentPlayer.web_name}
                </span>
                {opponentPlayer.injury_status && (
                  <span className="text-red-400 text-xs">🤕</span>
                )}
              </div>
              <div className="text-xs text-gray-400 mt-0.5">
                {opponentPlayer.team_abbr} • vs {opponentPlayer.opponent || '?'}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

PlayerMatchupRow.propTypes = {
  userPlayer: PropTypes.object,
  opponentPlayer: PropTypes.object,
  scoringMode: PropTypes.string.isRequired
};

// Main Matchup Tab Component
const MatchupTabContent = ({ currentGameweek, scoringMode = 'ffh' }) => {
  const [matchupData, setMatchupData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchMatchup = async () => {
      if (!currentGameweek?.number) {
        setError('Gameweek data not available');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const response = await fetch('/api/matchup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: 'ThatDerekGuy', // Using the hardcoded user ID from constants
            week: currentGameweek.number,
            scoringMode
          })
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          // Handle 404 (no matchup data) differently from other errors
          if (response.status === 404) {
            throw new Error(data.message || 'No matchup data available for this week');
          }
          throw new Error(data.error || `Failed to fetch matchup: ${response.status}`);
        }

        setMatchupData(data);
      } catch (err) {
        console.error('❌ Error fetching matchup:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchMatchup();
  }, [currentGameweek, scoringMode]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mr-3"></div>
        <span className="text-white">Loading matchup data...</span>
      </div>
    );
  }

  if (error) {
    // Check if it's a "no data" error vs a real error
    const isNoDataError = error.includes('not available') || error.includes('not have started');

    return (
      <div className="rounded-lg border p-6 text-center bg-gray-800 border-gray-700">
        <div className={`${isNoDataError ? 'text-yellow-500' : 'text-red-500'} text-4xl mb-2`}>
          {isNoDataError ? '📅' : '❌'}
        </div>
        <h3 className="text-lg font-medium mb-2 text-white">
          {isNoDataError ? 'No Matchup Data Available' : 'Failed to Load Matchup'}
        </h3>
        <p className="mb-4 text-gray-400">{error}</p>
        {isNoDataError && (
          <p className="text-sm text-gray-500">
            Matchup data will be available once the Premier League season begins and matchups are scheduled in your Sleeper league.
          </p>
        )}
      </div>
    );
  }

  if (!matchupData) {
    return (
      <div className="rounded-lg border p-6 text-center bg-gray-800 border-gray-700">
        <div className="text-gray-400 text-4xl mb-2">🏆</div>
        <h3 className="text-lg font-medium mb-2 text-white">No Matchup Data</h3>
        <p className="text-gray-400">Unable to load matchup information</p>
      </div>
    );
  }

  const { user, opponent, winProbability } = matchupData;

  // Group players by position
  const groupByPosition = (players) => {
    const grouped = { GKP: [], DEF: [], MID: [], FWD: [] };
    players.forEach(player => {
      const pos = player.position;
      if (grouped[pos]) {
        grouped[pos].push(player);
      }
    });
    return grouped;
  };

  const userByPosition = groupByPosition(user.starters);
  const opponentByPosition = groupByPosition(opponent.starters);

  // Create position matchups (pair up players by position)
  const createPositionMatchups = () => {
    const matchups = [];
    const positions = ['GKP', 'DEF', 'MID', 'FWD'];

    positions.forEach(position => {
      const userPlayers = userByPosition[position] || [];
      const opponentPlayers = opponentByPosition[position] || [];
      const maxLength = Math.max(userPlayers.length, opponentPlayers.length);

      for (let i = 0; i < maxLength; i++) {
        matchups.push({
          position,
          userPlayer: userPlayers[i],
          opponentPlayer: opponentPlayers[i]
        });
      }
    });

    return matchups;
  };

  const positionMatchups = createPositionMatchups();

  return (
    <div className="space-y-6">
      {/* Gameweek Header */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg shadow-lg p-6 text-center border border-purple-500">
        <div className="flex items-center justify-center gap-3">
          <span className="text-4xl">🏆</span>
          <div>
            <h2 className="text-3xl font-bold text-white">
              Week {currentGameweek?.number || 'N/A'}
            </h2>
            <p className="text-purple-100 text-sm mt-1">Matchup</p>
          </div>
        </div>
      </div>

      {/* Team Headers with Projected Scores */}
      <div className="grid grid-cols-[1fr,auto,1fr] gap-4">
        {/* User Team */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 text-right">
          <div className="flex items-center justify-end gap-3 mb-2">
            <div>
              <h3 className="text-xl font-bold text-white">
                {user.displayName}
              </h3>
              <p className="text-sm text-gray-400">
                {user.record.wins}-{user.record.losses}
                {user.record.ties > 0 && `-${user.record.ties}`}
              </p>
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-bold text-blue-400">
              {user.projectedPoints.toFixed(2)}
            </div>
            <div className="text-xs text-gray-400 uppercase tracking-wide">
              Projected
            </div>
          </div>
        </div>

        {/* VS Badge */}
        <div className="flex items-center justify-center">
          <div className="bg-gradient-to-br from-gray-700 to-gray-800 text-white px-6 py-3 rounded-lg text-xl font-bold border border-gray-600 shadow-lg">
            VS
          </div>
        </div>

        {/* Opponent Team */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 text-left">
          <div className="flex items-center gap-3 mb-2">
            <div>
              <h3 className="text-xl font-bold text-white">
                {opponent.displayName}
              </h3>
              <p className="text-sm text-gray-400">
                {opponent.record.wins}-{opponent.record.losses}
                {opponent.record.ties > 0 && `-${opponent.record.ties}`}
              </p>
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-bold text-blue-400">
              {opponent.projectedPoints.toFixed(2)}
            </div>
            <div className="text-xs text-gray-400 uppercase tracking-wide">
              Projected
            </div>
          </div>
        </div>
      </div>

      {/* Win Probability Bar */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-white">
            {winProbability.user.toFixed(1)}%
          </span>
          <span className="text-xs text-gray-400">Win Probability</span>
          <span className="text-sm font-medium text-white">
            {winProbability.opponent.toFixed(1)}%
          </span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden flex">
          <div
            className="bg-gradient-to-r from-green-500 to-green-600 h-full transition-all duration-500"
            style={{ width: `${winProbability.user}%` }}
          />
          <div
            className="bg-gradient-to-r from-red-600 to-red-500 h-full transition-all duration-500"
            style={{ width: `${winProbability.opponent}%` }}
          />
        </div>
      </div>

      {/* Starters Section */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
          <span>⚽</span>
          <span>Starters</span>
        </h3>

        <div className="space-y-2">
          {positionMatchups.map((matchup, index) => (
            <PlayerMatchupRow
              key={`${matchup.position}-${index}`}
              userPlayer={matchup.userPlayer}
              opponentPlayer={matchup.opponentPlayer}
              scoringMode={scoringMode}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

MatchupTabContent.propTypes = {
  currentGameweek: PropTypes.object,
  scoringMode: PropTypes.string
};

export default MatchupTabContent;
