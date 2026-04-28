/**
 * Mock Draft AI Service
 * Pure computation — no React, no side effects.
 *
 * Provides:
 *   - generatePickOrder(leagueSize, rounds) → snake pick order
 *   - ARCHETYPES config
 *   - getAiPick(teamIdx, available, roster, archetype, round, totalRounds, difficulty)
 *   - computeAvailabilityProbs(rankedPlayers, pickOrder, archetypes, myTeamIndex, N)
 *   - gradeDraft(myPicks, allPicks, rankedPlayers)
 *   - gradeOnePick(pick, allPriorPicks, rankedPlayers)
 */

import { normalizePosition, POSITION_MINIMUMS, POSITION_MAXIMUMS } from './draftRankingService.js';

// Re-export constants needed by UI
export { POSITION_MINIMUMS, POSITION_MAXIMUMS };

// ─── Gaussian noise helper ────────────────────────────────────────────────────
// Box-Muller transform: generates N(0,1) sample
function gaussianNoise() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

// ─── Difficulty noise multipliers ────────────────────────────────────────────
export const DIFFICULTY_NOISE = {
  casual:   1.8,
  balanced: 1.0,
  sharp:    0.5,
};

// ─── Archetype Definitions ────────────────────────────────────────────────────
//
// posWeights:      position preference multipliers applied to draftVorp
// needAwareness:   0-1 scale — how strongly this archetype responds to mandatory
//                  positional need (0 = pure best-available, 1 = heavily need-driven)
// baseNoise:       base σ for Gaussian noise (scaled by difficulty)
// gkpStrategy:     null | { waitUntilRound: N } | { preferByRound: N }
// useRawProjection: if true, sort by draftProjection instead of draftVorp (Star Chaser)
//
export const ARCHETYPES = {
  valueBot: {
    name: 'Value Bot',
    description: 'Plays close to optimal. Uses VORP + flex, responds strongly to positional need.',
    posWeights: { GKP: 1.0, DEF: 1.0, MID: 1.0, FWD: 1.0 },
    needAwareness: 0.9,
    baseNoise: 0.06,
    gkpStrategy: null,
    useRawProjection: false,
  },
  attackHunter: {
    name: 'Attack Hunter',
    description: 'Loves goals and assists. Reaches for MID/FWD, delays GK as long as possible.',
    posWeights: { GKP: 0.45, DEF: 0.70, MID: 1.45, FWD: 1.55 },
    needAwareness: 0.30,
    baseNoise: 0.14,
    gkpStrategy: { waitUntilRound: 14 },
    useRawProjection: false,
  },
  cleanSheetMerchant: {
    name: 'Clean Sheet Merchant',
    description: 'Defence first. Grabs a premium GK very early, stacks DEF.',
    posWeights: { GKP: 1.70, DEF: 1.55, MID: 0.85, FWD: 0.65 },
    needAwareness: 0.70,
    baseNoise: 0.11,
    gkpStrategy: { preferByRound: 3 },
    useRawProjection: false,
  },
  starChaser: {
    name: 'Star Chaser',
    description: 'Always picks the biggest name. Ignores VORP — uses raw projection instead.',
    posWeights: { GKP: 1.0, DEF: 1.0, MID: 1.0, FWD: 1.0 },
    needAwareness: 0.05,
    baseNoise: 0.09,
    gkpStrategy: { waitUntilRound: 16 },
    useRawProjection: true,   // ← key differentiator: sorts by projection not VORP
  },
  balancedBuilder: {
    name: 'Balanced Builder',
    description: 'Methodical. Fills positions proportionally. Highly responsive to roster need.',
    posWeights: { GKP: 1.0, DEF: 1.15, MID: 1.05, FWD: 1.0 },
    needAwareness: 1.0,
    baseNoise: 0.10,
    gkpStrategy: { preferByRound: 8 },
    useRawProjection: false,
  },
  lateGkSpecialist: {
    name: 'Late GK Specialist',
    description: 'Waits on GK until the final rounds. Correct strategy — strong non-GK roster.',
    posWeights: { GKP: 0.05, DEF: 1.15, MID: 1.20, FWD: 1.10 },
    needAwareness: 0.75,
    baseNoise: 0.13,
    gkpStrategy: { waitUntilRound: 15 },
    useRawProjection: false,
  },
  wildcard: {
    name: 'Wildcard',
    description: 'High noise. Unpredictable — occasionally brilliant, often chaotic.',
    posWeights: { GKP: 1.0, DEF: 1.0, MID: 1.0, FWD: 1.0 },
    needAwareness: 0.40,
    baseNoise: 0.35,
    gkpStrategy: null,
    useRawProjection: false,
  },
};

