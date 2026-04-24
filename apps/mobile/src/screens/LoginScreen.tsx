import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";

import { useAuth } from "../contexts/AuthContext";
import { BRAND_NAME, COLORS } from "../theme";

export const LoginScreen = ({
  onOpenRegister
}: {
  onOpenRegister: () => void;
}) => {
  const { t } = useTranslation();
  const { isConfigured, signInWithPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!isConfigured) {
      setError(t("auth.errors.missingConfig"));
      return;
    }

    if (!email.trim() || !password.trim()) {
      setError(t("auth.errors.missingCredentials"));
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await signInWithPassword({
        email: email.trim(),
        password
      });
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : t("auth.errors.loginFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>{BRAND_NAME}</Text>
      <Text style={styles.title}>{t("auth.login.title")}</Text>
      <Text style={styles.subtitle}>{t("auth.login.subtitle")}</Text>

      <TextInput
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        placeholder={t("auth.login.emailPlaceholder")}
        placeholderTextColor={COLORS.textMuted}
        style={styles.input}
      />

      <TextInput
        value={password}
        onChangeText={setPassword}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder={t("auth.login.passwordPlaceholder")}
        placeholderTextColor={COLORS.textMuted}
        secureTextEntry
        style={styles.input}
      />

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Pressable style={styles.primaryAction} onPress={() => void handleSubmit()}>
        <Text style={styles.primaryActionText}>
          {submitting ? t("auth.login.submitting") : t("auth.login.submit")}
        </Text>
      </Pressable>

      <Pressable style={styles.secondaryAction} onPress={onOpenRegister}>
        <Text style={styles.secondaryActionText}>{t("auth.login.openRegister")}</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    alignSelf: "stretch",
    backgroundColor: COLORS.panel,
    borderColor: COLORS.borderStrong,
    borderRadius: 28,
    borderWidth: 1,
    gap: 14,
    padding: 20
  },
  eyebrow: {
    color: COLORS.accentSoft,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.3,
    textTransform: "uppercase"
  },
  title: {
    color: COLORS.text,
    fontSize: 28,
    fontWeight: "900"
  },
  subtitle: {
    color: COLORS.textMuted,
    fontSize: 14,
    lineHeight: 21
  },
  input: {
    backgroundColor: COLORS.field,
    borderColor: COLORS.border,
    borderRadius: 18,
    borderWidth: 1,
    color: COLORS.text,
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 14
  },
  errorText: {
    color: "#ffd8d8",
    fontSize: 13,
    lineHeight: 19
  },
  primaryAction: {
    alignItems: "center",
    backgroundColor: COLORS.accent,
    borderRadius: 18,
    paddingVertical: 15
  },
  primaryActionText: {
    color: "#101013",
    fontSize: 15,
    fontWeight: "900"
  },
  secondaryAction: {
    alignItems: "center",
    backgroundColor: COLORS.backgroundRaised,
    borderColor: COLORS.borderStrong,
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 14
  },
  secondaryActionText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "800"
  }
});
