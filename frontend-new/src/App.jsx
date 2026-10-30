
import { useEffect, useState } from "react";
import "./App.css";
import { auth } from "./firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail,
} from "firebase/auth";

const API_URL = "http://localhost:5000";

const emptyProfile = {
  name: "",
  phone: "",
  skills: "",
  education: "",
};

function App() {
  const [user, setUser] = useState(null);
  const [page, setPage] = useState("Dashboard");
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [message, setMessage] = useState("");

  const [profile, setProfile] = useState(emptyProfile);
  const [photo, setPhoto] = useState("");
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  const [resume, setResume] = useState(null);
  const [resumeText, setResumeText] = useState("");
  const [resumeMessage, setResumeMessage] = useState("");
  const [resumeId, setResumeId] = useState("");
  const [deletingResume, setDeletingResume] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [savedResumes, setSavedResumes] = useState([]);
const [loadingResumes, setLoadingResumes] = useState(false);
const [analysis, setAnalysis] = useState(null);
const [analyzing, setAnalyzing] = useState(false);
const [jobDescription, setJobDescription] = useState("");
const [jobMatch, setJobMatch] = useState(null);
const [matchingJob, setMatchingJob] = useState(false);


  // Statistics are derived from successfully extracted resume text.
  const resumeStats = (() => {
    const text = resumeText || "";
    const lower = text.toLowerCase();
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;

    const skillsCatalog = [
      "javascript", "typescript", "python", "java", "c++", "c#",
      "react", "node.js", "express", "mongodb", "sql", "html",
      "css", "git", "aws", "azure", "docker", "kubernetes",
      "machine learning", "data analysis", "excel", "power bi",
      "communication", "leadership", "project management",
    ];

    const detectedSkills = skillsCatalog.filter((skill) =>
      new RegExp(
        `(^|[^a-z0-9+#.])${skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9+#.]|$)`,
        "i"
      ).test(text)
    );

    const sections = [
      {
        label: "Education",
        terms: ["education", "academic", "qualification"],
      },
      {
        label: "Experience",
        terms: ["experience", "employment", "work history"],
      },
      {
        label: "Projects",
        terms: ["projects", "project experience"],
      },
      {
        label: "Certifications",
        terms: ["certification", "certifications", "certificates"],
      },
    ].filter((section) =>
      section.terms.some((term) => lower.includes(term))
    );

    const emailDetected =
      /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(text);
    const phoneDetected = /(?:\+?\d[\d ()-]{7,}\d)/.test(text);

    const skillGroups = [
      {
        label: "Programming",
        skills: ["javascript", "typescript", "python", "java", "c++", "c#"],
      },
      {
        label: "Web & Tools",
        skills: [
          "react", "node.js", "express", "mongodb", "sql",
          "html", "css", "git", "docker",
        ],
      },
      {
        label: "Data & Cloud",
        skills: [
          "aws", "azure", "machine learning", "data analysis",
          "excel", "power bi", "kubernetes",
        ],
      },
      {
        label: "Professional",
        skills: ["communication", "leadership", "project management"],
      },
    ].map((group) => ({
      ...group,
      count: detectedSkills.filter((skill) =>
        group.skills.includes(skill)
      ).length,
    }));

    const sectionCoveragePercent = Math.round((sections.length / 4) * 100);
    const contactPercent = Math.round(
      (((emailDetected ? 1 : 0) + (phoneDetected ? 1 : 0)) / 2) * 100
    );

    return {
      words,
      characters: text.length,
      detectedSkills,
      sections,
      emailDetected,
      phoneDetected,
      skillGroups,
      sectionCoveragePercent,
      contactPercent,
    };
  })();

  
useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
    setUser(currentUser);

    if (!currentUser) {
      setProfile(emptyProfile);
      setPhoto("");
      setResume(null);
      setResumeId("");
      setResumeText("");
      setResumeMessage("");
      return;
    }

    setPage("Dashboard");
  await loadSavedResumes(currentUser);
    try {
      const token = await currentUser.getIdToken();

      const response = await fetch(`${API_URL}/api/profile`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

     const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Could not load profile.");
      }

      const savedProfile = result.profile || {};

      setProfile({
        ...emptyProfile,
        name:
          savedProfile.fullName ||
          savedProfile.name ||
          currentUser.displayName ||
          "",
        phone: savedProfile.phone || "",
        skills: savedProfile.skills || "",
        education: savedProfile.education || "",
      });

      setPhoto(savedProfile.photo || "");
    } catch (error) {
      console.error("Profile loading error:", error);

      setProfile({
        ...emptyProfile,
        name: currentUser.displayName || "",
      });

      setPhoto("");
    }
  });

  return unsubscribe;
}, []);


  function updateForm(event) {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  }

  function friendlyError(code) {
    const errors = {
      "auth/email-already-in-use": "This email is already registered.",
      "auth/invalid-email": "Please enter a valid email address.",
      "auth/weak-password": "Use a password with at least 6 characters.",
      "auth/invalid-credential": "Incorrect email or password.",
      "auth/user-not-found": "No account found with this email.",
      "auth/wrong-password": "Incorrect password.",
      "auth/popup-closed-by-user": "Google Sign-In was cancelled.",
      "auth/cancelled-popup-request":
        "A sign-in popup is already open. Please try again.",
      "auth/popup-blocked":
        "The browser blocked the popup. Allow popups and try again.",
      "auth/too-many-requests":
        "Too many attempts. Please wait and try again.",
      "auth/network-request-failed":
        "Network error. Check your internet connection.",
      "auth/unauthorized-domain":
        "Add this website domain in Firebase Authentication settings.",
    };

    return errors[code] || "Something went wrong. Please try again.";
  }

  async function handleAuth(event) {
    event.preventDefault();
    setMessage("");

    if (mode === "register") {
      if (!form.name.trim()) {
        setMessage("Please enter your full name.");
        return;
      }

      if (form.password.length < 6) {
        setMessage("Password must contain at least 6 characters.");
        return;
      }

      if (form.password !== confirmPassword) {
        setMessage("Passwords do not match.");
        return;
      }
    }

    try {
      setLoading(true);

      if (mode === "register") {
        const result = await createUserWithEmailAndPassword(
          auth,
          form.email.trim(),
          form.password
        );

        await updateProfile(result.user, {
          displayName: form.name.trim(),
        });

        setProfile({
          ...emptyProfile,
          name: form.name.trim(),
        });
      } else {
        await signInWithEmailAndPassword(
          auth,
          form.email.trim(),
          form.password
        );
      }
    } catch (error) {
      setMessage(friendlyError(error.code));
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    setMessage("");

    try {
      setGoogleLoading(true);
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (error) {
      setMessage(friendlyError(error.code));
    } finally {
      setGoogleLoading(false);
    }
  }

  async function handleForgotPassword() {
    if (!form.email.trim()) {
      setMessage("Enter your email address first.");
      return;
    }

    try {
      setLoading(true);
      await sendPasswordResetEmail(auth, form.email.trim());
      setMessage("Password reset email sent. Check your inbox.");
    } catch (error) {
      setMessage(friendlyError(error.code));
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    try {
      await signOut(auth);
      setPage("Dashboard");
      setProfileMenuOpen(false);
      setResume(null);
      setResumeId("");
      setResumeText("");
      setResumeMessage("");
      setMessage("");
    } catch {
      setMessage("Unable to sign out. Please try again.");
    }
  }

  function handleProfileChange(event) {
    const { name, value } = event.target;
    setProfile((previous) => ({ ...previous, [name]: value }));
  }

 
async function saveProfile(event) {
  event.preventDefault();

  if (!user) {
    setMessage("Please sign in to save your profile.");
    return;
  }

  try {
    setLoading(true);
    setMessage("");

    const token = await user.getIdToken();

    const response = await fetch(`${API_URL}/api/profile`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        fullName: profile.name.trim(),
        phone: profile.phone,
        skills: profile.skills,
        education: profile.education,
        photo,
      }),
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || "Unable to save profile.");
    }

    if (profile.name.trim() && profile.name.trim() !== user.displayName) {
      await updateProfile(user, {
        displayName: profile.name.trim(),
      });
    }

    setMessage("Profile saved successfully to MongoDB.");
  } catch (error) {
    console.error("Profile save error:", error);
    setMessage(error.message || "Unable to save profile. Please try again.");
  } finally {
    setLoading(false);
  }
}



