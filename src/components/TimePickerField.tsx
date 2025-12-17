// src/components/TimePickerField.tsx
import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from "react-native";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { MaterialIcons } from "@expo/vector-icons";
import { COLORS, FONT_SIZES } from "../../types";

type Props = {
  value?: string; // Valor actual en formato "HH:MM" (24 horas), opcional
  onChange: (hhmm: string) => void; // Callback que devuelve la hora seleccionada en formato "HH:MM"
  mode?: "point" | "interval"; // Modo de uso: "point" = hora puntual, "interval" = intervalo (cada X tiempo)
  placeholder?: string; // Texto que se muestra cuando no hay hora seleccionada
};

function parseHHMMToDate(hhmm?: string): Date {
  const now = new Date(); // Fecha actual para tomar año/mes/día

  // Si no hay valor o el formato no es válido, se usa una hora por defecto (08:00)
  if (!hhmm || !/^\d{1,2}:\d{2}$/.test(hhmm)) {
    return new Date(
      now.getFullYear(), // Año actual
      now.getMonth(), // Mes actual
      now.getDate(), // Día actual
      8, // Hora por defecto
      0, // Minutos por defecto
      0,
      0
    );
  }

  const [hStr, mStr] = hhmm.split(":"); // Separa horas y minutos
  const h = parseInt(hStr, 10); // Convierte horas a número
  const m = parseInt(mStr, 10); // Convierte minutos a número

  // Crea un Date usando la fecha actual y la hora/minutos parseados
  return new Date(
    now.getFullYear(), // Año
    now.getMonth(), // Mes
    now.getDate(), // Día
    isNaN(h) ? 0 : h, // Hora (0 si no es válida)
    isNaN(m) ? 0 : m, // Minutos (0 si no es válido)
    0,
    0
  );
}

function formatForDisplay(hhmm?: string, mode: "point" | "interval" = "point") {
  // Si no hay valor o el formato no es válido, no se muestra nada
  if (!hhmm || !/^\d{1,2}:\d{2}$/.test(hhmm)) return "";

  const [hStr, mStr] = hhmm.split(":"); // Separa horas y minutos
  const h = parseInt(hStr, 10); // Convierte horas a número
  const m = parseInt(mStr, 10); // Convierte minutos a número

  if (mode === "interval") {
    // 🟢 Modo intervalo: siempre se muestra en formato 24h (HH:MM)
    const hh = isNaN(h) ? 0 : h;
    const mm = isNaN(m) ? 0 : m;
    return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
  }

  // 🟢 Modo hora puntual: se muestra en formato 12h con am/pm
  const d = new Date(); // Fecha base
  d.setHours(
    isNaN(h) ? 0 : h, // Hora
    isNaN(m) ? 0 : m, // Minutos
    0,
    0
  );

  return d.toLocaleTimeString("es-MX", {
    hour: "numeric", // Muestra la hora
    minute: "2-digit", // Muestra minutos con dos dígitos
    hour12: true, // Fuerza formato 12 horas (am/pm)
  });
}

const TimePickerField: React.FC<Props> = ({
  value, // Hora actual en formato "HH:MM"
  onChange, // Callback para notificar cambios
  mode = "point", // Modo por defecto: hora puntual
  placeholder = "Seleccionar hora", // Texto por defecto si no hay valor
}) => {
  const [show, setShow] = useState(false); // Controla si el TimePicker está visible
  const [pickerDate, setPickerDate] = useState<Date>(parseHHMMToDate(value)); // Fecha/hora usada por el picker

  const label = useMemo(() => {
    // Memoiza el texto que se muestra en el campo
    const formatted = formatForDisplay(value, mode); // Formatea según el modo
    if (!formatted) return placeholder; // Si no hay hora válida, muestra placeholder
    return formatted; // Muestra hora formateada
  }, [value, mode, placeholder]);

  const onPress = () => {
    // Al presionar el campo:
    setPickerDate(parseHHMMToDate(value)); // Sincroniza el picker con el valor actual
    setShow(true); // Muestra el selector de hora
  };

  const handleChange = (event: DateTimePickerEvent, selected?: Date) => {
    // Handler cuando cambia el valor del picker

    if (Platform.OS === "android") {
      setShow(false); // En Android se cierra el picker automáticamente
    }

    if (!selected) return; // Si el usuario cancela, no hace nada

    setPickerDate(selected); // Actualiza la fecha interna del picker

    const h = selected.getHours(); // Obtiene horas seleccionadas
    const m = selected.getMinutes(); // Obtiene minutos seleccionados
    const hh = String(h).padStart(2, "0"); // Formatea horas a dos dígitos
    const mm = String(m).padStart(2, "0"); // Formatea minutos a dos dígitos
    const hhmm = `${hh}:${mm}`; // Construye string "HH:MM"

    onChange(hhmm); // Notifica el nuevo valor al componente padre
  };
  return (
    <View>
      <TouchableOpacity style={styles.timeButton} onPress={onPress}>
        <MaterialIcons name="access-time" size={20} color={COLORS.surface} />
        <Text style={styles.timeButtonText}>{label}</Text>
      </TouchableOpacity>

      {show && (
        <DateTimePicker
          value={pickerDate}
          mode="time"
          display="spinner"
          // 🟢 Para intervalos usamos 24h (permite 00:30 sin am/pm)
          is24Hour={mode === "interval"}
          onChange={handleChange}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  timeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flex: 1,
  },
  timeButtonText: {
    color: COLORS.surface,
    fontWeight: "700",
    fontSize: FONT_SIZES.small,
  },
});

export default TimePickerField;
