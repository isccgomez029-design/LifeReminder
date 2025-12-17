// src/services/alarmValidator.ts


import { syncQueueService } from "./offline/SyncQueueService";
import { offlineAlarmService } from "./offline/OfflineAlarmService";
import { offlineAuthService } from "./offline/OfflineAuthService";


export async function shouldShowAlarm(
  notificationData: any
): Promise<{ shouldShow: boolean; reason?: string }> {
  try {
    const params = notificationData?.params || notificationData || {};
    const { type, medId, habitId, ownerUid: paramOwnerUid } = params;

    // Obtener ownerUid de forma offline-first
    const ownerUid = paramOwnerUid || offlineAuthService.getCurrentUid();

    if (!ownerUid) {

      return { shouldShow: true };
    }

    let itemId: string | null = null;
    let collection: "medications" | "habits" | null = null;

    if (type === "med" && medId) {
      itemId = medId;
      collection = "medications";
    } else if (type === "habit" && habitId) {
      itemId = habitId;
      collection = "habits";
    }

    // Si no hay item identificable, permitir mostrar
    if (!itemId || !collection) {

      return { shouldShow: true };
    }


    const itemData = await syncQueueService.getItemFromCache(
      collection,
      ownerUid,
      itemId
    );

    if (!itemData) {

      return { shouldShow: true };
    }

    // Verificar estado de archivo
    if (itemData.isArchived === true || !!itemData.archivedAt) {

      // Cancelar todas las alarmas futuras de este item usando el servicio offline
      await offlineAlarmService.cancelAllAlarmsForItem(itemId, ownerUid);

      return {
        shouldShow: false,
        reason: "El item está archivado",
      };
    }

    // Item activo, mostrar alarma
    return { shouldShow: true };
  } catch (error) {

    return { shouldShow: true };
  }
}


export async function cleanupArchivedItemAlarms(
  userId?: string
): Promise<void> {
  try {


    // Obtener userId de forma offline-first
    const ownerUid = userId || offlineAuthService.getCurrentUid();
    if (!ownerUid) {

      return;
    }

    // Obtener todas las alarmas del servicio offline
    const allAlarms = await offlineAlarmService.getAllAlarms();

    // Filtrar solo las alarmas del usuario actual
    const userAlarms = allAlarms.filter((alarm) => alarm.ownerUid === ownerUid);

    let cancelledCount = 0;

    for (const alarm of userAlarms) {
      const collection = alarm.type === "med" ? "medications" : "habits";

      try {
        // Verificar si está archivado (100% desde cache local)
        const itemData = await syncQueueService.getItemFromCache(
          collection,
          ownerUid,
          alarm.itemId
        );

        if (itemData?.isArchived === true || !!itemData?.archivedAt) {
          await offlineAlarmService.cancelAlarm(alarm.id);
          cancelledCount++;

        }
      } catch (checkErr) {

      }
    }


  } catch (error) {

  }
}

/**
 * Limpia alarmas vencidas (que ya deberían haber sonado hace más de 1 hora)
 */
export async function cleanupExpiredAlarms(): Promise<void> {
  try {
    const count = await offlineAlarmService.cleanupExpiredAlarms();
    if (count > 0) {

    }
  } catch (error) {

  }
}

/**
 * Función de mantenimiento general (llamar al iniciar la app)
 */
export async function performAlarmMaintenance(): Promise<void> {
  const userId = offlineAuthService.getCurrentUid();
  if (!userId) return;

  // Limpiar alarmas vencidas
  await cleanupExpiredAlarms();

  // Limpiar alarmas de items archivados
  await cleanupArchivedItemAlarms(userId);


}
