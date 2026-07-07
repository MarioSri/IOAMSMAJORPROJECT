# 🎯 Selective Recipient Resend Feature - Implementation Complete

## 📋 Overview

This feature allows document submitters to **selectively choose** which rejected recipients should receive a re-uploaded document in **Bi-Directional Routing** workflows, instead of automatically sending to all rejected recipients.

---

## ✨ Key Features

### 1. **Recipient Selection Dialog**
- Visual list of all rejected (bypassed) recipients
- Checkbox selection for each recipient
- Shows rejection reason for each recipient
- Quick "Select All" / "Deselect All" buttons

### 2. **Optional File Re-Upload**
- Upload new/revised files before resending
- Supports multiple file formats (.pdf, .doc, .docx, .xlsx, .xls, .png, .jpg, .jpeg)
- Files are updated in the document before resending

### 3. **Selective Resending**
- Only selected recipients receive the approval card
- Unselected recipients remain bypassed
- Status tracking: "Re-Submitted" badge for resent recipients

### 4. **Smart Status Management**
- Selected recipients: `bypassed` → `resent`
- Unselected recipients: remain `bypassed`
- Document status updates based on remaining bypassed recipients

---

## 🚀 How to Use

### **Step 1: View Rejected Recipients**

Navigate to **Track Documents** page and find your document with rejected recipients:

```
Document: "Budget Proposal 2024"

Workflow Progress:
✅ Recipient 1 (HOD): Approved
❌ Recipient 2 (Principal): BYPASSED - "Needs more details"
✅ Recipient 3 (Dean): Approved  
❌ Recipient 4 (Registrar): BYPASSED - "Wrong format"

[Choose & Resend Button]
```

### **Step 2: Click "Choose & Resend"**

A dialog opens showing all rejected recipients with checkboxes.

### **Step 3: Select Recipients**

- Click checkboxes to select specific recipients
- Use "Select All" to choose all rejected recipients
- Use "Deselect All" to clear all selections

### **Step 4: Re-Upload Files (Optional)**

- Click "Upload New Files" button
- Select revised document files
- Files are uploaded and attached to the document

### **Step 5: Click "Resend to X Recipients"**

- Only selected recipients receive the approval card
- Success message shows number of recipients notified
- Dialog closes automatically

---

## 🔧 Technical Implementation

### **Files Modified**

1. **`src/services/WorkflowService.ts`**
   - Added `resendToSelectedRecipients()` method
   - Handles selective recipient status updates
   - Updates `bypassed_recipients` array

2. **`src/components/documents/DocumentTracker.tsx`**
   - Added recipient selection dialog
   - Added state management for selection
   - Updated "Resend" button to open dialog
   - Integrated file upload functionality

3. **`supabase/migrations/20260415_add_resent_status.sql`**
   - Added `resent_at` timestamp column
   - Added index for performance
   - Added documentation comments

### **New Method: `resendToSelectedRecipients()`**

```typescript
async resendToSelectedRecipients(
  documentId: string, 
  selectedRecipientNames: string[]
): Promise<number>
```

**Parameters:**
- `documentId`: The document ID to resend
- `selectedRecipientNames`: Array of recipient names to resend to

**Returns:**
- Number of workflow steps reset

**Functionality:**
1. Fetches workflow and steps from database
2. Filters bypassed steps matching selected recipient names
3. Updates selected steps: `status = 'resent'`, adds `resent_at` timestamp
4. Removes selected recipients from `bypassed_recipients` array
5. Updates document status if no bypassed recipients remain
6. Logs blockchain audit event

---

## 📊 Database Schema Changes

### **workflow_steps Table**

```sql
ALTER TABLE workflow_steps 
ADD COLUMN resent_at TIMESTAMP WITH TIME ZONE;
```

**Purpose:** Track when a bypassed step was resent to the recipient

**Index:**
```sql
CREATE INDEX idx_workflow_steps_resent_at 
ON workflow_steps(resent_at) 
WHERE resent_at IS NOT NULL;
```

---

## 🎨 UI Components

### **Recipient Selection Dialog**

**Header:**
- Title: "Choose Recipients to Resend"
- Icon: Users icon (blue)
- Description: Instructions for user

**Document Info Section:**
- Document title
- Count of rejected recipients

**Recipient List:**
- Checkbox for each rejected recipient
- Recipient name with User icon
- "BYPASSED" badge (red)
- Rejection reason (if available)
- Hover effect for better UX

**Quick Actions:**
- "Select All" button
- "Deselect All" button

**Re-Upload Section:**
- "Upload New Files" button
- File picker integration
- Success/error toast notifications

**Footer:**
- "Cancel" button (closes dialog)
- "Resend to X Recipients" button (disabled if none selected)

---

## 🔄 Workflow Status Flow

### **Before Resend:**
```
✅ Recipient 1: completed
❌ Recipient 2: bypassed
✅ Recipient 3: completed
❌ Recipient 4: bypassed

bypassed_recipients: ["Recipient 2", "Recipient 4"]
```

### **User Selects Only Recipient 2:**
```
Selected: ["Recipient 2"]
Unselected: ["Recipient 4"]
```

### **After Resend:**
```
✅ Recipient 1: completed
🔄 Recipient 2: resent (receives approval card)
✅ Recipient 3: completed
❌ Recipient 4: bypassed (no change)

bypassed_recipients: ["Recipient 4"]
resubmitted_recipients: ["Recipient 2"]
```

---

## 🧪 Testing Guide

### **Test Case 1: Select Single Recipient**

**Setup:**
- Create bi-directional document with 4 recipients
- 2 recipients reject the document

