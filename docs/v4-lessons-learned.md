# V4 Model - Lessons Learned

## Summary

V4 was an attempt to improve upon V3's Sleeper scoring predictions using ensemble ML techniques. After rigorous validation against 175 actual gameweek results (GW 1-21), **V4 performed worse than V3** and was removed from the codebase.

## What We Tried

### V4 Architecture
- **Statistical Model (40%)**: Position-based multipliers learned from training data
- **ML Correction Model (40%)**: Gradient boosting-style decision rules for bias correction
- **Consensus Validator (20%)**: Pulled extreme predictions towards position averages

### Training Data
- **175 samples** from GW 1-21 (2025-26 season)
- Combined FFH predictions, FPL actuals, and Sleeper actuals
- 4 positions: GKP, DEF, MID, FWD

## Validation Results

### Overall Performance
| Model | MAE | vs FFH | vs V3 |
|-------|-----|--------|-------|
| FFH (baseline) | 2.82 | - | - |
| V3 (simple multipliers) | 2.78 | +1.3% | - |
| V4 (original) | 3.18 | -12.7% | -14.2% |
| V4 (conservative) | 2.88 | -2.1% | -3.5% |

### Position Breakdown (V3 Final)
| Position | FFH MAE | V3 MAE | Improvement |
|----------|---------|--------|-------------|
| GKP | 2.28 | 2.00 | +12.3% |
| DEF | 2.63 | 2.59 | +1.5% |
| MID | 3.08 | 3.10 | -0.6% |
| FWD | 3.00 | 2.95 | +1.7% |

## Key Findings

### 1. Simplicity Wins
- V3's simple position multipliers (GKP 0.90x, DEF 1.15x, MID 1.05x, FWD 0.97x) are **already optimal**
- Testing alternative multipliers (±2-30%) all performed worse
- Adding complexity (ML, consensus) added variance, not signal

### 2. Small Sample Size
- 175 samples may be too small to train meaningful ML models
- ML corrections were essentially overfitting to noise
- Would need 500+ samples for reliable ML training

### 3. FFH is Already Good
- FFH baseline: 2.82 MAE is quite accurate
- Only 1.3% room for improvement with V3
- Expecting 15-20% improvement from V4 was unrealistic

### 4. Over-Correction Problem
- Initial V4 multipliers (1.13-1.28x) based on empirical ratios were too aggressive
- Validation showed these "learned" multipliers were worse than V3's conservative ones
- Even reducing corrections by 50% didn't help

## What Didn't Work

1. **Learned Multipliers from Data**
   - Empirical ratios: GKP 1.27x, DEF 1.32x, MID 1.26x, FWD 1.20x
   - These were significantly worse than V3's multipliers
   - Likely overfitting to sample variance

2. **ML Correction Trees**
   - Position bias, minutes adjustments, team strength, opponent difficulty
   - Added ~5-15% corrections on top of statistical model
   - Made predictions worse, not better

3. **Ensemble Weighting**
   - Tried 40/40/20, 70/20/10, and other weight combinations
   - All performed worse than just using V3

## Why V4 Failed

### Mathematical Perspective
Given:
- FFH MAE = 2.82
- V3 MAE = 2.78
- Improvement = 0.04 points (1.3%)

The small improvement margin means:
1. **Signal-to-noise ratio is low** - V3 is near the prediction ceiling given available data
2. **Variance dominates** - Any additional corrections add more noise than signal
3. **Local optimum** - V3 multipliers are at or very close to optimal values

### Practical Perspective
- V3 works because it applies simple, consistent corrections
- V4 tried to be "smart" with contextual adjustments (minutes, form, fixtures)
- Reality: These contextual factors have too much variance in small samples
- Better to have consistent slight under/over-prediction than noisy adjustments

## Lessons for Future Models

### If Attempting V5 (not recommended):
1. **Collect more data** - Need 500+ samples minimum
2. **Simpler features** - Focus on just position, don't try to learn everything
3. **Cross-validation** - Use proper k-fold validation, not just train/test split
4. **Regularization** - Heavily penalize complex models
5. **Ensemble weights** - Start with 90/5/5, not 40/40/20

### Better Approaches:
1. **Stick with V3** - It's optimal for current dataset
2. **Focus on data quality** - Get more accurate Sleeper actuals
3. **Improve FFH data** - Work with FFH to improve their base predictions
4. **Better metrics** - Predicted minutes are valuable, focus on availability prediction

## Conclusion

**V3 is the winner.** After extensive testing:
- V3 achieves 1.3% improvement over FFH
- This is likely near the theoretical maximum given current data
- Further improvements require either:
  - Much larger training datasets (500+ samples)
  - Better base predictions from FFH
  - Different approach entirely (not ensemble ML)

**Recommendation**: Maintain V3 as the production system. Focus development efforts on other features (optimizer, transfer recommendations, UI improvements) rather than trying to squeeze out marginal prediction gains.

## Files Removed

V4 implementation was fully removed from codebase:
- `app/services/v4/` - All V4 model files
- `app/services/v4ScoringService.js` - Main V4 service
- `app/data/v4_training_data.json` - Training data
- `scripts/validateV4*.js` - Validation scripts
- V4 toggle button from UI
- V4 confidence column from tables
- V4 API enhancement from integrated-players route

## Future Data Collection

To enable future model improvements, continue collecting:
- Actual Sleeper scores for each gameweek
- Add to `temp/sleeper_fc_data.csv`
- Run `mergeTrainingData.js` periodically
- Archive in case V5 attempt with larger dataset (500+ samples)

Current data: 175 samples (GW 1-21). Target: 500+ for meaningful ML training.
