# GROQ AI Configuration

This document describes the AI analysis configuration used in the LA STAP Operations Portal.

## Model

- **Provider:** Groq
- **Model:** Llama 3.3 70B
- **Max Tokens:** 2000

## System Role

```
You are an expert operations analyst for an out-of-home advertising company.
Provide concise, actionable insights using bullet points and specific numbers.
Be direct and executive-level in your communication.
```

## Data Sources

The AI analyzes data from these primary sources:

| Source | Description |
|--------|-------------|
| **Pipeline Summary** | Current month campaigns by stage (RFP → POP Complete) |
| **Installation Report** | Unit-level install tracking with completion rates |
| **Risk Analysis** | Critical, stalled, and at-risk campaign detection |
| **Weather Forecast** | Local weather from user's configured location |
| **Delayed Flights** | Campaigns past start date but not complete |
| **Material Status** | Tracking material receipt bottlenecks |
| **Hold Report** | Campaigns on hold with reasons |
| **Removal Operations** | Upcoming and overdue removals |
| **Performance Report** | Historical success rates, impressions delivered |
| **POP Gallery** | Photo compliance tracking |
| **Special Media** | High-touch installs (wraps, dominations, takeovers) |
| **Availability Charting** | Market capacity and booking density |

### Data Filtering

- **6-month window:** Campaigns older than 6 months are automatically excluded
- **Active filters respected:** Market, product, and production filters are noted in the prompt
- **Weather location:** Uses user's configured location (Settings → Weather Location)

## Data Points Fed to AI

### 1. Install Execution Scorecard

| Metric | Description |
|--------|-------------|
| Total Units Ordered | Sum of all unit quantities |
| Units Installed | Sum of installed units |
| Units Pending | Remaining units to install |
| Overall Completion Rate | Installed / Ordered as percentage |

**Campaign Status Categories:**
- **Fully Installed** - 100% complete (pending = 0)
- **Partially Installed** - Some progress, not done
- **Not Started** - 0 units installed

### 2. Risk Radar

| Risk Level | Logic | Criteria |
|------------|-------|----------|
| **CRITICAL** | Ending soon + low completion | Started >3 days ago, ending in <7 days, <50% complete |
| **STALLED** | Started but no recent progress | Started >7 days ago, <50% complete |
| **AT RISK** | Past start date, no progress | Past start date, 0% installed |

### 3. Delayed Flights

| Metric | Description |
|--------|-------------|
| Count | Campaigns past start date (>7 day grace), not complete |
| Total Qty | Units affected by delays |
| Campaigns | Specific advertisers with days late and install progress |

### 4. Material Status

| Category | Description |
|----------|-------------|
| **Awaiting Material** | Campaigns in Contracted/Proofs Approved stages |
| **Materials Received** | Campaigns in Material Ready stage |
| **Bottlenecks** | Campaigns waiting >3 days for materials |

### 5. Hold Tracking

- Count of campaigns on hold
- Total units blocked
- Hold reasons breakdown
- Specific advertiser names

### 6. Removal Operations

| Category | Description |
|----------|-------------|
| **This Week** | Removals due Mon-Sun of current week |
| **Overdue** | Past end date, not yet removed |

### 7. Pipeline Stage Counts

Campaigns are counted by stage:
- RFP
- Proposal
- Contracted
- Proofs Approved
- Material Ready
- Installed
- POP Complete

### 8. POP Compliance (Photo Documentation)

| Category | Description |
|----------|-------------|
| **Awaiting Photos** | Installed campaigns with no photos taken yet |
| **Photos Ready** | Photos taken, awaiting POP completion |
| **POP Complete** | Fully documented campaigns |
| **Overdue** | Installed >7 days without photos (flagged) |

### 9. Special Media Tracking

| Category | Description |
|----------|-------------|
| **Total** | All special media (wraps, dominations, takeovers, custom) |
| **In Progress** | Not yet completed - requires extra attention |
| **Completed** | Successfully installed special media |

### 10. Performance Report

