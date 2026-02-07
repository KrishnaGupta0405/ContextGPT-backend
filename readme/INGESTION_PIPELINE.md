# Ingestion Pipeline - Implementation Summary

## Overview

Complete ingestion pipeline for handling file uploads, Lambda processing, and data storage with proper error handling and status tracking.

## Architecture Flow

```
User → Backend (uploadFile) → S3 Upload → Lambda Trigger
  ↓
Lambda processes file:
  - Chunks file
  - Generates embeddings (OpenAI)
  - Stores chunks & embeddings in S3
  - Sends webhook to backend
  ↓
Backend (handleIngestionWebhook) → DB Transaction:
  - Updates ingestion_files status
  - Inserts chunks into ingestion_chunks
  - Logs status in ingestion_status_logs
  - Handles errors in ingestion_errors
```

## API Endpoints

### 1. File Upload

**POST** `/api/v1/ingestion/upload`

- **Auth**: Required (verifyJWT)
- **Body**: `multipart/form-data`
  - `file`: The file to upload (PDF/DOCX/TXT)
  - `chatbotId`: UUID of the chatbot

**Response**:

```json
{
  "statusCode": 200,
  "data": { "fileId": "uuid" },
  "message": "File uploaded successfully"
}
```

---

### 2. Lambda Webhook

**POST** `/api/v1/ingestion/webhook`

- **Auth**: Secret header (`x-webhook-secret`)
- **Body**: JSON

**Lambda should send**:

```json
{
  "fileId": "uuid-from-ingestion_files",
  "status": "COMPLETED", // or "FAILED", "CHUNKING", "EMBEDDING"
  "totalChunks": 5,
  "totalTokens": 2500,
  "totalPages": 10,
  "chunks": [
    {
      "chunkIndex": 1,
      "s3ChunkUrl": "s3://bucket/chunks/file-uuid-chunk1.txt",
      "tokenCount": 500,
      "embeddingStatus": "COMPLETED",
      "pineconeVectorId": "vec-123" // Optional
    }
  ],
  "error": {
    // Only if status === "FAILED"
    "step": "EMBEDDING",
    "message": "OpenAI API rate limit exceeded"
  }
}
```

**Response**: `{ "success": true }`

---

### 3. Get File Status

**GET** `/api/v1/ingestion/file/:fileId`

- **Auth**: Required

**Response**:

```json
{
  "statusCode": 200,
  "data": {
    "file": {
      /* ingestion_files record */
    },
    "chunks": [
      /* array of chunks */
    ],
    "statusLogs": [
      /* array of status logs */
    ]
  },
  "message": "File status retrieved successfully"
}
```

---

### 4. Get Chatbot Files

**GET** `/api/v1/ingestion/chatbot/:chatbotId/files?status=COMPLETED`

- **Auth**: Required
- **Query Params**: `status` (optional) - filter by file status

**Response**:

```json
{
  "statusCode": 200,
  "data": {
    "files": [
      /* array of files */
    ],
    "total": 10
  },
  "message": "Files retrieved successfully"
}
```

---

### 5. Get Ingestion Errors

**GET** `/api/v1/ingestion/chatbot/:chatbotId/errors?fileId=uuid`

- **Auth**: Required
- **Query Params**: `fileId` (optional) - filter by specific file

**Response**:

```json
{
  "statusCode": 200,
  "data": {
    "errors": [
      /* array of error records */
    ],
    "total": 3
  },
  "message": "Errors retrieved successfully"
}
```

---

### 6. Delete File

**DELETE** `/api/v1/ingestion/file/:fileId`

- **Auth**: Required

**Response**:

```json
{
  "statusCode": 200,
  "data": null,
  "message": "File deleted successfully"
}
```

**Note**: Chunks, status logs, and errors are cascade deleted automatically.

---

## Database Tables Used

### `ingestion_files`

Stores file metadata and status:

- `id` (UUID): File identifier (also S3 key name)
- `chatbot_id`, `user_id`
- `file_name`, `file_type`, `file_size`
- `status`: `UPLOADED | CHUNKING | EMBEDDING | COMPLETED | FAILED`
- `total_chunks`, `file_tokens`, `file_pages`
- `s3_url`: Full S3 URL to original file

