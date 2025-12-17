// src/components/OfflineBanner.tsx

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";

interface OfflineBannerProps {
  // Define las props que recibe el componente
  pendingChanges?: number; // Número de cambios pendientes de sincronizar (opcional)
}

export function OfflineBanner({ pendingChanges = 0 }: OfflineBannerProps) {
  // Componente funcional que recibe pendingChanges
  // Si no se pasa la prop, por defecto se usa 0

  if (pendingChanges === 0) {
    return null; // No renderiza nada cuando no hay cambios pendientes
  }

  return (
    <View style={styles.banner}>
      <MaterialIcons name="cloud-off" size={16} color="#F59E0B" />
      <Text style={styles.text}>
        {pendingChanges === 1
          ? "1 cambio pendiente de sincronizar"
          : `${pendingChanges} cambios pendientes de sincronizar`}
      </Text>
      <MaterialIcons name="sync" size={16} color="#F59E0B" />
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FEF3C7",
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F59E0B",
  },
  text: {
    fontSize: 12,
    color: "#92400E",
    fontWeight: "600",
  },
});
