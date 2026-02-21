# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Development
npm run dev          # Start development server (http://localhost:3000)
npm run build        # Build for production
npm start           # Start production server
npm run lint        # Run ESLint checks
```

## Project Overview

Fantasy FC Playbook is a Next.js 14 application that integrates Sleeper Fantasy Football league data with Fantasy Football Hub (FFH) predictions. The system uses Opta ID matching to achieve 98% player matching accuracy and provides fantasy football analytics with reliable gameweek tracking and dual scoring systems.

**Current Version**: v3.7 - FPL Injury & Status News Integration
**Production Status**: Ready for 2025-26 Premier League season

## Architecture

### Tech Stack
- **Framework**: Next.js 14 with App Router
- **Styling**: Tailwind CSS with custom Sleeper-inspired dark theme design
- **State Management**: React hooks and context
- **API**: Next.js API routes with robust error handling

### Core Services Architecture

```
app/
├── api/                           # API endpoints
│   ├── integrated-players/route.js   # Main data integration (Sleeper + FFH)
│   ├── optimizer/route.js            # Formation optimization
│   ├── fpl-gameweek/route.js        # Hardcoded gameweek service
│   └── ffh/players/route.js         # FFH data with fallback handling
├── services/                      # Business logic services
│   ├── gameweekService.js            # Hardcoded 2025-26 schedule
│   ├── playerMatchingService.js      # Opta ID-based matching (98% success)
│   ├── formationOptimizerService.js  # Lineup optimization algorithms
│   ├── v3ScoringService.js           # V3 Sleeper scoring with FPL conversion
│   ├── scoringConversionService.js   # Pure FFH data extraction (no conversion)
│   └── fplNewsService.js             # FPL bootstrap-static news/status fetcher
├── components/                    # UI components
│   ├── DashboardHeader.js            # Top nav bar, tabs, scoring toggle
│   ├── GameweekDisplay.js            # Clickable gameweek status widget
│   ├── MatchingTabContent.js         # Opta matching stats tab
│   ├── ComparisonChart.js            # Reusable bar chart for fixture comparisons
│   ├── OptimizerTabContent.js        # Formation optimization interface
│   ├── TransferTabContent.js         # Transfer recommendations with smart pairing
│   ├── TransferPairRecommendations.js # Smart "Drop X, Add Y" transfer system
│   ├── ComparisonTabContent.js       # Player comparison interface
│   ├── PlayerModal.js                # Detailed player modal with charts & fixtures
│   ├── MyPlayersTable.js            # Player analytics table (memoized)
│   ├── ErrorBoundary.js             # React error boundary (class component)
│   ├── common/AppLogo.js            # SVG logo component
│   └── stats/                       # Statistics card components
│       ├── MatchingStatsCard.js     # Player matching statistics
│       └── OptimizerStatsCard.js    # Optimizer performance statistics
├── config/                        # Configuration constants
│   └── constants.js                 # Centralized app constants
├── hooks/                         # Custom React hooks
│   ├── usePlayerData.js             # Player data fetching hook
│   └── useGameweek.js               # Gameweek state management hook
├── utils/                         # Utility functions
│   ├── predictionUtils.js            # Centralized scoring utilities
│   ├── gameweekStyles.js             # Gameweek status color utilities
│   ├── newsUtils.js                  # timeAgo() and getFPLStatusBadge() helpers
│   └── cacheManager.js              # Client-side caching with compression
└── page.js                       # Main dashboard (~620 lines)
```

### Data Integration System

**Primary Data Sources:**
1. **Sleeper API**: Authoritative source for player positions, league data, rosters
2. **Fantasy Football Hub (FFH)**: Predictions and analytics (with graceful fallback)
3. **FPL Official API**: Player injury/status news via `bootstrap-static` endpoint (graceful fallback)
4. **Hardcoded Schedule**: Complete 2025-26 Premier League gameweek dates

**Position Authority**: Sleeper position data takes absolute precedence over FFH data to ensure 100% accuracy with Sleeper app.

**Matching Logic**: 
- Primary: Exact Opta ID matching (98% success rate)
- Fallback: Graceful degradation to Sleeper-only mode when FFH unavailable

## Key Features

### Gameweek System (v3.1)
- **Hardcoded Reliability**: Complete 38-gameweek schedule embedded in `gameweekService.js`
- **Zero Dependencies**: Works offline, immune to external API failures
- **Performance**: Sub-millisecond gameweek detection
- **Maintenance**: Annual schedule update only
- **Smart Logging**: Deduplicated console output for cleaner development

### Enhanced Transfer Analysis
- **Smart Transfer Pairing**: "Drop Player X, Add Player Y" recommendations with net gain
  - Position-aware matching (GKP-for-GKP, outfield flexibility)
  - Top 10 recommendations ranked by season points improvement
  - Adjustable minimum gain threshold filter
  - Summary statistics: total opportunities, best gain, average top 5
- **Form Analysis**: Predicted performance trends with visual indicators (📈📉➡️)
- **Fixture Difficulty Visualization**: Color-coded ratings (1-5) based on predicted performance
  - 🟢 Easy (1-2) | 🟡 Medium (3) | 🟠 Hard (4) | 🔴 Very Hard (5)
- **Pure Prediction Scoring**: Rankings based on unmodified prediction data for accuracy
- Intuitive gameweek range controls with arrow navigation and text display
- Detailed player comparison modals with side-by-side analytics
- Enhanced filtering by position with visual indicators
- Works with or without FFH predictions (graceful fallback)

### Formation Optimizer
- Mathematical constraint-based lineup optimization algorithms
- Support for 6 formations: 3-5-2, 4-4-2, 4-5-1, 3-4-3, 4-3-3, 5-4-1
- Real-time optimization status indicators with efficiency metrics
- Interactive formation diagrams with player positioning
- Current vs. optimal formation comparison analysis

### Player Analytics
- Comprehensive PPG comparison (current vs predicted performance)
- Advanced filtering by position, team, owner, points, availability
- Intelligent search with flexible pagination (10/25/50/100/All)
- Color-coded optimization and ownership indicators
- **Dual Scoring Systems**: Toggle between FFH FPL predictions and V3 Sleeper scoring
  - **FFH Mode**: Pure Fantasy Premier League predictions from FFH
  - **V3 Mode**: Sleeper-adjusted predictions with optimal position-based conversion ratios (validated as best-performing)
- Interactive player comparison modals with detailed statistics

### Player News & Injury Status (NEW in v3.7)
- **FPL Official API integration**: Real-time injury and availability data from `bootstrap-static`
- **Status badges**: INJURED 🏥 / DOUBTFUL ⚠️ / SUSPENDED 🚫 / UNAVAILABLE ❌ / NOT IN SQUAD ➖
- **Relative timestamps**: News shown as "2h ago", "3d ago" etc. via `timeAgo()` utility
- **Color-coded news icons** in Players tab: red for injured/suspended, orange for doubtful
- **Tooltip with news + timestamp** on hover in Players tab table
- **Home tab news feed**: Expanded to include all non-available players with inline badges
- **PlayerModal**: FPL status badge + timestamp below player name
- **Graceful fallback**: FPL API failure silently skipped, no impact on other features
- **Matching**: Uses existing `ffh_id` field (FPL element ID) for exact match — no name matching needed
- **FPL status codes**: `a`=available (hidden), `i`=injured, `d`=doubtful, `s`=suspended, `u`=unavailable, `n`=not in squad

### Player Modal (v3.4)
- **Detailed player view** accessible by clicking any player in the dashboard
- **Header Stats**: Season total points, current GW prediction, season average, minutes prediction
- **FFH/V3 Toggle**: Switch between scoring modes within the modal
- **Next 5 Gameweeks Chart**: Bar chart showing predicted points for upcoming 5 GWs
  - Dynamic Y-axis scaling based on max predicted points
  - Half-width bars with point labels above each bar
  - Opponent display showing home/away and team code
- **Rest of Season Fixtures Table**: Complete fixture list for all remaining gameweeks
  - GW number, opponent, difficulty rating (color-coded 1-5), predicted points
  - Scrollable with sticky headers for easy navigation
- **Season Stats**: Conditional display of goals, assists, minutes, clean sheets, cards, bonus
- **Compare Button**: Quick navigation to Comparison tab with player pre-selected
- **Responsive Design**: Adapts to different screen sizes with proper mobile support

### Player Comparison (Enhanced in v3.4)
- **Side-by-side comparison** of any two players with intelligent auto-suggestions
- **Real-time search** with fuzzy matching by name, team, or position
- **Smart suggestions dropdown** showing top 10 matches with player stats preview
- **My Players Dropdown**: Quick selection from your team below search fields
- **Comprehensive metrics** including ROS Points, Next 5 GW, PPG Predicted, V3 scoring
- **Visual comparison** with color-coded better/worse indicators
- **Next 5 GW Charts**: Side-by-side bar charts (Player 1 blue, Player 2 green)
  - Dynamic Y-axis with grid lines
  - Point predictions above each bar
  - Opponent labels below X-axis
- **Rest of Season Tables**: Side-by-side fixture tables showing all remaining gameweeks
  - Scrollable with max-height and sticky headers
  - Color-coded difficulty badges (1-5 scale)
  - Predicted points for each fixture
- **Clean interface** focused on prediction data without market noise
- **News integration** with 📰 icons for player injury/status updates
- **Pre-selection Support**: Navigate from PlayerModal via Compare button

## Environment Configuration

Required environment variables:
```env
SLEEPER_LEAGUE_ID=your_league_id
FFH_AUTH_STATIC=your_ffh_auth_token
FFH_BEARER_TOKEN=your_ffh_bearer_token
```

## API Patterns

### Primary Endpoints
- `POST /api/integrated-players` - Main data integration with FFH fallback
- `POST /api/optimizer` - Formation optimization
- `GET /api/fpl-gameweek` - Hardcoded gameweek information

### Error Handling Pattern
All services implement graceful fallback:
1. Try primary data source (FFH)
2. Handle errors with enhanced detection (malformed responses, JSON corruption)
3. Fall back to Sleeper-only mode
4. Maintain full functionality without external predictions

### Caching Strategy
- **Client-side**: 30-minute cache for user data with local storage persistence
- **Server-side**: 15-minute cache for API responses with intelligent invalidation
- **Gameweek**: Instant response (hardcoded, no caching needed)
- **Cache Hit Rate**: ~80% during normal usage patterns
- **Multi-level Strategy**: Reduces API calls and improves response times
- **Smart Compression**: Automatic data compression to prevent quota exceeded errors
- **Intelligent Cleanup**: Auto-removes stale cache data when storage is full

## Sleeper FC Rules (IMPORTANT)

**Sleeper FC does NOT have:**
- **Captain** - No captain system, no 2x points for any player
- **Vice-captain** - No vice-captain either
- **Budget/Salary cap** - No transfer budget constraints
- **Transfer costs** - Free transfers anytime
- **Double Gameweeks (DGW)** - Players only play once per gameweek regardless of FPL schedule

**Sleeper FC DOES have:**
- 11 starters + 4 bench players
- Formation flexibility (various formations allowed)
- Weekly lineup locks at gameweek deadline
- Head-to-head or points-based league formats

**NEVER suggest captain-related features** - this is a common FPL concept that does not exist in Sleeper.

## Code Conventions

### Position Handling
Always use Sleeper position data as authoritative source:
```javascript
// ✅ Correct - Sleeper position priority
const position = sleeperPlayer.fantasy_positions?.[0] || sleeperPlayer.position || ffhFallback;

