# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
npm run dev          # Start development server (http://localhost:3000)
npm run build        # Build for production
npm test             # Run Jest unit tests (240 tests across 13 suites)
npm run check:scoring # Scoring consistency lint (catches banned field usage)
```

## Project Overview

Fantasy FC Playbook is a Next.js 14 application that integrates Sleeper Fantasy Football league data with Fantasy Football Hub (FFH) predictions. The system uses Opta ID matching to achieve 98% player matching accuracy and provides fantasy football analytics with reliable gameweek tracking and dual scoring systems.

**Current Version**: v6.3 - Navigation Redesign & Bug Fixes
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
│   ├── validate-league/route.js     # Sleeper league ID validation + roster owners
│   └── draft-analysis/route.js      # Sleeper draft data proxy (1-hr cache)
├── services/                      # Business logic services
│   ├── gameweekService.js            # Hardcoded 2025-26 schedule
│   ├── playerMatchingService.js      # Opta ID-based matching (98% success)
│   ├── formationOptimizerService.js  # Lineup optimization algorithms
│   ├── v3/core.js                    # V3 Sleeper scoring (FFH × position ratio)
│   ├── v4/core.js                    # V4 Ensemble scoring (70% FFH + 30% Sleeper blend)
│   ├── sleeperProjectionsService.js  # Fetches Sleeper EPL projected points per GW
│   ├── scoringConversionService.js   # Pure FFH data extraction
│   ├── fplNewsService.js             # FPL bootstrap-static news/status + ep_next
│   ├── ffhCustomStatsService.js      # FFH players-custom Opta stats
│   ├── draftRankingService.js        # VORP, tiers, pick suggestions (pure, no React)
│   ├── draftAnalysisService.js       # Post-draft strategy analysis
│   └── mockDraftAiService.js         # Snake engine, 7 AI archetypes, Monte Carlo availability
├── components/                    # UI components
│   ├── DashboardHeader.js, SetupModal.js, PlayerModal.js
│   ├── OptimizerTabContent.js, TransferTabContent.js, ComparisonTabContent.js
│   ├── LeagueTabContent.js           # League tab shell: Standings · Scout · Schedule Luck · Reporting · Season Review
│   ├── ScheduleLuckContent.js        # Self-contained luck analyzer (Pythagorean expected wins, all-play breakdown)
│   ├── DraftTabContent.js            # Draft tab shell: 4 sub-tabs (Cheat Sheet, Mock Draft, Draft Assistant, Draft Analysis)
│   ├── draft/
│   │   ├── DraftAnalysisPanel.js    # Draft Analysis sub-tab (post-draft retroactive insights)
│   │   ├── MockDraftSetup.js        # Mock Draft setup form (league size, position, speed, difficulty)
│   │   ├── MockDraftBoard.js        # Mock Draft live board (tier list, pick banner, suggestions, picks log)
│   │   ├── MockDraftResults.js      # Mock Draft results (grade, VORP efficiency, team rankings, archetype reveal)
│   │   └── DraftAssistantPlaceholder.js  # "Coming soon" placeholder for live Sleeper sync
│   └── stats/OptimizerStatsCard.js
├── hooks/                         # Custom React hooks
│   ├── usePlayerData.js, useGameweek.js, useUserConfig.js
│   ├── useDraftBoard.js              # Cheat sheet state (rankings, search, position filter)
│   └── useMockDraft.js              # Mock draft state machine (idle → drafting → complete)
└── utils/                         # Utility functions
    ├── predictionUtils.js            # Centralized scoring utilities
    └── cacheManager.js               # Client-side caching with compression
```

