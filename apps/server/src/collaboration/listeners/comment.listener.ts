import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { CommentService } from '../../core/comment/comment.service';
import { Page } from '@docmost/db/types/entity.types';
import { ManulService } from '../../integrations/manul/manul.service';
import { PageHistoryRepo } from '@docmost/db/repos/page/page-history.repo';
import { isDeepStrictEqual } from 'node:util';
import { generateText } from '@tiptap/core';
import { tiptapExtensions } from '../collaboration.util';
import { AGENT_USER_ID } from '../../common/helpers/constants';

export class UpdatedPageEvent {
  page: Page;
}

@Injectable()
export class CommentListener {
  private readonly logger = new Logger(CommentListener.name);

  constructor(
    private readonly commentService: CommentService,
    private readonly manulService: ManulService,
    private readonly pageHistoryRepo: PageHistoryRepo
  ) {}

  private contentToMarkdown(content: any): string {
    return generateText(content, tiptapExtensions);
  }

  private getMarkdownDiff(previousContent: any, currentContent: any): string {
    const previousMarkdown = this.contentToMarkdown(previousContent);
    const currentMarkdown = this.contentToMarkdown(currentContent);
    
    const previousLines = previousMarkdown.split('\n');
    const currentLines = currentMarkdown.split('\n');
    
    let diff = '';
    let i = 0;
    let j = 0;
    
    while (i < previousLines.length || j < currentLines.length) {
      if (i < previousLines.length && j < currentLines.length && previousLines[i] === currentLines[j]) {
        // Lines are the same
        i++;
        j++;
      } else {
        // Lines are different
        if (i < previousLines.length) {
          i++;
        }
        if (j < currentLines.length) {
          diff += `${currentLines[j]}`;
          j++;
        }
      }
    }
    
    return diff;
  }

  @OnEvent('collab.page.updated')
  async handleCreateComment(event: UpdatedPageEvent) {
    const { page } = event;

    try {
      // Get the last history entry to compare changes
      const lastHistory = await this.pageHistoryRepo.findPageLastHistory(page.id);
      this.logger.debug("Last history", lastHistory);
      this.logger.debug("Page content", page.content);
      
      if (lastHistory && !isDeepStrictEqual(lastHistory.content, page.content)) {
        // Check if lastHistory is the current version or the previous version
        let previousVersion = lastHistory;
        if (isDeepStrictEqual(lastHistory.content, page.content)) {
          // If lastHistory matches current content, get the actual previous version
          const previousHistory = await this.pageHistoryRepo.findPageHistoryByPageId(page.id, {
            page: 1,
            limit: 2,
            query: ''
          });
          previousVersion = previousHistory.items[1];
        }

        // Get markdown diff
        const markdownDiff = this.getMarkdownDiff(previousVersion?.content || {}, page.content);
        this.logger.debug("Markdown diff", markdownDiff);

        // Prepare context for Manul
        const context = {
          previousContent: previousVersion?.content || {},
          currentContent: page.content,
          pageTitle: page.title,
          pageId: page.id,
          markdownDiff: markdownDiff
        };

        // Ask Manul to analyze the changes
        const analysis = await this.manulService.callManulAgent(
          JSON.stringify(context),
          "Please analyze the changes made to this document by comparing the previous and current content. Provide constructive criticism focusing on content quality, structure, and potential improvements. Be concise, use at most 2 sentences."
        );

        // Create a comment with the analysis
        await this.commentService.create(
          AGENT_USER_ID, // Use the agent user ID from constants
          page.id,
          page.workspaceId,
          {
            pageId: page.id,
            content: JSON.stringify({
              type: 'doc',
              content: [
                {
                  type: 'paragraph',
                  content: [
                    {
                      type: 'text',
                      text: analysis
                    }
                  ]
                }
              ]
            }),
            selection: markdownDiff,
            parentCommentId: null
          }
        );

        this.logger.debug(`Created AI analysis comment for page: ${page.id}`);
      }
    } catch (err) {
      this.logger.error(`Failed to create AI analysis comment for page: ${page.id}`, err);
    }
  }
} 