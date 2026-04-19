'use client';

/**
 * LiveDraftView — the main board shown during an active draft.
 *
 * Layout:
 *   - Sync status bar (last synced, out-of-sync warning, resync button)
 *   - Pick banner (whose turn, round/overall)
 *   - Suggestions (top 3, only on user's turn)
 *   - Tier board (all players, taken ones marked) + right sidebar
 *     - My Roster
 *     - Draft Picks log
 *     - All Manager Rosters (collapsible)
 */

import { useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import { buildTierGroups, getPlayerId, getPlayerName } from '../../../utils/playerUtils';
import TierGroup from '../board/TierGroup';
import SuggestionCard from '../board/SuggestionCard';
import MyRosterPanel from '../board/MyRosterPanel';
import DraftPicksList from '../board/DraftPicksList';
import PositionBadge from '../../common/PositionBadge';

const POSITIONS = ['ALL', 'FWD', 'MID', 'DEF', 'GKP'];

// ─── Sync Status Bar ─────────────────────────────────────────────────────────
function SyncBar({ syncStatus, syncError, lastSyncAt, onResync, onReset }) {
  const secondsAgo = lastSyncAt ? Math.round((Date.now() - lastSyncAt) / 1000) : null;

  const isOutOfSync = syncStatus === 'out_of_sync';
  const isError     = syncStatus === 'error';

  return (
    <div className={`flex items-center justify-between gap-3 px-3 py-2 rounded-lg border text-xs ${
      isOutOfSync ? 'bg-amber-900/20 border-amber-500/40' :
      isError     ? 'bg-red-900/20 border-red-500/40' :
                    'bg-slate-800/60 border-slate-700'
    }`}>
      <div className="flex items-center gap-2">
        {syncStatus === 'polling' && (
          <span className="w-2 h-2 rounded-full bg-violet-400 animate-pulse flex-shrink-0" />
        )}
        {syncStatus === 'synced' && (
          <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
        )}
        {isOutOfSync && (
          <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
        )}
        {isError && (
          <span className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />
        )}

        {isOutOfSync && <span className="text-amber-400 font-medium">⚠️ Out of sync — picks may be missing</span>}
        {isError     && <span className="text-red-400">Connection error: {syncError}</span>}
        {!isOutOfSync && !isError && secondsAgo !== null && (
          <span className="text-slate-500">Last synced {secondsAgo}s ago</span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onResync}
          className="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition-colors"
        >
          ⟳ Resync
        </button>
        <button
          onClick={onReset}
          className="px-2.5 py-1 text-slate-500 hover:text-slate-300 transition-colors"
        >
          ✕ Exit
        </button>
      </div>
    </div>
  );
}

// ─── Pick Banner ──────────────────────────────────────────────────────────────
function PickBanner({ currentPickInfo, totalPicks, isMyTurn, suggestions, onAutoPick }) {
  if (!currentPickInfo) return null;
  const { pickNo, round, displayName } = currentPickInfo;

  return (
    <div className={`rounded-lg border px-4 py-3 flex flex-wrap items-center justify-between gap-3 ${
      isMyTurn
        ? 'bg-emerald-900/30 border-emerald-500/60'
        : 'bg-slate-800/60 border-slate-700'
    }`}>
      <div className="flex items-center gap-4">
        <div>
          <div className={`text-lg font-bold ${isMyTurn ? 'text-emerald-400' : 'text-slate-300'}`}>
            {isMyTurn ? '🟢 Your Turn!' : `⏳ ${displayName} is picking…`}
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <div className="text-2xl font-bold text-white leading-none">
            Pick {pickNo}
            <span className="text-sm font-normal text-slate-500"> / {totalPicks}</span>
          </div>
          <span className="text-slate-600">·</span>
          <div className="text-xl font-semibold text-slate-300 leading-none">Round {round}</div>
        </div>
      </div>

      {isMyTurn && suggestions?.length > 0 && (
        <button
          onClick={() => onAutoPick?.(suggestions[0])}
          className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-medium rounded transition-colors"
          title={`Top suggestion: ${getPlayerName(suggestions[0])}`}
        >
          Top pick: {getPlayerName(suggestions[0])}
        </button>
      )}
    </div>
  );
}

// ─── All Manager Rosters ──────────────────────────────────────────────────────
function AllManagerRosters({ allRosters, leagueSize, mySlot, userMap, draftMeta }) {
  // Build slot → displayName map
  const slotNames = useMemo(() => {
    const map = {};
    if (draftMeta?.draft_order) {
      Object.entries(draftMeta.draft_order).forEach(([uid, slot]) => {
        map[slot] = userMap[uid]?.displayName || `Team ${slot}`;
      });
    }
    for (let i = 1; i <= leagueSize; i++) {
      if (!map[i]) map[i] = `Team ${i}`;
    }
    return map;
  }, [draftMeta, userMap, leagueSize]);

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-bold text-white">All Rosters</h3>
      <div className="grid grid-cols-2 gap-2">
        {Array.from({ length: leagueSize }, (_, i) => {
          const slot = i + 1;
          const roster = allRosters[slot] || [];
          const isMe = slot === mySlot;
          const name = slotNames[slot];
          return (
            <div
              key={slot}
              className={`rounded-lg p-2 border text-xs ${isMe ? 'bg-violet-900/20 border-violet-500/40' : 'bg-slate-800/40 border-slate-700'}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={`font-bold truncate max-w-[90px] ${isMe ? 'text-violet-300' : 'text-slate-300'}`}>
                  {isMe ? `⭐ ${name}` : name}
                </span>
                <span className="text-slate-500 flex-shrink-0">{roster.length}/17</span>
              </div>
              <div className="space-y-0.5 max-h-28 overflow-y-auto">
                {roster.map(p => (
                  <div key={getPlayerId(p)} className="flex items-center gap-1">
                    <PositionBadge position={p.position} size="sm" className="text-[9px] flex-shrink-0" />
                    <span className="text-slate-400 truncate">{getPlayerName(p)}</span>
                  </div>
                ))}
                {roster.length === 0 && <span className="text-slate-700 italic">No picks yet</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Waiting Screen ───────────────────────────────────────────────────────────
function WaitingScreen({ draftMeta, onResync, onReset }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 space-y-4">
      <div className="text-4xl">⏳</div>
      <h3 className="text-lg font-bold text-white">Waiting for Draft to Start</h3>
      <p className="text-sm text-slate-400 text-center max-w-sm">
        The draft hasn't started yet. This page polls Sleeper every 30 seconds and will automatically switch to the live board when it begins.
      </p>
      {draftMeta && (
        <div className="text-xs text-slate-500 bg-slate-800 rounded px-4 py-2 border border-slate-700">
          Draft ID: {draftMeta.draft_id}
        </div>
      )}
      <div className="flex gap-2">
        <button onClick={onResync} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded transition-colors">
          ⟳ Check Now
        </button>
        <button onClick={onReset} className="px-4 py-2 text-slate-500 hover:text-slate-300 text-sm transition-colors">
          ← Back to Setup
        </button>
      </div>
    </div>
  );
}

// ─── Main LiveDraftView ───────────────────────────────────────────────────────
export default function LiveDraftView({
  phase,
  draftMeta,
  picks,
  rankings,
  availablePlayers,
  myRoster,
  allRosters,
  mySlot,
  leagueSize,
  totalPicks,
  currentPickInfo,
  isMyTurn,
  takenIds,
  suggestions,
  userMap,
  syncStatus,
  syncError,
  lastSyncAt,
  onResync,
  onReset,
}) {
  const [posFilter, setPosFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [showAllRosters, setShowAllRosters] = useState(false);

  // Filtered + searched ranked players
  const displayPlayers = useMemo(() => {
    let players = rankings?.rankedPlayers || [];
    if (posFilter !== 'ALL') {
      players = players.filter(p => (p.position || '').toUpperCase() === posFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      players = players.filter(p =>
        (p.name || '').toLowerCase().includes(q) ||
        (p.full_name || '').toLowerCase().includes(q) ||
        (p.web_name || '').toLowerCase().includes(q) ||
        (p.team_abbr || '').toLowerCase().includes(q)
      );
    }
    return players;
  }, [rankings, posFilter, search]);

  const tierGroups = useMemo(() => buildTierGroups(displayPlayers), [displayPlayers]);

  // Convert picks array to the shape DraftPicksList expects
  const picksForLog = useMemo(() => {
    if (!picks?.length || !rankings?.rankedPlayers) return [];
    return picks.map(pick => {
      const player = rankings.rankedPlayers.find(
        p => String(getPlayerId(p)) === String(pick.player_id)
      ) || { name: pick.metadata?.first_name + ' ' + pick.metadata?.last_name, position: pick.metadata?.position };
      const { round } = (() => {
        const r = Math.ceil(pick.pick_no / leagueSize);
        return { round: r };
      })();
      return { overall: pick.pick_no, round, teamIndex: pick.draft_slot - 1, player };
    });
  }, [picks, rankings, leagueSize]);

  if (phase === 'waiting') {
    return (
      <div className="space-y-4">
        <SyncBar syncStatus={syncStatus} syncError={syncError} lastSyncAt={lastSyncAt} onResync={onResync} onReset={onReset} />
        <WaitingScreen draftMeta={draftMeta} onResync={onResync} onReset={onReset} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Sync bar */}
      <SyncBar syncStatus={syncStatus} syncError={syncError} lastSyncAt={lastSyncAt} onResync={onResync} onReset={onReset} />

      {/* Pick banner */}
      <PickBanner
        currentPickInfo={currentPickInfo}
        totalPicks={totalPicks}
        isMyTurn={isMyTurn}
        suggestions={suggestions}
      />

      {/* Suggestions — only on user's turn */}
      {isMyTurn && suggestions.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide">
            Top Picks — VORP + Roster Need
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
            {suggestions.map((player, i) => (
              <SuggestionCard
                key={getPlayerId(player)}
                player={player}
                rank={i + 1}
                availProb={null}
                onPick={() => {}} // read-only — picks happen in Sleeper
              />
            ))}
          </div>
          <p className="text-[11px] text-slate-600 italic">
            Make your pick in Sleeper — the board will update automatically.
          </p>
        </div>
      )}

      {/* Main: tier board + sidebar */}
      <div className="flex flex-col lg:flex-row gap-4">

        {/* Left: Tier Board */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            {POSITIONS.map(pos => (
              <button
                key={pos}
                onClick={() => setPosFilter(pos)}
                className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                  posFilter === pos ? 'bg-violet-600 text-white' : 'bg-slate-700/50 text-slate-400 hover:text-white'
                }`}
              >
                {pos}
              </button>
            ))}
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search players…"
              className="flex-1 min-w-[140px] max-w-[240px] px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
            />
            <span className="text-xs text-slate-600">{availablePlayers.length} available</span>
          </div>

          <div>
            {tierGroups.map((group, i) => (
              <TierGroup
                key={group.tierNumber}
                tierNumber={group.tierNumber}
                players={group.players}
                takenIds={takenIds}
                isMyTurn={false} /* picks happen in Sleeper, not here */
                getAvailabilityAtNextPick={() => null}
                onPick={() => {}}
                isLast={i === tierGroups.length - 1}
              />
            ))}
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="lg:w-64 flex-shrink-0 space-y-4">
          {/* My Roster */}
          <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-3">
            <MyRosterPanel myRoster={myRoster} />
          </div>

          {/* Draft Log */}
          <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-white">Draft Picks</h3>
              <span className="text-xs text-slate-500">{picks.length} made</span>
            </div>
            <DraftPicksList
              picks={picksForLog}
              myTeamIndex={mySlot - 1}
            />
          </div>

          {/* All Rosters */}
          <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-3">
            <button
              onClick={() => setShowAllRosters(v => !v)}
              className="w-full flex items-center justify-between text-sm font-bold text-slate-300 hover:text-white transition-colors"
            >
              <span>All Rosters</span>
              <span className="text-slate-500 text-xs">{showAllRosters ? '▲ hide' : '▼ show'}</span>
            </button>
            {showAllRosters && (
              <div className="mt-3">
                <AllManagerRosters
                  allRosters={allRosters}
                  leagueSize={leagueSize}
                  mySlot={mySlot}
                  userMap={userMap}
                  draftMeta={draftMeta}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

LiveDraftView.propTypes = {
  phase: PropTypes.string.isRequired,
  draftMeta: PropTypes.object,
  picks: PropTypes.array.isRequired,
  rankings: PropTypes.object,
  availablePlayers: PropTypes.array.isRequired,
  myRoster: PropTypes.array.isRequired,
  allRosters: PropTypes.object.isRequired,
  mySlot: PropTypes.number,
  leagueSize: PropTypes.number.isRequired,
  totalPicks: PropTypes.number.isRequired,
  currentPickInfo: PropTypes.object,
  isMyTurn: PropTypes.bool.isRequired,
  takenIds: PropTypes.instanceOf(Set).isRequired,
  suggestions: PropTypes.array.isRequired,
  userMap: PropTypes.object.isRequired,
  syncStatus: PropTypes.string.isRequired,
  syncError: PropTypes.string,
  lastSyncAt: PropTypes.number,
  onResync: PropTypes.func.isRequired,
  onReset: PropTypes.func.isRequired,
};