### Data Sources
1. **Sleeper API**: Authoritative source for player positions, league data, rosters, reserve slots
2. **Sleeper Projections API**: Per-GW EPL player projections via `/projections/clubsoccer:epl/regular/{season}/{gw}` — converted to custom league fantasy points using actual league scoring settings. Coverage is partial (~200 of ~400 active players); absence in a GW with data = rotation risk signal.
3. **Fantasy Football Hub (FFH)**: Per-GW predictions via `player-predictions` endpoint
4. **FFH Opta Stats**: Season stats (xG, xA, shots, tackles) via `players-custom` endpoint
5. **FPL Official API**: Player injury/status news + `ep_next`/`ep_this` (expected points) via `bootstrap-static` endpoint
6. **Hardcoded Schedule**: Complete 2025-26 Premier League gameweek dates

**Position Authority**: Sleeper position data takes absolute precedence over FFH data.

**Matching Logic**: Exact Opta ID matching (98% success rate) with graceful fallback.

## Key Features

- **Multi-User Support**: Per-user league config via localStorage, first-run onboarding modal
- **Triple Scoring Systems**: Toggle between FFH FPL predictions, V3 Sleeper (ratio conversion), and V4 Ensemble (70% FFH + 30% Sleeper projections blend)
- **6-Tab Navigation**: Home · Lineup · Transfers · Trades · League · Draft — each with sub-tabs
- **Formation Optimizer**: Mathematical constraint-based lineup optimization (6 formations)
- **Live GW Locked Players**: Players whose match has started are locked in formation optimizer
- **Smart Transfer Pairing**: "Drop X, Add Y" recommendations with net gain analysis; reserve player toggle hides IR/reserve slot players from drop candidates
- **Player Analytics**: Comprehensive filtering, search, comparison modals with charts
- **Opta Advanced Stats**: xG, xA, ICT surfaced across decision tabs
- **FPL Injury Status**: Real-time injury badges and news timestamps
- **Hardcoded Gameweek System**: 100% reliability, zero external dependencies
- **Live GW Auto-Expand**: Home tab fixtures section auto-expands when GW status is `live`
- **DGW Scaling**: FFH predictions with `predicted_mins > 100` are scaled to single-match equivalent (`90 / predicted_mins`) — Sleeper FC only scores one match per GW
- **Schedule Luck Analyzer**: Pythagorean expected wins vs actual, all-play record, weekly breakdown with Tough Luck / Lucky Win badges — under League tab
- **Cheat Sheet**: Static VORP-ranked tier board with Overall view and By Position 4-column grid (FWD/MID/DEF/GKP)
- **Mock Draft Simulator**: Solo snake draft vs 7 AI archetypes, Monte Carlo availability %, VORP-graded results with letter grade
- **Draft Analysis**: Retroactive VORP grading of actual Sleeper league draft — manager grades, position flow, steals/reaches, strategy takeaways
- **Draft Assistant** *(coming soon)*: Live Sleeper draft sync placeholder

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

### Position Display Order
Always use **FWD → MID → DEF → GKP** when displaying positions in filters, grids, dropdowns, or any UI list. This is the attack-first ordering used throughout the app.
```javascript
// ✅ Correct
const POSITIONS = ['FWD', 'MID', 'DEF', 'GKP'];
const posOrder = { FWD: 0, MID: 1, DEF: 2, GKP: 3 };

// ❌ Incorrect (old football lineup order — do not use in UI)
const POSITIONS = ['GKP', 'DEF', 'MID', 'FWD'];
```

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

## V4 Ensemble Scoring System

V4 blends raw FFH predictions with Sleeper projected points (converted to custom league scoring) for the best accuracy of any available model.

### Blend Weights (empirically validated)
- **70% FFH raw predictions** (`pred.predicted_pts`) — primary signal
- **30% Sleeper projections** — converted via actual league scoring settings

These weights were determined via backtest across GW1-34 (3132 paired samples):
| Model | MAE |
|---|---|
| V3 (FFH × position ratio) | 2.738 |
| FFH raw standalone | 2.717 |
| Sleeper projections standalone | 2.983 |
| **V4 (70% FFH + 30% Sleeper)** | **2.622** ← best |

