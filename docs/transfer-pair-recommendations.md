# Transfer Pair Recommendations Feature

## Overview

Smart transfer system that suggests "Drop Player X, Add Player Y" pairs with net gain calculations. Ranks your weakest performers against best available replacements to make transfer decisions easier.

## Features

### 1. **Intelligent Pairing Algorithm**
- Compares each available player against your current roster
- Calculates net season points gain for each potential swap
- Shows only transfers that meet minimum gain threshold (default: 5 pts)

### 2. **Position-Aware Matching**
- **GKP**: Only suggests GKP-for-GKP swaps
- **Outfield (DEF/MID/FWD)**: Compares across all outfield positions for flexibility
- This matches real fantasy strategy where you can swap DEF↔MID↔FWD based on formation

### 3. **Rich Context for Each Transfer**
- **Net Gain**: Season total points improvement
- **Form Indicators**: 📈 Hot | ➡️ Steady | 📉 Cold
- **Fixture Difficulty**: Average difficulty rating (1-5) for next N gameweeks
  - 🟢 1-2: Easy fixtures
  - 🟡 3: Medium
  - 🟠 4: Hard
  - 🔴 5: Very hard
- **Position Badges**: Color-coded position indicators

### 4. **Flexible Filtering**
- **Position Filter**: Focus on GKP, DEF, MID, FWD, or ALL
- **Minimum Gain**: Adjust threshold to see only high-impact transfers (0+ points)
- Shows top 10 recommendations by default

### 5. **Summary Statistics**
- **Total Opportunities**: Count of all viable transfers above threshold
- **Best Gain Available**: Highest single transfer improvement
- **Avg Top 5 Gain**: Average improvement from your best 5 options

### 6. **Scoring Mode Support**
- Works with both FFH and V3 scoring modes
- Toggle between modes updates all recommendations instantly
- Ensures consistency across your entire dashboard

## How It Works

### Algorithm

```javascript
For each available free agent player:
  1. Calculate season total points (FFH or V3 mode)
  2. Find best comparison from your roster:
     - GKP: Compare only to your GKPs
     - DEF/MID/FWD: Compare to all your outfield players
  3. Calculate net gain = add_player_pts - drop_player_pts
  4. If net gain >= minimum threshold:
     - Add to recommendations
     - Calculate form trend
     - Calculate average fixture difficulty
  5. Sort by net gain (descending)
  6. Show top 10
```

### Fixture Difficulty Calculation

Uses predicted points vs season average to estimate difficulty:
- **Very Hard (5)**: Player predicted <70% of season average
- **Hard (4)**: Player predicted 70-85% of season average
- **Medium (3)**: Player predicted 85-115% of season average
- **Good (2)**: Player predicted 115-130% of season average
- **Easy (1)**: Player predicted >130% of season average

### Form Trend Calculation

Compares current gameweek prediction to season average:
- **📈 Hot**: Current GW >10% above season average
- **➡️ Steady**: Current GW within ±10% of season average
- **📉 Cold**: Current GW >10% below season average

## Usage

### Basic Workflow

1. **Navigate to Transfer Tab**
2. **Review Top Recommendations** at the top of the page
3. **Filter by Position** if targeting specific roster spots
4. **Adjust Min Gain** to focus on high-impact moves
5. **Compare Fixtures** - green is better than red
6. **Check Form** - look for 📈 adds and 📉 drops
7. **Make Decision** based on net gain + context

### Example Scenarios

#### Scenario 1: Finding Best Overall Transfer
- Set Position: **ALL**
- Set Min Gain: **10**
- Look at Rank #1 recommendation
- Best overall improvement across entire roster

#### Scenario 2: Upgrading Weak Position
- Set Position: **DEF** (if defenders underperforming)
- Set Min Gain: **5**
- See top 5 defender upgrades
- Pick based on fixtures + form

#### Scenario 3: Fixture-Based Transfer
- Set Min Gain: **5**
- Look at "Fixtures" column
- Find swaps with Drop=🔴 (hard) → Add=🟢 (easy)
- Good for short-term gameweek optimization

## Integration

### Component Location
- **File**: `app/components/TransferPairRecommendations.js`
- **Parent**: `app/components/TransferTabContent.js`
- **Placement**: Top of Transfer tab, before existing transfer table

### Props
```javascript
<TransferPairRecommendations
  myPlayers={Array}           // Your current roster
  availablePlayers={Array}    // Free agents
  scoringMode={String}        // 'ffh' or 'v3'
  currentGameweek={Number}    // Current GW number
  nextNGameweeks={Number}     // How many GWs ahead to analyze
/>
```

### Data Requirements
Players must have:
- `position` (GKP/DEF/MID/FWD)
- `name`, `team`
- `predictions` array with `gw`, `predicted_pts`, `predicted_mins`
- `season_prediction_avg` for form/fixture calculations
- `predicted_points` or `v3_season_total` depending on mode

## Design Decisions

### Why Top 10 Only?
- Prevents decision paralysis
- Most impactful transfers are in top 5-10
- User can adjust filters to see more

### Why No "Recommended" Flag?
- Every transfer in the list is recommended
- Ranked by net gain - higher = better
- User applies their own judgment with provided context

### Why Show Negative Gain Transfers?
- Sometimes best available option is still negative
- User awareness: "my worst player is still better than top free agent"
- Hidden if below minimum threshold

### Why Position-Specific Matching?
- GKP must swap GKP (league rules)
- Outfield flexibility matches real strategy
- Allows formation changes via transfers

## Future Enhancements

Potential improvements:
1. **Budget Integration** - Filter by salary cap constraints
2. **Multi-Week Preview** - Show GW-by-GW comparison for next 5 weeks
3. **Transfer Cost** - Factor in transfer limits/penalties
4. **Ownership %** - Show differential opportunities
5. **Recent Points** - Actual vs predicted tracking
6. **Injury Status** - Flag injured players with icons
7. **Double Gameweeks** - Highlight DGW opportunities

## Technical Notes

### Performance
- `useMemo` hook prevents recalculation on every render
- Only recalculates when: players, scoring mode, filters change
- Efficient O(n*m) algorithm: n=free agents, m=my players

### Styling
- Follows existing dark theme design
- Matches dashboard color scheme
- Responsive design (mobile-friendly)
- Consistent position colors across app

### Error Handling
- Graceful fallbacks for missing prediction data
- Default values prevent crashes
- Works even with partial data

## Testing

### Manual Test Checklist
- [ ] Loads without errors
- [ ] Shows recommendations in Transfer tab
- [ ] Position filter works (GKP/DEF/MID/FWD/ALL)
- [ ] Min Gain slider filters results
- [ ] FFH/V3 toggle updates recommendations
- [ ] Statistics cards show correct values
- [ ] Form indicators display correctly
- [ ] Fixture difficulty colors are accurate
- [ ] Rank badges show top 3 with special styling
- [ ] Table is readable and well-formatted

### Sample Test Cases
1. **All Positions, Min Gain 5**: Should show ~10-20 recommendations
2. **GKP Only**: Should show 2-5 GKP swaps
3. **Min Gain 50**: Should show 0-2 recommendations (rare high-impact moves)
4. **V3 Mode**: All point values should change from FFH mode

## Changelog

### v1.0 - Initial Release (2025-01-17)
- Core transfer pairing algorithm
- Position-aware matching
- Form and fixture analysis
- Top 10 recommendations
- Filtering by position and minimum gain
- Summary statistics
- FFH/V3 scoring mode support
- Ranked display with colored badges
- Responsive dark theme design
