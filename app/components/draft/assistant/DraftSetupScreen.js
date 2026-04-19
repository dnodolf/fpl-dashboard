'use client';

/**
 * DraftSetupScreen — pre-draft setup for the live Draft Assistant.
 *
 * Step 1: Enter league ID → fetch draft info
 * Step 2: Confirm draft slot (auto-detected from league config)
 */

import { useState } from 'react';
import PropTypes from 'prop-types';

const SLOT_OPTIONS = Array.from({ length: 12 }, (_, i) => i + 1);

export default function DraftSetupScreen({
  setupLeagueId,
  setSetupLeagueId,
  setupError,
  setupLoading,
  draftMeta,
  detectedSlot,
  onFetchDraft,
  onConfirmAndStart,
}) {
  const [confirmedSlot, setConfirmedSlot] = useState(detectedSlot || 1);

  // Update confirmed slot when detection changes
  const effectiveSlot = detectedSlot !== null && confirmedSlot === 1 ? detectedSlot : confirmedSlot;

  const leagueSize = draftMeta?.settings?.teams || 10;
  const rounds     = draftMeta?.settings?.rounds || 17;
  const status     = draftMeta?.status;

  const statusBadge = status === 'drafting'
    ? <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">🟢 Live Now</span>
    : status === 'pre_draft'
    ? <span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">⏳ Not Started</span>
    : status === 'complete'
    ? <span className="px-2 py-0.5 rounded text-xs font-bold bg-slate-500/20 text-slate-400 border border-slate-500/30">✓ Complete</span>
    : null;

  return (
    <div className="max-w-lg mx-auto space-y-6 py-4">
      <div>
        <h2 className="text-xl font-bold text-white mb-1">Draft Assistant Setup</h2>
        <p className="text-sm text-slate-400">
          Enter your Sleeper league ID to sync with your live draft. Open this a few minutes before your draft starts.
        </p>
      </div>

      {/* Step 1: League ID */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-4 space-y-3">
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wide">Step 1 — League</h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={setupLeagueId}
            onChange={e => setSetupLeagueId(e.target.value)}
            placeholder="Sleeper league ID"
            className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
            onKeyDown={e => e.key === 'Enter' && setupLeagueId.trim() && onFetchDraft(setupLeagueId.trim())}
          />
          <button
            onClick={() => onFetchDraft(setupLeagueId.trim())}
            disabled={setupLoading || !setupLeagueId.trim()}
            className="px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-medium rounded transition-colors"
          >
            {setupLoading ? 'Fetching…' : 'Fetch Draft'}
          </button>
        </div>

        {setupError && (
          <p className="text-sm text-red-400">⚠️ {setupError}</p>
        )}

        {draftMeta && (
          <div className="bg-slate-700/50 rounded p-3 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-white font-medium">Draft found</span>
              {statusBadge}
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <div className="text-slate-500">Teams</div>
                <div className="text-slate-200 font-medium">{leagueSize}</div>
              </div>
              <div>
                <div className="text-slate-500">Rounds</div>
                <div className="text-slate-200 font-medium">{rounds}</div>
              </div>
              <div>
                <div className="text-slate-500">Type</div>
                <div className="text-slate-200 font-medium capitalize">{draftMeta.type || 'snake'}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Step 2: Confirm slot — only shown once draft is fetched */}
      {draftMeta && (
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4 space-y-3">
          <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wide">Step 2 — Your Pick Slot</h3>

          {detectedSlot ? (
            <p className="text-sm text-slate-400">
              We detected your slot as <span className="text-white font-bold">#{detectedSlot}</span>. Confirm or adjust below.
            </p>
          ) : (
            <p className="text-sm text-slate-400">
              We couldn't auto-detect your slot. Select it manually.
            </p>
          )}

          <div className="flex flex-wrap gap-1.5">
            {SLOT_OPTIONS.slice(0, leagueSize).map(slot => (
              <button
                key={slot}
                onClick={() => setConfirmedSlot(slot)}
                className={`w-10 h-10 rounded text-sm font-bold transition-colors border ${
                  effectiveSlot === slot
                    ? 'bg-violet-600 text-white border-violet-500'
                    : 'bg-slate-700 text-slate-300 border-slate-600 hover:border-violet-500 hover:text-white'
                }`}
              >
                {slot}
              </button>
            ))}
          </div>

          <button
            onClick={() => onConfirmAndStart(effectiveSlot)}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded transition-colors"
          >
            {status === 'drafting' ? '🟢 Join Live Draft' : '⏳ Start Waiting for Draft'}
          </button>

          {status === 'complete' && (
            <p className="text-xs text-slate-500 text-center">This draft is already complete — you can still view the board.</p>
          )}
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
  draftMeta: PropTypes.object,
  detectedSlot: PropTypes.number,
  onFetchDraft: PropTypes.func.isRequired,
  onConfirmAndStart: PropTypes.func.isRequired,
};
