import { PageHistoryRepo } from '@docmost/db/repos/page/page-history.repo';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { JSONContent } from '@tiptap/core';
import { Job } from 'bullmq';
import { diffLines, type Change } from 'diff';
import { isDeepStrictEqual } from 'util';
import { AGENT_USER_ID } from '../../../common/helpers/constants';
import {
  jsonToHtml,
  sanitizeTiptapJson,
} from '../../../collaboration/collaboration.util';
import { CommentService } from '../../../core/comment/comment.service';
import { turndown } from '../../export/turndown-utils';
import { ManulService } from '../../manul/manul.service';
import { QueueName } from '../constants';
import { IDiffAnalysisJob } from '../constants/queue.interface';
import { UserRepo } from '@docmost/db/repos/user/user.repo';

@Processor(QueueName.DIFF_ANALYSIS_QUEUE)
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
      this.logger.debug(
        `Processing job ${job.id} with data: ${JSON.stringify(job.data)}`,
      );
      const { pageId, workspaceId, userId, timestamp } = job.data;

      const page = await this.pageRepo.findById(pageId, {
        includeContent: true,
      });
      if (!page) {
        this.logger.debug(`Page not found: ${pageId}`);
        return;
      }
      this.logger.debug(`Found current page data: ${pageId}`);

      const historyEntries = await this.pageHistoryRepo.findPageHistoryByPageId(
        pageId,
        {
          page: 1,
          limit: 5,
          query: '',
        },
      );

      let previousVersion = null;
      for (const entry of historyEntries.items) {
        if (isDeepStrictEqual(entry.content, page.content)) {
          continue;
        }
        previousVersion = entry;
        break;
      }

      // Convert Tiptap JSON to HTML, then to Markdown using shared utility
      const sanitizedPreviousContent = sanitizeTiptapJson(
        previousVersion?.content as JSONContent,
      );
      const sanitizedCurrentContent = sanitizeTiptapJson(
        page.content as JSONContent,
      );
      const previousHtml = sanitizedPreviousContent
        ? jsonToHtml(sanitizedPreviousContent)
        : '';
      const currentHtml = sanitizedCurrentContent
        ? jsonToHtml(sanitizedCurrentContent)
        : '';
      const previousMarkdown = turndown(previousHtml);
      const currentMarkdown = turndown(currentHtml);
      this.logger.debug(
        'Converted content from Tiptap JSON -> HTML -> Markdown format',
      );

      const markdownDiff: Change[] = diffLines(
        previousMarkdown,
        currentMarkdown,
        {
          newlineIsToken: true,
        },
      );
      let addedChars = 0;
      let removedChars = 0;
      markdownDiff.forEach((change) => {
        if (change.added) {
          addedChars += change.value.length;
        } else if (change.removed) {
          removedChars += change.value.length;
        }
      });
      const totalCharDiff = addedChars + removedChars;
      this.logger.debug(
        `Total character diff: ${totalCharDiff} (added: ${addedChars}, removed: ${removedChars})`,
      );
      const MIN_CHAR_DIFF = 20;
      if (totalCharDiff < MIN_CHAR_DIFF) {
        this.logger.debug(
          `Skipping analysis for page ${pageId} due to small diff size (${totalCharDiff} chars).`,
        );
        return;
      }

      const markdownDiffStr = JSON.stringify(markdownDiff);
      this.logger.debug(
        `Calculated Markdown line diff (newlineIsToken=true): ${markdownDiffStr}`,
      );
      this.logger.debug(
        `Successfully completed diff analysis for page: ${pageId}`,
      );
    } catch (err) {
      this.logger.error(
        `Failed to process AI analysis for page: ${job.data.pageId}`,
        err,
      );
      throw err;
    }
  }
}
