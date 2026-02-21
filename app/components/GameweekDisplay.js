'use client';

import { getGameweekStatusStyles } from '../utils/gameweekStyles';

const GameweekDisplay = ({ gameweek }) => {
  const styles = getGameweekStatusStyles(gameweek.status);

  const handleGameweekClick = () => {
    const fixturesUrl = `https://fantasy.premierleague.com/fixtures/${gameweek.number}`;
    window.open(fixturesUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <button
      onClick={handleGameweekClick}
      className={`${styles.bg} ${styles.hover} border rounded-lg px-3 py-2 transition-all duration-200 cursor-pointer transform hover:scale-105 active:scale-95`}
      title={`Click to view GW${gameweek.number} fixtures on Premier League website`}
    >
      <div className={`text-sm font-medium ${styles.text} flex items-center gap-1`}>
        {styles.icon} GW {gameweek.number} ({gameweek.status === 'upcoming' ? 'Upcoming' : gameweek.status === 'live' ? 'Live' : 'Completed'})
        <span className="text-xs opacity-70 ml-1">🔗</span>
      </div>
      <div className={`text-xs ${styles.subText}`}>
        {gameweek.status === 'upcoming' ? 'Starts' : gameweek.status === 'live' ? 'Ends' : 'Finished'}: {gameweek.date}
        {gameweek.deadlineFormatted && gameweek.status === 'upcoming' && (
          <div className="mt-1">Deadline: {gameweek.deadlineFormatted}</div>
        )}
        {gameweek.source && gameweek.source !== 'fpl_api' && (
          <div className="mt-1 opacity-75">⚠️ {gameweek.source}</div>
        )}
        <div className="mt-1 text-xs opacity-60">Click to view fixtures</div>
      </div>
    </button>
  );
};

export default GameweekDisplay;
