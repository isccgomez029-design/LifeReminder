// src/hooks/useAlarmScreen.ts

import { useEffect, useRef, useState } from "react";
import { Animated, Vibration } from "react-native";
import { Audio } from "expo-av";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../navigation/StackNavigator";

import alarmService, {
  AlarmParams,
  SNOOZE_LIMIT,
  waitForPersistence,
  completeAlarm,
  snoozeAlarm,
  dismissAlarm,
} from "../services/alarmService";

type Nav = StackNavigationProp<RootStackParamList, "Alarm">;

const VIBRATION_PATTERN = [0, 400, 200, 400, 200, 400];
// Patrón de vibración: pausa inicial y vibraciones intermitentes

export function useAlarmScreen(params: AlarmParams) {
  const navigation = useNavigation<Nav>(); // Hook de navegación para cerrar la pantalla

  const [sound, setSound] = useState<Audio.Sound | null>(null);
  // Estado que mantiene la instancia del sonido de la alarma

  const pulseAnim = useRef(new Animated.Value(1)).current;
  // Valor animado para el efecto de “pulso” en la UI

  const [snoozeCount, setSnoozeCount] = useState<number>(
    params.snoozeCount || 0
  );
  // Contador de veces que la alarma ha sido pospuesta

  const isProcessingRef = useRef(false);
  // Flag para evitar que el usuario ejecute varias acciones al mismo tiempo

  // ===== Sound =====
  useEffect(() => {
    let isMounted = true; // Controla si el componente sigue montado
    let loadedSound: Audio.Sound | null = null; // Referencia local al sonido cargado

    async function loadSound() {
      try {
        // Carga el archivo de sonido de la alarma
        const { sound: s } = await Audio.Sound.createAsync(
          require("../../assets/alarm_sound.mp3"), // Archivo de sonido
          { isLooping: true, volume: 1 } // Sonido en loop y volumen máximo
        );

        if (isMounted) {
          loadedSound = s; // Guarda referencia
          setSound(s); // Guarda sonido en estado
          await s.playAsync(); // Reproduce la alarma
        } else {
          // Si el componente se desmontó antes de terminar
          await s.unloadAsync();
        }
      } catch {
        // Fallo silencioso: la app no se rompe si el sonido falla
      }
    }

    loadSound(); // Ejecuta la carga del sonido al montar

    return () => {
      // Cleanup al desmontar
      isMounted = false;
      if (loadedSound) {
        loadedSound.stopAsync().catch(() => {}); // Detiene sonido
        loadedSound.unloadAsync().catch(() => {}); // Libera recursos
      }
    };
  }, []);

  // ===== Vibration =====
  useEffect(() => {
    Vibration.vibrate(VIBRATION_PATTERN, true);
    // Inicia vibración continua usando el patrón definido

    return () => Vibration.cancel();
    // Detiene la vibración al desmontar
  }, []);

  // ===== Pulse animation =====
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15, // Escala hacia arriba
          duration: 600, // Duración del efecto
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1, // Regresa al tamaño original
          duration: 600,
          useNativeDriver: true,
        }),
      ])
    );

    pulse.start(); // Inicia animación en loop
    return () => pulse.stop(); // Detiene animación al desmontar
  }, [pulseAnim]);

  const stopAlarm = async () => {
    // Detiene sonido y vibración de la alarma
    try {
      Vibration.cancel(); // Cancela vibración
      if (sound) {
        await sound.stopAsync().catch(() => {}); // Detiene sonido
        await sound.unloadAsync().catch(() => {}); // Libera recursos de audio
      }
    } catch {
      // no-op
    }
  };

  const closeScreen = () => {
    // Cierra la pantalla de alarma
    if (navigation.canGoBack()) {
      navigation.goBack(); // Regresa a la pantalla anterior
    } else {
      // Si no hay historial, reinicia navegación a la pantalla principal
      navigation.reset({
        index: 0,
        routes: [{ name: "MainTabs" as any }],
      });
    }
  };

  const onComplete = async () => {
    // Acción cuando el usuario marca la alarma como completada
    if (isProcessingRef.current) return; // Evita doble ejecución
    isProcessingRef.current = true;

    await stopAlarm(); // Detiene sonido y vibración

    try {
      // Marca la alarma como completada en el sistema
      await completeAlarm({ ...params, snoozeCount });
      await waitForPersistence(); // Espera a que se guarden los cambios
    } catch {
      // no-op
    } finally {
      isProcessingRef.current = false; // Libera el lock
      closeScreen(); // Cierra la pantalla
    }
  };

  const onSnooze = async (minutes: number) => {
    // Acción para posponer la alarma
    if (isProcessingRef.current) return; // Evita ejecuciones múltiples
    isProcessingRef.current = true;

    const newCount = snoozeCount + 1; // Incrementa contador de snooze
    setSnoozeCount(newCount); // Actualiza estado

    await stopAlarm(); // Detiene sonido y vibración

    try {
      // Reprograma la alarma con minutos extra
      await snoozeAlarm(
        { ...params, snoozeCount: newCount },
        minutes,
        newCount
      );
      await waitForPersistence(); // Espera persistencia
    } catch {
      // no-op
    } finally {
      isProcessingRef.current = false; // Libera lock
      closeScreen(); // Cierra pantalla
    }
  };

  const onDismiss = async () => {
    // Acción para descartar la alarma sin completar
    if (isProcessingRef.current) return; // Evita doble ejecución
    isProcessingRef.current = true;

    await stopAlarm(); // Detiene sonido y vibración

    try {
      // Marca la alarma como descartada
      await dismissAlarm({ ...params, snoozeCount });
      await waitForPersistence(); // Espera persistencia
    } catch {
      // no-op
    } finally {
      isProcessingRef.current = false; // Libera lock
      closeScreen(); // Cierra pantalla
    }
  };

  return {
    pulseAnim, // Valor animado para UI
    snoozeCount, // Número actual de snoozes
    SNOOZE_LIMIT, // Límite máximo de snoozes permitido
    onComplete, // Handler para completar alarma
    onSnooze, // Handler para posponer alarma
    onDismiss, // Handler para descartar alarma
  };
}

export default useAlarmScreen;
