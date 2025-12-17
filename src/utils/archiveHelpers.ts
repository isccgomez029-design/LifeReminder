// src/utils/archiveHelpers.ts


import { syncQueueService } from "../services/offline/SyncQueueService";
import { offlineAlarmService } from "../services/offline/OfflineAlarmService";

/* ==========================================================
    CANCELAR ALARMAS 
   ========================================================== */

async function cancelItemAlarms(
  itemId: string,
  ownerUid: string,
  currentAlarmId?: string | null
): Promise<void> {
  try {
    // 1. Cancelar alarma actual si existe
    if (currentAlarmId) {
      await offlineAlarmService.cancelAlarm(currentAlarmId);
    }

    // 2. Cancelar todas las alarmas del item usando el servicio offline
    const canceledCount = await offlineAlarmService.cancelAllAlarmsForItem(
      itemId,
      ownerUid
    );
  } catch (error) {}
}

/* ==========================================================
   ARCHIVAR MEDICAMENTO
   ========================================================== */
export async function archiveMedication(
  userId: string,
  medId: string,
  medData?: any
): Promise<void> {
  const now = new Date().toISOString();

  // Obtener datos actuales desde cache
  const currentData = await syncQueueService.getItemFromCache(
    "medications",
    userId,
    medId
  );

  //  CANCELAR ALARMAS ANTES DE ARCHIVAR
  const alarmId = currentData?.currentAlarmId || medData?.currentAlarmId;
  await cancelItemAlarms(medId, userId, alarmId);

  const archiveData = {
    isArchived: true,
    archivedAt: now,
    updatedAt: now,
    // Reiniciar campos de alarma
    currentAlarmId: null,
    snoozeCount: 0,
    snoozedUntil: null,
    lastSnoozeAt: null,
  };

  // PRIMERO: Actualizar cache local inmediatamente
  await syncQueueService.updateItemInCache(
    "medications",
    userId,
    medId,
    archiveData
  );

  // SEGUNDO: Encolar para sincronización con Firestore
  await syncQueueService.enqueue(
    "UPDATE",
    "medications",
    medId,
    userId,
    archiveData
  );
}

/* ==========================================================
   ARCHIVAR HÁBITO
   ========================================================== */
export async function archiveHabit(
  userId: string,
  habitId: string,
  habitData?: any
): Promise<void> {
  const now = new Date().toISOString();

  const currentData = await syncQueueService.getItemFromCache(
    "habits",
    userId,
    habitId
  );

  //  CANCELAR ALARMAS ANTES DE ARCHIVAR
  const alarmId = currentData?.currentAlarmId || habitData?.currentAlarmId;
  await cancelItemAlarms(habitId, userId, alarmId);

  const archiveData = {
    isArchived: true,
    archivedAt: now,
    updatedAt: now,
    // Reiniciar campos de alarma
    currentAlarmId: null,
    scheduledAlarmIds: [],
    snoozeCount: 0,
    snoozedUntil: null,
    lastSnoozeAt: null,
  };

  // PRIMERO: Actualizar cache local
  await syncQueueService.updateItemInCache(
    "habits",
    userId,
    habitId,
    archiveData
  );

  // SEGUNDO: Encolar para Firestore
  await syncQueueService.enqueue(
    "UPDATE",
    "habits",
    habitId,
    userId,
    archiveData
  );
}

/* ==========================================================
   ARCHIVAR CITA
   ========================================================== */
export async function archiveAppointment(
  userId: string,
  appointmentId: string,
  appointmentData?: any
): Promise<void> {
  const now = new Date().toISOString();

  const currentData = await syncQueueService.getItemFromCache(
    "appointments",
    userId,
    appointmentId
  );

  //  CANCELAR RECORDATORIOS DE CITA
  await cancelItemAlarms(appointmentId, userId, null);

  const archiveData = {
    isArchived: true,
    archivedAt: now,
    updatedAt: now,
  };

  //  PRIMERO: Actualizar cache local
  await syncQueueService.updateItemInCache(
    "appointments",
    userId,
    appointmentId,
    archiveData
  );

  // SEGUNDO: Encolar para Firestore
  await syncQueueService.enqueue(
    "UPDATE",
    "appointments",
    appointmentId,
    userId,
    archiveData
  );
}

