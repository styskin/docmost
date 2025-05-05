import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { SpaceRepo } from '@docmost/db/repos/space/space.repo';
import { WorkspaceRepo } from '@docmost/db/repos/workspace/workspace.repo';
import { z } from 'zod';
import { generateSlugId } from '../../common/helpers';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { AGENT_USER_ID } from '../../common/helpers/constants';

@Injectable()
export class McpService implements OnModuleInit {
  private readonly logger = new Logger(McpService.name);
  private server: McpServer;

  constructor(
    private readonly pageRepo: PageRepo,
    private readonly spaceRepo: SpaceRepo,
    private readonly workspaceRepo: WorkspaceRepo,
  ) {}

  async onModuleInit() {
    try {
      // Attempt to load the MCP SDK
      this.logger.log('Initializing MCP server');
      
      try {
        // Create an MCP server
        this.server = new McpServer({
          name: 'Docmost Document Creator',
          version: '1.0.0',
        });

        // Add a tool to create documents
        this.server.tool(
          'create_document',
          'Create a new document with the specified title and content',
          { 
            title: z.string(), 
            content: z.string(), 
            space: z.string(),
          },
          async (args: any) => {
            try {
              const { title, content, space } = args;
              if (!title || !content || !space) {
                return {
                  content: [{ type: 'text', text: 'Missing required parameters: title, content, or space' }],
                  isError: true
                };
              }
              
              const workspaceEntity = await this.workspaceRepo.findFirst()
              const workspaceId = workspaceEntity?.id;
              const spaceEntity = await this.spaceRepo.findBySlug(space, workspaceId);
              
              if (!spaceEntity) {
                return {
                  content: [{ type: 'text', text: `Space "${space}" not found` }],
                  isError: true
                };
              }

              // Create the document using the pageRepo
              const createdPage = await this.pageRepo.insertPage({
                slugId: generateSlugId(),
                title,
                content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: content }] }] },
                textContent: content,
                position: '0',
                spaceId: spaceEntity.id,
                creatorId: AGENT_USER_ID,
                workspaceId: workspaceId,
                lastUpdatedById: AGENT_USER_ID,
              });

              this.logger.log(`Created document with title: ${title} and ID: ${createdPage.id}`);
              
              return {
                content: [{ 
                  type: 'text', 
                  text: JSON.stringify({
                    documentId: createdPage.id,
                    slugId: createdPage.slugId,
                    title: createdPage.title,
                    message: 'Document created successfully'
                  }, null, 2)
                }]
              };
            } catch (error: any) {
              this.logger.error(`Failed to create document: ${error.message}`, error.stack);
              return {
                content: [{ type: 'text', text: `Error: ${error.message}` }],
                isError: true
              };
            }
          }
        );

        this.logger.log('MCP server initialized and ready for controller integration');
      } catch (error: any) {
        this.logger.error(`Failed to import MCP module: ${error.message}`, error.stack);
        throw error;
      }
    } catch (error: any) {
      this.logger.error(`Failed to initialize MCP server: ${error.message}`);
    }
  }

  // Method to handle HTTP requests from the controller
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