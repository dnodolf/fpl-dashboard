/**
 * Design Tokens - Single Source of Truth
 * All colors, spacing, typography should reference these tokens
 *
 * Usage:
 * import { COLORS, TYPOGRAPHY, SPACING, COMPONENTS } from '../constants/designTokens';
 * className={`${COMPONENTS.card.base} ${SPACING.padding.md}`}
 */

// ==================== COLORS ====================

export const COLORS = {
  // Grays (Dark Theme)
  gray: {
    bg: {
      app: 'bg-gray-900',        // Main app background
      primary: 'bg-gray-800',    // Primary cards/containers
      secondary: 'bg-gray-700',  // Secondary cards, inputs, selects
      tertiary: 'bg-gray-600',   // Borders, hover states
    },
    text: {
      primary: 'text-white',     // High emphasis
      secondary: 'text-gray-300', // Medium emphasis
      tertiary: 'text-gray-400',  // Low emphasis (MOST COMMON)
      disabled: 'text-gray-500',  // Disabled/muted
    },
    border: {
      primary: 'border-gray-700', // Primary borders
      secondary: 'border-gray-600', // Secondary borders
    },
    hover: 'hover:bg-gray-700',  // Standard hover state for rows/cards
    hoverSecondary: 'hover:bg-gray-600', // Hover for already gray-700 elements
  },

  // Primary Actions (Blue)
  primary: {
    bg: 'bg-blue-500',
    bgHover: 'hover:bg-blue-600',
    bgDark: 'bg-blue-700',
    text: 'text-blue-400',
    textLight: 'text-blue-100',
    border: 'border-blue-500',
    ring: 'ring-blue-500',
  },

  // Success/Positive (Green)
  success: {
    bg: 'bg-green-500',
    bgHover: 'hover:bg-green-600',
    bgDark: 'bg-green-600',
    text: 'text-green-400',
    light: {
      bg: 'bg-green-100',
      text: 'text-green-800',
      border: 'border-green-300',
    }
  },

  // Error/Negative (Red)
  error: {
    bg: 'bg-red-500',
    bgHover: 'hover:bg-red-600',
    bgDark: 'bg-red-600',
    text: 'text-red-400',
  },

  // Warning (Yellow)
  warning: {
    bg: 'bg-yellow-500',
    bgHover: 'hover:bg-yellow-600',
    bgDark: 'bg-yellow-600',
    text: 'text-yellow-400',
    border: 'border-yellow-700',
    bgLight: 'bg-yellow-900/20',
    borderLight: 'border-yellow-700/50',
  },

  // Info/Secondary (Purple)
  info: {
    bg: 'bg-purple-500',
    bgHover: 'hover:bg-purple-600',
    bgDark: 'bg-purple-600',
    text: 'text-purple-400',
  },

  // Ownership badges
  ownership: {
    mine: {
      bg: 'bg-indigo-100',
      text: 'text-indigo-900',
      border: 'border-indigo-400',
    },
    other: {
      bg: 'bg-orange-100',
      text: 'text-orange-900',
      border: 'border-orange-400',
    },
    freeAgent: {
      bg: 'bg-green-100',
      text: 'text-green-800',
      border: 'border-green-300',
    }
  },
};

// Difficulty scale (1-5) - Centralized from 4 duplicate functions
const DIFFICULTY_COLORS = {
  1: 'bg-green-500 text-white',      // Easiest - Very favorable
  2: 'bg-green-400 text-black',      // Easy - Favorable
  3: 'bg-yellow-500 text-black',     // Medium - Neutral
  4: 'bg-orange-500 text-white',     // Hard - Difficult
  5: 'bg-red-500 text-white',        // Hardest - Very difficult
  default: 'bg-gray-500 text-white', // Unknown/No data
};

// ==================== TYPOGRAPHY ====================

export const TYPOGRAPHY = {
  size: {
    xs: 'text-xs',      // 12px - Labels, badges, table headers
    sm: 'text-sm',      // 14px - Body text, secondary info
    base: 'text-base',  // 16px - Default text
    lg: 'text-lg',      // 18px - Section headers
    xl: 'text-xl',      // 20px - Page headers
    '2xl': 'text-2xl',  // 24px - Large stats
    '3xl': 'text-3xl',  // 30px - Hero text
    '4xl': 'text-4xl',  // 36px - Large icons/emojis
  },
  weight: {
    normal: 'font-normal',
    medium: 'font-medium',
    semibold: 'font-semibold',
    bold: 'font-bold',
  },
  // Common combinations
  badge: 'text-xs font-bold',
  tableHeader: 'text-xs font-medium uppercase tracking-wider',
  cardHeader: 'text-lg font-bold',
  sectionHeader: 'text-xl font-bold',
  pageHeader: 'text-3xl font-bold',
  stat: 'text-2xl font-bold',
  body: 'text-sm font-medium',
  bodySecondary: 'text-sm text-gray-400',
  caption: 'text-xs text-gray-400',
};

