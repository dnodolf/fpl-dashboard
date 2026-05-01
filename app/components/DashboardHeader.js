'use client';

import { useState, useRef, useEffect } from 'react';
import { getDataFreshnessStatus } from '../utils/cacheManager';
import CacheManager from '../utils/cacheManager';
import { AppLogo } from './common/AppLogo';
import { Home, Users, ArrowLeftRight, Scale, Trophy, Target, RefreshCw, Info, ChevronDown } from 'lucide-react';

const SCORING_MODES = [
  { id: 'ffh', label: 'FFH', emoji: '📊' },
  { id: 'v3',  label: 'V3',  emoji: '🚀' },
  { id: 'v4',  label: 'V4',  emoji: '⚡' },
];

const DashboardHeader = ({ lastUpdated, players, updateData, activeTab, setActiveTab, currentGameweek, scoringMode, setScoringMode, calibration, modelAccuracy, leagueName, onChangeLeague }) => {
  const freshnessStatus = getDataFreshnessStatus(lastUpdated);
  const tabScrollRef = useRef(null);
  const scoringDropdownRef = useRef(null);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [scoringOpen, setScoringOpen] = useState(false);

  useEffect(() => {
    if (!scoringOpen) return;
    const handleClick = (e) => {
      if (!scoringDropdownRef.current?.contains(e.target)) setScoringOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [scoringOpen]);

  useEffect(() => {
    const el = tabScrollRef.current;
    if (!el) return;

    const check = () => setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
    check();
    el.addEventListener('scroll', check);
    window.addEventListener('resize', check);
    return () => {
      el.removeEventListener('scroll', check);
      window.removeEventListener('resize', check);
    };
  }, []);

  return (
    <header className="bg-slate-900 border-slate-800 border-b sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-2 sm:px-4 py-2 sm:py-4">
        {/* Top Row: Title, Gameweek, Update Button */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-4 mb-2 sm:mb-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 w-full sm:w-auto">
            <div className="flex items-center gap-3">
              <h1 className="flex items-center gap-3 text-xl sm:text-3xl font-semibold text-slate-50 whitespace-nowrap">
                <AppLogo size={48} className="hidden sm:block" />
                <AppLogo size={40} className="block sm:hidden" />
                Fantasy FC Playbook
              </h1>
              {leagueName && (
                <div className="flex items-center gap-2">
                  <span className="hidden sm:inline text-xs text-slate-400 bg-slate-800 border border-slate-700 px-2 py-1 rounded-full truncate max-w-[160px]" title={leagueName}>
                    {leagueName}
                  </span>
                  {onChangeLeague && (
                    <button
                      onClick={onChangeLeague}
                      className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                      title="Change league"
                    >
                      ✏️
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto justify-between sm:justify-end">
            {/* Scoring Mode Dropdown */}
            <div className="relative" ref={scoringDropdownRef}>
              <button
                onClick={() => setScoringOpen(o => !o)}
                className="flex items-center gap-1.5 px-2 sm:px-3 py-1 rounded-lg text-xs sm:text-sm font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
              >
                <span>{SCORING_MODES.find(m => m.id === scoringMode)?.emoji}</span>
                <span>{SCORING_MODES.find(m => m.id === scoringMode)?.label}</span>
                <ChevronDown size={12} className={`transition-transform duration-150 ${scoringOpen ? 'rotate-180' : ''}`} />
              </button>
              {scoringOpen && (
                <div className="absolute right-0 top-full mt-1 w-36 bg-slate-800 border border-slate-700 rounded-lg overflow-hidden shadow-xl shadow-black/40 z-50">
                  {SCORING_MODES.map(mode => (
                    <button
                      key={mode.id}
                      onClick={() => { setScoringMode(mode.id); setScoringOpen(false); }}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-left transition-colors ${
                        scoringMode === mode.id
                          ? 'bg-violet-500/20 text-white'
                          : 'text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      <span>{mode.emoji}</span>
                      <span className="font-medium">{mode.label}</span>
                      {scoringMode === mode.id && <span className="ml-auto text-violet-400">✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Model accuracy + calibration — info icon with hover tooltip */}
            {(modelAccuracy || calibration) && (
              <div className="relative group">
                <button className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors">
                  <Info size={14} />
                </button>
                <div className="absolute right-0 top-full mt-2 w-64 bg-slate-800 border border-slate-700 rounded-lg p-3 text-xs text-slate-300 shadow-xl shadow-black/40 hidden group-hover:block z-50 space-y-2">
                  {modelAccuracy && (
                    <div>
                      <span className="text-slate-500 uppercase tracking-wider text-[10px] font-medium">Model Accuracy</span>
                      <p className="mt-0.5 text-slate-300">Sleeper MAE: <span className="text-white font-medium">{modelAccuracy.sleeper_proj?.mae?.toFixed(2) ?? '?'}</span> <span className="text-slate-500">({modelAccuracy.sleeper_proj?.samples ?? 0} samples)</span></p>
                      <p className="text-slate-500 mt-0.5">Lower = more accurate vs actual Sleeper scores</p>
                    </div>
                  )}
                  {calibration && (
                    <div className={modelAccuracy ? 'border-t border-slate-700 pt-2' : ''}>
                      <span className="text-slate-500 uppercase tracking-wider text-[10px] font-medium">V3 Calibration</span>
                      {calibration.active ? (
                        <>
                          <p className="mt-0.5 text-emerald-400 font-medium">Active — {calibration.gwsAnalyzed} GWs · {calibration.sampleCount} samples</p>
                          <p className="text-slate-400 mt-0.5">FWD {calibration.positionRatios?.FWD} · MID {calibration.positionRatios?.MID} · DEF {calibration.positionRatios?.DEF} · GKP {calibration.positionRatios?.GKP}</p>
                        </>
                      ) : (
                        <p className="mt-0.5 text-amber-400">Uncalibrated — {calibration.fallbackReason || 'using hardcoded ratios'}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Data Freshness + Update Button */}
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline text-xs text-slate-400">
                {freshnessStatus.message}
              </span>
              <button
                onClick={() => updateData('manual', true, false)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 px-2 sm:px-4 py-1 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center whitespace-nowrap"
              >
                <RefreshCw size={13} className="mr-1" /><span className="hidden sm:inline">Update Data</span>
              </button>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="relative">
          {canScrollRight && (
            <div className="absolute right-0 top-0 bottom-2 w-8 sm:w-12 bg-gradient-to-l from-slate-900 to-transparent pointer-events-none z-10" />
          )}
        <div ref={tabScrollRef} className="flex overflow-x-auto pb-2 -mb-2 scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-slate-800">
          {[
            { id: 'home',      label: 'Home',      icon: <Home className="w-5 h-5 sm:w-3.5 sm:h-3.5" /> },
            { id: 'lineup',    label: 'Lineup',    icon: <Users className="w-5 h-5 sm:w-3.5 sm:h-3.5" /> },
            { id: 'transfers', label: 'Transfers', icon: <ArrowLeftRight className="w-5 h-5 sm:w-3.5 sm:h-3.5" /> },
            { id: 'trades',    label: 'Trades',    icon: <Scale className="w-5 h-5 sm:w-3.5 sm:h-3.5" /> },
            { id: 'league',    label: 'League',    icon: <Trophy className="w-5 h-5 sm:w-3.5 sm:h-3.5" /> },
            { id: 'draft',     label: 'Draft',     icon: <Target className="w-5 h-5 sm:w-3.5 sm:h-3.5" /> }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-3 sm:px-3 sm:py-2 text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0 border-b-2 ${
                activeTab === tab.id
                  ? 'border-violet-500 text-white'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600'
              }`}
            >
              {tab.icon}<span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>
        </div>
      </div>
    </header>
  );
};

export default DashboardHeader;
