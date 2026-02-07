# KloudGin Replacement — Field Operations Module

> **Status:** Vision / Future exploration
> **Context session:** Install Velocity SLA feature build (Feb 2026)
> **Priority:** TBD — explore when ready

---

## The Idea

Replace KloudGin with a **custom-built field operations module** as a standalone addition to the Ops Hub Portal. Instead of paying for an enterprise field service platform designed for utilities, build something purpose-fit for OOH transit advertising operations.

## Why Consider This

- KloudGin is built for **utilities/telecom** — OOH advertising has different workflows
- We're already building campaign intelligence in the Ops Hub that KloudGin can't see
- The bridge between KloudGin and Ops Hub is manual (CSV exports)
- A unified system eliminates the data gap entirely
- Field crews doing OOH installs/removals have simpler routing needs than utility workers
- Cost: enterprise field service platforms carry enterprise pricing

## What KloudGin Currently Handles

### Must-Replace (Core)
- [ ] **Work order creation** — schedule install/removal jobs
- [ ] **Crew dispatch & assignment** — who does what, when
- [ ] **Mobile field app** — technicians see their jobs, mark complete, upload photos
- [ ] **Work order status tracking** — pending → dispatched → in progress → complete
- [ ] **Location/asset management** — shelter locations, panel inventory

### Nice-to-Have (KloudGin Features We May Use)
- [ ] Route optimization for crews
- [ ] Crew availability / calendar management
- [ ] Equipment/material tracking per job
- [ ] Digital signatures / proof of completion
- [ ] Offline mobile support (shelters may have poor signal)

### Don't Need (Utility-Specific)
- Predictive maintenance / AI failure detection
- Complex asset lifecycle (transformers, meters, etc.)
- Compliance/regulatory workflows
- Multi-tier subcontractor management

## The Integration Win

If field ops lives inside (or tightly alongside) the Ops Hub:

```
Campaign reaches "Material Ready"
    → Auto-generate work orders for each face/location
    → Crew completes install in field app
    → Install count updates in real-time
    → SLA velocity tracks automatically (no CSV lag)
    → POP photos flow straight into POP Gallery
    → Removal work orders auto-generate from end dates
```

**The firstInstallDate and completion fields we just built SLA tracking around?**
Those would come directly from work order timestamps instead of CSV columns.

## Architecture Questions (For Future Session)

1. **Standalone app or integrated into Ops Hub?**
   - Standalone: `mobile.html` already exists as a separate field app
   - Integrated: single codebase, shared data layer
   - Hybrid: standalone mobile app + shared Firebase backend

2. **Firebase fit?**
   - Firestore for work orders (real-time sync is perfect for field updates)
   - Firebase Auth for crew login
   - Firebase Storage for field photos
   - Still on Spark plan? Work orders + photos might push to Blaze

3. **Mobile-first?**
   - Field crews are 100% mobile
   - Existing `mobile.html` is a starting point
   - PWA vs native? (PWA keeps it simple, offline via service worker)

4. **Crew management scope?**
   - Just "Shelter Clean" and "In-House Ops" today (from removal assignee dropdown)
   - How many crews? How complex is scheduling?
   - Do crews self-select jobs or get dispatched?

5. **Location data?**
   - Do we have a shelter/panel location database?
   - GPS tracking for crews?
   - Map-based dispatch view?

## Data Model Sketch

```
work_orders/
  ├── {orderId}
  │   ├── campaignId        → links to Ops Hub campaign
  │   ├── type              → "install" | "removal" | "rotation" | "maintenance"
  │   ├── locationId        → shelter/panel reference
  │   ├── assignedCrew      → crew identifier
  │   ├── status            → "pending" | "dispatched" | "in_progress" | "complete"
  │   ├── scheduledDate
  │   ├── completedDate     → becomes firstInstallDate / completion in Ops Hub
  │   ├── photos[]          → field photos (install verification / POP)
  │   ├── notes
  │   └── createdAt / updatedAt

crews/
  ├── {crewId}
  │   ├── name
  │   ├── type              → "shelter_clean" | "in_house"
  │   ├── active
  │   └── assignments[]     → current work order refs

locations/
  ├── {locationId}
  │   ├── type              → "shelter" | "billboard" | "transit"
  │   ├── address / coords
  │   ├── market
  │   ├── panelCount
  │   └── currentCampaign   → active campaign ref
```

## Starting Point

The existing **`mobile.html`** field operations app is already built for field crews. Review what it does today and what would need to expand for work order management.

## Revenue / Cost Justification

- KloudGin licensing cost: $____/month (fill in)
- Custom build: Firebase (Spark/Blaze) + development time
- Break-even timeline: ____
- Intangible value: unified data, no CSV bridge, real-time SLA tracking

---

*This document is a placeholder for future exploration. Don't start building — just capture the thinking so we can pick it up in a future session.*
