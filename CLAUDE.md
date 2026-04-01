# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
npm run dev          # Start development server (http://localhost:3000)
npm run build        # Build for production
npm test             # Run Jest unit tests (135 tests across 9 suites)
npm run check:scoring # Scoring consistency lint (catches banned field usage)
```

## Project Overview

Fantasy FC Playbook is a Next.js 14 application that integrates Sleeper Fantasy Football league data with Fantasy Football Hub (FFH) predictions. The system uses Opta ID matching to achieve 98% player matching accuracy and provides fantasy football analytics with reliable gameweek tracking and dual scoring systems.

**Current Version**: v4.5 - Multi-User Support
**Production Status**: Ready for 2025-26 Premier League season

## Architecture

### Tech Stack
- **Framework**: Next.js 14 with App Router
- **Styling**: Tailwind CSS with custom dark theme
- **State Management**: React hooks and context
- **API**: Next.js API routes with robust error handling

### Core Services Architecture

```
app/
├── api/                           # API endpoints
│   ├── integrated-players/route.js   # Main data integration (Sleeper + FFH)
│   ├── optimizer/route.js            # Formation optimization
│   ├── fpl-gameweek/route.js        # Hardcoded gameweek service
│   └── validate-league/route.js     # Sleeper league ID validation + roster owners
├── services/                      # Business logic services
│   ├── gameweekService.js            # Hardcoded 2025-26 schedule
│   ├── playerMatchingService.js      # Opta ID-based matching (98% success)
│   ├── formationOptimizerService.js  # Lineup optimization algorithms
│   ├── v3ScoringService.js           # V3 Sleeper scoring with FPL conversion
│   ├── scoringConversionService.js   # Pure FFH data extraction
│   ├── fplNewsService.js             # FPL bootstrap-static news/status
│   └── ffhCustomStatsService.js      # FFH players-custom Opta stats
├── components/                    # UI components
│   ├── DashboardHeader.js, SetupModal.js, PlayerModal.js
│   ├── OptimizerTabContent.js, TransferTabContent.js, ComparisonTabContent.js
│   └── stats/OptimizerStatsCard.js
├── hooks/                         # Custom React hooks
│   ├── usePlayerData.js, useGameweek.js, useUserConfig.js
└── utils/                         # Utility functions
    ├── predictionUtils.js            # Centralized scoring utilities
    └── cacheManager.js               # Client-side caching with compression
```

### Data Sources
1. **Sleeper API**: Authoritative source for player positions, league data, rosters
2. **Fantasy Football Hub (FFH)**: Per-GW predictions via `player-predictions` endpoint
3. **FFH Opta Stats**: Season stats (xG, xA, shots, tackles) via `players-custom` endpoint
4. **FPL Official API**: Player injury/status news via `bootstrap-static` endpoint
5. **Hardcoded Schedule**: Complete 2025-26 Premier League gameweek dates

**Position Authority**: Sleeper position data takes absolute precedence over FFH data.

**Matching Logic**: Exact Opta ID matching (98% success rate) with graceful fallback.

## Key Features

- **Multi-User Support**: Per-user league config via localStorage, first-run onboarding modal
- **Dual Scoring Systems**: Toggle between FFH FPL predictions and V3/V4 Sleeper scoring
- **Formation Optimizer**: Mathematical constraint-based lineup optimization (6 formations)
- **Live GW Locked Players**: Players whose match has started are locked in formation optimizer
- **Smart Transfer Pairing**: "Drop X, Add Y" recommendations with net gain analysis
- **Player Analytics**: Comprehensive filtering, search, comparison modals with charts
- **Opta Advanced Stats**: xG, xA, ICT surfaced across decision tabs
- **FPL Injury Status**: Real-time injury badges and news timestamps
- **Hardcoded Gameweek System**: 100% reliability, zero external dependencies

## Environment Configuration

Required environment variables:
```env
SLEEPER_LEAGUE_ID=your_league_id  # Fallback only, users configure via UI
FFH_AUTH_STATIC=your_ffh_auth_token
FFH_BEARER_TOKEN=your_ffh_bearer_token
```

## Sleeper FC Rules (IMPORTANT)

**Sleeper FC does NOT have:**
- **Captain** - No captain system, no 2x points for any player
- **Vice-captain** - No vice-captain either
- **Budget/Salary cap** - No transfer budget constraints
- **Transfer costs** - Free transfers anytime
- **Double Gameweeks (DGW)** - Players only play once per gameweek

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

### Scoring Consistency (CRITICAL)
All components must use the same scoring approach:

```javascript
// ✅ Correct - Use centralized utilities
const currentGwPoints = getNextNGameweeksTotal(player, scoringMode, currentGW, 1);
const perGwPoints = prediction.v3_pts || prediction.v4_pts || prediction.ffhPoints;
const seasonTotal = scoringMode === 'v3' ? player.v3_season_total : player.predicted_points;

