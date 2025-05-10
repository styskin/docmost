import { z } from 'zod';
import { Injectable, Logger } from '@nestjs/common';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { SpaceRepo } from '@docmost/db/repos/space/space.repo';
import { generateSlugId } from '../../../common/helpers';
import { AGENT_USER_ID } from '../../../common/helpers/constants';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export const CREATE_DOCUMENT_TOOL_DESCRIPTION = `
Create a new document with the specified title and content.
The content must be provided as a stringified JSON representing a YDoc.
YDoc is a data structure used for collaborative editing.
Example of a simple YDoc structure:
{
  "type": "doc",
  "content": [
    {
      "type": "paragraph",
      "content": [
        {
          "type": "text",
          "text": "A paragraph of text"
        }
      ]
    },
    {
      "type": "heading",
      "attrs": { "level": 2 },
      "content": [
        {
          "type": "text",
          "text": "New section"
        }
      ]
    },
    {
      "type": "table",
      "content": [
        {
          "type": "tableRow",
          "content": [
            {
              "type": "tableHeader",
              "attrs": {
                "colspan": 1,
                "rowspan": 1
              },
              "content": [
                {
                  "type": "paragraph",
                  "attrs": {
                    "textAlign": "left"
                  },
                  "content": [
                    {
                      "text": "Column 1",
                      "type": "text"
                    }
                  ]
                }
              ]
            },
            {
              "type": "tableHeader",
              "attrs": {
                "colspan": 1,
                "rowspan": 1
              },
              "content": [
                {
                  "type": "paragraph",
                  "attrs": {
                    "textAlign": "left"
                  },
                  "content": [
                    {
                      "text": "Header2",
                      "type": "text"
                    }
                  ]
                }
              ]
            }
          ]
        },
        {
          "type": "tableRow",
          "content": [
            {
              "type": "tableCell",
              "attrs": {
                "colspan": 1,
                "rowspan": 1
              },
              "content": [
                {
                  "type": "paragraph",
                  "attrs": {
                    "textAlign": "left"
                  },
                  "content": [
                    {
                      "text": "row 1, column1",
                      "type": "text"
                    }
                  ]
                }
              ]
            },
            {
              "type": "tableCell",
              "attrs": {
                "colspan": 1,
                "rowspan": 1
              },
              "content": [
                {
                  "type": "paragraph",
                  "attrs": {
                    "textAlign": "left"
                  },
                  "content": [
                    {
                      "text": "row 1, column2",
                      "type": "text"
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}
  
Ensure the provided content string is a valid JSON representation of a YDoc.

Args:
- title, string: The title of the new document.
- content, string: The content of the new document, as a stringified JSON YDoc.
- space, string: The slug of the space where the document will be created.
- workspace, string: The ID of the workspace.

Returns:
- documentId, string: The ID of the created document.
- slugId, string: The slug ID of the created document.
- title, string: The title of the created document.
- message, string: A success message.
`;

@Injectable()
export class CreateDocumentTool {
  private readonly logger = new Logger('CreateDocumentTool');

  constructor(
    private readonly pageRepo: PageRepo,
    private readonly spaceRepo: SpaceRepo,
  ) {}

  register(server: McpServer) {
    server.tool(
      'create_document',
      CREATE_DOCUMENT_TOOL_DESCRIPTION,
      {
        title: z.string().describe('The title for the new document.'),
        content: z.string().describe('The content of the new document, as a stringified JSON YDoc.'),
        space: z.string().describe('The slug of the space where the document will be created.'),
        workspace: z.string().describe('The ID of the workspace.'),
      },
      async (args: any) => {
        try {
          const { title, content, space, workspace } = args;
          if (!title || !content || !space || !workspace) {
            return {
              content: [{ type: 'text', text: 'Missing required parameters: title, content, space, or workspace' }],
              isError: true
            };
          }
          
          const workspaceId = workspace;
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
            content: JSON.parse(content),
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
  }
} 