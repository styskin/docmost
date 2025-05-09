import { z } from 'zod';
import { Injectable, Logger } from '@nestjs/common';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { SpaceRepo } from '@docmost/db/repos/space/space.repo';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export const LIST_DOCUMENTS_TOOL_DESCRIPTION = `
Get a list of all documents within a specified space.
This tool returns information about all documents contained within the requested space,
including their IDs, slugs, titles, positions, and parent IDs if applicable.

Args:
- space, string: The slug of the space to list documents from.
- workspace, string: The ID of the workspace.

Returns:
An array of document objects, each containing:
- id, string: The unique identifier of the document.
- slugId, string: The slug ID of the document, used in URLs.
- title, string: The title of the document.
- position, string: The position of the document in the space hierarchy.
- parentId, string: The ID of the parent document, if any.
`;

@Injectable()
export class ListDocumentsTool {
  private readonly logger = new Logger('ListDocumentsTool');

  constructor(
    private readonly pageRepo: PageRepo,
    private readonly spaceRepo: SpaceRepo,
  ) {}

  register(server: McpServer) {
    server.tool(
      'list_documents',
      LIST_DOCUMENTS_TOOL_DESCRIPTION,
      {
        space: z.string().describe('The slug of the space to list documents from'),
        workspace: z.string().describe('The ID of the workspace'),
      },
      async (args: any) => {
        try {
          const { space, workspace } = args;
          if (!space || !workspace) {
            return {
              content: [{ type: 'text', text: 'Missing required parameters: space or workspace' }],
              isError: true,
            };
          }

          const workspaceId = workspace;
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
            position: doc.position,
            parentId: doc.parentPageId,
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
  }
} 