# Diagnostics

This directory contains read-only or inspection-oriented utilities for checking local application and Supabase state.

| File | Purpose |
|---|---|
| `check_db.js` | Inspect database connectivity or schema signals used during development |
| `test-schema.ts` | Check the application’s schema assumptions during local development |

These utilities are not part of the production application bundle. Confirm the target environment and credentials before execution.
