# Activity Log Implementation Guide

## Overview
This guide outlines where and how to implement a comprehensive activity log (user log) system in the DOrSU Connect application.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     ACTIVITY LOG SYSTEM                      │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│   Backend    │      │   Database   │      │   Frontend   │
│   Services   │      │   MongoDB    │      │   Screens    │
└──────────────┘      └──────────────┘      └──────────────┘
```

## Implementation Locations

### 1. Backend Service Layer

#### File: `backend/src/services/activity-log.js` (NEW)
**Purpose**: Core service for logging and retrieving user activities

**Key Methods**:
- `logActivity(userId, action, details, metadata)` - Log a user activity
- `getActivityLogs(filters, pagination)` - Retrieve activity logs with filtering
- `getActivityLogsByUser(userId, limit, skip)` - Get logs for specific user
- `getActivityLogsByAction(action, limit, skip)` - Get logs by action type

**Activity Types to Log**:
- `user.login` - User login
- `user.logout` - User logout
- `user.register` - User registration
- `user.profile_update` - Profile updates
- `user.password_change` - Password changes
- `admin.role_change` - Role changes (admin/mod/user)
- `admin.user_delete` - User account deletion
- `admin.post_create` - Post creation
- `admin.post_update` - Post updates
- `admin.post_delete` - Post deletion
- `admin.settings_update` - Settings changes

#### File: `backend/src/services/mongodb.js` (UPDATE)
**Add Methods**:
```javascript
async logActivity(userId, action, details = {}, metadata = {}) {
  // Log activity to activity_logs collection
}

async getActivityLogs(filters = {}, limit = 100, skip = 0) {
  // Retrieve activity logs with filtering
}
```

**Update `initializeIndexes()`**:
```javascript
// Add indexes for activity logs
await activityLogsCollection.createIndex({ userId: 1, timestamp: -1 });
await activityLogsCollection.createIndex({ action: 1, timestamp: -1 });
await activityLogsCollection.createIndex({ timestamp: -1 });
```

#### File: `backend/src/config/mongodb.config.js` (UPDATE)
**Add Collection**:
```javascript
collections: {
  // ... existing collections
  activityLogs: 'activity_logs'
}
```

### 2. Integration Points (Add Logging Calls)

#### File: `backend/src/services/auth.js`
**Locations**:
- After successful login → `logActivity(userId, 'user.login', { method: 'email/google' })`
- After logout → `logActivity(userId, 'user.logout')`
- After registration → `logActivity(userId, 'user.register', { email, method })`

#### File: `backend/src/server.js`
**Locations**:
- `PUT /api/users/:id/role` → `logActivity(adminUserId, 'admin.role_change', { targetUserId, oldRole, newRole })`
- `DELETE /api/users/:id` → `logActivity(adminUserId, 'admin.user_delete', { deletedUserId, deletedUserEmail })`
- Post creation/update/deletion endpoints → Log respective actions

#### File: `backend/src/services/posts.js` (if exists)
**Locations**:
- Post creation → `logActivity(userId, 'admin.post_create', { postId, title })`
- Post update → `logActivity(userId, 'admin.post_update', { postId, title })`
- Post deletion → `logActivity(userId, 'admin.post_delete', { postId, title })`

### 3. API Endpoints

#### File: `backend/src/server.js` (ADD)
**New Endpoints**:
```javascript
// GET /api/activity-logs - Get all activity logs (admin only)
// GET /api/activity-logs/user/:userId - Get logs for specific user
// GET /api/activity-logs/action/:action - Get logs by action type
// GET /api/activity-logs/search?query=... - Search logs
```

**Example Implementation**:
```javascript
if (method === 'GET' && url === '/api/activity-logs') {
  const auth = await authMiddleware(authService, mongoService)(req);
  if (!auth.authenticated || !auth.isAdmin) {
    sendJson(res, 403, { error: 'Forbidden: Admin access required' });
    return;
  }
  
  const urlObj = new URL(req.url, `http://${req.headers.host}`);
  const limit = parseInt(urlObj.searchParams.get('limit') || '100');
  const skip = parseInt(urlObj.searchParams.get('skip') || '0');
  const userId = urlObj.searchParams.get('userId');
  const action = urlObj.searchParams.get('action');
  const startDate = urlObj.searchParams.get('startDate');
  const endDate = urlObj.searchParams.get('endDate');
  
  const logs = await activityLogService.getActivityLogs({
    userId,
    action,
    startDate,
    endDate
  }, limit, skip);
  
  sendJson(res, 200, { logs, total: logs.length });
  return;
}
```

### 4. Frontend Service Layer

#### File: `frontend/src/services/ActivityLogService.ts` (NEW)
**Purpose**: Handle API calls for activity logs

**Methods**:
```typescript
class ActivityLogService {
  async getActivityLogs(filters?: ActivityLogFilters): Promise<ActivityLog[]>
  async getActivityLogsByUser(userId: string): Promise<ActivityLog[]>
  async getActivityLogsByAction(action: string): Promise<ActivityLog[]>
  async searchActivityLogs(query: string): Promise<ActivityLog[]>
}
```

**Types**:
```typescript
export interface ActivityLog {
  _id: string;
  userId: string;
  userEmail?: string;
  userName?: string;
  action: string;
  details: Record<string, any>;
  metadata: {
    ipAddress?: string;
    userAgent?: string;
    timestamp: Date;
  };
  createdAt: Date;
}

