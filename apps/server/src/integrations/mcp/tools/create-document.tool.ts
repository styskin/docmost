import { z } from 'zod';
import { Injectable, Logger } from '@nestjs/common';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { SpaceRepo } from '@docmost/db/repos/space/space.repo';
import { generateSlugId } from '../../../common/helpers';
import { AGENT_USER_ID } from '../../../common/helpers/constants';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { WsGateway } from '../../../ws/ws.gateway';
import { PageService } from '../../../core/page/services/page.service';
import { TiptapTransformer } from '@hocuspocus/transformer';
import * as Y from 'yjs';
import {
  tiptapExtensions,
  htmlToJson,
  jsonToText,
} from '../../../collaboration/collaboration.util';
import { markdownToHtml } from '@docmost/editor-ext';

export const CREATE_DOCUMENT_TOOL_DESCRIPTION = `
Creating a new document with the specified title and Markdown content.
The content should be provided as Markdown text, which will be automatically converted to the appropriate document format.
Markdown supports most popular features including:
- Headers (# ## ### etc.)
- Bold (**text**) and italic (*text*) formatting
- Lists (ordered and unordered)
- Links [text](url)
- Code blocks and inline code
- Tables
- Task lists with checkboxes
- Block quotes

Do not include the title as a heading in the content since the title is specified separately.
By default, the new document will be created at the root of the space.
If you want to create a document under a parent document, provide the slug ID of the parent document.
Do not do this unless explicitly instructed to do so.

Args:
- title, string: The title of the new document.
- content, string: The content of the new document in Markdown format.
- space, string: The slug of the space where the document will be created.
- workspace, string: The ID of the workspace.
- parentDocument, string, optional: The slug ID of the parent document.

Returns a JSON object with the following properties:
- documentId, string: The ID of the created document.
- slugId, string: The slug ID of the created document.
- title, string: The title of the created document.
- message, string: A success message.
- parentId, string, optional: The slug ID of the parent document, if any.
`;

@Injectable()
export class CreateDocumentTool {
  private readonly logger = new Logger('CreateDocumentTool');

  constructor(
    private readonly pageRepo: PageRepo,
    private readonly spaceRepo: SpaceRepo,
    private eventEmitter: EventEmitter2,
    private wsGateway: WsGateway,
    private pageService: PageService,
  ) {}

