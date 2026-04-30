'use client';

import { useState } from 'react';
import PropTypes from 'prop-types';
import LeagueStandings from './LeagueStandings';
import ScoutTabContent from './ScoutTabContent';
import ScheduleLuckContent from './ScheduleLuckContent';

const TABS = [
  { key: 'standings',    label: 'Standings' },
  { key: 'scout',        label: 'Scout' },
  { key: 'scheduleLuck', label: 'Schedule Luck' },
  { key: 'reporting',    label: 'Reporting' },
  { key: 'seasonReview', label: 'Season Review' },
];

const ComingSoonPlaceholder = ({ title, description }) => (
  <div className="flex flex-col items-center justify-center py-20 text-center">
    <div className="text-4xl mb-4">📊</div>
    <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
    <p className="text-sm text-slate-400 max-w-sm">{description}</p>
    <span className="mt-4 text-xs bg-violet-900/40 text-violet-300 border border-violet-700/50 px-3 py-1 rounded-full">
      Coming Soon
    </span>
  </div>
);

export default function LeagueTabContent({ players, currentGameweek, scoringMode, onPlayerClick, userId }) {
  const [activeSubTab, setActiveSubTab] = useState('standings');

  return (
    <div className="space-y-4">
      {/* Sub-tab bar */}
      <div className="flex items-center gap-1 border-b border-slate-700 pb-2">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveSubTab(t.key)}
            className={`px-4 py-1.5 text-sm font-medium rounded-t transition-colors ${
              activeSubTab === t.key
                ? 'bg-violet-600 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeSubTab === 'standings' && (
        <LeagueStandings currentUserId={userId} />
      )}

      {activeSubTab === 'scout' && (
        <ScoutTabContent
          players={players}
          currentGameweek={currentGameweek}
          scoringMode={scoringMode}
          onPlayerClick={onPlayerClick}
          userId={userId}
        />
      )}

      {activeSubTab === 'scheduleLuck' && (
        <ScheduleLuckContent userId={userId} />
      )}

      {activeSubTab === 'reporting' && (
        <ComingSoonPlaceholder
          title="Reporting"
          description="League-wide analytics including manager profiles, player value rankings, GW projection leaderboards, and squad health reports."
        />
      )}

      {activeSubTab === 'seasonReview' && (
        <ComingSoonPlaceholder
          title="Season Review"
          description="End-of-season recap: top performers, best value picks, biggest surprises, and a full year-in-review breakdown."
        />
      )}
    </div>
  );
}

LeagueTabContent.propTypes = {
  players: PropTypes.array.isRequired,
  currentGameweek: PropTypes.object,
  scoringMode: PropTypes.string.isRequired,
  onPlayerClick: PropTypes.func,
  userId: PropTypes.string,
};
