// src/hooks/useAddMedication.ts
// 🪝 Hook controlador para AddMedication: estado + validaciones + submit/delete + imagen

import { useCallback, useMemo, useState } from "react";
import { Alert } from "react-native";
import { StackNavigationProp } from "@react-navigation/stack";

import { RootStackParamList } from "../navigation/StackNavigator";
import medsService from "../services/medsService";
import { auth } from "../config/firebaseConfig";
import { offlineAuthService } from "../services/offline/OfflineAuthService";

import {
  pickImageFromGallery,
  takePhotoWithCamera,
} from "../services/imagePickerService";

type Nav = StackNavigationProp<RootStackParamList, "AddMedication">;

type Params = {
  medId?: string;
  initialData?: any;
  patientUid?: string; // dueño real
};

// persistencia offline-first, alarmas y manejo de imágenes

export function useAddMedication(args: {
  navigation: Nav;
  routeParams?: Params;
}) {
  const { navigation, routeParams } = args; // Extrae navegación y parámetros de ruta
  const params = routeParams ?? {}; // Garantiza objeto params aunque no venga nada

  const medId = params.medId; // ID del medicamento (solo existe en edición)
  const initial = params.initialData; // Datos iniciales del medicamento
  const initialAny: any = initial ?? {}; // Versión flexible para acceder a campos legacy
  const isEdit = !!medId; // True si se está editando un medicamento existente

  // UID del usuario autenticado (online u offline)
  const loggedUid =
    auth.currentUser?.uid || offlineAuthService.getCurrentUid() || "";

  // UID del dueño real del medicamento (paciente)
  const ownerUid = params.patientUid || loggedUid || "";

  // Solo el paciente puede modificar/eliminar medicamentos
  const canModify = ownerUid === loggedUid;

  // ===================== estado de formulario =====================

  const [nombre, setNombre] = useState(initial?.nombre ?? ""); // Nombre del medicamento
  const [frecuencia, setFrecuencia] = useState(initial?.frecuencia ?? ""); // Frecuencia HH:MM
  const [hora, setHora] = useState(initial?.proximaToma ?? ""); // Próxima toma HH:MM

  // Cantidad disponible (stock)
  const [cantidad, setCantidad] = useState(
    initialAny.cantidadActual != null
      ? String(initialAny.cantidadActual) // Prioriza cantidadActual
      : initialAny.cantidad != null
      ? String(initialAny.cantidad) // Fallback legacy
      : ""
  );

  // Cantidad por toma (dosis)
  const [doseAmount, setDoseAmount] = useState(
    initialAny.cantidadPorToma != null
      ? String(initialAny.cantidadPorToma)
      : initialAny.doseAmount != null
      ? String(initialAny.doseAmount)
      : initialAny.dosis
      ? String(initialAny.dosis).match(/\d+/)?.[0] ?? ""
      : ""
  );

  // Unidad de la dosis: tabletas o ml
  const [doseUnit, setDoseUnit] = useState<"tabletas" | "ml">(
    initialAny.doseUnit === "ml"
      ? "ml"
      : initialAny.doseUnit === "tabletas"
      ? "tabletas"
      : String(initialAny.dosis || "")
          .toLowerCase()
          .includes("ml")
      ? "ml"
      : "tabletas"
  );

  // Imagen asociada al medicamento
  const [imageUri, setImageUri] = useState<string>(initialAny.imageUri ?? "");

  // Controla si se muestra el action sheet de imagen
  const [showImageSheet, setShowImageSheet] = useState(false);

  // ===================== imágenes =====================

  const onPressCamera = useCallback(() => setShowImageSheet(true), []);
  // Abre el menú para elegir cámara o galería

  const handlePickFromGallery = useCallback(async () => {
    const uri = await pickImageFromGallery(); // Abre galería
    if (uri) setImageUri(uri); // Guarda la imagen seleccionada
  }, []);

  const handleTakePhoto = useCallback(async () => {
    const uri = await takePhotoWithCamera(); // Abre cámara
    if (uri) setImageUri(uri); // Guarda la foto tomada
  }, []);

  // ===================== validación =====================

  const validate = useCallback((): boolean => {
    // Verifica permisos
    if (!canModify) {
      Alert.alert(
        "Sin permisos",
        "Solo el paciente puede modificar medicamentos."
      );
      return false;
    }

    // Nombre obligatorio
    if (!nombre.trim()) {
      Alert.alert("Falta el nombre", "Ingresa el nombre del medicamento.");
      return false;
    }

    // Dosis obligatoria
    if (!doseAmount.trim()) {
      Alert.alert(
        "Falta la dosis",
        "Ingresa la cantidad por toma, por ejemplo: 1, 2, 5, etc."
      );
      return false;
    }

    // Dosis válida (> 0)
    const doseNum = Number(doseAmount.trim());
    if (!Number.isFinite(doseNum) || doseNum <= 0) {
      Alert.alert("Dosis inválida", "La dosis debe ser un número mayor que 0.");
      return false;
    }

    // Unidad de dosis obligatoria
    if (!doseUnit) {
      Alert.alert(
        "Unidad de dosis",
        "Selecciona si la dosis es en tabletas/pastillas o en ml."
      );
      return false;
    }

    // Validación de frecuencia usando el servicio
    const freqCheck = medsService.validateFrequency(frecuencia);
    if (!freqCheck.ok) {
      Alert.alert(
        freqCheck.reason === "Falta la frecuencia"
          ? "Falta la frecuencia"
          : "Frecuencia inválida",
        freqCheck.reason === "Falta la frecuencia"
          ? "Ingresa cada cuánto se toma en formato HH:MM, por ejemplo: 08:00."
          : "La frecuencia debe tener el formato HH:MM, por ejemplo: 08:00."
      );
      return false;
    }

    // Cantidad disponible válida (>= 0)
    if (cantidad.trim()) {
      const n = Number(cantidad.trim());
      if (!Number.isFinite(n) || n < 0) {
        Alert.alert(
          "Cantidad inválida",
          "La cantidad disponible debe ser un número entero mayor o igual a 0."
        );
        return false;
      }
    }

    return true; // Todas las validaciones pasaron
  }, [canModify, nombre, doseAmount, doseUnit, frecuencia, cantidad]);

  // ===================== submit =====================

  const onSubmit = useCallback(async () => {
    if (!validate()) return; // Detiene si falla validación

    if (!ownerUid || !loggedUid) {
      Alert.alert(
        "Sesión requerida",
        "Debes iniciar sesión para guardar tus medicamentos."
      );
      return;
    }

    // Conversión de valores numéricos
    const cantidadNumber = cantidad.trim() ? Number(cantidad.trim()) : 0;
    const doseAmountNumber = doseAmount.trim() ? Number(doseAmount.trim()) : 1;

    try {
      // Guarda o actualiza medicamento + programa alarmas
      const res = await medsService.upsertMedicationWithAlarm({
        ownerUid,
        loggedUid,
        medId: isEdit ? medId : undefined,

        nombre,
        frecuencia,
        hora,

        cantidad: cantidadNumber,
        doseAmount: doseAmountNumber,
        doseUnit,
        imageUri,
      });

      // Mensaje de éxito
      Alert.alert(
        "Listo",
        isEdit
          ? "Medicamento actualizado."
          : res.alarmId && res.nextDueAt
          ? `Medicamento guardado. Primera alarma programada para ${res.nextDueAt.toLocaleTimeString(
              "es-MX",
              { hour: "2-digit", minute: "2-digit" }
            )}.`
          : "Medicamento guardado.",
        [{ text: "OK", onPress: () => navigation.goBack() }]
      );
    } catch (e: any) {
      // Manejo de errores de permisos
      if (String(e?.message || "") === "PERMISSION_DENIED") {
        Alert.alert(
          "Sin permisos",
          "Solo el paciente puede modificar medicamentos."
        );
        return;
      }

      // Error general
      Alert.alert(
        "Error",
        `No se pudo guardar el medicamento.\n\nCódigo: ${
          e?.code ?? "desconocido"
        }\nDetalle: ${e?.message ?? "sin mensaje"}`
      );
    }
  }, [
    validate,
    ownerUid,
    loggedUid,
    isEdit,
    medId,
    nombre,
    frecuencia,
    hora,
    cantidad,
    doseAmount,
    doseUnit,
    imageUri,
    navigation,
  ]);

  // ===================== delete =====================

  const onDelete = useCallback(() => {
    if (!isEdit || !medId) return; // Solo se puede borrar en edición

    if (!canModify) {
      Alert.alert(
        "Sin permisos",
        "Solo el paciente puede eliminar medicamentos."
      );
      return;
    }

    Alert.alert(
      "Eliminar medicamento",
      "¿Seguro que deseas eliminar este medicamento? Esta acción no se puede deshacer.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              await medsService.deleteMedicationWithAlarms({
                ownerUid,
                loggedUid,
                medId,
              });
              Alert.alert("Eliminado", "El medicamento fue eliminado.", [
                { text: "OK", onPress: () => navigation.goBack() },
              ]);
            } catch (e: any) {
              if (String(e?.message || "") === "PERMISSION_DENIED") {
                Alert.alert(
                  "Sin permisos",
                  "Solo el paciente puede eliminar medicamentos."
                );
                return;
              }

              Alert.alert(
                "Error",
                `No se pudo eliminar el medicamento.\n\nCódigo: ${
                  e?.code ?? "desconocido"
                }\nDetalle: ${e?.message ?? "sin mensaje"}`
              );
            }
          },
        },
      ]
    );
  }, [isEdit, medId, canModify, ownerUid, loggedUid, navigation]);

  // ===================== API del hook =====================

  return useMemo(
    () => ({
      // meta
      isEdit, // Indica si es edición
      canModify, // Indica si el usuario puede modificar

      // state
      nombre,
      frecuencia,
      hora,
      cantidad,
      doseAmount,
      doseUnit,
      imageUri,
      showImageSheet,

      // setters
      setNombre,
      setFrecuencia,
      setHora,
      setCantidad,
      setDoseAmount,
      setDoseUnit,

      // image sheet
      setShowImageSheet,
      onPressCamera,
      handlePickFromGallery,
      handleTakePhoto,

      // actions
      onSubmit,
      onDelete,
    }),
    [
      isEdit,
      canModify,
      nombre,
      frecuencia,
      hora,
      cantidad,
      doseAmount,
      doseUnit,
      imageUri,
      showImageSheet,
      onPressCamera,
      handlePickFromGallery,
      handleTakePhoto,
      onSubmit,
      onDelete,
    ]
  );
}
