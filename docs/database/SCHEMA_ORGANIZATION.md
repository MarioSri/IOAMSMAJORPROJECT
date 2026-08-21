# IAOMS database organization

## Purpose

IAOMS uses a **minimal-change, migration-first database strategy**. Existing application tables and RPC signatures remain intact so the web publication does not fail because of missing tables or renamed columns. Historical SQL editor scripts are retained for auditability, while new database changes must be added as one timestamped migration under `supabase/migrations/`.

The canonical cleanup migration is:

`supabase/migrations/20260821_consolidate_schema_and_rls.sql`

The internal RPC hardening follow-up is:

`supabase/migrations/20260821_harden_internal_rpc_execution.sql`

Both migrations were applied successfully to Supabase project `lyyuslwdibcscpdfzeww` through the migration path. They do not drop tables, columns, or application data.

## Live table domains

The production schema currently contains 36 public application tables. The table names below are grouped by responsibility rather than duplicated by feature.

| Domain | Canonical tables | Responsibility |
|---|---|---|
| Identity and access | `role_recipients`, `user_devices`, `user_notification_preferences`, `user_activity` | User directory, device registration, notification preferences, and activity events |
| Authentication security | `auth_challenges`, `user_credentials`, `recovery_codes`, `webauthn_audit_log` | Passkeys, recovery codes, authentication challenges, and audit records |
| Documents and approvals | `documents`, `document_files`, `document_workflows`, `workflow_steps`, `document_approvals`, `approval_comments`, `document_comments` | Document lifecycle, workflow state, approval actions, comments, and file metadata |
| Notifications | `notifications` | User notifications, delivery status, retry tracking, and document links |
| Collaboration | `chat_channels`, `chat_messages` | Document, department, and emergency communication |
| Meetings | `meetings`, `meeting_sessions`, `meeting_participants`, `live_meeting_requests` | Calendar meetings, live sessions, participants, and meeting requests |
| Emergency workflows | `emergency_documents`, `emergency_contacts`, `emergency_escalations`, `emergency_notification_settings`, `emergency_notifications` | Emergency submission, recipient escalation, notification policy, and delivery |
| Analytics | `analytics_metrics`, `department_stats`, `monthly_trends` | User-scoped metrics, department summaries, and monthly trend summaries |
| Audit and verification | `audit_logs`, `document_audit_log`, `blockchain_audit_log`, `rekor_queue`, `rekor_monitoring_log` | Application audit, document events, blockchain audit chain, Rekor queue, and monitoring |
| Personal productivity | `notes`, `reminders` | User notes and reminders |
| Request controls | `rate_limit_events` | Server-side rate-limit event tracking |
| Bypass flow | `bypass_documents`, `bypass_workflow_steps` | Separate emergency or bypass approval path retained for compatibility |

These are separate tables because they represent different ownership, retention, or query boundaries. Tables were not merged solely because their names appeared similar; merging populated tables would require a data migration and coordinated application release.

## Duplicate cleanup completed

The live Supabase advisor identified two identical indexes on `public.documents`:

- `idx_documents_submitter`
- `idx_documents_submitter_id`

Both indexed `documents(submitted_by)`. The cleanup retains `idx_documents_submitter_id` and drops the exact duplicate.

The cleanup also removes identical active-recipient policies whose predicates were the same as the retained policy, and removes duplicate all-trends/all-stats read policies. No row-level access predicate was intentionally broadened by this cleanup.

Four covering indexes were added for live foreign keys that had no index:

- `department_stats(user_id)`
- `monthly_trends(user_id)`
- `recovery_codes(user_id)`
- `webauthn_audit_log(user_id)`

## Function and RPC organization

Existing RPC and trigger signatures are preserved. The cleanup pins function resolution to `public, auth, pg_temp` for the existing helpers and trigger functions. The follow-up migration also revokes anonymous execution from internal security-definer helpers that are used by RLS, triggers, or maintenance routines. Public PIN and provider-lookup compatibility endpoints were intentionally left unchanged.

The application-facing analytics query remains the single canonical RPC call:

```ts
const { data, error } = await supabase.rpc('get_department_analytics', {
  p_user_id: userId,
});
```

Supabase queries should select only the fields required by the view, use explicit filters, order by indexed columns where appropriate, and apply a bounded `.limit(...)` for activity or event lists. New features should not create a second table when an existing canonical table and migration can support the same responsibility.

## SQL editor organization rule

The Supabase SQL editor currently contains many historical private queries, including repeated chat, approval-chain, workflow, and live-meeting repair scripts. They are useful as audit history but should not be treated as independent production schema sources.

For future changes:

1. Draft one canonical migration under `supabase/migrations/`.
2. Make DDL idempotent where safe with `IF EXISTS`, `IF NOT EXISTS`, or `CREATE OR REPLACE`.
3. Keep data backfills separate from schema DDL when the backfill has different rollback or validation needs.
4. Never create a second table to replace an existing table without a documented migration and application compatibility plan.
5. Apply the migration once through Supabase migration history and verify the resulting tables, indexes, policies, and RPC signatures.
6. Keep the saved SQL editor query as a readable copy or verification query, not as an additional competing migration.

This follows current Supabase guidance for migration tracking, idempotent DDL, explicit function search paths, RLS, and generated schema types.[1] [2]

## Publication-safety checklist

Before publishing the web application, run the frontend and backend builds and deterministic tests. Then verify that the live schema still contains the application-facing tables listed above, that the analytics RPC accepts `p_user_id`, and that no migration has dropped a column consumed by the application. Regenerate Supabase TypeScript types after intentional schema changes and review the diff before committing.

The post-cleanup frontend build, frontend tests, backend build, backend tests, and `git diff --check` completed successfully. Supabase security and performance advisors should still be reviewed periodically: advisor output can include intentional warnings for unused indexes, repeated policies on compatibility tables, security-definer RPC grants, and Auth settings such as leaked-password protection.

## References

[1]: https://supabase.com/docs/guides/database/database-linter "Supabase Database Linter"
[2]: https://github.com/supabase/supabase/blob/master/examples/prompts/database-create-migration.md "Supabase Database Migration Guidelines"
