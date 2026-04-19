'use client';

import { useState, useEffect, useMemo } from 'react';
import { getNextNGameweeksTotal } from '../utils/predictionUtils';
import { getSleeperPositionBadgeClasses } from '../../utils/positionUtils';
import { getPlayerName } from '../utils/playerUtils';
import { getDifficultyColor } from '../constants/designTokens';
import { getFPLStatusBadge } from '../utils/newsUtils';
import PlayerAvatar from './common/PlayerAvatar';

// ─── Data hook ────────────────────────────────────────────────────
function useScoutData(scoringMode, currentGameweek) {
  const [data, setData] = useState({ loading: true, error: null, teams: [] });

  const fetchData = async (forceRefresh = false) => {
    try {
      setData(prev => ({ ...prev, loading: true, error: null }));
      const res = await fetch('/api/scout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scoringMode,
          currentGameweek: currentGameweek?.number,
          forceRefresh
        })
      });
      if (!res.ok) throw new Error(`Scout API failed: ${res.status}`);
      const result = await res.json();
      if (!result.success) throw new Error(result.error || 'Scout analysis failed');
      setData({ loading: false, error: null, teams: result.teams });
    } catch (err) {
      console.error('Scout fetch error:', err);
      setData(prev => ({ ...prev, loading: false, error: err.message }));
    }
  };

  useEffect(() => {
    if (currentGameweek?.number) fetchData();
  }, [scoringMode, currentGameweek?.number]);

  return { ...data, refetch: fetchData };
}

// ─── Position group helpers ───────────────────────────────────────
const POS_ORDER = ['FWD', 'MID', 'DEF', 'GKP'];

function groupByPosition(players) {
  const groups = { GKP: [], DEF: [], MID: [], FWD: [] };
  (players || []).forEach(p => {
    const pos = p.position || 'MID';
    if (groups[pos]) groups[pos].push(p);
  });
  return groups;
}

function sumPoints(players, scoringMode, gw) {
  return (players || []).reduce((sum, p) => {
    return sum + getNextNGameweeksTotal(p, scoringMode, gw, 1);
  }, 0);
}

// ─── Compact player pill ─────────────────────────────────────────
const PlayerPill = ({ player, scoringMode, currentGW, onPlayerClick }) => {
  const pts = getNextNGameweeksTotal(player, scoringMode, currentGW, 1);
  const fplBadge = player.fpl_status && player.fpl_status !== 'a' ? getFPLStatusBadge(player.fpl_status) : null;

  // Get next opponent
  let opp = null;
  if (player.predictions?.length) {
    const pred = player.predictions.find(p => p.gw === currentGW);
    if (pred?.opp?.[0] && Array.isArray(pred.opp[0])) {
      const [code, full, diff] = pred.opp[0];
      opp = { code: (code || '').toUpperCase(), isHome: (full || '').includes('(H)'), difficulty: diff || 3 };
    }
  }

  return (
    <button
      onClick={() => onPlayerClick?.(player)}
      className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-700/60 hover:bg-slate-600/60 transition-colors text-xs group"
    >
      <PlayerAvatar player={player} size="xs" />
      <span className="font-medium text-white truncate max-w-[80px]">{getPlayerName(player)}</span>
      {fplBadge && (
        <span className={`text-[8px] px-1 rounded ${fplBadge.color}`}>{fplBadge.icon}</span>
      )}
      {opp && (
        <span className={`px-1 rounded text-[9px] font-medium ${getDifficultyColor(opp.difficulty)}`}>
          {opp.code}{opp.isHome ? '(H)' : '(A)'}
        </span>
      )}
      {player.opta_stats && Number(player.opta_stats.xg || 0) >= 1 && (
        <span className="text-[8px] text-yellow-500" title={`xG: ${Number(player.opta_stats.xg).toFixed(1)}, xA: ${Number(player.opta_stats.xa || 0).toFixed(1)}`}>
          xG {Number(player.opta_stats.xg).toFixed(1)}
        </span>
      )}
      <span className="font-bold text-green-400 ml-auto">{pts.toFixed(1)}</span>
    </button>
  );
};

