'use client';

import { useState, useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import { DEFAULT_USER_ID } from '../config/constants';

const LuckMeter = ({ luckScore, minLuck, maxLuck }) => {
  const scaleMin = Math.min(minLuck, -4);
  const scaleMax = Math.max(maxLuck, 4);
  const range = scaleMax - scaleMin;
  const position = ((luckScore - scaleMin) / range) * 100;
  const clampedPosition = Math.max(3, Math.min(97, position));
  const zeroPosition = ((0 - scaleMin) / range) * 100;

  const getColor = (score) => {
    if (score <= -2) return 'text-red-400';
    if (score < 0) return 'text-orange-400';
    if (score < 2) return 'text-yellow-400';
    return 'text-green-400';
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs text-slate-500">
        <span>Unlucky</span>
        <span>Lucky</span>
      </div>
      <div className="relative h-4 rounded-full bg-gradient-to-r from-red-900/60 via-gray-700 to-green-900/60 border border-slate-600">
        <div className="absolute top-0 bottom-0 w-px bg-slate-500" style={{ left: `${zeroPosition}%` }} />
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-white border-2 border-violet-400 shadow-lg shadow-violet-500/30 z-10"
          style={{ left: `${clampedPosition}%` }}
        />
      </div>
      <div className="text-center">
        <span className={`text-2xl font-bold ${getColor(luckScore)}`}>
          {luckScore > 0 ? '+' : ''}{luckScore.toFixed(1)}
        </span>
        <span className="text-sm text-slate-400 ml-2">expected wins differential</span>
      </div>
    </div>
  );
};

export default function ScheduleLuckContent({ userId = DEFAULT_USER_ID }) {
  const [standings, setStandings] = useState([]);
  const [loadingStandings, setLoadingStandings] = useState(true);
  const [allPlayData, setAllPlayData] = useState(null);
  const [loadingAllPlay, setLoadingAllPlay] = useState(true);

  useEffect(() => {
    fetch('/api/standings')
      .then(r => r.json())
      .then(data => setStandings(data.standings || []))
      .catch(() => {})
      .finally(() => setLoadingStandings(false));
  }, []);

  useEffect(() => {
    fetch('/api/all-play')
      .then(r => r.json())
      .then(data => { if (data.success) setAllPlayData(data); })
      .catch(() => {})
      .finally(() => setLoadingAllPlay(false));
  }, []);

  const luckData = useMemo(() => {
    if (!standings || standings.length === 0) return null;

    const byPoints = [...standings].sort((a, b) => b.pointsFor - a.pointsFor);
    const teams = standings.map((team, winsRankIndex) => {
      const totalGames = team.wins + team.losses + team.ties;
      if (totalGames === 0) {
        return { ...team, totalGames: 0, expectedWins: 0, luckScore: 0, pointsRank: 0, winsRank: 0, rankGap: 0, ppg: 0 };
      }
      const expectedWinRate = team.pointsFor / (team.pointsFor + team.pointsAgainst);
      const expectedWins = expectedWinRate * totalGames;
      const actualWinEquivalent = team.wins + (team.ties * 0.5);
      const luckScore = actualWinEquivalent - expectedWins;
      const pointsRank = byPoints.findIndex(t => t.roster_id === team.roster_id) + 1;
      const winsRank = winsRankIndex + 1;
      const rankGap = pointsRank - winsRank;
      return {
        ...team,
        totalGames,
        expectedWins: Math.round(expectedWins * 10) / 10,
        luckScore: Math.round(luckScore * 10) / 10,
        pointsRank,
        winsRank,
        rankGap,
        ppg: Math.round((team.pointsFor / totalGames) * 10) / 10,
      };
    });

    const sortedByLuck = [...teams].sort((a, b) => a.luckScore - b.luckScore);
    const minLuck = Math.min(...teams.map(t => t.luckScore));
    const maxLuck = Math.max(...teams.map(t => t.luckScore));
    const userLuck = teams.find(t => t.displayName === userId);
    return { teams: sortedByLuck, userLuck, minLuck, maxLuck };
  }, [standings, userId]);

  if (loadingStandings) {
    return <div className="text-center py-12 text-slate-400">Loading standings...</div>;
  }

  if (!luckData) {
    return <div className="text-center py-12 text-slate-500">No standings data available.</div>;
  }

  const hasAllPlay = allPlayData?.weeksPlayed > 0;
  const userAllPlay = hasAllPlay ? allPlayData?.allPlay?.find(a => a.displayName === userId) : null;
  const userApTotal = userAllPlay ? (userAllPlay.wins + userAllPlay.losses + userAllPlay.ties) : 0;
  const userApPct = userApTotal > 0 ? Math.round((userAllPlay.wins / userApTotal) * 1000) / 10 : 0;

  const userWeeks = hasAllPlay
    ? (allPlayData?.weeks
        ?.map(w => ({ week: w.week, ...w.rosters.find(r => r.displayName === userId) }))
        .filter(w => w.roster_id != null)
        .sort((a, b) => a.week - b.week) || [])
    : [];

  const apByName = {};
  (allPlayData?.allPlay || []).forEach(a => { apByName[a.displayName] = a; });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-white mb-1">Schedule Luck Analyzer</h2>
        <p className="text-xs text-slate-500">
          Pythagorean luck = actual wins minus expected wins (PF/PA ratio).
          All-play = how many managers you&apos;d have beaten each week.
        </p>
      </div>

      {/* Your Luck Card */}
      {luckData.userLuck && (
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-5">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-sm font-semibold text-violet-400">Your Luck Score</span>
            <span className="text-xs text-slate-500">
              {luckData.userLuck.wins}W from {luckData.userLuck.totalGames} games
              (expected {luckData.userLuck.expectedWins}W)
            </span>
          </div>
          <LuckMeter
            luckScore={luckData.userLuck.luckScore}
            minLuck={luckData.minLuck}
            maxLuck={luckData.maxLuck}
          />

          {userAllPlay && (
            <div className="mt-4 pt-4 border-t border-slate-700 grid grid-cols-3 gap-3 text-center">
              <div>
                <span className="text-xs text-slate-500 block mb-0.5">All-Play Record</span>
                <span className="text-base font-bold text-white">{userAllPlay.wins}-{userAllPlay.losses}</span>
                <span className="text-xs text-slate-400 ml-1">({userApPct}%)</span>
              </div>
              <div>
                <span className="text-xs text-slate-500 block mb-0.5">Actual Record</span>
                <span className="text-base font-bold text-white">{luckData.userLuck.wins}-{luckData.userLuck.losses}</span>
              </div>
              <div>
                <span className="text-xs text-slate-500 block mb-0.5">Tough-Luck Weeks</span>
                <span className="text-base font-bold text-red-400">
                  {userWeeks.filter(w => !w.won && !w.tied && w.all_play_wins >= Math.ceil(w.league_size / 2)).length}
                </span>
                <span className="text-xs text-slate-500 ml-1">losses</span>
              </div>
            </div>
          )}
          {loadingAllPlay && (
            <div className="mt-4 pt-4 border-t border-slate-700 text-center text-xs text-slate-500">
              Loading all-play data...
            </div>
          )}
          {!loadingAllPlay && allPlayData && allPlayData.weeksPlayed === 0 && (
            <div className="mt-4 pt-4 border-t border-slate-700 text-center text-xs text-slate-500">
              All-play data is not available for this league type.
            </div>
          )}
        </div>
      )}

      {/* Weekly Breakdown */}
      {userWeeks.length > 0 && (
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-5">
          <h3 className="text-xs font-semibold text-slate-400 uppercase mb-3">Your Weekly Breakdown</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-900">
                <tr>
                  <th className="px-3 py-2 text-center text-xs font-medium text-slate-400 uppercase">Wk</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-slate-400 uppercase">Your Pts</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-slate-400 uppercase">Opp Pts</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-slate-400 uppercase">Result</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-slate-400 uppercase">All-Play</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-slate-400 uppercase"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {userWeeks.map(w => {
                  const toughLuck = !w.won && !w.tied && w.all_play_wins >= Math.ceil(w.league_size / 2);
                  const luckyWin = (w.won || w.tied) && w.all_play_wins < Math.floor(w.league_size / 2);
                  const rowBg = toughLuck ? 'bg-red-950/30' : luckyWin ? 'bg-yellow-950/20' : w.won || w.tied ? 'bg-green-950/20' : '';
                  return (
                    <tr key={w.week} className={rowBg}>
                      <td className="px-3 py-2 text-center text-slate-400 font-mono text-xs">GW{w.week}</td>
                      <td className="px-3 py-2 text-right font-medium text-white">{w.points.toFixed(1)}</td>
                      <td className="px-3 py-2 text-right text-slate-400">{w.opponent_points.toFixed(1)}</td>
                      <td className="px-3 py-2 text-center">
                        <span className={`font-bold text-xs ${w.won ? 'text-green-400' : w.tied ? 'text-yellow-400' : 'text-red-400'}`}>
                          {w.won ? 'W' : w.tied ? 'T' : 'L'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center text-slate-300 text-xs">{w.all_play_wins}/{w.league_size - 1}</td>
                      <td className="px-3 py-2 text-center">
                        {toughLuck && <span className="text-[10px] bg-red-900/60 text-red-300 px-1.5 py-0.5 rounded font-medium">Tough Luck</span>}
                        {luckyWin && <span className="text-[10px] bg-yellow-900/40 text-yellow-300 px-1.5 py-0.5 rounded font-medium">Lucky W</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* League Luck Rankings */}
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-5">
        <h3 className="text-xs font-semibold text-slate-400 uppercase mb-3">League Luck Rankings</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-900">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-400 uppercase">#</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-400 uppercase">Manager</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-slate-400 uppercase">W-L</th>
                {hasAllPlay && <th className="px-3 py-2 text-center text-xs font-medium text-slate-400 uppercase">All-Play</th>}
                <th className="px-3 py-2 text-center text-xs font-medium text-slate-400 uppercase">PPG</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-slate-400 uppercase">Luck</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-slate-400 uppercase w-28"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {luckData.teams.map((team, index) => {
                const isUser = team.displayName === userId;
                const luckRange = (luckData.maxLuck - luckData.minLuck) || 1;
                const barPosition = ((team.luckScore - luckData.minLuck) / luckRange) * 100;
                const luckColor = team.luckScore <= -2 ? 'bg-red-500' : team.luckScore < 0 ? 'bg-orange-500' : team.luckScore < 2 ? 'bg-yellow-500' : 'bg-green-500';
                const textColor = team.luckScore <= -2 ? 'text-red-400' : team.luckScore < 0 ? 'text-orange-400' : team.luckScore < 2 ? 'text-yellow-400' : 'text-green-400';
                const ap = apByName[team.displayName];
                const apTotal = ap ? (ap.wins + ap.losses + ap.ties) : 0;
                const apPct = apTotal > 0 ? Math.round((ap.wins / apTotal) * 1000) / 10 : null;

                return (
                  <tr key={team.roster_id} className={isUser ? 'bg-violet-900/30 border-l-4 border-violet-500' : 'hover:bg-slate-700/50'}>
                    <td className="px-3 py-2 text-slate-500">{index + 1}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className={`font-medium ${isUser ? 'text-violet-400' : 'text-white'}`}>{team.displayName}</span>
                        {isUser && <span className="text-[10px] bg-violet-600 text-white px-1.5 py-0.5 rounded">You</span>}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center text-slate-300">{team.wins}-{team.losses}</td>
                    {hasAllPlay && (
                      <td className="px-3 py-2 text-center text-slate-300">
                        {ap ? <span>{ap.wins}-{ap.losses} <span className="text-xs text-slate-500">({apPct}%)</span></span> : <span className="text-slate-600">—</span>}
                      </td>
                    )}
                    <td className="px-3 py-2 text-center text-slate-300">{team.ppg}</td>
                    <td className={`px-3 py-2 text-center font-bold ${textColor}`}>
                      {team.luckScore > 0 ? '+' : ''}{team.luckScore}
                    </td>
                    <td className="px-3 py-2">
                      <div className="relative h-2 bg-slate-700 rounded-full w-full">
                        <div className="absolute top-0 bottom-0 left-1/2 w-px bg-slate-500" />
                        <div
                          className={`absolute top-0 h-full rounded-full ${luckColor}`}
                          style={{
                            left: barPosition < 50 ? `${barPosition}%` : '50%',
                            width: `${Math.abs(barPosition - 50)}%`,
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

ScheduleLuckContent.propTypes = {
  userId: PropTypes.string,
};
