# Production Hardening Changelog

## Implemented controls

The backend uses one canonical Supabase-backed authentication middleware. The predictable `your-secret-key` fallback and local JWT issuance path were removed. Signup and password sign-in use Supabase Auth, and production startup validates the server-side Supabase configuration.

The Resend webhook fails closed when its secret is missing, captures the exact raw request body before JSON parsing, verifies Svix headers and signatures, rejects malformed requests, and avoids logging the complete event payload. Production startup requires `RESEND_WEBHOOK_SECRET`.

The duplicate Supabase authentication module exposes compatibility aliases to the canonical middleware rather than maintaining a second token-validation implementation. Environment examples document the publishable key, server-only secret, JWKS URL, and webhook secret without including real credentials.

Backend validation is discoverable through package scripts for typechecking, linting, building, and testing. A GitHub Actions workflow runs frontend and backend linting, tests, builds, and dependency-audit reporting. Backend tests cover authentication input handling, webhook security failure cases, and the summarizer route’s authentication boundary.

The external summarizer benchmark is `backend/tests/summarizer.integration.test.ts` and runs only through a dedicated Jest integration configuration. The default backend test gate no longer invokes live API, authentication, model, or external-provider dependencies. The root `test:integration` command delegates correctly to the backend suite, and an explicit preflight requires `RUN_INTEGRATION_TESTS=true`, `API_URL`, `TEST_AUTH_TOKEN`, and at least one model-provider key before the integration suite can start.

The browser spreadsheet parser was migrated from the vulnerable and unmaintained `xlsx` dependency to the read-only `read-excel-file` package. Both document viewing and AI summarization now impose a strict 10 MB spreadsheet parsing limit, escape generated HTML cells, and no longer import `xlsx`. The Vite manual chunk configuration was updated accordingly.

The safe remediation pass removed the unused `claude-mem` package, upgraded Vitest to 4.1.11, upgraded Fabric to 7.4.0, and upgraded backend Nodemailer to 9.0.5. Vite 8 was evaluated but reverted because it broke the existing application build; the compatible Vite 5 toolchain remains in place pending a separately planned migration.

## Verification completed

| Check | Result |
|---|---|
| Frontend lint | Passed with 406 warnings and 0 errors |
| Frontend build | Passed with compatible Vite 5 toolchain |
| Frontend tests | Passed |
| Backend lint | Passed with 166 warnings and 0 errors |
| Backend TypeScript build | Passed |
| Backend tests | Passed: 3 suites, 7 tests |
| Spreadsheet source scan | No remaining `xlsx` imports in maintained frontend source |
| Diff whitespace check | Passed |
| Predictable JWT fallback scan | No remaining matches in `backend/src` |
| Environment files tracked by Git | No |
| Frontend dependency audit | Improved to 7 findings: 0 critical, 2 high, 5 moderate |
| Backend dependency audit | Improved to 7 findings: 0 critical, 2 high, 4 moderate, 1 low |
| Integration preflight | Correctly guarded and fails fast when external configuration is absent |

## Remaining risks

The lint commands now exit successfully, but warnings remain substantial: 406 on the frontend and 166 on the backend. The most common warning is `no-explicit-any`. These warnings are visible rather than hidden and should continue to be reduced through typed API contracts, generated Supabase types, and gradual strict-mode adoption. Selected legacy migration rules remain warnings so the CI gate can run while the debt is retired; new correctness regressions should not be added.

The remaining frontend dependency advisories include a Vite path requiring a major-version migration and a transitive `brace-expansion` advisory. The backend retains an `onnxruntime-node`/`adm-zip` advisory path and moderate findings. These require focused replacement or major-upgrade plans. Forced upgrades were not used because they would introduce unverified breaking changes. The browser-used spreadsheet package has now been replaced, removing its prior no-fix advisory from the dependency audit.

The summarizer integration suite is explicit but still requires a running API, valid authentication token, configured external model services, and provider credentials. It is intentionally not included in the deterministic default gate and must run in a separately provisioned integration environment.

The codebase is now **materially hardened and verifiable in its highest-risk backend and document-processing areas**, but it should not yet be described as fully production-ready until the remaining high dependency paths are resolved, warning debt is reduced, the Vite migration is evaluated, and the external summarizer integration suite completes in a provisioned environment.
