/**
 * V4 Ensemble Scoring - Core Module
 *
 * Blends V3 predictions (FFH * calibrated ratio) with Sleeper projections.
 * Both inputs are in Sleeper custom league scoring format.
 *
 * Backtest (3186 paired samples, GW14-29):
 *   Sleeper projections standalone: MAE = 2.973
 *   V3 standalone:                  MAE = 2.750
 *   V4 (75% V3 + 25% Sleeper):     MAE = 2.708  (best V3/Sleeper blend)
 *
 * NOTE: The backtest used FFH actual FPL points (not predictions) for V3.
 * Real prediction accuracy may differ. Track forward results to validate.
 *
 * For players WITHOUT Sleeper projections (~1300), V4 falls back to V3 values.
 */

// Blend weights from empirical backtest (optimal V3/Sleeper blend)
const V4_V3_WEIGHT = 0.75;
const V4_SLEEPER_WEIGHT = 0.25;

/**
 * Apply V4 enhancement to all players.
 * Must be called AFTER V3 enhancement (needs v3_pts, v3_season_total, etc.).
 *
 * @param {Array} players - Players with V3 enhancement already applied
 * @param {Object|null} sleeperProjections - { [sleeperId]: { [gw]: points } }
 * @param {number} currentGW - Current gameweek number
 * @returns {Array} Players with v4_pts embedded on predictions
 */
export function applyV4Scoring(players, sleeperProjections, currentGW) {
  if (!sleeperProjections) {
    // No Sleeper projections available — V4 = V3 for all players
    if (process.env.NODE_ENV === 'development') {
      console.log('V4: No Sleeper projections available, falling back to V3 for all players');
    }
    return players.map(p => ({
      ...p,
      v4_season_total: p.v3_season_total || p.predicted_points || 0,
      v4_season_avg: p.v3_season_avg || p.season_prediction_avg || 0,
      v4_has_sleeper_data: false
    }));
  }

  let withSleeperData = 0;
  let withoutSleeperData = 0;

  const enhanced = players.map(player => {
    const sleeperId = player.sleeper_id;
    const playerProjections = sleeperId ? sleeperProjections[sleeperId] : null;
    const hasSleeperData = playerProjections && Object.keys(playerProjections).length > 0;

    if (!hasSleeperData) {
      withoutSleeperData++;
      return {
        ...player,
        v4_season_total: player.v3_season_total || player.predicted_points || 0,
        v4_season_avg: player.v3_season_avg || player.season_prediction_avg || 0,
        v4_has_sleeper_data: false
      };
    }

    withSleeperData++;

    // Embed v4_pts on each prediction entry
    const predictions = player.predictions?.map(pred => {
      const v3Pts = pred.v3_pts;
      const sleeperPts = playerProjections[pred.gw];

      if (sleeperPts !== undefined && v3Pts !== undefined && v3Pts > 0) {
        // Blend V3 (calibrated FFH) with Sleeper projection — both in Sleeper scoring units
        return {
          ...pred,
          v4_pts: Math.round((v3Pts * V4_V3_WEIGHT + sleeperPts * V4_SLEEPER_WEIGHT) * 100) / 100,
          v4_sleeper_pts: sleeperPts
        };
      }

      // No Sleeper data for this GW — fall back to V3
      return {
        ...pred,
        v4_pts: v3Pts !== undefined ? v3Pts : (pred.predicted_pts || 0)
      };
    }) || player.predictions;

    // Compute season totals from blended predictions (future GWs only)
    const futurePreds = (predictions || []).filter(p => p.gw >= currentGW);
    const v4Total = futurePreds.reduce((sum, p) => sum + (p.v4_pts || 0), 0);
    const v4Avg = futurePreds.length > 0 ? v4Total / futurePreds.length : 0;

    return {
      ...player,
      predictions,
      v4_season_total: Math.round(v4Total * 100) / 100,
      v4_season_avg: Math.round(v4Avg * 100) / 100,
      v4_has_sleeper_data: true
    };
  });

  if (process.env.NODE_ENV === 'development') {
    console.log(`V4 Enhancement: ${withSleeperData} players with Sleeper data, ${withoutSleeperData} without (fallback to V3)`);
  }

  return enhanced;
}
