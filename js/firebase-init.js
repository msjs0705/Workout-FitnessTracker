// =========================================================
// FIREBASE INIT — shared singleton
// =========================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, signOut,
  GoogleAuthProvider, signInWithRedirect, getRedirectResult, signInWithPopup
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, collection, doc, setDoc, addDoc, getDoc, getDocs,
  updateDoc, deleteDoc, query, where, orderBy, limit, Timestamp,
  enableIndexedDbPersistence
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Cache data locally so the app still works with a flaky connection
// (handy on mobile data at the gym).
try { enableIndexedDbPersistence(db); } catch (e) { /* multiple tabs open, fine to ignore */ }

export {
  onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut,
  GoogleAuthProvider, signInWithRedirect, getRedirectResult, signInWithPopup,
  collection, doc, setDoc, addDoc, getDoc, getDocs, updateDoc, deleteDoc,
  query, where, orderBy, limit, Timestamp
};
