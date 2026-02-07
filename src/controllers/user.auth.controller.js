import { db } from "../index.js";
import {
  users,
  accounts,
  accountMembers,
  usersSessions,
} from "../../drizzle/schema.ts";
import ms from "ms";

import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { uploadOnImageKit, deleteFromImageKit } from "../utils/imagekit.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import { eq, sql } from "drizzle-orm";
import {
  generateAccessToken,
  generateRefreshToken,
} from "../middlewares/auth.middleware.js";
import bcrypt from "bcrypt";
import {
  ACCESS_COOKIE_OPTIONS,
  Logout_ACCESS_COOKIE_OPTIONS,
  Logout_REFRESH_COOKIE_OPTIONS,
  Logout_SESSION_COOKIE_OPTIONS,
  REFRESH_COOKIE_OPTIONS,
  SESSION_COOKIE_OPTIONS,
} from "../utils/cookieconfig.js";

//===============================================================================================
// Utility functions
const lowercaseTrim = (s) => s?.trim().toLowerCase() || "";

async function hashPassword(password) {
  return await bcrypt.hash(password, 10);
}

async function isPasswordCorrect(input, storedPassword) {
  // console.log("inside isPasswordCorrect");
  // console.log("input password:", input);
  // console.log("stored password:", storedPassword);

  if (!input || !storedPassword) {
    throw new Error("Both input and storedPassword must be provided");
  }
  return await bcrypt.compare(input, storedPassword);
}

async function generateAccessAndRefreshTokens(user) {
  const accessToken = await generateAccessToken(user);
  const refreshToken = await generateRefreshToken(user);

  return { accessToken, refreshToken };
}

// utils/userHelpers.js    ← or authHelpers.js, or wherever you keep utils
export function getSafeUser(user) {
  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatar: user.avatar ?? null, // or '' if you prefer empty string
  };
}

//===============================================================================================

/**
 * Shared helper function to create a new user
 * @param {Object} params - User creation parameters
 * @param {string} params.email - User email
 * @param {string} params.name - User name
 * @param {string} params.password - User password
 * @param {Object} params.avatarFile - Avatar file object from req.files
 * @returns {Promise<Object>} Created user object
 */
export async function createNewUser({
  email,
  name,
  password,
  avatarFile,
  accountName,
}) {
  // Validate required fields
  if (!name?.trim() || !email?.trim() || !password?.trim()) {
    throw new ApiError(400, "name, email, and password are required");
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new ApiError(400, "Invalid email format");
  }

  // Validate password strength (minimum 6 characters)
  if (password.length < 6) {
    throw new ApiError(400, "Password must be at least 6 characters long");
  }

  // Check if user already exists
  const [existingUser] = await db
    .select()
    .from(users)
    .where(
      sql`LOWER(${users.name}) = ${lowercaseTrim(name)} OR LOWER(${users.email}) = ${lowercaseTrim(email)}`
    )
    .limit(1);

  if (existingUser) {
    throw new ApiError(409, "User with email or name already exists");
  }

  // Handle avatar upload
  if (!avatarFile?.path) {
    throw new ApiError(400, "Avatar file is required");
  }

  // Upload avatar to ImageKit with compression (before transaction)
  const avatar = await uploadOnImageKit(avatarFile.path, true);

  if (!avatar?.url) {
    throw new ApiError(500, "Error while uploading avatar to server");
  }

  // Wrap all database operations in a transaction
  return await db.transaction(async (tx) => {
    // Create user in database
    const [createdUser] = await tx
      .insert(users)
      .values({
        name: lowercaseTrim(name),
        email: lowercaseTrim(email),
        password: await hashPassword(password),
        avatar: avatar.url,
      })
      .returning();

    if (!createdUser) {
      throw new ApiError(500, "Error while creating user");
    }

    // Create account for the user (each user owns their company/account)
    const [createdAccount] = await tx
      .insert(accounts)
      .values({
        name: accountName || `${createdUser.name}'s Account`,
        ownerId: createdUser.id,
      })
      .returning();

    if (!createdAccount) {
      throw new ApiError(500, "Error while creating account for user");
    }

    // Add user as OWNER in account_members
    // Owner is the super-admin
    const [accountMember] = await tx
      .insert(accountMembers)
      .values({
        accountId: createdAccount.id,
        userId: createdUser.id,
        role: "SUPER_ADMIN",
      })
      .returning();

    if (!accountMember) {
      throw new ApiError(500, "Error while adding user as account owner");
    }

    return { createdUser, createdAccount, accountMember };
  });
}

// Register new user
const registerUser = asyncHandler(async (req, res) => {
  const { email, name, password, accountName } = req.body;
  const avatarFile = req.files?.avatar?.[0];

  // Use the shared helper function
  const { createdUser, createdAccount, accountMember } = await createNewUser({
    email,
    name,
    password,
    avatarFile,
    accountName,
  });

  const safeUser = getSafeUser(createdUser);

  return res.status(201).json(
    new ApiResponse(
      201,
      {
        user: safeUser,
        account: {
          id: createdAccount.id,
          name: createdAccount.name,
          role: accountMember.role,
        },
      },
      "User registered successfully with account created"
    )
  );
});

