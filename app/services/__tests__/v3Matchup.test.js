import {
  extractCurrentGameweekMatchup,
  calculateStartRecommendation,
  calculateSingleGameweekMatchup,
} from '../v3/matchup.js';

// ─── extractCurrentGameweekMatchup ───────────────────────────────────────────

describe('extractCurrentGameweekMatchup', () => {
  it('returns hasMatchup:false when player has no predictions', () => {
    const result = extractCurrentGameweekMatchup({}, 20);
    expect(result.hasMatchup).toBe(false);
    expect(result.opponent).toBe('TBD');
    expect(result.source).toBe('no_predictions');
  });

  it('returns hasMatchup:false when current GW prediction is absent', () => {
    const player = { predictions: [{ gw: 19, predicted_pts: 4 }] };
    const result = extractCurrentGameweekMatchup(player, 20);
    expect(result.hasMatchup).toBe(false);
    expect(result.source).toBe('no_current_gw_prediction');
  });

  it('returns TBD when current GW prediction has no opp data', () => {
    const player = { predictions: [{ gw: 20, predicted_pts: 5 }] };
    const result = extractCurrentGameweekMatchup(player, 20);
    expect(result.hasMatchup).toBe(true);
    expect(result.opponent).toBe('TBD');
    expect(result.source).toBe('ffh_predictions');
  });

  it('extracts opponent from nested opp array', () => {
    const player = {
      predictions: [{ gw: 20, predicted_pts: 6, opp: [['MCI', 'Man City (A)', 5]] }]
    };
    const result = extractCurrentGameweekMatchup(player, 20);
    expect(result.hasMatchup).toBe(true);
    expect(result.opponent).toBe('MCI');
    expect(result.difficulty).toBe(5);
    expect(result.isHome).toBe(false);
  });

  it('detects home fixture via (H) suffix', () => {
    const player = {
      predictions: [{ gw: 20, predicted_pts: 6, opp: [['ARS', 'Arsenal (H)', 2]] }]
    };
    const result = extractCurrentGameweekMatchup(player, 20);
    expect(result.isHome).toBe(true);
    expect(result.opponent).toBe('ARS');
  });

  it('uppercases opponent code', () => {
    const player = {
      predictions: [{ gw: 20, predicted_pts: 4, opp: [['liv', 'Liverpool (A)', 4]] }]
    };
    const result = extractCurrentGameweekMatchup(player, 20);
    expect(result.opponent).toBe('LIV');
  });

  it('includes predicted_points and predicted_minutes in result', () => {
    const player = {
      predictions: [{ gw: 20, predicted_pts: 7, xmins: 90, opp: [['TOT', 'Tottenham (H)', 3]] }]
    };
    const result = extractCurrentGameweekMatchup(player, 20);
    expect(result.predicted_points).toBe(7);
    expect(result.predicted_minutes).toBe(90);
  });
});

// ─── calculateStartRecommendation ────────────────────────────────────────────

describe('calculateStartRecommendation', () => {
  describe('MID thresholds', () => {
    it('MUST_START at >= 6 pts', () => {
      expect(calculateStartRecommendation(7, 'MID').recommendation).toBe('MUST_START');
    });
    it('SAFE_START at >= 4 pts', () => {
      expect(calculateStartRecommendation(5, 'MID').recommendation).toBe('SAFE_START');
    });
    it('FLEX at >= 3 pts', () => {
      expect(calculateStartRecommendation(3.5, 'MID').recommendation).toBe('FLEX');
    });
    it('BENCH below 3 pts', () => {
      expect(calculateStartRecommendation(2, 'MID').recommendation).toBe('BENCH');
    });
  });

  describe('GKP thresholds', () => {
    it('MUST_START at >= 4.5 pts', () => {
      expect(calculateStartRecommendation(5, 'GKP').recommendation).toBe('MUST_START');
    });
    it('BENCH below 2 pts', () => {
      expect(calculateStartRecommendation(1, 'GKP').recommendation).toBe('BENCH');
    });
  });

  describe('DEF thresholds', () => {
    it('MUST_START at >= 5 pts', () => {
      expect(calculateStartRecommendation(5.5, 'DEF').recommendation).toBe('MUST_START');
    });
  });

  describe('FWD thresholds', () => {
    it('MUST_START at >= 6.5 pts', () => {
      expect(calculateStartRecommendation(7, 'FWD').recommendation).toBe('MUST_START');
    });
    it('BENCH below 3.5 pts', () => {
      expect(calculateStartRecommendation(2, 'FWD').recommendation).toBe('BENCH');
    });
  });

  it('result includes label, color, confidence, description', () => {
    const result = calculateStartRecommendation(5, 'MID');
    expect(result).toHaveProperty('label');
    expect(result).toHaveProperty('color');
    expect(result).toHaveProperty('confidence');
    expect(result).toHaveProperty('description');
  });

  it('description includes formatted points value', () => {
    const result = calculateStartRecommendation(4.567, 'MID');
    expect(result.description).toContain('4.6');
  });
});

// ─── calculateSingleGameweekMatchup ──────────────────────────────────────────

describe('calculateSingleGameweekMatchup', () => {
  it('returns quality "unknown" when player has no matchup data', () => {
    const result = calculateSingleGameweekMatchup({}, 20);
    expect(result.quality).toBe('unknown');
    expect(result.source).toBe('no_data');
  });

  it('returns smash_spot for adjustedDifficulty <= 2', () => {
    const player = {
      predictions: [{ gw: 20, predicted_pts: 7, opp: [['NOR', 'Norwich (H)', 1]] }]
    };
    const result = calculateSingleGameweekMatchup(player, 20);
    // Home gives -0.5, so difficulty 1 → adjusted 0.5 → smash_spot
    expect(result.quality).toBe('smash_spot');
  });

  it('returns avoid for adjustedDifficulty > 4.2', () => {
    const player = {
      predictions: [{ gw: 20, predicted_pts: 2, opp: [['MCI', 'Man City (A)', 5]] }]
    };
    const result = calculateSingleGameweekMatchup(player, 20);
    // Away gives +0.3, so difficulty 5 → adjusted 5.3 → avoid
    expect(result.quality).toBe('avoid');
  });

  it('includes source:calculated for valid matchup', () => {
    const player = {
      predictions: [{ gw: 20, predicted_pts: 5, opp: [['EVE', 'Everton (H)', 3]] }]
    };
    const result = calculateSingleGameweekMatchup(player, 20);
    expect(result.source).toBe('calculated');
  });

  it('result includes all required fields', () => {
    const player = {
      predictions: [{ gw: 20, predicted_pts: 5, opp: [['BHA', 'Brighton (A)', 3]] }]
    };
    const result = calculateSingleGameweekMatchup(player, 20);
    ['quality', 'label', 'color', 'description', 'opponent', 'difficulty', 'adjustedDifficulty', 'isHome'].forEach(
      key => expect(result).toHaveProperty(key)
    );
  });

  it('home advantage reduces effective difficulty', () => {
    const homePlayer = {
      predictions: [{ gw: 20, predicted_pts: 4, opp: [['CHE', 'Chelsea (H)', 4]] }]
    };
    const awayPlayer = {
      predictions: [{ gw: 20, predicted_pts: 4, opp: [['CHE', 'Chelsea (A)', 4]] }]
    };
    const homeResult = calculateSingleGameweekMatchup(homePlayer, 20);
    const awayResult = calculateSingleGameweekMatchup(awayPlayer, 20);
    expect(homeResult.adjustedDifficulty).toBeLessThan(awayResult.adjustedDifficulty);
  });
});
