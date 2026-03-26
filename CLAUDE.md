# Suggestd — Claude Code Master Brief

## What you are building

Suggestd is an anonymous employee feedback tool. Workers get a Chrome extension that sits
in their browser toolbar. One click opens a small widget. They type an idea or suggestion,
pick a category, and submit — fully anonymously, no login required. An admin dashboard
shows AI-clustered insights. A weekly digest email is sent to admins every Monday.

Zero external capital. Solo founder. Ship fast.

---

## Tech stack

| Layer | Tool | Why |
|---|---|---|
| Widget | Chrome Extension (Manifest V3) | Lives in browser toolbar, zero install friction |
| Frontend + API | Next.js 15 (App Router) on Vercel | Free tier, instant deploys, cron support |
| Database | Supabase (PostgreSQL) | Free tier, RLS, no backend to manage |
| AI clustering | Anthropic Claude API (claude-sonnet-4-20250514) | Cheap, fast, smart summaries |
| Email | Resend | Free tier, great DX |
| Fonts | DM Sans (Google Fonts) | Clean, modern, matches brand |
| Styling | Tailwind CSS | Fast to write, no design system needed |

---

## Commands

```bash
npm run dev          # Start dev server on localhost:3000
npm run build        # Production build
npm run lint         # ESLint check
npm run db:push      # Push schema changes to Supabase
```

---

## Project structure to create

```
pulse/
├── CLAUDE.md                          ← this file
├── .env.local                         ← never commit
├── .env.example                       ← commit this
├── package.json
├── next.config.js
├── tailwind.config.js
├── vercel.json                        ← cron config
│
├── app/
│   ├── layout.js
│   ├── page.js                        ← landing page
│   │
│   ├── dashboard/
│   │   ├── page.js                    ← admin insights dashboard
│   │   └── layout.js                 ← simple auth check
│   │
│   └── api/
│       ├── submit/route.js           ← POST: receive idea from extension
│       ├── insights/route.js         ← GET: return clustered data for dashboard
│       └── digest/route.js           ← POST: weekly cron → Claude → email
│
├── components/
│   ├── IdeaCard.js                   ← single clustered idea display
│   ├── SentimentBar.js               ← visual sentiment breakdown
│   ├── MetricCard.js                 ← stat card (submissions, participation)
│   └── WeeklyChart.js                ← trend chart (recharts)
│
├── lib/
│   ├── supabase.js                   ← supabase client (server + browser)
│   ├── anthropic.js                  ← claude api client
│   └── email.js                      ← resend email builder
│
├── extension/
│   ├── manifest.json
│   ├── popup.html
│   ├── popup.js
│   ├── popup.css
│   ├── background.js
│   └── icon.png                      ← yellow circle, 128x128
│
└── supabase/
    └── schema.sql                    ← full DB schema, run once
```

---

## Environment variables

Create `.env.local` (never commit). Create `.env.example` with empty values.

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# Resend
RESEND_API_KEY=re_...

# Cron security (make up a long random string)
CRON_SECRET=some-long-random-string-here

# Admin access (simple password for MVP)
ADMIN_PASSWORD=choose-a-password
```

---

## Database schema — supabase/schema.sql

Create all tables, indexes, and RLS policies in one file.

```sql
-- Enable UUID generation
create extension if not exists "pgcrypto";

-- Organisations (your customers)
create table organisations (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  admin_email text not null,
  slug text unique not null,          -- used in extension config e.g. "acme-corp"
  created_at timestamptz default now()
);

-- Ideas — fully anonymous, no user reference ever
create table ideas (
  id uuid default gen_random_uuid() primary key,
  org_id uuid references organisations(id) on delete cascade not null,
  body text not null check (char_length(body) between 5 and 1000),
  category text check (category in ('operations','culture','product','management','other')),
  submitted_at timestamptz default now()
);

-- AI-generated weekly digests
create table digests (
  id uuid default gen_random_uuid() primary key,
  org_id uuid references organisations(id) on delete cascade not null,
  week_of date not null,
  total_submissions integer not null default 0,
  insights jsonb not null,            -- structured output from Claude
  created_at timestamptz default now(),
  unique(org_id, week_of)
);

-- Indexes
create index ideas_org_submitted on ideas(org_id, submitted_at desc);
create index digests_org_week on digests(org_id, week_of desc);

-- Row Level Security
alter table ideas enable row level security;
alter table digests enable row level security;
alter table organisations enable row level security;

