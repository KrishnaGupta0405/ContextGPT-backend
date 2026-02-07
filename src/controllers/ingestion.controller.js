import { db } from "../index.js";
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import fs from "fs";
import crypto from "crypto";
// import { getSignedUrl } from "@aws-sdk/s3-request-presigner"; // If needed for upload
import {
  ingestionFiles,
  ingestionChunks,
  ingestionStatusLogs,
  ingestionErrors,
} from "../../drizzle/schema.ts";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { eq, desc } from "drizzle-orm";
import { asyncHandler } from "../utils/asyncHandler.js";
import { validate as isUUID } from "uuid";

//================================================================
// const objectKey = `chatbots/${chatbotId}/files/${fileId}/raw.${fileExt}`;

// const fileID = chatbots/{chatbotId}/files/{fileId}/chunk/chunk_0.txt
// chatbots/{chatbotId}/files/{fileId}/chunk/
//   ├── chunks/chunk_0.txt
//   ├── chunks/chunk_1.txt
//   ├── chunks/chunk_2.txt

// namespace = chatbots/{chatbotId}/files/{fileId}/vector/vector_0.embedding
//   ├── vector id: chunk_0
//   ├── vector id: chunk_1
//   ├── vector id: chunk_2

// Pinecone (The "Brain")
// This is where you change your logic. You stop creating a new namespace for every file. Instead, you create one namespace per chatbot. All files for that customer go into that same "bucket."
// Namespace: chatbot_{chatbotId}
// Metadata: This is how the "Brain" knows which file is which. Every vector you save gets a tag called fileId.

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_KEY,
  },
});

const isValidStatus = (status) =>
  ["UPLOADED", "CHUNKING", "EMBEDDING", "COMPLETED", "FAILED"].includes(status);
//================================================================

// 1. Raw file import Upload
export const uploadFile = asyncHandler(async (req, res) => {
  const file = req.file;
  if (!file) {
    throw new ApiError(400, "No file uploaded");
  }

  const { chatbotId } = req.body;
  const userId = req.user.id;

  let fileType = "UNKNOWN";

  if (file.mimetype === "application/pdf") fileType = "PDF";
  else if (
    file.mimetype ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  )
    fileType = "DOCX";
  else if (file.mimetype === "text/plain") fileType = "TXT";
  else if (file.mimetype === "text/markdown") fileType = "MD";
  else if (
    file.mimetype === "text/html" ||
    file.mimetype === "application/xhtml+xml"
  )
    fileType = "HTML";
  else {
    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
    throw new ApiError(400, "Unsupported file type");
  }

  // Generate fileId and S3 key (UUID-based, no original filename)
  const fileId = crypto.randomUUID();
  const fileExt = fileType.toLowerCase(); // pdf, docx, txt
  const objectKey = `uploads/chatbots/${chatbotId}/files/LOCAL_UPLOAD/${fileId}/raw.${fileExt}`;

  // Read file content
  const fileContent = fs.readFileSync(file.path);
  // console.log("File content:", fileContent);

  if (!fileContent || fileContent.length === 0) {
    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
    throw new ApiError(400, "File content is empty or could not be read");
  }

  if (fileContent.length !== file.size) {
    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
    throw new ApiError(400, "File read error: size mismatch detected");
  }

  // Upload to S3
  const command = new PutObjectCommand({
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: objectKey,
    Body: fileContent,
    ContentType: file.mimetype,
  });

  const uploadResponse = await s3Client.send(command);
  // console.log("Upload response:", uploadResponse);

  if (!uploadResponse) {
    throw new ApiError(500, "Failed to upload file to S3");
  }

  // Insert into DB
  try {
    await db.insert(ingestionFiles).values({
      id: fileId,
      chatbotId,
      userId,

      fileName: file.originalname,
      fileType,
      fileSize: file.size,
      fileSource: "LOCAL_UPLOAD",
      origin: "FILE",

      storageUri: `https://${process.env.AWS_BUCKET_NAME}.s3.amazonaws.com/${objectKey}`,
      objectKey: objectKey,
      status: "UPLOADED",

      // created_at and updated_at are automatically handled by postgresSql
    });
  } catch (error) {
    throw new ApiError(500, "Failed to update file record");
  }

  // also update status inside ingestion_status_logs table
  try {
    await db.insert(ingestionStatusLogs).values({
      chatbotId,
      entityType: "FILE",
      fileId,
      status: "UPLOADED",

      // created_at and updated_at are automatically handled by postgresSql
    });
  } catch (error) {
    throw new ApiError(500, "Failed to update status in logs");
  }

  // Cleanup local file
  if (fs.existsSync(file.path)) {
    fs.unlinkSync(file.path);
  }

  res
    .status(200)
    .json(new ApiResponse(200, { fileId }, "File uploaded successfully"));
});

