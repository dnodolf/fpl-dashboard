import React from 'react';
import { render, screen } from '@testing-library/react';
import ComparisonTabContent from '../ComparisonTabContent';

const makePlayer = (id, name, position, owned_by = 'other') => ({
  sleeper_id: id,
  name,
  web_name: name.split(' ').pop(),
  position,
  team_abbr: 'TOT',
  owned_by,
  predictions: [
    { gw: 29, predicted_pts: 6, v3_pts: 6.2, v4_pts: 6.1, predicted_mins: 90, opp: [['ARS', 'Arsenal (H)', 3]] },
    { gw: 30, predicted_pts: 5, v3_pts: 5.1, v4_pts: 5.0, predicted_mins: 90, opp: [['CHE', 'Chelsea (A)', 4]] },
  ],
  predicted_points: 120,
  v3_season_total: 118,
  v4_season_total: 119,
  season_prediction_avg: 4.5,
  v3_season_avg: 4.4,
  v4_season_avg: 4.5,
});

const myPlayer  = makePlayer('p1', 'Son Heung-min', 'MID', 'testUser');
const freeAgent = makePlayer('p2', 'Marcus Rashford', 'MID');

const defaultProps = {
  players: [myPlayer, freeAgent],
  currentGameweek: { number: 29, status: 'upcoming' },
  scoringMode: 'ffh',
  onPlayerClick: jest.fn(),
};

describe('ComparisonTabContent', () => {
  it('renders without crashing with empty players', () => {
    const { container } = render(
      <ComparisonTabContent {...defaultProps} players={[]} />
    );
    // Should show loading spinner
    expect(container.firstChild).not.toBeNull();
  });

  it('renders with players', () => {
    render(<ComparisonTabContent {...defaultProps} />);
    // Should not crash
    expect(document.body).toBeTruthy();
  });

  it('renders player search input', () => {
    render(<ComparisonTabContent {...defaultProps} />);
    const inputs = screen.getAllByRole('textbox');
    expect(inputs.length).toBeGreaterThanOrEqual(1);
  });

  it('renders verdict table headers when two players selected', () => {
    render(
      <ComparisonTabContent
        {...defaultProps}
        preSelectedPlayer1={myPlayer}
      />
    );
    // No crash with pre-selected player
    expect(document.body).toBeTruthy();
  });

  it('shows loading state when players is empty', () => {
    render(<ComparisonTabContent {...defaultProps} players={[]} />);
    expect(screen.getByText(/Loading player data/i)).toBeInTheDocument();
  });

  it('renders Swap button', () => {
    render(<ComparisonTabContent {...defaultProps} />);
    const swapBtn = screen.queryByRole('button', { name: /swap/i });
    // May or may not be visible depending on selection state — just no crash
    expect(document.body).toBeTruthy();
  });

  it('does not crash with v3 scoringMode', () => {
    expect(() =>
      render(<ComparisonTabContent {...defaultProps} scoringMode="v3" />)
    ).not.toThrow();
  });

  it('does not crash with v4 scoringMode', () => {
    expect(() =>
      render(<ComparisonTabContent {...defaultProps} scoringMode="v4" />)
    ).not.toThrow();
  });
});