-- Service role bypasses RLS (used in API routes with SUPABASE_SERVICE_ROLE_KEY)
-- Anon key can only insert ideas (for the extension)
create policy "anon can insert ideas"
  on ideas for insert
  with check (true);

-- Block anon reads — ideas are never read publicly
create policy "no anon reads"
  on ideas for select
  using (false);
```

---

## API routes — detailed specs

### POST /api/submit

Receives an idea from the Chrome extension.

```javascript
// Request body:
{ idea: string, category?: string, orgSlug: string }

// Steps:
// 1. Validate: idea exists, 5-1000 chars, orgSlug is valid
// 2. Look up org_id from orgSlug (use service role key)
// 3. Strip any PII — remove emails, phone numbers with regex before saving
// 4. Insert into ideas table — no user ID, no IP address, nothing identifying
// 5. Return { ok: true } — and optionally { similar_count: N } for the toast message

// Rate limiting: use Vercel's built-in or a simple in-memory check
// Return 429 if same orgSlug submits more than 20 ideas per minute
```

### GET /api/insights

Returns dashboard data for an org. Admin-only.

```javascript
// Query params: ?orgSlug=acme-corp&weeks=4
// Auth: check Authorization header against ADMIN_PASSWORD env var

// Returns:
{
  org: { name, slug },
  thisWeek: {
    total: number,
    byCategory: { operations: N, culture: N, ... },
  },
  latestDigest: { /* full insights JSON from digests table */ },
  recentDigests: [ /* last 4 weeks, for trend chart */ ],
  rawFeed: [ /* last 20 ideas, body + category + submitted_at */ ]
}
```

### POST /api/digest

Called by Vercel cron every Monday 06:00 UTC. Clusters ideas with Claude, saves digest, emails admin.

```javascript
// Auth: check Authorization header === `Bearer ${CRON_SECRET}`

// For each organisation:
// 1. Fetch all ideas from the past 7 days
// 2. If < 3 ideas, skip (not enough signal)
// 3. Build prompt for Claude (see Claude prompt below)
// 4. Parse JSON response
// 5. Upsert into digests table
// 6. Send email via Resend
// 7. Log result

// Important: use Promise.allSettled so one failed org doesn't block others
```

---

## Claude API prompt — digest generation

Use this exact prompt in `/api/digest/route.js`:

```javascript
const prompt = `You are analysing anonymous employee feedback submitted this week.
Company: ${org.name}
Total submissions: ${ideas.length}

Submissions (format: [category] text):
${ideas.map((i, n) => `${n+1}. [${i.category || 'general'}] ${i.body}`).join('\n')}

Return a JSON object with exactly these fields:
{
  "top_issues": [
    { "theme": "short theme title", "count": N, "example": "quote from an actual submission" }
  ],
  "top_opportunities": [
    { "theme": "short theme title", "count": N }
  ],
  "quick_wins": ["actionable item 1", "actionable item 2", "actionable item 3"],
  "sentiment": {
    "positive_pct": N,
    "neutral_pct": N,
    "frustrated_pct": N
  },
  "ai_insight": "One sentence. Most important pattern in plain English.",
  "participation_note": "Optional: one sentence if participation seems low or unusually high."
}

Rules:
- top_issues: max 3 items, sorted by count descending
- top_opportunities: max 2 items
- quick_wins: max 3 items, each under 10 words, genuinely actionable
- sentiment percentages must sum to 100
- example quotes must be paraphrased, not verbatim (protect anonymity)
- Return ONLY the JSON object, no markdown, no preamble`
```

Parse with: `JSON.parse(message.content[0].text)`

---

## Chrome Extension — extension/

### manifest.json

```json
{
  "manifest_version": 3,
  "name": "Pulse — Share Ideas Anonymously",
  "version": "1.0.0",
  "description": "Quickly share ideas and suggestions with your team, anonymously.",
  "permissions": ["storage"],
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icon16.png",
      "32": "icon32.png",
      "48": "icon48.png",
      "128": "icon128.png"
    }
  }
}
```

### popup.html

Full styled widget. Design spec:
- Width: 360px
- Font: DM Sans from Google Fonts (load via @import in CSS)
- Background: white
- Hover/focus state on textarea: border turns #F7FE4F with yellow glow
- Submit button: #F7FE4F background, dark text, full width, rounded
- Category select: subtle border, clean styling
- Anonymous toggle: ON by default, small toggle switch
- Success state: replace form with "Submitted. Your idea has been added." + count of similar ideas this week
- Error state: show inline error message in red, don't clear the textarea

### popup.js

```javascript
// On load: read orgSlug from chrome.storage.local
// If no orgSlug: show setup screen asking for org slug
// On submit:
//   1. Validate textarea not empty
//   2. POST to https://your-vercel-app.vercel.app/api/submit
//   3. Show success or error state
//   4. Auto-close after 3 seconds on success

