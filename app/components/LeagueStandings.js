// app/components/LeagueStandings.js
'use client';

import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';

const LeagueStandings = ({ currentUserId = 'ThatDerekGuy' }) => {
  const [standings, setStandings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isExpanded, setIsExpanded] = useState(false);

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
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-3">
        <div className="text-sm text-gray-400">Loading standings...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-3">
        <div className="text-sm text-red-400">Failed to load standings</div>
      </div>
    );
  }

  // Find current user's standing
  const userStanding = standings.find(s => s.displayName === currentUserId);
  const userRank = userStanding ? standings.indexOf(userStanding) + 1 : null;

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-lg">
      {/* Header - Always Visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-700 transition-colors rounded-t-lg"
      >
        <div className="flex items-center gap-3">
          <span className="text-xl">🏆</span>
          <div className="text-left">
            <div className="text-sm font-bold text-white">League Standings</div>
            {userRank && (
              <div className="text-xs text-gray-400">
                You're #{userRank} • {userStanding.wins}-{userStanding.losses}
                {userStanding.ties > 0 && `-${userStanding.ties}`}
              </div>
            )}
          </div>
        </div>
        <span className="text-gray-400 text-sm">
          {isExpanded ? '▼' : '▶'}
        </span>
      </button>

      {/* Expanded Standings Table */}
      {isExpanded && (
        <div className="border-t border-gray-700">
          <table className="w-full text-sm">
            <thead className="bg-gray-900">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase">#</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase">Team</th>
                <th className="px-4 py-2 text-center text-xs font-medium text-gray-400 uppercase">W-L-T</th>
                <th className="px-4 py-2 text-center text-xs font-medium text-gray-400 uppercase">PF</th>
                <th className="px-4 py-2 text-center text-xs font-medium text-gray-400 uppercase">PA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {standings.map((team, index) => {
                const isCurrentUser = team.displayName === currentUserId;
                return (
                  <tr
                    key={team.roster_id}
                    className={`${
                      isCurrentUser
                        ? 'bg-blue-900/30 border-l-4 border-blue-500'
                        : 'hover:bg-gray-700'
                    }`}
                  >
                    <td className="px-4 py-2 text-gray-300 font-medium">
                      {index + 1}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <span className={`font-medium ${isCurrentUser ? 'text-blue-400' : 'text-white'}`}>
                          {team.displayName}
                        </span>
                        {isCurrentUser && (
                          <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded">You</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-center text-gray-300">
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
      )}
    </div>
  );
};

LeagueStandings.propTypes = {
  currentUserId: PropTypes.string
};

export default LeagueStandings;
