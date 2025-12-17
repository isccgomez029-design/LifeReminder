/* 
   UserMenuButton.tsx 
   */

import React, { useState, useEffect } from "react";
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  Text,
  BackHandler,
  Alert,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { COLORS, FONT_SIZES } from "../../types";
import { useNavigation } from "@react-navigation/native";

import { offlineAuthService } from "../services/offline/OfflineAuthService";

export default function UserMenuButton() {
  const navigation = useNavigation<any>(); // Hook para poder navegar entre pantallas
  const [open, setOpen] = useState(false); // Estado que controla si el menú está abierto o cerrado

  useEffect(() => {
    // Listener del botón físico "Atrás" en Android
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (open) {
        setOpen(false); // Si el menú está abierto, lo cierra
        return true; // Consume el evento (no vuelve a la pantalla anterior)
      }
      return false; // Permite el comportamiento normal del botón atrás
    });
    return () => sub.remove(); // Limpia el listener al desmontar o cambiar dependencias
  }, [open]); // Se vuelve a registrar si cambia el estado del menú

  const go = (route: string) => {
    setOpen(false); // Cierra el menú antes de navegar
    navigation.navigate(route); // Navega a la pantalla indicada
  };

  const handleLogout = async () => {
    setOpen(false); // Cierra el menú
    try {
      await offlineAuthService.signOut(false);
      // Cierra sesión manteniendo el cache local (modo offline disponible)

      navigation.reset({
        index: 0,
        routes: [{ name: "Login" }], // Reinicia la navegación y manda a Login
      });
    } catch (e: any) {
      Alert.alert("Error al cerrar sesión", e?.message ?? "Intenta de nuevo."); // Muestra error si falla el logout
    }
  };

  // Función para logout completo (borra todo el cache)
  const handleLogoutComplete = async () => {
    Alert.alert(
      "Cerrar sesión completa", // Título del alert
      "¿Deseas borrar todos los datos guardados? No podrás usar la app sin internet hasta que vuelvas a iniciar sesión.",
      [
        { text: "Cancelar", style: "cancel" }, // Opción para cancelar
        {
          text: "Borrar y salir",
          style: "destructive", // Botón de acción destructiva
          onPress: async () => {
            setOpen(false); // Cierra el menú
            try {
              await offlineAuthService.signOut(true);
              // Cierra sesión y borra todo el cache local

              navigation.reset({
                index: 0,
                routes: [{ name: "Login" }], // Reinicia navegación a Login
              });
            } catch (e: any) {
              Alert.alert("Error", e?.message ?? "Intenta de nuevo.");
            }
          },
        },
      ]
    );
  };

  return (
    <View style={{ position: "relative" }}>
      <TouchableOpacity
        onPress={() => setOpen((v) => !v)}
        style={{ padding: 6 }}
        accessibilityLabel="Menú de usuario"
      >
        <MaterialIcons name="settings" size={22} color={COLORS.surface} />
      </TouchableOpacity>

      {open && (
        <>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setOpen(false)}
          />

          <View style={styles.menu}>
            {/* PERFIL */}
            <TouchableOpacity style={styles.item} onPress={() => go("Profile")}>
              <MaterialIcons
                name="person"
                size={18}
                color={COLORS.text}
                style={styles.icon}
              />
              <Text style={styles.txt}>Perfil</Text>
            </TouchableOpacity>

            {/* CONFIGURACIÓN */}
            <TouchableOpacity
              style={styles.item}
              onPress={() => go("Settings")}
            >
              <MaterialIcons
                name="tune"
                size={18}
                color={COLORS.text}
                style={styles.icon}
              />
              <Text style={styles.txt}>Configuración</Text>
            </TouchableOpacity>

            {/* INVITACIONES */}
            <TouchableOpacity
              style={styles.item}
              onPress={() => go("CareInvites")}
            >
              <MaterialIcons
                name="group-add"
                size={18}
                color={COLORS.text}
                style={styles.icon}
              />
              <Text style={styles.txt}>Invitaciones de cuidado</Text>
            </TouchableOpacity>

            <View style={styles.divider} />

            <View style={styles.divider} />

            {/* CERRAR SESIÓN (mantiene cache) */}
            <TouchableOpacity style={styles.item} onPress={handleLogout}>
              <MaterialIcons
                name="logout"
                size={18}
                color="#c62828"
                style={styles.icon}
              />
              <Text style={[styles.txt, { color: "#c62828" }]}>
                Cerrar sesión
              </Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  menu: {
    position: "absolute",
    top: "100%",
    right: 0,
    marginTop: 8,
    width: 210,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 6,
    elevation: 5,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  icon: { marginRight: 8 },
  txt: {
    fontSize: FONT_SIZES.medium || 16,
    color: COLORS.text,
    fontWeight: "600",
  },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 6 },
});
