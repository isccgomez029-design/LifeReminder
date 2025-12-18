// src/services/caregiverNotifications.ts
import { db } from "../config/firebaseConfig";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";

// ============================================================
//                    TIPOS
// ============================================================

type NotifyResult = {
  success: boolean;
  notifiedCount: number;
  error?: string;
};

// ============================================================
//     NOTIFICAR INCUMPLIMIENTO (MÚLTIPLES POSPOSICIONES)
// ============================================================

/**
 * Notificar a los cuidadores sobre incumplimiento de medicación/hábito
 * Se llama cuando el paciente pospone 3+ veces
 *
 * @param patientUid - UID del paciente
 * @param patientName - Nombre del paciente (opcional)
 * @param medicationName - Nombre del medicamento o hábito
 * @param snoozeCount - Número de veces que se pospuso
 * @param type - Tipo de recordatorio ("med" | "habit")
 */
export async function notifyCaregiversAboutNoncompliance(params: {
  patientUid: string;
  patientName?: string;
  medicationName: string;
  snoozeCount: number;
  type: "med" | "habit";
}): Promise<NotifyResult> {
  try {
    const { patientUid, patientName, medicationName, snoozeCount, type } =
      params;

    //  Buscar cuidadores activos del paciente
    const careNetworkRef = collection(db, "users", patientUid, "careNetwork");
    const q = query(
      careNetworkRef,
      where("status", "==", "accepted"),
      where("deleted", "==", false)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {

      return { success: true, notifiedCount: 0 };
    }

    // Crear notificación para cada cuidador
    const notificationPromises = snapshot.docs.map(async (doc) => {
      const caregiverData = doc.data();
      const caregiverUid = caregiverData.caregiverUid;

      // Solo notificar si el modo de acceso permite alertas
      const accessMode = caregiverData.accessMode || "alerts-only";
      if (accessMode === "disabled") {

        return false;
      }

      if (!caregiverUid) {

        return false;
      }

      // Crear notificación en la subcolección del cuidador
      const notificationsRef = collection(
        db,
        "users",
        caregiverUid,
        "notifications"
      );

      const itemType = type === "med" ? "medicamento" : "hábito";
      const patientDisplay = patientName || "Un paciente";

      await addDoc(notificationsRef, {
        type: "noncompliance",
        title: `⚠️ Incumplimiento detectado`,
        message: `${patientDisplay} ha pospuesto "${medicationName}" ${snoozeCount} veces`,
        patientUid: patientUid,
        patientName: patientName || "Paciente",
        itemType: type,
        itemName: medicationName,
        snoozeCount: snoozeCount,
        severity: "high",
        read: false,
        createdAt: serverTimestamp(),
      });
      return true;
    });

    const results = await Promise.all(notificationPromises);
    const notifiedCount = results.filter(Boolean).length;


    return { success: true, notifiedCount };
  } catch (error: any) {

    return { success: false, notifiedCount: 0, error: error?.message };
  }
}

// ============================================================
//     NOTIFICAR DESCARTE (DISMISS) DE ALARMA
// ============================================================

/**
 * Notificar a los cuidadores cuando el paciente DESCARTA una alarma
 * sin tomar el medicamento o completar el hábito
 *
 * @param patientUid - UID del paciente
 * @param patientName - Nombre del paciente (opcional)
 * @param itemName - Nombre del medicamento o hábito
 * @param itemType - Tipo ("med" | "habit")
 * @param snoozeCountBeforeDismiss - Veces que pospuso antes de descartar
 */
export async function notifyCaregiversAboutDismissal(params: {
  patientUid: string;
  patientName?: string;
  itemName: string;
  itemType: "med" | "habit";
  snoozeCountBeforeDismiss: number;
}): Promise<NotifyResult> {
  try {
    const {
      patientUid,
      patientName,
      itemName,
      itemType,
      snoozeCountBeforeDismiss,
    } = params;

    //  Buscar cuidadores activos del paciente
    const careNetworkRef = collection(db, "users", patientUid, "careNetwork");
    const q = query(
      careNetworkRef,
      where("status", "==", "accepted"),
      where("deleted", "==", false)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {

      return { success: true, notifiedCount: 0 };
    }

    //  Crear notificación para cada cuidador
    const notificationPromises = snapshot.docs.map(async (doc) => {
      const caregiverData = doc.data();
      const caregiverUid = caregiverData.caregiverUid;

      // Solo notificar si el modo de acceso permite alertas
      const accessMode = caregiverData.accessMode || "alerts-only";
      if (accessMode === "disabled") {

        return false;
      }

      if (!caregiverUid) {

        return false;
      }

      // Crear notificación en la subcolección del cuidador
      const notificationsRef = collection(
        db,
        "users",
        caregiverUid,
        "notifications"
      );

      const itemTypeLabel = itemType === "med" ? "medicamento" : "hábito";
      const patientDisplay = patientName || "Un paciente";

      // Determinar severidad basada en si pospuso antes
      const severity =
        snoozeCountBeforeDismiss > 0
          ? "high"
          : snoozeCountBeforeDismiss === 0
          ? "medium"
          : "medium";

      // Mensaje más descriptivo
      let messageText = `${patientDisplay} ha descartado el ${itemTypeLabel} "${itemName}"`;
      if (snoozeCountBeforeDismiss > 0) {
        messageText += ` después de posponerlo ${snoozeCountBeforeDismiss} ${
          snoozeCountBeforeDismiss === 1 ? "vez" : "veces"
        }`;
      }
      messageText += " sin completarlo.";

      await addDoc(notificationsRef, {
        type: "dismissal",
        title: `🚫 ${
          itemTypeLabel === "medicamento" ? "Medicamento" : "Hábito"
        } descartado`,
        message: messageText,
        patientUid: patientUid,
        patientName: patientName || "Paciente",
        itemType: itemType,
        itemName: itemName,
        snoozeCountBeforeDismiss: snoozeCountBeforeDismiss,
        severity: severity,
        read: false,
        createdAt: serverTimestamp(),
      });

      return true;
    });

    const results = await Promise.all(notificationPromises);
    const notifiedCount = results.filter(Boolean).length;


    return { success: true, notifiedCount };
  } catch (error: any) {

    return { success: false, notifiedCount: 0, error: error?.message };
  }
}

// ============================================================
//    REGISTRAR EVENTO DE POSPOSICIÓN
// ============================================================

/**
 * Registrar evento de posposición en Firestore

 */
export async function logSnoozeEvent(params: {
  patientUid: string;
  itemId: string;
  itemName: string;
  itemType: "med" | "habit";
  snoozeMinutes: number;
  snoozeCount: number;
}) {
  try {
    const {
      patientUid,
      itemId,
      itemName,
      itemType,
      snoozeMinutes,
      snoozeCount,
    } = params;

    const eventsRef = collection(db, "users", patientUid, "complianceEvents");

    await addDoc(eventsRef, {
      eventType: "snooze",
      itemId,
      itemName,
      itemType,
      snoozeMinutes,
      snoozeCount,
      timestamp: serverTimestamp(),
    });


  } catch (error) {

  }
}

// ============================================================
//    REGISTRAR EVENTO DE DESCARTE
// ============================================================

/**
 * Registrar evento de descarte en Firestore
  */
export async function logDismissalEvent(params: {
  patientUid: string;
  itemId: string;
  itemName: string;
  itemType: "med" | "habit";
  snoozeCountBeforeDismiss: number;
}) {
  try {
    const { patientUid, itemId, itemName, itemType, snoozeCountBeforeDismiss } =
      params;

    const eventsRef = collection(db, "users", patientUid, "complianceEvents");

    await addDoc(eventsRef, {
      eventType: "dismissal",
      itemId,
      itemName,
      itemType,
      snoozeCountBeforeDismiss,
      timestamp: serverTimestamp(),
    });


  } catch (error) {

  }
}

// ============================================================
//    REGISTRAR CUMPLIMIENTO EXITOSO
// ============================================================

/**
 * Registrar cumplimiento exitoso
 */
export async function logComplianceSuccess(params: {
  patientUid: string;
  itemId: string;
  itemName: string;
  itemType: "med" | "habit";
  afterSnoozes?: number;
}) {
  try {
    const { patientUid, itemId, itemName, itemType, afterSnoozes } = params;

    const eventsRef = collection(db, "users", patientUid, "complianceEvents");

    await addDoc(eventsRef, {
      eventType: "completed",
      itemId,
      itemName,
      itemType,
      afterSnoozes: afterSnoozes || 0,
      timestamp: serverTimestamp(),
    });


  } catch (error) {

  }
}
