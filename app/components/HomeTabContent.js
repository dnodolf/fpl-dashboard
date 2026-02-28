// app/components/HomeTabContent.js
'use client';

import { useState, useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import { USER_ID } from '../config/constants';
import { getSleeperPositionStyle } from '../constants/positionColors';
import { timeAgo, getFPLStatusBadge } from '../utils/newsUtils';
import PlayerAvatar from './common/PlayerAvatar';

// Progress Ring component for visual stats
const ProgressRing = ({ progress, size = 60, strokeWidth = 6, color = 'green', label, sublabel }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  const colorClasses = {
    green: 'text-green-500',
    yellow: 'text-yellow-500',
    red: 'text-red-500',
    blue: 'text-blue-500',
    purple: 'text-purple-500'
  };

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          stroke="currentColor"
          fill="none"
          className="text-gray-700"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          stroke="currentColor"
          fill="none"
          strokeLinecap="round"
          className={colorClasses[color] || 'text-green-500'}
          style={{
            strokeDasharray: circumference,
            strokeDashoffset: offset,
            transition: 'stroke-dashoffset 0.5s ease-out'
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold text-white">{label}</span>
        {sublabel && <span className="text-[10px] text-gray-400">{sublabel}</span>}
      </div>
    </div>
  );
};

// Countdown timer component
const CountdownTimer = ({ deadline }) => {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, mins: 0, secs: 0 });
  const [isUrgent, setIsUrgent] = useState(false);

  useEffect(() => {
    if (!deadline) return;

    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const deadlineTime = new Date(deadline).getTime();
      const diff = deadlineTime - now;

      if (diff <= 0) {
        return { days: 0, hours: 0, mins: 0, secs: 0 };
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diff % (1000 * 60)) / 1000);

      return { days, hours, mins, secs };
    };

    // Initial calculation
    const initial = calculateTimeLeft();
    setTimeLeft(initial);
    setIsUrgent(initial.days === 0 && initial.hours < 24);

    // Update every second
    const timer = setInterval(() => {
      const newTime = calculateTimeLeft();
      setTimeLeft(newTime);
      setIsUrgent(newTime.days === 0 && newTime.hours < 24);
    }, 1000);

    return () => clearInterval(timer);
  }, [deadline]);

  if (!deadline) return null;

  const TimeUnit = ({ value, label }) => (
    <div className="flex flex-col items-center">
      <span className={`text-2xl font-bold ${isUrgent ? 'text-orange-400' : 'text-white'}`}>
        {String(value).padStart(2, '0')}
      </span>
      <span className="text-[10px] text-gray-500 uppercase">{label}</span>
    </div>
  );

  return (
    <div className="flex items-center gap-2">
      {timeLeft.days > 0 && (
        <>
          <TimeUnit value={timeLeft.days} label="days" />
          <span className="text-gray-600 text-xl">:</span>
        </>
      )}
      <TimeUnit value={timeLeft.hours} label="hrs" />
      <span className="text-gray-600 text-xl">:</span>
      <TimeUnit value={timeLeft.mins} label="min" />
      <span className="text-gray-600 text-xl">:</span>
      <TimeUnit value={timeLeft.secs} label="sec" />
    </div>
  );
};

// Gradient border card wrapper
const GradientCard = ({ children, gradient = 'from-blue-500 to-purple-500', className = '' }) => (
  <div className={`relative p-[1px] rounded-lg bg-gradient-to-r ${gradient} ${className}`}>
    <div className="bg-gray-800 rounded-lg h-full">
      {children}
    </div>
  </div>
);

