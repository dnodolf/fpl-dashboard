/**
 * Draft Analysis Service
 * Analyzes actual draft picks to generate strategy insights for future drafts.
 * Reuses draftRankingService for VORP/tier calculations.
 */

import { computeDraftRankings, normalizePosition, getSeasonProjection } from './draftRankingService';

/**
 * Grade a pick based on how it compares to projection rank.
 * @param {number} pickNo - Overall pick number
 * @param {number} projectionRank - Where this player ranks by projection
 * @returns {string} Letter grade
 */
function gradePick(pickNo, projectionRank) {
  if (!projectionRank) return '—';
  const delta = projectionRank - pickNo; // Positive = value (drafted later than projected)

  if (delta >= 15) return 'A+';
  if (delta >= 8) return 'A';
  if (delta >= 3) return 'B+';
  if (delta >= -2) return 'B';
  if (delta >= -5) return 'C+';
  if (delta >= -10) return 'C';
  if (delta >= -15) return 'D+';
  if (delta >= -25) return 'D';
  return 'F';
}

/**
 * Detect position runs: 3+ consecutive picks of the same position.
 */
function detectPositionRuns(picks) {
  const runs = [];
  let currentPos = null;
  let runStart = 0;
  let runCount = 0;

  picks.forEach((pick, i) => {
    const pos = pick.metadata?.position?.toUpperCase() || null;
    const normalized = normalizePosition(pos);

    if (normalized === currentPos) {
      runCount++;
    } else {
      if (runCount >= 3 && currentPos) {
        const startPickNo = picks[runStart].pick_no;
        const endPickNo = picks[i - 1].pick_no;
        const round = picks[runStart].round;
        runs.push({
          position: currentPos,
          count: runCount,
          round,
          startPick: startPickNo,
          endPick: endPickNo,
        });
      }
      currentPos = normalized;
      runStart = i;
      runCount = 1;
    }
  });

  // Check final run
  if (runCount >= 3 && currentPos) {
    runs.push({
      position: currentPos,
      count: runCount,
      round: picks[runStart].round,
      startPick: picks[runStart].pick_no,
      endPick: picks[picks.length - 1].pick_no,
    });
  }

  return runs;
}

/**
 * Analyze the full draft and generate insights.
 * @param {Array} picks - Draft picks from Sleeper API
 * @param {Array} players - All players with projections
 * @param {Object} users - User ID → display name map
 * @param {string} scoringMode - 'ffh', 'v3', or 'v4'
 * @param {number} leagueSize - Number of teams
 * @returns {Object} Full analysis
 */
