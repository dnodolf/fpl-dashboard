'use client';

/**
 * useMockDraft — state management for the mock draft simulator.
 *
 * Completely separate from useDraftBoard. Different localStorage keys.
 * Does not touch cheat sheet state.
 *
 * Phases: 'idle' → 'drafting' → 'complete'
 */

import { useState, useCallback, useMemo, useRef } from 'react';
import { computeDraftRankings } from '../services/draftRankingService';
import {
  generatePickOrder,
  getMyPickSlots,
  assignArchetypes,
  getAiPick,
  computeAvailabilityProbs,
  gradeDraft,
  rankTeams,
  ARCHETYPES,
} from '../services/mockDraftAiService';

const STORAGE_KEY_ACTIVE  = 'fpl_mock_draft_active';
const STORAGE_KEY_HISTORY = 'fpl_mock_draft_history';
const MAX_HISTORY = 3;

function loadFromStorage(key, defaultValue) {
  if (typeof window === 'undefined') return defaultValue;
  try {
    const s = localStorage.getItem(key);
    return s ? JSON.parse(s) : defaultValue;
  } catch { return defaultValue; }
}

function saveToStorage(key, value) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

export const DEFAULT_SETTINGS = {
  leagueSize: 10,
  myDraftPosition: 5,   // 1-indexed
  scoringMode: 'v3',
  speed: 'fast',        // 'instant' | 'fast' | 'slow'
  difficulty: 'balanced',
};

/**
 * @param {Array}  players      - all players from integrated-players API
 * @param {string} scoringMode  - active scoring mode from parent (default for settings)
 */
