import { MentionNode } from '../../../common/helpers/prosemirror/utils';

export interface IPageBacklinkJob {
  pageId: string;
  workspaceId: string;
  mentions: MentionNode[];
}

export interface IStripeSeatsSyncJob {
  workspaceId: string;
}

export interface IDiffAnalysisJob {
  pageId: string;
  workspaceId: string;
  userId: string;
  timestamp: number;
}

export interface IAgentFeedJob {
  eventType: 'update_scheduled_task_document';
  documentId: string;
  documentType: string;
  workspaceId: string;
  spaceId: string;
  payload?: Record<string, any>;
}
