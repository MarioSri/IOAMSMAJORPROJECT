import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { roleScopedStorage } from '@/utils/RoleScopedStorage';
import { verifyGoogleUser, signOut, AuthResult } from '@/services/AuthService';
import { userProfileService } from '@/services/UserProfileService';
import { WebPushService } from '@/services/WebPushService';
import type { PushSubscriptionData } from '@/lib/webpush';

// ── JWT helpers ─────────────────────────────────────────────────────────────

/**
 * Returns true when the persisted session token has definitely expired.
 * We add a 60-second safety buffer so we never serve a token that is
 * about to expire in the next request cycle.
 */
export function isJwtExpired(expiresAt: number | undefined): boolean {
  if (!expiresAt) return false; // unknown expiry — let Supabase decide
  return Date.now() / 1000 > expiresAt - 60;
}

export interface User {
  id: string;
  /** The role_recipients.id UUID — canonical recipient identifier for workflow matching. */
  recipientId?: string;
  name: string;
  email: string;
  role: 'principal' | 'registrar' | 'hod' | 'program-head' | 'employee';
  department?: string;
  branch?: string;
  avatar?: string;
  employee_id?: string;
  designation?: string;
  permissions: {
    canApprove: boolean;
    canViewAllDepartments: boolean;
    canManageWorkflows: boolean;
    canViewAnalytics: boolean;
    canManageUsers: boolean;
  };
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  justLoggedIn: boolean;
  loginWithResult: (result: AuthResult, supabaseUserId?: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: ReactNode;
}

type RolePermissions = User['permissions'];

const ROLE_PERMISSIONS: Record<User['role'], RolePermissions> = {
  principal: {
    canApprove: true,
    canViewAllDepartments: true,
    canManageWorkflows: true,
    canViewAnalytics: true,
    canManageUsers: true,
  },
  registrar: {
    canApprove: true,
    canViewAllDepartments: true,
    canManageWorkflows: true,
    canViewAnalytics: true,
    canManageUsers: false,
  },
  hod: {
    canApprove: true,
    canViewAllDepartments: false,
    canManageWorkflows: true,
    canViewAnalytics: true,
    canManageUsers: false,
  },
  'program-head': {
    canApprove: true,
    canViewAllDepartments: false,
    canManageWorkflows: true,
    canViewAnalytics: true,
    canManageUsers: false,
  },
  employee: {
    canApprove: true,
    canViewAllDepartments: false,
    canManageWorkflows: true,
    canViewAnalytics: true,
    canManageUsers: false,
  },
};

function getUserPermissions(role: string): RolePermissions {
  return ROLE_PERMISSIONS[role as User['role']] ?? ROLE_PERMISSIONS.employee;
}



function buildUserFromResult(result: AuthResult, supabaseUserId?: string): User {
  const role = (result.role ?? 'employee') as User['role'];
  return {
    id: supabaseUserId ?? `${role}-${Date.now()}`,
    recipientId: result.recipientId,
    name: result.name ?? '',
    email: result.email ?? '',
    role,
    department: result.department ?? '',
    branch: result.branch ?? '',
    employee_id: result.employee_id ?? '',
    designation: result.designation ?? '',
    avatar: result.avatar ?? '',
    permissions: getUserPermissions(role),
  };
}

/** Persisted user shape — includes optional JWT expiry for stale-session detection. */
interface PersistedUser extends User {
  _jwtExpiresAt?: number; // Unix timestamp (seconds)
}

// ── Session persistence helpers ─────────────────────────────────────────────
// localStorage is used instead of sessionStorage so that the persisted user
// survives tab duplication, browser-restore, and background-tab reactivation.
// No auth tokens are stored here — only the user profile metadata.

const IAOMS_USER_KEY = 'iaoms-user-v2';

function persistUser(u: User, session?: Session): void {
  const payload: PersistedUser = {
    ...u,
    _jwtExpiresAt: session?.expires_at ?? undefined,
  };
  localStorage.setItem(IAOMS_USER_KEY, JSON.stringify(payload));
}

function clearPersistedUser(): void {
  localStorage.removeItem(IAOMS_USER_KEY);
}

function loadPersistedUser(): User | null {
  const saved = localStorage.getItem(IAOMS_USER_KEY);
  if (!saved) return null;
  try {
    const parsed = JSON.parse(saved) as PersistedUser;

    if (isJwtExpired(parsed._jwtExpiresAt)) {
      console.warn('[AuthContext] Persisted session JWT expired — clearing.');
      localStorage.removeItem(IAOMS_USER_KEY);
      return null;
    }

    const { _jwtExpiresAt: _, ...user } = parsed;
    return { ...user, permissions: getUserPermissions(user.role) };
  } catch {
    localStorage.removeItem(IAOMS_USER_KEY);
    return null;
  }
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => loadPersistedUser());
  const hasPersistedUserRef = useRef<boolean>(!!loadPersistedUser());
  const [isLoading, setIsLoading] = useState<boolean>(() => {
    const persisted = loadPersistedUser();
    if (persisted) return false;
    return true;
  });
  const [justLoggedIn, setJustLoggedIn] = useState(false);

