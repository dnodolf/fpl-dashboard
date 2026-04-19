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

const POS_PANEL_STYLE = {
  GKP: { badge: 'bg-yellow-600/20 border-yellow-500/40 text-yellow-300', header: 'bg-yellow-900/20 border-yellow-700/30', label: 'Goalkeepers' },
  DEF: { badge: 'bg-green-600/20 border-green-500/40 text-green-300',   header: 'bg-green-900/20 border-green-700/30',   label: 'Defenders'   },
  MID: { badge: 'bg-blue-600/20 border-blue-500/40 text-blue-300',      header: 'bg-blue-900/20 border-blue-700/30',      label: 'Midfielders' },
  FWD: { badge: 'bg-red-600/20 border-red-500/40 text-red-300',         header: 'bg-red-900/20 border-red-700/30',         label: 'Forwards'    },
};

// ─── Main DraftTabContent ───────────────────────────────────────────────────
export default function DraftTabContent({ players, currentGameweek, scoringMode, onPlayerClick, userId, leagueId }) {
  // Top-level tab: 'cheatsheet' | 'mock' | 'assistant' | 'analysis'
  const [activeTab, setActiveTab] = useState('cheatsheet');

  // Cheat sheet view toggle: 'overall' | 'byPosition'
  const [tierView, setTierView] = useState('overall');

  // Mock draft hook
  const mock = useMockDraft(players, scoringMode);

  const {
    rankings,
    displayPlayers,
    positionFilter,
    setPositionFilter,
    searchQuery,
    setSearchQuery,
  } = useDraftBoard(players, scoringMode);

  // Overall tier groups (respects position filter + search via displayPlayers)
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

  // Per-position tier groups — independent tier model for each position
  const positionTierGroups = useMemo(() => {
    const posTiers = rankings?.positionTiers;
    if (!posTiers) return {};

    const result = {};
    for (const pos of ['GKP', 'DEF', 'MID', 'FWD']) {
      const data = posTiers[pos];
      if (!data?.tiers) continue;

      const filteredTiers = {};
      for (const [tier, players] of Object.entries(data.tiers)) {
        let list = [...players];
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          list = list.filter(p =>
            (p.name || '').toLowerCase().includes(q) ||
            (p.full_name || '').toLowerCase().includes(q) ||
            (p.team || '').toLowerCase().includes(q) ||
            (p.team_abbr || '').toLowerCase().includes(q)
          );
        }
        if (list.length > 0) filteredTiers[tier] = list;
      }

      result[pos] = Object.entries(filteredTiers)
        .map(([tier, players]) => ({ tierNumber: parseInt(tier), players }))
        .sort((a, b) => a.tierNumber - b.tierNumber);
    }
    return result;
  }, [rankings?.positionTiers, searchQuery]);

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

      {/* Filters + view toggle */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Position filter buttons — only in overall view */}
        {tierView === 'overall' && POSITIONS.map(pos => (
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
        {/* Overall / By Position toggle */}
        <div className="flex items-center gap-0.5 ml-auto bg-slate-800 rounded border border-slate-700 p-0.5 flex-shrink-0">
          <button
            onClick={() => setTierView('overall')}
            className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
              tierView === 'overall' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Overall
          </button>
          <button
            onClick={() => setTierView('byPosition')}
            className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
              tierView === 'byPosition' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            By Position
          </button>
        </div>
      </div>

      {/* ── Overall view ──────────────────────────────────────────────────── */}
      {tierView === 'overall' && (
        <>
          <div className="flex items-center gap-2 px-3 text-[10px] font-medium text-slate-500 uppercase tracking-wide border-b border-slate-800 pb-1">
            <span className="min-w-[28px]">RK</span>
            <span className="w-7" />
            <span className="flex-1">Player</span>
            <span className="hidden md:block w-20 text-right">Proj</span>
            <span className="hidden md:block w-16 text-right">VORP</span>
          </div>

          {tierGroups.length > 0 ? tierGroups.map((group, i) => (
            <div key={group.tierNumber}>
              <div className={`text-xs font-bold uppercase tracking-widest px-3 py-1.5 mt-2 ${getTierColor(group.tierNumber).text}`}>
                Tier {group.tierNumber} — {getTierLabel(group.tierNumber)}
              </div>
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
              {i < tierGroups.length - 1 && (
                <div className="flex items-center gap-2 py-1 px-3 mt-1">
                  <div className="flex-1 border-t border-orange-500/20" />
                  <span className="text-[10px] text-orange-400/50">tier break</span>
                  <div className="flex-1 border-t border-orange-500/20" />
                </div>
              )}
            </div>
          )) : (
            <div className="text-center py-12 text-slate-500">No players found</div>
          )}
        </>
      )}

      {/* ── By Position view — 4 columns ──────────────────────────────────── */}
      {tierView === 'byPosition' && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {['GKP', 'DEF', 'MID', 'FWD'].map(pos => {
            const style = POS_PANEL_STYLE[pos];
            const groups = positionTierGroups[pos] || [];
            const totalPlayers = groups.reduce((n, g) => n + g.players.length, 0);
            let posRank = 0;
            return (
              <div key={pos} className="flex flex-col border border-slate-700/60 rounded-lg overflow-hidden">
                {/* Position header */}
                <div className={`flex items-center gap-2 px-3 py-2 border-b border-slate-700/50 ${style.header}`}>
                  <span className={`px-2 py-0.5 rounded text-xs font-bold border ${style.badge}`}>{pos}</span>
                  <span className="text-sm font-semibold text-white">{style.label}</span>
                  <span className="text-xs text-slate-500 ml-auto">{totalPlayers}</span>
                </div>
                {/* Column headers */}
                <div className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-slate-500 uppercase tracking-wide border-b border-slate-800 bg-slate-900/40">
                  <span className="min-w-[18px]">RK</span>
                  <span className="w-6 flex-shrink-0" />
                  <span className="flex-1">Player</span>
                  <span className="w-8 text-right">Proj</span>
                  <span className="w-8 text-right">VORP</span>
                </div>
                {/* Tier groups */}
                {groups.length > 0 ? groups.map((group, i) => (
                  <div key={group.tierNumber}>
                    <div className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 bg-slate-800/60 ${getTierColor(group.tierNumber).text}`}>
                      T{group.tierNumber} — {getTierLabel(group.tierNumber)}
                    </div>
                    {group.players.map(player => {
                      posRank++;
                      const rank = posRank;
                      return (
                        <button
                          key={player.sleeper_id || player.id}
                          onClick={() => onPlayerClick?.(player)}
                          className="w-full flex items-center gap-1 px-2 py-1.5 hover:bg-slate-700/40 transition-colors text-left group"
                        >
                          <span className="text-slate-500 text-[10px] font-mono min-w-[18px]">{rank}</span>
                          <PlayerAvatar player={player} size="sm" />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs text-white font-medium truncate group-hover:text-violet-300 transition-colors">
                              {player.web_name || player.name}
                            </div>
                            <div className="text-[9px] text-slate-500 truncate">
                              {player.team_abbr || player.team}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 text-[10px] text-slate-400 flex-shrink-0">
                            <div className="w-8 text-right">
                              <div className="text-slate-300 font-medium">{player.draftProjection?.toFixed(0)}</div>
                            </div>
                            <div className="w-8 text-right">
                              <div className="text-slate-400">{player.draftVorp?.toFixed(0)}</div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                    {i < groups.length - 1 && (
                      <div className="flex items-center gap-1 px-2 py-0.5">
                        <div className="flex-1 border-t border-orange-500/20" />
                        <span className="text-[9px] text-orange-400/40">tier break</span>
                        <div className="flex-1 border-t border-orange-500/20" />
                      </div>
                    )}
                  </div>
                )) : (
                  <div className="py-8 text-center text-xs text-slate-600">No players</div>
                )}
              </div>
            );
          })}
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
