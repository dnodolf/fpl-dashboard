/**
 * usePlayerData Hook
 * Manages player data fetching with caching
 */

import { useState, useEffect, useRef } from 'react';
import CacheManager from '../utils/cacheManager';

export function usePlayerData(leagueId = '') {
  const [data, setData] = useState({
    players: [],
    loading: true,
    error: null,
    lastUpdated: null,
    source: 'loading',
    quality: null,
    ownershipData: false,
    ownershipCount: 0,
    enhanced: false,
    integrated: false,
    integration: null,
    calibration: null,
    modelAccuracy: null
  });

  // Guard against concurrent in-flight requests
  const fetchingRef = useRef(false);

  const fetchFromServer = async (forceRefresh = false) => {
    if (fetchingRef.current && !forceRefresh) return;
    fetchingRef.current = true;

    try {
      if (process.env.NODE_ENV === 'development') {
        console.log('🔄 Fetching fresh data from API');
      }

      const response = await fetch('/api/integrated-players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          includeMatching: true,
          includeScoring: true,
          forceRefresh,
          ...(leagueId ? { leagueId } : {})
        })
      });

      if (!response.ok) throw new Error(`API Error: ${response.status}`);

      const result = await response.json();

      if (result.players && Array.isArray(result.players)) {
        if (process.env.NODE_ENV === 'development') {
          console.log('✅ Setting player data:', result.players.length, 'players');
        }

        const newData = {
          players: result.players,
          loading: false,
          error: null,
          lastUpdated: result.timestamp,
          source: 'integrated',
          quality: 'high',
          ownershipData: true,
          enhanced: true,
          cached: result.cached || false,
          ownershipCount: result.count || result.players.length,
          integrated: true,
          integration: result.stats,
          calibration: result.calibration || null,
          modelAccuracy: result.modelAccuracy || null
        };

        CacheManager.set(newData);
        setData(newData);
      } else {
        throw new Error('No player data received from API');
      }
    } catch (error) {
      console.error('Error fetching player data:', error);
      // Only surface error if nothing is already displayed
      setData(prev => ({
        ...prev,
        loading: false,
        error: prev.players.length === 0 ? error.message : null
      }));
    } finally {
      fetchingRef.current = false;
    }
  };

  // Stale-while-revalidate: show cached data instantly, always background-refresh.
  // This means a Sleeper roster change shows up automatically within seconds of
  // page load rather than waiting for the full cache TTL to expire.
  const fetchData = async (type = 'auto', forceRefresh = false, useCache = true) => {
    if (forceRefresh) {
      setData(prev => ({ ...prev, loading: true, error: null }));
      await fetchFromServer(true);
      return;
    }

    const cachedData = useCache ? CacheManager.get() : null;

    if (cachedData) {
      // Show stale data immediately (no spinner)
      if (process.env.NODE_ENV === 'development') {
        console.log('⚡ Showing cached data, background refresh starting');
      }
      setData(prev => ({ ...prev, loading: false, ...cachedData }));
      // Background refresh — updates UI silently when fresh data arrives
      fetchFromServer(false);
    } else {
      // No cache: show spinner and wait
      setData(prev => ({ ...prev, loading: true, error: null }));
      await fetchFromServer(false);
    }
  };

  useEffect(() => {
    fetchData('auto', false, true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leagueId]);

  return { ...data, refetch: fetchData };
}
