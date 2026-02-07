# Global Error Logging System

## Overview

Implemented a comprehensive global error logging system that automatically captures and stores all application errors in the database.

## Components

### 1. Database Table: `application_errors`

**Location**: `DB_Schema/db_command.sql`

**Purpose**: Stores all application-level errors with rich context

**Key Fields**:

- `error_type`: DATABASE | AUTHENTICATION | VALIDATION | API | S3 | LAMBDA | UNKNOWN
- `severity`: INFO | WARN | ERROR | CRITICAL
- `endpoint`: The API route that failed
- `method`: HTTP method (GET, POST, etc.)
- `request_ip`: Client IP address
- `user_id`: User who encountered the error (nullable)
- `chatbot_id`: Related chatbot (nullable)
- `error_message`: Human-readable error description
- `error_stack`: Full stack trace for debugging
- `request_body`: Sanitized request payload (passwords/tokens redacted)
- `request_params`: URL parameters
- `request_query`: Query string parameters
- `metadata`: Additional context (JSONB)

### 2. Drizzle Schema

**Location**: `drizzle/schema.ts`

Added `applicationErrors` table definition for type-safe database operations.

### 3. Enhanced AsyncHandler

**Location**: `src/utils/asyncHandler.js`

**Features**:

- **Automatic Error Logging**: Every error caught by asyncHandler is logged to the database
- **Smart Error Classification**: Automatically determines error type (DATABASE, AUTH, VALIDATION, etc.)
- **Severity Detection**: Assigns severity based on HTTP status codes and error messages
- **Data Sanitization**: Removes sensitive data (passwords, tokens, API keys) before logging
- **Request Context**: Captures full request details (URL, method, IP, user agent, params, body)
- **Graceful Failure**: If database logging fails, falls back to console logging

## Usage

### Already Implemented

All your controllers using `asyncHandler` will automatically log errors:

```javascript
export const handleIngestionWebhook = asyncHandler(async (req, res) => {
  // Your code here
  // Any errors will be automatically logged to application_errors table
});
```

### Error Example from Your Terminal

The error you're seeing:

```
Error: Failed query: select ... from "ingestion_files" where "ingestion_files"."id" = $1
params: fileId_789,1
```

Will be logged as:

- **error_type**: `DATABASE`
- **severity**: `ERROR`
- **endpoint**: `/api/ingestion/webhook` (or whatever route)
- **error_message**: "Failed query: select..."
- **error_stack**: Full stack trace
- **request_body**: The webhook payload
- **user_id**: The authenticated user (if any)

## Next Steps

### 1. Run Database Migration

You need to create the `application_errors` table in your database:

```sql
-- Run this in your PostgreSQL database
-- (Already added to DB_Schema/db_command.sql)
```

### 2. Query Errors

You can now query all errors:

```javascript
// Get all unresolved errors
const errors = await db
  .select()
  .from(applicationErrors)
  .where(eq(applicationErrors.resolved, false))
  .orderBy(desc(applicationErrors.createdAt));

// Get database errors
const dbErrors = await db
  .select()
  .from(applicationErrors)
  .where(eq(applicationErrors.errorType, "DATABASE"))
  .limit(50);

// Get critical errors for a specific user
const userCriticalErrors = await db
  .select()
  .from(applicationErrors)
  .where(
    and(
      eq(applicationErrors.userId, userId),
      eq(applicationErrors.severity, "CRITICAL")
    )
  );
```

### 3. Create Error Dashboard (Optional)

You can create an admin controller to view errors:

```javascript
export const getApplicationErrors = asyncHandler(async (req, res) => {
  const { type, severity, resolved } = req.query;

  let query = db.select().from(applicationErrors);

  if (type) query = query.where(eq(applicationErrors.errorType, type));
  if (severity) query = query.where(eq(applicationErrors.severity, severity));
  if (resolved !== undefined) {
    query = query.where(eq(applicationErrors.resolved, resolved === "true"));
  }

  const errors = await query
    .orderBy(desc(applicationErrors.createdAt))
    .limit(100);

  res.status(200).json(new ApiResponse(200, { errors }, "Errors retrieved"));
});
```

## Benefits

1. **Automatic Logging**: No need to manually log errors in each controller
2. **Rich Context**: Every error includes request details, user info, and stack traces
3. **Security**: Sensitive data is automatically redacted
4. **Debugging**: Full stack traces and request context make debugging easier
5. **Monitoring**: Can track error patterns, frequency, and affected users
6. **Analytics**: Query errors by type, severity, user, endpoint, etc.

## Current Error Fix

The error you're seeing (`fileId_789` not found) is a **data issue**, not a code issue. The webhook is being called with a test `fileId` that doesn't exist in your database.

To fix it:

1. Use a real `fileId` from your `ingestion_files` table
2. Or create a test file first, then use that ID in your webhook test
