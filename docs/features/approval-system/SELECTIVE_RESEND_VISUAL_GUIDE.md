# 📊 Visual Flow Diagrams: Selective Recipient Resend

## 🎯 Complete Workflow Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    INITIAL SUBMISSION                           │
│                  (Bi-Directional Routing)                       │
└─────────────────────────────────────────────────────────────────┘
                            │
                            │ Submitter creates document
                            │ Selects 4 recipients
                            │ Chooses bi-directional routing
                            ▼
                    ┌───────────────┐
                    │   Submitter   │
                    └───────┬───────┘
                            │
            ┌───────────────┼───────────────┐
            │               │               │
            ▼               ▼               ▼
      ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
      │Recipient1│    │Recipient2│    │Recipient3│    │Recipient4│
      │   (HOD)  │    │(Principal)│   │  (Dean)  │    │(Registrar)│
      └────┬─────┘    └────┬─────┘    └────┬─────┘    └────┬─────┘
           │               │               │               │
           │ Approves      │ Rejects       │ Approves      │ Rejects
           ▼               ▼               ▼               ▼
        ✅ DONE        ❌ BYPASS        ✅ DONE        ❌ BYPASS

┌─────────────────────────────────────────────────────────────────┐
│                    CURRENT STATE                                │
└─────────────────────────────────────────────────────────────────┘

    ✅ Recipient 1 (HOD): Approved
    ❌ Recipient 2 (Principal): BYPASSED - "Needs budget details"
    ✅ Recipient 3 (Dean): Approved
    ❌ Recipient 4 (Registrar): BYPASSED - "Missing signatures"

    bypassed_recipients: ["Principal", "Registrar"]

┌─────────────────────────────────────────────────────────────────┐
│              SUBMITTER OPENS SELECTION DIALOG                   │
└─────────────────────────────────────────────────────────────────┘
                            │
                            │ Clicks "Choose & Resend"
                            ▼
            ┌───────────────────────────────┐
            │  Recipient Selection Dialog   │
            ├───────────────────────────────┤
            │                               │
            │  ☑ Principal (BYPASSED)       │
            │    "Needs budget details"     │
            │                               │
            │  ☐ Registrar (BYPASSED)       │
            │    "Missing signatures"       │
            │                               │
            │  [Select All] [Deselect All]  │
            │                               │
            │  ─────────────────────────    │
            │  [📤 Upload New Files]        │
            │                               │
            │  [Resend to 1 Recipient(s)]   │
            └───────────────────────────────┘
                            │
                            │ Submitter:
                            │ 1. Checks Principal only
                            │ 2. Uploads revised budget
                            │ 3. Clicks Resend
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    AFTER RESEND                                 │
└─────────────────────────────────────────────────────────────────┘

    ✅ Recipient 1 (HOD): Approved
    🔄 Recipient 2 (Principal): Re-Submitted ← Receives approval card
    ✅ Recipient 3 (Dean): Approved
    ❌ Recipient 4 (Registrar): BYPASSED ← No change

    bypassed_recipients: ["Registrar"]
    resubmitted_recipients: ["Principal"]

                            │
                            │ Principal reviews
                            ▼
                    ┌───────────────┐
                    │   Principal   │
                    │  Sees card in │
                    │Approval Center│
                    └───────┬───────┘
                            │
                    ┌───────┴───────┐
                    │               │
                    ▼               ▼
              ✅ Approves      ❌ Rejects Again
                    │               │
                    ▼               ▼
            Workflow moves    Stays bypassed
              forward         (can resend again)
```

---

## 🔄 Status Transition Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│              WORKFLOW STEP STATUS TRANSITIONS                   │
└─────────────────────────────────────────────────────────────────┘

    INITIAL STATE
    ─────────────
    ┌─────────┐
    │ pending │  (Waiting for turn)
    └────┬────┘
         │
         │ Recipient's turn arrives
         ▼
    ┌─────────┐
    │ current │  (Active - can approve/reject)
    └────┬────┘
         │
         ├─────────────┬─────────────┐
         │             │             │
         ▼             ▼             ▼
    ┌──────────┐  ┌──────────┐  ┌──────────┐
    │completed │  │ rejected │  │ bypassed │
    └──────────┘  └────┬─────┘  └────┬─────┘
                       │             │
                       │             │ Submitter selects
                       │             │ for resend
                       │             ▼
                       │        ┌─────────┐
                       │        │ resent  │ ← NEW STATUS
                       │        └────┬────┘
                       │             │
                       │             │ Recipient reviews again
                       │             ▼
                       │        ┌─────────┐
                       │        │ current │
                       │        └────┬────┘
                       │             │
                       └─────────────┴─────────────┐
                                                   │
                                                   ▼
                                            ┌──────────┐
                                            │ completed│
                                            │    or    │
                                            │ bypassed │
                                            └──────────┘
```

