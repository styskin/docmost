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
      this.logger.log('Initializing MCP server');
      this.server = new McpServer({
        name: 'Docmost Document Creator',
        version: '1.0.0',
      });

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

            const createdPage = await this.pageRepo.insertPage({
              slugId: generateSlugId(),
              title,
              content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: content }] }] },
              textContent: content,
              position: '0',
              spaceId: spaceEntity.id,
              workspaceId: workspaceId,
              creatorId: AGENT_USER_ID,
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

      this.server.tool(
        'list_documents',
        'Get a list of all documents within a specified space',
        {
          space: z.string().describe('The slug of the space to list documents from'),
        },
        async (args: any) => {
          try {
            const { space } = args;
            if (!space) {
              return {
                content: [{ type: 'text', text: 'Missing required parameter: space' }],
                isError: true,
              };
            }

            const workspaceEntity = await this.workspaceRepo.findFirst();
            const workspaceId = workspaceEntity?.id;

            const spaceEntity = await this.spaceRepo.findBySlug(space, workspaceId);
            if (!spaceEntity) {
              return {
                content: [{ type: 'text', text: `Space "${space}" not found` }],
                isError: true,
              };
            }

            const paginationResult = await this.pageRepo.getRecentPagesInSpace(
              spaceEntity.id,
              { page: 1, limit: 1000, query: undefined },
            );
            const documents = paginationResult.items;

            const documentList = documents.map((doc) => ({
              id: doc.id,
              slugId: doc.slugId,
              title: doc.title,
              position: doc.position, // Position might be useful for hierarchy later
              parentId: doc.parentPageId, // Corrected field name
            }));

            this.logger.log(`Listed ${documentList.length} documents in space: ${space}`);
            return {
              content: [{
                type: 'text',
                text: JSON.stringify(documentList, null, 2),
              }],
            };
          } catch (error: any) {
            this.logger.error(`Failed to list documents in space: ${error.message}`, error.stack);
            return {
              content: [{ type: 'text', text: `Error: ${error.message}` }],
              isError: true,
            };
          }
        }
      );

      this.server.tool(
        'get_document',
        'Get a document by its unique slug ID',
        {
          slugId: z.string().describe('The unique slug ID of the document to retrieve'),
        },
        async (args: any) => {
          try {
            const { slugId } = args;
            if (!slugId) {
              return {
                content: [{ type: 'text', text: 'Missing required parameter: slugId' }],
                isError: true,
              };
            }

            const document = await this.pageRepo.findById(slugId, { includeContent: true });

            if (!document) {
              return {
                content: [{ type: 'text', text: `Document with slug ID "${slugId}" not found` }],
                isError: true,
              };
            }

            this.logger.log(`Retrieved document with slug ID: ${slugId}`);
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  id: document.id,
                  slugId: document.slugId,
                  title: document.title,
                  content: document.content,
                  textContent: document.textContent,
                  spaceId: document.spaceId,
                  workspaceId: document.workspaceId,
                }, null, 2),
              }],
            };
          } catch (error: any) {
            this.logger.error(`Failed to get document by slug ID: ${error.message}`, error.stack);
            return {
              content: [{ type: 'text', text: `Error: ${error.message}` }],
              isError: true,
            };
          }
        }
      );

      this.logger.log('MCP server initialized and ready for controller integration');
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