import {
  normalizePosition,
  mapSleeperPosition,
  getPositionDisplayInfo,
  getSleeperPositionBadgeClasses,
  getSleeperPositionStyle,
  isValidPosition,
} from '../positionUtils.js';

// ─── mapSleeperPosition ───────────────────────────────────────────────────────

describe('mapSleeperPosition', () => {
  it('returns MID for null/undefined', () => {
    expect(mapSleeperPosition(null)).toBe('MID');
    expect(mapSleeperPosition(undefined)).toBe('MID');
  });

  it('maps GK and G to GKP', () => {
    expect(mapSleeperPosition('GK')).toBe('GKP');
    expect(mapSleeperPosition('G')).toBe('GKP');
    expect(mapSleeperPosition('gk')).toBe('GKP');
  });

  it('maps D and DEF to DEF', () => {
    expect(mapSleeperPosition('D')).toBe('DEF');
    expect(mapSleeperPosition('DEF')).toBe('DEF');
    expect(mapSleeperPosition('def')).toBe('DEF');
  });

  it('maps M and MID to MID', () => {
    expect(mapSleeperPosition('M')).toBe('MID');
    expect(mapSleeperPosition('MID')).toBe('MID');
    expect(mapSleeperPosition('mid')).toBe('MID');
  });

  it('maps F and FWD to FWD', () => {
    expect(mapSleeperPosition('F')).toBe('FWD');
    expect(mapSleeperPosition('FWD')).toBe('FWD');
    expect(mapSleeperPosition('fwd')).toBe('FWD');
  });

  it('maps full position names', () => {
    expect(mapSleeperPosition('GOALKEEPER')).toBe('GKP');
    expect(mapSleeperPosition('DEFENDER')).toBe('DEF');
    expect(mapSleeperPosition('MIDFIELDER')).toBe('MID');
    expect(mapSleeperPosition('FORWARD')).toBe('FWD');
    expect(mapSleeperPosition('ATTACKER')).toBe('FWD');
  });

  it('returns UNKNOWN for unrecognized position', () => {
    expect(mapSleeperPosition('XYZ')).toBe('UNKNOWN');
  });

  it('trims whitespace before mapping', () => {
    expect(mapSleeperPosition('  GK  ')).toBe('GKP');
  });
});

// ─── normalizePosition ────────────────────────────────────────────────────────

describe('normalizePosition', () => {
  it('uses fantasy_positions[0] as highest priority', () => {
    const player = { fantasy_positions: ['GK'], position: 'MID' };
    expect(normalizePosition(player)).toBe('GKP');
  });

  it('falls back to position string when fantasy_positions absent', () => {
    const player = { position: 'DEF' };
    expect(normalizePosition(player)).toBe('DEF');
  });

  it('falls back to position_id when no Sleeper data', () => {
    expect(normalizePosition({ position_id: 1 })).toBe('GKP');
    expect(normalizePosition({ position_id: 2 })).toBe('DEF');
    expect(normalizePosition({ position_id: 3 })).toBe('MID');
    expect(normalizePosition({ position_id: 4 })).toBe('FWD');
  });

  it('defaults to MID when no position data at all', () => {
    expect(normalizePosition({})).toBe('MID');
  });

  it('ignores empty fantasy_positions array', () => {
    const player = { fantasy_positions: [], position: 'FWD' };
    expect(normalizePosition(player)).toBe('FWD');
  });

  it('does not throw when debugLog is true', () => {
    expect(() => normalizePosition({ name: 'Test', fantasy_positions: ['GK'] }, true)).not.toThrow();
  });

  it('position_id unknown value defaults to MID', () => {
    expect(normalizePosition({ position_id: 99 })).toBe('MID');
  });
});

// ─── getPositionDisplayInfo ───────────────────────────────────────────────────

