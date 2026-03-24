/**
 * FFH Data Utility Functions
 * Shared utilities for processing Fantasy Football Hub data
 */

/**
 * Extract all gameweek predictions from FFH player data
 * Combines predictions and results arrays, with results taking priority
 *
 * @param {Object} ffhPlayer - FFH player object
 * @returns {Object} Object containing all, upcoming, and current predictions
 */
export function extractAllGameweekPredictions(ffhPlayer) {
  const allPredictions = new Map(); // Use Map to avoid duplicates and maintain order

  // Step 1: Process the 'predictions' array (future/upcoming gameweeks)
  if (ffhPlayer.predictions && Array.isArray(ffhPlayer.predictions)) {
    ffhPlayer.predictions.forEach(pred => {
      // Use != null (not falsy) so 0-pt entries (injured/suspended players) are included
      if (pred.gw && pred.predicted_pts != null) {
        const pts = typeof pred.predicted_pts === 'object' ?
                    (pred.predicted_pts?.predicted_pts ?? 0) : pred.predicted_pts;
        const mins = pred.predicted_mins || pred.xmins || 0;

        if (typeof pts === 'number' && pts >= 0) {
          allPredictions.set(pred.gw, {
            gw: pred.gw,
            predicted_pts: pts,
            predicted_mins: mins,
            source: 'predictions'
          });
        }
      }
    });
  }

  // Step 2: Process the 'results' array (current/completed gameweeks)
  // Results take PRIORITY over predictions for the same gameweek
  if (ffhPlayer.results && Array.isArray(ffhPlayer.results)) {
    // Accept season 2025 (start year) or 2026 (end year) for the 2025-26 PL season,
    // or no season field at all (some FFH responses omit it)
    ffhPlayer.results
      .filter(result => !result.season || result.season === 2025 || result.season === 2026)
      .forEach(result => {
        if (!result.gw) return;
        // Check multiple field names — FFH may use different names once a GW goes live
        const rawPts = result.predicted_pts ?? result.total_predicted_pts ?? result.ep ?? null;
        if (rawPts != null) {
          const pts = typeof rawPts === 'object' ? (rawPts?.predicted_pts ?? 0) : rawPts;
          const mins = result.predicted_mins || result.xmins || 0;

          if (typeof pts === 'number' && pts >= 0) {
            // OVERRIDE prediction with result for same gameweek
            allPredictions.set(result.gw, {
              gw: result.gw,
              predicted_pts: pts,
              predicted_mins: mins,
              source: 'results'
            });
          }
        }
      });
  }

  // Convert to sorted array
  const allPredictionsArray = Array.from(allPredictions.values())
    .sort((a, b) => a.gw - b.gw);

  return { all: allPredictionsArray };
}

/**
 * Extract all gameweek minutes from FFH player data
 * Combines predictions and results arrays
 *
 * @param {Object} ffhPlayer - FFH player object
 * @returns {Object} Object mapping gameweek number to predicted minutes
 */
export function extractAllGameweekMinutes(ffhPlayer) {
  const allMinutes = {};

  // Process predictions array
  if (ffhPlayer.predictions && Array.isArray(ffhPlayer.predictions)) {
    ffhPlayer.predictions.forEach(pred => {
      if (pred.gw) {
        const mins = pred.predicted_mins || pred.xmins || 0;
        if (typeof mins === 'number' && mins >= 0) {
          allMinutes[pred.gw] = mins;
        }
      }
    });
  }

  // Process results array (overrides predictions)
  if (ffhPlayer.results && Array.isArray(ffhPlayer.results)) {
    ffhPlayer.results
      .filter(result => !result.season || result.season === 2025 || result.season === 2026)
      .forEach(result => {
        if (result.gw) {
          const mins = result.predicted_mins || result.xmins || 0;
          if (typeof mins === 'number' && mins >= 0) {
            allMinutes[result.gw] = mins;
          }
        }
      });
  }

  return allMinutes;
}
