import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken";
import { db } from "../index.js";
import { sql } from "drizzle-orm";

// Generate access token
async function generateAccessToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      username: user.username,
      fullName: user.fullName,
    },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: process.env.ACCESS_TOKEN_EXPIRY }
  );
}

// Generate refresh token
async function generateRefreshToken(user) {
  return jwt.sign({ id: user.id }, process.env.REFRESH_TOKEN_SECRET, {
    expiresIn: process.env.REFRESH_TOKEN_EXPIRY,
  });
}

const verifyJWT = asyncHandler(async (req, _, next) => {
  try {
    // Cookies for the website login, Authorization for the API requests
    const token =
      req.cookies?.accessToken ||
      req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      throw new ApiError(401, "Unauthorized request");
    }

    const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

    const userResult = await db.execute(
      sql`select * from users where id=${decodedToken?.id}`
    );

    if (!userResult?.rows?.length) {
      throw new ApiError(401, "Invalid Access Token: User not found");
    }

    const {
      password: removedPassword,
      refresh_token: _,
      ...safeUser
    } = userResult.rows[0];

    req.user = safeUser;
    // console.log("user-> ", safeUser);
    next();
  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid access token");
  }
});

export { verifyJWT, generateAccessToken, generateRefreshToken };
