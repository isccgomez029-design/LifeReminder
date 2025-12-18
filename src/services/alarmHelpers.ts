// src/services/alarmHelpers.ts

import {
  offlineAlarmService,
  AlarmScheduleResult,
} from "./offline/OfflineAlarmService";

/* -----------------------------------------------------------
   PROGRAMAR ALARMA DE MEDICAMENTO
----------------------------------------------------------- */
export async function scheduleMedicationAlarm(
  triggerDate: Date,
  medication: {
    nombre: string;
    dosis?: string;
    imageUri?: string;
    medId?: string;
    ownerUid?: string;
    frecuencia?: string;
    cantidadActual?: number;
    cantidadPorToma?: number;
    patientName?: string;
    snoozeCount?: number;
  }
): Promise<string | null> {
  const result = await offlineAlarmService.scheduleMedicationAlarm(
    triggerDate,
    medication
  );
  return result.notificationId;
}

/* -----------------------------------------------------------
   PROGRAMAR ALARMA DE HÁBITO
----------------------------------------------------------- */
export async function scheduleHabitAlarm(
  triggerDate: Date,
  habit: {
    name: string;
    icon?: string;
    lib?: "MaterialIcons" | "FontAwesome5";
    habitId?: string;
    ownerUid?: string;
    patientName?: string;
    snoozeCount?: number;
  }
): Promise<string | null> {
  const result = await offlineAlarmService.scheduleHabitAlarm(
    triggerDate,
    habit
  );
  return result.notificationId;
}

/* -----------------------------------------------------------
   PROGRAMAR VARIAS ALARMAS DE HÁBITO (RECURRENTES)
----------------------------------------------------------- */
export async function scheduleRecurringHabitAlarms(habit: {
  id?: string;
  name: string;
  times: string[];
  days: number[];
  icon?: string;
  lib?: "MaterialIcons" | "FontAwesome5";
  ownerUid?: string;
}): Promise<string[]> {
  const scheduledIds: string[] = [];

  try {
    const now = new Date();

    for (const timeStr of habit.times) {
      const [hours, minutes] = timeStr.split(":").map(Number);

      for (const dayOfWeek of habit.days) {
        const nextAlarm = getNextOccurrence(dayOfWeek, hours, minutes, now);

        const id = await scheduleHabitAlarm(nextAlarm, {
          name: habit.name,
          icon: habit.icon,
          lib: habit.lib,
          habitId: habit.id,
          ownerUid: habit.ownerUid,
          snoozeCount: 0,
        });

        if (id) scheduledIds.push(id);
      }
    }
    return scheduledIds;
  } catch (error) {

    return scheduledIds;
  }
}

/* -----------------------------------------------------------
    CANCELAR ALARMAS
----------------------------------------------------------- */
export async function cancelAlarm(notificationId: string): Promise<void> {
  await offlineAlarmService.cancelAlarm(notificationId);
}

export async function cancelAllAlarms(): Promise<void> {
  await offlineAlarmService.cancelAllAlarms();
}

export async function cancelAllAlarmsForItem(
  itemId: string,
  ownerUid: string
): Promise<number> {
  return await offlineAlarmService.cancelAllAlarmsForItem(itemId, ownerUid);
}

export async function getAllScheduledAlarms() {
  return await offlineAlarmService.getAllAlarms();
}

/* -----------------------------------------------------------
   Calcular próxima ocurrencia (para alarmas recurrentes)
----------------------------------------------------------- */
function getNextOccurrence(
  targetDayOfWeek: number,
  targetHours: number,
  targetMinutes: number,
  fromDate: Date
): Date {
  const result = new Date(fromDate);

  const jsTargetDay = (targetDayOfWeek + 1) % 7;
  const currentDay = result.getDay();

  let daysUntilTarget = (jsTargetDay - currentDay + 7) % 7;

  if (daysUntilTarget === 0) {
    const nowAtTarget = new Date(result);
    nowAtTarget.setHours(targetHours, targetMinutes, 0, 0);

    if (result >= nowAtTarget) {
      daysUntilTarget = 7;
    }
  }

  result.setDate(result.getDate() + daysUntilTarget);
  result.setHours(targetHours, targetMinutes, 0, 0);

  return result;
}

/* -----------------------------------------------------------
   UTILIDAD: Reprogramar alarma de medicamento según frecuencia
----------------------------------------------------------- */
export async function scheduleNextMedicationAlarm(medication: {
  nombre: string;
  dosis?: string;
  imageUri?: string;
  medId?: string;
  ownerUid?: string;
  frecuencia?: string;
  cantidadActual?: number;
  cantidadPorToma?: number;
}): Promise<string | null> {
  const result = await offlineAlarmService.scheduleNextMedicationAlarm(
    medication
  );
  return result.notificationId;
}

// ============================================================
//           NUEVAS FUNCIONES DE UTILIDAD
// ============================================================

/**
 * Obtiene todas las alarmas de un item específico
 */
export async function getAlarmsForItem(itemId: string, ownerUid: string) {
  return await offlineAlarmService.getAlarmsForItem(itemId, ownerUid);
}

/**
 * Limpia alarmas vencidas (llamar periódicamente)
 */
export async function cleanupExpiredAlarms(): Promise<number> {
  return await offlineAlarmService.cleanupExpiredAlarms();
}


