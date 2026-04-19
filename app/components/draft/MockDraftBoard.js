'use client';

/**
 * MockDraftBoard — in-progress mock draft UI.
 *
 * Shows:
 *  - Pick status banner (whose turn, round/overall, countdown animation)
 *  - VORP pick suggestions (top 3 recommended for user)
 *  - Availability probability badges
 *  - Searchable/filterable player list
 *  - My roster sidebar
 *  - All rosters panel (collapsible)
 *  - Undo + Reset controls
 */

import { useState, useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';
import PlayerAvatar from '../common/PlayerAvatar';
import { getPositionBadgeStyle } from '../../constants/positionColors';
import { TEAM_DISPLAY_NAMES } from '../../constants/teams';
import { ARCHETYPES } from '../../services/mockDraftAiService';
import { getTierLabel, getTierColor, getPickSuggestions } from '../../services/draftRankingService';

const POSITIONS = ['ALL', 'GKP', 'DEF', 'MID', 'FWD'];

// ─── Availability badge ───────────────────────────────────────────────────────
function AvailBadge({ prob }) {
  if (prob === null || prob === undefined) return null;
  const pct = Math.round(prob * 100);
  const style =
    pct >= 75 ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
    pct >= 35 ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' :
               'bg-red-500/20 text-red-400 border-red-500/30';
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${style}`} title="% chance available at your next pick">
      {pct}%
    </span>
  );
}

// ─── Pick Suggestion Card ─────────────────────────────────────────────────────
function SuggestionCard({ player, rank, availProb, onPick }) {
  const reasonColors = {
    Value:      'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    Need:       'bg-blue-500/20 text-blue-400 border-blue-500/30',
    'Must Fill':'bg-red-500/20 text-red-400 border-red-500/30',
    Depth:      'bg-slate-500/20 text-slate-400 border-slate-500/30',
    Sleeper:    'bg-amber-500/20 text-amber-400 border-amber-500/30',
  };

  return (
    <div className="flex items-center gap-3 p-3 bg-slate-800/60 rounded-lg border border-slate-700 hover:border-violet-500/60 transition-colors">
      <span className="text-violet-400 font-bold text-lg min-w-[24px]">#{rank}</span>
      <PlayerAvatar player={player} size="md" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-white text-sm font-medium truncate">
            {player.web_name || player.name}
          </span>
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${getPositionBadgeStyle(player.position)}`}>
            {player.draftPosition}
          </span>
          {player.draftReason && (
            <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${reasonColors[player.draftReason] || reasonColors.Value}`}>
              {player.draftReason}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5 flex-wrap">
          <span>{TEAM_DISPLAY_NAMES[player.team_abbr] || player.team_abbr || player.team}</span>
          <span className="text-slate-600">·</span>
          <span>VORP {player.draftVorp?.toFixed(1)}</span>
          <span className="text-slate-600">·</span>
          <span>Proj {player.draftProjection?.toFixed(1)}</span>
          {availProb !== null && availProb !== undefined && (
            <>
              <span className="text-slate-600">·</span>
              <AvailBadge prob={availProb} />
            </>
          )}
        </div>
      </div>
      <button
        onClick={() => onPick(player)}
        className="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold rounded transition-colors flex-shrink-0"
      >
        Pick
      </button>
    </div>
  );
}

// ─── Player Row ───────────────────────────────────────────────────────────────
function PlayerRow({ player, isTaken, availProb, isMyTurn, onPick }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded transition-colors group ${isTaken ? 'opacity-40' : 'hover:bg-slate-700/40'}`}>
      <span className="text-slate-500 text-xs font-mono min-w-[28px]">{player.draftOverallRank}</span>
      <PlayerAvatar player={player} size="sm" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={`text-sm font-medium truncate ${isTaken ? 'text-slate-500 line-through' : 'text-white'}`}>
            {player.web_name || player.name}
          </span>
          <span className={`px-1 py-0.5 rounded text-[10px] font-bold border ${getPositionBadgeStyle(player.position)}`}>
            {player.draftPosition}
          </span>
        </div>
        <div className="text-xs text-slate-500 hidden sm:block">
          {TEAM_DISPLAY_NAMES[player.team_abbr] || player.team_abbr || player.team}
          {isTaken && ' · Taken'}
        </div>
      </div>
      <div className="hidden md:flex items-center gap-4 text-xs text-slate-400">
        <div className="text-right min-w-[44px]">
          <div className="text-slate-300 font-medium">{player.draftProjection?.toFixed(1)}</div>
          <div className="text-[10px]">Proj</div>
        </div>
        <div className="text-right min-w-[44px]">
          <div className="text-slate-300 font-medium">{player.draftVorp?.toFixed(1)}</div>
          <div className="text-[10px]">VORP</div>
        </div>
      </div>
      {availProb !== null && availProb !== undefined && !isTaken && (
        <AvailBadge prob={availProb} />
      )}
      {!isTaken && isMyTurn && (
        <button
          onClick={() => onPick(player)}
          className="px-2.5 py-1 bg-violet-600 hover:bg-violet-500 text-white text-[11px] font-bold rounded transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
        >
          Pick
        </button>
      )}
      {isTaken && (
        <span className="text-[10px] text-slate-600 w-14 text-right flex-shrink-0">Taken</span>
      )}
    </div>
  );
}