  const isAuthenticated = !!user;

  useEffect(() => {
    let mounted = true;

    const loadingTimeout = !hasPersistedUserRef.current
      ? setTimeout(() => {
        if (mounted) {
          console.warn('[AuthContext] Session check timed out — showing login page');
          setIsLoading(false);
        }
      }, 10000)
      : null;

    supabase.auth.getSession()
      .then(async ({ data: { session } }) => {
        if (!mounted) return;

        if (session?.user) {
          await handleSupabaseSession(session);
        } else {
          const persisted = loadPersistedUser();
          if (persisted) {
            console.warn('[AuthContext] Supabase session expired — clearing persisted user');
            clearPersistedUser();
            setUser(null);
          }
        }
      })
      .catch((err) => {
        console.error('[AuthContext] getSession failed:', err);
        const persisted = loadPersistedUser();
        if (persisted && mounted) {
          setUser(persisted);
          console.log('[AuthContext] Keeping persisted user despite getSession error');
        }
      })
      .finally(() => {
        if (mounted && !hasPersistedUserRef.current) {
          setIsLoading(false);
        }
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        if (event === 'INITIAL_SESSION') {
          return;
        }

        if (event === 'SIGNED_IN' && session?.user) {
          // ✅ Compare incoming UID to persisted UID.
          // If they differ (Google account switch) we MUST re-validate even if
          // hasPersistedUserRef is true, otherwise user.id stays stale and
          // Supabase queries return 0 rows → Track Cards disappear.
          const persisted = loadPersistedUser();
          const incomingUid = session.user.id;
          const isSameUser = persisted?.id === incomingUid;

          if (hasPersistedUserRef.current && isSameUser) {
            console.log('[AuthContext] SIGNED_IN skipped — same persisted user present');
            return;
          }

          console.log('[AuthContext] SIGNED_IN — re-validating session', {
            incomingUid,
            previousUid: persisted?.id ?? 'none',
            sameUser: isSameUser,
          });

          setIsLoading(true);
          await handleSupabaseSession(session);
          setJustLoggedIn(true);
          hasPersistedUserRef.current = true;
          if (mounted) setIsLoading(false);
        } else if (event === 'SIGNED_OUT') {
          clearPersistedUser();
          setUser(null);
          setIsLoading(false);
          // ✅ Reset guard so the NEXT SIGNED_IN is never silently skipped.
          hasPersistedUserRef.current = false;
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          console.log('[AuthContext] TOKEN_REFRESHED — re-validating profile');
          await handleSupabaseSession(session);
        }
      }
    );

    // ── Tab-visibility recovery ──────────────────────────────────────────────
    // When the user returns to this tab after a long absence (switching between
    // Google tabs, OS sleep, etc.) the SDK's background auto-refresh timer may
    // have been throttled or paused by the browser. This handler forces an
    // immediate session check the moment the tab becomes visible again so that
    // the first Supabase data query always has a valid token.
    const handleVisibilityChange = async () => {
      if (document.visibilityState !== 'visible' || !mounted) return;

      console.log('[AuthContext] Tab visible — checking session health');
      try {
        let { data: { session } } = await supabase.auth.getSession();
        
        // If getSession() is null, it might just be the in-memory cache being cleared.
        // Try refreshSession() as a force-verify before we declare the user logged out.
        if (!session) {
          console.log('[AuthContext] Session missing on tab focus — attempting refreshSession() recovery');
          const refreshResult = await supabase.auth.refreshSession();
          session = refreshResult.data.session;
        }

        if (!mounted) return;

        if (session?.user) {
          // Session is alive — silently refresh the persisted profile/expiry.
          await handleSupabaseSession(session);
          console.log('[AuthContext] Session confirmed on tab focus', { expiresAt: session.expires_at });
        } else {
          // Session truly expired and refresh failed while the tab was backgrounded.
          const persisted = loadPersistedUser();
          if (persisted) {
            console.warn('[AuthContext] Session expired in background — signing out user');
            clearPersistedUser();
            setUser(null);
          }
        }
      } catch (err) {
        // Network offline or Supabase unreachable — keep existing in-memory
        // state so the user isn't needlessly logged out.
        console.warn('[AuthContext] Visibility check failed (network?):', err);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      mounted = false;
      if (loadingTimeout) clearTimeout(loadingTimeout);
      subscription.unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    const handleServiceWorkerMessage = (event: MessageEvent<unknown>) => {
      const raw = typeof event.data === 'string' ? (() => {
        try {
          return JSON.parse(event.data) as unknown;
        } catch {
          return null;
        }
      })() : event.data;

      if (!raw || typeof raw !== 'object') return;
      const message = raw as { type?: unknown; subscription?: PushSubscriptionData };
      if (message.type !== 'PUSH_SUBSCRIPTION_CHANGED' || !user?.id || !message.subscription) return;

      WebPushService.registerSubscription(user.id, message.subscription).catch((error) => {
        console.warn('[AuthContext] Failed to re-register rotated push subscription:', error);
      });
    };

    navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);
    return () => navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
  }, [user?.id]);

  async function handleSupabaseSession(session: Session): Promise<void> {
    const email = session.user.email ?? '';
    const result = await verifyGoogleUser(email);

    if (!result.success) {
      console.error('[AuthContext] Supabase user not allowed:', result.error);
      await signOut();
      clearPersistedUser();
      setUser(null);
      return;
    }

    const authenticatedUser = buildUserFromResult(result, session.user.id);
    setUser(authenticatedUser);
    persistUser(authenticatedUser, session);

    // Write supabase_uid back to role_recipients so the fallback lookup in
    // ApprovalService.getPendingApprovals always works, even on stale sessions.
    if (authenticatedUser.recipientId) {
      supabase
        .from('role_recipients')
        .update({ supabase_uid: session.user.id })
        .eq('id', authenticatedUser.recipientId)
        .then(({ error }) => {
          if (error) {
            console.warn('[AuthContext] Failed to write supabase_uid to role_recipients:', error.message);
          }
        });
    }

    // Register Web Push subscription for push notifications (best-effort — non-blocking)
    WebPushService.registerToken(session.user.id, { requestPermission: false }).catch(() => { });

    console.log('[AuthContext] Supabase session authenticated:', {
      name: authenticatedUser.name,
      role: authenticatedUser.role,
      recipientId: authenticatedUser.recipientId,
      email: authenticatedUser.email,
      expiresAt: session.expires_at,
    });
  }

  function loginWithResult(result: AuthResult, supabaseUserId?: string): void {
    if (!result.success) {
      console.error('[AuthContext] loginWithResult called with failed result');
      return;
    }
    const uid = result.supabaseUserId ?? supabaseUserId;
    const authenticatedUser = buildUserFromResult(result, uid);
    setUser(authenticatedUser);
    persistUser(authenticatedUser);

    if (!localStorage.getItem('hasLoggedInBefore')) {
      localStorage.setItem('isFirstLogin', 'true');
      localStorage.setItem('hasLoggedInBefore', 'true');
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        persistUser(authenticatedUser, session);
        console.log('[AuthContext] JWT expiry persisted after Employee ID login:', session.expires_at);
        WebPushService.registerToken(session.user.id, { requestPermission: false }).catch(() => { });
      }
    }).catch(() => { /* non-critical */ });

