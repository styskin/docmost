import { z } from 'zod';
import { Injectable, Logger } from '@nestjs/common';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { AGENT_USER_ID } from '../../../common/helpers/constants';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as Y from 'yjs';
import { TiptapTransformer } from '@hocuspocus/transformer';
import {
  jsonToText,
  tiptapExtensions,
  htmlToJson,
} from '../../../collaboration/collaboration.util';
import { JSONContent } from '@tiptap/core';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { WsGateway } from '../../../ws/ws.gateway';
import { markdownToHtml } from '@docmost/editor-ext';

export const APPEND_CONTENT_TOOL_DESCRIPTION = `
Appends content to an existing document.
The content to append should be provided as Markdown text, which will be automatically converted to the appropriate document format.
This will be added to the end or beginning of the current document, based on the position parameter.

Markdown supports most popular features including:
- Headers (# ## ### etc.)
- Bold (**text**) and italic (*text*) formatting
- Lists (ordered and unordered)
- Links [text](url)
- Code blocks and inline code
- Tables
- Task lists with checkboxes
- Block quotes

Args:
- document, string: The document ID or slug ID of the document to append to.
- content, string: The content to append in Markdown format.
- workspace, string: The ID of the workspace.
- position, string: Where to add the content - "top" or "bottom" (default: "bottom").

Returns an object with the following properties:
- documentId, string: The ID of the updated document.
- message, string: A success message.
`;

@Injectable()
export class AppendContentTool {
  private readonly logger = new Logger('AppendContentTool');

  constructor(
    private readonly pageRepo: PageRepo,
    private eventEmitter: EventEmitter2,
    private wsGateway: WsGateway,
  ) {}

  register(server: McpServer) {
    server.tool(
      'append_content',
      APPEND_CONTENT_TOOL_DESCRIPTION,
      {
        document: z
          .string()
          .describe('The document ID or slug ID of the document to append to.'),
        content: z
          .string()
          .describe('The content to append in Markdown format.'),
        workspace: z.string().describe('The ID of the workspace.'),
        position: z
          .enum(['top', 'bottom'])
          .default('bottom')
          .describe('Where to add the content - "top" or "bottom".'),
      },
      async (args: any) => {
        try {
          const { document, content, workspace, position = 'bottom' } = args;
          if (!document || !content || !workspace) {
            return {
              content: [
                {
                  type: 'text',
                  text: 'Missing required parameters: document, content, or workspace',
                },
              ],
              isError: true,
            };
          }

          const page = await this.pageRepo.findById(document, {
            includeContent: true,
            includeYdoc: true,
          });

          if (!page) {
            return {
              content: [
                { type: 'text', text: `Document "${document}" not found` },
              ],
              isError: true,
            };
          }

          // Convert Markdown to ProseMirror JSON
          let contentToAppend: JSONContent;
          try {
            // Convert Markdown to HTML
            const html = await markdownToHtml(content);

            // Convert HTML to ProseMirror JSON
            contentToAppend = htmlToJson(html);
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

          let contentNodesArray: any[] = [];
          if (
            contentToAppend.type === 'doc' &&
            Array.isArray(contentToAppend.content)
          ) {
            contentNodesArray = contentToAppend.content;
          } else if (Array.isArray(contentToAppend)) {
            contentNodesArray = contentToAppend;
          } else {
            contentNodesArray = [contentToAppend];
          }

          const fragmentYDoc = TiptapTransformer.toYdoc(
            { type: 'doc', content: contentNodesArray },
            'default',
            tiptapExtensions,
          );
          const fragmentRoot = fragmentYDoc.get(
            'default',
            Y.XmlFragment,
          ) as Y.XmlFragment;
          const fragmentNodes = Array.from(fragmentRoot.toArray());

          let ydoc = new Y.Doc();
          if (page.ydoc) {
            const existingState = new Uint8Array(page.ydoc);
            Y.applyUpdate(ydoc, existingState);
          }
          const mainRoot = ydoc.get('default', Y.XmlFragment) as Y.XmlFragment;
          const nodesToPush = fragmentNodes
            .filter(
              (node) =>
                node instanceof Y.XmlElement || node instanceof Y.XmlText,
            )
            .map((node) => node.clone());

          if (nodesToPush.length > 0) {
            if (position === 'top') {
              mainRoot.insert(0, nodesToPush);
            } else {
              mainRoot.push(nodesToPush);
            }
          }
          const mergedContent = TiptapTransformer.fromYdoc(ydoc, 'default');
          const ydocState = Buffer.from(Y.encodeStateAsUpdate(ydoc));
          const textContent = jsonToText(mergedContent);

          const contributors = new Set<string>(page.contributorIds || []);
          contributors.add(AGENT_USER_ID);
          const contributorIds = Array.from(contributors);

          await this.pageRepo.updatePage(
            {
              content: mergedContent,
              textContent: textContent,
              ydoc: ydocState,
              lastUpdatedById: AGENT_USER_ID,
              updatedAt: new Date(),
              contributorIds: contributorIds,
            },
            page.id,
          );

          const updatedPage = {
            ...page,
            content: mergedContent,
            textContent: textContent,
            ydoc: ydocState,
            lastUpdatedById: AGENT_USER_ID,
            updatedAt: new Date(),
          };

          // Emit event for the collaboration system to handle
          this.eventEmitter.emit('collab.page.updated', {
            page: updatedPage,
            source: 'append-content-tool',
          });

          // Emit WebSocket event to notify all clients
          this.wsGateway.server.emit('message', {
            operation: 'updateOne',
            spaceId: page.spaceId,
            entity: ['pages'],
            id: page.id,
            payload: {
              id: page.id,
              slugId: page.slugId,
              content: mergedContent,
              textContent: textContent,
              lastUpdatedById: AGENT_USER_ID,
              updatedAt: new Date(),
              spaceId: page.spaceId,
              workspaceId: page.workspaceId,
            },
          });

          this.logger.log(`Appended content to document with ID: ${page.id}`);

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    documentId: page.id,
                    slugId: page.slugId,
                    message: 'Content appended to document successfully',
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        } catch (error: any) {
          this.logger.error(
            `Failed to append to document: ${error.message}`,
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
