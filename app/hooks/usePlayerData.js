/**
 * usePlayerData Hook
 * Manages player data fetching with caching
 */

import { useState, useEffect } from 'react';
import CacheManager from '../utils/cacheManager';

export function usePlayerData() {
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
    integration: null
  });

  const fetchData = async (type = 'auto', forceRefresh = false, useCache = true) => {
    try {
      setData(prev => ({ ...prev, loading: true, error: null }));

      if (!forceRefresh && useCache) {
        const cachedData = CacheManager.get();
        if (cachedData) {
          if (process.env.NODE_ENV === 'development') {
            console.log('⚡ Loading from cache');
          }
          setData(prev => ({
            ...prev,
            loading: false,
            ...cachedData
          }));
          return;
        }
      }

      if (process.env.NODE_ENV === 'development') {
        console.log('🔄 Fetching fresh data from API');
      }

      const response = await fetch('/api/integrated-players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          includeMatching: true,
          includeScoring: true,
          forceRefresh
        })
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const result = await response.json();

      // Direct check for players array
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
          integration: result.stats
        };

        CacheManager.set(newData);
        setData(newData);
      } else {
        throw new Error('No player data received from API');
      }
    } catch (error) {
      console.error('Error fetching player data:', error);
      setData(prev => ({
        ...prev,
        loading: false,
        error: error.message
      }));
    }
  };

  useEffect(() => {
    fetchData('auto', false, true);
  }, []);

  return { ...data, refetch: fetchData };
}
