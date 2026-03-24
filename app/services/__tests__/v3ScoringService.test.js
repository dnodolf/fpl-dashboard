// Mock all dependencies of v3/core.js before importing
jest.mock('../playerArchetypeService.js', () => ({
  getPlayerArchetype: jest.fn(() => ({ archetype: 'standard', ratio: 1.0, source: 'default' }))
}));
jest.mock('../v3/conversionRatios.js', () => ({
  FALLBACK_CONVERSION_RATIOS: { GKP: 0.9, DEF: 1.15, MID: 1.05, FWD: 0.97 },
  getCalibrationAwareRatio: jest.fn((position) => {
    const ratios = { GKP: 0.9, DEF: 1.15, MID: 1.05, FWD: 0.97 };
    return ratios[position] || 1.0;
  })
}));
jest.mock('../v3/adjustments.js', () => ({
  applyPlayingTimeAdjustment: jest.fn(v => v),
  calculateFormMomentum: jest.fn(() => 1.0),
  calculateFixtureRunQuality: jest.fn(() => 1.0),
  calculateInjuryReturnAdjustment: jest.fn(() => 1.0)
}));
jest.mock('../v3/matchup.js', () => ({
  extractCurrentGameweekMatchup: jest.fn(() => null),
  calculateStartRecommendation: jest.fn(() => ({
    recommendation: 'START', label: '✅ Start', color: 'text-green-500',
    confidence: 'high', description: 'Good pick'
  })),
  calculateSingleGameweekMatchup: jest.fn(() => ({
    quality: 'favorable', label: '🟢 Easy', color: 'text-green-500',
    description: 'Easy fixture', opponent: 'ARS', opponentFull: 'Arsenal (H)',
    difficulty: 2, adjustedDifficulty: 2, isHome: true,
    predicted_points: 6, predicted_minutes: 90, source: 'ffh'
  }))
}));

import { calculateV3Prediction, applyV3Scoring, getScoringValue } from '../v3/core.js';

const GW = { number: 20 };

// ─── getScoringValue ─────────────────────────────────────────────────────────

describe('getScoringValue', () => {
  const player = {
    predicted_points: 100,
    season_prediction_avg: 5.0,
    current_gw_prediction: 6.0,
    v3_season_total: 110,
    v3_season_avg: 5.5,
    v3_current_gw: 6.3,
    v4_season_total: 108,
    v4_season_avg: 5.4,
  };

  describe('ffh mode', () => {
    it('season_total returns predicted_points', () => {
      expect(getScoringValue(player, 'season_total', 'ffh')).toBe(100);
    });
    it('points_ros returns predicted_points', () => {
      expect(getScoringValue(player, 'points_ros', 'ffh')).toBe(100);
    });
    it('season_avg returns season_prediction_avg', () => {
      expect(getScoringValue(player, 'season_avg', 'ffh')).toBe(5.0);
    });
    it('current_gw returns current_gw_prediction', () => {
      expect(getScoringValue(player, 'current_gw', 'ffh')).toBe(6.0);
    });
    it('returns 0 for missing fields', () => {
      expect(getScoringValue({}, 'season_total', 'ffh')).toBe(0);
    });
  });

  describe('v3 mode', () => {
    it('season_total returns v3_season_total', () => {
      expect(getScoringValue(player, 'season_total', 'v3')).toBe(110);
    });
    it('season_avg returns v3_season_avg', () => {
      expect(getScoringValue(player, 'season_avg', 'v3')).toBe(5.5);
    });
    it('current_gw returns v3_current_gw', () => {
      expect(getScoringValue(player, 'current_gw', 'v3')).toBe(6.3);
    });
    it('falls back to predicted_points when v3_season_total missing', () => {
      expect(getScoringValue({ predicted_points: 90 }, 'season_total', 'v3')).toBe(90);
    });
    it('returns 0 for missing fields', () => {
      expect(getScoringValue({}, 'season_total', 'v3')).toBe(0);
    });
  });

  describe('v4 mode', () => {
    it('season_total returns v4_season_total', () => {
      expect(getScoringValue(player, 'season_total', 'v4')).toBe(108);
    });
    it('season_avg returns v4_season_avg', () => {
      expect(getScoringValue(player, 'season_avg', 'v4')).toBe(5.4);
    });
    it('season_total falls back to v3_season_total when v4 missing', () => {
      const p = { v3_season_total: 110 };
      expect(getScoringValue(p, 'season_total', 'v4')).toBe(110);
    });
    it('season_total falls back to predicted_points when both v4 and v3 missing', () => {
      const p = { predicted_points: 100 };
      expect(getScoringValue(p, 'season_total', 'v4')).toBe(100);
    });
    it('returns 0 when all fields missing', () => {
      expect(getScoringValue({}, 'season_total', 'v4')).toBe(0);
    });
  });

  describe('default mode (no scoringMode arg)', () => {
    it('defaults to ffh behaviour', () => {
      expect(getScoringValue(player, 'season_total')).toBe(100);
    });
  });
});

