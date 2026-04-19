'use client';

/**
 * MockDraftSetup — configuration screen shown before a mock draft begins.
 *
 * Props:
 *   settings       - current settings object from useMockDraft
 *   updateSettings - setter from useMockDraft
 *   onStart        - called when user clicks "Start Mock Draft"
 *   draftHistory   - array of past draft summaries
 *   myPickSlots    - preview of which overall picks belong to the user
 *   isLoading      - true while players are still being fetched
 */

import PropTypes from 'prop-types';
import { useMemo } from 'react';

const SPEED_OPTIONS = [
  { value: 'instant', label: 'Instant', desc: 'All AI picks happen immediately' },
  { value: 'fast', label: 'Fast', desc: 'AI picks animate at ~80ms each' },
  { value: 'slow', label: 'Slow', desc: 'AI picks animate at ~350ms each' },
];

const DIFFICULTY_OPTIONS = [
  { value: 'casual', label: 'Casual', desc: 'AI makes frequent reaches and mistakes' },
  { value: 'balanced', label: 'Balanced', desc: 'Realistic league opponent behaviour' },
  { value: 'sharp', label: 'Sharp', desc: 'Near-optimal AI — tests your edge' },
];

const SCORING_OPTIONS = [
  { value: 'v3', label: 'V3 Sleeper' },
  { value: 'fpl', label: 'FFH FPL' },
];

function GradeChip({ letter }) {
  const colors = {
    'A+': 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    A:   'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    'B+': 'bg-blue-500/20 text-blue-300 border-blue-500/40',
    B:   'bg-blue-500/20 text-blue-300 border-blue-500/40',
    'C+': 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    C:   'bg-amber-500/20 text-amber-300 border-amber-500/40',
    D:   'bg-red-500/20 text-red-300 border-red-500/40',
  };
  return (
    <span className={`px-2 py-0.5 rounded text-sm font-bold border ${colors[letter] || 'bg-slate-700 text-slate-300 border-slate-600'}`}>
      {letter}
    </span>
  );
}

