import {
  Body,
  Controller,
  Post,
  HttpException,
  HttpStatus,
  NotFoundException,
  Res,
} from '@nestjs/common';
import { FastifyReply } from 'fastify';

import { ImportService } from '../import/import.service';
import { ManulService } from './manul.service';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { JSONContent } from '@tiptap/core';

export const AGENT_USER_ID = '00000000-0000-7000-8000-000000000000';

import {
  jsonToText,
  sanitizeTiptapJson,
} from '../../collaboration/collaboration.util';

@Controller('manul')
export class ManulController {
  constructor(
    private readonly manulService: ManulService,
    private readonly pageRepo: PageRepo,
    private readonly importService: ImportService,
  ) {}

  @Post('query')
  async queryManul(
    @Body()
    body: {
      messages: {
        role: string;
        content: string;
        tool_calls?: any[];
        tool_call_id?: string;
      }[];
    },
    @Res() res: FastifyReply,
  ) {
    try {
      console.log(
        'ManulController: Processing query request with message count:',
        body.messages?.length,
      );

      if (
        !body.messages ||
        !Array.isArray(body.messages) ||
        body.messages.length === 0
      ) {
        throw new HttpException(
          'Missing required parameter: messages must be a non-empty array',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Validate message format
      for (const message of body.messages) {
        if (!message.role || typeof message.content !== 'string') {
          throw new HttpException(
            'Invalid message format: each message must have role and content properties',
            HttpStatus.BAD_REQUEST,
          );
        }
      }

      console.log(
        'ManulController: Calling Manul API with messages:',
        body.messages,
      );
      const stream = await this.manulService.contextCall(body.messages);

      console.log('ManulController: Got stream response');

      // Set up appropriate headers for SSE
      res.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });

      console.log('ManulController: Wrote headers');

      const reader = stream.getReader();
      const decoder = new TextDecoder();

      (async () => {
        try {
          console.log('ManulController: Starting to process stream');
          let chunkCount = 0;

          while (true) {
            const { value, done } = await reader.read();
            if (done) {
              console.log(
                'ManulController: Stream complete, processed',
                chunkCount,
                'chunks',
              );
              res.raw.end();
              break;
            }

            const chunk = decoder.decode(value);
            chunkCount++;

            if (chunkCount <= 3) {
              console.log(
                `ManulController: Chunk ${chunkCount} (${chunk.length} bytes):`,
                chunk.substring(0, 100),
              );
            } else if (chunkCount % 10 === 0) {
              console.log(
                `ManulController: Processed ${chunkCount} chunks so far`,
              );
            }

            res.raw.write(chunk);
          }
        } catch (error) {
          console.error('ManulController: Error processing stream:', error);
          if (!res.raw.writableEnded) {
            res.raw.end();
          }
        }
      })();
    } catch (error) {
      console.error('ManulController: Error setting up stream:', error);

      if (!res.sent) {
        res.status(500).send({
          error: 'Failed to process streaming query',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }

  @Post('suggest')
  async suggestManul(@Body() body: { pageId: string; prompt: string }) {
    try {
      const page = await this.pageRepo.findById(body.pageId, {
        includeContent: true,
      });

      if (!page) {
        throw new NotFoundException('Page not found');
      }

      // Get all ancestors of the page (excluding the page itself)
      const pageHierarchy = await this.pageRepo.getPageAncestors(
        body.pageId,
        true,
      );

      // Build a markdown string with all pages in the hierarchy
      let combinedMarkdown = '';

      // Process pages in reverse order (from root to current page)
      for (const hierarchyPage of pageHierarchy.reverse()) {
        // Add page title as heading
        combinedMarkdown += `# ${hierarchyPage.title || 'Untitled'}\n\n`;

        // Add page content if it exists
        // content might be missing in the database schema response
        const pageContent = hierarchyPage['content'];
        if (pageContent) {
          const sanitizedContent = sanitizeTiptapJson(
            pageContent as JSONContent,
          );
          const pageMarkdown = sanitizedContent
            ? jsonToText(sanitizedContent)
            : '';
          combinedMarkdown += `${pageMarkdown}\n\n`;
        }
      }
      const sanitizedContent = sanitizeTiptapJson(page.content as JSONContent);
      const response = await this.manulService.suggest(
        combinedMarkdown,
        JSON.stringify(sanitizedContent),
        body.prompt,
      );
      this.importService.importJson(
        page.title + '_agent',
        response.doc,
        AGENT_USER_ID,
        page.spaceId,
        page.workspaceId,
      );
      return response;
    } catch (error) {
      console.error('Error', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to process suggestion',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
