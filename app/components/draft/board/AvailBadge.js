'use client';

/**
 * AvailBadge — Monte Carlo availability probability badge.
 * Only rendered when prob is in the actionable 5–95% range.
 * Green = safe to wait, Amber = borderline, Red = take now.
 */

import PropTypes from 'prop-types';

export default function AvailBadge({ prob }) {
  if (prob === null || prob === undefined) return null;
  const pct = Math.round(prob * 100);
  if (pct < 5 || pct > 95) return null;

  const style =
    pct >= 75 ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
    pct >= 35 ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' :
               'bg-red-500/20 text-red-400 border-red-500/30';

  return (
    <span
      className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${style}`}
      title={`${pct}% chance still available at your next pick`}
    >
      {pct}%
    </span>
  );
}

AvailBadge.propTypes = {
  prob: PropTypes.number,
};