// 1.1 YouTube Transcript Upload
// TODO: Playlist upload coming soon
export const uploadYoutubeTranscripts = asyncHandler(async (req, res) => {
  const { chatbotId, videoIds } = req.body;
  const userId = req.user.id;

  if (!chatbotId) {
    throw new ApiError(400, "Chatbot ID is required");
  }

  if (!videoIds || !Array.isArray(videoIds) || videoIds.length === 0) {
    throw new ApiError(
      400,
      "Video IDs array is required and must not be empty"
    );
  }

  const LAMBDA_TRANSCRIPT_API =
    "https://3ncw479pf7.execute-api.us-east-1.amazonaws.com/transcript";
  const results = [];
  const errors = [];

  // Process each video ID
  for (const videoId of videoIds) {
    try {
      // Fetch transcript from Lambda API
      const response = await fetch(`${LAMBDA_TRANSCRIPT_API}/${videoId}`);

      if (!response.ok) {
        errors.push({
          videoId,
          error: `Failed to fetch transcript: ${response.statusText}`,
        });
        continue;
      }

      const transcriptData = await response.json();

      if (!transcriptData.text || transcriptData.text.trim().length === 0) {
        errors.push({
          videoId,
          error: "Transcript text is empty",
        });
        continue;
      }

      // Create text file content
      const fileContent = Buffer.from(transcriptData.text, "utf-8");
      const fileSize = fileContent.length;

      // Generate fileId and S3 key
      const fileId = crypto.randomUUID();
      const fileType = "TXT";
      const fileExt = "txt";
      const objectKey = `uploads/chatbots/${chatbotId}/files/YOUTUBE/${fileId}/raw.${fileExt}`;

      // Upload to S3
      const command = new PutObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: objectKey,
        Body: fileContent,
        ContentType: "text/plain",
      });

      const uploadResponse = await s3Client.send(command);
      // console.log(`Upload response for video ${videoId}:`, uploadResponse);

      if (!uploadResponse) {
        errors.push({
          videoId,
          error: "Failed to upload file to S3",
        });
        continue;
      }

      // Insert into DB
      try {
        await db.insert(ingestionFiles).values({
          id: fileId,
          chatbotId,
          userId,

          fileName: `YouTube_${videoId}.txt`,
          fileType,
          fileSize,
          fileSource: "YOUTUBE",
          origin: "FILE",

          storageUri: `https://${process.env.AWS_BUCKET_NAME}.s3.amazonaws.com/${objectKey}`,
          objectKey: objectKey,
          status: "UPLOADED",
        });
      } catch (error) {
        throw new ApiError(500, "Failed to update file record");
      }

      // Update status inside ingestion_status_logs table
      try {
        await db.insert(ingestionStatusLogs).values({
          chatbotId,
          entityType: "FILE",
          fileId,
          status: "UPLOADED",
        });
      } catch (error) {
        throw new ApiError(500, "Failed to update status in logs");
      }

      results.push({
        videoId,
        fileId,
        status: "success",
      });
    } catch (error) {
      console.error(`Error processing video ${videoId}:`, error);
      errors.push({
        videoId,
        error: error.message || "Unknown error occurred",
      });
    }
  }

  // Return response with both successes and failures
  res.status(200).json(
    new ApiResponse(
      200,
      {
        successful: results,
        failed: errors,
        totalProcessed: videoIds.length,
        successCount: results.length,
        failureCount: errors.length,
      },
      `Processed ${results.length} of ${videoIds.length} YouTube transcripts successfully`
    )
  );
});

// Lambda2 Should return something like this
// {
//   chunkIndex,
//   objectKey,
//   chunkTextPreviewLink,
//   tokenCount,
//   embeddingStatus,
//   vectorId,
//   vectorNamespace,
//   vectorMetadata,
//   pageNumber
// }

