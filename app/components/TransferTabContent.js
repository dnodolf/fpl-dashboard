// app/components/TransferTabContent.js
// Transfer analysis component following existing dashboard patterns
'use client';

import PropTypes from 'prop-types';
import TransferPairRecommendations from './TransferPairRecommendations';

const TransferTabContent = ({ players, currentGameweek, scoringMode = 'ffh', gameweekRange, onGameweekRangeChange }) => {
  // Calculate default gameweek range: current GW + next 4 (total of 5)
  const currentGW = currentGameweek?.number;
  const defaultEndGW = currentGW + 4;

  // Use shared state from parent
  const endGameweek = gameweekRange?.end || defaultEndGW;

  return (
    <div className="space-y-6">
      {/* Transfer Pair Recommendations - Smart Transfer System */}
      <TransferPairRecommendations
        myPlayers={players?.filter(p => p.owned_by === 'ThatDerekGuy') || []}
        availablePlayers={players?.filter(p => !p.owned_by || p.owned_by === 'Free Agent') || []}
        scoringMode={scoringMode}
        currentGameweek={currentGW}
        nextNGameweeks={endGameweek - currentGW + 1}
      />
    </div>
  );
};

TransferTabContent.propTypes = {
  players: PropTypes.arrayOf(PropTypes.object).isRequired,
  currentGameweek: PropTypes.shape({
    number: PropTypes.number.isRequired
  }),
  scoringMode: PropTypes.oneOf(['ffh', 'v3']),
  gameweekRange: PropTypes.shape({
    start: PropTypes.number,
    end: PropTypes.number
  }),
  onGameweekRangeChange: PropTypes.func
};

TransferTabContent.defaultProps = {
  scoringMode: 'ffh',
  currentGameweek: { number: 1 },
  gameweekRange: null,
  onGameweekRangeChange: () => {}
};

export default TransferTabContent;
