# Model Context Protocol (MCP) Server

This module implements an MCP server inside the Docmost application that allows external AI assistants and clients to create documents in Docmost.

## Overview

The MCP server uses the official Model Context Protocol SDK with a robust fallback mechanism to ensure reliability. If the SDK loads successfully, it uses the real implementation; otherwise, it gracefully falls back to a mock implementation that still provides the same interface and functionality.

The server exposes a single tool:

- `create_document`: Creates a new document with specified title and content.

## Usage

The MCP server uses the stdio transport and can be accessed by any MCP client, such as Claude Desktop.

### Tool: create_document

**Parameters:**

- `title` (string): The title of the document
- `content` (string): The content of the document in markdown format
- `spaceId` (string): The ID of the space where the document should be created (UUID format)

**Example Input:**

```json
{
  "title": "Meeting Notes",
  "content": "# Meeting Notes\n\n- Discussed project timeline\n- Assigned tasks\n- Set next meeting date",
  "spaceId": "00000000-0000-0000-0000-000000000001"
}
```

**Example Output:**

```json
{
  "documentId": "123e4567-e89b-12d3-a456-426614174000",
  "slugId": "ABC123xyz",
  "title": "Meeting Notes",
  "message": "Document created successfully"
}
```

## Implementation Details

This module attempts to use the official Model Context Protocol SDK in multiple ways (ESM imports, CJS requires, etc.) and falls back to a mock implementation if all attempts fail. This ensures robustness even if there are module resolution issues with the SDK.

The implementation:
1. Tries to load the SDK using various approaches
2. Creates either a real MCP server or a mock implementation depending on success
3. Registers the document creation tool with proper parameter validation
4. Uses the Docmost page repository to create actual documents
5. Returns standardized responses per MCP specifications

Both the real SDK and mock implementation provide the same interface and functionality, ensuring a consistent experience.

## Future Improvements

1. Add proper authentication and authorization
2. Add more tools for interacting with documents
3. Add support for HTTP transport in addition to stdio

## Requirements

- Model Context Protocol SDK (@modelcontextprotocol/sdk) - optional but preferred
- Zod for input validation
- Access to the Docmost database and page repository 