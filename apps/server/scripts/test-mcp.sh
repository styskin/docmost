#!/bin/bash

# Test script for MCP HTTP endpoint using curl
# This script makes a POST request to test the create_document tool

# Configuration
MCP_URL="http://localhost:3000/api/mcp"
SPACE_ID="00000000-0000-0000-0000-000000000001" # Replace with a valid space ID

# Generate a timestamp for a unique document title
TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")

echo "Testing MCP create_document tool..."
echo "Sending request to $MCP_URL"

# Create the JSON payload with the correct method name for MCP tool invocation
PAYLOAD=$(cat <<EOF
{
  "jsonrpc": "2.0",
  "id": "1",
  "method": "tools/call",
  "params": {
    "name": "get_document",
    "arguments": {
      "slugId": "A1IA2kSfqF"
    }
  }
}
EOF
)

echo "Payload:"
echo "$PAYLOAD" | jq . 2>/dev/null || echo "$PAYLOAD"

# Make the curl request with required Accept headers
echo -e "\nSending request..."
RESPONSE_FILE="/tmp/mcp_response_$$.txt"
curl -v -X POST "$MCP_URL" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d "$PAYLOAD" > "$RESPONSE_FILE" 2>&1

echo -e "\nRaw Response (including headers):"
cat "$RESPONSE_FILE"

echo -e "\nTrying to parse the response body:"
# Extract just the response body (everything after the blank line that follows the headers)
RESPONSE_BODY=$(sed -n -e '/^$/,$p' "$RESPONSE_FILE" | tail -n +2)
echo "$RESPONSE_BODY"

# Extract JSON data from SSE format if present
SSE_JSON=$(echo "$RESPONSE_BODY" | grep "^data:" | sed 's/^data: //')
if [ ! -z "$SSE_JSON" ]; then
  echo -e "\nExtracted JSON from SSE:"
  echo "$SSE_JSON" | jq . 2>/dev/null || echo "$SSE_JSON"
  RESPONSE_BODY="$SSE_JSON"
fi

# Try to format with jq if it's valid JSON
echo -e "\nFormatted JSON (if valid):"
echo "$RESPONSE_BODY" | jq . 2>/dev/null || echo "Response is not valid JSON"

# Clean up
rm -f "$RESPONSE_FILE"

# Check for success (basic check)
if [[ "$RESPONSE_BODY" == *"documentId"* ]]; then
  echo -e "\nSuccess! Document created."
else
  echo -e "\nError: Failed to create document."
fi 