# Recent Documents Widget - Architecture Diagram

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         SUPABASE CLOUD                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │  documents   │  │  workflows   │  │workflow_steps│         │
│  │   (table)    │  │   (table)    │  │   (table)    │         │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘         │
│         │                  │                  │                  │
│         └──────────────────┴──────────────────┘                 │
│                            │                                     │
│                   ┌────────▼────────┐                          │
│                   │  Realtime API   │                          │
│                   │  (WebSocket)    │                          │
│                   └────────┬────────┘                          │
└────────────────────────────┼─────────────────────────────────┘
                             │
                    ┌────────▼────────┐
                    │   Network Layer  │
                    └────────┬────────┘
                             │
┌────────────────────────────▼─────────────────────────────────┐
│                      FRONTEND APPLICATION                      │
│                                                                │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         useSupabaseRecentDocuments Hook              │   │
│  │  ┌────────────────────────────────────────────────┐  │   │
│  │  │  1. Fetch documents from Supabase              │  │   │
│  │  │  2. Filter by user role & recipients           │  │   │
│  │  │  3. Subscribe to real-time changes             │  │   │
│  │  │  4. Cache to localStorage (fallback only)      │  │   │
│  │  └────────────────────────────────────────────────┘  │   │
│  └──────────────────────┬───────────────────────────────┘   │
│                         │                                      │
│  ┌──────────────────────▼───────────────────────────────┐   │
│  │           DocumentsWidget Component                   │   │
│  │  ┌────────────────────────────────────────────────┐  │   │
│  │  │  • Display documents                           │  │   │
│  │  │  • Filter (All/Pending/Emergency)              │  │   │
│  │  │  • Navigate to Approval Center                 │  │   │
│  │  │  • Open AI Summarizer                          │  │   │
│  │  │  • Auto-update on real-time events             │  │   │
│  │  └────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                                │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              localStorage (Cache Only)                │   │
│  │  { data: [...], timestamp: 1234567890 }              │   │
│  │  TTL: 5 minutes                                       │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────┘
```

---

## 🔄 Data Flow Sequence

### 1. Initial Load
```
User Opens Dashboard
    ↓
DocumentsWidget mounts
    ↓
useSupabaseRecentDocuments() called
    ↓
Fetch from Supabase
    ↓
Filter by user/role
    ↓
Cache to localStorage
    ↓
Display in UI
```

### 2. Real-Time Update (New Document)
```
User A creates document in Approval Center
    ↓
approvalService.createDocument()
    ↓
INSERT into Supabase documents table
    ↓
Supabase Realtime broadcasts change
    ↓
User B's subscription receives event
    ↓
useSupabaseRecentDocuments refetches
    ↓
UI updates automatically
    ↓
Cache updated
```

### 3. Real-Time Update (Approve Document)
```
User A approves document
    ↓
approvalService.approveDocument()
    ↓
UPDATE Supabase documents.status = 'approved'
    ↓
Supabase Realtime broadcasts change
    ↓
All users' subscriptions receive event
    ↓
useSupabaseRecentDocuments refetches
    ↓
Document removed from UI (status filter)
    ↓
Cache updated
```

### 4. Offline/Error Scenario
```
Network error occurs
    ↓
Supabase fetch fails
    ↓
useSupabaseRecentDocuments catches error
    ↓
Check localStorage cache
    ↓
If cache < 5 minutes old
    ↓
Display cached data
    ↓
Show to user (with stale indicator optional)
```

---

## 🔌 Real-Time Subscription Flow

```
┌─────────────────────────────────────────────────────────┐
│  useSupabaseRecentDocuments Hook                        │
│                                                          │
│  useEffect(() => {                                       │
│    const channel = supabase                             │
│      .channel('recent-documents')                       │
│      .on('postgres_changes', {                          │
│        event: '*',                                       │
│        schema: 'public',                                 │
│        table: 'documents'                                │
│      }, () => fetchDocuments())                         │
│      .on('postgres_changes', {                          │
│        event: '*',                                       │
│        schema: 'public',                                 │
│        table: 'workflow_steps'                          │
│      }, () => fetchDocuments())                         │
│      .subscribe();                                       │
│                                                          │
│    return () => channel.unsubscribe();                  │
│  }, [user]);                                             │
└─────────────────────────────────────────────────────────┘
```

---

## 📊 Component Hierarchy

```
Dashboard
  └── RoleDashboard
      └── DynamicDashboard
          └── DocumentsWidget
              ├── useSupabaseRecentDocuments (hook)
              │   ├── Supabase queries
              │   ├── Real-time subscriptions
              │   └── Cache management
              │
              ├── Filter buttons (All/Pending/Emergency)
              ├── Document cards
              │   ├── Status badge
              │   ├── Priority indicator
              │   ├── Action required badge
              │   └── Quick actions
              │       ├── View Details
              │       └── AI Summarizer
              │
              └── AISummarizerModal
