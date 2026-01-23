# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LA STAP Operations Portal - A single-page React application for managing out-of-home (OOH) transit advertising operations. Built as a browser-based tool with no build system or server requirements.

## Architecture

### Stack
- **React 18** via CDN (UMD build, no JSX compilation needed)
- **Babel Standalone** for in-browser JSX transpilation
- **Tailwind CSS** via CDN for styling
- **Lucide Icons** for UI icons
- **Three.js** for 3D login screen animation

### File Structure
- `index.html` - Main desktop application (~1.3MB, self-contained)
- `detailModal.js` - External detail modal component for campaign editing
- `canvasGearSidebar.js` - Canvas-based gear menu sidebar navigation
- `mobile.html` - Mobile-optimized field operations app
- `demo.js` - Demo mode components and mock data generators

### Key Architectural Patterns

**Single-file SPA**: The entire desktop app lives in `index.html` with inline `<script type="text/babel">` blocks. No bundling or transpilation step required - just serve the files.

**Component Organization**: React components are defined inline within the script block. Major sections:
- `LoginScreen` / `ChronosScene` - 3D animated login with Three.js
- Dashboard views (Upload, Dashboard, POP Gallery, Availability Charting, etc.)
- Sidebar navigation with gear-based menu system

**State Management**: Uses React hooks (`useState`, `useEffect`, `useMemo`, `useRef`) for local component state. Data persists via `localStorage`.

**External APIs**:
- Groq API (Llama 3.3 70B) for AI analysis features
- Open-Meteo for weather forecasts (free, no key required)
- Google Sheets integration for live data sync

### Icon System
Icons use Lucide via the `Icon` component. Map custom names in `ICON_MAP` object to Lucide icon names.

```javascript
// Usage
<Icon name="Upload" size={20} className="text-blue-500" />
```

### Demo Mode
Demo components load from `demo.js` and attach to `window.STAPDemo`. The main app checks for these at runtime:
- `DemoTip`, `FeatureBadge` - UI helper components
- `DemoWelcomeModal`, `DemoGuidePanel` - Onboarding overlays
- `generateMockData`, `getDemoMaterials` - Sample data generators

## Development

### Running Locally
Simply open `index.html` in a browser, or serve via any static file server:
```bash
python -m http.server 8000
# or
npx serve .
```

### Making Changes
1. Edit the HTML/JS directly in `index.html`
2. Refresh browser to see changes (Babel compiles JSX on each load)
3. For demo features, edit `demo.js`

### Data Flow
- CSV uploads parsed client-side via `parseCSV()` function
- Data stored in component state and `localStorage`
- Google Sheets integration uses published CSV export URLs

### Date Handling
The `parseDate()` function handles multiple formats:
- US format: `MM/DD/YYYY`
- ISO format: `YYYY-MM-DD`
- Shorthand: `MM/DD/YY`

### Campaign Stages
Campaigns flow through stages defined in `ALL_STAGES` array:
`RFP` → `Initial Proposal` → `Contracted` → `Proofs Approved` → `Material Ready For Install` → `Installed` → `POP Completed` → `Takedown Complete`

### Detail Modal (`detailModal.js`)
Unified campaign detail view with 3-column layout:
- **SCHEDULE** - Booked qty, charted qty (manual override), start/end dates
- **INSTALL PROGRESS** - Installed count, pending count, progress bar
- **REMOVAL** - Removal tracking with qty, done count, status, assignee

**Key Features:**
- Waterfall data flow: Charted qty → Install Progress → Removal
- Smart removal status: auto-calculates `in_progress`/`complete` from numbers, manual `scheduled`/`blocked`
- Change history tracking with timestamps (stored in `manualOverrides`)
- Save button only appears when there are unsaved changes
- Unsaved changes warning on close

**Data Keys:**
- `adjustedQty` - Manual charted quantity override
- `installed` / `totalInstalled` - Installed count
- `removalQty`, `removedCount`, `removalStatus`, `removalAssignee` - Removal tracking
- `history` - Array of `{ timestamp, changes[] }` entries

### Removal Tracking
Pending Removals view tracks campaigns past their end date:
- 45-day deadline from end date for removal
- Risk scoring for priority sorting (overdue items first)
- Splits into `pendingRemovals` and `completedRemovals` based on stage/status
- Stage override from `manualOverrides` is applied for proper filtering

### Sidebar Navigation (`canvasGearSidebar.js`)
Three interlocking gears with orbital menu items. Full view (320px) shows animated gears, collapsed view (64px) shows icon bar.

**MODULES gear (cyan)** - 9 items:
`dashboard`, `master`, `holdReport`, `availability`, `riskAnalysis`, `specialMedia`, `popGallery`, `materialReceivers`, `performanceReport`

**PIPELINE gear (purple)** - 10 items:
`delayedFlights`, `onHoldCampaigns`, `inProgressFlights`, `fullyInstalledThisWeek`, `rotations`, `thisWeek`, `upcoming`, `materialReadyFuture`, `nextMonth`, `pipelineSummary`

**HISTORY gear (amber)** - 6 items:
`pendingRemovals`, `activeInstalls`, `awaitingPop`, `completedCampaigns`, `lostOpportunities`, `impressions`

### Pipeline Summary Dashboard
Comprehensive analytics view for monthly pipeline (`pipelineSummary` view):
- **Header Stats Cards** - Total campaigns, faces, installed count, active stages
- **Visual Funnel** - Bar chart showing campaign count per stage, proportionally sized
- **Breakdown Table** - Stage details with progress bars, quantities, percentages
- **Bottleneck Detection** - Alerts when stages have >1.5x average campaigns
- Color-coded by stage (RFP=gray, Contracted=indigo, Material Ready=yellow, Installed=green, etc.)
- Clickable rows for drill-down navigation

### AWAIT POP View
Tracks campaigns needing proof of performance photos:
- Filters: `stage === 'Installed'` AND `pending === 0`
- Shows fully installed campaigns waiting for POP photos
- Sorted oldest first (longest waiting)
- Change stage to "Photos Taken" or "POP Completed" to move out of this view

## Security Notes
- API keys are embedded in the HTML file (marked with security warnings)
- This is designed for internal/intranet use only
- Login credentials are hardcoded: `admin@vectormedia.com` / `secret123`
