// src/services/alarmService.ts


import { syncQueueService } from "./offline/SyncQueueService";
import offlineAlarmService from "./offline/OfflineAlarmService";
import {
  notifyCaregiversAboutNoncompliance,
  notifyCaregiversAboutDismissal,
  logSnoozeEvent,
  logComplianceSuccess,
  logDismissalEvent,
} from "./caregiverNotifications";

export type AlarmItemType = "med" | "habit";

export type AlarmParams = {
  type: AlarmItemType;
  title?: string;
  message?: string;

  ownerUid: string;
  patientName?: string;

  // meds
  medId?: string;
  imageUri?: string;
  doseLabel?: string;
  frecuencia?: string; // "HH:mm"
  cantidadActual?: number;
  cantidadPorToma?: number;

  // habits
  habitId?: string;
  habitIcon?: string;
  habitLib?: "MaterialIcons" | "FontAwesome5";

  // state
  snoozeCount?: number;
};

export const SNOOZE_LIMIT = 3;

export const freqToMs = (freq?: string): number => {
  if (!freq) return 0;
  const m = freq.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return 0;
  return (parseInt(m[1], 10) * 60 + parseInt(m[2], 10)) * 60000;
};

export const toDateSafe = (v: any): Date | null => {
  if (!v) return null;

  if (typeof v === "string" || typeof v === "number") {
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }

  if (typeof v?.toDate === "function") {
    const d = v.toDate();
    return d instanceof Date && !isNaN(d.getTime()) ? d : null;
  }

  if (typeof v?.seconds === "number") {
    const d = new Date(v.seconds * 1000);
    return isNaN(d.getTime()) ? null : d;
  }

  return null;
};

export const fireAndForget = (p: Promise<any>) => {
  p.catch(() => {});
};

// Helper para esperar persistencia (AsyncStorage)
export async function waitForPersistence(retries = 5, delayMs = 200) {
  for (let i = 0; i < retries; i++) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
}

// Base nextDueAt para meds: nextDueAt futuro en cache o now
export async function getBaseNextDueAtForMed(input: {
  ownerUid: string;
  medId: string;
}): Promise<Date> {
  const now = new Date();
  try {
    const cached = await syncQueueService.getItemFromCache(
      "medications",
      input.ownerUid,
      input.medId
    );

    const cachedNext = toDateSafe((cached as any)?.nextDueAt);
    if (cachedNext && cachedNext.getTime() > now.getTime()) return cachedNext;

    return now;
  } catch {
    return now;
  }
}

