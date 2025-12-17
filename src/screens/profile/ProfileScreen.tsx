// src/screens/profile/ProfileScreen.tsx

import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Image,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";

import { useProfile } from "../../hooks/useProfile";

import { useIsOnline } from "../../context/OfflineContext";

const ProfileScreen: React.FC = () => {
  const isOnline = useIsOnline();

  const {
    firebaseUser,
    userId,
    userEmail,

    displayName,
    setDisplayName,
    phone,
    setPhone,
    age,
    setAge,
    allergies,
    setAllergies,
    conditions,
    setConditions,
    photoUri,

    emergencyName,
    setEmergencyName,
    emergencyRelation,
    setEmergencyRelation,
    emergencyPhone,
    setEmergencyPhone,

    bloodType,
    setBloodType,
    emergencyNotes,
    setEmergencyNotes,

    loading,
    saving,
    isEditing,

    showEmailForm,
    setShowEmailForm,
    showPasswordForm,
    setShowPasswordForm,

    newEmail,
    setNewEmail,
    emailPassword,
    setEmailPassword,
    processingEmail,

    currentPass,
    setCurrentPass,
    newPass,
    setNewPass,
    confirmPass,
    setConfirmPass,
    processingPass,

    toggleEdit,
    handlePickFromGallery,
    handleTakePhoto,
    handleSave,
    handleChangeEmail,
    handleChangePassword,
  } = useProfile();

  const canUseOnlineSecurity = !!firebaseUser && isOnline;

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Cargando perfil...</Text>
      </SafeAreaView>
    );
  }

  if (!userId) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.errorText}>
          No hay usuario autenticado. Inicia sesión de nuevo.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.title}>Mi perfil</Text>
              <Text style={styles.subtitle}>
                Revisa tu información personal y médica
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.editButton, isEditing && styles.editButtonActive]}
              onPress={toggleEdit}
            >
              <MaterialIcons
                name={isEditing ? "close" : "edit"}
                size={20}
                color={isEditing ? "#fff" : "#007bff"}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.avatarContainer}>
            <View style={styles.avatarOuter}>
              <View style={styles.avatarCircle}>
                {photoUri ? (
                  <Image
                    source={{ uri: photoUri }}
                    style={styles.avatarImage}
                  />
                ) : (
                  <Text style={styles.avatarInitials}>
                    {displayName
                      ? displayName.charAt(0).toUpperCase()
                      : userEmail?.charAt(0).toUpperCase() ?? "?"}
                  </Text>
                )}
              </View>
            </View>
            {isEditing && (
              <View style={styles.avatarButtons}>
                <TouchableOpacity
                  style={styles.avatarIconButton}
                  onPress={handlePickFromGallery}
                >
                  <MaterialIcons
                    name="photo-library"
                    size={20}
                    color="#007bff"
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.avatarIconButton}
                  onPress={handleTakePhoto}
                >
                  <MaterialIcons
                    name="photo-camera"
                    size={20}
                    color="#007bff"
                  />
                </TouchableOpacity>
              </View>
            )}
          </View>

          <Text style={styles.sectionTitle}>Cuenta</Text>
          <View style={styles.field}>
            <Text style={styles.label}>Correo electrónico</Text>
            <Text style={styles.readonlyInput}>
              {userEmail || "No disponible"}
            </Text>
          </View>

          {/* Seguridad */}
          {firebaseUser && (
            <View style={styles.securityBlock}>
              <Text style={styles.sectionTitle}>Seguridad de la cuenta</Text>

              {!isOnline && (
                <View style={styles.offlineBanner}>
                  <MaterialIcons name="wifi-off" size={16} color="#6b7280" />
                  <Text style={styles.offlineBannerText}>
                    Sin internet: cambiar correo/contraseña está deshabilitado
                  </Text>
                </View>
              )}

              {/* Cambiar correo */}
              <TouchableOpacity
                style={[
                  styles.inlineButton,
                  !canUseOnlineSecurity && styles.disabledButton,
                ]}
                disabled={!canUseOnlineSecurity}
                onPress={() => {
                  if (!canUseOnlineSecurity) {
                    Alert.alert(
                      "Sin conexión",
                      "Para cambiar tu correo necesitas conexión a internet."
                    );
                    return;
                  }
                  setShowEmailForm((prev) => !prev);
                }}
              >
                <MaterialIcons
                  name="alternate-email"
                  size={18}
                  color={canUseOnlineSecurity ? "#007bff" : "#9ca3af"}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[
                    styles.inlineButtonText,
                    !canUseOnlineSecurity && styles.inlineButtonTextDisabled,
                  ]}
                >
                  {showEmailForm ? "Cancelar" : "Cambiar correo"}
                </Text>
              </TouchableOpacity>

              {showEmailForm && (
                <View style={styles.securityCard}>
                  <Text style={styles.label}>Nuevo correo</Text>
                  <TextInput
                    style={styles.input}
                    value={newEmail}
                    onChangeText={setNewEmail}
                    placeholder="nuevo@correo.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    editable={isOnline && !processingEmail}
                  />
                  <Text style={[styles.label, { marginTop: 8 }]}>
                    Contraseña actual
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={emailPassword}
                    onChangeText={setEmailPassword}
                    placeholder="Contraseña"
                    secureTextEntry
                    editable={isOnline && !processingEmail}
                  />
                  <TouchableOpacity
                    style={[
                      styles.saveButtonSmall,
                      (!isOnline || processingEmail) && { opacity: 0.6 },
                    ]}
                    onPress={handleChangeEmail}
                    disabled={!isOnline || processingEmail}
                  >
                    {processingEmail ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.saveButtonTextSmall}>Guardar</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}

              {/* Cambiar contraseña */}
              <TouchableOpacity
                style={[
                  styles.inlineButton,
                  { marginTop: 10 },
                  !canUseOnlineSecurity && styles.disabledButton,
                ]}
                disabled={!canUseOnlineSecurity}
                onPress={() => {
                  if (!canUseOnlineSecurity) {
                    Alert.alert(
                      "Sin conexión",
                      "Para cambiar tu contraseña necesitas conexión a internet."
                    );
                    return;
                  }
                  setShowPasswordForm((prev) => !prev);
                }}
              >
                <MaterialIcons
                  name="lock-reset"
                  size={18}
                  color={canUseOnlineSecurity ? "#007bff" : "#9ca3af"}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[
                    styles.inlineButtonText,
                    !canUseOnlineSecurity && styles.inlineButtonTextDisabled,
                  ]}
                >
                  {showPasswordForm ? "Cancelar" : "Cambiar contraseña"}
                </Text>
              </TouchableOpacity>

              {showPasswordForm && (
                <View style={styles.securityCard}>
                  <Text style={styles.label}>Contraseña actual</Text>
                  <TextInput
                    style={styles.input}
                    value={currentPass}
                    onChangeText={setCurrentPass}
                    placeholder="Actual"
                    secureTextEntry
                    editable={isOnline && !processingPass}
                  />
                  <Text style={[styles.label, { marginTop: 8 }]}>
                    Nueva contraseña
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={newPass}
                    onChangeText={setNewPass}
                    placeholder="Mín. 6 caracteres"
                    secureTextEntry
                    editable={isOnline && !processingPass}
                  />
                  <Text style={[styles.label, { marginTop: 8 }]}>
                    Confirmar
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={confirmPass}
                    onChangeText={setConfirmPass}
                    placeholder="Repetir"
                    secureTextEntry
                    editable={isOnline && !processingPass}
                  />
                  <TouchableOpacity
                    style={[
                      styles.saveButtonSmall,
                      (!isOnline || processingPass) && { opacity: 0.6 },
                    ]}
                    onPress={handleChangePassword}
                    disabled={!isOnline || processingPass}
                  >
                    {processingPass ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.saveButtonTextSmall}>Guardar</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          <View style={styles.sectionDivider} />
          <Text style={styles.sectionTitle}>Información personal</Text>

          <View style={styles.field}>
            <Text style={styles.label}>Nombre</Text>
            <TextInput
              style={[styles.input, !isEditing && styles.inputDisabled]}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Tu nombre"
              editable={isEditing}
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.field, styles.rowItem]}>
              <Text style={styles.label}>Edad</Text>
              <TextInput
                style={[styles.input, !isEditing && styles.inputDisabled]}
                value={age}
                onChangeText={setAge}
                placeholder="Ej. 21"
                keyboardType="numeric"
                editable={isEditing}
              />
            </View>
            <View style={[styles.field, styles.rowItem]}>
              <Text style={styles.label}>Teléfono</Text>
              <TextInput
                style={[styles.input, !isEditing && styles.inputDisabled]}
                value={phone}
                onChangeText={setPhone}
                placeholder="3511234567"
                keyboardType="phone-pad"
                editable={isEditing}
              />
            </View>
          </View>

          <View style={styles.sectionDivider} />
          <Text style={styles.sectionTitle}>Contacto de emergencia</Text>

          <View style={styles.field}>
            <Text style={styles.label}>Nombre</Text>
            <TextInput
              style={[styles.input, !isEditing && styles.inputDisabled]}
              value={emergencyName}
              onChangeText={setEmergencyName}
              placeholder="Ej. Mamá"
              editable={isEditing}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Parentesco</Text>
            <TextInput
              style={[styles.input, !isEditing && styles.inputDisabled]}
              value={emergencyRelation}
              onChangeText={setEmergencyRelation}
              placeholder="Ej. Madre"
              editable={isEditing}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Teléfono</Text>
            <TextInput
              style={[styles.input, !isEditing && styles.inputDisabled]}
              value={emergencyPhone}
              onChangeText={setEmergencyPhone}
              placeholder="Teléfono"
              keyboardType="phone-pad"
              editable={isEditing}
            />
          </View>

          <View style={styles.sectionDivider} />
          <Text style={styles.sectionTitle}>Datos rápidos</Text>

          <View style={styles.field}>
            <Text style={styles.label}>Tipo de sangre</Text>
            <TextInput
              style={[styles.input, !isEditing && styles.inputDisabled]}
              value={bloodType}
              onChangeText={setBloodType}
              placeholder="Ej. O+"
              editable={isEditing}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Notas</Text>
            <TextInput
              style={[
                styles.input,
                styles.multiline,
                !isEditing && styles.inputDisabled,
              ]}
              value={emergencyNotes}
              onChangeText={setEmergencyNotes}
              placeholder="Notas importantes"
              multiline
              editable={isEditing}
            />
          </View>

          <View style={styles.sectionDivider} />
          <Text style={styles.sectionTitle}>Datos médicos</Text>

          <View style={styles.field}>
            <Text style={styles.label}>Alergias</Text>
            <TextInput
              style={[
                styles.input,
                styles.multiline,
                !isEditing && styles.inputDisabled,
              ]}
              value={allergies}
              onChangeText={setAllergies}
              placeholder="Alergias"
              multiline
              editable={isEditing}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Condiciones médicas</Text>
            <TextInput
              style={[
                styles.input,
                styles.multiline,
                !isEditing && styles.inputDisabled,
              ]}
              value={conditions}
              onChangeText={setConditions}
              placeholder="Condiciones"
              multiline
              editable={isEditing}
            />
          </View>

          {isEditing && (
            <TouchableOpacity
              style={[styles.saveButton, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveButtonText}>Guardar cambios</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f6fa" },
  content: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingVertical: 24,
    alignItems: "center",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  loadingText: { marginTop: 8, fontSize: 14, color: "#555" },
  errorText: { fontSize: 16, textAlign: "center", color: "#333" },
  card: {
    width: "100%",
    maxWidth: 480,
    backgroundColor: "#fff",
    borderRadius: 18,
    paddingHorizontal: 20,
    paddingVertical: 22,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  title: { fontSize: 22, fontWeight: "600", color: "#111827" },
  subtitle: { fontSize: 13, color: "#6b7280", marginTop: 2 },
  editButton: {
    padding: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#007bff33",
    backgroundColor: "#fff",
  },
  editButtonActive: { backgroundColor: "#007bff", borderColor: "#007bff" },
  avatarContainer: { alignItems: "center", marginTop: 16, marginBottom: 12 },
  avatarOuter: { padding: 4, borderRadius: 999, backgroundColor: "#e5e7eb" },
  avatarCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#e5e7eb",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImage: { width: 96, height: 96, borderRadius: 48 },
  avatarInitials: { fontSize: 32, fontWeight: "700", color: "#4b5563" },
  avatarButtons: { flexDirection: "row", marginTop: 8, gap: 10 },
  avatarIconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "#007bff33",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f3f4f6",
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
    marginTop: 10,
    marginBottom: 6,
  },
  sectionDivider: { height: 1, backgroundColor: "#f0f0f0", marginVertical: 10 },
  field: { marginBottom: 12 },
  label: { fontSize: 13, marginBottom: 4, color: "#6b7280" },
  readonlyInput: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "#f3f4f6",
    fontSize: 15,
    color: "#111827",
  },
  input: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    fontSize: 15,
    backgroundColor: "#fff",
    color: "#111827",
  },
  inputDisabled: { backgroundColor: "#f9fafb", color: "#6b7280" },
  multiline: { minHeight: 80, textAlignVertical: "top" },
  row: { flexDirection: "row", gap: 10 },
  rowItem: { flex: 1 },
  saveButton: {
    marginTop: 8,
    backgroundColor: "#007bff",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  saveButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  securityBlock: { marginTop: 4 },

  inlineButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingVertical: 6,
  },
  inlineButtonText: { color: "#007bff", fontWeight: "600", fontSize: 13 },

  disabledButton: { opacity: 0.45 },
  inlineButtonTextDisabled: { color: "#9ca3af" },

  offlineBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: "#f3f4f6",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginBottom: 8,
  },
  offlineBannerText: { fontSize: 12, color: "#6b7280", flexShrink: 1 },

  securityCard: {
    marginTop: 4,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#f9fafb",
  },
  saveButtonSmall: {
    marginTop: 10,
    backgroundColor: "#007bff",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  saveButtonTextSmall: { color: "#fff", fontSize: 14, fontWeight: "600" },
});

export default ProfileScreen;
