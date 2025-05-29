import { ISpace } from "@/features/space/types/space.types.ts";

export enum DocumentType {
  STANDARD = "standard",
  LLM_INSTRUCTION = "llm_instruction",
  LLM_SCHEDULED_TASK = "llm_scheduled_task",
}

export const DOCUMENT_TYPE_NAMES: Record<DocumentType, string> = {
  [DocumentType.STANDARD]: "Standard document",
  [DocumentType.LLM_INSTRUCTION]: "LLM Instruction",
  [DocumentType.LLM_SCHEDULED_TASK]: "LLM Scheduled Task",
};

export interface IPage {
  id: string;
  slugId: string;
  title: string;
  content: string;
  icon: string;
  coverPhoto: string;
  parentPageId: string;
  creatorId: string;
  spaceId: string;
  workspaceId: string;
  isLocked: boolean;
  lastUpdatedById: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date;
  position: string;
  hasChildren: boolean;
  creator: ICreator;
  lastUpdatedBy: ILastUpdatedBy;
  space: Partial<ISpace>;
  type?: DocumentType;
}

interface ICreator {
  id: string;
  name: string;
  avatarUrl: string;
}
interface ILastUpdatedBy {
  id: string;
  name: string;
  avatarUrl: string;
}

export interface IMovePage {
  pageId: string;
  position?: string;
  after?: string;
  before?: string;
  parentPageId?: string;
}

export interface IMovePageToSpace {
  pageId: string;
  spaceId: string;
}

export interface ICopyPageToSpace {
  pageId: string;
  spaceId: string;
}

export interface SidebarPagesParams {
  spaceId: string;
  pageId?: string;
  page?: number; // pagination
}

export interface IPageInput {
  pageId: string;
  title: string;
  parentPageId: string;
  icon: string;
  coverPhoto: string;
  position: string;
  type?: DocumentType;
}

export interface IExportPageParams {
  pageId: string;
  format: ExportFormat;
  includeChildren?: boolean;
}

export enum ExportFormat {
  HTML = "html",
  Markdown = "markdown",
}
