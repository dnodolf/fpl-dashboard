/**
 * DraftTabContent Component
 * Offline draft cheat sheet with tier board, VORP suggestions, watchlist, and roster tracking.
 */

'use client';

import { useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useDraftBoard } from '../hooks/useDraftBoard';
import { useMockDraft } from '../hooks/useMockDraft';
import { getTierLabel, getTierColor } from '../services/draftRankingService';
import { getPositionBadgeStyle } from '../constants/positionColors';
import { TEAM_DISPLAY_NAMES } from '../constants/teams';
import PlayerAvatar from './common/PlayerAvatar';
import DraftAnalysisPanel from './draft/DraftAnalysisPanel';
import MockDraftSetup from './draft/MockDraftSetup';
import MockDraftBoard from './draft/MockDraftBoard';
import MockDraftResults from './draft/MockDraftResults';
import DraftAssistantPlaceholder from './draft/DraftAssistantPlaceholder';

const POSITIONS = ['ALL', 'GKP', 'DEF', 'MID', 'FWD'];

// ─── Main DraftTabContent ───────────────────────────────────────────────────
export default function DraftTabContent({ players, currentGameweek, scoringMode, onPlayerClick, userId, leagueId }) {
  // Top-level tab: 'cheatsheet' | 'mock' | 'analysis'
  const [activeTab, setActiveTab] = useState('cheatsheet');

  // Mock draft hook
  const mock = useMockDraft(players, scoringMode);

  const {
    displayPlayers,
    positionFilter,
    setPositionFilter,
    searchQuery,
    setSearchQuery,
  } = useDraftBoard(players, scoringMode);

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

  // ── Tab bar (shared across all views) ──────────────────────────────────────
  const TABS = [
    { key: 'cheatsheet', label: 'Cheat Sheet' },
    { key: 'mock',       label: 'Mock Draft' },
    { key: 'assistant',  label: 'Draft Assistant' },
    { key: 'analysis',   label: 'Draft Analysis' },
  ];

  const tabBar = (
    <div className="flex items-center gap-1 border-b border-slate-700 pb-2">
      {TABS.map(t => (
        <button
          key={t.key}
          onClick={() => setActiveTab(t.key)}
          className={`px-4 py-1.5 text-sm font-medium rounded-t transition-colors ${
            activeTab === t.key
              ? 'bg-violet-600 text-white'
              : 'text-slate-400 hover:text-white hover:bg-slate-700'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );

  // ── Mock Draft tab ─────────────────────────────────────────────────────────
  if (activeTab === 'mock') {
    const { phase, settings, draftState, results, rankedPlayers, availablePlayers,
            allRosters, myRoster, currentPickInfo, isMyTurn, takenIds,
            myPickSlotsPreview, draftHistory,
            getAvailabilityAtNextPick,
            updateSettings, startMockDraft, makeMyPick, autoPickBest, undoLastPick, resetMock } = mock;

    return (
      <div className="space-y-4">
        {tabBar}
        {phase === 'idle' && (
          <MockDraftSetup
            settings={settings}
            updateSettings={updateSettings}
            onStart={startMockDraft}
            draftHistory={draftHistory}
            myPickSlots={myPickSlotsPreview}
            isLoading={!players?.length}
          />
        )}
        {phase === 'drafting' && (
          <MockDraftBoard
            draftState={draftState}
            phase={phase}
            settings={settings}
            availablePlayers={availablePlayers}
            allRosters={allRosters}
            myRoster={myRoster}
            currentPickInfo={currentPickInfo}
            isMyTurn={isMyTurn}
            takenIds={takenIds}
            rankedPlayers={rankedPlayers}
            getAvailabilityAtNextPick={getAvailabilityAtNextPick}
            onMakeMyPick={makeMyPick}
            onAutoPick={autoPickBest}
            onUndo={undoLastPick}
            onReset={resetMock}
          />
        )}
        {phase === 'complete' && (
          <MockDraftResults
            results={results}
            settings={settings}
            draftState={draftState}
            onPlayAgain={resetMock}
            onReset={resetMock}
          />
        )}
      </div>
    );
  }

  // ── Draft Assistant tab ────────────────────────────────────────────────────
  if (activeTab === 'assistant') {
    return (
      <div className="space-y-4">
        {tabBar}
        <DraftAssistantPlaceholder />
      </div>
    );
  }

  // ── Analysis tab ───────────────────────────────────────────────────────────
  if (activeTab === 'analysis') {
    return (
      <div className="space-y-4">
        {tabBar}
        <DraftAnalysisPanel
          leagueId={leagueId}
          players={players}
          scoringMode={scoringMode}
        />
      </div>
    );
  }

  // ── Cheat Sheet tab (default) ──────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {tabBar}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {POSITIONS.map(pos => (
          <button
            key={pos}
            onClick={() => setPositionFilter(pos)}
            className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${
              positionFilter === pos
                ? 'bg-violet-600 text-white'
                : 'bg-slate-700/50 text-slate-400 hover:text-white'
            }`}
          >
            {pos}
          </button>
        ))}
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search players…"
          className="flex-1 min-w-[160px] max-w-[260px] px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
        />
        <span className="text-xs text-slate-500 ml-auto">{displayPlayers.length} players</span>
      </div>

      {/* Column headers */}
      <div className="flex items-center gap-2 px-3 text-[10px] font-medium text-slate-500 uppercase tracking-wide border-b border-slate-800 pb-1">
        <span className="min-w-[28px]">RK</span>
        <span className="w-7" />
        <span className="flex-1">Player</span>
        <span className="hidden md:block w-20 text-right">Proj</span>
        <span className="hidden md:block w-16 text-right">VORP</span>
      </div>

      {/* Tier list */}
      {tierGroups.length > 0 ? tierGroups.map((group, i) => (
        <div key={group.tierNumber}>
          {/* Tier label */}
          <div className={`text-xs font-bold uppercase tracking-widest px-3 py-1.5 mt-2 ${getTierColor(group.tierNumber).text}`}>
            Tier {group.tierNumber} — {getTierLabel(group.tierNumber)}
          </div>
          {/* Players */}
          {group.players.map(player => (
            <button
              key={player.sleeper_id || player.id}
              onClick={() => onPlayerClick?.(player)}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-700/40 transition-colors text-left group"
            >
              <span className="text-slate-500 text-xs font-mono min-w-[28px]">{player.draftOverallRank}</span>
              <PlayerAvatar player={player} size="sm" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm text-white font-medium truncate group-hover:text-violet-300 transition-colors">
                    {player.web_name || player.name}
                  </span>
                  <span className={`px-1 py-0.5 rounded text-[10px] font-bold border ${getPositionBadgeStyle(player.position)}`}>
                    {player.draftPosition}
                  </span>
                </div>
                <span className="text-xs text-slate-500">
                  {TEAM_DISPLAY_NAMES[player.team_abbr] || player.team_abbr || player.team}
                </span>
              </div>
              <div className="hidden md:flex items-center gap-4 text-xs text-slate-400 flex-shrink-0">
                <div className="w-20 text-right">
                  <div className="text-slate-300 font-medium">{player.draftProjection?.toFixed(1)}</div>
                  <div className="text-[10px]">Proj</div>
                </div>
                <div className="w-16 text-right">
                  <div className="text-slate-300 font-medium">{player.draftVorp?.toFixed(1)}</div>
                  <div className="text-[10px]">VORP</div>
                </div>
              </div>
            </button>
          ))}
          {/* Tier break */}
          {i < tierGroups.length - 1 && (
            <div className="flex items-center gap-2 py-1 px-3 mt-1">
              <div className="flex-1 border-t border-orange-500/20" />
              <span className="text-[10px] text-orange-400/50">tier break</span>
              <div className="flex-1 border-t border-orange-500/20" />
            </div>
          )}
        </div>
      )) : (
        <div className="text-center py-12 text-slate-500">
          <p>No players found</p>
        </div>
      )}
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