// Lambda2 failed case ->
// {
//   "fileId": "fileId_789",
//   "status": "FAILED",
//   "error": {
//     "step": "EMBEDDING_GENERATION",
//     "message": "<the actual python exception string>"
//   }
// }
// 2. Webhook Controller (Triggered by Lambda)
export const handleIngestionWebhook = asyncHandler(async (req, res) => {
  const {
    fileId,
    status,
    totalChunks,
    totalTokens,
    totalPages,
    chunks, // array of chunks
    error,
  } = req.body;

  // Security Check: Verify a shared secret key from Lambda to prevent fake requests
  const signature = req.headers["x-webhook-signature"];
  const body = JSON.stringify(req.body);

  const expected = crypto
    .createHmac("sha256", process.env.LAMBDA_WEBHOOK_SECRET)
    .update(body)
    .digest("hex");

  if (signature !== expected) {
    throw new ApiError(403, "Invalid signature");
  }

  if (!fileId) {
    throw new ApiError(400, "fileId is required");
  }

  // Get file record to retrieve chatbot_id
  const [fileRecord] = await db
    .select()
    .from(ingestionFiles)
    .where(eq(ingestionFiles.id, fileId))
    .limit(1);

  if (!fileRecord) {
    throw new ApiError(404, "File not found");
  }

  // Handle FAILED status
  if (!isValidStatus(status)) {
    throw new ApiError(400, "Invalid status");
  }

  if (status === "FAILED") {
    // 1. Update the file table
    try {
      await db
        .update(ingestionFiles)
        .set({
          status: "FAILED",
          updatedAt: new Date().toISOString(),
        })
        .where(eq(ingestionFiles.id, fileId));
    } catch (error) {
      throw new ApiError(500, "Failed to update file status");
    }

    // 2. Also log error inside ingestion_error table
    try {
      await db.insert(ingestionErrors).values({
        chatbotId: fileRecord.chatbotId,
        fileId,
        chunkId: null,
        step: error?.step || "UNKNOWN",
        errorMessage: error?.message || "Processing failed",
        retryCount: 0,
      });
    } catch (error) {
      throw new ApiError(500, "Failed to upload error logs");
    }

    // 3. also update status inside ingestion_status_logs table
    try {
      await db
        .update(ingestionStatusLogs)
        .set({
          status: "FAILED",
          updatedAt: new Date().toISOString(),
        })
        .where(eq(ingestionStatusLogs.fileId, fileId));
    } catch (error) {
      throw new ApiError(500, "Failed to update status in logs");
    }

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { received: true },
          "File processing failed, status updated."
        )
      );
  }

  // Handle COMPLETED status - Use transaction for data integrity
  if (status === "COMPLETED") {
    await db.transaction(async (tx) => {
      // 1. Update File Status & Stats
      await tx
        .update(ingestionFiles)
        .set({
          status: "COMPLETED",
          totalChunks: totalChunks || chunks?.length || 0,
          fileTokens: totalTokens,
          filePages: totalPages,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(ingestionFiles.id, fileId));

      // 2. Batch Insert Chunks
      if (chunks && chunks.length > 0) {
        const chunksToInsert = chunks.map((chunk) => ({
          fileId,
          chunkIndex: chunk.chunkIndex,
          objectKey: chunk.objectKey,
          chunkTextPreviewLink: chunk.chunkTextPreviewLink || null,
          tokenCount: chunk.tokenCount || 0,
          embeddingStatus: chunk.embeddingStatus || "COMPLETED",
          vectorId: chunk.vectorId || null,
          vectorNamespace: chunk.vectorNamespace || null,
          vectorMetadata: chunk.vectorMetadata || null,
          pageNumber: chunk.pageNumber || null,
        }));

        await tx
          .insert(ingestionChunks)
          .values(chunksToInsert)
          .onConflictDoNothing();
      }

      // 3. Log Status
      await tx.insert(ingestionStatusLogs).values({
        chatbotId: fileRecord.chatbotId,
        entityType: "FILE",
        fileId,
        status: "COMPLETED",
        metadata: {
          source: "lambda-webhook",
          totalChunks: chunks?.length || 0,
          totalTokens,
          totalPages,
        },
      });
    });

    return res
      .status(200)
      .json(new ApiResponse(200, {}, "Ingestion completed successfully"));
  }

  // Handle other statuses (CHUNKING, EMBEDDING, etc.)
  await db
    .update(ingestionFiles)
    .set({
      status,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(ingestionFiles.id, fileId));

  // Log status update
  await db.insert(ingestionStatusLogs).values({
    chatbotId: fileRecord.chatbotId,
    entityType: "FILE",
    fileId,
    status,
    metadata: { source: "lambda-webhook" },
  });

  res
    .status(200)
    .json(new ApiResponse(200, {}, `Ingestion status updated to ${status}`));
});

// 3. Get File Status and Chunks
export const getFileStatus = asyncHandler(async (req, res) => {
  const { fileId } = req.params;

  if (!fileId) {
    throw new ApiError(400, "File ID is required");
  }

  const [file] = await db
    .select()
    .from(ingestionFiles)
    .where(eq(ingestionFiles.id, fileId))
    .limit(1);

  if (!file) {
    throw new ApiError(404, "File not found");
  }

  // Get chunks: No need to share chunks to user, all they need is total pages
  // const fileChunks = await db
  //   .select()
  //   .from(ingestionChunks)
  //   .where(eq(ingestionChunks.fileId, fileId))
  //   .orderBy(ingestionChunks.chunkIndex);

  // Get latest status log
  const statusLogs = await db
    .select()
    .from(ingestionStatusLogs)
    .where(eq(ingestionStatusLogs.fileId, fileId))
    .orderBy(ingestionStatusLogs.createdAt);

  res.status(200).json(
    new ApiResponse(
      200,
      {
        file,
        // chunks: fileChunks,
        statusLogs,
      },
      "File status retrieved successfully"
    )
  );
});

