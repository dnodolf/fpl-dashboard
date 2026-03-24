'use client';

import { useMemo } from 'react';

const DIFF_STYLES = {
  1: { bg: 'bg-green-800/70 border-green-600/40',   bar: 'bg-green-500',   badge: 'bg-green-900/60 text-green-300',   label: 'Easy' },
  2: { bg: 'bg-green-900/60 border-green-700/30',   bar: 'bg-green-600',   badge: 'bg-green-900/50 text-green-400',   label: 'Easy' },
  3: { bg: 'bg-yellow-900/50 border-yellow-700/30', bar: 'bg-yellow-500',  badge: 'bg-yellow-900/60 text-yellow-300', label: 'Med' },
  4: { bg: 'bg-orange-900/50 border-orange-700/30', bar: 'bg-orange-500',  badge: 'bg-orange-900/60 text-orange-300', label: 'Hard' },
  5: { bg: 'bg-red-900/50 border-red-700/30',       bar: 'bg-red-500',     badge: 'bg-red-900/60 text-red-300',       label: 'V.Hard' },
};

function getDiffStyle(avgDiff) {
  const rounded = Math.round(avgDiff);
  return DIFF_STYLES[Math.min(5, Math.max(1, rounded))] || DIFF_STYLES[3];
}

const SquadFixtureForecast = ({ myPlayers, currentGW, scoringMode }) => {
  const gwData = useMemo(() => {
    if (!myPlayers?.length || !currentGW) return [];

    const results = [];
    for (let i = 0; i < 8; i++) {
      const gw = currentGW + i;
      let totalDiff = 0;
      let diffCount = 0;
      let totalPts = 0;
      let ptsCount = 0;

      for (const player of myPlayers) {
        if (!player.predictions?.length) continue;
        const pred = player.predictions.find(p => p.gw === gw);
        if (!pred) continue;

        // Extract difficulty from opp field: [[code, full, difficulty], ...]
        if (pred.opp?.[0] && Array.isArray(pred.opp[0]) && pred.opp[0].length >= 3) {
          const diff = pred.opp[0][2];
          if (typeof diff === 'number' && diff >= 1 && diff <= 5) {
            totalDiff += diff;
            diffCount++;
          }
        }

        // Extract predicted points based on scoring mode
        const pts = scoringMode === 'v4'
          ? (pred.v4_pts ?? pred.v3_pts ?? pred.predicted_pts ?? 0)
          : scoringMode === 'v3'
            ? (pred.v3_pts ?? pred.predicted_pts ?? 0)
            : (pred.predicted_pts ?? 0);

        if (pts >= 0) {
          totalPts += pts;
          ptsCount++;
        }
      }

      results.push({
        gw,
        avgDiff: diffCount > 0 ? totalDiff / diffCount : 3,
        avgPts:  ptsCount  > 0 ? totalPts  / ptsCount  : 0,
        hasData: diffCount > 0 || ptsCount > 0,
      });
    }
    return results;
  }, [myPlayers, currentGW, scoringMode]);

  // Find best & worst consecutive 2-GW windows (by avg difficulty)
  const { bestWindow, worstWindow } = useMemo(() => {
    if (gwData.length < 2) return { bestWindow: -1, worstWindow: -1 };
    let bestIdx = 0, worstIdx = 0;
    let bestScore = Infinity, worstScore = -Infinity;
    for (let i = 0; i < gwData.length - 1; i++) {
      const score = (gwData[i].avgDiff + gwData[i + 1].avgDiff) / 2;
      if (score < bestScore) { bestScore = score; bestIdx = i; }
      if (score > worstScore) { worstScore = score; worstIdx = i; }
    }
    return { bestWindow: bestIdx, worstWindow: worstIdx };
  }, [gwData]);

  if (!gwData.length) return null;

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-400">Squad Fixture Forecast</h3>
        <span className="text-xs text-gray-500">Next {gwData.length} GWs · avg difficulty &amp; predicted pts</span>
      </div>

      <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
        {gwData.map((d, i) => {
          const style = getDiffStyle(d.avgDiff);
          const isBest  = i === bestWindow  || i === bestWindow  + 1;
          const isWorst = i === worstWindow || i === worstWindow + 1;
          // Best takes priority if windows overlap
          const ring = isBest  ? 'ring-2 ring-green-400 ring-offset-1 ring-offset-gray-800'
                     : isWorst ? 'ring-2 ring-red-500/60 ring-offset-1 ring-offset-gray-800'
                     : '';

          return (
            <div
              key={d.gw}
              className={`${style.bg} border rounded-lg p-2 flex flex-col items-center gap-1 relative ${ring}`}
              title={`GW${d.gw}: avg difficulty ${d.avgDiff.toFixed(1)}/5 · avg ${d.avgPts.toFixed(1)} pts`}
            >
              {/* Window badges */}
              {i === bestWindow && (
                <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-[9px] bg-green-500 text-white px-1 rounded whitespace-nowrap font-bold">
                  Best
                </span>
              )}
              {i === worstWindow && bestWindow !== worstWindow && (
                <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-[9px] bg-red-500 text-white px-1 rounded whitespace-nowrap font-bold">
                  Hard
                </span>
              )}

              <span className="text-[10px] font-bold text-gray-300">GW{d.gw}</span>

              {/* Difficulty mini-bar */}
              <div className="w-full bg-gray-700 rounded-full h-1">
                <div
                  className={`${style.bar} h-1 rounded-full`}
                  style={{ width: `${(d.avgDiff / 5) * 100}%` }}
                />
              </div>

              <span className="text-xs font-bold text-white">{d.avgDiff.toFixed(1)}</span>
              <span className="text-[10px] text-gray-400">{d.avgPts.toFixed(1)}pt</span>

              <span className={`text-[9px] px-1 py-0.5 rounded font-medium ${style.badge}`}>
                {style.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-2 mt-3">
        <span className="text-[10px] text-gray-500">Difficulty:</span>
        {[1, 2, 3, 4, 5].map(d => (
          <span key={d} className={`text-[11px] px-1.5 py-0.5 rounded font-medium ${DIFF_STYLES[d].badge}`}>
            {d} — {DIFF_STYLES[d].label}
          </span>
        ))}
        <span className="w-full sm:w-auto mt-1 sm:mt-0 ml-0 sm:ml-auto text-[10px] text-gray-500 flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full bg-green-400"></span> best 2-GW window
          <span className="inline-block w-2 h-2 rounded-full bg-red-500/60 ml-1"></span> hardest window
        </span>
      </div>
    </div>
  );
};

export default SquadFixtureForecast;
