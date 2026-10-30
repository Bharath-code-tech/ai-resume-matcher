
const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");

let serviceAccount;

if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  serviceAccount = JSON.parse(
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  );
} else {
  serviceAccount = require("./serviceAccountKey.json");
}

const app =
  getApps().length === 0
    ? initializeApp({
        credential: cert(serviceAccount),
      })
    : getApps()[0];

const auth = getAuth(app);

console.log("Firebase Admin initialized successfully!");

module.exports = { adminApp: app, auth };