export function analyzeDraft(picks, players, users, scoringMode, leagueSize = 10) {
  if (!picks?.length || !players?.length) {
    return { pickAnalysis: [], positionRuns: [], managerGrades: {}, insights: [] };
  }

  // Compute rankings for all players (as if pre-draft)
  const { rankedPlayers } = computeDraftRankings(players, scoringMode, leagueSize);

  // Build a lookup: player_id → ranked player
  const playerLookup = {};
  players.forEach(p => {
    if (p.sleeper_id) playerLookup[p.sleeper_id] = p;
    if (p.id) playerLookup[p.id] = p;
  });

  // Build projection rank lookup
  const projRankLookup = {};
  rankedPlayers.forEach((p, i) => {
    const id = p.sleeper_id || p.id;
    projRankLookup[id] = i + 1;
  });

  // VORP lookup
  const vorpLookup = {};
  rankedPlayers.forEach(p => {
    const id = p.sleeper_id || p.id;
    vorpLookup[id] = p.draftVorp || 0;
  });

  // Analyze each pick
  const pickAnalysis = picks.map(pick => {
    const playerId = pick.player_id;
    const player = playerLookup[playerId];
    const projectionRank = projRankLookup[playerId] || null;
    const vorp = vorpLookup[playerId] || 0;
    const grade = gradePick(pick.pick_no, projectionRank);

    const managerName = typeof users === 'object' && !Array.isArray(users)
      ? users[pick.picked_by] || `Slot ${pick.draft_slot}`
      : Array.isArray(users)
        ? users.find(u => u.user_id === pick.picked_by)?.display_name || `Slot ${pick.draft_slot}`
        : `Slot ${pick.draft_slot}`;

    return {
      pickNo: pick.pick_no,
      round: pick.round,
      draftSlot: pick.draft_slot,
      playerId,
      playerName: player?.name || player?.web_name || (pick.metadata?.first_name && pick.metadata?.last_name ? `${pick.metadata.first_name} ${pick.metadata.last_name}` : `Player ${playerId}`),
      position: normalizePosition(pick.metadata?.position) || normalizePosition(player?.position) || '—',
      managerId: pick.picked_by,
      managerName,
      projectionRank,
      vorp,
      grade,
      projection: player ? getSeasonProjection(player, scoringMode) : 0,
    };
  });

  // Position runs
  const positionRuns = detectPositionRuns(picks);

  // Manager grades
  const managerPicks = {};
  pickAnalysis.forEach(pick => {
    if (!managerPicks[pick.managerId]) {
      managerPicks[pick.managerId] = {
        name: pick.managerName,
        picks: [],
        positionCounts: { GKP: 0, DEF: 0, MID: 0, FWD: 0 },
        totalVorp: 0,
      };
    }
    const mgr = managerPicks[pick.managerId];
    mgr.picks.push(pick);
    if (pick.position && mgr.positionCounts[pick.position] !== undefined) {
      mgr.positionCounts[pick.position]++;
    }
    mgr.totalVorp += pick.vorp;
  });

  const managerGrades = {};
  for (const [managerId, mgr] of Object.entries(managerPicks)) {
    const avgVorp = mgr.picks.length > 0 ? mgr.totalVorp / mgr.picks.length : 0;
    const sortedByVorp = [...mgr.picks].sort((a, b) => b.vorp - a.vorp);
    const bestPick = sortedByVorp[0];
    const worstPick = sortedByVorp[sortedByVorp.length - 1];

    // Overall grade based on avg VORP across all 17 picks.
    // Calibrated to realistic values: elite picks ~20-50 VORP, mid-draft ~5-15,
    // bench depth ~0 or negative → typical good draft avgVorp is 3-10.
    let overallGrade;
    if (avgVorp >= 10) overallGrade = 'A+';
    else if (avgVorp >= 7.5) overallGrade = 'A';
    else if (avgVorp >= 5) overallGrade = 'B+';
    else if (avgVorp >= 2.5) overallGrade = 'B';
    else if (avgVorp >= 0) overallGrade = 'C';
    else if (avgVorp >= -2.5) overallGrade = 'D';
    else overallGrade = 'F';

    managerGrades[managerId] = {
      name: mgr.name,
      avgVorp,
      totalVorp: mgr.totalVorp,
      pickCount: mgr.picks.length,
      positionCounts: mgr.positionCounts,
      bestPick: bestPick ? { name: bestPick.playerName, vorp: bestPick.vorp, pickNo: bestPick.pickNo } : null,
      worstPick: worstPick ? { name: worstPick.playerName, vorp: worstPick.vorp, pickNo: worstPick.pickNo } : null,
      overallGrade,
    };
  }

  // Generate structured strategy analysis
  const strategy = generateStrategy(pickAnalysis, positionRuns, managerGrades, leagueSize);

  return { pickAnalysis, positionRuns, managerGrades, strategy };
}

/**
 * Generate structured strategy analysis grouped into clear sections.
 * Returns data designed to tell a story: What happened -> What it means -> What to do.
 */
