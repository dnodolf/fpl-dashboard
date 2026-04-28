'use client';

/**
 * DraftCompleteView — post-draft results screen.
 * Shows VORP efficiency grades for every manager, sorted best→worst.
 * User's team is highlighted and shown first.
 */

import PropTypes from 'prop-types';
import PositionBadge from '../../common/PositionBadge';

const GRADE_COLOR = {
  'A+': 'text-emerald-400', 'A': 'text-emerald-400',
  'B+': 'text-green-400',   'B': 'text-green-400',
  'C+': 'text-yellow-400',  'C': 'text-yellow-400',
  'D':  'text-orange-400',
};

const GRADE_BORDER = {
  'A+': 'border-emerald-500/30', 'A': 'border-emerald-500/30',
  'B+': 'border-green-500/30',   'B': 'border-green-500/30',
  'C+': 'border-yellow-500/30',  'C': 'border-yellow-500/30',
  'D':  'border-orange-500/30',
};

const GRADE_BG = {
  'A+': 'bg-emerald-900/20', 'A': 'bg-emerald-900/20',
  'B+': 'bg-green-900/20',   'B': 'bg-green-900/20',
  'C+': 'bg-yellow-900/20',  'C': 'bg-yellow-900/20',
  'D':  'bg-orange-900/20',
};

function GradeCard({ gradeData, isMe, rank }) {
  const { displayName, grade, efficiency, totalVorp, positionCounts, bestPick, worstPick } = gradeData;
  const gradeColor  = GRADE_COLOR[grade]  || 'text-slate-400';
  const gradeBorder = GRADE_BORDER[grade] || 'border-slate-700';
  const gradeBg     = GRADE_BG[grade]     || 'bg-slate-800/50';

  return (
    <div className={`rounded-lg border p-4 ${gradeBg} ${gradeBorder} ${isMe ? 'ring-2 ring-violet-500/50' : ''}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-slate-500 text-sm font-mono flex-shrink-0">#{rank}</span>
          <span className={`font-bold text-sm truncate ${isMe ? 'text-violet-300' : 'text-white'}`}>
            {isMe ? `⭐ ${displayName}` : displayName}
          </span>
        </div>
        <span className={`text-3xl font-black flex-shrink-0 ml-2 ${gradeColor}`}>{grade}</span>
      </div>

      <div className="space-y-2 text-xs text-slate-400">
        <div className="flex justify-between">
          <span>VORP efficiency</span>
          <span className="text-slate-300 font-medium">{(efficiency * 100).toFixed(1)}%</span>
        </div>
        <div className="flex justify-between">
          <span>Total VORP drafted</span>
          <span className="text-slate-300 font-medium">{totalVorp?.toFixed(1)}</span>
        </div>
        {bestPick && (
          <div className="flex justify-between">
            <span>Best pick</span>
            <span className="text-emerald-400 truncate ml-2 max-w-[120px]">{bestPick.playerName}</span>
          </div>
        )}
        {worstPick && (
          <div className="flex justify-between">
            <span>Biggest reach</span>
            <span className="text-orange-400 truncate ml-2 max-w-[120px]">{worstPick.playerName}</span>
          </div>
        )}

        {/* Position breakdown */}
        <div className="flex gap-1.5 pt-1.5 border-t border-slate-700/50">
          {['FWD', 'MID', 'DEF', 'GKP'].map(pos => (
            <div key={pos} className="flex items-center gap-0.5">
              <PositionBadge position={pos} label={String(positionCounts?.[pos] || 0)} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function DraftCompleteView({ managerGrades, mySlot, onReset }) {
  if (!managerGrades || Object.keys(managerGrades).length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        <p>Draft complete — computing grades…</p>
      </div>
    );
  }

  // Sort by efficiency descending; user's team floats to top within ties
  const sorted = Object.values(managerGrades).sort((a, b) => {
    if (Math.abs(a.efficiency - b.efficiency) < 0.001) {
      if (a.slot === mySlot) return -1;
      if (b.slot === mySlot) return 1;
    }
    return b.efficiency - a.efficiency;
  });

  const myGrade = managerGrades[mySlot];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-1">
        <div className="text-4xl">🏆</div>
        <h2 className="text-2xl font-black text-white">Draft Complete</h2>
        <p className="text-sm text-slate-400">Final grades based on VORP efficiency — how well each manager drafted relative to the best available player at each pick.</p>
      </div>

      {/* User's grade hero */}
      {myGrade && (
        <div className="bg-slate-800 rounded-xl border border-violet-500/40 p-6 text-center">
          <p className="text-slate-400 text-sm mb-1">Your Draft Grade</p>
          <div className={`text-7xl font-black ${GRADE_COLOR[myGrade.grade] || 'text-slate-400'}`}>
            {myGrade.grade}
          </div>
          <p className="text-slate-400 text-sm mt-1">
            {(myGrade.efficiency * 100).toFixed(1)}% efficiency · {myGrade.totalVorp?.toFixed(1)} total VORP
          </p>
          {myGrade.bestPick && (
            <p className="text-emerald-400 text-xs mt-2">Best steal: {myGrade.bestPick.playerName}</p>
          )}
        </div>
      )}

      {/* All manager grades */}
      <div>
        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wide mb-3">All Managers</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {sorted.map((grade, i) => (
            <GradeCard
              key={grade.slot}
              gradeData={grade}
              isMe={grade.slot === mySlot}
              rank={i + 1}
            />
          ))}
        </div>
      </div>

      <div className="text-center">
        <button
          onClick={onReset}
          className="px-6 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm font-medium rounded transition-colors"
        >
          ← Back to Setup
        </button>
      </div>
    </div>
  );
}

DraftCompleteView.propTypes = {
  managerGrades: PropTypes.object,
  mySlot: PropTypes.number,
  onReset: PropTypes.func.isRequired,
};
