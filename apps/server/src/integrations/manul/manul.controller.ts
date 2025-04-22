import {
  Body,
  Controller,
  Post,
  HttpException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { ManulService, SuggestDiffResponse } from './manul.service';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { JSONContent } from '@tiptap/core';

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
      
      // Convert page content to markdown
      const sanitizedContent = sanitizeTiptapJson(page.content as JSONContent);
      // const html = sanitizedContent ? jsonToHtml(sanitizedContent) : '';
      // const markdown = turndown(html);    
      const markdown = sanitizedContent ? jsonToText(sanitizedContent) : '';      
      const response = await this.manulService.suggest(markdown, body.prompt);
      return response;
    } catch (error) {
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