async function handlePhoto(event) {
  const file = event.target.files?.[0];

  if (!file) return;

  if (!file.type.startsWith("image/")) {
    setMessage("Please select an image file.");
    event.target.value = "";
    return;
  }

  if (file.size > 2 * 1024 * 1024) {
    setMessage("Profile photo must be smaller than 2 MB.");
    event.target.value = "";
    return;
  }

  try {
    setLoading(true);
    setMessage("");

    const imageData = await new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("Could not read this image."));

      reader.readAsDataURL(file);
    });

    const token = await user.getIdToken();

    const response = await fetch(`${API_URL}/api/profile`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        fullName: profile.name.trim(),
        phone: profile.phone,
        skills: profile.skills,
        education: profile.education,
        photo: imageData,
      }),
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || "Unable to update profile photo.");
    }

    setPhoto(imageData);
    setMessage("Profile photo saved to MongoDB successfully.");
  } catch (error) {
    console.error("Photo upload error:", error);
    setMessage(error.message || "Could not update profile photo.");
  } finally {
    setLoading(false);
    event.target.value = "";
  }
}


async function loadSavedResumes(currentUser) {
  if (!currentUser) {
    setSavedResumes([]);
    setResume(null);
    setResumeId("");
    setResumeText("");
    setResumeMessage("");
    return;
  }

  try {
    setLoadingResumes(true);

    const token = await currentUser.getIdToken();

    const response = await fetch(`${API_URL}/api/resumes`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(
        result.message || "Could not load saved resumes."
      );
    }

    const resumes = Array.isArray(result.resumes)
      ? result.resumes
      : [];

    setSavedResumes(resumes);

    if (resumes.length > 0) {
      const latestResume = resumes[0];

      setResumeId(latestResume._id || "");
      setResumeText(
        typeof latestResume.resumeText === "string"
          ? latestResume.resumeText
          : ""
      );
      setResume(null);
      setResumeMessage("Saved resume loaded from MongoDB.");
    } else {
      setResume(null);
      setResumeId("");
      setResumeText("");
      setResumeMessage(
        "No saved resume found. Upload a PDF to get started."
      );
    }
  } catch (error) {
    console.error("Load saved resumes error:", error);
    setResumeMessage(
      error.message || "Could not load saved resumes."
    );
  } finally {
    setLoadingResumes(false);
  }
}
async function openResumePdf() {
  if (!user || !resumeId) {
    setResumeMessage("Please select a saved resume first.");
    return;
  }

  const newTab = window.open("", "_blank");

  try {
    const token = await user.getIdToken();

    const response = await fetch(
      `${API_URL}/api/resumes/${resumeId}/pdf`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error("Could not open the saved PDF.");
    }

    const pdfBlob = await response.blob();
    const pdfUrl = URL.createObjectURL(pdfBlob);

    if (newTab) {
      newTab.location.href = pdfUrl;
    } else {
      window.location.href = pdfUrl;
    }
  } catch (error) {
    if (newTab) newTab.close();

    console.error("Open PDF error:", error);
    setResumeMessage(error.message || "Could not open the PDF.");
  }
}