// ─── Default team archetype assignment (10 teams) ────────────────────────────
// Randomly shuffled at mock start (see assignArchetypes). These are weights for
// how many of each archetype appear.
const ARCHETYPE_POOL = [
  'valueBot',
  'attackHunter',
  'attackHunter',
  'cleanSheetMerchant',
  'starChaser',
  'balancedBuilder',
  'balancedBuilder',
  'lateGkSpecialist',
  'wildcard',
  // 10th slot = user
];

/**
 * Randomly assign archetypes to opponent teams.
 * The user's team index is excluded.
 * @param {number} leagueSize
 * @param {number} myTeamIndex
 * @returns {{ [teamIndex]: archetypeKey }}
 */
export function assignArchetypes(leagueSize, myTeamIndex) {
  // Shuffle the pool
  const pool = [...ARCHETYPE_POOL];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  const assignment = {};
  let poolIdx = 0;
  for (let t = 0; t < leagueSize; t++) {
    if (t === myTeamIndex) continue;
    assignment[t] = pool[poolIdx++] || 'balancedBuilder';
  }
  return assignment;
}

// ─── Snake Draft Pick Order ───────────────────────────────────────────────────
/**
 * Generate the full snake pick order.
 * @param {number} leagueSize
 * @param {number} rounds - default 17 (Sleeper FC roster size)
 * @returns {Array<{ overall, round, pickInRound, teamIndex }>}
 */
export function generatePickOrder(leagueSize, rounds = 17) {
  const order = [];
  for (let round = 0; round < rounds; round++) {
    const teams = Array.from({ length: leagueSize }, (_, i) => i);
    if (round % 2 === 1) teams.reverse(); // snake
    teams.forEach((teamIndex, pickInRound) => {
      order.push({
        overall: round * leagueSize + pickInRound + 1,
        round: round + 1,
        pickInRound: pickInRound + 1,
        teamIndex,
      });
    });
  }
  return order;
}

/**
 * Get the pick slot numbers (1-indexed overall) for a given team.
 */
export function getMyPickSlots(pickOrder, myTeamIndex) {
  return pickOrder
    .filter(p => p.teamIndex === myTeamIndex)
    .map(p => p.overall);
}

// ─── Positional need helpers ──────────────────────────────────────────────────
function countPositions(roster) {
  const have = { GKP: 0, DEF: 0, MID: 0, FWD: 0 };
  roster.forEach(p => {
    const pos = normalizePosition(p.position);
    if (pos) have[pos] = (have[pos] || 0) + 1;
  });
  return have;
}

function computeMandatoryNeed(have, picksRemaining) {
  let total = 0;
  const need = {};
  for (const [pos, min] of Object.entries(POSITION_MINIMUMS)) {
    need[pos] = Math.max(0, min - (have[pos] || 0));
    total += need[pos];
  }
  return { need, total };
}

/**
 * Need multiplier: how urgently does this team need this position?
 * Returns a multiplier to apply to the base VORP score.
 */
function needMultiplier(pos, have, picksRemaining, needAwareness, mandatoryNeed, totalMandatoryNeed) {
  const posNeed = mandatoryNeed[pos] || 0;
  const atMax = (have[pos] || 0) >= (POSITION_MAXIMUMS[pos] || 99);

  if (atMax) return 0.05; // effectively excluded

  if (posNeed > 0) {
    // Urgency: close to "must fill" territory
    const urgency = picksRemaining > 0 ? totalMandatoryNeed / picksRemaining : 1;
    const baseBoost = 1.0 + posNeed * 0.4 * needAwareness;
    const urgencyBoost = urgency > 0.8 ? 2.5 * needAwareness : 1.0;
    return baseBoost * urgencyBoost;
  }

  const excess = (have[pos] || 0) - (POSITION_MINIMUMS[pos] || 0);
  if (excess > 0) {
    // Diminishing returns for extra players
    const diminish = Math.max(0.15, 0.7 - excess * 0.15);
    return 1.0 + (diminish - 1.0) * needAwareness;
  }

  return 1.0;
}

