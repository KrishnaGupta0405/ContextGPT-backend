import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import {
  users,
  isPasswordCorrect,
  hashPassword,
} from "../schema/users.schema.js";
import { uploadOnImageKit, deleteFromImageKit } from "../utils/imagekit.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import { eq, sql } from "drizzle-orm";
import {
  generateAccessToken,
  generateRefreshToken,
} from "../middlewares/auth.middleware.js";

// Import your database instance (should be centralized)
// TODO: Import from your central db file instead of creating new instance
import { drizzle } from "drizzle-orm/node-postgres";
import pkg from "pg";
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool, { schema: { users } });

// Utility function
const lowercaseTrim = (s) => s?.trim().toLowerCase() || "";

// Generate access and refresh tokens
const generateAccessAndRefreshTokens = async (user) => {
  try {
    const accessToken = await generateAccessToken(user);
    const refreshToken = await generateRefreshToken(user);
    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(500, "Something went wrong while generating tokens");
  }
};

// Register new user
const registerUser = asyncHandler(async (req, res) => {
  const { fullName, email, username, password } = req.body;

  // Validate required fields
  if ([fullName, email, username, password].some((field) => !field?.trim())) {
    throw new ApiError(400, "All fields are required");
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
  const existingUser = await db
    .select()
    .from(users)
    .where(
      sql`LOWER(${users.username}) = ${lowercaseTrim(username)} OR LOWER(${users.email}) = ${lowercaseTrim(email)}`
    )
    .limit(1);

  if (existingUser.length > 0) {
    throw new ApiError(409, "User with email or username already exists");
  }
  // Handle avatar upload
  let avatarLocalPath;
  if (req.files?.avatar?.[0]?.path) {
    avatarLocalPath = req.files.avatar[0].path;
  }

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is required");
  }
  // Upload avatar to Cloudinary
  // Upload avatar to ImageKit with compression
  const avatar = await uploadOnImageKit(avatarLocalPath, true); // true for avatar compression

  if (!avatar?.url) {
    throw new ApiError(500, "Error while uploading avatar to server");
  }

  // Create user in database
  const [createdUser] = await db
    .insert(users)
    .values({
      username: lowercaseTrim(username),
      email: lowercaseTrim(email),
      password: await hashPassword(password),
      fullName: fullName.trim(),
      avatar: avatar.url,
      role: "user", // Default role
    })
    .returning({
      id: users.id,
      username: users.username,
      email: users.email,
      fullName: users.fullName,
      avatar: users.avatar,
      role: users.role,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    });

  if (!createdUser) {
    throw new ApiError(500, "Error while creating user");
  }

  return res
    .status(201)
    .json(new ApiResponse(201, createdUser, "User registered successfully"));
});

// Login user
const loginUser = asyncHandler(async (req, res) => {
  const { email, username, password } = req.body;

  // Require either username or email
  if (!username && !email) {
    throw new ApiError(400, "Username or email is required");
  }

  if (!password) {
    throw new ApiError(400, "Password is required");
  }

  // Find user by username or email
  const [existingUser] = await db
    .select()
    .from(users)
    .where(
      sql`LOWER(${users.username}) = ${lowercaseTrim(username || "")} OR LOWER(${users.email}) = ${lowercaseTrim(email || "")}`
    )
    .limit(1);

  if (!existingUser) {
    throw new ApiError(404, "User does not exist");
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

  // Update refresh token in database
  const [loggedInUser] = await db
    .update(users)
    .set({
      refreshToken: refreshToken,
      updatedAt: sql`NOW()`,
    })
    .where(eq(users.id, existingUser.id))
    .returning();

  if (!loggedInUser) {
    throw new ApiError(500, "Error updating user session");
  }

  // Remove sensitive data
  const { password: _, refreshToken: __, ...safeUser } = loggedInUser;

  // Cookie options
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, cookieOptions)
    .cookie("refreshToken", refreshToken, cookieOptions)
    .json(
      new ApiResponse(
        200,
        { user: safeUser, accessToken, refreshToken },
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
    .update(users)
    .set({
      refreshToken: null,
      updatedAt: sql`NOW()`,
    })
    .where(eq(users.id, userId));

  // Cookie options
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  };

  return res
    .status(200)
    .clearCookie("accessToken", cookieOptions)
    .clearCookie("refreshToken", cookieOptions)
    .json(new ApiResponse(200, {}, "User logged out successfully"));
});

// Refresh access token
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

    // Find user
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, decoded.id))
      .limit(1);

    if (!user) {
      throw new ApiError(401, "Invalid refresh token");
    }

    // Verify token matches stored token
    if (incomingRefreshToken !== user.refreshToken) {
      throw new ApiError(401, "Refresh token is expired or has been used");
    }

    // Generate new tokens
    const { accessToken: newAccessToken, refreshToken: newRefreshToken } =
      await generateAccessAndRefreshTokens(user);

    // Update refresh token in database
    const [updatedUser] = await db
      .update(users)
      .set({
        refreshToken: newRefreshToken,
        updatedAt: sql`NOW()`,
      })
      .where(eq(users.id, user.id))
      .returning();

    if (!updatedUser) {
      throw new ApiError(500, "Failed to update refresh token");
    }

    // Remove sensitive data
    const { password: _, refreshToken: __, ...safeUser } = updatedUser;

    // Cookie options
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    };

    return res
      .status(200)
      .cookie("accessToken", newAccessToken, cookieOptions)
      .cookie("refreshToken", newRefreshToken, cookieOptions)
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

  if (oldPassword === newPassword) {
    throw new ApiError(400, "New password must be different from old password");
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

  // Hash and update new password
  const hashedPassword = await hashPassword(newPassword);

  await db
    .update(users)
    .set({
      password: hashedPassword,
      updatedAt: sql`NOW()`,
    })
    .where(eq(users.id, user.id));

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password changed successfully"));
});

