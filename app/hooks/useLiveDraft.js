'use client';

/**
 * useLiveDraft — state machine for the real-time Draft Assistant.
 *
 * Phases:
 *   setup    → user fills in league ID + confirms their draft slot
 *   waiting  → draft found but status !== 'drafting'; polls every 30s
 *   live     → draft active; polls picks every 3s
 *   complete → draft finished; grades computed
 *
 * Resync:
 *   - Manual resync() re-fetches all picks from scratch
 *   - Auto-resync on tab focus (visibilitychange)
 *   - Out-of-sync detected when API pick count jumps by > 1 vs our last count
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { computeDraftRankings, getPickSuggestions } from '../services/draftRankingService';
import { getPlayerId } from '../utils/playerUtils';

const POLL_LIVE_MS    = 3000;   // 3s when drafting
const POLL_WAITING_MS = 30000;  // 30s waiting for draft to start

// ─── Helpers ────────────────────────────────────────────────────────────────

/** GET /api/live-draft?type=X&... */
async function liveDraftFetch(params) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`/api/live-draft?${qs}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

/**
 * Given a 1-indexed overall pick number and league size, return
 * { round (1-indexed), slot (1-indexed) } for a standard snake draft.
 */
function snakePickInfo(pickNo, leagueSize) {
  const round = Math.ceil(pickNo / leagueSize);
  const posInRound = ((pickNo - 1) % leagueSize) + 1; // 1…N
  const slot = round % 2 === 0 ? leagueSize - posInRound + 1 : posInRound;
  return { round, slot };
}

/**
 * Compute VORP efficiency grade for a roster.
 * optimalVorpPerPick is an array of the best available VORP at each pick slot.
 */
function gradeEfficiency(efficiency) {
  if (efficiency >= 0.93) return 'A+';
  if (efficiency >= 0.89) return 'A';
  if (efficiency >= 0.85) return 'B+';
  if (efficiency >= 0.80) return 'B';
  if (efficiency >= 0.75) return 'C+';
  if (efficiency >= 0.70) return 'C';
  return 'D';
}

/**
 * Compute post-draft grades for all managers.
 * Uses retroactive VORP-at-time-of-pick efficiency.
 *
 * @param {Array}  picks         - all draft picks in order [{pick_no, player_id, draft_slot, ...}]
 * @param {Object} playerVorpMap - { sleeperId: draftVorp }
 * @param {number} leagueSize
 * @param {Object} userMap       - { userId: { displayName } }
 * @param {Object} slotToUser    - { draftSlot: userId }
 */
function computeAllGrades(picks, playerVorpMap, leagueSize, userMap, slotToUser) {
  if (!picks?.length || !playerVorpMap) return {};

  // Reconstruct the pool at time of each pick — track taken player IDs
  const takenIds = new Set();
  // For each slot, accumulate: totalVorp, optimalVorp (best available at that moment), picksData
  const slotData = {};
  for (let slot = 1; slot <= leagueSize; slot++) {
    slotData[slot] = { totalVorp: 0, optimalVorp: 0, picks: [], positionCounts: { GKP: 0, DEF: 0, MID: 0, FWD: 0 } };
  }

  // Sorted picks by pick_no ascending
  const sorted = [...picks].sort((a, b) => a.pick_no - b.pick_no);
  const allPlayerIds = Object.keys(playerVorpMap);

  sorted.forEach(pick => {
    const slot = pick.draft_slot;
    const pid = pick.player_id;
    const vorp = playerVorpMap[pid] ?? 0;

    // Best available vorp at this moment
    const available = allPlayerIds.filter(id => !takenIds.has(id));
    const bestVorp = available.reduce((best, id) => Math.max(best, playerVorpMap[id] ?? 0), 0);

    if (slotData[slot]) {
      slotData[slot].totalVorp += vorp;
      slotData[slot].optimalVorp += bestVorp;
      slotData[slot].picks.push({ pid, vorp, bestVorp, playerName: pick.metadata?.first_name + ' ' + pick.metadata?.last_name });
      const pos = (pick.metadata?.position || '').toUpperCase();
      if (slotData[slot].positionCounts[pos] !== undefined) slotData[slot].positionCounts[pos]++;
    }

    takenIds.add(pid);
  });

  // Build grade map keyed by slot
  const grades = {};
  for (const [slot, data] of Object.entries(slotData)) {
    const slotNum = parseInt(slot, 10);
    const userId = slotToUser?.[slotNum];
    const displayName = (userId && userMap?.[userId]?.displayName) || `Team ${slot}`;
    const efficiency = data.optimalVorp > 0 ? data.totalVorp / data.optimalVorp : 0;
    const grade = gradeEfficiency(efficiency);

    // Best and worst individual picks
    const picksSorted = [...data.picks].sort((a, b) => (b.vorp - b.bestVorp) - (a.vorp - a.bestVorp));
    const bestPick = picksSorted[0] || null;
    const worstPick = picksSorted[picksSorted.length - 1] || null;

    grades[slotNum] = {
      slot: slotNum,
      userId,
      displayName,
      grade,
      efficiency,
      totalVorp: data.totalVorp,
      positionCounts: data.positionCounts,
      bestPick,
      worstPick,
    };
  }

  return grades;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useLiveDraft(players, scoringMode, leagueId, userId) {
  // ── phase & core data ──
  const [phase, setPhase]         = useState('setup');   // setup | waiting | live | complete
  const [draftMeta, setDraftMeta] = useState(null);      // Sleeper draft object
  const [picks, setPicks]         = useState([]);        // all picks so far
  const [userMap, setUserMap]     = useState({});        // userId → { displayName }
  const [mySlot, setMySlot]       = useState(null);      // confirmed draft slot (1-indexed)
  const [detectedSlot, setDetectedSlot] = useState(null);// auto-detected from draft_order

  // ── sync state ──
  const [syncStatus, setSyncStatus]   = useState('idle');  // idle | polling | synced | error | out_of_sync
  const [syncError, setSyncError]     = useState(null);
  const [lastSyncAt, setLastSyncAt]   = useState(null);
  const lastPickCountRef              = useRef(0);

  // ── setup form state ──
  const [setupLeagueId, setSetupLeagueId] = useState(leagueId || '');
  const [setupError, setSetupError]       = useState(null);
  const [setupLoading, setSetupLoading]   = useState(false);

  const pollTimerRef = useRef(null);

  // ── VORP rankings (computed once from players, reused throughout) ──
  const rankings = useMemo(() => {
    if (!players?.length) return null;
    return computeDraftRankings(players, scoringMode, 10);
  }, [players, scoringMode]);

  // Map sleeperId → draftVorp for grading
  const playerVorpMap = useMemo(() => {
    if (!rankings?.rankedPlayers) return {};
    const map = {};
    rankings.rankedPlayers.forEach(p => {
      const id = getPlayerId(p);
      if (id) map[String(id)] = p.draftVorp ?? 0;
    });
    return map;
  }, [rankings]);

  // ── Derived draft state ──────────────────────────────────────────────────

  const leagueSize = draftMeta?.settings?.teams || 10;
  const totalRounds = draftMeta?.settings?.rounds || 17;
  const totalPicks  = leagueSize * totalRounds;

  // Map: sleeperId string → pick object (for quick taken lookup)
  const takenIds = useMemo(() => {
    const set = new Set();
    picks.forEach(p => set.add(String(p.player_id)));
    return set;
  }, [picks]);

  // Map: draftSlot → array of player objects (for rosters panel)
  const allRosters = useMemo(() => {
    const rosters = {};
    for (let i = 1; i <= leagueSize; i++) rosters[i] = [];
    picks.forEach(pick => {
      const slot = pick.draft_slot;
      const player = rankings?.rankedPlayers?.find(p => String(getPlayerId(p)) === String(pick.player_id));
      if (player && rosters[slot]) {
        rosters[slot].push({ ...player, pickNo: pick.pick_no });
      }
    });
    return rosters;
  }, [picks, rankings, leagueSize]);

  const myRoster = useMemo(() => allRosters[mySlot] || [], [allRosters, mySlot]);

  const availablePlayers = useMemo(() => {
    if (!rankings?.rankedPlayers) return [];
    return rankings.rankedPlayers.filter(p => !takenIds.has(String(getPlayerId(p))));
  }, [rankings, takenIds]);

  // Current pick info
  const currentPickNo = picks.length + 1;
  const currentPickInfo = useMemo(() => {
    if (phase !== 'live' || currentPickNo > totalPicks) return null;
    const { round, slot } = snakePickInfo(currentPickNo, leagueSize);
    const userId = draftMeta?.slot_to_roster_id
      ? Object.entries(draftMeta.draft_order || {}).find(([uid, s]) => s === slot)?.[0]
      : null;
    return {
      pickNo: currentPickNo,
      round,
      slot,
      isMyTurn: slot === mySlot,
      displayName: (userId && userMap[userId]?.displayName) || `Team ${slot}`,
    };
  }, [phase, currentPickNo, totalPicks, leagueSize, mySlot, draftMeta, userMap]);

  const isMyTurn = currentPickInfo?.isMyTurn ?? false;

  // Pick suggestions (only meaningful on my turn)
  const suggestions = useMemo(() => {
    if (!isMyTurn) return [];
    return getPickSuggestions(availablePlayers, myRoster, scoringMode, leagueSize, 3);
  }, [isMyTurn, availablePlayers, myRoster, scoringMode, leagueSize]);

  // Post-draft grades (computed when complete)
  const managerGrades = useMemo(() => {
    if (phase !== 'complete') return null;
    // Build slotToUser from draft_order: { userId: slot } → invert to { slot: userId }
    const slotToUser = {};
    if (draftMeta?.draft_order) {
      Object.entries(draftMeta.draft_order).forEach(([uid, slot]) => {
        slotToUser[slot] = uid;
      });
    }
    return computeAllGrades(picks, playerVorpMap, leagueSize, userMap, slotToUser);
  }, [phase, picks, playerVorpMap, leagueSize, userMap, draftMeta]);

  // ── Polling ──────────────────────────────────────────────────────────────

  const fetchPicks = useCallback(async (isResync = false) => {
    if (!draftMeta?.draft_id) return;
    setSyncStatus('polling');
    try {
      const fresh = await liveDraftFetch({ type: 'picks', draftId: draftMeta.draft_id });
      const newPicks = Array.isArray(fresh) ? fresh : [];

      // Out-of-sync detection: if API pick count jumped by more than 1 since last poll
      const prevCount = lastPickCountRef.current;
      if (!isResync && prevCount > 0 && newPicks.length > prevCount + 1) {
        setSyncStatus('out_of_sync');
      } else {
        setSyncStatus('synced');
      }

      lastPickCountRef.current = newPicks.length;
      setPicks(newPicks);
      setLastSyncAt(Date.now());
      setSyncError(null);

      // Check if draft completed
      if (newPicks.length >= totalPicks) {
        setPhase('complete');
        stopPolling();
        return;
      }

      // Re-check draft status if we're in waiting phase
      if (phase === 'waiting') {
        const meta = await liveDraftFetch({ type: 'draft', draftId: draftMeta.draft_id });
        if (meta?.status === 'drafting') {
          setDraftMeta(meta);
          setPhase('live');
        }
      }
    } catch (err) {
      setSyncStatus('error');
      setSyncError(err.message);
    }
  }, [draftMeta, totalPicks, phase]);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const startPolling = useCallback((intervalMs) => {
    stopPolling();
    pollTimerRef.current = setInterval(() => fetchPicks(), intervalMs);
  }, [stopPolling, fetchPicks]);

  // Start/adjust polling when phase changes
  useEffect(() => {
    if (phase === 'live') {
      fetchPicks();
      startPolling(POLL_LIVE_MS);
    } else if (phase === 'waiting') {
      fetchPicks();
      startPolling(POLL_WAITING_MS);
    } else {
      stopPolling();
    }
    return stopPolling;
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-resync on tab focus
  useEffect(() => {
    const handleVisibility = () => {
      if (!document.hidden && (phase === 'live' || phase === 'waiting')) {
        fetchPicks(true); // isResync = true — suppress out-of-sync warning
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [phase, fetchPicks]);

  // Cleanup on unmount
  useEffect(() => () => stopPolling(), [stopPolling]);

  // ── Setup actions ────────────────────────────────────────────────────────

  /** Fetch the draft for a given league ID and populate setup state. */
  const fetchDraftForLeague = useCallback(async (lid) => {
    setSetupLoading(true);
    setSetupError(null);
    try {
      const [drafts, users] = await Promise.all([
        liveDraftFetch({ type: 'drafts', leagueId: lid }),
        liveDraftFetch({ type: 'users', leagueId: lid }),
      ]);

      if (!Array.isArray(drafts) || drafts.length === 0) {
        setSetupError('No draft found for this league. Check the league ID or try again closer to draft day.');
        return;
      }

      // Use the most recent / upcoming draft (prefer 'pre_draft' or 'drafting' status)
      const draft = drafts.find(d => d.status === 'drafting' || d.status === 'pre_draft') || drafts[0];

      setDraftMeta(draft);
      setUserMap(users || {});

      // Auto-detect user's draft slot from draft_order: { userId: slot }
      if (draft.draft_order && userId) {
        const slot = draft.draft_order[userId];
        if (slot) setDetectedSlot(slot);
      }
    } catch (err) {
      setSetupError(err.message);
    } finally {
      setSetupLoading(false);
    }
  }, [userId]);

  /** User confirms their slot and moves to waiting/live phase. */
  const confirmAndStart = useCallback((confirmedSlot) => {
    setMySlot(confirmedSlot);
    lastPickCountRef.current = 0;
    const status = draftMeta?.status;
    if (status === 'drafting') {
      setPhase('live');
    } else {
      setPhase('waiting');
    }
  }, [draftMeta]);

  /** Manual resync — re-fetches all picks, clears out-of-sync flag. */
  const resync = useCallback(() => {
    lastPickCountRef.current = 0;
    fetchPicks(true);
  }, [fetchPicks]);

  /** Return to setup screen. */
  const reset = useCallback(() => {
    stopPolling();
    setPhase('setup');
    setDraftMeta(null);
    setPicks([]);
    setMySlot(null);
    setDetectedSlot(null);
    setUserMap({});
    setSyncStatus('idle');
    setSyncError(null);
    setLastSyncAt(null);
    setSetupError(null);
    lastPickCountRef.current = 0;
  }, [stopPolling]);

  return {
    // Phase
    phase,

    // Setup
    setupLeagueId, setSetupLeagueId,
    setupError, setupLoading,
    fetchDraftForLeague,
    draftMeta,
    detectedSlot,
    confirmAndStart,

    // Live draft data
    picks,
    mySlot,
    myRoster,
    allRosters,
    availablePlayers,
    rankings,
    currentPickInfo,
    isMyTurn,
    takenIds,
    suggestions,
    leagueSize,
    totalPicks,
    userMap,

    // Sync
    syncStatus,
    syncError,
    lastSyncAt,
    resync,

    // Post-draft
    managerGrades,

    // Actions
    reset,
  };
}
