const express = require("express");
const cors = require("cors");
const path = require("path");
const dotenv = require("dotenv");

const connectDB = require("./config/db");
const authRoutes = require("./routes/auth");
const itemRoutes = require("./routes/items");

dotenv.config();

const app = express();

// Connect to MongoDB
connectDB().catch((err) => {
  console.error("Database connection failed:", err);
});

// Middlewares
app.use(cors(
{
   origin: "https://fludge-frontent.vercel.app",
    credentials: true,
}
));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded images
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/items", itemRoutes);

// Health Check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

// Root Route
app.get("/", (req, res) => {
  res.json({
    message: "Fludge Backend is Running 🚀",
  });
});

// Multer & General Error Handler
app.use((err, req, res, next) => {
  if (err.code === "LIMIT_FILE_SIZE") {
    return res
      .status(400)
      .json({ message: "File too large. Maximum size is 5MB." });
  }

  if (err.message && err.message.includes("Only")) {
    return res.status(400).json({ message: err.message });
  }

  console.error(err.stack);

  res.status(500).json({
    message: "Internal Server Error",
  });
});

// Export Express App for Vercel
module.exports = app;