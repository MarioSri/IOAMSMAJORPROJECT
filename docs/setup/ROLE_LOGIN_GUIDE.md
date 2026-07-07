# Role-Based Login Flow - IAOMS

## 🔐 Login Process Overview

When users login to the IAOMS system, they are automatically redirected to their role-specific dashboard with customized navigation and features based on their selected role.

## 🎯 Login Flow Steps

### 1. **Access Login Page**
- Navigate to `http://localhost:8084/`
- System displays authentication card with role selection

### 2. **Select Role**
Choose from the dropdown menu:
- **Principal** 👑 - Full administrative access
- **Registrar** 🛡️ - Academic administration 
- **Program Department Head** 👥 - Program-specific management
- **HOD** 👥 - Department leadership
- **Employee** 💼 - Basic staff access

### 3. **Authentication Process**
- Click "Sign In" button
- System shows loading animation (2-second simulation)
- Success toast notification displays role confirmation
- Automatic redirect to `/dashboard`

### 4. **Role-Based Dashboard Access**
Each role receives a customized interface:

#### **Principal Login Result:**
```
✅ User: Dr. Robert Smith
✅ Role: Principal  
✅ Email: principal@hitam.org
✅ Navigation: Full access (Dashboard, Documents, Workflow, Approvals, Analytics)
✅ Permissions: Can approve, view all departments, manage workflows, view analytics, manage users
✅ Theme: Purple with Crown icon
```

#### **Registrar Login Result:**
```
✅ User: Prof. Sarah Johnson
✅ Role: Registrar
✅ Email: registrar@hitam.org  
✅ Navigation: Administrative access (Dashboard, Documents, Workflow, Approvals, Analytics)
✅ Permissions: Can approve, view all departments, manage workflows, view analytics
✅ Theme: Blue with Shield icon
```

#### **Program Department Head Login Result:**
```
✅ User: Prof. Anita Sharma
✅ Role: Program Department Head
✅ Department: Electronics & Communication
✅ Branch: ECE
✅ Email: program-head@hitam.org
✅ Navigation: Program management (Dashboard, Documents, Workflow, Approvals, Analytics)
✅ Permissions: Can approve, manage workflows, view analytics (department-specific)
✅ Theme: Green with Users icon
```

#### **HOD Login Result:**
```
✅ User: Dr. Rajesh Kumar
✅ Role: Head of Department
✅ Department: Computer Science & Engineering
✅ Branch: CSE
✅ Email: hod@hitam.org
✅ Navigation: Department management (Dashboard, Documents, Workflow, Approvals, Analytics)
✅ Permissions: Can approve, manage workflows, view analytics (department-specific)
✅ Theme: Orange with Users icon
```

#### **Employee Login Result:**
```
✅ User: Mr. John Doe
✅ Role: Employee
✅ Email: employee@hitam.org
✅ Navigation: Basic access (Dashboard, Documents, Workflow)
✅ Permissions: Manage workflows only
✅ Theme: Gray with Briefcase icon
```

## 📱 Interface Elements After Login

### **Header Navigation**
- **Toggle Sidebar**: Collapsible navigation
- **IAOMS Dashboard**: Title with role indicator
- **Role Badge**: Color-coded role identification
- **Search Button**: Universal search access
- **Profile Dropdown**: Role-specific options

### **Sidebar Navigation**
Role-based menu items:
- **All Roles**: Dashboard, Search, Documents, Calendar, Messages, Advanced Signature, Reminders, Emergency
- **Approval Roles**: + Workflow Management, Approvals, Analytics
- **Employee**: + Workflow Management only

### **Mobile Navigation**
- Responsive bottom navigation
- Role-specific quick access buttons
- Notification badges for approval roles

## 🔄 Role Switching Process

### **Logout and Re-login:**
1. Click profile dropdown in header
2. Select "Sign Out" 
3. System redirects to login page
4. Select different role
5. Experience different interface and permissions

## 🛡️ Security Features

### **Protected Routes**
- All dashboard pages require authentication
- Role-specific permissions enforced
- Automatic redirect for unauthorized access

### **Permission Validation**
- **Approvals page**: Requires `canApprove` permission
- **Analytics page**: Requires `canViewAnalytics` permission  
- **Workflow page**: Requires `canManageWorkflows` permission

## 🎨 Visual Indicators

### **Role Themes**
Each role has distinct visual identity:
- **Principal**: Purple theme with Crown icon
- **Registrar**: Blue theme with Shield icon
- **Program Head**: Green theme with Users icon
- **HOD**: Orange theme with Users icon
- **Employee**: Gray theme with Briefcase icon

### **Success Notifications**
After successful login, users see:
```
🎉 Welcome to IAOMS!
Successfully logged in as [Role Name]
```

## ✅ Testing the Login Flow

### **Test Scenario 1: Principal Access**
1. Go to login page
2. Select "Principal" from dropdown
3. Click "Sign In"
4. Verify: Full navigation, purple theme, crown icon
5. Check: All menu items available

### **Test Scenario 2: Employee Access**
1. Go to login page  
2. Select "Employee" from dropdown
3. Click "Sign In"
4. Verify: Limited navigation, gray theme, briefcase icon
5. Check: No "Approvals" menu item

## 🔧 Technical Implementation

### **Authentication Context**
- User state management
- Role-based permission calculation
- Persistent login state (localStorage)

### **Protected Route System**
- Route-level authentication checks
- Permission-based access control
- Automatic redirection handling

### **Responsive Layout**
- Desktop: Full sidebar and header
- Mobile: Bottom navigation and mobile header
- Consistent role theming across all devices

This comprehensive role-based login system ensures that each user type receives appropriate access levels while maintaining security and usability standards.