// ─── calculateV3Prediction ───────────────────────────────────────────────────

describe('calculateV3Prediction', () => {
  const basePlayer = {
    name: 'Test Player',
    position: 'MID',
    predicted_points: 80,
    season_prediction_avg: 4.0,
    current_gw_prediction: 5.0,
    predictions: [
      { gw: 20, predicted_pts: 5 },
      { gw: 21, predicted_pts: 4 },
    ]
  };

  it('returns error object when currentGameweek has no number', async () => {
    // calculateV3Prediction catches errors internally and returns an error object
    const result = await calculateV3Prediction(basePlayer, {});
    expect(result.v3_calculation_source).toBe('error');
    expect(result.v3_season_total).toBe(0);
  });

  it('returns v3_season_total using archetype ratio * predicted_points (mocked ratio = 1.0)', async () => {
    const result = await calculateV3Prediction(basePlayer, GW);
    // Archetype mock returns ratio 1.0 when no calibrationData passed
    expect(result.v3_season_total).toBeCloseTo(80 * 1.0, 1);
  });

  it('embeds v3_pts on each prediction entry', async () => {
    const result = await calculateV3Prediction(basePlayer, GW);
    expect(result.predictions).toHaveLength(2);
    result.predictions.forEach(p => {
      expect(p).toHaveProperty('v3_pts');
      expect(typeof p.v3_pts).toBe('number');
    });
  });

  it('v3_pts = predicted_pts * ratio for each prediction', async () => {
    const result = await calculateV3Prediction(basePlayer, GW);
    // Archetype mock returns ratio 1.0
    expect(result.predictions[0].v3_pts).toBeCloseTo(5 * 1.0, 2);
    expect(result.predictions[1].v3_pts).toBeCloseTo(4 * 1.0, 2);
  });

  it('confidence is "high" when >= 15 predictions', async () => {
    const richPlayer = {
      ...basePlayer,
      predictions: Array.from({ length: 15 }, (_, i) => ({ gw: i + 1, predicted_pts: 4 }))
    };
    const result = await calculateV3Prediction(richPlayer, GW);
    expect(result.v3_confidence).toBe('high');
  });

  it('confidence is "medium" for 10-14 predictions', async () => {
    const medPlayer = {
      ...basePlayer,
      predictions: Array.from({ length: 10 }, (_, i) => ({ gw: i + 1, predicted_pts: 4 }))
    };
    const result = await calculateV3Prediction(medPlayer, GW);
    expect(result.v3_confidence).toBe('medium');
  });

  it('confidence is "low" for < 10 predictions', async () => {
    const result = await calculateV3Prediction(basePlayer, GW);
    expect(result.v3_confidence).toBe('low');
  });

  it('confidence is "none" when predicted_points is 0', async () => {
    const result = await calculateV3Prediction({ ...basePlayer, predicted_points: 0 }, GW);
    expect(result.v3_confidence).toBe('none');
  });

  it('falls back to MID ratio when position is null', async () => {
    const noPos = { ...basePlayer, position: null };
    const result = await calculateV3Prediction(noPos, GW);
    expect(result.v3_season_total).toBeGreaterThan(0);
  });

  it('handles player with no predictions array', async () => {
    const noPreds = { ...basePlayer, predictions: undefined };
    const result = await calculateV3Prediction(noPreds, GW);
    expect(result.predictions).toBeUndefined();
    expect(result.v3_season_total).toBeGreaterThanOrEqual(0);
  });
});

// ─── applyV3Scoring ──────────────────────────────────────────────────────────

describe('applyV3Scoring', () => {
  const players = [
    { name: 'P1', position: 'MID', predicted_points: 80, season_prediction_avg: 4, current_gw_prediction: 5, predictions: [] },
    { name: 'P2', position: 'DEF', predicted_points: 70, season_prediction_avg: 3.5, current_gw_prediction: 4, predictions: [] }
  ];

  it('returns array of same length', async () => {
    const result = await applyV3Scoring(players, GW);
    expect(result).toHaveLength(2);
  });

  it('all players have v3_season_total field', async () => {
    const result = await applyV3Scoring(players, GW);
    result.forEach(p => expect(p).toHaveProperty('v3_season_total'));
  });

  it('all players have v3_enhanced flag', async () => {
    const result = await applyV3Scoring(players, GW);
    result.forEach(p => expect(p.v3_enhanced).toBe(true));
  });

  it('rejects when currentGameweek is null', async () => {
    await expect(applyV3Scoring(players, null)).rejects.toThrow('currentGameweek is required');
  });

  it('rejects when currentGameweek has no number', async () => {
    await expect(applyV3Scoring(players, {})).rejects.toThrow('currentGameweek is required');
  });

  it('returns players unchanged when input is not an array', async () => {
    const result = await applyV3Scoring('not-an-array', GW);
    expect(result).toBe('not-an-array');
  });

  it('handles empty players array', async () => {
    const result = await applyV3Scoring([], GW);
    expect(result).toEqual([]);
  });
});
