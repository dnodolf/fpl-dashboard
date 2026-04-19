'use client';

/**
 * PlayerRow — single player entry in the tier board list.
 */

import PropTypes from 'prop-types';
import PlayerAvatar from '../../common/PlayerAvatar';
import PositionBadge from '../../common/PositionBadge';
import AvailBadge from './AvailBadge';
import { getPlayerName, getTeamDisplay } from '../../../utils/playerUtils';

export default function PlayerRow({ player, isTaken, availProb, isMyTurn, onPick }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded transition-colors group ${isTaken ? 'opacity-40' : 'hover:bg-slate-700/40'}`}>
      <span className="text-slate-500 text-xs font-mono min-w-[28px]">{player.draftOverallRank}</span>
      <PlayerAvatar player={player} size="sm" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={`text-sm font-medium truncate ${isTaken ? 'text-slate-500 line-through' : 'text-white'}`}>
            {getPlayerName(player)}
          </span>
          <PositionBadge position={player.position} label={player.draftPosition} />
        </div>
        <div className="text-xs text-slate-500 hidden sm:block">
          {getTeamDisplay(player)}
          {isTaken && ' · Taken'}
        </div>
      </div>
      <div className="hidden md:flex items-center gap-4 text-xs text-slate-400">
        <div className="text-right min-w-[44px]">
          <div className="text-slate-300 font-medium">{player.draftProjection?.toFixed(1)}</div>
          <div className="text-[10px]">Proj</div>
        </div>
        <div className="text-right min-w-[44px]">
          <div className="text-slate-300 font-medium">{player.draftVorp?.toFixed(1)}</div>
          <div className="text-[10px]">VORP</div>
        </div>
      </div>
      {availProb !== null && availProb !== undefined && !isTaken && (
        <AvailBadge prob={availProb} />
      )}
      {!isTaken && isMyTurn && (
        <button
          onClick={() => onPick(player)}
          className="px-2.5 py-1 bg-violet-600 hover:bg-violet-500 text-white text-[11px] font-bold rounded transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
        >
          Pick
        </button>
      )}
      {isTaken && (
        <span className="text-[10px] text-slate-600 w-14 text-right flex-shrink-0">Taken</span>
      )}
    </div>
  );
}

PlayerRow.propTypes = {
  player: PropTypes.object.isRequired,
  isTaken: PropTypes.bool.isRequired,
  availProb: PropTypes.number,
  isMyTurn: PropTypes.bool.isRequired,
  onPick: PropTypes.func.isRequired,
};
