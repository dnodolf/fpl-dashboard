/**
 * CheatSheetTabContent Component
 * Quick-reference rankings by position with ownership filtering
 */

'use client';

import { useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import { USER_ID, TOTAL_GAMEWEEKS } from '../config/constants';
import { TEAM_DISPLAY_NAMES } from '../constants/teams';
import { getPositionBadgeStyle } from '../constants/positionColors';
import PlayerAvatar from './common/PlayerAvatar';
import { getNextNGameweeksTotal, getAvgMinutesNextN } from '../utils/predictionUtils';

// Position order for display
const POSITIONS = ['GKP', 'DEF', 'MID', 'FWD'];

// Get ownership status for a player
const getOwnershipStatus = (player, userId) => {
  const ownerName = player.owned_by || player.owner_name;
  if (ownerName === userId || ownerName === USER_ID) return 'mine';
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
    <div className={`flex items-center gap-3 px-3 py-2 mb-1 rounded border ${bgColor} hover:opacity-80 transition-opacity`}>
      <span className="text-gray-400 text-sm font-medium min-w-[24px]">{rank}.</span>

      {/* Player Image */}
      <PlayerAvatar player={player} size="md" />

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
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span>{TEAM_DISPLAY_NAMES[player.team_abbr] || player.team_abbr || player.team || 'N/A'}</span>
          {player.avgMinutes > 0 && (
            <>
              <span>•</span>
              <span>{player.avgMinutes} min/gw</span>
            </>
          )}
        </div>
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
  const colorClasses = getPositionBadgeStyle(position);

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
  const currentGW = currentGameweek?.number || 1;
  const [startGW, setStartGW] = useState(currentGW);
  const [endGW, setEndGW] = useState(TOTAL_GAMEWEEKS);
  const [hideOthers, setHideOthers] = useState(true);
  const numGWs = endGW - startGW + 1;

  // Process and filter players
  const rankedPlayers = useMemo(() => {
    if (!players || players.length === 0) return {};
    const playersWithPoints = players.map(player => {
      const displayPoints = getNextNGameweeksTotal(player, scoringMode, startGW, numGWs);
      const avgMinutes = Math.round(getAvgMinutesNextN(player, startGW, numGWs));

      const ownershipStatus = getOwnershipStatus(player, USER_ID);

      return {
        ...player,
        displayPoints,
        avgMinutes,
        ownershipStatus
      };
    });

    // Group by position
    const grouped = {};
    POSITIONS.forEach(pos => {
      let positionPlayers = playersWithPoints.filter(p => p.position === pos);

      // Remove players with 0 points and sort by display points (descending)
      positionPlayers = positionPlayers.filter(p => p.displayPoints >= 0.05);
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
  }, [players, startGW, endGW, hideOthers, scoringMode, currentGameweek]);

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-4">
          {/* GW Range selector */}
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-sm text-gray-400">GW</label>
            <button
              onClick={() => setStartGW(gw => Math.max(currentGW, gw - 1))}
              className="text-gray-400 hover:text-white px-1 text-lg"
              disabled={startGW <= currentGW}
            >
              ◀
            </button>
            <input
              type="number"
              min={currentGW}
              max={endGW}
              value={startGW}
              onChange={(e) => setStartGW(Math.max(currentGW, Math.min(endGW, parseInt(e.target.value) || currentGW)))}
              className="bg-gray-700 text-white px-2 py-1.5 rounded border border-gray-600 text-sm w-16 sm:w-20 text-center focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={() => setStartGW(gw => Math.min(endGW, gw + 1))}
              className="text-gray-400 hover:text-white px-1 text-lg"
              disabled={startGW >= endGW}
            >
              ▶
            </button>
            <span className="text-gray-400 text-sm">to</span>
            <button
              onClick={() => setEndGW(gw => Math.max(startGW, gw - 1))}
              className="text-gray-400 hover:text-white px-1 text-lg"
              disabled={endGW <= startGW}
            >
              ◀
            </button>
            <input
              type="number"
              min={startGW}
              max={TOTAL_GAMEWEEKS}
              value={endGW}
              onChange={(e) => setEndGW(Math.max(startGW, Math.min(TOTAL_GAMEWEEKS, parseInt(e.target.value) || TOTAL_GAMEWEEKS)))}
              className="bg-gray-700 text-white px-2 py-1.5 rounded border border-gray-600 text-sm w-16 sm:w-20 text-center focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={() => setEndGW(gw => Math.min(TOTAL_GAMEWEEKS, gw + 1))}
              className="text-gray-400 hover:text-white px-1 text-lg"
              disabled={endGW >= TOTAL_GAMEWEEKS}
            >
              ▶
            </button>
            <span className="text-gray-500 text-xs ml-1">({numGWs} GW{numGWs !== 1 ? 's' : ''})</span>
          </div>

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
            ? `Showing your players + top 10 free agents per position (GW ${startGW}–${endGW})`
            : `Showing all players, top 50 per position (GW ${startGW}–${endGW})`}
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
  scoringMode: PropTypes.oneOf(['ffh', 'v3', 'v4']),
  currentGameweek: PropTypes.shape({
    number: PropTypes.number
  }),
  onPlayerClick: PropTypes.func
};
