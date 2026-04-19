'use client';

/**
 * DraftAssistantPanel — real-time Sleeper draft assistant.
 *
 * Owns the useLiveDraft hook and routes between phases:
 *   setup    → DraftSetupScreen
 *   waiting  → LiveDraftView (waiting state)
 *   live     → LiveDraftView (live board)
 *   complete → DraftCompleteView (grades)
 */

import PropTypes from 'prop-types';
import { useLiveDraft } from '../../hooks/useLiveDraft';
import DraftSetupScreen from './assistant/DraftSetupScreen';
import LiveDraftView from './assistant/LiveDraftView';
import DraftCompleteView from './assistant/DraftCompleteView';

export default function DraftAssistantPanel({ players, scoringMode, leagueId, userId }) {
  const {
    phase,

    // Setup
    setupLeagueId, setSetupLeagueId,
    setupError, setupLoading,
    fetchDraftForLeague,
    draftMeta,
    detectedSlot,
    confirmAndStart,

    // Demo
    isDemoMode,
    demoLoading,
    demoAllPicks,
    demoPickIndex,
    demoSpeed,
    demoPlaying,
    fetchDemoData,
    startDemoReplay,
    advanceDemoPick,
    rewindDemoPick,
    toggleDemoPlay,
    changeDemoSpeed,

    // Live draft data
    picks,
    mySlot,
    myRoster,
    allRosters,
    availablePlayers,
    rankings,
    currentPickInfo,
    isMyTurn,
    takenIds,
    suggestions,
    leagueSize,
    totalPicks,
    userMap,

    // Sync
    syncStatus,
    syncError,
    lastSyncAt,
    resync,

    // Post-draft
    managerGrades,

    // Actions
    reset,
  } = useLiveDraft(players, scoringMode, leagueId, userId);

  if (phase === 'setup') {
    return (
      <DraftSetupScreen
        setupLeagueId={setupLeagueId}
        setSetupLeagueId={setSetupLeagueId}
        setupError={setupError}
        setupLoading={setupLoading}
        demoLoading={demoLoading}
        draftMeta={draftMeta}
        detectedSlot={detectedSlot}
        demoAllPicks={demoAllPicks}
        onFetchDraft={fetchDraftForLeague}
        onFetchDemo={fetchDemoData}
        onConfirmAndStart={confirmAndStart}
        onStartDemoReplay={startDemoReplay}
      />
    );
  }

  if (phase === 'complete') {
    return (
      <DraftCompleteView
        managerGrades={managerGrades}
        mySlot={mySlot}
        onReset={reset}
      />
    );
  }

  // phase === 'waiting' | 'live'
  return (
    <LiveDraftView
      phase={phase}
      draftMeta={draftMeta}
      picks={picks}
      rankings={rankings}
      availablePlayers={availablePlayers}
      myRoster={myRoster}
      allRosters={allRosters}
      mySlot={mySlot}
      leagueSize={leagueSize}
      totalPicks={totalPicks}
      currentPickInfo={currentPickInfo}
      isMyTurn={isMyTurn}
      takenIds={takenIds}
      suggestions={suggestions}
      userMap={userMap}
      syncStatus={syncStatus}
      syncError={syncError}
      lastSyncAt={lastSyncAt}
      onResync={resync}
      isDemoMode={isDemoMode}
      demoPickIndex={demoPickIndex}
      demoAllPicksCount={demoAllPicks?.length || 0}
      demoSpeed={demoSpeed}
      demoPlaying={demoPlaying}
      onAdvanceDemo={advanceDemoPick}
      onRewindDemo={rewindDemoPick}
      onToggleDemoPlay={toggleDemoPlay}
      onChangeDemoSpeed={changeDemoSpeed}
      onReset={reset}
    />
  );
}

DraftAssistantPanel.propTypes = {
  players: PropTypes.array,
  scoringMode: PropTypes.string.isRequired,
  leagueId: PropTypes.string,
  userId: PropTypes.string,
};
