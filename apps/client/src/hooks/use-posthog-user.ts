import { useAtomValue } from 'jotai';
import { useEffect } from 'react';
import posthog from 'posthog-js';
import { currentUserAtom } from '@/features/user/atoms/current-user-atom';

/**
 * Hook to identify the current user in PostHog
 * This should be used in the App component to track user identity
 */
export function usePostHogUser() {
  const currentUser = useAtomValue(currentUserAtom);

  useEffect(() => {
    // Identify user when they're logged in
    if (currentUser?.user) {
      const { user, workspace } = currentUser;
      
      // Identify the user with their ID and properties
      posthog.identify(user.id, {
        email: user.email,
        name: user.name,
        workspace_id: workspace?.id,
        workspace_name: workspace?.name,
        role: user.role,
        locale: user.locale,
        $initial_referrer: document.referrer,
      });
      
      // Set user properties that are useful for filtering in PostHog
      posthog.people.set({
        email: user.email,
        name: user.name,
        workspace_id: workspace?.id,
        workspace_name: workspace?.name,
        role: user.role,
        locale: user.locale,
        last_login: user.lastLoginAt,
      });
    } else {
      // Reset user identity when logged out
      posthog.reset();
    }
  }, [currentUser]);
}
