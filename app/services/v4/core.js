/**
 * V4 Ensemble Scoring - Core Module
 *
 * Blends raw FFH predictions with Sleeper projections (both in their native units).
 * Backtest (3132 paired samples, GW1-34) showed FFH raw outperforms ratio-adjusted V3:
 *
 *   FFH standalone:              MAE = 2.717
 *   V3 (FFH * ratio) standalone: MAE = 2.738
 *   Sleeper projections:         MAE = 2.983
 *   V4 (70% FFH + 30% Sleeper): MAE = 2.622  ← best blend
 *
 * Using pred.predicted_pts (raw FFH) instead of v3_pts (FFH * ratio) as the primary
 * signal — the ratio conversion adds noise at this sample size.
 *
 * For players WITHOUT Sleeper projections, V4 falls back to V3 values.
 */

// Blend weights from empirical backtest (GW1-34, 3132 samples)
const V4_FFH_WEIGHT = 0.70;
const V4_SLEEPER_WEIGHT = 0.30;

// Applied when Sleeper has GW projection data but doesn't project this player.
// Sleeper omits players it considers rotation risks — discount FFH's optimistic prediction.
const ROTATION_RISK_MULTIPLIER = 0.65;

/**
 * Apply V4 enhancement to all players.
 * Must be called AFTER V3 enhancement (needs v3_pts, v3_season_total, etc.).
 *
 * @param {Array} players - Players with V3 enhancement already applied
 * @param {Object|null} sleeperProjections - { [sleeperId]: { [gw]: points } }
 * @param {number} currentGW - Current gameweek number
 * @param {Set|null} gwsWithData - GWs where Sleeper returned projection data; absent player in these GW = rotation risk
 * @returns {Array} Players with v4_pts embedded on predictions
 */
export function applyV4Scoring(players, sleeperProjections, currentGW, gwsWithData = null) {
  if (!sleeperProjections) {
    // No Sleeper projections available — V4 = V3 for all players
    if (process.env.NODE_ENV === 'development') {
      console.log('V4: No Sleeper projections available, falling back to V3 for all players');
    }
    return players.map(p => ({
      ...p,
      v4_season_total: p.v3_season_total || p.predicted_points || 0,
      v4_season_avg: p.v3_season_avg || p.season_prediction_avg || 0,
      v4_current_gw: p.v3_current_gw || p.current_gw_prediction || 0,
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
        v4_current_gw: player.v3_current_gw || player.current_gw_prediction || 0,
        v4_has_sleeper_data: false
      };
    }

    withSleeperData++;

    // Embed v4_pts on each prediction entry: 70% raw FFH + 30% Sleeper projection
    const predictions = player.predictions?.map(pred => {
      const ffhPts = pred.predicted_pts || 0;
      const sleeperPts = playerProjections[pred.gw];

      if (sleeperPts !== undefined && ffhPts > 0) {
        return {
          ...pred,
          v4_pts: Math.round((ffhPts * V4_FFH_WEIGHT + sleeperPts * V4_SLEEPER_WEIGHT) * 100) / 100,
          v4_sleeper_pts: sleeperPts
        };
      }

      // No Sleeper projection for this GW.
      // If Sleeper had data for this GW but skipped this player, treat as rotation risk.
      // If Sleeper has no data for this GW at all, fall back to V3 unchanged.
      const baseV4 = pred.v3_pts !== undefined ? pred.v3_pts : ffhPts;
      if (gwsWithData && gwsWithData.has(pred.gw)) {
        return {
          ...pred,
          v4_pts: Math.round(baseV4 * ROTATION_RISK_MULTIPLIER * 100) / 100,
          v4_rotation_risk: true
        };
      }
      return { ...pred, v4_pts: baseV4 };
    }) || player.predictions;

    // Compute season totals and current GW from blended predictions
    const futurePreds = (predictions || []).filter(p => p.gw >= currentGW);
    const v4Total = futurePreds.reduce((sum, p) => sum + (p.v4_pts || 0), 0);
    const v4Avg = futurePreds.length > 0 ? v4Total / futurePreds.length : 0;
    const currentGWPred = predictions?.find(p => p.gw === currentGW);
    const v4CurrentGW = currentGWPred?.v4_pts ?? player.v3_current_gw ?? 0;

    return {
      ...player,
      predictions,
      v4_season_total: Math.round(v4Total * 100) / 100,
      v4_season_avg: Math.round(v4Avg * 100) / 100,
      v4_current_gw: Math.round(v4CurrentGW * 100) / 100,
      v4_has_sleeper_data: true
    };
  });

  if (process.env.NODE_ENV === 'development') {
    console.log(`V4 Enhancement: ${withSleeperData} players with Sleeper data, ${withoutSleeperData} without (fallback to V3)`);
  }

  return enhanced;
}
