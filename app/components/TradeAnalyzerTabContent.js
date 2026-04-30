'use client';

import { useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import { ArrowLeftRight, Scale, Check } from 'lucide-react';
import { getNextNGameweeksTotal } from '../utils/predictionUtils';
import { getScoringValue } from '../services/v3ScoringService';
import { getSleeperPositionStyle } from '../constants/positionColors';
import { getFPLStatusBadge } from '../utils/newsUtils';

// Fixture difficulty cell styles (matches SquadFixtureForecast)
const DIFF_CELL = {
  1: { bg: 'bg-green-800',  border: 'border-green-700/50',  text: 'text-green-200'  },
  2: { bg: 'bg-lime-800',   border: 'border-lime-700/50',   text: 'text-lime-200'   },
  3: { bg: 'bg-yellow-800', border: 'border-yellow-700/50', text: 'text-yellow-200' },
  4: { bg: 'bg-orange-800', border: 'border-orange-700/50', text: 'text-orange-200' },
  5: { bg: 'bg-red-900',    border: 'border-red-800/50',    text: 'text-red-200'    },
};

const GW_COUNT = 5;
const POSITIONS = ['FWD', 'MID', 'DEF', 'GKP'];
const POS_ORDER = { FWD: 0, MID: 1, DEF: 2, GKP: 3 };

// Trade score metric weights (must sum to 1)
const WEIGHTS = { next1: 0.10, next3: 0.25, next5: 0.40, ros: 0.25 };

function pName(p) {
  return p?.web_name || p?.name || p?.full_name || 'Unknown';
}

function playerId(p) {
  return p?.player_id || p?.sleeper_id;
}

function computeWeightedScore({ next1Give, next1Rec, next3Give, next3Rec, next5Give, next5Rec, rosGive, rosRec }) {
  const pairs = [
    { give: next1Give, rec: next1Rec, weight: WEIGHTS.next1 },
    { give: next3Give, rec: next3Rec, weight: WEIGHTS.next3 },
    { give: next5Give, rec: next5Rec, weight: WEIGHTS.next5 },
    { give: rosGive,   rec: rosRec,   weight: WEIGHTS.ros   },
  ];
  let weightedSum = 0;
  let totalWeight = 0;
  for (const { give, rec, weight } of pairs) {
    if (give > 0 || rec > 0) {
      const ratio = give > 0 ? (rec / give) * 100 : 200;
      weightedSum += ratio * weight;
      totalWeight += weight;
    }
  }
  return totalWeight > 0 ? weightedSum / totalWeight : 100;
}

function ScoreBadge({ score }) {
  if (score == null) return null;
  let cls, label;
  if (score >= 110)      { cls = 'bg-emerald-600 text-white'; label = `${score.toFixed(0)}% ↑↑`; }
  else if (score >= 105) { cls = 'bg-green-700 text-white';   label = `${score.toFixed(0)}% ↑`;  }
  else if (score >= 95)  { cls = 'bg-yellow-700 text-white';  label = `${score.toFixed(0)}% ~`;  }
  else if (score >= 85)  { cls = 'bg-orange-700 text-white';  label = `${score.toFixed(0)}% ↓`;  }
  else                   { cls = 'bg-red-800 text-white';     label = `${score.toFixed(0)}% ↓↓`; }
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold ${cls}`}>
      {label}
    </span>
  );
}

// A single clickable player card in the roster grid
function PlayerCard({ player, isSelected, onToggle, scoringMode, currentGW }) {
  const badge = player?.fpl_status && player.fpl_status !== 'a'
    ? getFPLStatusBadge(player.fpl_status)
    : null;
  const n1  = getNextNGameweeksTotal(player, scoringMode, currentGW, 1);
  const n3  = getNextNGameweeksTotal(player, scoringMode, currentGW, 3);
  const n5  = getNextNGameweeksTotal(player, scoringMode, currentGW, 5);
  const ros = getScoringValue(player, 'season_total', scoringMode) || 0;

  return (
    <button
      onClick={() => onToggle(player)}
      className={`w-full text-left px-3 py-2 rounded-lg border transition-all ${
        isSelected
          ? 'bg-violet-600/20 border-violet-500 ring-1 ring-violet-500/50'
          : 'bg-slate-700/50 border-slate-600/50 hover:bg-slate-700 hover:border-slate-500'
      }`}
    >
      <div className="flex items-center gap-2">
        {/* Checkmark */}
        <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
          isSelected ? 'bg-violet-500 border-violet-500' : 'border-slate-500'
        }`}>
          {isSelected && <Check size={10} className="text-white" />}
        </div>

        {/* Player info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-white text-xs font-medium truncate">{pName(player)}</span>
            {badge && (
              <span className={`text-[9px] font-bold px-1 py-0.5 rounded ${badge.color}`}>{badge.badge}</span>
            )}
          </div>
          <div className="text-[10px] text-slate-400">{player.team_abbr || player.team}</div>
        </div>

        {/* Stats columns: n1 | n3 | n5 | ROS */}
        <div className="flex gap-2 shrink-0 text-right">
          {[['n1', n1], ['n3', n3], ['n5', n5], ['ROS', ros]].map(([label, val]) => (
            <div key={label} className="w-8">
              <div className="text-xs font-semibold text-slate-200">{val.toFixed(0)}</div>
              <div className="text-[9px] text-slate-500">{label}</div>
            </div>
          ))}
        </div>
      </div>
    </button>
  );
}

