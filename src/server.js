require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const fleetRoutes = require("./routes/fleetRoutes");

const app = express();

app.use(express.json());
app.use("/uploads", express.static(require("path").join(process.cwd(), "uploads")));
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // allow no-origin requests (curl, server-to-server, Render health checks)
      if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
  })
);

// --- Health check (Render pings this to confirm the service is alive) ---
app.get("/health", (req, res) => res.status(200).json({ status: "ok" }));
app.get("/", (req, res) => res.status(200).json({ service: "fleet-api", status: "running" }));

// --- Routes ---
app.use("/api/fleet", fleetRoutes);

// --- 404 + error handling ---
app.use((req, res) => res.status(404).json({ error: "Not found" }));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || "Server error" });
});

// Render sets process.env.PORT itself — always bind to it, never hardcode a port.
const PORT = process.env.PORT || 4000;

async function start() {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`fleet-api listening on port ${PORT}`);
    });
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
}

start();
