/**
 * useGameweek Hook
 * Manages current gameweek state
 */

import { useState, useEffect } from 'react';
import GameweekService from '../services/gameweekService';

/**
 * Get current gameweek with error handling
 */
const getCurrentGameweek = async () => {
  try {
    return await GameweekService.getCurrentGameweek();
  } catch (error) {
    console.error('Error getting current gameweek:', error);
    // Return a safe fallback
    return {
      number: 2,
      status: 'upcoming',
      statusDisplay: '🏁 GW 2 (Upcoming)',
      date: 'Aug 22',
      fullDate: '2025-08-22',
      source: 'error_fallback'
    };
  }
};

export function useGameweek() {
  const [currentGameweek, setCurrentGameweek] = useState({
    number: 2,
    status: 'upcoming',
    statusDisplay: '🏁 GW 2 (Upcoming)',
    date: 'Loading...',
    fullDate: null,
    source: 'loading'
  });

  useEffect(() => {
    const loadGameweek = async () => {
      const gw = await getCurrentGameweek();
      setCurrentGameweek(gw);
    };

    loadGameweek();
  }, []);

  return currentGameweek;
}
