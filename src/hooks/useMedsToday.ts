// src/hooks/useMedsToday.ts
// 🪝 Controlador de MedsToday: carga cache + escucha Firestore (si online) + acciones

import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";

import { RootStackParamList } from "../navigation/StackNavigator";
import { offlineAuthService } from "../services/offline/OfflineAuthService";
import { auth } from "../config/firebaseConfig";
import { useOffline } from "../context/OfflineContext";

import medsService, { Medication } from "../services/medsService";

type Nav = StackNavigationProp<RootStackParamList, "MedsToday">;

type RouteParams = {
  patientUid?: string;
  patientName?: string;
};

export function useMedsToday(args: {
  navigation: Nav;
  routeParams?: RouteParams;
}) {
  const { navigation, routeParams } = args;
  const params = routeParams ?? {};

  const initialPatientName =
    typeof params.patientName === "string" ? params.patientName : "";

  const [patientName] = useState<string>(initialPatientName);

  const [meds, setMeds] = useState<Array<Medication & { id: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMedId, setSelectedMedId] = useState<string | null>(null);

  const [now, setNow] = useState<Date>(new Date());
  const hasSelection = !!selectedMedId;

  const { isOnline, pendingOperations } = useOffline();

  const loggedUserUid =
    auth.currentUser?.uid || offlineAuthService.getCurrentUid();
  const ownerUid = params.patientUid ?? loggedUserUid ?? null;

  const isCaregiverView =
    !!params.patientUid && params.patientUid !== loggedUserUid;
  const canModify = ownerUid === loggedUserUid;

  const checkModifyPermissions = useCallback(
    (action: string): boolean => {
      if (!canModify) {
        Alert.alert(
          "Sin permisos",
          `Solo el paciente puede ${action} medicamentos.`
        );
        return false;
      }
      return true;
    },
    [canModify]
  );

  // Tick para cálculos de "tomada"
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 10000);
    return () => clearInterval(id);
  }, []);

  const reloadFromCache = useCallback(async () => {
    if (!ownerUid) return;
    try {
      const list = await medsService.getActiveMedsFromCache(ownerUid);
      const withId = list.filter(
        (m): m is Medication & { id: string } => !!m.id
      ) as any;
      setMeds(withId);
    } catch {
      // no-op
    }
  }, [ownerUid]);

  // ✅ Siempre que entras a la pantalla, refresca cache (offline-first)
  useFocusEffect(
    useCallback(() => {
      reloadFromCache();
    }, [reloadFromCache])
  );

  // ✅ Suscripción Firestore solo si online
  useEffect(() => {
    if (!ownerUid) {
      setLoading(false);
      return;
    }

    let mounted = true;
    let unsubscribe: null | (() => void) = null;

    const start = async () => {
      try {
        setLoading(true);

        // 1) Mostrar cache primero (si hay)
        await reloadFromCache();
        if (!mounted) return;

        // 2) Si no hay internet, terminar aquí
        if (!isOnline) {
          setLoading(false);
          return;
        }

        // 3) Firestore real-time
        unsubscribe = medsService.subscribeMedicationsFirestore(
          ownerUid,
          (list) => {
            if (!mounted) return;
            const withId = list.filter(
              (m): m is Medication & { id: string } => !!m.id
            ) as any;
            setMeds(withId);
            setLoading(false);
          },
          () => {
            if (!mounted) return;
            setLoading(false);
          }
        );
      } catch {
        if (mounted) setLoading(false);
      }
    };

    start();

    return () => {
      mounted = false;
      if (unsubscribe) unsubscribe();
    };
  }, [ownerUid, isOnline, reloadFromCache]);

  // ✅ Reprogramar alarmas faltantes cuando llega data (solo online)
  useEffect(() => {
    if (!ownerUid) return;
    if (!isOnline) return;
    if (meds.length === 0) return;

    medsService.reprogramMissingAlarms({
      ownerUid,
      meds,
      patientName,
    });
  }, [meds, isOnline, ownerUid, patientName]);

  const selectMed = useCallback((id: string) => {
    setSelectedMedId((prev) => (prev === id ? null : id));
  }, []);

  const isTaken = useCallback(
    (med: Medication) => medsService.isMedTaken(med, now),
    [now]
  );

  const markTaken = useCallback(
    async (med: Medication & { id: string }) => {
      if (!ownerUid) {
        Alert.alert(
          "Error",
          "No se encontró el usuario dueño de estos medicamentos."
        );
        return;
      }
      if (!checkModifyPermissions("registrar la toma")) return;

      if ((med.cantidadActual ?? 0) <= 0) {
        Alert.alert(
          "Sin existencias",
          "Este medicamento ya no tiene cantidad registrada."
        );
        return;
      }

      try {
        const { updatedMed } = await medsService.markMedicationTaken({
          ownerUid,
          med,
          patientName,
        });

        // UI update
        setMeds((prev) => prev.map((m) => (m.id === med.id ? updatedMed : m)));
        setNow(new Date());

        Alert.alert(
          "¡Listo!",
          isOnline
            ? "Se registró la toma."
            : "Se registró la toma (se sincronizará cuando haya conexión)."
        );
      } catch (err) {
        Alert.alert("Error", "No se pudo registrar la toma.");
      }
    },
    [ownerUid, checkModifyPermissions, patientName, isOnline]
  );

  const addMed = useCallback(() => {
    if (!ownerUid) return;
    if (!checkModifyPermissions("agregar")) return;
    navigation.navigate("AddMedication" as any, { patientUid: ownerUid });
  }, [checkModifyPermissions, navigation, ownerUid]);

  const editSelected = useCallback(() => {
    if (!ownerUid) return;
    const med = meds.find((m) => m.id === selectedMedId);
    if (!med) return;
    if (!checkModifyPermissions("editar")) return;

    navigation.navigate("AddMedication" as any, {
      medId: med.id,
      initialData: med,
      patientUid: ownerUid,
    });
  }, [checkModifyPermissions, meds, navigation, ownerUid, selectedMedId]);

  const archiveSelected = useCallback(() => {
    if (!ownerUid) return;

    if (!selectedMedId) {
      Alert.alert("Ups", "Selecciona un medicamento primero.");
      return;
    }

    const med = meds.find((m) => m.id === selectedMedId);
    if (!med) return;

    if (!checkModifyPermissions("archivar")) return;

    Alert.alert(
      "Archivar medicamento",
      `¿Deseas archivar "${med.nombre}"? Podrás restaurarlo después si lo necesitas.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Archivar",
          style: "destructive",
          onPress: async () => {
            try {
              // Optimista UI
              setMeds((prev) => prev.filter((m) => m.id !== selectedMedId));
              setSelectedMedId(null);

              await medsService.archiveMedication(ownerUid, med.id, med);

              Alert.alert(
                "¡Listo!",
                isOnline
                  ? "Medicamento archivado correctamente."
                  : "Se sincronizará cuando haya conexión."
              );
            } catch (err) {

              setMeds((prev) =>
                [...prev, med].sort((a, b) => (a.nombre > b.nombre ? 1 : -1))
              );
              Alert.alert("Error", "No se pudo archivar el medicamento.");
            }
          },
        },
      ]
    );
  }, [ownerUid, selectedMedId, meds, checkModifyPermissions, isOnline]);

  const pendingChanges = pendingOperations;

  return useMemo(
    () => ({
      // state
      loading,
      meds,
      selectedMedId,
      patientName,
      isOnline,
      pendingChanges,

      // permissions
      ownerUid,
      canModify,
      isCaregiverView,
      hasSelection,

      // actions
      selectMed,
      markTaken,
      addMed,
      editSelected,
      archiveSelected,

      // helpers
      isTaken,
    }),
    [
      loading,
      meds,
      selectedMedId,
      patientName,
      isOnline,
      pendingChanges,
      ownerUid,
      canModify,
      isCaregiverView,
      hasSelection,
      selectMed,
      markTaken,
      addMed,
      editSelected,
      archiveSelected,
      isTaken,
    ]
  );
}
