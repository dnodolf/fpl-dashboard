// app/utils/newsUtils.js
// Centralized news/injury display utilities

/**
 * Convert ISO timestamp to relative time string ("2h ago", "3d ago")
 */
export function timeAgo(isoTimestamp) {
  if (!isoTimestamp) return '';

  const now = new Date();
  const then = new Date(isoTimestamp);
  const diffMs = now - then;

  if (diffMs < 0) return '';

  const minutes = Math.floor(diffMs / (1000 * 60));
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

/**
 * Map FPL status character to structured status object.
 * More precise than regex parsing of news text.
 */
export function getFPLStatusBadge(fplStatus) {
  switch (fplStatus) {
    case 'i': return { badge: 'INJURED',      color: 'bg-red-500 text-white',   icon: '🏥' };
    case 'd': return { badge: 'DOUBTFUL',     color: 'bg-orange-500 text-white', icon: '⚠️' };
    case 's': return { badge: 'SUSPENDED',    color: 'bg-red-600 text-white',   icon: '🚫' };
    case 'u': return { badge: 'UNAVAILABLE',  color: 'bg-gray-500 text-white',  icon: '❌' };
    case 'n': return { badge: 'NOT IN SQUAD', color: 'bg-gray-600 text-white',  icon: '➖' };
    case 'a': return null; // Available - no badge needed
    default:  return null;
  }
}
