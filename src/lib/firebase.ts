import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyD5Ebq5FXtwjxwXjjvxl_GpL3vQWUw87Vo",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "adam-4afa5.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "adam-4afa5",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "adam-4afa5.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "834864797467",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:834864797467:web:1cc7f4e8e7c42de04ba5be",
  measurementId: "G-DDBVSQDDQ8"
};

export const isFirebaseConfigured = !!firebaseConfig.apiKey;

if (!isFirebaseConfigured) {
  console.error("Missing Firebase configuration. Please set VITE_FIREBASE_* environment variables.");
}

export const app: FirebaseApp | undefined = isFirebaseConfigured ? initializeApp(firebaseConfig) : undefined;
export const auth: Auth = isFirebaseConfigured ? getAuth(app) : ({} as Auth);
export const db: Firestore = isFirebaseConfigured ? getFirestore(app) : ({} as Firestore);
export const storage: FirebaseStorage = isFirebaseConfigured ? getStorage(app) : ({} as FirebaseStorage);

export const googleProvider = new GoogleAuthProvider();
