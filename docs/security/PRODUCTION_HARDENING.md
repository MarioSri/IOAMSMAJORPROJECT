# Production Hardening Changelog

## Implemented controls

The backend uses one canonical Supabase-backed authentication middleware. The predictable `your-secret-key` fallback and local JWT issuance path were removed. Signup and password sign-in use Supabase Auth, and production startup validates the server-side Supabase configuration.

The Resend webhook fails closed when its secret is missing, captures the exact raw request body before JSON parsing, verifies Svix headers and signatures, rejects malformed requests, and avoids logging the complete event payload. Production startup requires `RESEND_WEBHOOK_SECRET`.

The duplicate Supabase authentication module exposes compatibility aliases to the canonical middleware rather than maintaining a second token-validation implementation. Environment examples document the publishable key, server-only secret, JWKS URL, and webhook secret without including real credentials.

Backend validation is discoverable through package scripts for typechecking, linting, building, and testing. A GitHub Actions workflow runs frontend and backend linting, tests, builds, and dependency-audit reporting. Backend tests cover authentication input handling, webhook security failure cases, and the summarizer route’s authentication boundary.

The external summarizer benchmark is `backend/tests/summarizer.integration.test.ts` and runs only through a dedicated Jest integration configuration. The default backend test gate no longer invokes live API, authentication, model, or external-provider dependencies. The root `test:integration` command delegates correctly to the backend suite, and an explicit preflight requires `RUN_INTEGRATION_TESTS=true`, `API_URL`, `TEST_AUTH_TOKEN`, and at least one model-provider key before the integration suite can start.

The browser spreadsheet parser was migrated from the vulnerable and unmaintained `xlsx` dependency to the read-only `read-excel-file` package. Both document viewing and AI summarization now impose a strict 10 MB spreadsheet parsing limit, escape generated HTML cells, and no longer import `xlsx`. The Vite manual chunk configuration was updated accordingly.

The dependency remediation pass removed unused `@sigstore/bundle`, `@sigstore/sign`, and `onnxruntime-node` packages, upgraded Multer to 2.2.0, upgraded node-cron to 4.6.0, upgraded tsx to 4.23.12 so its esbuild chain is patched, upgraded React Router to 7.18.2, upgraded the Vite toolchain to Vite 6.4.3 with the compatible React SWC plugin and Lovable tagger releases, and refreshed transitive dependencies through non-breaking audit fixes.

The existing handwritten-signature upload renderer was hardened in place without adding UI. It now enforces a 12 MB browser upload limit and a 12-million-pixel/6,000-pixel-side processing limit, applies local-contrast ink extraction, deterministic texture jitter, connected-component cleanup, transparent cropping, high-quality resampling, and automatic orientation for sideways portrait captures. It preserves the existing upload, preview, placement, and confirmation components and reports invalid or failed uploads through the existing toast surface.

The responsive pass preserves the current IAOMS screens while improving their layout behavior. The shared shell now contains flex children with `min-width: 0`, the dashboard header uses bounded search/profile sizing, search results respect dynamic viewport height, the tutorial card centers and scrolls safely on narrow screens, and document pages no longer force global `min-w-max` overflow. Spreadsheet content remains horizontally scrollable inside its own bounded viewer surface, while mobile content retains safe-area padding and touch-friendly controls.

## Verification completed

| Check | Result |
|---|---|
| Frontend lint | Passed with 0 errors; warnings remain visible |
| Frontend build | Passed with Vite 6.4.3 toolchain |
| Frontend tests | Passed |
| Backend lint | Passed with 166 warnings and 0 errors |
| Backend TypeScript build | Passed |
| Backend tests | Passed: 3 suites, 7 tests |
| Spreadsheet source scan | No remaining `xlsx` imports in maintained frontend source |
| Diff whitespace check | Passed |
| Predictable JWT fallback scan | No remaining matches in `backend/src` |
| Environment files tracked by Git | No |
| Frontend dependency audit | Passed: 0 vulnerabilities |
| Backend dependency audit | Passed: 0 vulnerabilities |
| Integration preflight | Correctly guarded and fails fast when external configuration is absent |
| Browser application smoke test | Existing IAOMS login UI loaded with 0 page errors |
| Browser signature smoke test | Supplied 1,204 × 1,600 photo produced non-empty transparent output at 715 × 583 with 13,257 alpha pixels |
| Desktop viewport check | Passed at 1,280 × 900; existing IAOMS screen loaded with 0 page errors |
| Tablet viewport check | Passed at 834 × 1,112; existing IAOMS controls remained visible and contained |
| Mobile viewport check | Passed at 390 × 844; document width equaled viewport width and `overflow-x` was hidden |

## Remaining risks

The lint commands now exit successfully, but warnings remain substantial: 406 on the frontend and 166 on the backend. The most common warning is `no-explicit-any`. These warnings are visible rather than hidden and should continue to be reduced through typed API contracts, generated Supabase types, and gradual strict-mode adoption. Selected legacy migration rules remain warnings so the CI gate can run while the debt is retired; new correctness regressions should not be added.

The 19 GitHub Dependabot alerts were remediated in the local dependency graphs without forced audit upgrades. Multer DoS advisories were addressed by moving to Multer 2.2.0; Vite, React Router, brace-expansion, esbuild, uuid, and the Sigstore/adm-zip paths were resolved through compatible upgrades or removal of unused direct packages. Both npm audit commands now report zero vulnerabilities. The browser-used spreadsheet package remains on the maintained `read-excel-file` parser, removing its prior no-fix advisory.

The summarizer integration suite is explicit but still requires a running API, valid authentication token, configured external model services, and provider credentials. It is intentionally not included in the deterministic default gate and must run in a separately provisioned integration environment.

The codebase is now **materially hardened and verifiable in its highest-risk backend, dependency, and document-processing areas**, including the existing handwritten-signature upload path. It should not yet be described as fully production-ready until warning debt is reduced, visual acceptance is completed against representative documents, and the external summarizer integration suite completes in a provisioned environment.
