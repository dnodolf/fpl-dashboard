// utils/positionUtils.js - UPDATED WITH BETTER CONTRAST COLORS
// SINGLE SOURCE OF TRUTH for all position logic

/**
 * Centralized position normalization - SLEEPER AUTHORITY ONLY
 */
export function normalizePosition(player, debugLog = false) {
  const playerName = player.name || player.full_name || player.web_name || 'Unknown';
  
  if (debugLog) {
    console.log(`🎯 POSITION DEBUG for ${playerName}:`, {
      fantasy_positions: player.fantasy_positions,
      position: player.position,
      position_id: player.position_id,
      team: player.team || player.team_abbr
    });
  }
  
  // Priority 1: Sleeper fantasy_positions (ABSOLUTE AUTHORITY)
  if (player.fantasy_positions && Array.isArray(player.fantasy_positions) && player.fantasy_positions.length > 0) {
    const pos = player.fantasy_positions[0];
    const normalized = mapSleeperPosition(pos);
    
    if (debugLog) {
      console.log(`✅ ${playerName} normalized to ${normalized} from fantasy_positions[0] = '${pos}'`);
    }
    
    return normalized;
  }
  
  // Priority 2: Sleeper position string (backup)
  if (player.position) {
    const pos = player.position.toString();
    const normalized = mapSleeperPosition(pos);
    
    if (debugLog) {
      console.log(`✅ ${playerName} normalized to ${normalized} from position = '${pos}'`);
    }
    
    return normalized;
  }
  
  // Priority 3: FFH position_id (only used if no Sleeper data available)
  if (player.position_id) {
    const ffhPositionMap = { 1: 'GKP', 2: 'DEF', 3: 'MID', 4: 'FWD' };
    const normalized = ffhPositionMap[player.position_id] || 'MID';
    
    if (debugLog) {
      console.log(`⚠️ ${playerName} using FFH fallback: position_id ${player.position_id} -> ${normalized}`);
    }
    
    return normalized;
  }
  
  if (debugLog) {
    console.warn(`🚨 ${playerName} has no position data available, defaulting to MID`);
  }
  
  return 'MID';
}

/**
 * Map Sleeper position codes to standard format
 */
export function mapSleeperPosition(position) {
  if (!position) return 'MID';
  
  const pos = position.toString().toUpperCase().trim();
  
  if (pos === 'GK' || pos === 'G') return 'GKP';
  if (pos === 'D' || pos === 'DEF') return 'DEF';
  if (pos === 'M' || pos === 'MID') return 'MID';
  if (pos === 'F' || pos === 'FWD') return 'FWD';
  
  // Handle full position names (backup)
  if (pos.includes('GOALKEEPER') || pos.includes('KEEPER')) return 'GKP';
  if (pos.includes('DEFEND') || pos.includes('DEFENCE')) return 'DEF';
  if (pos.includes('MIDFIELD')) return 'MID';
  if (pos.includes('FORWARD') || pos.includes('ATTACK')) return 'FWD';
  
  console.warn(`🚨 Unknown position format: "${position}" - listing as UNKNOWN`);
  return 'UNKNOWN';
}

/**
 * Get position for UI display with BETTER CONTRAST SLEEPER COLOR SCHEME
 */
export function getPositionDisplayInfo(position) {
  const positionMap = {
    'GKP': { label: 'GKP', color: 'sleeper-gkp', hex: '#f0be4d' },
    'DEF': { label: 'DEF', color: 'sleeper-def', hex: '#63c0d6' },  
    'MID': { label: 'MID', color: 'sleeper-mid', hex: '#f38699' },
    'FWD': { label: 'FWD', color: 'sleeper-fwd', hex: '#a8427f' }
  };
  
  return positionMap[position] || { label: position || 'UNK', color: 'gray', hex: '#6b7280' };
}

/**
 * Get Sleeper position badge classes with BETTER CONTRAST
 * Uses more vibrant colors that match the optimizer tab
 */
export function getSleeperPositionBadgeClasses(position) {
  switch (position) {
    case 'GKP':
    case 'GK':
    case 'G':
      return 'bg-yellow-500 text-black border border-yellow-400';
    case 'DEF':
    case 'D':
      return 'bg-cyan-500 text-black border border-cyan-400';
    case 'MID':
    case 'M':
      return 'bg-pink-500 text-white border border-pink-400';
    case 'FWD':
    case 'F':
      return 'bg-purple-500 text-white border border-purple-400';
    default:
      return 'bg-gray-500 text-white border border-gray-400';
  }
}

/**
 * Get Sleeper position style with better contrast colors
 * Enhanced contrast styling
 */
export function getSleeperPositionStyle(position) {
  const styles = {
    backgroundColor: '',
    color: '',
    borderColor: ''
  };

  switch (position) {
    case 'GKP':
    case 'GK':
    case 'G':
      styles.backgroundColor = '#eab308'; // yellow-500
      styles.color = '#000000';
      styles.borderColor = '#facc15'; // yellow-400
      break;
    case 'DEF':
    case 'D':
      styles.backgroundColor = '#06b6d4'; // cyan-500
      styles.color = '#000000';
      styles.borderColor = '#22d3ee'; // cyan-400
      break;
    case 'MID':
    case 'M':
      styles.backgroundColor = '#ec4899'; // pink-500
      styles.color = '#ffffff';
      styles.borderColor = '#f472b6'; // pink-400
      break;
    case 'FWD':
    case 'F':
      styles.backgroundColor = '#a855f7'; // purple-500
      styles.color = '#ffffff';
      styles.borderColor = '#c084fc'; // purple-400
      break;
    default:
      styles.backgroundColor = '#6b7280'; // gray-500
      styles.color = '#ffffff';
      styles.borderColor = '#9ca3af'; // gray-400
  }

  return styles;
}

/**
 * Validate if position is valid for formations
 */
export function isValidPosition(position) {
  return ['GKP', 'DEF', 'MID', 'FWD'].includes(position);
}