```

---

## 🗄️ Database Relationships

```
documents (1) ──────┐
                    │
                    ├──> document_workflows (1)
                    │         │
                    │         └──> workflow_steps (N)
                    │
                    └──> document_approvals (N)
```

### Query Strategy
```sql
-- Single query with joins for efficiency
SELECT 
  d.*,
  dw.escalation_level,
  ws.status,
  ws.assignee_id
FROM documents d
INNER JOIN document_workflows dw ON d.id = dw.document_id
INNER JOIN workflow_steps ws ON dw.id = ws.workflow_id
WHERE d.status IN ('pending', 'in-review', 'emergency')
  AND ws.assignee_id = $1
  AND ws.status = 'current'
ORDER BY d.submitted_date DESC
LIMIT 50
```

---

## 🔐 Security Layers

```
┌─────────────────────────────────────────────────────┐
│  1. Supabase Authentication                         │
│     • User must be logged in                        │
│     • JWT token validation                          │
└─────────────────┬───────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────┐
│  2. Row-Level Security (RLS)                        │
│     • Policies on all tables                        │
│     • User-specific data access                     │
└─────────────────┬───────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────┐
│  3. Application-Level Filtering                     │
│     • Recipient matching                            │
│     • Role-based filtering                          │
│     • Department/branch filtering                   │
└─────────────────────────────────────────────────────┘
```

---

## 💾 Cache Strategy

```
┌─────────────────────────────────────────────────────┐
│  localStorage Cache                                 │
│                                                      │
│  Key: 'recent-documents-cache'                      │
│  Value: {                                            │
│    data: RecentDocument[],                          │
│    timestamp: number                                 │
│  }                                                   │
│                                                      │
│  TTL: 5 minutes (300,000 ms)                        │
│                                                      │
│  Usage:                                              │
│  • Write: After successful Supabase fetch           │
│  • Read: On Supabase error only                     │
│  • Clear: On successful fetch (implicit)            │
└─────────────────────────────────────────────────────┘
```

---

## 🚀 Performance Optimizations

1. **Database Indexes**
   ```sql
   CREATE INDEX idx_documents_status ON documents(status);
   CREATE INDEX idx_documents_submitted_date ON documents(submitted_date DESC);
   CREATE INDEX idx_workflow_steps_assignee ON workflow_steps(assignee_id);
   ```

2. **Query Optimization**
   - Single query with joins (no N+1)
   - LIMIT 50 for pagination
   - Filtered by status at DB level

3. **Real-Time Efficiency**
   - Single channel for multiple tables
   - Debounced refetch (automatic)
   - Unsubscribe on unmount

4. **Cache Strategy**
   - Write-through cache
   - 5-minute TTL
   - Automatic invalidation

---

## 📱 Multi-Device Sync

```
Device A (Browser 1)          Device B (Browser 2)
      │                              │
      ├──> Create Document           │
      │                              │
      │    Supabase INSERT           │
      │         │                    │
      │         └──> Realtime ───────┤
      │              Broadcast       │
      │                              ├──> Receive Event
      │                              │
      │                              ├──> Refetch Data
      │                              │
      │                              └──> Update UI
      │                                   (Document appears)
      │                              │
      ├──> Approve Document          │
      │                              │
      │    Supabase UPDATE           │
      │         │                    │
      │         └──> Realtime ───────┤
      │              Broadcast       │
      │                              ├──> Receive Event
      │                              │
      │                              ├──> Refetch Data
      │                              │
      │                              └──> Update UI
      │                                   (Document removed)
```

---

**Architecture Version:** 1.0.0
**Last Updated:** 2024-01-28