describe('getPositionDisplayInfo', () => {
  it('returns correct label and hex for GKP', () => {
    const info = getPositionDisplayInfo('GKP');
    expect(info.label).toBe('GKP');
    expect(info.hex).toBe('#f0be4d');
  });

  it('returns correct info for DEF, MID, FWD', () => {
    expect(getPositionDisplayInfo('DEF').label).toBe('DEF');
    expect(getPositionDisplayInfo('MID').label).toBe('MID');
    expect(getPositionDisplayInfo('FWD').label).toBe('FWD');
  });

  it('returns fallback for unknown position', () => {
    const info = getPositionDisplayInfo('XYZ');
    expect(info.label).toBe('XYZ');
    expect(info.color).toBe('gray');
    expect(info.hex).toBe('#6b7280');
  });

  it('returns fallback with "UNK" for null/undefined', () => {
    const info = getPositionDisplayInfo(null);
    expect(info.label).toBe('UNK');
  });
});

// ─── getSleeperPositionBadgeClasses ──────────────────────────────────────────

describe('getSleeperPositionBadgeClasses', () => {
  it('returns yellow badge for GKP', () => {
    expect(getSleeperPositionBadgeClasses('GKP')).toContain('yellow');
  });

  it('returns same yellow for GK alias', () => {
    expect(getSleeperPositionBadgeClasses('GK')).toContain('yellow');
  });

  it('returns cyan badge for DEF', () => {
    expect(getSleeperPositionBadgeClasses('DEF')).toContain('cyan');
  });

  it('returns pink badge for MID', () => {
    expect(getSleeperPositionBadgeClasses('MID')).toContain('pink');
  });

  it('returns purple badge for FWD', () => {
    expect(getSleeperPositionBadgeClasses('FWD')).toContain('purple');
  });

  it('returns gray for unknown position', () => {
    expect(getSleeperPositionBadgeClasses('XYZ')).toContain('gray');
  });
});

// ─── getSleeperPositionStyle ──────────────────────────────────────────────────

describe('getSleeperPositionStyle', () => {
  it('returns correct backgroundColor for GKP', () => {
    const style = getSleeperPositionStyle('GKP');
    expect(style.backgroundColor).toBe('#eab308');
    expect(style.color).toBe('#000000');
  });

  it('returns correct backgroundColor for DEF', () => {
    const style = getSleeperPositionStyle('DEF');
    expect(style.backgroundColor).toBe('#06b6d4');
  });

  it('returns correct backgroundColor for MID', () => {
    const style = getSleeperPositionStyle('MID');
    expect(style.backgroundColor).toBe('#ec4899');
    expect(style.color).toBe('#ffffff');
  });

  it('returns correct backgroundColor for FWD', () => {
    const style = getSleeperPositionStyle('FWD');
    expect(style.backgroundColor).toBe('#a855f7');
  });

  it('returns gray fallback for unknown position', () => {
    const style = getSleeperPositionStyle('XYZ');
    expect(style.backgroundColor).toBe('#6b7280');
  });

  it('result always has backgroundColor, color, borderColor', () => {
    ['GKP', 'DEF', 'MID', 'FWD', 'UNKNOWN'].forEach(pos => {
      const style = getSleeperPositionStyle(pos);
      expect(style).toHaveProperty('backgroundColor');
      expect(style).toHaveProperty('color');
      expect(style).toHaveProperty('borderColor');
    });
  });
});

// ─── isValidPosition ──────────────────────────────────────────────────────────

describe('isValidPosition', () => {
  it('returns true for GKP, DEF, MID, FWD', () => {
    ['GKP', 'DEF', 'MID', 'FWD'].forEach(pos => expect(isValidPosition(pos)).toBe(true));
  });

  it('returns false for lowercase and aliases', () => {
    expect(isValidPosition('gkp')).toBe(false);
    expect(isValidPosition('GK')).toBe(false);
    expect(isValidPosition('D')).toBe(false);
  });

  it('returns false for unknown positions', () => {
    expect(isValidPosition('XYZ')).toBe(false);
    expect(isValidPosition('')).toBe(false);
    expect(isValidPosition(null)).toBe(false);
    expect(isValidPosition(undefined)).toBe(false);
  });
});