// ─── GK strategy override ─────────────────────────────────────────────────────
function applyGkpStrategy(pos, round, totalRounds, gkpStrategy, have) {
  if (pos !== 'GKP' || !gkpStrategy) return 1.0;

  const hasGK = (have['GKP'] || 0) >= 1;

  if (gkpStrategy.waitUntilRound && round < gkpStrategy.waitUntilRound) {
    return hasGK ? 0.02 : 0.05; // heavily suppress GK early
  }
  if (gkpStrategy.waitUntilRound && round >= gkpStrategy.waitUntilRound) {
    return hasGK ? 0.02 : 3.0; // force GK late if still needed
  }
  if (gkpStrategy.preferByRound && round <= gkpStrategy.preferByRound && !hasGK) {
    return 2.5; // strong preference for early GK
  }

  return 1.0;
}

// ─── Core AI pick function ────────────────────────────────────────────────────
/**
 * Select the best pick for an AI team given their archetype.
 *
 * @param {Array}  available   - ranked player objects (with draftVorp, draftProjection)
 * @param {Array}  roster      - this team's current picks (player objects)
 * @param {string} archetypeKey
 * @param {number} round       - current round (1-indexed)
 * @param {number} totalRounds - total rounds in draft (17)
 * @param {string} difficulty  - 'casual' | 'balanced' | 'sharp'
 * @returns {object} chosen player
 */
export function getAiPick(available, roster, archetypeKey, round, totalRounds, difficulty = 'balanced') {
  if (!available?.length) return null;

  const archetype = ARCHETYPES[archetypeKey] || ARCHETYPES.balancedBuilder;
  const noiseScale = archetype.baseNoise * (DIFFICULTY_NOISE[difficulty] || 1.0);
  const picksRemaining = totalRounds - round + 1;

  const have = countPositions(roster);
  const { need: mandNeed, total: totalMandatory } = computeMandatoryNeed(have, picksRemaining);

  let best = null;
  let bestScore = -Infinity;

  for (const player of available) {
    const pos = normalizePosition(player.position);
    if (!pos) continue;

    const atMax = (have[pos] || 0) >= (POSITION_MAXIMUMS[pos] || 99);
    if (atMax) continue;

    // Base value: VORP or raw projection depending on archetype
    const baseValue = archetype.useRawProjection
      ? (player.draftProjection || 0)
      : (player.draftVorp || 0);

    if (baseValue <= 0) continue;

    // Archetype position preference
    const prefWeight = archetype.posWeights[pos] || 1.0;

    // GK strategy override
    const gkpMod = applyGkpStrategy(pos, round, totalRounds, archetype.gkpStrategy, have);
    if (gkpMod < 0.1 && pos === 'GKP') continue; // skip GK when suppressed

    // Positional need
    const needMult = needMultiplier(
      pos, have, picksRemaining,
      archetype.needAwareness, mandNeed, totalMandatory
    );

    // Multiplicative Gaussian noise — shuffles within tier, not across tiers
    const noise = 1.0 + gaussianNoise() * noiseScale;

    const score = baseValue * prefWeight * gkpMod * needMult * Math.max(0.2, noise);

    if (score > bestScore) {
      bestScore = score;
      best = player;
    }
  }

  // Fallback: if all positions were filtered (e.g. at max), take best available by VORP
  if (!best && available.length > 0) {
    best = available.reduce((a, b) =>
      (b.draftVorp || 0) > (a.draftVorp || 0) ? b : a
    );
  }

  return best;
}

/**
 * Lean version of getAiPick for Monte Carlo simulations — no noise, pure expected value.
 * Used in computeAvailabilityProbs to keep simulations fast.
 */
function getAiPickDeterministic(available, roster, archetypeKey, round, totalRounds) {
  if (!available?.length) return null;

  const archetype = ARCHETYPES[archetypeKey] || ARCHETYPES.balancedBuilder;
  const have = countPositions(roster);
  const picksRemaining = totalRounds - round + 1;
  const { need: mandNeed, total: totalMandatory } = computeMandatoryNeed(have, picksRemaining);

  let best = null;
  let bestScore = -Infinity;

  for (const player of available) {
    const pos = normalizePosition(player.position);
    if (!pos) continue;
    if ((have[pos] || 0) >= (POSITION_MAXIMUMS[pos] || 99)) continue;

    const baseValue = archetype.useRawProjection
      ? (player.draftProjection || 0)
      : (player.draftVorp || 0);
    if (baseValue <= 0) continue;

    const prefWeight = archetype.posWeights[pos] || 1.0;
    const gkpMod = applyGkpStrategy(pos, round, totalRounds, archetype.gkpStrategy, have);
    if (gkpMod < 0.1 && pos === 'GKP') continue;

    const needMult = needMultiplier(
      pos, have, picksRemaining,
      archetype.needAwareness, mandNeed, totalMandatory
    );

    const score = baseValue * prefWeight * gkpMod * needMult;
    if (score > bestScore) { bestScore = score; best = player; }
  }

  return best || (available.length > 0 ? available[0] : null);
}

