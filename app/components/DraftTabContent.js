/**
 * DraftTabContent Component
 * Offline draft cheat sheet with tier board, VORP suggestions, watchlist, and roster tracking.
 */

'use client';

import { useState, useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useDraftBoard } from '../hooks/useDraftBoard';
import { getTierLabel, getTierColor, ROSTER_SLOTS } from '../services/draftRankingService';
import { getPositionBadgeStyle } from '../constants/positionColors';
import { TEAM_DISPLAY_NAMES } from '../constants/teams';
import PlayerAvatar from './common/PlayerAvatar';
import DraftAnalysisPanel from './draft/DraftAnalysisPanel';

const POSITIONS = ['ALL', 'GKP', 'DEF', 'MID', 'FWD'];

// ─── Pick Suggestion Card ───────────────────────────────────────────────────
const SuggestionCard = ({ player, rank, onDraft, onPlayerClick }) => {
  const reasonColors = {
    Value: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    Need: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    'Must Fill': 'bg-red-500/20 text-red-400 border-red-500/30',
    Depth: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
    Sleeper: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  };

  return (
    <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg border border-slate-700 hover:border-violet-500/50 transition-colors">
      <span className="text-violet-400 font-bold text-lg min-w-[24px]">#{rank}</span>
      <PlayerAvatar player={player} size="md" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onPlayerClick?.(player)}
            className="text-white text-sm font-medium truncate hover:text-violet-400 transition-colors text-left"
          >
            {player.web_name || player.name}
          </button>
          <span className={`px-1.5 py-0.5 rounded text-xs font-bold border ${getPositionBadgeStyle(player.position)}`}>
            {player.draftPosition}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
          <span>{TEAM_DISPLAY_NAMES[player.team_abbr] || player.team_abbr || player.team}</span>
          <span>|</span>
          <span>VORP: {player.draftVorp?.toFixed(1)}</span>
          <span>|</span>
          <span>Proj: {player.draftProjection?.toFixed(1)}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className={`px-2 py-0.5 rounded text-xs font-medium border ${reasonColors[player.draftReason] || reasonColors.Value}`}>
          {player.draftReason}
        </span>
        <button
          onClick={() => onDraft(player, 'me')}
          className="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium rounded transition-colors"
        >
          Draft
        </button>
      </div>
    </div>
  );
};

