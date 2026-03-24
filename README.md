# Fantasy FC Playbook

## Project Overview

**Fantasy FC Playbook** is a production-ready Next.js 14 application that bridges Sleeper Fantasy Football league management with advanced predictive analytics. The system achieves 98% player matching accuracy through Opta ID matching and provides comprehensive fantasy football analytics with 100% reliable gameweek tracking.

**Current Version:** 4.3 - Code Cleanup, Tab UX & Expanded Tests
**Status:** Production Ready
**Last Updated:** March 2026

---

## Key Features

### Player Data Integration
- **98% Match Accuracy** via Opta ID-based player matching between Sleeper and Fantasy Football Hub
- **Calibrated V3 Scoring**: Position-based FPL-to-Sleeper conversion with per-player calibration
- **V4 Ensemble Scoring**: Blends V3 (75%) with Sleeper projections (25%) for improved accuracy
- **Position Authority**: Sleeper position data takes absolute precedence (100% accuracy)
- **Smart Fallback**: Graceful degradation to Sleeper-only mode when external APIs fail

### Formation Optimizer (Start/Sit)
- **6 Formation Options**: 3-5-2, 4-4-2, 4-5-1, 3-4-3, 4-3-3, 5-4-1
- **Mathematical Optimization**: Constraint-based algorithms for optimal lineups
- **Actionable Recommendations**: Explicit "bench X, start Y" with net point gain
- **Visual Formation Display**: Interactive pitch diagrams with player positioning
- **Live GW Locked Players**: Players whose match has started/finished are locked in place with LOCKED badge

### Enhanced Transfer Analysis
- **Smart Transfer Pairing**: "Drop Player X, Add Player Y" recommendations with net gain
  - Position-aware matching (GKP-for-GKP, outfield flexibility)
  - Top 10 recommendations ranked by season points improvement
  - Form indicators and fixture difficulty visualization
- **Gameweek Range Analysis**: Customizable projection periods
- **Pure Predictions**: Rankings based on unmodified prediction data

### Player Comparison
- **Drop/Add workflow**: Left slot for roster players (grouped by position), right slot for free agents
- **Verdict table**: 7 time horizons (Next 1/3/5/10 GW, ROS, Avg Mins, PPG) with color-coded winner
- **Opta Quality section**: xG, xA, key passes (or saves for GKP) in verdict table
- **Collapsible detail panels**: Next 5 GW charts and full fixture tables
- **Swap button**: Quick player slot reversal

### Opta Advanced Stats (v4.0)
- **38 Opta season stats per player** via FFH `players-custom` endpoint
- **PlayerModal**: Collapsible "Advanced Stats" section, position-aware (outfield vs GK)
- **Decision support**: xG/xA surfaced in Comparison verdict, Transfer recommendations, Start/Sit cards, Scout pills
- **Per-90 context**: Stats shown with per-90 calculations where useful
- **513 players enriched** (all FFH-matched players)

### Cheat Sheet
- **Position-based rankings**: GKP, DEF, MID, FWD columns
- **GW range selector**: Customizable range for projection periods
- **Ownership filtering**: Show your players + top free agents, or all players
- **Predicted minutes**: Shown per player for availability insight

### Scout Tab
- **Waiver wire analysis**: Top free agents ranked by predicted points
- **Key threats**: Players projected to score heavily vs your upcoming opponents
- **xG badges**: Players with ≥1.0 xG season total highlighted

### Squad Fixture Forecast (v4.3)
- **8-GW difficulty strip** on Home tab showing color-coded avg difficulty and predicted squad pts per gameweek
- **Best/hardest windows**: Green ring highlights easiest consecutive 2-GW window; red highlights hardest

### Player News & Injury Status (v3.7)
- **FPL Official API integration**: Real-time injury and availability data
- **Status badges**: INJURED / DOUBTFUL / SUSPENDED / UNAVAILABLE / NOT IN SQUAD
- **Relative timestamps**: "2h ago", "3d ago" via `timeAgo()` utility
- **Graceful fallback**: FPL API failure silently skipped

