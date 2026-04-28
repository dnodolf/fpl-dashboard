import {
  applyPlayingTimeAdjustment,
  calculateFormMomentum,
  calculateFixtureRunQuality,
  calculateInjuryReturnAdjustment,
} from '../v3/adjustments.js';

// ─── applyPlayingTimeAdjustment ──────────────────────────────────────────────

describe('applyPlayingTimeAdjustment', () => {
  it('applies 0.7x when expectedMinutes is null', () => {
    expect(applyPlayingTimeAdjustment(10, null)).toBeCloseTo(7);
  });

  it('applies 0.7x when expectedMinutes is 0', () => {
    expect(applyPlayingTimeAdjustment(10, 0)).toBeCloseTo(7);
  });

  it('applies 0.4x for < 30 minutes', () => {
    expect(applyPlayingTimeAdjustment(10, 20)).toBeCloseTo(4);
  });

  it('applies 0.75x for 30-59 minutes', () => {
    expect(applyPlayingTimeAdjustment(10, 45)).toBeCloseTo(7.5);
  });

  it('applies 0.90x for 60-74 minutes', () => {
    expect(applyPlayingTimeAdjustment(10, 65)).toBeCloseTo(9);
  });

  it('no reduction for 75+ minutes', () => {
    expect(applyPlayingTimeAdjustment(10, 90)).toBeCloseTo(10);
  });

  it('no reduction exactly at 75 minutes', () => {
    expect(applyPlayingTimeAdjustment(8, 75)).toBeCloseTo(8);
  });
});

// ─── calculateFormMomentum ───────────────────────────────────────────────────

describe('calculateFormMomentum', () => {
  it('returns multiplier 1.0 when predictions array is missing', () => {
    const result = calculateFormMomentum({ season_prediction_avg: 4 }, 20);
    expect(result.multiplier).toBe(1.0);
    expect(result.source).toBe('insufficient_data');
  });

  it('returns multiplier 1.0 when fewer than 3 predictions', () => {
    const player = { season_prediction_avg: 4, predictions: [{ gw: 18, predicted_pts: 5 }] };
    const result = calculateFormMomentum(player, 20);
    expect(result.multiplier).toBe(1.0);
  });

  it('returns multiplier 1.0 when season avg is 0', () => {
    const player = {
      season_prediction_avg: 0,
      predictions: [
        { gw: 17, predicted_pts: 5 }, { gw: 18, predicted_pts: 4 }, { gw: 19, predicted_pts: 6 }
      ]
    };
    const result = calculateFormMomentum(player, 20);
    expect(result.multiplier).toBe(1.0);
    expect(result.source).toBe('no_season_avg');
  });

  it('returns multiplier 1.0 when fewer than 2 recent GWs', () => {
    const player = {
      season_prediction_avg: 4,
      predictions: [
        { gw: 5, predicted_pts: 5 }, { gw: 6, predicted_pts: 4 }, { gw: 7, predicted_pts: 6 }
      ]
    };
    // currentGameweek=20, so looks at gw 17-19 — none exist
    const result = calculateFormMomentum(player, 20);
    expect(result.multiplier).toBe(1.0);
    expect(result.source).toBe('insufficient_recent_data');
  });

  it('returns "hot" trend when recent avg is above season avg', () => {
    const player = {
      season_prediction_avg: 3,
      predictions: [
        { gw: 17, predicted_pts: 6 }, { gw: 18, predicted_pts: 7 }, { gw: 19, predicted_pts: 8 }
      ]
    };
    const result = calculateFormMomentum(player, 20);
    expect(result.trend).toBe('hot');
    expect(result.multiplier).toBeGreaterThan(1.0);
    expect(result.multiplier).toBeLessThanOrEqual(1.2);
  });

  it('returns "cold" trend when recent avg is below season avg', () => {
    const player = {
      season_prediction_avg: 6,
      predictions: [
        { gw: 17, predicted_pts: 1 }, { gw: 18, predicted_pts: 2 }, { gw: 19, predicted_pts: 1 }
      ]
    };
    const result = calculateFormMomentum(player, 20);
    expect(result.trend).toBe('cold');
    expect(result.multiplier).toBeLessThan(1.0);
    expect(result.multiplier).toBeGreaterThanOrEqual(0.8);
  });

  it('caps multiplier at 1.2 (max)', () => {
    const player = {
      season_prediction_avg: 1,
      predictions: [
        { gw: 17, predicted_pts: 100 }, { gw: 18, predicted_pts: 100 }, { gw: 19, predicted_pts: 100 }
      ]
    };
    const result = calculateFormMomentum(player, 20);
    expect(result.multiplier).toBe(1.2);
  });

  it('caps multiplier at 0.8 (min)', () => {
    const player = {
      season_prediction_avg: 100,
      predictions: [
        { gw: 17, predicted_pts: 1 }, { gw: 18, predicted_pts: 1 }, { gw: 19, predicted_pts: 1 }
      ]
    };
    const result = calculateFormMomentum(player, 20);
    expect(result.multiplier).toBe(0.8);
  });

  it('result includes recentAvg, seasonAvg, gameweeksUsed', () => {
    const player = {
      season_prediction_avg: 4,
      predictions: [
        { gw: 17, predicted_pts: 4 }, { gw: 18, predicted_pts: 4 }, { gw: 19, predicted_pts: 4 }
      ]
    };
    const result = calculateFormMomentum(player, 20);
    expect(result).toHaveProperty('recentAvg');
    expect(result).toHaveProperty('seasonAvg');
    expect(result).toHaveProperty('gameweeksUsed');
    expect(result.source).toBe('calculated');
  });
});

