# Engineering Intelligence Atlas web application

This folder contains the React/TypeScript atlas and the Hono/tRPC Research Director
server. The atlas is usable without an account. Director projects, credentials,
provider runs, database persistence and artifact storage require the separate
configured server runtime. GitHub Pages publishes only the static atlas.

## Requirements

Use Node.js 22.12 or later and npm. Dependency versions are resolved by
`package-lock.json`; use `npm ci` for reproducible installs. No API key, database
or `.env` file is required to build the atlas or run the default test suite.

From this directory:

```bash
npm ci
npm run check
npm run check:migrations
npm run build
npm test
```

`build` produces the portable frontend in `dist/public/` and a self-contained
server entry at `dist/boot.js`. Run the build before the deployment tests: they
check the actual emitted files and boot an isolated unauthenticated test server.

## Static atlas and GitHub Pages

From the repository root:

```bash
npm --prefix site-source ci
node scripts/build-static.mjs
node scripts/check-static.mjs
```

The build uses Vite's `static` mode, relative asset URLs and hash routes. The same
client files work at the GitHub Pages project subpath and inside the desktop and
Android shells. The publication script copies only `dist/public/` into `docs/`;
it never publishes `dist/boot.js`, `.env` or server credentials. `docs/build-info.json`
records the source-content digest and SHA-256 digest of every published file.
The integrity command rejects stale source or modified/missing output assets.

Preview the static experience locally with `npm run dev:static`. The Pages
workflow rebuilds from source, checks the TypeScript and migration contracts,
and runs the browser smoke before deployment. Editing `docs/assets/` directly
is not a supported source workflow.

For the browser smoke, install a compatible browser once:

```bash
npx playwright install chromium
npm run test:static
```

`test:static` serves `docs/` under the real project subpath and checks atlas routes
at desktop/mobile widths plus an offline reload. Set `CHROMIUM_PATH` to use an
existing compatible Chromium binary. A failure to launch the browser is a test
environment failure, not a passing UI check.

## Dynamic Director runtime

Copy `.env.example` to `.env` and fill the required values using services you
control. Keep the file local. The current auth and storage adapters target the
Kimi hosting platform; this repository does not provision that platform or
publish a configured Director server automatically.

| Configuration | Purpose |
| --- | --- |
| `APP_ID`, `APP_SECRET` | Application identity and session signing |
| `DATABASE_URL` | MySQL-compatible database connection |
| `KIMI_AUTH_URL`, `KIMI_OPEN_URL` | The provisioned OAuth and user-profile endpoints |
| `OWNER_UNION_ID` | Optional administrator identity |
| `INTEGRATION_ENCRYPTION_KEY` | 64 hex characters for the owner-scoped credential vault |
| `KIMI_AGENTGW_BASE_URL`, `KIMI_AGENTGW_API_KEY` | Optional platform model gateway |
| `KIMI_STORAGE_RESOURCE_ID` | Provisioned platform artifact storage, with the gateway pair |
| `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` | Optional server-level provider credentials; owners can also use the vault |
| `PORT` | HTTP listen port, default `3000` |

Do not expose secrets through `VITE_` variables. Provider usage and hosted storage
may incur charges. The default tests never enable live model or storage operations.

After provisioning a **fresh, isolated database**, review [database setup](db/README.md),
then run:

```bash
npm run db:migrate
npm run db:seed
npm run build
npm start
```

The seed reads the repository's `../skills/` directory and inventories the 15
curated skills without executing their code. `SKILL_SEED_ROOT` can override that
source directory. Development with a configured backend uses `npm run dev`.
Do not run `db:push` as an upgrade procedure on an existing database; review
versioned migrations instead.

## Verification levels

### Prompt context and cost accounting

The Director now compiles a stable, versioned skill prefix and caches that string
in a bounded process-local LRU (128 entries, 2 MiB, five-minute expiration).
Keys include owner, provider, model, skill version/hash and actual source content.
Task goals and provider outputs are not in that cache. Accepted upstream artifacts
are selected by artifact edges in SQL and sent as IDs, complete hashes and compact
summaries. Skills above 16,000 characters or handoffs above 24,000 characters fail
explicitly; no source is silently truncated.

Optional provider-side caching is separate. Configure the actual input/output and
cache read/write rates for your chosen model using owner pricing or the variables
in `.env.example`. Anthropic receives a breakpoint on the stable system prefix.
OpenAI receives an owner-scoped key; explicit breakpoints require the exact model
ID in `OPENAI_EXPLICIT_CACHE_MODELS`. The server does not prewarm caches, force a
longer retention period, assume a hit, or replay a prior generated answer.

Usage events distinguish reported input/output, cache reads/writes, and unknown
usage. Cache categories are not added twice to the SDK's total input. With complete
categories, the engine applies each configured rate once. With requested caching
but incomplete categories, it uses the highest configured input rate. Missing
usage or a reported cache category without a price preserves the generated
artifact, leaves it unaccepted, and stops further dispatch for review. Numeric
zero placeholders in that failed run's ledger are not evidence of a free call.
These configured-rate estimates are not final provider invoices.

The web scheduler remains a single-process document workflow. Multi-replica leases,
durable job delivery and provider-call reconciliation are a separate next step;
the desktop Office worker has its own native control plane. See
[backend architecture and evidence](../project/BACKEND_RESEARCH.md).

### Test commands

| Command/configuration | What it proves |
| --- | --- |
| `npm run check` | Web, server and configuration TypeScript contracts compile |
| `npm run check:migrations` | SQL files, journal, snapshots and schema agree; no DB connection |
| `npm test` | Offline engine, connector, vault, provider-mock and emitted-server checks; integration tests report explicit skips |
| `RUN_DATABASE_TESTS=1` | Opts into DB-backed tests using the configured isolated database |
| `RUN_STORAGE_TESTS=1` | Opts into real object uploads/readback/deletes; requires provisioned storage |
| `RUN_LIVE_AI_TESTS=1` | Opts into real gateway discovery and one billed generation smoke |
| `npm run test:static` | Pages subpath, responsive route loading and service-worker offline reload |

The full project-lifecycle integration suite needs **both** database and storage
opt-ins. The GitHub CI MySQL job runs connector ownership/scoping against a
disposable MySQL service with provider requests mocked; it does not use live AI
or hosted storage. Once explicitly enabled, a missing service is a failure,
not a successful fake check.

For the original dynamic-runtime browser checks, run a configured local server
and use `BASE_URL=http://127.0.0.1:3000 npm run test:browser`. Those checks include
Director sign-in/degraded states and should not be confused with static Pages
validation.

## Repository layout

- `src/`: public atlas and authenticated Director views.
- `api/`: server routes, orchestration, provider adapters, vault and connectors.
- `contracts/`: shared DAG, skill, run, integration and artifact contracts.
- `db/`: schema, committed migrations and registry seed.
- `public/research/`: downloadable science reports, charters and reviewed skills.
- `scripts/`: data generation and dynamic-runtime browser checks.

Root release/status documents describe the current roadmap. Historical research
reports contain older design checkpoints; their completion claims are not a
replacement for test evidence on the current revision.
