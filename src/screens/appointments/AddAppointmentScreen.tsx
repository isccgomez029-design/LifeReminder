// src/screens/appointments/AddAppointmentScreen.tsx
import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
} from "react-native";

import { COLORS, FONT_SIZES } from "../../../types";
import { SafeAreaView } from "react-native-safe-area-context";
import { RouteProp, useRoute, useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../../navigation/StackNavigator";

import TimePickerField from "../../components/TimePickerField";
import MiniCalendar from "../../components/MiniCalendar";

import { useAddAppointment } from "../../hooks/useAddAppointment";

type AddApptRoute = RouteProp<RootStackParamList, "AddAppointment">;
type Nav = StackNavigationProp<RootStackParamList, "AddAppointment">;

export default function AddAppointmentScreen() {
  const route = useRoute<AddApptRoute>();
  const navigation = useNavigation<Nav>();

  const {
    isEdit,
    date,
    motivo,
    ubicacion,
    medico,
    hora,
    setDate,
    setMotivo,
    setUbicacion,
    setMedico,
    onChangeHora,
    guardar,
    formatHHMMDisplay,
  } = useAddAppointment({ navigation, routeParams: route.params as any });

  const formattedHora = formatHHMMDisplay(hora);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>
          {isEdit ? "Editar cita" : "Nueva cita"}
        </Text>

        <View style={styles.card}>
          <View style={styles.calendarBox}>
            <MiniCalendar value={date} onChange={setDate} />
          </View>

          <View style={{ gap: 10 }}>
            <View style={styles.row}>
              <TextInput
                style={styles.input}
                placeholder="Motivo de la cita:"
                value={motivo}
                onChangeText={setMotivo}
                placeholderTextColor={COLORS.textSecondary}
              />
            </View>

            <View style={styles.row}>
              <TextInput
                style={styles.input}
                placeholder="Ubicación:"
                value={ubicacion}
                onChangeText={setUbicacion}
                placeholderTextColor={COLORS.textSecondary}
              />
            </View>

            <View style={styles.row}>
              <TextInput
                style={styles.input}
                placeholder="Médico y especialidad:"
                value={medico}
                onChangeText={setMedico}
                placeholderTextColor={COLORS.textSecondary}
              />
            </View>

            <View style={styles.row}>
              <TimePickerField
                value={hora}
                onChange={onChangeHora}
                mode="point"
                placeholder="Seleccionar hora"
              />
            </View>

            <TouchableOpacity style={styles.primaryBtn} onPress={guardar}>
              <Text style={styles.primaryText}>
                {isEdit ? "Guardar cambios" : "Confirmar"}
              </Text>
            </TouchableOpacity>

            <Text style={styles.helper}>
              Seleccionado:{" "}
              {date.toLocaleDateString("es-MX", {
                weekday: "short",
                year: "numeric",
                month: "short",
                day: "numeric",
              })}{" "}
              {hora ? `• ${formattedHora}` : ""}
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ===== Estilos ===== */
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  container: { flex: 1 },
  content: { padding: 8, paddingBottom: 24 },
  title: {
    fontSize: FONT_SIZES.xlarge,
    fontWeight: "800",
    color: COLORS.text,
    marginBottom: 10,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    gap: 12,
  },
  calendarBox: {
    alignItems: "center",
    justifyContent: "center",
    padding: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    backgroundColor: "#111",
  },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  input: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    color: COLORS.text,
    backgroundColor: COLORS.surface,
  },
  primaryBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 6,
  },
  primaryText: {
    color: COLORS.surface,
    fontWeight: "800",
    fontSize: FONT_SIZES.medium,
  },
  helper: { color: COLORS.textSecondary, marginTop: 6, textAlign: "center" },
});
