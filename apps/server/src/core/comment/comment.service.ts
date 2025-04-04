import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { CommentRepo } from '@docmost/db/repos/comment/comment.repo';
import { Comment, User } from '@docmost/db/types/entity.types';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import { PaginationResult } from '@docmost/db/pagination/pagination';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { AGENT_USER_ID } from '../../common/helpers/constants';

@Injectable()
export class CommentService {
  constructor(
    private commentRepo: CommentRepo,
    private pageRepo: PageRepo,
  ) {}

  async findById(commentId: string) {
    const comment = await this.commentRepo.findById(commentId, {
      includeCreator: true,
    });
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }
    return comment;
  }

  async create(
    userId: string,
    pageId: string,
    workspaceId: string,
    createCommentDto: CreateCommentDto,
  ) {
    const commentContent = JSON.parse(createCommentDto.content);

    if (createCommentDto.parentCommentId) {
      const parentComment = await this.commentRepo.findById(
        createCommentDto.parentCommentId,
      );

      if (!parentComment || parentComment.pageId !== pageId) {
        throw new BadRequestException('Parent comment not found');
      }

      if (parentComment.parentCommentId !== null) {
        throw new BadRequestException('You cannot reply to a reply');
      }
    }

    const createdComment = await this.commentRepo.insertComment({
      pageId: pageId,
      content: commentContent,
      selection: createCommentDto?.selection?.substring(0, 250),
      type: 'inline',
      parentCommentId: createCommentDto?.parentCommentId,
      creatorId: userId,
      workspaceId: workspaceId,
    });

    return createdComment;
  }

  async findByPageId(
    pageId: string,
    pagination: PaginationOptions,
  ): Promise<PaginationResult<Comment>> {
    const page = await this.pageRepo.findById(pageId);

    if (!page) {
      throw new BadRequestException('Page not found');
    }

    const pageComments = await this.commentRepo.findPageComments(
      pageId,
      pagination,
    );

    return pageComments;
  }

  async update(
    commentId: string,
    updateCommentDto: UpdateCommentDto,
    authUser: User,
  ): Promise<Comment> {
    const commentContent = JSON.parse(updateCommentDto.content);

    const comment = await this.commentRepo.findById(commentId);
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    if (comment.creatorId !== authUser.id) {
      throw new ForbiddenException('You can only edit your own comments');
    }

    const editedAt = new Date();

    await this.commentRepo.updateComment(
      {
        content: commentContent,
        editedAt: editedAt,
      },
      commentId,
    );
    comment.content = commentContent;
    comment.editedAt = editedAt;

    return comment;
  }

  async remove(commentId: string, authUser: User): Promise<void> {
    const comment = await this.commentRepo.findById(commentId);

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    if (comment.creatorId !== authUser.id) {
      throw new ForbiddenException('You can only delete your own comments');
    }

    await this.commentRepo.deleteComment(commentId);
  }

  async resolve(commentId: string, authUser: User): Promise<void> {
    const comment = await this.commentRepo.findById(commentId);
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    // Only allow resolving comments created by the Agent
    if (comment.creatorId !== AGENT_USER_ID) {
      throw new ForbiddenException('Can only resolve Agent comments');
    }

    await this.commentRepo.resolveComment(commentId);
  }

  async unresolve(commentId: string, authUser: User): Promise<void> {
    const comment = await this.commentRepo.findById(commentId);
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    // Only allow unresolving comments created by the Agent
    if (comment.creatorId !== AGENT_USER_ID) {
      throw new ForbiddenException('Can only unresolve Agent comments');
    }

    await this.commentRepo.unresolveComment(commentId);
  }
}