// ─── Availability Probability (Monte Carlo) ───────────────────────────────────
/**
 * For each player, compute the probability they're still available at each
 * of the user's pick positions.
 *
 * Returns: { [sleeperId]: [prob_at_pick_1, prob_at_pick_2, ...] }
 * where indices correspond to the user's picks in order (up to 17 values).
 *
 * @param {Array}  rankedPlayers  - all ranked players with draftVorp
 * @param {Array}  pickOrder      - full pick order from generatePickOrder
 * @param {object} archetypes     - { [teamIndex]: archetypeKey }
 * @param {number} myTeamIndex
 * @param {number} N              - number of simulations (default 300)
 */
export function computeAvailabilityProbs(rankedPlayers, pickOrder, archetypes, myTeamIndex, N = 300) {
  const totalRounds = Math.max(...pickOrder.map(p => p.round));
  const leagueSize = new Set(pickOrder.map(p => p.teamIndex)).size;

  // My pick indices (positions in pickOrder where it's my turn)
  const myPickIndices = pickOrder
    .map((p, idx) => ({ ...p, idx }))
    .filter(p => p.teamIndex === myTeamIndex)
    .map(p => p.idx);

  if (myPickIndices.length === 0) return {};

  // Survived count: sleeperId → [count surviving to my pick 0, pick 1, ...]
  const survivedCounts = {};
  rankedPlayers.forEach(p => {
    survivedCounts[p.sleeper_id || p.id] = new Array(myPickIndices.length).fill(0);
  });

  // Build a lookup by sleeper_id for fast access
  const playerById = {};
  rankedPlayers.forEach(p => { playerById[p.sleeper_id || p.id] = p; });

  for (let sim = 0; sim < N; sim++) {
    // Use a Set of ids for O(1) availability checks
    const available = new Set(rankedPlayers.map(p => p.sleeper_id || p.id));
    const rosters = {};  // teamIndex → array of player ids
    for (let t = 0; t < leagueSize; t++) rosters[t] = [];

    let myPickCheckpoint = 0;

    for (let i = 0; i < pickOrder.length; i++) {
      const { teamIndex, round } = pickOrder[i];

      // At my pick positions — count what's survived
      if (myPickIndices[myPickCheckpoint] === i) {
        available.forEach(id => { survivedCounts[id][myPickCheckpoint]++; });
        myPickCheckpoint++;
        if (myPickCheckpoint >= myPickIndices.length) break;
        continue; // don't simulate my pick
      }

      if (teamIndex === myTeamIndex) continue;

      // Build available array for this team (only those not yet taken)
      const availArray = [];
      available.forEach(id => {
        if (playerById[id]) availArray.push(playerById[id]);
      });

      const archetypeKey = archetypes[teamIndex] || 'balancedBuilder';
      const teamRoster = rosters[teamIndex].map(id => playerById[id]).filter(Boolean);

      const pick = getAiPickDeterministic(availArray, teamRoster, archetypeKey, round, totalRounds);
      if (pick) {
        const pickId = pick.sleeper_id || pick.id;
        available.delete(pickId);
        rosters[teamIndex].push(pickId);
      }
    }
  }

  // Normalize to probabilities
  const result = {};
  Object.entries(survivedCounts).forEach(([id, counts]) => {
    result[id] = counts.map(c => c / N);
  });

  return result;
}

// ─── Draft Grading ────────────────────────────────────────────────────────────
/**
 * Grade a single pick relative to what was available at that moment.
 *
 * @param {object} myPick         - { player, overall }
 * @param {Array}  allPriorPicks  - all picks made before this one (by all teams)
 * @param {Array}  rankedPlayers  - full ranked player list (with draftVorp)
 * @returns {{ delta, topAvailable, label, isSteal, isReach }}
 */
