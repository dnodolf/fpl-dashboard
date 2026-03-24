/**
 * Optimizer Integration Tests
 *
 * Tests FormationOptimizerService.analyzeCurrentRoster() end-to-end,
 * using MSW to intercept the Sleeper API calls it makes internally.
 */
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { FormationOptimizerService } from '../formationOptimizerService.js';

// --- Fixtures ---
const LEAGUE_ID = '1240184286171107328';
const USER_ID = 'testUser';
const USER_SLEEPER_ID = 'u1';

const mockUsers = [
  { user_id: USER_SLEEPER_ID, display_name: USER_ID, username: USER_ID }
];

const playerIds = ['gk1','d1','d2','d3','d4','m1','m2','m3','m4','f1','f2','b1','b2','b3','bk1'];
const starterIds = ['gk1','d1','d2','d3','d4','m1','m2','m3','m4','f1','f2'];

const mockRosters = [{
  roster_id: 1,
  owner_id: USER_SLEEPER_ID,
  players: playerIds,
  starters: starterIds,
  metadata: { formation: '4-4-2' },
  settings: { wins: 5, losses: 3, fpts: 420, fpts_against: 390 }
}];

const makePred = (gw, pts) => ({
  gw,
  predicted_pts: pts,
  v3_pts: pts * 1.05,
  v4_pts: pts * 1.02,
  predicted_mins: 90,
  opp: [['BHA', 'Brighton (H)', 2]]
});

// Map standard position codes to Sleeper native format so normalizePosition resolves correctly
const SLEEPER_POS = { GKP: 'GK', DEF: 'D', MID: 'M', FWD: 'F' };

const makePlayer = (id, pos, pts) => ({
  sleeper_id: id,
  player_id: id,
  name: `Player ${id}`,
  web_name: id,
  // Use Sleeper native position string so mapSleeperPosition resolves correctly
  fantasy_positions: [SLEEPER_POS[pos] || pos],
  position: SLEEPER_POS[pos] || pos,
  team_abbr: 'LIV',
  owned_by: USER_ID,
  is_starter: starterIds.includes(id),
  predictions: [makePred(29, pts), makePred(30, pts - 1)],
  predicted_points: pts * 20,
  v3_season_total: pts * 20 * 1.05,
  season_prediction_avg: pts,
});

const allPlayers = [
  makePlayer('gk1', 'GKP', 5),
  makePlayer('d1',  'DEF', 6), makePlayer('d2', 'DEF', 5.5), makePlayer('d3', 'DEF', 5),  makePlayer('d4', 'DEF', 4),
  makePlayer('m1',  'MID', 8), makePlayer('m2', 'MID', 7),   makePlayer('m3', 'MID', 6.5), makePlayer('m4', 'MID', 6),
  makePlayer('f1',  'FWD', 9), makePlayer('f2', 'FWD', 7),
  makePlayer('b1',  'DEF', 3), makePlayer('b2', 'MID', 3),  makePlayer('b3', 'FWD', 3),
  makePlayer('bk1', 'GKP', 2),
];

// --- MSW server ---
const server = setupServer(
  http.get(`https://api.sleeper.app/v1/league/${LEAGUE_ID}/rosters`, () =>
    HttpResponse.json(mockRosters)
  ),
  http.get(`https://api.sleeper.app/v1/league/${LEAGUE_ID}/users`, () =>
    HttpResponse.json(mockUsers)
  )
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// --- Tests ---
describe('FormationOptimizerService.analyzeCurrentRoster()', () => {
  let service;
  beforeEach(() => { service = new FormationOptimizerService(); });

  it('returns a result with current and optimal formations', async () => {
    const result = await service.analyzeCurrentRoster(allPlayers, USER_ID, 'ffh', 29);
    expect(result).toHaveProperty('current');
    expect(result).toHaveProperty('optimal');
    expect(result.current).not.toBeNull();
    expect(result.optimal).not.toBeNull();
  });

  it('current formation has 11 players', async () => {
    const result = await service.analyzeCurrentRoster(allPlayers, USER_ID, 'ffh', 29);
    expect(result.current.players).toHaveLength(11);
  });

  it('optimal formation has 11 players', async () => {
    const result = await service.analyzeCurrentRoster(allPlayers, USER_ID, 'ffh', 29);
    expect(result.optimal.players).toHaveLength(11);
  });

  it('includes roster info with player IDs', async () => {
    const result = await service.analyzeCurrentRoster(allPlayers, USER_ID, 'ffh', 29);
    expect(result.roster).toHaveProperty('players');
    expect(result.roster.players.length).toBeGreaterThan(0);
  });

  it('result has improvement and efficiency fields', async () => {
    const result = await service.analyzeCurrentRoster(allPlayers, USER_ID, 'ffh', 29);
    expect(result).toHaveProperty('improvement');
    expect(result).toHaveProperty('efficiency');
    expect(typeof result.improvement).toBe('number');
  });

  it('optimal totalPoints >= current points', async () => {
    const result = await service.analyzeCurrentRoster(allPlayers, USER_ID, 'ffh', 29);
    expect(result.optimal.totalPoints).toBeGreaterThanOrEqual(result.current.points);
  });

  it('returns error object when user not found', async () => {
    server.use(
      http.get(`https://api.sleeper.app/v1/league/${LEAGUE_ID}/users`, () =>
        HttpResponse.json([]) // no users
      )
    );
    const result = await service.analyzeCurrentRoster(allPlayers, 'unknownUser', 'ffh', 29);
    expect(result).toHaveProperty('error');
  });

  it('works with v3 scoring mode', async () => {
    const result = await service.analyzeCurrentRoster(allPlayers, USER_ID, 'v3', 29);
    expect(result.current).not.toBeNull();
    expect(result.optimal).not.toBeNull();
  });

  it('identifies locked players when lockedTeams provided', async () => {
    const lockedTeams = new Set(['LIV']); // all players are LIV
    const result = await service.analyzeCurrentRoster(allPlayers, USER_ID, 'ffh', 29, lockedTeams);
    // All players on LIV should be marked locked
    const starters = result.current.players;
    const allLocked = starters.every(p => p._locked === true);
    expect(allLocked).toBe(true);
  });

  it('returns recommendations array', async () => {
    const result = await service.analyzeCurrentRoster(allPlayers, USER_ID, 'ffh', 29);
    expect(result).toHaveProperty('recommendations');
    expect(Array.isArray(result.recommendations)).toBe(true);
  });
});