// Login user, add details to users_sessions table
// return the user and account details
const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const userAgent = req.headers["user-agent"] || "Unknown";
  const ipAddress = req.ip || req.connection.remoteAddress;

  // Require either username or email
  if (!email) {
    throw new ApiError(400, "Email is required");
  }

  if (!password || password.trim().length < 6) {
    throw new ApiError(
      400,
      "Password is required and must be at least 6 characters long"
    );
  }

  // Find user by email
  const [existingUser] = await db
    .select()
    .from(users)
    .where(sql`LOWER(${users.email}) = ${lowercaseTrim(email)}`)
    .limit(1);

  if (!existingUser) {
    throw new ApiError(404, "User does not exist");
  }

  const [existingAccounts] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.ownerId, existingUser.id))
    .limit(1);

  if (!existingAccounts) {
    throw new ApiError(404, "User does not have an account");
  }

  // Verify password
  const isPasswordValid = await isPasswordCorrect(
    password,
    existingUser.password
  );

  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid user credentials");
  }

  // Generate tokens
  const { accessToken, refreshToken } =
    await generateAccessAndRefreshTokens(existingUser);

  // Set expiry for refresh token (e.g., 7 days from now)
  const expiresAt = new Date(
    Date.now() + ms(process.env.REFRESH_TOKEN_EXPIRY || "7d")
  );

  // Wrap session creation and cleanup in a transaction
  const newSession = await db.transaction(async (tx) => {
    // Create a new session in users_sessions table
    const [session] = await tx
      .insert(usersSessions)
      .values({
        userId: existingUser.id,
        refreshToken: refreshToken,
        deviceInfo: userAgent,
        ipAddress: ipAddress,
        expiresAt: expiresAt,
        isRevoked: false,
        createdAt: sql`NOW()`,
        updatedAt: sql`NOW()`,
      })
      .returning();

    if (!session) {
      throw new ApiError(500, "Error creating user session");
    }

    // Clean up old expired/revoked sessions for this user
    await tx.delete(usersSessions).where(
      sql`${usersSessions.userId} = ${existingUser.id} 
            AND (${usersSessions.expiresAt} < NOW() 
            OR ${usersSessions.isRevoked} = true)`
    );

    return session;
  });

  // Remove sensitive data from user object
  const safeUser = getSafeUser(existingUser);

  return res
    .status(200)
    .cookie("accessToken", accessToken, ACCESS_COOKIE_OPTIONS)
    .cookie("refreshToken", refreshToken, REFRESH_COOKIE_OPTIONS)
    .cookie("sessionId", newSession.id, SESSION_COOKIE_OPTIONS) // Add session ID cookie
    .json(
      new ApiResponse(
        200,
        {
          user: safeUser,
          account: {
            id: existingAccounts.id,
            name: existingAccounts.name,
            role: "SUPER_ADMIN", // user is always super_admin of his own account at time of logging into his account
          },
          accessToken,
          refreshToken,
          sessionId: newSession.id,
        },
        "User logged in successfully"
      )
    );
});

// Logout user
const logoutUser = asyncHandler(async (req, res) => {
  const userId = req.user?.id;

  if (!userId) {
    throw new ApiError(401, "Unauthorized request");
  }

  // Clear refresh token from database
  await db
    .update(usersSessions)
    .set({
      refreshToken: null,
      isRevoked: true,
      updatedAt: sql`NOW()`,
    })
    .where(eq(usersSessions.userId, userId));

  return res
    .status(200)
    .clearCookie("accessToken", Logout_ACCESS_COOKIE_OPTIONS)
    .clearCookie("refreshToken", Logout_REFRESH_COOKIE_OPTIONS)
    .clearCookie("sessionId", Logout_SESSION_COOKIE_OPTIONS)
    .json(new ApiResponse(200, {}, "User logged out successfully"));
});