const API_BASE = 'https://YOUR_APP.vercel.app'; // replace at deploy time
```

### Setup flow (first install)

When extension is installed and `orgSlug` is not set in storage:
- Show a simple input: "Enter your organisation code"
- User types the slug (e.g. `acme-corp`) given to them by their admin
- Save to `chrome.storage.local`
- Show normal widget on next open

---

## Admin dashboard — app/dashboard/page.js

Simple password-protected page. On load:
1. Check `localStorage` for `pulse_auth` token
2. If not present, show password prompt (full screen, centered, clean)
3. Verify against `ADMIN_PASSWORD` via a simple `POST /api/auth/verify`
4. Store token in localStorage on success

Dashboard layout (single page, no sidebar needed for MVP):

```
┌─────────────────────────────────────────────────────┐
│  ● Suggestd          [Week of 17 Mar]   [Email report] │
├─────────────────────────────────────────────────────┤
│  [142 submissions] [38 topics] [67% participation]  │
│                    [3.4/5 sentiment]                │
├─────────────────┬───────────────────────────────────┤
│  Top ideas      │  Sentiment + trend chart          │
│  [filter tabs]  │  [AI insight box]                 │
│  [idea list]    │                                   │
├─────────────────┴───────────────────────────────────┤
│  Raw feed (last 20 submissions)                     │
└─────────────────────────────────────────────────────┘
```

Use `recharts` for the trend line chart. Use Tailwind for layout.
Match the yellow (#F7FE4F) accent throughout.
Show "Loading..." skeleton states while fetching.

---

## Landing page — app/page.js

Simple, fast-loading marketing page. Sections:

1. Nav: logo (yellow dot + "Suggestd"), "Get early access" button (yellow)
2. Hero: headline "Your team has ideas. Surveys don't catch them." + subheading + two CTAs
3. Widget preview: show a mock of the extension popup (static HTML, not real extension)
4. How it works: 3 steps (widget → AI clusters → weekly email)
5. Comparison table: Pulse vs monthly surveys
6. Social proof: 2 fake testimonial quotes (label as "Beta tester")
7. CTA band: "Free 30-day pilot. Setup in 10 minutes." + email input
8. Footer: "Built by one person. Powered by Claude."

Keep it under 200 lines of JSX. No animations needed for MVP.

---

## Email template — lib/email.js

Build HTML email with inline styles (email clients strip `<style>` tags).

```javascript
export function buildDigestEmail(orgName, weekOf, totalIdeas, insights) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a1a;">

  <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 24px;">
    <div style="width: 18px; height: 18px; background: #F7FE4F; border-radius: 50%;"></div>
    <strong style="font-size: 16px;">Pulse</strong>
    <span style="color: #888; font-size: 13px; margin-left: auto;">Week of ${weekOf}</span>
  </div>

  <h1 style="font-size: 20px; margin: 0 0 4px;">${orgName} — Weekly Insights</h1>
  <p style="color: #666; font-size: 14px; margin: 0 0 24px;">${totalIdeas} anonymous submissions this week</p>

  <!-- Top issues -->
  <h2 style="font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; color: #888; margin: 0 0 12px;">Top issues</h2>
  ${insights.top_issues.map(issue => `
    <div style="padding: 12px; background: #f9f9f9; border-radius: 8px; margin-bottom: 8px;">
      <strong style="font-size: 15px;">${issue.theme}</strong>
      <span style="color: #666; font-size: 13px; margin-left: 8px;">${issue.count} mentions</span>
      <p style="color: #555; font-size: 13px; margin: 4px 0 0; font-style: italic;">"${issue.example}"</p>
    </div>
  `).join('')}

  <!-- Quick wins -->
  <h2 style="font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; color: #888; margin: 24px 0 12px;">Quick wins this week</h2>
  ${insights.quick_wins.map(win => `
    <div style="padding: 8px 12px; border-left: 3px solid #F7FE4F; margin-bottom: 6px; font-size: 14px;">${win}</div>
  `).join('')}

  <!-- AI insight -->
  <div style="background: #fffff0; border: 1px solid #e8ef00; border-radius: 8px; padding: 14px; margin: 24px 0;">
    <strong style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #888;">AI insight</strong>
    <p style="margin: 6px 0 0; font-size: 14px; font-style: italic;">${insights.ai_insight}</p>
  </div>

  <p style="color: #aaa; font-size: 12px; margin-top: 32px; text-align: center;">
    Powered by Pulse · <a href="{{dashboard_url}}" style="color: #888;">View full dashboard</a>
  </p>

