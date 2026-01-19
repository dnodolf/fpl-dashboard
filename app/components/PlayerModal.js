/**
 * PlayerModal Component
 * Displays detailed player information in a modal
 * Phase 1: Header, Fixtures Table, Form Indicator, FFH/V3 Toggle
 */

'use client';

import { useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import { TOTAL_GAMEWEEKS, USER_ID } from '../config/constants';
import { convertToV3Points } from '../services/v3/conversionRatios';
import { getNextNGameweeksTotal } from '../utils/predictionUtils';
import { getDifficultyColor } from '../constants/designTokens';
import PlayerAvatar from './common/PlayerAvatar';

export function PlayerModal({
  player = null,
  isOpen,
  onClose,
  currentGameweek = { number: 15 },
  scoringMode: parentScoringMode = 'ffh',
  onCompare = null
}) {
  const [localScoringMode, setLocalScoringMode] = useState(parentScoringMode);

  // Calculate key stats - all hooks must be called before any conditional returns
  const currentGW = currentGameweek?.number || 15;

  // Get predictions data
  const predictions = player?.predictions || [];
  const seasonTotal = localScoringMode === 'v3' ? player?.v3_season_total : player?.predicted_points;
  const seasonAvg = localScoringMode === 'v3' ? player?.v3_season_avg : player?.season_prediction_avg;
  const currentGWPrediction = localScoringMode === 'v3' ? player?.v3_current_gw : player?.current_gw_prediction;

  // Calculate next 5 GW total using centralized utility
  const next5GWTotal = useMemo(() => {
    return getNextNGameweeksTotal(player, localScoringMode, currentGW, 5);
  }, [player, localScoringMode, currentGW]);

  // Calculate ROS (Rest of Season) points
  const rosPoints = useMemo(() => {
    if (!predictions || predictions.length === 0) return seasonTotal || 0;

    const remainingPredictions = predictions.filter(p => p.gw >= currentGW);
    return remainingPredictions.reduce((sum, p) => {
      const ffhPoints = p.predicted_pts || 0;
      const points = localScoringMode === 'v3' ? convertToV3Points(ffhPoints, player?.position) : ffhPoints;
      return sum + points;
    }, 0);
  }, [predictions, currentGW, localScoringMode, seasonTotal, player?.position]);

  // Get next 5 gameweeks for chart (excluding current live GW)
  const next5Fixtures = useMemo(() => {
    if (!predictions || predictions.length === 0) return [];

    return predictions
      .filter(p => p.gw > currentGW && p.gw <= currentGW + 5)
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

        // Get predicted points - FFH uses predicted_pts, V3 converts on the fly
        const ffhPoints = p.predicted_pts || 0;
        const predictedPoints = localScoringMode === 'v3' ? convertToV3Points(ffhPoints, player?.position) : ffhPoints;

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

  // Get all remaining fixtures for table (from next GW onwards)
  const remainingFixtures = useMemo(() => {
    if (!predictions || predictions.length === 0) return [];

    return predictions
      .filter(p => p.gw > currentGW && p.gw <= TOTAL_GAMEWEEKS)
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

        // Get predicted points - FFH uses predicted_pts, V3 converts on the fly
        const ffhPoints = p.predicted_pts || 0;
        const predictedPoints = localScoringMode === 'v3' ? convertToV3Points(ffhPoints, player?.position) : ffhPoints;

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
      const points = localScoringMode === 'v3' ? convertToV3Points(ffhPoints, player?.position) : ffhPoints;
      return sum + points;
    }, 0) / recentGames.length;

    return avgPoints;
  }, [predictions, currentGW, localScoringMode, player?.position]);

  // Early return AFTER all hooks have been called
  if (!isOpen || !player) return null;

  // Get injury/availability status from news
  const getAvailabilityStatus = (news) => {
    if (!news) return null;

    const newsLower = news.toLowerCase();

    // Critical - Red badges
    if (newsLower.includes('suspended') || newsLower.includes('banned')) {
      return {
        badge: 'SUSPENDED',
        color: 'bg-red-600 text-white',
        icon: '🚫'
      };
    }
    if (newsLower.includes('injured') || newsLower.includes('injury')) {
      return {
        badge: 'INJURED',
        color: 'bg-red-500 text-white',
        icon: '🏥'
      };
    }

    // Warning - Orange/Yellow badges
    if (newsLower.includes('doubt') || newsLower.includes('doubtful') || newsLower.includes('50%')) {
      return {
        badge: 'DOUBTFUL',
        color: 'bg-orange-500 text-white',
        icon: '⚠️'
      };
    }
    if (newsLower.includes('knock') || newsLower.includes('minor')) {
      return {
        badge: 'KNOCK',
        color: 'bg-yellow-600 text-white',
        icon: '⚡'
      };
    }

    // Positive - Green/Blue badges
    if (newsLower.includes('fit') || newsLower.includes('available') || newsLower.includes('training')) {
      return {
        badge: 'AVAILABLE',
        color: 'bg-green-600 text-white',
        icon: '✅'
      };
    }
    if (newsLower.includes('return') || newsLower.includes('back')) {
      return {
        badge: 'RETURNING',
        color: 'bg-blue-600 text-white',
        icon: '↩️'
      };
    }

    // Default - Gray badge for other news
    return {
      badge: 'NEWS',
      color: 'bg-gray-600 text-white',
      icon: '📰'
    };
  };

  // Get ownership display
  const getOwnershipDisplay = () => {
    if (player.owned_by === USER_ID || player.owned_by === 'You') {
      return { text: 'Your Team', color: 'text-green-400' };
    } else if (!player.owned_by || player.owned_by === 'Free Agent') {
      return { text: 'Free Agent', color: 'text-blue-400' };
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75" onClick={onClose}>
      <div
        className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-900 to-purple-900 p-6 rounded-t-lg relative">
          {/* Action buttons */}
          <div className="absolute top-4 right-4 flex items-center gap-2">
            {/* Compare button */}
            {onCompare && (
              <button
                onClick={() => {
                  onCompare(player);
                  onClose();
                }}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded transition-colors"
              >
                Compare
              </button>
            )}
            {/* Close button */}
            <button
              onClick={onClose}
              className="text-gray-300 hover:text-white text-2xl font-bold"
            >
              ×
            </button>
          </div>

          {/* Player name and team */}
          <div className="mb-4 flex items-start gap-4">
            <PlayerAvatar player={player} size="lg" />
            <div>
              <h2 className="text-3xl font-bold text-white mb-1">
                {player.web_name || player.name || player.full_name}
              </h2>
            <div className="flex items-center gap-2 text-lg">
              <span className="text-gray-300">{player.team || 'N/A'}</span>
              <span className="text-gray-400">•</span>
              <span className="text-gray-300">{player.position}</span>
              <span className="text-gray-400">•</span>
              <span className={ownership.color}>{ownership.text}</span>
            </div>
            </div>
          </div>

          {/* Key stats grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-700 bg-opacity-50 rounded p-3">
              <div className="text-xs text-gray-400 mb-1">Current PPG</div>
              <div className="text-2xl font-bold text-white">
                {seasonAvg ? seasonAvg.toFixed(1) : 'N/A'}
              </div>
            </div>

            <div className="bg-gray-700 bg-opacity-50 rounded p-3">
              <div className="text-xs text-gray-400 mb-1">Next GW</div>
              <div className="text-2xl font-bold text-white">
                {currentGWPrediction ? currentGWPrediction.toFixed(1) : 'N/A'}
              </div>
            </div>

            <div className="bg-gray-700 bg-opacity-50 rounded p-3">
              <div className="text-xs text-gray-400 mb-1">Next 5 GW</div>
              <div className="text-2xl font-bold text-white">
                {next5GWTotal.toFixed(1)}
              </div>
            </div>

            <div className="bg-gray-700 bg-opacity-50 rounded p-3">
              <div className="text-xs text-gray-400 mb-1">ROS Points</div>
              <div className="text-2xl font-bold text-white">
                {rosPoints.toFixed(1)}
              </div>
            </div>
          </div>

          {/* Form indicator */}
          {form && (
            <div className="mt-4 flex items-center gap-2">
              <span className="text-sm text-gray-400">Form:</span>
              <span className={`text-sm ${form.color} flex items-center gap-1`}>
                {form.icon} {form.text}
              </span>
            </div>
          )}

          {/* News/Availability indicator */}
          {player.news && (
            <div className="mt-3">
              {(() => {
                const status = getAvailabilityStatus(player.news);
                return (
                  <div className="flex items-start gap-2">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${status.color} flex items-center gap-1`}>
                      <span>{status.icon}</span>
                      <span>{status.badge}</span>
                    </span>
                    <p className="text-sm text-gray-300 flex-1">{player.news}</p>
                  </div>
                );
              })()}
            </div>
          )}
        </div>

        {/* Season Stats - Only show if we have meaningful data */}
        {(() => {
          const hasStats = (player.goals_scored || player.goals ||
                           player.assists || player.minutes ||
                           player.clean_sheets || player.yellow_cards ||
                           player.red_cards || player.bonus);

          if (!hasStats) return null;

          return (
            <div className="bg-gray-800 px-6 py-4 border-b border-gray-700">
              <h3 className="text-sm font-semibold text-gray-400 mb-3">Season Stats (2024/25)</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {/* Goals - only show if > 0 or if player is attacker */}
                {((player.goals_scored || player.goals || 0) > 0 || player.position === 'FWD' || player.position === 'MID') && (
                  <div className="bg-gray-700 rounded p-2">
                    <div className="text-xs text-gray-400">Goals</div>
                    <div className="text-lg font-bold text-white">
                      {player.goals_scored || player.goals || 0}
                    </div>
                  </div>
                )}

                {/* Assists - only show if > 0 or if player is attacker/mid */}
                {((player.assists || 0) > 0 || player.position === 'FWD' || player.position === 'MID') && (
                  <div className="bg-gray-700 rounded p-2">
                    <div className="text-xs text-gray-400">Assists</div>
                    <div className="text-lg font-bold text-white">
                      {player.assists || 0}
                    </div>
                  </div>
                )}

                {/* Clean Sheets - only for GKP/DEF */}
                {(player.position === 'GKP' || player.position === 'DEF') && (player.clean_sheets || 0) >= 0 && (
                  <div className="bg-gray-700 rounded p-2">
                    <div className="text-xs text-gray-400">Clean Sheets</div>
                    <div className="text-lg font-bold text-white">
                      {player.clean_sheets || 0}
                    </div>
                  </div>
                )}

                {/* Minutes - always show if available */}
                {(player.minutes || 0) > 0 && (
                  <div className="bg-gray-700 rounded p-2">
                    <div className="text-xs text-gray-400">Minutes</div>
                    <div className="text-lg font-bold text-white">
                      {player.minutes || 0}
                    </div>
                  </div>
                )}

                {/* Yellow Cards - only if > 0 */}
                {(player.yellow_cards || 0) > 0 && (
                  <div className="bg-gray-700 rounded p-2">
                    <div className="text-xs text-gray-400">Yellow Cards</div>
                    <div className="text-lg font-bold text-yellow-400">
                      {player.yellow_cards}
                    </div>
                  </div>
                )}

                {/* Red Cards - only if > 0 */}
                {(player.red_cards || 0) > 0 && (
                  <div className="bg-gray-700 rounded p-2">
                    <div className="text-xs text-gray-400">Red Cards</div>
                    <div className="text-lg font-bold text-red-400">
                      {player.red_cards}
                    </div>
                  </div>
                )}

                {/* Bonus Points - only if available */}
                {typeof player.bonus !== 'undefined' && player.bonus > 0 && (
                  <div className="bg-gray-700 rounded p-2">
                    <div className="text-xs text-gray-400">Bonus</div>
                    <div className="text-lg font-bold text-purple-400">
                      {player.bonus}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* Scoring mode toggle */}
        <div className="bg-gray-700 px-6 py-3 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-400">Scoring:</span>
            <button
              onClick={() => setLocalScoringMode('ffh')}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                localScoringMode === 'ffh'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              FFH FPL
            </button>
            <button
              onClick={() => setLocalScoringMode('v3')}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                localScoringMode === 'v3'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              V3 Sleeper
            </button>
          </div>
        </div>

        {/* Next 5 GW Predicted Points Bar Chart */}
        {next5Fixtures.length > 0 && (
          <div className="px-6 pt-6 pb-4 border-b border-gray-700">
            <h3 className="text-lg font-bold text-white mb-4">Next 5 Gameweeks</h3>
            <div className="relative h-48">
              {/* Y-axis labels */}
              <div className="absolute left-0 top-0 bottom-12 w-8 flex flex-col justify-between text-xs text-gray-400">
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
                  <div className="border-t border-gray-700"></div>
                  <div className="border-t border-gray-700"></div>
                  <div className="border-t border-gray-700"></div>
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
                          <div className="absolute bottom-full mb-2 hidden group-hover:block bg-gray-900 text-white text-xs rounded py-1 px-2 whitespace-nowrap z-10">
                            <div className="font-bold">{fixture.predictedPoints.toFixed(1)} pts</div>
                            <div>{fixture.isHome ? 'vs' : '@'} {fixture.opponent}</div>
                          </div>

                          {/* Points label above bar */}
                          <div className="text-xs font-bold text-white mb-1 absolute" style={{ bottom: `${heightPercent}%` }}>
                            {fixture.predictedPoints.toFixed(1)}
                          </div>

                          {/* Bar */}
                          <div
                            className="w-1/2 bg-blue-500 rounded-t transition-all hover:opacity-80 relative"
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
                    <div className="text-xs font-medium text-gray-300">GW{fixture.gw}</div>
                    <div className="text-xs text-gray-500">{fixture.isHome ? 'vs' : '@'} {fixture.opponent}</div>
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
              <span className="text-sm text-gray-400 font-normal ml-2">
                ({remainingFixtures.length} fixtures)
              </span>
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-2 px-3 text-gray-400 font-medium">GW</th>
                    <th className="text-left py-2 px-3 text-gray-400 font-medium">Opponent</th>
                    <th className="text-center py-2 px-3 text-gray-400 font-medium">Difficulty</th>
                    <th className="text-center py-2 px-3 text-gray-400 font-medium">Minutes</th>
                    <th className="text-right py-2 px-3 text-gray-400 font-medium">Predicted Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {remainingFixtures.map((fixture) => (
                    <tr key={fixture.gw} className="border-b border-gray-700 hover:bg-gray-700">
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
                      <td className="py-3 px-3 text-center text-gray-300">
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
  scoringMode: PropTypes.oneOf(['ffh', 'v3']),
  onCompare: PropTypes.func
};