function generateStrategy(pickAnalysis, positionRuns, managerGrades, leagueSize) {
  // ── 1. Draft Overview stats ──
  const totalPicks = pickAnalysis.length;
  const rounds = Math.max(...pickAnalysis.map(p => p.round), 0);

  // ── 2. Position demand: when was each position drafted? ──
  const positionPicks = { GKP: [], DEF: [], MID: [], FWD: [] };
  pickAnalysis.forEach(pick => {
    if (pick.position && positionPicks[pick.position]) {
      positionPicks[pick.position].push(pick);
    }
  });

  const positionDemand = Object.entries(positionPicks).map(([pos, picks]) => {
    if (picks.length === 0) return { position: pos, count: 0 };
    const sortedPicks = picks.map(p => p.pickNo).sort((a, b) => a - b);
    const firstPick = sortedPicks[0];
    const medianPick = sortedPicks[Math.floor(sortedPicks.length / 2)];
    const lastPick = sortedPicks[sortedPicks.length - 1];

    // Count per round
    const byRound = {};
    picks.forEach(p => { byRound[p.round] = (byRound[p.round] || 0) + 1; });

    // Peak round (most picks of this position)
    const peakRound = Object.entries(byRound).sort(([, a], [, b]) => b - a)[0];

    return {
      position: pos,
      count: picks.length,
      firstPick,
      medianPick,
      lastPick,
      peakRound: peakRound ? { round: parseInt(peakRound[0]), count: peakRound[1] } : null,
      byRound,
    };
  });

  // ── 3. Round-by-round breakdown for position flow ──
  const roundFlow = [];
  for (let r = 1; r <= rounds; r++) {
    const roundPicks = pickAnalysis.filter(p => p.round === r);
    const counts = { GKP: 0, DEF: 0, MID: 0, FWD: 0 };
    roundPicks.forEach(p => {
      if (p.position && counts[p.position] !== undefined) counts[p.position]++;
    });
    roundFlow.push({ round: r, ...counts, total: roundPicks.length });
  }

  // ── 4. Top steals & reaches (expanded lists, not just best/worst) ──
  const allValuePicks = pickAnalysis
    .filter(p => p.projectionRank && (p.projectionRank - p.pickNo) >= 8)
    .map(p => ({ ...p, delta: p.projectionRank - p.pickNo }))
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 5);

  const allReaches = pickAnalysis
    .filter(p => p.projectionRank && (p.pickNo - p.projectionRank) >= 8)
    .map(p => ({ ...p, delta: p.pickNo - p.projectionRank }))
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 5);

  // ── 5. Key takeaways: plain-English, actionable, numbered ──
  const takeaways = [];

  // Round 1 importance
  const round1Picks = pickAnalysis.filter(p => p.round === 1);
  const avgRound1Vorp = round1Picks.reduce((s, p) => s + p.vorp, 0) / (round1Picks.length || 1);
  const round1Positions = {};
  round1Picks.forEach(p => { round1Positions[p.position] = (round1Positions[p.position] || 0) + 1; });
  const topR1Pos = Object.entries(round1Positions).sort(([, a], [, b]) => b - a)[0];

  if (topR1Pos) {
    takeaways.push({
      title: `Round 1 was dominated by ${topR1Pos[0]}s`,
      detail: `${topR1Pos[1]} of ${leagueSize} first-round picks were ${topR1Pos[0]}. Average VORP in round 1: ${avgRound1Vorp.toFixed(1)}. Your first pick matters most — the gap between the best and worst round 1 picks is huge.`,
      action: `Target the best available ${topR1Pos[0]} if you pick early, or pivot to a scarce position if you pick late.`,
    });
  }

  // Position runs → don't panic / get ahead
  if (positionRuns.length > 0) {
    const biggestRun = positionRuns.sort((a, b) => b.count - a.count)[0];
    takeaways.push({
      title: `Watch for ${biggestRun.position} runs in rounds ${biggestRun.round}`,
      detail: `${biggestRun.count} managers grabbed a ${biggestRun.position} back-to-back (picks ${biggestRun.startPick}–${biggestRun.endPick}). When one manager reaches for a position, others panic and follow.`,
      action: `Either get your ${biggestRun.position} one round early (round ${biggestRun.round - 1}), or wait it out — the value after the run is often fine.`,
    });
  }

  // Position scarcity — which positions dried up fast?
  const sortedByMedian = [...positionDemand].filter(p => p.count > 0).sort((a, b) => a.medianPick - b.medianPick);
  const hottestPos = sortedByMedian[0];
  const coldestPos = sortedByMedian[sortedByMedian.length - 1];

  if (hottestPos && coldestPos && hottestPos.position !== coldestPos.position) {
    takeaways.push({
      title: `${hottestPos.position} went fast, ${coldestPos.position} went late`,
      detail: `The median ${hottestPos.position} was picked at #${hottestPos.medianPick} vs. the median ${coldestPos.position} at #${coldestPos.medianPick}. ${coldestPos.position} was available much longer.`,
      action: `You can wait on ${coldestPos.position} and focus early rounds on ${hottestPos.position} where the good options disappear quickly.`,
    });
  }

  // Value picks exist — patience pays
  if (allValuePicks.length > 0) {
    const bestSteal = allValuePicks[0];
    takeaways.push({
      title: 'Late-round steals were available',
      detail: `${allValuePicks.length} players were drafted 8+ spots later than their projection rank. The best steal was ${bestSteal.playerName} (picked #${bestSteal.pickNo}, projected #${bestSteal.projectionRank}).`,
      action: 'Don\'t overpay in the middle rounds. There\'s real value in rounds 8+ if you\'re patient.',
    });
  }

  // Reaches — don't overpay
  if (allReaches.length > 0) {
    const biggestReach = allReaches[0];
    takeaways.push({
      title: 'Managers overpaid for some players',
      detail: `${allReaches.length} players were drafted 8+ spots earlier than projected. The biggest reach was ${biggestReach.playerName} (picked #${biggestReach.pickNo}, projected #${biggestReach.projectionRank}).`,
      action: 'Stick to your board. When others reach, the players they should have taken fall to you.',
    });
  }

  // GKP timing
  const gkDemand = positionDemand.find(p => p.position === 'GKP');
  if (gkDemand && gkDemand.count > 0) {
    const gkPeakRound = gkDemand.peakRound;
    takeaways.push({
      title: `Goalkeepers went mostly in round ${gkPeakRound?.round || '?'}`,
      detail: `${gkDemand.count} GKPs were drafted total. First GKP went at pick #${gkDemand.firstPick}, and the busiest round was ${gkPeakRound?.round || '?'} (${gkPeakRound?.count || 0} GKPs).`,
      action: gkDemand.firstPick > leagueSize * 4
        ? 'GKPs are a late-round play in this league. Wait until everyone else starts picking theirs.'
        : 'Some managers prioritize GKPs — if you want a top one, don\'t wait too long.',
    });
  }

  return {
    overview: { totalPicks, rounds, leagueSize },
    positionDemand,
    roundFlow,
    valuePicks: allValuePicks,
    reaches: allReaches,
    takeaways,
  };
}
