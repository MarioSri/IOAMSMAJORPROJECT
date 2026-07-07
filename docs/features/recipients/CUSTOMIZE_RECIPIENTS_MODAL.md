# Implementation Guide: Customize Recipients Modal

## Changes Required:

### 1. Add State (Line 103):
```typescript
const [showCustomizeModal, setShowCustomizeModal] = useState(false);
```

### 2. Update Button Click (Line 730):
Change from:
```typescript
onClick={() => {
  const allOpen = selectedRecipients.reduce((acc, id) => ({...acc, [id]: true}), {});
  setOpenRecipients(allOpen);
}}
```

To:
```typescript
onClick={() => setShowCustomizeModal(true)}
```

### 3. Remove Inline Section (Lines 900-1100):
Remove the entire inline "Customize Notifications per Recipient" section that appears after WhatsApp Notifications.

### 4. Add Modal Before Document Assignment Modal (Line 1300):
Add the new Customize Recipients Modal with ScrollArea containing all recipient cards.

The modal will open when user clicks "Customize Recipients" button and display all recipients in a scrollable dialog.
