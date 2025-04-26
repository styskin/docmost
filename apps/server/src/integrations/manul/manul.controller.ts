import {
  Body,
  Controller,
  Post,
  HttpException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';

import { ImportService } from '../import/import.service';
import { ManulService, SuggestDiffResponse } from './manul.service';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { JSONContent } from '@tiptap/core';

//export const AGENT_USER_ID = "00000000-0000-7000-8000-000000000000";
export const AGENT_USER_ID = "0195fc99-bd95-7b48-9efe-4541582f9adf";

import {
  jsonToHtml,
  jsonToText,
  sanitizeTiptapJson,
} from '../../collaboration/collaboration.util';
import { turndown } from '../export/turndown-utils';

@Controller('manul')
export class ManulController {
  constructor(
    private readonly manulService: ManulService,
    private readonly pageRepo: PageRepo,

    private readonly importService: ImportService,
  ) {}

  @Post('query')
  async queryManul(@Body() body: { context: string; query: string }) {
    try {
      const response = await this.manulService.contextCall(
        body.context,
        body.query,
      );
      return { response };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to process query',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
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
      const pageHierarchy = await this.pageRepo.getPageAncestors(body.pageId, true);
      
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
          const sanitizedContent = sanitizeTiptapJson(pageContent as JSONContent);
          const pageMarkdown = sanitizedContent ? jsonToText(sanitizedContent) : '';
          combinedMarkdown += `${pageMarkdown}\n\n`;
        }
      }
      // Convert page content to markdown
      const sanitizedContent = sanitizeTiptapJson(page.content as JSONContent);
      // const html = sanitizedContent ? jsonToHtml(sanitizedContent) : '';
      // const markdown = turndown(html);    
      const markdown = sanitizedContent ? jsonToText(sanitizedContent) : '';       
      const response = await this.manulService.suggest(combinedMarkdown, JSON.stringify(sanitizedContent), body.prompt);
      this.importService.importJson(page.title + "_agent", response.doc, AGENT_USER_ID, page.spaceId, page.workspaceId);
      return response;
    } catch (error) {
      console.error("Error", error);
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