export interface ActivityLogFilters {
  userId?: string;
  action?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  skip?: number;
}
```

### 5. Frontend Screen

#### File: `frontend/src/screens/admin/ActivityLog.tsx` (NEW)
**Purpose**: Display activity logs in admin panel

**Features**:
- Table/list view of activity logs
- Filters:
  - User filter (dropdown)
  - Action type filter (dropdown)
  - Date range picker
  - Search bar
- Pagination
- Export to CSV (optional)
- Real-time updates (optional)

**Design**: Match the style of `ManageAccounts.tsx` and `AdminDashboard.tsx`

**Key Components**:
- Search bar (similar to ManageAccounts)
- Filter dropdowns
- Activity log table with columns:
  - Timestamp
  - User (with profile picture/initials)
  - Action
  - Details
  - Metadata (IP, User Agent - expandable)

### 6. Navigation Integration

#### File: `frontend/src/navigation/AppNavigator.tsx` (UPDATE)
**Add Screen**:
```typescript
import ActivityLog from '../screens/admin/ActivityLog';

<Stack.Screen
  name="ActivityLog"
  component={ActivityLog}
  options={{
    headerShown: false,
    animationDuration: 0,
  }}
/>
```

#### File: `frontend/src/components/navigation/AdminSidebar.tsx` (UPDATE)
**Add Menu Item**:
```typescript
<TouchableOpacity
  style={styles.sidebarMenuItem}
  onPress={() => {
    onClose();
    navigation.navigate('ActivityLog');
  }}
>
  <Ionicons
    name={currentScreen === 'ActivityLog' ? 'list' : 'list-outline'}
    size={24}
    color={currentScreen === 'ActivityLog' ? t.colors.accent : (isDarkMode ? '#9CA3AF' : '#6B7280')}
  />
  <Text style={[styles.sidebarMenuText, {
    color: currentScreen === 'ActivityLog' ? t.colors.accent : (isDarkMode ? '#D1D5DB' : '#4B5563'),
    fontWeight: currentScreen === 'ActivityLog' ? '600' : '500',
    fontSize: t.fontSize.scaleSize(16)
  }]}>
    Activity Log
  </Text>
</TouchableOpacity>
```

## Database Schema

### Collection: `activity_logs`

```javascript
{
  _id: ObjectId,
  userId: String,           // User who performed the action
  userEmail: String,        // Cached for quick display
  userName: String,          // Cached for quick display
  action: String,           // e.g., 'user.login', 'admin.role_change'
  details: Object,          // Action-specific details
  metadata: {
    ipAddress: String,      // User's IP address
    userAgent: String,      // Browser/device info
    timestamp: Date         // When action occurred
  },
  createdAt: Date,         // Document creation time
  updatedAt: Date           // Last update time
}
```

## Activity Types Reference

### User Actions
- `user.login` - User logged in
- `user.logout` - User logged out
- `user.register` - New user registration
- `user.profile_update` - Profile information updated
- `user.password_change` - Password changed
- `user.email_verify` - Email verified

### Admin Actions
- `admin.role_change` - User role changed
- `admin.user_delete` - User account deleted
- `admin.user_create` - User created (if admin creates users)
- `admin.post_create` - Post/announcement created
- `admin.post_update` - Post/announcement updated
- `admin.post_delete` - Post/announcement deleted
- `admin.settings_update` - System settings updated

## Implementation Priority

### Phase 1: Core Infrastructure
1. ✅ Create `activity-log.js` service
2. ✅ Update MongoDB config
3. ✅ Add database methods to `mongodb.js`
4. ✅ Create API endpoints

### Phase 2: Integration
1. ✅ Add logging to authentication flows
2. ✅ Add logging to user management
3. ✅ Add logging to admin actions

### Phase 3: Frontend
1. ✅ Create `ActivityLogService.ts`
2. ✅ Create `ActivityLog.tsx` screen
3. ✅ Add navigation routes
4. ✅ Add sidebar menu item

### Phase 4: Enhancement
1. ⚠️ Add real-time updates
2. ⚠️ Add export functionality
3. ⚠️ Add advanced filtering
4. ⚠️ Add activity statistics dashboard

## Security Considerations

1. **Access Control**: Only admins can view activity logs
2. **Data Privacy**: Mask sensitive information (passwords, tokens)
3. **Rate Limiting**: Prevent log flooding
4. **Data Retention**: Consider automatic cleanup of old logs (optional)
5. **IP Address**: Store IPs for security auditing but respect privacy

## Performance Considerations

1. **Indexing**: Ensure proper indexes on frequently queried fields
2. **Pagination**: Always paginate results
3. **Caching**: Cache user info (email, name) to avoid lookups
4. **Archiving**: Consider archiving old logs to separate collection

## Example Usage

### Backend Logging
```javascript
// In auth.js after successful login
await activityLogService.logActivity(
  userId,
  'user.login',
  { method: 'email' },
  {
    ipAddress: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
    userAgent: req.headers['user-agent'],
    timestamp: new Date()
  }
);
```

### Frontend Display
```typescript
// In ActivityLog.tsx
const logs = await ActivityLogService.getActivityLogs({
  action: 'admin.role_change',
  startDate: '2024-01-01',
  endDate: '2024-12-31'
});
```

## Next Steps

1. Review this guide
2. Create the backend service file
3. Update MongoDB configuration
4. Add logging calls to existing endpoints
5. Create frontend service and screen
6. Test the implementation
7. Deploy and monitor

---

**Note**: This is a comprehensive system. Consider implementing in phases to manage complexity and ensure quality.