// ❌ Incorrect - Don't use these patterns
const points = player.current_gw_prediction;  // Can diverge from predictions array
const points = player.v3_current_gw;          // Can diverge from predictions array
const points = convertToV3Points(ffhPts);     // Uses hardcoded ratios, unsafe for display
```

**Scoring Field Standards:**
- **Current GW**: Use `getNextNGameweeksTotal(player, scoringMode, currentGW, 1)` - reads from predictions array
- **Season Total**: `predicted_points` (FFH) / `v3_season_total` (V3) / `v4_season_total` (V4)
- **Season Average**: `season_prediction_avg` (FFH) / `v3_season_avg` (V3) / `v4_season_avg` (V4)
- **Next N GWs**: Use `getNextNGameweeksTotal()` from `app/utils/predictionUtils.js`
- **Per-GW in charts**: Use `prediction.v3_pts` / `prediction.v4_pts` (embedded per prediction)

**Validation**: Run `npm run check:scoring` to catch violations automatically.

### Component Structure
- Use client components (`'use client'`) for interactive features
- Implement error boundaries for robust UX
- Follow Tailwind CSS patterns, avoid styled-jsx
- Use responsive design patterns for mobile optimization
- Wrap console.log/warn in `process.env.NODE_ENV === 'development'` guards

### React Hooks Rules (CRITICAL)
- Place ALL hooks (useState, useMemo, useCallback, useEffect) BEFORE any conditional returns
- Use optional chaining (`player?.predictions`) to safely handle null props during hook execution
- Violation causes "Rendered more hooks than during the previous render" error

## V3 Sleeper Scoring System

V3 scoring converts FFH's FPL-based predictions into Sleeper custom league scoring using position-based conversion ratios.

### Conversion Ratios
- **GKP: 0.90x** - Subtract FPL appearance points, add save bonuses
- **DEF: 1.15x** - Add defensive stat rewards (tackles, interceptions, blocks)
- **MID: 1.05x** - Add versatility bonus (goals, assists, defensive actions)
- **FWD: 0.97x** - Subtract dispossession penalties

V3 scoring uses ONLY position ratios. Complex adjustments (form, fixture, injury, minutes) were removed in v3.6 as they caused inconsistencies and did not improve accuracy.

### Validation Results (GW 1-21, 2025-26 Season)
- **FFH Baseline**: 2.82 MAE (Mean Absolute Error)
- **V3 Performance**: 2.78 MAE (**1.3% improvement**, validated against 175 player-gameweek samples)

V3 represents the optimal balance - more complex approaches added variance without improving accuracy.

## Recent Technical Updates

### v4.5 - Multi-User Support (March 2026)
- **Per-user league config**: `useUserConfig` hook stores `leagueId` + `userId` in localStorage
- **SetupModal**: First-run onboarding - paste Sleeper league ID → validate → pick roster
- **Dynamic routing**: `integrated-players` and `optimizer` routes accept `leagueId` in request body
- **Scoped caching**: Server cache keys use `integrated-players-{leagueId}`; client cache keyed by league
- **No auth server required**: Config persists via localStorage

### v4.4 - Mobile Responsiveness Pass (March 2026)
- Responsive breakpoints across MyPlayersTable, PlayerModal, ComparisonTabContent, DashboardHeader
- Hide non-essential columns below `md` breakpoint; clamp font sizes for mobile
- `flex-wrap` for gameweek controls; emoji-only scoring buttons on mobile

### v4.3 - Code Cleanup & Expanded Tests (March 2026)
- Dead code removed: 9 unused functions, 3 unused re-export blocks
- Tab scroll indicator with fade gradient when tabs overflow
- Jest test suite: 135 tests across 9 suites (predictionUtils, newsUtils, v3ScoringService, gameweekStyles, etc.)

## Development Notes

- **JSX Compilation**: Avoid styled-jsx; use global CSS instead
- **V3 Scoring**: Minutes weighting critical for realistic predictions
- **Error Handling**: Always implement graceful fallbacks for external API dependencies
- **Theme System**: Application uses dark theme exclusively
- **Cache Strategy**: Compression essential for large datasets (1500+ players)
- **React Hooks**: All hooks BEFORE any conditional returns; use optional chaining for safety
- **Scoring Consistency**: NEVER create custom scoring functions in components - use `app/utils/predictionUtils.js`

---

The system is optimized for the 2025-26 Premier League season and requires minimal maintenance.