// 4. Get All Files for a Chatbot
export const getChatbotFiles = asyncHandler(async (req, res) => {
  const { chatbotId } = req.params;
  // status: In Progeress(UPLOADED), COMPLETED, FAILED, IN_PROGRESS(Chunking || Embedding)
  const { status } = req.query; // Optional filter by status

  if (!chatbotId) {
    throw new ApiError(400, "Chatbot ID is required");
  }

  const filesQuery = db
    .select()
    .from(ingestionFiles)
    .where(eq(ingestionFiles.chatbotId, chatbotId));

  const files = status
    ? await filesQuery
        .where(eq(ingestionFiles.status, status))
        .orderBy(desc(ingestionFiles.createdAt))
    : await filesQuery.orderBy(desc(ingestionFiles.createdAt));

  res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { files, total: files.length },
        "Files retrieved successfully"
      )
    );
});

// 5. Get Ingestion Errors
// export const getIngestionErrors = async (req, res) => {
//   const { chatbotId } = req.params;
//   const { fileId } = req.query; // Optional filter by fileId

//   if (!chatbotId) {
//     throw new ApiError(400, "Chatbot ID is required");
//   }

//   const errorsQuery = db
//     .select()
//     .from(ingestionErrors)
//     .where(eq(ingestionErrors.chatbotId, chatbotId));

//   const errors = fileId
//      await errorsQuery
//         .where(eq(ingestionErrors.fileId, fileId))
//         .orderBy(desc(ingestionErrors.createdAt))
//     : await errorsQuery.orderBy(desc(ingestionErrors.createdAt));

//   res
//     .status(200)
//     .json(
//       new ApiResponse(
//         200,
//         { errors, total: errors.length },
//         "Errors retrieved successfully"
//       )
//     );
// };

// 6. Delete File and Associated Data
export const deleteFile = asyncHandler(async (req, res) => {
  const { fileId } = req.params;

  if (!fileId) {
    throw new ApiError(400, "File ID is required");
  }

  const [file] = await db
    .select()
    .from(ingestionFiles)
    .where(eq(ingestionFiles.id, fileId))
    .limit(1);

  if (!file) {
    throw new ApiError(404, "File not found");
  }

  const prefix = `chatbots/${file.chatbotId}/files/${fileId}/`;
  const vectorNamespace = `chatbots/${file.chatbotId}/files/${fileId}/vector`;

  try {
    // 1. update the status log to DELETING
    await db
      .update(ingestionStatusLogs)
      .set({
        status: "DELETING",
        updatedAt: new Date().toISOString(),
      })
      .where(eq(ingestionStatusLogs.fileId, fileId));

    // 2. Delete from Pinecone (whole file/namespace)
    await pineconeIndex.delete({
      namespace: vectorNamespace,
    });

    // 3. List all objects under prefix
    const listed = await s3Client.send(
      new ListObjectsV2Command({
        Bucket: process.env.AWS_BUCKET_NAME,
        Prefix: prefix,
      })
    );

    if (listed.Contents?.length) {
      // 4. Batch delete (up to 1000 per call)
      await s3Client.send(
        new DeleteObjectsCommand({
          Bucket: process.env.AWS_BUCKET_NAME,
          Delete: {
            Objects: listed.Contents.map((o) => ({ Key: o.Key })),
            Quiet: true,
          },
        })
      );
    }
  } catch (err) {
    console.error(err);
    throw new ApiError(500, "Failed to delete file", err.message);
  }

  // 5. Delete DB records (cascades)
  await db.transaction(async (tx) => {
    if (file.sourceId) {
      await tx
        .update(ingestionSources)
        .set({
          fileId: null,
          extractionStatus: "FAILED",
          updatedAt: new Date().toISOString(),
        })
        .where(eq(ingestionSources.id, file.sourceId));
    }

    // update the status log to DELETED
    await tx
      .update(ingestionStatusLogs)
      .set({
        status: "DELETED",
        updatedAt: new Date().toISOString(),
      })
      .where(eq(ingestionStatusLogs.fileId, fileId));

    await tx.delete(ingestionFiles).where(eq(ingestionFiles.id, fileId));
  });

  res
    .status(200)
    .json(
      new ApiResponse(
        200,
        null,
        "File and associated data deleted successfully"
      )
    );
});
