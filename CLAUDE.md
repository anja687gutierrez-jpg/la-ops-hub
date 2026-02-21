# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LA STAP Operations Portal - A single-page React application for managing out-of-home (OOH) transit advertising operations. Built as a browser-based tool with no build system or server requirements.

**Repo:** `github.com/anja687gutierrez-jpg/ops-hub-portal`
**Branch:** `main`

## Architecture

### Stack
- **React 18** via CDN (UMD build, no JSX compilation needed)
- **Babel Standalone** for in-browser JSX transpilation
- **Tailwind CSS** via CDN for styling
- **Lucide Icons** for UI icons
- **Three.js** for 3D login screen animation

### File Structure

**Core Application:**
- `index.html` - Main desktop application (~1.3MB, self-contained SPA)
- `detailModal.js` - Campaign detail modal (schedule, install progress, removal)
- `canvasGearSidebar.js` - Canvas-based gear menu sidebar navigation
- `mobile.html` - Mobile-optimized field operations app

**Extracted Components:**
- `searchOverlay.js` - Global search overlay component
- `availability.js` - Availability charting component
- `impressionsDashboard.js` - Impressions analytics dashboard
- `digestModal.js` - Digest/summary modal component
- `riskCommandCenter.js` - Risk analysis command center
- `materialReceivers.js` - Material receivers tracking
- `popGallery.js` - POP (Proof of Performance) gallery
- `icon.js` - Icon utilities

**Demo & Testing:**
- `demo.js` - Demo mode components and mock data generators
- `demoGuide.js` - Demo guide/walkthrough component
- `demo.html` - Standalone demo page
- `csv-consolidator-test.html` - CSV consolidation test page
- `FULL_DATE_FIX.js` - Date parsing fix utility
- `check-bundle-sizes.js` - Bundle size checker

**Documentation:**
- `GROQ_AI_CONFIG.md` - AI analysis configuration documentation
- `kloudgin.md` - Future vision: custom field ops module to replace KloudGin (exploration only, not started)

### Key Architectural Patterns

**Single-file SPA**: The entire desktop app lives in `index.html` with inline `<script type="text/babel">` blocks. No bundling or transpilation step required - just serve the files.

**Component Organization**: React components are defined inline within the script block. Major sections:
- `LoginScreen` / `ChronosScene` - 3D animated login with Three.js
- Dashboard views (Upload, Dashboard, POP Gallery, Availability Charting, etc.)
- Sidebar navigation with draggable gear-based menu system

**State Management**: Uses React hooks (`useState`, `useEffect`, `useMemo`, `useRef`) for local component state. Data persists via IndexedDB (primary) with localStorage fallback. See **Data Storage Architecture** section below.

**External APIs**:
- Groq API (Llama 3.3 70B) for AI analysis features (see `GROQ_AI_CONFIG.md`)
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
- Google Sheets integration uses published CSV export URLs
- Live sync is the primary data source (daily), manual CSV is fallback

### Data Storage Architecture (CRITICAL)

The app has **four distinct persistence layers**. Bugs arise when they desync.

| Layer | Storage | Contents | Cleared by sync? | Cleared by reset? |
|-------|---------|----------|-------------------|-------------------|
| **IndexedDB** (`idb.js`) | `stap_ops_hub` DB | Materials (`materials` store), Proofs (`proofs` store) | NO | YES |
| **Temp Overrides** | `stap_temp_overrides` (localStorage) | `installed`, `stage`, `previousStage` | **YES** | YES |
| **Meta Overrides** | `stap_meta_overrides` (localStorage) | `adjustedQty`, `materialBreakdown`, removal tracking, `productionProof`, `history`, etc. | **NO** | YES |
| **Material Data** | `stap_material_data` (localStorage) | Comms Center email fields (breakdown, photosLink, receiverLink, mediaType) | NO | YES |

**IDB Write-Through Pattern:**
```javascript
// CORRECT: clear-then-putAll (deletions persist)
STAP_IDB.clear('materials').then(() => {
    if (data.length > 0) STAP_IDB.putAll('materials', data);
});

// WRONG: putAll alone (deleted items survive in IDB)
STAP_IDB.putAll('materials', data); // ← zombie entries!
```

**CRITICAL RULES:**
1. **IDB `putAll` only upserts** — it never removes items missing from the new array. Always `clear()` then `putAll()`, or use `IDB.delete(store, id)` for single-item deletes.
2. **Material Receiver hub merges two sources** — `materialsArray` (IDB) + `savedMaterialEntries` (from `stap_material_data`). Delete must handle both. Entries tagged `fromDetailModal: true` live in localStorage, others in IDB.
3. **Dirty-check init must match comparison source** — All dirty-checked fields in `detailModal.js` MUST initialize from `item.*` (metaOverrides), never from `stap_material_data`. The dirty check compares against `item.*`.
4. **Use `!= null` not `||` for numeric fields** — `0 || fallback` skips zero. `item.removalQty != null ? item.removalQty : fallback` preserves it.
5. **Every delete path must nuke from the correct store** — React state update + `IDB.delete()` for IDB entries, or `localStorage` manipulation + `setDeletedSavedIds()` for savedMaterial entries.

