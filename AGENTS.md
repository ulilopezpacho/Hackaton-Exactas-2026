<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Project tooling

- Supabase CLI is installed as a dev dependency. Use `npx supabase ...` instead of assuming a global `supabase` binary exists.
- For remote Supabase migrations, use the authenticated Supabase connector/MCP to apply SQL directly. Do not run `supabase login`, do not link via keychain-backed auth, and do not require a global CLI session.
- After applying a remote migration through the connector, list remote migrations and name the local migration file with the exact remote version/name before committing.

## Project routing decisions

- Use normal visible route segments for the main product areas:
  - `app/auth/...` renders `/auth/...`.
  - `app/app/...` renders `/app/...`.
- Do not use route-group folders like `(app)` or `(auth)` for these areas.
- `/` should only route users based on session state:
  - authenticated users go to `/app`;
  - anonymous users go to `/auth/login`.
- Keep the mock split into real Next pages so teammates can work independently:
  - `/app`
  - `/app/onboarding`
  - `/app/trips`
  - `/app/trips/new/destination`
  - `/app/trips/new/places`
  - `/app/trips/new/preferences`
  - `/app/trips/new/generating`
  - `/app/trips/[tripId]`
  - `/app/trips/[tripId]/itinerary`
  - `/app/trips/[tripId]/itinerary/[dayNumber]`
  - `/app/trips/[tripId]/travel`
  - `/app/trips/[tripId]/settings`
  - `/app/profile`
  - `/app/profile/preferences`
- Keep the pages mock-data driven for now. Do not duplicate the old monolithic mock into a second route.
- Login and sign-up are the only auth pages that should have separate implementations for now:
  - `/auth/login`
  - `/auth/sign-up`
- Logout lives in the private app header and uses a Supabase Server Action.
- Supabase Auth is already wired through `@supabase/ssr`, cookies, `proxy.ts`, and `/auth/callback`.
- Promotions are out of scope for now. Do not add promotions pages, API routes, or UI until the team reopens that feature.

## Page implementation status

Use this list as the source of truth when replacing mock pages with functional pages. When a route stops being mock-data driven, update its status in the same change.

### Functional

- `/`: session-based redirect to `/app` or `/auth/login`.
- `/auth/login`: functional Supabase email/password login.
- `/auth/sign-up`: functional Supabase email/password signup.
- `/auth/callback`: functional Supabase auth-code exchange.
- `/app/layout.tsx`: functional private shell; protects `/app/...` routes and provides logout.
- `/app`: functional Supabase-backed private home/dashboard cards.
- `/app/trips`: functional Supabase-backed trip list.
- `/app/trips/[tripId]`: functional Supabase-backed trip summary.
- `/app/trips/[tripId]/itinerary`: functional Supabase-backed itinerary and map.
- `/app/trips/[tripId]/itinerary/[dayNumber]`: functional day detail.
- `/app/onboarding`: functional required preferences onboarding.
- `/app/profile/preferences`: functional saved preferences editor.
- `POST /api/trips/[tripId]/place-catalog`: functional one-shot destination and place catalog generation.

### Mocked

- `/app/trips/new/destination`: mocked destination and date selection.
- `/app/trips/new/places`: mocked wishlist, suggestions, and activity ordering.
- `/app/trips/new/preferences`: mocked trip preference selection.
- `/app/trips/new/generating`: mocked AI generation progress.
- `/app/trips/[tripId]/travel`: mocked travel mode and replanning actions.
- `/app/trips/[tripId]/settings`: mocked trip settings.
- `/app/profile`: partially functional session read and saved preferences summary.

## Internal Handlers & APIs

### Places & Destination Logic (`lib/places/`)

- **`google.ts`**: Core wrapper for Google Places API (New).
  - `searchPlaces({ query, latBias, lngBias })`: Returns `PlaceCandidate[]`. Mocked if API key is missing.
  - `resolveDestination(query)`: Resolves destination name to coordinates and administrative metadata.
- **`generatePlaces(input)`**: Higher-level AI orchestrator. Uses Claude to curate 15-25 places matching user preferences and destination context.

### Reusable API Endpoints

- **`POST /api/trips/[tripId]/place-catalog`**:
  - Populates a trip with its destination and a full curated place catalog in one call.
  - Automatically fetches user preferences and resolves coordinates.
  - Verification: `npx tsx scripts/verify-catalog-loop.ts <trip_id>`

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4, Vanilla CSS
- **Components**: Shadcn UI, Base UI, Lucide Icons
- **Backend**: Supabase (PostgreSQL, Auth, SSR)
- **AI**: Anthropic SDK (Claude models)

## Agent Guidelines

- **Skills**: This project uses specialized skills in `.agents/skills/`. Activate relevant skills before starting tasks (e.g., `activate_skill("supabase")`).
- **Memory**: 
  - Gemini: Use the private memory folder for local notes.
  - Claude: Use `.claude/` for internal state.
- **Workflow**: 
  - Always research the current implementation status before starting.
  - For new features, update the "Page implementation status" in this file.
  - Follow the Plan -> Act -> Validate cycle.
  - Verify changes by running `npm run lint` and relevant tests.
