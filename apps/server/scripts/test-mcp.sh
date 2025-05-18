#!/bin/bash

# Test script for MCP HTTP endpoint using curl
# This script makes a POST request to test the create_document tool

# Configuration
MCP_URL="http://localhost:3000/api/mcp"
WORKSPACE_ID="0196a081-de73-769c-a5ed-24ec58cf4734"

# Generate a timestamp for a unique document title
TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")


########################################################
# List workspaces
########################################################

echo "Testing MCP list_workspaces tool..."
echo "Sending request to $MCP_URL"

# Create the JSON payload with the correct method name for MCP tool invocation
PAYLOAD=$(cat <<EOF
{
  "jsonrpc": "2.0",
  "id": "1",
  "method": "tools/call",
  "params": {
    "name": "list_workspaces",
    "arguments": {}
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
rm -f "$RESPONSE_FILE"


########################################################
# List spaces
########################################################

echo "Testing MCP list_spaces tool..."
echo "Sending request to $MCP_URL"

# Create the JSON payload with the correct method name for MCP tool invocation
PAYLOAD=$(cat <<EOF
{
  "jsonrpc": "2.0",
  "id": "1",
  "method": "tools/call",
  "params": {
    "name": "list_spaces",
    "arguments": {
      "workspace": "$WORKSPACE_ID"
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
rm -f "$RESPONSE_FILE"


########################################################
# Create a document
########################################################

echo "Testing MCP create_document tool..."
echo "Sending request to $MCP_URL"

# Create the JSON payload with the correct method name for MCP tool invocation
PAYLOAD=$(cat <<EOF
{
  "jsonrpc": "2.0",
  "id": "1",
  "method": "tools/call",
  "params": {
    "name": "create_document",
    "arguments": {
      "title": "Test Document",
      "content": "{\"type\": \"doc\", \"content\": [{\"type\": \"paragraph\", \"content\": [{\"type\": \"text\", \"text\": \"Hello, world!\"}]}] }",
      "space": "general",
      "workspace": "$WORKSPACE_ID"
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
rm -f "$RESPONSE_FILE"


########################################################
# List a document
########################################################

echo "Testing MCP list_documents tool..."
echo "Sending request to $MCP_URL"

# Create the JSON payload with the correct method name for MCP tool invocation
PAYLOAD=$(cat <<EOF
{
  "jsonrpc": "2.0",
  "id": "1",
  "method": "tools/call",
  "params": {
    "name": "list_documents",
    "arguments": {
      "space": "general",
      "workspace": "$WORKSPACE_ID"
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
rm -f "$RESPONSE_FILE"


########################################################
# Get a document
########################################################

echo "Testing MCP get_document tool..."
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
      "slugId": "rXYv03k1BA"
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
rm -f "$RESPONSE_FILE"


########################################################
# Append to a document
########################################################

echo "Testing MCP append_document tool..."
echo "Sending request to $MCP_URL"

# Create the JSON payload with the correct method name for MCP tool invocation
PAYLOAD=$(cat <<EOF
{
  "jsonrpc": "2.0",
  "id": "1",
  "method": "tools/call",
  "params": {
    "name": "append_document",
    "arguments": {
      "document": "rXYv03k1BA",
      "content": "{\"type\": \"doc\", \"content\": [{\"type\": \"paragraph\", \"content\": [{\"type\": \"text\", \"text\": \"This is appended content.\"}]}] }",
      "workspace": "$WORKSPACE_ID"
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
rm -f "$RESPONSE_FILE"