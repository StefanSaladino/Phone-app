# Together

A private, mobile-first React app for two people to share date ideas, save places, and leave little notes.

The project has a strict **$0 operating-cost target**. It uses React and Vite in the browser, Supabase Free for authentication and PostgreSQL, and Netlify Free for hosting.

## Current status

Phases 1 through 9 are implemented:

- complete Vite + React + TypeScript repository
- Supabase email/password sessions and protected routes
- two-person couple workspace with profile names and live totals
- fully shared date-idea CRUD
- idea, planned, and completed states
- planned dates, favourites, filters, and confirmation states
- categorized saved-place CRUD with free Google Maps links
- inbox notes and live/app-opening surprise popups
- realtime post-it delivery, seen/dismissed states, and sent/received history
- recipient-only note-state permissions protected by Row Level Security
- initial database schema with Row Level Security
- installable PWA manifest, app icons, offline shell, and Netlify release configuration
- private prize and punishment wheels with secure bet settlement
- hidden-answer bets with server-protected prediction reveal
- per-device Web Push subscriptions, date reminders, and bet notifications

See [`docs/ROADMAP.md`](docs/ROADMAP.md) for the complete build plan.

## Requirements

- A current Node.js release supported by Vite
- npm
- A free Supabase account
- A free Netlify account for deployment later

## Local setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create a Supabase project

Create one free Supabase project. In its SQL Editor, run these migrations in order:

```text
supabase/migrations/0001_initial_schema.sql
supabase/migrations/0002_profile_names.sql
supabase/migrations/0003_notes_delivery.sql
supabase/migrations/0004_notes_delivery_direct_access.sql
supabase/migrations/0005_realtime_surprise_notes.sql
supabase/migrations/0006_bets_foundation.sql
supabase/migrations/0008_bet_settlement_game.sql
supabase/migrations/0009_push_notifications.sql
supabase/migrations/0010_hidden_answer_bets.sql
```

### 3. Create the two users

In Supabase Authentication, create or invite the two accounts that will use the app. Disable public signup after both users exist.

The database trigger creates a matching `profiles` row for each new Auth user.

### 4. Link both users to one couple

Get the two user IDs:

```sql
select id, email
from auth.users
order by created_at;
```

Replace the placeholders and run:

```sql
with new_couple as (
  insert into public.couples (name, created_by)
  values ('Us', 'FIRST_USER_UUID')
  returning id
)
insert into public.couple_members (couple_id, user_id, role)
select id, 'FIRST_USER_UUID', 'owner' from new_couple
union all
select id, 'SECOND_USER_UUID', 'partner' from new_couple;
```

### 5. Configure local environment values

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env.local
```

Fill in the browser-safe values from the Supabase project's Connect panel:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
VITE_VAPID_PUBLIC_KEY=YOUR_URL_SAFE_VAPID_PUBLIC_KEY
```

Never expose a Supabase service-role key in this project.

### 6. Run the app

```bash
npm run dev
```

## Verification

```bash
npm run typecheck
npm run lint
npm run build
```

## Project structure

```text
src/
  app/              route definitions
  components/
    auth/            route protection
    layout/          shared authenticated layout
    date-ideas/      date-idea cards, filters, forms, and dialogs
    places/          saved-place cards, filters, forms, and dialogs
    notes/           note history, composer, and post-it reveal
    ui/              reusable visual components
    pwa/             installation and connectivity components
    notifications/   Web Push permission and preference controls
  contexts/          global state providers
  hooks/             typed context hooks
  lib/               external clients and configuration
  pwa/               production service-worker registration
  pages/             route-level screens
  services/          Supabase feature queries and mutations
  types/             shared database and feature types
  styles/            tokens and separated style concerns
supabase/
  migrations/        database schema and security policies
  functions/         server-only Web Push delivery worker
  setup/             manual cron configuration templates
docs/
  ROADMAP.md          phased implementation plan
```

## Production deployment

Phase 6 includes the manifest, icons, service worker, offline messaging, and Netlify cache rules required for the installable release. Follow [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) to deploy on Netlify Free and add the app to both iPhone Home Screens.
