'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { computeDraftRankings, getPickSuggestions, normalizePosition } from '../services/draftRankingService';

const STORAGE_KEYS = {
  SESSION: 'fpl_draft_session',
  WATCHLIST: 'fpl_draft_watchlist',
  DND: 'fpl_draft_dnd',
};

function loadFromStorage(key, defaultValue) {
  if (typeof window === 'undefined') return defaultValue;
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : defaultValue;
  } catch {
    return defaultValue;
  }
}

function saveToStorage(key, value) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage full or unavailable
  }
}

/**
 * Custom hook managing draft session state.
 * Tracks drafted players, watchlist, do-not-draft list, and derives rankings/suggestions.
 *
 * @param {Array} players - All players from integrated-players API
 * @param {string} scoringMode - 'ffh', 'v3', or 'v4'
 * @param {number} leagueSize - Number of teams in the league
 */
export function useDraftBoard(players, scoringMode, leagueSize = 10) {
  // Persisted state
  const [draftedPlayers, setDraftedPlayers] = useState(() =>
    loadFromStorage(STORAGE_KEYS.SESSION, {})
  );
  const [watchlist, setWatchlist] = useState(() =>
    loadFromStorage(STORAGE_KEYS.WATCHLIST, [])
  );
  const [doNotDraft, setDoNotDraft] = useState(() =>
    loadFromStorage(STORAGE_KEYS.DND, [])
  );
  const [positionFilter, setPositionFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Persist to localStorage on change
  useEffect(() => {
    saveToStorage(STORAGE_KEYS.SESSION, draftedPlayers);
  }, [draftedPlayers]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.WATCHLIST, watchlist);
  }, [watchlist]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.DND, doNotDraft);
  }, [doNotDraft]);

  // Pick counter
  const pickNumber = useMemo(() => Object.keys(draftedPlayers).length, [draftedPlayers]);

  const totalPicks = leagueSize * 17; // 17-man squads (11 starters + 6 bench)

  // Players eligible for stable ranking: all players except DND.
  // Drafted players stay in the pool so tiers never shift as picks are made.
  const eligiblePlayers = useMemo(() => {
    if (!players?.length) return [];
    return players.filter(p => !doNotDraft.includes(p.sleeper_id || p.id));
  }, [players, doNotDraft]);

  // Rankings computed once from all eligible players — tiers are stable throughout the draft.
  const rankings = useMemo(() => {
    return computeDraftRankings(eligiblePlayers, scoringMode, leagueSize);
  }, [eligiblePlayers, scoringMode, leagueSize]);

  // Available players for suggestions only (not drafted, not DND)
  const availablePlayers = useMemo(() => {
    return (rankings.rankedPlayers || []).filter(p => {
      const id = p.sleeper_id || p.id;
      return !draftedPlayers[id];
    });
  }, [rankings.rankedPlayers, draftedPlayers]);

  // My roster (players I drafted)
  const myRoster = useMemo(() => {
    return Object.entries(draftedPlayers)
      .filter(([, info]) => info.draftedBy === 'me')
      .map(([id, info]) => {
        const player = players?.find(p => (p.sleeper_id || p.id) === id);
        return player ? { ...player, pickNumber: info.pickNumber } : null;
      })
      .filter(Boolean)
      .sort((a, b) => a.pickNumber - b.pickNumber);
  }, [draftedPlayers, players]);

  // Suggestions use available (undrafted) players only
  const suggestions = useMemo(() => {
    return getPickSuggestions(availablePlayers, myRoster, scoringMode, leagueSize);
  }, [availablePlayers, myRoster, scoringMode, leagueSize]);

  // Display players: all ranked players with draft status attached.
  // Tiers never change — drafted players stay in place, just marked.
  const displayPlayers = useMemo(() => {
    let filtered = (rankings.rankedPlayers || []).map(p => {
      const id = p.sleeper_id || p.id;
      const draftInfo = draftedPlayers[id];
      return {
        ...p,
        isDrafted: !!draftInfo,
        draftedBy: draftInfo?.draftedBy || null,
      };
    });

    if (positionFilter !== 'ALL') {
      filtered = filtered.filter(p => normalizePosition(p.position) === positionFilter);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(p =>
        (p.name || '').toLowerCase().includes(query) ||
        (p.full_name || '').toLowerCase().includes(query) ||
        (p.team || '').toLowerCase().includes(query) ||
        (p.team_abbr || '').toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [rankings.rankedPlayers, positionFilter, searchQuery, draftedPlayers]);

  // Watchlist players (all — including drafted, so you can see who you got)
  const watchlistPlayers = useMemo(() => {
    return (rankings.rankedPlayers || [])
      .filter(p => watchlist.includes(p.sleeper_id || p.id))
      .map(p => {
        const id = p.sleeper_id || p.id;
        const draftInfo = draftedPlayers[id];
        return { ...p, isDrafted: !!draftInfo, draftedBy: draftInfo?.draftedBy || null };
      });
  }, [rankings.rankedPlayers, watchlist, draftedPlayers]);

  // My roster is full at 17
  const myRosterFull = myRoster.length >= 17;

  // Actions
  const draftPlayer = useCallback((player, draftedBy = 'me') => {
    if (draftedBy === 'me') {
      setDraftedPlayers(prev => {
        const myCount = Object.values(prev).filter(p => p.draftedBy === 'me').length;
        if (myCount >= 17) return prev;
        return {
          ...prev,
          [player.sleeper_id || player.id]: {
            draftedBy,
            pickNumber: Object.keys(prev).length + 1,
            name: player.name || player.full_name,
            position: player.position,
          }
        };
      });
    } else {
      const id = player.sleeper_id || player.id;
      setDraftedPlayers(prev => ({
        ...prev,
        [id]: {
          draftedBy,
          pickNumber: Object.keys(prev).length + 1,
          name: player.name || player.full_name,
          position: player.position,
        }
      }));
    }
  }, []);

  const undraftPlayer = useCallback((playerId) => {
    setDraftedPlayers(prev => {
      const next = { ...prev };
      delete next[playerId];
      return next;
    });
  }, []);

  const toggleWatchlist = useCallback((playerId) => {
    setWatchlist(prev =>
      prev.includes(playerId)
        ? prev.filter(id => id !== playerId)
        : [...prev, playerId]
    );
  }, []);

  const toggleDND = useCallback((playerId) => {
    setDoNotDraft(prev =>
      prev.includes(playerId)
        ? prev.filter(id => id !== playerId)
        : [...prev, playerId]
    );
  }, []);

  const resetDraft = useCallback(() => {
    setDraftedPlayers({});
    setWatchlist([]);
    setDoNotDraft([]);
    setPositionFilter('ALL');
    setSearchQuery('');
    localStorage.removeItem(STORAGE_KEYS.SESSION);
    localStorage.removeItem(STORAGE_KEYS.WATCHLIST);
    localStorage.removeItem(STORAGE_KEYS.DND);
  }, []);

  // Roster slot fill status
  const rosterSlots = useMemo(() => {
    const filled = { GKP: [], DEF: [], MID: [], FWD: [] };
    myRoster.forEach(p => {
      const pos = normalizePosition(p.position);
      if (pos && filled[pos]) {
        filled[pos].push(p);
      }
    });
    return filled;
  }, [myRoster]);

  return {
    // Data
    availablePlayers,
    myRoster,
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
    myRosterFull,
    // Filters
    positionFilter,
    setPositionFilter,
    searchQuery,
    setSearchQuery,
    // Actions
    draftPlayer,
    undraftPlayer,
    toggleWatchlist,
    toggleDND,
    resetDraft,
  };
}
