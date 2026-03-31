'use client';

import { useState } from 'react';
import PropTypes from 'prop-types';
import AppLogo from './common/AppLogo';

/**
 * SetupModal - First-run onboarding modal.
 * User pastes Sleeper league ID → validates → picks their roster → saves config.
 */
const SetupModal = ({ onComplete }) => {
  const [step, setStep] = useState(1); // 1: league ID, 2: pick roster
  const [leagueId, setLeagueId] = useState('');
  const [leagueInfo, setLeagueInfo] = useState(null);
  const [rosterOwners, setRosterOwners] = useState([]);
  const [selectedOwner, setSelectedOwner] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleValidateLeague = async (e) => {
    e.preventDefault();
    if (!leagueId.trim()) {
      setError('Please enter a Sleeper league ID.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/validate-league', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leagueId: leagueId.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to validate league.');
        setLoading(false);
        return;
      }

      setLeagueInfo(data.league);
      setRosterOwners(data.rosterOwners);
      setStep(2);
    } catch {
      setError('Network error. Please check your connection and try again.');
    }
    setLoading(false);
  };

  const handleSelectRoster = () => {
    if (!selectedOwner) {
      setError('Please select your roster.');
      return;
    }

    onComplete({
      leagueId: leagueInfo.id,
      leagueName: leagueInfo.name,
      userId: selectedOwner.displayName,
      rosterOwners,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-800 via-slate-750 to-slate-800 p-6 text-center border-b border-slate-700">
          <div className="flex justify-center mb-3">
            <AppLogo size={48} />
          </div>
          <h1 className="text-xl font-bold text-white">Fantasy FC Playbook</h1>
          <p className="text-slate-400 text-sm mt-1">Connect your Sleeper league to get started</p>
        </div>

        {/* Body */}
        <div className="p-6">
          {step === 1 && (
            <form onSubmit={handleValidateLeague}>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Sleeper League ID
              </label>
              <p className="text-xs text-slate-500 mb-3">
                Find this in your Sleeper app under League Settings, or copy it from your league URL.
              </p>
              <input
                type="text"
                value={leagueId}
                onChange={(e) => setLeagueId(e.target.value)}
                placeholder="e.g. 1240184286171107328"
                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent text-sm"
                autoFocus
                disabled={loading}
              />
              {error && (
                <p className="text-red-400 text-xs mt-2">{error}</p>
              )}
              <button
                type="submit"
                disabled={loading || !leagueId.trim()}
                className="w-full mt-4 px-4 py-3 bg-violet-600 hover:bg-violet-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors text-sm"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                    Validating...
                  </span>
                ) : (
                  'Connect League'
                )}
              </button>
            </form>
          )}

          {step === 2 && leagueInfo && (
            <div>
              {/* League confirmation */}
              <div className="bg-slate-700/50 rounded-lg p-3 mb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white font-medium text-sm">{leagueInfo.name}</p>
                    <p className="text-slate-400 text-xs">
                      {leagueInfo.season} &middot; {leagueInfo.totalRosters} teams
                    </p>
                  </div>
                  <button
                    onClick={() => { setStep(1); setError(''); }}
                    className="text-xs text-blue-400 hover:text-blue-300"
                  >
                    Change
                  </button>
                </div>
              </div>

              <label className="block text-sm font-medium text-slate-300 mb-2">
                Select Your Team
              </label>
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {rosterOwners.map((owner) => (
                  <button
                    key={owner.rosterId}
                    onClick={() => { setSelectedOwner(owner); setError(''); }}
                    className={`w-full text-left px-4 py-3 rounded-lg border transition-all text-sm ${
                      selectedOwner?.rosterId === owner.rosterId
                        ? 'border-blue-500 bg-blue-500/20 text-white'
                        : 'border-slate-600 bg-slate-700/50 text-slate-300 hover:border-slate-500 hover:bg-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{owner.displayName}</span>
                      <span className="text-xs text-slate-400">
                        {owner.playerCount} players &middot; {owner.wins}W-{owner.losses}L
                      </span>
                    </div>
                  </button>
                ))}
              </div>

              {error && (
                <p className="text-red-400 text-xs mt-2">{error}</p>
              )}

              <button
                onClick={handleSelectRoster}
                disabled={!selectedOwner}
                className="w-full mt-4 px-4 py-3 bg-green-600 hover:bg-green-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors text-sm"
              >
                Let&apos;s Go
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

SetupModal.propTypes = {
  onComplete: PropTypes.func.isRequired,
};

export default SetupModal;