export function useMockDraft(players, scoringMode = 'v3') {
  const [phase, setPhase] = useState('idle');
  const [settings, setSettings] = useState(() => ({
    ...DEFAULT_SETTINGS,
    scoringMode,
  }));

  // Core draft state — stored together so we update atomically
  const [draftState, setDraftState] = useState(null);
  /*
    draftState shape:
    {
      pickOrder: [...],
      archetypes: { [teamIndex]: key },
      myTeamIndex: N,
      currentPickIndex: 0,
      picks: [{ overall, round, teamIndex, player, isMyPick }],
      availabilityProbs: { [sleeperId]: [prob, ...] },
      snapshots: [{ currentPickIndex, picks }],  // captured at each of MY turns
    }
  */

  // Results (set when draft completes)
  const [results, setResults] = useState(null);

  // Speed-control interval ref
  const aiIntervalRef = useRef(null);

  // ── Derived VORP rankings (recomputed when players or scoringMode changes) ──
  const rankings = useMemo(() => {
    if (!players?.length) return { rankedPlayers: [] };
    return computeDraftRankings(players, settings.scoringMode, settings.leagueSize);
  }, [players, settings.scoringMode, settings.leagueSize]);

  const rankedPlayers = rankings.rankedPlayers || [];

  // ── Computed: taken player IDs from current picks ──────────────────────────
  const takenIds = useMemo(() => {
    if (!draftState) return new Set();
    return new Set(draftState.picks.map(p => p.player.sleeper_id || p.player.id));
  }, [draftState]);

  // ── Available players (not yet taken) ─────────────────────────────────────
  const availablePlayers = useMemo(() => {
    return rankedPlayers.filter(p => !takenIds.has(p.sleeper_id || p.id));
  }, [rankedPlayers, takenIds]);

  // ── All team rosters derived from picks ───────────────────────────────────
  const allRosters = useMemo(() => {
    if (!draftState) return {};
    const rosters = {};
    draftState.picks.forEach(({ teamIndex, player }) => {
      if (!rosters[teamIndex]) rosters[teamIndex] = [];
      rosters[teamIndex].push(player);
    });
    return rosters;
  }, [draftState]);

  // ── My roster ─────────────────────────────────────────────────────────────
  const myRoster = useMemo(() => {
    if (!draftState) return [];
    return draftState.picks
      .filter(p => p.isMyPick)
      .map(p => p.player);
  }, [draftState]);

  // ── Current pick info ─────────────────────────────────────────────────────
  const currentPickInfo = useMemo(() => {
    if (!draftState || phase !== 'drafting') return null;
    const { pickOrder, currentPickIndex } = draftState;
    if (currentPickIndex >= pickOrder.length) return null;
    return pickOrder[currentPickIndex];
  }, [draftState, phase]);

  const isMyTurn = useMemo(() => {
    if (!currentPickInfo || !draftState) return false;
    return currentPickInfo.teamIndex === draftState.myTeamIndex;
  }, [currentPickInfo, draftState]);

  // ── Availability percentage for a player at my NEXT pick ─────────────────
  const getAvailabilityAtNextPick = useCallback((sleeperId) => {
    if (!draftState?.availabilityProbs) return null;
    const probs = draftState.availabilityProbs[sleeperId];
    if (!probs) return null;

    // Find which of my picks comes next
    const myPickSlots = getMyPickSlots(draftState.pickOrder, draftState.myTeamIndex);
    const nextMyPick = myPickSlots.find(slot => slot > (currentPickInfo?.overall || 0));
    if (!nextMyPick) return null;

    // The probability array index corresponds to my pick order (0 = first pick, 1 = second...)
    const myPickIdx = myPickSlots.indexOf(nextMyPick);
    return probs[myPickIdx] ?? null;
  }, [draftState, currentPickInfo]);

  // ─── Actions ───────────────────────────────────────────────────────────────

  const updateSettings = useCallback((updates) => {
    setSettings(prev => ({ ...prev, ...updates }));
  }, []);

  /**
   * Start a new mock draft.
   */
  const startMockDraft = useCallback(() => {
    if (!rankedPlayers.length) return;

    const { leagueSize, difficulty } = settings;
    const resolvedPosition = settings.myDraftPosition === 'random'
      ? Math.floor(Math.random() * leagueSize) + 1
      : settings.myDraftPosition;
    const myTeamIndex = resolvedPosition - 1; // convert to 0-indexed

    const pickOrder = generatePickOrder(leagueSize, 17);
    const archetypes = assignArchetypes(leagueSize, myTeamIndex);

    // Pre-compute availability probabilities
    const availabilityProbs = computeAvailabilityProbs(
      rankedPlayers, pickOrder, archetypes, myTeamIndex, 300
    );

    const initialState = {
      pickOrder,
      archetypes,
      myTeamIndex,
      currentPickIndex: 0,
      picks: [],
      availabilityProbs,
      snapshots: [],
    };

    setDraftState(initialState);
    setResults(null);
    setPhase('drafting');

    // If first pick belongs to an AI team, advance automatically
    if (pickOrder[0]?.teamIndex !== myTeamIndex) {
      // Schedule AI advancement after state settles
      setTimeout(() => _advanceAiPicks(initialState, rankedPlayers, settings), 0);
    }
  }, [rankedPlayers, settings]);

  /**
   * Advance all consecutive AI picks until it's the user's turn (or draft ends).
   * Internal function called after each user pick or at draft start.
   */
  const _advanceAiPicks = useCallback((currentState, ranked, currentSettings) => {
    const { pickOrder, archetypes, myTeamIndex, currentPickIndex, picks } = currentState;
    const { speed, difficulty } = currentSettings;
    const totalRounds = 17;

    if (speed === 'instant') {
      // Run all AI picks synchronously until my turn
      let idx = currentPickIndex;
      const newPicks = [...picks];
      const taken = new Set(newPicks.map(p => p.player.sleeper_id || p.player.id));

      while (idx < pickOrder.length) {
        const pick = pickOrder[idx];
        if (pick.teamIndex === myTeamIndex) break; // stop at my turn

        // Build available array
        const avail = ranked.filter(p => !taken.has(p.sleeper_id || p.id));
        if (!avail.length) { idx++; continue; }

        // Build this team's roster
        const teamRoster = newPicks
          .filter(p => p.teamIndex === pick.teamIndex)
          .map(p => p.player);

        const chosen = getAiPick(
          avail, teamRoster,
          archetypes[pick.teamIndex] || 'balancedBuilder',
          pick.round, totalRounds, difficulty
        );

        if (chosen) {
          taken.add(chosen.sleeper_id || chosen.id);
          newPicks.push({ ...pick, player: chosen, isMyPick: false });
        }
        idx++;
      }

      // Check if draft is complete
      const isDone = idx >= pickOrder.length;

      setDraftState(prev => {
        if (!prev) return prev;
        const next = { ...prev, currentPickIndex: idx, picks: newPicks };

        if (isDone) {
          // Trigger completion after state update
          setTimeout(() => _completeDraft(next, ranked), 0);
        }

        return next;
      });

    } else {
      // Animated mode: advance one AI pick at a time
      const delay = speed === 'slow' ? 350 : 80;

      if (aiIntervalRef.current) clearInterval(aiIntervalRef.current);

      aiIntervalRef.current = setInterval(() => {
        setDraftState(prev => {
          if (!prev) { clearInterval(aiIntervalRef.current); return prev; }

          const { currentPickIndex: idx, picks, pickOrder: order } = prev;

          if (idx >= order.length) {
            clearInterval(aiIntervalRef.current);
            _completeDraft(prev, ranked);
            return prev;
          }

          const pick = order[idx];
          if (pick.teamIndex === myTeamIndex) {
            // My turn — stop advancing
            clearInterval(aiIntervalRef.current);
            return prev;
          }

          const taken = new Set(picks.map(p => p.player.sleeper_id || p.player.id));
          const avail = ranked.filter(p => !taken.has(p.sleeper_id || p.id));
          const teamRoster = picks.filter(p => p.teamIndex === pick.teamIndex).map(p => p.player);

          const chosen = getAiPick(
            avail, teamRoster,
            archetypes[pick.teamIndex] || 'balancedBuilder',
            pick.round, totalRounds, difficulty
          );

          const newPicks = chosen
            ? [...picks, { ...pick, player: chosen, isMyPick: false }]
            : picks;

          const nextIdx = idx + 1;
          const next = { ...prev, currentPickIndex: nextIdx, picks: newPicks };

          // Check if next pick is mine or draft is over
          if (nextIdx >= order.length) {
            clearInterval(aiIntervalRef.current);
            setTimeout(() => _completeDraft(next, ranked), 0);
          } else if (order[nextIdx].teamIndex === myTeamIndex) {
            clearInterval(aiIntervalRef.current);
          }

          return next;
        });
      }, delay);
    }
  }, []);

  /**
   * User makes a pick.
   */
  const makeMyPick = useCallback((player) => {
    if (!isMyTurn || !draftState) return;

    setDraftState(prev => {
      if (!prev) return prev;
      const { currentPickIndex, picks, pickOrder, snapshots } = prev;
      const pick = pickOrder[currentPickIndex];

      const newPick = { ...pick, player, isMyPick: true };
      const newPicks = [...picks, newPick];
      const nextIdx = currentPickIndex + 1;

      // Snapshot this moment for undo
      const snapshot = { currentPickIndex, picks: [...picks] };
      const newSnapshots = [...snapshots, snapshot];

      const next = {
        ...prev,
        currentPickIndex: nextIdx,
        picks: newPicks,
        snapshots: newSnapshots,
      };

      // Advance AI picks after my pick
      setTimeout(() => _advanceAiPicks(next, rankedPlayers, settings), 0);

      return next;
    });
  }, [isMyTurn, draftState, rankedPlayers, settings, _advanceAiPicks]);

  /**
   * Auto pick: use the top available player by VORP (same as top suggestion).
   */
  const autoPickBest = useCallback(() => {
    if (!isMyTurn || !availablePlayers.length) return;
    makeMyPick(availablePlayers[0]);
  }, [isMyTurn, availablePlayers, makeMyPick]);

  /**
   * Undo the last user pick — restore to snapshot.
   */
  const undoLastPick = useCallback(() => {
    if (!draftState?.snapshots?.length) return;
    if (aiIntervalRef.current) clearInterval(aiIntervalRef.current);

    setDraftState(prev => {
      if (!prev?.snapshots?.length) return prev;
      const snapshots = [...prev.snapshots];
      const last = snapshots.pop();
      return {
        ...prev,
        currentPickIndex: last.currentPickIndex,
        picks: last.picks,
        snapshots,
      };
    });
    setPhase('drafting');
    setResults(null);
  }, [draftState]);

  /**
   * Complete the draft — compute results.
   */
  const _completeDraft = useCallback((finalState, ranked) => {
    const { picks, archetypes: archs, myTeamIndex: myIdx } = finalState;

    const myPicks = picks.filter(p => p.isMyPick);
    const grade = gradeDraft(myPicks, picks, ranked);
    const teamRanking = rankTeams(picks, myIdx, archs);
    const myRank = teamRanking.findIndex(t => t.isMe) + 1;

    const newResults = {
      myRoster: myPicks.map(p => p.player),
      draftGrade: grade,
      teamRanking,
      myRank,
      archetypes: archs,
      archetypeNames: Object.fromEntries(
        Object.entries(archs).map(([ti, key]) => [ti, ARCHETYPES[key]?.name || key])
      ),
    };

    setResults(newResults);
    setPhase('complete');

    // Persist summary to history
    const history = loadFromStorage(STORAGE_KEY_HISTORY, []);
    const summary = {
      id: Date.now(),
      date: new Date().toISOString(),
      settings,
      grade: grade.letter,
      efficiency: grade.efficiency,
      myRank,
      totalVorp: grade.totalMyVorp,
      leagueSize: settings.leagueSize,
    };
    const newHistory = [summary, ...history].slice(0, MAX_HISTORY);
    saveToStorage(STORAGE_KEY_HISTORY, newHistory);
  }, [settings]);

  /**
   * Reset everything back to idle (keep settings).
   */
  const resetMock = useCallback(() => {
    if (aiIntervalRef.current) clearInterval(aiIntervalRef.current);
    setPhase('idle');
    setDraftState(null);
    setResults(null);
  }, []);

  // ── Draft history ──────────────────────────────────────────────────────────
  const draftHistory = useMemo(() => loadFromStorage(STORAGE_KEY_HISTORY, []), [phase]);

  // ── My pick slots preview (for setup screen) ──────────────────────────────
  const myPickSlotsPreview = useMemo(() => {
    const { leagueSize, myDraftPosition } = settings;
    if (myDraftPosition === 'random') return []; // no preview for random
    const myTeamIndex = myDraftPosition - 1;
    const order = generatePickOrder(leagueSize, 17);
    return getMyPickSlots(order, myTeamIndex);
  }, [settings.leagueSize, settings.myDraftPosition]);

  return {
    // State
    phase,
    settings,
    draftState,
    results,
    rankings,

    // Derived
    rankedPlayers,
    availablePlayers,
    allRosters,
    myRoster,
    currentPickInfo,
    isMyTurn,
    takenIds,
    myPickSlotsPreview,
    draftHistory,

    // Helpers
    getAvailabilityAtNextPick,

    // Actions
    updateSettings,
    startMockDraft,
    makeMyPick,
    autoPickBest,
    undoLastPick,
    resetMock,
  };
}
