// src/hooks/useHome.ts
// 🪝 Hook base para HomeScreen: toda la lógica fuera de la pantalla

import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert } from "react-native";
import NetInfo from "@react-native-community/netinfo";

import { auth } from "../config/firebaseConfig";
import { offlineAuthService } from "../services/offline/OfflineAuthService";
import { syncQueueService } from "../services/offline/SyncQueueService";

// Si ya tienes OfflineContext, puedes usarlo en vez de NetInfo directamente:
// import { useOffline } from "../context/OfflineContext";

type HomeRouteParams = {
  patientUid?: string;
  patientName?: string;
};

export function useHome(args?: { routeParams?: HomeRouteParams }) {
  const params = args?.routeParams ?? {};

  // ⚙️ Identidad
  const loggedUserUid =
    auth.currentUser?.uid || offlineAuthService.getCurrentUid();
  const ownerUid = params.patientUid ?? loggedUserUid ?? null;

  const isCaregiverView =
    !!params.patientUid && params.patientUid !== loggedUserUid;
  const canModify = ownerUid === loggedUserUid;

  // 🌐 Offline / pending ops
  const [isOnline, setIsOnline] = useState(true);
  const [pendingChanges, setPendingChanges] = useState(0);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const online =
        state.isConnected === true && state.isInternetReachable !== false;
      setIsOnline(online);

      if (online) {
        syncQueueService.processQueue().then(() => {
          syncQueueService.getPendingCount().then(setPendingChanges);
        });
      }
    });

    syncQueueService.getPendingCount().then(setPendingChanges);
    return () => unsubscribe();
  }, []);

  // ✅ Permisos (si Home tiene acciones para editar/crear cosas)
  const checkModifyPermissions = useCallback(
    (action: string) => {
      if (!canModify) {
        Alert.alert("Solo lectura", `No puedes ${action} desde tu sesión.`);
        return false;
      }
      return true;
    },
    [canModify]
  );

  /**
   * 👇 Aquí van los “controllers” reales del Home:
   * - cargar data para cards/contadores (meds today, próximas citas, hábitos activos, etc.)
   * - refrescar cache al focus
   * - handlers de navegación
   *
   * Como no tengo tu HomeScreen, dejo placeholders.
   */
  const [loading, setLoading] = useState(false);

  // ejemplo: contadores
  const [counts, setCounts] = useState({
    medsToday: 0,
    upcomingAppointments: 0,
    activeHabits: 0,
  });

  const refresh = useCallback(async () => {
    if (!ownerUid) return;
    try {
      setLoading(true);

      // TODO: aquí llamas tus services/hook existentes para obtener datos
      // Ejemplos (si ya los tienes):
      // const meds = await medsService.getActiveMedsFromCache(ownerUid);
      // const appts = await appointmentsService.getFromCache(ownerUid);
      // const habits = await habitsService.getActiveFromCache(ownerUid);

      // setCounts({ medsToday: meds.length, upcomingAppointments: ..., activeHabits: ... });
    } finally {
      setLoading(false);
    }
  }, [ownerUid]);

  return useMemo(
    () => ({
      // auth/permissions
      ownerUid,
      loggedUserUid,
      canModify,
      isCaregiverView,

      // offline
      isOnline,
      pendingChanges,

      // state
      loading,
      counts,

      // actions
      refresh,
      checkModifyPermissions,
      setCounts, // por si necesitas actualizar desde algún callback
    }),
    [
      ownerUid,
      loggedUserUid,
      canModify,
      isCaregiverView,
      isOnline,
      pendingChanges,
      loading,
      counts,
      refresh,
      checkModifyPermissions,
    ]
  );
}