export function gradeOnePick(myPick, allPriorPicks, rankedPlayers) {
  const takenBefore = new Set(allPriorPicks.map(p => (p.player.sleeper_id || p.player.id)));
  const availableAtPick = rankedPlayers.filter(p => !takenBefore.has(p.sleeper_id || p.id));

  const topAvailable = availableAtPick[0];
  const myVorp = myPick.player.draftVorp || 0;
  const topVorp = topAvailable?.draftVorp || myVorp;
  const delta = myVorp - topVorp;

  let label;
  if (delta >= 0)   label = '✓ Optimal';
  else if (delta >= -3)  label = 'Good Value';
  else if (delta >= -8)  label = 'Minor Reach';
  else if (delta >= -15) label = 'Reach';
  else                   label = 'Big Reach';

  return {
    delta,
    topAvailable,
    label,
    isSteal: delta >= 4,
    isReach: delta <= -8,
  };
}

/**
 * Grade the full draft (all 17 of the user's picks).
 *
 * @param {Array} myPicks   - user's picks: [{ player, overall }]
 * @param {Array} allPicks  - every pick by every team: [{ player, overall, teamIndex }]
 * @param {Array} rankedPlayers
 * @returns {{ letter, color, label, efficiency, pickAnalysis, steals, reaches }}
 */
export function gradeDraft(myPicks, allPicks, rankedPlayers) {
  // Sort all picks by overall order
  const sortedAll = [...allPicks].sort((a, b) => a.overall - b.overall);

  let totalMyVorp = 0;
  let totalOptimalVorp = 0;
  const pickAnalysis = [];
  const steals = [];
  const reaches = [];

  myPicks.forEach(myPick => {
    const priorPicks = sortedAll.filter(p => p.overall < myPick.overall);
    const grade = gradeOnePick(myPick, priorPicks, rankedPlayers);

    totalMyVorp += myPick.player.draftVorp || 0;
    totalOptimalVorp += grade.topAvailable?.draftVorp || myPick.player.draftVorp || 0;

    pickAnalysis.push({ ...myPick, ...grade });
    if (grade.isSteal)  steals.push({ ...myPick, delta: grade.delta });
    if (grade.isReach)  reaches.push({ ...myPick, delta: grade.delta });
  });

  const efficiency = totalOptimalVorp > 0 ? totalMyVorp / totalOptimalVorp : 0;

  let letter, color, label;
  if (efficiency >= 0.93) { letter = 'A+'; color = 'amber'; label = 'Perfect Draft'; }
  else if (efficiency >= 0.89) { letter = 'A';  color = 'amber'; label = 'Excellent'; }
  else if (efficiency >= 0.85) { letter = 'B+'; color = 'green'; label = 'Strong Draft'; }
  else if (efficiency >= 0.80) { letter = 'B';  color = 'green'; label = 'Solid'; }
  else if (efficiency >= 0.75) { letter = 'C+'; color = 'blue';  label = 'Average'; }
  else if (efficiency >= 0.70) { letter = 'C';  color = 'blue';  label = 'Below Average'; }
  else                         { letter = 'D';  color = 'red';   label = 'Needs Work'; }

  return { letter, color, label, efficiency, pickAnalysis, steals, reaches, totalMyVorp, totalOptimalVorp };
}

/**
 * Compute VORP totals for all teams and return sorted ranking.
 * @param {Array} allPicks  - [{ player, teamIndex }]
 * @param {number} myTeamIndex
 * @param {object} archetypes - { [teamIndex]: archetypeKey }
 * @returns {Array<{ teamIndex, archetypeKey, archetypeName, totalVorp, isMe }>} sorted desc
 */
export function rankTeams(allPicks, myTeamIndex, archetypes) {
  const vorpByTeam = {};
  allPicks.forEach(({ player, teamIndex }) => {
    vorpByTeam[teamIndex] = (vorpByTeam[teamIndex] || 0) + (player.draftVorp || 0);
  });

  return Object.entries(vorpByTeam)
    .map(([ti, vorp]) => {
      const teamIndex = Number(ti);
      const archetypeKey = archetypes[teamIndex] || null;
      return {
        teamIndex,
        archetypeKey,
        archetypeName: archetypeKey ? ARCHETYPES[archetypeKey]?.name : 'You',
        totalVorp: Math.round(vorp * 10) / 10,
        isMe: teamIndex === myTeamIndex,
      };
    })
    .sort((a, b) => b.totalVorp - a.totalVorp);
}
