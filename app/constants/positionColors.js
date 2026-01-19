/**
 * Position Color Constants
 * Single source of truth for position-based styling across the app
 * Sleeper-inspired dark theme with consistent color palette
 */

/**
 * Base position colors following Sleeper's theme
 * GKP: Yellow | DEF: Cyan | MID: Pink | FWD: Purple
 */
export const POSITION_COLORS = {
  GKP: {
    bg: 'bg-yellow-500',
    bgDark: 'bg-yellow-600',
    text: 'text-black',
    textWhite: 'text-white',
    border: 'border-yellow-400',
    borderDark: 'border-yellow-500',
    accent: 'bg-yellow-500',
    pill: 'bg-gradient-to-r from-yellow-500 to-yellow-600'
  },
  DEF: {
    bg: 'bg-cyan-500',
    bgDark: 'bg-cyan-600',
    text: 'text-black',
    textWhite: 'text-white',
    border: 'border-cyan-400',
    borderDark: 'border-cyan-500',
    accent: 'bg-teal-500',
    pill: 'bg-gradient-to-r from-cyan-500 to-cyan-600'
  },
  MID: {
    bg: 'bg-pink-500',
    bgDark: 'bg-pink-600',
    text: 'text-white',
    textWhite: 'text-white',
    border: 'border-pink-400',
    borderDark: 'border-pink-500',
    accent: 'bg-pink-500',
    pill: 'bg-gradient-to-r from-pink-500 to-pink-600'
  },
  FWD: {
    bg: 'bg-purple-500',
    bgDark: 'bg-purple-600',
    text: 'text-white',
    textWhite: 'text-white',
    border: 'border-purple-400',
    borderDark: 'border-purple-500',
    accent: 'bg-purple-500',
    pill: 'bg-gradient-to-r from-purple-500 to-purple-600'
  }
};

/**
 * Get position badge style (for small badges/pills)
 * @param {string} position - Player position (GKP, DEF, MID, FWD, or aliases)
 * @returns {string} Tailwind CSS classes
 */
export function getPositionBadgeStyle(position) {
  const normalized = normalizePosition(position);
  const colors = POSITION_COLORS[normalized];

  if (!colors) {
    return 'bg-gray-500 text-white border-gray-400';
  }

  return `${colors.bg} ${colors.text} ${colors.border}`;
}

/**
 * Get position badge style with border (for outlined badges)
 * @param {string} position - Player position
 * @returns {string} Tailwind CSS classes with border
 */
export function getPositionBadgeWithBorder(position) {
  const normalized = normalizePosition(position);
  const colors = POSITION_COLORS[normalized];

  if (!colors) {
    return 'bg-gray-500 text-white border border-gray-400';
  }

  return `${colors.bg} ${colors.text} border ${colors.border}`;
}

/**
 * Get darker position badge style (better contrast on dark backgrounds)
 * @param {string} position - Player position
 * @returns {string} Tailwind CSS classes
 */
export function getPositionBadgeDark(position) {
  const normalized = normalizePosition(position);
  const colors = POSITION_COLORS[normalized];

  if (!colors) {
    return 'bg-gray-600 text-white border border-gray-500';
  }

  return `${colors.bgDark} ${colors.textWhite} border ${colors.borderDark}`;
}

/**
 * Get position color object (for complex styling needs)
 * @param {string} position - Player position
 * @returns {Object} Color object with all variants
 */
export function getPositionColors(position) {
  const normalized = normalizePosition(position);
  return POSITION_COLORS[normalized] || {
    bg: 'bg-gray-500',
    bgDark: 'bg-gray-600',
    text: 'text-white',
    textWhite: 'text-white',
    border: 'border-gray-400',
    borderDark: 'border-gray-500',
    accent: 'bg-gray-500',
    pill: 'bg-gray-500'
  };
}

/**
 * Normalize position aliases to standard format
 * @param {string} position - Position string (may be GKP, GK, G, etc.)
 * @returns {string} Normalized position (GKP, DEF, MID, FWD)
 */
function normalizePosition(position) {
  if (!position) return 'GKP';

  const pos = position.toUpperCase();

  // GKP aliases
  if (pos === 'GKP' || pos === 'GK' || pos === 'G') return 'GKP';

  // DEF aliases
  if (pos === 'DEF' || pos === 'D') return 'DEF';

  // MID aliases
  if (pos === 'MID' || pos === 'M') return 'MID';

  // FWD aliases
  if (pos === 'FWD' || pos === 'F') return 'FWD';

  return pos;
}

/**
 * Get Sleeper position badge style for standard badges
 * Used by: page.js, HomeTabContent.js
 * Returns full CSS string for position badges (px-2 py-0.5)
 */
export function getSleeperPositionStyle(position) {
  const baseClasses = 'inline-flex items-center px-2 py-0.5 rounded text-xs font-bold border';
  const badgeStyle = getPositionBadgeWithBorder(position);
  return `${baseClasses} ${badgeStyle}`;
}

/**
 * Get Sleeper position badge style for player cards (smaller padding)
 * Used by: OptimizerTabContent.js
 * Returns full CSS string for position badges in cards (px-1.5 py-0.5)
 */
export function getSleeperPositionCardStyle(position) {
  const baseClasses = 'inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium border';
  const badgeStyle = getPositionBadgeWithBorder(position);
  return `${baseClasses} ${badgeStyle}`;
}