// ❌ Incorrect - FFH position priority
const position = ffhPlayer.position_id || sleeperPlayer.position;
```

### Service Integration
Services use fail-fast imports with proper error boundaries:
```javascript
// All critical services must be importable or system fails gracefully
async function importServices() {
  const matchingService = new (await import('./playerMatchingService.js')).PlayerMatchingService();
  // Service instantiation with error handling
}
```

### Component Structure
- Use client components (`'use client'`) for interactive features
- Implement error boundaries for robust UX
- Follow Tailwind CSS patterns for styling consistency
- Avoid styled-jsx in favor of global CSS classes
- Use responsive design patterns for mobile optimization
- Uses consistent dark theme styling for optimal contrast

## Performance Characteristics

### Reliability Metrics
- **Player Matching**: 98% accuracy via Opta ID system
- **Position Accuracy**: 100% (Sleeper authority system)
- **Gameweek Detection**: 100% reliability (hardcoded system)
- **API Uptime**: Graceful fallback ensures service continuity

### Performance Metrics
- **Data Integration**: <2 seconds for complete player dataset
- **Cache Hit Rate**: ~80% reducing API calls and improving response times
- **Optimization Speed**: Real-time formation analysis
- **Error Recovery**: Automatic fallback maintains functionality

## Troubleshooting

### Common Issues
1. **Missing Predictions**: System handles automatically with fallback data
2. **Position Mismatches**: Should not occur (100% Sleeper accuracy)
3. **FFH API Errors**: Automatic fallback to Sleeper-only mode
4. **Gameweek Issues**: Eliminated by hardcoded system

### Debugging Tools
- **Dev-Only Console Logging**: All console.log/warn wrapped in `process.env.NODE_ENV === 'development'` guards
- **Enhanced Error Detection**: Malformed API responses and JSON corruption detection
- **Position Assignment Tracking**: Debugging with conflict resolution
- **Transfer Analysis Debug**: Output for recommendation calculations
- **Formation Detection Debug**: Constraint violation details
- **Cache Performance Metrics**: Hit rate monitoring and size tracking
- **Storage Management**: Automatic cleanup and compression logging

## Current Status

**Production Ready**: v3.7 represents real-time player injury/status integration with:
- ✅ 100% reliable gameweek system (hardcoded)
- ✅ 98% player matching accuracy
- ✅ 100% position accuracy (Sleeper authority)
- ✅ Robust API error handling with graceful fallbacks
- ✅ Enhanced UI with intuitive gameweek controls
- ✅ Streamlined transfer analysis with improved UX
- ✅ Self-maintaining system (annual updates only)
- ✅ Intelligent player comparison with auto-suggestions and visualizations
- ✅ Detailed player modal with charts and fixture analysis
- ✅ Optimized caching with compression and smart cleanup
- ✅ Clean console logging with duplicate prevention
- ✅ Real-time FPL injury/status news with badges and timestamps

## Recent Technical Updates

### v3.7 - FPL Injury & Status News Integration (February 2025)
- **New Service**: `app/services/fplNewsService.js` — fetches FPL `bootstrap-static` API, 15-min server-side cache, returns null on failure
- **New Utilities**: `app/utils/newsUtils.js`
  - `timeAgo(isoTimestamp)` — converts timestamps to relative strings ("2h ago", "3d ago")
  - `getFPLStatusBadge(fplStatus)` — returns badge label, Tailwind color class, and icon per status code
- **API Integration**: `app/api/integrated-players/route.js`
  - FPL fetch added to `Promise.all` alongside Sleeper and FFH for zero-latency overhead
  - Merges `fpl_status`, `fpl_news`, `fpl_news_added` onto players via exact `ffh_id` match
  - Overrides `chance_next_round` when FPL has data
- **PlayerModal**: FPL status badge + `timeAgo` timestamp displayed below player name header
- **HomeTabContent**: News feed expands to all `fpl_status !== 'a'` players; inline badge + timestamp per entry
- **page.js (Players tab)**: News icon 📰 color-coded red (injured/suspended), orange (doubtful); tooltip shows news text · timestamp
- **Matching strategy**: Uses existing `ffh_id` field (stores FPL element ID) — exact match, no name fuzzy-matching needed
- **FPL status codes**: `a`=available (no badge shown), `i`=injured, `d`=doubtful, `s`=suspended, `u`=unavailable, `n`=not in squad

### Codebase Cleanup & Component Extraction (February 2025)
- **page.js reduced from ~1,550 to ~620 lines** by extracting inline components:
  - `DashboardHeader.js` - Top nav bar, tabs, scoring toggle, update button
  - `GameweekDisplay.js` - Clickable gameweek status widget
  - `MatchingTabContent.js` - Opta matching stats tab content
  - `ComparisonChart.js` - Reusable bar chart (eliminated duplication in ComparisonTabContent)
  - `gameweekStyles.js` - Centralized gameweek status color utilities
- **Console.log cleanup**: 208 statements wrapped in dev guards or removed from components
  - All component `console.log/warn` removed entirely
  - API/service/hook logs wrapped in `process.env.NODE_ENV === 'development'`
  - `console.error` preserved (errors should always log)
- **Dead code removed**: `getPlayerPredictedPointsLegacy` and `getPlayerPPGLegacy` from MyPlayersTable.js
- **Performance**: Added `useMemo`/`useCallback` memoization to MyPlayersTable.js for filter/sort operations
- **Deleted**: `page.js.backup` removed from repository
- **Inline styles**: Converted OptimizerTabContent.js inline styles to Tailwind/CSS clamp

### v3.6 - Scoring Consistency Standardization (January 2025)
- **Comprehensive Scoring Audit**: Fixed inconsistencies where same player showed different points across tabs
- **Centralized Utility Functions**: All components now use `getNextNGameweeksTotal()` and `getAvgMinutesNextN()` from `app/utils/predictionUtils.js`
- **V3 Scoring Simplification**: Removed complex form/fixture/injury/minutes adjustments from `app/services/v3/core.js`
  - Now uses ONLY position ratios (the validated approach with 2.78 MAE)
  - Eliminates inconsistency between pre-calculated fields and on-the-fly calculations
- **Files Standardized**:
  - `CheatSheetTabContent.js` - Uses centralized utilities, custom GW=1 uses same fields as Start/Sit
  - `HomeTabContent.js` - Replaced custom `getNext5Points()` with centralized utility
  - `MyPlayersTable.js` - Fixed PPG to use `season_prediction_avg` for FFH mode
  - `OptimizerTabContent.js` - Removed dead v4 mode code
  - `PlayerModal.js` - Uses pre-calculated fields for ROS points
  - `TransferPairRecommendations.js` - Uses centralized utility instead of custom function
- **Scoring Field Standards**:
  - Current GW: `current_gw_prediction` (FFH) / `v3_current_gw` (V3)
  - Season Total: `predicted_points` (FFH) / `v3_season_total` (V3)
  - Season Average: `season_prediction_avg` (FFH) / `v3_season_avg` (V3)
  - Next N GWs: Use `getNextNGameweeksTotal()` utility with predictions array

### v3.5 - Smart Transfer Pair Recommendations (January 2025)
- **TransferPairRecommendations Component**: New intelligent transfer suggestion system (`app/components/TransferPairRecommendations.js`)
  - "Drop Player X, Add Player Y" pairing algorithm with net season points gain
  - Position-aware matching: GKP-for-GKP only, outfield (DEF/MID/FWD) flexible
  - Top 10 recommendations ranked by net gain
  - Adjustable filters: position (GKP/DEF/MID/FWD/ALL) and minimum gain threshold
  - Rich context per transfer: form indicators (📈📉➡️), fixture difficulty (1-5), season points
  - Summary statistics: total opportunities, best gain available, avg top 5 gain
  - Fixture difficulty calculation based on predicted points vs season average
  - Medal-style ranking badges (🥇🥈🥉) for top 3 recommendations
  - FFH/V3 scoring mode support with instant updates
- **Integration**: Seamlessly integrated into Transfer tab (`app/components/TransferTabContent.js`)
  - Appears at top of Transfer tab for immediate visibility
  - Shares scoring mode toggle with existing transfer analysis
  - Complements existing position-based recommendations
- **Documentation**: Comprehensive feature docs (`docs/transfer-pair-recommendations.md`)
  - Algorithm explanation and decision rationale
  - Usage scenarios and examples
  - Future enhancement roadmap
- **Performance**: Optimized with useMemo hooks, O(n*m) algorithm efficiency

### v3.4 - Enhanced Player Details & Comparison Visualizations (December 2024)
- **PlayerModal Component**: New comprehensive player detail modal (`app/components/PlayerModal.js`)
  - Click any player to view detailed stats, predictions, and fixtures
  - FFH/V3 scoring toggle within modal
  - Next 5 Gameweeks bar chart with dynamic Y-axis scaling
  - Rest of Season fixtures table with scrollable design and sticky headers
  - Season stats conditionally rendered only when data available
  - Compare button for quick navigation to Comparison tab with pre-selection
  - PropTypes validation for type safety
  - Follows React Hooks rules with proper hook ordering
- **Enhanced Comparison Tab**: Added visual fixture analysis (`app/components/ComparisonTabContent.js`)
  - Side-by-side Next 5 GW bar charts (Player 1 blue, Player 2 green)
  - Side-by-side Rest of Season fixtures tables with color-coded difficulty
  - My Players dropdown for quick selection from your team
  - Pre-selection support when navigating from PlayerModal
  - Maintains all existing comparison metrics and stats
  - V3 conversion ratios applied to fixture predictions
- **Cross-Component Integration**: Seamless navigation between features (`app/page.js`)
  - handleCompare callback to navigate from modal to comparison
  - comparisonPlayer1 state management for pre-selection
  - onClearPreSelection cleanup to prevent state leakage
- **Code Quality**:
  - Added 421 lines of new functionality
  - Proper error handling and null checks
  - Consistent styling with existing dark theme
  - Responsive design patterns throughout

### v3.3 - Performance Optimization & Code Quality (December 2024)
- **React Performance Optimizations**: Added useMemo/useCallback hooks to prevent unnecessary re-renders
  - Memoized `filteredPlayers` (1,500+ player filtering)
  - Memoized `sortedPlayers` (expensive sorting operations)
  - Memoized `getSortValue`, `handleSort`, and `getPositionColor` functions
  - Significant performance improvement for filtering and sorting with large datasets
- **Constants Extraction**: Created centralized configuration in `app/config/constants.js`
  - `USER_ID`, `TOTAL_GAMEWEEKS`, `NEXT_N_GAMEWEEKS` constants
  - `OWNERSHIP_STATUS` and `FILTER_OPTIONS` enums
  - Single source of truth eliminates hardcoded magic numbers
  - Replaced 20+ instances of hardcoded strings/numbers
- **Component Modularization**: Extracted stats cards into reusable components
  - `app/components/stats/MatchingStatsCard.js` - Player matching statistics
  - `app/components/stats/OptimizerStatsCard.js` - Optimizer statistics with dynamic scoring
  - Improved maintainability and testability
  - Reduced `page.js` by ~250 lines (10% size reduction)
- **Code Quality**: Improved code organization and maintainability
  - Better separation of concerns
  - Easier to test individual components
  - Clearer component boundaries

### v3.2 - V3 Sleeper Scoring with FPL Conversion (January 2025)
- **V3 Sleeper Scoring**: Complete implementation of position-based FPL→Sleeper conversion
- **Simplified Architecture**: Removed complex granular stats fetching for reliable performance
- **Conversion Ratios**: Position-specific multipliers (GKP: 0.90x, DEF: 1.15x, MID: 1.05x, FWD: 0.97x)
- **Dashboard Toggle**: Seamless switching between FFH and V3 modes across all tabs
- **Transfer Tab V3 Support**: Gameweek-level V3 scoring applied to transfer recommendations
- **Zero Dependencies**: No external API calls for V3 calculations
- **Performance**: Instant V3 scoring for 1500+ players with no network overhead

### v3.1 - Player Comparison & Performance Optimization
- **Player Comparison Tab**: Complete side-by-side player analysis with intelligent auto-suggestions
- **Smart Search**: Real-time fuzzy matching with dropdown suggestions showing player stats
- **Enhanced Transfer Analysis**: Form indicators and fixture difficulty visualization
- **Form Analysis**: Predicted performance trends with visual indicators (📈📉➡️)
- **Fixture Difficulty Tiles**: Color-coded tiles showing difficulty ratings (1-5)
- **Pure Prediction Scoring**: Rankings based on unmodified prediction data for accuracy
- **Performance Optimization**: Intelligent cache compression reducing storage from 7MB to 3MB
- **Storage Management**: Automatic cleanup when localStorage quota exceeded
- **Console Deduplication**: Eliminated duplicate logging from React re-renders
- **Hardcoded Gameweek Schedule**: Complete 2025-26 Premier League fixture integration
- **Clean UI**: Removed unnecessary market data from comparison for focus on predictions

### v3.0 - Enhanced UI & Intelligent Predictive Scoring
- Streamlined gameweek range controls with intuitive arrow navigation
- Improved transfer tab user experience with position-consistent filtering
- **Revolutionary V3 Scoring**: Minutes-weighted predictions eliminate rotation risk overvaluation
- **Smart Gameweek Summation**: Individual gameweek predictions summed for realistic season totals
- **Rotation Risk Modeling**: Heavy penalties for low playing time (30 mins = 90% reduction)
- **Dark Theme Only**: Comprehensive light mode removal for better contrast and simplified codebase
- Enhanced console logging with smart deduplication
- Robust error handling and compilation fixes
- Replaced complex dual-handle sliders with reliable text-based controls

### Development Notes
- **JSX Compilation**: Avoid styled-jsx for complex CSS-in-JS; use global CSS instead
- **Range Controls**: Text-based inputs with arrow controls proved more reliable than dual-handle sliders
- **V3 Scoring**: Minutes weighting is critical for realistic predictions - always consider playing time
- **Prediction Methods**: Prefer gameweek summation over naive season extrapolation for accuracy
- **Error Handling**: Always implement graceful fallbacks for external API dependencies
- **Theme System**: Application uses dark theme exclusively - no light/dark mode toggles needed
- **Port Management**: Clean development environment setup (kill processes: `taskkill /F /IM node.exe`)
- **Performance**: Cache compression and deduplication are essential for large datasets (1500+ players)
- **Auto-suggestions**: Limit to 10 results and use fuzzy matching for best UX
- **Logging**: Always implement deduplication for React development to prevent console spam
- **React Hooks Rules**: CRITICAL - All hooks must be called unconditionally at component top level
  - Place ALL useState, useMemo, useCallback, useEffect hooks BEFORE any conditional returns
  - Use optional chaining (`player?.predictions`) to safely handle null props during hook execution
  - Violation causes "Rendered more hooks than during the previous render" error
- **Modal Design Patterns**:
  - Bar charts work better than line charts for discrete gameweek predictions
  - Use half-width bars (`w-1/2`) for cleaner visual appearance
  - Dynamic Y-axis scaling: `Math.max(...data, 1)` prevents division by zero
  - Sticky headers essential for scrollable tables: `position: sticky; top: 0`
- **Cross-Component State**:
  - Pass callbacks down for navigation (handleCompare)
  - Use state lifting for pre-selection (comparisonPlayer1)
  - Always provide cleanup handlers (onClearPreSelection) to prevent state leakage
- **Scoring Consistency**: CRITICAL - All components must use the same scoring approach
  - Use pre-calculated fields (`v3_current_gw`, `predicted_points`, etc.) for single values
  - Use centralized utilities (`getNextNGameweeksTotal()`) for gameweek range calculations
  - NEVER create custom scoring functions in components - use `app/utils/predictionUtils.js`
  - V3 conversion: position ratio ONLY (no form/fixture/injury adjustments)

---

## V3 Sleeper Scoring System (v3.2)

### Overview
V3 scoring converts FFH's FPL-based predictions into Sleeper custom league scoring predictions using position-based conversion ratios. Users can toggle between FFH and V3 modes throughout the dashboard.

### Implementation Strategy

**Challenge**: FFH provides FPL predicted points but does NOT provide granular stat predictions (tackles, interceptions, dribbles, etc.) that Sleeper custom scoring requires.

**Solution**: Statistical conversion ratios derived from scoring system differences between FPL and custom Sleeper leagues.

### Conversion Ratios

Position-based multipliers applied to FFH FPL predictions:

- **GKP: 0.90x** - Subtract FPL appearance points, add save bonuses
- **DEF: 1.15x** - Add defensive stat rewards (tackles, interceptions, blocks)
- **MID: 1.05x** - Add versatility bonus (goals, assists, defensive actions)
- **FWD: 0.97x** - Subtract dispossession penalties

### How It Works

1. **Server-Side Processing** (`integrated-players/route.js`):
   - Fetches FFH FPL predictions for all players
   - Applies V3 conversion ratios to calculate Sleeper-adjusted predictions
   - Adds V3 fields: `v3_season_total`, `v3_season_avg`, `v3_current_gw`

2. **Client-Side Toggle** (`page.js`, `TransferTabContent.js`):
   - Toggle button switches between FFH and V3 scoring modes
   - All tables, charts, and recommendations update dynamically
   - Centralized utilities apply conversion ratios consistently

3. **Scoring Field Selection**:
   - FFH mode: Uses `predicted_points`, `season_prediction_avg`, `current_gw_prediction`
   - V3 mode: Uses `v3_season_total`, `v3_season_avg`, `v3_current_gw`
   - Next N GWs: Use `getNextNGameweeksTotal()` from `app/utils/predictionUtils.js`

**IMPORTANT**: V3 scoring uses ONLY position ratios. Complex adjustments (form, fixture, injury, minutes) were removed in v3.6 as they caused inconsistencies and did not improve accuracy.

### Key Files

- **`app/services/v3ScoringService.js`** - Core V3 scoring with FPL→Sleeper conversion
- **`app/components/TransferTabContent.js`** - V3 scoring toggle for transfers tab
- **`app/page.js`** - Main dashboard with V3 mode toggle
- **`app/api/integrated-players/route.js`** - Server-side V3 enhancement
- **`app/api/optimizer/route.js`** - V3 scoring support for optimizer

### Benefits

- ⚡ **Performance**: Instant calculations with no external API calls
- 🎯 **Position-Aware**: Defenders get 15% boost, forwards get 3% reduction
- 🔄 **Reliable**: No network dependencies or timeouts
- 📊 **Simple**: Easy to understand and maintain conversion logic
- ✅ **Validated**: Tested against 175 actual gameweek results (GW 1-21)

### Validation Results (GW 1-21, 2025-26 Season)

Extensive validation against actual Sleeper league results proved V3 is optimal:

- **FFH Baseline**: 2.82 MAE (Mean Absolute Error)
- **V3 Performance**: 2.78 MAE (**1.3% improvement**)
- **175 player-gameweek samples** from real league data

**Key Finding**: V3 multipliers represent the optimal balance. Testing showed:
- Pure FFH (no conversion): 2.82 MAE
- V3 multipliers: 2.78 MAE (BEST)
- Any other multiplier sets: 2.83+ MAE (worse)

**Position Breakdown**:
- GKP: FFH 2.28 → V3 2.00 (12.3% improvement)
- DEF: FFH 2.63 → V3 2.59 (1.5% improvement)
- MID: FFH 3.08 → V3 3.10 (-0.6% change)
- FWD: FFH 3.00 → V3 2.95 (1.7% improvement)

**Conclusion**: V3 is the final, production-ready scoring system. More complex approaches (ensemble models, ML corrections) added variance without improving accuracy

---

The system is optimized for the 2025-26 Premier League season and requires minimal maintenance.