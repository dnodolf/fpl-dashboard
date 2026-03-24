import { getGameweekStatusStyles } from '../gameweekStyles.js';

const REQUIRED_KEYS = ['icon', 'bg', 'hover', 'text', 'subText'];

describe('getGameweekStatusStyles', () => {
  it.each(['upcoming', 'live', 'completed'])(
    'returns an object with all required keys for "%s"',
    (status) => {
      const styles = getGameweekStatusStyles(status);
      REQUIRED_KEYS.forEach(key => expect(styles).toHaveProperty(key));
    }
  );

  it('upcoming uses blue theme', () => {
    const s = getGameweekStatusStyles('upcoming');
    expect(s.icon).toBe('🏁');
    expect(s.bg).toContain('blue');
    expect(s.text).toContain('blue');
  });

  it('live uses red theme', () => {
    const s = getGameweekStatusStyles('live');
    expect(s.icon).toBe('🔴');
    expect(s.bg).toContain('red');
    expect(s.text).toContain('red');
  });

  it('completed uses green theme', () => {
    const s = getGameweekStatusStyles('completed');
    expect(s.icon).toBe('✅');
    expect(s.bg).toContain('green');
    expect(s.text).toContain('green');
  });

  it('returns gray default for unknown status', () => {
    const s = getGameweekStatusStyles('unknown');
    expect(s.icon).toBe('⚽');
    expect(s.bg).toContain('gray');
  });

  it('returns gray default for null', () => {
    const s = getGameweekStatusStyles(null);
    REQUIRED_KEYS.forEach(key => expect(s).toHaveProperty(key));
    expect(s.bg).toContain('gray');
  });

  it('returns gray default for undefined', () => {
    const s = getGameweekStatusStyles(undefined);
    expect(s.bg).toContain('gray');
  });

  it('does not mutate the styles object across calls', () => {
    const a = getGameweekStatusStyles('live');
    const b = getGameweekStatusStyles('live');
    expect(a).toEqual(b);
    expect(a).not.toBe(b); // different object references
  });
});