// Luck Meter component - horizontal gauge from unlucky (red/left) to lucky (green/right)
const LuckMeter = ({ luckScore, minLuck, maxLuck }) => {
  const scaleMin = Math.min(minLuck, -4);
  const scaleMax = Math.max(maxLuck, 4);
  const range = scaleMax - scaleMin;

  // Position as percentage (0% = left/unlucky, 100% = right/lucky)
  const position = ((luckScore - scaleMin) / range) * 100;
  const clampedPosition = Math.max(3, Math.min(97, position));

  // Zero line position
  const zeroPosition = ((0 - scaleMin) / range) * 100;

  const getColor = (score) => {
    if (score <= -2) return 'text-red-400';
    if (score < 0) return 'text-orange-400';
    if (score < 2) return 'text-yellow-400';
    return 'text-green-400';
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs text-gray-500">
        <span>Unlucky</span>
        <span>Lucky</span>
      </div>

      {/* Gauge bar */}
      <div className="relative h-4 rounded-full bg-gradient-to-r from-red-900/60 via-gray-700 to-green-900/60 border border-gray-600">
        {/* Zero/fair center line */}
        <div
          className="absolute top-0 bottom-0 w-px bg-gray-500"
          style={{ left: `${zeroPosition}%` }}
        />
        {/* Marker */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-white border-2 border-blue-400 shadow-lg shadow-blue-500/30 z-10"
          style={{ left: `${clampedPosition}%` }}
        />
      </div>

      {/* Score label */}
      <div className="text-center">
        <span className={`text-2xl font-bold ${getColor(luckScore)}`}>
          {luckScore > 0 ? '+' : ''}{luckScore.toFixed(1)}
        </span>
        <span className="text-sm text-gray-400 ml-2">expected wins differential</span>
      </div>
    </div>
  );
};

// Position-themed text color helper
const getPositionTextColor = (position) => {
  switch (position) {
    case 'GKP': return 'text-yellow-400';
    case 'DEF': return 'text-green-400';
    case 'MID': return 'text-blue-400';
    case 'FWD': return 'text-purple-400';
    default: return 'text-gray-400';
  }
};

const HomeTabContent = ({ players, currentGameweek, scoringMode, onPlayerClick }) => {
  const [optimizerData, setOptimizerData] = useState(null);
  const [loadingOptimizer, setLoadingOptimizer] = useState(true);
  const [standings, setStandings] = useState([]);
  const [loadingStandings, setLoadingStandings] = useState(true);
  const [standingsExpanded, setStandingsExpanded] = useState(false);
  const [fixtureCounts, setFixtureCounts] = useState(null);

  // Fetch live fixture counts when GW is live
  useEffect(() => {
    if (currentGameweek?.status !== 'live') {
      setFixtureCounts(null);
      return;
    }
    const fetchCounts = async () => {
      try {
        const res = await fetch('/api/fpl-gameweek', { cache: 'no-store' });
        const data = await res.json();
        if (data.success && data.currentGameweek?.fixtureCounts) {
          setFixtureCounts(data.currentGameweek.fixtureCounts);
        }
      } catch { /* silent */ }
    };
    fetchCounts();
    // Refresh every 60 seconds while live
    const interval = setInterval(fetchCounts, 60000);
    return () => clearInterval(interval);
  }, [currentGameweek?.status, currentGameweek?.number]);
  const [luckExpanded, setLuckExpanded] = useState(false);

  // Fetch optimizer data to check if lineup is optimized
  useEffect(() => {
    const fetchOptimizerData = async () => {
      try {
        setLoadingOptimizer(true);
        const response = await fetch('/api/optimizer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: USER_ID,
            scoringMode,
            currentGameweek: currentGameweek?.number
          })
        });

        if (response.ok) {
          const data = await response.json();
          setOptimizerData(data);
        }
      } catch (error) {
        console.error('Error fetching optimizer data:', error);
      } finally {
        setLoadingOptimizer(false);
      }
    };

    if (currentGameweek?.number) {
      fetchOptimizerData();
    }
  }, [currentGameweek, scoringMode]);

  // Fetch league standings
  useEffect(() => {
    const fetchStandings = async () => {
      try {
        setLoadingStandings(true);
        const response = await fetch('/api/standings');
        if (response.ok) {
          const data = await response.json();
          setStandings(data.standings || []);
        }
      } catch (error) {
        console.error('Error fetching standings:', error);
      } finally {
        setLoadingStandings(false);
      }
    };
    fetchStandings();
  }, []);

  // Get my players
  const myPlayers = players.filter(p => p.owned_by === USER_ID);

  // Helper to get current GW points
  const getPlayerPoints = (player) => {
    return scoringMode === 'v3'
      ? (player.v3_current_gw || 0)
      : (player.current_gw_prediction || 0);
  };

  // Calculate playersToSwap locally (same logic as OptimizerTabContent)
  const calculateOptimizationStats = () => {
    const current = optimizerData?.current;
    const optimal = optimizerData?.optimal;

    if (!current?.players || !optimal?.players) {
      return { playersToSwap: 0, improvement: 0, efficiency: 100 };
    }

    const optimalPlayerIds = new Set(
      optimal.players.map(p => p.sleeper_id || p.id || p.player_id)
    );

    const playersToSwap = current.players.filter(p => {
      const playerId = p.sleeper_id || p.id || p.player_id;
      return !optimalPlayerIds.has(playerId);
    }).length;

    const currentPts = current.players.reduce((sum, p) => sum + getPlayerPoints(p), 0);
    const optimalPts = optimal.players.reduce((sum, p) => sum + getPlayerPoints(p), 0);
    const improvement = optimalPts - currentPts;
    let efficiency = optimalPts > 0 ? Math.round((currentPts / optimalPts) * 100) : 100;

    // Cap efficiency at 99% if there are changes needed (prevents showing 100% with pending swaps)
    if (playersToSwap > 0 && efficiency >= 100) {
      efficiency = 99;
    }

    return { playersToSwap, improvement, efficiency };
  };

  const optimizationStats = calculateOptimizationStats();

  // Get top 3 players for this GW
  const top3ThisGW = [...myPlayers]
    .sort((a, b) => getPlayerPoints(b) - getPlayerPoints(a))
    .slice(0, 3);

  // Find user's league standing
  const userStanding = standings.find(s => s.displayName === USER_ID);
  const userRank = userStanding ? standings.indexOf(userStanding) + 1 : null;

  // Luck analysis computation
  const luckData = useMemo(() => {
    if (!standings || standings.length === 0) return null;

    // Sort by points for to get "strength" ranking
    const byPoints = [...standings].sort((a, b) => b.pointsFor - a.pointsFor);

    const teams = standings.map((team, winsRankIndex) => {
      const totalGames = team.wins + team.losses + team.ties;
      if (totalGames === 0) {
        return { ...team, totalGames: 0, expectedWins: 0, luckScore: 0, pointsRank: 0, winsRank: 0, rankGap: 0, ppg: 0 };
      }

      // Pythagorean expected win rate
      const expectedWinRate = team.pointsFor / (team.pointsFor + team.pointsAgainst);
      const expectedWins = expectedWinRate * totalGames;
      // Account for ties as half-wins
      const actualWinEquivalent = team.wins + (team.ties * 0.5);
      const luckScore = actualWinEquivalent - expectedWins;

      // Rank positions
      const pointsRank = byPoints.findIndex(t => t.roster_id === team.roster_id) + 1;
      const winsRank = winsRankIndex + 1;
      const rankGap = pointsRank - winsRank; // positive = unlucky

      return {
        ...team,
        totalGames,
        expectedWins: Math.round(expectedWins * 10) / 10,
        luckScore: Math.round(luckScore * 10) / 10,
        pointsRank,
        winsRank,
        rankGap,
        ppg: Math.round((team.pointsFor / totalGames) * 10) / 10,
      };
    });

    // Sort by luck score ascending (most unlucky first)
    const sortedByLuck = [...teams].sort((a, b) => a.luckScore - b.luckScore);
    const minLuck = Math.min(...teams.map(t => t.luckScore));
    const maxLuck = Math.max(...teams.map(t => t.luckScore));
    const userLuck = teams.find(t => t.displayName === USER_ID);

    return { teams: sortedByLuck, userLuck, minLuck, maxLuck };
  }, [standings]);

  // Count players by availability status
  const availabilityStats = {
    healthy: myPlayers.filter(p => {
      const chance = p.chance_next_round ?? p.chance_of_playing_next_round ?? 100;
      return chance >= 75;
    }).length,
    doubtful: myPlayers.filter(p => {
      const chance = p.chance_next_round ?? p.chance_of_playing_next_round ?? 100;
      return chance >= 25 && chance < 75;
    }).length,
    out: myPlayers.filter(p => {
      const chance = p.chance_next_round ?? p.chance_of_playing_next_round ?? 100;
      return chance < 25;
    }).length
  };

  // Calculate team health percentage
  const teamHealth = myPlayers.length > 0
    ? Math.round((availabilityStats.healthy / myPlayers.length) * 100)
    : 100;

  // Get players with injury/news
  const playersWithNews = myPlayers.filter(p =>
    (p.news && p.news.length > 0) ||
    (p.fpl_status && p.fpl_status !== 'a')
  );

  // Calculate predicted points for this GW
  const predictedPoints = myPlayers.reduce((sum, p) => sum + getPlayerPoints(p), 0);

  return (
    <div className="space-y-6">
      {/* Hero Header with Countdown or Live Indicator */}
      <div className={`bg-gradient-to-r ${currentGameweek?.status === 'live' ? 'from-red-700 via-red-600 to-orange-600' : 'from-blue-600 via-purple-600 to-indigo-600'} rounded-xl shadow-lg px-6 py-4 relative overflow-hidden`}>
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-24 translate-x-24" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-16 -translate-x-16" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          {/* GW Info Widget */}
          <button
            onClick={() => {
              const url = `https://fantasy.premierleague.com/fixtures/${currentGameweek?.number || 1}`;
              window.open(url, '_blank', 'noopener,noreferrer');
            }}
            className="text-left hover:bg-white/10 rounded-lg p-2 -m-2 transition-colors"
            title={`Click to view GW${currentGameweek?.number} fixtures`}
          >
            <div className="flex items-center gap-3">
              <div className="text-4xl font-bold text-white">
                GW {currentGameweek?.number || '?'}
              </div>
              <div className="text-sm">
                <p className="text-blue-100">
                  {currentGameweek?.status === 'live' ? '🔴 Live' : currentGameweek?.status === 'upcoming' ? '🏁 Upcoming' : '✓ Complete'}
                </p>
                <p className="text-blue-200/70 text-xs">
                  {currentGameweek?.date || 'Loading...'}
                  <span className="ml-1 opacity-60">🔗</span>
                </p>
              </div>
            </div>
          </button>

          {/* Countdown Timer or Live Indicator */}
          {currentGameweek?.status === 'live' ? (
            <div className="bg-red-500/20 backdrop-blur-sm rounded-lg px-5 py-3 border border-red-500/30">
              <div className="flex items-center gap-3">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                </span>
                <div>
                  <p className="text-lg font-bold text-white">
                    {fixtureCounts
                      ? fixtureCounts.finished === fixtureCounts.total
                        ? 'All Matches Complete'
                        : fixtureCounts.started > 0
                          ? 'Matches In Progress'
                          : 'Matches Today'
                      : 'Matches In Progress'}
                  </p>
                  {fixtureCounts ? (
                    <div className="flex items-center gap-3 text-xs mt-1">
                      <span className="text-green-300">{fixtureCounts.finished} played</span>
                      {fixtureCounts.started > 0 && (
                        <span className="text-yellow-300">{fixtureCounts.started} live</span>
                      )}
                      <span className="text-red-200/70">{fixtureCounts.remaining} remaining</span>
                    </div>
                  ) : (
                    <p className="text-xs text-red-200/70">Loading fixtures...</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-black/20 backdrop-blur-sm rounded-lg px-4 py-2">
              <p className="text-xs text-blue-200 mb-1 text-center">Deadline</p>
              <CountdownTimer deadline={currentGameweek?.deadline} />
            </div>
          )}
        </div>
      </div>

      {/* Stats Grid with Progress Rings */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Lineup Optimization with Progress Ring */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg">
          <div className="p-4">
            <h3 className="text-sm font-medium text-gray-400 mb-3">Lineup Status</h3>
            {loadingOptimizer ? (
              <div className="flex items-center justify-center py-4">
                <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full"></div>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <ProgressRing
                  progress={optimizationStats.efficiency}
                  size={70}
                  color={optimizationStats.playersToSwap === 0 ? 'green' : 'yellow'}
                  label={`${optimizationStats.efficiency}%`}
                  sublabel="optimal"
                />
                <div>
                  {optimizationStats.playersToSwap === 0 ? (
                    <>
                      <p className="text-lg font-bold text-green-400">Optimized</p>
                      <p className="text-xs text-gray-400">No changes needed</p>
                    </>
                  ) : (
                    <>
                      <p className="text-lg font-bold text-yellow-400">{optimizationStats.playersToSwap} Changes</p>
                      <p className="text-xs text-gray-400">+{optimizationStats.improvement.toFixed(1)} pts</p>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Team Health with Progress Ring */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg">
          <div className="p-4">
            <h3 className="text-sm font-medium text-gray-400 mb-3">Team Health</h3>
            <div className="flex items-center gap-4">
              <ProgressRing
                progress={teamHealth}
                size={70}
                color={teamHealth >= 80 ? 'green' : teamHealth >= 60 ? 'yellow' : 'red'}
                label={`${teamHealth}%`}
                sublabel="healthy"
              />
              <div className="space-y-1 text-sm">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500"></span>
                  <span className="text-gray-400">Fit:</span>
                  <span className="text-white font-bold">{availabilityStats.healthy}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                  <span className="text-gray-400">Doubt:</span>
                  <span className="text-white font-bold">{availabilityStats.doubtful}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-500"></span>
                  <span className="text-gray-400">Out:</span>
                  <span className="text-white font-bold">{availabilityStats.out}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Top 3 This Gameweek */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg">
          <div className="p-4">
            <h3 className="text-sm font-medium text-gray-400 mb-3">Top 3 This GW</h3>
            <div className="space-y-2">
              {top3ThisGW.map((player, idx) => (
                <div key={player.sleeper_id} className="flex items-center gap-2 text-sm">
                  <span className="text-gray-600 w-4 font-bold">{idx + 1}</span>
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${getSleeperPositionStyle(player.position)}`}>
                    {player.position}
                  </span>
                  <button
                    onClick={() => onPlayerClick?.(player)}
                    className={`truncate flex-1 text-left font-medium hover:underline transition-colors ${getPositionTextColor(player.position)}`}
                  >
                    {player.web_name || player.name}
                  </button>
                  <span className="text-green-400 font-bold">{getPlayerPoints(player).toFixed(1)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* League Standing */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg">
          <div className="p-4">
            <h3 className="text-sm font-medium text-gray-400 mb-3">League Standing</h3>
            {loadingStandings ? (
              <div className="animate-pulse space-y-2">
                <div className="h-8 bg-gray-700 rounded w-16"></div>
                <div className="h-4 bg-gray-700 rounded w-24"></div>
              </div>
            ) : userRank ? (
              <div className="flex items-center gap-4">
                <div className="text-4xl font-bold text-yellow-400">#{userRank}</div>
                <div>
                  <p className="text-white font-medium">
                    {userStanding.wins}-{userStanding.losses}
                    {userStanding.ties > 0 && `-${userStanding.ties}`}
                  </p>
                  <p className="text-xs text-gray-400">of {standings.length} teams</p>
                  <button
                    onClick={() => setStandingsExpanded(!standingsExpanded)}
                    className="text-xs text-blue-400 hover:text-blue-300 mt-1 flex items-center gap-1"
                  >
                    {standingsExpanded ? '▼' : '▶'} Full standings
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-gray-500 text-sm">Unable to load</p>
            )}
          </div>
        </div>
      </div>

      {/* Expanded Standings Table */}
      {standingsExpanded && standings.length > 0 && (
        <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-900">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase">#</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase">Team</th>
                <th className="px-4 py-2 text-center text-xs font-medium text-gray-400 uppercase">W-L-T</th>
                <th className="px-4 py-2 text-center text-xs font-medium text-gray-400 uppercase">PF</th>
                <th className="px-4 py-2 text-center text-xs font-medium text-gray-400 uppercase">PA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {standings.map((team, index) => {
                const isCurrentUser = team.displayName === USER_ID;
                return (
                  <tr
                    key={team.roster_id}
                    className={`${
                      isCurrentUser
                        ? 'bg-blue-900/30 border-l-4 border-blue-500'
                        : 'hover:bg-gray-700'
                    }`}
                  >
                    <td className="px-4 py-2 text-gray-300 font-medium">{index + 1}</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <span className={`font-medium ${isCurrentUser ? 'text-blue-400' : 'text-white'}`}>
                          {team.displayName}
                        </span>
                        {isCurrentUser && (
                          <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded">You</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-center text-gray-300">
                      {team.wins}-{team.losses}{team.ties > 0 && `-${team.ties}`}
                    </td>
                    <td className="px-4 py-2 text-center text-green-400 font-medium">
                      {team.pointsFor.toFixed(1)}
                    </td>
                    <td className="px-4 py-2 text-center text-red-400 font-medium">
                      {team.pointsAgainst.toFixed(1)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* My Current Roster */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <span>My Roster</span>
          <span className="text-gray-400 text-sm font-normal">({myPlayers.length} players)</span>
        </h2>

        {/* Players with News/Injuries */}
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
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onPlayerClick?.(player)}
                          className={`font-medium hover:underline transition-colors text-left ${getPositionTextColor(player.position)}`}
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
                        {player.news && <p className="text-xs text-gray-400">{player.news}</p>}
                        {newsTimestamp && (
                          <span className="text-[10px] text-gray-600">{timeAgo(newsTimestamp)}</span>
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

        {/* Roster by Position */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {['GKP', 'DEF', 'MID', 'FWD'].map(position => {
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
              <div key={position} className={`bg-gradient-to-br ${positionGradients[position]} rounded-lg p-4 border border-gray-700/50`}>
                <h3 className="font-bold text-white mb-3 flex items-center gap-2">
                  <span className={`text-sm font-bold px-2 py-0.5 rounded ${getSleeperPositionStyle(position)}`}>
                    {position}
                  </span>
                  <span className="text-gray-400 text-sm font-normal">({positionPlayers.length})</span>
                </h3>
                <div className="space-y-2">
                  {positionPlayers.map(player => {
                    const chance = player.chance_next_round ?? player.chance_of_playing_next_round ?? 100;
                    const points = getPlayerPoints(player);

                    return (
                      <div key={player.sleeper_id} className="flex items-center gap-2 text-sm">
                        <PlayerAvatar player={player} size="sm" />
                        <div className="flex-1 min-w-0">
                          <button
                            onClick={() => onPlayerClick?.(player)}
                            className={`truncate font-medium hover:underline transition-colors text-left block w-full ${getPositionTextColor(position)}`}
                          >
                            {player.web_name || player.name}
                          </button>
                          <p className="text-xs text-gray-500">{player.team_abbr}</p>
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
                    <p className="text-gray-500 text-xs italic">No players</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Schedule Luck Analyzer — collapsible */}
      {!loadingStandings && standings.length > 0 && luckData && (
        <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
          <button
            onClick={() => setLuckExpanded(!luckExpanded)}
            className="w-full px-6 py-3 flex items-center justify-between hover:bg-gray-700/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-bold text-white">Schedule Luck Analyzer</h2>
              {luckData.userLuck && (
                <span className={`text-xs font-bold ${
                  luckData.userLuck.luckScore <= -2 ? 'text-red-400'
                    : luckData.userLuck.luckScore < 0 ? 'text-orange-400'
                    : luckData.userLuck.luckScore < 2 ? 'text-yellow-400'
                    : 'text-green-400'
                }`}>
                  {luckData.userLuck.luckScore > 0 ? '+' : ''}{luckData.userLuck.luckScore} luck
                </span>
              )}
            </div>
            <span className="text-gray-500 text-xs">{luckExpanded ? '▼' : '▶'}</span>
          </button>

          {luckExpanded && (
            <div className="px-6 pb-6">
              <p className="text-xs text-gray-500 mb-4">
                Expected wins based on points scored vs points against
              </p>

              {/* User's Luck Meter */}
              {luckData.userLuck && (
                <div className="bg-gray-900/50 rounded-lg p-4 mb-4">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-sm font-medium text-blue-400">Your Luck</span>
                    <span className="text-xs text-gray-500">
                      {luckData.userLuck.wins}W from {luckData.userLuck.totalGames} games
                      (expected {luckData.userLuck.expectedWins}W)
                    </span>
                  </div>
                  <LuckMeter
                    luckScore={luckData.userLuck.luckScore}
                    minLuck={luckData.minLuck}
                    maxLuck={luckData.maxLuck}
                  />
                </div>
              )}

              {/* League Luck Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-900">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase">#</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase">Manager</th>
                      <th className="px-3 py-2 text-center text-xs font-medium text-gray-400 uppercase">W-L</th>
                      <th className="px-3 py-2 text-center text-xs font-medium text-gray-400 uppercase">PF Rank</th>
                      <th className="px-3 py-2 text-center text-xs font-medium text-gray-400 uppercase">PPG</th>
                      <th className="px-3 py-2 text-center text-xs font-medium text-gray-400 uppercase">Exp W</th>
                      <th className="px-3 py-2 text-center text-xs font-medium text-gray-400 uppercase">Luck</th>
                      <th className="px-3 py-2 text-center text-xs font-medium text-gray-400 uppercase w-28"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {luckData.teams.map((team, index) => {
                      const isUser = team.displayName === USER_ID;
                      const luckRange = (luckData.maxLuck - luckData.minLuck) || 1;
                      const barPosition = ((team.luckScore - luckData.minLuck) / luckRange) * 100;
                      const luckColor = team.luckScore <= -2 ? 'bg-red-500'
                        : team.luckScore < 0 ? 'bg-orange-500'
                        : team.luckScore < 2 ? 'bg-yellow-500'
                        : 'bg-green-500';
                      const textColor = team.luckScore <= -2 ? 'text-red-400'
                        : team.luckScore < 0 ? 'text-orange-400'
                        : team.luckScore < 2 ? 'text-yellow-400'
                        : 'text-green-400';

                      return (
                        <tr
                          key={team.roster_id}
                          className={isUser
                            ? 'bg-blue-900/30 border-l-4 border-blue-500'
                            : 'hover:bg-gray-700/50'}
                        >
                          <td className="px-3 py-2 text-gray-500">{index + 1}</td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <span className={`font-medium ${isUser ? 'text-blue-400' : 'text-white'}`}>
                                {team.displayName}
                              </span>
                              {isUser && (
                                <span className="text-[10px] bg-blue-600 text-white px-1.5 py-0.5 rounded">You</span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-center text-gray-300">
                            {team.wins}-{team.losses}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span className="text-gray-300">#{team.pointsRank}</span>
                            {team.rankGap !== 0 && (
                              <span className={`ml-1 text-xs ${team.rankGap > 0 ? 'text-red-400' : 'text-green-400'}`}>
                                ({team.rankGap > 0 ? '+' : ''}{team.rankGap})
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-center text-gray-300">{team.ppg}</td>
                          <td className="px-3 py-2 text-center text-gray-300">{team.expectedWins}</td>
                          <td className={`px-3 py-2 text-center font-bold ${textColor}`}>
                            {team.luckScore > 0 ? '+' : ''}{team.luckScore}
                          </td>
                          <td className="px-3 py-2">
                            <div className="relative h-2 bg-gray-700 rounded-full w-full">
                              <div className="absolute top-0 bottom-0 left-1/2 w-px bg-gray-500" />
                              <div
                                className={`absolute top-0 h-full rounded-full ${luckColor}`}
                                style={{
                                  left: barPosition < 50 ? `${barPosition}%` : '50%',
                                  width: `${Math.abs(barPosition - 50)}%`,
                                }}
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

HomeTabContent.propTypes = {
  players: PropTypes.array.isRequired,
  currentGameweek: PropTypes.object,
  scoringMode: PropTypes.string.isRequired,
  onPlayerClick: PropTypes.func
};

export default HomeTabContent;
