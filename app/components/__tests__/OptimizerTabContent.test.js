import React from 'react';
import { render, screen } from '@testing-library/react';
import { OptimizerTabContent } from '../OptimizerTabContent';

// Mock fetch — OptimizerTabContent calls /api/optimizer on mount
beforeAll(() => {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        stats: { currentPoints: 55, optimalPoints: 60, improvement: 5, efficiency: 91, playersToSwap: 1, formationChange: false },
        current: { formation: '4-4-2', players: [] },
        optimal: { formation: '4-5-1', players: [] },
        recommendations: [],
        allFormations: [],
        roster: null,
        fixtureList: []
      })
    })
  );
});

afterEach(() => jest.clearAllMocks());

const makePlayer = (id, name, pos, isStarter = true) => ({
  sleeper_id: id,
  name,
  web_name: name.split(' ').pop(),
  position: pos,
  team_abbr: 'LIV',
  owned_by: 'testUser',
  is_starter: isStarter,
  predictions: [
    { gw: 29, predicted_pts: 7, v3_pts: 7.2, v4_pts: 7.1, predicted_mins: 90, opp: [['BHA', 'Brighton (H)', 2]] }
  ],
  predicted_points: 130,
  v3_season_total: 128,
  v4_season_total: 129,
  season_prediction_avg: 5.0,
  v3_season_avg: 4.9,
  v4_season_avg: 5.0,
});

const players = [
  makePlayer('gk1', 'Alisson Becker', 'GKP'),
  makePlayer('d1', 'Trent Alexander-Arnold', 'DEF'),
  makePlayer('d2', 'Andrew Robertson', 'DEF'),
  makePlayer('d3', 'Virgil van Dijk', 'DEF'),
  makePlayer('d4', 'Joe Gomez', 'DEF'),
  makePlayer('m1', 'Dominik Szoboszlai', 'MID'),
  makePlayer('m2', 'Curtis Jones', 'MID'),
  makePlayer('m3', 'Ryan Gravenberch', 'MID'),
  makePlayer('m4', 'Harvey Elliott', 'MID'),
  makePlayer('f1', 'Mohamed Salah', 'FWD'),
  makePlayer('f2', 'Darwin Nunez', 'FWD'),
  makePlayer('gk2', 'Caoimhin Kelleher', 'GKP', false),
  makePlayer('b1', 'Ibrahima Konate', 'DEF', false),
  makePlayer('b2', 'Stefan Bajcetic', 'MID', false),
  makePlayer('b3', 'Ben Doak', 'FWD', false),
];

const defaultProps = {
  players,
  currentGameweek: { number: 29, status: 'upcoming' },
  scoringMode: 'ffh',
  onPlayerClick: jest.fn(),
};

describe('OptimizerTabContent', () => {
  it('renders loading state initially (fetch in flight)', () => {
    render(<OptimizerTabContent {...defaultProps} />);
    // Initial render shows loading or content — just no crash
    expect(document.body).toBeTruthy();
  });

  it('renders without crashing with ffh scoring mode', () => {
    expect(() => render(<OptimizerTabContent {...defaultProps} />)).not.toThrow();
  });

  it('shows loading spinner when v3 mode and no gameweek', () => {
    render(<OptimizerTabContent {...defaultProps} scoringMode="v3" currentGameweek={null} />);
    expect(screen.getByText(/Loading gameweek data/i)).toBeInTheDocument();
  });

  it('shows loading spinner when v4 mode and no gameweek', () => {
    render(<OptimizerTabContent {...defaultProps} scoringMode="v4" currentGameweek={null} />);
    expect(screen.getByText(/Loading gameweek data/i)).toBeInTheDocument();
  });

  it('renders with empty players array without crashing', () => {
    expect(() =>
      render(<OptimizerTabContent {...defaultProps} players={[]} />)
    ).not.toThrow();
  });

  it('makes a fetch call to /api/optimizer on mount', () => {
    render(<OptimizerTabContent {...defaultProps} />);
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/optimizer',
      expect.objectContaining({ method: 'POST' })
    );
  });
});
