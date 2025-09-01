// utils/positionUtils.js
// SINGLE SOURCE OF TRUTH for all position logic
// Uses Sleeper fantasy_positions as absolute authority

/**
 * Centralized position normalization - SLEEPER AUTHORITY ONLY
 * This function is used by ALL services to ensure consistency
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
  
  // Should never reach this with proper Sleeper data
  if (debugLog) {
    console.warn(`🚨 ${playerName} has no position data available, defaulting to MID`);
  }
  
  return 'MID';
}

/**
 * Map Sleeper position codes to standard format
 * Handles both single characters (G, D, M, F) and full names
 */
export function mapSleeperPosition(position) {
  if (!position) return 'MID';
  
  const pos = position.toString().toUpperCase();
  
  // Handle Sleeper single-character codes
  if (pos === 'G') return 'GKP';
  if (pos === 'D') return 'DEF';
  if (pos === 'M') return 'MID';
  if (pos === 'F') return 'FWD';
  
  // Handle full position names (backup)
  if (pos === 'GK' || pos.includes('GOALKEEPER') || pos.includes('KEEPER')) return 'GKP';
  if (pos.includes('DEF')) return 'DEF';
  if (pos.includes('MID')) return 'MID';
  if (pos.includes('FWD') || pos.includes('FORWARD')) return 'FWD';
  
  // If unknown format, return as-is or default
  return pos.length <= 3 ? pos : 'MID';
}

/**
 * Get position for UI display (with color coding support)
 */
export function getPositionDisplayInfo(position) {
  const positionMap = {
    'GKP': { label: 'GKP', color: 'yellow' },
    'DEF': { label: 'DEF', color: 'green' },  
    'MID': { label: 'MID', color: 'blue' },
    'FWD': { label: 'FWD', color: 'red' }
  };
  
  return positionMap[position] || { label: position || 'UNK', color: 'gray' };
}

/**
 * Validate if position is valid for formations
 */
export function isValidPosition(position) {
  return ['GKP', 'DEF', 'MID', 'FWD'].includes(position);
}

/**
 * Debug function to log all position data for a player
 */
export function debugPlayerPosition(player) {
  console.log(`🔍 FULL POSITION DEBUG for ${player.name || player.full_name || 'Unknown'}:`);
  console.log({
    sleeper_fantasy_positions: player.fantasy_positions,
    sleeper_position: player.position,  
    ffh_position_id: player.position_id,
    normalized: normalizePosition(player),
    player_id: player.id || player.player_id || player.sleeper_id
  });
}