</body>
</html>`;
}
```

---

## vercel.json — cron config

```json
{
  "crons": [
    {
      "path": "/api/digest",
      "schedule": "0 6 * * 1"
    }
  ]
}
```

---

## Deployment steps (run in order)

```bash
# 1. Create Next.js project
npx create-next-app@latest suggestd --app --tailwind --no-typescript
cd suggestd

# 2. Install dependencies
npm install @supabase/supabase-js @anthropic-ai/sdk resend recharts

# 3. Copy all files from the structure above

# 4. Create Supabase project at supabase.com
#    Run supabase/schema.sql in the SQL editor
#    Copy the project URL and keys to .env.local

# 5. Create Resend account at resend.com
#    Add and verify your domain (or use the sandbox for testing)
#    Copy API key to .env.local

# 6. Push to GitHub, connect to Vercel
#    Add all env vars in Vercel dashboard
#    Deploy

# 7. Test the API:
curl -X POST https://your-app.vercel.app/api/submit \
  -H "Content-Type: application/json" \
  -d '{"idea":"This is a test idea","category":"culture","orgSlug":"test-org"}'

# 8. Load the extension:
#    Open chrome://extensions
#    Enable Developer Mode
#    Click "Load unpacked"
#    Select the extension/ folder

# 9. Manually trigger the digest (to test):
curl -X POST https://your-app.vercel.app/api/digest \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

---

## MVP constraints (keep it simple)

- No user accounts — admin is a single password in env vars
- No multi-admin — one email per org for now
- No file uploads in V1 — the folder button is UI-only, wire it up in V2
- No real-time updates — dashboard fetches on load, add a refresh button
- No mobile app — Chrome extension only for V1
- No usage analytics yet — just Supabase row counts

---

## Anonymity guarantee (important for trust)

These are the rules Claude Code must enforce in the codebase:

1. The `ideas` table has NO user ID column, NO email column, NO IP column — ever
2. `POST /api/submit` must NOT log `req.headers['x-forwarded-for']` or any IP
3. The Chrome extension must NOT send any browser fingerprint, user agent string beyond what fetch sends by default, or any identifying metadata
4. The org admin can see the raw feed of idea text — but never who wrote what
5. Add a comment in the code `// ANONYMITY: do not add user tracking here` near any submit handler

---

## What to build first (priority order)

1. `supabase/schema.sql` — foundation for everything
2. `lib/supabase.js` — database client
3. `app/api/submit/route.js` — core submission endpoint  
4. `extension/` — all 5 extension files (manifest, popup.html, popup.js, popup.css, background.js)
5. `app/api/digest/route.js` — Claude clustering + Resend email
6. `app/dashboard/page.js` — admin insights view
7. `app/api/insights/route.js` — dashboard data endpoint
8. `app/page.js` — landing page
9. `lib/email.js` — email template
10. `vercel.json` — cron config

---

## Key decisions for Claude Code to make

- Use `@supabase/supabase-js` v2 (not v1)
- Use `fetch` directly for the Anthropic API (or `@anthropic-ai/sdk`)
- Use Next.js App Router (not Pages Router)  
- Use `Response.json()` in API routes (not `NextResponse`)
- Keep all secrets server-side only — no `NEXT_PUBLIC_` prefix for API keys
- The `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are safe to expose (Supabase is designed for this — RLS handles security)
- Use `async/await` throughout, no `.then()` chains
- Handle errors gracefully — always return a JSON error response, never let routes throw unhandled

---

## After you build it

Say this to Claude Code to start:

> "Read CLAUDE.md and build Suggestd in priority order. Start with the database schema, then the submit API, then the Chrome extension files. Ask me before installing any package not listed in CLAUDE.md. Use Plan mode for each major section before writing code."
