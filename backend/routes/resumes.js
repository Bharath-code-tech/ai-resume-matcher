
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Resume = require("../models/Resume");
const verifyFirebaseToken = require("../middleware/verifyFirebaseToken");

// Delete a resume belonging to the signed-in user

router.get("/:id/pdf", verifyFirebaseToken, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid resume ID.",
      });
    }

    const resume = await Resume.findOne({
      _id: req.params.id,
      firebaseUid: req.user.uid,
    }).select("fileName contentType pdfData");

    if (!resume || !resume.pdfData) {
      return res.status(404).json({
        success: false,
        message: "PDF resume not found.",
      });
    }

    const safeFileName = (resume.fileName || "resume.pdf")
      .replace(/[\r\n"]/g, "_");

    res.setHeader(
      "Content-Type",
      resume.contentType || "application/pdf"
    );

    res.setHeader(
      "Content-Disposition",
      `inline; filename="${safeFileName}"`
    );

    return res.send(resume.pdfData);
  } catch (error) {
    console.error("Open resume PDF error:", error);

    return res.status(500).json({
      success: false,
      message: "Could not open the PDF resume.",
    });
  }
});

router.get("/", verifyFirebaseToken, async (req, res) => {
  try {
    const resumes = await Resume.find({
      firebaseUid: req.user.uid,
    })
      .select("-pdfData")
      .sort({ createdAt: -1 })
      .lean();

    return res.json({
      success: true,
      resumes,
    });
  } catch (error) {
  console.error("Load resumes error:", error.stack || error);

  return res.status(500).json({
    success: false,
    message: error.message || String(error) || "Could not load saved resumes.",
  });
}
});

router.delete("/:id", verifyFirebaseToken, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid resume ID.",
      });
    }

    const deletedResume = await Resume.findOneAndDelete({
      _id: req.params.id,
      firebaseUid: req.user.uid,
    });

    if (!deletedResume) {
      return res.status(404).json({
        success: false,
        message: "Resume not found or you do not have permission to delete it.",
      });
    }

    return res.json({
      success: true,
      message: "Resume deleted successfully.",
    });
  } catch (error) {
    console.error("Resume deletion error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not delete resume.",
    });
  }
});

const multer = require("multer");
const { PDFParse } = require("pdf-parse");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
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

router.post(
  "/upload",
  verifyFirebaseToken,
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

      parser = new PDFParse({ data: req.file.buffer });
      const result = await parser.getText();
      const resumeText = (result.text || "").trim();

      if (!resumeText) {
        return res.status(400).json({
          success: false,
          message: "No readable text found in this PDF.",
        });
      }

      const savedResume = await Resume.create({
        firebaseUid: req.user.uid,
        fileName: req.file.originalname,
        contentType: req.file.mimetype,
        pdfData: req.file.buffer,
        resumeText,
      });

      return res.status(201).json({
        success: true,
        message: "Resume saved successfully!",
        resumeId: savedResume._id,
        fileName: savedResume.fileName,
        resumeText: savedResume.resumeText,
      });
    } catch (error) {
  console.error("Resume upload error:", error.stack || error);

  return res.status(500).json({
    success: false,
    message: error.message || "Could not save the resume.",
  });
}finally {
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
// Analyze a saved resume
router.get("/:id/analyze", verifyFirebaseToken, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid resume ID.",
      });
    }

    const resume = await Resume.findOne({
      _id: req.params.id,
      firebaseUid: req.user.uid,
    }).select("fileName resumeText");

    if (!resume) {
      return res.status(404).json({
        success: false,
        message: "Resume not found.",
      });
    }

    const text = resume.resumeText || "";

    if (!text.trim()) {
      return res.status(400).json({
        success: false,
        message: "No readable text found in this resume.",
      });
    }

    const skillsList = [
      "JavaScript", "React", "Node.js", "Express", "MongoDB",
      "Python", "Java", "C++", "C", "SQL", "HTML", "CSS",
      "TypeScript", "Git", "AWS", "Docker", "Machine Learning",
      "Data Analysis", "Excel", "Communication", "Leadership"
    ];

    const foundSkills = skillsList.filter((skill) =>
      new RegExp(
        `(^|[^a-z0-9+#.])${skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9+#.]|$)`,
        "i"
      ).test(text)
    );

    const checks = {
      email: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(text),
      phone: /(\+?\d[\d\s()-]{7,}\d)/.test(text),
      education: /\b(education|bachelor|master|degree|university|college|B\.?Tech|M\.?Tech|B\.?E\.?)\b/i.test(text),
      experience: /\b(experience|employment|work history|internship|professional experience)\b/i.test(text),
      projects: /\b(projects?|portfolio)\b/i.test(text),
      skills: foundSkills.length > 0,
    };

    const completedChecks = Object.values(checks).filter(Boolean).length;
    const score = Math.round((completedChecks / Object.keys(checks).length) * 100);

    return res.json({
      success: true,
      analysis: {
        fileName: resume.fileName,
        score,
        skills: foundSkills,
        checks,
        suggestions: [
          ...(!checks.email ? ["Add a clear email address."] : []),
          ...(!checks.phone ? ["Add a contact phone number."] : []),
          ...(!checks.education ? ["Add an Education section."] : []),
          ...(!checks.experience ? ["Add an Experience section, including internships if applicable."] : []),
          ...(!checks.projects ? ["Add a Projects section if relevant to your background."] : []),
          ...(foundSkills.length === 0 ? ["Include relevant technical or professional skills."] : []),
        ],
      },
    });
  } catch (error) {
    console.error("Resume analysis error:", error);

    return res.status(500).json({
      success: false,
      message: "Could not analyze the resume.",
    });
  }
});


