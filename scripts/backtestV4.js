#!/usr/bin/env node
/**
 * V4 Backtest Script — Comprehensive Model Accuracy Comparison
 *
 * Compares prediction models against actual Sleeper custom league scores:
 *   1. Sleeper Projections (standalone) — projected stats computed with league scoring
 *   2. V3 (FFH * calibrated ratio) — requires dev server running
 *   3. V4 Blend (V3 * w + Sleeper * (1-w)) — grid search for optimal weights
 *
 * Usage:
 *   node scripts/backtestV4.js              # Sleeper projections only (no dev server needed)
 *   node scripts/backtestV4.js --with-v3    # Also test V3 + V4 ep_next blend (needs dev server on :3000)
 */

const LEAGUE_ID = '1240184286171107328';
const SLEEPER_API = 'https://api.sleeper.app/v1';
const SEASON = '2025';
const MAX_GW = 34; // Latest completed GW

const withV3 = process.argv.includes('--with-v3');

// ─── Sleeper API helpers ────────────────────────────────────────────────────

async function fetchScoringSettings() {
  const res = await fetch(`${SLEEPER_API}/league/${LEAGUE_ID}`);
  const league = await res.json();
  const raw = league.scoring_settings || {};
  const scoring = {};
  for (const [key, value] of Object.entries(raw)) {
    if (key.startsWith('pos_') && value !== 0) {
      scoring[key] = value;
    }
  }
  return scoring;
}

function computePoints(stats, scoring) {
  let total = 0;
  for (const [key, value] of Object.entries(stats)) {
    const weight = scoring[key];
    if (weight && value) total += weight * value;
  }
  return Math.round(total * 100) / 100;
}

// Map Sleeper single-letter positions to our standard codes
function normalizePos(player) {
  const pos = (player?.fantasy_positions || [])[0] || player?.position || '';
  const map = { 'GK': 'GKP', 'D': 'DEF', 'M': 'MID', 'F': 'FWD', 'DEF': 'DEF', 'GKP': 'GKP', 'MID': 'MID', 'FWD': 'FWD' };
  return map[pos] || '?';
}

