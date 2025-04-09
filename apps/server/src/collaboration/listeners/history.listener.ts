import { PageHistoryRepo } from '@docmost/db/repos/page/page-history.repo';
import { Page } from '@docmost/db/types/entity.types';
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Queue } from 'bullmq';
import { isDeepStrictEqual } from 'node:util';
import { QueueJob, QueueName } from '../../integrations/queue/constants';
import { IDiffAnalysisJob } from '../../integrations/queue/constants/queue.interface';

export class UpdatedPageEvent {
  page: Page;
}

@Injectable()
export class HistoryListener {
  private readonly logger = new Logger(HistoryListener.name);

  constructor(
    private readonly pageHistoryRepo: PageHistoryRepo,
    @InjectQueue(QueueName.DIFF_ANALYSIS_QUEUE)
    private diffAnalysisQueue: Queue,
  ) {}

  @OnEvent('collab.page.updated')
  async handleCreatePageHistory(event: UpdatedPageEvent) {
    const { page } = event;

    const currentTime = Date.now();
    const FIVE_MINUTES = 5 * 60 * 1000;

    const lastHistory = await this.pageHistoryRepo.findPageLastHistory(page.id);
    const isTimeGap =
      !lastHistory ||
      currentTime - new Date(lastHistory.createdAt).getTime() >= FIVE_MINUTES;
    const isDifferentContent =
      !lastHistory || !isDeepStrictEqual(lastHistory.content, page.content);
    const isDifferentUser =
      !lastHistory || lastHistory.lastUpdatedById !== page.lastUpdatedById;

    this.logger.debug(`Page ${page.id} - isTimeGap: ${isTimeGap}`);
    this.logger.debug(
      `Page ${page.id} - isDifferentContent: ${isDifferentContent}`,
    );
    this.logger.debug(`Page ${page.id} - isDifferentUser: ${isDifferentUser}`);

    if (isDifferentContent && (isTimeGap || isDifferentUser)) {
      try {
        // Saving revision
        await this.pageHistoryRepo.saveHistory(page);
        this.logger.debug(`New entry created for: ${page.id}`);

        // Queueing diff analysis job
        const jobData: IDiffAnalysisJob = {
          pageId: page.id,
          workspaceId: page.workspaceId,
          userId: page.lastUpdatedById,
          timestamp: Date.now(),
        };
        this.logger.debug(
          `Queueing ${QueueJob.DIFF_ANALYSIS} with data: ${JSON.stringify(jobData)}`,
        );
        await this.diffAnalysisQueue.add(QueueJob.DIFF_ANALYSIS, jobData);
        this.logger.debug(`Queued diff analysis job for page: ${page.id}`);
      } catch (err) {
        this.logger.error(`Failed to process page update for: ${page.id}`, err);
      }
    }
  }
}