  register(server: McpServer) {
    server.tool(
      'create_document',
      CREATE_DOCUMENT_TOOL_DESCRIPTION,
      {
        title: z.string().describe('The title for the new document.'),
        content: z
          .string()
          .describe('The content of the new document in Markdown format.'),
        space: z
          .string()
          .describe(
            'The slug of the space where the document will be created.',
          ),
        workspace: z.string().describe('The ID of the workspace.'),
        parentDocument: z
          .string()
          .optional()
          .describe(
            'The slug ID of the parent document. If provided, the new document will be nested under this document.',
          ),
      },
      async (args: any) => {
        try {
          const { title, content, space, workspace, parentDocument } = args;
          if (!title || !content || !space || !workspace) {
            return {
              content: [
                {
                  type: 'text',
                  text: 'Missing required parameters: title, content, space, or workspace',
                },
              ],
              isError: true,
            };
          }

          const workspaceId = workspace;
          const spaceEntity = await this.spaceRepo.findBySlug(
            space,
            workspaceId,
          );

          if (!spaceEntity) {
            return {
              content: [{ type: 'text', text: `Space "${space}" not found` }],
              isError: true,
            };
          }

          let parentPageId = undefined;
          if (parentDocument) {
            const parentPage = await this.pageRepo.findById(parentDocument);

            if (!parentPage) {
              return {
                content: [
                  {
                    type: 'text',
                    text: `Parent document "${parentDocument}" not found`,
                  },
                ],
                isError: true,
              };
            }

            if (parentPage.spaceId !== spaceEntity.id) {
              return {
                content: [
                  {
                    type: 'text',
                    text: `Parent document "${parentDocument}" is not in space "${space}"`,
                  },
                ],
                isError: true,
              };
            }

            parentPageId = parentPage.id;
          }

          // Get proper position for the new document
          let position = 'a0';
          try {
            position = await this.pageService.nextPagePosition(
              spaceEntity.id,
              parentPageId,
            );
          } catch (error: any) {
            this.logger.warn(
              `Error generating position: ${error.message}, using default`,
            );
          }

          // Convert Markdown to ProseMirror JSON
          let contentJson = null;
          try {
            // Convert Markdown to HTML
            const html = await markdownToHtml(content);

            // Convert HTML to ProseMirror JSON
            contentJson = htmlToJson(html);
          } catch (error: any) {
            this.logger.error(
              `Failed to convert Markdown to ProseMirror JSON: ${error.message}`,
              error.stack,
            );
            return {
              content: [
                {
                  type: 'text',
                  text: `Error converting Markdown content: ${error.message}`,
                },
              ],
              isError: true,
            };
          }

          // Form correct YDoc from content
          let ydoc = new Y.Doc();
          const fragmentYDoc = TiptapTransformer.toYdoc(
            contentJson,
            'default',
            tiptapExtensions,
          );
          const fragmentRoot = fragmentYDoc.get(
            'default',
            Y.XmlFragment,
          ) as Y.XmlFragment;
          const fragmentNodes = Array.from(fragmentRoot.toArray());
          const mainRoot = ydoc.get('default', Y.XmlFragment) as Y.XmlFragment;
          const nodesToPush = fragmentNodes
            .filter(
              (node) =>
                node instanceof Y.XmlElement || node instanceof Y.XmlText,
            )
            .map((node) => node.clone());
          mainRoot.push(nodesToPush);
          const ydocState = Buffer.from(Y.encodeStateAsUpdate(ydoc));

          // Insert page into database
          const createdPage = await this.pageRepo.insertPage({
            slugId: generateSlugId(),
            title,
            content: contentJson,
            textContent: jsonToText(contentJson),
            ydoc: ydocState,
            position: position,
            spaceId: spaceEntity.id,
            workspaceId: workspaceId,
            creatorId: AGENT_USER_ID,
            lastUpdatedById: AGENT_USER_ID,
            parentPageId: parentPageId,
          });

          this.logger.log(
            `Created document with title: ${title} and ID: ${createdPage.id}${parentPageId ? `, under parent ID: ${parentPageId}` : ''}`,
          );

          // Find the correct index for the new document based on its position
          let index = 0;
          const paginationOpts = { page: 1, limit: 250, query: '' };
          const siblingPagesResult = await this.pageService.getSidebarPages(
            spaceEntity.id,
            paginationOpts,
            parentPageId || undefined,
          );
          const siblingPages = siblingPagesResult.items;
          siblingPages.sort((a, b) => a.position.localeCompare(b.position));
          index = siblingPages.findIndex((page) => page.id === createdPage.id);
          if (index === -1) index = siblingPages.length;

          // Emit event for the collaboration system to handle
          this.eventEmitter.emit('collab.page.created', {
            page: createdPage,
            source: 'create-document-tool',
          });

          // Emit WebSocket event to notify all clients - using correct addTreeNode format
          this.wsGateway.server.emit('message', {
            operation: 'addTreeNode',
            spaceId: spaceEntity.id,
            payload: {
              parentId: parentPageId || null,
              index: index,
              data: {
                id: createdPage.id,
                slugId: createdPage.slugId,
                name: createdPage.title,
                position: createdPage.position,
                spaceId: spaceEntity.id,
                parentPageId: parentPageId || null,
                hasChildren: false,
                children: [],
              },
            },
          });

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    documentId: createdPage.id,
                    slugId: createdPage.slugId,
                    title: createdPage.title,
                    message: 'Document created successfully',
                    parentId: parentPageId || null,
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        } catch (error: any) {
          this.logger.error(
            `Failed to create document: ${error.message}`,
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
