# V3 Training & Optimization Infrastructure

This directory contains scripts for validating and optimizing V3 scoring multipliers using actual Sleeper league results.

## Overview

V3 uses position-based multipliers to convert FFH's FPL predictions into Sleeper league scoring predictions. These multipliers are:
- GKP: 0.90x
- DEF: 1.15x
- MID: 1.05x
- FWD: 0.97x

These values were validated as optimal using 175 samples from GW 1-21. However, as more gameweek data is collected, these multipliers can potentially be refined.

## Data Collection Workflow

### 1. Collect FFH Historical Data
```bash
node scripts/collectFFHHistoricalData.js
```

**What it does:**
- Fetches FFH predictions and FPL actuals for all 38 gameweeks
- Saves to `app/data/ffh_historical_gw1-20.json`
- Future-proofed: automatically includes all gameweeks as they become available

**When to run:**
- After each gameweek completes
- FFH API updates with actual FPL results typically within 24 hours of gameweek end

### 2. Record Actual Sleeper Scores
Manually add your team's actual Sleeper scores to `temp/sleeper_fc_data.csv`:

```csv
gameweek,player_name,position,sleeper_points,starting
22,Salah,MID,12.5,TRUE
22,Haaland,FWD,8.0,TRUE
22,Trippier,DEF,6.5,TRUE
...
```

**Format:**
- `gameweek`: Gameweek number (1-38)
- `player_name`: Last name only (e.g., "Salah", "Mateta")
- `position`: GKP/DEF/MID/FWD
- `sleeper_points`: Actual points scored in your Sleeper league
- `starting`: TRUE if started, FALSE if benched

### 3. Merge Data
```bash
node scripts/mergeTrainingData.js
```

**What it does:**
- Matches Sleeper players to FFH players using name + position
- Combines FFH predictions with Sleeper actuals
- Saves merged dataset (used by optimization script)

**Output:**
- Shows matching statistics
- Reports FFH → Sleeper prediction accuracy (MAE)
- Calculates position-specific multipliers from actual data

### 4. Optimize Multipliers
```bash
node scripts/optimizeV3Multipliers.js
```

**What it does:**
- Tests different multiplier values around current V3 values
- Calculates MAE for each combination
- Shows which multipliers perform best on your data

**Sample Output:**
```
GKP (17 samples):
--------------------------------------------------
  0.85x → MAE 2.105
  0.88x → MAE 2.023
  0.90x → MAE 2.001 ⭐ CURRENT
  0.92x → MAE 2.034
  ...
  → Best: 0.90x (MAE 2.001)

📊 Summary:
Current V3 overall MAE: 2.780
```

## When to Update V3 Multipliers

**Criteria for changing multipliers:**
1. **Sample size >500**: Need sufficient data to avoid overfitting
2. **Consistent improvement**: New multipliers must be better across multiple positions
3. **Statistical significance**: Improvement should be >5% to be meaningful

**Current status (GW 1-21):**
- Sample size: 175 (TOO SMALL to change)
- V3 MAE: 2.78 (validated as optimal)
- Recommendation: **Keep current multipliers until 500+ samples**

## File Organization

### Scripts
- `collectFFHHistoricalData.js` - Fetch FFH predictions + FPL actuals
- `mergeTrainingData.js` - Combine FFH + Sleeper data
- `optimizeV3Multipliers.js` - Find optimal multiplier values

### Data Files
- `app/data/ffh_historical_gw1-20.json` - FFH predictions + FPL actuals (4.5 MB)
- `temp/sleeper_fc_data.csv` - Your actual Sleeper scores (manual entry)

### Documentation
- `docs/v4-lessons-learned.md` - Why V4 failed, lessons for future optimization
- `scripts/README-TRAINING.md` - This file

## Tips

### Getting Sleeper Actuals
1. After each gameweek, check your Sleeper matchup
2. Record each player's points (not just starters - bench too!)
3. Add to CSV in format above
4. Common mistakes:
   - Wrong position (check Sleeper, not FPL)
   - Decimal separator (use `.` not `,`)
   - Player names (use last name only)

### Name Matching Issues
If players aren't matching:
- Check spelling in CSV
- Use last name only (e.g., "De Bruyne" → "Bruyne")
- For hyphenated names, try both forms
- Check position is correct (GK vs GKP)

### Sample Size Targets
- **175 samples**: Current (GW 1-21, 15 players × ~12 GWs avg)
- **300 samples**: Minimum for any changes
- **500 samples**: Target for confident optimization
- **1000+ samples**: Ideal for fine-tuning

### Optimization Frequency
- **Weekly**: Too frequent, causes overfitting
- **Monthly (4-5 GWs)**: Good for monitoring trends
- **Half-season (19 GWs)**: Good for actual optimization
- **Full-season (38 GWs)**: Best for major updates

## Expected Results

With current V3 multipliers (GW 1-21 validation):
```
Overall: MAE 2.78 (1.3% better than FFH)

By Position:
- GKP: MAE 2.00 (12.3% improvement)
- DEF: MAE 2.59 (1.5% improvement)
- MID: MAE 3.10 (-0.6% slight degradation)
- FWD: MAE 2.95 (1.7% improvement)
```

If optimization shows significantly different optimal values, it could indicate:
1. More data revealing true patterns
2. League scoring settings changed
3. Sample bias (e.g., too many attackers, not enough defenders)

## Troubleshooting

**"No training data available"**
- Run `collectFFHHistoricalData.js` first
- Check `app/data/` folder for FFH data

**"Sleeper CSV not found"**
- Create `temp/sleeper_fc_data.csv`
- Add header: `gameweek,player_name,position,sleeper_points,starting`

**"0 matched players"**
- Check player names in CSV match FFH
- Verify positions are correct (GK → GKP)
- Try using just last names

**"MAE getting worse"**
- Normal with small sample sizes (<300)
- Could be bad gameweek(s) with many unpredictable results
- Don't change multipliers based on 1-2 bad weeks

## Future Enhancements

Possible improvements to training infrastructure:
- Automated Sleeper score fetching (via Sleeper API)
- Cross-validation for multiplier testing
- Confidence intervals for MAE estimates
- Player-specific adjustments (e.g., differential for bonus monsters)
- Integration with actual gameweek comparison dashboard
