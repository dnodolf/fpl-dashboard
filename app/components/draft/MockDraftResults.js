'use client';

/**
 * MockDraftResults — post-draft grade screen.
 *
 * Shows:
 *  - Letter grade (A+ to D) with efficiency percentage
 *  - My roster with per-pick grade
 *  - League team ranking
 *  - Archetype reveal
 *  - Play Again + Back to Board buttons
 */

import { useMemo } from 'react';
import PropTypes from 'prop-types';
import PlayerAvatar from '../common/PlayerAvatar';
import { getPositionBadgeStyle } from '../../constants/positionColors';
import { TEAM_DISPLAY_NAMES } from '../../constants/teams';
import { ARCHETYPES } from '../../services/mockDraftAiService';

// ─── Grade display helpers ────────────────────────────────────────────────────
const GRADE_STYLES = {
  'A+': { ring: 'ring-emerald-400', text: 'text-emerald-300', bg: 'bg-emerald-500/10', badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' },
  A:   { ring: 'ring-emerald-400', text: 'text-emerald-300', bg: 'bg-emerald-500/10', badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' },
  'B+':{ ring: 'ring-blue-400',    text: 'text-blue-300',    bg: 'bg-blue-500/10',    badge: 'bg-blue-500/20 text-blue-300 border-blue-500/40' },
  B:   { ring: 'ring-blue-400',    text: 'text-blue-300',    bg: 'bg-blue-500/10',    badge: 'bg-blue-500/20 text-blue-300 border-blue-500/40' },
  'C+':{ ring: 'ring-amber-400',   text: 'text-amber-300',   bg: 'bg-amber-500/10',   badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40' },
  C:   { ring: 'ring-amber-400',   text: 'text-amber-300',   bg: 'bg-amber-500/10',   badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40' },
  D:   { ring: 'ring-red-400',     text: 'text-red-300',     bg: 'bg-red-500/10',     badge: 'bg-red-500/20 text-red-300 border-red-500/40' },
};

function getGradeStyle(letter) {
  return GRADE_STYLES[letter] || GRADE_STYLES.D;
}

// ─── Per-pick VORP label badge ────────────────────────────────────────────────
const PICK_LABEL_STYLE = {
  '✓ Optimal':   'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
  'Good Value':  'bg-blue-500/20 text-blue-400 border-blue-500/40',
  'Minor Reach': 'bg-amber-500/20 text-amber-400 border-amber-500/40',
  'Reach':       'bg-orange-500/20 text-orange-400 border-orange-500/40',
  'Big Reach':   'bg-red-500/20 text-red-400 border-red-500/40',
};

function PickGradeBadge({ grade }) {
  if (!grade?.label) return null;
  const style = PICK_LABEL_STYLE[grade.label] || 'bg-slate-700 text-slate-400 border-slate-600';
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${style}`}>
      {grade.label}
    </span>
  );
}

// ─── Rank medal ───────────────────────────────────────────────────────────────
function RankMedal({ rank }) {
  if (rank === 1) return <span title="1st place">🥇</span>;
  if (rank === 2) return <span title="2nd place">🥈</span>;
  if (rank === 3) return <span title="3rd place">🥉</span>;
  return <span className="text-slate-400 font-bold">#{rank}</span>;
}

// ─── Main MockDraftResults ────────────────────────────────────────────────────
export default function MockDraftResults({ results, settings, draftState, onPlayAgain, onReset }) {
  if (!results) return null;

  const { myRoster, draftGrade, teamRanking, myRank, archetypes, archetypeNames } = results;
  const gradeStyle = getGradeStyle(draftGrade.letter);
  const { leagueSize } = settings;

  // Group my roster by position
  const rosterByPos = useMemo(() => {
    const g = { GKP: [], DEF: [], MID: [], FWD: [] };
    myRoster.forEach(p => {
      const pos = (p.position || '').toUpperCase();
      if (g[pos]) g[pos].push(p);
    });
    return g;
  }, [myRoster]);

  // Find per-pick grades from the grade object (pickAnalysis entries)
  const pickGradeMap = useMemo(() => {
    const map = {};
    draftGrade.pickAnalysis?.forEach(pg => {
      const id = pg.player?.sleeper_id || pg.player?.id;
      if (id) map[id] = pg;
    });
    return map;
  }, [draftGrade]);

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="text-center space-y-1">
        <h2 className="text-xl font-bold text-white">Draft Complete!</h2>
        <p className="text-sm text-slate-400">
          {leagueSize}-team draft · Position {settings.myDraftPosition} · {settings.scoringMode.toUpperCase()} scoring
        </p>
      </div>

      {/* Grade Hero */}
      <div className={`rounded-xl border p-6 ${gradeStyle.bg} ${gradeStyle.ring} ring-2 text-center space-y-2`}>
        <div className={`text-7xl font-black ${gradeStyle.text}`}>{draftGrade.letter}</div>
        <div className="text-sm text-slate-300">
          <span className="font-bold text-white">{(draftGrade.efficiency * 100).toFixed(1)}%</span>
          {' '}draft efficiency
        </div>
        <div className="text-xs text-slate-400">
          Your VORP: <span className="text-white font-medium">{draftGrade.totalMyVorp?.toFixed(1)}</span>
          {' '}·{' '}
          Optimal: <span className="text-white font-medium">{draftGrade.totalOptimalVorp?.toFixed(1)}</span>
        </div>
        <div className="pt-2">
          <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full ${gradeStyle.badge} border text-sm font-bold`}>
            <RankMedal rank={myRank} />
            <span>Ranked #{myRank} of {leagueSize} teams</span>
          </div>
        </div>
      </div>

      {/* My Roster */}
      <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-4 space-y-4">
        <h3 className="text-sm font-bold text-white">My Roster</h3>
        {Object.entries(rosterByPos).map(([pos, players]) => (
          players.length > 0 && (
            <div key={pos}>
              <div className="flex items-center gap-1.5 mb-2">
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${getPositionBadgeStyle(pos)}`}>{pos}</span>
                <span className="text-xs text-slate-500">{players.length} players</span>
              </div>
              <div className="space-y-1">
                {players.map(p => {
                  const id = p.sleeper_id || p.id;
                  const pg = pickGradeMap[id];
                  return (
                    <div key={id} className="flex items-center gap-3 py-1.5 px-2 rounded hover:bg-slate-700/30 transition-colors">
                      <PlayerAvatar player={p} size="sm" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm text-white font-medium truncate">{p.web_name || p.name}</span>
                          {pg && <PickGradeBadge grade={pg} />}
                        </div>
                        <div className="text-xs text-slate-500">
                          {TEAM_DISPLAY_NAMES[p.team_abbr] || p.team_abbr || p.team}
                          {pg?.overall && ` · Pick #${pg.overall}`}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-xs text-slate-300 font-medium">{p.draftProjection?.toFixed(1)}</div>
                        <div className="text-[10px] text-slate-500">VORP {p.draftVorp?.toFixed(1)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )
        ))}
      </div>

      {/* Team Rankings */}
      <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-4 space-y-3">
        <h3 className="text-sm font-bold text-white">Team Rankings</h3>
        <p className="text-xs text-slate-500">Ranked by total team VORP</p>
        <div className="space-y-2">
          {teamRanking.map((team, i) => {
            const rank = i + 1;
            const archKey = archetypes?.[team.teamIndex];
            const archName = archetypeNames?.[team.teamIndex] || ARCHETYPES[archKey]?.name || '';
            const isMe = team.isMe;
            return (
              <div
                key={team.teamIndex}
                className={`flex items-center gap-3 py-2 px-3 rounded-lg border transition-colors ${
                  isMe
                    ? 'bg-violet-900/20 border-violet-500/40'
                    : 'bg-slate-700/20 border-slate-700'
                }`}
              >
                <div className="w-8 text-center flex-shrink-0">
                  <RankMedal rank={rank} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-medium ${isMe ? 'text-violet-300' : 'text-slate-300'}`}>
                    {isMe ? '⭐ You' : `Team ${team.teamIndex + 1}`}
                  </div>
                  {!isMe && archName && (
                    <div className="text-[11px] text-slate-500">{archName}</div>
                  )}
                </div>
                <div className="text-right flex-shrink-0 space-y-0.5">
                  <div className="text-sm text-white font-bold">{team.totalVorp?.toFixed(1)}</div>
                  <div className="text-[10px] text-slate-500">VORP</div>
                </div>
                {/* Simple VORP bar */}
                <div className="w-20 bg-slate-800 rounded-full h-1.5 flex-shrink-0">
                  <div
                    className={`h-1.5 rounded-full transition-all ${isMe ? 'bg-violet-500' : 'bg-slate-500'}`}
                    style={{
                      width: `${Math.max(0, Math.min(100, ((team.totalVorp || 0) / (teamRanking[0]?.totalVorp || 1)) * 100))}%`
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Archetype Reveal */}
      {archetypes && Object.keys(archetypes).length > 0 && (
        <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-4 space-y-3">
          <h3 className="text-sm font-bold text-white">Opponent Archetypes Revealed</h3>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(archetypes).map(([ti, key]) => {
              const teamIndex = parseInt(ti);
              if (teamIndex === draftState?.myTeamIndex) return null;
              const arch = ARCHETYPES[key];
              if (!arch) return null;
              return (
                <div key={ti} className="bg-slate-700/30 rounded-lg p-2.5 border border-slate-700">
                  <div className="text-xs font-bold text-slate-300 mb-0.5">Team {teamIndex + 1}</div>
                  <div className="text-sm font-semibold text-white">{arch.name}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5 leading-snug">{arch.description}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* CTA Buttons */}
      <div className="flex flex-col sm:flex-row gap-3 justify-center pb-4">
        <button
          onClick={onPlayAgain}
          className="px-8 py-3 bg-violet-600 hover:bg-violet-500 text-white font-bold text-sm rounded-lg transition-colors shadow-lg"
        >
          Draft Again
        </button>
        <button
          onClick={onReset}
          className="px-8 py-3 bg-slate-700 hover:bg-slate-600 text-slate-300 font-medium text-sm rounded-lg transition-colors"
        >
          Back to Cheat Sheet
        </button>
      </div>
    </div>
  );
}

MockDraftResults.propTypes = {
  results: PropTypes.object,
  settings: PropTypes.object.isRequired,
  draftState: PropTypes.object,
  onPlayAgain: PropTypes.func.isRequired,
  onReset: PropTypes.func.isRequired,
};
