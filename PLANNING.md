# LetsPlay App — Planning Summary

This document captures all planning decisions made before implementation began.

---

## Product Overview

A mobile app that allows users to:
- Create and host sports events
- Join other users' sports events
- View events by sport, time, and location
- Choose whether an event is free or paid
- (Future) Handle payments in-app
- Have user accounts (sign up, login, profile)
- See who joined an event
- (Future) Ratings/reviews for hosts or events

---

## Constraints

| Constraint | Decision |
|------------|----------|
| Team size | Solo developer |
| Technical background | Full-stack web dev (JavaScript/TypeScript, React) |
| Timeline | 1-2 months for MVP |
| Budget | Bootstrapped/minimal — prefer free tiers |
| Target platforms | iOS + Android |
| Launch region | Single city (hyper-local) |
| Offline support | Not needed — app requires internet |

---

## MVP Scope

### MVP (Launch day)
- Auth (sign up, login, profile)
- Create event (with free/paid flag — no payment processing)
- Browse events + filter/search by sport, date, distance
- Join events + see participants
- Basic profile page
- Edit your own events
- Auto-archive events after their date/time (don't show in search)

### v1 (Post-launch)
- Push notifications
- Event chat (real-time messaging)
- Ratings/reviews for hosts
- Map view
- Social features (follow users, invite friends)

### v2 (Later)
- In-app payments via Stripe
- Host payouts
- Recurring events

---

## Tech Stack

| Layer | Choice | Reasoning |
|-------|--------|-----------|
| Framework | Expo (React Native) | Leverages React web skills, handles both platforms |
| Language | TypeScript | Type safety, better tooling |
| Navigation | Expo Router | File-based routing, simpler than React Navigation |
| Server state | TanStack Query | Caching, deduplication, background refetch |
| Client state | Zustand | Lightweight, no boilerplate, no providers |
| Backend | Supabase | Auth, PostgreSQL, real-time, storage — all managed |
| Payments (v1) | Stripe + RevenueCat | RevenueCat handles App Store/Play Store complexity |
| Push (v1) | Expo Notifications | Free tier friendly |
| Maps (v1) | react-native-maps | For map view feature |

### Why Supabase over custom backend?
- Solo dev + fast timeline + bootstrapped = need managed services
- PostgreSQL underneath (can migrate off later if needed)
- Real-time subscriptions built-in (for chat in v1)
- Row-level security for auth
- Good free tier
- Easier to move to custom backend than Firebase (uses standard SQL)

### Why TanStack Query + Zustand over built-in React state?
- **TanStack Query**: Automatic caching, request deduplication, background refetch, loading/error states — avoids reimplementing these poorly
- **Zustand**: 90% less boilerplate than Context + Reducer, no provider nesting, subscribe to specific slices

---

## User Profile Fields

| Field | Required | Type |
|-------|----------|------|
| first_name | Yes | text |
| last_name | Yes | text |
| email | Yes | text |
| phone | Yes | text |
| date_of_birth | Yes | date |
| gender | Yes | text |
| favourite_sports | No | text[] |
| about_me | No | text |
| avatar_url | No | text |

---

## Database Schema

### profiles
```sql
id uuid (PK, references auth.users)
first_name text NOT NULL
last_name text NOT NULL
email text NOT NULL
phone text NOT NULL
date_of_birth date NOT NULL
gender text NOT NULL
favourite_sports text[] DEFAULT NULL
about_me text DEFAULT NULL
avatar_url text DEFAULT NULL
created_at timestamptz DEFAULT now()
```

### events
```sql
id uuid (PK, default gen_random_uuid())
host_id uuid (FK → profiles, NOT NULL)
title text NOT NULL
sport text NOT NULL
date timestamptz NOT NULL
location text NOT NULL
latitude float DEFAULT NULL
longitude float DEFAULT NULL
description text DEFAULT NULL
max_participants int DEFAULT 10
is_paid boolean DEFAULT false
price decimal DEFAULT NULL
created_at timestamptz DEFAULT now()
```

### participants
```sql
event_id uuid (FK → events)
user_id uuid (FK → profiles)
joined_at timestamptz DEFAULT now()
PRIMARY KEY (event_id, user_id)
```

### Row Level Security
- Anyone can view profiles, events, participants (public read)
- Users can only update/insert their own profile
- Only hosts can update/delete their own events
- Users can only join/leave as themselves

---

## Architecture

### Folder Structure
```
/app                    # Expo Router screens
  /(auth)               # Login, signup, complete-profile
  /(tabs)               # Main tab navigation (home, search, create, profile)
  /event/[id].tsx       # Event detail (dynamic route)

/components
  /ui                   # Reusable UI (Button, Input, Select)
  /events               # Event-specific components

/lib
  /supabase.ts          # Supabase client
  /constants/colors.ts  # Color palette
  /hooks/               # Custom hooks (useAuth, etc.)
  /stores/              # Zustand stores
  /types/               # TypeScript types
  /providers/           # React providers (QueryProvider)

/supabase
  /migrations           # SQL migration files
```

### Auth Flow
1. No session → redirect to login
2. Session but no profile in DB → redirect to complete-profile
3. Session + profile → allow access to main app (tabs)

### Data Flow
- Supabase SDK → TanStack Query hooks → Components
- UI state → Zustand stores → Components

---

## Design

### Color Palette
| Name | Hex | Usage |
|------|-----|-------|
| Teal | #00475a | Primary, headers, buttons |
| Green | #0ed385 | Success, accents |
| Cyan | #00cece | Secondary |
| Mint | #03dac6 | Highlights, secondary buttons |

### UI Approach
- Polished default design using StyleSheet
- Consistent spacing, typography, colors
- Reusable components (Button, Input, Select)

---

## Build Order (MVP)

1. Project setup — init Expo, install deps, folder structure
2. Database — create tables + RLS policies in Supabase
3. Auth screens — sign up, login, session persistence
4. Profile completion flow — collect required user info after signup
5. Create event screen — form, validation, insert to DB
6. Event feed — fetch & display events, pull-to-refresh
7. Event detail — view info, participant list
8. Join/leave — join button, participant count
9. Edit event — host can modify their events
10. Search & filter — sport picker, date filter
11. Profile — user info, hosted/joined events, past events
12. Polish — error handling, loading states, empty states

---

## Additional Decisions

### Local-only files (gitignored)
- `.env.local` — Supabase credentials
- `CHANGELOG.md` — Local changelog updated after each commit

### Commit style
- No "Co-Authored-By: Claude" in commit messages

### Code style
- When creating a new function, always include a one-sentence description of what it does
