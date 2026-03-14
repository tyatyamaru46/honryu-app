import { initializeApp, getApps } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAL1bQz3k5Y7ML4X-QYzcZeDUyfalmZKGc",
  authDomain: "my-app-23c8f.firebaseapp.com",
  projectId: "my-app-23c8f",
  storageBucket: "my-app-23c8f.firebasestorage.app",
  messagingSenderId: "178012585226",
  appId: "1:178012585226:web:defe9c8151d6dd52fa0ef3",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
