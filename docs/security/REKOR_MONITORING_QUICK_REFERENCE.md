# Rekor Monitoring Quick Reference

## TL;DR - Is It Working?

Run this command:
```bash
cd backend
npm run verify:rekor-monitoring
```

If you see `✅ Rekor Monitoring System is WORKING CORRECTLY` at the end, you're good!

---

## Common Questions

### Q: Why is my rekor_monitoring_log table empty?
**A:** This is NORMAL if:
- Your server hasn't run through 00:05 UTC yet today
- You just deployed/restarted your backend
- This is a new installation

The monitoring runs **once per day at 00:05 UTC**. It's not broken - it just hasn't run yet!

### Q: How do I test if it's working?
**A:** Run the verification script:
```bash
npm run verify:rekor-monitoring
```

Or manually trigger a check via API:
```bash
curl -X POST http://localhost:3001/api/blockchain-audit/monitoring/run \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Q: How do I view monitoring results?
**A:** Three ways:

1. **Database query:**
```sql
SELECT * FROM rekor_monitoring_log ORDER BY check_date DESC LIMIT 10;
```

2. **API endpoint:**
```bash
curl http://localhost:3001/api/blockchain-audit/monitoring/latest \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

3. **Verification script:**
```bash
npm run verify:rekor-monitoring
```

### Q: What does the monitoring check?
**A:** Three things:
1. **Log Consistency** - Rekor tree size should only grow, never shrink
2. **Tree Head Validity** - Rekor API is reachable and returns valid data
3. **Identity Monitoring** - Checks for unexpected entries for your configured emails

### Q: How do I configure identity monitoring?
**A:** Add to `backend/.env`:
```bash
REKOR_MONITORED_EMAILS=admin@hitam.org,director@hitam.org
```

---

## Quick Commands

### Verify System
```bash
npm run verify:rekor-monitoring
```

### Check Latest Result (API)
```bash
curl http://localhost:3001/api/blockchain-audit/monitoring/latest \
  -H "Authorization: Bearer YOUR_JWT"
```

### Get 30-Day History (API)
```bash
curl http://localhost:3001/api/blockchain-audit/monitoring/history?days=30 \
  -H "Authorization: Bearer YOUR_JWT"
```

### Manual Trigger (API)
```bash
curl -X POST http://localhost:3001/api/blockchain-audit/monitoring/run \
  -H "Authorization: Bearer YOUR_JWT"
```

### Check Database Directly
```sql
-- Latest 5 entries
SELECT 
  check_date,
  log_consistency_status,
  tree_head_valid,
  rekor_tree_size,
  unexpected_entries_found,
  array_length(issues_detected, 1) as issue_count,
  monitoring_duration_ms
FROM rekor_monitoring_log
ORDER BY check_date DESC
LIMIT 5;

-- Count by status
SELECT 
  log_consistency_status,
  COUNT(*) as count
FROM rekor_monitoring_log
GROUP BY log_consistency_status;

-- Recent issues
SELECT 
  check_date,
  issues_detected
FROM rekor_monitoring_log
WHERE array_length(issues_detected, 1) > 0
ORDER BY check_date DESC;
```

---

## Environment Variables

### Required
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### Optional
```bash
# Rekor instance (default: https://rekor.sigstore.dev)
REKOR_URL=https://rekor.sigstore.dev

# Disable Rekor in development (default: false)
REKOR_DISABLED=false

# Emails to monitor for unexpected entries
REKOR_MONITORED_EMAILS=admin@hitam.org,director@hitam.org
```

---

## Monitoring Schedule

- **Frequency:** Daily
- **Time:** 00:05 UTC
- **Trigger:** Automatic (cron job)
- **Requires:** Backend server running

**Note:** If your server is down at 00:05 UTC, that day's check will be skipped.

---

## Expected Results

### Healthy System
```json
{
  "check_date": "2026-04-10",
  "log_consistency_status": "ok",
  "tree_head_valid": true,
  "unexpected_entries_found": 0,
  "issues_detected": [],
  "monitoring_duration_ms": 371,
  "rekor_tree_size": 1151307785
}
```

### System with Issues
```json
{
  "check_date": "2026-04-10",
  "log_consistency_status": "failed",
  "tree_head_valid": false,
  "unexpected_entries_found": 3,
  "issues_detected": [
    "TAMPERING DETECTED: Rekor tree size DECREASED from 1000 to 900",
    "Unexpected Rekor entries for admin@hitam.org: uuid1, uuid2, uuid3"
  ],
  "monitoring_duration_ms": 450,
  "rekor_tree_size": 900
}
```

---

## Troubleshooting

### Problem: Verification script fails with "Supabase not configured"
**Solution:** Check your `.env` file has:
```bash
SUPABASE_URL=https://...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

### Problem: "Rekor API is not reachable"
**Solution:** 
1. Check internet connectivity
2. Verify Rekor status: https://status.sigstore.dev/
3. Check firewall/proxy settings

### Problem: Table doesn't exist
**Solution:** Run the migration:
```bash
# Apply the migration
psql -h your-db-host -U postgres -d your-db \
  -f supabase/migrations/20260310_blockchain_audit_log.sql
```

### Problem: Worker not running
**Solution:** This is normal if backend server isn't running. The worker only runs when the server is active.

---

## Integration with Frontend

To display monitoring status in your admin dashboard:

```typescript
// Fetch latest monitoring result
const response = await fetch('/api/blockchain-audit/monitoring/latest', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const { data } = await response.json();

// Display status
if (data?.log_consistency_status === 'ok') {
  // Show green checkmark
} else if (data?.log_consistency_status === 'failed') {
  // Show red alert with issues
} else {
  // Show "No data yet" message
}
```

---

## Monitoring Alerts

Set up alerts for:

1. **Critical:** `log_consistency_status = 'failed'`
   - Indicates potential tampering or Rekor issues
   - Requires immediate investigation

2. **Warning:** `unexpected_entries_found > 0`
   - Possible unauthorized use of institutional identities
   - Review and verify legitimacy

3. **Info:** No new entries for 24+ hours
   - Backend server may be down
   - Check server status

---

## Related Documentation

- **Full Report:** `docs/security/REKOR_MONITORING_VERIFICATION_REPORT.md`
- **Service Code:** `backend/src/services/rekorMonitorService.ts`
- **API Routes:** `backend/src/routes/blockchainAudit.ts`
- **Migration:** `supabase/migrations/20260310_blockchain_audit_log.sql`

---

**Last Updated:** 2026-04-10  
**Status:** ✅ System Operational
