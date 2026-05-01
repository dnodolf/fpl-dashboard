'use client';

import { useMemo } from 'react';
import { getSleeperPositionStyle } from '../constants/positionColors';
import { getPlayerName } from '../utils/playerUtils';
import PlayerAvatar from './common/PlayerAvatar';

const POSITION_ORDER = { FWD: 0, MID: 1, DEF: 2, GKP: 3 };

const DIFF_CELL = {
  1: { bg: 'bg-green-800',  border: 'border-green-700/50',  text: 'text-green-200'  },
  2: { bg: 'bg-lime-800',   border: 'border-lime-700/50',   text: 'text-lime-200'   },
  3: { bg: 'bg-yellow-800', border: 'border-yellow-700/50', text: 'text-yellow-200' },
  4: { bg: 'bg-orange-800', border: 'border-orange-700/50', text: 'text-orange-200' },
  5: { bg: 'bg-red-900',    border: 'border-red-800/50',    text: 'text-red-200'    },
};

const GW_COUNT = 5;

const SquadFixtureForecast = ({ myPlayers, currentGW, scoringMode, isGWActive = false }) => {
  const gwRange = useMemo(() => {
    if (!currentGW) return [];
    const range = [];
    for (let i = 0; i < GW_COUNT; i++) {
      const gw = currentGW + i;
      if (gw > 38) break;
      range.push(gw);
    }
    return range;
  }, [currentGW]);

  const sortedPlayers = useMemo(() => {
    if (!myPlayers?.length) return [];
    return [...myPlayers].sort((a, b) => {
      const posA = POSITION_ORDER[a.position] ?? 4;
      const posB = POSITION_ORDER[b.position] ?? 4;
      if (posA !== posB) return posA - posB;
      // Starters before bench within each position
      return (b.is_starter ? 1 : 0) - (a.is_starter ? 1 : 0);
    });
  }, [myPlayers]);

  const rows = useMemo(() => {
    const result = [];
    let currentPos = null;
    for (const player of sortedPlayers) {
      if (player.position !== currentPos) {
        currentPos = player.position;
        result.push({ type: 'header', pos: currentPos });
      }
      result.push({ type: 'player', player });
    }
    return result;
  }, [sortedPlayers]);

  if (!sortedPlayers.length || !gwRange.length) return null;

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
      {/* Legend */}
      <div className="flex items-center gap-1.5 text-[10px] mb-3">
        <span className="text-slate-500 mr-0.5">Difficulty:</span>
        <span className="px-1.5 py-0.5 rounded bg-green-800 text-green-200">Easy</span>
        <span className="px-1.5 py-0.5 rounded bg-lime-800 text-lime-200">Fav</span>
        <span className="px-1.5 py-0.5 rounded bg-yellow-800 text-yellow-200">Med</span>
        <span className="px-1.5 py-0.5 rounded bg-orange-800 text-orange-200">Hard</span>
        <span className="px-1.5 py-0.5 rounded bg-red-900 text-red-200">V.Hard</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr>
              <th className="text-left text-slate-500 font-medium pb-1.5 pr-3 w-36 min-w-[144px]">
                Player
              </th>
              {gwRange.map(gw => (
                <th key={gw} className="text-center text-slate-500 font-medium pb-1.5 px-0.5 min-w-[56px]">
                  <div className="flex flex-col items-center gap-0.5">
                    <span>GW{gw}</span>
                    {gw === currentGW && isGWActive && (
                      <span className="text-[8px] font-bold text-orange-400 tracking-wider">● LIVE</span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              if (row.type === 'header') {
                return (
                  <tr key={`hdr-${row.pos}-${i}`}>
                    <td colSpan={gwRange.length + 1} className="pt-2.5 pb-0.5">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${getSleeperPositionStyle(row.pos)}`}>
                        {row.pos}
                      </span>
                    </td>
                  </tr>
                );
              }

              const { player } = row;
              return (
                <tr key={player.sleeper_id || player.player_id || i}>
                  <td className="pr-3 py-1">
                    <div className="flex items-center gap-1.5">
                      <PlayerAvatar player={player} size="sm" />
                      <div className="min-w-0">
                        <span
                          className="text-slate-300 block truncate max-w-[96px] text-xs"
                          title={player.web_name || player.name}
                        >
                          {getPlayerName(player)}
                        </span>
                        {!player.is_starter && (
                          <span className="text-[8px] text-slate-600">BN</span>
                        )}
                      </div>
                    </div>
                  </td>
                  {gwRange.map(gw => {
                    const pred = player.predictions?.find(p => p.gw === gw);
                    if (!pred?.opp?.[0] || !Array.isArray(pred.opp[0])) {
                      return (
                        <td key={gw} className="px-0.5 py-0.5">
                          <div className="flex flex-col items-center justify-center h-10 rounded bg-slate-700/20 text-[9px] leading-tight text-center">
                            {gw === currentGW && isGWActive
                              ? <span className="text-orange-400 font-bold">GW<br/>Active</span>
                              : <span className="text-slate-600">—</span>
                            }
                          </div>
                        </td>
                      );
                    }

                    const [code, full, difficulty] = pred.opp[0];
                    const isHome = (full || '').includes('(H)');
                    const diff = Math.min(5, Math.max(1, Math.round(difficulty || 3)));
                    const style = DIFF_CELL[diff];

                    const pts = scoringMode === 'v4'
                      ? (pred.v4_pts ?? pred.v3_pts ?? pred.predicted_pts ?? 0)
                      : scoringMode === 'v3'
                        ? (pred.v3_pts ?? pred.predicted_pts ?? 0)
                        : (pred.predicted_pts ?? 0);

                    return (
                      <td key={gw} className="px-0.5 py-0.5">
                        <div
                          className={`flex flex-col items-center justify-center h-10 rounded border ${style.bg} ${style.border} cursor-default`}
                          title={`${player.web_name || player.name} vs ${full} — Difficulty ${diff}/5 · ${pts.toFixed(1)} pts`}
                        >
                          <span className={`font-bold text-[10px] leading-tight ${style.text}`}>
                            {(code || '').toUpperCase()}
                            <span className={`font-normal opacity-60 text-[8px] ml-0.5`}>
                              {isHome ? 'H' : 'A'}
                            </span>
                          </span>
                          <span className={`text-[10px] leading-tight font-medium ${style.text} opacity-80`}>
                            {pts.toFixed(1)}
                          </span>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SquadFixtureForecast;
