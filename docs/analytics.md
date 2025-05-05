# Analytics with PostHog

This document explains how to configure and use PostHog analytics in the application.

## Configuration

PostHog is configured using environment variables:

```
# Analytics
DISABLE_TELEMETRY=false
POSTHOG_API_KEY=your_posthog_api_key
POSTHOG_HOST=https://app.posthog.com
```

- `DISABLE_TELEMETRY`: Set to `true` to disable all analytics tracking
- `POSTHOG_API_KEY`: Your PostHog project API key
- `POSTHOG_HOST`: The URL of your PostHog instance (default is `https://app.posthog.com`)

## How Analytics Are Implemented

The application uses PostHog for analytics tracking with the following components:

1. **Initialization**: PostHog is initialized in `main.tsx` when the application starts
2. **User Identification**: Users are identified in PostHog when they log in using the `usePostHogUser` hook in `App.tsx`
3. **Page View Tracking**: Page views are tracked using the `useTrackPageView` hook in layout components
4. **Event Tracking**: Various events are tracked throughout the application using the functions in `lib/analytics.ts`

## Tracked Events

The application tracks the following events:

### Authentication Events
- `user_logged_in`: When a user successfully logs in
- `user_logged_out`: When a user logs out
- `user_signed_up`: When a new user signs up
- `password_reset_requested`: When a user requests a password reset

### Workspace Events
- `workspace_created`: When a new workspace is created
- `workspace_updated`: When workspace settings are updated
- `workspace_member_invited`: When a user is invited to a workspace
- `workspace_member_joined`: When a user joins a workspace

### Page Events
- `page_created`: When a new page is created
- `page_updated`: When a page is updated
- `page_deleted`: When a page is deleted
- `page_shared`: When a page is shared
- `page_exported`: When a page is exported
- `page_viewed`: When a page is viewed (with detailed page information)
- `page_error`: When an error occurs while loading a page

### Feature Usage Events
- `ai_assistant_used`: When the AI assistant is used
- `comment_added`: When a comment is added to a page
- `search_performed`: When a search is performed

### Navigation Events
- `page_viewed`: When a user navigates to a page

## Adding New Events

To add new events to track:

1. Add the event to the appropriate category in `lib/analytics.ts`
2. Call the tracking function where the event occurs in the application

Example:

```typescript
import { featureEvents } from '@/lib/analytics';

// Track when a feature is used
featureEvents.myNewFeature({ 
  feature_name: 'example',
  additional_property: 'value'
});
```

## Privacy Considerations

- Analytics are disabled in development mode
- Analytics can be disabled by setting `DISABLE_TELEMETRY=true`
- User identification is only done for authenticated users
- Sensitive information is never tracked
