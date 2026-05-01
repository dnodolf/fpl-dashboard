// app/components/LeagueStandings.js
'use client';

import { useState, useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import { DEFAULT_USER_ID } from '../config/constants';

const LeagueStandings = ({ currentUserId = DEFAULT_USER_ID }) => {
  const [standings, setStandings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortKey, setSortKey] = useState(null); // null = default API order (wins-based)
  const [sortDir, setSortDir] = useState('desc');

  useEffect(() => {
    const fetchStandings = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/standings', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
          }
        });

        if (!response.ok) {
          throw new Error('Failed to fetch standings');
        }

        const data = await response.json();
        setStandings(data.standings || []);
      } catch (err) {
        console.error('Error fetching standings:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchStandings();
  }, []); // Fetches on mount - will get fresh data from Sleeper API

  if (loading) {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-3">
        <div className="text-sm text-slate-400">Loading standings...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-3">
        <div className="text-sm text-red-400">Failed to load standings</div>
      </div>
    );
  }

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const sortedStandings = useMemo(() => {
    if (!sortKey) return standings;
    return [...standings].sort((a, b) => {
      const aVal = sortKey === 'wlt' ? a.wins + a.ties * 0.5
                 : sortKey === 'pf'  ? a.pointsFor
                 :                     a.pointsAgainst;
      const bVal = sortKey === 'wlt' ? b.wins + b.ties * 0.5
                 : sortKey === 'pf'  ? b.pointsFor
                 :                     b.pointsAgainst;
      return sortDir === 'desc' ? bVal - aVal : aVal - bVal;
    });
  }, [standings, sortKey, sortDir]);

  // userRank always reflects the original standings order (Sleeper's wins-based rank)
  const userStanding = standings.find(s => s.displayName === currentUserId);
  const userRank = userStanding ? standings.indexOf(userStanding) + 1 : null;

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg shadow-lg">
      {/* Header */}
      <div className="px-4 py-3 flex items-center gap-3 border-b border-slate-700">
        <span className="text-xl">🏆</span>
        <div>
          <div className="text-sm font-bold text-white">League Standings</div>
          {userRank && (
            <div className="text-xs text-slate-400">
              You&apos;re #{userRank} • {userStanding.wins}-{userStanding.losses}
              {userStanding.ties > 0 && `-${userStanding.ties}`}
            </div>
          )}
        </div>
      </div>

      {/* Standings Table */}
      <div>
        <table className="w-full text-sm">
          <thead className="bg-slate-900">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-slate-400 uppercase">#</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-slate-400 uppercase">Team</th>
              {[
                { key: 'wlt', label: 'W-L-T' },
                { key: 'pf',  label: 'PF' },
                { key: 'pa',  label: 'PA' },
              ].map(col => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className="px-4 py-2 text-center text-xs font-medium text-slate-400 uppercase cursor-pointer select-none hover:text-white transition-colors"
                >
                  {col.label}
                  <span className="ml-1 inline-block w-3 text-center">
                    {sortKey === col.key
                      ? (sortDir === 'desc' ? '▼' : '▲')
                      : <span className="opacity-30">⇅</span>}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {sortedStandings.map((team, index) => {
                const isCurrentUser = team.displayName === currentUserId;
                return (
                  <tr
                    key={team.roster_id}
                    className={`${
                      isCurrentUser
                        ? 'bg-violet-900/30 border-l-4 border-violet-500'
                        : 'hover:bg-slate-700'
                    }`}
                  >
                    <td className="px-4 py-2 text-slate-300 font-medium">
                      {index + 1}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <span className={`font-medium ${isCurrentUser ? 'text-violet-400' : 'text-white'}`}>
                          {team.displayName}
                        </span>
                        {isCurrentUser && (
                          <span className="text-xs bg-violet-600 text-white px-2 py-0.5 rounded">You</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-center text-slate-300">
                      {team.wins}-{team.losses}
                      {team.ties > 0 && `-${team.ties}`}
                    </td>
                    <td className="px-4 py-2 text-center text-green-400 font-medium">
                      {team.pointsFor.toFixed(1)}
                    </td>
                    <td className="px-4 py-2 text-center text-red-400 font-medium">
                      {team.pointsAgainst.toFixed(1)}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

LeagueStandings.propTypes = {
  currentUserId: PropTypes.string
};

export default LeagueStandings;
