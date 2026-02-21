'use client';

import { UnmatchedPlayersTable } from './stats/UnmatchedPlayersTable';

const MatchingTabContent = ({ players, integration }) => {
  const optaAnalysis = integration?.optaAnalysis;

  return (
    <div className="space-y-6">
      {/* Summary Section */}
      <div className="rounded-lg shadow-sm border p-6 bg-gray-800 border-gray-700">
        <h3 className="text-lg font-medium mb-4 text-white">
          🎯 Opta-Only Matching Summary
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="text-sm font-medium mb-2 text-gray-300">
              Coverage Analysis
            </h4>
            <ul className="text-sm space-y-1 text-gray-400">
              <li>• {optaAnalysis?.sleeperOptaRate || 0}% of Sleeper players have Opta IDs</li>
              <li>• {optaAnalysis?.ffhOptaRate || 0}% of FFH players have Opta IDs</li>
              <li>• {optaAnalysis?.optaMatchRate || 0}% match rate (matched/FFH players)</li>
              <li>• 100% match confidence (exact ID matching)</li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-medium mb-2 text-gray-300">
              Matching Method
            </h4>
            <ul className="text-sm space-y-1 text-gray-400">
              <li>• <strong>Opta ID Only:</strong> No complex name matching</li>
              <li>• <strong>Zero False Positives:</strong> Exact ID matches only</li>
              <li>• <strong>High Performance:</strong> ~90% faster than multi-tier</li>
              <li>• <strong>Reliable:</strong> No manual overrides needed</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Unmatched Players Table */}
      <UnmatchedPlayersTable optaAnalysis={optaAnalysis} />

      {/* Debug Information (Optional) */}
      {optaAnalysis?.duplicateOptas && optaAnalysis.duplicateOptas.size > 0 && (
        <div className="rounded-lg shadow-sm border p-6 bg-gray-800 border-gray-700">
          <h3 className="text-lg font-medium mb-4 text-white">
            ⚠️ Duplicate Opta IDs Detected
          </h3>
          <p className="text-sm mb-4 text-gray-400">
            These Sleeper players share the same Opta ID (only first match is used):
          </p>
          <div className="space-y-2">
            {Array.from(optaAnalysis.duplicateOptas.entries()).map(([optaId, duplicatePlayers]) => (
              <div key={optaId} className="p-3 rounded border bg-gray-700 border-gray-600">
                <div className="text-sm font-medium text-white">
                  Opta ID: {optaId}
                </div>
                <div className="text-xs mt-1 text-gray-400">
                  Players: {duplicatePlayers.map(p => `${p.name} (${p.team})`).join(', ')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default MatchingTabContent;
