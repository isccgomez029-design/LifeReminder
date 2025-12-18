// App.tsx
import React, { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as Notifications from "expo-notifications";
import NetInfo from "@react-native-community/netinfo";

import StackNavigator from "./src/navigation/StackNavigator";
import { configureNotificationPermissions } from "./src/services/Notifications";
import { navigationRef } from "./src/navigation/navigationRef";

// Servicios Offline
import { offlineAuthService } from "./src/services/offline/OfflineAuthService";
import { syncQueueService } from "./src/services/offline/SyncQueueService";

//  Contexto de conectividad
import { OfflineProvider } from "./src/context/OfflineContext";
import { auth } from "./src/config/firebaseConfig";
import { offlineAlarmService } from "./src/services/offline/OfflineAlarmService";
import {
  shouldShowAlarm,
  performAlarmMaintenance,
  cleanupArchivedItemAlarms,
} from "./src/services/alarmValidator";
import { AlarmInitializer } from "./src/components/AlarmInitializer";

import type { RootStackParamList } from "./src/navigation/StackNavigator";

const COLORS = {
  primary: "#6366F1",
  background: "#F8FAFC",
  text: "#1E293B",
};

export default function App() {
  const [isInitializing, setIsInitializing] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);

  //  RUTA INICIAL DINÁMICA
  const [initialRoute, setInitialRoute] =
    useState<keyof RootStackParamList>("Login");

  useEffect(() => {
    let isMounted = true;

    const initializeApp = async () => {
      try {
        // Permisos de notificaciones
        await configureNotificationPermissions();

        //  Inicializar auth offline-first
        const cachedUser = await offlineAuthService.initialize();

        //  Inicializar cola offline
        await syncQueueService.initialize();

        //  Inicializar sistema de alarmas
        await offlineAlarmService.initialize();

        await performAlarmMaintenance();

        //  DECISIÓN DE ARRANQUE
        if (cachedUser) {
          setInitialRoute("Home");
          await syncQueueService.debugCache(cachedUser.uid);
        } else {
          setInitialRoute("Login");
        }

        //  Limpiar alarmas huérfanas
        const userId =
          auth.currentUser?.uid || offlineAuthService.getCurrentUid();

        if (userId) {
          await cleanupArchivedItemAlarms(userId);
        }

        // (solo para forzar evaluación inicial de red)
        await NetInfo.fetch();

        if (isMounted) setIsInitializing(false);
      } catch (error: any) {
        if (isMounted) {
          setInitError(error.message || "Error de inicialización");
          setIsInitializing(false);
        }
      }
    };

    initializeApp();

    // Listener: notificación tocada (background)
    const responseListener =
      Notifications.addNotificationResponseReceivedListener(
        async (response) => {
          const data = response.notification.request.content.data;

          if (data?.screen === "Alarm") {
            const { shouldShow } = await shouldShowAlarm(data);
            if (shouldShow) {
              (navigationRef.current as any)?.navigate("Alarm", data.params);
            }
          }
        }
      );

    // Listener: notificación recibida (foreground)
    const notificationListener = Notifications.addNotificationReceivedListener(
      async (notification) => {
        const data = notification.request.content.data;

        if (data?.screen === "Alarm") {
          const { shouldShow } = await shouldShowAlarm(data);
          if (shouldShow) {
            (navigationRef.current as any)?.navigate("Alarm", data.params);
          }
        }
      }
    );

    // Cleanup
    return () => {
      isMounted = false;
      responseListener.remove();
      notificationListener.remove();
      offlineAuthService.destroy();
      syncQueueService.destroy();
    };
  }, []);

  //  Splash / loading
  if (isInitializing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Cargando LifeReminder...</Text>
      </View>
    );
  }

  //  Error de arranque
  if (initError) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorTitle}>Error de Inicialización</Text>
        <Text style={styles.errorText}>{initError}</Text>
        <Text style={styles.errorHint}>
          Intenta cerrar y volver a abrir la aplicación
        </Text>
      </View>
    );
  }

  // APP NORMAL
  return (
    <OfflineProvider>
      <SafeAreaProvider>
        <NavigationContainer ref={navigationRef}>
          <AlarmInitializer />
          <StackNavigator initialRoute={initialRoute} />
        </NavigationContainer>
      </SafeAreaProvider>
    </OfflineProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.background,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: COLORS.text,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.background,
    padding: 20,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: COLORS.text,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: "#EF4444",
    textAlign: "center",
    marginBottom: 16,
  },
  errorHint: {
    fontSize: 12,
    color: "#64748B",
    textAlign: "center",
  },
});
