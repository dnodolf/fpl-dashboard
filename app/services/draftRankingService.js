/**
 * Draft Ranking Service
 * Pure computation module for draft assistant: VORP, tiers, position scarcity, pick suggestions.
 * No React, no side effects.
 */

// Actual Sleeper FC roster structure (from league settings):
// Starters: GK(1), DEF(3), MID(3), FWD(1), FM_FLEX(1), FMD_FLEX(1), MD_FLEX(1) = 11
// Bench: 6
// Total: 17 per team
//
// Flex eligibility:
//   FM_FLEX  → FWD or MID
//   FMD_FLEX → FWD, MID, or DEF
//   MD_FLEX  → MID or DEF
const ROSTER_SLOTS = {
  starters: [
    { slot: 'GK', positions: ['GKP'], count: 1 },
    { slot: 'DEF', positions: ['DEF'], count: 3 },
    { slot: 'MID', positions: ['MID'], count: 3 },
    { slot: 'FWD', positions: ['FWD'], count: 1 },
    { slot: 'FM FLEX', positions: ['FWD', 'MID'], count: 1 },
    { slot: 'FMD FLEX', positions: ['FWD', 'MID', 'DEF'], count: 1 },
    { slot: 'MD FLEX', positions: ['MID', 'DEF'], count: 1 },
  ],
  bench: 6,
  total: 17,
};

// For VORP replacement level: max starters at each position (counting flex slots)
const MAX_STARTERS = { GKP: 1, DEF: 4, MID: 6, FWD: 3 };

// Simplified position caps for need-weight calculations
// (min guaranteed starters + fair share of bench)
const SLEEPER_FC_ROSTER = { GKP: 2, DEF: 5, MID: 6, FWD: 4 };

// Target number of tiers — FantasyPros uses 15, we split the difference
const TARGET_TIERS = 11;

/**
 * Get the season projection for a player based on scoring mode.
 * Uses the same field precedence as PlayerModal.js.
 */
function getSeasonProjection(player, scoringMode) {
  if (scoringMode === 'v4') {
    return player?.v4_season_total || player?.v3_season_total || 0;
  }
  if (scoringMode === 'v3') {
    return player?.v3_season_total || 0;
  }
  return player?.predicted_points || 0;
}

/**
 * Normalize position to standard format (GKP, DEF, MID, FWD)
 */
function normalizePosition(position) {
  if (!position) return null;
  const pos = position.toUpperCase();
  if (pos === 'GKP' || pos === 'GK' || pos === 'G') return 'GKP';
  if (pos === 'DEF' || pos === 'D') return 'DEF';
  if (pos === 'MID' || pos === 'M') return 'MID';
  if (pos === 'FWD' || pos === 'F') return 'FWD';
  return null;
}

/**
 * Compute replacement-level value for each position.
 * Replacement level = the (leagueSize * maxStarterSlots + 1)th best player at that position.
 * This represents the best freely-available player if all starters are rostered.
 */
function computeReplacementValues(playersByPosition, scoringMode, leagueSize) {
  const replacementValues = {};

  for (const [pos, players] of Object.entries(playersByPosition)) {
    const sorted = [...players]
      .map(p => ({ player: p, projection: getSeasonProjection(p, scoringMode) }))
      .filter(p => p.projection > 0)
      .sort((a, b) => b.projection - a.projection);

    const replacementIndex = leagueSize * MAX_STARTERS[pos];
    replacementValues[pos] = sorted[replacementIndex]?.projection || 0;
  }

  return replacementValues;
}

/**
 * Assign tier numbers to sorted players.
 *
 * Uses pyramid-shaped tier sizes: elite tiers are small (5-8 players),
 * lower tiers progressively absorb more (like FantasyPros cheat sheets).
 * Tier sizes follow geometric growth (each ~1.35x the previous),
 * then each boundary snaps to the nearest natural gap in the data.
 *
 * @param {Array} sortedPlayersWithProjections - Already sorted by projection descending
 * @param {number} [numTiers] - Override tier count (defaults to TARGET_TIERS)
 */