// ─── Running Draft Picks List ─────────────────────────────────────────────────
function DraftPicksList({ picks, myTeamIndex, leagueSize }) {
  if (!picks?.length) return (
    <p className="text-xs text-slate-600 italic">No picks yet</p>
  );

  // Group picks by round
  const byRound = {};
  picks.forEach(p => {
    if (!byRound[p.round]) byRound[p.round] = [];
    byRound[p.round].push(p);
  });

  return (
    <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
      {Object.entries(byRound)
        .sort(([a], [b]) => Number(b) - Number(a)) // most recent round first
        .map(([round, roundPicks]) => (
          <div key={round}>
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1 sticky top-0 bg-slate-800/90 py-0.5">
              Round {round}
            </div>
            <div className="space-y-0.5">
              {[...roundPicks].reverse().map(pick => {
                const isMe = pick.teamIndex === myTeamIndex;
                return (
                  <div
                    key={pick.overall}
                    className={`flex items-center gap-2 py-1 px-1.5 rounded ${isMe ? 'bg-emerald-900/20' : ''}`}
                  >
                    <span className="text-[10px] text-slate-600 font-mono min-w-[22px]">#{pick.overall}</span>
                    <span className={`px-1 py-0.5 rounded text-[9px] font-bold border ${getPositionBadgeStyle(pick.player.position)}`}>
                      {(pick.player.position || '').substring(0, 3).toUpperCase()}
                    </span>
                    <span className={`text-[11px] truncate flex-1 ${isMe ? 'text-emerald-300 font-medium' : 'text-slate-400'}`}>
                      {pick.player.web_name || pick.player.name}
                    </span>
                    {isMe && <span className="text-[9px] text-emerald-500 flex-shrink-0">you</span>}
                    {!isMe && <span className="text-[9px] text-slate-600 flex-shrink-0">T{pick.teamIndex + 1}</span>}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
    </div>
  );
}

// ─── My Roster Sidebar ────────────────────────────────────────────────────────
function MyRosterPanel({ myRoster, leagueSize, round }) {
  const byPos = useMemo(() => {
    const g = { GKP: [], DEF: [], MID: [], FWD: [] };
    myRoster.forEach(p => { const pos = (p.position || '').toUpperCase(); if (g[pos]) g[pos].push(p); });
    return g;
  }, [myRoster]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-white">My Roster</h3>
        <span className="text-xs text-slate-500">{myRoster.length}/17</span>
      </div>
      {Object.entries(byPos).map(([pos, players]) => (
        <div key={pos}>
          <div className="flex items-center gap-1.5 mb-1">
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${getPositionBadgeStyle(pos)}`}>{pos}</span>
            <span className="text-[10px] text-slate-500">{players.length}</span>
          </div>
          {players.length === 0 ? (
            <div className="text-[11px] text-slate-700 italic pl-1">–</div>
          ) : (
            <div className="space-y-0.5">
              {players.map(p => (
                <div key={p.sleeper_id || p.id} className="flex items-center gap-1.5 pl-1">
                  <span className="text-[11px] text-slate-300 truncate flex-1">{p.web_name || p.name}</span>
                  <span className="text-[10px] text-slate-500">{p.draftVorp?.toFixed(1)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── All Rosters Panel ────────────────────────────────────────────────────────
function AllRostersPanel({ allRosters, myTeamIndex, leagueSize, archetypes, archetypeNames }) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-bold text-white">All Rosters</h3>
      <div className="grid grid-cols-2 gap-2">
        {Array.from({ length: leagueSize }, (_, i) => {
          const roster = allRosters[i] || [];
          const isMe = i === myTeamIndex;
          const archKey = archetypes?.[i];
          const archName = archetypeNames?.[i] || ARCHETYPES[archKey]?.name || '';
          return (
            <div
              key={i}
              className={`rounded-lg p-2 border text-xs ${isMe ? 'bg-violet-900/20 border-violet-500/40' : 'bg-slate-800/40 border-slate-700'}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={`font-bold ${isMe ? 'text-violet-300' : 'text-slate-300'}`}>
                  {isMe ? '⭐ You' : `Team ${i + 1}`}
                </span>
                {!isMe && archName && (
                  <span className="text-[9px] text-slate-500 truncate max-w-[70px]">{archName}</span>
                )}
                <span className="text-slate-500">{roster.length}/17</span>
              </div>
              <div className="space-y-0.5 max-h-28 overflow-y-auto">
                {roster.map(p => (
                  <div key={p.sleeper_id || p.id} className="flex items-center gap-1">
                    <span className={`px-1 rounded text-[9px] font-bold border ${getPositionBadgeStyle(p.position)}`}>
                      {(p.position || '').substring(0, 3).toUpperCase()}
                    </span>
                    <span className="text-slate-400 truncate">{p.web_name || p.name}</span>
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

// ─── Tier Group (collapsible, matches cheat sheet style) ─────────────────────
function TierGroup({ tierNumber, players, takenIds, isMyTurn, getAvailabilityAtNextPick, onPick, isLast }) {
  const [collapsed, setCollapsed] = useState(tierNumber >= 7);
  const tierColor = getTierColor(tierNumber);
  const available = players.filter(p => !takenIds.has(p.sleeper_id || p.id)).length;

  return (
    <div className="mb-1">
      <button
        onClick={() => setCollapsed(c => !c)}
        className={`w-full flex items-center gap-2 px-3 py-2 rounded-t ${tierColor.bg} border ${tierColor.border} transition-colors hover:opacity-90`}
      >
        <span className={`text-sm font-bold ${tierColor.text}`}>
          Tier {tierNumber} — {getTierLabel(tierNumber)}
        </span>
        <span className="text-xs text-slate-500">
          {available === players.length
            ? `${players.length} available`
            : `${available} of ${players.length} available`}
        </span>
        <span className="ml-auto text-slate-500 text-xs">{collapsed ? '▶' : '▼'}</span>
      </button>

      {!collapsed && (
        <div className="border-x border-b border-slate-700/50 rounded-b bg-slate-800/20">
          {players.map(p => {
            const id = p.sleeper_id || p.id;
            const isTaken = takenIds.has(id);
            const availProb = getAvailabilityAtNextPick(id);
            return (
              <PlayerRow
                key={id}
                player={p}
                isTaken={isTaken}
                availProb={availProb}
                isMyTurn={isMyTurn}
                onPick={onPick}
              />
            );
          })}
        </div>
      )}

      {!isLast && !collapsed && (
        <div className="flex items-center gap-2 py-1 px-3">
          <div className="flex-1 border-t border-orange-500/30" />
          <span className="text-[10px] text-orange-400/70">tier break</span>
          <div className="flex-1 border-t border-orange-500/30" />
        </div>
      )}
    </div>
  );
}

// ─── Main MockDraftBoard ──────────────────────────────────────────────────────
export default function MockDraftBoard({
  draftState,
  phase,
  settings,
  availablePlayers,
  allRosters,
  myRoster,
  currentPickInfo,
  isMyTurn,
  takenIds,
  rankedPlayers,
  getAvailabilityAtNextPick,
  onMakeMyPick,
  onAutoPick,
  onUndo,
  onReset,
}) {
  const [posFilter, setPosFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [showAllRosters, setShowAllRosters] = useState(false);

  const { pickOrder, currentPickIndex, myTeamIndex, archetypes } = draftState || {};
  const { leagueSize } = settings;
  const totalPicks = pickOrder?.length || 0;
  const round = currentPickInfo ? currentPickInfo.round : Math.ceil((currentPickIndex || 0) / leagueSize);

  // Build archetype name map
  const archetypeNames = useMemo(() => {
    if (!archetypes) return {};
    return Object.fromEntries(
      Object.entries(archetypes).map(([ti, key]) => [ti, ARCHETYPES[key]?.name || key])
    );
  }, [archetypes]);

  // Suggestions — position-aware (mandatory minimums, diminishing returns, hard caps)
  const suggestions = useMemo(() =>
    getPickSuggestions(availablePlayers, myRoster, settings.scoringMode, settings.leagueSize, 3),
  [availablePlayers, myRoster, settings.scoringMode, settings.leagueSize]);

  // Filtered + searched players (all ranked, with taken flag)
  const displayPlayers = useMemo(() => {
    let players = rankedPlayers;
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
  }, [rankedPlayers, posFilter, search]);

  // Build tier groups
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

  const handlePick = useCallback((player) => {
    if (isMyTurn) onMakeMyPick(player);
  }, [isMyTurn, onMakeMyPick]);

  // ── Pick Status Banner ──
  const renderPickBanner = () => {
    if (!currentPickInfo) return null;
    const isAiPick = !isMyTurn;
    const teamLabel = isMyTurn ? 'Your Pick' : `Team ${(currentPickInfo.teamIndex || 0) + 1}`;
    const archKey = archetypes?.[currentPickInfo.teamIndex];
    const archName = archetypeNames?.[currentPickInfo.teamIndex] || '';

    return (
      <div className={`rounded-lg border px-4 py-3 flex flex-wrap items-center justify-between gap-3 ${
        isMyTurn
          ? 'bg-emerald-900/30 border-emerald-500/60'
          : 'bg-slate-800/60 border-slate-700'
      }`}>
        {/* Left: pick info */}
        <div className="flex items-center gap-4">
          <div>
            <div className={`text-lg font-bold ${isMyTurn ? 'text-emerald-400' : 'text-slate-300'}`}>
              {isMyTurn ? '🟢 Your Turn!' : `⏳ ${teamLabel} is picking…`}
            </div>
            {!isMyTurn && archName && (
              <div className="text-xs text-slate-500">{archName}</div>
            )}
          </div>
          <div className="flex items-baseline gap-2">
            <div className="text-2xl font-bold text-white leading-none">
              Pick {currentPickIndex + 1}
              <span className="text-sm font-normal text-slate-500"> / {totalPicks}</span>
            </div>
            <span className="text-slate-600">·</span>
            <div className="text-xl font-semibold text-slate-300 leading-none">Round {round}</div>
          </div>
        </div>

        {/* Right: action buttons (only on my turn) */}
        {isMyTurn && (
          <div className="flex items-center gap-2">
            <button
              onClick={onAutoPick}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-medium rounded transition-colors"
              title={suggestions[0] ? `Auto-pick: ${suggestions[0].web_name || suggestions[0].name}` : undefined}
            >
              Auto-pick{suggestions[0] ? `: ${suggestions[0].web_name || suggestions[0].name}` : ' Best'}
            </button>
            {draftState?.snapshots?.length > 0 && (
              <button
                onClick={onUndo}
                className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-medium rounded transition-colors"
              >
                ↩ Undo
              </button>
            )}
          </div>
        )}
        {!isMyTurn && draftState?.snapshots?.length > 0 && (
          <button
            onClick={onUndo}
            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-medium rounded transition-colors"
          >
            ↩ Undo
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Top Controls Bar */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {/* Progress bar */}
          <div className="flex-1 bg-slate-800 rounded-full h-2 max-w-[200px]">
            <div
              className="bg-violet-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${totalPicks ? ((currentPickIndex || 0) / totalPicks) * 100 : 0}%` }}
            />
          </div>
          <span className="text-xs text-slate-500 whitespace-nowrap">
            {currentPickIndex || 0}/{totalPicks} picks
          </span>
        </div>
        <button
          onClick={onReset}
          className="px-3 py-1.5 text-xs font-medium bg-red-600/70 hover:bg-red-500 text-white rounded transition-colors flex-shrink-0"
        >
          Abandon
        </button>
      </div>

      {/* Pick Banner */}
      {renderPickBanner()}

      {/* Suggestions (only on my turn) */}
      {isMyTurn && suggestions.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide">
            Top Picks — VORP + Roster Need
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
            {suggestions.map((player, i) => (
              <SuggestionCard
                key={player.sleeper_id || player.id}
                player={player}
                rank={i + 1}
                availProb={null}
                onPick={handlePick}
              />
            ))}
          </div>
        </div>
      )}

      {/* Main: tier board + sidebar */}
      <div className="flex flex-col lg:flex-row gap-4">

        {/* Left: Player Tier Board */}
        <div className="flex-1 min-w-0">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            {POSITIONS.map(pos => (
              <button
                key={pos}
                onClick={() => setPosFilter(pos)}
                className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                  posFilter === pos
                    ? 'bg-violet-600 text-white'
                    : 'bg-slate-700/50 text-slate-400 hover:text-white'
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

          {/* Tier groups */}
          <div>
            {tierGroups.map((group, i) => (
              <TierGroup
                key={group.tierNumber}
                tierNumber={group.tierNumber}
                players={group.players}
                takenIds={takenIds}
                isMyTurn={isMyTurn}
                getAvailabilityAtNextPick={getAvailabilityAtNextPick}
                onPick={handlePick}
                isLast={i === tierGroups.length - 1}
              />
            ))}
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="lg:w-64 flex-shrink-0 space-y-4">
          {/* My Roster */}
          <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-3">
            <MyRosterPanel
              myRoster={myRoster}
              leagueSize={leagueSize}
              round={round}
            />
          </div>

          {/* Draft Picks Log */}
          <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-white">Draft Picks</h3>
              <span className="text-xs text-slate-500">{draftState?.picks?.length || 0} made</span>
            </div>
            <DraftPicksList
              picks={draftState?.picks}
              myTeamIndex={myTeamIndex}
              leagueSize={leagueSize}
            />
          </div>

          {/* All Rosters toggle */}
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
                <AllRostersPanel
                  allRosters={allRosters}
                  myTeamIndex={myTeamIndex}
                  leagueSize={leagueSize}
                  archetypes={archetypes}
                  archetypeNames={archetypeNames}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

MockDraftBoard.propTypes = {
  draftState: PropTypes.object,
  phase: PropTypes.string.isRequired,
  settings: PropTypes.object.isRequired,
  availablePlayers: PropTypes.array.isRequired,
  allRosters: PropTypes.object.isRequired,
  myRoster: PropTypes.array.isRequired,
  currentPickInfo: PropTypes.object,
  isMyTurn: PropTypes.bool.isRequired,
  takenIds: PropTypes.instanceOf(Set).isRequired,
  rankedPlayers: PropTypes.array.isRequired,
  getAvailabilityAtNextPick: PropTypes.func.isRequired,
  onMakeMyPick: PropTypes.func.isRequired,
  onAutoPick: PropTypes.func.isRequired,
  onUndo: PropTypes.func.isRequired,
  onReset: PropTypes.func.isRequired,
};