**Steps:**
1. Login as submitter
2. Go to Track Documents
3. Click "Choose & Resend" button
4. Select only 1 rejected recipient
5. Click "Resend to 1 Recipient(s)"

**Expected:**
- Selected recipient receives approval card
- Unselected recipient remains bypassed
- Success toast shows "resent to 1 recipient(s)"

### **Test Case 2: Select All Recipients**

**Steps:**
1. Click "Choose & Resend"
2. Click "Select All" button
3. Click "Resend to 2 Recipients"

**Expected:**
- All rejected recipients receive approval cards
- All recipients show "Re-Submitted" badge
- `bypassed_recipients` array becomes empty

### **Test Case 3: Re-Upload Files Before Resend**

**Steps:**
1. Click "Choose & Resend"
2. Select recipients
3. Click "Upload New Files"
4. Select revised document files
5. Wait for "Files Updated" toast
6. Click "Resend to X Recipients"

**Expected:**
- Files uploaded successfully
- Selected recipients receive approval cards with NEW files
- Old files are replaced

### **Test Case 4: Cancel Without Resending**

**Steps:**
1. Click "Choose & Resend"
2. Select some recipients
3. Click "Cancel" button

**Expected:**
- Dialog closes
- No changes to workflow
- No recipients notified

---

## 🎯 User Scenarios

### **Scenario 1: Partial Fix**

**Situation:**
- Principal rejects: "Add financial details"
- Registrar rejects: "Wrong signature format"
- You only fixed financial details today

**Solution:**
1. Click "Choose & Resend"
2. Select only Principal
3. Upload revised document with financial details
4. Click "Resend to 1 Recipient"
5. Principal receives updated document
6. Registrar remains bypassed (fix tomorrow)

### **Scenario 2: Different Issues**

**Situation:**
- 4 recipients, 3 reject with different reasons
- You fixed issues for 2 recipients only

**Solution:**
1. Click "Choose & Resend"
2. Select the 2 recipients whose issues are fixed
3. Upload revised document
4. Click "Resend to 2 Recipients"
5. Only those 2 receive the document
6. 1 recipient remains bypassed

### **Scenario 3: Resend Without Changes**

**Situation:**
- Recipient rejected by mistake
- No document changes needed

**Solution:**
1. Click "Choose & Resend"
2. Select the recipient
3. Don't upload new files
4. Click "Resend to 1 Recipient"
5. Recipient receives original document again

---

## 📈 Benefits

### **For Submitters:**
✅ **Control** - Choose exactly who receives the document  
✅ **Efficiency** - Don't resend to recipients whose issues aren't fixed yet  
✅ **Flexibility** - Handle different rejection reasons separately  
✅ **Transparency** - See rejection reasons before deciding  

### **For Recipients:**
✅ **Relevance** - Only receive documents when their issues are addressed  
✅ **Clarity** - "Re-Submitted" badge shows it's a resubmission  
✅ **Efficiency** - Don't review documents that aren't ready for them  

### **For System:**
✅ **Audit Trail** - Tracks who was resent and when  
✅ **Status Accuracy** - Proper workflow state management  
✅ **Performance** - Selective updates reduce unnecessary notifications  

---

## 🔐 Security & Permissions

### **Who Can Use This Feature:**
- Document submitter (owner) only
- Verified by checking `submittedBy` matches current user

### **Validation:**
- Must be bi-directional routing type
- Must have bypassed recipients
- Must select at least 1 recipient to resend

### **Audit Logging:**
- Blockchain event logged with action: `BYPASS_APPROVED`
- Records selected recipient names
- Tracks timestamp of resubmission

---

## 🐛 Error Handling

### **No Recipients Selected:**
- "Resend" button is disabled
- User must select at least 1 recipient

### **File Upload Fails:**
- Error toast: "Failed to upload files"
- User can retry upload
- Can still resend without new files

### **Resend Fails:**
- Error toast: "Failed to resend document"
- Dialog remains open
- User can retry

### **Network Issues:**
- Graceful error messages
- No partial updates (transaction-based)
- User can retry operation

---

## 📝 Future Enhancements

### **Potential Improvements:**

1. **Bulk Actions**
   - Resend to multiple documents at once
   - Select recipients across multiple documents

2. **Scheduled Resend**
   - Schedule resend for specific date/time
   - Automatic resend after file upload

3. **Recipient Notifications**
   - Email notification to selected recipients
   - SMS notification option

4. **Analytics**
   - Track resend success rates
   - Monitor recipient response times
   - Dashboard for resubmission metrics

5. **Templates**
   - Save recipient selection as template
   - Quick apply for similar documents

---

## ✅ Verification Checklist

- [x] WorkflowService method implemented
- [x] DocumentTracker dialog added
- [x] Database migration created
- [x] State management configured
- [x] File upload integration
- [x] Error handling implemented
- [x] Success notifications added
- [x] Blockchain audit logging
- [x] UI/UX polished
- [x] Documentation complete

---

## 🎉 Summary

The **Selective Recipient Resend** feature provides document submitters with **granular control** over which rejected recipients receive re-uploaded documents in bi-directional routing workflows.

**Key Capabilities:**
- ✅ Visual recipient selection with checkboxes
- ✅ Optional file re-upload before resending
- ✅ Selective status updates (only selected recipients)
- ✅ Proper audit trail and blockchain logging
- ✅ Intuitive UI with clear feedback

**Result:** Submitters can now efficiently manage document resubmissions by choosing exactly which recipients should receive revised documents, improving workflow efficiency and reducing unnecessary notifications.
