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

Fantasy FC Playbook is a Next.js 14 application that integrates Sleeper Fantasy Football league data with Fantasy Football Hub (FFH) predictions. The system uses Opta ID matching to achieve 98% player matching accuracy and provides fantasy football analytics with reliable gameweek tracking.

**Key Version**: v2.8 - Features hardcoded gameweek system for 100% reliability

## Architecture

### Tech Stack
- **Framework**: Next.js 14 with App Router
- **Styling**: Tailwind CSS with custom Sleeper-inspired design
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
│   └── scoringConversionService.js   # FPL→Sleeper point conversion
├── components/                    # UI components
│   ├── OptimizerTabContent.js        # Formation optimization interface
│   ├── TransferTabContent.js         # Transfer recommendations
│   └── MyPlayersTable.js            # Player analytics table
└── page.js                       # Main dashboard (25k+ lines)
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

### Gameweek System (v2.8)
- **Hardcoded Reliability**: Complete 38-gameweek schedule embedded in `gameweekService.js`
- **Zero Dependencies**: Works offline, immune to external API failures
- **Performance**: Sub-millisecond gameweek detection
- **Maintenance**: Annual schedule update only

### Transfer Analysis
- Position-based player recommendations with net gain calculations
- Interactive controls (gameweek slider, position filtering)
- Detailed player comparison modals
- Works with or without FFH predictions

### Formation Optimizer
- Mathematical constraint-based lineup optimization
- Support for multiple formations (3-5-2, 4-4-2, 4-5-1, etc.)
- Real-time optimization status indicators
- Visual formation displays

### Player Analytics
- PPG comparison (current vs predicted performance)
- Advanced filtering by position, team, owner, points
- Search with flexible pagination (10/25/50/100/All)
- Color-coded optimization and ownership indicators

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
- **Client-side**: 30-minute cache for user data
- **Server-side**: 15-minute cache for API responses
- **Gameweek**: Instant response (hardcoded, no caching needed)

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

## Performance Characteristics

- **API Response Time**: < 2 seconds for full data integration
- **Match Accuracy**: 98% (Opta ID-based matching)
- **Position Accuracy**: 100% (Sleeper authority)
- **Gameweek Reliability**: 100% (hardcoded system)
- **Cache Hit Rate**: ~80% during normal usage

## Troubleshooting

### Common Issues
1. **Missing Predictions**: System handles automatically with fallback data
2. **Position Mismatches**: Should not occur (100% Sleeper accuracy)
3. **FFH API Errors**: Automatic fallback to Sleeper-only mode
4. **Gameweek Issues**: Eliminated by hardcoded system

### Debugging Tools
- Console logs provide detailed execution information
- Enhanced error detection for malformed API responses
- Position assignment tracking and debugging
- Transfer analysis debug output for recommendation calculations

## Current Status

**Production Ready**: v2.8 represents a maturity milestone with:
- ✅ 100% reliable gameweek system (hardcoded)
- ✅ 98% player matching accuracy
- ✅ 100% position accuracy (Sleeper authority)
- ✅ Robust API error handling with graceful fallbacks
- ✅ Self-maintaining system (annual updates only)

The system is optimized for the 2025-26 Premier League season and requires minimal maintenance.