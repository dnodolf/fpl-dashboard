'use client';

/**
 * DraftSetupScreen — pre-draft setup for the live Draft Assistant.
 *
 * Two paths:
 *  A. Live draft  — fetch upcoming/active draft, confirm slot, go live
 *  B. Demo replay — load last season's draft picks, confirm slot, replay pick by pick
 */

import { useState } from 'react';
import PropTypes from 'prop-types';

const SLOT_OPTIONS = Array.from({ length: 12 }, (_, i) => i + 1);

function SlotPicker({ leagueSize, detectedSlot, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {SLOT_OPTIONS.slice(0, leagueSize).map(slot => (
        <button
          key={slot}
          onClick={() => onChange(slot)}
          className={`w-10 h-10 rounded text-sm font-bold transition-colors border ${
            value === slot
              ? 'bg-violet-600 text-white border-violet-500'
              : 'bg-slate-700 text-slate-300 border-slate-600 hover:border-violet-500 hover:text-white'
          }`}
        >
          {slot}
          {slot === detectedSlot && <span className="block text-[8px] leading-none text-violet-300">auto</span>}
        </button>
      ))}
    </div>
  );
}

export default function DraftSetupScreen({
  setupLeagueId,
  setSetupLeagueId,
  setupError,
  setupLoading,
  demoLoading,
  draftMeta,
  detectedSlot,
  demoAllPicks,
  onFetchDraft,
  onFetchDemo,
  onConfirmAndStart,
  onStartDemoReplay,
}) {
  const [confirmedSlot, setConfirmedSlot] = useState(null);
  const [mode, setMode] = useState(null); // null | 'live' | 'demo'

  const leagueSize = draftMeta?.settings?.teams || 10;
  const status     = draftMeta?.status;
  const effectiveSlot = confirmedSlot ?? detectedSlot ?? 1;

  // When detectedSlot arrives and user hasn't manually picked yet, adopt it
  const handleSlotChange = (slot) => setConfirmedSlot(slot);

  const statusBadge = status === 'drafting'
    ? <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">🟢 Live Now</span>
    : status === 'pre_draft'
    ? <span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">⏳ Not Started</span>
    : status === 'complete'
    ? <span className="px-2 py-0.5 rounded text-xs font-bold bg-slate-500/20 text-slate-400 border border-slate-500/30">✓ Complete</span>
    : null;

  const draftFound = !!draftMeta;
  const demoReady  = demoAllPicks?.length > 0;

  return (
    <div className="max-w-lg mx-auto space-y-6 py-4">
      <div>
        <h2 className="text-xl font-bold text-white mb-1">Draft Assistant</h2>
        <p className="text-sm text-slate-400">
          Connect to your live Sleeper draft, or replay last season's draft to walk through the experience.
        </p>
      </div>

      {/* Step 1: League ID */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-4 space-y-3">
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wide">Step 1 — League ID</h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={setupLeagueId}
            onChange={e => { setSetupLeagueId(e.target.value); setMode(null); }}
            placeholder="Sleeper league ID"
            className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
            onKeyDown={e => e.key === 'Enter' && setupLeagueId.trim() && onFetchDraft(setupLeagueId.trim())}
          />
        </div>

        {/* Two action buttons */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => { setMode('live'); onFetchDraft(setupLeagueId.trim()); }}
            disabled={setupLoading || !setupLeagueId.trim()}
            className="px-3 py-2 bg-violet-600 hover:bg-violet-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-medium rounded transition-colors"
          >
            {setupLoading && mode === 'live' ? 'Fetching…' : '🟢 Live Draft'}
          </button>
          <button
            onClick={() => { setMode('demo'); onFetchDemo(setupLeagueId.trim()); }}
            disabled={demoLoading || !setupLeagueId.trim()}
            className="px-3 py-2 bg-slate-600 hover:bg-slate-500 disabled:bg-slate-700 disabled:text-slate-500 text-slate-200 text-sm font-medium rounded transition-colors border border-slate-500"
          >
            {demoLoading ? 'Loading…' : '▶ Demo Replay'}
          </button>
        </div>
        <p className="text-[11px] text-slate-500">
          <strong className="text-slate-400">Live Draft</strong> — syncs to an active or upcoming Sleeper draft.{' '}
          <strong className="text-slate-400">Demo Replay</strong> — replays last season's picks pick-by-pick so you can walk through the experience.
        </p>

        {setupError && (
          <p className="text-sm text-red-400">⚠️ {setupError}</p>
        )}

        {/* Draft info card */}
        {draftFound && (
          <div className="bg-slate-700/50 rounded p-3 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-white font-medium">
                {demoReady && mode === 'demo' ? '📼 Last season\'s draft loaded' : 'Draft found'}
              </span>
              {mode === 'live' && statusBadge}
              {demoReady && mode === 'demo' && (
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-violet-500/20 text-violet-400 border border-violet-500/30">
                  {demoAllPicks.length} picks
                </span>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <div className="text-slate-500">Teams</div>
                <div className="text-slate-200 font-medium">{leagueSize}</div>
              </div>
              <div>
                <div className="text-slate-500">Rounds</div>
                <div className="text-slate-200 font-medium">{draftMeta.settings?.rounds || 17}</div>
              </div>
              <div>
                <div className="text-slate-500">Type</div>
                <div className="text-slate-200 font-medium capitalize">{draftMeta.type || 'snake'}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Step 2: Confirm slot */}
      {draftFound && (
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4 space-y-3">
          <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wide">Step 2 — Your Pick Slot</h3>

          {detectedSlot ? (
            <p className="text-sm text-slate-400">
              Detected your slot as <span className="text-white font-bold">#{detectedSlot}</span>. Confirm or adjust:
            </p>
          ) : (
            <p className="text-sm text-slate-400">Select your draft slot:</p>
          )}

          <SlotPicker
            leagueSize={leagueSize}
            detectedSlot={detectedSlot}
            value={effectiveSlot}
            onChange={handleSlotChange}
          />

          {mode === 'demo' && demoReady ? (
            <button
              onClick={() => onStartDemoReplay(effectiveSlot)}
              className="w-full py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold rounded transition-colors"
            >
              ▶ Start Demo Replay
            </button>
          ) : mode === 'live' && draftFound ? (
            <button
              onClick={() => onConfirmAndStart(effectiveSlot)}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded transition-colors"
            >
              {status === 'drafting' ? '🟢 Join Live Draft' : '⏳ Wait for Draft to Start'}
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}

DraftSetupScreen.propTypes = {
  setupLeagueId: PropTypes.string.isRequired,
  setSetupLeagueId: PropTypes.func.isRequired,
  setupError: PropTypes.string,
  setupLoading: PropTypes.bool,
  demoLoading: PropTypes.bool,
  draftMeta: PropTypes.object,
  detectedSlot: PropTypes.number,
  demoAllPicks: PropTypes.array,
  onFetchDraft: PropTypes.func.isRequired,
  onFetchDemo: PropTypes.func.isRequired,
  onConfirmAndStart: PropTypes.func.isRequired,
  onStartDemoReplay: PropTypes.func.isRequired,
};
