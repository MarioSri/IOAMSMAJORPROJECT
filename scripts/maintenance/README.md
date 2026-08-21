# Maintenance Utilities

This directory contains manual utilities that change local browser state, repair development data, or support one-time maintenance tasks.

| File | Purpose |
|---|---|
| `clear-storage.js` | Clear local application storage during troubleshooting |
| `fix-push-keys.ts` | Repair or inspect web-push key configuration |
| `fix_db_columns.js` | Support database-column repair during development |
| `remove_demo.cjs` | Remove legacy demo artifacts |
| `remove_demo_checks.ps1` | Verify demo-artifact removal on Windows |

These utilities are intentionally excluded from the normal build and deployment path. Review their source and target environment before running them, and prefer a reviewed Supabase migration for durable production schema changes.
