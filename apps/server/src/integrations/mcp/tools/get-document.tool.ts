import { z } from 'zod';
import { Injectable, Logger } from '@nestjs/common';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export const GET_DOCUMENT_TOOL_DESCRIPTION = `
Retrieve a specific document by its unique slug ID.
This tool fetches detailed information about a document including its content and metadata.

Args:
- slugId, string: The unique slug ID of the document to retrieve.

Returns:
A document object containing:
- id, string: The unique identifier of the document.
- slugId, string: The slug ID of the document, used in URLs.
- title, string: The title of the document.
- content, object: The full structured content of the document as a YDoc.
- textContent, string: The plain text representation of the document content.
- spaceId, string: The ID of the space containing this document.
- workspaceId, string: The ID of the workspace containing this document.
`;

@Injectable()
export class GetDocumentTool {
  private readonly logger = new Logger('GetDocumentTool');

  constructor(private readonly pageRepo: PageRepo) {}

  register(server: McpServer) {
    server.tool(
      'get_document',
      GET_DOCUMENT_TOOL_DESCRIPTION,
      {
        slugId: z
          .string()
          .describe('The unique slug ID of the document to retrieve'),
      },
      async (args: any) => {
        try {
          const { slugId } = args;
          if (!slugId) {
            return {
              content: [
                {
                  type: 'text',
                  text: 'Missing required parameters: slugId or workspace',
                },
              ],
              isError: true,
            };
          }

          const document = await this.pageRepo.findById(slugId, {
            includeContent: true,
          });

          if (!document) {
            return {
              content: [
                {
                  type: 'text',
                  text: `Document with slug ID "${slugId}" not found`,
                },
              ],
              isError: true,
            };
          }

          this.logger.log(`Retrieved document with slug ID: ${slugId}`);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    id: document.id,
                    slugId: document.slugId,
                    title: document.title,
                    content: document.content,
                    textContent: document.textContent,
                    spaceId: document.spaceId,
                    workspaceId: document.workspaceId,
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        } catch (error: any) {
          this.logger.error(
            `Failed to get document by slug ID: ${error.message}`,
            error.stack,
          );
          return {
            content: [{ type: 'text', text: `Error: ${error.message}` }],
            isError: true,
          };
        }
      },
    );
  }
}
