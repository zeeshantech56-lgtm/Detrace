/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Firebase config — values baked in for reliable deployment
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyC4wdU4SPunAq2V0HOp1-o0N8wYtujaXRw",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "detrace-25103.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "detrace-25103",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "detrace-25103.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "264202419529",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:264202419529:web:bec7d27a9598352344ae98"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const db = getFirestore(app);
export const isFirebaseConfigured = true;

export const OperationType = {
  GET: 'GET',
  WRITE: 'WRITE',
  LIST: 'LIST'
} as const;

export type OperationType = typeof OperationType[keyof typeof OperationType];

export function handleFirestoreError(error: any, operation: OperationType, path: string) {
  console.error(`Firestore operation ${operation} on ${path} failed:`, error);
  throw new Error(`Storage error during ${operation} operation.`);
}
