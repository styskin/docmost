import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { 
  CreateDocumentTool, 
  ListDocumentsTool, 
  GetDocumentTool, 
  ListSpacesTool,
  ListWorkspacesTool
} from './tools';

@Injectable()
export class McpService implements OnModuleInit {
  private readonly logger = new Logger(McpService.name);
  private server: McpServer;

  constructor(
    private readonly createDocumentTool: CreateDocumentTool,
    private readonly listDocumentsTool: ListDocumentsTool,
    private readonly getDocumentTool: GetDocumentTool,
    private readonly listSpacesTool: ListSpacesTool,
    private readonly listWorkspacesTool: ListWorkspacesTool,
  ) {}

  async onModuleInit() {
    try {
      this.logger.log('Initializing MCP server');
      this.server = new McpServer({
        name: 'Docmost Document Creator',
        version: '1.0.0',
      });

      this.createDocumentTool.register(this.server);
      this.listDocumentsTool.register(this.server);
      this.getDocumentTool.register(this.server);
      this.listSpacesTool.register(this.server);
      this.listWorkspacesTool.register(this.server);

      this.logger.log('MCP server initialized and ready for controller integration');
    } catch (error: any) {
      this.logger.error(`Failed to initialize MCP server: ${error.message}`);
    }
  }

  async handleMcpRequest(req: any, res: any, body: any) {
    try {
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
      });
      
      res.raw.on('close', () => {
        this.logger.log('Request closed');
        transport.close();
      });
      
      await this.server.connect(transport);
      await transport.handleRequest(req.raw, res.raw, body);
      
      return true;
    } catch (error: any) {
      this.logger.error(`Error handling MCP request: ${error.message}`, error.stack);
      throw error;
    }
  }

  async close() {
    if (this.server) {
      try {
        await this.server.close();
        this.logger.log(`MCP server stopped`);
      } catch (error: any) {
        this.logger.error(`Error closing MCP server: ${error.message}`, error.stack);
      }
    }
  }
} 