### Player Modal
- **Detailed player view**: Click any player for stats, predictions, fixtures
- **Accessibility**: ESC closes modal, Tab focus trapped, `role="dialog" aria-modal="true"`
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
- **Fantasy Football Hub**: Predictions + Opta season stats (with fallback)
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
+-- v4/core.js                   # V4 ensemble blending (75% V3 + 25% Sleeper)
+-- fplNewsService.js            # FPL injury/status fetcher
+-- ffhCustomStatsService.js     # FFH players-custom Opta season stats (38 fields)
+-- sleeperApiService.js         # Sleeper API with no-cache fetching
+-- sleeperProjectionsService.js # Sleeper weekly projections for V4 blend
+-- calibrationService.js        # Per-player FFH-to-Sleeper calibration
+-- sleeperMatchupService.js     # Sleeper stats API for calibration
+-- cacheService.js              # Server-side cache management
```

### Component Architecture
```
app/components/
+-- DashboardHeader.js            # Top nav, tabs, scoring toggle, scroll shadow
+-- GameweekDisplay.js            # Clickable gameweek status widget
+-- HomeTabContent.js             # Home dashboard with health, news, fixtures
+-- SquadFixtureForecast.js       # 8-GW difficulty/pts forecast strip
+-- OptimizerTabContent.js        # Start/Sit with formation visualization
+-- TransferTabContent.js         # Transfer analysis
+-- TransferPairRecommendations.js # Smart drop/add pairing
+-- ComparisonTabContent.js       # Drop/Add player comparison with verdict table
+-- CheatSheetTabContent.js       # Position-based rankings
+-- ScoutTabContent.js            # Waiver wire and key threat analysis
+-- PlayerModal.js                # Detailed player modal with charts + a11y
+-- MyPlayersTable.js             # Player analytics table (memoized)
+-- MatchingTabContent.js         # Opta matching stats
+-- ComparisonChart.js            # Reusable bar chart
+-- ErrorBoundary.js              # React error boundary
+-- common/PlayerAvatar.js        # Player avatar with FPL photo
+-- common/AppLogo.js             # SVG logo component
```

### Utilities
```
app/utils/
+-- predictionUtils.js      # getNextNGameweeksTotal(), getAvgMinutesNextN() - SINGLE SOURCE OF TRUTH
+-- newsUtils.js            # timeAgo(), getFPLStatusBadge()
+-- gameweekStyles.js       # Gameweek status color utilities
+-- cacheManager.js         # Client-side caching with compression
+-- ffhDataUtils.js         # FFH data extraction (predictions + results merging)
+-- playerTransformUtils.js # Client-side player transform (preserves locked flags)
+-- teamImage.js            # Team logo URL helpers
```

---

## Scoring System

### Three Scoring Modes
- **FFH Mode**: Pure Fantasy Premier League predictions from Fantasy Football Hub
- **V3 Mode**: Sleeper-adjusted predictions with calibrated position-based conversion ratios
- **V4 Mode**: Ensemble blending V3 (75%) + Sleeper projections (25%) for improved accuracy

### V3 Calibration
Position-based multipliers derived from Sleeper stats API (3190 samples, GW1-26):
- Calibrated per-player when sufficient data exists
- Falls back to position archetype ratios
- `v3_pts` embedded on each prediction entry for consistent client-side access

### V4 Ensemble
- Blends calibrated V3 with Sleeper's own weekly projections
- Falls back to V3 for ~1300 players without Sleeper projection data
- `v4_pts` embedded on each prediction entry alongside `v3_pts`
- Backtest (6263 samples, GW1-29): Sleeper projections standalone MAE = 2.993

### Scoring Consistency (v3.8+)
All components use a single scoring path:
- **Current GW**: `getNextNGameweeksTotal(player, scoringMode, currentGW, 1)` from predictions array
- **Next N GWs**: `getNextNGameweeksTotal(player, scoringMode, currentGW, N)`
- **Per-GW in charts**: `prediction.v4_pts ?? prediction.v3_pts ?? prediction.predicted_pts`
- **Season totals**: Pre-calculated `predicted_points` / `v3_season_total` / `v4_season_total`
- **Lint check**: `npm run check:scoring` catches banned field usage in display components

---

## Dashboard Tabs

1. **Home**: Team overview, squad fixture forecast, league standings, team health, player news, live fixtures
2. **Start/Sit**: Formation optimizer with visual pitch, actionable swap recommendations, locked player support
3. **Transfers**: Transfer pair recommendations with net gain analysis and form/fixture context
4. **Cheat Sheet**: Position-based rankings with GW range selector
5. **Comparison**: Drop/Add player comparison with 7-metric verdict table and Opta quality section
6. **Scout**: Waiver wire analysis, key threats, xG badges
7. **Players**: Comprehensive player table with filtering, search, and pagination
8. **Matching**: Player data integration status and Opta matching stats

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
npm run dev           # Start development server (http://localhost:3000)
npm run build         # Build for production
npm start             # Start production server
npm run lint          # Run ESLint checks
npm run check:scoring # Scoring consistency lint (catches banned field usage)
npm test              # Run Jest unit tests (135 tests across 9 suites)
npm run test:coverage # Run tests with coverage report
```

