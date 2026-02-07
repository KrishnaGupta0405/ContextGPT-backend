// Any error in global is stored in application_errors table, inside the @asyncHandler.js file
// and then at the sub level like users_chatbot_errors, ingestion_errors, etc.
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { Paddle } from "@paddle/paddle-node-sdk";

export const paddle = new Paddle(process.env.PADDLE_API_KEY, {
  environment: process.env.PADDLE_ENV === "sandbox" ? "sandbox" : "production",
});

const app = express();

app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  })
);

app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("public"));
app.use(cookieParser());

//routes import
import userRouter from "./routes/user.routes.js";
import authRouter from "./routes/user.auth.routes.js";
import teamRouter from "./routes/team.routes.js";
import usageRouter from "./routes/usage.route.js";
import referralRouter from "./routes/referral.routes.js";
import chatbotRouter from "./routes/chatbot.route.js";
import ingestionRouter from "./routes/ingestion.route.js";
import widgetRouter from "./routes/widget.routes.js";
import chattingRouter from "./routes/chatting.routes.js";

import billingRouter from "./routes/billing.routes.js";
import { handlePaddleWebhook } from "./controllers/billing.controller.js";

//routes declaration
app.use("/api/v1/users", userRouter);
app.use("/api/v1/auth", authRouter);

// Has route of account_invitations
// Invitation are diffrent from referrals
// INVITATION -> Allow member to work as SUPER_ADMIN, ADMIN, MANAGER, AGENT
// REFERRAL -> Request other to also use ContextGPT

// Referral -> account creation -> INVITATION == Reward
// Account creation -> Invitation == No reward
app.use("/api/v1/teams", teamRouter);
app.use("/api/v1/billing", billingRouter);
app.use("/api/v1/usage", usageRouter);
app.use("/api/v1/referrals", referralRouter);
app.use("/api/v1/chatbots", chatbotRouter);
app.use("/api/v1/ingestion", ingestionRouter);

// Widget and Chat routes (public endpoints for embedded widgets)
app.use("/api/widget", widgetRouter);
app.use("/api/chat", chattingRouter);
app.get("/health", (req, res) => {
  res.send("Server is up !!");
});

// For webhook route only
app.post(
  "/api/webhooks/paddle",
  express.raw({ type: "application/json" }), // ← critical!
  handlePaddleWebhook
);

export { app };
