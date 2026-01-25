'use client';

/**
 * App Logo - Fantasy FC Playbook
 * Clean design: Clipboard with soccer pitch
 */
export function AppLogo({ size = 32, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="boardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#A16207" />
          <stop offset="100%" stopColor="#78350F" />
        </linearGradient>
        <linearGradient id="pitchGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#22C55E" />
          <stop offset="100%" stopColor="#16A34A" />
        </linearGradient>
      </defs>

      {/* Clipboard background */}
      <rect x="6" y="8" width="52" height="52" rx="4" fill="url(#boardGrad)" />

      {/* Clipboard clip */}
      <rect x="20" y="2" width="24" height="10" rx="3" fill="#475569" />
      <rect x="24" y="4" width="16" height="6" rx="2" fill="#64748B" />

      {/* Soccer pitch */}
      <rect x="10" y="14" width="44" height="42" rx="2" fill="url(#pitchGrad)" />

      {/* Pitch markings */}
      <g stroke="white" strokeWidth="1.5" strokeOpacity="0.8">
        {/* Outline */}
        <rect x="12" y="16" width="40" height="38" rx="1" fill="none" />

        {/* Center line */}
        <line x1="12" y1="35" x2="52" y2="35" />

        {/* Center circle */}
        <circle cx="32" cy="35" r="6" fill="none" />

        {/* Center dot */}
        <circle cx="32" cy="35" r="1.5" fill="white" fillOpacity="0.8" />

        {/* Top penalty box */}
        <rect x="20" y="16" width="24" height="10" fill="none" />

        {/* Top goal box */}
        <rect x="26" y="16" width="12" height="5" fill="none" />

        {/* Top penalty arc */}
        <path d="M24 26 Q32 30 40 26" fill="none" />

        {/* Bottom penalty box */}
        <rect x="20" y="44" width="24" height="10" fill="none" />

        {/* Bottom goal box */}
        <rect x="26" y="49" width="12" height="5" fill="none" />

        {/* Bottom penalty arc */}
        <path d="M24 44 Q32 40 40 44" fill="none" />

        {/* Corner arcs */}
        <path d="M12 18 Q14 16 16 16" fill="none" />
        <path d="M48 16 Q50 16 52 18" fill="none" />
        <path d="M12 52 Q14 54 16 54" fill="none" />
        <path d="M48 54 Q50 54 52 52" fill="none" />
      </g>
    </svg>
  );
}

export default AppLogo;
