import api from "@/lib/api-client";
import {
  ICommentParams,
  IComment,
  IResolveComment,
} from "@/features/comment/types/comment.types";
import { IPagination } from "@/lib/types.ts";

export async function createComment(
  data: Partial<IComment>,
): Promise<IComment> {
  const req = await api.post<IComment>("/comments/create", data);
  return req.data;
}

export async function resolveComment(data: IResolveComment): Promise<IComment> {
  const endpoint = data.resolved ? '/comments/resolve' : '/comments/unresolve';
  const req = await api.post<IComment>(endpoint, { commentId: data.commentId, pageId: data.pageId });
  return req.data;
}

export async function updateComment(
  data: Partial<IComment>,
): Promise<IComment> {
  const req = await api.post<IComment>(`/comments/update`, data);
  return req.data;
}

export async function getCommentById(commentId: string): Promise<IComment> {
  const req = await api.post<IComment>("/comments/info", { commentId });
  return req.data;
}

export async function getPageComments(
  data: ICommentParams,
): Promise<IPagination<IComment>> {
  const req = await api.post("/comments", data);
  return req.data;
}

export async function deleteComment(commentId: string): Promise<void> {
  await api.post("/comments/delete", { commentId });
}
