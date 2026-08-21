# IAOMS

IAOMS is a React and TypeScript institutional activity oversight system for managing permission reports, letters, circulars, approvals, meetings, notifications, and document workflows at HITAM. It uses Supabase for identity, persistence, storage, and realtime data, with an Express backend for privileged operations and integrations. It is not a standalone offline application: it requires a configured Supabase project and, for selected features, external provider credentials.

## Features

- **Document management.** `src/services/DocumentService.ts` and `backend/src/controllers/documentController.ts` handle document creation, tracking, workflow state, archival, and file metadata.
- **Approval workflows.** Workflow components under `src/components/workflow/` coordinate multi-step approvals, escalation state, signatures, and role-aware actions.
- **Authentication and authorization.** `src/contexts/AuthContext.tsx` provides Google and employee-ID sign-in flows, while `backend/src/middleware/auth.ts` validates Supabase access tokens and maps canonical roles.
- **Realtime operations.** Supabase realtime subscriptions in the service and hook layers keep documents, notifications, emergency events, meetings, and workflow state synchronized.
- **Meetings and collaboration.** Components under `src/components/meetings/` support scheduling, live meeting requests, calendar integration, and chat-related workflows.
- **AI-assisted document summarization.** `backend/src/controllers/summarizeController.ts` provides provider fallback logic; the browser performs bounded PDF, Word, and spreadsheet extraction before submission.
- **Production hardening.** `backend/src/controllers/resendController.ts` verifies signed webhook payloads, and `backend/src/config/supabase.ts` fails closed when required server configuration is absent.

The implementation favors explicit service boundaries and Supabase-backed state over hidden local credentials or predictable application-issued tokens.

## Documentation and database assets

The complete documentation index is available in [`docs/README.md`](docs/README.md). Supabase migrations and manual database operations are separated under [`supabase/README.md`](supabase/README.md); only reviewed timestamped files in `supabase/migrations/` belong in the deployment migration path.

## What it does

The frontend presents a login surface, dashboard, document tracker, approval interfaces, notification center, emergency workflows, meeting tools, and administrative views. API calls are routed through Vite’s `/api` proxy during development and through the configured deployment boundary in production.

The backend exposes Express routes for authentication, documents, workflows, notifications, meetings, files, summarization, webhooks, WebAuthn, and operational verification. OpenAPI documentation is available from the running backend at `/api-docs`.

Spreadsheet files are read through the maintained `read-excel-file` package. Browser-side spreadsheet parsing is capped at 10 MB, and generated table cells are HTML-escaped before display. The backend upload route also applies explicit multipart size limits.

## How it works

1. **Identity.** The frontend authenticates through Supabase Auth. Protected backend routes validate the bearer token against Supabase’s JWKS and derive the user identity and role from verified claims.
2. **Application state.** Services in `src/services/` read and write Supabase tables and storage. Realtime channels trigger focused refetches rather than maintaining a second authoritative local database.
3. **Privileged operations.** The Express backend uses the server-only Supabase service key for operations that must not run in the browser. Webhook handlers verify authenticity before parsing or acting on event data.
4. **Document processing.** Browser extraction handles display and optional pre-extracted text. The summarizer backend validates the authenticated request and delegates to configured external providers with fallback behavior.

Decisions worth calling out:

- **Fail-closed authentication.** The backend has no predictable local JWT fallback; a missing or invalid Supabase configuration is an operational error rather than an authorization bypass.
- **Raw-body webhook verification.** Resend signatures are checked against the exact request bytes before JSON parsing, preventing formatting changes from invalidating or bypassing verification.
- **Bounded browser parsing.** Spreadsheet parsing is limited to 10 MB and uses a read-only parser, reducing exposure to oversized or hostile client-provided workbooks.
- **User-scoped caches.** Document cache keys include the authenticated user ID so an account switch cannot display another user’s cached cards.

## Running it locally

```bash
npm install
npm install --prefix backend
npm run dev
```

The frontend runs on `http://localhost:5173` and the backend on `http://localhost:3001` by default. The combined development command starts both processes.

Useful commands:

```bash
npm run build              # frontend production build
npm test -- --run          # frontend tests
npm run lint               # frontend lint
npm run build:backend      # backend TypeScript build
npm run test:backend       # deterministic backend tests
npm run lint:backend       # backend lint
npm run test:integration   # opt-in external summarizer suite
npm run validate           # build and deterministic validation suite
```

Create `.env` and `backend/.env` from the corresponding example files. The frontend requires the public Supabase URL and publishable key. The backend requires the Supabase URL, publishable key, server-only service key, JWKS URL, WebAuthn settings, and any provider secrets for enabled integrations. Never commit either environment file.

## Project structure

```text
src/
├── components/             # application screens and reusable UI
├── contexts/               # authentication and application context
├── hooks/                  # reusable state and realtime behavior
├── lib/                    # frontend clients and low-level helpers
├── services/               # Supabase and external-service boundaries
└── tests/                  # frontend tests
backend/
├── src/config/             # validated server configuration
├── src/controllers/        # HTTP request handlers
├── src/middleware/         # authentication and request middleware
├── src/routes/             # Express route composition
├── src/services/           # server-side integrations and domain services
└── tests/                  # deterministic and opt-in integration tests
.github/workflows/          # continuous integration quality checks
```

## Scope and limitations

IAOMS is an institutional workflow application, not a general-purpose document-management platform or a replacement for an organization’s identity, records-retention, or compliance systems. It assumes a Supabase project, configured database policies, and correctly provisioned external integrations. The summarizer integration suite requires a running API, a valid test token, and provider credentials; it is intentionally separate from the deterministic test gate. The application surface is broad, but deployment-specific policy, data migration, observability, and provider contracts still require environment-level validation.

## Security

No live secrets, API keys, private keys, or committed environment files belong in this repository. Public Supabase configuration is supplied through environment variables, while server-only keys remain in the backend environment and are never sent to the browser. Authentication uses verified Supabase tokens, webhook requests require signature validation, uploads have size limits, and spreadsheet content is escaped before rendering.

Review `backend/.env.example` and `.env.example` before deployment. Rotate any credential that has ever been exposed outside an ignored environment file. Run the dependency audit and deterministic validation commands before release; remaining advisory findings and lint warnings must be triaged rather than hidden.

## Contributing

Keep changes scoped to a service or feature boundary, add a deterministic regression test for security-sensitive behavior, and run the frontend and backend build, lint, and test commands before opening a pull request. External-provider checks belong in the explicit integration suite and must not make the default test gate nondeterministic.

## License

MIT. See [LICENSE](LICENSE).
