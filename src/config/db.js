const mongoose = require("mongoose");

async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not set");
  }

  mongoose.set("strictQuery", true);

  await mongoose.connect(uri, {
    dbName: process.env.MONGODB_DB_NAME || undefined,
  });

  console.log("MongoDB connected:", mongoose.connection.host);

  mongoose.connection.on("error", (err) => {
    console.error("MongoDB connection error:", err);
  });
}

module.exports = connectDB;
