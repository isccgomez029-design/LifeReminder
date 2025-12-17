// src/hooks/useHabits.ts
//  Hook: lógica de NewReminderScreen (cache + Firestore + offline + acciones)

import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { useFocusEffect, RouteProp } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";

import { RootStackParamList } from "../navigation/StackNavigator";
import { offlineAuthService } from "../services/offline/OfflineAuthService";
import { auth, db } from "../config/firebaseConfig";
import { collection, query, onSnapshot, orderBy } from "firebase/firestore";

import { type HabitWithArchive } from "../services/habitsService";
import { syncQueueService } from "../services/offline/SyncQueueService";
import { archiveHabit } from "../utils/archiveHelpers";

type Nav = StackNavigationProp<RootStackParamList, "NewReminder">;
type Route = RouteProp<RootStackParamList, "NewReminder">;

export function useHabits(args: { navigation: Nav; route: Route }) {
  const { navigation, route } = args;

  const [habits, setHabits] = useState<HabitWithArchive[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [isOnline, setIsOnline] = useState(true);
  const [pendingChanges, setPendingChanges] = useState(0);
  const [loading, setLoading] = useState(true);

  // 🔑 dueño real (paciente o usuario logueado)
  const loggedUserUid =
    auth.currentUser?.uid || offlineAuthService.getCurrentUid();
  const ownerUid = route.params?.patientUid ?? loggedUserUid ?? null;

  const isCaregiverView =
    !!route.params?.patientUid && route.params.patientUid !== loggedUserUid;

  const canModify = ownerUid === loggedUserUid;

  const selectedHabit = useMemo(
    () => habits.find((h) => h.id === selectedId),
    [habits, selectedId]
  );

  const reloadFromCache = useCallback(async () => {
    if (!ownerUid) return;

    try {
      const cached = await syncQueueService.getFromCache<any>(
        "habits",
        ownerUid
      );
      if (cached?.data && cached.data.length > 0) {
        const items = cached.data.filter(
          (h: any) => !h.isArchived
        ) as HabitWithArchive[];
        setHabits(items);
      }
    } catch {
      // no-op
    }
  }, [ownerUid]);

  //  refrescar cache cuando vuelves a la pantalla
  useFocusEffect(
    useCallback(() => {
      reloadFromCache();
    }, [reloadFromCache])
  );

  // ================== CONNECTIVITY MONITOR ==================
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

  // ================== Cargar hábitos (cache → Firestore) ==================
  useEffect(() => {
    const userId = ownerUid;
    if (!userId) {
      setLoading(false);
      return;
    }

    let isMounted = true;
    let unsubscribe: (() => void) | null = null;

    const start = async () => {
      try {
        setLoading(true);

        // 1) cache primero
        const cached = await syncQueueService.getFromCache<any>(
          "habits",
          userId
        );
        if (cached?.data && isMounted) {
          const processed = cached.data
            .filter((h: any) => !h.isArchived)
            .map((data: any) => ({
              id: data.id,
              name: data.name || "",
              icon: data.icon,
              lib: data.lib,
              priority: data.priority,
              days: data.days || [],
              times: data.times || [],
              isArchived: data.isArchived,
              archivedAt: data.archivedAt,
            })) as HabitWithArchive[];

          setHabits(processed);
          setLoading(false);
        }

        // 2) Firestore listener (si falla, cache ya está)
        const habitsRef = collection(db, "users", userId, "habits");

        // Si quieres ordenar por nombre en server, puedes usar orderBy("name")
        // (si no tienes índice, quítalo). Te lo dejo seguro:
        const q = query(habitsRef);

        unsubscribe = onSnapshot(
          q,
          async (snapshot) => {
            if (!isMounted) return;

            const items = snapshot.docs.map((d) => ({
              id: d.id,
              ...d.data(),
            }));

            await syncQueueService.saveToCache("habits", userId, items);

            const merged = await syncQueueService.getFromCache<any>(
              "habits",
              userId
            );
            if (!merged?.data) return;

            const finalHabits = merged.data.filter(
              (h: any) => !h.isArchived
            ) as HabitWithArchive[];

            setHabits(finalHabits);
            setLoading(false);
          },
          () => {
            if (!isMounted) return;
            setLoading(false);
          }
        );
      } catch {
        if (isMounted) setLoading(false);
      }
    };

    start();

    return () => {
      isMounted = false;
      if (unsubscribe) unsubscribe();
    };
  }, [ownerUid]);

  const onAdd = useCallback(() => {
    if (!canModify) {
      Alert.alert(
        "Solo lectura",
        "No puedes crear hábitos para este paciente desde tu sesión."
      );
      return;
    }

    navigation.navigate("AddHabit", {
      mode: "new",
      patientUid: ownerUid ?? undefined,
    } as any);
  }, [canModify, navigation, ownerUid]);

  const onEdit = useCallback(() => {
    if (!selectedHabit || !selectedHabit.id) {
      Alert.alert("Selecciona un hábito", "Toca un hábito primero.");
      return;
    }

    if (!canModify) {
      Alert.alert(
        "Solo lectura",
        "No puedes editar hábitos para este paciente desde tu sesión."
      );
      return;
    }

    navigation.navigate("AddHabit", {
      mode: "edit",
      habit: selectedHabit,
      patientUid: ownerUid ?? undefined,
    } as any);
  }, [canModify, navigation, ownerUid, selectedHabit]);

  const onArchive = useCallback(() => {
    if (!selectedId) {
      Alert.alert("Selecciona un hábito", "Toca un hábito primero.");
      return;
    }

    if (!canModify) {
      Alert.alert("Solo lectura", "No puedes eliminar hábitos.");
      return;
    }

    const habitId = selectedId;
    const habit = habits.find((h) => h.id === habitId);
    const habitName = habit?.name ?? "este hábito";

    Alert.alert(
      "Archivar hábito",
      `¿Seguro que quieres archivar "${habitName}"?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Archivar",
          style: "destructive",
          onPress: async () => {
            try {
              if (!ownerUid) return;

              // Optimistic UI
              setHabits((prev) => prev.filter((h) => h.id !== habitId));
              setSelectedId(null);

              // ✅ Encola UPDATE isArchived + cache merge
              await archiveHabit(ownerUid, habitId, habit);

              setPendingChanges(await syncQueueService.getPendingCount());

              Alert.alert(
                "¡Listo!",
                isOnline
                  ? "Hábito archivado."
                  : "Se sincronizará cuando haya conexión."
              );
            } catch (e: any) {
              Alert.alert("Error", e?.message ?? "Intenta nuevamente.");
              // rollback UI
              if (habit) setHabits((prev) => [...prev, habit]);
            }
          },
        },
      ]
    );
  }, [selectedId, canModify, habits, ownerUid, isOnline]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedId((prev) => (prev === id ? null : id));
  }, []);

  return useMemo(
    () => ({
      // state
      habits,
      selectedId,
      selectedHabit,
      loading,
      isOnline,
      pendingChanges,

      // permissions
      ownerUid,
      canModify,
      isCaregiverView,

      // actions
      toggleSelect,
      onAdd,
      onEdit,
      onArchive,
    }),
    [
      habits,
      selectedId,
      selectedHabit,
      loading,
      isOnline,
      pendingChanges,
      ownerUid,
      canModify,
      isCaregiverView,
      toggleSelect,
      onAdd,
      onEdit,
      onArchive,
    ]
  );
}
