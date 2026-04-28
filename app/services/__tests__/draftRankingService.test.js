/**
 * Tests for draftRankingService.js
 * Covers: VORP computation, flex multipliers, tier assignment, pick suggestions.
 */

import {
  computeDraftRankings,
  getPickSuggestions,
  getTierLabel,
  getTierColor,
  computeFlexMultipliers,
  FLEX_WEIGHT,
  ROSTER_SLOTS,
  normalizePosition,
} from '../draftRankingService.js';

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makePlayer(id, position, points, overrides = {}) {
  return {
    sleeper_id: String(id),
    id: String(id),
    name: `Player ${id}`,
    position,
    predicted_points: points,
    v3_season_total: points * 1.05,
    v4_season_total: points * 1.1,
    ...overrides,
  };
}

/** Build a minimal pool: 5 of each position with descending projections */
function makePool() {
  const players = [];
  let id = 1;
  ['GKP', 'DEF', 'MID', 'FWD'].forEach(pos => {
    for (let i = 5; i >= 1; i--) {
      players.push(makePlayer(id++, pos, i * 10));
    }
  });
  return players;
}

// ─── normalizePosition ───────────────────────────────────────────────────────

describe('normalizePosition', () => {
  it('maps GK/GKP/G to GKP', () => {
    expect(normalizePosition('GK')).toBe('GKP');
    expect(normalizePosition('GKP')).toBe('GKP');
    expect(normalizePosition('G')).toBe('GKP');
  });

  it('maps DEF/D to DEF', () => {
    expect(normalizePosition('DEF')).toBe('DEF');
    expect(normalizePosition('d')).toBe('DEF');
  });

  it('maps MID/M to MID', () => {
    expect(normalizePosition('MID')).toBe('MID');
    expect(normalizePosition('m')).toBe('MID');
  });

  it('maps FWD/F to FWD', () => {
    expect(normalizePosition('FWD')).toBe('FWD');
    expect(normalizePosition('f')).toBe('FWD');
  });

  it('returns null for unknown positions', () => {
    expect(normalizePosition('XYZ')).toBeNull();
    expect(normalizePosition(null)).toBeNull();
    expect(normalizePosition(undefined)).toBeNull();
  });
});

// ─── computeFlexMultipliers ──────────────────────────────────────────────────

describe('computeFlexMultipliers', () => {
  let multipliers;

  beforeAll(() => {
    multipliers = computeFlexMultipliers();
  });

  it('returns a multiplier for every position', () => {
    expect(multipliers).toHaveProperty('GKP');
    expect(multipliers).toHaveProperty('DEF');
    expect(multipliers).toHaveProperty('MID');
    expect(multipliers).toHaveProperty('FWD');
  });

  it('GKP has no flex bonus (baseline 1.0)', () => {
    expect(multipliers.GKP).toBe(1.0);
  });

  it('MID has the highest multiplier (most flex slots)', () => {
    expect(multipliers.MID).toBeGreaterThan(multipliers.DEF);
    expect(multipliers.MID).toBeGreaterThan(multipliers.FWD);
    expect(multipliers.MID).toBeGreaterThan(multipliers.GKP);
  });

  it('DEF and FWD have equal multipliers (both fill 2 flex slots)', () => {
    expect(multipliers.DEF).toBeCloseTo(multipliers.FWD, 5);
  });

  it('MID multiplier equals 1 + FLEX_WEIGHT', () => {
    expect(multipliers.MID).toBeCloseTo(1 + FLEX_WEIGHT, 5);
  });

  it('all multipliers are >= 1.0', () => {
    Object.values(multipliers).forEach(m => {
      expect(m).toBeGreaterThanOrEqual(1.0);
    });
  });

  it('is derived from ROSTER_SLOTS (FM/FMD/MD flex)', () => {
    // MID fills all 3 flex slots — verify this matches ROSTER_SLOTS structure
    const midFlexSlots = ROSTER_SLOTS.starters.filter(s =>
      ['FM FLEX', 'FMD FLEX', 'MD FLEX'].includes(s.slot) &&
      s.positions.includes('MID')
    ).length;
    expect(midFlexSlots).toBe(3);
  });
});

