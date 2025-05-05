import posthog from 'posthog-js';
import { castToBoolean } from '@/lib/utils.tsx';

/**
 * Get configuration value from environment or window.CONFIG
 */
function getPostHogConfigValue(key: string, defaultValue: string = undefined): string {
  const rawValue = import.meta.env.DEV
    ? import.meta.env[key]
    : window?.CONFIG?.[key];
  return rawValue ?? defaultValue;
}

/**
 * Initialize PostHog analytics
 */
export function initPostHog() {
  const posthogApiKey = getPostHogConfigValue('POSTHOG_API_KEY');
  const posthogHost = getPostHogConfigValue('POSTHOG_HOST', 'https://app.posthog.com');
  const disableTelemetry = castToBoolean(getPostHogConfigValue('DISABLE_TELEMETRY', 'false'));

  if (!posthogApiKey || disableTelemetry) {
    // Skip PostHog initialization if API key is not provided or telemetry is disabled
    return;
  }

  posthog.init(posthogApiKey, {
    api_host: posthogHost,
    capture_pageview: true, // Automatically capture pageviews
    capture_pageleave: true, // Automatically capture page leave events
    autocapture: true, // Automatically capture clicks, form submissions, etc.
    persistence: 'localStorage',
    loaded: (posthog) => {
      // Add any additional configuration after PostHog is loaded
      if (import.meta.env.DEV) {
        // Disable capturing in development mode
        posthog.opt_out_capturing();
      }
    },
  });

  // Identify user when they're logged in
  const identifyUser = (userId: string, email?: string, name?: string) => {
    if (userId) {
      posthog.identify(userId, {
        email,
        name,
      });
    }
  };

  return {
    posthog,
    identifyUser,
  };
}

/**
 * Track an event with PostHog
 * @param eventName The name of the event to track
 * @param properties Optional properties to include with the event
 */
export function trackEvent(eventName: string, properties?: Record<string, any>) {
  console.log("trackEvent", eventName, properties);
  if (typeof posthog !== 'undefined' && posthog.capture) {
    posthog.capture(eventName, properties);
  }
}

/**
 * Reset the current user's identity
 */
export function resetUser() {
  if (typeof posthog !== 'undefined' && posthog.reset) {
    posthog.reset();
  }
}
