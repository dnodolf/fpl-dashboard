/**
 * PositionBadge — reusable position pill.
 *
 * Replaces the ~21 hand-rolled
 *   `px-1 py-0.5 rounded text-[10px] font-bold border ${getPositionBadgeStyle(pos)}`
 * call sites scattered across the draft and analysis components.
 *
 * Props
 *  position  — player position string (GKP / DEF / MID / FWD and aliases)
 *  size      — 'sm' (default) | 'md' | 'lg'
 *              sm  →  px-1   py-0.5  text-[10px]
 *              md  →  px-1.5 py-0.5  text-[10px]
 *              lg  →  px-2   py-0.5  text-xs
 *  label     — override the displayed text (defaults to position string)
 *  className — additional Tailwind classes (e.g. 'opacity-60')
 */

import PropTypes from 'prop-types';
import { getPositionBadgeStyle } from '../../constants/positionColors';

const SIZE_CLASSES = {
  sm: 'px-1   py-0.5 text-[10px]',
  md: 'px-1.5 py-0.5 text-[10px]',
  lg: 'px-2   py-0.5 text-xs',
};

export default function PositionBadge({ position, size = 'sm', label, className = '' }) {
  const colorClasses = getPositionBadgeStyle(position);
  const sizeClasses = SIZE_CLASSES[size] ?? SIZE_CLASSES.sm;
  const display = label !== undefined ? label : (position || '').toUpperCase();

  return (
    <span className={`rounded font-bold border ${sizeClasses} ${colorClasses} ${className}`.trim()}>
      {display}
    </span>
  );
}

PositionBadge.propTypes = {
  position: PropTypes.string.isRequired,
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  label: PropTypes.string,
  className: PropTypes.string,
};
