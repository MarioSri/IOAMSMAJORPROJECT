# IAOMS Documentation

This directory contains the maintained IAOMS documentation, organized by the purpose of each document rather than by the historical location of the file.

## Documentation categories

| Category | Purpose |
|---|---|
| [Architecture](./architecture/) | System architecture, migrations, and cross-cutting technical decisions. |
| [Backend](./backend/) | Backend-specific orientation and service documentation. |
| [Deployment](./deployment/) | Production deployment, hosting, domain, and release checklists. |
| [Development](./development/) | Internal development conventions and maintenance notes. |
| [Features](./features/) | Feature documentation grouped by product area. |
| [Guides](./guides/) | Practical user, developer, and testing procedures. |
| [Performance](./performance/) | Performance investigations, optimizations, testing, and validation. |
| [Project](./project/) | Project status, changelog, implementation summaries, and completion reports. |
| [QA](./qa/) | Verification checklists and validation results. |
| [Security](./security/) | Production hardening, security controls, and Rekor monitoring. |
| [Setup](./setup/) | Local development, backend setup, authentication, and integration configuration. |
| [Troubleshooting](./troubleshooting/) | Diagnostics, fixes, and issue-resolution guidance. |
| [Archive](./archive/) | Historical or deprecated material retained for reference. |

## Feature areas

Feature-specific documentation is grouped below `features/`. Current areas include approvals, chat, documents, emergency contacts, file viewing, live meetings, notifications, PDF handling, recipients, search, signatures, SmartDocs, watermarking, and workflow.

## Contribution rule

New Markdown files should be placed in the narrowest applicable category. Feature documentation belongs under `docs/features/<area>/`; operational procedures belong under `docs/guides/`, `docs/setup/`, `docs/deployment/`, or `docs/troubleshooting/`; engineering conventions belong under `docs/development/`; and historical completion or migration notes belong under `docs/project/`, `docs/architecture/`, or `docs/archive/` as appropriate.

When moving a document, update relative Markdown links in the same change and run the repository documentation-link validation before committing.