async function analyzeResume() {
  if (!user || !resumeId) {
    setResumeMessage("Please upload or select a saved resume first.");
    return;
  }

  try {
    setAnalyzing(true);
    setAnalysis(null);
    setResumeMessage("Analyzing your saved resume...");

    const token = await user.getIdToken();

    const response = await fetch(
      `${API_URL}/api/resumes/${resumeId}/analyze`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(
        result.message || "Could not analyze the resume."
      );
    }

    setAnalysis(result.analysis);
    setResumeMessage("Resume analysis completed.");
  } catch (error) {
    console.error("Resume analysis error:", error);
    setResumeMessage(
      error.message || "Could not analyze the resume."
    );
  } finally {
    setAnalyzing(false);
  }
}

async function matchJobDescription() {
  if (!user || !resumeId) {
    setResumeMessage("Please upload or select a resume first.");
    return;
  }

  if (!jobDescription.trim()) {
    setResumeMessage("Please paste a job description first.");
    return;
  }

  try {
    setMatchingJob(true);
    setJobMatch(null);

    const token = await user.getIdToken();

    const response = await fetch(
      `${API_URL}/api/resumes/${resumeId}/analyze`
    , {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(
        result.message || "Could not match the job description."
      );
    }

    const resumeSkills = (result.analysis.skills || []).map(
      (skill) => skill.toLowerCase()
    );

    const jobText = jobDescription.toLowerCase();

    const matchedSkills = resumeSkills.filter((skill) =>
      jobText.includes(skill)
    );

    const missingSkills = resumeSkills.length
      ? []
      : ["No recognized skills found in your resume"];

    const jobKeywords = [
      "javascript",
      "react",
      "node.js",
      "mongodb",
      "express",
      "python",
      "java",
      "sql",
      "git",
      "html",
      "css",
      "communication",
      "problem solving",
    ];

    const requiredSkills = jobKeywords.filter((skill) =>
      jobText.includes(skill)
    );

    const missingRequiredSkills = requiredSkills.filter(
      (skill) => !resumeSkills.includes(skill)
    );

    const matchedRequiredSkills = requiredSkills.filter(
      (skill) => resumeSkills.includes(skill)
    );

    const score = requiredSkills.length
      ? Math.round(
          (matchedRequiredSkills.length / requiredSkills.length) * 100
        )
      : 0;

    setJobMatch({
      score,
      matchedSkills: matchedRequiredSkills,
      missingSkills: missingRequiredSkills,
    });

    setResumeMessage("Job description matching completed.");
  } catch (error) {
    console.error("Job matching error:", error);
    setResumeMessage(
      error.message || "Could not match the job description."
    );
  } finally {
    setMatchingJob(false);
  }
}

async function loadRecommendedJobs() {
  if (!user || !resumeId) {
    setResumeMessage("Please upload or select a resume first.");
    return;
  }

  try {
    setMatchingJob(true);
    setJobMatch(null);
    setResumeMessage("Finding suitable jobs...");

    const token = await user.getIdToken();

    const response = await fetch(
      `${API_URL}/api/resumes/${resumeId}/jobs`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(
        result.message || "Could not load recommended jobs."
      );
    }

    setJobMatch({
      jobs: result.jobs || [],
      resumeSkills: result.resumeSkills || [],
    });

    setResumeMessage(
      `Found ${(result.jobs || []).length} suitable job listings.`
    );
  } catch (error) {
    console.error("Recommended jobs error:", error);
    setResumeMessage(
      error.message || "Could not load recommended jobs."
    );
  } finally {
    setMatchingJob(false);
  }
}

  async function handleResumeUpload(event) {
    event.preventDefault();

    if (!resume) {
      setResumeMessage("Please select a PDF resume first.");
      return;
    }

    if (
      resume.type !== "application/pdf" &&
      !resume.name.toLowerCase().endsWith(".pdf")
    ) {
      setResumeMessage("Only PDF files are supported.");
      return;
    }

    if (resume.size > 5 * 1024 * 1024) {
      setResumeMessage("Resume must be smaller than 5 MB.");
      return;
    }

    const data = new FormData();
    data.append("resume", resume);

    try {
      setUploading(true);
      setResumeText("");
      setResumeId("");
      setResumeMessage("Uploading and extracting text...");

      const token = await user.getIdToken();

      const response = await fetch(`${API_URL}/api/resumes/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: data,
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Resume upload failed.");
      }

      setResumeText(result.resumeText || "");
      setResumeId(result.resumeId || result._id || "");

      setResumeMessage(
        result.resumeText
          ? "Resume text extracted successfully."
          : "Upload completed, but no text was found in the PDF."
      );

      if (!result.resumeId && !result._id) {
        setResumeMessage(
          "Resume text extracted, but the backend did not return a saved resume ID. Deletion requires the MongoDB save route."
        );
      }
    } catch (error) {
      setResumeMessage(
        error.message ||
          "Cannot connect to the backend. Make sure it is running."
      );
    } finally {
      setUploading(false);
    }
  }

  // Delete the current saved resume from MongoDB.
  
async function deleteResume() {
  if (!resumeId) {
    setResumeMessage(
      "This resume has no saved MongoDB ID."
    );
    return;
  }

  const confirmed = window.confirm(
    "Are you sure you want to permanently delete this resume?"
  );

  if (!confirmed) return;

  try {
    setDeletingResume(true);

    const token = await user.getIdToken();

    const response = await fetch(
      `${API_URL}/api/resumes/${resumeId}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const responseText = await response.text();

    let result;

    try {
      result = JSON.parse(responseText);
    } catch {
      console.error("Delete URL:", `${API_URL}/api/resumes/${resumeId}`);
      console.error("Server response:", responseText);

      throw new Error(
        "Server returned an invalid response while deleting the resume."
      );
    }

    if (!response.ok || !result.success) {
      throw new Error(
        result.message || "Failed to delete resume."
      );
    }

    setResume(null);
    setResumeId("");
    setResumeText("");
    setResumeMessage("Resume deleted successfully.");
  } catch (error) {
    console.error("Delete resume error:", error);

    setResumeMessage(
      error.message || "Could not delete resume."
    );
  } finally {
    setDeletingResume(false);
  }
}


  async function copyResumeText() {
    try {
      await navigator.clipboard.writeText(resumeText);
      setResumeMessage("Resume text copied successfully.");
    } catch {
      setResumeMessage("Copy failed. Please copy the text manually.");
    }
  }

  function Avatar({ size = 42 }) {
    const initial = (
      profile.name ||
      user?.displayName ||
      user?.email ||
      "U"
    ).charAt(0).toUpperCase();

    return (
      <span
        className="avatar"
        style={{ width: size, height: size, minWidth: size }}
      >
        {photo ? (
          <img src={photo} alt="Profile" />
        ) : (
          initial
        )}
      </span>
    );
  }

  if (!user) {
    return (
      <div className="app-shell">
        <div className="glow glow-one" />
        <div className="glow glow-two" />

        <header className="topbar">
          <div className="brand">
            <span className="brand-icon">✦</span>
            <span>
              Resume<span className="brand-accent">AI</span>
            </span>
          </div>
          <span className="top-label">AI CAREER PLATFORM</span>
        </header>

        <main className="main-layout">
          <section className="intro-panel">
            <span className="eyebrow">YOUR NEXT CAREER MOVE</span>

            <h1>
              Make your resume
              <br />
              <span>work smarter.</span>
            </h1>

            <p>
              Analyze your resume, organize your skills, and prepare
              for your next career opportunity with one smart workspace.
            </p>

            <div className="feature-list">
              <div className="feature">
                <span>✧</span>
                <div>
                  <strong>Resume Analysis</strong>
                  <p>Upload your resume and extract its text.</p>
                </div>
              </div>

              <div className="feature">
                <span>◎</span>
                <div>
                  <strong>Personal Profile</strong>
                  <p>Keep your skills and education organized.</p>
                </div>
              </div>

              <div className="feature">
                <span>↗</span>
                <div>
                  <strong>Career Preparation</strong>
                  <p>Build your foundation for future job matching.</p>
                </div>
              </div>
            </div>
          </section>

          <section className="auth-card">
            <div className="card-symbol">✦</div>

            <h2>
              {mode === "login" ? "Welcome back" : "Create your account"}
            </h2>

            <p className="card-subtitle">
              {mode === "login"
                ? "Sign in to organize your profile and analyze your resume."
                : "Start building your career workspace today."}
            </p>

            <div className="mode-switch">
              <button
                type="button"
                className={mode === "login" ? "active" : ""}
                onClick={() => {
                  setMode("login");
                  setMessage("");
                }}
              >
                Sign In
              </button>

              <button
                type="button"
                className={mode === "register" ? "active" : ""}
                onClick={() => {
                  setMode("register");
                  setMessage("");
                }}
              >
                Create Account
              </button>
            </div>

            <button
              type="button"
              className="google-button"
              onClick={handleGoogleLogin}
              disabled={loading || googleLoading}
            >
              <span className="google-g">G</span>
              {googleLoading ? "Connecting..." : "Continue with Google"}
            </button>

            <div className="separator">OR CONTINUE WITH EMAIL</div>

            <form onSubmit={handleAuth}>
              {mode === "register" && (
                <label>
                  Full Name
                  <input
                    name="name"
                    value={form.name}
                    onChange={updateForm}
                    placeholder="Enter your full name"
                    autoComplete="name"
                    required
                  />
                </label>
              )}

              <label>
                Email Address
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={updateForm}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                />
              </label>

              <label>
                Password
                <div className="password-field">
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    value={form.password}
                    onChange={updateForm}
                    placeholder="Enter your password"
                    autoComplete={
                      mode === "register"
                        ? "new-password"
                        : "current-password"
                    }
                    required
                  />

                  <button
                    type="button"
                    className="show-password"
                    onClick={() => setShowPassword((value) => !value)}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </label>

              {mode === "register" && (
                <label>
                  Confirm Password
                  <input
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(event) =>
                      setConfirmPassword(event.target.value)
                    }
                    placeholder="Enter your password again"
                    autoComplete="new-password"
                    required
                  />
                </label>
              )}

              {mode === "login" && (
                <div className="forgot-row">
                  <button
                    type="button"
                    className="forgot-password"
                    onClick={handleForgotPassword}
                    disabled={loading}
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              {message && (
                <div className="notice" role="status">
                  {message}
                </div>
              )}

              <button
                type="submit"
                className="primary-button"
                disabled={loading || googleLoading}
              >
                {loading
                  ? "Please wait..."
                  : mode === "login"
                  ? "Sign In"
                  : "Create Account"}
                <span>→</span>
              </button>
            </form>

            <p className="terms">
              Secure sign-in powered by Firebase Authentication.
            </p>
          </section>
        </main>

        <footer>ResumeAI · Your career journey starts here</footer>
      </div>
    );
  }

  const navigation = [
    { name: "Dashboard", icon: "⌂" },
    { name: "Resume Analyzer", icon: "▤" },
    { name: "My Profile", icon: "◎" },
  ];

  return (
    <div className="workspace">
      <header className="workspace-header">
        <div className="brand">
          <span className="brand-icon">✦</span>
          <span>
            Resume<span className="brand-accent">AI</span>
          </span>
        </div>

        <div className="account-area">
          <button
            type="button"
            className="account-button"
            onClick={() => setProfileMenuOpen((value) => !value)}
          >
            <Avatar />
            <span>{profile.name || user.displayName || user.email}</span>
            <span>⌄</span>
          </button>

          {profileMenuOpen && (
            <div className="account-dropdown">
              <button
                type="button"
                onClick={() => {
                  setPage("My Profile");
                  setProfileMenuOpen(false);
                }}
              >
                My Profile
              </button>

              <button type="button" onClick={handleLogout}>
                Sign Out
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="workspace-layout">
        <aside className="workspace-sidebar">
          <p className="sidebar-heading">WORKSPACE</p>

          {navigation.map((item) => (
            <button
              type="button"
              key={item.name}
              className={`nav-link ${page === item.name ? "active" : ""}`}
              onClick={() => {
                setPage(item.name);
                setMessage("");
              }}
            >
              <span>{item.icon}</span>
              {item.name}
            </button>
          ))}

          <div className="sidebar-account">
            <Avatar size={38} />
            <div>
              <strong>
                {profile.name || user.displayName || "My Account"}
              </strong>
              <small>Personal workspace</small>
            </div>
          </div>
        </aside>

        <main className="workspace-content">
          {message && (
            <div className="notice workspace-notice" role="status">
              <span>{message}</span>
              <button type="button" onClick={() => setMessage("")}>
                ×
              </button>
            </div>
          )}

          {page === "Dashboard" && (
            <>
              <div className="page-heading">
                <span className="eyebrow">OVERVIEW</span>
                <h1>
                  Welcome back, {profile.name || user.displayName || "there"}.
                </h1>
                <p>
                  Manage your resume and career information in one place.
                </p>
              </div>

              <section className="dashboard-hero">
                <div>
                  <span className="eyebrow">YOUR CAREER WORKSPACE</span>
                  <h2>Ready to improve your resume?</h2>
                  <p>
                    Upload your PDF resume and review its extracted content.
                  </p>
                  <button
                    type="button"
                    className="primary-button hero-button"
                    onClick={() => setPage("Resume Analyzer")}
                  >
                    Open Resume Analyzer <span>→</span>
                  </button>
                </div>
                <div className="hero-art">✦</div>
              </section>

              <div className="stats-grid">
                <article className="stat-card">
                  <span className="stat-icon">▤</span>
                  <p>Resume Status</p>
                  <h3>{resumeText ? "Processed" : "Not uploaded"}</h3>
                  <small>
                    {resumeText
                      ? "Text extraction completed"
                      : "Upload a PDF to start"}
                  </small>
                </article>

                <article className="stat-card">
                  <span className="stat-icon">◎</span>
                  <p>Profile</p>
                  <h3>{profile.skills ? "In progress" : "Get started"}</h3>
                  <small>Keep your career details updated</small>
                </article>

                <article className="stat-card">
                  <span className="stat-icon">✧</span>
                  <p>Extracted Text</p>
                  <h3>{resumeText.length.toLocaleString()}</h3>
                  <small>Characters extracted from your PDF</small>
                </article>
              </div>

              <div className="section-title">
                <h2>Quick actions</h2>
                <p>Choose a section to continue.</p>
              </div>

              <div className="quick-grid">
                <button
                  type="button"
                  className="quick-card"
                  onClick={() => setPage("Resume Analyzer")}
                >
                  <span className="quick-icon">▤</span>
                  <strong>Resume Analyzer</strong>
                  <p>Upload and review your resume PDF.</p>
                  <span className="quick-arrow">→</span>
                </button>

                <button
                  type="button"
                  className="quick-card"
                  onClick={() => setPage("My Profile")}
                >
                  <span className="quick-icon">◎</span>
                  <strong>My Profile</strong>
                  <p>Update your skills and education.</p>
                  <span className="quick-arrow">→</span>
                </button>
              </div>
            </>
          )}

          {page === "Resume Analyzer" && (
            <>
              <div className="page-heading">
                <span className="eyebrow">RESUME TOOLS</span>
                <h1>Resume Analyzer</h1>
                <p>
                  Upload a PDF and view the text extracted from your resume.
                </p>
              </div>

              <section className="panel">
                <div className="section-title">
                  <h2>Upload your resume</h2>
                  <p>PDF format · Maximum size 5 MB</p>
                </div>

                <form className="upload-form" onSubmit={handleResumeUpload}>
                  <label className="file-drop">
                    <span className="file-icon">↑</span>
                    <strong>
                      {resume ? resume.name : "Choose your resume"}
                    </strong>
                    <span>
                      {resume
                        ? `${(resume.size / 1024).toFixed(1)} KB`
                        : "Select a PDF file from your device"}
                    </span>
                    <input
                      type="file"
                      accept=".pdf,application/pdf"
                      onChange={(event) => {
                        setResume(event.target.files?.[0] || null);
                        setResumeMessage("");
                        setResumeText("");
                        setResumeId("");
                      }}
                    />
                  </label>

                  <button
                    type="submit"
                    className="primary-button upload-button"
                    disabled={!resume || uploading}
                  >
                    {uploading ? "Processing..." : "Upload & Extract Text"}
                    <span>→</span>
                  </button>
                </form>

                {resumeMessage && (
                  <div className="notice" role="status">
                    {resumeMessage}
                  </div>
                )}
              </section>

              {resumeText && (
                <>
                  <section className="panel">
                    <div className="section-title extracted-heading">
                      <div>
                        <h2>Resume file details</h2>
                        <p>Summary of your uploaded document.</p>
                      </div>

                      <button
                        type="button"
                        className="secondary-button"
                        onClick={deleteResume}
                        disabled={deletingResume || !resumeId}
                        title={
                          !resumeId
                            ? "Backend must save the PDF and return its MongoDB ID"
                            : "Delete this saved resume"
                        }
                      >
                        {deletingResume ? "Deleting..." : "Delete Resume"}
                      </button>
                    </div>

                    <div className="table-wrap">
                      <table className="resume-table">
                        <thead>
                          <tr>
                            <th>Property</th>
                            <th>Details</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td>Resume File</td>
                            <td>{resume?.name || "Uploaded PDF"}</td>
                            <td>
                              <span className="status-pill">Uploaded</span>
                            </td>
                          </tr>
                          <tr>
                            <td>File Format</td>
                            <td>PDF Document</td>
                            <td>
                              <span className="status-pill">Supported</span>
                            </td>
                          </tr>
                          <tr>
                            <td>Extracted Text</td>
                            <td>
                              {resumeText.length.toLocaleString()} characters
                            </td>
                            <td>
                              <span className="status-pill">Completed</span>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </section>

                  <section className="panel extracted-panel">
                    <div className="section-title extracted-heading">
                      <div>
                        <h2>Extracted resume text</h2>
                        <p>
                          Review or copy the content extracted from your PDF.
                        </p>
                      </div>
                      <button
                        type="button"
                        className="secondary-button copy-button"
                        onClick={copyResumeText}
                      >
                        Copy Text
                      </button>
                    </div>

                    <div className="resume-metrics">
                      <div>
                        <small>FILE TYPE</small>
                        <strong>PDF Document</strong>
                      </div>
                      <div>
                        <small>TEXT LENGTH</small>
                        <strong>
                          {resumeText.length.toLocaleString()} characters
                        </strong>
                      </div>
                      <div>
                        <small>STATUS</small>
                        <strong className="success-text">Extracted</strong>
                      </div>
                    </div>

                    <pre className="extracted-text">{resumeText}</pre>
                  </section>
                  
<section className="panel">
  <div className="section-title">
    <h2>Detailed Resume Analysis</h2>
    <p>Check your resume skills and common sections.</p>
  </div>

  <button
    type="button"
    className="primary-button"
    onClick={analyzeResume}
    disabled={analyzing || !resumeId}
  >
    {analyzing ? "Analyzing..." : "Analyze Resume"}
  </button>

  {analysis && (
    <div className="analysis-results">
      <h3>Resume Checklist Score: {analysis.score}%</h3>
      <p>{analysis.fileName}</p>

      <h3>Detected Skills</h3>
      {analysis.skills.length > 0 ? (
        <div className="skill-chip-list">
          {analysis.skills.map((skill) => (
            <span className="skill-chip" key={skill}>
              {skill}
            </span>
          ))}
        </div>
      ) : (
        <p>No skills from the built-in keyword list were detected.</p>
      )}

      <h3>Suggestions</h3>
      {analysis.suggestions.length > 0 ? (
        <ul>
          {analysis.suggestions.map((suggestion, index) => (
            <li key={index}>{suggestion}</li>
          ))}
        </ul>
      ) : (
        <p>No checklist suggestions.</p>
      )}

      <small>
        This is a basic checklist score, not an AI assessment or hiring probability.
      </small>
    </div>
  )}
</section>

<section className="panel">
  <div className="section-title">
    <h2>Recommended Jobs & Companies</h2>
    <p>Find jobs that match your uploaded resume automatically.</p>
  </div>

  <button
    type="button"
    className="primary-button"
    onClick={loadRecommendedJobs}
    disabled={matchingJob || !resumeId}
  >
    {matchingJob ? "Finding Jobs..." : "Find Suitable Jobs"}
  </button>

  {jobMatch && (
    <div className="analysis-results">
      <h3>Skills Found in Your Resume</h3>

      {jobMatch.resumeSkills.length > 0 ? (
        <div className="skill-chip-list">
          {jobMatch.resumeSkills.map((skill) => (
            <span className="skill-chip" key={skill}>
              {skill}
            </span>
          ))}
        </div>
      ) : (
        <p>No recognized skills were found in your resume.</p>
      )}

      <h3>Matching Job Opportunities</h3>

      {jobMatch.jobs.length > 0 ? (
        jobMatch.jobs.map((job, index) => (
          <article
            className="analysis-stat-card"
            key={`${job.url}-${index}`}
          >
            <h4>{job.title}</h4>
            <p><strong>Company:</strong> {job.company}</p>
            <p><strong>Location:</strong> {String(job.location)}</p>
            <p><strong>Resume keyword match:</strong> {job.score}%</p>
            <p>
              <strong>Matching skills:</strong>{" "}
              {job.matchedSkills.join(", ") || "None detected"}
            </p>
            <a
              href={job.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              View Job & Apply
            </a>
          </article>
        ))
      ) : (
        <p>No matching job listings were found.</p>
      )}
    </div>
  )}
</section>

                  <section
                    className="panel resume-analytics"
                    aria-label="Resume analysis statistics"
                  >
                    <div className="section-title">
                      <h2>Resume analysis statistics</h2>
                      <p>
                        Calculated from the text extracted from your uploaded
                        PDF.
                      </p>
                    </div>

                    <div className="analysis-stat-grid">
                      <article className="analysis-stat-card">
                        <span className="analysis-stat-icon">Aa</span>
                        <small>WORD COUNT</small>
                        <strong>{resumeStats.words.toLocaleString()}</strong>
                      </article>

                      <article className="analysis-stat-card">
                        <span className="analysis-stat-icon">#</span>
                        <small>CHARACTERS</small>
                        <strong>
                          {resumeStats.characters.toLocaleString()}
                        </strong>
                      </article>

                      <article className="analysis-stat-card">
                        <span className="analysis-stat-icon">✦</span>
                        <small>SKILLS DETECTED</small>
                        <strong>{resumeStats.detectedSkills.length}</strong>
                      </article>

                      <article className="analysis-stat-card">
                        <span className="analysis-stat-icon">▤</span>
                        <small>SECTION COVERAGE</small>
                        <strong>{resumeStats.sectionCoveragePercent}%</strong>
                        <div className="percentage-track">
                          <div
                            className="percentage-fill"
                            style={{
                              width: `${resumeStats.sectionCoveragePercent}%`,
                            }}
                          />
                        </div>
                        <span className="percentage-caption">
                          {resumeStats.sections.length} of 4 common sections
                          detected
                        </span>
                      </article>
                    </div>

                    <div className="analysis-percentage-row">
                      <div className="analysis-detail-card percentage-summary">
                        <div className="percentage-summary-heading">
                          <h3>Contact information check</h3>
                          <strong>{resumeStats.contactPercent}%</strong>
                        </div>
                        <div className="percentage-track">
                          <div
                            className="percentage-fill"
                            style={{
                              width: `${resumeStats.contactPercent}%`,
                            }}
                          />
                        </div>
                        <small className="analysis-disclaimer">
                          Based on whether an email address and phone number
                          were detected in the extracted text.
                        </small>
                      </div>
                    </div>

                    <div className="analysis-detail-grid">
                      <div className="analysis-detail-card">
                        <h3>Detected skills</h3>
                        {resumeStats.detectedSkills.length ? (
                          <div className="skill-chip-list">
                            {resumeStats.detectedSkills.map((skill) => (
                              <span className="skill-chip" key={skill}>
                                {skill}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="analysis-empty">
                            No skills from the built-in keyword list were
                            detected. This does not mean your resume has no
                            skills.
                          </p>
                        )}
                        <small className="analysis-disclaimer">
                          Keyword-based detection; review for accuracy.
                        </small>
                      </div>

                      <div className="analysis-detail-card">
                        <h3>Skills distribution</h3>
                        {resumeStats.skillGroups.map((group) => {
                          const percent = resumeStats.detectedSkills.length
                            ? Math.round(
                                (group.count /
                                  resumeStats.detectedSkills.length) *
                                  100
                              )
                            : 0;

                          return (
                            <div className="skill-bar-row" key={group.label}>
                              <div className="skill-bar-label">
                                <span>
                                  {group.label} ({group.count})
                                </span>
                                <strong>{percent}%</strong>
                              </div>
                              <div className="skill-bar-track">
                                <div
                                  className="skill-bar-fill"
                                  style={{ width: `${percent}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="analysis-detail-card">
                        <h3>Resume sections</h3>
                        <ul className="analysis-check-list">
                          {[
                            "Education",
                            "Experience",
                            "Projects",
                            "Certifications",
                          ].map((section) => {
                            const found = resumeStats.sections.some(
                              (item) => item.label === section
                            );

                            return (
                              <li key={section}>
                                <span
                                  className={
                                    found
                                      ? "analysis-check found"
                                      : "analysis-check"
                                  }
                                >
                                  {found ? "✓" : "–"}
                                </span>
                                {section}
                                <small>
                                  {found ? "Keyword found" : "Not detected"}
                                </small>
                              </li>
                            );
                          })}
                        </ul>
                        <small className="analysis-disclaimer">
                          Section detection is based on keywords and may miss
                          differently named sections.
                        </small>
                      </div>

                      <div className="analysis-detail-card">
                        <h3>Contact information</h3>
                        <ul className="analysis-check-list">
                          <li>
                            <span
                              className={
                                resumeStats.emailDetected
                                  ? "analysis-check found"
                                  : "analysis-check"
                              }
                            >
                              {resumeStats.emailDetected ? "✓" : "–"}
                            </span>
                            Email address
                            <small>
                              {resumeStats.emailDetected
                                ? "Detected"
                                : "Not detected"}
                            </small>
                          </li>
                          <li>
                            <span
                              className={
                                resumeStats.phoneDetected
                                  ? "analysis-check found"
                                  : "analysis-check"
                              }
                            >
                              {resumeStats.phoneDetected ? "✓" : "–"}
                            </span>
                            Phone number
                            <small>
                              {resumeStats.phoneDetected
                                ? "Possible number detected"
                                : "Not detected"}
                            </small>
                          </li>
                        </ul>
                      </div>
                    </div>

                    <p className="analysis-disclaimer analysis-footer-note">
                      These are text-based indicators, not an overall
                      resume-quality score. Job-match percentages require a job
                      description and a separate matching analysis.
                    </p>
                  </section>
                </>
              )}
            </>
          )}

          {page === "My Profile" && (
            <>
              <div className="page-heading">
                <span className="eyebrow">ACCOUNT SETTINGS</span>
                <h1>My Profile</h1>
                <p>Manage your personal and professional details.</p>
              </div>

              <section className="panel">
                <div className="profile-overview">
                  <label className="profile-photo-picker">
                    <Avatar size={88} />
                    <span className="photo-edit">Change photo</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhoto}
                    />
                  </label>

                  <div>
                    <h2>
                      {profile.name || user.displayName || "Your profile"}
                    </h2>
                    <p>{user.email}</p>
                    <small>Choose an image smaller than 2 MB.</small>
                  </div>
                </div>
                <div className="resume-profile-section">
  <h2>My Resume</h2>

  <p>
    {resumeId
      ? "Your saved resume is available in your account."
      : "No saved resume selected. Upload a PDF in Resume Analyzer first."}
  </p>

  {resumeId && (
    <button
      type="button"
      className="primary-button"
      onClick={openResumePdf}
    >
      Open Resume PDF
    </button>
  )}
</div>
                <form className="profile-form" onSubmit={saveProfile}>
                  <label>
                    Full Name
                    <input
                      name="name"
                      value={profile.name}
                      onChange={handleProfileChange}
                      placeholder="Enter your full name"
                    />
                  </label>

                  <label>
                    Email Address
                    <input value={user.email || ""} readOnly />
                  </label>

                  <label>
                    Phone Number
                    <input
                      name="phone"
                      value={profile.phone}
                      onChange={handleProfileChange}
                      placeholder="Enter your phone number"
                    />
                  </label>

                  <label>
                    Skills
                    <textarea
                      name="skills"
                      value={profile.skills}
                      onChange={handleProfileChange}
                      placeholder="e.g. Python, React, SQL"
                      rows={3}
                    />
                  </label>

                  <label>
                    Education
                    <textarea
                      name="education"
                      value={profile.education}
                      onChange={handleProfileChange}
                      placeholder="Enter your qualification"
                      rows={3}
                    />
                  </label>

                  <button
                    type="submit"
                    className="primary-button save-button"
                  >
                    Save Profile <span>→</span>
                  </button>
                </form>
              </section>
            </>
          )}

          <footer className="workspace-footer">
            ResumeAI · Your personal career workspace
          </footer>
        </main>
      </div>
    </div>
  );
}

export default App;