### `ingestion_chunks`

Stores individual chunk data:

- `file_id`: FK to ingestion_files
- `chunk_index`: Order within file
- `s3_chunk_url`: S3 location of chunk text
- `token_count`: Tokens in this chunk
- `embedding_status`: `PENDING | COMPLETED | FAILED`
- `pinecone_vector_id`: Vector DB identifier (if applicable)

### `ingestion_status_logs`

Audit trail of ingestion progress:

- `chatbot_id`, `entity_type` (FILE|CHUNK|SOURCE)
- `file_id`, `status`, `metadata` (JSONB)

### `ingestion_errors`

Error tracking:

- `chatbot_id`, `file_id`, `chunk_id`
- `step`: `CHUNKING | EMBEDDING | VECTOR_STORAGE`
- `error_message`, `retry_count`

---

## Environment Variables Required

```env
# AWS S3
AWS_REGION=us-east-1
AWS_ACCESS_KEY=your-access-key
AWS_SECRET_KEY=your-secret-key
AWS_BUCKET_NAME=your-bucket-name

# Lambda Webhook Security
LAMBDA_WEBHOOK_SECRET=shared-secret-with-lambda
```

---

## Key Implementation Details

### 1. File Upload Logic

- Validates file type (PDF, DOCX, TXT)
- Generates UUID as fileId
- Uploads to S3 with key = fileId
- Inserts record into `ingestion_files` with status `UPLOADED`
- Cleans up local temp file after upload

### 2. Webhook Handler

- **Security**: Validates `x-webhook-secret` header
- **Transaction Support**: Uses Drizzle transactions for COMPLETED status
- **Handles Multiple States**:
  - `FAILED`: Updates file status, logs error
  - `COMPLETED`: Updates file, inserts chunks, logs status (all-or-nothing)
  - Others (`CHUNKING`, `EMBEDDING`): Updates status and logs

### 3. Error Handling

- All controllers use `ApiError` for consistent error responses
- File cleanup on upload errors
- Proper cascade deletion from DB schema

---

## Lambda Integration Notes

### What Lambda Should Do:

1. Receive S3 event trigger when file is uploaded
2. Download file from S3 using `fileId` as key
3. Chunk the file into smaller pieces
4. Generate embeddings using OpenAI API
5. Store chunks and embeddings in S3
6. Send webhook to backend with results

### Webhook Call Example:

```javascript
const axios = require("axios");

await axios.post(
  "https://your-api.com/api/v1/ingestion/webhook",
  {
    fileId: event.Records[0].s3.object.key, // The UUID
    status: "COMPLETED",
    totalChunks: chunks.length,
    totalTokens: 2500,
    totalPages: 10,
    chunks: processedChunks.map((c, i) => ({
      chunkIndex: i + 1,
      s3ChunkUrl: `s3://bucket/chunks/${fileId}-chunk${i}.txt`,
      tokenCount: c.tokens,
      embeddingStatus: "COMPLETED",
      pineconeVectorId: c.vectorId,
    })),
  },
  {
    headers: {
      "x-webhook-secret": process.env.WEBHOOK_SECRET,
    },
  }
);
```

---

## Testing the Pipeline

### 1. Upload a file

```bash
curl -X POST http://localhost:8000/api/v1/ingestion/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@test.pdf" \
  -F "chatbotId=your-chatbot-uuid"
```

### 2. Simulate Lambda webhook (after processing)

```bash
curl -X POST http://localhost:8000/api/v1/ingestion/webhook \
  -H "x-webhook-secret: your-secret" \
  -H "Content-Type: application/json" \
  -d '{
    "fileId": "file-uuid-from-step-1",
    "status": "COMPLETED",
    "totalChunks": 3,
    "totalTokens": 1500,
    "totalPages": 5,
    "chunks": [
      {
        "chunkIndex": 1,
        "s3ChunkUrl": "s3://bucket/chunk1.txt",
        "tokenCount": 500,
        "embeddingStatus": "COMPLETED"
      }
    ]
  }'
```

### 3. Check file status

```bash
curl -X GET http://localhost:8000/api/v1/ingestion/file/FILE_UUID \
  -H "Authorization: Bearer YOUR_TOKEN"
```
