
const express = require("express");
const User = require("../models/user");
const verifyFirebaseToken = require("../middleware/verifyFirebaseToken");

const router = express.Router();

// Save or update the signed-in user's profile.
router.put("/", verifyFirebaseToken, async (req, res) => {
  try {
    const allowedFields = [
      "fullName",
      "phone",
      "location",
      "education",
      "skills",
      "experience",
      "photo",
    ];

    const profile = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        profile[field] = req.body[field];
      }
    }

    const user = await User.findOneAndUpdate(
      { firebaseUid: req.user.uid },
      {
        $set: {
          ...profile,
          email: req.user.email || "",
        },
        $setOnInsert: {
          firebaseUid: req.user.uid,
        },
      },
     {
  returnDocument: "after",
  upsert: true,
  runValidators: true,
  setDefaultsOnInsert: true,
}
    );

    res.json({
      success: true,
      message: "Profile saved successfully!",
      profile: user,
    });
  } catch (error) {
    console.error("Save profile error:", error.message);
    res.status(500).json({
      success: false,
      message: "Could not save profile.",
    });
  }
});

// Retrieve the signed-in user's profile.
router.get("/", verifyFirebaseToken, async (req, res) => {
  try {
    const user = await User.findOne({
      firebaseUid: req.user.uid,
    });

    if (!user) {
      return res.json({
        success: true,
        profile: null,
      });
    }

    res.json({
      success: true,
      profile: user,
    });
 } catch (error) {
  console.error("Save profile error:", error);

  res.status(500).json({
    success: false,
    message: error.message || "Could not save profile.",
  });
}
});

module.exports = router;