function assignTiers(sortedPlayersWithProjections, numTiers) {
  const tierCount = numTiers || TARGET_TIERS;
  const n = sortedPlayersWithProjections.length;

  if (n === 0) return [];
  if (n <= tierCount) {
    return sortedPlayersWithProjections.map((p, i) => ({ ...p, tier: i + 1 }));
  }

  // Step 1: Compute pyramid-shaped target sizes using geometric growth.
  // Early tiers (Elite, Premium) are small; later tiers absorb more players.
  const GROWTH_FACTOR = 1.35;
  const rawSizes = [];
  for (let t = 0; t < tierCount; t++) {
    rawSizes.push(Math.pow(GROWTH_FACTOR, t));
  }
  const rawSum = rawSizes.reduce((s, v) => s + v, 0);

  // Convert to cumulative boundary indices (where each tier ends)
  const targetBoundaries = [];
  let cumulative = 0;
  for (let t = 0; t < tierCount - 1; t++) {
    cumulative += rawSizes[t];
    targetBoundaries.push(Math.round((cumulative / rawSum) * n));
  }

  // Step 2: Place tier breaks exactly at the geometric target boundaries.
  // Snapping to natural gaps sounds appealing but EPL projection data doesn't
  // have evenly-spaced cliffs — multiple boundaries cluster near the same gap,
  // producing erratic tier sizes (2, 20, 9...). Exact placement is cleaner.
  const breakIndices = new Set(targetBoundaries);

  // Step 3: Assign tiers
  let currentTier = 1;
  const result = [{ ...sortedPlayersWithProjections[0], tier: currentTier }];

  for (let i = 1; i < n; i++) {
    if (breakIndices.has(i)) currentTier++;
    result.push({ ...sortedPlayersWithProjections[i], tier: currentTier });
  }

  return result;
}

/**
 * Compute the number of flex starter slots each position can fill.
 * Derived directly from ROSTER_SLOTS so it stays in sync with league rules.
 *
 * Results for current Sleeper FC structure:
 *   GKP: 0 flex slots  (only fills GK)
 *   DEF: 2 flex slots  (FMD FLEX + MD FLEX)
 *   MID: 3 flex slots  (FM FLEX + FMD FLEX + MD FLEX)
 *   FWD: 2 flex slots  (FM FLEX + FMD FLEX)
 */
function computeFlexSlotCounts() {
  const flexCounts = { GKP: 0, DEF: 0, MID: 0, FWD: 0 };
  const flexSlotNames = ['FM FLEX', 'FMD FLEX', 'MD FLEX'];

  ROSTER_SLOTS.starters.forEach(slot => {
    if (flexSlotNames.includes(slot.slot)) {
      slot.positions.forEach(pos => {
        const normalized = normalizePosition(pos);
        if (normalized && flexCounts[normalized] !== undefined) {
          flexCounts[normalized] += slot.count;
        }
      });
    }
  });

  return flexCounts;
}

/**
 * Maximum bonus applied to the most flex-eligible position (MID).
 * 0.12 = up to 12% VORP boost. Keeps rankings mostly projection-driven
 * while nudging versatile players up relative to specialists.
 */
const FLEX_WEIGHT = 0.12;

/**
 * Compute flex multipliers for VORP adjustment.
 * Players eligible for more flex slots get a modest VORP bonus
 * reflecting their higher roster utility.
 *
 * Formula: 1 + (flexSlots / maxFlexSlots) * FLEX_WEIGHT
 *
 * With current structure:
 *   GKP: 1.00x, DEF: 1.08x, MID: 1.12x, FWD: 1.08x
 */
export function computeFlexMultipliers() {
  const flexCounts = computeFlexSlotCounts();
  const maxFlex = Math.max(...Object.values(flexCounts), 1);

  const multipliers = {};
  for (const [pos, count] of Object.entries(flexCounts)) {
    multipliers[pos] = 1 + (count / maxFlex) * FLEX_WEIGHT;
  }

  return multipliers;
}

/**
 * Compute position scarcity multipliers.
 * Higher = scarcer = more valuable to draft early.
 * Formula: (totalStarterSlots / availableAtPosition) normalized to baseline of 1.0
 */