// ─── calculateFixtureRunQuality ───────────────────────────────────────────────

describe('calculateFixtureRunQuality', () => {
  it('returns multiplier 1.0 when predictions is missing', () => {
    const result = calculateFixtureRunQuality({ season_prediction_avg: 4 }, 20);
    expect(result.multiplier).toBe(1.0);
    expect(result.source).toBe('insufficient_data');
  });

  it('returns multiplier 1.0 when season avg is 0', () => {
    const player = {
      season_prediction_avg: 0,
      predictions: [{ gw: 20, predicted_pts: 5 }, { gw: 21, predicted_pts: 5 }, { gw: 22, predicted_pts: 5 }]
    };
    const result = calculateFixtureRunQuality(player, 20);
    expect(result.multiplier).toBe(1.0);
    expect(result.source).toBe('no_season_avg');
  });

  it('returns multiplier 1.0 when fewer than 3 upcoming GWs', () => {
    // Must have >= 3 total predictions to pass the first guard, but < 3 upcoming
    const player = {
      season_prediction_avg: 4,
      predictions: [
        { gw: 15, predicted_pts: 4 }, { gw: 16, predicted_pts: 4 }, { gw: 17, predicted_pts: 4 },
        { gw: 20, predicted_pts: 5 }, { gw: 21, predicted_pts: 5 }
      ]
    };
    const result = calculateFixtureRunQuality(player, 20);
    expect(result.multiplier).toBe(1.0);
    expect(result.source).toBe('insufficient_upcoming_data');
  });

  it('rates "favorable" when upcoming avg beats season avg', () => {
    const player = {
      season_prediction_avg: 3,
      predictions: [
        { gw: 20, predicted_pts: 7 }, { gw: 21, predicted_pts: 7 }, { gw: 22, predicted_pts: 7 }
      ]
    };
    const result = calculateFixtureRunQuality(player, 20);
    expect(result.rating).toBe('favorable');
    expect(result.multiplier).toBeGreaterThan(1.0);
    expect(result.multiplier).toBeLessThanOrEqual(1.08);
  });

  it('rates "difficult" when upcoming avg trails season avg', () => {
    const player = {
      season_prediction_avg: 8,
      predictions: [
        { gw: 20, predicted_pts: 1 }, { gw: 21, predicted_pts: 1 }, { gw: 22, predicted_pts: 1 }
      ]
    };
    const result = calculateFixtureRunQuality(player, 20);
    expect(result.rating).toBe('difficult');
    expect(result.multiplier).toBeLessThan(1.0);
    expect(result.multiplier).toBeGreaterThanOrEqual(0.92);
  });

  it('caps multiplier at 1.08 (max)', () => {
    const player = {
      season_prediction_avg: 1,
      predictions: Array.from({ length: 6 }, (_, i) => ({ gw: 20 + i, predicted_pts: 100 }))
    };
    const result = calculateFixtureRunQuality(player, 20);
    expect(result.multiplier).toBe(1.08);
  });
});

// ─── calculateInjuryReturnAdjustment ─────────────────────────────────────────

describe('calculateInjuryReturnAdjustment', () => {
  it('returns healthy/no_injury_data for player with no injury info', () => {
    const player = { injury_status: '', news: '', predictions: [] };
    const result = calculateInjuryReturnAdjustment(player, 20);
    expect(result.multiplier).toBe(1.0);
    expect(result.status).toBe('healthy');
  });

  it('returns 0.5x multiplier for currently injured player', () => {
    const player = {
      injury_status: 'injured',
      news: 'out for 3 weeks',
      predictions: [{ gw: 19, predicted_mins: 90 }]
    };
    const result = calculateInjuryReturnAdjustment(player, 20);
    expect(result.multiplier).toBe(0.5);
    expect(result.status).toBe('injured');
  });

  it('returns multiplier 1.0 for injured player with no predictions', () => {
    const player = { injury_status: 'injured', news: '', predictions: [] };
    const result = calculateInjuryReturnAdjustment(player, 20);
    expect(result.multiplier).toBe(1.0);
    expect(result.status).toBe('unknown');
  });

  it('applies graduated recovery for returning player (week 1)', () => {
    // Use non-zero low value: source code uses `predicted_mins || xmins || 90`
    // so 0 is treated as falsy and falls through to 90
    const player = {
      injury_status: 'injured',
      news: 'recovered and available',
      predictions: [
        { gw: 17, predicted_mins: 5 },
        { gw: 18, predicted_mins: 5 },
        { gw: 19, predicted_mins: 5 }
      ]
    };
    const result = calculateInjuryReturnAdjustment(player, 20);
    expect(result.status).toBe('returning');
    expect([0.70, 0.85, 0.95, 1.00]).toContain(result.multiplier);
  });

  it('returns healthy when no injury keywords present', () => {
    const player = {
      injury_status: 'fit',
      news: 'training fully',
      predictions: [{ gw: 19, predicted_mins: 90 }]
    };
    const result = calculateInjuryReturnAdjustment(player, 20);
    expect(result.multiplier).toBe(1.0);
  });
});
