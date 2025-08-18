'use client';
import { useState, useEffect } from 'react';
import { LoadingSpinner } from './components/LoadingSpinner';
import { ErrorBoundary } from './components/ErrorBoundary';

// ----------------- HEADER COMPONENT -----------------
const DashboardHeader = ({ 
  isDarkMode, 
  setIsDarkMode, 
  lastUpdated, 
  source, 
  players = [], 
  quality, 
  ownershipData, 
  ownershipCount,
  enhanced,
  refetch,
  activeTab,
  setActiveTab
}) => (
  <header className={`${
    isDarkMode ? 'bg-gray-800' : 'bg-white'
  } shadow-sm border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
    <div className="max-w-7xl mx-auto px-4 py-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">🏆 FPL Roster Explorer</h1>
          {lastUpdated && (
            <div className="text-sm opacity-75 mt-1 space-x-4">
              <span>Last updated: {new Date(lastUpdated).toLocaleString()}</span>
              {source && <span>• Source: {source}</span>}
              {enhanced && <span>• Enhanced ✨</span>}
              {ownershipData && <span>• Ownership data: {ownershipCount} players</span>}
              {quality && (
                <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                  quality.completenessScore >= 90 ? 'bg-green-100 text-green-800' :
                  quality.completenessScore >= 70 ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  Data Quality: {quality.completenessScore}%
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex gap-4 items-center">
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className={`p-2 rounded-lg transition-colors ${
              isDarkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'
            }`}
          >
            {isDarkMode ? '☀️' : '🌙'}
          </button>
          <div className="flex gap-2">
            <button 
              onClick={() => refetch('sheets')}
              className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded text-sm transition-colors"
              title="Load from Google Sheets"
            >
              📊 Sheets
            </button>
            <button 
              onClick={() => refetch('ffh')}
              className="bg-green-500 hover:bg-green-600 text-white px-3 py-2 rounded text-sm transition-colors"
              title="Load fresh FFH predictions"
            >
              🔄 FFH
            </button>
            <button 
              onClick={() => refetch('auto', true)}
              className="bg-purple-500 hover:bg-purple-600 text-white px-3 py-2 rounded text-sm transition-colors"
              title="Auto-select best source with fresh data"
            >
              ⚡ Refresh
            </button>
          </div>
        </div>
      </div>
      
      {/* Navigation Tabs */}
      <nav className="mt-4">
        <div className="flex gap-1 overflow-x-auto">
          {[
            { id: 'players', label: '👥 Players', desc: `Browse ${players?.length || 0} players` },
            { id: 'optimizer', label: '⚡ Optimizer', desc: 'Find optimal lineups' },
            { id: 'transfers', label: '🔄 Transfers', desc: 'Transfer suggestions' },
            { id: 'analytics', label: '📊 Analytics', desc: 'Performance insights' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 rounded-lg font-medium transition-colors min-w-max ${
                activeTab === tab.id
                  ? 'bg-blue-500 text-white'
                  : isDarkMode 
                    ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              <div className="text-sm">{tab.label}</div>
              <div className="text-xs opacity-75">{tab.desc}</div>
            </button>
          ))}
        </div>
      </nav>
    </div>
  </header>
);

// ----------------- DATA HOOK -----------------
function usePlayerData() {
  const [data, setData] = useState({
    players: [],
    loading: true,
    error: null,
    lastUpdated: null,
    source: null,
    quality: null,
    ownershipData: false,
    enhanced: false
  });

  const fetchData = async (source = 'auto', forceRefresh = false) => {
    setData(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const params = new URLSearchParams({
        source,
        refresh: forceRefresh.toString(),
        matching: 'true'
      });
      
      const response = await fetch(`/api/players?${params}`);
      const result = await response.json();
      
      if (result.success) {
        setData({
          players: result.players || [],
          loading: false,
          error: null,
          lastUpdated: result.lastUpdated,
          source: result.source || source,
          quality: result.quality,
          ownershipData: result.ownershipData,
          enhanced: result.enhanced,
          cached: result.fromCache,
          ownershipCount: result.ownershipCount || 0
        });
      } else {
        throw new Error(result.error || 'Failed to fetch data');
      }
    } catch (error) {
      console.error('Error fetching player data:', error);
      setData(prev => ({
        ...prev,
        loading: false,
        error: error.message
      }));
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      if (!document.hidden) {
        fetchData('auto', false);
      }
    }, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetchData('auto');
  }, []);

  return { ...data, refetch: fetchData };
}

// ----------------- MAIN DASHBOARD -----------------
export default function FPLDashboard() {
  const [activeTab, setActiveTab] = useState('players');
  const [filters, setFilters] = useState({
    position: 'all',
    availability: 'all',
    team: 'all',
    minPoints: 0,
    search: ''
  });
  const [selectedFormation, setSelectedFormation] = useState('4-3-3');
  const [isDarkMode, setIsDarkMode] = useState(true);
  
  const { players, loading, error, lastUpdated, source, quality, ownershipData, ownershipCount, enhanced, refetch } = usePlayerData();

  // ... your PlayerCard, FormationOptimizer, filters, error/loading screens unchanged ...

  if (loading) {
    return (
      <div className={`min-h-screen ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
        <div className="flex items-center justify-center min-h-screen">
          <LoadingSpinner message="Loading player data..." />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`min-h-screen ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center p-8">
            <div className="text-6xl mb-4">⚠️</div>
            <h2 className="text-2xl font-bold mb-4">Error Loading Data</h2>
            <p className="text-gray-400 mb-6">{error}</p>
            <div className="space-x-4">
              <button onClick={() => refetch('sheets')} className="bg-blue-500 hover:bg-blue-600 px-4 py-2 rounded">Try Google Sheets</button>
              <button onClick={() => refetch('ffh')} className="bg-green-500 hover:bg-green-600 px-4 py-2 rounded">Try FFH API</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className={`min-h-screen transition-colors ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
        
        <DashboardHeader
          isDarkMode={isDarkMode}
          setIsDarkMode={setIsDarkMode}
          lastUpdated={lastUpdated}
          source={source}
          players={players}
          quality={quality}
          ownershipData={ownershipData}
          ownershipCount={ownershipCount}
          enhanced={enhanced}
          refetch={refetch}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
        />

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 py-6">
          {/* ... existing tab content ... */}
        </main>
      </div>
    </ErrorBoundary>
  );
}