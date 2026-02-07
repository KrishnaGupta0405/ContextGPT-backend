// import bcrypt from "bcrypt";
// import jwt from "jsonwebtoken";

// // models/user.js

// import users from "../drizzle/schema.ts";

// async function hashPassword(password) {
//   return await bcrypt.hash(password, 10);
// }

// async function isPasswordCorrect(input, storedPassword) {
//   // console.log("inside isPasswordCorrect");
//   // console.log("input password:", input);
//   // console.log("stored password:", storedPassword);

//   if (!input || !storedPassword) {
//     throw new Error("Both input and storedPassword must be provided");
//   }
//   return await bcrypt.compare(input, storedPassword);
// }

// export {
//   users,
//   hashPassword,
//   isPasswordCorrect,
//   // generateAccessToken,
//   // generateRefreshToken
// };
