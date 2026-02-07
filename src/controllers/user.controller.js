import { db } from "../index.js";
import { users } from "../../drizzle/schema.ts";
import { eq, sql } from "drizzle-orm";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { getSafeUser } from "./user.auth.controller.js";

const lowercaseTrim = (s) => s?.trim().toLowerCase() || "";

// Update account details
const updateAccountDetails = asyncHandler(async (req, res) => {
  const {
    name,
    email,
    facebookLink,
    instagramLink,
    linkedinLink,
    twitterLink,
    youtubeLink,
  } = req.body;

  // Check if at least one field is provided
  if (
    !name &&
    !email &&
    !facebookLink &&
    !instagramLink &&
    !linkedinLink &&
    !twitterLink &&
    !youtubeLink
  ) {
    throw new ApiError(
      400,
      "At least one field is required to update the account details"
    );
  }

  // Validate email if provided
  if (email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new ApiError(400, "Invalid email format");
    }

    // Check if any user already has this email
    const [userWithEmail] = await db
      .select()
      .from(users)
      .where(sql`LOWER(${users.email}) = ${lowercaseTrim(email)}`)
      .limit(1);

    // If a user exists with this email and it's not the current user, throw error
    if (userWithEmail && userWithEmail.id !== req.user.id) {
      throw new ApiError(409, "Email is already in use by another user");
    }
  }

  // Simple URL validation helper
  const isValidUrl = (url) => {
    if (!url) return true; // Allow empty/null values
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  // Validate social media links if provided
  if (facebookLink && !isValidUrl(facebookLink)) {
    throw new ApiError(400, "Invalid Facebook link URL");
  }
  if (instagramLink && !isValidUrl(instagramLink)) {
    throw new ApiError(400, "Invalid Instagram link URL");
  }
  if (linkedinLink && !isValidUrl(linkedinLink)) {
    throw new ApiError(400, "Invalid LinkedIn link URL");
  }
  if (twitterLink && !isValidUrl(twitterLink)) {
    throw new ApiError(400, "Invalid Twitter link URL");
  }
  if (youtubeLink && !isValidUrl(youtubeLink)) {
    throw new ApiError(400, "Invalid YouTube link URL");
  }

  // Prepare update object
  const updateData = {
    updatedAt: sql`NOW()`,
  };

  if (name !== undefined) updateData.name = name?.trim() || null;
  if (email !== undefined) updateData.email = lowercaseTrim(email);
  if (facebookLink !== undefined)
    updateData.facebookLink = facebookLink?.trim() || null;
  if (instagramLink !== undefined)
    updateData.instagramLink = instagramLink?.trim() || null;
  if (linkedinLink !== undefined)
    updateData.linkedinLink = linkedinLink?.trim() || null;
  if (twitterLink !== undefined)
    updateData.twitterLink = twitterLink?.trim() || null;
  if (youtubeLink !== undefined)
    updateData.youtubeLink = youtubeLink?.trim() || null;

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

  // Delete old avatar from Cloudinary if exists
  if (req.user.avatar) {
    try {
      const deleteResult = await deleteFromCloudinary(req.user.avatar);
      if (deleteResult?.result !== "ok") {
        console.warn("Failed to delete old avatar:", deleteResult);
      }
    } catch (error) {
      console.error("Error deleting old avatar:", error);
      // Continue with upload even if delete fails
    }
  }

  // Upload new avatar to ImageKit with compression=true
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
    throw new ApiError(500, "Failed to update avatar in db");
  }

  // Remove sensitive data
  const { password: _, refreshToken: __, ...safeUser } = updatedUser;

  return res
    .status(200)
    .json(new ApiResponse(200, safeUser, "Avatar updated successfully"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
  const safeUser = getSafeUser(req.user); // ← from auth middleware

  return res
    .status(200)
    .json(new ApiResponse(200, safeUser, "Current user fetched successfully"));
});

export { updateAccountDetails, updateUserAvatar, getCurrentUser };
