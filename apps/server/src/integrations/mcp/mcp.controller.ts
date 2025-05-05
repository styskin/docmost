import { Controller, Post, Get, Delete, Req, Res, Body, HttpStatus, HttpException } from '@nestjs/common';
import { McpService } from './mcp.service';
import { FastifyRequest, FastifyReply } from 'fastify';
import { Logger } from '@nestjs/common';

@Controller('mcp')
export class McpController {
  private readonly logger = new Logger(McpController.name);

  constructor(private readonly mcpService: McpService) {}

  @Post()
  async handleMcpPost(
    @Req() req: FastifyRequest,
    @Res() res: FastifyReply,
    @Body() body: any,
  ) {
    try {
      await this.mcpService.handleMcpRequest(req, res, body);
      // The response is handled by the StreamableHTTPServerTransport
    } catch (error: any) {
      this.logger.error(`Error in MCP controller: ${error.message}`, error.stack);
      if (!res.sent) {
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Internal server error',
          },
          id: null,
        });
      }
    }
  }

  @Get()
  async handleMcpGet(@Res() res: FastifyReply) {
    this.logger.log('Received GET MCP request');
    return res.status(HttpStatus.METHOD_NOT_ALLOWED).send({
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: 'Method not allowed.',
      },
      id: null,
    });
  }

  @Delete()
  async handleMcpDelete(@Res() res: FastifyReply) {
    this.logger.log('Received DELETE MCP request');
    return res.status(HttpStatus.METHOD_NOT_ALLOWED).send({
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: 'Method not allowed.',
      },
      id: null,
    });
  }
} 