---

## 🎨 UI Component Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  Choose Recipients to Resend                          [X]       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Select which rejected recipients should receive the document   │
│  again. You can re-upload files before resending.               │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  Document: "Budget Proposal 2024"                         │ │
│  │  2 recipient(s) rejected this document                    │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  Select Recipients:                                             │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ ☑  👤 Principal                    [BYPASSED]             │ │
│  │    Reason: Needs budget breakdown                         │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ ☐  👤 Registrar                    [BYPASSED]             │ │
│  │    Reason: Missing signatures                             │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  [Select All]  [Deselect All]                                  │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  Re-Upload Files (Optional)                                     │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │           [📤 Upload New Files]                           │ │
│  └───────────────────────────────────────────────────────────┘ │
│  Upload revised documents before resending to selected          │
│  recipients                                                     │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                  [Cancel] [Resend to 1 Recipient(s)] │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📊 Decision Tree

```
                    START: Document has rejections
                                │
                                ▼
                    ┌───────────────────────┐
                    │ Are you the submitter?│
                    └───────┬───────────────┘
                            │
                    ┌───────┴───────┐
                    │               │
                    NO              YES
                    │               │
                    ▼               ▼
            ┌──────────────┐  ┌──────────────────┐
            │ Button hidden│  │ "Choose & Resend"│
            │ (not owner)  │  │  button visible  │
            └──────────────┘  └────────┬─────────┘
                                       │
                                       │ Click button
                                       ▼
                            ┌──────────────────────┐
                            │ Dialog opens showing │
                            │ rejected recipients  │
                            └──────────┬───────────┘
                                       │
                                       ▼
                            ┌──────────────────────┐
                            │ Do you need to       │
                            │ upload new files?    │
                            └──────────┬───────────┘
                                       │
                            ┌──────────┴──────────┐
                            │                     │
                            YES                   NO
                            │                     │
                            ▼                     │
                    ┌──────────────┐              │
                    │ Click Upload │              │
                    │ Select files │              │
                    │ Wait for ✅  │              │
                    └──────┬───────┘              │
                           │                      │
                           └──────────┬───────────┘
                                      │
                                      ▼
                            ┌──────────────────────┐
                            │ Select recipients    │
                            │ using checkboxes     │
                            └──────────┬───────────┘
                                       │
                                       ▼
                            ┌──────────────────────┐
                            │ At least 1 selected? │
                            └──────────┬───────────┘
                                       │
                            ┌──────────┴──────────┐
                            │                     │
                            NO                    YES
                            │                     │
                            ▼                     ▼
                    ┌──────────────┐      ┌──────────────┐
                    │ Resend button│      │ Click Resend │
                    │   disabled   │      │    button    │
                    └──────────────┘      └──────┬───────┘
                                                 │
                                                 ▼
                                    ┌────────────────────────┐
                                    │ Selected recipients    │
                                    │ receive approval cards │
                                    └────────────────────────┘
                                                 │
                                                 ▼
                                    ┌────────────────────────┐
                                    │ Success message shown  │
                                    │ Dialog closes          │
                                    └────────────────────────┘
                                                 │
                                                 ▼
                                              END
```

---

## 🔄 Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    DATA FLOW ARCHITECTURE                       │
└─────────────────────────────────────────────────────────────────┘

    USER INTERFACE (DocumentTracker.tsx)
    ────────────────────────────────────
    │
    │ 1. User clicks "Choose & Resend"
    │    ↓
    │    setShowResendDialog(true)
    │    setSelectedDocForResend(document)
    │
    │ 2. User selects recipients
    │    ↓
    │    setSelectedRecipients([...names])
    │
    │ 3. User uploads files (optional)
    │    ↓
    │    workflowService.updateDocumentFiles()
    │    ↓
    ├────────────────────────────────────────────────┐
    │                                                │
    ▼                                                ▼
    WORKFLOW SERVICE                          SUPABASE DATABASE
    ────────────────                          ─────────────────
    │                                         │
    │ resendToSelectedRecipients()            │ documents table
    │   ↓                                     │   ↓
    │   1. Fetch workflow                     │   UPDATE files
    │      ↓                                  │
    │      getWorkflowByDocumentId()          │ workflow_steps table
    │      ↓                                  │   ↓
    │   2. Filter bypassed steps              │   UPDATE status = 'resent'
    │      matching selected names            │   UPDATE resent_at = NOW()
    │      ↓                                  │   CLEAR rejected_date
    │   3. Update selected steps              │
    │      ↓                                  │ document_workflows table
    │      UPDATE workflow_steps              │   ↓
    │      SET status = 'resent'              │   UPDATE bypassed_recipients
    │      ↓                                  │   (remove selected)
    │   4. Update bypassed list               │
    │      ↓                                  │
    │      UPDATE document_workflows          │
    │      ↓                                  │
    │   5. Log blockchain event               │
    │      ↓                                  │
    │      reportBlockchainEvent()            │
    │                                         │
    └─────────────────┬───────────────────────┘
                      │
                      │ Return: resetCount
                      ▼
    USER INTERFACE
    ──────────────
    │
    │ refetch() - Reload documents
    │ toast() - Show success message
    │ setShowResendDialog(false) - Close dialog
    │
    ▼
    UPDATED UI
    ──────────
    │
    │ • Selected recipients show "Re-Submitted" badge
    │ • Unselected recipients still show "BYPASSED"
    │ • Document status updated
    │ • Approval cards sent to selected recipients
    │
    ▼
    END
