// Mock the JSON data import
jest.mock('../../data/playerArchetypes.json', () => ({
  archetypes: {
    GKP: {
      sweeper_keeper: { ratio: 0.92, description: 'Active sweeper keeper' },
      traditional_keeper: { ratio: 0.88, description: 'Shot-stopper' }
    },
    DEF: {
      defensive_specialist: { ratio: 1.20, description: 'Tackle-focused' },
      attacking_fullback: { ratio: 1.18, description: 'Offensive fullback' }
    },
    MID: {
      box_to_box: { ratio: 1.08, description: 'All-round midfielder' },
      attacking_mid: { ratio: 1.02, description: 'Creative midfielder' }
    },
    FWD: {
      target_man: { ratio: 0.95, description: 'Physical striker' },
      poacher: { ratio: 0.93, description: 'Penalty box striker' }
    }
  },
  playerMappings: {
    GKP: {
      sweeper_keeper: ['Alisson', 'Ederson'],
      traditional_keeper: ['Flekken', 'Raya']
    },
    DEF: {
      defensive_specialist: ['Saliba', 'Guehi'],
      attacking_fullback: ['Alexander-Arnold', 'Trent']
    },
    MID: {
      box_to_box: ['Rice', 'Fernandes'],
      attacking_mid: ['De Bruyne', 'Saka']
    },
    FWD: {
      target_man: ['Nunez', 'Wood'],
      poacher: ['Haaland', 'Watkins']
    }
  }
}), { virtual: true });

// Mock conversionRatios dependency
jest.mock('../v3/conversionRatios', () => ({
  getV3ConversionRatio: jest.fn((position) => {
    const ratios = { GKP: 0.90, DEF: 1.15, MID: 1.05, FWD: 0.97 };
    return ratios[position] || 1.0;
  })
}));

import {
  getPlayerArchetype,
  getPlayersByArchetype,
  getArchetypeStats,
  logArchetypeInfo,
} from '../playerArchetypeService.js';

// ─── getPlayerArchetype ───────────────────────────────────────────────────────

describe('getPlayerArchetype', () => {
  it('returns fallback for null player', () => {
    const result = getPlayerArchetype(null);
    expect(result.archetype).toBe('unknown');
    expect(result.ratio).toBe(1.0);
    expect(result.source).toBe('fallback');
  });

  it('returns position_fallback for player with no name', () => {
    const result = getPlayerArchetype({ position: 'MID' });
    expect(result.source).toBe('position_fallback');
  });

  it('returns position_fallback for unknown position', () => {
    const result = getPlayerArchetype({ name: 'Someone', position: 'UNKNOWN_POS' });
    expect(result.source).toBe('position_fallback');
  });

  it('finds exact archetype for known player', () => {
    const result = getPlayerArchetype({ name: 'Alisson', position: 'GKP' });
    expect(result.archetype).toBe('sweeper_keeper');
    expect(result.ratio).toBe(0.92);
    expect(result.source).toBe('archetype_mapping');
  });

  it('is case-insensitive for player name matching', () => {
    const result = getPlayerArchetype({ name: 'alisson', position: 'GKP' });
    expect(result.archetype).toBe('sweeper_keeper');
  });

  it('matches via full_name fallback', () => {
    const result = getPlayerArchetype({ full_name: 'Ederson', position: 'GKP' });
    expect(result.archetype).toBe('sweeper_keeper');
  });

  it('matches via web_name fallback', () => {
    const result = getPlayerArchetype({ web_name: 'Rice', position: 'MID' });
    expect(result.archetype).toBe('box_to_box');
  });

  it('returns position_default for known position but unknown player', () => {
    const result = getPlayerArchetype({ name: 'Unknown Player', position: 'MID' });
    expect(result.source).toBe('position_default');
    expect(result.archetype).toBe('default_mid');
  });

  it('uses position default ratio from conversionRatios for unknown player', () => {
    const result = getPlayerArchetype({ name: 'Nobody', position: 'DEF' });
    expect(result.ratio).toBe(1.15);
  });

  it('defaults position to MID when none provided', () => {
    const result = getPlayerArchetype({ name: 'Someone Unknown' });
    expect(result.source).toBe('position_default');
    expect(result.archetype).toBe('default_mid');
  });
});

// ─── getPlayersByArchetype ────────────────────────────────────────────────────

describe('getPlayersByArchetype', () => {
  it('returns list of players for valid position and archetype', () => {
    const result = getPlayersByArchetype('GKP', 'sweeper_keeper');
    expect(result).toContain('Alisson');
    expect(result).toContain('Ederson');
  });

  it('returns empty array for unknown position', () => {
    expect(getPlayersByArchetype('XYZ', 'some_type')).toEqual([]);
  });

  it('returns empty array for unknown archetype within valid position', () => {
    expect(getPlayersByArchetype('MID', 'nonexistent_archetype')).toEqual([]);
  });
});

// ─── getArchetypeStats ────────────────────────────────────────────────────────

describe('getArchetypeStats', () => {
  it('counts total players correctly', () => {
    const players = [
      { name: 'Alisson', position: 'GKP' },
      { name: 'Unknown', position: 'MID' }
    ];
    const stats = getArchetypeStats(players);
    expect(stats.totalPlayers).toBe(2);
  });

  it('increments withArchetype only for matched players', () => {
    const players = [
      { name: 'Alisson', position: 'GKP' },
      { name: 'Nobody Known', position: 'MID' }
    ];
    const stats = getArchetypeStats(players);
    expect(stats.withArchetype).toBe(1);
  });

  it('tracks source distribution', () => {
    const players = [
      { name: 'Alisson', position: 'GKP' },
      { name: 'UnknownDef', position: 'DEF' }
    ];
    const stats = getArchetypeStats(players);
    expect(stats.bySource.archetype_mapping).toBe(1);
    expect(stats.bySource.position_default).toBe(1);
  });

  it('tracks per-archetype counts in byArchetype', () => {
    const players = [
      { name: 'Alisson', position: 'GKP' },
      { name: 'Ederson', position: 'GKP' }
    ];
    const stats = getArchetypeStats(players);
    expect(stats.byArchetype['GKP_sweeper_keeper']).toBe(2);
  });

  it('handles empty players array', () => {
    const stats = getArchetypeStats([]);
    expect(stats.totalPlayers).toBe(0);
    expect(stats.withArchetype).toBe(0);
  });
});

// ─── logArchetypeInfo ─────────────────────────────────────────────────────────

describe('logArchetypeInfo', () => {
  it('does not throw in production environment', () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    expect(() =>
      logArchetypeInfo({ name: 'Alisson' }, { source: 'archetype_mapping', archetype: 'sweeper_keeper', ratio: 0.92, description: 'test' })
    ).not.toThrow();
    process.env.NODE_ENV = original;
  });

  it('does not throw in development environment', () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    expect(() =>
      logArchetypeInfo({ name: 'Alisson' }, { source: 'archetype_mapping', archetype: 'sweeper_keeper', ratio: 0.92, description: 'test' })
    ).not.toThrow();
    process.env.NODE_ENV = original;
  });
});
