import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateCommentDto, SuggestionDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { CommentRepo } from '@docmost/db/repos/comment/comment.repo';
import {
  Comment,
  User,
  UpdatableComment,
} from '@docmost/db/types/entity.types';
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

  // Helper function to safely parse suggestions JSON
  private parseSuggestions(suggestionsJson: unknown): SuggestionDto[] | null {
    if (!suggestionsJson) {
      return null;
    }
    try {
      const suggestions =
        typeof suggestionsJson === 'string'
          ? JSON.parse(suggestionsJson)
          : suggestionsJson;
      if (Array.isArray(suggestions)) {
        return suggestions as SuggestionDto[];
      }
      console.error('Parsed suggestions is not an array:', suggestions);
      return null;
    } catch (error) {
      console.error(
        'Failed to parse suggestions JSON:',
        error,
        suggestionsJson,
      );
      return null;
    }
  }

  async findById(
    commentId: string,
  ): Promise<
    | (Omit<Comment, 'suggestions'> & { suggestions?: SuggestionDto[] | null })
    | undefined
  > {
    const comment = await this.commentRepo.findById(commentId, {
      includeCreator: true,
    });
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }
    const parsedSuggestions = this.parseSuggestions(comment.suggestions);
    return { ...comment, suggestions: parsedSuggestions };
  }

  async create(
    userId: string,
    pageId: string,
    workspaceId: string,
    createCommentDto: CreateCommentDto,
  ): Promise<
    Omit<Comment, 'suggestions'> & { suggestions?: SuggestionDto[] | null }
  > {
    const commentContent =
      typeof createCommentDto.content === 'string'
        ? JSON.parse(createCommentDto.content)
        : createCommentDto.content;

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
      suggestions: createCommentDto.suggestions as any,
    });

    // Parse suggestions
    const parsedSuggestions = this.parseSuggestions(createdComment.suggestions);
    // Return new object with correct type
    return { ...createdComment, suggestions: parsedSuggestions };
  }

  // Return type reflects the structure with parsed suggestions
  async findByPageId(
    pageId: string,
    pagination: PaginationOptions,
  ): Promise<
    PaginationResult<
      Omit<Comment, 'suggestions'> & { suggestions?: SuggestionDto[] | null }
    >
  > {
    const page = await this.pageRepo.findById(pageId);

    if (!page) {
      throw new BadRequestException('Page not found');
    }

    const pageComments = await this.commentRepo.findPageComments(
      pageId,
      pagination,
    );

    // Map items to the correct return structure
    const itemsWithParsedSuggestions = pageComments.items.map((comment) => ({
      ...comment,
      suggestions: this.parseSuggestions(comment.suggestions),
    }));

    return {
      ...pageComments,
      items: itemsWithParsedSuggestions,
    };
  }

  async update(
    commentId: string,
    updateCommentDto: UpdateCommentDto,
    authUser: User,
  ): Promise<
    Omit<Comment, 'suggestions'> & { suggestions?: SuggestionDto[] | null }
  > {
    const commentContent = JSON.parse(updateCommentDto.content);

    const comment = await this.commentRepo.findById(commentId);
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    if (comment.creatorId !== authUser.id) {
      throw new ForbiddenException('You can only edit your own comments');
    }

    const editedAt = new Date();
    const updateData: UpdatableComment = {
      content: commentContent,
      editedAt: editedAt,
    };

    await this.commentRepo.updateComment(updateData, commentId);
    const updatedComment = await this.findById(commentId);
    if (!updatedComment) {
      throw new NotFoundException('Comment disappeared after update');
    }
    return updatedComment;
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
