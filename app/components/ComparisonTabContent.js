'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { getScoringValue } from '../services/v3ScoringService.js';
import { TOTAL_GAMEWEEKS, USER_ID } from '../config/constants';
import { getNextNGameweeksTotal, getAvgMinutesNextN } from '../utils/predictionUtils';
import { getDifficultyColor } from '../constants/designTokens';
import { getSleeperPositionStyle } from '../constants/positionColors';
import { getFPLStatusBadge } from '../utils/newsUtils';
import ComparisonChart from './ComparisonChart';

const ComparisonTabContent = ({ players = [], currentGameweek, scoringMode = 'ffh', onPlayerClick, preSelectedPlayer1, onClearPreSelection }) => {
  const [dropPlayer, setDropPlayer] = useState(null);
  const [addPlayer, setAddPlayer] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showCharts, setShowCharts] = useState(false);
  const [showFixtures, setShowFixtures] = useState(false);
  const searchRef = useRef(null);

  // My players grouped by position
  const myPlayers = useMemo(() => {
    return players.filter(p =>
      p.owned_by === USER_ID || p.owned_by === 'You'
    ).sort((a, b) => {
      const posOrder = { GKP: 0, DEF: 1, MID: 2, FWD: 3 };
      if (posOrder[a.position] !== posOrder[b.position]) {
        return posOrder[a.position] - posOrder[b.position];
      }
      return (a.name || a.full_name || '').localeCompare(b.name || b.full_name || '');
    });
  }, [players]);

  // Handle pre-selected player from PlayerModal Compare button
  useEffect(() => {
    if (preSelectedPlayer1) {
      const isMyPlayer = preSelectedPlayer1.owned_by === USER_ID || preSelectedPlayer1.owned_by === 'You';
      if (isMyPlayer) {
        setDropPlayer(preSelectedPlayer1);
      } else {
        setAddPlayer(preSelectedPlayer1);
      }
      onClearPreSelection?.();
    }
  }, [preSelectedPlayer1, onClearPreSelection]);

  // Close suggestions on click outside
  useEffect(() => {
    const handleClick = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Search suggestions — free agents first, then owned by others
  const suggestions = useMemo(() => {
    if (!searchTerm || searchTerm.length < 2) return [];
    const term = searchTerm.toLowerCase();
    const matches = players.filter(p =>
      (p.name?.toLowerCase().includes(term) ||
       p.full_name?.toLowerCase().includes(term) ||
       p.web_name?.toLowerCase().includes(term) ||
       p.team_abbr?.toLowerCase().includes(term)) &&
      p.player_id !== dropPlayer?.player_id
    );
    return matches.sort((a, b) => {
      const aFree = !a.owned_by || a.owned_by === 'Free Agent';
      const bFree = !b.owned_by || b.owned_by === 'Free Agent';
      if (aFree !== bFree) return aFree ? -1 : 1;
      return getScoringValue(b, 'season_total', scoringMode) - getScoringValue(a, 'season_total', scoringMode);
    }).slice(0, 12);
  }, [players, searchTerm, scoringMode, dropPlayer]);

  // Compute verdict metrics
  const metrics = useMemo(() => {
    if (!dropPlayer || !addPlayer) return null;
    const gw = currentGameweek?.number || 1;
    return [
      { label: 'Next GW', drop: getNextNGameweeksTotal(dropPlayer, scoringMode, gw, 1), add: getNextNGameweeksTotal(addPlayer, scoringMode, gw, 1) },
      { label: 'Next 3 GW', drop: getNextNGameweeksTotal(dropPlayer, scoringMode, gw, 3), add: getNextNGameweeksTotal(addPlayer, scoringMode, gw, 3) },
      { label: 'Next 5 GW', drop: getNextNGameweeksTotal(dropPlayer, scoringMode, gw, 5), add: getNextNGameweeksTotal(addPlayer, scoringMode, gw, 5) },
      { label: 'Next 10 GW', drop: getNextNGameweeksTotal(dropPlayer, scoringMode, gw, 10), add: getNextNGameweeksTotal(addPlayer, scoringMode, gw, 10) },
      { label: 'Rest of Season', drop: getScoringValue(dropPlayer, 'season_total', scoringMode), add: getScoringValue(addPlayer, 'season_total', scoringMode) },
      { label: 'Avg Mins (Next 5)', drop: getAvgMinutesNextN(dropPlayer, gw, 5), add: getAvgMinutesNextN(addPlayer, gw, 5) },
      { label: 'PPG', drop: getScoringValue(dropPlayer, 'season_avg', scoringMode), add: getScoringValue(addPlayer, 'season_avg', scoringMode) },
      // Opta quality metrics (only if either player has stats)
      ...(dropPlayer?.opta_stats || addPlayer?.opta_stats ? [
        { label: 'xG', drop: dropPlayer?.opta_stats?.xg || 0, add: addPlayer?.opta_stats?.xg || 0, separator: true },
        { label: 'xA', drop: dropPlayer?.opta_stats?.xa || 0, add: addPlayer?.opta_stats?.xa || 0 },
        ...(dropPlayer?.position === 'GKP' || addPlayer?.position === 'GKP' ? [
          { label: 'Saves', drop: dropPlayer?.opta_stats?.saves || 0, add: addPlayer?.opta_stats?.saves || 0 },
        ] : [
          { label: 'Key Passes', drop: dropPlayer?.opta_stats?.key_pass || 0, add: addPlayer?.opta_stats?.key_pass || 0 },
          { label: 'Shots', drop: dropPlayer?.opta_stats?.shots || 0, add: addPlayer?.opta_stats?.shots || 0 },
        ]),
      ] : []),
    ];
  }, [dropPlayer, addPlayer, scoringMode, currentGameweek]);

  // Fixture data for detail panels
  const getPlayerFixtures = (player) => {
    if (!player?.predictions || !currentGameweek) return { next5: [], remaining: [] };
    const currentGW = currentGameweek.number || 1;

    const allFixtures = (player.predictions || [])
      .filter(p => p.gw >= currentGW && p.gw <= TOTAL_GAMEWEEKS)
      .map(p => {
        let opponent = 'TBD', difficulty = 3, isHome = true;
        if (p.opp?.[0] && Array.isArray(p.opp[0]) && p.opp[0].length >= 3) {
          opponent = (p.opp[0][0] || 'TBD').toUpperCase();
          isHome = (p.opp[0][1] || '').includes('(H)');
          difficulty = p.opp[0][2] || 3;
        }
        const ffhPoints = p.predicted_pts || 0;
        return {
          gw: p.gw,
          opponent,
          isHome,
          difficulty,
          predictedMinutes: p.xmins || p.predicted_mins || 90,
          predictedPoints: scoringMode === 'v4'
            ? (p.v4_pts ?? p.v3_pts ?? ffhPoints)
            : scoringMode === 'v3'
            ? (p.v3_pts ?? ffhPoints)
            : ffhPoints
        };
      });

    return { next5: allFixtures.slice(0, 5), remaining: allFixtures };
  };

  const dropFixtures = getPlayerFixtures(dropPlayer);
  const addFixtures = getPlayerFixtures(addPlayer);

  // Swap players
  const handleSwap = () => {
    const tmpDrop = dropPlayer;
    const tmpAdd = addPlayer;
    setDropPlayer(tmpAdd);
    setAddPlayer(tmpDrop);
    setSearchTerm('');
    setShowSuggestions(false);
  };

  // Player name helper
  const pName = (p) => p?.web_name || p?.name || p?.full_name || 'Unknown';

  // Status badge for selected player chip
  const StatusBadge = ({ player }) => {
    if (!player?.fpl_status || player.fpl_status === 'a') return null;
    const badge = getFPLStatusBadge(player.fpl_status);
    if (!badge) return null;
    return <span className={`text-[9px] font-bold px-1 py-0.5 rounded ${badge.color}`}>{badge.badge}</span>;
  };

  // Verdict summary
  const verdictSummary = useMemo(() => {
    if (!metrics) return null;
    let addWins = 0;
    metrics.forEach(m => { if (m.add > m.drop) addWins++; });
    return { addWins, dropWins: metrics.length - addWins, total: metrics.length };
  }, [metrics]);

  return (
    <div className="space-y-4">
      {/* Selection Bar */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <div className="flex flex-col md:flex-row items-stretch gap-3">
          {/* Left: Your Player (dropdown) */}
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wide">Your Player (Drop)</label>
            {dropPlayer ? (
              <div className="flex items-center gap-2 bg-gray-700 rounded-lg px-3 py-2 border border-blue-500/50">
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${getSleeperPositionStyle(dropPlayer.position)}`}>
                  {dropPlayer.position}
                </span>
                <span className="text-white font-medium text-sm flex-1 truncate">{pName(dropPlayer)}</span>
                <span className="text-gray-500 text-xs">{dropPlayer.team_abbr}</span>
                <StatusBadge player={dropPlayer} />
                <button
                  onClick={() => setDropPlayer(null)}
                  className="text-gray-500 hover:text-red-400 ml-1 text-sm"
                >
                  ✕
                </button>
              </div>
            ) : (
              <select
                onChange={(e) => {
                  const player = myPlayers.find(p => p.player_id === e.target.value);
                  if (player) setDropPlayer(player);
                }}
                value=""
                className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none text-sm"
              >
                <option value="">Select from your team...</option>
                {['GKP', 'DEF', 'MID', 'FWD'].map(pos => {
                  const posPlayers = myPlayers.filter(p => p.position === pos);
                  if (posPlayers.length === 0) return null;
                  return (
                    <optgroup key={pos} label={pos}>
                      {posPlayers.map(p => (
                        <option key={p.player_id} value={p.player_id}>
                          {pName(p)} — {p.team_abbr} ({getScoringValue(p, 'season_total', scoringMode).toFixed(0)} pts)
                        </option>
                      ))}
                    </optgroup>
                  );
                })}
              </select>
            )}
          </div>

          {/* Swap button */}
          <div className="flex items-end justify-center pb-1">
            <button
              onClick={handleSwap}
              disabled={!dropPlayer && !addPlayer}
              className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-400 hover:text-white rounded-lg border border-gray-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-sm"
              title="Swap players"
            >
              ⇄
            </button>
          </div>

          {/* Right: Replacement (search) */}
          <div className="flex-1" ref={searchRef}>
            <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wide">Replacement (Add)</label>
            {addPlayer ? (
              <div className="flex items-center gap-2 bg-gray-700 rounded-lg px-3 py-2 border border-green-500/50">
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${getSleeperPositionStyle(addPlayer.position)}`}>
                  {addPlayer.position}
                </span>
                <span className="text-white font-medium text-sm flex-1 truncate">{pName(addPlayer)}</span>
                <span className="text-gray-500 text-xs">{addPlayer.team_abbr}</span>
                <StatusBadge player={addPlayer} />
                <button
                  onClick={() => { setAddPlayer(null); setSearchTerm(''); }}
                  className="text-gray-500 hover:text-red-400 ml-1 text-sm"
                >
                  ✕
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search for a player..."
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setShowSuggestions(e.target.value.length >= 2); }}
                  onFocus={() => { if (searchTerm.length >= 2) setShowSuggestions(true); }}
                  className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-green-500 focus:outline-none text-sm"
                />
                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute z-20 w-full mt-1 bg-gray-700 border border-gray-600 rounded-lg shadow-xl max-h-72 overflow-y-auto">
                    {suggestions.map(player => {
                      const isFree = !player.owned_by || player.owned_by === 'Free Agent';
                      return (
                        <button
                          key={player.player_id}
                          onClick={() => { setAddPlayer(player); setSearchTerm(''); setShowSuggestions(false); }}
                          className="w-full px-3 py-2 hover:bg-gray-600 text-left border-b border-gray-600/50 last:border-b-0 flex items-center gap-2"
                        >
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${getSleeperPositionStyle(player.position)}`}>
                            {player.position}
                          </span>
                          <span className="text-white text-sm font-medium flex-1 truncate">
                            {pName(player)}
                          </span>
                          <span className="text-gray-500 text-xs">{player.team_abbr}</span>
                          {isFree ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-900/50 text-green-400">FA</span>
                          ) : (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-600 text-gray-400">{player.owned_by}</span>
                          )}
                          <span className="text-gray-400 text-xs w-12 text-right">
                            {getScoringValue(player, 'season_total', scoringMode).toFixed(0)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Verdict Table */}
      {metrics && verdictSummary && (
        <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-4 gap-0 bg-gray-900 text-xs font-medium text-gray-400 uppercase tracking-wide">
            <div className="px-4 py-3">Metric</div>
            <div className="px-4 py-3 text-right">{pName(dropPlayer)}</div>
            <div className="px-4 py-3 text-right">{pName(addPlayer)}</div>
            <div className="px-4 py-3 text-right">Diff</div>
          </div>

          {/* Metric Rows */}
          <div className="divide-y divide-gray-700/50">
            {metrics.map((m) => {
              const diff = m.add - m.drop;
              const addBetter = diff > 0.05;
              const dropBetter = diff < -0.05;
              const isMinutes = m.label.includes('Mins');
              const isInteger = ['Key Passes', 'Shots', 'Saves'].includes(m.label);
              const fmt = (v) => isMinutes || isInteger ? Math.round(Number(v) || 0) : (Number(v) || 0).toFixed(1);
              return (
                <div key={m.label}>
                {m.separator && (
                  <div className="px-4 py-1.5 bg-gray-900/50 text-[10px] font-medium text-gray-500 uppercase tracking-widest">Opta Quality</div>
                )}
                <div className="grid grid-cols-4 gap-0 text-sm">
                  <div className="px-4 py-2.5 text-gray-400 font-medium">{m.label}</div>
                  <div className={`px-4 py-2.5 text-right font-mono ${dropBetter ? 'text-green-400 font-bold' : 'text-gray-300'}`}>
                    {fmt(m.drop)}
                  </div>
                  <div className={`px-4 py-2.5 text-right font-mono ${addBetter ? 'text-green-400 font-bold' : 'text-gray-300'}`}>
                    {fmt(m.add)}
                  </div>
                  <div className={`px-4 py-2.5 text-right font-mono font-bold ${
                    addBetter ? 'text-green-400' : dropBetter ? 'text-red-400' : 'text-gray-500'
                  }`}>
                    {addBetter ? '+' : ''}{fmt(diff)}
                  </div>
                </div>
                </div>
              );
            })}
          </div>

          {/* Verdict Summary */}
          <div className={`px-4 py-3 border-t border-gray-700 flex items-center justify-between ${
            verdictSummary.addWins > verdictSummary.dropWins
              ? 'bg-green-900/20'
              : verdictSummary.dropWins > verdictSummary.addWins
                ? 'bg-red-900/20'
                : 'bg-gray-700/30'
          }`}>
            <span className="text-sm font-bold text-white">
              {verdictSummary.addWins > verdictSummary.dropWins
                ? `Replacement wins ${verdictSummary.addWins}/${verdictSummary.total} metrics`
                : verdictSummary.dropWins > verdictSummary.addWins
                  ? `Your player wins ${verdictSummary.dropWins}/${verdictSummary.total} metrics`
                  : 'Even — tied across metrics'}
            </span>
            <span className={`text-xs font-bold px-2 py-1 rounded ${
              verdictSummary.addWins > verdictSummary.dropWins
                ? 'bg-green-600 text-white'
                : verdictSummary.dropWins > verdictSummary.addWins
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-600 text-gray-300'
            }`}>
              {verdictSummary.addWins > verdictSummary.dropWins
                ? 'ADD'
                : verdictSummary.dropWins > verdictSummary.addWins
                  ? 'KEEP'
                  : 'TOSS-UP'}
            </span>
          </div>
        </div>
      )}

      {/* Empty State */}
      {(!dropPlayer || !addPlayer) && (
        <div className="text-center py-10">
          <div className="text-5xl mb-3">⚖️</div>
          <h3 className="text-lg font-semibold text-white mb-1">Compare Two Players</h3>
          <p className="text-gray-500 text-sm">
            {!dropPlayer && !addPlayer
              ? 'Select a player from your team and search for a replacement'
              : !dropPlayer
                ? 'Select a player from your team on the left'
                : 'Search for a replacement on the right'}
          </p>
        </div>
      )}

      {/* Collapsible: Next 5 GW Charts */}
      {dropPlayer && addPlayer && dropFixtures.next5.length > 0 && addFixtures.next5.length > 0 && (
        <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
          <button
            onClick={() => setShowCharts(!showCharts)}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-700/50 transition-colors"
          >
            <span className="text-sm font-bold text-white">Next 5 GW Charts</span>
            <span className="text-gray-500 text-xs">{showCharts ? '▼' : '▶'}</span>
          </button>
          {showCharts && (
            <div className="px-4 pb-4">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-xs text-gray-400 mb-2 text-center">{pName(dropPlayer)}</p>
                  <ComparisonChart fixtures={dropFixtures.next5} barColor="bg-blue-500" />
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-2 text-center">{pName(addPlayer)}</p>
                  <ComparisonChart fixtures={addFixtures.next5} barColor="bg-green-500" />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Collapsible: Rest of Season Fixtures */}
      {dropPlayer && addPlayer && dropFixtures.remaining.length > 0 && addFixtures.remaining.length > 0 && (
        <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
          <button
            onClick={() => setShowFixtures(!showFixtures)}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-700/50 transition-colors"
          >
            <span className="text-sm font-bold text-white">Rest of Season Fixtures</span>
            <span className="text-gray-500 text-xs">{showFixtures ? '▼' : '▶'}</span>
          </button>
          {showFixtures && (
            <div className="px-4 pb-4">
              <div className="grid grid-cols-2 gap-6">
                {[{ player: dropPlayer, fixtures: dropFixtures.remaining }, { player: addPlayer, fixtures: addFixtures.remaining }].map(({ player, fixtures }, idx) => (
                  <div key={idx} className="bg-gray-700/50 rounded-lg overflow-hidden">
                    <div className="px-3 py-2 bg-gray-700 text-xs font-medium text-gray-400">
                      {pName(player)} — {fixtures.length} fixtures
                    </div>
                    <div className="overflow-y-auto max-h-80">
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-gray-700">
                          <tr className="border-b border-gray-600">
                            <th className="text-left py-1.5 px-2 text-gray-400">GW</th>
                            <th className="text-left py-1.5 px-2 text-gray-400">Opp</th>
                            <th className="text-center py-1.5 px-2 text-gray-400">FDR</th>
                            <th className="text-right py-1.5 px-2 text-gray-400">Pts</th>
                          </tr>
                        </thead>
                        <tbody>
                          {fixtures.map(f => (
                            <tr key={f.gw} className="border-b border-gray-600/50 hover:bg-gray-600/30">
                              <td className="py-1.5 px-2 text-white">{f.gw}</td>
                              <td className="py-1.5 px-2 text-white">{f.isHome ? 'vs ' : '@ '}{f.opponent}</td>
                              <td className="py-1.5 px-2 text-center">
                                <span className={`inline-flex items-center justify-center w-5 h-5 ${getDifficultyColor(f.difficulty)} rounded text-white text-[10px] font-bold`}>
                                  {f.difficulty}
                                </span>
                              </td>
                              <td className="py-1.5 px-2 text-right text-white font-bold">{f.predictedPoints.toFixed(1)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

ComparisonTabContent.propTypes = {
  players: PropTypes.arrayOf(PropTypes.object),
  currentGameweek: PropTypes.shape({
    number: PropTypes.number.isRequired
  }),
  scoringMode: PropTypes.oneOf(['ffh', 'v3']),
  onPlayerClick: PropTypes.func,
  preSelectedPlayer1: PropTypes.object,
  onClearPreSelection: PropTypes.func
};

ComparisonTabContent.defaultProps = {
  players: [],
  scoringMode: 'ffh',
  currentGameweek: { number: 1 },
  onPlayerClick: () => {},
  preSelectedPlayer1: null,
  onClearPreSelection: null
};

export default ComparisonTabContent;
