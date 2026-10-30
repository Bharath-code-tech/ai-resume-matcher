const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const multer = require("multer");
const profileRoutes = require("./routes/profile");
const resumeRoutes = require("./routes/resumes");
const { PDFParse } = require("pdf-parse");
const connectDB = require("./db");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));
app.use("/api/profile", profileRoutes);
app.use("/api/resumes", resumeRoutes);
// Store uploaded PDF files in memory.
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype === "application/pdf" ||
      file.originalname.toLowerCase().endsWith(".pdf")
    ) {
      cb(null, true);
    } else {
      cb(new Error("Please upload a PDF file."));
    }
  },
});

// Home route.
app.get("/", (req, res) => {
  res.send("AI Resume Analyzer Backend is running!");
});

// Test the backend connection.
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Frontend can connect to backend!",
  });
});

// Upload and extract text from a PDF resume.
app.post(
  "/api/resume/upload",
  upload.single("resume"),
  async (req, res) => {
    let parser;

    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "Please select a PDF resume.",
        });
      }

      // Create the PDF parser using the uploaded file buffer.
      parser = new PDFParse({
        data: req.file.buffer,
      });

      const result = await parser.getText();
      const resumeText = (result.text || "").trim();

      if (!resumeText) {
        return res.status(400).json({
          success: false,
          message:
            "No readable text found. Please upload a text-based PDF.",
        });
      }

      return res.json({
        success: true,
        message: "Resume uploaded successfully!",
        fileName: req.file.originalname,
        resumeText,
      });
    } catch (error) {
      console.error("Resume processing error:", error);

      return res.status(500).json({
        success: false,
        message:
          "Could not process this PDF. Please try another PDF.",
      });
    } finally {
      if (parser) {
        try {
          await parser.destroy();
        } catch (error) {
          console.error("PDF cleanup error:", error);
        }
      }
    }
  }
);

// Return JSON errors instead of HTML error pages.
app.use((err, req, res, next) => {
  console.error("Backend request error:", err.message);

  if (res.headersSent) {
    return next(err);
  }

  const status = err instanceof multer.MulterError ? 400 : 400;

  return res.status(status).json({
    success: false,
    message: err.message || "Something went wrong.",
  });
});

// Connect to MongoDB and start the backend.
// Connect to MongoDB and start the backend.
async function startServer() {
  const isConnected = await connectDB();

  if (!isConnected) {
    console.error("Server startup stopped: MongoDB connection failed.");
    process.exit(1);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Backend running on port ${PORT}`);
  });
}

startServer();