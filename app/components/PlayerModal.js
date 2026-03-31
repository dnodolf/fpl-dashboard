/**
 * PlayerModal Component
 * Displays detailed player information in a modal
 * Phase 1: Header, Fixtures Table, Form Indicator, FFH/V3 Toggle
 */

'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { TOTAL_GAMEWEEKS } from '../config/constants';
import { getNextNGameweeksTotal } from '../utils/predictionUtils';
import { getDifficultyColor } from '../constants/designTokens';
import { timeAgo, getFPLStatusBadge } from '../utils/newsUtils';
import PlayerAvatar from './common/PlayerAvatar';
import { getTeamLogoFromPlayer, getTeamFullName } from '../utils/teamImage';

export function PlayerModal({
  player = null,
  isOpen,
  onClose,
  currentGameweek = { number: 15 },
  scoringMode: parentScoringMode = 'ffh',
  onCompare = null,
  userId
}) {
  const [localScoringMode, setLocalScoringMode] = useState(parentScoringMode);
  const [showAdvancedStats, setShowAdvancedStats] = useState(false);
  const modalRef = useRef(null);

  // Keep local scoring mode in sync when parent toggles while modal is open
  useEffect(() => {
    setLocalScoringMode(parentScoringMode);
  }, [parentScoringMode]);

  // ESC key closes modal; Tab key stays trapped inside
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === 'Tab' && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey ? document.activeElement === first : document.activeElement === last) {
          e.preventDefault();
          (e.shiftKey ? last : first)?.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    // Move focus into modal on open
    modalRef.current?.focus();
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Calculate key stats - all hooks must be called before any conditional returns
  const currentGW = currentGameweek?.number || 15;

  // Get predictions data
  const predictions = player?.predictions || [];
  const seasonTotal = localScoringMode === 'v4'
    ? (player?.v4_season_total || player?.v3_season_total)
    : localScoringMode === 'v3' ? player?.v3_season_total : player?.predicted_points;
  const seasonAvg = localScoringMode === 'v4'
    ? (player?.v4_season_avg || player?.v3_season_avg)
    : localScoringMode === 'v3' ? player?.v3_season_avg : player?.season_prediction_avg;
  const currentGWPrediction = getNextNGameweeksTotal(player, localScoringMode, currentGW, 1);

  // Calculate next 5 GW total using centralized utility
  const next5GWTotal = useMemo(() => {
    return getNextNGameweeksTotal(player, localScoringMode, currentGW, 5);
  }, [player, localScoringMode, currentGW]);

  // ROS (Rest of Season) points - use pre-calculated fields for consistency
  const rosPoints = useMemo(() => {
    if (localScoringMode === 'v4') {
      return player?.v4_season_total || player?.v3_season_total || 0;
    }
    if (localScoringMode === 'v3') {
      return player?.v3_season_total || 0;
    }
    return player?.predicted_points || 0;
  }, [player?.v4_season_total, player?.v3_season_total, player?.predicted_points, localScoringMode]);

  // Get next 5 gameweeks for chart (including current GW if still has predictions)
  const next5Fixtures = useMemo(() => {
    if (!predictions || predictions.length === 0) return [];

    return predictions
      .filter(p => p.gw >= currentGW && p.gw <= currentGW + 5)
      .slice(0, 5)
      .map(p => {
        // Extract opponent data from FFH nested array format: opp: [["AVL", "Aston Villa (H)", 3]]
        let opponent = 'TBD';
        let opponentFull = 'TBD';
        let difficulty = 3;
        let isHome = true;

        if (p.opp && Array.isArray(p.opp) && p.opp.length > 0) {
          const oppData = p.opp[0];
          if (Array.isArray(oppData) && oppData.length >= 3) {
            opponent = (oppData[0] || 'TBD').toUpperCase();
            opponentFull = oppData[1] || 'TBD';
            difficulty = oppData[2] || 3;
            isHome = opponentFull.includes('(H)');
          }
        }

        // Get predicted points - use embedded v3_pts for calibrated values
        const ffhPoints = p.predicted_pts || 0;
        const predictedPoints = localScoringMode === 'v4'
          ? (p.v4_pts ?? p.v3_pts ?? ffhPoints)
          : localScoringMode === 'v3'
          ? (p.v3_pts ?? ffhPoints)
          : ffhPoints;

        return {
          gw: p.gw,
          opponent: opponent,
          opponentFull: opponentFull,
          isHome: isHome,
          difficulty: difficulty,
          predictedMinutes: p.xmins || p.predicted_mins || 90,
          predictedPoints: predictedPoints
        };
      });
  }, [predictions, currentGW, localScoringMode, player?.position]);

  // Get all remaining fixtures for table (including current GW if predictions exist)
  const remainingFixtures = useMemo(() => {
    if (!predictions || predictions.length === 0) return [];

    return predictions
      .filter(p => p.gw >= currentGW && p.gw <= TOTAL_GAMEWEEKS)
      .map(p => {
        // Extract opponent data from FFH nested array format: opp: [["AVL", "Aston Villa (H)", 3]]
        let opponent = 'TBD';
        let opponentFull = 'TBD';
        let difficulty = 3;
        let isHome = true;

        if (p.opp && Array.isArray(p.opp) && p.opp.length > 0) {
          const oppData = p.opp[0];
          if (Array.isArray(oppData) && oppData.length >= 3) {
            opponent = (oppData[0] || 'TBD').toUpperCase();
            opponentFull = oppData[1] || 'TBD';
            difficulty = oppData[2] || 3;
            isHome = opponentFull.includes('(H)');
          }
        }

        // Get predicted points - use embedded v3_pts for calibrated values
        const ffhPoints = p.predicted_pts || 0;
        const predictedPoints = localScoringMode === 'v4'
          ? (p.v4_pts ?? p.v3_pts ?? ffhPoints)
          : localScoringMode === 'v3'
          ? (p.v3_pts ?? ffhPoints)
          : ffhPoints;

        return {
          gw: p.gw,
          opponent: opponent,
          opponentFull: opponentFull,
          isHome: isHome,
          difficulty: difficulty,
          predictedMinutes: p.xmins || p.predicted_mins || 90,
          predictedPoints: predictedPoints
        };
      });
  }, [predictions, currentGW, localScoringMode, player?.position]);

  // Calculate form (last 5 GWs trend)
  const formTrend = useMemo(() => {
    if (!predictions || predictions.length === 0) return null;

    const recentGames = predictions
      .filter(p => p.gw < currentGW && p.gw >= currentGW - 5)
      .slice(-5);

    if (recentGames.length < 3) return null;

    const avgPoints = recentGames.reduce((sum, p) => {
      const ffhPoints = p.predicted_pts || 0;
      const points = localScoringMode === 'v4'
        ? (p.v4_pts ?? p.v3_pts ?? ffhPoints)
        : localScoringMode === 'v3'
        ? (p.v3_pts ?? ffhPoints)
        : ffhPoints;
      return sum + points;
    }, 0) / recentGames.length;

    return avgPoints;
  }, [predictions, currentGW, localScoringMode, player?.position]);

  // Early return AFTER all hooks have been called
  if (!isOpen || !player) return null;

  // Get injury/availability status — prefer FPL status code, fallback to news text parsing
  const getAvailabilityStatus = (playerData) => {
    // Prefer FPL Official status (single character, authoritative)
    if (playerData.fpl_status) {
      const fplBadge = getFPLStatusBadge(playerData.fpl_status);
      if (fplBadge) return fplBadge;
    }

    // Fallback to news text parsing for unmatched players
    const news = playerData.news;
    if (!news) return null;

    const newsLower = news.toLowerCase();

    if (newsLower.includes('suspended') || newsLower.includes('banned')) {
      return { badge: 'SUSPENDED', color: 'bg-red-600 text-white', icon: '🚫' };
    }
    if (newsLower.includes('injured') || newsLower.includes('injury')) {
      return { badge: 'INJURED', color: 'bg-red-500 text-white', icon: '🏥' };
    }
    if (newsLower.includes('doubt') || newsLower.includes('doubtful') || newsLower.includes('50%')) {
      return { badge: 'DOUBTFUL', color: 'bg-orange-500 text-white', icon: '⚠️' };
    }
    if (newsLower.includes('knock') || newsLower.includes('minor')) {
      return { badge: 'KNOCK', color: 'bg-yellow-600 text-white', icon: '⚡' };
    }
    if (newsLower.includes('fit') || newsLower.includes('available') || newsLower.includes('training')) {
      return { badge: 'AVAILABLE', color: 'bg-green-600 text-white', icon: '✅' };
    }
    if (newsLower.includes('return') || newsLower.includes('back')) {
      return { badge: 'RETURNING', color: 'bg-violet-600 text-white', icon: '↩️' };
    }

    return { badge: 'NEWS', color: 'bg-slate-600 text-white', icon: '📰' };
  };

  // Get ownership display
  const getOwnershipDisplay = () => {
    if (player.owned_by === userId || player.owned_by === 'You') {
      return { text: 'Your Team', color: 'text-green-400' };
    } else if (!player.owned_by || player.owned_by === 'Free Agent') {
      return { text: 'Free Agent', color: 'text-violet-400' };
    } else {
      return { text: player.owned_by, color: 'text-yellow-400' };
    }
  };

  const ownership = getOwnershipDisplay();

  // Get form indicator
  const getFormIndicator = () => {
    if (!formTrend) return null;

    if (formTrend > seasonAvg * 1.2) {
      return { icon: '📈', text: 'Hot', color: 'text-green-400' };
    } else if (formTrend < seasonAvg * 0.8) {
      return { icon: '📉', text: 'Cold', color: 'text-red-400' };
    } else {
      return { icon: '➡️', text: 'Steady', color: 'text-yellow-400' };
    }
  };

  const form = getFormIndicator();

  // Position-themed gradient for header
  const getPositionGradient = (position) => {
    switch (position) {
      case 'GKP': return 'from-yellow-700 to-amber-900';
      case 'DEF': return 'from-green-700 to-emerald-900';
      case 'MID': return 'from-pink-700 to-fuchsia-900';
      case 'FWD': return 'from-purple-700 to-fuchsia-900';
      default: return 'from-slate-700 to-slate-900';
    }
  };

  // Position-themed ring color for avatar
  const getPositionRingColor = (position) => {
    switch (position) {
      case 'GKP': return 'ring-yellow-500';
      case 'DEF': return 'ring-green-500';
      case 'MID': return 'ring-pink-500';
      case 'FWD': return 'ring-purple-500';
      default: return 'ring-slate-500';
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm"
      onClick={onClose}
      style={{ animation: 'fadeIn 0.2s ease-out' }}
    >
      <div
        ref={modalRef}
        className="bg-slate-800 rounded-lg shadow-2xl w-full max-w-full sm:max-w-4xl max-h-[95vh] overflow-y-auto mx-4"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: 'slideUp 0.3s ease-out' }}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className={`bg-gradient-to-r ${getPositionGradient(player.position)} p-4 sm:p-6 rounded-t-lg relative`}>
          {/* Action buttons */}
          <div className="absolute top-4 right-4 flex items-center gap-2">
            {/* Compare button */}
            {onCompare && (
              <button
                onClick={() => {
                  onCompare(player);
                  onClose();
                }}
                className="px-3 py-1 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium rounded transition-colors"
              >
                Compare
              </button>
            )}
            {/* Close button */}
            <button
              onClick={onClose}
              className="text-slate-300 hover:text-white text-2xl font-bold"
            >
              ×
            </button>
          </div>

          {/* Player name and team */}
          <div className="mb-4 flex items-start gap-4">
            <div className={`ring-4 ${getPositionRingColor(player.position)} rounded-full`}>
              <PlayerAvatar player={player} size="xl" />
            </div>
            <div className="flex-1">
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-1">
                {player.web_name || player.name || player.full_name}
              </h2>
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-sm sm:text-lg">
                {/* Team logo and name */}
                <div className="flex items-center gap-2">
                  {getTeamLogoFromPlayer(player) && (
                    <img
                      src={getTeamLogoFromPlayer(player)}
                      alt={getTeamFullName(player.team_abbr)}
                      className="w-6 h-6 object-contain"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  )}
                  <span className="text-slate-200 font-medium">
                    {getTeamFullName(player.team_abbr) || player.team || 'N/A'}
                  </span>
                </div>
                <span className="text-slate-500">•</span>
                <span className="text-slate-300">{player.position}</span>
                <span className="text-slate-500">•</span>
                <span className={ownership.color}>{ownership.text}</span>
              </div>
            </div>
          </div>

          {/* Key stats grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-700 bg-opacity-50 rounded p-3">
              <div className="text-xs text-slate-400 mb-1">Current PPG</div>
              <div className="text-2xl font-bold text-white">
                {seasonAvg ? seasonAvg.toFixed(1) : 'N/A'}
              </div>
            </div>

            <div className="bg-slate-700 bg-opacity-50 rounded p-3">
              <div className="text-xs text-slate-400 mb-1">Next GW</div>
              <div className="text-2xl font-bold text-white">
                {currentGWPrediction ? currentGWPrediction.toFixed(1) : 'N/A'}
              </div>
            </div>

            <div className="bg-slate-700 bg-opacity-50 rounded p-3">
              <div className="text-xs text-slate-400 mb-1">Next 5 GW</div>
              <div className="text-2xl font-bold text-white">
                {next5GWTotal.toFixed(1)}
              </div>
            </div>

            <div className="bg-slate-700 bg-opacity-50 rounded p-3">
              <div className="text-xs text-slate-400 mb-1">ROS Points</div>
              <div className="text-2xl font-bold text-white">
                {rosPoints.toFixed(1)}
              </div>
            </div>
          </div>

          {/* Form indicator */}
          {form && (
            <div className="mt-4 flex items-center gap-2">
              <span className="text-sm text-slate-400">Form:</span>
              <span className={`text-sm ${form.color} flex items-center gap-1`}>
                {form.icon} {form.text}
              </span>
            </div>
          )}

          {/* Fixture Difficulty Heat Strip */}
          {next5Fixtures.length > 0 && (
            <div className="mt-4">
              <div className="text-xs text-slate-400 mb-2">Upcoming Fixtures</div>
              <div className="flex gap-1">
                {next5Fixtures.map((fixture) => (
                  <div
                    key={fixture.gw}
                    className={`w-12 h-8 rounded ${getDifficultyColor(fixture.difficulty)} flex flex-col items-center justify-center text-xs font-bold text-white cursor-default`}
                    title={`GW${fixture.gw}: ${fixture.isHome ? 'vs' : '@'} ${fixture.opponent} - Difficulty ${fixture.difficulty}`}
                  >
                    <span className="text-[10px] opacity-80">{fixture.gw}</span>
                    <span className="text-[9px] truncate max-w-[40px]">{fixture.opponent}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* News/Availability indicator */}
          {(player.news || (player.fpl_status && player.fpl_status !== 'a')) && (() => {
            const status = getAvailabilityStatus(player);
            if (!status) return null;
            const newsTimestamp = player.news_added || player.fpl_news_added;
            return (
              <div className="mt-3">
                <div className="flex items-start gap-2">
                  <span className={`px-2 py-1 rounded text-xs font-bold ${status.color} flex items-center gap-1 whitespace-nowrap`}>
                    <span>{status.icon}</span>
                    <span>{status.badge}</span>
                  </span>
                  <div className="flex-1">
                    {player.news && <p className="text-sm text-slate-300">{player.news}</p>}
                    {newsTimestamp && (
                      <p className="text-xs text-slate-500 mt-0.5">{timeAgo(newsTimestamp)}</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Season Stats - Only show if we have meaningful data */}
        {(() => {
          const hasStats = (player.goals_scored || player.goals ||
                           player.assists || player.minutes ||
                           player.clean_sheets || player.yellow_cards ||
                           player.red_cards || player.bonus);

          if (!hasStats) return null;

          return (
            <div className="bg-slate-800 px-6 py-4 border-b border-slate-700">
              <h3 className="text-sm font-semibold text-slate-400 mb-3">Season Stats (2024/25)</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {/* Goals - only show if > 0 or if player is attacker */}
                {((player.goals_scored || player.goals || 0) > 0 || player.position === 'FWD' || player.position === 'MID') && (
                  <div className="bg-slate-700 rounded p-2">
                    <div className="text-xs text-slate-400">Goals</div>
                    <div className="text-lg font-bold text-white">
                      {player.goals_scored || player.goals || 0}
                    </div>
                  </div>
                )}

                {/* Assists - only show if > 0 or if player is attacker/mid */}
                {((player.assists || 0) > 0 || player.position === 'FWD' || player.position === 'MID') && (
                  <div className="bg-slate-700 rounded p-2">
                    <div className="text-xs text-slate-400">Assists</div>
                    <div className="text-lg font-bold text-white">
                      {player.assists || 0}
                    </div>
                  </div>
                )}

                {/* Clean Sheets - only for GKP/DEF */}
                {(player.position === 'GKP' || player.position === 'DEF') && (player.clean_sheets || 0) >= 0 && (
                  <div className="bg-slate-700 rounded p-2">
                    <div className="text-xs text-slate-400">Clean Sheets</div>
                    <div className="text-lg font-bold text-white">
                      {player.clean_sheets || 0}
                    </div>
                  </div>
                )}

                {/* Minutes - always show if available */}
                {(player.minutes || 0) > 0 && (
                  <div className="bg-slate-700 rounded p-2">
                    <div className="text-xs text-slate-400">Minutes</div>
                    <div className="text-lg font-bold text-white">
                      {player.minutes || 0}
                    </div>
                  </div>
                )}

                {/* Yellow Cards - only if > 0 */}
                {(player.yellow_cards || 0) > 0 && (
                  <div className="bg-slate-700 rounded p-2">
                    <div className="text-xs text-slate-400">Yellow Cards</div>
                    <div className="text-lg font-bold text-yellow-400">
                      {player.yellow_cards}
                    </div>
                  </div>
                )}

                {/* Red Cards - only if > 0 */}
                {(player.red_cards || 0) > 0 && (
                  <div className="bg-slate-700 rounded p-2">
                    <div className="text-xs text-slate-400">Red Cards</div>
                    <div className="text-lg font-bold text-red-400">
                      {player.red_cards}
                    </div>
                  </div>
                )}

                {/* Bonus Points - only if available */}
                {typeof player.bonus !== 'undefined' && player.bonus > 0 && (
                  <div className="bg-slate-700 rounded p-2">
                    <div className="text-xs text-slate-400">Bonus</div>
                    <div className="text-lg font-bold text-purple-400">
                      {player.bonus}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* Advanced Stats (Opta) - collapsible */}
        {player.opta_stats && (
          <div className="bg-slate-800 border-b border-slate-700">
            <button
              onClick={() => setShowAdvancedStats(!showAdvancedStats)}
              className="w-full px-6 py-3 flex items-center justify-between text-sm font-semibold text-slate-400 hover:text-slate-200 transition-colors"
            >
              <span>Advanced Stats (Opta)</span>
              <span className="text-xs">{showAdvancedStats ? '▲' : '▼'}</span>
            </button>
            {showAdvancedStats && (() => {
              const s = player.opta_stats;
              const pos = player.position;
              const n = (val) => Number(val) || 0;
              const per90 = (val) => s.mins > 0 ? (n(val) / n(s.mins) * 90).toFixed(1) : '0.0';
              const isGK = pos === 'GKP';
              const isDEF = pos === 'DEF';
              const isMID = pos === 'MID';
              const isFWD = pos === 'FWD';
              const isAttacker = isMID || isFWD;

              const StatCard = ({ label, value, sub, color = 'text-white' }) => (
                <div className="bg-slate-700 rounded p-2">
                  <div className="text-xs text-slate-400">{label}</div>
                  <div className={`text-lg font-bold ${color}`}>{value}</div>
                  {sub && <div className="text-xs text-slate-500">{sub}</div>}
                </div>
              );

              return (
                <div className="px-6 pb-4 space-y-4">
                  {/* xG & Shooting - relevant for outfield */}
                  {!isGK && (
                    <div>
                      <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">xG & Shooting</div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        <StatCard label="xG" value={n(s.xg).toFixed(2)} sub={`${per90(s.xg)}/90`} color="text-green-400" />
                        <StatCard label="xA" value={n(s.xa).toFixed(2)} sub={`${per90(s.xa)}/90`} color="text-violet-400" />
                        <StatCard label="Shots" value={s.shots} sub={`${s.shots_on_target} on target`} />
                        <StatCard label="Big Chances" value={s.big_chance} />
                      </div>
                    </div>
                  )}

                  {/* Creativity - relevant for MID/FWD/DEF */}
                  {!isGK && (
                    <div>
                      <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Creativity</div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        <StatCard label="Key Passes" value={s.key_pass} sub={`${per90(s.key_pass)}/90`} color="text-violet-400" />
                        <StatCard label="Big Ch. Created" value={s.big_chance_created} />
                        <StatCard label="Pass Accuracy" value={n(s.total_pass) > 0 ? `${Math.round(n(s.acc_pass) / n(s.total_pass) * 100)}%` : 'N/A'} sub={`${n(s.acc_pass)}/${n(s.total_pass)}`} />
                        <StatCard label="Dribbles" value={s.succ_drib} />
                      </div>
                    </div>
                  )}

                  {/* Defending - relevant for DEF/MID or GK */}
                  {(isDEF || isMID || isGK) && (
                    <div>
                      <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">{isGK ? 'Goalkeeping' : 'Defending'}</div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {isGK ? (
                          <>
                            <StatCard label="Saves" value={s.saves} sub={`${per90(s.saves)}/90`} color="text-yellow-400" />
                            <StatCard label="Goals Conceded" value={s.goals_conceded} />
                            <StatCard label="Clean Sheets" value={s.clean_sheets} color="text-green-400" />
                            <StatCard label="Pen Saves" value={`${n(s.pen_goal)}/${n(s.pen_taken)}`} />
                          </>
                        ) : (
                          <>
                            <StatCard label="Tackles Won" value={s.tackles_won} sub={`${per90(s.tackles_won)}/90`} />
                            <StatCard label="Interceptions" value={s.intercepts} sub={`${per90(s.intercepts)}/90`} />
                            <StatCard label="Clearances" value={s.clearances} />
                            <StatCard label="Blocks" value={s.blocks} />
                            {isDEF && <StatCard label="Recoveries" value={s.recoveries} sub={`${per90(s.recoveries)}/90`} />}
                            {isDEF && <StatCard label="Clean Sheets" value={s.clean_sheets} color="text-green-400" />}
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ICT Index - all positions */}
                  <div>
                    <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">ICT Index</div>
                    <div className="grid grid-cols-3 gap-2">
                      <StatCard label="Influence" value={n(s.influence).toFixed(0)} color="text-orange-400" />
                      <StatCard label="Creativity" value={n(s.creativity).toFixed(0)} color="text-purple-400" />
                      <StatCard label="Threat" value={n(s.threat).toFixed(0)} color="text-red-400" />
                    </div>
                  </div>

                  {/* Playing time summary */}
                  <div>
                    <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Playing Time</div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      <StatCard label="Minutes" value={n(s.mins).toLocaleString()} />
                      <StatCard label="Appearances" value={s.appearance} sub={`${s.starts} starts`} />
                      <StatCard label="BPS" value={s.bps} />
                      <StatCard label="Bonus" value={s.bonus} color="text-purple-400" />
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* Scoring mode toggle */}
        <div className="bg-slate-900 px-6 py-3 border-b border-slate-700/60">
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-400">Scoring:</span>
            <button
              onClick={() => setLocalScoringMode('ffh')}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                localScoringMode === 'ffh'
                  ? 'bg-violet-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              FFH FPL
            </button>
            <button
              onClick={() => setLocalScoringMode('v3')}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                localScoringMode === 'v3'
                  ? 'bg-purple-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              V3 Sleeper
            </button>
            <button
              onClick={() => setLocalScoringMode('v4')}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                localScoringMode === 'v4'
                  ? 'bg-amber-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              V4 Ensemble
            </button>
          </div>
        </div>

        {/* Next 5 GW Predicted Points Bar Chart */}
        {next5Fixtures.length > 0 && (
          <div className="px-6 pt-6 pb-4 border-b border-slate-700">
            <h3 className="text-lg font-bold text-white mb-4">Next 5 Gameweeks</h3>
            <div className="relative h-48">
              {/* Y-axis labels */}
              <div className="absolute left-0 top-0 bottom-12 w-8 flex flex-col justify-between text-xs text-slate-400">
                {(() => {
                  const maxPoints = Math.max(...next5Fixtures.map(f => f.predictedPoints), 1);
                  const roundedMax = Math.ceil(maxPoints);
                  return [roundedMax, Math.round(roundedMax * 0.5), 0].map((val, i) => (
                    <div key={i} className="text-right">{val}</div>
                  ));
                })()}
              </div>

              {/* Chart area */}
              <div className="absolute left-10 right-0 top-0 bottom-12">
                {/* Grid lines */}
                <div className="absolute inset-0 flex flex-col justify-between">
                  <div className="border-t border-slate-700"></div>
                  <div className="border-t border-slate-700"></div>
                  <div className="border-t border-slate-700"></div>
                </div>

                {/* Bar chart */}
                <div className="absolute inset-0 flex items-end justify-between gap-2">
                  {(() => {
                    const maxPoints = Math.max(...next5Fixtures.map(f => f.predictedPoints), 1);
                    return next5Fixtures.map((fixture) => {
                      const heightPercent = (fixture.predictedPoints / maxPoints) * 100;

                      return (
                        <div key={fixture.gw} className="flex-1 flex flex-col items-center justify-end group relative h-full">
                          {/* Tooltip */}
                          <div className="absolute bottom-full mb-2 hidden group-hover:block bg-slate-900 text-white text-xs rounded py-1 px-2 whitespace-nowrap z-10">
                            <div className="font-bold">{fixture.predictedPoints.toFixed(1)} pts</div>
                            <div>{fixture.isHome ? 'vs' : '@'} {fixture.opponent}</div>
                          </div>

                          {/* Points label above bar */}
                          <div className="text-xs font-bold text-white mb-1 absolute" style={{ bottom: `${heightPercent}%` }}>
                            {fixture.predictedPoints.toFixed(1)}
                          </div>

                          {/* Bar */}
                          <div
                            className="w-1/2 bg-violet-500 rounded-t transition-all hover:opacity-80 relative"
                            style={{ height: `${heightPercent}%`, minHeight: '2px' }}
                          />
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* X-axis labels */}
              <div className="absolute left-10 right-0 bottom-0 h-12 flex items-start justify-between gap-2">
                {next5Fixtures.map((fixture) => (
                  <div key={fixture.gw} className="flex-1 flex flex-col items-center text-center">
                    <div className="text-xs font-medium text-slate-300">GW{fixture.gw}</div>
                    <div className="text-xs text-slate-500">{fixture.isHome ? 'vs' : '@'} {fixture.opponent}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Rest of Season Fixtures Table */}
        {remainingFixtures.length > 0 && (
          <div className="p-6">
            <h3 className="text-xl font-bold text-white mb-4">
              Rest of Season Fixtures
              <span className="text-sm text-slate-400 font-normal ml-2">
                ({remainingFixtures.length} fixtures)
              </span>
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-2 px-3 text-slate-400 font-medium">GW</th>
                    <th className="text-left py-2 px-3 text-slate-400 font-medium">Opponent</th>
                    <th className="text-center py-2 px-3 text-slate-400 font-medium">Difficulty</th>
                    <th className="text-center py-2 px-3 text-slate-400 font-medium">Minutes</th>
                    <th className="text-right py-2 px-3 text-slate-400 font-medium">Predicted Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {remainingFixtures.map((fixture) => (
                    <tr key={fixture.gw} className="border-b border-slate-700 hover:bg-slate-700">
                      <td className="py-3 px-3 text-white font-medium">{fixture.gw}</td>
                      <td className="py-3 px-3 text-white">
                        {fixture.isHome ? 'vs ' : '@ '}
                        {fixture.opponent}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`inline-block w-8 h-8 ${getDifficultyColor(fixture.difficulty)} rounded text-white font-bold flex items-center justify-center`}>
                          {fixture.difficulty}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center text-slate-300">
                        {fixture.predictedMinutes}'
                      </td>
                      <td className="py-3 px-3 text-right text-white font-bold">
                        {fixture.predictedPoints.toFixed(1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

PlayerModal.propTypes = {
  player: PropTypes.object,
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  currentGameweek: PropTypes.shape({
    number: PropTypes.number.isRequired
  }),
  scoringMode: PropTypes.oneOf(['ffh', 'v3', 'v4']),
  onCompare: PropTypes.func,
  userId: PropTypes.string
};
