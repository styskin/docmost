import { trackEvent } from './posthog';

/**
 * Track page view events
 * @param pageName The name of the page being viewed
 * @param properties Additional properties to include with the event
 */
export function trackPageView(pageName: string, properties?: Record<string, any>) {
  trackEvent('page_viewed', {
    page_name: pageName,
    ...properties,
  });
}

/**
 * Track user authentication events
 */
export const authEvents = {
  login: (method: string = 'email') => {
    trackEvent('user_logged_in', { method });
  },
  logout: () => {
    trackEvent('user_logged_out');
  },
  signup: (method: string = 'email') => {
    trackEvent('user_signed_up', { method });
  },
  passwordReset: () => {
    trackEvent('password_reset_requested');
  },
};

/**
 * Track workspace-related events
 */
export const workspaceEvents = {
  created: (properties?: Record<string, any>) => {
    trackEvent('workspace_created', properties);
  },
  updated: (properties?: Record<string, any>) => {
    trackEvent('workspace_updated', properties);
  },
  memberInvited: (properties?: Record<string, any>) => {
    trackEvent('workspace_member_invited', properties);
  },
  memberJoined: (properties?: Record<string, any>) => {
    trackEvent('workspace_member_joined', properties);
  },
};

/**
 * Track page-related events
 */
export const pageEvents = {
  created: (properties?: Record<string, any>) => {
    trackEvent('page_created', properties);
  },
  updated: (properties?: Record<string, any>) => {
    trackEvent('page_updated', properties);
  },
  deleted: (properties?: Record<string, any>) => {
    trackEvent('page_deleted', properties);
  },
  shared: (properties?: Record<string, any>) => {
    trackEvent('page_shared', properties);
  },
  exported: (format: string, properties?: Record<string, any>) => {
    trackEvent('page_exported', { format, ...properties });
  },
  viewed: (properties?: Record<string, any>) => {
    trackEvent('page_viewed', properties);
  },
  error: (properties?: Record<string, any>) => {
    trackEvent('page_error', properties);
  },
};

/**
 * Track feature usage events
 */
export const featureEvents = {
  aiAssistantUsed: (properties?: Record<string, any>) => {
    trackEvent('ai_assistant_used', properties);
  },
  commentAdded: (properties?: Record<string, any>) => {
    trackEvent('comment_added', properties);
  },
  searchPerformed: (properties?: Record<string, any>) => {
    trackEvent('search_performed', properties);
  },
};
