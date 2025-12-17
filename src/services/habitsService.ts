// src/services/habitsService.ts


import { db } from "../config/firebaseConfig";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { syncQueueService } from "./offline";

// ============================================================
//                    TIPOS DE HÁBITO
// ============================================================

export interface HabitWithArchive {
  id?: string;
  name: string;
  icon?: string;
  lib?: "MaterialIcons" | "FontAwesome5";
  priority?: "baja" | "normal" | "alta";
  days?: number[]; // [0=L, 1=M, ..., 6=D]
  times?: string[]; // ["08:00", "14:00"]
  isArchived?: boolean;
  archivedAt?: string;
  createdAt?: any;
  updatedAt?: any;
  // 🆕 Campos para alarmas pospuestas
  currentAlarmId?: string | null;
  snoozeCount?: number;
  snoozedUntil?: Date | null;
  lastSnoozeAt?: Date | null;
}

// ============================================================
//                    FUNCIONES CRUD
// ============================================================

/**
 * CREAR hábito (con soporte offline)
 */
export async function createHabit(
  userId: string,
  data: HabitWithArchive
): Promise<string> {
  const tempId = `temp_${Date.now()}_${Math.random()
    .toString(36)
    .substr(2, 9)}`;

  const habitData = {
    ...data,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isArchived: false,
    _createdLocally: true,
  };

  await syncQueueService.enqueue("CREATE", "habits", tempId, userId, habitData);

  return tempId;
}

/**
 * ACTUALIZAR hábito (con soporte offline)
 */
export async function updateHabit(
  userId: string,
  habitId: string,
  data: Partial<HabitWithArchive>
): Promise<void> {
  const updateData = {
    ...data,
    updatedAt: new Date().toISOString(),
  };

  await syncQueueService.enqueue(
    "UPDATE",
    "habits",
    habitId,
    userId,
    updateData
  );
}

/**
 * ARCHIVAR hábito (con soporte offline)
 */
export async function archiveHabit(
  userId: string,
  habitId: string
): Promise<void> {
  await updateHabit(userId, habitId, {
    isArchived: true,
    archivedAt: new Date().toISOString(),
  });
}

/**
 *  ELIMINAR hábito (con soporte offline)
 */
export async function deleteHabit(
  userId: string,
  habitId: string
): Promise<void> {
  await syncQueueService.enqueue("DELETE", "habits", habitId, userId, {});
}

// ============================================================
//              FUNCIONES DE LECTURA (CON CACHE)
// ============================================================

/**
 *  Escuchar hábitos activos en tiempo real (con fallback a cache local)
 */
export function listenActiveHabits(
  userId: string,
  onChange: (habits: HabitWithArchive[]) => void,
  onError?: (error: any) => void
): () => void {
  // Primero cargar datos locales
  loadLocalHabits(userId).then((localHabits) => {
    if (localHabits.length > 0) {
      onChange(localHabits);
    }
  });

  // Luego escuchar cambios en Firestore
  const habitsRef = collection(db, "users", userId, "habits");
  const q = query(habitsRef, where("isArchived", "==", false));

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const habits: HabitWithArchive[] = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          snoozedUntil: data.snoozedUntil?.toDate?.() || null,
          lastSnoozeAt: data.lastSnoozeAt?.toDate?.() || null,
        } as HabitWithArchive;
      });

      // Ordenar por prioridad y nombre
      const sorted = habits.sort((a, b) => {
        const priorityOrder = { alta: 0, normal: 1, baja: 2 };
        const aPriority = priorityOrder[a.priority || "normal"];
        const bPriority = priorityOrder[b.priority || "normal"];

        if (aPriority !== bPriority) {
          return aPriority - bPriority;
        }

        return (a.name || "").localeCompare(b.name || "");
      });

      onChange(sorted);

      const habitsWithId = sorted.filter(
        (habit): habit is HabitWithArchive & { id: string } => !!habit.id
      );
      syncQueueService.saveToCache("habits", userId, habitsWithId);
    },
    (error) => {


      // Si hay error, cargar desde cache local
      loadLocalHabits(userId).then((localHabits) => {
        if (localHabits.length > 0) {

          onChange(localHabits);
        }
      });

      onError?.(error);
    }
  );

  return unsubscribe;
}

/**
 *  Cargar hábitos desde cache local
 */
async function loadLocalHabits(userId: string): Promise<HabitWithArchive[]> {
  try {
    const cached = await syncQueueService.getFromCache<any>("habits", userId);
    const localData = cached?.data || [];

    const habits = localData
      .filter((habit: any) => !habit.isArchived)
      .map((habit: any) => ({
        ...habit,
        snoozedUntil: habit.snoozedUntil ? new Date(habit.snoozedUntil) : null,
        lastSnoozeAt: habit.lastSnoozeAt ? new Date(habit.lastSnoozeAt) : null,
      })) as HabitWithArchive[];

    // Ordenar por prioridad
    return habits.sort((a, b) => {
      const priorityOrder: Record<string, number> = {
        alta: 0,
        normal: 1,
        baja: 2,
      };
      const aPriority = priorityOrder[a.priority || "normal"] ?? 1;
      const bPriority = priorityOrder[b.priority || "normal"] ?? 1;

      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }

      return (a.name || "").localeCompare(b.name || "");
    });
  } catch (error) {

    return [];
  }
}

/**
 * Obtener un hábito por ID (con fallback a cache)
 */
export async function getHabitById(
  userId: string,
  habitId: string
): Promise<HabitWithArchive | null> {
  try {
    const { doc, getDoc } = await import("firebase/firestore");
    const docRef = doc(db, "users", userId, "habits", habitId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        snoozedUntil: data.snoozedUntil?.toDate?.() || null,
        lastSnoozeAt: data.lastSnoozeAt?.toDate?.() || null,
      } as HabitWithArchive;
    }

    // Fallback a cache local
    const localData = await syncQueueService.getItemFromCache(
      "habits",
      userId,
      habitId
    );

    if (localData) {
      return {
        ...localData,
        id: habitId,
        snoozedUntil: (localData as any).snoozedUntil
          ? new Date((localData as any).snoozedUntil)
          : null,
        lastSnoozeAt: (localData as any).lastSnoozeAt
          ? new Date((localData as any).lastSnoozeAt)
          : null,
      } as HabitWithArchive;
    }

    return null;
  } catch (error) {


    // Fallback a cache local
    const localData = await syncQueueService.getLocalData(
      "habits",
      habitId,
      userId
    );

    if (localData) {
      return {
        id: habitId,
        ...localData,
        snoozedUntil: localData.snoozedUntil
          ? new Date(localData.snoozedUntil)
          : null,
        lastSnoozeAt: localData.lastSnoozeAt
          ? new Date(localData.lastSnoozeAt)
          : null,
      } as HabitWithArchive;
    }

    return null;
  }
}

// Exportar por defecto
export default {
  createHabit,
  updateHabit,
  archiveHabit,
  deleteHabit,
  listenActiveHabits,
  getHabitById,
};