Using `pred.predicted_pts` (raw FFH) rather than `v3_pts` (FFH × ratio) as the primary signal — the ratio conversion adds noise at this sample size.

### Rotation Risk Discount
When Sleeper returns projection data for a GW (`gwsWithData`) but **does not project** a specific player, this signals Sleeper's model considers them a rotation risk. V4 applies a **0.65× multiplier** (`ROTATION_RISK_MULTIPLIER`) to their predicted points for that GW.

Key distinction:
- `gwsWithData` has GW and player is absent → rotation risk → `v4_pts = baseV4 * 0.65`, `v4_rotation_risk: true`
- `gwsWithData` does NOT have GW → GW not yet projected → fall back to V3 (`v4_pts = v3_pts ?? ffhPts`)

This correctly handles the real-world case: Sleeper's EPL projection API only covers ~200 of ~400 active players. A player absent from a projected GW has a fixture but is at risk of not starting.

### Player Fields
- `v4_pts` — per prediction entry: blended or discounted points
- `v4_sleeper_pts` — raw Sleeper projection (when available)
- `v4_rotation_risk` — true when Sleeper had GW data but skipped this player
- `v4_season_total`, `v4_season_avg`, `v4_current_gw` — aggregated from predictions
- `v4_has_sleeper_data` — false if no Sleeper projections exist for this player (falls back to V3 values)

### Implementation Files
- **`app/services/v4/core.js`** — `applyV4Scoring()` — called after V3 enhancement in `integrated-players/route.js`
- **`app/services/sleeperProjectionsService.js`** — `fetchSleeperProjections()` — batched parallel fetch, 2-hour cache, returns `{ projections, playerCount, gwsLoaded, gwsWithData }`
- **`scripts/backtestV4.js`** — standalone Node.js backtest tool — fetches FFH history + Sleeper actuals to compute MAE across model variants; run with `node scripts/backtestV4.js`

### V4 Player Fields: `is_reserve`
Players occupying IR/reserve roster slots in Sleeper are tagged `is_reserve: true`. The Transfers tab uses this to optionally hide them from drop candidates (reserve toggle in `TransferPairRecommendations.js`).

## Draft Tab (v6.0)

The Draft tab has four sub-tabs: **Cheat Sheet**, **Mock Draft**, **Draft Assistant** (placeholder), and **Draft Analysis**.

### Cheat Sheet
Static read-only ranked tier list. No interactive draft tracking — that lives in the Draft Assistant tab (future).
- **Overall view**: All positions ranked together by VORP with pyramid tier labels
- **By Position view**: 4-column grid — FWD | MID | DEF | GKP — each with independent per-position tier model
- Toggle between views; search works in both

### Mock Draft Simulator
Solo snake draft practice against AI opponents. Inspired by FantasyPros Draft Wizard, adapted for Sleeper FC EPL format.

### Sleeper FC Roster Structure (17 players)
```
Starters (11): GK(1), DEF(3), MID(3), FWD(1), FM FLEX(1), FMD FLEX(1), MD FLEX(1)
Bench (6):     any position
Flex eligibility: FM = FWD/MID, FMD = FWD/MID/DEF, MD = MID/DEF
```

Position caps enforced in suggestions:
- **Maximums**: GKP:2, DEF:6, MID:7, FWD:4
- **Minimums** (must fill for legal lineup): GKP:1, DEF:3, MID:3, FWD:1

### VORP (Value Over Replacement Player)
`VORP = player_season_projection - replacement_level_at_position`

Replacement level = season projection of the `(leagueSize × maxStarterSlots + 1)`th-best player at each position. Represents the best freely-available player if all teams fill their starter slots. Higher VORP = more value over what you'd get if you waited.

### Tier Algorithm
Tiers use **pyramid-shaped geometric distribution**: elite tiers are intentionally small, lower tiers progressively larger (mimicking FantasyPros). Each tier is ~1.35× the size of the previous. With ~455 players / 11 tiers: T1≈6, T2≈8, T3≈11 ... T11≈122.