export default function MockDraftSetup({ settings, updateSettings, onStart, draftHistory, myPickSlots, isLoading }) {
  const { leagueSize, myDraftPosition, scoringMode, speed, difficulty } = settings;

  // Group my pick slots into rounds for the preview
  const pickSlotRows = useMemo(() => {
    if (!myPickSlots?.length) return [];
    return myPickSlots.map((overall, idx) => {
      const round = Math.ceil(overall / leagueSize);
      const pickInRound = myDraftPosition % 2 === 1
        ? myDraftPosition
        : leagueSize - myDraftPosition + 1;
      return { round, overall, idx };
    });
  }, [myPickSlots, leagueSize, myDraftPosition]);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-white">Mock Draft Simulator</h2>
        <p className="text-sm text-slate-400 mt-1">
          Practice your snake draft strategy against AI opponents. Your picks are graded by VORP efficiency.
        </p>
      </div>

      {/* League Settings */}
      <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-4 space-y-4">
        <h3 className="text-sm font-bold text-white">League Settings</h3>

        {/* League Size */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-slate-400">League Size</label>
          <div className="flex gap-2 flex-wrap">
            {[8, 10, 12, 14].map(n => (
              <button
                key={n}
                onClick={() => updateSettings({ leagueSize: n })}
                className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                  leagueSize === n
                    ? 'bg-violet-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {n} teams
              </button>
            ))}
          </div>
        </div>

        {/* My Draft Position */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-slate-400">My Draft Position</label>
          <div className="flex gap-1.5 flex-wrap">
            {Array.from({ length: leagueSize }, (_, i) => i + 1).map(pos => (
              <button
                key={pos}
                onClick={() => updateSettings({ myDraftPosition: pos })}
                className={`w-9 h-9 rounded text-sm font-bold transition-colors ${
                  myDraftPosition === pos
                    ? 'bg-violet-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {pos}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-500">
            Position {myDraftPosition} of {leagueSize} — drafting {myDraftPosition <= leagueSize / 2 ? 'early' : 'late'}
          </p>
        </div>

        {/* Scoring Mode */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-slate-400">Scoring System</label>
          <div className="flex gap-2">
            {SCORING_OPTIONS.map(o => (
              <button
                key={o.value}
                onClick={() => updateSettings({ scoringMode: o.value })}
                className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                  scoringMode === o.value
                    ? 'bg-violet-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Simulator Settings */}
      <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-4 space-y-4">
        <h3 className="text-sm font-bold text-white">Simulator Settings</h3>

        {/* Speed */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-slate-400">AI Pick Speed</label>
          <div className="grid grid-cols-3 gap-2">
            {SPEED_OPTIONS.map(o => (
              <button
                key={o.value}
                onClick={() => updateSettings({ speed: o.value })}
                className={`p-3 rounded text-left transition-colors border ${
                  speed === o.value
                    ? 'bg-violet-600/20 border-violet-500/60 text-white'
                    : 'bg-slate-700/50 border-slate-700 text-slate-300 hover:border-slate-500'
                }`}
              >
                <div className="text-sm font-medium">{o.label}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">{o.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Difficulty */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-slate-400">AI Difficulty</label>
          <div className="grid grid-cols-3 gap-2">
            {DIFFICULTY_OPTIONS.map(o => (
              <button
                key={o.value}
                onClick={() => updateSettings({ difficulty: o.value })}
                className={`p-3 rounded text-left transition-colors border ${
                  difficulty === o.value
                    ? 'bg-violet-600/20 border-violet-500/60 text-white'
                    : 'bg-slate-700/50 border-slate-700 text-slate-300 hover:border-slate-500'
                }`}
              >
                <div className="text-sm font-medium">{o.label}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">{o.desc}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* My Pick Slots Preview */}
      {pickSlotRows.length > 0 && (
        <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-4">
          <h3 className="text-sm font-bold text-white mb-3">Your Pick Slots (17 rounds)</h3>
          <div className="flex flex-wrap gap-1.5">
            {pickSlotRows.map(({ round, overall }) => (
              <div
                key={overall}
                className="flex flex-col items-center px-2.5 py-1.5 bg-violet-600/20 border border-violet-500/40 rounded text-center"
              >
                <span className="text-[10px] text-violet-300 font-medium">Rd {round}</span>
                <span className="text-xs text-white font-bold">#{overall}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Snake draft — your pick order reverses each round.
          </p>
        </div>
      )}

      {/* Draft History */}
      {draftHistory?.length > 0 && (
        <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-4">
          <h3 className="text-sm font-bold text-white mb-3">Recent Drafts</h3>
          <div className="space-y-2">
            {draftHistory.map(entry => (
              <div
                key={entry.id}
                className="flex items-center justify-between py-1.5 border-b border-slate-700 last:border-0"
              >
                <div className="flex items-center gap-3">
                  <GradeChip letter={entry.grade} />
                  <div>
                    <div className="text-xs text-slate-300">
                      {entry.leagueSize}-team · Pos {entry.settings?.myDraftPosition ?? '?'} · {entry.settings?.scoringMode?.toUpperCase() ?? ''}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {new Date(entry.date).toLocaleDateString()} · Rank #{entry.myRank} of {entry.leagueSize}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-300 font-medium">{(entry.efficiency * 100).toFixed(0)}% eff</div>
                  <div className="text-[11px] text-slate-500">VORP: {entry.totalVorp?.toFixed(1)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Start Button */}
      <div className="flex justify-center pb-4">
        <button
          onClick={onStart}
          disabled={isLoading}
          className="px-8 py-3 bg-violet-600 hover:bg-violet-500 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-bold text-base rounded-lg transition-colors shadow-lg"
        >
          {isLoading ? 'Loading players…' : 'Start Mock Draft'}
        </button>
      </div>
    </div>
  );
}

MockDraftSetup.propTypes = {
  settings: PropTypes.object.isRequired,
  updateSettings: PropTypes.func.isRequired,
  onStart: PropTypes.func.isRequired,
  draftHistory: PropTypes.array,
  myPickSlots: PropTypes.array,
  isLoading: PropTypes.bool,
};
