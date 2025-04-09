import { IUser } from "@/features/user/types/user.types";
import { QueryParams } from "@/lib/types.ts";

// Define the structure for suggestions received from the backend
export interface ISuggestion {
  textToReplace: string;
  textReplacement: string;
  reason: string;
  textBefore: string;
  textAfter: string;
}

export interface IComment {
  id: string;
  content: string;
  selection?: string;
  type?: string;
  creatorId: string;
  pageId: string;
  parentCommentId?: string;
  resolvedById?: string;
  resolvedAt?: Date;
  workspaceId: string;
  createdAt: Date;
  editedAt?: Date;
  deletedAt?: Date;
  creator: IUser;
  suggestions?: ISuggestion[]; // Add the optional suggestions field
}

export interface ICommentData {
  id: string;
  pageId: string;
  parentCommentId?: string;
  content: any;
  selection?: string;
}

export interface IResolveComment {
  commentId: string;
  pageId: string;
  resolved: boolean;
}

export interface ICommentParams extends QueryParams {
  pageId: string;
}