---

## Performance

- **Player Matching**: 98% accuracy via Opta ID system
- **Position Accuracy**: 100% (Sleeper authority)
- **Gameweek Detection**: 100% (hardcoded schedule)
- **Data Integration**: <2 seconds for complete dataset
- **Cache Hit Rate**: ~80% during normal usage
- **V3/V4 Scoring**: Instant (no network overhead)

---

## Error Handling

- **FFH API Failure**: Automatic fallback to Sleeper-only mode
- **FPL API Failure**: Silently skipped, no impact on other features
- **Position Conflicts**: Sleeper data takes absolute precedence
- **Gameweek Issues**: Eliminated through hardcoded system
- **Stale Data**: `cache: 'no-store'` on Sleeper API fetches
- **Storage Quota**: Automatic cache cleanup and compression

---

## Testing

135 unit and integration tests across 9 suites:

| Suite | Environment | Tests |
|-------|-------------|-------|
| `predictionUtils.test.js` | node | 30 |
| `newsUtils.test.js` | node | 19 |
| `gameweekStyles.test.js` | node | 10 |
| `v3ScoringService.test.js` | node | 33 |
| `optimizer.integration.test.js` | node + MSW | 10 |
| `ffhCustomStats.integration.test.js` | node + MSW | 9 |
| `PlayerModal.test.js` | jsdom + RTL | 10 |
| `ComparisonTabContent.test.js` | jsdom + RTL | 8 |
| `OptimizerTabContent.test.js` | jsdom + RTL | 6 |

Integration tests use [MSW](https://mswjs.io/) to intercept Sleeper and FFH API calls.

---

## Recent Updates

### v4.3 - Code Cleanup, Tab UX & Expanded Tests (March 2026)
- Squad Fixture Forecast widget on Home tab (8-GW color-coded difficulty/pts strip)
- FFH Opta stats: `|| 0` → `?? 0` for correct nullish coalescion across all 28 stat fields
- Tab scroll shadow: fade gradient appears when tabs overflow off-screen
- ComparisonTabContent shows loading spinner during initial data load
- Jest dual-project setup (node + jsdom); MSW integration tests added
- Test count: 92 → 135 tests across 9 suites

### v4.2 - Dead Code Cleanup, Accessibility & Test Foundation (March 2026)
- Deleted 6 unused functions from `scoringConversionService.js` and `integrated-players/route.js`
- PlayerModal: ESC close, Tab focus trap, `role="dialog" aria-modal="true"`, scoring mode sync
- V4 added to `scoringMode` PropTypes across all components
- Minutes fallback simplified to 3 levels in `formationOptimizerService.js`
- 82 unit tests across 3 suites (predictionUtils, newsUtils, v3ScoringService)

### v4.1 - Live GW Locked Players & Prediction Fix (March 2026)
- Start/Sit predictions now show correctly during a live gameweek
- Locked player system: players whose match has started are locked in formation display
- Optimizer fetches FPL fixtures in parallel (zero latency overhead)

### v4.0 - Opta Advanced Stats Integration (March 2025)
- FFH `players-custom` endpoint: 38 Opta season stats per player
- Advanced stats in PlayerModal, Comparison verdict, Transfer cards, Start/Sit, Scout
- 513 players enriched with xG, xA, shots, tackles, ICT, saves, and more

### v3.9 - V4 Ensemble Model & Scoring Integrity (March 2025)
- V4 scoring mode: blends V3 (75%) with Sleeper projections (25%)
- Optimizer Start/Sit fix: now uses predictions array via `getNextNGameweeksTotal()`
- Scoring consistency lint: `npm run check:scoring` catches banned field usage
- Model accuracy badge (Sleeper projections MAE) in DashboardHeader

### v3.8 - Scoring Consistency & Comparison Redesign (March 2025)
- Fixed scoring discrepancies across all tabs (unified to predictions array)
- Redesigned comparison tab for drop/add decisions with 7-metric verdict table
- Live GW prediction preservation

---

**Fantasy FC Playbook** — Bridging league management with predictive analytics for competitive fantasy football advantage.
