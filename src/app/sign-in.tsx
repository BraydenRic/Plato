import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FirebaseError } from "firebase/app";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";

import { Button, Field } from "@/components/ui";
import { Palette, Radius, Spacing } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";

function friendlyAuthError(e: unknown): string {
  if (e instanceof FirebaseError) {
    switch (e.code) {
      case "auth/invalid-credential":
      case "auth/wrong-password":
      case "auth/user-not-found":
        return "Email or password is incorrect.";
      case "auth/email-already-in-use":
        return "An account with this email already exists.";
      case "auth/weak-password":
        return "Password must be at least 6 characters.";
      case "auth/invalid-email":
        return "That email address doesn't look right.";
      case "auth/network-request-failed":
        return "Network error — check your connection.";
    }
  }
  return "Something went wrong. Please try again.";
}

export default function SignInScreen() {
  const { signIn, signUp, signInWithGoogle, canUseGoogle } = useAuth();
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  async function submitGoogle() {
    setGoogleBusy(true);
    try {
      // Resolves false when the user dismissed Google's account picker —
      // nothing to report in that case.
      await signInWithGoogle();
    } catch (e) {
      Alert.alert("Google sign-in failed", e instanceof Error ? e.message : friendlyAuthError(e));
    } finally {
      setGoogleBusy(false);
    }
  }

  const isSignUp = mode === "signUp";
  const canSubmit = email.trim().length > 3 && password.length >= 6 && (!isSignUp || name.trim().length > 0);

  async function submit() {
    setBusy(true);
    try {
      if (isSignUp) await signUp(name, email, password);
      else await signIn(email, password);
      // Success: the auth guard in the root layout swaps to the app.
    } catch (e) {
      Alert.alert(isSignUp ? "Sign up failed" : "Sign in failed", friendlyAuthError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <View style={styles.logoMark}>
              <Image
                source={require("../../assets/images/plato-logo.png")}
                style={styles.logoImage}
                contentFit="contain"
              />
            </View>
            <Text style={styles.title}>Plato</Text>
            <Text style={styles.subtitle}>Log lifts. Build streaks. See progress.</Text>
          </View>

          {canUseGoogle && (
            <>
              <Pressable
                onPress={submitGoogle}
                disabled={googleBusy}
                style={({ pressed }) => [styles.googleButton, pressed && { opacity: 0.85 }]}>
                <Ionicons name="logo-google" size={18} color="#111" />
                <Text style={styles.googleButtonText}>
                  {googleBusy ? "Signing in…" : "Continue with Google"}
                </Text>
              </Pressable>
              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or</Text>
                <View style={styles.dividerLine} />
              </View>
            </>
          )}

          <View style={styles.form}>
            {isSignUp && (
              <Field
                placeholder="Name"
                autoCapitalize="words"
                autoComplete="name"
                value={name}
                onChangeText={setName}
              />
            )}
            <Field
              placeholder="Email"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
            <Field
              placeholder="Password"
              secureTextEntry
              autoComplete={isSignUp ? "new-password" : "current-password"}
              value={password}
              onChangeText={setPassword}
              onSubmitEditing={() => canSubmit && submit()}
            />
            <Button
              title={isSignUp ? "Create account" : "Sign in"}
              onPress={submit}
              loading={busy}
              disabled={!canSubmit}
            />
          </View>

          <Pressable onPress={() => setMode(isSignUp ? "signIn" : "signUp")} style={styles.switchRow}>
            <Text style={styles.switchText}>
              {isSignUp ? "Already have an account? " : "New to Plato? "}
              <Text style={styles.switchLink}>{isSignUp ? "Sign in" : "Create one"}</Text>
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Palette.bg,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    padding: Spacing.four,
    gap: Spacing.five,
  },
  hero: {
    alignItems: "center",
    gap: Spacing.two,
  },
  logoMark: {
    width: 72,
    height: 72,
    borderRadius: Radius.xl,
    backgroundColor: Palette.accentSoft,
    borderWidth: 1,
    borderColor: Palette.accent,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.two,
  },
  logoImage: {
    width: 44,
    height: 44,
  },
  title: {
    fontSize: 34,
    fontWeight: "800",
    color: Palette.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: Palette.textTertiary,
  },
  googleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.two,
    backgroundColor: "#fff",
    borderRadius: Radius.md,
    paddingVertical: 14,
  },
  googleButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111",
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
    marginVertical: -Spacing.two,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: Palette.border,
  },
  dividerText: {
    fontSize: 12,
    fontWeight: "600",
    color: Palette.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  form: {
    gap: Spacing.three,
  },
  switchRow: {
    alignItems: "center",
  },
  switchText: {
    fontSize: 14,
    color: Palette.textTertiary,
  },
  switchLink: {
    color: Palette.accentText,
    fontWeight: "600",
  },
});
