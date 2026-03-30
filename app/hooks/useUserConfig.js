/**
 * useUserConfig Hook
 * Manages user configuration (league ID, user display name) via localStorage.
 * Provides setup state detection and config update methods.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';

const CONFIG_KEY = 'fpl_dashboard_user_config';

const DEFAULT_CONFIG = {
  leagueId: '',
  userId: '',
  leagueName: '',
  rosterOwners: [],    // cached roster owner list for the league
  configuredAt: null,
};

export function useUserConfig() {
  const [config, setConfig] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load config from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(CONFIG_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.leagueId && parsed.userId) {
          setConfig(parsed);
        }
      }
    } catch {
      // Corrupt localStorage — ignore
    }
    setIsLoading(false);
  }, []);

  const isConfigured = !!(config?.leagueId && config?.userId);

  const saveConfig = useCallback((newConfig) => {
    const updated = {
      ...DEFAULT_CONFIG,
      ...newConfig,
      configuredAt: new Date().toISOString(),
    };
    localStorage.setItem(CONFIG_KEY, JSON.stringify(updated));
    setConfig(updated);
  }, []);

  const clearConfig = useCallback(() => {
    localStorage.removeItem(CONFIG_KEY);
    setConfig(null);
  }, []);

  return {
    config,
    isConfigured,
    isLoading,
    saveConfig,
    clearConfig,
    userId: config?.userId || '',
    leagueId: config?.leagueId || '',
    leagueName: config?.leagueName || '',
  };
}
