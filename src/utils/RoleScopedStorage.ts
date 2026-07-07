/**
 * RoleScopedStorage - Provides role-isolated localStorage/sessionStorage
 */

type RoleType = 'real';

class RoleScopedStorage {
  private getRoleType(userRole: string): RoleType {
    return 'real';
  }

  private getScopedKey(userRole: string, key: string): string {
    const roleType = this.getRoleType(userRole);
    return `${roleType}:${key}`;
  }

  setItem(userRole: string, key: string, value: string): void {
    const scopedKey = this.getScopedKey(userRole, key);
    try {
      localStorage.setItem(scopedKey, value);
    } catch (error) {
      console.error(`[RoleScopedStorage] Failed to save ${scopedKey}:`, error);
      throw error;
    }
  }

  getItem(userRole: string, key: string): string | null {
    const scopedKey = this.getScopedKey(userRole, key);
    try {
      return localStorage.getItem(scopedKey);
    } catch (error) {
      console.error(`[RoleScopedStorage] Failed to read ${scopedKey}:`, error);
      return null;
    }
  }

  removeItem(userRole: string, key: string): void {
    const scopedKey = this.getScopedKey(userRole, key);
    try {
      localStorage.removeItem(scopedKey);
    } catch (error) {
      console.error(`[RoleScopedStorage] Failed to remove ${scopedKey}:`, error);
    }
  }

  clearRoleStorage(userRole: string): void {
    const roleType = this.getRoleType(userRole);
    const prefix = `${roleType}:`;
    const keysToRemove: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
    });
  }

  migrateOldKeys(userRole: string, oldKeys: string[]): void {
    const roleType = this.getRoleType(userRole);

    oldKeys.forEach(oldKey => {
      const value = localStorage.getItem(oldKey);
      if (value) {
        const newKey = `${roleType}:${oldKey}`;
        localStorage.setItem(newKey, value);
        localStorage.removeItem(oldKey);
      }
    });
  }

  hasOldUnscopedKeys(keysToCheck: string[]): boolean {
    return keysToCheck.some(key => localStorage.getItem(key) !== null);
  }

  getRoleKeys(userRole: string): string[] {
    const roleType = this.getRoleType(userRole);
    const prefix = `${roleType}:`;
    const keys: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        keys.push(key.substring(prefix.length));
      }
    }

    return keys;
  }
}

export const roleScopedStorage = new RoleScopedStorage();

export const STORAGE_KEYS = {
  PENDING_APPROVALS: 'pending-approvals',
  SUBMITTED_DOCUMENTS: 'submitted-documents',
  APPROVAL_HISTORY: 'approval-history-new',
  LIVEMEET_REQUESTS: 'livemeet-requests',
  // Comments migrated to Supabase approval_comments table — keys below kept for backward compat reference only
  // APPROVAL_COMMENTS: 'approval-comments',
  // SHARED_COMMENTS: 'shared-comments',
  // DOCUMENT_COMMENTS: 'document-comments',
  MEETINGS: 'meetings',
  REMINDERS: 'reminders',
  CHANNELS: 'channels',
  STICKY_NOTES: 'stickyNotes',
  RECIPIENTS: 'recipients'
} as const;
