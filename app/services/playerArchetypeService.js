// app/services/playerArchetypeService.js
// Player archetype classification for enhanced V3 scoring

import archetypeData from '../data/playerArchetypes.json';
import { getV3ConversionRatio } from './v3/conversionRatios';

/**
 * Get player archetype and associated conversion ratio
 * Falls back to position-based ratio if player not found
 */
export function getPlayerArchetype(player) {
  if (!player) {
    return { archetype: 'unknown', ratio: 1.0, source: 'fallback' };
  }

  const position = player.position || 'MID';
  const playerName = (player.name || player.full_name || player.web_name || '').trim();

  if (!playerName || !archetypeData.playerMappings[position]) {
    return {
      archetype: 'unknown',
      ratio: getDefaultPositionRatio(position),
      source: 'position_fallback'
    };
  }

  // Search through all archetypes for this position
  const positionArchetypes = archetypeData.playerMappings[position];

  for (const [archetypeName, playerList] of Object.entries(positionArchetypes)) {
    // Check for name match (case-insensitive, handles partial matches)
    const found = playerList.some(mappedName => {
      const normalizedMapped = mappedName.toLowerCase().replace(/[^\w\s]/g, '');
      const normalizedPlayer = playerName.toLowerCase().replace(/[^\w\s]/g, '');

      // Check if names match or if one contains the other
      return normalizedMapped === normalizedPlayer ||
             normalizedMapped.includes(normalizedPlayer) ||
             normalizedPlayer.includes(normalizedMapped);
    });

    if (found) {
      const archetypeInfo = archetypeData.archetypes[position][archetypeName];
      return {
        archetype: archetypeName,
        ratio: archetypeInfo.ratio,
        description: archetypeInfo.description,
        source: 'archetype_mapping'
      };
    }
  }

  // Player not found in mappings - use position default
  return {
    archetype: 'default_' + position.toLowerCase(),
    ratio: getDefaultPositionRatio(position),
    source: 'position_default'
  };
}

/**
 * Default position-based ratios (fallback when no archetype found)
 */
function getDefaultPositionRatio(position) {
  return getV3ConversionRatio(position);
}

/**
 * Get all players for a specific archetype
 */
export function getPlayersByArchetype(position, archetype) {
  if (!archetypeData.playerMappings[position] || !archetypeData.playerMappings[position][archetype]) {
    return [];
  }
  return archetypeData.playerMappings[position][archetype];
}

/**
 * Get archetype statistics for a set of players
 */
export function getArchetypeStats(players) {
  const stats = {
    totalPlayers: players.length,
    withArchetype: 0,
    byArchetype: {},
    bySource: {
      archetype_mapping: 0,
      position_default: 0,
      position_fallback: 0
    }
  };

  players.forEach(player => {
    const archetypeInfo = getPlayerArchetype(player);

    stats.bySource[archetypeInfo.source]++;

    if (archetypeInfo.source === 'archetype_mapping') {
      stats.withArchetype++;

      const key = `${player.position}_${archetypeInfo.archetype}`;
      if (!stats.byArchetype[key]) {
        stats.byArchetype[key] = 0;
      }
      stats.byArchetype[key]++;
    }
  });

  return stats;
}

/**
 * Log archetype information for debugging
 */
export function logArchetypeInfo(player, archetypeInfo) {
  if (process.env.NODE_ENV === 'development') {
    if (archetypeInfo.source === 'archetype_mapping') {
      console.log(
        `🎯 Archetype: ${player.name} → ${archetypeInfo.archetype} (${archetypeInfo.ratio}x) - ${archetypeInfo.description}`
      );
    }
  }
}

export default {
  getPlayerArchetype,
  getPlayersByArchetype,
  getArchetypeStats,
  logArchetypeInfo
};
