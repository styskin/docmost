import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { z } from 'zod';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { DocumentService } from '../../core/document/document.service';
import { CreateDocumentDto } from '../../core/document/dto/create-document.dto';
import { ListDocumentsDto } from '../../core/document/dto/list-documents.dto';
import { GetDocumentDto } from '../../core/document/dto/get-document.dto';

@Injectable()
export class McpService implements OnModuleInit {
  private readonly logger = new Logger(McpService.name);
  private server: McpServer;

  constructor(
    private readonly documentService: DocumentService,
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
            
            // Create a DTO for the document service
            const createDocumentDto = new CreateDocumentDto();
            createDocumentDto.title = title;
            createDocumentDto.content = content;
            createDocumentDto.spaceId = space;
            
            const result = await this.documentService.createDocument(createDocumentDto);
            
            this.logger.log(`Created document with title: ${title} and ID: ${result.documentId}`);
            
            return {
              content: [{ 
                type: 'text', 
                text: JSON.stringify(result, null, 2)
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

            // Create a DTO for the document service
            const listDocumentsDto = new ListDocumentsDto();
            listDocumentsDto.space = space;
            
            const documentList = await this.documentService.listDocuments(listDocumentsDto);

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

            // Create a DTO for the document service
            const getDocumentDto = new GetDocumentDto();
            getDocumentDto.slugId = slugId;
            
            const document = await this.documentService.getDocument(getDocumentDto);

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
