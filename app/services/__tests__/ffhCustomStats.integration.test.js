/**
 * FFH Custom Stats Integration Tests
 *
 * Tests fetchFFHCustomStats() end-to-end, using MSW to intercept
 * the FFH players-custom endpoint. Verifies the stats map shape
 * and field normalization logic.
 */
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

// --- Mock FFH API response ---
const mockFFHPlayers = [
  {
    code: 123,
    xg1: 5.2, xa: 3.1, xgi: 8.3, xpts: 42.0,
    shots: 32, shots_on_target: 18, shots_in_box: 22, big_chance: 6,
    goals: 4, key_pass: 15, big_chance_created: 5, assists: 3,
    acc_pass: 120, total_pass: 180,
    tackles: 8, tackles_won: 5, intercepts: 3, clearances: 1,
    blocks: 2, recoveries: 14,
    saves: 0, goals_conceded: 0,
    influence: 210.5, creativity: 180.3, threat: 300.1,
    mins: 1980, appearance: 22, starts: 20,
    clean_sheets: 0, bps: 180, bonus: 12,
    yellow_card: 2, red_card: 0,
    touches_in_opp_box: 45, succ_drib: 8, fouls: 12,
    offside: 4, pen_taken: 1, pen_goal: 1,
  },
  {
    code: 456,
    // Sparse player — many fields missing (should default to 0)
    xg1: 0, xa: 0,
    mins: 630, appearance: 7, starts: 5,
  }
];

// Mock env vars (checked by fetchFFHCustomStats before fetching)
process.env.FFH_AUTH_STATIC = 'mock-auth';
process.env.FFH_BEARER_TOKEN = 'mock-token';

// MSW intercepts the actual FFH URL pattern
const server = setupServer(
  http.get('https://data.fantasyfootballhub.co.uk/api/players-custom/', () =>
    HttpResponse.json(mockFFHPlayers)
  )
);

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// Import after env vars are set
let fetchFFHCustomStats;
beforeAll(async () => {
  // Clear module cache so env vars take effect
  jest.resetModules();
  ({ fetchFFHCustomStats } = await import('../ffhCustomStatsService.js'));
});

describe('fetchFFHCustomStats()', () => {
  it('returns a stats map keyed by FPL element code', async () => {
    const statsMap = await fetchFFHCustomStats(29);
    expect(statsMap).not.toBeNull();
    expect(typeof statsMap).toBe('object');
    expect(statsMap[123]).toBeDefined();
    expect(statsMap[456]).toBeDefined();
  });

  it('correctly maps xG field (xg1 → xg)', async () => {
    const statsMap = await fetchFFHCustomStats(29);
    expect(statsMap[123].xg).toBeCloseTo(5.2);
  });

  it('maps xa field', async () => {
    const statsMap = await fetchFFHCustomStats(29);
    expect(statsMap[123].xa).toBeCloseTo(3.1);
  });

  it('defaults missing fields to 0 for sparse players', async () => {
    const statsMap = await fetchFFHCustomStats(29);
    const sparse = statsMap[456];
    expect(sparse.xg).toBe(0);
    expect(sparse.xa).toBe(0);
    expect(sparse.shots).toBe(0);
    expect(sparse.goals).toBe(0);
    expect(sparse.tackles).toBe(0);
    expect(sparse.saves).toBe(0);
  });

  it('preserves legitimate 0 values (not overridden by falsy coercion)', async () => {
    const statsMap = await fetchFFHCustomStats(29);
    // sparse player has xg1: 0 (legitimate 0, not missing)
    // With ?? 0, this should remain 0 (same result, but semantically correct)
    expect(statsMap[456].xg).toBe(0);
    expect(statsMap[456].xa).toBe(0);
  });

  it('includes playing time stats', async () => {
    const statsMap = await fetchFFHCustomStats(29);
    expect(statsMap[123].mins).toBe(1980);
    expect(statsMap[123].appearance).toBe(22);
    expect(statsMap[123].starts).toBe(20);
  });

  it('includes ICT index stats', async () => {
    const statsMap = await fetchFFHCustomStats(29);
    expect(statsMap[123].influence).toBeCloseTo(210.5);
    expect(statsMap[123].creativity).toBeCloseTo(180.3);
    expect(statsMap[123].threat).toBeCloseTo(300.1);
  });

  it('returns null when API returns 500', async () => {
    server.use(
      http.get('https://data.fantasyfootballhub.co.uk/api/players-custom/', () =>
        HttpResponse.error()
      )
    );
    jest.resetModules();
    const { fetchFFHCustomStats: fresh } = await import('../ffhCustomStatsService.js');
    const result = await fresh(29);
    expect(result).toBeNull();
  });

  it('returns null when response is empty array', async () => {
    server.use(
      http.get('https://data.fantasyfootballhub.co.uk/api/players-custom/', () =>
        HttpResponse.json([])
      )
    );
    jest.resetModules();
    const { fetchFFHCustomStats: fresh } = await import('../ffhCustomStatsService.js');
    const result = await fresh(29);
    expect(result).toBeNull();
  });
});
