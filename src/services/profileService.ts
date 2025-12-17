// src/services/profileService.ts


import { auth, db } from "../config/firebaseConfig";
import { doc, getDoc, setDoc } from "firebase/firestore";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updateEmail,
  updatePassword,
  User,
} from "firebase/auth";

import { syncQueueService } from "./offline/SyncQueueService";
import { offlineAuthService } from "./offline/OfflineAuthService";

export type ProfileData = {
  id: string;
  displayName: string;
  phone: string;
  email: string;

  age: number | null;
  allergies: string;
  conditions: string;
  photoUri: string | null;

  emergencyContactName: string;
  emergencyContactRelation: string;
  emergencyContactPhone: string;

  bloodType: string;
  emergencyNotes: string;

  updatedAt: string;
};

function safeFirstFromCache(cached: any): any | null {
  if (!cached?.data) return null;
  if (Array.isArray(cached.data) && cached.data.length > 0)
    return cached.data[0];
  return null;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("TIMEOUT")), ms)
    ),
  ]);
}

export function getCurrentAuthInfo() {
  const firebaseUser = auth.currentUser;
  const offlineUser = offlineAuthService.getCurrentUser();

  const userId =
    firebaseUser?.uid || offlineAuthService.getCurrentUid() || null;
  const userEmail = firebaseUser?.email || offlineUser?.email || "";
  const displayNameFallback =
    firebaseUser?.displayName || offlineUser?.displayName || "";

  return { firebaseUser, offlineUser, userId, userEmail, displayNameFallback };
}

/**
 *  OFFLINE-FIRSTL:
 * 1) Retorna cache inmediato (sin colgar)
 * 2) Si hay internet, hace getDoc en background con timeout
 * 3) Si llega remoto, actualiza cache (la UI puede re-leer luego)
 */
export async function loadProfileOfflineFirst(
  userId: string
): Promise<any | null> {
  // 1) cache (rápido)
  let data: any | null = null;
  try {
    const cached = await syncQueueService.getFromCache("profile", userId);
    const first = safeFirstFromCache(cached);
    if (first) data = first;
  } catch {
    // no-op
  }

  //  Firestore en background 
  void (async () => {
    try {
      const online = await syncQueueService.checkConnection();
      if (!online) return;

      const userRef = doc(db, "users", userId);
      const snap = await withTimeout(getDoc(userRef), 2000);

      if (snap.exists()) {
        const remote = snap.data();


        await syncQueueService.saveToCache("profile", userId, [
          { ...remote, id: userId },
        ]);
      }
    } catch {

    }
  })();

  return data;
}

export async function saveProfileOfflineFirst(args: {
  userId: string;
  profileData: ProfileData;
}): Promise<void> {
  const { userId, profileData } = args;

  // enqueue (offline-first)
  await syncQueueService.enqueue(
    "UPDATE",
    "profile",
    userId,
    userId,
    profileData
  );

  // actualizar cache local para que se vea al instante
  try {

    await syncQueueService.saveToCache("profile", userId, [
      { ...profileData, id: userId },
    ]);
  } catch {
    // no-op
  }

  // intento directo Firestore (si hay conexión)
  try {
    const userRef = doc(db, "users", userId);
    await setDoc(userRef, profileData, { merge: true });
  } catch {
    // se sincroniza luego con la cola
  }
}

export async function changeEmailOnline(args: {
  firebaseUser: User;
  newEmail: string;
  currentPassword: string;
}): Promise<void> {
  const { firebaseUser, newEmail, currentPassword } = args;

  if (!firebaseUser?.email) throw new Error("NO_EMAIL");

  const cred = EmailAuthProvider.credential(
    firebaseUser.email,
    currentPassword
  );
  await reauthenticateWithCredential(firebaseUser, cred);
  await updateEmail(firebaseUser, newEmail);

  const userRef = doc(db, "users", firebaseUser.uid);
  await setDoc(
    userRef,
    { email: newEmail, updatedAt: new Date().toISOString() },
    { merge: true }
  );
}

export async function changePasswordOnline(args: {
  firebaseUser: User;
  currentPassword: string;
  newPassword: string;
}): Promise<void> {
  const { firebaseUser, currentPassword, newPassword } = args;

  if (!firebaseUser?.email) throw new Error("NO_EMAIL");

  const cred = EmailAuthProvider.credential(
    firebaseUser.email,
    currentPassword
  );
  await reauthenticateWithCredential(firebaseUser, cred);
  await updatePassword(firebaseUser, newPassword);
}
