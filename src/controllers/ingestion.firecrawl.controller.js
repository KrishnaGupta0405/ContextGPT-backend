import { db } from "../index.js";
import { eq } from "drizzle-orm";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import crypto from "crypto";
import axios from "axios";
import {
  ingestionFiles,
  ingestionStatusLogs,
  ingestionErrors,
  ingestionFirecrawlBatchJobs,
} from "../../drizzle/schema.ts";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

//================================================================
// FIRECRAWL INGESTION CONTROLLER
// This controller handles web scraping via Firecrawl API
// All scraped content is stored in S3 and processed for chunking/embedding
//================================================================

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_KEY,
  },
});

// Firecrawl API configuration
const FIRECRAWL_API_URL =
  process.env.FIRECRAWL_API_URL || "https://api.firecrawl.dev/v1";
const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;

//================================================================
// HELPER FUNCTIONS
//================================================================

/**
 * Makes a request to Firecrawl API
 * @param {string} endpoint - API endpoint
 * @param {object} data - Request payload
 * @param {object} customHeaders - Custom headers to include
 * @returns {Promise<object>} - API response
 */
const makeFirecrawlRequest = async (endpoint, data, customHeaders = {}) => {
  if (!FIRECRAWL_API_KEY) {
    throw new ApiError(500, "Firecrawl API key is not configured");
  }

  try {
    const headers = {
      Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
      "Content-Type": "application/json",
      ...customHeaders,
    };

    // console.log(`[Firecrawl] POST ${endpoint}`, JSON.stringify(data, null, 2));

    const response = await axios.post(`${FIRECRAWL_API_URL}${endpoint}`, data, {
      headers,
    });

    // console.log(
    //   `[Firecrawl] Response from ${endpoint}:`,
    //   JSON.stringify(response.data, null, 2)
    // );

    // console.log("Firecrawl API Response:", response.data);
    return response.data;
  } catch (error) {
    // console.error(
    //   "Firecrawl API Error:",
    //   error.response?.data || error.message
    // );
    throw new ApiError(
      error.response?.status || 500,
      error.response?.data?.error || "Firecrawl API request failed"
    );
  }
};

/**
 * Uploads scraped content to S3
 * @param {string} content - Content to upload
 * @param {string} chatbotId - Chatbot ID
 * @param {string} fileId - File ID
 * @param {string} source - Source type (FIRECRAWL_BULK, FIRECRAWL_SITEMAP, FIRECRAWL_CRAWL)
 * @param {string} url - Original URL
 * @returns {Promise<object>} - Upload result with objectKey and storageUri
 */
const uploadToS3 = async (content, chatbotId, fileId, source, url) => {
  const fileContent = Buffer.from(content, "utf-8");
  const fileExt = "md";
  const objectKey = `uploads/chatbots/${chatbotId}/files/${source}/${fileId}/raw.${fileExt}`;

  const command = new PutObjectCommand({
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: objectKey,
    Body: fileContent,
    ContentType: "text/markdown",
    Metadata: {
      sourceUrl: url,
      scrapedAt: new Date().toISOString(),
    },
  });

  await s3Client.send(command);

  return {
    objectKey,
    storageUri: `https://${process.env.AWS_BUCKET_NAME}.s3.amazonaws.com/${objectKey}`,
  };
};

/**
 * Creates a database record for scraped file
 * @param {object} params - File parameters
 * @returns {Promise<string>} - File ID
 */
