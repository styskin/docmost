import { z } from 'zod';
import { Injectable, Logger } from '@nestjs/common';
import { SpaceRepo } from '@docmost/db/repos/space/space.repo';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export const LIST_SPACES_TOOL_DESCRIPTION = `
Get a list of all spaces within the workspace.
This tool returns information about all available spaces, including their IDs, slugs, and names.

Args:
- workspace, string: The ID of the workspace.

Returns:
An array of space objects, each containing:
- id, string: The unique identifier of the space.
- slug, string: The slug of the space, used in URLs.
- name, string: The display name of the space.
- description, string: The description of the space, if available.
`;

@Injectable()
export class ListSpacesTool {
  private readonly logger = new Logger('ListSpacesTool');

  constructor(private readonly spaceRepo: SpaceRepo) {}

  register(server: McpServer) {
    server.tool(
      'list_spaces',
      LIST_SPACES_TOOL_DESCRIPTION,
      {
        workspace: z.string().describe('The ID of the workspace'),
      },
      async (args: any) => {
        try {
          const { workspace } = args;
          if (!workspace) {
            return {
              content: [
                { type: 'text', text: 'Missing required parameter: workspace' },
              ],
              isError: true,
            };
          }

          const workspaceId = workspace;
          const spacesResult = await this.spaceRepo.getSpacesInWorkspace(
            workspaceId,
            { page: 1, limit: 100, query: undefined },
          );

          const spaceList = spacesResult.items.map((space) => ({
            id: space.id,
            slug: space.slug,
            name: space.name,
            description: space.description,
          }));

          this.logger.log(`Listed ${spaceList.length} spaces in workspace`);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(spaceList, null, 2),
              },
            ],
          };
        } catch (error: any) {
          this.logger.error(
            `Failed to list spaces: ${error.message}`,
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