//* Not secured route
const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies?.refreshToken || req.body?.refreshToken;

  if (!incomingRefreshToken) {
    throw new ApiError(401, "Refresh token is required");
  }

  try {
    // Verify refresh token
    const decoded = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    if (!decoded?.id) {
      throw new ApiError(401, "Invalid refresh token payload");
    }

    // Verify ownership of refresh token
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, decoded.id))
      .limit(1);

    if (!user) {
      throw new ApiError(401, "User not found for this refresh token !!");
    }

    // Find session for existing refresh token
    const [usersSessions] = await db
      .select()
      .from(usersSessions)
      .where(eq(usersSessions.userId, decoded.id))
      .limit(1);

    if (
      !usersSessions ||
      usersSessions.isRevoked ||
      usersSessions.expiresAt < new Date()
    ) {
      throw new ApiError(
        401,
        "Session not found, Invalid or expired refresh token, Please login again !!"
      );
    }

    // Verify token matches stored token
    if (incomingRefreshToken !== usersSessions.refreshToken) {
      throw new ApiError(
        401,
        "Refresh token is expired or has been used, please login again"
      );
    }

    // Generate new tokens
    const { accessToken: newAccessToken, refreshToken: newRefreshToken } =
      await generateAccessAndRefreshTokens(user);

    // Update refresh token in database within a transaction
    const [updatedUser] = await db.transaction(async (tx) => {
      return await tx
        .update(usersSessions)
        .set({
          refreshToken: newRefreshToken,
          isRevoked: false,
          updatedAt: sql`NOW()`,
        })
        .where(eq(usersSessions.userId, user.id))
        .returning();
    });

    if (!updatedUser) {
      throw new ApiError(500, "Failed to update refresh token");
    }

    // Remove sensitive data from user object
    const safeUser = getSafeUser(user);

    //Updated refresh token stored in users_sessions table

    return res
      .status(200)
      .cookie("accessToken", newAccessToken, ACCESS_COOKIE_OPTIONS)
      .cookie("refreshToken", newRefreshToken, REFRESH_COOKIE_OPTIONS)
      .json(
        new ApiResponse(
          200,
          {
            user: safeUser,
            accessToken: newAccessToken,
            refreshToken: newRefreshToken,
          },
          "Access token refreshed successfully"
        )
      );
  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid refresh token");
  }
});

// Change current password
const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  if (!oldPassword || !newPassword) {
    throw new ApiError(400, "Old password and new password are required");
  }

  if (newPassword.length < 6) {
    throw new ApiError(400, "New password must be at least 6 characters long");
  }

  // Get current user with password
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, req.user.id))
    .limit(1);

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  // Verify old password
  const isOldPasswordCorrect = await isPasswordCorrect(
    oldPassword,
    user.password
  );

  if (!isOldPasswordCorrect) {
    throw new ApiError(401, "Invalid old password");
  }

  // Check if new password is the same as the old password (compare against hash)
  const isSameAsOldPassword = await isPasswordCorrect(
    newPassword,
    user.password
  );

  if (isSameAsOldPassword) {
    throw new ApiError(400, "New password must be different from old password");
  }

  // Hash and update new password within a transaction
  const hashedPassword = await hashPassword(newPassword);

  const [updatedUser] = await db.transaction(async (tx) => {
    return await tx
      .update(users)
      .set({
        password: hashedPassword,
        updatedAt: sql`NOW()`,
      })
      .where(eq(users.id, user.id))
      .returning();
  });

  if (!updatedUser) {
    throw new ApiError(500, "Failed to update password");
  }

  const safeUser = getSafeUser(updatedUser);

  return res
    .status(200)
    .json(new ApiResponse(200, { safeUser }, "Password changed successfully"));
});

// Get All Active Sessions (list devices)
const getAllSessions = asyncHandler(async (req, res) => {
  const userId = req.user.id; // ← from auth middleware

  const sessions = await db
    .select({
      id: usersSessions.id,
      deviceInfo: usersSessions.deviceInfo,
      ipAddress: usersSessions.ipAddress,
      createdAt: usersSessions.createdAt,
      expiresAt: usersSessions.expiresAt,
      isRevoked: usersSessions.isRevoked,
      updatedAt: usersSessions.updatedAt,
      // optional: last used / updatedAt if you track it
    })
    .from(usersSessions)
    .where(
      and(
        eq(usersSessions.userId, userId),
        eq(usersSessions.isRevoked, false),
        gt(usersSessions.expiresAt, sql`NOW()`)
      )
    )
    .orderBy(desc(usersSessions.createdAt));

  // Optional: enrich with "isCurrent" flag
  const enriched = sessions.map((session) => ({
    ...session,
    isCurrent: session.id === req.cookies?.sessionId || false, // if you store sessionId in cookie
  }));

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        sessions.length
          ? "Active sessions retrieved"
          : "No active sessions found",
        { sessions: enriched }
      )
    );
});

// Revoke a single session (log out specific device)
// for logging out multiple devices, call this endpoint multiple times
const revokeSession = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const sessionId = req.body.sessionId;

  if (!sessionId) {
    throw new ApiError(400, "Session ID is required");
  }

  // Verify ownership
  const [session] = await db
    .select()
    .from(usersSessions)
    .where(
      and(eq(usersSessions.id, sessionId), eq(usersSessions.userId, userId))
    )
    .limit(1);

  if (!session) {
    throw new ApiError(404, "Session not found or does not belong to you");
  }

  if (session.isRevoked) {
    return res
      .status(200)
      .json(new ApiResponse(200, {}, "Session already revoked"));
  }

  // Mark as revoked
  await db
    .update(usersSessions)
    .set({
      isRevoked: true,
      updatedAt: sql`NOW()`,
    })
    .where(eq(usersSessions.id, sessionId));

  // ! If revoking current session, the show the logout button on client side
});

export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getAllSessions,
  revokeSession,
};
