'use client';

import { getDataFreshnessStatus } from '../utils/cacheManager';
import CacheManager from '../utils/cacheManager';
import { AppLogo } from './common/AppLogo';

const DashboardHeader = ({ lastUpdated, players, updateData, activeTab, setActiveTab, currentGameweek, scoringMode, setScoringMode }) => {
  const freshnessStatus = getDataFreshnessStatus(lastUpdated);

  return (
    <header className="bg-gray-800 border-gray-700 border-b sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-2 sm:px-4 py-2 sm:py-4">
        {/* Top Row: Title, Gameweek, Update Button */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-4 mb-2 sm:mb-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 w-full sm:w-auto">
            <h1 className="flex items-center gap-3 text-xl sm:text-3xl font-bold text-white whitespace-nowrap">
              <AppLogo size={48} className="hidden sm:block" />
              <AppLogo size={40} className="block sm:hidden" />
              Fantasy FC Playbook
            </h1>
          </div>

          <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto justify-between sm:justify-end">
            {/* Scoring Mode Toggle */}
            <div className="flex items-center gap-1 sm:gap-2">
              <span className="text-xs sm:text-sm text-gray-300 hidden sm:inline">
                Scoring:
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => setScoringMode('ffh')}
                  className={`px-2 sm:px-3 py-1 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                    scoringMode === 'ffh'
                      ? 'bg-blue-500 text-white hover:bg-blue-600'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                  title="Fantasy Football Hub (FPL scoring)"
                >
                  📊 FFH
                </button>
                <button
                  onClick={() => setScoringMode('v3')}
                  className={`px-2 sm:px-3 py-1 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                    scoringMode === 'v3'
                      ? 'bg-green-500 text-white hover:bg-green-600'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                  title="V3 Sleeper conversion (optimal position-based ratios)"
                >
                  🚀 V3
                </button>
              </div>
            </div>

            {/* Data Freshness + Update Button */}
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline text-xs text-gray-400">
                {freshnessStatus.message}
              </span>
              <button
                onClick={() => updateData('manual', true, false)}
                className="bg-blue-500 hover:bg-blue-600 text-white px-2 sm:px-4 py-1 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center gap-1 sm:gap-2 whitespace-nowrap"
              >
                🔄 <span className="hidden sm:inline">Update Data</span>
              </button>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex space-x-1 overflow-x-auto pb-2 -mb-2 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
          {[
            { id: 'home', label: 'Home' },
            { id: 'optimizer', label: 'Start/Sit' },
            { id: 'transfers', label: 'Transfers' },
            { id: 'cheatsheet', label: 'Cheat Sheet' },
            { id: 'comparison', label: 'Comparison' },
            { id: 'players', label: 'Players' },
            { id: 'matching', label: 'Matching' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 font-medium rounded-lg transition-colors whitespace-nowrap flex-shrink-0 ${
                activeTab === tab.id
                  ? 'bg-blue-500 text-white'
                  : 'text-gray-300 hover:text-white hover:bg-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
};

export default DashboardHeader;
