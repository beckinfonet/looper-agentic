import mongoose from "mongoose";
import { config } from "./config.js";

export async function connectDb(): Promise<void> {
  mongoose.set("strictQuery", true);
  const opts =
    config.mongoDbName != null && config.mongoDbName.length > 0
      ? { dbName: config.mongoDbName }
      : {};
  await mongoose.connect(config.mongoUri, opts);
  const name = mongoose.connection.db?.databaseName ?? "?";
  // Visible in Railway logs — confirm prod is on `looper`, not default `test`
  console.info(
    `[mongo] connected database="${name}" MONGODB_DB_NAME=${config.mongoDbName ?? "(unset)"}`,
  );
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
}