| Metric | Description |
|--------|-------------|
| **Completed Campaigns** | Count and quantity of finished work |
| **Impressions** | Estimated impressions delivered (based on media type) |
| **By Market** | Performance breakdown by geographic market |

### 11. Market Capacity

| Metric | Description |
|--------|-------------|
| **Total Booked** | Units currently booked across all markets |
| **By Market** | Units and campaigns per market |
| **Busiest Markets** | Top 5 markets by booking volume |

### 12. External Risk Factors

| Factor | Source |
|--------|--------|
| **Weather** | Open-Meteo API (user's configured location) |
| **Holidays** | Built-in holiday calendar (14-day lookahead) |

## AI Directive

The AI is instructed to act as **Senior Director of Operations** and provide a sharp, no-BS operational briefing (8-12 sentences max).

### Required Analysis Points (8 Total)

1. **HEADLINE THE BIGGEST RISK**
   - What's the #1 thing that could blow up this week?
   - Be specific with campaign names and numbers

2. **INSTALL VELOCITY CHECK**
   - Current completion percentage
   - Path to completion
   - Flag if below 50% (concerning) or 75% (needs acceleration)

3. **CALL OUT STALLED/DELAYED**
   - Name specific advertisers
   - Include both stalled and delayed campaigns
   - Demand action on problem campaigns

4. **POP COMPLIANCE**
   - Installed campaigns needing photos
   - Compliance risk assessment

5. **SPECIAL MEDIA WATCH**
   - High-touch installs requiring extra attention
   - Wraps, dominations, takeovers in progress

6. **HOLDS & MATERIALS**
   - Revenue impact of blocked campaigns
   - Material bottlenecks

7. **MARKET CAPACITY**
   - Top market by booking volume
   - Any capacity concerns or overload

8. **WEATHER/STAFFING**
   - Factor weather from user's location into directive
   - Note holiday staffing risks

## Output Style

- **Length:** 8-12 sentences maximum
- **Tone:** Direct, executive-level, no corporate fluff
- **Content:** Specific numbers, specific advertiser names
- **Format:** Bullet points and specific metrics

## API Configuration

```javascript
// API Endpoint
https://api.groq.com/openai/v1/chat/completions

// Request Headers
Content-Type: application/json
Authorization: Bearer ${GROQ_API_KEY}

// Request Body
{
    model: "llama-3.3-70b-versatile",
    messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: ANALYSIS_PROMPT }
    ],
    max_tokens: 2000,
    temperature: 0.7
}
```

## Setting Up

1. Get a free API key at [console.groq.com/keys](https://console.groq.com/keys)
2. In the app, triple-click the logo to open Settings
3. Paste your API key in the "AI Features (Groq API)" section
4. Click Save

## Configuring Weather Location

1. Triple-click the logo to open Settings
2. Find "Weather Location" setting
3. Enter your city (e.g., "Los Angeles, CA" or "New York, NY")
4. Save - AI will now use local weather in analysis

## Triggering Analysis

The AI analysis can be triggered from:
- **Dashboard view** - "AI Pipeline Insights" button in the header
- Automatically refreshes with new data on each trigger

## Data Tabs Used by AI

| Tab | Data Provided |
|-----|---------------|
| **Pipeline Summary** | Stage counts, campaign flow |
| **Installation Report** | Unit-level install tracking |
| **Risk Analysis** | Critical/stalled/at-risk detection |
| **Delayed Flights** | Past-due campaigns |
| **Hold Report** | Blocked campaigns with reasons |
| **Pending Removals** | Upcoming/overdue removals |
| **Performance Report** | Historical success, impressions |
| **POP Gallery** | Photo compliance status |
| **Special Media** | High-touch installs tracking |
| **Availability Charting** | Market capacity metrics |

## Impression Estimation

Impressions are estimated based on media type:

| Media Type | Daily Rate per Unit |
|------------|---------------------|
| Transit Shelter | 15,000 |
| Bus | 8,000 |
| Digital | 45,000 |
| Billboard | 35,000 |
| Default | 10,000 |

Formula: `daily_rate × quantity × 28 days`