    setJustLoggedIn(true);
    hasPersistedUserRef.current = true;
    // ✅ Immediately clear loading: the SIGNED_IN auth-state event will skip its
    // full re-validation path (hasPersistedUserRef is already true) and won't
    // call setIsLoading(false) itself — so we must do it here to unblock
    // ProtectedRoute and prevent an infinite loading spinner.
    setIsLoading(false);

    console.log(`[AuthContext] loginWithResult: ${authenticatedUser.name} (${authenticatedUser.role}) uid=${uid}`);
  }



  function logout(): void {
    if (user) {
      roleScopedStorage.clearRoleStorage(user.role);

      // ✅ Clear user-scoped Track Documents cache so a subsequent login
      // (even with a different Google account) never shows stale cards.
      try {
        localStorage.removeItem(`track-documents-cache-${user.id}`);
        localStorage.removeItem(`track-documents-cache-ts-${user.id}`);
      } catch { /* non-critical */ }
    }

    // Unregister Web Push subscription so stale devices don't receive pushes after sign-out
    WebPushService.unregisterToken(user?.id).catch(() => { });

    userProfileService.clearCache();

    signOut().catch(err => console.error('Supabase signOut error:', err));

    setUser(null);
    setIsLoading(false);
    setJustLoggedIn(false);
    hasPersistedUserRef.current = false;
    clearPersistedUser();
    sessionStorage.clear();
  }

  // Remove legacy storage keys on mount (old sessionStorage key + old localStorage key)
  useEffect(() => {
    localStorage.removeItem('iaoms-user');
    // The old sessionStorage key is no longer written; clean it up for any
    // existing sessions that were persisted under the previous key.
    sessionStorage.removeItem('iaoms-user');
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoading,
      justLoggedIn,
      loginWithResult,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
};