async function fetchGW(endpoint, gw) {
  const url = `${SLEEPER_API}/${endpoint}/clubsoccer:epl/regular/${SEASON}/${gw}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  return res.json();
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== Model Accuracy Backtest ===\n');

  // 1. Fetch scoring settings + player positions
  process.stdout.write('Fetching league settings and player data...');
  const [scoring, playersData] = await Promise.all([
    fetchScoringSettings(),
    fetch(`${SLEEPER_API}/players/clubsoccer:epl`).then(r => r.json())
  ]);
  console.log(' done');
  console.log(`  Scoring rules: ${Object.keys(scoring).length} active pos_* keys\n`);

  // 2. Fetch actuals + projections for all past GWs
  const gws = Array.from({ length: MAX_GW }, (_, i) => i + 1);
  const samples = []; // { gw, pid, name, pos, projected, actual }

  console.log(`Fetching GW1-${MAX_GW} actuals + projections...`);
  // Batch in groups of 5 to avoid overwhelming the API
  for (let i = 0; i < gws.length; i += 5) {
    const batch = gws.slice(i, i + 5);
    const results = await Promise.all(
      batch.map(async gw => {
        const [actuals, projections] = await Promise.all([
          fetchGW('stats', gw),
          fetchGW('projections', gw)
        ]);
        return { gw, actuals, projections };
      })
    );

    for (const { gw, actuals, projections } of results) {
      if (!actuals || !projections) {
        process.stdout.write(`  GW${gw}: skipped (no data)\n`);
        continue;
      }

      let count = 0;
      for (const [pid, projStats] of Object.entries(projections)) {
        if (pid.startsWith('TEAM')) continue;
        const actualStats = actuals[pid];
        if (!actualStats || typeof actualStats !== 'object') continue;
        if (Object.keys(actualStats).length === 0) continue;

        const projected = computePoints(projStats, scoring);
        const actual = computePoints(actualStats, scoring);

        // Only include players who actually played (non-zero actual)
        if (actual === 0) continue;

        const player = playersData[pid];
        samples.push({
          gw,
          pid,
          name: player ? player.full_name : 'Unknown',
          pos: player ? normalizePos(player) : '?',
          projected,
          actual
        });
        count++;
      }
      process.stdout.write(`  GW${gw}: ${count} samples\n`);
    }
  }

  const positions = ['GKP', 'DEF', 'MID', 'FWD'];
  const gwsCovered = [...new Set(samples.map(s => s.gw))].sort((a, b) => a - b);
  console.log(`\nTotal samples: ${samples.length}`);
  console.log(`GWs covered: ${gwsCovered[0]}-${gwsCovered[gwsCovered.length - 1]} (${gwsCovered.length} gameweeks)\n`);

  // ─── Sleeper Projections Accuracy ──────────────────────────────────────

  console.log('═══════════════════════════════════════════════════');
  console.log('  MODEL 1: Sleeper Projections (Standalone)');
  console.log('═══════════════════════════════════════════════════');

  const sleeperMAE = samples.reduce((sum, s) => sum + Math.abs(s.projected - s.actual), 0) / samples.length;
  console.log(`  Overall MAE: ${sleeperMAE.toFixed(3)} (${samples.length} samples)\n`);

  console.log('  Per-position:');
  positions.forEach(pos => {
    const ps = samples.filter(s => s.pos === pos);
    if (ps.length === 0) return;
    const mae = ps.reduce((sum, s) => sum + Math.abs(s.projected - s.actual), 0) / ps.length;
    const avgProj = ps.reduce((sum, s) => sum + s.projected, 0) / ps.length;
    const avgActual = ps.reduce((sum, s) => sum + s.actual, 0) / ps.length;
    const bias = avgProj - avgActual;
    console.log(`    ${pos}: MAE=${mae.toFixed(3)} (n=${ps.length}, avgProj=${avgProj.toFixed(2)}, avgActual=${avgActual.toFixed(2)}, bias=${bias > 0 ? '+' : ''}${bias.toFixed(2)})`);
  });

  // ─── V3 Accuracy (requires dev server) ─────────────────────────────────

  let v3Samples = null;
  if (withV3) {
    console.log('\n═══════════════════════════════════════════════════');
    console.log('  MODEL 2: V3 (FFH * Calibrated Ratio)');
    console.log('═══════════════════════════════════════════════════');

    try {
      process.stdout.write('  Fetching V3 predictions from localhost:3000...');
      const resp = await fetch('http://localhost:3000/api/integrated-players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forceRefresh: true })
      });
      const data = await resp.json();
      const v3Players = data.players || [];
      console.log(` ${v3Players.length} players`);

      // Build lookup: sleeper_id -> player with predictions
      const v3Lookup = {};
      v3Players.forEach(p => {
        if (p.sleeper_id) v3Lookup[p.sleeper_id] = p;
      });

      // V3 predictions array contains:
      // - Past GWs: source='results' with v3_pts = fpl_actual * ratio (post-hoc V3 conversion)
      // - Future GWs: source='predictions' with v3_pts = fpl_predicted * ratio (true prediction)
      //
      // For past GWs, v3_pts represents what V3 produces from actual FPL outcomes.
      // This tests the V3 ratio accuracy: how well fpl_actual * ratio approximates sleeper_actual.
      // It's the same methodology the calibration system validated (3190 samples, MAE 2.78).

      v3Samples = [];
      for (const s of samples) {
        const v3Player = v3Lookup[s.pid];
        if (!v3Player) continue;

        const ratio = v3Player.v3_conversion_ratio;
        if (!ratio) continue;

        // Use ffh_gw_results for past GWs — these contain actual FPL points scored
        const results = v3Player.ffh_gw_results || [];
        const gwResult = results.find(r => r.gw === s.gw);
        if (!gwResult || !gwResult.predicted_pts) continue;

        const ffhPts = gwResult.predicted_pts; // actual FPL points for this GW
        const v3Pts = ffhPts * ratio;           // V3 = FFH actual * calibrated ratio

        v3Samples.push({
          ...s,
          v3Pts,
          ffhPts
        });
      }

      if (v3Samples.length > 0) {
        const v3MAE = v3Samples.reduce((sum, s) => sum + Math.abs(s.v3Pts - s.actual), 0) / v3Samples.length;
        const ffhMAE = v3Samples.reduce((sum, s) => sum + Math.abs(s.ffhPts - s.actual), 0) / v3Samples.length;
        const sleeperSubMAE = v3Samples.reduce((sum, s) => sum + Math.abs(s.projected - s.actual), 0) / v3Samples.length;
        console.log(`  Paired samples (V3 + Sleeper proj + actual): ${v3Samples.length}`);
        console.log(`  FFH raw MAE:       ${ffhMAE.toFixed(3)}`);
        console.log(`  V3 (FFH*ratio) MAE: ${v3MAE.toFixed(3)}`);
        console.log(`  Sleeper proj MAE:  ${sleeperSubMAE.toFixed(3)}`);

        console.log('\n  Per-position:');
        positions.forEach(pos => {
          const ps = v3Samples.filter(s => s.pos === pos);
          if (ps.length === 0) return;
          const v3mae = ps.reduce((sum, s) => sum + Math.abs(s.v3Pts - s.actual), 0) / ps.length;
          const ffhmae = ps.reduce((sum, s) => sum + Math.abs(s.ffhPts - s.actual), 0) / ps.length;
          const slmae = ps.reduce((sum, s) => sum + Math.abs(s.projected - s.actual), 0) / ps.length;
          const best = Math.min(v3mae, ffhmae, slmae);
          const winner = best === v3mae ? 'V3' : best === ffhmae ? 'FFH' : 'Sleeper';
          console.log(`    ${pos}: FFH=${ffhmae.toFixed(3)}, V3=${v3mae.toFixed(3)}, Sleeper=${slmae.toFixed(3)} (n=${ps.length}) <-- ${winner} best`);
        });
      } else {
        console.log(`  No paired samples found. Check FFH results data availability.`);
      }
    } catch (e) {
      console.log(` FAILED: ${e.message}`);
      console.log('  Run "npm run dev" first, then use --with-v3 flag.');
    }
  }

  // ─── V4 ep_next Blend Validation ───────────────────────────────────────

  let epSamples = null;
  if (v3Samples && v3Samples.length > 0) {
    console.log('\n═══════════════════════════════════════════════════');
    console.log('  MODEL 3: V4 ep_next Blend (V3 * 0.65 + ep_next * 0.35)');
    console.log('═══════════════════════════════════════════════════');

    try {
      // Build sleeper_id -> ffh_id (FPL element ID) map from dev server response
      process.stdout.write('  Fetching player ID mapping from dev server...');
      const mapResp = await fetch('http://localhost:3000/api/integrated-players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const mapData = await mapResp.json();
      const sleeperToFplId = {};
      (mapData.players || []).forEach(p => {
        if (p.sleeper_id && p.ffh_id) sleeperToFplId[p.sleeper_id] = p.ffh_id;
      });
      console.log(` ${Object.keys(sleeperToFplId).length} mappings`);

      // Unique FPL IDs needed (only players that appear in our v3Samples)
      const neededFplIds = [...new Set(v3Samples.map(s => sleeperToFplId[s.pid]).filter(Boolean))];
      process.stdout.write(`  Fetching FPL element summaries for ${neededFplIds.length} players...`);

      const FPL_API = 'https://fantasy.premierleague.com/api';
      const epHistory = {}; // fpl_id -> { gw -> ep }

      // Batch 10 at a time to avoid rate limiting
      for (let i = 0; i < neededFplIds.length; i += 10) {
        const batch = neededFplIds.slice(i, i + 10);
        await Promise.all(batch.map(async fplId => {
          try {
            const res = await fetch(`${FPL_API}/element-summary/${fplId}/`, {
              headers: { 'User-Agent': 'FPL-Dashboard/1.0' }
            });
            if (!res.ok) return;
            const d = await res.json();
            epHistory[fplId] = {};
            (d.history || []).forEach(h => {
              // FPL element-summary uses 'event' (not 'round') for GW number
              const gw = h.event ?? h.round;
              if (gw != null && h.expected_points != null) {
                epHistory[fplId][gw] = parseFloat(h.expected_points);
              }
            });
          } catch { /* skip */ }
        }));
        process.stdout.write('.');
      }
      console.log(' done');

      // Build ep-enriched samples: add epSleeper (ep_next converted to Sleeper scoring via ratio)
      epSamples = v3Samples.map(s => {
        const fplId = sleeperToFplId[s.pid];
        const ep = fplId && epHistory[fplId] ? epHistory[fplId][s.gw] : null;
        if (ep == null) return null;
        // Recover position ratio from v3Pts / ffhPts
        const ratio = s.ffhPts > 0 ? s.v3Pts / s.ffhPts : 1;
        const epSleeper = ep * ratio;
        return { ...s, ep, epSleeper };
      }).filter(Boolean);

      if (epSamples.length < 10) {
        console.log(`  Only ${epSamples.length} samples with ep_next data — skipping ep blend analysis.`);
        epSamples = null;
      } else {
        const v3MAE = epSamples.reduce((sum, s) => sum + Math.abs(s.v3Pts - s.actual), 0) / epSamples.length;
        const epMAE = epSamples.reduce((sum, s) => sum + Math.abs(s.epSleeper - s.actual), 0) / epSamples.length;
        const v4MAE = epSamples.reduce((sum, s) => sum + Math.abs(s.v3Pts * 0.65 + s.epSleeper * 0.35 - s.actual), 0) / epSamples.length;

        // Grid search optimal V3/ep_next blend weights
        let bestW = 0.65, bestMAE = Infinity;
        for (let w = 0; w <= 1.0; w += 0.05) {
          const mae = epSamples.reduce((sum, s) => sum + Math.abs(s.v3Pts * w + s.epSleeper * (1 - w) - s.actual), 0) / epSamples.length;
          if (mae < bestMAE) { bestMAE = mae; bestW = w; }
        }

        console.log(`  ep_next samples: ${epSamples.length}`);
        console.log(`  V3 standalone MAE:        ${v3MAE.toFixed(3)}`);
        console.log(`  ep_next standalone MAE:   ${epMAE.toFixed(3)}`);
        console.log(`  V4 as shipped (65/35) MAE: ${v4MAE.toFixed(3)}`);
        console.log(`  Optimal V3/ep blend:       ${bestMAE.toFixed(3)} (${(bestW*100).toFixed(0)}% V3 / ${((1-bestW)*100).toFixed(0)}% ep_next)`);

        const shippedDelta = ((v4MAE - v3MAE) / v3MAE * 100).toFixed(1);
        const optimalDelta = ((bestMAE - v3MAE) / v3MAE * 100).toFixed(1);
        console.log(`\n  V4 as shipped vs V3:  ${shippedDelta > 0 ? '+' : ''}${shippedDelta}% (${v4MAE < v3MAE ? 'improvement' : 'regression'})`);
        console.log(`  Optimal blend vs V3:  ${optimalDelta > 0 ? '+' : ''}${optimalDelta}% (${bestMAE < v3MAE ? 'improvement' : 'regression'})`);

        if (Math.abs(bestW - 0.65) >= 0.10) {
          console.log(`\n  ⚠️  Optimal weight (${(bestW*100).toFixed(0)}% V3) differs from shipped (65%) by ≥10pp`);
          console.log(`     Consider updating core.js blend: v3*${bestW.toFixed(2)} + ep_next*${(1-bestW).toFixed(2)}`);
        } else {
          console.log(`\n  ✅  Shipped weights (65/35) within 10pp of optimal — no change needed`);
        }

        console.log('\n  Per-position ep_next blend:');
        positions.forEach(pos => {
          const ps = epSamples.filter(s => s.pos === pos);
          if (ps.length < 5) return;
          let bw = 0.65, bm = Infinity;
          for (let w = 0; w <= 1.0; w += 0.05) {
            const mae = ps.reduce((sum, s) => sum + Math.abs(s.v3Pts * w + s.epSleeper * (1 - w) - s.actual), 0) / ps.length;
            if (mae < bm) { bm = mae; bw = w; }
          }
          const v3mae = ps.reduce((sum, s) => sum + Math.abs(s.v3Pts - s.actual), 0) / ps.length;
          const epmae = ps.reduce((sum, s) => sum + Math.abs(s.epSleeper - s.actual), 0) / ps.length;
          console.log(`    ${pos}: optimal=${(bw*100).toFixed(0)}%V3/${((1-bw)*100).toFixed(0)}%ep → MAE=${bm.toFixed(3)} (V3-only: ${v3mae.toFixed(3)}, ep-only: ${epmae.toFixed(3)}, n=${ps.length})`);
        });
      }
    } catch (e) {
      console.log(`  FAILED: ${e.message}`);
    }
  }

  // ─── V4 Blend Optimization ─────────────────────────────────────────────

  if (v3Samples && v3Samples.length > 0) {
    console.log('\n═══════════════════════════════════════════════════');
    console.log('  V4 BLEND OPTIMIZATION (V3 * w + Sleeper * (1-w))');
    console.log('═══════════════════════════════════════════════════');

    const v3OnlyMAE = v3Samples.reduce((sum, s) => sum + Math.abs(s.v3Pts - s.actual), 0) / v3Samples.length;
    const ffhOnlyMAE = v3Samples.reduce((sum, s) => sum + Math.abs(s.ffhPts - s.actual), 0) / v3Samples.length;
    const sleeperOnlyMAE = v3Samples.reduce((sum, s) => sum + Math.abs(s.projected - s.actual), 0) / v3Samples.length;

    // --- Blend 1: V3 + Sleeper ---
    let bestV3SlW = 0, bestV3SlMAE = Infinity;
    for (let w = 0; w <= 1.0; w += 0.05) {
      const mae = v3Samples.reduce((sum, s) => sum + Math.abs(s.v3Pts * w + s.projected * (1 - w) - s.actual), 0) / v3Samples.length;
      if (mae < bestV3SlMAE) { bestV3SlMAE = mae; bestV3SlW = w; }
    }

    // --- Blend 2: FFH + Sleeper ---
    let bestFfhSlW = 0, bestFfhSlMAE = Infinity;
    for (let w = 0; w <= 1.0; w += 0.05) {
      const mae = v3Samples.reduce((sum, s) => sum + Math.abs(s.ffhPts * w + s.projected * (1 - w) - s.actual), 0) / v3Samples.length;
      if (mae < bestFfhSlMAE) { bestFfhSlMAE = mae; bestFfhSlW = w; }
    }

    // --- Blend 3: FFH + V3 + Sleeper (3-way grid search) ---
    let best3 = { w1: 0, w2: 0, mae: Infinity };
    for (let w1 = 0; w1 <= 1.0; w1 += 0.05) {
      for (let w2 = 0; w2 <= 1.0 - w1; w2 += 0.05) {
        const w3 = 1.0 - w1 - w2;
        const mae = v3Samples.reduce((sum, s) => {
          return sum + Math.abs(s.ffhPts * w1 + s.v3Pts * w2 + s.projected * w3 - s.actual);
        }, 0) / v3Samples.length;
        if (mae < best3.mae) { best3 = { w1, w2, w3, mae }; }
      }
    }

    console.log('\n  ┌─────────────────────────────────────────────────┐');
    console.log('  │          BLEND COMPARISON RESULTS               │');
    console.log('  ├─────────────────────────────────────────────────┤');
    console.log(`  │ FFH standalone:           MAE = ${ffhOnlyMAE.toFixed(3)}          │`);
    console.log(`  │ V3 standalone:            MAE = ${v3OnlyMAE.toFixed(3)}          │`);
    console.log(`  │ Sleeper standalone:       MAE = ${sleeperOnlyMAE.toFixed(3)}          │`);
    console.log(`  │                                                 │`);
    console.log(`  │ FFH/Sleeper blend:        MAE = ${bestFfhSlMAE.toFixed(3)}          │`);
    console.log(`  │   (${bestFfhSlW.toFixed(2)} FFH + ${(1-bestFfhSlW).toFixed(2)} Sleeper)                   │`);
    console.log(`  │ V3/Sleeper blend:         MAE = ${bestV3SlMAE.toFixed(3)}          │`);
    console.log(`  │   (${bestV3SlW.toFixed(2)} V3 + ${(1-bestV3SlW).toFixed(2)} Sleeper)                    │`);
    console.log(`  │ 3-way blend:              MAE = ${best3.mae.toFixed(3)}          │`);
    console.log(`  │   (${best3.w1.toFixed(2)} FFH + ${best3.w2.toFixed(2)} V3 + ${best3.w3.toFixed(2)} Sleeper)     │`);
    console.log('  └─────────────────────────────────────────────────┘');

    // Find overall winner
    const allModels = [
      { name: 'FFH raw', mae: ffhOnlyMAE },
      { name: 'V3 (FFH*ratio)', mae: v3OnlyMAE },
      { name: 'Sleeper projections', mae: sleeperOnlyMAE },
      { name: `FFH/Sleeper blend (${bestFfhSlW.toFixed(2)}/${(1-bestFfhSlW).toFixed(2)})`, mae: bestFfhSlMAE },
      { name: `V3/Sleeper blend (${bestV3SlW.toFixed(2)}/${(1-bestV3SlW).toFixed(2)})`, mae: bestV3SlMAE },
      { name: `3-way blend (${best3.w1.toFixed(2)}/${best3.w2.toFixed(2)}/${best3.w3.toFixed(2)})`, mae: best3.mae }
    ].sort((a, b) => a.mae - b.mae);

    console.log('\n  RANKING (best to worst):');
    allModels.forEach((m, i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '  ';
      const improv = i === 0 ? '' : ` (+${((m.mae - allModels[0].mae) / allModels[0].mae * 100).toFixed(1)}% worse)`;
      console.log(`  ${medal} ${i+1}. ${m.name}: ${m.mae.toFixed(3)}${improv}`);
    });

    // Per-position optimal weights (V3/Sleeper blend)
    console.log('\n  Per-Position Optimal V3/Sleeper Weights:');
    positions.forEach(pos => {
      const ps = v3Samples.filter(s => s.pos === pos);
      if (ps.length < 10) return;

      let bestW = 0, bestM = Infinity;
      for (let w = 0; w <= 1.0; w += 0.05) {
        const mae = ps.reduce((sum, s) => sum + Math.abs(s.v3Pts * w + s.projected * (1 - w) - s.actual), 0) / ps.length;
        if (mae < bestM) { bestM = mae; bestW = w; }
      }
      const v3mae = ps.reduce((sum, s) => sum + Math.abs(s.v3Pts - s.actual), 0) / ps.length;
      const slmae = ps.reduce((sum, s) => sum + Math.abs(s.projected - s.actual), 0) / ps.length;
      console.log(`    ${pos}: V3=${bestW.toFixed(2)}/Sleeper=${(1 - bestW).toFixed(2)} -> MAE=${bestM.toFixed(3)} (V3-only: ${v3mae.toFixed(3)}, Sleeper-only: ${slmae.toFixed(3)}, n=${ps.length})`);
    });
  }

  // ─── Summary ──────────────────────────────────────────────────────────

  console.log('\n═══════════════════════════════════════════════════');
  console.log('  SUMMARY');
  console.log('═══════════════════════════════════════════════════');
  console.log(`  Sleeper Projections MAE: ${sleeperMAE.toFixed(3)} (${samples.length} samples, GW${gwsCovered[0]}-${gwsCovered[gwsCovered.length - 1]})`);
  console.log(`  V3 Calibrated MAE:       ~2.78 (3190 samples, GW1-26, from calibration system)`);
  if (v3Samples && v3Samples.length > 0) {
    const v3MAE = v3Samples.reduce((sum, s) => sum + Math.abs(s.v3Pts - s.actual), 0) / v3Samples.length;
    console.log(`  V3 MAE (this run):       ${v3MAE.toFixed(3)} (${v3Samples.length} paired samples)`);
  }
  if (epSamples && epSamples.length > 0) {
    const v4MAE = epSamples.reduce((sum, s) => sum + Math.abs(s.v3Pts * 0.65 + s.epSleeper * 0.35 - s.actual), 0) / epSamples.length;
    const v3SubMAE = epSamples.reduce((sum, s) => sum + Math.abs(s.v3Pts - s.actual), 0) / epSamples.length;
    const delta = ((v4MAE - v3SubMAE) / v3SubMAE * 100).toFixed(1);
    console.log(`  V4 ep_next blend MAE:    ${v4MAE.toFixed(3)} (${epSamples.length} samples, ${delta > 0 ? '+' : ''}${delta}% vs V3)`);
  }
  console.log('');
}

main().catch(console.error);
