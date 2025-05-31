import { z } from 'zod';
import { Injectable, Logger } from '@nestjs/common';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { jsonToHtml } from '../../../collaboration/collaboration.util';
import { turndown } from '../../export/turndown-utils';

export const GET_DOCUMENT_TOOL_DESCRIPTION = `
Retrieve a specific document by its unique slug ID.
This tool fetches detailed information about a document including its content in Markdown format and metadata.

Args:
- slugId, string: The unique slug ID of the document to retrieve.

Returns an object with the following properties:
- id, string: The unique identifier of the document.
- slugId, string: The slug ID of the document, used in URLs.
- title, string: The title of the document.
- content, string: The document content in Markdown format.
- spaceId, string: The ID of the space containing this document.
- workspaceId, string: The ID of the workspace containing this document.
- parentId, string: The ID of the parent document, if any.
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

          // Convert document content to Markdown
          let markdownContent = '';
          try {
            if (document.content) {
              const html = jsonToHtml(document.content);
              // Remove colgroup elements that can cause issues with Markdown conversion
              const cleanHtml = html.replace(
                /<colgroup[^>]*>[\s\S]*?<\/colgroup>/gim,
                '',
              );
              markdownContent = turndown(cleanHtml);
            }
          } catch (error: any) {
            this.logger.warn(
              `Failed to convert document content to Markdown: ${error.message}`,
            );
            markdownContent = document.textContent || '';
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
                    content: markdownContent,
                    spaceId: document.spaceId,
                    workspaceId: document.workspaceId,
                    parentId: document.parentPageId || null,
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
