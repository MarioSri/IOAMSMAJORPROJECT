# Emergency Document to Approval Center Implementation

## Overview
This implementation creates approval cards in the Approval Center → Pending Approvals section when documents are submitted from the Emergency Management page, following the exact UI layout and design of existing approval cards.

## Key Features Implemented

### 1. Emergency Document Card Creation
- When a user submits a document from Emergency Management page with selected recipients
- A corresponding approval card is automatically created in the Approval Center
- The card follows the exact UI layout of the "Student Event Proposal – Tech Fest 2024" card

### 2. File Upload and Preview Support
- Uploaded files from Emergency Management are converted to base64 for storage
- Files are accessible via the "View" button on approval cards
- FileViewer component displays the actual uploaded files
- Fallback to demo HTML file if no files are uploaded

### 3. Emergency Document Styling
- Emergency documents have distinctive red border and background
- Animated pulse effect for urgent attention
- "EMERGENCY" badge with alert triangle icon
- Emergency features section showing auto-escalation, smart delivery, and notification settings

### 4. Real-time Updates
- Event-driven architecture using custom events
- Approval cards appear immediately when emergency documents are submitted
- No page refresh required

## Implementation Details

### Modified Files

#### 1. EmergencyWorkflowInterface.tsx
- Enhanced `createEmergencyDocumentCard` function to create both Track Documents and Approval Center cards
- Added approval card creation with proper structure matching existing cards
- File serialization to base64 for localStorage storage
- Event dispatching for real-time updates

#### 2. Approvals.tsx
- Added event listener for `approval-card-created` events
- Enhanced `createDocumentFile` function to handle uploaded files from Emergency Management
- Added emergency document styling and features display
- Updated pending approvals counter

### Data Structure

#### Approval Card Structure
```javascript
{
  id: string,
  title: string,
  type: 'Letter' | 'Circular' | 'Report',
  submitter: string,
  submittedDate: string,
  priority: 'medium' | 'urgent' | 'high' | 'critical',
  description: string,
  files: Array<{name, size, type, data}>, // base64 serialized
  recipients: string[],
  isEmergency: boolean,
  emergencyFeatures: {
    autoEscalation: boolean,
    escalationTimeout: number,
    escalationTimeUnit: string,
    notificationSettings: string,
    smartDelivery: boolean
  }
}
```

### Event Flow

1. User submits emergency document with recipients
2. `createEmergencyDocumentCard` function is called
3. Creates card for Track Documents page
4. Creates approval card for Approval Center page
5. Saves both to localStorage
6. Dispatches `approval-card-created` event
7. Approval Center page receives event and updates UI
8. New approval card appears with emergency styling

### File Handling

1. Files uploaded in Emergency Management are converted to base64
2. Stored in approval card data structure
3. When "View" button is clicked, base64 is converted back to File object
4. FileViewer component displays the actual uploaded file
5. Emergency document information is embedded in fallback HTML

## Usage

1. Navigate to Emergency Management page
2. Activate Emergency Mode
3. Fill in document details and upload files
4. Select recipients
5. Submit emergency document
6. Navigate to Approval Center → Pending Approvals
7. See the new approval card with emergency styling
8. Click "View" to preview uploaded files
9. Use standard approval workflow (Approve & Sign, Reject, etc.)

## Benefits

- Seamless integration between Emergency Management and Approval Center
- Maintains exact UI consistency with existing approval cards
- Real-time updates without page refresh
- Full file upload and preview support
- Emergency document prioritization with visual indicators
- Preserves all emergency features and settings in approval workflow