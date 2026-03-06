# Fantasy FC Playbook

## Project Overview

**Fantasy FC Playbook** is a production-ready Next.js 14 application that bridges Sleeper Fantasy Football league management with advanced predictive analytics. The system achieves 98% player matching accuracy through Opta ID matching and provides comprehensive fantasy football analytics with 100% reliable gameweek tracking.

**Current Version:** 3.8 - Scoring Consistency & Comparison Redesign
**Status:** Production Ready
**Last Updated:** March 2025

---

## Key Features

### Player Data Integration
- **98% Match Accuracy** via Opta ID-based player matching between Sleeper and Fantasy Football Hub
- **Calibrated V3 Scoring**: Position-based FPL-to-Sleeper conversion with per-player calibration
- **Position Authority**: Sleeper position data takes absolute precedence (100% accuracy)
- **Smart Fallback**: Graceful degradation to Sleeper-only mode when external APIs fail

### Formation Optimizer (Start/Sit)
- **6 Formation Options**: 3-5-2, 4-4-2, 4-5-1, 3-4-3, 4-3-3, 5-4-1
- **Mathematical Optimization**: Constraint-based algorithms for optimal lineups
- **Actionable Recommendations**: Explicit "bench X, start Y" with net point gain
- **Visual Formation Display**: Interactive pitch diagrams with player positioning
- **Bench Player Cards**: See bench players with predicted points alongside formation

### Enhanced Transfer Analysis
- **Smart Transfer Pairing**: "Drop Player X, Add Player Y" recommendations with net gain
  - Position-aware matching (GKP-for-GKP, outfield flexibility)
  - Top 10 recommendations ranked by season points improvement
  - Form indicators and fixture difficulty visualization
- **Gameweek Range Analysis**: Customizable projection periods
- **Pure Predictions**: Rankings based on unmodified prediction data

### Player Comparison (Redesigned in v3.8)
- **Drop/Add workflow**: Left slot for roster players (grouped by position), right slot for free agents
- **Verdict table**: 7 time horizons (Next 1/3/5/10 GW, ROS, Avg Mins, PPG) with color-coded winner
- **Collapsible detail panels**: Next 5 GW charts and full fixture tables
- **Swap button**: Quick player slot reversal

### Cheat Sheet
- **Position-based rankings**: GKP, DEF, MID, FWD columns
- **Timeframe options**: Next GW, Next 5, Rest of Season, Custom N
- **Ownership filtering**: Show your players + top free agents, or all players
- **Predicted minutes**: Shown per player for availability insight

### Player News & Injury Status (v3.7)
- **FPL Official API integration**: Real-time injury and availability data
- **Status badges**: INJURED / DOUBTFUL / SUSPENDED / UNAVAILABLE / NOT IN SQUAD
- **Relative timestamps**: "2h ago", "3d ago" via `timeAgo()` utility
- **Graceful fallback**: FPL API failure silently skipped

### Player Modal (v3.4)
- **Detailed player view**: Click any player for stats, predictions, fixtures
- **Next 5 GW Chart**: Bar chart with opponent and difficulty display
- **Rest of Season Table**: Full fixture list with color-coded difficulty
- **Compare Button**: Quick navigation to Comparison tab with pre-selection

### Hardcoded Gameweek System
- **100% Reliability**: Complete 2025-26 Premier League schedule embedded
- **Zero Dependencies**: Works offline, immune to external API failures
- **Live GW Support**: Current GW predictions preserved when gameweek goes live

---

## Technology Stack

### Frontend
- **Framework**: Next.js 14 with App Router
- **Styling**: Tailwind CSS with custom Sleeper-inspired dark theme
- **State Management**: React hooks and context with local storage persistence

### Backend
- **API Layer**: Next.js API routes with intelligent caching and error handling
- **Services**: Specialized service classes for matching, scoring, optimization
- **Caching**: Multi-level strategy (client: 30min, server: 15min) with smart compression

### Data Sources
- **Sleeper API**: Primary source for league data, rosters, ownership (authoritative)
- **Fantasy Football Hub**: Predictions and analytics (with fallback)
- **FPL Official API**: Player injury/status news via `bootstrap-static` endpoint
- **Hardcoded Schedule**: 2025-26 Premier League gameweek dates (100% reliable)

---

## Architecture

### Service Layer
```
app/services/
+-- gameweekService.js           # Hardcoded 2025-26 schedule
+-- playerMatchingService.js     # Opta ID matching (98% success)
+-- formationOptimizerService.js # Mathematical lineup optimization
+-- scoringConversionService.js  # FFH data extraction and player enhancement
+-- v3ScoringService.js          # V3 Sleeper scoring orchestration
+-- v3/core.js                   # Calibrated position ratios + v3_pts embedding
+-- v3/conversionRatios.js       # Static fallback ratios
+-- fplNewsService.js            # FPL injury/status fetcher
+-- sleeperApiService.js         # Sleeper API with no-cache fetching
+-- calibrationService.js        # Per-player FFH-to-Sleeper calibration
+-- sleeperMatchupService.js     # Sleeper stats API for calibration
+-- cacheService.js              # Server-side cache management
```

