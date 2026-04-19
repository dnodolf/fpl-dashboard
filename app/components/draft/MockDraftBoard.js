'use client';

/**
 * MockDraftBoard — in-progress mock draft UI.
 *
 * Orchestrates the live draft view:
 *  - Pick status banner (whose turn, round/overall)
 *  - VORP pick suggestions (top 3 recommended for user)
 *  - Searchable/filterable tier board (from board/ sub-components)
 *  - My roster sidebar
 *  - All rosters panel (collapsible)
 *  - Undo + Reset controls
 */

import { useState, useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';
import { getPlayerId, getPlayerName, buildTierGroups } from '../../utils/playerUtils';
import { getPickSuggestions } from '../../services/draftRankingService';
import { ARCHETYPES } from '../../services/mockDraftAiService';
import SuggestionCard from './board/SuggestionCard';
import TierGroup from './board/TierGroup';
import DraftPicksList from './board/DraftPicksList';
import MyRosterPanel from './board/MyRosterPanel';
import AllRostersPanel from './board/AllRostersPanel';

const POSITIONS = ['ALL', 'FWD', 'MID', 'DEF', 'GKP'];

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

  const tierGroups = useMemo(() => buildTierGroups(displayPlayers), [displayPlayers]);

  const handlePick = useCallback((player) => {
    if (isMyTurn) onMakeMyPick(player);
  }, [isMyTurn, onMakeMyPick]);

  // ── Pick Status Banner ──────────────────────────────────────────────────────
  const archName = archetypeNames?.[currentPickInfo?.teamIndex] || '';

  return (
    <div className="space-y-4">
      {/* Top Controls Bar */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
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
      {currentPickInfo && (
        <div className={`rounded-lg border px-4 py-3 flex flex-wrap items-center justify-between gap-3 ${
          isMyTurn ? 'bg-emerald-900/30 border-emerald-500/60' : 'bg-slate-800/60 border-slate-700'
        }`}>
          <div className="flex items-center gap-4">
            <div>
              <div className={`text-lg font-bold ${isMyTurn ? 'text-emerald-400' : 'text-slate-300'}`}>
                {isMyTurn
                  ? '🟢 Your Turn!'
                  : `⏳ Team ${(currentPickInfo.teamIndex || 0) + 1} is picking…`}
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

          {isMyTurn && (
            <div className="flex items-center gap-2">
              <button
                onClick={onAutoPick}
                className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-medium rounded transition-colors"
                title={suggestions[0] ? `Auto-pick: ${getPlayerName(suggestions[0])}` : undefined}
              >
                Auto-pick{suggestions[0] ? `: ${getPlayerName(suggestions[0])}` : ' Best'}
              </button>
              {draftState?.snapshots?.length > 0 && (
                <button onClick={onUndo} className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-medium rounded transition-colors">
                  ↩ Undo
                </button>
              )}
            </div>
          )}
          {!isMyTurn && draftState?.snapshots?.length > 0 && (
            <button onClick={onUndo} className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-medium rounded transition-colors">
              ↩ Undo
            </button>
          )}
        </div>
      )}

      {/* Suggestions (only on my turn) */}
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
            <span className="text-[10px] text-slate-600 ml-auto hidden sm:block">
              Coloured % = chance still available at your next pick
            </span>
          </div>

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
          <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-3">
            <MyRosterPanel myRoster={myRoster} />
          </div>

          <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-white">Draft Picks</h3>
              <span className="text-xs text-slate-500">{draftState?.picks?.length || 0} made</span>
            </div>
            <DraftPicksList
              picks={draftState?.picks}
              myTeamIndex={myTeamIndex}
            />
          </div>

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
