import {
  getNextNGameweeksTotal,
  getAvgMinutesNextN,
  getNextNGameweeksDetails
} from '../predictionUtils.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

function makePlayer(predictions) {
  return { predictions };
}

function makePred(gw, predicted_pts, { v3_pts, v4_pts, xmins } = {}) {
  return { gw, predicted_pts, ...(v3_pts !== undefined && { v3_pts }), ...(v4_pts !== undefined && { v4_pts }), ...(xmins !== undefined && { xmins }) };
}

// ─── getNextNGameweeksTotal ──────────────────────────────────────────────────

describe('getNextNGameweeksTotal', () => {
  const player = makePlayer([
    makePred(10, 5, { v3_pts: 6, v4_pts: 5.75 }),
    makePred(11, 4, { v3_pts: 5, v4_pts: 4.5 }),
    makePred(12, 3, { v3_pts: 3.5, v4_pts: 3.25 }),
    makePred(13, 6, { v3_pts: 7, v4_pts: 6.5 }),
    makePred(14, 2, { v3_pts: 2.5, v4_pts: 2.25 }),
  ]);

  describe('ffh mode', () => {
    it('sums predicted_pts for next 5 GWs', () => {
      expect(getNextNGameweeksTotal(player, 'ffh', 10, 5)).toBe(20);
    });

    it('sums predicted_pts for next 1 GW', () => {
      expect(getNextNGameweeksTotal(player, 'ffh', 10, 1)).toBe(5);
    });

    it('sums predicted_pts for next 3 GWs', () => {
      expect(getNextNGameweeksTotal(player, 'ffh', 10, 3)).toBe(12);
    });
  });

  describe('v3 mode', () => {
    it('uses v3_pts when available', () => {
      expect(getNextNGameweeksTotal(player, 'v3', 10, 2)).toBe(11); // 6 + 5
    });

    it('falls back to predicted_pts when v3_pts missing', () => {
      const noV3 = makePlayer([makePred(10, 5), makePred(11, 4)]);
      expect(getNextNGameweeksTotal(noV3, 'v3', 10, 2)).toBe(9);
    });
  });

  describe('v4 mode', () => {
    it('uses v4_pts when available', () => {
      expect(getNextNGameweeksTotal(player, 'v4', 10, 2)).toBeCloseTo(10.25); // 5.75 + 4.5
    });

    it('falls back to v3_pts when v4_pts missing', () => {
      const noV4 = makePlayer([makePred(10, 5, { v3_pts: 6 })]);
      expect(getNextNGameweeksTotal(noV4, 'v4', 10, 1)).toBe(6);
    });

    it('falls back to predicted_pts when both v4_pts and v3_pts missing', () => {
      const bare = makePlayer([makePred(10, 5)]);
      expect(getNextNGameweeksTotal(bare, 'v4', 10, 1)).toBe(5);
    });
  });

  describe('edge cases', () => {
    it('returns 0 when player has no predictions', () => {
      expect(getNextNGameweeksTotal(makePlayer([]), 'ffh', 10, 5)).toBe(0);
    });

    it('returns 0 when player is null', () => {
      expect(getNextNGameweeksTotal(null, 'ffh', 10, 5)).toBe(0);
    });

    it('returns 0 when currentGW is null', () => {
      expect(getNextNGameweeksTotal(player, 'ffh', null, 5)).toBe(0);
    });

    it('returns 0 when currentGW is undefined', () => {
      expect(getNextNGameweeksTotal(player, 'ffh', undefined, 5)).toBe(0);
    });

    it('skips missing GWs in sparse predictions array', () => {
      const sparse = makePlayer([makePred(10, 5), makePred(12, 3)]); // GW11 missing
      // Asking for GW10-12 (3 GWs): only GW10 (5) and GW12 (3) found
      expect(getNextNGameweeksTotal(sparse, 'ffh', 10, 3)).toBe(8);
    });

    it('returns 0 when currentGW is beyond all predictions', () => {
      expect(getNextNGameweeksTotal(player, 'ffh', 39, 5)).toBe(0);
    });

    it('handles mid-season start (GW38 with 1 GW)', () => {
      const endSeason = makePlayer([makePred(38, 4.5)]);
      expect(getNextNGameweeksTotal(endSeason, 'ffh', 38, 1)).toBe(4.5);
    });
  });
});