// ─── computeDraftRankings ────────────────────────────────────────────────────

describe('computeDraftRankings', () => {
  const pool = makePool();

  it('returns empty result for empty player list', () => {
    const result = computeDraftRankings([], 'ffh');
    expect(result.rankedPlayers).toHaveLength(0);
    expect(result.tiers).toEqual({});
  });

  it('returns empty result for null input', () => {
    const result = computeDraftRankings(null, 'ffh');
    expect(result.rankedPlayers).toHaveLength(0);
  });

  it('ranks all players with positive projections', () => {
    const { rankedPlayers } = computeDraftRankings(pool, 'ffh');
    expect(rankedPlayers.length).toBeGreaterThan(0);
    rankedPlayers.forEach(p => {
      expect(p.draftProjection).toBeGreaterThan(0);
    });
  });

  it('assigns sequential overall ranks starting at 1', () => {
    const { rankedPlayers } = computeDraftRankings(pool, 'ffh');
    rankedPlayers.forEach((p, i) => {
      expect(p.draftOverallRank).toBe(i + 1);
    });
  });

  it('assigns draftVorp and draftRawVorp to every player', () => {
    const { rankedPlayers } = computeDraftRankings(pool, 'ffh');
    rankedPlayers.forEach(p => {
      expect(typeof p.draftVorp).toBe('number');
      expect(typeof p.draftRawVorp).toBe('number');
    });
  });

  it('flex-adjusted VORP >= raw VORP for DEF/MID/FWD', () => {
    const { rankedPlayers } = computeDraftRankings(pool, 'ffh');
    rankedPlayers.forEach(p => {
      if (p.draftPosition !== 'GKP' && p.draftRawVorp > 0) {
        expect(p.draftVorp).toBeGreaterThanOrEqual(p.draftRawVorp);
      }
    });
  });

  it('GKP draftVorp equals draftRawVorp (no flex bonus)', () => {
    const { rankedPlayers } = computeDraftRankings(pool, 'ffh');
    const gkps = rankedPlayers.filter(p => p.draftPosition === 'GKP');
    gkps.forEach(p => {
      expect(p.draftVorp).toBeCloseTo(p.draftRawVorp, 5);
    });
  });

  it('MID flex multiplier is higher than FWD', () => {
    const { rankedPlayers } = computeDraftRankings(pool, 'ffh');
    const mid = rankedPlayers.find(p => p.draftPosition === 'MID');
    const fwd = rankedPlayers.find(p => p.draftPosition === 'FWD');
    expect(mid.draftFlexMultiplier).toBeGreaterThan(fwd.draftFlexMultiplier);
  });

  it('assigns tier 1 to the top-ranked player', () => {
    const { rankedPlayers } = computeDraftRankings(pool, 'ffh');
    expect(rankedPlayers[0].draftTier).toBe(1);
  });

  it('groups tiers correctly in the tiers map', () => {
    const { tiers, rankedPlayers } = computeDraftRankings(pool, 'ffh');
    const allTiered = Object.values(tiers).flat();
    expect(allTiered.length).toBe(rankedPlayers.length);
  });

  it('includes positionTiers for all four positions', () => {
    const { positionTiers } = computeDraftRankings(pool, 'ffh');
    expect(positionTiers).toHaveProperty('GKP');
    expect(positionTiers).toHaveProperty('DEF');
    expect(positionTiers).toHaveProperty('MID');
    expect(positionTiers).toHaveProperty('FWD');
  });

  it('uses v3_season_total in v3 scoring mode', () => {
    const singlePlayer = [makePlayer(99, 'MID', 100)];
    const { rankedPlayers } = computeDraftRankings(singlePlayer, 'v3', 1);
    // v3_season_total = 100 * 1.05 = 105
    expect(rankedPlayers[0].draftProjection).toBeCloseTo(105, 1);
  });

  it('uses v4_season_total in v4 scoring mode', () => {
    const singlePlayer = [makePlayer(99, 'MID', 100)];
    const { rankedPlayers } = computeDraftRankings(singlePlayer, 'v4', 1);
    // v4_season_total = 100 * 1.1 = 110
    expect(rankedPlayers[0].draftProjection).toBeCloseTo(110, 1);
  });

  it('top-projected player per position has highest position rank', () => {
    const { positionTiers } = computeDraftRankings(pool, 'ffh');
    ['GKP', 'DEF', 'MID', 'FWD'].forEach(pos => {
      const topPlayer = positionTiers[pos].players[0];
      expect(topPlayer.draftPositionRank).toBe(1);
    });
  });

  it('players are sorted descending by draftVorp', () => {
    const { rankedPlayers } = computeDraftRankings(pool, 'ffh');
    for (let i = 1; i < rankedPlayers.length; i++) {
      expect(rankedPlayers[i - 1].draftVorp).toBeGreaterThanOrEqual(rankedPlayers[i].draftVorp);
    }
  });
});

