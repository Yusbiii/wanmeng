import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyAKXev9jfsX8oYQPzJa8QRDzsZQFfwIWLk",
  authDomain: "ridwan04-3feba.firebaseapp.com",
  databaseURL: "https://ridwan04-3feba-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "ridwan04-3feba",
  storageBucket: "ridwan04-3feba.firebasestorage.app",
  messagingSenderId: "834350379374",
  appId: "1:834350379374:web:ba552cfc99e84b256e117f",
  measurementId: "G-JC9GFEGYZ2"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Services
export const auth = getAuth(app);
export const rtdb = getDatabase(app);
export const googleProvider = new GoogleAuthProvider();

export default app;
