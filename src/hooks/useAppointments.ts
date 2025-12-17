// src/hooks/useAppointments.ts
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Platform } from "react-native";
import NetInfo from "@react-native-community/netinfo";

import { auth } from "../config/firebaseConfig";
import { offlineAuthService } from "../services/offline/OfflineAuthService";
import { syncQueueService } from "../services/offline/SyncQueueService";

import type { Appointment } from "../services/appointmentsService";
import { listenAppointments } from "../services/appointmentsService";

import { deleteAndroidEvent } from "../services/deviceCalendarService";
import { archiveAppointment } from "../utils/archiveHelpers";

// =======================
// Helpers internos (sin archivo extra)
// =======================
const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
const toISO = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function getAppointmentDate(a: Appointment): Date {
  const [y, m, d] = (a.date || "").split("-").map((n) => parseInt(n, 10));
  let hh = 23;
  let mm = 59;

  if (a.time) {
    const [hStr, mStr] = a.time.split(":");
    const h = parseInt(hStr ?? "0", 10);
    const mi = parseInt(mStr ?? "0", 10);
    if (!isNaN(h)) hh = h;
    if (!isNaN(mi)) mm = mi;
  }

  return new Date(y || 1970, (m || 1) - 1, d || 1, hh, mm, 0);
}

function isAppointmentPast(a: Appointment, now: Date): boolean {
  return getAppointmentDate(a).getTime() < now.getTime();
}

function formatApptDateTime(dateISO: string, time?: string | null) {
  const [y, m, d] = (dateISO || "").split("-").map((n) => parseInt(n, 10));
  const baseDate = new Date(y || 1970, (m || 1) - 1, d || 1);

  const datePart = baseDate.toLocaleDateString("es-MX", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });

  if (!time) return datePart;

  const [hh, mm] = time.split(":").map((n) => parseInt(n, 10));
  const withTime = new Date(y || 1970, (m || 1) - 1, d || 1, hh || 0, mm || 0);

  const timePart = withTime.toLocaleTimeString("es-MX", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  return `${datePart} · ${timePart}`;
}

