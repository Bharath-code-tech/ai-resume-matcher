
const mongoose = require("mongoose");

const resumeSchema = new mongoose.Schema(
  {
    firebaseUid: {
      type: String,
      required: true,
      index: true,
    },
    fileName: {
      type: String,
      required: true,
    },
    contentType: {
      type: String,
      default: "application/pdf",
    },
    pdfData: {
      type: Buffer,
      required: true,
    },
    resumeText: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Resume", resumeSchema);
