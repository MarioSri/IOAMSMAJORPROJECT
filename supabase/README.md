# Supabase Database Assets

This directory is the source of truth for IAOMS database changes.

## Directory contract

| Directory | Purpose | Publication behavior |
|---|---|---|
| `migrations/` | Timestamped, idempotent schema and security changes | Eligible for the approved migration pipeline only |
| `operations/` | Manual diagnostics, verification queries, and one-time operational SQL | Never auto-applied; review before running in production |
| `config.toml` | Local Supabase CLI configuration | Used by local development tooling |

The files in `migrations/` are ordered by their timestamp prefix. A migration must be safe to run once through the project migration workflow and must not contain destructive changes without an explicit rollback and data-preservation plan.

The files in `operations/` are intentionally separate from deployable migrations. They may contain diagnostic queries, verification placeholders, or environment-specific remediation instructions. Run them only after confirming the target project ID and reviewing the query in the Supabase SQL Editor.

## Production workflow

The repository migration history and the live Supabase migration history must be reconciled before publication. Do not execute every historical SQL file in this directory against production. Use the canonical migration chain, verify the target project identifier, refresh generated types after schema changes, and run the application contract tests before publishing.

Saved SQL Editor snippets are not an alternative migration system. If a schema change is needed, create a reviewed timestamped migration here first, then use the SQL Editor only for controlled application and verification.

## Naming rules

Deployable migrations use `YYYYMMDD_description.sql`. Operational scripts use an uppercase action-oriented name only when they are manual procedures, such as `VERIFY_OPTIMIZATION.sql` or `DEPLOY_LIVEMEET_RLS_FIX.sql`. New operational scripts should include a target scope, safety note, and expected result in their header.

The canonical IAOMS schema map is documented in [`../docs/database/SCHEMA_ORGANIZATION.md`](../docs/database/SCHEMA_ORGANIZATION.md).
