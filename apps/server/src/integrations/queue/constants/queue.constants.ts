export enum QueueName {
  EMAIL_QUEUE = '{email-queue}',
  ATTACHMENT_QUEUE = '{attachment-queue}',
  GENERAL_QUEUE = '{general-queue}',
  BILLING_QUEUE = '{billing-queue}',
  DIFF_ANALYSIS_QUEUE = '{diff-analysis-queue}',
  AGENT_FEED_QUEUE = '{agent-feed-queue}',
}

export enum QueueJob {
  SEND_EMAIL = 'send-email',
  DELETE_SPACE_ATTACHMENTS = 'delete-space-attachments',
  DELETE_PAGE_ATTACHMENTS = 'delete-page-attachments',
  PAGE_CONTENT_UPDATE = 'page-content-update',

  DELETE_USER_AVATARS = 'delete-user-avatars',

  PAGE_BACKLINKS = 'page-backlinks',
  STRIPE_SEATS_SYNC = 'sync-stripe-seats',
  DIFF_ANALYSIS = 'diff-analysis',
  TRIAL_ENDED = 'trial-ended',
  WELCOME_EMAIL = 'welcome-email',
  FIRST_PAYMENT_EMAIL = 'first-payment-email',
  AGENT_FEED_DOCUMENT_EVENT = 'agent-feed-document-event',
}
