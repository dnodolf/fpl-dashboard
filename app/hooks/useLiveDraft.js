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
 * Demo/Replay mode (isDemoMode = true):
 *   Polling is disabled. Historical picks are fed one at a time via
 *   advanceDemoPick() or auto-play at a chosen speed.
 *   Activated via startDemo(historicalData, slot).
 *
 * Resync (live mode only):
 *   - Manual resync() re-fetches all picks from scratch
 *   - Auto-resync on tab focus (visibilitychange)
 *   - Out-of-sync detected when API pick count jumps by > 1
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { computeDraftRankings, getPickSuggestions } from '../services/draftRankingService';
import { getPlayerId } from '../utils/playerUtils';

const POLL_LIVE_MS    = 3000;
const POLL_WAITING_MS = 30000;
const DEMO_SPEED_MS   = { manual: null, slow: 1500, fast: 400 };

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function liveDraftFetch(params) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`/api/live-draft?${qs}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

function snakePickInfo(pickNo, leagueSize) {
  const round = Math.ceil(pickNo / leagueSize);
  const posInRound = ((pickNo - 1) % leagueSize) + 1;
  const slot = round % 2 === 0 ? leagueSize - posInRound + 1 : posInRound;
  return { round, slot };
}

function gradeEfficiency(efficiency) {
  if (efficiency >= 0.93) return 'A+';
  if (efficiency >= 0.89) return 'A';
  if (efficiency >= 0.85) return 'B+';
  if (efficiency >= 0.80) return 'B';
  if (efficiency >= 0.75) return 'C+';
  if (efficiency >= 0.70) return 'C';
  return 'D';
}

function computeAllGrades(picks, playerVorpMap, leagueSize, userMap, slotToUser) {
  if (!picks?.length || !playerVorpMap) return {};

  const takenIds = new Set();
  const slotData = {};
  for (let slot = 1; slot <= leagueSize; slot++) {
    slotData[slot] = { totalVorp: 0, optimalVorp: 0, picks: [], positionCounts: { GKP: 0, DEF: 0, MID: 0, FWD: 0 } };
  }

  const allPlayerIds = Object.keys(playerVorpMap);
  const sorted = [...picks].sort((a, b) => a.pick_no - b.pick_no);

  sorted.forEach(pick => {
    const slot = pick.draft_slot;
    const pid = String(pick.player_id);
    const vorp = playerVorpMap[pid] ?? 0;
    const available = allPlayerIds.filter(id => !takenIds.has(id));
    const bestVorp = available.reduce((best, id) => Math.max(best, playerVorpMap[id] ?? 0), 0);

    if (slotData[slot]) {
      slotData[slot].totalVorp += vorp;
      slotData[slot].optimalVorp += bestVorp;
      const playerName = [pick.metadata?.first_name, pick.metadata?.last_name].filter(Boolean).join(' ') || `Player ${pid}`;
      slotData[slot].picks.push({ pid, vorp, bestVorp, playerName });
      const pos = (pick.metadata?.position || '').toUpperCase();
      if (slotData[slot].positionCounts[pos] !== undefined) slotData[slot].positionCounts[pos]++;
    }
    takenIds.add(pid);
  });

  const grades = {};
  for (const [slot, data] of Object.entries(slotData)) {
    const slotNum = parseInt(slot, 10);
    const uid = slotToUser?.[slotNum];
    const displayName = (uid && userMap?.[uid]?.displayName) || `Team ${slot}`;
    const efficiency = data.optimalVorp > 0 ? data.totalVorp / data.optimalVorp : 0;
    const grade = gradeEfficiency(efficiency);
    const picksSorted = [...data.picks].sort((a, b) => (b.vorp - b.bestVorp) - (a.vorp - a.bestVorp));
    grades[slotNum] = {
      slot: slotNum, userId: uid, displayName, grade, efficiency,
      totalVorp: data.totalVorp, positionCounts: data.positionCounts,
      bestPick: picksSorted[0] || null,
      worstPick: picksSorted[picksSorted.length - 1] || null,
    };
  }
  return grades;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useLiveDraft(players, scoringMode, leagueId, userId) {
  // ── phase & core data ──
  const [phase, setPhase]         = useState('setup');
  const [draftMeta, setDraftMeta] = useState(null);
  const [picks, setPicks]         = useState([]);
  const [userMap, setUserMap]     = useState({});
  const [mySlot, setMySlot]       = useState(null);
  const [detectedSlot, setDetectedSlot] = useState(null);

  // ── sync state (live mode) ──
  const [syncStatus, setSyncStatus] = useState('idle');
  const [syncError, setSyncError]   = useState(null);
  const [lastSyncAt, setLastSyncAt] = useState(null);
  const lastPickCountRef            = useRef(0);

  // ── demo/replay state ──
  const [isDemoMode, setIsDemoMode]       = useState(false);
  const [demoAllPicks, setDemoAllPicks]   = useState([]);   // full historical pick array
  const [demoPickIndex, setDemoPickIndex] = useState(0);    // how many picks revealed so far
  const [demoSpeed, setDemoSpeed]         = useState('manual'); // 'manual' | 'slow' | 'fast'
  const [demoPlaying, setDemoPlaying]     = useState(false);
  const demoTimerRef                      = useRef(null);

  // ── setup form state ──
  const [setupLeagueId, setSetupLeagueId] = useState(leagueId || '');
  const [setupError, setSetupError]       = useState(null);
  const [setupLoading, setSetupLoading]   = useState(false);
  const [demoLoading, setDemoLoading]     = useState(false);

  const pollTimerRef = useRef(null);

  // ── VORP rankings ──────────────────────────────────────────────────────────
  const rankings = useMemo(() => {
    if (!players?.length) return null;
    return computeDraftRankings(players, scoringMode, 10);
  }, [players, scoringMode]);

  const playerVorpMap = useMemo(() => {
    if (!rankings?.rankedPlayers) return {};
    const map = {};
    rankings.rankedPlayers.forEach(p => {
      const id = getPlayerId(p);
      if (id) map[String(id)] = p.draftVorp ?? 0;
    });
    return map;
  }, [rankings]);

  // ── Derived draft state ───────────────────────────────────────────────────
  const leagueSize  = draftMeta?.settings?.teams  || 10;
  const totalRounds = draftMeta?.settings?.rounds || 17;
  const totalPicks  = leagueSize * totalRounds;

  // In demo mode the visible picks are a slice of demoAllPicks
  const visiblePicks = isDemoMode
    ? demoAllPicks.slice(0, demoPickIndex)
    : picks;

  const takenIds = useMemo(() => {
    const set = new Set();
    visiblePicks.forEach(p => set.add(String(p.player_id)));
    return set;
  }, [visiblePicks]);

  const allRosters = useMemo(() => {
    const rosters = {};
    for (let i = 1; i <= leagueSize; i++) rosters[i] = [];
    visiblePicks.forEach(pick => {
      const slot = pick.draft_slot;
      const player = rankings?.rankedPlayers?.find(p => String(getPlayerId(p)) === String(pick.player_id));
      if (player && rosters[slot]) rosters[slot].push({ ...player, pickNo: pick.pick_no });
    });
    return rosters;
  }, [visiblePicks, rankings, leagueSize]);

  const myRoster = useMemo(() => allRosters[mySlot] || [], [allRosters, mySlot]);

  const availablePlayers = useMemo(() => {
    if (!rankings?.rankedPlayers) return [];
    return rankings.rankedPlayers.filter(p => !takenIds.has(String(getPlayerId(p))));
  }, [rankings, takenIds]);

  const currentPickNo = visiblePicks.length + 1;
  const currentPickInfo = useMemo(() => {
    if (phase !== 'live' || currentPickNo > totalPicks) return null;
    const { round, slot } = snakePickInfo(currentPickNo, leagueSize);
    const uid = Object.entries(draftMeta?.draft_order || {}).find(([, s]) => s === slot)?.[0];
    return {
      pickNo: currentPickNo,
      round,
      slot,
      isMyTurn: slot === mySlot,
      displayName: (uid && userMap[uid]?.displayName) || `Team ${slot}`,
    };
  }, [phase, currentPickNo, totalPicks, leagueSize, mySlot, draftMeta, userMap]);

  const isMyTurn = currentPickInfo?.isMyTurn ?? false;

  const suggestions = useMemo(() => {
    if (!isMyTurn) return [];
    return getPickSuggestions(availablePlayers, myRoster, scoringMode, leagueSize, 3);
  }, [isMyTurn, availablePlayers, myRoster, scoringMode, leagueSize]);

  const managerGrades = useMemo(() => {
    if (phase !== 'complete') return null;
    const slotToUser = {};
    if (draftMeta?.draft_order) {
      Object.entries(draftMeta.draft_order).forEach(([uid, slot]) => { slotToUser[slot] = uid; });
    }
    return computeAllGrades(visiblePicks, playerVorpMap, leagueSize, userMap, slotToUser);
  }, [phase, visiblePicks, playerVorpMap, leagueSize, userMap, draftMeta]);

  // ── Live Polling ──────────────────────────────────────────────────────────

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) { clearInterval(pollTimerRef.current); pollTimerRef.current = null; }
  }, []);

  const fetchPicks = useCallback(async (isResync = false) => {
    if (!draftMeta?.draft_id || isDemoMode) return;
    setSyncStatus('polling');
    try {
      const fresh = await liveDraftFetch({ type: 'picks', draftId: draftMeta.draft_id });
      const newPicks = Array.isArray(fresh) ? fresh : [];
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
      if (newPicks.length >= totalPicks) { setPhase('complete'); stopPolling(); return; }
      if (phase === 'waiting') {
        const meta = await liveDraftFetch({ type: 'draft', draftId: draftMeta.draft_id });
        if (meta?.status === 'drafting') { setDraftMeta(meta); setPhase('live'); }
      }
    } catch (err) {
      setSyncStatus('error');
      setSyncError(err.message);
    }
  }, [draftMeta, totalPicks, phase, isDemoMode, stopPolling]);

  const startPolling = useCallback((intervalMs) => {
    stopPolling();
    pollTimerRef.current = setInterval(() => fetchPicks(), intervalMs);
  }, [stopPolling, fetchPicks]);

  useEffect(() => {
    if (isDemoMode) return; // demo mode handles its own "ticking"
    if (phase === 'live')    { fetchPicks(); startPolling(POLL_LIVE_MS); }
    else if (phase === 'waiting') { fetchPicks(); startPolling(POLL_WAITING_MS); }
    else { stopPolling(); }
    return stopPolling;
  }, [phase, isDemoMode]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handleVisibility = () => {
      if (!document.hidden && !isDemoMode && (phase === 'live' || phase === 'waiting')) fetchPicks(true);
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [phase, isDemoMode, fetchPicks]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  // ── Demo auto-play timer ──────────────────────────────────────────────────

  const stopDemoTimer = useCallback(() => {
    if (demoTimerRef.current) { clearInterval(demoTimerRef.current); demoTimerRef.current = null; }
  }, []);

  // Advance one pick in demo mode
  const advanceDemoPick = useCallback(() => {
    setDemoPickIndex(prev => {
      const next = prev + 1;
      if (next >= demoAllPicks.length) {
        stopDemoTimer();
        setDemoPlaying(false);
        setPhase('complete');
        return prev; // don't go past end
      }
      return next;
    });
  }, [demoAllPicks.length, stopDemoTimer]);

  // Step back one pick
  const rewindDemoPick = useCallback(() => {
    setDemoPickIndex(prev => Math.max(0, prev - 1));
    // If we were at complete, go back to live
    setPhase(p => p === 'complete' ? 'live' : p);
  }, []);

  // Toggle auto-play
  const toggleDemoPlay = useCallback(() => {
    setDemoPlaying(prev => {
      const willPlay = !prev;
      if (willPlay) {
        const intervalMs = DEMO_SPEED_MS[demoSpeed] || DEMO_SPEED_MS.slow;
        stopDemoTimer();
        demoTimerRef.current = setInterval(() => {
          setDemoPickIndex(idx => {
            const next = idx + 1;
            if (next >= demoAllPicks.length) {
              stopDemoTimer();
              setDemoPlaying(false);
              setPhase('complete');
              return idx;
            }
            return next;
          });
        }, intervalMs);
      } else {
        stopDemoTimer();
      }
      return willPlay;
    });
  }, [demoSpeed, demoAllPicks.length, stopDemoTimer]);

  const changeDemoSpeed = useCallback((speed) => {
    setDemoSpeed(speed);
    // If playing, restart timer at new speed
    if (demoPlaying) {
      stopDemoTimer();
      const intervalMs = DEMO_SPEED_MS[speed];
      if (intervalMs) {
        demoTimerRef.current = setInterval(() => {
          setDemoPickIndex(idx => {
            const next = idx + 1;
            if (next >= demoAllPicks.length) {
              stopDemoTimer();
              setDemoPlaying(false);
              setPhase('complete');
              return idx;
            }
            return next;
          });
        }, intervalMs);
      }
    }
  }, [demoPlaying, demoAllPicks.length, stopDemoTimer]);

  useEffect(() => () => stopDemoTimer(), [stopDemoTimer]);

  // ── Setup actions ─────────────────────────────────────────────────────────

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
      const draft = drafts.find(d => d.status === 'drafting' || d.status === 'pre_draft') || drafts[0];
      setDraftMeta(draft);
      setUserMap(users || {});
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

  /** Load last season's draft for replay mode. */
  const fetchDemoData = useCallback(async (lid) => {
    const targetLeagueId = lid || setupLeagueId;
    if (!targetLeagueId) {
      setSetupError('Enter your league ID first so we can load last season\'s draft.');
      return;
    }
    setDemoLoading(true);
    setSetupError(null);
    try {
      const res = await fetch(`/api/draft-analysis?leagueId=${targetLeagueId}`);
      if (!res.ok) throw new Error('Could not load draft data — make sure the league ID is correct.');
      const data = await res.json();
      if (!data.picks?.length) throw new Error('No picks found in last season\'s draft.');

      // Normalise user map from draft-analysis format ({ userId: displayName }) to
      // the same shape useLiveDraft uses ({ userId: { displayName } })
      const normalisedUserMap = {};
      if (data.users) {
        Object.entries(data.users).forEach(([uid, name]) => {
          normalisedUserMap[uid] = { displayName: name };
        });
      }

      setDraftMeta(data.draft);
      setUserMap(normalisedUserMap);
      // Sort picks by pick_no ascending to ensure replay order is correct
      setDemoAllPicks([...data.picks].sort((a, b) => a.pick_no - b.pick_no));

      // Auto-detect slot from last season's draft order
      if (data.draft?.draft_order && userId) {
        const slot = data.draft.draft_order[userId];
        if (slot) setDetectedSlot(slot);
      }
    } catch (err) {
      setSetupError(err.message);
    } finally {
      setDemoLoading(false);
    }
  }, [setupLeagueId, userId]);

  const confirmAndStart = useCallback((confirmedSlot) => {
    setMySlot(confirmedSlot);
    lastPickCountRef.current = 0;
    const status = draftMeta?.status;
    if (status === 'drafting') setPhase('live');
    else setPhase('waiting');
  }, [draftMeta]);

  /** Start demo/replay mode — jumps straight to live board with 0 picks revealed. */
  const startDemoReplay = useCallback((confirmedSlot) => {
    setMySlot(confirmedSlot);
    setIsDemoMode(true);
    setDemoPickIndex(0);
    setDemoPlaying(false);
    setDemoSpeed('manual');
    setPhase('live');
  }, []);

  const resync = useCallback(() => {
    lastPickCountRef.current = 0;
    fetchPicks(true);
  }, [fetchPicks]);

  const reset = useCallback(() => {
    stopPolling();
    stopDemoTimer();
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
    setIsDemoMode(false);
    setDemoAllPicks([]);
    setDemoPickIndex(0);
    setDemoPlaying(false);
    lastPickCountRef.current = 0;
  }, [stopPolling, stopDemoTimer]);

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

    // Demo
    isDemoMode,
    demoLoading,
    demoAllPicks,
    demoPickIndex,
    demoSpeed,
    demoPlaying,
    fetchDemoData,
    startDemoReplay,
    advanceDemoPick,
    rewindDemoPick,
    toggleDemoPlay,
    changeDemoSpeed,

    // Live draft data
    picks: visiblePicks,
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

    // Sync (live mode)
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
