import { Injectable, Logger } from '@nestjs/common';
import { WorkspaceRepo } from '@docmost/db/repos/workspace/workspace.repo';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export const LIST_WORKSPACES_TOOL_DESCRIPTION = `
Get a list of all available workspaces.
This tool returns information about all workspaces, including their IDs, names, and other metadata.

Args:
None - This tool does not require any parameters.

Returns:
An array of workspace objects, each containing:
- id, string: The unique identifier of the workspace.
- name, string: The display name of the workspace.
- hostname, string: The hostname of the workspace.
- createdAt, string: The date and time when the workspace was created.
- updatedAt, string: The date and time when the workspace was last updated.
`;

@Injectable()
export class ListWorkspacesTool {
  private readonly logger = new Logger('ListWorkspacesTool');

  constructor(
    private readonly workspaceRepo: WorkspaceRepo,
  ) {}

  register(server: McpServer) {
    server.tool(
      'list_workspaces',
      LIST_WORKSPACES_TOOL_DESCRIPTION,
      {},
      async () => {
        try {
          const workspaces = await this.workspaceRepo.findAll();
          
          const workspaceList = workspaces.map(workspace => ({
            id: workspace.id,
            name: workspace.name,
            hostname: workspace.hostname,
            createdAt: workspace.createdAt,
            updatedAt: workspace.updatedAt,
          }));

          this.logger.log(`Listed ${workspaceList.length} workspaces`);
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(workspaceList, null, 2),
            }],
          };
        } catch (error: any) {
          this.logger.error(`Failed to list workspaces: ${error.message}`, error.stack);
          return {
            content: [{ type: 'text', text: `Error: ${error.message}` }],
            isError: true,
          };
        }
      }
    );
  }
} 