function computePositionScarcity(availablePlayers) {
  const positions = ['GKP', 'DEF', 'MID', 'FWD'];
  const counts = {};
  const totalAvailable = availablePlayers.length || 1;

  positions.forEach(pos => {
    counts[pos] = availablePlayers.filter(p => normalizePosition(p.position) === pos).length || 1;
  });

  // Baseline: even distribution
  const baseline = totalAvailable / positions.length;
  const scarcity = {};

  positions.forEach(pos => {
    scarcity[pos] = baseline / counts[pos];
  });

  return scarcity;
}

/**
 * Main entry point: compute full draft rankings.
 * @param {Array} players - All players from integrated-players API
 * @param {string} scoringMode - 'ffh', 'v3', or 'v4'
 * @param {number} leagueSize - Number of teams in the league (default 10)
 * @returns {{ rankedPlayers, tiers, replacementValues, scarcity }}
 */
export function computeDraftRankings(players, scoringMode, leagueSize = 10) {
  if (!players?.length) {
    return { rankedPlayers: [], tiers: {}, replacementValues: {}, scarcity: {} };
  }

  // Group players by position
  const playersByPosition = { GKP: [], DEF: [], MID: [], FWD: [] };
  players.forEach(player => {
    const pos = normalizePosition(player.position);
    if (pos && playersByPosition[pos]) {
      playersByPosition[pos].push(player);
    }
  });

  // Compute replacement values
  const replacementValues = computeReplacementValues(playersByPosition, scoringMode, leagueSize);

  // Compute scarcity
  const scarcity = computePositionScarcity(players);

  // Flex multipliers: reward players who can fill more starter slots
  const flexMultipliers = computeFlexMultipliers();

  // Rank all players by VORP (flex-adjusted)
  const rankedPlayers = players
    .map(player => {
      const pos = normalizePosition(player.position);
      const projection = getSeasonProjection(player, scoringMode);
      const rawVorp = pos ? projection - (replacementValues[pos] || 0) : 0;
      const flexMultiplier = flexMultipliers[pos] || 1.0;
      const vorp = rawVorp * flexMultiplier;

      return {
        ...player,
        draftProjection: projection,
        draftVorp: vorp,
        draftRawVorp: rawVorp,
        draftFlexMultiplier: flexMultiplier,
        draftPosition: pos,
      };
    })
    .filter(p => p.draftProjection > 0)
    .sort((a, b) => b.draftVorp - a.draftVorp);

  // Assign overall rank
  rankedPlayers.forEach((p, i) => {
    p.draftOverallRank = i + 1;
  });

  // Assign tiers
  const tieredPlayers = assignTiers(
    rankedPlayers.map(p => ({ ...p, projection: p.draftProjection }))
  );

  // Copy tier back onto ranked players
  tieredPlayers.forEach((tp, i) => {
    rankedPlayers[i].draftTier = tp.tier;
  });

  // Group into tier map for UI
  const tiers = {};
  rankedPlayers.forEach(p => {
    const tier = p.draftTier;
    if (!tiers[tier]) tiers[tier] = [];
    tiers[tier].push(p);
  });

  // Add sleeper tags: VORP rank is ≥15 spots better than overall projection rank
  const projectionRanked = [...rankedPlayers].sort((a, b) => b.draftProjection - a.draftProjection);
  projectionRanked.forEach((p, i) => { p._projRank = i + 1; });
  rankedPlayers.forEach(p => {
    p.draftSleeperTag = (p._projRank - p.draftOverallRank) >= 15;
    delete p._projRank;
  });

  // Per-position tiers: tier players within each position independently
  const positionTiers = {};
  for (const pos of ['GKP', 'DEF', 'MID', 'FWD']) {
    const posPlayers = rankedPlayers
      .filter(p => p.draftPosition === pos)
      .sort((a, b) => b.draftProjection - a.draftProjection);

    // Assign position rank
    posPlayers.forEach((p, i) => { p.draftPositionRank = i + 1; });

    // Tier within position — scale tier count to pool size
    // Aim for ~8-12 players per tier, capped at TARGET_TIERS
    const posTierCount = Math.min(TARGET_TIERS, Math.max(3, Math.round(posPlayers.length / 10)));
    const tiered = assignTiers(
      posPlayers.map(p => ({ ...p, projection: p.draftProjection })),
      posTierCount
    );

    // Store position tier on the player (separate from overall tier)
    tiered.forEach((tp, i) => {
      posPlayers[i].draftPosTier = tp.tier;
    });

    // Group into tier map
    const tierMap = {};
    posPlayers.forEach(p => {
      if (!tierMap[p.draftPosTier]) tierMap[p.draftPosTier] = [];
      tierMap[p.draftPosTier].push(p);
    });

    positionTiers[pos] = { players: posPlayers, tiers: tierMap };
  }

  return { rankedPlayers, tiers, replacementValues, scarcity, positionTiers };
}

