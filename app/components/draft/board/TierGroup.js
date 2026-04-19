'use client';

/**
 * TierGroup — collapsible tier section in the draft board.
 * Tiers ≥ 7 start collapsed by default.
 */

import { useState } from 'react';
import PropTypes from 'prop-types';
import { getTierLabel, getTierColor } from '../../../services/draftRankingService';
import { getPlayerId } from '../../../utils/playerUtils';
import PlayerRow from './PlayerRow';

export default function TierGroup({ tierNumber, players, takenIds, isMyTurn, getAvailabilityAtNextPick, onPick, isLast }) {
  const [collapsed, setCollapsed] = useState(tierNumber >= 7);
  const tierColor = getTierColor(tierNumber);
  const available = players.filter(p => !takenIds.has(getPlayerId(p))).length;

  return (
    <div className="mb-1">
      <button
        onClick={() => setCollapsed(c => !c)}
        className={`w-full flex items-center gap-2 px-3 py-2 rounded-t ${tierColor.bg} border ${tierColor.border} transition-colors hover:opacity-90`}
      >
        <span className={`text-sm font-bold ${tierColor.text}`}>
          Tier {tierNumber} — {getTierLabel(tierNumber)}
        </span>
        <span className="text-xs text-slate-500">
          {available === players.length
            ? `${players.length} available`
            : `${available} of ${players.length} available`}
        </span>
        <span className="ml-auto text-slate-500 text-xs">{collapsed ? '▶' : '▼'}</span>
      </button>

      {!collapsed && (
        <div className="border-x border-b border-slate-700/50 rounded-b bg-slate-800/20">
          {players.map(p => {
            const id = getPlayerId(p);
            const isTaken = takenIds.has(id);
            const availProb = getAvailabilityAtNextPick(id);
            return (
              <PlayerRow
                key={id}
                player={p}
                isTaken={isTaken}
                availProb={availProb}
                isMyTurn={isMyTurn}
                onPick={onPick}
              />
            );
          })}
        </div>
      )}

      {!isLast && !collapsed && (
        <div className="flex items-center gap-2 py-1 px-3">
          <div className="flex-1 border-t border-orange-500/30" />
          <span className="text-[10px] text-orange-400/70">tier break</span>
          <div className="flex-1 border-t border-orange-500/30" />
        </div>
      )}
    </div>
  );
}

TierGroup.propTypes = {
  tierNumber: PropTypes.number.isRequired,
  players: PropTypes.array.isRequired,
  takenIds: PropTypes.instanceOf(Set).isRequired,
  isMyTurn: PropTypes.bool.isRequired,
  getAvailabilityAtNextPick: PropTypes.func.isRequired,
  onPick: PropTypes.func.isRequired,
  isLast: PropTypes.bool,
};