**Detail Modal (4 boxes):**
- **SCHEDULE** — Booked qty, charted qty, dates (editable)
- **INSTALL PROGRESS** — Installed/pending counts, progress bar (editable)
- **REMOVAL** — Removal tracking with status/assignee (editable)
- **MATERIALS** — Read-only summary pill (count, progress bar, sufficiency badge, date). All intake happens in Comms Center below.

**Comms Center (single intake point for materials):**
- Upload Receiver PDFs → creates entries in `materialReceiverData` (IDB)
- Inventory Breakdown → manual design code/qty/scheduled rows (saved to metaOverrides)
- Linked Materials table → shows receivers from IDB, delete X removes from IDB
- Email drafter → generates templates from all the above data

### Date Handling
The `parseDate()` function handles multiple formats:
- US format: `MM/DD/YYYY`
- ISO format: `YYYY-MM-DD`
- Shorthand: `MM/DD/YY`

### Campaign Stages & Visibility Rules

#### Stage Pipeline (`ALL_STAGES`, index.html ~line 2406)
```
RFP → Initial Proposal → Client Feedback → Pending Hold → On Hold →
Pending Client Approval → Pending Finance Approval → Contracted →
Proofs Approved → Working On It → Proofs Out For Approval → Artwork Received →
Material Ready For Install → Installed → Photos Taken → POP Completed →
Takedown Complete → Lost Opportunity → Canceled
```

#### Charted Qty (`adjustedQty`) — The System Trigger
- **Set in:** Detail Modal (Schedule box → click "Charted" to edit, stored in `metaOverrides`)
- **Hold Report** is the central place to review/confirm charted numbers (read-only display with color badges: green ✓ = matched, amber ⚠ = under, blue ↑ = over, gray `--` = unset)
- **Charted qty gates the Daily Digest:** campaigns without confirmed `adjustedQty > 0` are excluded from ALL digest sections
- **Pending calculation:** `Math.max(0, effectiveQty - installed)` where `effectiveQty = adjustedQty || totalQty`

#### View Visibility by Stage & Charted Status

| View | What Shows | Key Conditions |
|------|-----------|----------------|
| **Hold Report** | ALL campaigns | No filters — master inventory sorted by start date |
| **Master Tracking** | All except ghosts/lost | Grouped by installTier (overdue/review/scheduled/inProgress/planned/complete) |
| **Active Installs** | Material Ready + Installed | Only if `pending > 0` |
| **Awaiting POP** | Installed only | Only if `pending === 0` (fully installed, needs proof photos) |
| **Completed Campaigns** | Takedown Complete only | — |
| **Pending Removals** | Installed/Photos Taken/POP/Takedown | Past end date, within 45-day removal window |

#### Digest Email Visibility (digestModal.js + generateDigestHtml)

**Global rule:** ALL digest sections require `adjustedQty > 0` (confirmed charted qty).

| Digest Section | Source Category | Additional Filters |
|---------------|----------------|-------------------|
| **Delayed Flights** | `delayedFlights` + `pastDue` | Exclude: Installed, Photos Taken, POP Completed, Takedown Complete, Canceled, Pending Hold, On Hold, RFP, Initial Proposal. Contracted/Proofs Approved/Out for Approval only if 30+ days stale |
| **In-Progress** | `inProgressFlights` | Charted only |
| **Upcoming** | `upcoming` | Charted only |
| **Installed This Week** | `fullyInstalledThisWeek` | Charted only |
| **Recent Installs** | `recentInstalls` | Charted only |
| **Removals Due** | `expiredFlights` | Charted only |
| **Pipeline Summary** | Aggregate counts | Charted filter on underlying data |

#### processedData Categorization (index.html ~line 9900-10100)

| Category | Condition | Time Window |
|----------|-----------|-------------|
| `delayedFlights` | Not completed stage, past grace period (7d) | Last 3 weeks (7-21 days late) |
| `pastDue` | Not completed stage, past start date | Older than 3 weeks |
| `inProgressFlights` | Material Ready + started, OR Installed with pending | Last 4 weeks |
| `upcoming` | Start date = next week, not canceled | Next week only |
| `fullyInstalledThisWeek` | Installed stage, completion this week | Current formula week (Sun-Sat) |
| `recentInstalls` | Installed stage | Last 30 days |
| `expiredFlights` | Installed/POP stages, past end date | Last 45 days (deduplicated) |
| `activeInstalls` | Material Ready or Installed with pending > 0 | No time limit |
| `awaitingPop` | Installed with pending === 0 | No time limit |
| `rotations` | Rotation advertisers (Rideshare Amigo, Jacob Emrani, etc.) | Current week through year-end |

