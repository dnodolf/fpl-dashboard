/**
 * DraftAnalysisPanel Component (Phase 1.5)
 * Analyzes actual draft data from Sleeper to generate strategy insights.
 * Structured as: Overview -> Key Takeaways -> Position Demand -> Steals & Reaches -> Manager Grades -> Full Recap
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import { getPositionBadgeStyle, POSITION_COLORS } from '../../constants/positionColors';
import { analyzeDraft } from '../../services/draftAnalysisService';

// ─── Overview Stats Bar ─────────────────────────────────────────────────────
const OverviewBar = ({ overview, positionDemand }) => (
  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
    {positionDemand.map(pd => (
      <div key={pd.position} className="bg-slate-800/50 rounded-lg border border-slate-700 p-3 text-center">
        <span className={`px-2 py-0.5 rounded text-xs font-bold border ${getPositionBadgeStyle(pd.position)}`}>
          {pd.position}
        </span>
        <div className="text-lg font-bold text-white mt-1.5">{pd.count}</div>
        <div className="text-[10px] text-slate-500 leading-tight">
          {pd.count > 0 ? (
            <>First: pick #{pd.firstPick}<br />Peak: round {pd.peakRound?.round || '—'}</>
          ) : 'None drafted'}
        </div>
      </div>
    ))}
  </div>
);

// ─── Takeaway Card ──────────────────────────────────────────────────────────
const TakeawayCard = ({ takeaway, number }) => (
  <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-4">
    <div className="flex items-start gap-3">
      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-violet-600 flex items-center justify-center text-white text-sm font-bold">
        {number}
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-bold text-white">{takeaway.title}</h4>
        <p className="text-xs text-slate-400 mt-1 leading-relaxed">{takeaway.detail}</p>
        <div className="mt-2 flex items-start gap-2 bg-violet-500/10 border border-violet-500/20 rounded px-3 py-2">
          <span className="text-violet-400 text-xs font-bold flex-shrink-0 mt-px">TIP</span>
          <p className="text-xs text-violet-300 leading-relaxed">{takeaway.action}</p>
        </div>
      </div>
    </div>
  </div>
);

// ─── Position Flow Chart (round-by-round bar chart) ─────────────────────────
const PositionFlowChart = ({ roundFlow }) => {
  const maxPerRound = Math.max(...roundFlow.map(r => r.total), 1);

  return (
    <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-4">
      <h3 className="text-sm font-bold text-white mb-3">When each position was drafted</h3>
      <div className="space-y-1.5">
        {roundFlow.map(round => (
          <div key={round.round} className="flex items-center gap-2">
            <span className="text-[10px] text-slate-500 font-mono w-8 text-right flex-shrink-0">R{round.round}</span>
            <div className="flex-1 flex h-5 rounded overflow-hidden bg-slate-700/30">
              {['GKP', 'DEF', 'MID', 'FWD'].map(pos => {
                const count = round[pos] || 0;
                if (count === 0) return null;
                const width = (count / maxPerRound) * 100;
                const colors = { GKP: 'bg-yellow-500', DEF: 'bg-cyan-500', MID: 'bg-pink-500', FWD: 'bg-purple-500' };
                return (
                  <div
                    key={pos}
                    className={`${colors[pos]} flex items-center justify-center`}
                    style={{ width: `${width}%` }}
                    title={`${pos}: ${count}`}
                  >
                    {count >= 2 && <span className="text-[9px] font-bold text-black/70">{count}</span>}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-4 mt-3 justify-center">
        {['GKP', 'DEF', 'MID', 'FWD'].map(pos => {
          const colors = { GKP: 'bg-yellow-500', DEF: 'bg-cyan-500', MID: 'bg-pink-500', FWD: 'bg-purple-500' };
          return (
            <div key={pos} className="flex items-center gap-1.5">
              <div className={`w-2.5 h-2.5 rounded ${colors[pos]}`} />
              <span className="text-[10px] text-slate-500">{pos}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── Steals & Reaches Table ─────────────────────────────────────────────────
const StealsAndReaches = ({ valuePicks, reaches }) => {
  if (valuePicks.length === 0 && reaches.length === 0) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Steals */}
      {valuePicks.length > 0 && (
        <div className="bg-slate-800/50 rounded-lg border border-emerald-500/20 p-4">
          <h3 className="text-sm font-bold text-emerald-400 mb-2">Best Steals</h3>
          <p className="text-[10px] text-slate-500 mb-2">Players drafted much later than their projection rank</p>
          <div className="space-y-1.5">
            {valuePicks.map((pick, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className={`px-1 py-0.5 rounded text-[10px] font-bold border ${getPositionBadgeStyle(pick.position)}`}>
                  {pick.position}
                </span>
                <span className="text-xs text-white flex-1 truncate">{pick.playerName}</span>
                <span className="text-[10px] text-slate-500">Pick #{pick.pickNo}</span>
                <span className="text-[10px] text-emerald-400 font-medium">+{pick.delta} value</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reaches */}
      {reaches.length > 0 && (
        <div className="bg-slate-800/50 rounded-lg border border-orange-500/20 p-4">
          <h3 className="text-sm font-bold text-orange-400 mb-2">Biggest Reaches</h3>
          <p className="text-[10px] text-slate-500 mb-2">Players drafted much earlier than their projection rank</p>
          <div className="space-y-1.5">
            {reaches.map((pick, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className={`px-1 py-0.5 rounded text-[10px] font-bold border ${getPositionBadgeStyle(pick.position)}`}>
                  {pick.position}
                </span>
                <span className="text-xs text-white flex-1 truncate">{pick.playerName}</span>
                <span className="text-[10px] text-slate-500">Pick #{pick.pickNo}</span>
                <span className="text-[10px] text-orange-400 font-medium">-{pick.delta} overpay</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Manager Grades ─────────────────────────────────────────────────────────
const ManagerGrades = ({ managerGrades }) => {
  if (!managerGrades || Object.keys(managerGrades).length === 0) return null;

  const gradeColor = (g) => {
    if (!g) return 'text-slate-500';
    if (g.startsWith('A')) return 'text-emerald-400';
    if (g.startsWith('B')) return 'text-green-400';
    if (g.startsWith('C')) return 'text-yellow-400';
    return 'text-orange-400';
  };

  const gradeBorder = (g) => {
    if (!g) return 'border-slate-700';
    if (g.startsWith('A')) return 'border-emerald-500/30';
    if (g.startsWith('B')) return 'border-green-500/30';
    if (g.startsWith('C')) return 'border-yellow-500/30';
    return 'border-orange-500/30';
  };

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-bold text-white">Manager Draft Grades</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {Object.entries(managerGrades)
          .sort(([, a], [, b]) => b.avgVorp - a.avgVorp)
          .map(([managerId, grade]) => (
            <div key={managerId} className={`p-3 rounded-lg border ${gradeBorder(grade.overallGrade)} bg-slate-800/50`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-white font-medium truncate">{grade.name}</span>
                <span className={`text-lg font-bold ${gradeColor(grade.overallGrade)}`}>
                  {grade.overallGrade}
                </span>
              </div>
              <div className="space-y-1 text-xs text-slate-400">
                <div className="flex justify-between">
                  <span>Avg value per pick</span>
                  <span className="text-slate-300">{grade.avgVorp?.toFixed(1)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Best pick</span>
                  <span className="text-emerald-400 truncate ml-2">{grade.bestPick?.name || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Worst pick</span>
                  <span className="text-orange-400 truncate ml-2">{grade.worstPick?.name || '—'}</span>
                </div>
                <div className="flex gap-2 mt-1.5 pt-1.5 border-t border-slate-700/50">
                  {['GKP', 'DEF', 'MID', 'FWD'].map(pos => (
                    <span key={pos} className={`px-1 py-0.5 rounded text-[10px] border ${getPositionBadgeStyle(pos)} opacity-60`}>
                      {grade.positionCounts?.[pos] || 0}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
};

// ─── Draft Recap Table ──────────────────────────────────────────────────────
const DraftRecapTable = ({ pickAnalysis }) => {
  const [expanded, setExpanded] = useState(false);
  const displayPicks = expanded ? pickAnalysis : pickAnalysis.slice(0, 36); // Show 3 rounds by default (12 teams * 3)

  const gradeColors = {
    'A+': 'text-emerald-400', A: 'text-emerald-400',
    'B+': 'text-green-400', B: 'text-green-400',
    'C+': 'text-yellow-400', C: 'text-yellow-400',
    'D+': 'text-orange-400', D: 'text-orange-400',
    F: 'text-red-400',
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-white">Full Draft Recap</h3>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
        >
          {expanded ? 'Show less' : `Show all ${pickAnalysis.length} picks`}
        </button>
      </div>
      <div className="bg-slate-800/50 rounded-lg border border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-800 text-slate-400 text-xs">
                <th className="px-3 py-2 text-left">Pick</th>
                <th className="px-3 py-2 text-left">Player</th>
                <th className="px-3 py-2 text-left">Pos</th>
                <th className="px-3 py-2 text-left hidden sm:table-cell">Manager</th>
                <th className="px-3 py-2 text-right hidden md:table-cell">Proj Rank</th>
                <th className="px-3 py-2 text-center">Grade</th>
              </tr>
            </thead>
            <tbody>
              {displayPicks.map((pick, i) => {
                // Add round separator
                const isNewRound = i > 0 && pick.round !== displayPicks[i - 1].round;
                return (
                  <tr
                    key={pick.pickNo}
                    className={`border-t hover:bg-slate-700/20 ${isNewRound ? 'border-slate-600' : 'border-slate-700/30'}`}
                  >
                    <td className="px-3 py-1.5 text-slate-500 font-mono text-xs">
                      {pick.round}.{pick.draftSlot}
                    </td>
                    <td className="px-3 py-1.5 text-white text-xs">{pick.playerName}</td>
                    <td className="px-3 py-1.5">
                      <span className={`px-1 py-0.5 rounded text-[10px] font-bold border ${getPositionBadgeStyle(pick.position)}`}>
                        {pick.position}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-slate-400 text-xs hidden sm:table-cell truncate max-w-[120px]">
                      {pick.managerName}
                    </td>
                    <td className="px-3 py-1.5 text-right text-slate-400 text-xs hidden md:table-cell">
                      {pick.projectionRank || '—'}
                    </td>
                    <td className={`px-3 py-1.5 text-center text-xs font-bold ${gradeColors[pick.grade] || 'text-slate-500'}`}>
                      {pick.grade || '—'}
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
};

// ─── Main Panel ─────────────────────────────────────────────────────────────
export default function DraftAnalysisPanel({ leagueId, players, scoringMode }) {
  const [draftData, setDraftData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!leagueId) {
      setError('No league ID configured');
      setLoading(false);
      return;
    }

    const fetchDraftData = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/draft-analysis?leagueId=${leagueId}`);
        if (!res.ok) throw new Error('Failed to fetch draft data');
        const data = await res.json();
        setDraftData(data);
      } catch (err) {
        setError(err.message || 'Failed to load draft data');
      } finally {
        setLoading(false);
      }
    };

    fetchDraftData();
  }, [leagueId]);

  const analysis = useMemo(() => {
    if (!draftData?.picks?.length || !players?.length) return null;
    return analyzeDraft(draftData.picks, players, draftData.users || [], scoringMode, draftData.draft?.settings?.teams || 10);
  }, [draftData, players, scoringMode]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-500 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Loading draft data from Sleeper...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-400 text-sm">{error}</p>
        <p className="text-slate-500 text-xs mt-1">Make sure your league has completed a draft.</p>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400">No draft data available for this league.</p>
      </div>
    );
  }

  const { strategy } = analysis;

  return (
    <div className="space-y-6">
      {/* Section 1: Position Demand Overview */}
      <div className="space-y-2">
        <h3 className="text-sm font-bold text-white">
          Draft Overview
          <span className="text-slate-500 font-normal ml-2">
            {strategy.overview.totalPicks} picks across {strategy.overview.rounds} rounds
          </span>
        </h3>
        <OverviewBar overview={strategy.overview} positionDemand={strategy.positionDemand} />
      </div>

      {/* Section 2: Key Takeaways */}
      {strategy.takeaways?.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-white">Key Takeaways for Next Draft</h3>
          <div className="space-y-3">
            {strategy.takeaways.map((takeaway, i) => (
              <TakeawayCard key={i} takeaway={takeaway} number={i + 1} />
            ))}
          </div>
        </div>
      )}

      {/* Section 3: Position Flow Chart */}
      {strategy.roundFlow?.length > 0 && (
        <PositionFlowChart roundFlow={strategy.roundFlow} />
      )}

      {/* Section 4: Steals & Reaches */}
      <StealsAndReaches valuePicks={strategy.valuePicks} reaches={strategy.reaches} />

      {/* Section 5: Manager Grades */}
      <ManagerGrades managerGrades={analysis.managerGrades} />

      {/* Section 6: Full Recap (collapsed by default) */}
      <DraftRecapTable pickAnalysis={analysis.pickAnalysis} />
    </div>
  );
}

DraftAnalysisPanel.propTypes = {
  leagueId: PropTypes.string,
  players: PropTypes.array.isRequired,
  scoringMode: PropTypes.string.isRequired,
};
