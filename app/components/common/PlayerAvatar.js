/**
 * PlayerAvatar Component
 * Standardized player image display with consistent sizing and fallbacks
 *
 * Sizes:
 * - xs: 24x24px (w-6 h-6) - Very compact displays
 * - sm: 32x32px (w-8 h-8) - Table rows, compact lists
 * - md: 40x40px (w-10 h-10) - Standard cards, news items
 * - lg: 48x48px (w-12 h-12) - Modal headers, featured displays
 *
 * Variants:
 * - default: No border (clean look, like Transfers tab)
 * - bordered: Gray border (border-gray-600) if needed
 * - news: Yellow border for news/alerts (border-yellow-700/50)
 * - clean: Same as default, no border
 */

import { getPlayerImageUrl, handleImageError } from '../../utils/playerImage';

// Size classes mapping to Tailwind
const SIZE_CLASSES = {
  xs: 'w-6 h-6',
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-12 h-12',
};

// Border variants - default is no border for cleaner look
const BORDER_CLASSES = {
  default: '',
  bordered: 'border-2 border-gray-600',
  news: 'border-2 border-yellow-700/50',
  clean: '',
};

export default function PlayerAvatar({
  player,
  size = 'md',
  variant = 'default',
  className = '',
  showFallback = true,
}) {
  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.md;
  const borderClass = BORDER_CLASSES[variant] || BORDER_CLASSES.default;

  // Get player name for alt text
  const playerName = player?.web_name || player?.name || player?.full_name || 'Player';

  return (
    <img
      src={getPlayerImageUrl(player)}
      alt={playerName}
      onError={handleImageError}
      className={`rounded-full object-cover flex-shrink-0 ${sizeClass} ${borderClass} ${className}`}
    />
  );
}

// Export size constants for external use
export const AVATAR_SIZES = SIZE_CLASSES;
export const AVATAR_VARIANTS = BORDER_CLASSES;