```

---

## 🎯 Comparison: Before vs After

```
┌─────────────────────────────────────────────────────────────────┐
│                    BEFORE (Old System)                          │
└─────────────────────────────────────────────────────────────────┘

    Track Documents
    ───────────────
    ✅ Recipient 1: Approved
    ❌ Recipient 2: BYPASSED
    ✅ Recipient 3: Approved
    ❌ Recipient 4: BYPASSED

    [Resend] ← Click this
       ↓
    Automatically sends to ALL bypassed recipients
       ↓
    ❌ No choice
    ❌ No control
    ❌ Can't select specific recipients
    ❌ Must fix all issues before resending


┌─────────────────────────────────────────────────────────────────┐
│                    AFTER (New System)                           │
└─────────────────────────────────────────────────────────────────┘

    Track Documents
    ───────────────
    ✅ Recipient 1: Approved
    ❌ Recipient 2: BYPASSED
    ✅ Recipient 3: Approved
    ❌ Recipient 4: BYPASSED

    [Choose & Resend] ← Click this
       ↓
    Dialog opens with checkboxes
       ↓
    ☑ Recipient 2 (select)
    ☐ Recipient 4 (don't select)
       ↓
    [Upload New Files] (optional)
       ↓
    [Resend to 1 Recipient(s)]
       ↓
    ✅ Full control
    ✅ Select specific recipients
    ✅ Upload files before resending
    ✅ Handle issues separately
```

---

## 📈 Success Metrics

```
┌─────────────────────────────────────────────────────────────────┐
│                    MEASURABLE IMPROVEMENTS                      │
└─────────────────────────────────────────────────────────────────┘

    BEFORE                          AFTER
    ──────                          ─────

    Resend Efficiency               Resend Efficiency
    ─────────────────               ─────────────────
    │                               │
    │ All or nothing                │ Selective choice
    │ 100% resend rate              │ 25-75% resend rate
    │                               │ (only who needs it)
    │                               │
    ▼                               ▼
    ❌ Inefficient                  ✅ Efficient


    Recipient Experience            Recipient Experience
    ────────────────────            ────────────────────
    │                               │
    │ Receive documents             │ Only receive when
    │ even if not ready             │ issues are fixed
    │                               │
    ▼                               ▼
    ❌ Frustrating                  ✅ Relevant


    Submitter Control               Submitter Control
    ─────────────────               ─────────────────
    │                               │
    │ No choice                     │ Full control
    │ Must fix all issues           │ Fix issues one by one
    │                               │
    ▼                               ▼
    ❌ Limited                      ✅ Flexible


    Workflow Clarity                Workflow Clarity
    ────────────────                ────────────────
    │                               │
    │ Hard to track                 │ Clear status badges
    │ who was resent                │ "Re-Submitted" vs
    │                               │ "BYPASSED"
    ▼                               ▼
    ❌ Unclear                      ✅ Transparent
```

---

## 🎉 Summary Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│         SELECTIVE RECIPIENT RESEND - COMPLETE FLOW              │
└─────────────────────────────────────────────────────────────────┘

    📄 Document Submitted (Bi-Directional)
              ↓
    👥 4 Recipients receive approval cards
              ↓
    ✅ 2 Approve  |  ❌ 2 Reject
              ↓
    📊 Track Documents shows rejections
              ↓
    🔘 Submitter clicks "Choose & Resend"
              ↓
    ☑️ Dialog opens with checkboxes
              ↓
    ✏️ Submitter selects specific recipients
              ↓
    📤 Optionally uploads new files
              ↓
    🚀 Clicks "Resend to X Recipients"
              ↓
    ✅ Selected recipients receive cards
    ❌ Unselected remain bypassed
              ↓
    🎯 Workflow continues efficiently!
```

This visual guide provides clear diagrams to help users understand the selective recipient resend feature at a glance!