// ─── getPickSuggestions ──────────────────────────────────────────────────────

describe('getPickSuggestions', () => {
  it('returns empty array when no players available', () => {
    expect(getPickSuggestions([], [], 'ffh')).toHaveLength(0);
    expect(getPickSuggestions(null, [], 'ffh')).toHaveLength(0);
  });

  it('returns up to numSuggestions players', () => {
    const { rankedPlayers } = computeDraftRankings(makePool(), 'ffh');
    const suggestions = getPickSuggestions(rankedPlayers, [], 'ffh', 10, 3);
    expect(suggestions.length).toBeLessThanOrEqual(3);
  });

  it('boosts a position with mandatory need above minimum', () => {
    const { rankedPlayers } = computeDraftRankings(makePool(), 'ffh');
    // Empty roster — all positions are needed. GKP should appear in suggestions.
    const suggestions = getPickSuggestions(rankedPlayers, [], 'ffh', 10, 5);
    const hasGKP = suggestions.some(p => p.draftPosition === 'GKP');
    expect(hasGKP).toBe(true);
  });

  it('penalises positions at their max cap', () => {
    const { rankedPlayers } = computeDraftRankings(makePool(), 'ffh');
    // Fill GKP to its max (2)
    const myRoster = [
      makePlayer(90, 'GKP', 50),
      makePlayer(91, 'GKP', 45),
    ];
    const suggestions = getPickSuggestions(rankedPlayers, myRoster, 'ffh', 10, 5);
    const hasGKP = suggestions.some(p => p.draftPosition === 'GKP');
    expect(hasGKP).toBe(false);
  });

  it('attaches draftScore and draftReason to every suggestion', () => {
    const { rankedPlayers } = computeDraftRankings(makePool(), 'ffh');
    const suggestions = getPickSuggestions(rankedPlayers, [], 'ffh', 10, 3);
    suggestions.forEach(s => {
      expect(typeof s.draftScore).toBe('number');
      expect(typeof s.draftReason).toBe('string');
    });
  });

  it('returns suggestions sorted by draftScore descending', () => {
    const { rankedPlayers } = computeDraftRankings(makePool(), 'ffh');
    const suggestions = getPickSuggestions(rankedPlayers, [], 'ffh', 10, 3);
    for (let i = 1; i < suggestions.length; i++) {
      expect(suggestions[i - 1].draftScore).toBeGreaterThanOrEqual(suggestions[i].draftScore);
    }
  });
});

// ─── getTierLabel / getTierColor ─────────────────────────────────────────────

describe('getTierLabel', () => {
  it('returns named labels for tiers 1-11', () => {
    expect(getTierLabel(1)).toBe('Elite');
    expect(getTierLabel(2)).toBe('Premium');
    expect(getTierLabel(11)).toBe('Flier');
  });

  it('falls back to "Tier N" for unknown tier numbers', () => {
    expect(getTierLabel(99)).toBe('Tier 99');
    expect(getTierLabel(0)).toBe('Tier 0');
  });
});

describe('getTierColor', () => {
  it('returns bg/border/text keys for known tiers', () => {
    const color = getTierColor(1);
    expect(color).toHaveProperty('bg');
    expect(color).toHaveProperty('border');
    expect(color).toHaveProperty('text');
  });

  it('falls back gracefully for unknown tiers', () => {
    const color = getTierColor(99);
    expect(color).toHaveProperty('bg');
  });
});
