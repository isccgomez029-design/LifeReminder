// src/screens/reminders/AddHabitScreen.tsx


import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons, FontAwesome5 } from "@expo/vector-icons";
import { COLORS, FONT_SIZES } from "../../../types";
import { RouteProp, useRoute, useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../../navigation/StackNavigator";

// UI
import TimePickerField from "../../components/TimePickerField";

// Utils solo para display (UI)
import { formatHHMMDisplay } from "../../utils/timeUtils";

// ✅ Hook (toda la lógica)
import { useAddHabit } from "../../hooks/useAddHabit";

type AddHabitRoute = RouteProp<RootStackParamList, "AddHabit">;
type Nav = StackNavigationProp<RootStackParamList, "AddHabit">;

const QUICK_ICONS: {
  icon: string;
  lib: "FontAwesome5" | "MaterialIcons";
}[] = [
  { icon: "tint", lib: "FontAwesome5" },
  { icon: "walking", lib: "FontAwesome5" },
  { icon: "self-improvement", lib: "MaterialIcons" },
  { icon: "book", lib: "FontAwesome5" },
  { icon: "favorite", lib: "MaterialIcons" },
  { icon: "healing", lib: "MaterialIcons" },
];

const DAY_LABELS = ["L", "M", "X", "J", "V", "S", "D"];

export default function AddHabitScreen() {
  const route = useRoute<AddHabitRoute>();
  const navigation = useNavigation<Nav>();

  const {
    isEdit,

    name,
    icon,
    lib,
    priority,
    days,
    times,
    newTime,

    setName,
    setIcon,
    setLib,
    setPriority,
    setNewTime,

    toggleDay,
    addTime,
    removeTime,
    save,
  } = useAddHabit({ route });

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>
          {isEdit ? "Editar hábito" : "Nuevo hábito"}
        </Text>

        <View style={styles.card}>
          {/* Nombre */}
          <Text style={styles.label}>Nombre del hábito</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej. Beber agua"
            value={name}
            onChangeText={setName}
            placeholderTextColor={COLORS.textSecondary}
          />

          {/* Iconos */}
          <Text style={[styles.label, { marginTop: 12 }]}>Icono</Text>
          <View style={styles.iconRow}>
            {QUICK_ICONS.map((it, i) => {
              const IconCmp =
                it.lib === "FontAwesome5" ? FontAwesome5 : MaterialIcons;
              const selected = icon === it.icon && lib === it.lib;

              return (
                <TouchableOpacity
                  key={i}
                  style={[styles.iconBox, selected && styles.iconBoxSelected]}
                  onPress={() => {
                    setIcon(it.icon);
                    setLib(it.lib);
                  }}
                >
                  <IconCmp
                    name={it.icon as any}
                    size={22}
                    color={selected ? COLORS.surface : COLORS.text}
                  />
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Días */}
          <Text style={[styles.label, { marginTop: 12 }]}>Repetir días</Text>
          <View style={styles.daysRow}>
            {DAY_LABELS.map((label, idx) => {
              const active = days.includes(idx);
              return (
                <TouchableOpacity
                  key={idx}
                  style={[styles.dayBox, active && styles.dayBoxSelected]}
                  onPress={() => toggleDay(idx)}
                >
                  <Text
                    style={[styles.dayText, active && styles.dayTextSelected]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Horas */}
          <Text style={[styles.label, { marginTop: 12 }]}>Horarios</Text>
          <View style={styles.timeRow}>
            <TimePickerField
              value={newTime}
              onChange={setNewTime}
              mode="point"
            />
            <TouchableOpacity style={styles.addTimeBtn} onPress={addTime}>
              <Text style={styles.addTimeText}>Agregar</Text>
            </TouchableOpacity>
          </View>

          {!!times.length && (
            <View style={styles.timesList}>
              {times.map((t) => (
                <View key={t} style={styles.timeChip}>
                  <Text style={styles.timeChipText}>
                    {formatHHMMDisplay(t)}
                  </Text>
                  <TouchableOpacity
                    style={styles.timeChipRemove}
                    onPress={() => removeTime(t)}
                  >
                    <MaterialIcons name="close" size={14} color="#fff" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* Prioridad */}
          <Text style={[styles.label, { marginTop: 12 }]}>Prioridad</Text>
          <View style={styles.priorityRow}>
            {(["baja", "normal", "alta"] as const).map((p) => {
              const active = priority === p;
              return (
                <TouchableOpacity
                  key={p}
                  style={[
                    styles.priorityBox,
                    active && styles.priorityBoxSelected,
                  ]}
                  onPress={() => setPriority(p)}
                >
                  <Text
                    style={[
                      styles.priorityText,
                      active && styles.priorityTextSelected,
                    ]}
                  >
                    {p.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Guardar */}
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={async () => {
              const res = await save();
              if (res?.ok) navigation.goBack();
            }}
          >
            <Text style={styles.primaryText}>
              {isEdit ? "Guardar cambios" : "Confirmar"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/* === ESTILOS === */
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
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
    gap: 10,
  },
  label: {
    fontSize: FONT_SIZES.small,
    fontWeight: "700",
    color: COLORS.text,
  },
  input: {
    height: 40,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    marginTop: 4,
    color: COLORS.text,
  },
  iconRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 6,
  },
  iconBox: {
    width: 46,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBoxSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  daysRow: { flexDirection: "row", gap: 6, marginTop: 4 },
  dayBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  dayBoxSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  dayText: { color: COLORS.text },
  dayTextSelected: { color: COLORS.surface, fontWeight: "800" },

  timeRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    marginTop: 6,
  },
  addTimeBtn: {
    borderWidth: 1,
    borderColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addTimeText: {
    color: COLORS.primary,
    fontWeight: "700",
  },

  timesList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 6,
  },
  timeChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.secondary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  timeChipText: {
    color: COLORS.surface,
    fontWeight: "700",
    marginRight: 4,
  },
  timeChipRemove: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },

  priorityRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  priorityBox: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  priorityBoxSelected: {
    backgroundColor: COLORS.secondary,
    borderColor: COLORS.secondary,
  },
  priorityText: {
    color: COLORS.text,
    fontWeight: "700",
  },
  priorityTextSelected: {
    color: COLORS.surface,
  },

  primaryBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 10,
  },
  primaryText: {
    color: COLORS.surface,
    fontWeight: "800",
    fontSize: FONT_SIZES.medium,
  },
});
