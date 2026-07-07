# Role-Based Navigation System - IAOMS

## Overview
The IAOMS (Institutional Academic Operations Management System) implements a comprehensive role-based navigation system that provides different interface elements and access levels based on user roles.

## Supported Roles

### 1. **Principal** 👑
- **Icon**: Crown
- **Color**: Purple theme
- **Description**: Institution Principal
- **Permissions**: Full system access
  - Can approve documents
  - Can view all departments
  - Can manage workflows
  - Can view analytics
  - Can manage users

### 2. **Registrar** 🛡️
- **Icon**: Shield
- **Color**: Blue theme
- **Description**: Academic Registrar
- **Permissions**: Administrative access
  - Can approve documents
  - Can view all departments
  - Can manage workflows
  - Can view analytics
  - Cannot manage users

### 3. **Program Department Head** 👥
- **Icon**: Users
- **Color**: Green theme
- **Description**: Program Department Head
- **Permissions**: Department-level access
  - Can approve documents
  - Cannot view all departments
  - Can manage workflows
  - Can view analytics
  - Cannot manage users

### 4. **HOD (Head of Department)** 👥
- **Icon**: Users
- **Color**: Orange theme
- **Description**: Head of Department
- **Permissions**: Department-level access
  - Can approve documents
  - Cannot view all departments
  - Can manage workflows
  - Can view analytics
  - Cannot manage users

### 5. **Employee** 💼
- **Icon**: Briefcase
- **Color**: Gray theme
- **Description**: Staff Member
- **Permissions**: Basic access
  - Cannot approve documents
  - Cannot view all departments
  - Can manage workflows
  - Cannot view analytics
  - Cannot manage users

## Navigation Elements

### Main Navigation Header
- **Toggle Sidebar**: Collapsible sidebar navigation
- **IAOMS Dashboard**: Main dashboard title with role indicator
- **Role Badge**: Color-coded badge showing current user role
- **Dashboard Button**: Quick access to dashboard home
- **Search Button**: Universal search functionality
- **Profile Settings**: Role-specific profile dropdown

### Sidebar Navigation
The sidebar shows different menu items based on user role:

#### Common Navigation (All Roles)
- Dashboard
- Search
- Documents
- Calendar
- Messages
- Advanced Signature
- Reminders
- Emergency

#### Role-Specific Navigation
- **Principal, Registrar, Program Head, HOD**: Additional access to
  - Workflow Management
  - Approvals
  - Analytics

- **Employee**: Limited to
  - Workflow Management
  - Analytics (basic view)

### Mobile Bottom Navigation
Responsive mobile navigation that adapts based on role:
- **All Roles**: Home, Search, Docs
- **Approval Roles**: Approve button (with notification badge)
- **Employee**: Workflow button instead of Approve

### Profile Settings Dropdown
Role-specific profile information including:
- Role icon and title
- Role description
- Profile Settings access
- System Settings
- Sign Out functionality

## Visual Indicators

### Role Colors
- **Principal**: Purple (`bg-purple-100 text-purple-700 border-purple-200`)
- **Registrar**: Blue (`bg-blue-100 text-blue-700 border-blue-200`)
- **Program Head**: Green (`bg-green-100 text-green-700 border-green-200`)
- **HOD**: Orange (`bg-orange-100 text-orange-700 border-orange-200`)
- **Employee**: Gray (`bg-gray-100 text-gray-700 border-gray-200`)

### Role Icons
- **Principal**: Crown icon
- **Registrar**: Shield icon
- **Program Head**: Users icon
- **HOD**: Users icon
- **Employee**: Briefcase icon

## Authentication Flow
1. User selects role from dropdown on login page
2. System authenticates and sets user context
3. Navigation elements adapt based on selected role
4. Permissions are enforced throughout the application
5. Role indicator appears in header and sidebar

## Technical Implementation

### Components
- `AuthenticationCard.tsx`: Role selection during login
- `DashboardLayout.tsx`: Main layout with role-based header
- `DashboardSidebar.tsx`: Sidebar with role-specific navigation
- `MobileBottomNav.tsx`: Mobile navigation adaptation
- `AuthContext.tsx`: Role management and permissions

### Role Management
- User role stored in AuthContext
- Permissions calculated based on role
- Navigation items filtered by role permissions
- Visual elements styled according to role theme

## Usage Examples

### Login as Principal
- Full navigation access
- Purple theme indicators
- Crown icon throughout interface
- All administrative features available

### Login as Employee
- Limited navigation options
- Gray theme indicators
- Briefcase icon
- Basic workflow access only

## Security Features
- Role-based access control
- Permission validation
- Restricted navigation based on role
- Secure logout functionality that redirects to login

This role-based navigation system ensures that each user type has appropriate access levels while maintaining a consistent and intuitive interface design.