/**
 * Compute how many slots each position can still fill on the roster,
 * accounting for the flex slot structure.
 *
 * Mandatory minimums (must fill to field a legal lineup):
 *   GKP: 1, DEF: 3, MID: 3, FWD: 1
 *
 * Flex-eligible maximums (locked + all flex slots this position can fill + bench):
 *   GKP: 1 + 6 bench = 7 (but realistically cap at ~2)
 *   DEF: 3 + FMD(1) + MD(1) + 6 bench = 11
 *   MID: 3 + FM(1) + FMD(1) + MD(1) + 6 bench = 14
 *   FWD: 1 + FM(1) + FMD(1) + 6 bench = 9
 *
 * We use practical caps to prevent absurd roster builds:
 */
const POSITION_MINIMUMS = { GKP: 1, DEF: 3, MID: 3, FWD: 1 }; // Must have these to start
const POSITION_MAXIMUMS = { GKP: 2, DEF: 6, MID: 7, FWD: 4 }; // Practical upper limits

/**
 * Get top N pick suggestions based on VORP weighted by roster need.
 *
 * The algorithm balances three forces:
 * 1. VORP (value) — always prefer better players
 * 2. Need (mandatory slots) — urgently boost positions below minimum
 * 3. Diminishing returns — each extra player at a full position is worth less
 *
 * @param {Array} availablePlayers - Players not yet drafted (already ranked with draftVorp)
 * @param {Array} myRoster - Players I've already drafted
 * @param {string} scoringMode - 'ffh', 'v3', or 'v4'
 * @param {number} leagueSize - Number of teams
 * @param {number} numSuggestions - How many suggestions to return (default 3)
 * @returns {Array} Top suggestions with score and reason
 */
