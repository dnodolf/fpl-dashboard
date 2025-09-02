// utils/positionUtils.js
// SINGLE SOURCE OF TRUTH for all position logic
// Enhanced to handle GK vs G distinction

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
 * ENHANCED to handle both G and GK for goalkeepers
 */
export function mapSleeperPosition(position) {
  if (!position) return 'MID';
  
  const pos = position.toString().toUpperCase().trim();
  
  // ENHANCED: Handle both GK and G for goalkeepers
  if (pos === 'GK' || pos === 'G') return 'GKP';
  if (pos === 'D' || pos === 'DEF') return 'DEF';
  if (pos === 'M' || pos === 'MID') return 'MID';
  if (pos === 'F' || pos === 'FWD') return 'FWD';
  
  // Handle full position names (backup)
  if (pos.includes('GOALKEEPER') || pos.includes('KEEPER')) return 'GKP';
  if (pos.includes('DEFEND') || pos.includes('DEFENCE')) return 'DEF';
  if (pos.includes('MIDFIELD')) return 'MID';
  if (pos.includes('FORWARD') || pos.includes('ATTACK')) return 'FWD';
  
  // Log unknown positions for debugging
  console.warn(`🚨 Unknown position format: "${position}" - defaulting to MID`);
  return 'MID';
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
 * Enhanced debugging function for specific players
 */
export function debugSpecificPlayer(player, playerNameToCheck = 'ederson') {
  const playerName = (player.name || player.full_name || player.web_name || '').toLowerCase();
  
  if (playerName.includes(playerNameToCheck.toLowerCase())) {
    console.log(`\n🔍 === DEBUGGING ${playerName.toUpperCase()} ===`);
    console.log('Raw player object:', {
      sleeper_id: player.sleeper_id || player.id,
      name: player.name,
      full_name: player.full_name,
      web_name: player.web_name,
      team_abbr: player.team_abbr,
      team: player.team,
      fantasy_positions: player.fantasy_positions,
      position: player.position,
      position_id: player.position_id,
      opta_id: player.opta_id,
      fantasy_data_source: player.fantasy_data_source
    });
    
    // Test each step of position logic
    console.log('\n📋 Position Logic Test:');
    if (player.fantasy_positions && Array.isArray(player.fantasy_positions) && player.fantasy_positions.length > 0) {
      const pos = player.fantasy_positions[0];
      console.log(`  Step 1 - fantasy_positions[0]: "${pos}"`);
      console.log(`  Step 1 - mapSleeperPosition("${pos}"): "${mapSleeperPosition(pos)}"`);
    } else {
      console.log(`  Step 1 - fantasy_positions: MISSING or INVALID`);
    }
    
    if (player.position) {
      console.log(`  Step 2 - position: "${player.position}"`);
      console.log(`  Step 2 - mapSleeperPosition("${player.position}"): "${mapSleeperPosition(player.position)}"`);
    } else {
      console.log(`  Step 2 - position: MISSING`);
    }
    
    if (player.position_id) {
      console.log(`  Step 3 - position_id: ${player.position_id}`);
    } else {
      console.log(`  Step 3 - position_id: MISSING`);
    }
    
    const finalPosition = normalizePosition(player);
    console.log(`\n🎯 FINAL RESULT: ${finalPosition}`);
    console.log(`=== END DEBUGGING ===\n`);
  }
}