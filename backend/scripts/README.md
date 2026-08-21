# Backend Scripts

Backend helper utilities are grouped by operational purpose and are not loaded by the Express application at runtime.

| Directory | Purpose |
|---|---|
| `diagnostics/` | Read-only checks for users, notifications, and device records |
| `maintenance/` | Manual table setup, column repair, migration execution, email testing, and DNS guidance |

The backend’s `.env`, package manifests, TypeScript configuration, ESLint configuration, Jest configuration, and `start.bat` remain at the backend root because they are package and runtime entry-point files. Maintenance utilities may require the backend environment and service-role access; review them before execution against shared or production data.