// ─── getAvgMinutesNextN ──────────────────────────────────────────────────────

describe('getAvgMinutesNextN', () => {
  const player = makePlayer([
    makePred(10, 5, { xmins: 90 }),
    makePred(11, 4, { xmins: 60 }),
    makePred(12, 3, { xmins: 45 }),
  ]);

  it('calculates average xmins over N GWs', () => {
    expect(getAvgMinutesNextN(player, 10, 3)).toBe(65); // (90+60+45)/3
  });

  it('calculates average for 1 GW', () => {
    expect(getAvgMinutesNextN(player, 10, 1)).toBe(90);
  });

  it('skips GWs with no xmins field', () => {
    const sparse = makePlayer([makePred(10, 5, { xmins: 90 }), makePred(11, 4)]);
    // GW11 has no xmins — only GW10 counted
    expect(getAvgMinutesNextN(sparse, 10, 2)).toBe(90);
  });

  it('counts zero xmins (benched) in average', () => {
    const benched = makePlayer([
      makePred(10, 5, { xmins: 0 }),
      makePred(11, 4, { xmins: 90 }),
    ]);
    expect(getAvgMinutesNextN(benched, 10, 2)).toBe(45); // (0+90)/2
  });

  it('returns 0 when no predictions', () => {
    expect(getAvgMinutesNextN(makePlayer([]), 10, 5)).toBe(0);
  });

  it('returns 0 when player is null', () => {
    expect(getAvgMinutesNextN(null, 10, 5)).toBe(0);
  });

  it('returns 0 when currentGW is null', () => {
    expect(getAvgMinutesNextN(player, null, 5)).toBe(0);
  });

  it('returns 0 when all target GWs have no xmins', () => {
    const noMins = makePlayer([makePred(10, 5), makePred(11, 4)]);
    expect(getAvgMinutesNextN(noMins, 10, 2)).toBe(0);
  });
});

// ─── getNextNGameweeksDetails ────────────────────────────────────────────────

describe('getNextNGameweeksDetails', () => {
  const opp = [['ARS', 'Arsenal (H)', 4]];
  const player = makePlayer([
    makePred(10, 5, { v3_pts: 6, xmins: 90 }),
    makePred(11, 4, { v3_pts: 5, xmins: 60 }),
  ]);

  it('returns array with gw, points, minutes, opponent', () => {
    const details = getNextNGameweeksDetails(player, 'ffh', 10, 2);
    expect(details).toHaveLength(2);
    expect(details[0]).toMatchObject({ gw: 10, points: 5, minutes: 90 });
    expect(details[1]).toMatchObject({ gw: 11, points: 4, minutes: 60 });
  });

  it('points reflect v3 scoring mode', () => {
    const details = getNextNGameweeksDetails(player, 'v3', 10, 1);
    expect(details[0].points).toBe(6);
  });

  it('returns empty array when no predictions', () => {
    expect(getNextNGameweeksDetails(makePlayer([]), 'ffh', 10, 5)).toEqual([]);
  });

  it('returns empty array when player is null', () => {
    expect(getNextNGameweeksDetails(null, 'ffh', 10, 5)).toEqual([]);
  });

  it('skips missing GWs', () => {
    const sparse = makePlayer([makePred(10, 5, { xmins: 90 })]); // GW11 missing
    const details = getNextNGameweeksDetails(sparse, 'ffh', 10, 2);
    expect(details).toHaveLength(1);
    expect(details[0].gw).toBe(10);
  });

  it('opponent is null when prediction has no opp', () => {
    const details = getNextNGameweeksDetails(player, 'ffh', 10, 1);
    expect(details[0].opponent).toBeNull();
  });

  it('opponent is populated when prediction has opp', () => {
    const withOpp = makePlayer([{ gw: 10, predicted_pts: 5, xmins: 90, opp }]);
    const details = getNextNGameweeksDetails(withOpp, 'ffh', 10, 1);
    expect(details[0].opponent).toEqual(opp);
  });
});
