# Frontend README

This is the React + Vite + TypeScript frontend for the Gully Predict 2026 platform.

## Stack

- **React 18** with functional components and hooks
- **Vite** for build tooling and dev server
- **TypeScript** in strict mode
- **Tailwind CSS v4** with custom IPL design tokens
- **Zustand** for auth/user state
- **TanStack Query v5** for all server state
- **React Router v6** for navigation
- **Axios** for API calls
- **Lucide React** for icons

## Dev

```bash
npm install
npm run dev       # starts dev server at http://localhost:5000
npm run build     # TypeScript check + production bundle
```

## Environment

Set `VITE_API_URL` in `.env` (defaults to `http://localhost:8000`):

```env
VITE_API_URL=http://localhost:8000
```

## Key Conventions

- **Team colors**: all team styling goes through `src/utils/teamColors.ts`. Use `getTeamColor(name)` and `getTeamShortName(name)` — both accept `any` type safely.
- **tossTime**: the API returns `tossTime` (ISO string) on all match responses. Use this field for lock calculations and countdown timers — never `start_time` directly.
- **Dynamic answers**: never hardcode question IDs in the UI. Iterate over `pred.answers` keys and look up metadata via the `questionMap` from the match detail response.
- **League Question Composite Keys**: League-specific questions use a composite key format `league_{campaign_id}_{question_id}` to prevent collision. The form maps all questions under `extra_answers.{key}` using React Hook Form, except for the top-level `use_powerup` field. In `MatchPage.tsx`, group questions dynamically by their `source_name` using `groupedQuestions`.
- **Powerup Balances & Mathematical Clarity**: Display remaining powerup balances dynamically from `powerup_balances` (global `GLB` balances vs campaign-scoped limits). In prediction details, display unmultiplied base points alongside a dedicated `2x` multiplier badge if a powerup is active.
- **Joined-Date Temporal Filtering**: Leaderboards and user progression lists dynamically filter matches using the member's `joined_at` timestamp: `Match.start_time >= joined_at`. Matches completed before joining are excluded.
- **Layout width**: the main Layout wrapper caps at `max-w-[1280px]`. Individual page containers should use `w-full max-w-full` to fill the available space.
- **iOS Safe Areas & Touch Targets**: Wrap root elements using CSS `env(safe-area-inset-*)` padding constants to avoid notches/home indicators. Ensure all buttons/inputs have a touch target of at least `44x44pt`, and body fonts are at least `17px` to prevent automatic zoom on iOS inputs.
- **Mobile Input Accessory Views**: Keep action/submit buttons anchored and reachable at the bottom of the form overlays (`AdminModal`) on mobile screens.

## Deployment

```bash
npm run build
# dist/ → deploy to Vercel
```

Vercel config (`vercel.json`):
```json
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```