// Roster panel: shows a full roster grouped by position, players are toggled in/out
function RosterPickerPanel({
  title, accentColor, players, selectedPlayers,
  onToggle, ownerOptions, selectedOwner, onOwnerChange,
  scoringMode, currentGW,
}) {
  const [posFilter, setPosFilter] = useState('ALL');
  const selectedIds = useMemo(
    () => new Set(selectedPlayers.map(playerId)),
    [selectedPlayers]
  );

  const grouped = useMemo(() => {
    const filtered = posFilter === 'ALL' ? players : players.filter(p => p.position === posFilter);
    const byPos = { GKP: [], DEF: [], MID: [], FWD: [] };
    for (const p of filtered) {
      const pos = p.position?.toUpperCase();
      if (byPos[pos]) byPos[pos].push(p);
    }
    // Sort each group by next-5 total descending (consistent order)
    for (const pos of POSITIONS) {
      byPos[pos].sort((a, b) =>
        (getScoringValue(b, 'season_total', 'v4') || 0) -
        (getScoringValue(a, 'season_total', 'v4') || 0)
      );
    }
    return byPos;
  }, [players, posFilter]);

  const selectedCount = selectedPlayers.length;

  return (
    <div className="flex-1 bg-slate-800 border border-slate-700 rounded-lg flex flex-col min-h-0">
      {/* Panel header */}
      <div className="px-4 pt-4 pb-3 border-b border-slate-700 space-y-3 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <h3 className={`text-sm font-bold ${accentColor}`}>
            {title}
            {selectedCount > 0 && (
              <span className="ml-2 text-xs font-normal text-slate-400">
                {selectedCount} selected
              </span>
            )}
          </h3>
          {/* Owner selector for "receive" side */}
          {ownerOptions && (
            <select
              value={selectedOwner || ''}
              onChange={(e) => onOwnerChange(e.target.value || null)}
              className="text-xs bg-slate-700 border border-slate-600 text-slate-300 rounded px-2 py-1 max-w-[150px]"
            >
              <option value="">Pick owner…</option>
              {ownerOptions.map(o => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          )}
        </div>

        {/* Position filter tabs */}
        {players.length > 0 && (
          <div className="flex gap-1">
            {['ALL', ...POSITIONS].map(pos => (
              <button
                key={pos}
                onClick={() => setPosFilter(pos)}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  posFilter === pos
                    ? 'bg-violet-600 text-white'
                    : 'bg-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                {pos}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Roster list */}
      <div className="overflow-y-auto p-3 space-y-3 flex-1" style={{ maxHeight: '380px' }}>
        {ownerOptions && !selectedOwner ? (
          <div className="text-center py-8 text-slate-500 text-xs">
            Select an owner to see their roster
          </div>
        ) : players.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-xs">No players</div>
        ) : (
          POSITIONS.map(pos => {
            const group = grouped[pos];
            if (!group?.length) return null;
            return (
              <div key={pos}>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 px-1">
                  {pos}
                </div>
                <div className="space-y-1">
                  {group.map(player => (
                    <PlayerCard
                      key={playerId(player)}
                      player={player}
                      isSelected={selectedIds.has(playerId(player))}
                      onToggle={onToggle}
                      scoringMode={scoringMode}
                      currentGW={currentGW}
                    />
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function FixtureGrid({ players, currentGW, scoringMode, label, accentColor }) {
  if (!players.length) return null;

  const gwRange = [];
  for (let i = 0; i < GW_COUNT; i++) {
    const gw = currentGW + i;
    if (gw > 38) break;
    gwRange.push(gw);
  }

  return (
    <div>
      <div className={`text-xs font-semibold uppercase tracking-wider mb-2 ${accentColor}`}>{label}</div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr>
              <th className="text-left text-slate-500 font-medium pb-1.5 pr-3 w-28 min-w-[112px]">Player</th>
              {gwRange.map(gw => (
                <th key={gw} className="text-center text-slate-500 font-medium pb-1.5 px-0.5 min-w-[56px]">GW{gw}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {players.map((player, i) => (
              <tr key={playerId(player) || i}>
                <td className="pr-3 py-0.5">
                  <span className="text-slate-300 block truncate max-w-[100px]" title={pName(player)}>
                    {player.web_name || pName(player)}
                  </span>
                </td>
                {gwRange.map(gw => {
                  const pred = player.predictions?.find(p => p.gw === gw);
                  if (!pred?.opp?.[0] || !Array.isArray(pred.opp[0])) {
                    return (
                      <td key={gw} className="px-0.5 py-0.5">
                        <div className="flex items-center justify-center h-10 rounded bg-slate-700/20 text-slate-600 text-[10px]">—</div>
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
                        title={`${pName(player)} vs ${full} — Difficulty ${diff}/5 · ${pts.toFixed(1)} pts`}
                      >
                        <span className={`font-bold text-[10px] leading-tight ${style.text}`}>
                          {(code || '').toUpperCase()}
                          <span className="font-normal opacity-60 text-[8px] ml-0.5">{isHome ? 'H' : 'A'}</span>
                        </span>
                        <span className={`text-[10px] leading-tight font-medium ${style.text} opacity-80`}>
                          {pts.toFixed(1)}
                        </span>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

const TradeAnalyzerTabContent = ({ players = [], currentGameweek, scoringMode = 'v4', userId }) => {
  const [givePlayers, setGivePlayers] = useState([]);
  const [receivePlayers, setReceivePlayers] = useState([]);
  const [receiveOwner, setReceiveOwner] = useState(null);

  const gw = currentGameweek?.number || 1;

  const myPlayers = useMemo(
    () => players
      .filter(p => p.owned_by === userId || p.owned_by === 'You')
      .sort((a, b) => (POS_ORDER[a.position] ?? 4) - (POS_ORDER[b.position] ?? 4)),
    [players, userId]
  );

  // Other owners — FAs excluded (can't trade them)
  const otherOwners = useMemo(
    () => [...new Set(
      players
        .filter(p => p.owned_by && p.owned_by !== '' && p.owned_by !== 'Free Agent' && p.owned_by !== userId && p.owned_by !== 'You')
        .map(p => p.owned_by)
    )].sort(),
    [players, userId]
  );

  const theirPlayers = useMemo(
    () => receiveOwner
      ? players.filter(p => p.owned_by === receiveOwner)
      : [],
    [players, receiveOwner]
  );

  // Clear receive selections when owner changes
  const handleOwnerChange = (owner) => {
    setReceiveOwner(owner);
    setReceivePlayers([]);
  };

  const toggleGive = (player) => {
    const id = playerId(player);
    setGivePlayers(prev =>
      prev.some(p => playerId(p) === id)
        ? prev.filter(p => playerId(p) !== id)
        : [...prev, player]
    );
  };

  const toggleReceive = (player) => {
    const id = playerId(player);
    setReceivePlayers(prev =>
      prev.some(p => playerId(p) === id)
        ? prev.filter(p => playerId(p) !== id)
        : [...prev, player]
    );
  };

  const metrics = useMemo(() => {
    if (!givePlayers.length || !receivePlayers.length) return null;

    const sum = (list, fn) => list.reduce((acc, p) => acc + fn(p), 0);

    const next1Give = sum(givePlayers, p => getNextNGameweeksTotal(p, scoringMode, gw, 1));
    const next1Rec  = sum(receivePlayers, p => getNextNGameweeksTotal(p, scoringMode, gw, 1));
    const next3Give = sum(givePlayers, p => getNextNGameweeksTotal(p, scoringMode, gw, 3));
    const next3Rec  = sum(receivePlayers, p => getNextNGameweeksTotal(p, scoringMode, gw, 3));
    const next5Give = sum(givePlayers, p => getNextNGameweeksTotal(p, scoringMode, gw, 5));
    const next5Rec  = sum(receivePlayers, p => getNextNGameweeksTotal(p, scoringMode, gw, 5));
    const rosGive   = sum(givePlayers, p => getScoringValue(p, 'season_total', scoringMode));
    const rosRec    = sum(receivePlayers, p => getScoringValue(p, 'season_total', scoringMode));
    const ppgGive   = sum(givePlayers, p => getScoringValue(p, 'season_avg', scoringMode)) / givePlayers.length;
    const ppgRec    = sum(receivePlayers, p => getScoringValue(p, 'season_avg', scoringMode)) / receivePlayers.length;

    const yourScore  = computeWeightedScore({ next1Give, next1Rec, next3Give, next3Rec, next5Give, next5Rec, rosGive, rosRec });
    const theirScore = computeWeightedScore({ next1Give: next1Rec, next1Rec: next1Give, next3Give: next3Rec, next3Rec: next3Give, next5Give: next5Rec, next5Rec: next5Give, rosGive: rosRec, rosRec: rosGive });

    return {
      rows: [
        { label: 'Next GW',    give: next1Give, receive: next1Rec },
        { label: 'Next 3 GW',  give: next3Give, receive: next3Rec },
        { label: 'Next 5 GW',  give: next5Give, receive: next5Rec },
        { label: 'ROS Total',  give: rosGive,   receive: rosRec   },
        { label: 'Season PPG', give: ppgGive,   receive: ppgRec   },
      ],
      yourScore,
      theirScore,
    };
  }, [givePlayers, receivePlayers, scoringMode, gw]);

  const hasSelections = givePlayers.length > 0 || receivePlayers.length > 0;
  const canAnalyze = givePlayers.length > 0 && receivePlayers.length > 0;

  return (
    <div className="space-y-6">

      {/* Roster pickers */}
      <div className="flex flex-col sm:flex-row gap-4 items-stretch">
        <RosterPickerPanel
          title="You Give"
          accentColor="text-red-400"
          players={myPlayers}
          selectedPlayers={givePlayers}
          onToggle={toggleGive}
          scoringMode={scoringMode}
          currentGW={gw}
        />

        <div className="flex items-center justify-center text-slate-600 shrink-0 py-2">
          <ArrowLeftRight size={20} />
        </div>

        <RosterPickerPanel
          title="You Receive"
          accentColor="text-green-400"
          players={theirPlayers}
          selectedPlayers={receivePlayers}
          onToggle={toggleReceive}
          ownerOptions={otherOwners}
          selectedOwner={receiveOwner}
          onOwnerChange={handleOwnerChange}
          scoringMode={scoringMode}
          currentGW={gw}
        />
      </div>

      {/* Empty state */}
      {!hasSelections && (
        <div className="text-center py-10 text-slate-500">
          <Scale size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Select players on both sides to analyze the trade</p>
        </div>
      )}

      {/* Trade value analysis */}
      {canAnalyze && metrics && (
        <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-6">
            <span className="text-sm font-bold text-white flex items-center gap-2">
              <Scale size={14} className="text-slate-400" />
              Trade Value Analysis
            </span>
            <div className="flex items-center gap-4 sm:ml-auto">
              <div className="flex items-center gap-2">
                <span className="text-xs text-red-400 font-medium">Your side</span>
                <ScoreBadge score={metrics.yourScore} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-green-400 font-medium">Their side</span>
                <ScoreBadge score={metrics.theirScore} />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left px-4 py-2.5 text-slate-500 font-medium">Metric</th>
                  <th className="text-right px-4 py-2.5 text-red-400 font-medium">You Give</th>
                  <th className="text-right px-4 py-2.5 text-green-400 font-medium">You Receive</th>
                  <th className="text-right px-4 py-2.5 text-slate-400 font-medium">Delta</th>
                </tr>
              </thead>
              <tbody>
                {metrics.rows.map(({ label, give, receive }) => {
                  const delta = receive - give;
                  const deltaStr = delta >= 0 ? `+${delta.toFixed(1)}` : `${delta.toFixed(1)}`;
                  const deltaColor = delta > 0.05 ? 'text-green-400' : delta < -0.05 ? 'text-red-400' : 'text-slate-400';
                  return (
                    <tr key={label} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                      <td className="px-4 py-2.5 text-slate-300">{label}</td>
                      <td className="px-4 py-2.5 text-right text-white font-medium tabular-nums">{give.toFixed(1)}</td>
                      <td className="px-4 py-2.5 text-right text-white font-medium tabular-nums">{receive.toFixed(1)}</td>
                      <td className={`px-4 py-2.5 text-right font-bold tabular-nums ${deltaColor}`}>{deltaStr}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="px-4 py-2 bg-slate-900/40 text-[11px] text-slate-500">
            Trade score = weighted ratio of receive/give value (Next 5 GW 40% · Next 3 GW 25% · ROS 25% · Next GW 10%). 100% = balanced.
          </div>
        </div>
      )}

      {/* Fixture breakdown */}
      {hasSelections && (
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 space-y-5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-sm font-bold text-white">Fixture Breakdown — Next {GW_COUNT} GWs</h3>
            <div className="flex items-center gap-1.5 text-[10px]">
              <span className="text-slate-500 mr-0.5">Difficulty:</span>
              <span className="px-1.5 py-0.5 rounded bg-green-800 text-green-200">Easy</span>
              <span className="px-1.5 py-0.5 rounded bg-lime-800 text-lime-200">Fav</span>
              <span className="px-1.5 py-0.5 rounded bg-yellow-800 text-yellow-200">Med</span>
              <span className="px-1.5 py-0.5 rounded bg-orange-800 text-orange-200">Hard</span>
              <span className="px-1.5 py-0.5 rounded bg-red-900 text-red-200">V.Hard</span>
            </div>
          </div>

          {givePlayers.length > 0 && (
            <FixtureGrid players={givePlayers} currentGW={gw} scoringMode={scoringMode} label="You Give" accentColor="text-red-400" />
          )}
          {receivePlayers.length > 0 && (
            <FixtureGrid players={receivePlayers} currentGW={gw} scoringMode={scoringMode} label="You Receive" accentColor="text-green-400" />
          )}
        </div>
      )}
    </div>
  );
};

TradeAnalyzerTabContent.propTypes = {
  players: PropTypes.arrayOf(PropTypes.object).isRequired,
  currentGameweek: PropTypes.shape({ number: PropTypes.number.isRequired }),
  scoringMode: PropTypes.oneOf(['ffh', 'v3', 'v4']),
  userId: PropTypes.string,
};

export default TradeAnalyzerTabContent;
