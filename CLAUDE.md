@AGENTS.md

## Supabase types
- `lib/supabase/database.types.ts` may be stale. Use `any` casts for table queries not in the generated types, or regenerate with `npx supabase gen types typescript --project-id <id>`.

## Itinerary solver
- Pure solver: `lib/itinerary/solver.ts` — `solve(input: SolverInput): SolverResult`.
- Supabase integration: `lib/itinerary/generate.ts` — `generateItinerary(tripId, placeIds, config?)`.
- API routes: `POST /api/itinerary/generate` (production), `POST /api/itinerary/test-generate` (seeds + runs), `POST /api/itinerary/mock-generate` (no auth, no DB — uses mock data for solver iteration).
- Mock data: `lib/itinerary/mock-data.ts` — Madrid (12 places) and Paris (13 places) with real coordinates. `mock-generate` accepts optional `{ placeIds?, city?, startsOn?, endsOn?, config? }`.
- Meal places are identified by `category` column in `places` table (categories containing "restaurante", "café", "cafetería", "bar", "gastro").
- The solver is exponential: O(d^n × n!) where d=days and n=places per day. Keep test inputs small (≤4 places for fast tests, ≤7 for stress tests).

## Testing
- Framework: Jest + ts-jest. Config: `jest.config.ts`. Path alias `@/*` mapped via `moduleNameMapper`.
- `npm test` — fast integration tests only (~0.5s). Ignores stress tests.
- `npm run test:stress` — larger inputs with real mock data (~5s). Uses `--testTimeout=60000`.
- Test files:
  - `lib/itinerary/solver.integration.test.ts` — 8 tests with small inputs (≤4 places, ≤2 days).
  - `lib/itinerary/solver.stress.test.ts` — 3 tests with Madrid/Paris mock data (6-7 places, 2-3 days).
  - `lib/itinerary/solver.manual-test.ts` — legacy standalone script (run with `npx tsx`, not Jest).
- Jest CLI: use `--testPathPatterns` (not the deprecated `--testPathPattern`).

## Environment
- Supabase project (`ncgrbcpgmhjhmkqlcsjm`) is not accessible via MCP `list_projects`. Test DB writes through the running Next.js server with authenticated cookies.
- Dev server: `npx next dev --port 3000`. Test authenticated endpoints by logging in at `/auth/login` first.
- First request after `next dev` starts takes ~60-90s to compile (slow filesystem). Wait for the `Compiled` log line before sending requests.
