# Repository Scripts

The repository keeps executable utilities grouped by purpose. Root-level startup files remain in place because they are user-facing launch entry points referenced by the existing setup documentation.

| Directory | Purpose |
|---|---|
| `diagnostics/` | Read-only database and schema inspection utilities |
| `maintenance/` | Manual cleanup, repair, migration-support, and data-maintenance utilities |
| `debug/` | Local debugging pages and development inspection tools |
| `test/` | Manual browser probes and integration-oriented verification scripts |
| `startup/` | Reserved for future startup helpers; current root launchers remain compatible entry points |

Utilities in `diagnostics/` and `maintenance/` may require local environment variables or a configured backend. Review each file before running it against a shared or production environment.
