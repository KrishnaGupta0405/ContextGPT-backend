import dotenv from "dotenv"
import connectDB from "./db/index.js";
import { app } from './app.js';

dotenv.config({ path: './.env' });


let db;

await connectDB()
  .then((dbObject) => { 
    db = dbObject
    app.listen(process.env.EXPRESS_PORT || 8000, () => {
      console.log(`⚙️  Server is running at http://localhost:${process.env.EXPRESS_PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ Failed to start server due to DB error:", err);
  });

// export const getDB = () => {
//   if (!dbInstance) dbInstance = drizzle(pool);
//   return dbInstance;
// };

export { db }










/*
import express from "express"
const app = express()
( async () => {
    try {
        await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)
        app.on("errror", (error) => {
            console.log("ERRR: ", error);
            throw error
        })

        app.listen(process.env.PORT, () => {
            console.log(`App is listening on port ${process.env.PORT}`);
        })

    } catch (error) {
        console.error("ERROR: ", error)
        throw err
    }
})()

*/