'use client';

/**
 * DraftPicksList — running log of all draft picks grouped by round.
 * Most recent round shown first; user's picks highlighted.
 */

import PropTypes from 'prop-types';
import PositionBadge from '../../common/PositionBadge';
import { getPlayerName } from '../../../utils/playerUtils';

export default function DraftPicksList({ picks, myTeamIndex }) {
  if (!picks?.length) return (
    <p className="text-xs text-slate-600 italic">No picks yet</p>
  );

  // Group picks by round
  const byRound = {};
  picks.forEach(p => {
    if (!byRound[p.round]) byRound[p.round] = [];
    byRound[p.round].push(p);
  });

  return (
    <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
      {Object.entries(byRound)
        .sort(([a], [b]) => Number(b) - Number(a))
        .map(([round, roundPicks]) => (
          <div key={round}>
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1 sticky top-0 bg-slate-800/90 py-0.5">
              Round {round}
            </div>
            <div className="space-y-0.5">
              {[...roundPicks].reverse().map(pick => {
                const isMe = pick.teamIndex === myTeamIndex;
                return (
                  <div
                    key={pick.overall}
                    className={`flex items-center gap-2 py-1 px-1.5 rounded ${isMe ? 'bg-emerald-900/20' : ''}`}
                  >
                    <span className="text-[10px] text-slate-600 font-mono min-w-[22px]">#{pick.overall}</span>
                    <PositionBadge position={pick.player.position} size="sm" className="text-[9px]" />
                    <span className={`text-[11px] truncate flex-1 ${isMe ? 'text-emerald-300 font-medium' : 'text-slate-400'}`}>
                      {getPlayerName(pick.player)}
                    </span>
                    {isMe
                      ? <span className="text-[9px] text-emerald-500 flex-shrink-0">you</span>
                      : <span className="text-[9px] text-slate-600 flex-shrink-0">T{pick.teamIndex + 1}</span>
                    }
                  </div>
                );
              })}
            </div>
          </div>
        ))}
    </div>
  );
}

DraftPicksList.propTypes = {
  picks: PropTypes.array,
  myTeamIndex: PropTypes.number,
};
