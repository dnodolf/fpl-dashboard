'use client';

/**
 * SuggestionCard — VORP pick suggestion card shown on the user's turn.
 */

import PropTypes from 'prop-types';
import PlayerAvatar from '../../common/PlayerAvatar';
import PositionBadge from '../../common/PositionBadge';
import AvailBadge from './AvailBadge';
import { getPlayerName, getTeamDisplay } from '../../../utils/playerUtils';

const REASON_COLORS = {
  Value:       'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  Need:        'bg-blue-500/20 text-blue-400 border-blue-500/30',
  'Must Fill': 'bg-red-500/20 text-red-400 border-red-500/30',
  Depth:       'bg-slate-500/20 text-slate-400 border-slate-500/30',
  Sleeper:     'bg-amber-500/20 text-amber-400 border-amber-500/30',
};

export default function SuggestionCard({ player, rank, availProb, onPick }) {
  return (
    <div className="flex items-center gap-3 p-3 bg-slate-800/60 rounded-lg border border-slate-700 hover:border-violet-500/60 transition-colors">
      <span className="text-violet-400 font-bold text-lg min-w-[24px]">#{rank}</span>
      <PlayerAvatar player={player} size="md" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-white text-sm font-medium truncate">
            {getPlayerName(player)}
          </span>
          <PositionBadge position={player.position} label={player.draftPosition} size="md" />
          {player.draftReason && (
            <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${REASON_COLORS[player.draftReason] || REASON_COLORS.Value}`}>
              {player.draftReason}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5 flex-wrap">
          <span>{getTeamDisplay(player)}</span>
          <span className="text-slate-600">·</span>
          <span>VORP {player.draftVorp?.toFixed(1)}</span>
          <span className="text-slate-600">·</span>
          <span>Proj {player.draftProjection?.toFixed(1)}</span>
          {availProb !== null && availProb !== undefined && (
            <>
              <span className="text-slate-600">·</span>
              <AvailBadge prob={availProb} />
            </>
          )}
        </div>
      </div>
      <button
        onClick={() => onPick(player)}
        className="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold rounded transition-colors flex-shrink-0"
      >
        Pick
      </button>
    </div>
  );
}

SuggestionCard.propTypes = {
  player: PropTypes.object.isRequired,
  rank: PropTypes.number.isRequired,
  availProb: PropTypes.number,
  onPick: PropTypes.func.isRequired,
};
