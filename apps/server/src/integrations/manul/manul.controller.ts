import {
  Body,
  Controller,
  Post,
  HttpException,
  HttpStatus,
  Res,
} from '@nestjs/common';
import { FastifyReply } from 'fastify';

import { ManulService } from './manul.service';

export const AGENT_USER_ID = '00000000-0000-7000-8000-000000000000';

@Controller('manul')
export class ManulController {
  constructor(private readonly manulService: ManulService) {}

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
}
