'use client';

import { getSleeperPositionStyle, getPositionTextColor } from '../constants/positionColors';
import { timeAgo, getFPLStatusBadge } from '../utils/newsUtils';
import { getNextNGameweeksTotal } from '../utils/predictionUtils';
import { getPlayerName } from '../utils/playerUtils';
import PlayerAvatar from './common/PlayerAvatar';


const MyRosterPanel = ({ players, userId, scoringMode, currentGameweek, onPlayerClick }) => {
  const myPlayers = players.filter(p => p.owned_by === userId);
  const currentGW = currentGameweek?.number || 1;
  const getPlayerPoints = (player) => getNextNGameweeksTotal(player, scoringMode, currentGW, 1);

  const playersWithNews = myPlayers.filter(p =>
    (p.news && p.news.length > 0) ||
    (p.fpl_status && p.fpl_status !== 'a')
  );

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
      <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
        <span>My Roster</span>
        <span className="text-slate-400 text-sm font-normal">({myPlayers.length} players)</span>
      </h2>

      {playersWithNews.length > 0 && (
        <div className="mb-6 bg-cyan-900/20 border border-cyan-700/50 rounded-lg p-4">
          <h3 className="text-sm font-bold text-cyan-400 mb-3 flex items-center gap-2">
            <span>📰 Player News ({playersWithNews.length})</span>
          </h3>
          <div className="space-y-2">
            {playersWithNews.map(player => {
              const statusBadge = player.fpl_status ? getFPLStatusBadge(player.fpl_status) : null;
              const newsTimestamp = player.news_added || player.fpl_news_added;
              return (
                <div key={player.sleeper_id} className="flex items-start gap-3 text-sm">
                  <PlayerAvatar player={player} size="md" />
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${getSleeperPositionStyle(player.position)}`}>
                    {player.position}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onPlayerClick?.(player)}
                        className={`truncate max-w-[120px] sm:max-w-none font-medium hover:underline transition-colors text-left ${getPositionTextColor(player.position)}`}
                      >
                        {player.name}
                      </button>
                      {statusBadge && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${statusBadge.color}`}>
                          {statusBadge.badge}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {player.news && <p className="text-xs text-slate-400">{player.news}</p>}
                      {newsTimestamp && (
                        <span className="text-[10px] text-slate-600">{timeAgo(newsTimestamp)}</span>
                      )}
                    </div>
                  </div>
                  <span className={`text-xs font-medium ${
                    (player.chance_next_round ?? player.chance_of_playing_next_round ?? 100) < 50
                      ? 'text-red-400'
                      : (player.chance_next_round ?? player.chance_of_playing_next_round ?? 100) < 75
                        ? 'text-orange-400'
                        : 'text-cyan-400'
                  }`}>
                    {player.chance_next_round ?? player.chance_of_playing_next_round ?? 100}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {['FWD', 'MID', 'DEF', 'GKP'].map(position => {
          const positionPlayers = myPlayers
            .filter(p => p.position === position)
            .sort((a, b) => getPlayerPoints(b) - getPlayerPoints(a));

          const positionGradients = {
            GKP: 'from-yellow-600/20 to-amber-600/20',
            DEF: 'from-green-600/20 to-emerald-600/20',
            MID: 'from-blue-600/20 to-indigo-600/20',
            FWD: 'from-purple-600/20 to-fuchsia-600/20'
          };

          return (
            <div key={position} className={`bg-gradient-to-br ${positionGradients[position]} rounded-lg p-4 border border-slate-700/50`}>
              <h3 className="font-bold text-white mb-3 flex items-center gap-2">
                <span className={`text-sm font-bold px-2 py-0.5 rounded ${getSleeperPositionStyle(position)}`}>
                  {position}
                </span>
                <span className="text-slate-400 text-sm font-normal">({positionPlayers.length})</span>
              </h3>
              <div className="space-y-2">
                {positionPlayers.map(player => {
                  const chance = player.chance_next_round ?? player.chance_of_playing_next_round ?? 100;
                  const points = getPlayerPoints(player);
                  const isLocked = player._locked || false;
                  return (
                    <div key={player.sleeper_id} className={`flex items-center gap-2 text-sm ${isLocked ? 'opacity-50' : ''}`}>
                      <PlayerAvatar player={player} size="sm" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => onPlayerClick?.(player)}
                            className={`truncate font-medium hover:underline transition-colors text-left ${getPositionTextColor(position)}`}
                          >
                            {getPlayerName(player)}
                          </button>
                          {isLocked && <span className="text-[10px] shrink-0" title="Match in progress">🔒</span>}
                        </div>
                        <p className="text-xs text-slate-500">{player.team_abbr}</p>
                      </div>
                      <div className="flex items-center gap-2 ml-2">
                        {chance < 75 && (
                          <span className={`text-xs ${
                            chance < 25 ? 'text-red-400' :
                            chance < 50 ? 'text-orange-400' :
                            'text-yellow-400'
                          }`}>
                            {chance}%
                          </span>
                        )}
                        <span className="text-white font-bold">{points.toFixed(1)}</span>
                      </div>
                    </div>
                  );
                })}
                {positionPlayers.length === 0 && (
                  <p className="text-slate-500 text-xs italic">No players</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MyRosterPanel;