const createFileRecord = async ({
  fileId,
  chatbotId,
  userId,
  fileName,
  fileSize,
  fileSource,
  storageUri,
  objectKey,
  sourceUrl,
  batchJobId = null,
}) => {
  let ingestionFile;
  try {
    ingestionFile = await db.insert(ingestionFiles).values({
      id: fileId,
      chatbotId,
      userId,
      ingestionFirecrawlBatchJobsId: batchJobId, // Link to batch job if provided
      fileName,
      fileType: "MARKDOWN",
      fileSize,
      fileSource,
      origin: "WEB",
      storageUri,
      objectKey,
      status: "UPLOADED",
      metadata: {
        sourceUrl,
        scrapedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    // console.error("Database error creating file record:", error);
    throw new ApiError(500, "Failed to update file record");
  }
  try {
    await db.insert(ingestionStatusLogs).values({
      chatbotId,
      entityType: "FILE",
      fileId,
      status: "UPLOADED",
      metadata: {
        source: "firecrawl",
        sourceUrl,
      },
    });
  } catch (error) {
    // console.error("Database error creating status log:", error);
    throw new ApiError(500, "Failed to update status in logs");
  }

  return fileId;
};

/**
 * Logs an error to the database
 * @param {string} chatbotId - Chatbot ID
 * @param {string} fileId - File ID (optional)
 * @param {string} step - Error step
 * @param {string} errorMessage - Error message
 * @param {string} url - URL that failed
 */
const logError = async (chatbotId, fileId, step, errorMessage, url) => {
  try {
    await db.insert(ingestionErrors).values({
      chatbotId,
      fileId: fileId || null,
      chunkId: null,
      step,
      errorMessage,
      retryCount: 0,
      metadata: {
        url,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    throw new ApiError(500, "Failed to update error log");
  }
};

/**
 * Parses custom headers from string format to object
 * @param {string} headersString - Headers in format "KEY: value, KEY2: value2"
 * @returns {object} - Parsed headers object
 */
const parseCustomHeaders = (headersString) => {
  if (!headersString || typeof headersString !== "string") {
    return {};
  }

  const headers = {};
  const pairs = headersString.split(",").map((pair) => pair.trim());

  pairs.forEach((pair) => {
    const [key, ...valueParts] = pair.split(":");
    if (key && valueParts.length > 0) {
      headers[key.trim()] = valueParts.join(":").trim();
    }
  });

  return headers;
};

/**
 * Verifies Firecrawl webhook signature
 * @param {string} payload - Raw request body as string
 * @param {string} signature - X-Firecrawl-Signature header value
 * @param {string} secret - Webhook secret
 * @returns {boolean} - Whether signature is valid
 */
const verifyFirecrawlSignature = (payload, signature, secret) => {
  if (!signature || !secret) {
    return false;
  }

  // Extract the signature (format: sha256=abc123...)
  const signaturePart = signature.replace("sha256=", "");

  // Compute HMAC-SHA256
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(payload);
  const computed = hmac.digest("hex");

  // Timing-safe comparison
  return crypto.timingSafeEqual(
    Buffer.from(signaturePart),
    Buffer.from(computed)
  );
};

/**
 * Processes a single page from Firecrawl batch scrape
 * @param {object} page - Page data from Firecrawl
 * @param {string} chatbotId - Chatbot ID
 * @param {string} userId - User ID
 * @param {string} jobType - Job type (SITEMAP, BULK, CRAWL)
 * @returns {Promise<object>} - File ID and status
 */
const processFirecrawlPage = async (
  page,
  chatbotId,
  userId,
  jobType,
  batchJobId = null
) => {
  const url = page.metadata?.sourceURL || page.url || "unknown";
  let content = page.markdown || page.html || "";

  // If no markdown/html content, create a minimal content from metadata
  if (!content || content.trim().length === 0) {
    // console.warn(
    //   "No markdown content extracted, creating fallback from metadata:",
    //   url
    // );

    // Create a basic markdown file with available metadata
    const metadata = page.metadata || {};
    content = `# ${metadata.title || "Untitled Page"}\n\n`;
    content += `**URL:** ${url}\n\n`;

    if (metadata.description) {
      content += `**Description:** ${metadata.description}\n\n`;
    }

    if (metadata.ogDescription) {
      content += `**Summary:** ${metadata.ogDescription}\n\n`;
    }

    content += `---\n\n`;
    content += `*Note: Full content extraction failed. This file contains metadata only.*\n\n`;
    content += `**Metadata:**\n\`\`\`json\n${JSON.stringify(metadata, null, 2)}\n\`\`\`\n`;
  }

  // Generate file ID and upload to S3
  const fileId = crypto.randomUUID();
  const { objectKey, storageUri } = await uploadToS3(
    content,
    chatbotId,
    fileId,
    `FIRECRAWL_${jobType}`,
    url
  );

  // Create database record
  await createFileRecord({
    fileId,
    chatbotId,
    userId,
    fileName: `${jobType}_${new URL(url).hostname}_${Date.now()}.md`,
    fileSize: Buffer.byteLength(content, "utf-8"),
    fileSource: `FIRECRAWL_${jobType}`,
    storageUri,
    objectKey,
    sourceUrl: url,
    batchJobId, // Pass the batch job ID for linking
  });
};

//================================================================
// WEBHOOK HANDLERS
//================================================================

/**
 * Handles Firecrawl webhooks for batch scraping
 * Event Types:
 * - batch_scrape.started
 * - batch_scrape.page
 * - batch_scrape.completed
 * - batch_scrape.failed
 */
export const handleFirecrawlWebhook = asyncHandler(async (req, res) => {
  // Verify signature
  // console.log("Webhook hit->", req.body);
  const signature = req.headers["x-firecrawl-signature"];
  const rawBody = JSON.stringify(req.body);
  const secret = process.env.FIRECRAWL_WEBHOOK_SECRET;

  if (!verifyFirecrawlSignature(rawBody, signature, secret)) {
    throw new ApiError(401, "Invalid webhook signature");
  }

  const { type, id: jobId, data, metadata, error } = req.body;

  // console.log(`[Firecrawl Webhook] Event: ${type}, Job ID: ${jobId}`);

  // Get job record
  const [job] = await db
    .select()
    .from(ingestionFirecrawlBatchJobs)
    .where(eq(ingestionFirecrawlBatchJobs.jobId, jobId))
    .limit(1);

  if (!job) {
    // console.warn(`[Firecrawl Webhook] Job not found: ${jobId}`);
    return res.status(200).json({ received: true });
  }

  // Get chatbotId, userId, and jobType from the job record
  const { chatbotId, userId, jobType } = job;
  try {
    switch (type) {
      case "batch_scrape.started":
      case "crawl.started":
        // Update job status to PROCESSING
        await db
          .update(ingestionFirecrawlBatchJobs)
          .set({
            status: "PROCESSING",
            updatedAt: new Date().toISOString(),
          })
          .where(eq(ingestionFirecrawlBatchJobs.jobId, jobId));

        // console.log(`[Firecrawl Webhook] Job ${jobId} started`);
        break;

      case "batch_scrape.page":
      case "crawl.page":
        // Process the scraped page
        if (data && data.length > 0) {
          const page = data[0];

          try {
            await processFirecrawlPage(
              page,
              chatbotId,
              userId,
              jobType,
              job.id
            );

            // Increment counters
            await db
              .update(ingestionFirecrawlBatchJobs)
              .set({
                processedUrls: job.processedUrls + 1,
                successfulUrls: job.successfulUrls + 1,
                updatedAt: new Date().toISOString(),
              })
              .where(eq(ingestionFirecrawlBatchJobs.jobId, jobId));

            // console.log(
            //   `[Firecrawl Webhook] Processed page for job ${jobId}: ${page.metadata?.sourceURL || page.url}`
            // );
          } catch (pageError) {
            // console.error(
            //   `[Firecrawl Webhook] Error processing page:`,
            //   pageError
            // );

            // Log error
            await logError(
              chatbotId,
              null,
              `${jobType}_PAGE_PROCESS`,
              pageError.message || "Failed to process page",
              page.metadata?.sourceURL || page.url || "unknown"
            );

            // Increment failure counter
            await db
              .update(ingestionFirecrawlBatchJobs)
              .set({
                processedUrls: job.processedUrls + 1,
                failedUrls: job.failedUrls + 1,
                updatedAt: new Date().toISOString(),
              })
              .where(eq(ingestionFirecrawlBatchJobs.jobId, jobId));
          }
        }
        break;

      case "batch_scrape.completed":
      case "crawl.completed":
        // Mark job as completed
        await db
          .update(ingestionFirecrawlBatchJobs)
          .set({
            status: "COMPLETED",
            updatedAt: new Date().toISOString(),
          })
          .where(eq(ingestionFirecrawlBatchJobs.jobId, jobId));

        // console.log(
        //   `[Firecrawl Webhook] Job ${jobId} completed. Successful: ${job.successfulUrls}, Failed: ${job.failedUrls}`
        // );
        break;

      case "batch_scrape.failed":
      case "crawl.failed":
        // Mark job as failed
        await db
          .update(ingestionFirecrawlBatchJobs)
          .set({
            status: "FAILED",
            metadata: {
              ...job.metadata,
              error: error || "Batch scrape failed",
            },
            updatedAt: new Date().toISOString(),
          })
          .where(eq(ingestionFirecrawlBatchJobs.jobId, jobId));

        // Log error
        await logError(
          chatbotId,
          null,
          `${jobType}_BATCH_FAILED`,
          error || "Batch scrape job failed",
          job.metadata.sourceUrl || "unknown"
        );

        // console.error(`[Firecrawl Webhook] Job ${jobId} failed:`, error);
        break;

      default:
      // console.warn(`[Firecrawl Webhook] Unknown event type: ${type}`);
    }

    res.status(200).json({ received: true });
  } catch (webhookError) {
    // console.error(
    //   "[Firecrawl Webhook] Error processing webhook:",
    //   webhookError
    // );

    // Log error but still return 200 to prevent retries
    await logError(
      chatbotId,
      null,
      "WEBHOOK_PROCESSING",
      webhookError.message || "Webhook processing failed",
      jobId
    );

    res.status(200).json({ received: true, error: webhookError.message });
  }
});

//================================================================
// CONTROLLER FUNCTIONS
//================================================================

/**
 * 1. BULK LINKS SCRAPING
 * Scrapes multiple URLs directly
 *
 * Request Body:
 * {
 *   chatbotId: string,
 *   urls: string[],
 *   extractMainContentOnly: boolean,
 *   includeSelectors: string[],
 *   excludeSelectors: string[],
 *   customHeaders: string (e.g., "Authorization: Bearer token, User-Agent: Bot")
 * }
 */
export const scrapeBulkLinks = asyncHandler(async (req, res) => {
  const {
    chatbotId,
    urls,
    extractMainContentOnly = true,
    includeSelectors = [],
    excludeSelectors = [],
    customHeaders = "",
  } = req.body;

  const userId = req.user.id;

  // Validation
  if (!chatbotId) {
    throw new ApiError(400, "Chatbot ID is required");
  }

  if (!urls || !Array.isArray(urls) || urls.length === 0) {
    throw new ApiError(400, "URLs array is required and must not be empty");
  }

  try {
    // Now scrape each URL using batch with webhooks (v2 API)
    const batchData = {
      urls,
      formats: ["markdown"],
      webhook: {
        url: `${process.env.API_NGROK_BASE_URL}ingestion/webhook/firecrawl`,
        events: ["started", "page", "completed", "failed"],
        metadata: {
          chatbotId,
          userId,
          jobType: "BULK",
          sourceUrl: urls[0], // Use first URL as reference
        },
      },
    };

    // Add scrape options if provided (v2 format - options at top level for batch)
    if (extractMainContentOnly) {
      batchData.onlyMainContent = true;
    }

    if (includeSelectors.length > 0) {
      batchData.includeTags = includeSelectors;
    }

    if (excludeSelectors.length > 0) {
      batchData.excludeTags = excludeSelectors;
    }

    // Make batch scrape request
    const batchResponse = await makeFirecrawlRequest(
      "/batch/scrape",
      batchData
    );

    const jobId = batchResponse.id;

    if (!jobId) {
      throw new ApiError(500, "Failed to start batch scrape job");
    }

    // Create job record in database
    try {
      await db.insert(ingestionFirecrawlBatchJobs).values({
        chatbotId,
        userId,
        jobId,
        jobType: "BULK",
        status: "STARTED",
        totalUrls: urls.length,
        metadata: {
          urls,
          extractMainContentOnly,
          includeSelectors,
          excludeSelectors,
        },
      });
    } catch (error) {
      throw new ApiError(500, "Failed to update batch job record");
    }

    // console.log(`[Bulk Scrape] Batch job started: ${jobId}`);

    // Return job ID immediately (async processing via webhooks)
    res.status(202).json(
      new ApiResponse(
        202,
        {
          jobId,
          status: "STARTED",
          totalUrls: urls.length,
          message:
            "Batch scrape job started. Results will be processed via webhooks.",
        },
        `Started batch scrape for ${urls.length} URLs`
      )
    );
  } catch (error) {
    // console.error("Bulk scraping error:", error);

    try {
      await logError(
        chatbotId,
        null,
        "BULK_SCRAPE",
        error.message || "Failed to scrape URLs",
        urls[0] || "unknown"
      );
    } catch (logErr) {
      // console.error("Failed to log error:", logErr);
    }

    throw new ApiError(
      error.statusCode || 500,
      error.message || "Failed to scrape URLs"
    );
  }
});

/**
 * 2. SITEMAP SCRAPING
 * Scrapes URLs from a sitemap
 *
 * Request Body:
 * {
 *   chatbotId: string,
 *   sitemapUrl: string,
 *   maxPages: number,
 *   includeUrlPaths: string[],
 *   excludeUrlPaths: string[],
 *   extractMainContentOnly: boolean,
 *   includeSelectors: string[],
 *   excludeSelectors: string[],
 *   customHeaders: string
 * }
 */
export const scrapeSitemap = asyncHandler(async (req, res) => {
  const {
    chatbotId,
    sitemapUrl,
    maxPages = 100,
    includeUrlPaths = [],
    excludeUrlPaths = [],
    extractMainContentOnly = true,
    includeSelectors = [],
    excludeSelectors = [],
    customHeaders = "",
  } = req.body;

  const userId = req.user.id;

  // Validation
  if (!chatbotId) {
    throw new ApiError(400, "Chatbot ID is required");
  }

  if (!sitemapUrl) {
    throw new ApiError(400, "Sitemap URL is required");
  }

  const parsedHeaders = parseCustomHeaders(customHeaders);

  try {
    // Prepare Firecrawl map request (v2 API) as fallback
    const mapData = {
      url: sitemapUrl,
      limit: maxPages,
    };

    // Add path filters if provided (v2 format)
    if (includeUrlPaths.length > 0) {
      mapData.includePaths = includeUrlPaths;
    }
    if (excludeUrlPaths.length > 0) {
      mapData.excludePaths = excludeUrlPaths;
    }

    let urlsToScrape = [];

    // 1. Try to fetch sitemap content directly (Manual Parsing)
    try {
      // console.log(`[Sitemap] Fetching directly: ${sitemapUrl}`);
      const response = await axios.get(sitemapUrl, {
        timeout: 10000,
        headers: parsedHeaders,
      });
      const xmlContent = response.data;

      // Simple regex to extract URLs from <loc> tags
      const locMatches = xmlContent.match(/<loc>(.*?)<\/loc>/g);

      if (locMatches && locMatches.length > 0) {
        urlsToScrape = locMatches.map((tag) =>
          tag.replace(/<\/?loc>/g, "").trim()
        );

        // console.log(
        //   `[Sitemap] Manual extraction found ${urlsToScrape.length} URLs`
        // );

        // Apply filters manually
        if (includeUrlPaths.length > 0) {
          urlsToScrape = urlsToScrape.filter((url) =>
            includeUrlPaths.some((path) => url.includes(path))
          );
        }

        if (excludeUrlPaths.length > 0) {
          urlsToScrape = urlsToScrape.filter(
            (url) => !excludeUrlPaths.some((path) => url.includes(path))
          );
        }

        // Apply limit
        if (urlsToScrape.length > maxPages) {
          urlsToScrape = urlsToScrape.slice(0, maxPages);
        }
      }
    } catch (manualError) {
      // console.warn(
      //   "[Sitemap] Manual fetch failed, falling back to Firecrawl API:",
      //   manualError.message
      // );
    }

    // 2. Fallback to Firecrawl /map if manual fetch failed or found nothing
    if (urlsToScrape.length === 0) {
      // console.log("[Sitemap] Using Firecrawl /map endpoint");
      const mapResponse = await makeFirecrawlRequest(
        "/map",
        mapData,
        parsedHeaders
      );
      urlsToScrape = mapResponse.links || [];
    }

    if (urlsToScrape.length === 0) {
      throw new ApiError(404, "No URLs found in sitemap");
    }

    // console.log(`[Sitemap] Found ${urlsToScrape.length} URLs to scrape`);

    // Now scrape each URL using batch with webhooks (v2 API)
    const batchData = {
      urls: urlsToScrape,
      formats: ["markdown"],
      webhook: {
        url: `${process.env.API_NGROK_BASE_URL}ingestion/webhook/firecrawl`,
        events: ["started", "page", "completed", "failed"],
        metadata: {
          chatbotId,
          userId,
          jobType: "SITEMAP",
          sourceUrl: sitemapUrl,
        },
      },
    };

    // Add scrape options if provided (v2 format - options at top level for batch)
    if (extractMainContentOnly) {
      batchData.onlyMainContent = true;
    }

    if (includeSelectors.length > 0) {
      batchData.includeTags = includeSelectors;
    }

    if (excludeSelectors.length > 0) {
      batchData.excludeTags = excludeSelectors;
    }

    // Make batch scrape request
    const batchResponse = await makeFirecrawlRequest(
      "/batch/scrape",
      batchData,
      parsedHeaders
    );

    const jobId = batchResponse.id;

    if (!jobId) {
      throw new ApiError(500, "Failed to start batch scrape job");
    }

    // Create job record in database
    try {
      await db.insert(ingestionFirecrawlBatchJobs).values({
        chatbotId,
        userId,
        jobId,
        jobType: "SITEMAP",
        status: "STARTED",
        totalUrls: urlsToScrape.length,
        metadata: {
          sitemapUrl,
          maxPages,
          includeUrlPaths,
          excludeUrlPaths,
          extractMainContentOnly,
          includeSelectors,
          excludeSelectors,
        },
      });
    } catch (error) {
      throw new ApiError(500, "Failed to update batch job record");
    }
    // console.log(`[Sitemap] Batch job started: ${jobId}`);

    // Return job ID immediately (async processing via webhooks)
    res.status(202).json(
      new ApiResponse(
        202,
        {
          jobId,
          status: "STARTED",
          totalUrls: urlsToScrape.length,
          message:
            "Batch scrape job started. Results will be processed via webhooks.",
        },
        `Started batch scrape for ${urlsToScrape.length} URLs from sitemap`
      )
    );
  } catch (error) {
    // console.error("Sitemap scraping error:", error);

    try {
      await logError(
        chatbotId,
        null,
        "SITEMAP_FETCH",
        error.message || "Failed to fetch sitemap",
        sitemapUrl
      );
    } catch (error) {
      console.error("Failed to log error:", error);
    }
    throw new ApiError(
      error.statusCode || 500,
      error.message || "Failed to scrape sitemap"
    );
  }
});

/**
 * 3. WEBSITE CRAWLING
 * Crawls a website recursively
 *
 * Request Body:
 * {
 *   chatbotId: string,
 *   websiteUrl: string,
 *   recursionDepth: number (1 = root level only),
 *   maxPages: number,
 *   includeUrlPaths: string[],
 *   excludeUrlPaths: string[],
 *   allowedDomains: string[],
 *   extractMainContentOnly: boolean,
 *   includeSelectors: string[],
 *   excludeSelectors: string[],
 *   customHeaders: string
 * }
 */
export const crawlWebsite = asyncHandler(async (req, res) => {
  const {
    chatbotId,
    websiteUrl,
    recursionDepth = 1,
    maxPages = 100,
    includeUrlPaths = [],
    excludeUrlPaths = [],
    allowedDomains = [],
    extractMainContentOnly = true,
    includeSelectors = [],
    excludeSelectors = [],
    customHeaders = "",
  } = req.body;

  const userId = req.user.id;

  // Validation
  if (!chatbotId) {
    throw new ApiError(400, "Chatbot ID is required");
  }

  if (!websiteUrl) {
    throw new ApiError(400, "Website URL is required");
  }

  try {
    // Prepare Firecrawl crawl request with webhook (v2 API)
    const crawlData = {
      url: websiteUrl,
      limit: maxPages,
      maxDepth: recursionDepth,
      scrapeOptions: {
        formats: ["markdown"],
      },
      webhook: {
        url: `${process.env.API_NGROK_BASE_URL}ingestion/webhook/firecrawl`,
        events: ["started", "page", "completed", "failed"],
        metadata: {
          chatbotId,
          userId,
          jobType: "CRAWL",
          sourceUrl: websiteUrl,
        },
      },
    };

    // Add path filters (v2 format)
    if (includeUrlPaths.length > 0) {
      crawlData.includePaths = includeUrlPaths;
    }
    if (excludeUrlPaths.length > 0) {
      crawlData.excludePaths = excludeUrlPaths;
    }

    // Add scrape options if provided (v2 format)
    if (
      includeSelectors.length > 0 ||
      excludeSelectors.length > 0 ||
      extractMainContentOnly
    ) {
      if (!crawlData.scrapeOptions) {
        crawlData.scrapeOptions = {};
      }
      crawlData.scrapeOptions.formats = ["markdown"];

      if (extractMainContentOnly) {
        crawlData.scrapeOptions.onlyMainContent = true;
      }

      if (includeSelectors.length > 0) {
        crawlData.scrapeOptions.includeTags = includeSelectors;
      }

      if (excludeSelectors.length > 0) {
        crawlData.scrapeOptions.excludeTags = excludeSelectors;
      }
    }

    // Make Firecrawl API request
    const crawlResponse = await makeFirecrawlRequest("/crawl", crawlData);

    // Firecrawl crawl is async, so we get a job ID
    const jobId = crawlResponse.id || crawlResponse.jobId;

    if (!jobId) {
      throw new ApiError(500, "Failed to start crawl job");
    }

    // Create job record in database
    try {
      await db.insert(ingestionFirecrawlBatchJobs).values({
        chatbotId,
        userId,
        jobId,
        jobType: "CRAWL",
        status: "STARTED",
        totalUrls: 0, // Unknown at start for crawl
        metadata: {
          websiteUrl,
          recursionDepth,
          maxPages,
          includeUrlPaths,
          excludeUrlPaths,
          allowedDomains,
          extractMainContentOnly,
          includeSelectors,
          excludeSelectors,
        },
      });
    } catch (error) {
      throw new ApiError(500, "Failed to update batch job record");
    }

    // console.log(`[Website Crawl] Batch job started: ${jobId}`);

    // Return job ID immediately (async processing via webhooks)
    res.status(202).json(
      new ApiResponse(
        202,
        {
          jobId,
          status: "STARTED",
          message: "Crawl job started. Results will be processed via webhooks.",
        },
        `Started crawl for ${websiteUrl}`
      )
    );
  } catch (error) {
    // console.error("Website crawling error:", error);

    try {
      await logError(
        chatbotId,
        null,
        "WEBSITE_CRAWL_INIT",
        error.message || "Failed to crawl website",
        websiteUrl
      );
    } catch (logErr) {
      // console.error("Failed to log error:", logErr);
    }

    throw new ApiError(
      error.statusCode || 500,
      error.message || "Failed to crawl website"
    );
  }
});

/**
 * GET BATCH JOB STATUS
 * Query the status of a batch scrape job
 *
 * URL Params: jobId
 */
export const getBatchJobStatus = asyncHandler(async (req, res) => {
  const { jobId } = req.params;

  if (!jobId) {
    throw new ApiError(400, "Job ID is required");
  }

  // Get job record
  const [job] = await db
    .select()
    .from(ingestionFirecrawlBatchJobs)
    .where(eq(ingestionFirecrawlBatchJobs.jobId, jobId))
    .limit(1);

  if (!job) {
    throw new ApiError(404, "Job not found");
  }

  // Extract chatbotId from metadata
  const { chatbotId } = job.metadata || {};

  // Get associated files if job is completed
  const files = await db
    .select({
      id: ingestionFiles.id,
      fileName: ingestionFiles.fileName,
      fileSize: ingestionFiles.fileSize,
      status: ingestionFiles.status,
      sourceUrl: ingestionFiles.metadata,
      createdAt: ingestionFiles.createdAt,
    })
    .from(ingestionFiles)
    .where(eq(ingestionFiles.chatbotId, chatbotId))
    .where(eq(ingestionFiles.fileSource, `FIRECRAWL_${job.jobType}`))
    .orderBy(ingestionFiles.createdAt);

  res.status(200).json(
    new ApiResponse(
      200,
      {
        jobId: job.jobId,
        status: job.status,
        jobType: job.jobType,
        totalUrls: job.totalUrls,
        processedUrls: job.processedUrls,
        successfulUrls: job.successfulUrls,
        failedUrls: job.failedUrls,
        metadata: job.metadata,
        files: files.map((f) => ({
          id: f.id,
          fileName: f.fileName,
          fileSize: f.fileSize,
          status: f.status,
          sourceUrl: f.sourceUrl?.sourceUrl,
          createdAt: f.createdAt,
        })),
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
      },
      "Job status retrieved successfully"
    )
  );
});
