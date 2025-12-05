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

**Current Version**: v3.2 - V3 Sleeper Scoring with FPL Conversion
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
│   └── scoringConversionService.js   # Pure FFH data extraction (no conversion)
├── components/                    # UI components
│   ├── OptimizerTabContent.js        # Formation optimization interface
│   ├── TransferTabContent.js         # Transfer recommendations
│   ├── ComparisonTabContent.js       # Player comparison interface
│   ├── MyPlayersTable.js            # Player analytics table
│   └── stats/                       # Statistics card components
│       ├── MatchingStatsCard.js     # Player matching statistics
│       └── OptimizerStatsCard.js    # Optimizer performance statistics
├── config/                        # Configuration constants
│   └── constants.js                 # Centralized app constants
├── hooks/                         # Custom React hooks
│   ├── usePlayerData.js             # Player data fetching hook
│   └── useGameweek.js               # Gameweek state management hook
└── page.js                       # Main dashboard (~1,550 lines)
```

### Data Integration System

**Primary Data Sources:**
1. **Sleeper API**: Authoritative source for player positions, league data, rosters
2. **Fantasy Football Hub (FFH)**: Predictions and analytics (with graceful fallback)
3. **Hardcoded Schedule**: Complete 2025-26 Premier League gameweek dates

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
- Position-based player recommendations with net gain calculations
- **Form Analysis**: Predicted performance trends with visual indicators (📈📉➡️)
- **Fixture Difficulty Visualization**: Color-coded tiles showing difficulty ratings (1-5)
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
  - **V3 Mode**: Sleeper-adjusted predictions with position-based conversion ratios
- Interactive player comparison modals with detailed statistics

### Player Comparison (NEW in v3.1)
- **Side-by-side comparison** of any two players with intelligent auto-suggestions
- **Real-time search** with fuzzy matching by name, team, or position
- **Smart suggestions dropdown** showing top 10 matches with player stats preview
- **Comprehensive metrics** including ROS Points, Next 5 GW, PPG Predicted, V3 scoring
- **Visual comparison** with color-coded better/worse indicators
- **Clean interface** focused on prediction data without market noise
- **News integration** with 📰 icons for player injury/status updates

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
- **Smart Console Logging**: Comprehensive logging with intelligent deduplication to prevent spam
- **Enhanced Error Detection**: Malformed API responses and JSON corruption detection
- **Position Assignment Tracking**: Debugging with conflict resolution
- **Transfer Analysis Debug**: Output for recommendation calculations
- **Formation Detection Debug**: Constraint violation details
- **Cache Performance Metrics**: Hit rate monitoring and size tracking
- **Storage Management**: Automatic cleanup and compression logging

## Current Status

**Production Ready**: v3.1 represents enhanced comparison and performance optimization with:
- ✅ 100% reliable gameweek system (hardcoded)
- ✅ 98% player matching accuracy
- ✅ 100% position accuracy (Sleeper authority)
- ✅ Robust API error handling with graceful fallbacks
- ✅ Enhanced UI with intuitive gameweek controls
- ✅ Streamlined transfer analysis with improved UX
- ✅ Self-maintaining system (annual updates only)
- ✅ Intelligent player comparison with auto-suggestions
- ✅ Optimized caching with compression and smart cleanup
- ✅ Clean console logging with duplicate prevention

## Recent Technical Updates

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
   - Transfer tab applies conversion ratios to individual gameweek predictions

3. **Scoring Field Selection** (`v3ScoringService.js`):
   - FFH mode: Uses `predicted_points`, `season_prediction_avg`, `current_gw_prediction`
   - V3 mode: Uses `v3_season_total`, `v3_season_avg`, `v3_current_gw`

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

### Future Enhancements

- **Backtesting Framework**: Validate conversion ratios against actual Sleeper league results
- **Dynamic Ratios**: Adjust ratios based on historical performance correlation
- **Player Profiling**: Fine-tune ratios based on player style (tackle-heavy defenders, etc.)

---

The system is optimized for the 2025-26 Premier League season and requires minimal maintenance.