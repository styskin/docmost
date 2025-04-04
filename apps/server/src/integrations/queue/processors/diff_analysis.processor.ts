import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { QueueName } from '../constants';
import { IDiffAnalysisJob } from '../constants/queue.interface';
import { CommentService } from '../../../core/comment/comment.service';
import { ManulService } from '../../manul/manul.service';
import { PageHistoryRepo } from '@docmost/db/repos/page/page-history.repo';
import { AGENT_USER_ID } from '../../../common/helpers/constants';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { isDeepStrictEqual } from 'util';


@Processor(QueueName.GENERAL_QUEUE)
export class DiffAnalysisProcessor extends WorkerHost {
  private readonly logger = new Logger(DiffAnalysisProcessor.name);

  constructor(
    private readonly manulService: ManulService,
    private readonly commentService: CommentService,
    private readonly pageHistoryRepo: PageHistoryRepo,
    private readonly pageRepo: PageRepo,
  ) {
    super();
  }

  async process(job: Job<IDiffAnalysisJob, void>): Promise<void> {
    try {
      const { pageId, workspaceId, userId, timestamp } = job.data;
      this.logger.debug(`Starting diff analysis for page: ${pageId}`);
      
      // Get page history entries
      const historyEntries = await this.pageHistoryRepo.findPageHistoryByPageId(pageId, {
        page: 1,
        limit: 10,
        query: ''
      });

      const TIME_GAP = 5 * 60 * 1000; // 5 minutes in milliseconds
      const changeTime = new Date(timestamp).getTime();
      let previousVersion = null;

      // Find version before time gap or user change
      for (const entry of historyEntries.items) {
        const entryTime = new Date(entry.createdAt).getTime();
        const isTimeGap = changeTime - entryTime >= TIME_GAP;
        
        if (isTimeGap) {
          previousVersion = entry;
          this.logger.debug(
            `Found break point: ${isTimeGap ? 'time gap' : 'user change'}, ` +
            `Current user: ${userId}, Previous user: ${entry.lastUpdatedById}`
          );
          break;
        }
      }

      // Get current page
      const page = await this.pageRepo.findById(pageId, { includeContent: true });
      if (!page) {
        this.logger.debug(`Page not found: ${pageId}`);
        return;
      }

      // Skip if content hasn't changed
      if (previousVersion && isDeepStrictEqual(previousVersion.content, page.content)) {
        this.logger.debug(`No content changes detected for page: ${pageId}`);
        return;
      }
      this.logger.debug(`Found current page data: ${pageId}`);

      // Ask Manul to analyze the changes
      this.logger.debug(`Requesting Manul analysis for page: ${pageId}`);
      const analysis = await this.manulService.callManulAgent(
        JSON.stringify({
          previousContent: previousVersion?.content,
          currentContent: page.content,
          pageTitle: page.title
        }),
        "Please analyze the changes made to this document by comparing the previous and current content. Provide constructive criticism focusing on content quality, structure, and potential improvements. Be concise, use at most 2 sentences."
      );
      this.logger.debug(`Received Manul analysis for page: ${pageId}`);

      // Create a comment with the analysis
      this.logger.debug(`Creating comment with analysis for page: ${pageId}`);
      await this.commentService.create(
        AGENT_USER_ID,
        pageId,
        workspaceId,
        {
          pageId: pageId,
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
          selection: null,
          parentCommentId: null
        }
      );
      this.logger.debug(`Successfully completed diff analysis for page: ${pageId}`);
    } catch (err) {
      this.logger.error(`Failed to process AI analysis for page: ${job.data.pageId}`, err);
      throw err;
    }
  }
}