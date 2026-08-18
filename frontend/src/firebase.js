import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyA98ey1XahNjqX4endlHU75zS-IU8wt5BQ",
  authDomain: "gsstb-scholar-f670e.firebaseapp.com",
  projectId: "gsstb-scholar-f670e",
  storageBucket: "gsstb-scholar-f670e.firebasestorage.app",
  messagingSenderId: "427789514515",
  appId: "1:427789514515:web:4628b67ce9dc5d5a2dcce6",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export default app;