// Get current user
const getCurrentUser = asyncHandler(async (req, res) => {
  // req.user is already set by verifyJWT middleware
  const { password: _, refreshToken: __, ...safeUser } = req.user;

  return res
    .status(200)
    .json(new ApiResponse(200, safeUser, "Current user fetched successfully"));
});

// Update account details
const updateAccountDetails = asyncHandler(async (req, res) => {
  const { fullName, email } = req.body;

  if (!fullName && !email) {
    throw new ApiError(
      400,
      "At least one field (fullName or email) is required"
    );
  }

  // Validate email if provided
  if (email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new ApiError(400, "Invalid email format");
    }

    // Check if email is already taken by another user
    const [existingUser] = await db
      .select()
      .from(users)
      .where(
        sql`LOWER(${users.email}) = ${lowercaseTrim(email)} AND ${users.id} != ${req.user.id}`
      )
      .limit(1);

    if (existingUser) {
      throw new ApiError(409, "Email is already in use");
    }
  }

  // Prepare update object
  const updateData = {
    updatedAt: sql`NOW()`,
  };

  if (fullName) updateData.fullName = fullName.trim();
  if (email) updateData.email = lowercaseTrim(email);

  // Update user
  const [updatedUser] = await db
    .update(users)
    .set(updateData)
    .where(eq(users.id, req.user.id))
    .returning();

  if (!updatedUser) {
    throw new ApiError(500, "Failed to update account details");
  }

  // Remove sensitive data
  const { password: _, refreshToken: __, ...safeUser } = updatedUser;

  return res
    .status(200)
    .json(
      new ApiResponse(200, safeUser, "Account details updated successfully")
    );
});

// Update user avatar
const updateUserAvatar = asyncHandler(async (req, res) => {
  const avatarLocalPath = req.file?.path;

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is required");
  }

  // Get current user data
  const [currentUser] = await db
    .select({ avatar: users.avatar })
    .from(users)
    .where(eq(users.id, req.user.id))
    .limit(1);

  if (!currentUser) {
    throw new ApiError(404, "User not found");
  }

  // Delete old avatar from Cloudinary if exists
  if (currentUser.avatar) {
    try {
      const deleteResult = await deleteFromCloudinary(currentUser.avatar);
      if (deleteResult?.result !== "ok") {
        console.warn("Failed to delete old avatar:", deleteResult);
      }
    } catch (error) {
      console.error("Error deleting old avatar:", error);
      // Continue with upload even if delete fails
    }
  }

  // Upload new avatar to ImageKit with compression
  const avatar = await uploadOnImageKit(avatarLocalPath, true);

  if (!avatar?.url) {
    throw new ApiError(500, "Error while uploading avatar");
  }

  // Update user avatar in database
  const [updatedUser] = await db
    .update(users)
    .set({
      avatar: avatar.url,
      updatedAt: sql`NOW()`,
    })
    .where(eq(users.id, req.user.id))
    .returning();

  if (!updatedUser) {
    throw new ApiError(500, "Failed to update avatar");
  }

  // Remove sensitive data
  const { password: _, refreshToken: __, ...safeUser } = updatedUser;

  return res
    .status(200)
    .json(new ApiResponse(200, safeUser, "Avatar updated successfully"));
});

// Get user channel profile
const getUserChannelProfile = asyncHandler(async (req, res) => {
  const { username } = req.params;

  if (!username?.trim()) {
    throw new ApiError(400, "Username is required");
  }

  // Find user by username
  const [user] = await db
    .select({
      id: users.id,
      username: users.username,
      fullName: users.fullName,
      email: users.email,
      avatar: users.avatar,
      role: users.role,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(sql`LOWER(${users.username}) = ${lowercaseTrim(username)}`)
    .limit(1);

  if (!user) {
    throw new ApiError(404, "Channel not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Channel profile fetched successfully"));
});

export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetails,
  updateUserAvatar,
  getUserChannelProfile,
};
