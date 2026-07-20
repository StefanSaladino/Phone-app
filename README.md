# Together

A private, mobile-first React app for two people to share date ideas, save places, and leave little notes.

The project has a strict **$0 operating-cost target**. It uses React and Vite in the browser, Supabase Free for authentication and PostgreSQL, and Netlify Free for hosting.

## Current status

Phase 1 is implemented:

- complete Vite + React + TypeScript repository
- Supabase email/password session management
- protected routes
- private app shell and mobile navigation
- initial database schema with Row Level Security
- Netlify SPA configuration

The feature pages are intentionally placeholders until their individual phases.

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

Create one free Supabase project. In its SQL Editor, run:

```text
supabase/migrations/0001_initial_schema.sql
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
    ui/              reusable visual components
  contexts/          global state providers
  hooks/             typed context hooks
  lib/               external clients and configuration
  pages/             route-level screens
  styles/            tokens and separated style concerns
supabase/
  migrations/        database schema and security policies
docs/
  ROADMAP.md          phased implementation plan
```