router.get("/:id/jobs", verifyFirebaseToken, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid resume ID.",
      });
    }

    const resume = await Resume.findOne({
      _id: id,
      firebaseUid: req.user.uid,
    }).select("resumeText fileName");

    if (!resume) {
      return res.status(404).json({
        success: false,
        message: "Resume not found.",
      });
    }

    const text = resume.resumeText || "";

    const skillsList = [
      "JavaScript", "React", "Node.js", "Express",
      "MongoDB", "Python", "Java", "SQL", "HTML",
      "CSS", "Git", "TypeScript", "AWS", "Docker",
      "Machine Learning", "Data Analysis",
      "Communication", "Problem Solving"
    ];

    const resumeSkills = skillsList.filter((skill) =>
      new RegExp(
        `(^|[^a-z0-9+#.])${skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9+#.]|$)`,
        "i"
      ).test(text)
    );

    if (resumeSkills.length === 0) {
      return res.json({
        success: true,
        resumeSkills: [],
        jobs: [],
        message: "No recognized skills found in your resume."
      });
    }

    // Search using skills found in the resume.
    const searchSkills = resumeSkills.slice(0, 5);
    const allListings = [];
    const seenJobs = new Set();

    for (const skill of searchSkills) {
      const url = new URL(
        "https://himalayas.app/jobs/api/search"
      );
      url.searchParams.set("q", skill);
      url.searchParams.set("country", "IN");
      url.searchParams.set("page", "1");
      const response = await fetch(url);

      if (!response.ok) {
        console.error(
          "Himalayas API status:",
          response.status
        );
        continue;
      }

      const data = await response.json();
      const listings = Array.isArray(data.jobs)
        ? data.jobs
        : [];

      for (const job of listings) {
        const key = job.guid || job.applicationLink;

        if (key && !seenJobs.has(key)) {
          seenJobs.add(key);
          allListings.push(job);
        }
      }
    }

    const jobs = allListings
      .map((job) => {
        const searchableText = [
          job.title,
          job.companyName,
          job.excerpt,
          job.description,
          job.employmentType,
          ...(job.categories || []),
          ...(job.parentCategories || [])
        ]
          .filter(Boolean)
          .join(" ")
          .replace(/<[^>]*>/g, " ")
          .toLowerCase();

        const matchedSkills = resumeSkills.filter((skill) =>
          searchableText.includes(skill.toLowerCase())
        );

        const score = Math.round(
          (matchedSkills.length / resumeSkills.length) * 100
        );

        return {
          title: job.title || "Job title unavailable",
          company: job.companyName || "Company not listed",
          location:
            job.locationRestrictions?.length
              ? job.locationRestrictions.join(", ")
              : "Worldwide / check listing",
          url: job.applicationLink || "",
          matchedSkills,
          score
        };
      })
      .filter((job) => job.score > 0 && job.url)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);

    return res.json({
      success: true,
      resumeSkills,
      jobs
    });
  } catch (error) {
    console.error("Automatic job search error:", error);

    return res.status(500).json({
      success: false,
      message: "Could not load recommended jobs. Please try again."
    });
  }
});

module.exports = router;
