import { z } from 'zod';
import { Injectable, Logger } from '@nestjs/common';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export interface ISuggestion {
  textToReplace: string;
  textReplacement: string;
  reason: string;
  textBefore: string;
  textAfter: string;
}

export const SUGGEST_DIFF_TOOL_DESCRIPTION = `
Apply suggested improvements to a document by providing specific diff suggestions.
This tool takes an array of text replacement suggestions and applies them to the document.

Args:
- suggestions, array: An array of suggestion objects to apply to the document.
  Each suggestion should have:
  - textToReplace, string: The original text segment that should be replaced.
  - textReplacement, string: The text to replace the original text with.
  - reason, string: Explanation for why this change is recommended.
  - textBefore, string: Text that comes before the suggestion (for context).
  - textAfter, string: Text that comes after the suggestion (for context).

Returns:
A confirmation object containing information about the applied suggestions.
`;

@Injectable()
export class SuggestDiffTool {
  private readonly logger = new Logger('SuggestDiffTool');

  constructor() {}

  register(server: McpServer) {
    server.tool(
      'suggest_diff',
      SUGGEST_DIFF_TOOL_DESCRIPTION,
      {
        suggestions: z.array(
          z.object({
            textToReplace: z.string().describe('The original text segment to replace'),
            textReplacement: z.string().describe('The text to replace the original with'),
            reason: z.string().describe('Explanation for why this change is recommended'),
            textBefore: z.string().describe('Text before the suggestion for context'),
            textAfter: z.string().describe('Text after the suggestion for context')
          })
        ).describe('Array of suggestion objects to apply')
      },
      async (args: any) => {
        try {
          const { suggestions } = args;
          
          if (!suggestions || !Array.isArray(suggestions) || suggestions.length === 0) {
            return {
              content: [
                {
                  type: 'text',
                  text: 'Missing required parameter: suggestions (must be a non-empty array)',
                },
              ],
              isError: true,
            };
          }

          // Validate each suggestion object
          const validSuggestions = suggestions.filter(suggestion => 
            suggestion.textToReplace && 
            suggestion.textReplacement && 
            suggestion.reason &&
            suggestion.textBefore &&
            suggestion.textAfter
          );

          if (validSuggestions.length !== suggestions.length) {
            return {
              content: [
                {
                  type: 'text',
                  text: 'Some suggestions are missing required fields',
                },
              ],
              isError: true,
            };
          }

          this.logger.log(`Processing ${suggestions.length} suggestions`);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  status: 'success',
                  appliedSuggestions: suggestions.length,
                  message: `Successfully processed ${suggestions.length} suggestions`
                }, null, 2),
              },
            ],
          };
        } catch (error: any) {
          this.logger.error(
            `Failed to process suggestions: ${error.message}`,
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