export function getPickSuggestions(availablePlayers, myRoster, scoringMode, leagueSize = 10, numSuggestions = 3) {
  if (!availablePlayers?.length) return [];

  const totalRosterSize = ROSTER_SLOTS.total; // 17
  const picksRemaining = Math.max(1, totalRosterSize - myRoster.length);

  // Count how many of each position I already have
  const have = { GKP: 0, DEF: 0, MID: 0, FWD: 0 };
  myRoster.forEach(p => {
    const pos = normalizePosition(p.position);
    if (pos && have[pos] !== undefined) have[pos]++;
  });

  // How many mandatory slots are still unfilled?
  const mandatoryNeed = {};
  let totalMandatoryNeed = 0;
  for (const [pos, min] of Object.entries(POSITION_MINIMUMS)) {
    mandatoryNeed[pos] = Math.max(0, min - have[pos]);
    totalMandatoryNeed += mandatoryNeed[pos];
  }

  // Are we running out of picks to fill mandatory slots?
  // If picks remaining barely covers mandatory needs, force those positions.
  const urgencyThreshold = totalMandatoryNeed >= picksRemaining - 2; // 2 picks of slack

  // Precompute scarcity once (not per player)
  const scarcity = computePositionScarcity(availablePlayers);

  // Score each available player
  const scored = availablePlayers.map(player => {
    const pos = normalizePosition(player.position);
    const vorp = player.draftVorp || 0;
    if (vorp <= 0) return null;

    let multiplier = 1.0;
    let reason = 'Value';

    // ── Force mandatory positions when picks are running out ──
    if (urgencyThreshold && mandatoryNeed[pos] > 0) {
      // Must-fill: massive boost
      multiplier = 3.0;
      reason = 'Must Fill';
    } else if (mandatoryNeed[pos] > 0) {
      // Still need this position but not yet urgent
      // Boost scales with how many we still need vs how many picks remain
      const needRatio = mandatoryNeed[pos] / picksRemaining;
      multiplier = 1.0 + needRatio * 4.0; // 1.0 to ~2.0 range
      reason = 'Need';
    } else if (have[pos] >= POSITION_MAXIMUMS[pos]) {
      // At or above practical max — heavily penalize
      multiplier = 0.05;
      reason = 'Full';
    } else if (have[pos] >= POSITION_MINIMUMS[pos]) {
      // Have enough starters, adding depth
      // Diminishing returns: each extra player at this position is worth less
      const excess = have[pos] - POSITION_MINIMUMS[pos];
      multiplier = Math.max(0.15, 0.7 - excess * 0.15);
      reason = 'Depth';
    }

    // Scarcity boost (mild — don't let it override need logic)
    const scarcityBoost = 1 + (scarcity[pos] - 1) * 0.15;

    // Sleeper tag override
    if (player.draftSleeperTag && reason === 'Value') reason = 'Sleeper';

    const score = vorp * multiplier * scarcityBoost;

    return { ...player, draftScore: score, draftReason: reason, draftNeedWeight: multiplier };
  }).filter(Boolean);

  // Ensure at least one suggestion per unfilled mandatory position (if available)
  const suggestions = [];
  const used = new Set();

  if (totalMandatoryNeed > 0) {
    // First pass: pick the best player for each unfilled mandatory position
    for (const [pos, need] of Object.entries(mandatoryNeed)) {
      if (need <= 0) continue;
      const best = scored
        .filter(p => normalizePosition(p.position) === pos && !used.has(p.sleeper_id || p.id))
        .sort((a, b) => b.draftScore - a.draftScore)[0];
      if (best && suggestions.length < numSuggestions) {
        suggestions.push(best);
        used.add(best.sleeper_id || best.id);
      }
    }
  }

  // Fill remaining suggestion slots with best overall
  const remaining = scored
    .filter(p => !used.has(p.sleeper_id || p.id))
    .sort((a, b) => b.draftScore - a.draftScore);

  for (const player of remaining) {
    if (suggestions.length >= numSuggestions) break;
    suggestions.push(player);
  }

  return suggestions.sort((a, b) => b.draftScore - a.draftScore);
}

/**
 * Get the tier label for display.
 */
export function getTierLabel(tierNumber) {
  const labels = {
    1: 'Elite',
    2: 'Premium',
    3: 'High-End Starter',
    4: 'Starter',
    5: 'Solid Starter',
    6: 'Flex Play',
    7: 'Rotation',
    8: 'Upside Bench',
    9: 'Bench',
    10: 'Deep Bench',
    11: 'Flier',
  };
  return labels[tierNumber] || `Tier ${tierNumber}`;
}

/**
 * Get tier color classes for the UI.
 */
export function getTierColor(tierNumber) {
  const colors = {
    1: { bg: 'bg-amber-500/20', border: 'border-amber-500/40', text: 'text-amber-400' },
    2: { bg: 'bg-orange-500/20', border: 'border-orange-500/40', text: 'text-orange-400' },
    3: { bg: 'bg-violet-500/20', border: 'border-violet-500/40', text: 'text-violet-400' },
    4: { bg: 'bg-blue-500/20', border: 'border-blue-500/40', text: 'text-blue-400' },
    5: { bg: 'bg-cyan-500/20', border: 'border-cyan-500/40', text: 'text-cyan-400' },
    6: { bg: 'bg-emerald-500/20', border: 'border-emerald-500/40', text: 'text-emerald-400' },
    7: { bg: 'bg-teal-500/20', border: 'border-teal-500/40', text: 'text-teal-400' },
    8: { bg: 'bg-green-500/20', border: 'border-green-500/40', text: 'text-green-400' },
    9: { bg: 'bg-slate-500/20', border: 'border-slate-500/40', text: 'text-slate-400' },
    10: { bg: 'bg-slate-600/20', border: 'border-slate-600/40', text: 'text-slate-500' },
    11: { bg: 'bg-slate-700/20', border: 'border-slate-700/40', text: 'text-slate-600' },
  };
  return colors[tierNumber] || colors[11];
}

export { SLEEPER_FC_ROSTER, ROSTER_SLOTS, FLEX_WEIGHT, getSeasonProjection, normalizePosition, computeFlexMultipliers };