**Critical**: Tiers are computed once from ALL eligible players (everyone except DND list) and never recomputed as picks are made. Drafted players remain in their tier, marked as taken. This keeps tiers stable throughout the draft. Only suggestions use the available-player subset.

Per-position tiers are computed independently within each position, scaling tier count to pool size (~10 players per tier, capped at 11).

### Pick Suggestion Algorithm
Three-phase weighting in `getPickSuggestions()`:
1. **Mandatory need** — positions below minimum get a large boost; near-critical (picks remaining ≈ mandatory slots needed) triggers "Must Fill" at 3.0× multiplier
2. **Diminishing returns** — each extra player beyond minimum at a position reduces multiplier (0.7 → 0.55 → 0.4...)
3. **Hard cap** — positions at or above maximum get 0.05× (effectively excluded)

Suggestions always guarantee at least one pick per unfilled mandatory position when available.

### Mock Draft AI Archetypes
Seven distinct personalities assigned randomly (except user's slot):
- **Value Bot** — pure VORP, plays near-optimal
- **Attack Hunter** (×2) — overweights MID/FWD, weak on defence
- **Clean Sheet Merchant** — overweights DEF/GKP, grabs GK early
- **Star Chaser** — uses raw projection not VORP, reaches for big names
- **Balanced Builder** (×2) — fills positions proportionally
- **Late GK Specialist** — ignores GK until rounds 15-17

### Mock Draft Grade
`efficiency = myTotalVorp / sumOfTopAvailableVorpAtEachPick`
A+ ≥ 0.93 · A ≥ 0.89 · B+ ≥ 0.85 · B ≥ 0.80 · C+ ≥ 0.75 · C ≥ 0.70 · D otherwise

### Mock Draft localStorage Keys
- `fpl_mock_draft_active` — active draft state (phase, picks, archetypes)
- `fpl_mock_draft_history` — last 3 draft summaries (grade, efficiency, rank)

### Cheat Sheet localStorage Keys (useDraftBoard — legacy, not used in cheat sheet view)
- `fpl_draft_session` — drafted players map: `{ [sleeperId]: { draftedBy, pickNumber, name, position } }`
- `fpl_draft_watchlist` — array of sleeper IDs
- `fpl_draft_dnd` — do-not-draft sleeper IDs (also excluded from tier ranking)

### Draft Analysis (Phase 1.5)
Post-draft analysis pulls actual league draft data from Sleeper API via `/api/draft-analysis?leagueId=X`. Retroactively evaluates every pick using VORP-at-time, grades managers, detects position runs, and generates plain-English strategy takeaways with actionable tips for next year's draft.

Sleeper draft API endpoints used (all public, no auth):
- `GET /league/{id}/drafts`
- `GET /draft/{id}/picks`
- `GET /draft/{id}/traded_picks`
- `GET /league/{id}/users`

## Recent Technical Updates

### v6.3 - Navigation Redesign & Bug Fixes (April 2026)
- **6-tab navigation**: Consolidated 9 tabs → Home · Lineup · Transfers · Trades · League · Draft. Each has sub-tabs following FantasyPros-style UX.
  - **Lineup**: Start/Sit (optimizer) · My Team (placeholder)
  - **Transfers**: Recommendations · Cheat Sheet (in-season) · Players
  - **League**: Standings · Scout · Schedule Luck · Reporting (placeholder) · Season Review (placeholder)
  - **Draft**: Cheat Sheet (VORP) · Mock Draft · Draft Assistant · Draft Analysis
- **`LeagueTabContent.js`** — new League tab shell; renders `LeagueStandings`, `ScoutTabContent`, `ScheduleLuckContent`, and two ComingSoon placeholders
- **`ScheduleLuckContent.js`** — self-contained luck analyzer extracted from HomeTabContent; self-fetches `/api/standings` and `/api/all-play`; always expanded (no collapse toggle)
- **`LeagueStandings.js`** — removed collapsible behavior; table is always expanded now that it lives on its own dedicated sub-tab page
- **Stats card position fix**: `OptimizerStatsCard` moved inside the Lineup tab, below the sub-tab bar, so switching sub-tabs doesn't shift the tab control position
- **Trades tab player columns**: `PlayerCard` in `TradeAnalyzerTabContent.js` now shows n1 · n3 · n5 · ROS per player instead of n5 only
- **Scrollbar layout shift fix**: Added `scrollbar-gutter: stable` to `body` in `globals.css` — prevents content jumping when scrollbar appears/disappears between tabs
- **DGW scaling**: FFH returns combined predictions for Double/Triple Gameweeks with inflated `predicted_mins` (e.g. 180 for two matches). Applied `scale = 90 / predicted_mins` when `predicted_mins > 100` in two places:
  - `app/utils/ffhDataUtils.js` → fixes `currentGwPrediction`, `currentGwMins`, `ffhSeasonPrediction`
  - `app/services/scoringConversionService.js` → fixes `finalPredictions` (per-GW array consumed by V3/V4)
  - Only future predictions scaled; completed results entries untouched. Diagnostic fields `dgw_scaled` and `dgw_fixture_count` embedded on affected entries.
- **GW schedule corrections**: GW35 start corrected to Fri 1 May (was May 2); GW36 end extended to Wed 13 May (was May 11, missed Man City/Crystal Palace); GW36-37 kickoff times corrected to first match of week (12:30 BST early slot)
- **Emoji encoding fix**: PowerShell UTF-8 corruption in `HomeTabContent.js` repaired — all double-encoded byte sequences restored (▶ ▼ ▲ ● → 🔴 🏁 ✅ 🔗 📰 🔒 and Unicode arrows/symbols)

### v6.2 - V4 Ensemble Scoring (April 2026)
- **V4 Ensemble model**: 70% FFH raw predictions + 30% Sleeper projected points (custom league scoring applied) — best MAE of any tested model (2.622 vs 2.717 FFH-only, validated GW1-34, 3132 samples)
- **Sleeper Projections Service**: `sleeperProjectionsService.js` fetches per-GW EPL projections from Sleeper API, converts to custom fantasy points using actual league `scoring_settings`, caches 2 hours
- **Rotation risk discount**: When Sleeper has GW projection data but omits a player, V4 applies a 0.65× multiplier (`ROTATION_RISK_MULTIPLIER`) — Sleeper's absence signals rotation risk, not a blank fixture
- **`gwsWithData` tracking**: Set of GWs where Sleeper returned projection data; distinguishes rotation risk (player absent from projected GW) from not-yet-projected (fall back to V3 unchanged)
- **`is_reserve` field**: Players in Sleeper IR/reserve slots tagged `is_reserve: true`; Transfers tab hides them from drop candidates by default via reserve toggle
- **Reserve toggle restored**: `TransferPairRecommendations.js` — toggle was lost in a bad merge; `hideReserve` state + filter + button UI all restored; `hideReserve` added to `useMemo` dependency array to fix non-refreshing toggle
- **Localhost HTTP fix**: `scout/route.js`, `optimizer/route.js`, `players/route.js` — detect localhost and force `http://` for internal fetches; Next.js passes `https://` in `request.url` even in dev causing `ERR_SSL_PACKET_LENGTH_TOO_LONG`
- **Backtest infrastructure**: `scripts/backtestV4.js` — standalone Node.js script; fetches FFH history + Sleeper actuals, computes MAE for FFH-only / V3 / Sleeper-only / V4 blend variants; `MAX_GW = 34`

### v6.1 - GW Sync & Draft Fixes (April 2026)
- **Stale-while-revalidate**: `usePlayerData.js` shows cached data instantly on load, always fires a background refresh — Sleeper roster changes appear within ~15s of page load instead of waiting for cache TTL
- **Client cache TTL**: Reduced from 30 min → 10 min (SWR makes it safe to refresh more often)
- **Server cache TTL**: Reduced from 15 min → 3 min in `integrated-players/route.js`
- **FFH/Sleeper split-GW fix**: Data-driven detection finds GWs that appear in both FFH `predictions` and `results` arrays; remaps prediction entries to the correct Sleeper week
- **Absorbed-game heuristic**: When FFH bundles a future midweek game into the current GW's results (leaving `predictions[currentGW]=0`), proxy the prediction using the avg of the next 2–3 future GWs — only fires for healthy players (chance ≥ 75%) with ≥2 positive future GWs
- **Draft Analysis grade recalibration**: Manager grade thresholds corrected from unreachable values (A+≥20, A≥15, B+≥10, B≥5) to realistic ones matching actual VORP output (A+≥10, A≥7.5, B+≥5, B≥2.5, C≥0, D≥-2.5, F<-2.5)
- **All-play Schedule Luck**: Added `/api/all-play` route + expanded luck section in Home tab showing per-week all-play W/L, Tough Luck/Lucky Win badges, and all-play column in league table. **Note**: Sleeper EPL (`clubsoccer:epl`) leagues don't expose per-week matchup scores via the `/league/{id}/matchups/{week}` endpoint (returns 404); the UI gracefully shows "not available" when the endpoint isn't supported by the league type.

### v6.0 - Mock Draft Simulator (April 2026)
- **Mock Draft tab**: Full snake draft simulator — 12 teams, 17 rounds, 7 AI archetypes
- **AI pick engine**: `pickScore = draftVorp × positionWeight × needMultiplier × (1 + Gaussian(0, σ))` with multiplicative noise
- **Monte Carlo availability**: 300 simulations at draft start; per-player % chance of being available at your next pick
- **Draft grade**: Efficiency score (myVORP / optimalVORP) → A+→D letter grade with per-pick analysis
- **Speed modes**: Instant / Fast (80ms/pick) / Slow (350ms/pick) with animated pick banner
- **Undo support**: Snapshot-based undo restores to any previous user pick
- **Mock draft history**: Last 3 session summaries persisted to localStorage
- **Cheat Sheet redesigned**: Converted to static read-only ranked list (no interactive draft tracking)
- **By Position view**: 4-column grid (FWD | MID | DEF | GKP) with independent per-position tiers
- **Draft Assistant placeholder**: "Coming soon" tab for future live Sleeper sync feature
- **Position order standardized**: FWD → MID → DEF → GKP everywhere in UI (filters, grids, sort maps)

### v5.0 - Draft Assistant (April 2026)
- **Draft tab**: VORP-based tier board, pick suggestions, watchlist, DND list, my roster sidebar
- **Stable tiers**: Rankings computed from all eligible players once; drafted players stay in tier marked as taken (not removed)
- **Pyramid tier distribution**: Geometric growth (1.35×/tier) gives small elite tiers, larger lower tiers
- **Position-aware suggestions**: Mandatory minimums, urgency detection, diminishing returns, hard caps per position
- **Draft Analysis tab**: Retroactive analysis of actual Sleeper draft with manager grades, position flow, steals/reaches, strategy takeaways
- **localStorage persistence**: Draft session, watchlist, and DND survive page reloads; Reset clears all three

### v4.5 - Multi-User Support (March 2026)
- **Per-user league config**: `useUserConfig` hook stores `leagueId` + `userId` in localStorage
- **SetupModal**: First-run onboarding - paste Sleeper league ID → validate → pick roster
- **Dynamic routing**: `integrated-players` and `optimizer` routes accept `leagueId` in request body
- **Scoped caching**: Server cache keys use `integrated-players-{leagueId}`; client cache keyed by league
- **Optimizer cache key**: Includes GW number (`optimizer_{userId}_{type}_{mode}_gw{N}`) — ensures live-GW locked-player detection is never served from a stale wrong-GW cache entry
- **No auth server required**: Config persists via localStorage

### v4.4 - Mobile Responsiveness Pass (March 2026)
- Responsive breakpoints across MyPlayersTable, PlayerModal, ComparisonTabContent, DashboardHeader
- Hide non-essential columns below `md` breakpoint; clamp font sizes for mobile
- `flex-wrap` for gameweek controls; emoji-only scoring buttons on mobile

### v5.1 - Transfer Improvements & Test Coverage (April 2026)
- **Reserve player toggle**: Transfers tab hides IR/reserve-slot players from drop candidates by default (amber "🏥 Reserve Hidden" toggle). Sleeper `roster.reserve` is now tracked in the data pipeline and exposed as `is_reserve` on each player object.
- **Transfer rating overhaul**: Rating now uses absolute weighted-gain-per-GW (±50 range around 50%) instead of a fragile ratio that inflated tiny signals. `next5Gain` (previously missing from `actualScore`) now contributes with 0.6× weight. Season gain uses remaining GWs not a flat 38. Risk adjustment only applies when a real signal exists.
- **Zero-signal guard**: Pairs where the Add player has no FFH projection, or where every per-GW gain rounds to zero, are excluded entirely before any rating is computed.
- **Test suite expanded**: 135 → 240 tests across 13 suites. New suites: `v3Adjustments`, `v3Matchup`, `playerArchetypeService`, `positionUtils`. Fixed color-token mismatches (`gray` → `slate`) in `newsUtils` and `gameweekStyles` tests.
- **GW schedule fix**: GW34 end date extended to prevent the live-detection window collapsing to zero between rounds.

### v4.3 - Code Cleanup & Expanded Tests (March 2026)
- Dead code removed: 9 unused functions, 3 unused re-export blocks
- Tab scroll indicator with fade gradient when tabs overflow
- Jest test suite: 135 tests across 9 suites (predictionUtils, newsUtils, v3ScoringService, gameweekStyles, etc.)

## Development Notes

- **JSX Compilation**: Avoid styled-jsx; use global CSS instead
- **Gameweek Schedule Maintenance**: Each entry in `gameweekService.js` must have `end` set 2–3 days after `start`. If `start === end`, the live detection window is zero — the GW flips to "upcoming" the instant it starts. Annual schedule updates must include proper end dates. All times are stored in UTC (BST = UTC+1, so 15:00 BST Saturday kickoff = 14:00Z; early 12:30 BST slot = 11:30Z).
- **DGW Scaling**: FFH bundles Double/Triple Gameweek fixtures into one prediction entry with `predicted_mins > 90`. Sleeper FC scores only one match per GW. Scaling is applied automatically in `ffhDataUtils.js` and `scoringConversionService.js` when `predicted_mins > 100`. Do NOT add separate DGW handling in components — it is already corrected in the pipeline.
- **V3 Scoring**: Uses only position ratios (GKP 0.90×, DEF 1.15×, MID 1.05×, FWD 0.97×). Complex adjustments were removed — they added variance without improving accuracy.
- **V4 Scoring**: Always runs after V3 (needs `v3_pts` per prediction). Requires `sleeperProjections` and `gwsWithData` from `fetchSleeperProjections()`. Falls back to V3 values when Sleeper data is unavailable.
- **Sleeper Projections Coverage**: Partial (~200/400 active players). Never assume missing player = blank fixture — could be rotation risk. Use `gwsWithData` to distinguish.
- **Error Handling**: Always implement graceful fallbacks for external API dependencies
- **Theme System**: Application uses dark theme exclusively
- **Cache Strategy**: Compression essential for large datasets (1500+ players)
- **React Hooks**: All hooks BEFORE any conditional returns; use optional chaining for safety
- **Scoring Consistency**: NEVER create custom scoring functions in components - use `app/utils/predictionUtils.js`

---

The system is optimized for the 2025-26 Premier League season and requires minimal maintenance.