**isCompletedStage** (line ~10003): `['installed', 'photos taken', 'pop completed', 'takedown complete', 'canceled', 'cancelled', 'lost opportunity']` AND no outstanding work (`pending === 0` for Installed)

**No advertiser exclusions** — all campaigns (including Warner Bros Perms, Adriana's Insurance, Filler) are eligible for delayed/pastDue. Visibility is controlled by stage + charted qty filters only.

### Detail Modal (`detailModal.js`)
Unified campaign detail view with **4-column layout**:
- **SCHEDULE** - Booked qty, charted qty (manual override), start/end dates
- **INSTALL PROGRESS** - Installed count, pending count, progress bar
- **REMOVAL** - Removal tracking with qty, done count, status, assignee
- **MATERIALS** - Read-only summary pill (receipt count, progress bar, sufficiency badge, received date)

**Key Features:**
- Waterfall data flow: Charted qty -> Install Progress -> Removal
- Smart removal status: auto-calculates `in_progress`/`complete` from numbers, manual `scheduled`/`blocked`
- Change history tracking with timestamps (stored in `metaOverrides`)
- Save button only appears when there are unsaved changes
- Unsaved changes warning on close
- **Dirty-field saving**: Only saves fields that were actually changed (prevents phantom overrides)
- **Material sufficiency**: Computed live from `linkedMaterials` prop (not stale `item` snapshot)
- **Comms Center**: Single intake point — PDF upload, inventory breakdown, email drafter, linked materials table with inline delete

**Data Keys:**
- `adjustedQty` - Manual charted quantity override
- `installed` / `totalInstalled` - Installed count
- `pending` - Pending count (always calculated as `max(0, qty - installed)`)
- `removalQty`, `removedCount`, `removalStatus`, `removalAssignee` - Removal tracking
- `materialReceivedDate` - Auto-derived from linked receivers, or manual
- `materialBreakdown` - Array of `{ code, qty, scheduled, scheduledLocked, link }` rows
- `history` - Array of `{ timestamp, changes[] }` entries

### Pending Calculation & Override Architecture
**Important:** Pending is ALWAYS calculated as `Math.max(0, qty - installed)`, never stored as an override.

**Dual-Bucket Override Model:**

| Storage Key | Contains | Cleared by sync? | Cleared by reset? |
|-------------|----------|-------------------|--------------------|
| `stap_temp_overrides` | `installed`, `stage`, `previousStage` | **YES** | YES |
| `stap_meta_overrides` | `adjustedQty`, `materialBreakdown`, `photosLink`, `receiverLink`, `mediaType`, removal tracking, `productionProof`, `history`, `notes` | **NO** | YES |

- **Temp overrides** are working adjustments between syncs — wiped on every sync/CSV import
- **Meta overrides** are app-only fields that don't exist in the sheet — persist forever (survive sync)
- `pending` is **never stored** in either bucket — always derived as `max(0, targetQty - installed)`
- Legacy `stap_manual_overrides` key is auto-migrated into the two new buckets on first load

**Auto-Sync Schedule:**
- Syncs automatically at **9:00 AM, 12:00 PM, 4:00 PM** (60-second check interval)
- Pause toggle in dashboard header (stored in `stap_sync_paused`)
- Amber banner shown when paused
- Manual sync always available

### Removal Tracking
Pending Removals view tracks campaigns past their end date:
- 45-day deadline from end date for removal
- Risk scoring for priority sorting (overdue items first)
- Splits into `pendingRemovals` and `completedRemovals` based on stage/status
- Stage override from `tempOverrides` is applied for proper filtering

### Sidebar Navigation (DUAL RENDERING SYSTEM)
Three interlocking gears with orbital menu items. The sidebar is **draggable to any screen edge** (top, bottom, left, right) using flexbox distribution.

**IMPORTANT:** The sidebar has TWO separate rendering systems that must BOTH be updated when adding/removing items:

| View | Width | File | Array to Update |
|------|-------|------|-----------------|
| **Expanded** | 320px | `canvasGearSidebar.js` | `navNodes`, `pipelineNodes`, `historyNodes` |
| **Collapsed** | 64px | `index.html` | `moduleItems`, `pipelineItems`, `historyItems` in `CollapsedMiniBar` |

**To add a new sidebar item:**
1. Add to `canvasGearSidebar.js` -> appropriate `*Nodes` array (with `id`, `label`, `angle`)
2. Add to `canvasGearSidebar.js` -> `icons` object (SVG path)
3. Add to `index.html` -> `CollapsedMiniBar` component -> appropriate `*Items` array (with `id`, `icon`)

**MODULES gear (cyan)** - 10 items:
`search`, `dashboard`, `master`, `holdReport`, `availability`, `riskAnalysis`, `specialMedia`, `popGallery`, `materialReceivers`, `performanceReport`

**PIPELINE gear (purple)** - 10 items:
`delayedFlights`, `onHoldCampaigns`, `inProgressFlights`, `fullyInstalledThisWeek`, `rotations`, `thisWeek`, `upcoming`, `materialReadyFuture`, `nextMonth`, `pipelineSummary`

**HISTORY gear (amber)** - 6 items:
`pendingRemovals`, `activeInstalls`, `awaitingPop`, `completedCampaigns`, `lostOpportunities`, `impressions`

### Global Search (`search` view)
Fullscreen search overlay accessible via:
- **Gear menu:** SEARCH item in MODULES gear (first position)
- **Keyboard:** `Cmd+K` (Mac) or `Ctrl+K` (Windows)

Features:
- Searches ALL campaigns in `filteredStats.all` (respects Market/Product filters)
- Queries: advertiser, campaign name, ID, product, market, owner
- Shows stage badges, qty/installed counts, premium indicators
- Keyboard navigation: up/down to navigate, Enter to select, Esc to close
- "Show all X results" expander for large result sets

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

### Premium Products (Special Media)
Premium/specialty products appear in ALL views with visual distinction:
- **Flag:** `isPremium: true` on campaign object
- **Display:** star icon + amber/gold background (`bg-amber-100 text-amber-800`)
- **Keywords:** `wrap`, `domination`, `takeover`, `special`, `custom`, `embellishment`, `icon`, `spectacular`, `wallscape`, `premium`, `mural`, `vinyl`
- **Filtering:** Can be filtered via product search; also have dedicated Special Media tab
- **AI Analysis:** Included in AI Pipeline Insights under "SPECIAL MEDIA" section

### AI Pipeline Insights
Dashboard AI analysis powered by Groq (Llama 3.3 70B). See `GROQ_AI_CONFIG.md` for full documentation.

**Output Format:**
```
## TL;DR (3 sentences max)
[Biggest risk] [Velocity status] [Action needed]

---

## DETAILED BREAKDOWN
[HEADLINE RISK, VELOCITY, STALLED/DELAYED, POP, SPECIAL MEDIA, HOLDS, MARKET/WEATHER]
```

**Status Indicators:** Critical (<50%) | Caution (50-75%) | On track (>75%) | Good

**Data Sources:** Install metrics, risk detection, delayed flights, material status, holds, POP compliance, special media, market capacity, weather, holidays

**Triggering:** Click "AI Pipeline Insights" button on Dashboard view

### Reset Button Behavior
The Reset Data button (`clearPersistedData()`) performs a full cache clear:

**Clears (15 keys):**
- `stap_csv_data` - Main CSV data
- `stap_data_source` - Data source info
- `stap_current_view` - Current view state
- `stap_manual_overrides` - Legacy key (auto-migrated to temp/meta on load)
- `stap_temp_overrides` - Temp overrides (stage, installed — wiped on sync)
- `stap_meta_overrides` - Meta overrides (adjustedQty, removal, materials — persist across sync)
- `stap_sync_paused` - Auto-sync pause state
- `stap_materials_data`, `stap_materials_sheet`, `stap_material_data` - Materials
- `stap_email_log` - Email statistics
- `stap_dashboard_prefs` - Dashboard preferences
- `stap_custom_widgets` - Custom widgets
- `stap_storage_overflow` - Storage overflow flag
- `STAP_SESSION` - Session data

Note: `stap_production_proof` and `stap_manual_overrides` are legacy keys that get auto-migrated into `stap_temp_overrides` + `stap_meta_overrides` on first load and then removed.

**Preserves (7 settings keys):**
- `stap_groq_api_key` - AI API key
- `stap_google_sheet_url` - Google Sheet URL for live sync
- `stap_material_sheet_url`, `stap_material_webhook` - Material settings
- `stap_pop_sheet_url`, `stap_mobile_sheet_url` - POP/Mobile settings
- `stap_proof_webhook` - Proof webhook URL

**Also resets React state:** `baseData`, `tempOverrides`, `metaOverrides`, `materialReceiverData`, `ghostBookings`, `emailStats`

After reset, user is returned to upload view and must re-upload CSV or use live sync.

## Security Notes
- API keys are embedded in the HTML file (marked with security warnings)
- This is designed for internal/intranet use only
- Login credentials are hardcoded: `admin@vectormedia.com` / `secret123`
