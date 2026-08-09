import { useEffect, useState } from "react";
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
import { useLocalSearchParams, useRouter } from "expo-router";
import { FirebaseError } from "firebase/app";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as AppleAuthentication from "expo-apple-authentication";
import { Image } from "expo-image";

import { Button, Field } from "@/components/ui";
import { Radius, Spacing } from "@/constants/theme";
import { makeStyles } from "@/context/AppearanceContext";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";

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
        return "Password must be at least 8 characters, with a letter and a number.";
      case "auth/too-many-requests":
        return "Too many attempts — wait a bit and try again.";
      case "auth/invalid-email":
        return "That email address doesn't look right.";
      case "auth/network-request-failed":
        return "Network error — check your connection.";
    }
  }
  return "Something went wrong. Please try again.";
}

export default function SignInScreen() {
  const styles = useStyles();
  const {
    signIn,
    signUp,
    signInWithGoogle,
    canUseGoogle,
    signInWithApple,
    canUseApple,
    resetPassword,
    isGuest,
    continueAsGuest,
  } = useAuth();
  const router = useRouter();
  const theme = useTheme();
  // Set when a guest opens this screen from Profile to claim their data, which
  // separates "upgrading" from a first run — the two need opposite behaviour.
  const { upgrade } = useLocalSearchParams<{ upgrade?: string }>();
  const isUpgrading = upgrade === "1";
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [appleBusy, setAppleBusy] = useState(false);
  const [appleReady, setAppleReady] = useState(false);

  // Entering guest mode mounts the app screens but doesn't move us there — this
  // screen stays available so guests can come back to upgrade. Step through
  // ourselves, except when a guest deliberately opened this screen to sign up.
  useEffect(() => {
    if (isGuest && !isUpgrading) router.replace("/");
  }, [isGuest, isUpgrading, router]);

  // Sign in with Apple needs iOS 13+; the check is async so it can't gate render directly.
  useEffect(() => {
    if (!canUseApple) return;
    AppleAuthentication.isAvailableAsync()
      .then(setAppleReady)
      .catch(() => setAppleReady(false));
  }, [canUseApple]);

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

  async function submitApple() {
    setAppleBusy(true);
    try {
      // Same contract as Google: false means the user closed the Apple sheet.
      await signInWithApple();
    } catch (e) {
      Alert.alert("Apple sign-in failed", e instanceof Error ? e.message : friendlyAuthError(e));
    } finally {
      setAppleBusy(false);
    }
  }

  const isSignUp = mode === "signUp";
  // New accounts need a real password; sign-in stays at Firebase's 6-char
  // minimum so accounts created before this rule can still get in.
  const strongPassword =
    password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password);
  const passwordsMatch = password === confirmPassword;
  const canSubmit =
    email.trim().length > 3 &&
    (isSignUp
      ? strongPassword && passwordsMatch && name.trim().length > 0
      : password.length >= 6);

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

  async function forgotPassword() {
    const target = email.trim();
    if (!target.includes("@")) {
      Alert.alert("Enter your email", "Type your email above, then tap Forgot password again.");
      return;
    }
    try {
      await resetPassword(target);
    } catch (e) {
      Alert.alert("Couldn't send reset email", friendlyAuthError(e));
      return;
    }
    // Firebase deliberately doesn't reveal whether the account exists, so the
    // confirmation is phrased the same way.
    Alert.alert(
      "Check your inbox",
      `If an account exists for ${target}, a reset link is on its way. Check spam if it doesn't show up.`
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <View
              style={[
                styles.logoMark,
                { backgroundColor: theme.accentSoft, borderColor: theme.accent },
              ]}>
              <Image
                source={require("../../assets/images/plato-logo.png")}
                style={styles.logoImage}
                contentFit="contain"
                tintColor={theme.accentText}
              />
            </View>
            <Text style={styles.title}>Plato</Text>
            <Text style={styles.subtitle}>Log lifts. Build streaks. See progress.</Text>
          </View>

          {isGuest && (
            <View
              style={[
                styles.migrateNote,
                { backgroundColor: theme.accentSoft, borderColor: theme.accent },
              ]}>
              <Ionicons name="cloud-upload-outline" size={16} color={theme.accentText} />
              <Text style={[styles.migrateNoteText, { color: theme.accentText }]}>
                Everything you&apos;ve logged on this phone moves into your account.
              </Text>
            </View>
          )}

          {(appleReady || canUseGoogle) && (
            <>
              <View style={styles.providers}>
                {appleReady && (
                  <AppleAuthentication.AppleAuthenticationButton
                    buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                    buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
                    cornerRadius={Radius.md}
                    style={styles.appleButton}
                    onPress={() => !appleBusy && submitApple()}
                  />
                )}
                {canUseGoogle && (
                  <Pressable
                    onPress={submitGoogle}
                    disabled={googleBusy}
                    style={({ pressed }) => [styles.googleButton, pressed && { opacity: 0.85 }]}>
                    <Ionicons name="logo-google" size={18} color="#111" />
                    <Text style={styles.googleButtonText}>
                      {googleBusy ? "Signing in…" : "Continue with Google"}
                    </Text>
                  </Pressable>
                )}
              </View>
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
            {isSignUp && password.length > 0 && !strongPassword && (
              <Text style={styles.passwordHint}>
                At least 8 characters, with a letter and a number.
              </Text>
            )}
            {isSignUp && (
              <Field
                placeholder="Confirm password"
                secureTextEntry
                autoComplete="new-password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                onSubmitEditing={() => canSubmit && submit()}
              />
            )}
            {isSignUp && confirmPassword.length > 0 && !passwordsMatch && (
              <Text style={styles.passwordHint}>Passwords don&apos;t match yet.</Text>
            )}
            {!isSignUp && (
              <Pressable onPress={forgotPassword} hitSlop={8} style={styles.forgotRow}>
                <Text style={[styles.forgotText, { color: theme.accentText }]}>Forgot password?</Text>
              </Pressable>
            )}
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
              <Text style={[styles.switchLink, { color: theme.accentText }]}>
                {isSignUp ? "Sign in" : "Create one"}
              </Text>
            </Text>
          </Pressable>

          {/* Guests arrive here from Profile, so they need a way back into the
              app they're already using. Everyone else gets the door in. */}
          {isUpgrading ? (
            <Pressable onPress={() => router.back()} style={styles.switchRow} hitSlop={8}>
              <Text style={styles.dismissText}>Not now</Text>
            </Pressable>
          ) : (
            /* Fenced off behind a rule rather than stacked under the sign-in ⇄
               create link: that link changes the form above it, this one skips
               the whole screen. Sharing their styling made them read as a pair
               of equal choices. Outlined instead of accent-coloured so it stays
               a real, reachable control without competing with signing in. */
            <View style={styles.guestBlock}>
              <View style={styles.guestSeparator} />
              <Pressable
                onPress={continueAsGuest}
                style={({ pressed }) => [styles.guestButton, pressed && { opacity: 0.7 }]}>
                <Text style={styles.guestButtonText}>Continue as guest</Text>
              </Pressable>
              <Text style={styles.guestHint}>
                Workouts save on this phone. Sign in later to sync them.
              </Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const useStyles = makeStyles((c) => ({
  safe: {
    flex: 1,
    backgroundColor: c.bg,
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
    borderWidth: 1,
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
    color: c.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: c.textTertiary,
  },
  providers: {
    gap: Spacing.three,
  },
  appleButton: {
    height: 48,
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
    backgroundColor: c.border,
  },
  dividerText: {
    fontSize: 12,
    fontWeight: "600",
    color: c.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  form: {
    gap: Spacing.three,
  },
  passwordHint: {
    fontSize: 13,
    color: c.textTertiary,
    marginTop: -Spacing.one,
    paddingHorizontal: Spacing.one,
  },
  forgotRow: {
    alignSelf: "flex-end",
    marginTop: -Spacing.one,
  },
  forgotText: {
    fontSize: 13,
    fontWeight: "600",
  },
  migrateNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.three,
    marginBottom: -Spacing.two,
  },
  migrateNoteText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  switchRow: {
    alignItems: "center",
  },
  guestBlock: {
    gap: Spacing.three,
  },
  guestSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: c.border,
  },
  // Matches the provider buttons' height and radius so it sits in the same
  // family, but outlined on the background instead of filled — present without
  // pulling attention off the primary action.
  guestButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: c.borderStrong,
  },
  guestButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: c.textSecondary,
  },
  guestHint: {
    fontSize: 12,
    lineHeight: 16,
    color: c.textTertiary,
    textAlign: "center",
  },
  dismissText: {
    fontSize: 14,
    fontWeight: "600",
    color: c.textSecondary,
  },
  switchText: {
    fontSize: 14,
    color: c.textTertiary,
  },
  switchLink: {
    fontWeight: "600",
  },
}));