// ================================================================
//  COMPLETE (MED / HABIT)
// ================================================================
export async function completeAlarm(params: AlarmParams) {
  const { ownerUid, type } = params;
  if (!ownerUid) return;

  const title = params.title || "Item";
  const patientName = params.patientName || "";
  const afterSnoozes = params.snoozeCount ?? 0;

  if (type === "med") {
    if (!params.medId) return;

    const medId = params.medId;
    const now = new Date();

    const newQty = Math.max(
      0,
      (params.cantidadActual ?? 0) - (params.cantidadPorToma ?? 1)
    );

    const updateData: Record<string, any> = {
      lastTakenAt: now.toISOString(),
      cantidadActual: newQty,
      cantidad: newQty,
      updatedAt: now.toISOString(),
      currentAlarmId: null,

      // limpiar snooze
      snoozeCount: 0,
      snoozedUntil: null,
      lastSnoozeAt: null,
    };

    const interval = freqToMs(params.frecuencia);
    if (interval > 0) {
      const nextDueAt = new Date(now.getTime() + interval);

      updateData.nextDueAt = nextDueAt.toISOString();
      updateData.proximaToma = nextDueAt.toLocaleTimeString("es-MX", {
        hour: "2-digit",
        minute: "2-digit",
      });

      try {
        const result = await offlineAlarmService.scheduleMedicationAlarm(
          nextDueAt,
          {
            nombre: title,
            dosis: params.doseLabel,
            imageUri: params.imageUri,
            medId,
            ownerUid,
            frecuencia: params.frecuencia,
            cantidadActual: newQty,
            cantidadPorToma: params.cantidadPorToma,
            patientName,
            snoozeCount: 0,
          }
        );

        if (result.success && result.notificationId) {
          updateData.currentAlarmId = result.notificationId;
        }
      } catch {
        // no-op
      }
    }

    await syncQueueService.enqueue(
      "UPDATE",
      "medications",
      medId,
      ownerUid,
      updateData
    );


    fireAndForget(
      logComplianceSuccess({
        patientUid: ownerUid,
        itemId: medId,
        itemName: title,
        itemType: "med",
        afterSnoozes,
      })
    );

    return;
  }

  // HABIT
  if (!params.habitId) return;
  const habitId = params.habitId;

  const now = new Date();
  const updateData = {
    currentAlarmId: null,
    snoozeCount: 0,
    snoozedUntil: null,
    lastSnoozeAt: null,
    lastCompletedAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  await syncQueueService.enqueue(
    "UPDATE",
    "habits",
    habitId,
    ownerUid,
    updateData
  );

  fireAndForget(
    logComplianceSuccess({
      patientUid: ownerUid,
      itemId: habitId,
      itemName: title,
      itemType: "habit",
      afterSnoozes,
    })
  );
}


//  SNOOZE (MED / HABIT)
export async function snoozeAlarm(
  params: AlarmParams,
  minutes: number,
  newSnoozeCount: number
) {
  const { ownerUid, type } = params;
  if (!ownerUid) return;

  const title = params.title || "Item";
  const patientName = params.patientName || "Paciente";

  const itemId = type === "med" ? params.medId : params.habitId;

  if (itemId) {
    fireAndForget(
      logSnoozeEvent({
        patientUid: ownerUid,
        itemId,
        itemName: title,
        itemType: type,
        snoozeMinutes: minutes,
        snoozeCount: newSnoozeCount,
      })
    );

    if (newSnoozeCount >= SNOOZE_LIMIT) {
      fireAndForget(
        notifyCaregiversAboutNoncompliance({
          patientUid: ownerUid,
          patientName,
          medicationName: title,
          snoozeCount: newSnoozeCount,
          type,
        })
      );
    }
  }

  let newAlarmId: string | null = null;

  if (type === "med") {
    if (!params.medId) return;
    const medId = params.medId;

    const base = await getBaseNextDueAtForMed({ ownerUid, medId });
    const newDueAt = new Date(base.getTime() + minutes * 60 * 1000);

    try {
      const result = await offlineAlarmService.scheduleMedicationAlarm(
        newDueAt,
        {
          nombre: title,
          dosis: params.doseLabel,
          imageUri: params.imageUri,
          medId,
          ownerUid,
          frecuencia: params.frecuencia,
          cantidadActual: params.cantidadActual,
          cantidadPorToma: params.cantidadPorToma,
          patientName: params.patientName,
          snoozeCount: newSnoozeCount,
        }
      );

      if (result.success) newAlarmId = result.notificationId;
    } catch {
      // no-op
    }

    const updateData: Record<string, any> = {
      currentAlarmId: newAlarmId,
      snoozeCount: newSnoozeCount,
      snoozedUntil: newDueAt.toISOString(),
      lastSnoozeAt: new Date().toISOString(),

      nextDueAt: newDueAt.toISOString(),
      proximaToma: newDueAt.toLocaleTimeString("es-MX", {
        hour: "2-digit",
        minute: "2-digit",
      }),

      updatedAt: new Date().toISOString(),
    };

    await syncQueueService.enqueue(
      "UPDATE",
      "medications",
      medId,
      ownerUid,
      updateData
    );
    return;
  }

  // HABIT
  if (!params.habitId) return;
  const habitId = params.habitId;

  const newTriggerTime = new Date(Date.now() + minutes * 60 * 1000);

  try {
    const result = await offlineAlarmService.scheduleHabitAlarm(
      newTriggerTime,
      {
        name: title,
        icon: params.habitIcon,
        lib: params.habitLib,
        habitId,
        ownerUid,
        patientName: params.patientName,
        snoozeCount: newSnoozeCount,
      }
    );

    if (result.success) newAlarmId = result.notificationId;
  } catch {
    // no-op
  }

  const updateData = {
    currentAlarmId: newAlarmId,
    snoozeCount: newSnoozeCount,
    snoozedUntil: newTriggerTime.toISOString(),
    lastSnoozeAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await syncQueueService.enqueue(
    "UPDATE",
    "habits",
    habitId,
    ownerUid,
    updateData
  );
}


export async function dismissAlarm(params: AlarmParams) {
  const { ownerUid, type } = params;
  if (!ownerUid) return;

  const title = params.title || "Item";
  const patientName = params.patientName || "Paciente";
  const snoozeCountBeforeDismiss = params.snoozeCount ?? 0;

  const itemId = type === "med" ? params.medId : params.habitId;

  if (itemId) {
    fireAndForget(
      logDismissalEvent({
        patientUid: ownerUid,
        itemId,
        itemName: title,
        itemType: type,
        snoozeCountBeforeDismiss,
      })
    );

    fireAndForget(
      notifyCaregiversAboutDismissal({
        patientUid: ownerUid,
        patientName,
        itemName: title,
        itemType: type,
        snoozeCountBeforeDismiss,
      })
    );
  }
}

export default {
  SNOOZE_LIMIT,
  waitForPersistence,
  completeAlarm,
  snoozeAlarm,
  dismissAlarm,
};
