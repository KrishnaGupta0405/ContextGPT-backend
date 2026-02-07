import ms from "ms";

export const ACCESS_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict",
  maxAge: ms(process.env.ACCESS_TOKEN_EXPIRY || "1d"),
  path: "/",                                // send on all routes
};

export const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict",
  maxAge: ms(process.env.REFRESH_TOKEN_EXPIRY || "10d"),
  // path: "/",                                // send on all routes
};

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,                           // JS can't access
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict",                       // prevents CSRF
  maxAge: ms(process.env.SESSION_ID_EXPIRY || "30d"), 
  path: "/",                                // send on all routes
};

export const Logout_ACCESS_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict",
  path: "/",                                // send on all routes
};

export const Logout_REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict",
  path: "/",                                // send on all routes
};

export const Logout_SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict",
  path: "/",
};

