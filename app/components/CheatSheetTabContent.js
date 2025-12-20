/**
 * CheatSheetTabContent Component
 * Quick-reference rankings by position with ownership filtering
 */

'use client';

import { useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import { USER_ID } from '../config/constants';
import { TEAM_DISPLAY_NAMES } from '../constants/teams';

// Position order for display
const POSITIONS = ['GKP', 'DEF', 'MID', 'FWD'];

// Position colors (matching Sleeper theme)
const POSITION_COLORS = {
  GKP: 'bg-yellow-500 text-black',
  DEF: 'bg-cyan-500 text-black',
  MID: 'bg-pink-500 text-white',
  FWD: 'bg-purple-500 text-white'
};

// Get ownership status for a player
const getOwnershipStatus = (player, userId) => {
  const ownerName = player.owned_by || player.owner_name;
  if (ownerName === userId || ownerName === 'ThatDerekGuy') return 'mine';
  if (!ownerName || ownerName === 'FA' || ownerName === 'Free Agent') return 'fa';
  return 'other';
};

// Get injury indicator
const getInjuryIndicator = (chanceNextRound) => {
  if (chanceNextRound === null || chanceNextRound === undefined) return null;
  const chance = parseFloat(chanceNextRound);
  if (chance >= 75) return null; // Likely to play
  if (chance >= 50) return { label: 'D', color: 'text-yellow-500' }; // Doubtful
  if (chance >= 25) return { label: 'Q', color: 'text-orange-500' }; // Questionable
  return { label: 'O', color: 'text-red-500' }; // Out
};

// Player card component
const PlayerCard = ({ player, rank, ownership, onPlayerClick }) => {
  const injury = getInjuryIndicator(player.chance_next_round);

  // Background color based on ownership
  const bgColor = ownership === 'mine'
    ? 'bg-green-900/30 border-green-700'
    : ownership === 'fa'
    ? 'bg-blue-900/30 border-blue-700'
    : 'bg-gray-800/30 border-gray-700';

  return (
    <div className={`flex items-center gap-2 px-3 py-2 mb-1 rounded border ${bgColor} hover:opacity-80 transition-opacity`}>
      <span className="text-gray-400 text-sm font-medium min-w-[24px]">{rank}.</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onPlayerClick?.(player)}
            className="text-white text-sm font-medium truncate hover:text-blue-400 transition-colors text-left"
          >
            {player.web_name || player.name}
          </button>
          {injury && (
            <span className={`text-xs font-bold ${injury.color}`} title="Injury status">
              {injury.label}
            </span>
          )}
        </div>
        <span className="text-xs text-gray-400">
          {TEAM_DISPLAY_NAMES[player.team_abbr] || player.team_abbr || player.team || 'N/A'}
        </span>
      </div>
      <span className="text-white text-sm font-bold">
        {player.displayPoints?.toFixed(1) || '0.0'}
      </span>
    </div>
  );
};

PlayerCard.propTypes = {
  player: PropTypes.object.isRequired,
  rank: PropTypes.number.isRequired,
  ownership: PropTypes.oneOf(['mine', 'fa', 'other']).isRequired,
  onPlayerClick: PropTypes.func
};

// Position column component
const PositionColumn = ({ position, players, onPlayerClick }) => {
  const colorClasses = POSITION_COLORS[position] || 'bg-gray-500 text-white';

  return (
    <div className="flex-1 min-w-[250px]">
      <h3 className={`text-lg font-bold mb-3 px-3 py-2 rounded-lg ${colorClasses}`}>
        {position}
      </h3>
      <div className="space-y-1">
        {players.length === 0 ? (
          <div className="text-gray-500 text-sm italic py-4 text-center">
            No players available
          </div>
        ) : (
          players.map((player, index) => (
            <PlayerCard
              key={player.player_id || player.sleeper_id || index}
              player={player}
              rank={index + 1}
              ownership={player.ownershipStatus}
              onPlayerClick={onPlayerClick}
            />
          ))
        )}
      </div>
    </div>
  );
};

PositionColumn.propTypes = {
  position: PropTypes.string.isRequired,
  players: PropTypes.array.isRequired,
  onPlayerClick: PropTypes.func
};

