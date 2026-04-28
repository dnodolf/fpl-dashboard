import { timeAgo, getFPLStatusBadge } from '../newsUtils.js';

// ─── timeAgo ────────────────────────────────────────────────────────────────

describe('timeAgo', () => {
  // Fix "now" to a stable point for all tests
  const NOW = new Date('2026-03-23T12:00:00Z');

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns empty string for null', () => {
    expect(timeAgo(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(timeAgo(undefined)).toBe('');
  });

  it('returns empty string for empty string', () => {
    expect(timeAgo('')).toBe('');
  });

  it('returns empty string for future timestamps', () => {
    const future = new Date(NOW.getTime() + 60_000).toISOString();
    expect(timeAgo(future)).toBe('');
  });

  it('returns "just now" for < 1 minute ago', () => {
    const ts = new Date(NOW.getTime() - 30_000).toISOString(); // 30 seconds
    expect(timeAgo(ts)).toBe('just now');
  });

  it('returns "just now" for exactly 0 ms diff', () => {
    expect(timeAgo(NOW.toISOString())).toBe('just now');
  });

  it('returns minutes ago for 1-59 minutes', () => {
    const ts1 = new Date(NOW.getTime() - 1 * 60_000).toISOString();
    expect(timeAgo(ts1)).toBe('1m ago');

    const ts30 = new Date(NOW.getTime() - 30 * 60_000).toISOString();
    expect(timeAgo(ts30)).toBe('30m ago');

    const ts59 = new Date(NOW.getTime() - 59 * 60_000).toISOString();
    expect(timeAgo(ts59)).toBe('59m ago');
  });

  it('returns hours ago for 1-23 hours', () => {
    const ts1 = new Date(NOW.getTime() - 60 * 60_000).toISOString(); // exactly 60 min
    expect(timeAgo(ts1)).toBe('1h ago');

    const ts12 = new Date(NOW.getTime() - 12 * 60 * 60_000).toISOString();
    expect(timeAgo(ts12)).toBe('12h ago');

    const ts23 = new Date(NOW.getTime() - 23 * 60 * 60_000).toISOString();
    expect(timeAgo(ts23)).toBe('23h ago');
  });

  it('returns days ago for 1-6 days', () => {
    const ts1 = new Date(NOW.getTime() - 24 * 60 * 60_000).toISOString(); // exactly 24h
    expect(timeAgo(ts1)).toBe('1d ago');

    const ts6 = new Date(NOW.getTime() - 6 * 24 * 60 * 60_000).toISOString();
    expect(timeAgo(ts6)).toBe('6d ago');
  });

  it('returns weeks ago for 7-29 days', () => {
    const ts7 = new Date(NOW.getTime() - 7 * 24 * 60 * 60_000).toISOString();
    expect(timeAgo(ts7)).toBe('1w ago');

    const ts14 = new Date(NOW.getTime() - 14 * 24 * 60 * 60_000).toISOString();
    expect(timeAgo(ts14)).toBe('2w ago');

    const ts29 = new Date(NOW.getTime() - 29 * 24 * 60 * 60_000).toISOString();
    expect(timeAgo(ts29)).toBe('4w ago');
  });

  it('returns months ago for 30+ days', () => {
    const ts30 = new Date(NOW.getTime() - 30 * 24 * 60 * 60_000).toISOString();
    expect(timeAgo(ts30)).toBe('1mo ago');

    const ts60 = new Date(NOW.getTime() - 60 * 24 * 60 * 60_000).toISOString();
    expect(timeAgo(ts60)).toBe('2mo ago');
  });
});

// ─── getFPLStatusBadge ───────────────────────────────────────────────────────

describe('getFPLStatusBadge', () => {
  it('returns INJURED badge for "i"', () => {
    const badge = getFPLStatusBadge('i');
    expect(badge).toMatchObject({ badge: 'INJURED', icon: '🏥' });
    expect(badge.color).toContain('red');
  });

  it('returns DOUBTFUL badge for "d"', () => {
    const badge = getFPLStatusBadge('d');
    expect(badge).toMatchObject({ badge: 'DOUBTFUL', icon: '⚠️' });
    expect(badge.color).toContain('orange');
  });

  it('returns SUSPENDED badge for "s"', () => {
    const badge = getFPLStatusBadge('s');
    expect(badge).toMatchObject({ badge: 'SUSPENDED', icon: '🚫' });
    expect(badge.color).toContain('red');
  });

  it('returns UNAVAILABLE badge for "u"', () => {
    const badge = getFPLStatusBadge('u');
    expect(badge).toMatchObject({ badge: 'UNAVAILABLE', icon: '❌' });
    expect(badge.color).toContain('slate');
  });

  it('returns NOT IN SQUAD badge for "n"', () => {
    const badge = getFPLStatusBadge('n');
    expect(badge).toMatchObject({ badge: 'NOT IN SQUAD', icon: '➖' });
    expect(badge.color).toContain('slate');
  });

  it('returns null for "a" (available)', () => {
    expect(getFPLStatusBadge('a')).toBeNull();
  });

  it('returns null for unknown status codes', () => {
    expect(getFPLStatusBadge('x')).toBeNull();
    expect(getFPLStatusBadge('')).toBeNull();
    expect(getFPLStatusBadge(null)).toBeNull();
    expect(getFPLStatusBadge(undefined)).toBeNull();
  });

  it('all non-null badges have badge, color, and icon fields', () => {
    ['i', 'd', 's', 'u', 'n'].forEach(code => {
      const badge = getFPLStatusBadge(code);
      expect(badge).toHaveProperty('badge');
      expect(badge).toHaveProperty('color');
      expect(badge).toHaveProperty('icon');
    });
  });
});