### Component Architecture
```
app/components/
+-- DashboardHeader.js            # Top nav, tabs, scoring toggle
+-- GameweekDisplay.js            # Clickable gameweek status widget
+-- HomeTabContent.js             # Home dashboard with team health, news, fixtures
+-- OptimizerTabContent.js        # Start/Sit with formation visualization
+-- TransferTabContent.js         # Transfer analysis
+-- TransferPairRecommendations.js # Smart drop/add pairing
+-- ComparisonTabContent.js       # Drop/Add player comparison with verdict table
+-- CheatSheetTabContent.js       # Position-based rankings
+-- PlayerModal.js                # Detailed player modal with charts
+-- MyPlayersTable.js             # Player analytics table (memoized)
+-- MatchingTabContent.js         # Opta matching stats
+-- ComparisonChart.js            # Reusable bar chart
+-- ErrorBoundary.js              # React error boundary
```

### Utilities
```
app/utils/
+-- predictionUtils.js   # getNextNGameweeksTotal(), getAvgMinutesNextN() - SINGLE SOURCE OF TRUTH
+-- newsUtils.js         # timeAgo(), getFPLStatusBadge()
+-- gameweekStyles.js    # Gameweek status color utilities
+-- cacheManager.js      # Client-side caching with compression
+-- ffhDataUtils.js      # FFH data extraction (predictions + results merging)
```

---

## Scoring System

### Dual Scoring Modes
- **FFH Mode**: Pure Fantasy Premier League predictions from Fantasy Football Hub
- **V3 Mode**: Sleeper-adjusted predictions with calibrated position-based conversion ratios

### V3 Calibration
Position-based multipliers derived from Sleeper stats API (3190 samples, GW1-26):
- Calibrated per-player when sufficient data exists
- Falls back to position archetype ratios
- `v3_pts` embedded on each prediction entry for consistent client-side access

### Scoring Consistency (v3.8)
All components use a single scoring path:
- **Current GW**: `getNextNGameweeksTotal(player, scoringMode, currentGW, 1)` from predictions array
- **Next N GWs**: `getNextNGameweeksTotal(player, scoringMode, currentGW, N)`
- **Per-GW in charts**: `prediction.v3_pts` (calibrated, embedded per entry)
- **Season totals**: Pre-calculated `predicted_points` / `v3_season_total`

---

## Dashboard Tabs

1. **Home**: Team overview, league standings, team health widget, player news feed, live fixture schedule
2. **Players**: Comprehensive player table with filtering, search, and pagination
3. **Start/Sit**: Formation optimizer with visual pitch, actionable swap recommendations
4. **Transfers**: Transfer pair recommendations with net gain analysis
5. **Comparison**: Drop/Add player comparison with 7-metric verdict table
6. **Cheat Sheet**: Position-based rankings with timeframe selection
7. **Matching**: Player data integration status and Opta matching stats

---

## Getting Started

### Prerequisites
- Node.js 18+
- npm
- Sleeper Fantasy Football league
- Fantasy Football Hub API access (optional - fallback available)

### Installation
```bash
npm install
cp .env.example .env.local
# Add your Sleeper League ID and FFH API credentials
```

### Environment Variables
```env
SLEEPER_LEAGUE_ID=your_sleeper_league_id
FFH_AUTH_STATIC=your_ffh_auth_token
FFH_BEARER_TOKEN=your_ffh_bearer_token
```

### Development
```bash
npm run dev     # Start development server (http://localhost:3000)
npm run build   # Build for production
npm start       # Start production server
npm run lint    # Run ESLint checks
```

---

## Performance

- **Player Matching**: 98% accuracy via Opta ID system
- **Position Accuracy**: 100% (Sleeper authority)
- **Gameweek Detection**: 100% (hardcoded schedule)
- **Data Integration**: <2 seconds for complete dataset
- **Cache Hit Rate**: ~80% during normal usage
- **V3 Scoring**: Instant (no network overhead)

---

## Error Handling

- **FFH API Failure**: Automatic fallback to Sleeper-only mode
- **FPL API Failure**: Silently skipped, no impact on other features
- **Position Conflicts**: Sleeper data takes absolute precedence
- **Gameweek Issues**: Eliminated through hardcoded system
- **Stale Data**: `cache: 'no-store'` on Sleeper API fetches
- **Storage Quota**: Automatic cache cleanup and compression

---

## Recent Updates

### v3.8 - Scoring Consistency & Comparison Redesign (March 2025)
- Fixed scoring discrepancies across all tabs (unified to predictions array)
- Redesigned comparison tab for drop/add decisions with 7-metric verdict table
- Live GW prediction preservation (current GW no longer disappears when live)
- Team health widget uses FPL status codes for accurate availability
- Cheat sheet: minutes for Next GW, zero-point player filtering
- Stale standings fix via no-cache Sleeper API fetches

### v3.7 - FPL Injury & Status News Integration (February 2025)
- Real-time injury/status data from FPL `bootstrap-static` API
- Status badges, relative timestamps, color-coded news icons
- Graceful fallback on FPL API failure

### v3.6 - Scoring Consistency Standardization (January 2025)
- Centralized scoring utilities in `predictionUtils.js`
- V3 scoring simplified to position ratios only

### v3.5 - Smart Transfer Pair Recommendations (January 2025)
- "Drop X, Add Y" pairing algorithm with net season points gain
- Position-aware matching, form indicators, fixture difficulty

### v3.4 - Player Modal & Comparison Visualizations (December 2024)
- Detailed player modal with charts and fixture analysis
- Side-by-side comparison with bar charts and fixture tables

### v3.2 - V3 Sleeper Scoring (January 2025)
- Position-based FPL-to-Sleeper conversion system
- Validated against 175 actual GW results (2.78 MAE)

---

**Fantasy FC Playbook** - Bridging league management with predictive analytics for competitive fantasy football advantage.
