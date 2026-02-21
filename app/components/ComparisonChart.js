'use client';

const ComparisonChart = ({ fixtures, barColor = 'bg-blue-500', title = 'Next 5 Gameweeks' }) => {
  if (!fixtures || fixtures.length === 0) return null;

  const maxPoints = Math.max(...fixtures.map(f => f.predictedPoints), 1);
  const roundedMax = Math.ceil(maxPoints);

  return (
    <div className="bg-gray-700 rounded-lg p-4">
      <h4 className="text-white font-semibold mb-3">{title}</h4>
      <div className="relative h-48">
        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 bottom-12 w-8 flex flex-col justify-between text-xs text-gray-400">
          {[roundedMax, Math.round(roundedMax * 0.5), 0].map((val, i) => (
            <div key={i} className="text-right">{val}</div>
          ))}
        </div>

        {/* Chart area */}
        <div className="absolute left-10 right-0 top-0 bottom-12">
          {/* Grid lines */}
          <div className="absolute inset-0 flex flex-col justify-between">
            <div className="border-t border-gray-600"></div>
            <div className="border-t border-gray-600"></div>
            <div className="border-t border-gray-600"></div>
          </div>

          {/* Bar chart */}
          <div className="absolute inset-0 flex items-end justify-between gap-2">
            {fixtures.map((fixture) => {
              const heightPercent = (fixture.predictedPoints / maxPoints) * 100;
              return (
                <div key={fixture.gw} className="flex-1 flex flex-col items-center justify-end group relative h-full">
                  <div className="text-xs font-bold text-white mb-1 absolute" style={{ bottom: `${heightPercent}%` }}>
                    {fixture.predictedPoints.toFixed(1)}
                  </div>
                  <div
                    className={`w-1/2 ${barColor} rounded-t transition-all hover:opacity-80 relative`}
                    style={{ height: `${heightPercent}%`, minHeight: '2px' }}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* X-axis labels */}
        <div className="absolute left-10 right-0 bottom-0 h-12 flex items-start justify-between gap-2">
          {fixtures.map((fixture) => (
            <div key={fixture.gw} className="flex-1 flex flex-col items-center text-center">
              <div className="text-xs font-medium text-gray-300">GW{fixture.gw}</div>
              <div className="text-xs text-gray-500">{fixture.isHome ? 'vs' : '@'} {fixture.opponent}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ComparisonChart;