// ==================== SPACING ====================

export const SPACING = {
  padding: {
    xs: 'p-2',   // 8px - Tight padding
    sm: 'p-3',   // 12px - Small padding
    md: 'p-4',   // 16px - Medium padding (cards)
    lg: 'p-6',   // 24px - Large padding (modals, pages)
    xl: 'p-8',   // 32px - Extra large padding
  },
  paddingX: {
    xs: 'px-2',
    sm: 'px-3',
    md: 'px-4',
    lg: 'px-6',
  },
  paddingY: {
    xs: 'py-1',
    sm: 'py-2',
    md: 'py-3',
    lg: 'py-4',
  },
  gap: {
    xs: 'gap-1',   // 4px - Tight inline elements
    sm: 'gap-2',   // 8px - Default inline spacing
    md: 'gap-3',   // 12px - Medium spacing
    lg: 'gap-4',   // 16px - Large spacing (grid columns)
    xl: 'gap-6',   // 24px - Extra large spacing
  },
  space: {
    xs: 'space-y-2',  // Tight vertical spacing
    sm: 'space-y-3',  // Small vertical spacing
    md: 'space-y-4',  // Medium vertical spacing
    lg: 'space-y-6',  // Large vertical spacing
  }
};

// ==================== BORDERS ====================

export const BORDERS = {
  radius: {
    sm: 'rounded',        // Small radius
    md: 'rounded-md',     // Medium radius
    lg: 'rounded-lg',     // Large radius (default for cards)
    full: 'rounded-full', // Circular (avatars, pills)
    top: 'rounded-t-lg',  // Top-only rounded
  },
  width: {
    default: 'border',     // 1px border
    thick: 'border-2',     // 2px border
  }
};

// ==================== COMPONENT PATTERNS ====================

export const COMPONENTS = {
  // Card patterns
  card: {
    base: `${COLORS.gray.bg.primary} border ${COLORS.gray.border.primary} ${BORDERS.radius.lg}`,
    withShadow: `${COLORS.gray.bg.primary} border ${COLORS.gray.border.primary} ${BORDERS.radius.lg} shadow-sm`,
    gradient: `bg-gradient-to-r from-blue-600 to-purple-600 ${BORDERS.radius.lg} shadow-lg`,
    gradientDark: `bg-gradient-to-r from-blue-900 to-purple-900`,
    nested: `bg-gray-900/50 ${BORDERS.radius.lg}`,
  },

  // Button patterns
  button: {
    primary: `${COLORS.primary.bg} ${COLORS.primary.bgHover} ${COLORS.gray.text.primary} ${TYPOGRAPHY.weight.medium} ${BORDERS.radius.lg} transition-colors`,
    secondary: `${COLORS.gray.bg.secondary} ${COLORS.gray.hoverSecondary} text-gray-300 ${TYPOGRAPHY.weight.medium} ${BORDERS.radius.lg} transition-colors`,
    danger: `${COLORS.error.bg} ${COLORS.error.bgHover} ${COLORS.gray.text.primary} ${TYPOGRAPHY.weight.medium} ${BORDERS.radius.lg} transition-colors`,
    padding: {
      sm: 'px-3 py-1',      // Small buttons (toggles)
      md: 'px-4 py-2',      // Standard buttons
    }
  },

  // Input/Select patterns
  input: {
    base: `w-full px-3 py-2 ${COLORS.gray.bg.secondary} ${COLORS.gray.text.primary} ${BORDERS.radius.sm} border ${COLORS.gray.border.secondary}`,
    focus: `focus:outline-none focus:ring-2 focus:${COLORS.primary.ring} focus:border-transparent`,
  },

  // Table patterns
  table: {
    container: `${BORDERS.radius.lg} border overflow-hidden ${COLORS.gray.bg.primary} ${COLORS.gray.border.primary}`,
    header: COLORS.gray.bg.secondary,
    headerCell: `px-4 py-3 text-left ${TYPOGRAPHY.tableHeader} text-gray-300 cursor-pointer ${COLORS.gray.hoverSecondary}`,
    body: `divide-y ${COLORS.gray.bg.primary} divide-gray-700`,
    row: COLORS.gray.hover,
    cell: 'px-4 py-3',
  },

  // Badge patterns
  badge: {
    base: `inline-flex items-center px-2.5 py-0.5 ${BORDERS.radius.full} ${TYPOGRAPHY.badge}`,
    withBorder: `inline-flex items-center px-2.5 py-0.5 ${BORDERS.radius.full} ${TYPOGRAPHY.badge} border`,
    small: `inline-flex items-center px-2 py-0.5 ${BORDERS.radius.full} ${TYPOGRAPHY.badge}`,
  },

  // Modal patterns
  modal: {
    overlay: 'fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75',
    content: `${COLORS.gray.bg.primary} ${BORDERS.radius.lg} shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto mx-4`,
    header: `${COMPONENTS.card.gradientDark} p-6 ${BORDERS.radius.top}`,
  },

  // Empty state patterns
  empty: {
    container: `${SPACING.padding.xl} text-center border-2 border-dashed ${BORDERS.radius.lg} ${COLORS.gray.bg.primary} border-gray-600 text-gray-400`,
    icon: 'text-4xl mb-2',
  }
};