// ─── League Projection Table ──────────────────────────────────────
const LeagueTable = ({ teams, myDisplayName, onSelectRival }) => {
  return (
    <div className="rounded-lg border bg-slate-800 border-slate-700 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-600 text-slate-400 text-xs uppercase">
            <th className="px-3 py-3 text-left w-8">#</th>
            <th className="px-3 py-3 text-left">Team</th>
            <th className="px-3 py-3 text-center">Proj Pts</th>
            <th className="px-3 py-3 text-center hidden sm:table-cell">Formation</th>
            <th className="px-3 py-3 text-center hidden md:table-cell">Record</th>
            <th className="px-3 py-3 text-center hidden md:table-cell">PF</th>
            <th className="px-3 py-3 text-center hidden sm:table-cell">Injuries</th>
            <th className="px-3 py-3 text-center w-20">Action</th>
          </tr>
        </thead>
        <tbody>
          {teams.map((team, idx) => {
            const isMe = team.displayName.toLowerCase() === myDisplayName.toLowerCase();
            return (
              <tr
                key={team.roster_id}
                className={`border-b border-slate-700/50 transition-colors ${
                  isMe
                    ? 'bg-violet-900/30 border-l-4 border-l-violet-500'
                    : 'hover:bg-slate-700/40'
                }`}
              >
                <td className="px-3 py-3 text-slate-400 font-mono">{idx + 1}</td>
                <td className="px-3 py-3">
                  <div className="font-medium text-white">{team.displayName}</div>
                  <div className="text-xs text-slate-500">{team.rosterSize} players</div>
                </td>
                <td className="px-3 py-3 text-center">
                  <span className={`font-bold text-lg ${isMe ? 'text-violet-400' : 'text-white'}`}>
                    {team.projectedPoints.toFixed(1)}
                  </span>
                </td>
                <td className="px-3 py-3 text-center hidden sm:table-cell text-slate-300">
                  {team.optimalFormation}
                </td>
                <td className="px-3 py-3 text-center hidden md:table-cell text-slate-400">
                  {team.wins}-{team.losses}{team.ties ? `-${team.ties}` : ''}
                </td>
                <td className="px-3 py-3 text-center hidden md:table-cell text-slate-400">
                  {team.pointsFor}
                </td>
                <td className="px-3 py-3 text-center hidden sm:table-cell">
                  {team.injuries.length > 0 ? (
                    <span className="text-red-400 font-medium">{team.injuries.length}</span>
                  ) : (
                    <span className="text-green-400">0</span>
                  )}
                </td>
                <td className="px-3 py-3 text-center">
                  {!isMe && (
                    <button
                      onClick={() => onSelectRival(team)}
                      className="px-3 py-1 text-xs font-medium rounded bg-slate-600 hover:bg-slate-500 text-white transition-colors"
                    >
                      Scout
                    </button>
                  )}
                  {isMe && (
                    <span className="px-3 py-1 text-xs font-medium rounded bg-violet-600 text-white">You</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

// ─── H2H Scouting View ───────────────────────────────────────────
const H2HScoutView = ({ myTeam, rival, scoringMode, currentGW, onBack, onPlayerClick }) => {
  const myGroups = groupByPosition(myTeam.optimalXI);
  const rivalGroups = groupByPosition(rival.optimalXI);

  const myTotal = myTeam.projectedPoints;
  const rivalTotal = rival.projectedPoints;
  const diff = myTotal - rivalTotal;

  // Position matchups
  const matchups = POS_ORDER.map(pos => {
    const myPts = myGroups[pos].reduce((s, p) => s + getNextNGameweeksTotal(p, scoringMode, currentGW, 1), 0);
    const rivalPts = rivalGroups[pos].reduce((s, p) => s + getNextNGameweeksTotal(p, scoringMode, currentGW, 1), 0);
    return { pos, myPlayers: myGroups[pos], rivalPlayers: rivalGroups[pos], myPts, rivalPts, diff: myPts - rivalPts };
  });

  const edges = matchups.filter(m => m.diff > 0.3);
  const vulnerabilities = matchups.filter(m => m.diff < -0.3);

  // Rival's top 3 scorers
  const rivalTop3 = [...rival.optimalXI]
    .sort((a, b) => getNextNGameweeksTotal(b, scoringMode, currentGW, 1) - getNextNGameweeksTotal(a, scoringMode, currentGW, 1))
    .slice(0, 3);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="px-3 py-1.5 text-sm rounded bg-slate-700 hover:bg-slate-600 text-white transition-colors">
          ← Back
        </button>
        <h3 className="text-lg font-bold text-white flex-1 text-center">
          {myTeam.displayName} vs {rival.displayName}
        </h3>
      </div>

      {/* Score comparison banner */}
      <div className="grid grid-cols-3 gap-4 text-center">
        <div className="bg-violet-900/30 border border-violet-700/50 rounded-lg p-4">
          <div className="text-sm text-violet-300 mb-1">{myTeam.displayName}</div>
          <div className="text-3xl font-bold text-violet-400">{myTotal.toFixed(1)}</div>
          <div className="text-xs text-slate-400 mt-1">{myTeam.optimalFormation}</div>
        </div>
        <div className="flex items-center justify-center">
          <div className={`text-2xl font-bold ${diff > 0 ? 'text-green-400' : diff < 0 ? 'text-red-400' : 'text-slate-400'}`}>
            {diff > 0 ? '+' : ''}{diff.toFixed(1)}
          </div>
        </div>
        <div className="bg-red-900/20 border border-red-700/40 rounded-lg p-4">
          <div className="text-sm text-red-300 mb-1">{rival.displayName}</div>
          <div className="text-3xl font-bold text-red-400">{rivalTotal.toFixed(1)}</div>
          <div className="text-xs text-slate-400 mt-1">{rival.optimalFormation}</div>
        </div>
      </div>

      {/* Position-by-position matchup */}
      <div className="rounded-lg border bg-slate-800 border-slate-700 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-600">
          <h4 className="text-sm font-semibold text-white uppercase">Position Matchups</h4>
        </div>
        <div className="divide-y divide-gray-700/50">
          {matchups.map(m => (
            <div key={m.pos} className="grid grid-cols-[1fr_auto_1fr] gap-2 p-3 items-start">
              {/* My players */}
              <div className="space-y-1">
                {m.myPlayers.map((p, i) => (
                  <PlayerPill key={i} player={p} scoringMode={scoringMode} currentGW={currentGW} onPlayerClick={onPlayerClick} />
                ))}
                {m.myPlayers.length === 0 && <div className="text-xs text-slate-500 italic">None</div>}
              </div>

              {/* Position badge + diff */}
              <div className="flex flex-col items-center gap-1 min-w-[60px]">
                <span className={`px-2 py-0.5 rounded text-xs font-bold ${getSleeperPositionBadgeClasses(m.pos)}`}>
                  {m.pos}
                </span>
                <span className={`text-sm font-bold ${
                  m.diff > 0.3 ? 'text-green-400' : m.diff < -0.3 ? 'text-red-400' : 'text-slate-400'
                }`}>
                  {m.diff > 0 ? '+' : ''}{m.diff.toFixed(1)}
                </span>
              </div>

              {/* Rival players */}
              <div className="space-y-1">
                {m.rivalPlayers.map((p, i) => (
                  <PlayerPill key={i} player={p} scoringMode={scoringMode} currentGW={currentGW} onPlayerClick={onPlayerClick} />
                ))}
                {m.rivalPlayers.length === 0 && <div className="text-xs text-slate-500 italic">None</div>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Edges & Vulnerabilities + Key Threats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Edges & Vulnerabilities */}
        <div className="rounded-lg border bg-slate-800 border-slate-700 p-4 space-y-3">
          <h4 className="text-sm font-semibold text-white uppercase">Your Edges</h4>
          {edges.length === 0 && <p className="text-xs text-slate-500">No clear edges this GW</p>}
          {edges.map(e => (
            <div key={e.pos} className="flex items-center justify-between text-sm">
              <span className={`px-2 py-0.5 rounded text-xs font-bold ${getSleeperPositionBadgeClasses(e.pos)}`}>{e.pos}</span>
              <span className="text-green-400 font-bold">+{e.diff.toFixed(1)} pts</span>
            </div>
          ))}

          <h4 className="text-sm font-semibold text-white uppercase pt-2">Vulnerabilities</h4>
          {vulnerabilities.length === 0 && <p className="text-xs text-slate-500">No weak spots this GW</p>}
          {vulnerabilities.map(v => (
            <div key={v.pos} className="flex items-center justify-between text-sm">
              <span className={`px-2 py-0.5 rounded text-xs font-bold ${getSleeperPositionBadgeClasses(v.pos)}`}>{v.pos}</span>
              <span className="text-red-400 font-bold">{v.diff.toFixed(1)} pts</span>
            </div>
          ))}
        </div>

        {/* Key threats + rival injuries */}
        <div className="rounded-lg border bg-slate-800 border-slate-700 p-4 space-y-3">
          <h4 className="text-sm font-semibold text-white uppercase">Key Threats</h4>
          {rivalTop3.map((p, i) => {
            const pts = getNextNGameweeksTotal(p, scoringMode, currentGW, 1);
            return (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className="text-slate-500 w-4">{i === 0 ? '1.' : i === 1 ? '2.' : '3.'}</span>
                <PlayerAvatar player={p} size="xs" />
                <span className="text-white font-medium truncate flex-1">{getPlayerName(p)}</span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${getSleeperPositionBadgeClasses(p.position)}`}>{p.position}</span>
                <span className="text-red-400 font-bold">{pts.toFixed(1)}</span>
                {p.opta_stats && (
                  <span className="text-[10px] text-slate-500" title={`xG: ${Number(p.opta_stats.xg || 0).toFixed(1)}, xA: ${Number(p.opta_stats.xa || 0).toFixed(1)}, Shots: ${p.opta_stats.shots || 0}`}>
                    xG {Number(p.opta_stats.xg || 0).toFixed(1)}
                  </span>
                )}
              </div>
            );
          })}

          {rival.injuries.length > 0 && (
            <>
              <h4 className="text-sm font-semibold text-white uppercase pt-2">Rival Injuries</h4>
              {rival.injuries.map((inj, i) => {
                const badge = getFPLStatusBadge(inj.status);
                return (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    {badge && <span className={`px-1 rounded ${badge.color}`}>{badge.icon}</span>}
                    <span className="text-slate-300">{inj.name}</span>
                    <span className="text-slate-500">{inj.position}</span>
                    {inj.news && <span className="text-slate-500 truncate ml-auto max-w-[150px]" title={inj.news}>{inj.news}</span>}
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Main export ──────────────────────────────────────────────────
const ScoutTabContent = ({ players, currentGameweek, scoringMode = 'ffh', onPlayerClick, userId }) => {
  const { loading, error, teams, refetch } = useScoutData(scoringMode, currentGameweek);
  const [selectedRival, setSelectedRival] = useState(null);

  // Find my team
  const myTeam = useMemo(() => {
    return teams.find(t => t.displayName.toLowerCase() === userId.toLowerCase());
  }, [teams]);

  const currentGW = currentGameweek?.number || 1;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-500 mr-3"></div>
        <span className="text-white">Scouting the league...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border bg-slate-800 border-slate-700 p-6 text-center">
        <div className="text-red-500 text-4xl mb-2">❌</div>
        <p className="text-slate-400 mb-4">{error}</p>
        <button onClick={() => refetch(true)} className="bg-violet-500 hover:bg-violet-600 text-white px-4 py-2 rounded-lg transition-colors">
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* GW Header */}
      <div className="bg-gradient-to-r from-purple-600 to-purple-700 rounded-lg shadow-lg p-6 text-center border border-purple-500">
        <div className="flex items-center justify-center gap-3">
          <span className="text-4xl">🔍</span>
          <div>
            <h2 className="text-3xl font-bold text-white">Gameweek {currentGW}</h2>
            <p className="text-purple-100 text-sm mt-1">League Scouting Report</p>
          </div>
        </div>
      </div>

      {selectedRival && myTeam ? (
        <H2HScoutView
          myTeam={myTeam}
          rival={selectedRival}
          scoringMode={scoringMode}
          currentGW={currentGW}
          onBack={() => setSelectedRival(null)}
          onPlayerClick={onPlayerClick}
        />
      ) : (
        <>
          {/* Projection summary */}
          {myTeam && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 text-center">
                <div className="text-xs text-slate-400 uppercase">Your Projected</div>
                <div className="text-2xl font-bold text-violet-400">{myTeam.projectedPoints.toFixed(1)}</div>
              </div>
              <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 text-center">
                <div className="text-xs text-slate-400 uppercase">League Rank</div>
                <div className="text-2xl font-bold text-white">
                  {teams.findIndex(t => t.roster_id === myTeam.roster_id) + 1}<span className="text-sm text-slate-400">/{teams.length}</span>
                </div>
              </div>
              <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 text-center">
                <div className="text-xs text-slate-400 uppercase">League Avg</div>
                <div className="text-2xl font-bold text-slate-300">
                  {(teams.reduce((s, t) => s + t.projectedPoints, 0) / teams.length).toFixed(1)}
                </div>
              </div>
              <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 text-center">
                <div className="text-xs text-slate-400 uppercase">vs Leader</div>
                <div className={`text-2xl font-bold ${teams[0]?.roster_id === myTeam.roster_id ? 'text-green-400' : 'text-red-400'}`}>
                  {teams[0]?.roster_id === myTeam.roster_id
                    ? 'You'
                    : `${(myTeam.projectedPoints - teams[0].projectedPoints).toFixed(1)}`
                  }
                </div>
              </div>
            </div>
          )}

          <LeagueTable teams={teams} myDisplayName={userId} onSelectRival={setSelectedRival} />

          <div className="text-center">
            <button
              onClick={() => refetch(true)}
              className="bg-violet-500 hover:bg-violet-600 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 mx-auto"
            >
              🔄 Refresh Scouting
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default ScoutTabContent;
