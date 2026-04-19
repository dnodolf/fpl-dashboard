'use client';

/**
 * MockDraftTab — wrapper component that owns useMockDraft state.
 *
 * Extracted from DraftTabContent so the hook only runs when the
 * Mock Draft sub-tab is actually active (lazy mount pattern).
 */

import PropTypes from 'prop-types';
import { useMockDraft } from '../../hooks/useMockDraft';
import MockDraftSetup from './MockDraftSetup';
import MockDraftBoard from './MockDraftBoard';
import MockDraftResults from './MockDraftResults';

export default function MockDraftTab({ players, scoringMode }) {
  const {
    phase,
    settings,
    draftState,
    results,
    rankedPlayers,
    availablePlayers,
    allRosters,
    myRoster,
    currentPickInfo,
    isMyTurn,
    takenIds,
    myPickSlotsPreview,
    draftHistory,
    getAvailabilityAtNextPick,
    updateSettings,
    startMockDraft,
    makeMyPick,
    autoPickBest,
    undoLastPick,
    resetMock,
  } = useMockDraft(players, scoringMode);

  if (phase === 'idle') {
    return (
      <MockDraftSetup
        settings={settings}
        updateSettings={updateSettings}
        onStart={startMockDraft}
        draftHistory={draftHistory}
        myPickSlots={myPickSlotsPreview}
        isLoading={!players?.length}
      />
    );
  }

  if (phase === 'drafting') {
    return (
      <MockDraftBoard
        draftState={draftState}
        phase={phase}
        settings={settings}
        availablePlayers={availablePlayers}
        allRosters={allRosters}
        myRoster={myRoster}
        currentPickInfo={currentPickInfo}
        isMyTurn={isMyTurn}
        takenIds={takenIds}
        rankedPlayers={rankedPlayers}
        getAvailabilityAtNextPick={getAvailabilityAtNextPick}
        onMakeMyPick={makeMyPick}
        onAutoPick={autoPickBest}
        onUndo={undoLastPick}
        onReset={resetMock}
      />
    );
  }

  return (
    <MockDraftResults
      results={results}
      settings={settings}
      draftState={draftState}
      onPlayAgain={resetMock}
      onReset={resetMock}
    />
  );
}

MockDraftTab.propTypes = {
  players: PropTypes.array,
  scoringMode: PropTypes.string.isRequired,
};
