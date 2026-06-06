<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Windows development rules

This repository is developed on Windows with PowerShell. Follow these rules to avoid known environment-specific failures:

- Run package scripts with `npm.cmd`, not `npm`. PowerShell may block `npm.ps1` when script execution is disabled. Examples: `npm.cmd run lint`, `npm.cmd run build`, and `npm.cmd run dev`.
- Use `-LiteralPath` when reading or operating on Next.js dynamic-route files such as `app/app/trips/[tripId]/page.tsx`. PowerShell treats square brackets in `-Path` values as wildcard expressions.
- Explicitly use UTF-8 when reading text in PowerShell: `Get-Content -LiteralPath <file> -Encoding UTF8`. Do not diagnose mojibake from default PowerShell output alone; verify the file with explicit UTF-8 decoding before editing.
- Use `apply_patch` for source edits. Do not rewrite UTF-8 source files through PowerShell pipelines or default-encoding output commands, because these can corrupt Spanish characters such as `í`, `ó`, and `·`.
- Prefer `rg` for searches. Quote paths and patterns when they contain brackets, parentheses, pipes, or other PowerShell metacharacters.
- In PowerShell, assign `foreach` output to a variable before piping it. Use `$results = foreach (...) { ... }; $results | ConvertTo-Json` instead of piping directly from a `foreach` statement.
- If the Node REPL or in-app browser fails with `windows sandbox failed: spawn setup refresh`, treat it as a tooling sandbox failure, not an application failure. Continue with shell-based checks where possible and report that visual browser verification could not run.
- Before starting another development server, inspect the existing process or port. Next.js may already be running and a second `next dev` will fail due to the occupied port or development lock.
- Public Supabase URL and publishable keys cannot apply migrations, seed `auth.users`, generate remote types, or run database advisors. Those operations require an authenticated Supabase MCP/CLI session, a database connection, or manual execution in the Supabase SQL Editor.

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
- `/app/trips/[tripId]`: functional Supabase-backed trip summary.
- `/app/trips/[tripId]/itinerary`: functional Supabase-backed itinerary and map.
- `/app/trips/[tripId]/itinerary/[dayNumber]`: functional day detail.

### Mocked

- `/app`: mocked private home/dashboard cards.
- `/app/trips`: mocked trip list.
- `/app/trips/new/destination`: mocked destination and date selection.
- `/app/trips/new/places`: mocked wishlist, suggestions, and activity ordering.
- `/app/trips/new/preferences`: mocked trip preference selection.
- `/app/trips/new/generating`: mocked AI generation progress.
- `/app/trips/[tripId]/travel`: mocked travel mode and replanning actions.
- `/app/trips/[tripId]/settings`: mocked trip settings.
- `/app/profile`: partially functional session read, mocked profile data beyond email/id.
- `/app/profile/preferences`: mocked saved preferences.
