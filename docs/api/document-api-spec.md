# Document API Specification

This document provides the specification for the Document REST API endpoints.

## Base URL

All endpoints are relative to the base URL: `/documents`

## Authentication

All endpoints require JWT authentication. Include the JWT token in the Authorization header:

```
Authorization: Bearer <token>
```

## Endpoints

### Create Document

Creates a new document with the specified title, content, and space.

**Endpoint:** `POST /documents`

**Request Body:**

```json
{
  "title": "string",
  "content": "string",
  "spaceId": "uuid"
}
```

**Parameters:**

| Name    | Type   | Required | Description                                |
|---------|--------|----------|--------------------------------------------|
| title   | string | Yes      | The title of the document                  |
| content | string | Yes      | The content of the document                |
| spaceId | uuid   | Yes      | The ID of the space to create the document in |

**Response:**

```json
{
  "documentId": "uuid",
  "slugId": "string",
  "title": "string",
  "message": "Document created successfully"
}
```

**Status Codes:**

| Status Code | Description                                                  |
|-------------|--------------------------------------------------------------|
| 201         | Document created successfully                                |
| 400         | Bad request (invalid parameters)                             |
| 401         | Unauthorized (invalid or missing authentication token)       |
| 404         | Space not found                                              |
| 500         | Server error                                                 |

**Example:**

Request:
```http
POST /documents
Content-Type: application/json
Authorization: Bearer <token>

{
  "title": "Meeting Notes",
  "content": "These are the notes from our meeting on May 6th.",
  "spaceId": "550e8400-e29b-41d4-a716-446655440000"
}
```

Response:
```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "documentId": "123e4567-e89b-12d3-a456-426614174000",
  "slugId": "meeting-notes-abc123",
  "title": "Meeting Notes",
  "message": "Document created successfully"
}
```

### Get Document

Retrieves a document by its unique slug ID.

**Endpoint:** `GET /documents/:slugId`

**URL Parameters:**

| Name   | Type   | Required | Description                    |
|--------|--------|----------|--------------------------------|
| slugId | string | Yes      | The unique slug ID of the document |

**Response:**

```json
{
  "id": "uuid",
  "slugId": "string",
  "title": "string",
  "content": "object",
  "textContent": "string",
  "spaceId": "uuid",
  "workspaceId": "uuid"
}
```

**Status Codes:**

| Status Code | Description                                                  |
|-------------|--------------------------------------------------------------|
| 200         | Success                                                      |
| 401         | Unauthorized (invalid or missing authentication token)       |
| 404         | Document not found                                           |
| 500         | Server error                                                 |

**Example:**

Request:
```http
GET /documents/meeting-notes-abc123
Authorization: Bearer <token>
```

Response:
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "slugId": "meeting-notes-abc123",
  "title": "Meeting Notes",
  "content": {
    "type": "doc",
    "content": [
      {
        "type": "paragraph",
        "content": [
          {
            "type": "text",
            "text": "These are the notes from our meeting on May 6th."
          }
        ]
      }
    ]
  },
  "textContent": "These are the notes from our meeting on May 6th.",
  "spaceId": "550e8400-e29b-41d4-a716-446655440000",
  "workspaceId": "550e8400-e29b-41d4-a716-446655440001"
}
```

### List Documents

Lists all documents within a specified space.

**Endpoint:** `GET /documents`

**Query Parameters:**

| Name  | Type   | Required | Description                                |
|-------|--------|----------|--------------------------------------------|
| space | string | Yes      | The slug of the space to list documents from |

**Response:**

```json
[
  {
    "id": "uuid",
    "slugId": "string",
    "title": "string",
    "position": "string",
    "parentId": "uuid"
  }
]
```

**Status Codes:**

| Status Code | Description                                                  |
|-------------|--------------------------------------------------------------|
| 200         | Success                                                      |
| 401         | Unauthorized (invalid or missing authentication token)       |
| 404         | Space not found                                              |
| 500         | Server error                                                 |

**Example:**

Request:
```http
GET /documents?space=team-space
Authorization: Bearer <token>
```

Response:
```http
HTTP/1.1 200 OK
Content-Type: application/json

[
  {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "slugId": "meeting-notes-abc123",
    "title": "Meeting Notes",
    "position": "a0",
    "parentId": null
  },
  {
    "id": "123e4567-e89b-12d3-a456-426614174001",
    "slugId": "project-plan-def456",
    "title": "Project Plan",
    "position": "b0",
    "parentId": null
  }
]
```

## Error Responses

All endpoints return errors in the following format:

```json
{
  "statusCode": 400,
  "message": "Error message",
  "error": "Error type"
}
```

Example error response:

```json
{
  "statusCode": 404,
  "message": "Space \"team-space\" not found",
  "error": "Not Found"
}
