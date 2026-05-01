/**
 * Position Color Constants — Sleeper brand palette
 * FWD #FF6482 · MID #C96CFF · DEF #00D7FF · GKP #FF7900 · BENCH #98B3D6
 *
 * All four colors are high-luminance on dark backgrounds.
 * Use text-black (not text-white) whenever these are badge backgrounds.
 * Contrast ratios vs black: FWD 7.8:1 · MID 7.6:1 · DEF 12.5:1 · GKP 8.3:1 (all AAA)
 */

export const POSITION_HEX = {
  FWD:   '#FF6482',
  MID:   '#C96CFF',
  DEF:   '#00D7FF',
  GKP:   '#FF7900',
  BENCH: '#98B3D6',
};

export const POSITION_COLORS = {
  GKP: {
    bg:        'bg-[#FF7900]',
    bgDark:    'bg-[#CC6100]',
    text:      'text-black',
    textColor: 'text-[#FF7900]',
    border:    'border-[#FF7900]',
    borderDark:'border-[#CC6100]',
    accent:    'bg-[#FF7900]',
    pill:      'bg-[#FF7900]',
  },
  DEF: {
    bg:        'bg-[#00D7FF]',
    bgDark:    'bg-[#00ADCC]',
    text:      'text-black',
    textColor: 'text-[#00D7FF]',
    border:    'border-[#00D7FF]',
    borderDark:'border-[#00ADCC]',
    accent:    'bg-[#00D7FF]',
    pill:      'bg-[#00D7FF]',
  },
  MID: {
    bg:        'bg-[#C96CFF]',
    bgDark:    'bg-[#A050D0]',
    text:      'text-black',
    textColor: 'text-[#C96CFF]',
    border:    'border-[#C96CFF]',
    borderDark:'border-[#A050D0]',
    accent:    'bg-[#C96CFF]',
    pill:      'bg-[#C96CFF]',
  },
  FWD: {
    bg:        'bg-[#FF6482]',
    bgDark:    'bg-[#CC4562]',
    text:      'text-black',
    textColor: 'text-[#FF6482]',
    border:    'border-[#FF6482]',
    borderDark:'border-[#CC4562]',
    accent:    'bg-[#FF6482]',
    pill:      'bg-[#FF6482]',
  },
};

function normalizePosition(position) {
  if (!position) return 'GKP';
  const pos = position.toUpperCase();
  if (pos === 'GKP' || pos === 'GK' || pos === 'G') return 'GKP';
  if (pos === 'DEF' || pos === 'D') return 'DEF';
  if (pos === 'MID' || pos === 'M') return 'MID';
  if (pos === 'FWD' || pos === 'F') return 'FWD';
  return pos;
}

export function getPositionColors(position) {
  const normalized = normalizePosition(position);
  return POSITION_COLORS[normalized] || {
    bg: 'bg-slate-500', bgDark: 'bg-slate-600', text: 'text-white',
    textColor: 'text-slate-400', border: 'border-slate-400',
    borderDark: 'border-slate-500', accent: 'bg-slate-500', pill: 'bg-slate-500',
  };
}

/** Player name / inline text color (on dark background) */
export function getPositionTextColor(position) {
  const normalized = normalizePosition(position);
  switch (normalized) {
    case 'GKP': return 'text-[#FF7900]';
    case 'DEF': return 'text-[#00D7FF]';
    case 'MID': return 'text-[#C96CFF]';
    case 'FWD': return 'text-[#FF6482]';
    default:    return 'text-slate-400';
  }
}

/** Solid badge — brand color bg + black text (all pass WCAG AAA with black) */
export function getPositionBadgeStyle(position) {
  const c = getPositionColors(normalizePosition(position));
  return `${c.bg} text-black ${c.border}`;
}

export function getPositionBadgeWithBorder(position) {
  const c = getPositionColors(normalizePosition(position));
  return `${c.bg} text-black border ${c.border}`;
}

export function getPositionBadgeDark(position) {
  const c = getPositionColors(normalizePosition(position));
  return `${c.bgDark} text-black border ${c.borderDark}`;
}

/** Full badge class string including sizing/shape — drop-in for className */
export function getSleeperPositionStyle(position) {
  return `inline-flex items-center px-2 py-0.5 rounded text-xs font-bold border ${getPositionBadgeWithBorder(position)}`;
}

export function getSleeperPositionCardStyle(position) {
  return `inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium border ${getPositionBadgeWithBorder(position)}`;
}

/** Subtle gradient for position-tinted card backgrounds */
export function getPositionGradientClasses(position) {
  const normalized = normalizePosition(position);
  switch (normalized) {
    case 'GKP': return 'from-[#FF7900]/20 to-[#FF7900]/5';
    case 'DEF': return 'from-[#00D7FF]/20 to-[#00D7FF]/5';
    case 'MID': return 'from-[#C96CFF]/20 to-[#C96CFF]/5';
    case 'FWD': return 'from-[#FF6482]/20 to-[#FF6482]/5';
    default:    return 'from-slate-700/20 to-slate-700/5';
  }
}
