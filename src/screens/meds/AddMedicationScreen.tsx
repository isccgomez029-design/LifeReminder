// src/screens/meds/AddMedicationScreen.tsx


import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { COLORS, FONT_SIZES } from "../../../types";
import { StackNavigationProp } from "@react-navigation/stack";
import { RouteProp, useRoute } from "@react-navigation/native";
import { RootStackParamList } from "../../navigation/StackNavigator";
import { SafeAreaView } from "react-native-safe-area-context";

import ImagePickerSheet from "../../components/ImagePickerSheet";
import TimePickerField from "../../components/TimePickerField";

import { useAddMedication } from "../../hooks/useAddMedication";

type Nav = StackNavigationProp<RootStackParamList, "AddMedication">;
type Route = RouteProp<RootStackParamList, "AddMedication">;

export default function AddMedicationScreen({
  navigation,
}: {
  navigation: Nav;
}) {
  const route = useRoute<Route>();

  const {
    isEdit,

    nombre,
    frecuencia,
    hora,
    cantidad,
    doseAmount,
    doseUnit,
    imageUri,
    showImageSheet,

    setNombre,
    setFrecuencia,
    setHora,
    setCantidad,
    setDoseAmount,
    setDoseUnit,

    setShowImageSheet,
    onPressCamera,
    handlePickFromGallery,
    handleTakePhoto,

    onSubmit,
    onDelete,
  } = useAddMedication({ navigation, routeParams: route.params as any });

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >

        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>
              {isEdit ? "Editar medicamento" : "Agregar medicamento"}
            </Text>
          </View>
          <View style={styles.sectionIcon}>
            <MaterialIcons
              name="medical-services"
              size={22}
              color={COLORS.surface}
            />
          </View>
        </View>


        <View style={styles.card}>

          <TouchableOpacity
            style={styles.cameraBtn}
            onPress={onPressCamera}
            activeOpacity={0.8}
          >
            <MaterialIcons
              name="photo-camera"
              size={22}
              color={COLORS.surface}
            />
          </TouchableOpacity>


          {imageUri ? (
            <View style={styles.previewWrapper}>
              <Image source={{ uri: imageUri }} style={styles.previewImage} />
            </View>
          ) : null}


          <View style={[styles.fieldRow, styles.firstFieldRow]}>
            <Text style={styles.label}>Nombre:</Text>
            <TextInput
              style={styles.input}
              value={nombre}
              onChangeText={setNombre}
              placeholder="Ej. Losartán"
              placeholderTextColor={COLORS.textSecondary}
            />
          </View>


          <View style={styles.fieldRow}>
            <Text style={styles.label}>Hora próxima toma:</Text>
            <View style={styles.timeRow}>
              <TimePickerField
                value={hora}
                onChange={setHora}
                mode="point"
                placeholder="Seleccionar hora"
              />
            </View>
          </View>

          {/* Frecuencia */}
          <View style={styles.fieldRow}>
            <Text style={styles.label}>Cada:</Text>
            <View style={styles.timeRow}>
              <TimePickerField
                value={frecuencia}
                onChange={setFrecuencia}
                mode="interval"
                placeholder="Seleccionar intervalo"
              />
              <Text style={[styles.label, { marginLeft: 8 }]}>hrs</Text>
            </View>
          </View>

          <View style={styles.fieldRow}>
            <Text style={styles.label}>Dosis por toma:</Text>
            <View style={styles.doseRow}>
              <TextInput
                style={styles.doseAmountInput}
                value={doseAmount}
                onChangeText={setDoseAmount}
                placeholder="Ej. 1"
                placeholderTextColor={COLORS.textSecondary}
                keyboardType="numeric"
              />

              <View style={styles.unitRow}>
                <TouchableOpacity
                  style={[
                    styles.unitChip,
                    doseUnit === "tabletas" && styles.unitChipSelected,
                  ]}
                  onPress={() => setDoseUnit("tabletas")}
                >
                  <Text
                    style={[
                      styles.unitChipText,
                      doseUnit === "tabletas" && styles.unitChipTextSelected,
                    ]}
                  >
                    Tabletas/pastillas
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.unitChip,
                    doseUnit === "ml" && styles.unitChipSelected,
                  ]}
                  onPress={() => setDoseUnit("ml")}
                >
                  <Text
                    style={[
                      styles.unitChipText,
                      styles.unitChipTextSmall,
                      doseUnit === "ml" && styles.unitChipTextSelected,
                    ]}
                  >
                    Mililitros (ml)
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <View style={styles.fieldRow}>
            <Text style={styles.label}>Cantidad disponible:</Text>
            <TextInput
              style={styles.input}
              value={cantidad}
              onChangeText={setCantidad}
              placeholder="Ej. 30"
              placeholderTextColor={COLORS.textSecondary}
              keyboardType="numeric"
            />
          </View>
        </View>

        {/* Botones */}
        <TouchableOpacity style={styles.primaryBtn} onPress={onSubmit}>
          <Text style={styles.primaryBtnText}>
            {isEdit ? "Actualizar medicamento" : "Guardar medicamento"}
          </Text>
        </TouchableOpacity>

        {isEdit && (
          <TouchableOpacity style={styles.deleteBtn} onPress={onDelete}>
            <Text style={styles.deleteBtnText}>Eliminar medicamento</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Sheet de imagen */}
      <ImagePickerSheet
        visible={showImageSheet}
        onClose={() => setShowImageSheet(false)}
        onTakePhoto={async () => {
          setShowImageSheet(false);
          await handleTakePhoto();
        }}
        onPickFromGallery={async () => {
          setShowImageSheet(false);
          await handlePickFromGallery();
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },

  container: { flex: 1 },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    paddingTop: 0,
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  title: {
    fontSize: FONT_SIZES.xlarge,
    fontWeight: "800",
    color: COLORS.text,
  },
  sectionIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: COLORS.secondary,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
  },

  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 52,
    borderWidth: 1,
    borderColor: COLORS.border,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },

  cameraBtn: {
    position: "absolute",
    right: 12,
    top: 12,
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },

  previewWrapper: { alignItems: "center", marginBottom: 12 },
  previewImage: { width: 140, height: 90, borderRadius: 8 },

  fieldRow: { marginBottom: 14 },
  firstFieldRow: { marginTop: 4 },

  label: {
    color: COLORS.text,
    fontWeight: "700",
    fontSize: FONT_SIZES.small,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.textSecondary,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: FONT_SIZES.medium,
    color: COLORS.text,
    backgroundColor: COLORS.background,
  },

  timeRow: { flexDirection: "row", alignItems: "center", marginTop: 4 },

  doseRow: { flexDirection: "column" },
  doseAmountInput: {
    borderWidth: 1,
    borderColor: COLORS.textSecondary,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: FONT_SIZES.medium,
    color: COLORS.text,
    backgroundColor: COLORS.background,
  },

  unitRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    flexWrap: "wrap",
  },
  unitChip: {
    borderWidth: 1,
    borderColor: COLORS.textSecondary,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginRight: 8,
    marginBottom: 4,
  },
  unitChipSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  unitChipText: {
    fontSize: FONT_SIZES.small,
    color: COLORS.text,
    fontWeight: "600",
  },
  unitChipTextSmall: { fontSize: FONT_SIZES.small },
  unitChipTextSelected: { color: COLORS.surface },

  primaryBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 28,
    alignSelf: "center",
    marginTop: 22,
    alignItems: "center",
  },
  primaryBtnText: {
    color: COLORS.surface,
    fontWeight: "900",
    fontSize: FONT_SIZES.medium,
    letterSpacing: 0.3,
  },

  deleteBtn: {
    backgroundColor: "#D32F2F",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignSelf: "center",
    marginTop: 12,
    alignItems: "center",
  },
  deleteBtnText: {
    color: COLORS.surface,
    fontWeight: "800",
    fontSize: FONT_SIZES.small,
  },
});
