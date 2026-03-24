# ⚽ Fantasy FC Playbook

> Sleeper Fantasy Football analytics powered by FFH predictions, Opta stats, and calibrated scoring models.

**v4.3** · Next.js 14 · Production Ready · March 2026

---

## ✨ What It Does

Fantasy FC Playbook bridges your **Sleeper Fantasy Football** league with **Fantasy Football Hub** predictions and **Opta advanced stats** to give you a data-driven edge — lineup decisions, transfer targets, and fixture forecasting all in one dashboard.

- 📊 **98% player match accuracy** via Opta ID matching
- 🎯 **3 scoring modes**: FFH (FPL), V3 (calibrated Sleeper), V4 (ensemble blend)
- 🔒 **Live GW locked players**: players mid-match are frozen in the optimizer
- 📰 **Real-time injury news** from the FPL official API
- ⚡ **100% reliable gameweek tracking** via hardcoded 2025-26 schedule

---

## 🗂 Tabs

| Tab | What it does |
|-----|-------------|
| 🏠 **Home** | Team health, squad fixture forecast, standings, live fixtures, news feed |
| 🧠 **Start/Sit** | Formation optimizer with locked-player support and swap recommendations |
| 🔄 **Transfers** | "Drop X, Add Y" pairs ranked by net season points gain |
| 📋 **Cheat Sheet** | Position-based rankings across any GW range |
| ⚖️ **Comparison** | Drop/Add verdict table — 7 metrics, Opta quality, fixture charts |
| 🔭 **Scout** | Waiver wire targets, key threats, xG badges |
| 👥 **Players** | Full player table with filtering, search, pagination |
| 🔗 **Matching** | Opta matching stats and data integration health |

---

## 🚀 Quick Start

```bash
npm install
cp .env.example .env.local   # fill in credentials below
npm run dev                  # http://localhost:3000
```

### Environment Variables
```env
SLEEPER_LEAGUE_ID=your_sleeper_league_id
FFH_AUTH_STATIC=your_ffh_auth_token
FFH_BEARER_TOKEN=your_ffh_bearer_token
```

---

## 🛠 Dev Commands

```bash
npm run dev            # Development server
npm run build          # Production build
npm run lint           # ESLint
npm run check:scoring  # Scoring consistency lint (catches banned field usage)
npm test               # Jest — 135 tests across 9 suites
npm run test:coverage  # Tests with coverage report
```

---

## 🧮 Scoring Modes

| Mode | Description | Best For |
|------|-------------|----------|
| 📊 **FFH** | Raw FPL predictions from Fantasy Football Hub | FPL point accuracy |
| 🚀 **V3** | FFH × calibrated position ratios (3190 samples) | Sleeper league accuracy |
| ⚡ **V4** | 75% V3 + 25% Sleeper projections ensemble | Best overall (2.99 MAE) |

All tabs respect the active scoring mode. Scoring path is unified via `getNextNGameweeksTotal()` — no per-component divergence.

---

## 🏗 Tech Stack

- **Framework**: Next.js 14 App Router
- **Styling**: Tailwind CSS, dark theme only
- **Data**: Sleeper API · Fantasy Football Hub · FPL bootstrap-static
- **Caching**: Client 30min + Server 15min, localStorage with smart compression
- **Tests**: Jest · React Testing Library · MSW (API mocking)

---

## 📁 Key Files

```
app/
├── services/
│   ├── formationOptimizerService.js  # Lineup optimization
│   ├── v3/core.js                    # V3 calibrated scoring
│   ├── v4/core.js                    # V4 ensemble blend
│   └── ffhCustomStatsService.js      # Opta stats (38 fields/player)
├── utils/
│   └── predictionUtils.js            # getNextNGameweeksTotal() — single source of truth
├── components/
│   ├── SquadFixtureForecast.js       # 8-GW difficulty/pts strip
│   └── PlayerModal.js                # Accessible modal with charts & fixtures
└── api/
    ├── integrated-players/route.js   # Main data integration
    └── optimizer/route.js            # Formation optimization
```

---

## 🧪 Tests

135 tests · 9 suites · node + jsdom + MSW

Suites cover prediction utilities, news utilities, gameweek styles, V3 scoring, FFH stats integration, optimizer integration, and component smoke tests (PlayerModal, Comparison, Optimizer).

---

*For architecture deep-dives, scoring internals, and full changelog — see [CLAUDE.md](CLAUDE.md).*
