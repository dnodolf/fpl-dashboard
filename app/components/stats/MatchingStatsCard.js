/**
 * MatchingStatsCard Component
 * Displays player matching statistics between Sleeper and FFH using Opta IDs
 */

import PropTypes from 'prop-types';

export function MatchingStatsCard({ players, integration }) {
  const optaAnalysis = integration?.optaAnalysis;

  if (!optaAnalysis) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className={`p-4 rounded-lg shadow-sm bg-gray-800`}>
          <div className="text-center">
            <div className="text-lg font-medium text-gray-500">Loading matching statistics...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      {/* Sleeper Players with Opta ID */}
      <div className={`p-4 rounded-lg shadow-sm bg-gray-800`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold text-blue-600">
              {optaAnalysis.sleeperWithOpta?.toLocaleString()}/{integration.sleeperTotal?.toLocaleString()}
            </div>
            <div className={`text-sm text-gray-400`}>
              Sleeper w/ Opta ({optaAnalysis.sleeperOptaRate}%)
            </div>
          </div>
          <div className="text-blue-500 text-2xl">👥</div>
        </div>
      </div>

      {/* FFH Players with Opta ID */}
      <div className={`p-4 rounded-lg shadow-sm bg-gray-800`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold text-green-600">
              {optaAnalysis.ffhWithOpta?.toLocaleString()}/{integration.ffhTotal?.toLocaleString()}
            </div>
            <div className={`text-sm text-gray-400`}>
              FFH w/ Opta ({optaAnalysis.ffhOptaRate}%)
            </div>
          </div>
          <div className="text-green-500 text-2xl">⚽</div>
        </div>
      </div>

      {/* Successful Matches */}
      <div className={`p-4 rounded-lg shadow-sm bg-gray-800`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold text-purple-600">
              {optaAnalysis.optaMatches?.toLocaleString()}/{optaAnalysis.ffhWithOpta?.toLocaleString()}
            </div>
            <div className={`text-sm text-gray-400`}>
              Successful Matches ({optaAnalysis.optaMatchRate}%)
            </div>
          </div>
          <div className="text-purple-500 text-2xl">🔗</div>
        </div>
      </div>

      {/* Unmatched Sleeper Players */}
      <div className={`p-4 rounded-lg shadow-sm bg-gray-800`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold text-orange-600">
              {optaAnalysis.unmatchedSleeperWithOpta?.length?.toLocaleString() || 0}
            </div>
            <div className={`text-sm text-gray-400`}>
              Unmatched Sleeper w/ Opta
            </div>
          </div>
          <div className="text-orange-500 text-2xl">❌</div>
        </div>
      </div>
    </div>
  );
}

MatchingStatsCard.propTypes = {
  players: PropTypes.arrayOf(PropTypes.object),
  integration: PropTypes.shape({
    sleeperTotal: PropTypes.number,
    ffhTotal: PropTypes.number,
    optaAnalysis: PropTypes.shape({
      sleeperWithOpta: PropTypes.number,
      sleeperOptaRate: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
      ffhWithOpta: PropTypes.number,
      ffhOptaRate: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
      optaMatches: PropTypes.number,
      optaMatchRate: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
      unmatchedSleeperWithOpta: PropTypes.arrayOf(PropTypes.object)
    })
  })
};
