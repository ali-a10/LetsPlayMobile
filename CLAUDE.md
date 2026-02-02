# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start        # Start Expo dev server (scan QR with Expo Go, or press w for web)
npm run android  # Run on Android emulator
npm run ios      # Run on iOS simulator (Mac only)
npm run web      # Run in browser
```

## Architecture

**Stack:** Expo (React Native) + TypeScript + Supabase + TanStack Query + Zustand

**Routing:** Expo Router with file-based navigation in `/app`
- `(auth)/` — Auth screens (login, signup, complete-profile). Stack navigator.
- `(tabs)/` — Main app screens (home, search, create, profile). Tab navigator.
- `event/[id].tsx` — Dynamic route for event details.

**Auth flow:** Handled in `app/_layout.tsx` via `AuthGate` component:
1. No session → redirect to login
2. Session but no profile in DB → redirect to complete-profile
3. Session + profile → allow access to tabs

**State management:**
- Server state (Supabase data): TanStack Query via `QueryProvider` in root layout
- Client state (UI state like filters): Zustand stores in `lib/stores/`
- Auth state: `lib/hooks/useAuth.ts` subscribes to Supabase auth changes

**Database:** Supabase with Row Level Security. Types defined in `lib/types/database.ts`. Client initialized in `lib/supabase.ts` using env vars from `.env.local`.

**UI components:** Reusable components in `components/ui/` (Button, Input, Select). Use color constants from `lib/constants/colors.ts`.

## Code Style

- When creating a new function, always include a one-sentence description of what it does.