export default function CheatSheetTabContent({
  players = [],
  scoringMode = 'ffh',
  currentGameweek = { number: 15 },
  onPlayerClick
}) {
  const [timeframe, setTimeframe] = useState('ros'); // 'next1', 'next5', 'ros', 'custom'
  const [customGames, setCustomGames] = useState(10);
  const [hideOthers, setHideOthers] = useState(true);

  // Process and filter players
  const rankedPlayers = useMemo(() => {
    if (!players || players.length === 0) return {};

    // Calculate display points based on timeframe
    const playersWithPoints = players.map(player => {
      let displayPoints = 0;

      if (timeframe === 'ros') {
        // Rest of season
        displayPoints = scoringMode === 'v3'
          ? (player.v3_season_total || 0)
          : (player.predicted_points || 0);
      } else {
        // Next N gameweeks (1, 5, or custom)
        const currentGW = currentGameweek?.number || 15;
        const predictions = player.predictions || [];

        // Determine how many games to look at
        let gamesToConsider = 5;
        if (timeframe === 'next1') {
          gamesToConsider = 1;
        } else if (timeframe === 'custom') {
          gamesToConsider = customGames;
        }

        const nextN = predictions
          .filter(p => p.gw >= currentGW && p.gw < currentGW + gamesToConsider)
          .slice(0, gamesToConsider);

        if (scoringMode === 'v3') {
          // Apply V3 conversion to each gameweek
          const v3Ratios = { GKP: 0.90, DEF: 1.15, MID: 1.05, FWD: 0.97 };
          const ratio = v3Ratios[player.position] || 1.0;
          displayPoints = nextN.reduce((sum, p) => sum + (p.predicted_pts || 0) * ratio, 0);
        } else {
          displayPoints = nextN.reduce((sum, p) => sum + (p.predicted_pts || 0), 0);
        }
      }

      const ownershipStatus = getOwnershipStatus(player, USER_ID);

      return {
        ...player,
        displayPoints,
        ownershipStatus
      };
    });

    // Group by position
    const grouped = {};
    POSITIONS.forEach(pos => {
      let positionPlayers = playersWithPoints.filter(p => p.position === pos);

      // Sort by display points (descending)
      positionPlayers.sort((a, b) => b.displayPoints - a.displayPoints);

      // Apply filtering if hideOthers is enabled
      if (hideOthers) {
        const myPlayers = positionPlayers.filter(p => p.ownershipStatus === 'mine');
        const faPlayers = positionPlayers.filter(p => p.ownershipStatus === 'fa').slice(0, 10);
        positionPlayers = [...myPlayers, ...faPlayers].sort((a, b) => b.displayPoints - a.displayPoints);
      } else {
        // Show top 50 per position when showing all
        positionPlayers = positionPlayers.slice(0, 50);
      }

      grouped[pos] = positionPlayers;
    });

    return grouped;
  }, [players, timeframe, customGames, hideOthers, scoringMode, currentGameweek]);

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-4">
          {/* Timeframe selector */}
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-400">Timeframe:</label>
            <select
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
              className="bg-gray-700 text-white px-3 py-1.5 rounded border border-gray-600 text-sm focus:outline-none focus:border-blue-500"
            >
              <option value="next1">Next Week</option>
              <option value="next5">Next 5 GWs</option>
              <option value="ros">Rest of Season</option>
              <option value="custom">Custom</option>
            </select>
          </div>

          {/* Custom games input - only show when Custom is selected */}
          {timeframe === 'custom' && (
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-400">Next</label>
              <input
                type="number"
                min="1"
                max="38"
                value={customGames}
                onChange={(e) => setCustomGames(Math.max(1, Math.min(38, parseInt(e.target.value) || 1)))}
                className="bg-gray-700 text-white px-3 py-1.5 rounded border border-gray-600 text-sm w-16 focus:outline-none focus:border-blue-500"
              />
              <label className="text-sm text-gray-400">games</label>
            </div>
          )}

          {/* Hide Others toggle */}
          <div className="flex items-center gap-2 sm:ml-auto">
            <label className="text-sm text-gray-400">Hide Others</label>
            <button
              onClick={() => setHideOthers(!hideOthers)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                hideOthers ? 'bg-blue-600' : 'bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  hideOthers ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Info text */}
        <div className="mt-3 text-xs text-gray-500">
          {hideOthers
            ? 'Showing your players + top 10 free agents per position'
            : 'Showing all players (top 50 per position)'}
        </div>
      </div>

      {/* Position columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {POSITIONS.map(position => (
          <PositionColumn
            key={position}
            position={position}
            players={rankedPlayers[position] || []}
            onPlayerClick={onPlayerClick}
          />
        ))}
      </div>
    </div>
  );
}

CheatSheetTabContent.propTypes = {
  players: PropTypes.array,
  scoringMode: PropTypes.oneOf(['ffh', 'v3']),
  currentGameweek: PropTypes.shape({
    number: PropTypes.number
  }),
  onPlayerClick: PropTypes.func
};