// ==================== SIZES ====================

export const SIZES = {
  avatar: {
    xs: 'w-6 h-6',   // 24px - Tiny icons
    sm: 'w-8 h-8',   // 32px - Small avatars (roster)
    md: 'w-10 h-10', // 40px - Standard avatars (default)
    lg: 'w-12 h-12', // 48px - Large avatars
  },
  icon: {
    sm: 'w-4 h-4',   // 16px - Small icons
    md: 'w-6 h-6',   // 24px - Medium icons
    lg: 'w-8 h-8',   // 32px - Large icons
  },
  badge: {
    sm: 'w-6 h-6',   // 24px - Small badges
    md: 'w-8 h-8',   // 32px - Medium badges
  }
};

// ==================== HELPER FUNCTIONS ====================

/**
 * Get difficulty color based on rating (1-5)
 * Centralized from 4 duplicate implementations:
 * - ComparisonTabContent.js
 * - PlayerModal.js
 * - TransferPairRecommendations.js
 * - MyPlayersTable.js
 *
 * @param {number|string} difficulty - Difficulty rating (1-5)
 * @returns {string} Tailwind CSS classes for background and text color
 */
export function getDifficultyColor(difficulty) {
  if (difficulty === 'N/A' || difficulty === null || difficulty === undefined) {
    return DIFFICULTY_COLORS.default;
  }

  const num = typeof difficulty === 'number' ? difficulty : parseFloat(difficulty);

  if (isNaN(num)) return DIFFICULTY_COLORS.default;

  // Map difficulty ranges to color levels
  if (num <= 1.5) return DIFFICULTY_COLORS[1];
  if (num <= 2.5) return DIFFICULTY_COLORS[2];
  if (num <= 3.5) return DIFFICULTY_COLORS[3];
  if (num <= 4.5) return DIFFICULTY_COLORS[4];
  return DIFFICULTY_COLORS[5];
}

/**
 * Get ownership badge classes based on owner ID
 * Standardizes ownership badge styling across components
 *
 * @param {string} ownerId - Owner ID or 'Free Agent'
 * @param {string} userId - Current user's ID
 * @returns {string} Tailwind CSS classes for ownership badge
 */
export function getOwnershipBadge(ownerId, userId) {
  if (ownerId === userId) {
    const { bg, text, border } = COLORS.ownership.mine;
    return `${COMPONENTS.badge.withBorder} ${bg} ${text} ${border}`;
  }
  if (!ownerId || ownerId === 'Free Agent') {
    const { bg, text, border } = COLORS.ownership.freeAgent;
    return `${COMPONENTS.badge.withBorder} ${bg} ${text} ${border}`;
  }
  const { bg, text, border } = COLORS.ownership.other;
  return `${COMPONENTS.badge.withBorder} ${bg} ${text} ${border}`;
}

/**
 * Get transition classes for common animations
 * @param {string} property - CSS property to transition (default: 'colors')
 * @returns {string} Transition classes
 */
export function getTransition(property = 'colors') {
  return `transition-${property}`;
}
