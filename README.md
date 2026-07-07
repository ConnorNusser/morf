# Morf

An AI-powered fitness app built with Expo / React Native. Generate workouts and routines from natural language, log sets (including hands-free by voice), track strength percentiles and personal records, and climb a tier-based gamification system — with an iOS Live Activity for rest timers and Lock-Screen set logging.

> Working on this codebase with an AI assistant? Start with [`CLAUDE.md`](./CLAUDE.md) — it maps the architecture, commands, and conventions. Domain-specific notes live in `lib/ai/CLAUDE.md` and `lib/gamification/CLAUDE.md`.

## Stack

- **Expo SDK 54** (New Architecture, Hermes) + **expo-router** (typed, file-based routing)
- **Google Gemini** (`@google/generative-ai`) for workout/routine generation
- **Supabase** (anonymous, device-keyed) for analytics, sync, and a social feed
- Local-first persistence via AsyncStorage + SecureStore — **no login/auth**
- Native iOS **Live Activity** module + **WidgetKit** widget (`modules/`, `targets/`)

## Getting started

```bash
npm install
npm start          # Metro bundler — press i (iOS sim) or a (Android)
```

For anything touching the native Live Activity / widget, run a full native build (Expo Go can't load local native modules):

```bash
npm run ios        # or: npm run android
```

### Environment

Set these in `.env` / `.env.local` (all are `EXPO_PUBLIC_*` and client-visible by design). The app degrades gracefully when they're absent — Gemini falls back to deterministic generation, and Supabase features silently no-op.

```
EXPO_PUBLIC_GEMINI_API_KEY=...
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_KEY=...
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm start` | Start Metro (Expo dev server) |
| `npm run ios` / `android` | Native build + run on a simulator/device |
| `npm run web` | Web build (used by the `visual-loop/` screenshot harness) |
| `npm test` | Jest (pure `lib/` domain logic; node env, no RN rendering) |
| `npm run lint` | ESLint (expo flat config) |
| `npx tsc --noEmit` | Typecheck |

Run a single test with `npx jest __tests__/oneRmEstimate.test.ts` or `npx jest -t "name"`.

The **pre-commit hook** runs `eslint --max-warnings 0`, `tsc --noEmit`, and `npm test` — all three must pass.

## Project layout

```
app/            expo-router screens (5 tabs: home, history, workout, notes, profile)
components/     presentation, grouped by tab + shared ui/ primitives
contexts/       global React state (theme, user, workout launch, video, tab bar)
lib/            all domain logic — the center of gravity
  ai/           Gemini generation + prompt factories        (see lib/ai/CLAUDE.md)
  workout/      session lifecycle, draft, parsing, progression
  gamification/ XP, tiers, achievements, PRs                (see lib/gamification/CLAUDE.md)
  history/      derived, unit-tested analytics
  data/         static reference data + calculators
  services/     Supabase, feed, notifications, voice, device identity
  storage/      local device persistence
  ui/           design tokens + theme
modules/        local native iOS Live Activity module
targets/        WidgetKit extension (@bacons/apple-targets)
supabase/       raw SQL migrations
docs/           design & spike notes (incl. ui-conventions.md)
```

Builds and releases go through **EAS** (`eas.json`).
