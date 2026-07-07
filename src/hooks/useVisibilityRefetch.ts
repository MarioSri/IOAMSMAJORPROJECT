import { useEffect } from 'react';

/**
 * Calls `refetch` whenever the browser tab becomes visible again.
 *
 * This is the session-stability companion to the AuthContext visibilitychange
 * listener: the auth layer refreshes the token first, then each hook that uses
 * this utility re-fetches its data with the fresh token — ensuring data never
 * appears lost after long inactivity or tab switching.
 *
 * @param refetch - A stable callback (useCallback-wrapped) that triggers a
 *                  silent background re-fetch of the hook's data.
 * @param enabled - Set to false when the user is logged out so the listener
 *                  does not fire unnecessarily. Defaults to true.
 */
export function useVisibilityRefetch(refetch: () => void, enabled = true): void {
  useEffect(() => {
    if (!enabled) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refetch();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [refetch, enabled]);
}