function formatTime12(time?: string | null) {
  if (!time) return "Sin hora";
  const [hh, mm] = time.split(":").map((n) => parseInt(n, 10));
  const d = new Date();
  d.setHours(hh || 0, mm || 0, 0, 0);
  return d.toLocaleTimeString("es-MX", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function getMonthMatrix(year: number, monthIndex0: number) {
  const first = new Date(year, monthIndex0, 1);
  const startWeekIdx = (first.getDay() + 6) % 7; // L=0 ... D=6
  const daysInMonth = new Date(year, monthIndex0 + 1, 0).getDate();
  const prevDays = new Date(year, monthIndex0, 0).getDate();

  const matrix: Date[][] = [];
  let dayCounter = 1;
  let nextMonthDay = 1;

  for (let r = 0; r < 6; r++) {
    const row: Date[] = [];
    for (let c = 0; c < 7; c++) {
      let date: Date;
      const cellIndex = r * 7 + c;

      if (cellIndex < startWeekIdx) {
        const dd = prevDays - (startWeekIdx - cellIndex - 1);
        date = new Date(year, monthIndex0 - 1, dd);
      } else if (dayCounter <= daysInMonth) {
        date = new Date(year, monthIndex0, dayCounter++);
      } else {
        date = new Date(year, monthIndex0 + 1, nextMonthDay++);
      }

      row.push(date);
    }
    matrix.push(row);
  }

  return matrix;
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// =======================
// Hook
// =======================
type Params = {
  navigation: any;
  routeParams?: { patientUid?: string };
};

// Hook central para listar, filtrar y manipular citas (incluye mini-calendario).
export function useAppointments({ navigation, routeParams }: Params) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [selectedApptId, setSelectedApptId] = useState<string | null>(null);

  const [pendingChanges, setPendingChanges] = useState(0);
  const [isOnline, setIsOnline] = useState(true);
  const [loading, setLoading] = useState(true);

  // Mini calendario
  const [showCal, setShowCal] = useState(false);
  const today = new Date();
  const [cursor, setCursor] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1)
  );
  const [selectedDate, setSelectedDate] = useState<Date | null>(today);

  // dueño real
  const loggedUserUid =
    auth.currentUser?.uid || offlineAuthService.getCurrentUid();
  const ownerUid = routeParams?.patientUid ?? loggedUserUid ?? null;
  const isCaregiverView =
    !!routeParams?.patientUid && routeParams.patientUid !== loggedUserUid;
  const canModify = ownerUid === loggedUserUid;

  const reloadFromCache = useCallback(async () => {
    if (!ownerUid) return;
    try {
      const cached = await syncQueueService.getFromCache<any>(
        "appointments",
        ownerUid
      );
      if (cached?.data?.length) {
        const items = (cached.data as any[]).filter(
          (a) => !a?.isArchived
        ) as Appointment[];
        setAppointments(items);
      }
    } catch {
      // no-op
    }
  }, [ownerUid]);

  // Conectividad + cola
  // Mantiene estado online/offline y dispara el procesamiento de la cola al volver internet.
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

  // Listener central (service ya hace cache-first + onSnapshot)
  // Se suscribe a citas del owner y filtra archivadas; controla loading.
  useEffect(() => {
    if (!ownerUid) return;

    setLoading(true);

    const unsub = listenAppointments(
      ownerUid,
      (items) => {
        const filtered = (items as any[]).filter(
          (a) => !a?.isArchived
        ) as Appointment[];
        setAppointments(filtered);
        setLoading(false);
      },
      () => setLoading(false)
    );

    return () => {
      unsub?.();
    };
  }, [ownerUid]);

  const upcomingAppointments = useMemo(() => {
    const now = new Date();
    return appointments.filter((a) => !isAppointmentPast(a, now));
  }, [appointments]);

  useEffect(() => {
    if (!selectedApptId) return;
    const stillExists = upcomingAppointments.some(
      (a) => a.id === selectedApptId
    );
    if (!stillExists) setSelectedApptId(null);
  }, [upcomingAppointments, selectedApptId]);

  const selectedAppt = useMemo(
    () => upcomingAppointments.find((a) => a.id === selectedApptId) ?? null,
    [upcomingAppointments, selectedApptId]
  );

  const monthMatrix = useMemo(
    () => getMonthMatrix(cursor.getFullYear(), cursor.getMonth()),
    [cursor]
  );

  const monthKeyMap = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    upcomingAppointments.forEach((a) => {
      const list = map.get(a.date) ?? [];
      list.push(a);
      map.set(a.date, list);
    });
    return map;
  }, [upcomingAppointments]);

  const selectedISO = selectedDate ? toISO(selectedDate) : "";
  const selectedItems = monthKeyMap.get(selectedISO) ?? [];

  const goPrevMonth = () =>
    setCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  const goNextMonth = () =>
    setCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));

  const toggleSelect = (id?: string) => {
    if (!id) return;
    setSelectedApptId((prev) => (prev === id ? null : id));
  };

  // Navega para crear una nueva cita (con dueño correcto).
  const goAdd = () => {
    navigation.navigate("AddAppointment", {
      mode: "new",
      patientUid: ownerUid ?? undefined,
    } as any);
  };

  // Navega para editar la cita seleccionada.
  const goEdit = () => {
    if (!selectedAppt) {
      Alert.alert("Selecciona una cita", "Toca una cita para poder editarla.");
      return;
    }
    navigation.navigate("AddAppointment", {
      mode: "edit",
      appt: selectedAppt,
      patientUid: ownerUid ?? undefined,
    } as any);
  };

  // Confirmación + eliminación optimista + archivado (usa cola offline si aplica).
  const removeSelected = async () => {
    if (!selectedAppt || !ownerUid) {
      Alert.alert("Selecciona una cita", "Toca una cita para eliminarla.");
      return;
    }

    Alert.alert(
      "Eliminar cita",
      `¿Seguro que quieres eliminar "${selectedAppt.title}"?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            // optimistic
            setAppointments((prev) =>
              prev.filter((a) => a.id !== selectedAppt.id)
            );
            setSelectedApptId(null);

            if (Platform.OS === "android" && selectedAppt.eventId) {
              try {
                await deleteAndroidEvent(selectedAppt.eventId);
              } catch {
                // no-op
              }
            }

            try {
              await archiveAppointment(
                ownerUid,
                selectedAppt.id!,
                selectedAppt as any
              );
              setPendingChanges(await syncQueueService.getPendingCount());

              Alert.alert(
                "¡Listo!",
                isOnline
                  ? "Cita eliminada."
                  : "Se sincronizará cuando haya conexión."
              );
            } catch {
              Alert.alert("Error", "No se pudo eliminar la cita.");
              setAppointments((prev) => [...prev, selectedAppt]);
            }
          },
        },
      ]
    );
  };

  return {
    ownerUid,
    canModify,
    isCaregiverView,

    loading,
    pendingChanges,

    upcomingAppointments,
    selectedApptId,
    selectedAppt,

    showCal,
    setShowCal,
    cursor,
    selectedDate,
    setSelectedDate,
    monthMatrix,
    monthKeyMap,
    selectedItems,
    monthLabel: cursor.toLocaleDateString("es-MX", {
      month: "long",
      year: "numeric",
    }),
    today,
    isSameDay,

    formatApptDateTime,
    formatTime12,
    toISO,

    reloadFromCache,
    toggleSelect,
    goAdd,
    goEdit,
    removeSelected,
    goPrevMonth,
    goNextMonth,
  };
}
