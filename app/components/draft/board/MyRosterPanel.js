'use client';

/**
 * MyRosterPanel — sidebar showing the user's current draft roster grouped by position.
 */

import { useMemo } from 'react';
import PropTypes from 'prop-types';
import PositionBadge from '../../common/PositionBadge';
import { getPlayerId, getPlayerName } from '../../../utils/playerUtils';

export default function MyRosterPanel({ myRoster }) {
  const byPos = useMemo(() => {
    const g = { FWD: [], MID: [], DEF: [], GKP: [] };
    myRoster.forEach(p => {
      const pos = (p.position || '').toUpperCase();
      if (g[pos]) g[pos].push(p);
    });
    return g;
  }, [myRoster]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-white">My Roster</h3>
        <span className="text-xs text-slate-500">{myRoster.length}/17</span>
      </div>
      {Object.entries(byPos).map(([pos, players]) => (
        <div key={pos}>
          <div className="flex items-center gap-1.5 mb-1">
            <PositionBadge position={pos} size="md" />
            <span className="text-[10px] text-slate-500">{players.length}</span>
          </div>
          {players.length === 0 ? (
            <div className="text-[11px] text-slate-700 italic pl-1">–</div>
          ) : (
            <div className="space-y-0.5">
              {players.map(p => (
                <div key={getPlayerId(p)} className="flex items-center gap-1.5 pl-1">
                  <span className="text-[11px] text-slate-300 truncate flex-1">{getPlayerName(p)}</span>
                  <span className="text-[10px] text-slate-500">{p.draftVorp?.toFixed(1)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

MyRosterPanel.propTypes = {
  myRoster: PropTypes.array.isRequired,
};
