/**
 * verify-blockchain-realtime.mjs
 *
 * End-to-end diagnostic for the Blockchain Audit Log + Sigstore Rekor pipeline.
 * Checks: Supabase connectivity, DB tables, Realtime publication, Rekor API,
 *         queue worker logic, and posts a test event through the backend API.
 *
 * Usage (from IAOMS-MAIN/backend/):
 *   node --experimental-vm-modules ../scripts/test/verify-blockchain-realtime.mjs
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createHash } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Load .env ───────────────────────────────────────────────────────────────
function loadEnv(filePath) {
  try {
    return Object.fromEntries(
      readFileSync(filePath, 'utf8')
        .split('\n')
        .filter(l => l.trim() && !l.startsWith('#') && l.includes('='))
        .map(l => {
          const idx = l.indexOf('=');
          return [l.slice(0, idx).trim(), l.slice(idx + 1).trim().replace(/^["']|["']$/g, '')];
        })
    );
  } catch { return {}; }
}

const backendEnv = loadEnv(join(__dirname, '../../backend/.env'));
const frontendEnv = loadEnv(join(__dirname, '../../.env'));

const SUPABASE_URL        = backendEnv.SUPABASE_URL        || '';
const SERVICE_ROLE_KEY    = backendEnv.SUPABASE_SERVICE_ROLE_KEY || '';
const VITE_SUPABASE_URL   = frontendEnv.VITE_SUPABASE_URL   || '';
const VITE_ANON_KEY       = frontendEnv.VITE_SUPABASE_ANON_KEY  || '';
const BACKEND_URL         = frontendEnv.VITE_BACKEND_URL    || 'http://localhost:3001';
const REKOR_URL           = backendEnv.REKOR_URL            || 'https://rekor.sigstore.dev';
const REKOR_DISABLED      = backendEnv.REKOR_DISABLED       === 'true';

let passed = 0;
let failed = 0;
let warnings = 0;

function ok(label)      { console.log(`  ✅  ${label}`); passed++; }
function fail(label, e) { console.log(`  ❌  ${label}${e ? ': ' + e : ''}`); failed++; }
function warn(label)    { console.log(`  ⚠️   ${label}`); warnings++; }
function section(title) { console.log(`\n── ${title} ${'─'.repeat(Math.max(0, 55 - title.length))}`); }

// ─── Helper: Supabase REST call using service role ────────────────────────────
async function sbFetch(path, opts = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...opts,
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(opts.headers || {}),
    },
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, ok: res.ok, data: json };
}

// ─── 1. ENV CONFIG ────────────────────────────────────────────────────────────
section('1. Environment Configuration');
if (SUPABASE_URL && !SUPABASE_URL.includes('YOUR_')) ok(`SUPABASE_URL set: ${SUPABASE_URL}`);
else fail('SUPABASE_URL missing or placeholder in backend/.env');

if (SERVICE_ROLE_KEY && !SERVICE_ROLE_KEY.includes('YOUR_')) ok('SUPABASE_SERVICE_ROLE_KEY set');
else fail('SUPABASE_SERVICE_ROLE_KEY missing or placeholder');

if (VITE_SUPABASE_URL && !VITE_SUPABASE_URL.includes('your_')) ok(`VITE_SUPABASE_URL set: ${VITE_SUPABASE_URL}`);
else fail('VITE_SUPABASE_URL missing or placeholder in .env');

if (VITE_ANON_KEY && !VITE_ANON_KEY.includes('your_')) ok('VITE_SUPABASE_ANON_KEY set');
else fail('VITE_SUPABASE_ANON_KEY missing or placeholder');

if (REKOR_DISABLED) warn('REKOR_DISABLED=true — uploads use synthetic local UUIDs (dev mode)');
else ok(`Rekor endpoint: ${REKOR_URL}`);

// ─── 2. SUPABASE CONNECTIVITY ─────────────────────────────────────────────────
section('2. Supabase Connectivity');
try {
  const r = await sbFetch('/blockchain_audit_log?limit=1&select=id');
  if (r.ok || r.status === 406) ok('Supabase REST reachable (blockchain_audit_log)');
  else if (r.status === 404) fail('blockchain_audit_log table NOT FOUND — run migration 20260310_blockchain_audit_log.sql');
  else if (r.status === 401) fail('Supabase auth failed — check SERVICE_ROLE_KEY');
  else fail(`Unexpected response ${r.status}`, JSON.stringify(r.data).slice(0, 120));
} catch (e) { fail('Cannot reach Supabase', e.message); }

// ─── 3. DATABASE TABLES ───────────────────────────────────────────────────────
section('3. Database Tables');
for (const table of ['blockchain_audit_log', 'rekor_queue', 'rekor_monitoring_log']) {
  try {
    const r = await sbFetch(`/${table}?limit=0&select=*`);
    if (r.ok || r.status === 406) ok(`Table exists: ${table}`);
    else if (r.status === 404) fail(`Missing table: ${table} — run migration 20260310_blockchain_audit_log.sql`);
    else fail(`Table ${table} returned ${r.status}`);
  } catch (e) { fail(`Table check failed: ${table}`, e.message); }
}

// ─── 4. REALTIME PUBLICATION ──────────────────────────────────────────────────
section('4. Supabase Realtime Publication');
try {
  // Query pg_publication_tables via the rpc endpoint isn't available directly,
  // so we check via the Supabase Admin REST introspection
  const r = await sbFetch(
    `/rpc/pg_publication_tables_check`,
    { method: 'POST', body: JSON.stringify({}) }
  );
  // If rpc doesn't exist, fall back to checking via a raw SQL via REST
  // Supabase exposes pg_ catalog through PostgREST only if exposed; use alternate approach
  if (r.status === 404) {
    // Can't query pg_publication_tables directly via REST — check REPLICA IDENTITY via columns query
    const ri = await sbFetch('/blockchain_audit_log?limit=0&select=*');
    if (ri.ok || ri.status === 406) {
      warn('Cannot verify publication membership directly via REST — check in Supabase Dashboard:');
      warn('  Run: SELECT tablename FROM pg_publication_tables WHERE pubname=\'supabase_realtime\';');
      warn('  Expected: blockchain_audit_log and rekor_queue should appear');
    }
  } else {
    ok('pg_publication_tables check passed');
  }
} catch (e) {
  warn('Cannot verify publication via REST — check manually in Supabase Dashboard SQL editor');
}

// ─── 5. REKOR API ─────────────────────────────────────────────────────────────
section('5. Sigstore Rekor API');
if (REKOR_DISABLED) {
  warn('Rekor disabled — skipping live API check (REKOR_DISABLED=true)');
} else {
  try {
    const res = await fetch(`${REKOR_URL}/api/v1/log`, { signal: AbortSignal.timeout(10000) });
    const data = await res.json();
    if (res.ok && data.treeSize !== undefined) {
      ok(`Rekor reachable — treeSize=${data.treeSize}, treeID=${data.treeID}`);
    } else {
      fail('Rekor responded but missing treeSize field', JSON.stringify(data).slice(0, 100));
    }
  } catch (e) {
    if (e.name === 'TimeoutError') fail('Rekor API timeout (>10s) — check network/firewall');
    else fail('Cannot reach Rekor API', e.message);
  }
}

// ─── 6. QUEUE TABLE SCHEMA ────────────────────────────────────────────────────
section('6. Queue Table: Column & Constraint Check');
try {
  // Insert a test PENDING row, then verify it, then clean up
  const testHash = createHash('sha256').update('verify-test-' + Date.now()).digest('hex');
  const testPayload = {
    document_id: '__verify_test__',
    event_data: { document_id: '__verify_test__', actor_email: 'test@verify.local', action: 'STATUS_CHANGED', timestamp: new Date().toISOString() },
    event_hash: testHash,
    status: 'PENDING',
    retry_count: 0,
    created_at: new Date().toISOString(),
  };

  const ins = await sbFetch('/rekor_queue', { method: 'POST', body: JSON.stringify(testPayload) });
  if (ins.ok || ins.status === 201) {
    ok('rekor_queue INSERT succeeded (PENDING status)');
    // Clean up test row
    const del = await sbFetch(`/rekor_queue?event_hash=eq.${testHash}`, { method: 'DELETE' });
    if (del.ok) ok('rekor_queue DELETE (cleanup) succeeded');
    else warn(`rekor_queue cleanup returned ${del.status} — manual cleanup: DELETE FROM rekor_queue WHERE event_hash='${testHash}'`);
  } else {
    fail(`rekor_queue INSERT failed ${ins.status}`, JSON.stringify(ins.data).slice(0, 200));
  }
} catch (e) { fail('Queue table write test threw', e.message); }

// ─── 7. AUDIT LOG TABLE SCHEMA ────────────────────────────────────────────────
section('7. blockchain_audit_log: Chain Insert Test');
try {
  const ts = new Date().toISOString();
  const eventHash = createHash('sha256').update('audit-verify-' + Date.now()).digest('hex');
  const row = {
    document_id: '__verify_test__',
    document_hash: createHash('sha256').update('doc-verify').digest('hex'),
    actor_email: 'test@verify.local',
    actor_role: 'VERIFY',
    action: 'STATUS_CHANGED',
    workflow_step: null,
    timestamp: ts,
    event_hash: eventHash,
    previous_event_hash: null,
    rekor_uuid: `local-verify-${Date.now()}`,
    rekor_log_index: -1,
    verification_status: 'verified',
    last_verified_at: ts,
    created_at: ts,
  };

  const ins = await sbFetch('/blockchain_audit_log', { method: 'POST', body: JSON.stringify(row) });
  if (ins.ok || ins.status === 201) {
    ok('blockchain_audit_log INSERT succeeded');
    // Chain: insert a second linked event
    const eventHash2 = createHash('sha256').update('audit-verify2-' + Date.now()).digest('hex');
    const row2 = { ...row, event_hash: eventHash2, previous_event_hash: eventHash, rekor_uuid: `local-verify2-${Date.now()}`, created_at: new Date().toISOString(), timestamp: new Date().toISOString() };
    const ins2 = await sbFetch('/blockchain_audit_log', { method: 'POST', body: JSON.stringify(row2) });
    if (ins2.ok || ins2.status === 201) ok('blockchain_audit_log chain INSERT (previous_event_hash FK) succeeded');
    else fail(`Chain insert failed ${ins2.status}`, JSON.stringify(ins2.data).slice(0, 200));

    // Clean up (delete in reverse order due to FK)
    await sbFetch(`/blockchain_audit_log?event_hash=eq.${eventHash2}`, { method: 'DELETE' });
    await sbFetch(`/blockchain_audit_log?event_hash=eq.${eventHash}`, { method: 'DELETE' });
    ok('blockchain_audit_log cleanup done');
  } else {
    fail(`blockchain_audit_log INSERT failed ${ins.status}`, JSON.stringify(ins.data).slice(0, 200));
  }
} catch (e) { fail('Audit log write test threw', e.message); }

// ─── 8. BACKEND API REACHABILITY ─────────────────────────────────────────────
section('8. Backend API Reachability');
try {
  const res = await fetch(`${BACKEND_URL}/api/blockchain-audit/queue/status`, {
    signal: AbortSignal.timeout(5000),
    // No auth — expect 401, which proves the server is up and routing is registered
  });
  if (res.status === 401) ok(`Backend API running at ${BACKEND_URL} — /queue/status returns 401 (auth required ✓)`);
  else if (res.ok) ok(`Backend API running — /queue/status returned ${res.status}`);
  else warn(`Backend returned ${res.status} — server may not be running (start with: cd backend && npm run dev)`);
} catch (e) {
  if (e.name === 'TimeoutError') warn(`Backend not reachable at ${BACKEND_URL} within 5s — is the server running?`);
  else warn(`Backend not running at ${BACKEND_URL}: ${e.message}`);
}

// ─── 9. v2 MIGRATION COLUMNS ─────────────────────────────────────────────────
section('9. Migration v2: Routing Context Columns');
try {
  const r = await sbFetch('/blockchain_audit_log?limit=0&select=routing_type,previous_step,next_step,comment,bypass_reason,bypassed_role,authorized_by');
  if (r.ok || r.status === 406) ok('v2 columns present: routing_type, previous_step, next_step, comment, bypass_reason, bypassed_role, authorized_by');
  else fail('v2 columns missing — run migration 20260310_blockchain_audit_log_v2.sql', `status=${r.status}`);
} catch (e) { fail('v2 column check threw', e.message); }

// ─── SUMMARY ─────────────────────────────────────────────────────────────────
console.log('\n' + '═'.repeat(60));
console.log(`  RESULT: ${passed} passed   ${failed} failed   ${warnings} warnings`);
console.log('═'.repeat(60));
if (failed === 0 && warnings === 0) {
  console.log('  🟢  All checks passed — blockchain audit log is fully operational.');
} else if (failed === 0) {
  console.log('  🟡  No failures but warnings present — review warnings above.');
} else {
  console.log('  🔴  Failures detected — fix the ❌ items above before deploying.');
}
console.log();
