'use client';

/**
 * AllRostersPanel — grid view of every team's current draft roster.
 * User's team highlighted; AI archetypes shown for other teams.
 */

import PropTypes from 'prop-types';
import PositionBadge from '../../common/PositionBadge';
import { getPlayerId, getPlayerName } from '../../../utils/playerUtils';
import { ARCHETYPES } from '../../../services/mockDraftAiService';

export default function AllRostersPanel({ allRosters, myTeamIndex, leagueSize, archetypes, archetypeNames }) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-bold text-white">All Rosters</h3>
      <div className="grid grid-cols-2 gap-2">
        {Array.from({ length: leagueSize }, (_, i) => {
          const roster = allRosters[i] || [];
          const isMe = i === myTeamIndex;
          const archKey = archetypes?.[i];
          const archName = archetypeNames?.[i] || ARCHETYPES[archKey]?.name || '';

          return (
            <div
              key={i}
              className={`rounded-lg p-2 border text-xs ${isMe ? 'bg-violet-900/20 border-violet-500/40' : 'bg-slate-800/40 border-slate-700'}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={`font-bold ${isMe ? 'text-violet-300' : 'text-slate-300'}`}>
                  {isMe ? '⭐ You' : `Team ${i + 1}`}
                </span>
                {!isMe && archName && (
                  <span className="text-[9px] text-slate-500 truncate max-w-[70px]">{archName}</span>
                )}
                <span className="text-slate-500">{roster.length}/17</span>
              </div>
              <div className="space-y-0.5 max-h-28 overflow-y-auto">
                {roster.map(p => (
                  <div key={getPlayerId(p)} className="flex items-center gap-1">
                    <PositionBadge position={p.position} size="sm" className="text-[9px]" />
                    <span className="text-slate-400 truncate">{getPlayerName(p)}</span>
                  </div>
                ))}
                {roster.length === 0 && (
                  <span className="text-slate-700 italic">No picks yet</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

AllRostersPanel.propTypes = {
  allRosters: PropTypes.object.isRequired,
  myTeamIndex: PropTypes.number,
  leagueSize: PropTypes.number.isRequired,
  archetypes: PropTypes.object,
  archetypeNames: PropTypes.object,
};
