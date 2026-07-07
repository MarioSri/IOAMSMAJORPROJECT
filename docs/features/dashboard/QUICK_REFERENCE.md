# Recent Documents Widget - Quick Reference

## 🚀 What Changed

### Before
```typescript
// DocumentsWidget.tsx - OLD
const [documents, setDocuments] = useState<Document[]>([]);

useEffect(() => {
  const storedApprovals = JSON.parse(localStorage.getItem('pending-approvals') || '[]');
  const userApprovalCards = storedApprovals.filter(isUserInRecipients);
  setDocuments(userApprovalCards);
  
  window.addEventListener('approval-card-created', handleApprovalCardCreated);
  window.addEventListener('storage', handleStorageChange);
}, []);
```

### After
```typescript
// DocumentsWidget.tsx - NEW
import { useSupabaseRecentDocuments } from '@/hooks/useSupabaseRecentDocuments';

const { documents, loading } = useSupabaseRecentDocuments();
// That's it! Real-time updates automatic
```

---

## 📦 New Hook Usage

```typescript
import { useSupabaseRecentDocuments } from '@/hooks/useSupabaseRecentDocuments';

function MyComponent() {
  const { documents, loading, error, refresh } = useSupabaseRecentDocuments();
  
  if (loading) return <Spinner />;
  if (error) return <Error message={error} />;
  
  return (
    <div>
      {documents.map(doc => (
        <DocumentCard key={doc.id} document={doc} />
      ))}
    </div>
  );
}
```

---

## 🔄 How Real-Time Works

```typescript
// Automatic - No code needed in component
useEffect(() => {
  const channel = supabase
    .channel('recent-documents')
    .on('postgres_changes', { table: 'documents' }, () => {
      // Refetch automatically
    })
    .subscribe();
    
  return () => channel.unsubscribe();
}, []);
```

---

## 💾 Cache Strategy

```typescript
// Write cache (automatic)
localStorage.setItem('recent-documents-cache', JSON.stringify({
  data: documents,
  timestamp: Date.now()
}));

// Read cache on error (automatic)
const cached = JSON.parse(localStorage.getItem('recent-documents-cache') || '{}');
if (Date.now() - cached.timestamp < 300000) { // 5 min
  return cached.data;
}
```

---

## 🗄️ Database Queries

```typescript
// Fetch documents with workflow info
const { data } = await supabase
  .from('documents')
  .select(`
    *,
    document_workflows!inner(
      escalation_level,
      workflow_steps!inner(status, assignee_id)
    )
  `)
  .in('status', ['pending', 'in-review', 'emergency'])
  .order('submitted_date', { ascending: false });
```

---

## 🎯 Key Points

1. **No localStorage writes** for business data
2. **No manual event listeners** needed
3. **Real-time updates** automatic
4. **Cache fallback** for offline
5. **UI unchanged** - zero visual impact

---

## 🧪 Quick Test

```bash
# 1. Create document
# Go to Approval Center → Create Card

# 2. Check Dashboard
# Document appears instantly

# 3. Approve document
# Document disappears instantly

# 4. Check console
# Should see: "📡 Document change: INSERT"
```

---

## 🐛 Debug

```typescript
// Check if real-time connected
supabase.channel('test').subscribe((status) => {
  console.log('Realtime status:', status);
});

// Check cache
console.log(localStorage.getItem('recent-documents-cache'));

// Force refresh
const { refresh } = useSupabaseRecentDocuments();
refresh();
```

---

## 📚 Related Files

- Hook: `src/hooks/useSupabaseRecentDocuments.ts`
- Widget: `src/components/dashboard/widgets/DocumentsWidget.tsx`
- Service: `src/services/ApprovalService.ts`
- Schema: `supabase/migrations/20240131_approval_center.sql`

---

**Ready to use!** No additional setup required.
