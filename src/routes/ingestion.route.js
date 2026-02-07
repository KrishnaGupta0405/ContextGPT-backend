//routes/ingestion.route.js
import { Router } from "express";
import {
  uploadFile,
  uploadYoutubeTranscripts,
  handleIngestionWebhook,
  getFileStatus,
  getChatbotFiles,
  // getIngestionErrors,
  deleteFile,
} from "../controllers/ingestion.controller.js";
import {
  scrapeBulkLinks,
  scrapeSitemap,
  crawlWebsite,
  handleFirecrawlWebhook,
  getBatchJobStatus,
} from "../controllers/ingestion.firecrawl.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyPermissions } from "../utils/permissionUtils.js";
import { checkSubscriptionAndPageLimit } from "../middlewares/subscription.middleware.js";

const router = Router();

// File Upload: Max file size is 50MB
// ✅ Checks: JWT → Permissions → Subscription & Page Limit → Upload
router.post(
  "/upload",
  verifyJWT,
  upload.single("file", { limits: { fileSize: 1024 * 1024 * 50 } }), // 50MB
  verifyPermissions("INGESTION_UPLOAD"),
  checkSubscriptionAndPageLimit,
  uploadFile
);

// YouTube Transcript Upload
// ✅ Checks: JWT → Permissions → Subscription & Page Limit → Upload
router.post(
  "/youtube-transcripts",
  verifyJWT,
  verifyPermissions("INGESTION_UPLOAD"),
  checkSubscriptionAndPageLimit,
  uploadYoutubeTranscripts
);

// Webhook from Lambda (no auth needed - uses secret header)
router.post("/webhook/lambda", handleIngestionWebhook);

// Get file status with chunks and logs
router.get(
  "/file/:fileId",
  verifyJWT,
  verifyPermissions("INGESTION_VIEW"),
  getFileStatus
);

// Get all files for a chatbot (with optional status filter)
router.get(
  "/chatbot/:chatbotId/files",
  verifyJWT,
  verifyPermissions("INGESTION_VIEW"),
  getChatbotFiles
);

// Get ingestion errors for a chatbot
// router.get(
//   "/chatbot/:chatbotId/errors",
//   verifyJWT,
//   verifyPermissions("INGESTION_VIEW"),
//   getIngestionErrors
// );

// Delete file
router.delete(
  "/file/:fileId",
  verifyJWT,
  verifyPermissions("INGESTION_DELETE"),
  deleteFile
);

// ==========================================
// Firecrawl Routes
// ==========================================

// Bulk Links Scraping
// ✅ Checks: JWT → Permissions → Subscription & Page Limit
router.post(
  "/web-scrape/bulk",
  verifyJWT,
  verifyPermissions("INGESTION_UPLOAD"),
  checkSubscriptionAndPageLimit,
  scrapeBulkLinks
);

// Sitemap Scraping
// ✅ Checks: JWT → Permissions → Subscription & Page Limit
router.post(
  "/web-scrape/sitemap",
  verifyJWT,
  verifyPermissions("INGESTION_UPLOAD"),
  checkSubscriptionAndPageLimit,
  scrapeSitemap
);

// Website Crawling
// ✅ Checks: JWT → Permissions → Subscription & Page Limit
router.post(
  "/web-scrape/crawl",
  verifyJWT,
  verifyPermissions("INGESTION_UPLOAD"),
  checkSubscriptionAndPageLimit,
  crawlWebsite
);

// Firecrawl Webhook (no auth - uses signature verification)
router.post("/webhook/firecrawl", handleFirecrawlWebhook);

// Get Batch Job Status
// ✅ Checks: JWT → Permissions
router.get(
  "/batch-job/:jobId",
  verifyJWT,
  verifyPermissions("INGESTION_VIEW"),
  getBatchJobStatus
);

export default router;
