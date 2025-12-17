// src/context/OfflineContext.tsx

import React, {
  createContext,
  useContext, 
  useEffect,
  useState, 
  useCallback,
  ReactNode, 
} from "react";
import NetInfo, { NetInfoState } from "@react-native-community/netinfo";
// NetInfo permite detectar cambios de conectividad en React Native

import { syncQueueService } from "../services/offline/SyncQueueService";
// Servicio que maneja la cola de operaciones offline pendientes

interface OfflineContextValue {
  isOnline: boolean; // Indica si el dispositivo tiene conexión a internet
  pendingOperations: number; // Número de operaciones pendientes en la cola offline
  isSyncing: boolean; // Indica si se está sincronizando actualmente
  lastSyncTime: Date | null; // Fecha y hora de la última sincronización exitosa
  syncNow: () => Promise<void>; // Función para forzar la sincronización manual
}

/* =====================================================
   Valores por defecto del contexto
   (se usan si un componente consume el contexto
    fuera del Provider, evitando errores)
===================================================== */

const defaultValue: OfflineContextValue = {
  isOnline: true, // Por defecto se asume online
  pendingOperations: 0, // Sin operaciones pendientes
  isSyncing: false, // No está sincronizando
  lastSyncTime: null, // Aún no hay sincronización
  syncNow: async () => {}, // Función vacía por defecto
};

/* Creación del contexto global */

const OfflineContext = createContext<OfflineContextValue>(defaultValue);

/* Props del Provider */

interface OfflineProviderProps {
  children: ReactNode; // Componentes hijos que tendrán acceso al contexto
}

/* Provider del contexto Offline*/

export function OfflineProvider(
  props: OfflineProviderProps
): React.ReactElement {
  /* Estados internos del contexto */

  const [isOnline, setIsOnline] = useState(true); // Estado de conectividad
  const [pendingOperations, setPendingOperations] = useState(0); // Cola pendiente
  const [isSyncing, setIsSyncing] = useState(false); // Estado de sincronización
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null); // Última sync

  /* Función para sincronizar manualmente */

  const syncNow = useCallback(async () => {
    // Evita sincronizar si ya hay un proceso activo o si no hay internet
    if (isSyncing || !isOnline) return;

    setIsSyncing(true); // Marca que la sincronización comenzó
    try {
      // Procesa la cola de operaciones offline (CREATE, UPDATE, DELETE)
      await syncQueueService.processQueue();

      // Obtiene el número actualizado de operaciones pendientes
      const count = await syncQueueService.getPendingCount();
      setPendingOperations(count); // Actualiza el estado

      // Guarda la fecha de la última sincronización exitosa
      setLastSyncTime(new Date());
    } catch {
      // Fallo silencioso: no se rompe la app si algo falla
    } finally {
      setIsSyncing(false); // Finaliza el estado de sincronización
    }
  }, [isSyncing, isOnline]);

  /* Efecto: escuchar cambios de conectividad*/

  useEffect(() => {
    const handleConnectivityChange = (state: NetInfoState) => {
      // Determina si hay conexión real a internet
      const online =
        state.isConnected === true && state.isInternetReachable !== false;

      const wasOffline = !isOnline; // Guarda el estado anterior
      setIsOnline(online); // Actualiza el estado actual

      // Si vuelve la conexión después de estar offline → sincroniza automáticamente
      if (online && wasOffline) {
        syncNow();
      }
    };

    // Se suscribe a cambios de red
    const unsubscribe = NetInfo.addEventListener(handleConnectivityChange);

    // Verificación inicial del estado de conexión
    NetInfo.fetch().then(handleConnectivityChange);

    // Limpieza del listener al desmontar
    return () => unsubscribe();
  }, [isOnline, syncNow]);

  /* Efecto: actualizar periódicamente operaciones pendientes*/

  useEffect(() => {
    const updatePending = async () => {
      try {
        // Consulta cuántas operaciones siguen pendientes
        const count = await syncQueueService.getPendingCount();
        setPendingOperations(count); // Actualiza el estado
      } catch {
        // Fallo silencioso
      }
    };

    updatePending(); // Actualización inicial

    // Actualiza cada 5 segundos
    const interval = setInterval(updatePending, 5000);

    // Limpieza del intervalo al desmontar
    return () => clearInterval(interval);
  }, []);

  /*  Valor que se expone a los componentes hijos*/

  const value: OfflineContextValue = {
    isOnline, // Estado de conectividad
    pendingOperations, // Operaciones pendientes
    isSyncing, // Estado de sincronización
    lastSyncTime, // Última sincronización
    syncNow, // Función para forzar sincronización
  };

  /*  Render del Provider*/

  return React.createElement(
    OfflineContext.Provider, // Provider del contexto
    { value: value }, // Valor expuesto
    props.children // Componentes hijos
  );
}

/*  Hook para consumir TODO el contexto*/

export function useOffline(): OfflineContextValue {
  return useContext(OfflineContext); // Devuelve el contexto completo
}

/* Hook simplificado para solo saber si hay internet*/

export function useIsOnline(): boolean {
  const { isOnline } = useOffline(); // Extrae solo isOnline
  return isOnline;
}

export default OfflineContext;
