import {
  Body,
  Controller,
  Post,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ManulService } from './manul.service';

@Controller('manul')
export class ManulController {
  constructor(private readonly manulService: ManulService) {}

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
}