/* ==========================================================
   SOFT DELETE GENÉRICO
   ========================================================== */
export async function softDeleteItem(
  collection: "medications" | "habits" | "appointments",
  itemId: string,
  userId: string,
  itemData?: any
): Promise<void> {
  switch (collection) {
    case "medications":
      return archiveMedication(userId, itemId, itemData);
    case "habits":
      return archiveHabit(userId, itemId, itemData);
    case "appointments":
      return archiveAppointment(userId, itemId, itemData);
  }
}

/* ==========================================================
   RESTAURAR ITEM ARCHIVADO
   ========================================================== */
export async function restoreItem(
  collection: "medications" | "habits" | "appointments",
  itemId: string,
  userId: string
): Promise<void> {
  const now = new Date().toISOString();

  const restoreData = {
    isArchived: false,
    archivedAt: null,
    updatedAt: now,
  };

  // PRIMERO: Actualizar cache local
  await syncQueueService.updateItemInCache(
    collection,
    userId,
    itemId,
    restoreData
  );

  // SEGUNDO: Encolar para Firestore
  await syncQueueService.enqueue(
    "UPDATE",
    collection,
    itemId,
    userId,
    restoreData
  );


}

/* ==========================================================
   ELIMINACIÓN PERMANENTE 
   ========================================================== */
export async function hardDeleteItem(
  collection: "medications" | "habits" | "appointments",
  itemId: string,
  userId: string
): Promise<void> {
  //  CANCELAR ALARMAS ANTES DE ELIMINAR
  const currentData = await syncQueueService.getItemFromCache(
    collection,
    userId,
    itemId
  );

  if (currentData?.currentAlarmId) {
    await cancelItemAlarms(itemId, userId, currentData.currentAlarmId);
  } else {
    await cancelItemAlarms(itemId, userId, null);
  }

  //  PRIMERO: Eliminar del cache local
  await syncQueueService.removeItemFromCache(collection, userId, itemId);

  //  SEGUNDO: Encolar eliminación para Firestore
  await syncQueueService.enqueue("DELETE", collection, itemId, userId, {});
}

/* ==========================================================
   VERIFICAR SI UN ITEM ESTÁ ARCHIVADO
   ========================================================== */
export async function isItemArchived(
  collection: "medications" | "habits" | "appointments",
  itemId: string,
  userId: string
): Promise<boolean> {
  try {
    const itemData = await syncQueueService.getItemFromCache(
      collection,
      userId,
      itemId
    );

    if (!itemData) return false;

    return itemData.isArchived === true || !!itemData.archivedAt;
  } catch (error) {
    return false;
  }
}

/* ==========================================================
   CANCELAR ALARMA SI ITEM ESTÁ ARCHIVADO

   ========================================================== */
export async function cancelAlarmIfArchived(
  collection: "medications" | "habits",
  itemId: string,
  userId: string,
  alarmId?: string
): Promise<boolean> {
  try {
    const isArchived = await isItemArchived(collection, itemId, userId);

    if (isArchived) {
      await cancelItemAlarms(itemId, userId, alarmId);
      return true; // Indica que la alarma fue cancelada porque el item está archivado
    }

    return false; // Item activo, alarma válida
  } catch (error) {
    return false;
  }
}

/* ==========================================================
    OBTENER ITEMS ARCHIVADOS
   ========================================================== */
export async function getArchivedItems(
  collection: "medications" | "habits" | "appointments",
  userId: string
): Promise<any[]> {
  return syncQueueService.getArchivedItems(collection, userId);
}

/* ==========================================================
    OBTENER ITEMS ACTIVOS 
   ========================================================== */
export async function getActiveItems(
  collection: "medications" | "habits" | "appointments",
  userId: string
): Promise<any[]> {
  return syncQueueService.getActiveItems(collection, userId);
}
