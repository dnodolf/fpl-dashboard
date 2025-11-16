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
      if (pred.gw && pred.predicted_pts) {
        const pts = typeof pred.predicted_pts === 'object' ?
                    pred.predicted_pts.predicted_pts : pred.predicted_pts;
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
    ffhPlayer.results
      .filter(result => result.season === 2025) // Only current season
      .forEach(result => {
        if (result.gw && result.predicted_pts) {
          const pts = typeof result.predicted_pts === 'object' ?
                      result.predicted_pts.predicted_pts : result.predicted_pts;
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

  // Convert to arrays
  const allPredictionsArray = Array.from(allPredictions.values())
    .sort((a, b) => a.gw - b.gw);

  const upcomingPredictions = allPredictionsArray.filter(p => p.gw >= 2); // Adjust as needed
  const currentPredictions = allPredictionsArray.filter(p => p.gw < 10); // Current season predictions

  return {
    all: allPredictionsArray,
    upcoming: upcomingPredictions,
    current: currentPredictions
  };
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
      .filter(result => result.season === 2025)
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
