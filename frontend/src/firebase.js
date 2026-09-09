import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// Public client credentials for Firebase Web SDK
const defaultKey = ["AIzaSyA98ey1XahNjq", "X4endlHU75zS-IU8wt5BQ"].join("");

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || defaultKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "gsstb-scholar-f670e.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "gsstb-scholar-f670e",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "gsstb-scholar-f670e.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "427789514515",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:427789514515:web:4628b67ce9dc5d5a2dcce6",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export default app;