// ─── Player Row in Tier Board ───────────────────────────────────────────────
const PlayerRow = ({ player, isWatchlisted, myRosterFull, onDraft, onUndraft, onToggleWatchlist, onToggleDND, onPlayerClick }) => {
  const isDrafted = player.isDrafted;
  const isMyPick = player.draftedBy === 'me';

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded transition-colors group ${isDrafted ? 'opacity-40' : 'hover:bg-slate-700/30'}`}>
      <span className="text-slate-500 text-xs font-mono min-w-[28px]">{player.draftOverallRank}</span>

      <PlayerAvatar player={player} size="sm" />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onPlayerClick?.(player)}
            className={`text-sm font-medium truncate transition-colors text-left ${isDrafted ? 'text-slate-500 line-through' : 'text-white hover:text-violet-400'}`}
          >
            {player.web_name || player.name}
          </button>
          <span className={`px-1 py-0.5 rounded text-[10px] font-bold border ${getPositionBadgeStyle(player.position)}`}>
            {player.draftPosition}
          </span>
          {isDrafted && (
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${isMyPick ? 'bg-violet-500/20 text-violet-400 border-violet-500/30' : 'bg-slate-600/30 text-slate-500 border-slate-600/30'}`}>
              {isMyPick ? 'My Pick' : 'Taken'}
            </span>
          )}
          {!isDrafted && player.draftSleeperTag && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-500/20 text-green-400 border border-green-500/30">
              Sleeper
            </span>
          )}
        </div>
        <div className="text-xs text-slate-500 hidden sm:block">
          {TEAM_DISPLAY_NAMES[player.team_abbr] || player.team_abbr || player.team}
        </div>
      </div>

      {/* Stats */}
      <div className="hidden md:flex items-center gap-4 text-xs text-slate-400">
        <div className="text-right min-w-[48px]">
          <div className="text-slate-300 font-medium">{player.draftProjection?.toFixed(1)}</div>
          <div className="text-[10px]">Proj</div>
        </div>
        <div className="text-right min-w-[48px]">
          <div className="text-slate-300 font-medium">{player.draftVorp?.toFixed(1)}</div>
          <div className="text-[10px]">VORP</div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {isDrafted ? (
          <button
            onClick={() => onUndraft(player.sleeper_id || player.id)}
            className="px-2 py-1 text-slate-600 hover:text-slate-400 text-[10px] rounded transition-colors opacity-0 group-hover:opacity-100"
            title="Undo pick"
          >
            Undo
          </button>
        ) : (
          <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => onToggleWatchlist(player.sleeper_id || player.id)}
              className={`p-1 rounded transition-colors ${isWatchlisted ? 'text-amber-400' : 'text-slate-500 hover:text-amber-400'}`}
              title={isWatchlisted ? 'Remove from watchlist' : 'Add to watchlist'}
            >
              {isWatchlisted ? '\u2605' : '\u2606'}
            </button>
            <button
              onClick={() => onDraft(player, 'me')}
              disabled={myRosterFull}
              className={`px-2 py-1 text-white text-[10px] font-medium rounded transition-colors ${myRosterFull ? 'bg-slate-700 opacity-40 cursor-not-allowed' : 'bg-violet-600/80 hover:bg-violet-500'}`}
            >
              Mine
            </button>
            <button
              onClick={() => onDraft(player, 'other')}
              className="px-2 py-1 bg-slate-600/80 hover:bg-slate-500 text-white text-[10px] font-medium rounded transition-colors"
            >
              Taken
            </button>
            <button
              onClick={() => onToggleDND(player.sleeper_id || player.id)}
              className="p-1 text-slate-600 hover:text-red-400 rounded transition-colors text-xs"
              title="Do not draft"
            >
              &times;
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Tier Group ─────────────────────────────────────────────────────────────
const TierGroup = ({ tierNumber, players, watchlist, myRosterFull, onDraft, onUndraft, onToggleWatchlist, onToggleDND, onPlayerClick, isLast }) => {
  const [collapsed, setCollapsed] = useState(tierNumber >= 7);
  const tierColor = getTierColor(tierNumber);

  return (
    <div className="mb-1">
      {/* Tier Header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className={`w-full flex items-center gap-2 px-3 py-2 rounded-t ${tierColor.bg} border ${tierColor.border} transition-colors hover:opacity-90`}
      >
        <span className={`text-sm font-bold ${tierColor.text}`}>
          Tier {tierNumber} — {getTierLabel(tierNumber)}
        </span>
        <span className="text-xs text-slate-500">
          {(() => {
            const available = players.filter(p => !p.isDrafted).length;
            return available === players.length
              ? `${players.length} available`
              : `${available} of ${players.length} available`;
          })()}
        </span>
        <span className="ml-auto text-slate-500 text-xs">{collapsed ? '\u25B6' : '\u25BC'}</span>
      </button>

      {/* Player Rows */}
      {!collapsed && (
        <div className="border-x border-b border-slate-700/50 rounded-b bg-slate-800/20">
          {players.map((player) => (
            <PlayerRow
              key={player.sleeper_id || player.id}
              player={player}
              isWatchlisted={watchlist.includes(player.sleeper_id || player.id)}
              myRosterFull={myRosterFull}
              onDraft={onDraft}
              onUndraft={onUndraft}
              onToggleWatchlist={onToggleWatchlist}
              onToggleDND={onToggleDND}
              onPlayerClick={onPlayerClick}
            />
          ))}
        </div>
      )}

      {/* Tier break warning */}
      {!isLast && !collapsed && (
        <div className="flex items-center gap-2 py-1 px-3">
          <div className="flex-1 border-t border-orange-500/30" />
          <span className="text-[10px] text-orange-400/70">tier break</span>
          <div className="flex-1 border-t border-orange-500/30" />
        </div>
      )}
    </div>
  );
};

// ─── Position Tier Group (compact, for by-position view) ────────────────────
const PositionTierGroup = ({ tierNumber, position, players, watchlist, myRosterFull, onDraft, onUndraft, onToggleWatchlist, onPlayerClick, isLast }) => {
  const [collapsed, setCollapsed] = useState(tierNumber >= 7);
  const tierColor = getTierColor(tierNumber);

  return (
    <div className="mb-0.5">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className={`w-full flex items-center gap-1.5 px-2 py-1 rounded-t ${tierColor.bg} border ${tierColor.border} transition-colors hover:opacity-90`}
      >
        <span className={`text-xs font-bold ${tierColor.text}`}>
          T{tierNumber}
        </span>
        <span className="text-[10px] text-slate-500 truncate">{getTierLabel(tierNumber)}</span>
        <span className="text-[10px] text-slate-600 ml-auto">
          {(() => {
            const available = players.filter(p => !p.isDrafted).length;
            return available === players.length ? players.length : `${available}/${players.length}`;
          })()}
        </span>
        <span className="text-slate-500 text-[10px]">{collapsed ? '\u25B6' : '\u25BC'}</span>
      </button>

      {!collapsed && (
        <div className="border-x border-b border-slate-700/50 rounded-b bg-slate-800/20">
          {players.map((player) => {
            const playerId = player.sleeper_id || player.id;
            const isWatchlisted = watchlist.includes(playerId);
            const isDrafted = player.isDrafted;
            const isMyPick = player.draftedBy === 'me';
            return (
              <div key={playerId} className={`flex items-center gap-1.5 px-2 py-1 rounded transition-colors group ${isDrafted ? 'opacity-40' : 'hover:bg-slate-700/30'}`}>
                <span className="text-slate-500 text-[10px] font-mono min-w-[20px]">{player.draftOverallRank}</span>
                <button
                  onClick={() => onPlayerClick?.(player)}
                  className={`text-xs font-medium truncate transition-colors text-left flex-1 min-w-0 ${isDrafted ? 'text-slate-500 line-through' : 'text-white hover:text-violet-400'}`}
                >
                  {player.web_name || player.name}
                </button>
                {isDrafted ? (
                  <span className={`text-[9px] font-medium ${isMyPick ? 'text-violet-400' : 'text-slate-600'}`}>
                    {isMyPick ? 'Mine' : 'Taken'}
                  </span>
                ) : (
                  <>
                    <span className="text-[10px] text-slate-500 hidden sm:inline">{player.team_abbr || player.team}</span>
                    <span className="text-[10px] text-slate-400 min-w-[28px] text-right">{player.draftVorp?.toFixed(0)}</span>
                  </>
                )}
                <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  {isDrafted ? (
                    <button
                      onClick={() => onUndraft(playerId)}
                      className="text-[9px] text-slate-600 hover:text-slate-400 rounded transition-colors"
                    >
                      Undo
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => onToggleWatchlist(playerId)}
                        className={`text-xs ${isWatchlisted ? 'text-amber-400' : 'text-slate-600 hover:text-amber-400'}`}
                      >
                        {isWatchlisted ? '\u2605' : '\u2606'}
                      </button>
                      <button
                        onClick={() => onDraft(player, 'me')}
                        disabled={myRosterFull}
                        className={`px-1.5 py-0.5 text-white text-[9px] font-medium rounded transition-colors ${myRosterFull ? 'bg-slate-700 opacity-40 cursor-not-allowed' : 'bg-violet-600/80 hover:bg-violet-500'}`}
                      >
                        Mine
                      </button>
                      <button
                        onClick={() => onDraft(player, 'other')}
                        className="px-1.5 py-0.5 bg-slate-600/80 hover:bg-slate-500 text-white text-[9px] font-medium rounded transition-colors"
                      >
                        Taken
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!isLast && !collapsed && (
        <div className="flex items-center gap-1 py-0.5 px-2">
          <div className="flex-1 border-t border-orange-500/20" />
        </div>
      )}
    </div>
  );
};

// ─── Roster Sidebar ─────────────────────────────────────────────────────────
// Shows the actual Sleeper FC slot structure: GK, DEF, MID, FWD, flex slots, bench
const RosterSidebar = ({ myRoster, onUndraft, onPlayerClick }) => {
  // Assign drafted players to slots using the actual slot structure.
  // Greedy assignment: fill locked slots first, then flex, then bench.
  const assignments = useMemo(() => {
    const remaining = [...myRoster];
    const slots = [];

    // Helper: take best available player matching any of these positions
    const fillSlot = (slotLabel, eligiblePositions, count) => {
      for (let i = 0; i < count; i++) {
        const idx = remaining.findIndex(p => {
          const pos = (p.position || '').toUpperCase();
          const normalized = pos === 'GK' || pos === 'G' ? 'GKP' : pos === 'D' ? 'DEF' : pos === 'M' ? 'MID' : pos === 'F' ? 'FWD' : pos;
          return eligiblePositions.includes(normalized);
        });
        if (idx !== -1) {
          slots.push({ slot: slotLabel, player: remaining.splice(idx, 1)[0], eligible: eligiblePositions });
        } else {
          slots.push({ slot: slotLabel, player: null, eligible: eligiblePositions });
        }
      }
    };

    // Fill in order: locked position slots → flex → bench
    fillSlot('GK', ['GKP'], 1);
    fillSlot('DEF', ['DEF'], 3);
    fillSlot('MID', ['MID'], 3);
    fillSlot('FWD', ['FWD'], 1);
    fillSlot('FM', ['FWD', 'MID'], 1);
    fillSlot('FMD', ['FWD', 'MID', 'DEF'], 1);
    fillSlot('MD', ['MID', 'DEF'], 1);

    // Bench: any remaining players, up to 6
    const benchCount = 6;
    for (let i = 0; i < benchCount; i++) {
      if (remaining.length > 0) {
        slots.push({ slot: 'BN', player: remaining.shift(), eligible: ['GKP', 'DEF', 'MID', 'FWD'] });
      } else {
        slots.push({ slot: 'BN', player: null, eligible: ['GKP', 'DEF', 'MID', 'FWD'] });
      }
    }

    return slots;
  }, [myRoster]);

  const filledCount = assignments.filter(s => s.player).length;

  // Group for display
  const starterSlots = assignments.filter(s => s.slot !== 'BN');
  const benchSlots = assignments.filter(s => s.slot === 'BN');

  const slotLabel = (slot, eligible) => {
    if (['GK', 'DEF', 'MID', 'FWD'].includes(slot)) return slot;
    // Show flex eligibility
    return `${slot}`;
  };

  const slotBadgeStyle = (slot) => {
    const posMap = { GK: 'GKP', DEF: 'DEF', MID: 'MID', FWD: 'FWD' };
    if (posMap[slot]) return getPositionBadgeStyle(posMap[slot]);
    // Flex slots get a neutral style
    return 'bg-slate-600 text-white border-slate-500';
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-white">My Roster</h3>
        <span className="text-xs text-slate-500">{filledCount}/17</span>
      </div>

      {/* Starters */}
      <div className="space-y-1">
        <div className="text-[10px] text-slate-500 uppercase font-medium">Starters (11)</div>
        {starterSlots.map((s, i) => (
          <div key={`starter-${i}`} className="flex items-center gap-2 py-0.5">
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border min-w-[34px] text-center ${slotBadgeStyle(s.slot)}`}>
              {slotLabel(s.slot, s.eligible)}
            </span>
            {s.player ? (
              <>
                <button
                  onClick={() => onPlayerClick?.(s.player)}
                  className="text-xs text-slate-300 hover:text-violet-400 truncate flex-1 text-left"
                >
                  {s.player.web_name || s.player.name}
                </button>
                <button
                  onClick={() => onUndraft(s.player.sleeper_id || s.player.id)}
                  className="text-slate-600 hover:text-red-400 text-xs flex-shrink-0"
                  title="Undo draft"
                >
                  &times;
                </button>
              </>
            ) : (
              <span className="text-xs text-slate-600 italic flex-1">
                {s.eligible.length > 1 ? s.eligible.join('/') : 'Empty'}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Bench */}
      <div className="space-y-1">
        <div className="text-[10px] text-slate-500 uppercase font-medium">Bench (6)</div>
        {benchSlots.map((s, i) => (
          <div key={`bench-${i}`} className="flex items-center gap-2 py-0.5">
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold border bg-slate-700 text-slate-400 border-slate-600 min-w-[34px] text-center">
              BN
            </span>
            {s.player ? (
              <>
                <span className={`px-1 py-0.5 rounded text-[10px] font-bold border ${getPositionBadgeStyle(s.player.position)}`}>
                  {(s.player.position || '').substring(0, 3).toUpperCase()}
                </span>
                <button
                  onClick={() => onPlayerClick?.(s.player)}
                  className="text-xs text-slate-300 hover:text-violet-400 truncate flex-1 text-left"
                >
                  {s.player.web_name || s.player.name}
                </button>
                <button
                  onClick={() => onUndraft(s.player.sleeper_id || s.player.id)}
                  className="text-slate-600 hover:text-red-400 text-xs flex-shrink-0"
                  title="Undo draft"
                >
                  &times;
                </button>
              </>
            ) : (
              <span className="text-xs text-slate-600 italic flex-1">Empty</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Main DraftTabContent ───────────────────────────────────────────────────
export default function DraftTabContent({ players, currentGameweek, scoringMode, onPlayerClick, userId, leagueId }) {
  const [activeView, setActiveView] = useState('board'); // 'board' | 'analysis'
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [tierView, setTierView] = useState('overall'); // 'overall' | 'byPosition'

  const {
    draftedPlayers,
    watchlist,
    doNotDraft,
    rankings,
    suggestions,
    displayPlayers,
    watchlistPlayers,
    rosterSlots,
    pickNumber,
    totalPicks,
    positionFilter,
    setPositionFilter,
    searchQuery,
    setSearchQuery,
    draftPlayer,
    undraftPlayer,
    toggleWatchlist,
    toggleDND,
    resetDraft,
    myRoster,
    myRosterFull,
  } = useDraftBoard(players, scoringMode);

  const handleReset = useCallback(() => {
    resetDraft();
    setShowResetConfirm(false);
  }, [resetDraft]);

  // Build overall tier groups from display players
  const tierGroups = useMemo(() => {
    const groups = {};
    displayPlayers.forEach(p => {
      const tier = p.draftTier || 99;
      if (!groups[tier]) groups[tier] = [];
      groups[tier].push(p);
    });
    return Object.entries(groups)
      .map(([tier, players]) => ({ tierNumber: parseInt(tier), players }))
      .sort((a, b) => a.tierNumber - b.tierNumber);
  }, [displayPlayers]);

  // Build per-position tier groups — drafted players stay in place, just marked
  const positionTierGroups = useMemo(() => {
    const posTiers = rankings.positionTiers;
    if (!posTiers) return {};

    const result = {};
    for (const pos of ['GKP', 'DEF', 'MID', 'FWD']) {
      const data = posTiers[pos];
      if (!data?.tiers) continue;

      let filteredTiers = {};
      for (const [tier, players] of Object.entries(data.tiers)) {
        // Attach draft status to each player
        let enriched = players.map(p => {
          const id = p.sleeper_id || p.id;
          const draftInfo = draftedPlayers[id];
          return { ...p, isDrafted: !!draftInfo, draftedBy: draftInfo?.draftedBy || null };
        });

        // Apply search filter
        if (searchQuery.trim()) {
          const query = searchQuery.toLowerCase().trim();
          enriched = enriched.filter(p =>
            (p.name || '').toLowerCase().includes(query) ||
            (p.full_name || '').toLowerCase().includes(query) ||
            (p.team || '').toLowerCase().includes(query) ||
            (p.team_abbr || '').toLowerCase().includes(query)
          );
        }

        if (enriched.length > 0) {
          filteredTiers[tier] = enriched;
        }
      }

      result[pos] = Object.entries(filteredTiers)
        .map(([tier, players]) => ({ tierNumber: parseInt(tier), players }))
        .sort((a, b) => a.tierNumber - b.tierNumber);
    }
    return result;
  }, [rankings.positionTiers, searchQuery, draftedPlayers]);

  if (activeView === 'analysis') {
    return (
      <div className="space-y-4">
        {/* View Toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveView('board')}
            className="px-3 py-1.5 text-sm font-medium rounded transition-colors text-slate-400 hover:text-white hover:bg-slate-700"
          >
            Draft Board
          </button>
          <button
            onClick={() => setActiveView('analysis')}
            className="px-3 py-1.5 text-sm font-medium rounded transition-colors bg-violet-600 text-white"
          >
            Draft Analysis
          </button>
        </div>
        <DraftAnalysisPanel
          leagueId={leagueId}
          players={players}
          scoringMode={scoringMode}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top Bar: View Toggle + Draft Progress + Controls */}
      <div className="flex flex-wrap items-center gap-3">
        {/* View Toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveView('board')}
            className="px-3 py-1.5 text-sm font-medium rounded transition-colors bg-violet-600 text-white"
          >
            Draft Board
          </button>
          <button
            onClick={() => setActiveView('analysis')}
            className="px-3 py-1.5 text-sm font-medium rounded transition-colors text-slate-400 hover:text-white hover:bg-slate-700"
          >
            Draft Analysis
          </button>
        </div>

        {/* Draft Progress */}
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-sm text-slate-400">
            Pick <span className="text-white font-bold">{pickNumber + 1}</span> of {totalPicks}
          </span>
          <span className="text-xs text-slate-600">|</span>
          <span className="text-xs text-slate-500">
            My roster: {myRoster.length}/17
          </span>
        </div>

        {/* Reset */}
        {showResetConfirm ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-red-400">Reset all draft data?</span>
            <button
              onClick={handleReset}
              className="px-2 py-1 bg-red-600 hover:bg-red-500 text-white text-xs rounded"
            >
              Yes, reset
            </button>
            <button
              onClick={() => setShowResetConfirm(false)}
              className="px-2 py-1 bg-slate-600 hover:bg-slate-500 text-white text-xs rounded"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowResetConfirm(true)}
            className="px-2 py-1 text-xs text-slate-500 hover:text-red-400 transition-colors"
            title="Reset draft"
          >
            Reset
          </button>
        )}
      </div>

      {/* Pick Suggestions */}
      {suggestions.length > 0 && !myRosterFull && (
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <span className="text-violet-400">Recommended Picks</span>
            <span className="text-xs text-slate-500 font-normal">based on VORP + roster need</span>
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
            {suggestions.map((player, i) => (
              <SuggestionCard
                key={player.sleeper_id || player.id}
                player={player}
                rank={i + 1}
                onDraft={draftPlayer}
                onPlayerClick={onPlayerClick}
              />
            ))}
          </div>
        </div>
      )}

      {/* Main Content: Tier Board + Roster Sidebar */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Left: Tier Board */}
        <div className="flex-1 min-w-0">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            {/* Tier View Toggle */}
            <div className="flex items-center gap-1 border-r border-slate-700 pr-2 mr-1">
              <button
                onClick={() => setTierView('overall')}
                className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                  tierView === 'overall'
                    ? 'bg-violet-600 text-white'
                    : 'bg-slate-700/50 text-slate-400 hover:text-white'
                }`}
              >
                Overall
              </button>
              <button
                onClick={() => setTierView('byPosition')}
                className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                  tierView === 'byPosition'
                    ? 'bg-violet-600 text-white'
                    : 'bg-slate-700/50 text-slate-400 hover:text-white'
                }`}
              >
                By Position
              </button>
            </div>

            {/* Position Filter (only show in overall view) */}
            {tierView === 'overall' && (
              <div className="flex items-center gap-1">
                {POSITIONS.map(pos => (
                  <button
                    key={pos}
                    onClick={() => setPositionFilter(pos)}
                    className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                      positionFilter === pos
                        ? 'bg-violet-600 text-white'
                        : 'bg-slate-700/50 text-slate-400 hover:text-white'
                    }`}
                  >
                    {pos}
                  </button>
                ))}
              </div>
            )}

            {/* Search */}
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search players..."
              className="flex-1 min-w-[150px] max-w-[250px] px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
            />

            <span className="text-xs text-slate-500">
              {tierView === 'overall' ? `${displayPlayers.length} available` : ''}
            </span>
          </div>

          {/* Overall Tier View */}
          {tierView === 'overall' && (
            <>
              {tierGroups.length > 0 ? (
                tierGroups.map((group, i) => (
                  <TierGroup
                    key={group.tierNumber}
                    tierNumber={group.tierNumber}
                    players={group.players}
                    watchlist={watchlist}
                    myRosterFull={myRosterFull}
                    onDraft={draftPlayer}
                    onUndraft={undraftPlayer}
                    onToggleWatchlist={toggleWatchlist}
                    onToggleDND={toggleDND}
                    onPlayerClick={onPlayerClick}
                    isLast={i === tierGroups.length - 1}
                  />
                ))
              ) : (
                <div className="text-center py-12 text-slate-500">
                  <p className="text-lg">No players available</p>
                  <p className="text-sm mt-1">Player data may still be loading, or all players have been drafted.</p>
                </div>
              )}
            </>
          )}

          {/* By Position Tier View */}
          {tierView === 'byPosition' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {['GKP', 'DEF', 'MID', 'FWD'].map(pos => {
                const groups = positionTierGroups[pos] || [];
                const totalPlayers = groups.reduce((sum, g) => sum + g.players.length, 0);
                return (
                  <div key={pos} className="space-y-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold border ${getPositionBadgeStyle(pos)}`}>
                        {pos}
                      </span>
                      <span className="text-xs text-slate-500">{totalPlayers} available</span>
                      <span className="ml-auto text-[10px] text-slate-600 pr-1">VORP</span>
                    </div>
                    {groups.length > 0 ? (
                      groups.map((group, i) => (
                        <PositionTierGroup
                          key={`${pos}-${group.tierNumber}`}
                          tierNumber={group.tierNumber}
                          position={pos}
                          players={group.players}
                          watchlist={watchlist}
                          myRosterFull={myRosterFull}
                          onDraft={draftPlayer}
                          onUndraft={undraftPlayer}
                          onToggleWatchlist={toggleWatchlist}
                          onPlayerClick={onPlayerClick}
                          isLast={i === groups.length - 1}
                        />
                      ))
                    ) : (
                      <div className="text-xs text-slate-600 italic py-4 text-center">
                        No {pos} available
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Roster + Watchlist */}
        <div className="lg:w-64 flex-shrink-0 space-y-4">
          {/* My Roster */}
          <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-3">
            <RosterSidebar
              myRoster={myRoster}
              onUndraft={undraftPlayer}
              onPlayerClick={onPlayerClick}
            />
          </div>

          {/* Watchlist */}
          {watchlistPlayers.length > 0 && (
            <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-3">
              <h3 className="text-sm font-bold text-amber-400 mb-2">
                Watchlist ({watchlistPlayers.length})
              </h3>
              <div className="space-y-1">
                {watchlistPlayers.map(player => (
                  <div key={player.sleeper_id || player.id} className="flex items-center gap-2">
                    <button
                      onClick={() => onPlayerClick?.(player)}
                      className="text-xs text-slate-300 hover:text-violet-400 truncate flex-1 text-left"
                    >
                      {player.web_name || player.name}
                    </button>
                    <span className={`px-1 py-0.5 rounded text-[10px] font-bold border ${getPositionBadgeStyle(player.position)}`}>
                      {player.draftPosition}
                    </span>
                    <span className="text-[10px] text-slate-500">{player.draftVorp?.toFixed(1)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Scarcity Info */}
          {rankings.scarcity && (
            <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-3">
              <h3 className="text-sm font-bold text-white mb-2">Position Scarcity</h3>
              <div className="space-y-1.5">
                {['GKP', 'DEF', 'MID', 'FWD'].map(pos => {
                  const val = rankings.scarcity[pos] || 1;
                  const barWidth = Math.min(100, val * 50); // Normalize for display
                  const isHigh = val > 1.3;
                  return (
                    <div key={pos} className="flex items-center gap-2">
                      <span className={`px-1 py-0.5 rounded text-[10px] font-bold border ${getPositionBadgeStyle(pos)} min-w-[32px] text-center`}>
                        {pos}
                      </span>
                      <div className="flex-1 bg-slate-700/50 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${isHigh ? 'bg-orange-500' : 'bg-slate-500'}`}
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                      <span className={`text-[10px] ${isHigh ? 'text-orange-400' : 'text-slate-500'}`}>
                        {val.toFixed(2)}x
                      </span>
                    </div>
                  );
                })}
                <p className="text-[10px] text-slate-600 mt-1">Higher = scarcer = draft sooner</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

DraftTabContent.propTypes = {
  players: PropTypes.array.isRequired,
  currentGameweek: PropTypes.object,
  scoringMode: PropTypes.string.isRequired,
  onPlayerClick: PropTypes.func,
  userId: PropTypes.string,
  leagueId: PropTypes.string,
};
